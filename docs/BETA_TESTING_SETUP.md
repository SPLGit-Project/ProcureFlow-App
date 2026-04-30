# ProcureFlow — Beta Testing Setup Guide

> **Audience:** An agent or developer executing the full expansion test setup from scratch.
> **Goal:** Put ProcureFlow into a state that mirrors go-live exactly, with all new features unlocked for a designated tester, while production users remain completely unaffected.

---

## How the Feature Flag System Works

All new features are gated by rows in the `app_config` table (Supabase). The frontend reads these on login via `db.getFeatureFlags()` in `services/db.ts`. The mapping between DB keys and in-code names is:

| `app_config` key | Code name (`FeatureFlags`) | Default if missing | What it controls |
|---|---|---|---|
| `ui_revamp_enabled` | `uiRevampEnabled` | `false` | Floating nav rail, new header, dark nocturne theme |
| `preview_enabled` | `previewEnabled` | `false` | Item Creation nav item visible in sidebar |
| `preview_write_block` | `previewWriteBlock` | `true` | When `true`, all item creation writes are silently blocked. Must be `false` for testing. |
| `go_live_enabled` | `goLiveEnabled` | `false` | When `true`, approved items graduate from preview tables into the live `items` table. Keep `false` until testers sign off. |
| `smart_buying_v2_enabled` | `smartBuyingV2Enabled` | `false` | Live BundleConnect data mode in Smart Buying |
| `integrations_enabled` | `integrationsEnabled` | `false` | External API calls (Salesforce, Bundle, SAP). Not ready — leave `false`. |

> **Critical:** `ui_revamp_enabled` defaults to `true` in `DEFAULT_FEATURE_FLAGS` in `AppContext.tsx` (line ~253) but is `false` in the DB. This means the revamp UI is active only if the DB row is set. Confirm the DB row before testing.

---

## Step 1 — Establish the Database Target

**Decision required before proceeding:**

| Option | Pros | Cons |
|---|---|---|
| **Same Supabase project as production** | No data migration, real data for testing | Feature flags are global — must be tightly controlled |
| **Separate staging Supabase project** | Full isolation, safe to break | Requires re-seeding reference data (sites, suppliers, items, users) |

The guide assumes the **same Supabase project** with feature flags controlling who sees what. If using a separate project, apply all migrations and seed reference data before continuing.

---

## Step 2 — Apply Pending Migrations (in order)

All migration files are in `supabase/migrations/`. Apply them in filename order (chronological). The following are the expansion-specific migrations that must be confirmed applied:

### 2a. Check which migrations are already applied

```sql
SELECT key, value, updated_at
FROM app_config
WHERE key IN (
  'ui_revamp_enabled', 'preview_enabled', 'preview_write_block',
  'go_live_enabled', 'smart_buying_v2_enabled', 'integrations_enabled'
)
ORDER BY key;
```

If this returns rows, at least the Phase 0 foundation migration has run. If it returns nothing, start from 2b.

