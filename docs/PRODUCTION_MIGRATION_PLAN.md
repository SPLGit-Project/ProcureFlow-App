# ProcureFlow Expansion — Production Migration Plan

**Branch:** `feature/expansion` → `main`  
**Plan date:** 2026-05-08  
**Commits ahead of main:** 49  
**Files changed:** 93 files · +23,513 / −916 lines  
**Migrations to apply:** 16 (all new, none modify existing tables destructively)

---

## Executive Summary

The expansion branch adds a complete governed **item creation lifecycle** on top of the existing PO/procurement system. It introduces new tables, enums, functions, RLS policies, edge functions, cron jobs, and a large set of new UI pages and wizards — without modifying or dropping any data that exists on `main`.

The production deployment is **zero-downtime compatible** because:
- Every migration uses `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` guards
- No existing columns are dropped or renamed
- No existing enum values are removed
- Feature flags in `app_config` default to `false`, so no new UI surface is visible to users until you explicitly enable each flag
- The only destructive operation in the entire migration set is `PARTIALLY_RECEIVED` sanitization, which was already applied to the expansion branch's Supabase instance

---

## Part 1 — Pre-Merge Checklist

Complete every item in this part **before** merging or applying anything to production.

### 1.1 — Branch hygiene

| # | Check | How to verify |
|---|-------|---------------|
| 1 | Feature branch builds cleanly | `npm run build:prod` — zero TypeScript errors |
| 2 | No uncommitted changes | `git status` — working tree clean |
| 3 | Branch is up to date | `git log main..HEAD` — all 49 commits are intentional |
| 4 | No console errors on key pages | Manual smoke-test: Dashboard, Item Requests, Item Catalogue, Settings |
| 5 | `public/version.json` is bumped | Ensure the version number reflects the expansion release |

### 1.2 — Supabase project confirmation

| # | Check | How to verify |
|---|-------|---------------|
| 6 | Confirm target Supabase project ID | Supabase dashboard → Project Settings |
| 7 | Confirm `pg_cron` extension is enabled | SQL: `SELECT * FROM pg_extension WHERE extname = 'pg_cron';` |
| 8 | Confirm `pg_net` extension is enabled | SQL: `SELECT * FROM pg_extension WHERE extname = 'pg_net';` |
| 9 | Confirm `btree_gist` extension is enabled | SQL: `SELECT * FROM pg_extension WHERE extname = 'btree_gist';` — needed for date-range exclusion constraints |
| 10 | Confirm `app.settings.supabase_url` GUC is set | Required by cron job migration; set via Supabase dashboard → Database → Extensions / Vault |
| 11 | Confirm `app.settings.service_role_key` GUC is set | Same as above |
| 12 | Backup production database | Supabase dashboard → Project Settings → Database → Download backup |

### 1.3 — Roles and permissions audit

The expansion adds these new `PermissionId` values that do not exist on `main`:

| New permission | Purpose | Who should have it |
|---|---|---|
| `approve_item_requests` | Approve item creation requests | Approvers, Admin |
| `manage_item_requests` | Create and manage item requests | Procurement, Admin |
| `manage_item_definition` | Master Data QA + Procurement Queue | Master Data team, Admin |
| `manage_purchase_pricing` | Set and update purchase prices | Purchasing, Admin |
| `view_purchase_pricing` | Read purchase prices | Purchasing, Finance, Admin |
| `manage_sell_pricing` | Set and update sell prices | Pricing team, Admin |
| `view_sell_pricing` | Read sell prices | Sales, Finance, Admin |
| `override_margin_threshold` | Override margin approval gate | Finance Manager, Admin |
| `manage_pricing_schedules` | Create/edit pricing schedules | Pricing team, Admin |
| `publish_items` | Trigger item publication to external systems | Admin, Integrations |
| `view_items` | Read item catalogue | All non-guest roles (likely already assigned) |

**Action required:** Before going live, update each role's permissions array in the Admin Panel → Settings → Roles to include the applicable new permissions. The `Beta Tester` role is seeded by migration with a default set; all other roles retain their existing permissions and are unchanged until you edit them.

### 1.4 — Feature flags (all default to `false`)

These flags are seeded with safe defaults. Review each one and decide when to enable it.

| Flag key | Default | Meaning |
|---|---|---|
| `item_request_form_enabled` | `false` | Show the new Item Request wizard to all users |
| `approved_catalogue_enforced` | `false` | Require PO items to have an active governed sell price |
| `legacy_item_editing_locked` | `false` | Block direct unit_price edits on governed items |
| `item_creation_preview_enabled` | `true` | Visible to `manage_development` users only |
| `ui_revamp_enabled` | `true` | New floating header / expandable sidebar UI |
| `smart_buying_v2_enabled` | `false` | Live BundleConnect data in Smart Buying |
| `integrations_enabled` | `false` | BundleConnect sync infrastructure |
| `phase8_cutover_ready` | `false` | Informational — set by Admin after readiness checks pass |

> **Recommended go-live order:** `ui_revamp_enabled` (UX only, safe) → `item_request_form_enabled` (enables wizard for all users) → `approved_catalogue_enforced` (enforces governance on POs).

---

## Part 2 — Database Migration Sequence

Apply these **16 migrations in the exact order listed** via Supabase's migration runner or the MCP `apply_migration` tool. All migrations are idempotent — safe to re-run if one fails partway through.

> **Important:** Migrations 13 and 14 must be applied as **two separate operations** (they are already split into one file, but the enum step in Part 1 of migration 16 must be committed before the index in Part 2 can reference the new enum value). Supabase's migration runner handles this automatically; if applying manually via psql, run in separate transactions.