Also verify the preview tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'preview_%'
ORDER BY table_name;
```

Expected tables: `preview_item_approval_instances`, `preview_item_approval_rules`, `preview_item_audit_logs`, `preview_item_requests`, `preview_publication_events`, `preview_item_reference_overlays`.

### 2b. Apply migrations in this order

Run each file's SQL in the Supabase SQL editor (or via MCP `execute_sql`). Apply in strict order — later migrations depend on earlier ones.

| Order | File | What it creates |
|---|---|---|
| 1 | `20260427000000_item_creation_preview.sql` | 10 preview tables + initial `app_config` rows for old-style item creation flags |
| 2 | `20260429000000_expansion_phase0_foundation.sql` | `ui_revamp_enabled`, `smart_buying_v2_enabled`, `integrations_enabled` flags + `Beta Tester` role + `approve_item_requests` permission |
| 3 | `20260429000001_expansion_phase2a_reference_data.sql` | Reference data extensions (`attribute_options` additions for new attribute types) |
| 4 | `20260429000002_item_approval_rules.sql` | `item_approval_rules` table with 8 default routing rules |
| 5 | `20260429000003_bundle_connect_sync.sql` | BundleConnect sync tracking tables (Smart Buying v2 infrastructure) |
| 6 | `20260429000004_smart_buying_v2.sql` | `short_supply_plans` and reference tables for Smart Buying v2 |
| 7 | `20260429000005_phase6_rls_hardening.sql` | RLS hardening on preview tables + `approved_items` view + `margin_thresholds` in `app_config` |

> **If a migration fails** with "already exists" errors, the table/row was created by a prior run. Wrap the failing statement in `IF NOT EXISTS` or skip it — do not re-run the whole file.

---

## Step 3 — Configure Feature Flags for Testing

Run this block in the Supabase SQL editor. It sets all flags to their testing values using `ON CONFLICT DO UPDATE` so it is safe to run multiple times.

```sql
-- ── Feature flags for beta testing ──────────────────────────────────────────
INSERT INTO app_config (key, value, updated_at)
VALUES
  ('ui_revamp_enabled',       'true'::jsonb,  NOW()),
  ('preview_enabled',         'true'::jsonb,  NOW()),
  ('preview_write_block',     'false'::jsonb, NOW()),  -- MUST be false to allow writes
  ('go_live_enabled',         'false'::jsonb, NOW()),  -- keep false; flipped only at go-live
  ('smart_buying_v2_enabled', 'true'::jsonb,  NOW()),
  ('integrations_enabled',    'false'::jsonb, NOW())   -- external APIs not ready
ON CONFLICT (key) DO UPDATE
  SET value      = EXCLUDED.value,
      updated_at = EXCLUDED.updated_at;