| # | File | What it does | Risk |
|---|------|-------------|------|
| 1 | `20260427000000_item_creation_preview.sql` | Creates 9 `preview_*` sandbox tables + RLS + feature-flag seeds. Fully isolated from live data. | None |
| 2 | `20260429000000_expansion_phase0_foundation.sql` | Seeds `ui_revamp_enabled`, `smart_buying_v2_enabled`, `integrations_enabled` flags. Inserts `beta_tester` role. | None — `ON CONFLICT DO NOTHING` |
| 3 | `20260429000001_expansion_phase2a_reference_data.sql` | Seeds reference data for `PREVIEW_CUSTOMER_PRICING_GROUP`, `PREVIEW_SAP_MAPPING`, `PREVIEW_SUPPLIER_EXT` attribute option types. | None — `ON CONFLICT DO NOTHING` |
| 4 | `20260429000002_item_approval_rules.sql` | Creates `item_approval_rules` table with RLS. No data seeded. | None |
| 5 | `20260429000003_bundle_connect_sync.sql` | Creates `bundle_connect_sync_config`, `bundle_connect_sync_jobs`, `bundle_connect_sync_metrics` tables. No live data touched. | None |
| 6 | `20260429000004_smart_buying_v2.sql` | Creates `short_supply_plans`, `smart_buying_item_properties` tables. No live data touched. | None |
| 7 | `20260429000005_phase6_rls_hardening.sql` | Tightens RLS on preview tables. Creates `approved_items` view. Seeds `margin_thresholds` config. | None — only adds/replaces policies |
| 8 | `20260430000000_kill_partially_received_for_good.sql` | Updates any remaining `PARTIALLY_RECEIVED` PO records to `ACTIVE`. Recreates `admin_update_delivery_line_qty` RPC without the legacy status. | **Low** — data update, but only affects records in a deprecated status. Verify no records exist first (see Pre-check below). |
| 9 | `20260504000001_item_purchase_prices.sql` | Creates `item_purchase_prices` table + immutability trigger + RLS + `btree_gist` date-range exclusion constraint. | None |
| 10 | `20260504000002_item_sell_prices.sql` | Creates `item_sell_prices` table + margin approval trigger + sync-to-items trigger + RLS. | None |
| 11 | `20260504000003_item_requests.sql` | Creates `item_request_status` enum + `item_requests` table + `item_request_revisions` table + auto-number trigger + urgency trigger + stage-timestamp trigger + RLS. | None |
| 12 | `20260504000004_item_duplicate_checks.sql` | Creates `item_duplicate_checks` table + immutability trigger + RLS. | None |
| 13 | `20260504000005_item_approval_tables.sql` | Creates `item_approval_instances` + `item_approval_decisions` tables + RLS. | None |
| 14 | `20260504000006_publication_and_schedules.sql` | Creates `item_publication_events`, `item_completeness_checks`, `pricing_schedules`, `pricing_schedule_lines` tables + enums + RLS. | None |
| 15 | `20260504000007_db_functions_and_views.sql` | Creates `resolve_item_price()`, `resolve_purchase_cost()`, `v_current_item_prices` view, `evaluate_item_approval_rules()` function. Pure additions. | None |
| 16 | `20260504000008_execute_pricing_schedule.sql` | Creates `execute_pricing_schedule()` atomic function. Pure addition. | None |
| 17 | `20260504000009_permissions_and_migration.sql` | Adds `item_workflow_status` enum + workflow columns to `items`. Seeds `margin_approval_threshold`, `item_request_form_enabled`, `approved_catalogue_enforced`, `legacy_item_editing_locked` flags. **Migrates existing `items.unit_price` values → `item_sell_prices` as LEGACY records.** | **Medium** — data migration. Review pre-check below. |
| 18 | `20260504000010_cron_jobs.sql` | Registers two `pg_cron` jobs: `activate-future-prices-daily` (1 AM UTC) and `check-sla-breaches-hourly`. Requires `pg_cron` + GUCs to be set (see pre-check 1.2). | **Low** — will fail gracefully if GUCs not set; no data risk. |
| 19 | `20260504000011_migrate_catalog_items.sql` | Migrates `catalog_items` → `item_purchase_prices` (uses `ON CONFLICT DO NOTHING`). Historical prices are preserved. | **Low** — additive only, existing catalog_items rows remain unchanged. |
| 20 | `20260504000012_phase8_cutover_notes.sql` | Seeds `phase8_cutover_ready = false` in `app_config`. No structural changes. | None |
| 21 | `20260505200000_item_request_deletion.sql` | Replaces `ir_no_delete` RLS policy with `ir_delete_policy` (owner pre-approval + admin any-time). Adds `delete_item_request_and_cascade()` RPC. | None — only affects `item_requests` table, which is new |
| 22 | `20260508000000_procurement_review_and_spec_columns.sql` | Adds `PROCUREMENT_REVIEW` enum value to `item_request_status`. Adds spec columns and wizard-helper columns to `item_requests`. Recreates stage-timestamp trigger. Adds partial index. **Must run after migration 11.** | None |

### Pre-checks before running migrations 8 and 17

**Migration 8 pre-check — PARTIALLY_RECEIVED records:**
```sql
SELECT COUNT(*) FROM po_requests WHERE status = 'PARTIALLY_RECEIVED';
```
Expected result: `0` (already sanitized on expansion branch). If > 0, note the count and review each record before proceeding.

**Migration 17 pre-check — items.unit_price migration:**
```sql
SELECT COUNT(*) FROM items WHERE unit_price IS NOT NULL AND unit_price > 0 AND active_flag = true;
```
This is the number of legacy price records that will be migrated. Each becomes a `LEGACY`-noted row in `item_sell_prices` with `cost_basis = 0`. After migration, verify the count:
```sql
SELECT COUNT(*) FROM item_sell_prices WHERE notes LIKE 'Migrated from legacy%';
```
The two counts should match.

---

## Part 3 — Edge Function Deployments

Two new Edge Functions must be deployed to Supabase **after** the migrations.

| Function | Directory | Purpose |
|---|---|---|
| `activate-future-prices` | `supabase/functions/activate-future-prices/` | Scheduled daily at 1 AM UTC. Activates pricing schedule lines whose `effective_from` date has passed. |
| `notify-sla-breach` | `supabase/functions/notify-sla-breach/` | Scheduled hourly. Checks item requests approaching or breaching SLA thresholds and sends notifications. |

**Deploy commands (via Supabase CLI):**
```bash
supabase functions deploy activate-future-prices --project-ref <your-project-ref>
supabase functions deploy notify-sla-breach --project-ref <your-project-ref>
```

> **Note:** The existing `send-invite-email`, `sync-directory`, `sync-short-supply`, and `directory-suggest` functions are unchanged and do not need redeployment.

---

## Part 4 — Git Merge Strategy

### 4.1 — Recommended approach: Squash merge

The expansion branch has 49 commits including several intermediate fix commits and reverts. For `main`, a clean history is preferable.

```bash
# On main branch:
git checkout main
git merge --squash feature/expansion
git commit -m "feat: governed item creation lifecycle (expansion branch)"
```

### 4.2 — Alternative: Standard merge (preserves full history)

If you want the full commit history in `main` for auditability:
```bash
git checkout main
git merge feature/expansion --no-ff -m "Merge feature/expansion: governed item creation lifecycle"
```

### 4.3 — Post-merge steps
```bash
# Verify build still passes after merge
npm run build:prod

# Tag the release
git tag v2.0.0-expansion
git push origin main --tags
```

---

## Part 5 — Frontend Deployment

No additional build configuration is required. The frontend is deployed as a standard Vite build.

```bash
npm ci                  # Installs @playwright/test (new devDependency)
npm run build:prod      # Compiles TypeScript + bundles for production
```

**New dependency to be aware of:**
- `@playwright/test ^1.59.1` — added as a devDependency for E2E tests. It is not included in the production bundle. No action needed in CI/CD unless you are also running E2E tests in your pipeline (see Part 7).

---

## Part 6 — Post-Deployment Smoke Tests

Perform these manual checks immediately after deployment and migration.

### 6.1 — Existing functionality (regression)
| # | Test | Expected |
|---|------|---------|
| 1 | Log in as a standard user | Dashboard loads, no errors |
| 2 | Create a new PO request | Form submits successfully |
| 3 | Approve a pending PO | Status transitions correctly |
| 4 | View Finance Review | Existing POs visible |
| 5 | Admin Panel → Settings | All tabs load; no blank panels |
| 6 | Smart Buying | Dashboard loads; existing plans visible |

### 6.2 — New item lifecycle features
| # | Test | Expected |
|---|------|---------|
| 7 | Navigate to `/items/new-request` | ItemRequestWizard loads |
| 8 | Complete Step 1 (transaction type) | Continue button active; step pill advances |
| 9 | Complete Step 2 (item code builder) | Code preview updates live |
| 10 | Step 2 → select "Other" for Material | Custom text input appears; value saves to localStorage |
| 11 | Step 4 (Review) with missing attributes | Amber warning panel lists missing fields; SLA shows +24h |
| 12 | Submit a new item request | Request appears in My Item Requests |
| 13 | Log in as a `manage_item_definition` user | Duplicate Check Wizard accessible from queue |
| 14 | Complete Duplicate Check | Request transitions to `PROCUREMENT_REVIEW` |
| 15 | Procurement Queue page | Request appears; "Start Review" button navigates to wizard |
| 16 | Item Catalogue | Existing items visible; workflow status shows `LEGACY` |
| 17 | Admin → Cutover Readiness Checker | Panel loads; all checks run |
| 18 | Cancel button in wizard header | Navigates back; no stale state |
| 19 | Previous button in wizard header | Returns to prior step with form state preserved |

### 6.3 — Feature flag verification
| # | Test | Expected |
|---|------|---------|
| 20 | `item_request_form_enabled = false` | `/items/new-request` not visible in sidebar to non-dev users |
| 21 | Set `item_request_form_enabled = true` | Link appears in sidebar; wizard accessible |
| 22 | `approved_catalogue_enforced = false` | PO creation works with any item, no blocking |

---

## Part 7 — E2E Test Suite (Optional CI Step)

A Playwright E2E test suite was added as part of the expansion. These tests can be integrated into your CI pipeline.