```

Verify after running:

```sql
SELECT key, value FROM app_config
WHERE key IN (
  'ui_revamp_enabled','preview_enabled','preview_write_block',
  'go_live_enabled','smart_buying_v2_enabled','integrations_enabled'
)
ORDER BY key;
```

Expected result:

| key | value |
|---|---|
| `go_live_enabled` | `false` |
| `integrations_enabled` | `false` |
| `preview_enabled` | `true` |
| `preview_write_block` | `false` |
| `smart_buying_v2_enabled` | `true` |
| `ui_revamp_enabled` | `true` |

---

## Step 4 — Set Up the Beta Tester Role

Migration `20260429000000` already inserts a `Beta Tester` role. Verify it exists:

```sql
SELECT id, name, permissions
FROM roles
WHERE id = 'beta_tester';
```

If missing, insert it manually:

```sql
INSERT INTO roles (id, name, description, is_system, permissions)
VALUES (
  'beta_tester',
  'Beta Tester',
  'Access to expansion features under development.',
  false,
  ARRAY[
    'view_dashboard', 'view_items', 'view_stock', 'view_suppliers',
    'view_sites', 'view_active_requests', 'view_completed_requests',
    'create_request', 'view_all_requests', 'approve_requests',
    'receive_goods', 'view_finance', 'manage_development',
    'approve_item_requests', 'manage_items', 'view_security',
    'manage_settings', 'view_notifications', 'view_branding',
    'view_mapping', 'view_workflow'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET permissions = EXCLUDED.permissions,
      description = EXCLUDED.description;
```

> **Key permissions for testing item creation:**
> - `manage_development` — unlocks Item Creation nav item and development-gated UI
> - `approve_item_requests` — unlocks Item Approvals nav item and queue
> - `manage_items` — unlocks Settings → Item Creation tab
> - `manage_settings` — unlocks all other admin Settings tabs

### Assign the role to your test account

Look up your user ID first:

```sql
SELECT id, email, name FROM directory WHERE email = 'your-test-email@splservices.com.au';
```

Then assign the role (replace `<user-id>` with the result):

```sql
UPDATE directory
SET role_id = 'beta_tester'
WHERE id = '<user-id>';
```

> The role is stored in the `directory` table (ProcureFlow's user directory), not directly in `auth.users`. The app reads permissions from `directory.role_id → roles.permissions[]` on login.

---

## Step 5 — Verify the Setup

Log out and log back in (feature flags and permissions are loaded fresh on each login). Then check:

### Sidebar navigation (revamp mode)
- [ ] Floating dark rail visible on left (nocturne background)
- [ ] **Item Creation** appears in the nav (gated by `preview_enabled` + `manage_development`)
- [ ] **Item Approvals** appears in the nav (gated by `approve_item_requests`)
- [ ] **Item Catalogue** appears in the nav (gated by `view_items`)

### Admin Panel tabs
- [ ] Settings → Admin Portal header shows tab bar in the floating top header
- [ ] **Item Creation** tab is visible (gated by `manage_items`)

### Database sanity check
```sql
-- Confirm preview tables are empty (clean start)
SELECT 'preview_item_requests' AS tbl, COUNT(*) FROM preview_item_requests
UNION ALL
SELECT 'preview_item_approval_instances', COUNT(*) FROM preview_item_approval_instances
UNION ALL
SELECT 'preview_publication_events', COUNT(*) FROM preview_publication_events;
```

---

## Step 6 — End-to-End Test Paths

### 6a. Item Creation — Golden Path

1. Navigate to **Item Creation** (sidebar)
2. WORKBENCH tab → fill a **Standard** type request:
   - Description, business unit, branch site, business reason
   - Attach a spec sheet (optional)
3. Click **Check for Duplicates** → confirm engine runs and returns scored candidates or "No duplicates found"
4. Confirm SKU is auto-generated in the format `[CATEGORY_CODE]-[PRODUCT_TYPE_CODE]-[SEQUENCE]`
5. Enter **Purchase Pricing**: supplier, purchase price ex GST, UOM, landed cost auto-calculates
6. Enter **Sell Pricing** (Standard type):
   - Enter a sell price that gives margin > 25% → no approval warning should appear
   - Lower the sell price until margin < 25% → amber approval warning should appear
7. Toggle publication targets (Bundle, LinenHub, Salesforce)
8. Click **Submit** → status should change from `Draft` → `Submitted`
9. Navigate to **REQUESTS tab** → confirm the request appears with `Submitted` status

### 6b. Approval Path

1. Navigate to **Item Approvals** (sidebar)
2. Find the submitted request — SLA countdown should be visible
3. Open the review panel — confirm all sections are populated (item details, pricing, margin %, publication targets)
4. Click **Approve** → add a comment → confirm
5. Status should change to `Approved`
6. Navigate to **Item Catalogue** → the approved item should appear in the list

### 6c. Revision Path

1. Submit a new request with sell price giving margin significantly below 25%
2. In Item Approvals → select **Request Revision** with a comment
3. Status should change to `Revision Required`
4. Navigate back to Item Creation → REQUESTS tab → find the request
5. Edit and resubmit → status returns to `Submitted`

### 6d. Configurable Margin Threshold

1. Go to Settings → Admin Portal → **Item Creation** tab
2. Find the Margin Thresholds section — confirm the default (25%) is displayed
3. Change the Standard threshold to 30% → Save
4. Create a new item request with sell price giving 27% margin
5. Confirm the approval warning now fires (was previously below threshold)

### 6e. Smart Buying v2 (if Azure proxy is available)

1. Navigate to **Smart Buying**
2. Toggle "Live Data" mode — site selector should appear
3. Select a site → data should load from BundleConnect (via Azure proxy)
4. STAR days column should be populated
5. If proxy not deployed: manual upload mode should still function identically to current production

### 6f. Existing PO Workflow Regression

Run these to confirm nothing broken by new code:

1. Create Request → complete a full PO (all fields) → Submit
2. Approvals → approve the PO
3. Requests list → receive goods on a line
4. Finance Review → cost-code the PO
5. History → confirm audit log has entries for all steps

---

## Step 7 — Approval Rules Reference

Migration `20260429000002_item_approval_rules.sql` seeds default approval routing rules. Verify they loaded:

```sql
SELECT rule_name, condition_type, condition_value, approver_type, sla_hours, is_active
FROM item_approval_rules
ORDER BY sequential_stage_order;
```

The 8 default rules are:
| Rule | Condition | Approver |
|---|---|---|
| Standard Margin Check | `MARGIN_BELOW` 25% | Commercial Manager role |
| Purchase Only | `PURCHASE_ONLY` | Procurement role |
| Below Floor Margin | `MARGIN_BELOW` 15% | CFO role |
| Customer Specific | `CUSTOMER_SPECIFIC` | Account Manager role |
| Contract Pricing | `CONTRACT` | Contracts role |
| COG Item | `COG` | COG Specialist role |
| Urgent Request | `URGENT` | Procurement Manager role |
| Default Catch-All | `DEFAULT` | Procurement role |

Rules can be edited via Settings → Admin Portal → Item Creation → Approval Rules section.

---

## Step 8 — What Is NOT Being Tested Yet

| Feature | Status | Reason |
|---|---|---|
| Salesforce integration | Off (`integrations_enabled = false`) | External API not confirmed |
| Bundle/LinenHub publication | Off | External API not confirmed |
| SAP financial posting | Off | External API not confirmed |
| `go_live_enabled` | Off | Keeps item creation isolated in preview tables |
| Azure DB migration (DB2) | Not started | Requires separate infrastructure work |

Publication events are still written to `preview_publication_events` with a `Simulated` status — they can be reviewed in the Item Creation CATALOGUE tab to confirm payloads are correctly formed.

---

## Step 9 — Go-Live Sequence (when testers sign off)

Run these SQL statements **in order** on the production Supabase project only after all testers have signed off:

```sql
-- 1. Lift the write block (allows item creation to write to preview tables live)
UPDATE app_config SET value = 'false'::jsonb, updated_at = NOW()
WHERE key = 'preview_write_block';

-- 2. Graduate item creation from preview tables into live items table
UPDATE app_config SET value = 'true'::jsonb, updated_at = NOW()
WHERE key = 'go_live_enabled';

-- 3. Enable item creation nav item for all eligible users
UPDATE app_config SET value = 'true'::jsonb, updated_at = NOW()
WHERE key = 'preview_enabled';

-- 4. Enable UI revamp globally
UPDATE app_config SET value = 'true'::jsonb, updated_at = NOW()
WHERE key = 'ui_revamp_enabled';

-- 5. Enable Smart Buying v2 only after Azure proxy is confirmed deployed
-- UPDATE app_config SET value = 'true'::jsonb, updated_at = NOW()
-- WHERE key = 'smart_buying_v2_enabled';
```

After the SQL, merge `main` branch to production deployment and announce to users.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Item Creation not in sidebar | `preview_enabled = false` or user lacks `manage_development` | Check `app_config` row and user's role permissions |
| Submitting a request silently does nothing | `preview_write_block = true` | Set to `false` in `app_config` |
| Item Approvals nav item missing | User lacks `approve_item_requests` permission | Update the role's `permissions[]` array |
| Settings → Item Creation tab missing | User lacks `manage_items` permission | Update role permissions |
| Duplicate check returns no results | `attribute_options` not seeded with category/product type codes | Run migration `20260429000001` and check `attribute_options` table |
| SKU generates as blank | Category code or product type code missing from `attribute_options` | Add codes via Settings → Admin Portal → Item Creation → SKU Code Maps |
| Preview tables don't exist | Migration `20260427000000` not applied | Apply the migration in Supabase SQL editor |
| Approval rules table doesn't exist | Migration `20260429000002` not applied | Apply the migration |
| Margin threshold not configurable | Migration `20260429000005` not applied (no `margin_thresholds` row in `app_config`) | Apply the migration |