```bash
# Install browsers once (first setup)
npx playwright install

# Run all tests headlessly
npm test

# Run with UI (local debugging)
npm run test:ui
```

Test files located in `tests/e2e/`:
- `navigation.spec.ts` — Sidebar and routing
- `item-catalogue.spec.ts` — Item Catalogue page
- `item-approval-queue.spec.ts` — Approval queue
- `settings-item-creation.spec.ts` — Item creation settings
- `smart-buying.spec.ts` — Smart Buying dashboard
- `help-guide.spec.ts` — Help & Support
- `regression-po-workflow.spec.ts` — Existing PO workflow regression

---

## Part 8 — Rollback Plan

The expansion is designed to be non-destructive, so a full rollback is only needed if a critical regression is found in existing PO/approval functionality.

### 8.1 — Application rollback (fast)
Revert to the previous frontend build. Because all feature flags default to `false`, the new UI surfaces will simply not appear. This restores the visual experience to pre-expansion state without any database changes.

### 8.2 — Database rollback (if required)

The migrations are **not automatically reversible** — they do not have `down` scripts. However:

| Migration type | Rollback approach |
|---|---|
| New tables (`preview_*`, `item_requests`, `item_purchase_prices`, etc.) | `DROP TABLE` — safe, no live data in these tables on first deployment |
| Columns added to `items` (`workflow_status`, `current_request_id`, etc.) | `ALTER TABLE items DROP COLUMN` — safe for new columns |
| Data migration: `item_sell_prices` from `items.unit_price` | Delete rows `WHERE notes LIKE 'Migrated from legacy%'` |
| Data migration: `item_purchase_prices` from `catalog_items` | Delete rows inserted by migration 19 (identifiable by `notes = 'Migrated...'`) |
| `PARTIALLY_RECEIVED` → `ACTIVE` (migration 8) | **Not reversible** — these records were in a deprecated status. Restore from backup if needed. |
| Enum values added (`PROCUREMENT_REVIEW`, `item_workflow_status`) | PostgreSQL does not support removing enum values without a full enum rebuild. Not reversible without migration. |
| `pg_cron` jobs | `SELECT cron.unschedule('activate-future-prices-daily'); SELECT cron.unschedule('check-sla-breaches-hourly');` |

> **Recommendation:** If any critical issue arises post-deployment, roll back the frontend build first (takes < 5 minutes), diagnose the issue, then decide if database rollback is needed. In most cases the frontend rollback alone is sufficient because all new functionality is flag-guarded.

### 8.3 — Backup restore (last resort)
If a database rollback is necessary, restore the backup taken in pre-check step 12 via Supabase dashboard → Database → Restore from backup. This is a full database restore and will revert all migrations.

---

## Part 9 — Post-Go-Live: Enabling Features Progressively

This plan is recommended for a controlled rollout after the technical migration is complete.

### Wave 1 — Day 0 (deployment day)
Enable immediately — these are safe, UX-only:
- `ui_revamp_enabled = true` (already seeded as true)

### Wave 2 — Week 1 (internal team only)
Grant `manage_item_definition` permission to Master Data team.  
Grant `approve_item_requests` permission to Approver roles.  
Keep `item_request_form_enabled = false`.  
Test end-to-end item request lifecycle with internal users only.

### Wave 3 — Week 2 (wider rollout)
Set `item_request_form_enabled = true` — all users with `create_request` permission can now submit item requests.  
Monitor Procurement Queue and Master Data Queue for activity.

### Wave 4 — Week 3–4 (governance enforcement)
Review legacy price migration quality (check `cost_basis = 0` records in `item_sell_prices`).  
Update cost_basis values for migrated records.  
Set `approved_catalogue_enforced = true` to enforce the governed catalogue on PO creation.

### Wave 5 — As needed
`legacy_item_editing_locked = true` — locks direct price edits on governed items. Only enable once all items have been reviewed under the new system.

---

## Appendix A — Migration Application Order (Quick Reference)

```
1.  20260427000000_item_creation_preview.sql
2.  20260429000000_expansion_phase0_foundation.sql
3.  20260429000001_expansion_phase2a_reference_data.sql
4.  20260429000002_item_approval_rules.sql
5.  20260429000003_bundle_connect_sync.sql
6.  20260429000004_smart_buying_v2.sql
7.  20260429000005_phase6_rls_hardening.sql
8.  20260430000000_kill_partially_received_for_good.sql       ← pre-check required
9.  20260504000001_item_purchase_prices.sql
10. 20260504000002_item_sell_prices.sql
11. 20260504000003_item_requests.sql
12. 20260504000004_item_duplicate_checks.sql
13. 20260504000005_item_approval_tables.sql
14. 20260504000006_publication_and_schedules.sql
15. 20260504000007_db_functions_and_views.sql
16. 20260504000008_execute_pricing_schedule.sql
17. 20260504000009_permissions_and_migration.sql              ← pre-check + data migration
18. 20260504000010_cron_jobs.sql                             ← requires pg_cron GUCs
19. 20260504000011_migrate_catalog_items.sql
20. 20260504000012_phase8_cutover_notes.sql
21. 20260505200000_item_request_deletion.sql
22. 20260508000000_procurement_review_and_spec_columns.sql
```

## Appendix B — New Routes Added

| Path | Component | Permission required |
|---|---|---|
| `/items/new-request` | ItemRequestWizard | `create_request` |
| `/items/my-requests` | MyItemRequests | `view_dashboard` |
| `/items/master-data-queue` | MasterDataQueue | `manage_item_definition` |
| `/items/procurement-queue` | ProcurementQueue | `manage_item_definition` |
| `/items/pricing-queue` | PricingReviewQueue | `manage_sell_pricing` |
| `/items/requests/:id` | ItemRequestDetail | `view_dashboard` |
| `/items/requests/:id/duplicate-check` | DuplicateCheckWizard | `manage_item_definition` |
| `/items/requests/:id/procurement-review` | ProcurementReviewWizard | `manage_item_definition` |
| `/items/requests/:id/define` | ItemDefinitionWizard | `manage_item_definition` |
| `/items/requests/:id/pricing` | PricingSetupWizard | `manage_sell_pricing` |
| `/items/requests/:id/approval-review` | ApprovalReviewWizard | `approve_item_requests` |
| `/item-catalogue` | ItemCatalogue | `view_items` |
| `/approvals` | ApprovalQueue (replaces POList filter) | `approve_item_requests` |
| `/pricing/dashboard` | PriceManagementDashboard | `manage_sell_pricing` |
| `/pricing/schedules` | PricingSchedulesList | `manage_pricing_schedules` |
| `/pricing/schedules/:id` | PricingScheduleForm | `manage_pricing_schedules` |
| `/admin/approval-rules` | ApprovalRulesConfig | `manage_settings` |
| `/admin/tools` | AdminTools | `manage_settings` |
| `/admin/cutover` | CutoverReadinessChecker | `manage_settings` |
| `/admin/colours` | ColourPaletteAdmin | `manage_settings` |

## Appendix C — Compatibility Notes

- **`/approvals` route change:** On `main`, this route renders `<POList filter="PENDING">`. On expansion it renders `<ApprovalQueue>`. Existing users with bookmarks to `/approvals` will land on the new queue page. The new page covers both PO approvals and item request approvals. If this change is not desired immediately, a feature-flag guard can be added to `App.tsx` to render the old or new component based on `featureFlags.item_request_form_enabled`.

- **Navigation change:** The sidebar navigation has been significantly expanded with categories. Users will see new sections (Items, Pricing, Admin) in the sidebar. Sections are filtered by permission, so users only see what they have access to. No existing nav item has been removed (Dashboard, Create Request, Requests, Smart Buying, Finance Review, Reports, Settings, Help & Support all remain).

- **`manage_development` permission:** This existed on `main` and is unchanged. All expansion features visible only to `manage_development` users will already work for existing users who hold this permission.
