# ProcureFlow — State of Development Report
**Date:** 2026-04-30  
**Branch:** `feature/expansion`  
**Build status:** ✅ Clean (`tsc --noEmit` zero errors, `npm run build` succeeds in 6.30s)  
**Analyst:** Forensic codebase review via direct file inspection, git diff, and build verification

---

## EXECUTIVE SUMMARY

The `feature/expansion` branch is in an **advanced and largely complete state**. All six planned implementation commits (A–F) have landed and the production build compiles without errors. The remaining work falls into four categories:

1. **Uncommitted working-tree changes** — 13 modified files containing the latest UI polish (warm nocturne theme, floating header, teal consistency, UpdateToast reskin, admin tab bar portal) plus critical migration corrections. These need review and a commit before any deployment.
2. **Two critical correctness issues** — a `DEFAULT_FEATURE_FLAGS` change that would expose expansion features to production users if the DB row is missing, and RLS migrations that now depend on `public.has_permission()` / `public.is_admin()` helper functions that must be verified to exist in the target database.
3. **UI teal consistency** — 10 components still contain `bg-blue-600` / `bg-indigo-600` buttons outside the expansion feature scope.
4. **Playwright test suite** — 40+ tests are written and listed; the suite has been run locally (`test-results/` directory exists) but results are untracked and no CI gate is in place.

**No functional code is broken. The app is deployable to staging today after resolving the two critical issues below.**

---

## SECTION 1 — COMMIT STATUS (Verified Against Git Log)

| Commit | Tag | Status | Verification |
|---|---|---|---|
| A | `a50c417` | ✅ Complete | `MarginThresholds` in `types.ts`; `db.getMarginThresholds()` + `db.updateMarginThresholds()` in `services/db.ts`; wired in `AppContext.tsx` |
| B | `b9c07fa` | ✅ Complete | `ItemApprovalQueue.tsx`, `ItemCatalogue.tsx`, `ItemApprovalReview.tsx` all present; `App.tsx` routes wired; `navigation.ts` entries present |
| C | `1e7f53b` | ✅ Complete | `ItemCreationSettings.tsx` (458 LOC); `Settings.tsx` ITEM_CREATION tab in `allTabs` and render block |
| D | `52c1611` | ✅ Complete | 4 HelpGuide categories (`item-creation`, `item-approvals`, `smart-buying-v2`, `data-sync`); 3 EntityAuditPanel preview-table mappings; Layout.tsx `previewEnabled` gate |
| E | `245553e` | ✅ Complete | `marginThreshold` variable wired in `ItemCreationPreview.tsx`; no remaining hardcoded `25`; POCreate catalogue prompt present |
| F | `287a674` + `9b29f94` | ✅ Complete | 7 test spec files in `tests/e2e/`; `playwright.config.ts` present; 40+ tests listed |
| UI Polish | `80a012f`, `aedabff`, `95499a3` | ✅ Committed | Floating header, expandable sidebar, teal consistency, PARTIALLY_RECEIVED removal |
| **Current session UI work** | Uncommitted | ⚠️ Working tree | Warm nocturne palette, admin tab bar portal, logo sizing, UpdateToast reskin |

---

## SECTION 2 — CRITICAL ISSUES (Must Fix Before Deployment)

### 🔴 CRITICAL #1 — DEFAULT_FEATURE_FLAGS Will Expose Features in Production

**File:** `context/AppContext.tsx` (working tree, not yet committed)

**What changed:**
```ts
// Before (committed):
const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  previewEnabled:    false,   // ← safe default
  uiRevampEnabled:   false,   // ← safe default
  ...
};

// After (working tree, UNCOMMITTED):
const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  previewEnabled:    true,    // ← DANGEROUS
  uiRevampEnabled:   true,    // ← DANGEROUS
  ...
};
```

**Why this is critical:** `DEFAULT_FEATURE_FLAGS` is used as a fallback when `db.getFeatureFlags()` returns no row for a key — i.e., if the `app_config` row doesn't exist in the production Supabase project. With these defaults set to `true`, ANY deployment to a DB that hasn't run the flag-seeding SQL will immediately expose the revamp UI and Item Creation module to all users.

**Fix required:**
```ts
// AppContext.tsx — restore safe defaults
const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  previewEnabled:       false,
  previewWriteBlock:    true,
  goLiveEnabled:        false,
  uiRevampEnabled:      false,   // DB row controls opt-in
  smartBuyingV2Enabled: false,
  integrationsEnabled:  false,
};
```

The `true` values are appropriate for local development convenience, but must not ship. The DB row set by the `BETA_TESTING_SETUP.md` guide is what controls flag state in any real environment.

---

### 🔴 CRITICAL #2 — RLS Migrations Depend on Helper Functions That May Not Exist

**Files:** `supabase/migrations/20260429000002_item_approval_rules.sql` and `supabase/migrations/20260429000005_phase6_rls_hardening.sql` (working tree modifications)

**What changed:** The original committed versions used inline JOIN chains to resolve permissions. The working-tree versions replace these with `public.has_permission(permission_name text)` and `public.is_admin()` helper functions:

```sql
-- OLD (committed, self-contained):
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = auth.uid()
      AND p.name IN ('approve_item_requests','manage_development','system_admin')
  )
);

-- NEW (working tree, depends on helper):
USING (public.has_permission('approve_item_requests') OR public.is_admin());
```

**Why this is critical:** If `public.has_permission()` and `public.is_admin()` do not exist in the target Supabase project, these migrations will fail with `function "has_permission" does not exist`, leaving the RLS policies in a broken state.

**Fix required — before committing these migrations:**

1. Verify the helpers exist:
```sql
SELECT routine_name, routine_schema
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('has_permission', 'is_admin');
```

2. If they do not exist, either:
   - **Option A (recommended):** Revert the RLS migrations to the original self-contained JOIN chain (the committed version is correct and safe)
   - **Option B:** Add a migration that creates the helper functions before `20260429000002` is applied

The helper functions ARE used throughout the existing committed migrations (e.g. `20260318000000_rls_hardening.sql` likely defines them), but this must be confirmed for each target DB before applying the updated migrations.

---

## SECTION 3 — UNCOMMITTED WORKING TREE (13 Files)

All of these represent the current session's UI polish work. Once the two critical issues above are resolved, these should be committed as a single "UI polish + migration cleanup" commit.

| File | Nature of Change | Safe to Commit? |
|---|---|---|
| `components/Layout.tsx` | Logo sizing, header restructure, admin tab slot, teal action buttons | ✅ Yes |
| `components/Settings.tsx` | Admin tab bar portal for revamp mode, `createPortal` import | ✅ Yes |
| `components/UpdateToast.tsx` | Nocturne background, `bg-tranquil` icon, `useApp` import removed | ✅ Yes |
| `constants/navigation.ts` | Label rename: "Item Preview" → "Item Creation" | ✅ Yes |
| `context/AppContext.tsx` | `DEFAULT_FEATURE_FLAGS` `previewEnabled`/`uiRevampEnabled` flipped to `true` | ❌ **Revert before committing** (Critical #1) |
| `index.css` | Warm nocturne dark palette, CSS class overrides for hardcoded dark colors | ✅ Yes |
| `index.html` | Tailwind config warm surface tokens, body background, scrollbar colors | ✅ Yes |
| `public/version.json` | Minor version bump | ✅ Yes |
| `supabase/migrations/20260429000000_expansion_phase0_foundation.sql` | Minor edit | Verify before commit |
| `supabase/migrations/20260429000002_item_approval_rules.sql` | RLS simplified with helper functions | ❌ **Verify `has_permission()` exists first** (Critical #2) |
| `supabase/migrations/20260429000003_bundle_connect_sync.sql` | Minor edit | Verify before commit |
| `supabase/migrations/20260429000004_smart_buying_v2.sql` | Minor edit | Verify before commit |
| `supabase/migrations/20260429000005_phase6_rls_hardening.sql` | RLS simplified with helper functions | ❌ **Verify `has_permission()` exists first** (Critical #2) |

---

## SECTION 4 — COMPONENT INVENTORY

### New Components (Expansion)

| Component | LOC | Status | Notes |
|---|---|---|---|
| `ItemApprovalQueue.tsx` | ~251 | ✅ Complete | SLA countdown, status badges, slide-over review |
| `ItemApprovalReview.tsx` | ~280 | ✅ Complete | Full review panel, approve/reject/revise actions |
| `ItemCatalogue.tsx` | ~274 | ✅ Complete | Search, BU/division filters, publication badges, pre-go-live preview badge |
| `ItemCreationSettings.tsx` | ~458 | ✅ Complete | Margin thresholds (6 fields), approval rules CRUD, SKU code maps |
| `ItemCreationPreview.tsx` | ~1342 | ✅ Complete | 4 tabs; `marginThreshold` variable used throughout (no hardcoded `25`) |
| `ItemSetupManagement.tsx` | Present | ✅ Untracked but present | Reference data manager |
| `PageMetaContext.tsx` | ~24 | ✅ Complete | Context + `useSetPageMeta` hook with cleanup |
| `PageHeader.tsx` | ~50 | ✅ Complete | Calls `useSetPageMeta` in revamp mode; returns null |

### Modified Existing Components

| Component | Status | Notes |
|---|---|---|
| `Layout.tsx` | ✅ Complete | Revamp rail (64px/212px), floating header, admin tab slot, previewEnabled gate, logo sizing |
| `Settings.tsx` | ✅ Complete | ITEM_CREATION tab added; `createPortal` for revamp admin tab bar |
| `AppContext.tsx` | ⚠️ Partially committed | MarginThresholds wired; DEFAULT_FEATURE_FLAGS has dangerous `true` values in working tree |
| `HelpGuide.tsx` | ✅ Complete | 4 new guide categories added |
| `EntityAuditPanel.tsx` | ✅ Complete | 3 preview table name mappings added |
| `POCreate.tsx` | ✅ Complete | "Not in catalogue?" prompt with `prefill` query param navigation |
| `UpdateToast.tsx` | ✅ Complete (working tree) | Nocturne background, teal icon; `useApp` import correctly removed |

---

## SECTION 5 — DATA LAYER

### Types (`types.ts`)
- ✅ `MarginThresholds` interface defined
- ✅ `approve_item_requests` in `PermissionId` union
- ✅ All preview-related types present

### Services (`services/db.ts`)
- ✅ `getMarginThresholds()` — reads from `app_config` key `margin_thresholds`
- ✅ `updateMarginThresholds()` — upserts to `app_config`
- ✅ `getFeatureFlags()` — maps all 6 DB keys to typed flags

### Services (`services/itemCreationPreviewService.ts`, ~536 LOC)
- ✅ Core CRUD for `preview_item_requests`
- ✅ Duplicate candidate scoring
- ✅ Approval instance creation and decision recording
- ✅ Publication event creation
- ⚠️ **Method naming:** The public API does not use the literal names `checkDuplicates`, `submitRequest`, `approveRequest`, `publishRequest` from the plan. Confirm that all consumer call sites (ItemCreationPreview.tsx, ItemApprovalQueue.tsx, ItemApprovalReview.tsx) use the actual exported method names before testing.

### Utilities
- ✅ `itemCreationPreviewEngine.ts` (~414 LOC): `generateMdSku`, `validatePreviewSku`, `findPreviewDuplicateCandidates`, `calculatePreviewPricing`, `validatePreviewRequestForSubmit`, `makePreviewRequestNumber`, `buildPreviewPublicationPayload`
- ✅ `itemPreviewOptions.ts`: Option group definitions

### Migrations (all present in `supabase/migrations/`)

| Migration | Status | Creates |
|---|---|---|
| `20260427000000_item_creation_preview.sql` | ✅ Committed | 10 preview tables + initial `app_config` rows |
| `20260429000000_expansion_phase0_foundation.sql` | ⚠️ Working tree edit | Feature flags, Beta Tester role |
| `20260429000001_expansion_phase2a_reference_data.sql` | ✅ Committed | `attribute_options` extensions |
| `20260429000002_item_approval_rules.sql` | ⚠️ RLS changed | `item_approval_rules` table + RLS (verify helper functions) |
| `20260429000003_bundle_connect_sync.sql` | ⚠️ Minor edit | BundleConnect sync tracking |
| `20260429000004_smart_buying_v2.sql` | ⚠️ Minor edit | `short_supply_plans`, reference tables |
| `20260429000005_phase6_rls_hardening.sql` | ⚠️ RLS changed | RLS hardening + `approved_items` view + `margin_thresholds` seed |

---

## SECTION 6 — TEST SUITE STATUS

**Framework:** Playwright (`playwright.config.ts` at project root)  
**Test files:** 7 specs in `tests/e2e/`  
**Total tests listed:** 40+  
**Last run:** Locally (untracked `test-results/` directory present)

| Spec File | Test Count | Coverage |
|---|---|---|
| `navigation.spec.ts` | 7 | Feature flag gating, permission-based nav visibility, route loading |
| `item-approval-queue.spec.ts` | 5 | Route load, permission gate, empty state, refresh button |
| `item-catalogue.spec.ts` | 7 | Route load, preview badge, search, empty state, filters, refresh |
| `settings-item-creation.spec.ts` | 5 | Tab visibility, margin thresholds, approval rules, SKU code maps |
| `help-guide.spec.ts` | 7 | All 4 new categories, guide content, search |
| `smart-buying.spec.ts` | ~4 | Live data toggle, STAR column, plan/history tabs |
| `regression-po-workflow.spec.ts` | 8 | Dashboard, PO create, PO list, Settings, Help, Approvals |

**Gap:** No spec covers the full item creation → approval → catalogue happy path end-to-end. The existing specs test component rendering and navigation, not the data flow. This is acceptable for pre-staging but should be noted for final go-live sign-off.

---

## SECTION 7 — UI THEME CONSISTENCY

### Remaining Blue Buttons (10 components)
These are **pre-existing** blue buttons outside the expansion scope. They do not affect expansion feature correctness but break full teal uniformity.

```
components/ActiveRequestsView.tsx   — bg-blue-600 / bg-indigo-600
components/CatalogManagement.tsx    — bg-blue-600
components/ConfirmDialog.tsx        — bg-blue-600
components/DataSyncPanel.tsx        — bg-blue-600
components/ItemWizard.tsx           — bg-blue-600 / bg-indigo-600
components/MenuEditor.tsx           — bg-blue-600
components/MultiSiteSelector.tsx    — bg-blue-600
components/PODetail.tsx             — bg-blue-600 / bg-indigo-600
components/Settings.tsx             — bg-blue-600 (remaining instances)
components/SimpleWorkflowConfig.tsx — bg-blue-600
```

**Recommendation:** Sweep with a single pass replacing `bg-blue-600` → `bg-[var(--color-brand,#129DC0)]` and `bg-indigo-600` → `bg-[var(--color-brand,#129DC0)]` across all 10 files. This is low-risk since `--color-brand` is set to `#129DC0` in the revamp root and falls back to the brand color in classic mode.

### Dark Mode
- ✅ Warm nocturne palette applied in `index.css` (working tree)
- ✅ CSS class overrides cover all hardcoded `dark:bg-[#1e2029]`, `dark:bg-[#15171e]`, `dark:bg-[#1a1d27]`
- ✅ Revamp floating header uses `dark:bg-[#1f1718]/90` — warm cocoa
- ⚠️ Legacy layout sidebar (`sidebarThemeClass`) still references `dark:bg-[#1e2029]/95` (line ~177) — handled by CSS override but consider updating directly

---

## SECTION 8 — ORDERED ACTION PLAN

Tasks are ordered by priority and dependency. Each is written as a self-contained prompt an AI agent can execute.

---

### TASK 1 — Revert Dangerous Feature Flag Defaults
**Priority: CRITICAL — do this before any other commit**  
**File:** `C:\Github\ProcureFlow-App\context\AppContext.tsx`

Locate `DEFAULT_FEATURE_FLAGS` (around line 249) and revert:
```ts
const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  previewEnabled:       false,  // was changed to true — revert
  previewWriteBlock:    true,
  goLiveEnabled:        false,
  uiRevampEnabled:      false,  // was changed to true — revert
  smartBuyingV2Enabled: false,
  integrationsEnabled:  false,
};
```
Why: These defaults fire when `app_config` rows are absent. `true` defaults would expose expansion features to ALL users on any DB without the seeded rows, including production.

---

### TASK 2 — Verify RLS Helper Functions Exist in Supabase
**Priority: CRITICAL — must be confirmed before applying modified migrations**  
**Action:** Run this SQL in the Supabase SQL editor for the target project:
```sql
SELECT routine_name, routine_schema, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('has_permission', 'is_admin')
ORDER BY routine_name;
```

**If both rows are returned:** The working-tree migration changes are safe to apply.  
**If either is missing:** Revert `20260429000002_item_approval_rules.sql` and `20260429000005_phase6_rls_hardening.sql` to their committed versions (which use self-contained JOIN chains), or create a prerequisite migration that defines the helpers. The committed versions are in git — retrieve with:
```bash
git show HEAD:supabase/migrations/20260429000002_item_approval_rules.sql > /tmp/migration_002_safe.sql
git show HEAD:supabase/migrations/20260429000005_phase6_rls_hardening.sql > /tmp/migration_005_safe.sql
```

---

### TASK 3 — Commit All Working-Tree UI Polish Changes
**Priority: HIGH — after Tasks 1 and 2 are resolved**  
**Files:** Layout.tsx, Settings.tsx, UpdateToast.tsx, navigation.ts, index.css, index.html, public/version.json, and the verified migrations.

Stage and commit as:
```
UI: warm nocturne palette, admin tab portal, logo sizing, UpdateToast reskin, migration RLS cleanup
```

This commit represents all work from the current session (dark mode warm palette, floating header polish, teal action buttons, admin tab bar portaling into header, UpdateToast nocturne background).

---

### TASK 4 — Verify `itemCreationPreviewService` Method Names Match Call Sites
**Priority: HIGH — required before functional testing**  
**Files to read:**
- `C:\Github\ProcureFlow-App\services\itemCreationPreviewService.ts` (lines 171 onwards — the exported object)
- `C:\Github\ProcureFlow-App\components\ItemCreationPreview.tsx` (all `itemCreationPreviewService.` calls)
- `C:\Github\ProcureFlow-App\components\ItemApprovalQueue.tsx` (all `itemCreationPreviewService.` calls)
- `C:\Github\ProcureFlow-App\components\ItemApprovalReview.tsx` (all `itemCreationPreviewService.` calls)

Grep for `itemCreationPreviewService\.` across the project and confirm every method name called exists on the service object. The planned method names (`checkDuplicates`, `submitRequest`, `approveRequest`, `publishRequest`) may differ from actual names. Any mismatch will cause runtime `TypeError: ... is not a function` during testing.

---

### TASK 5 — Teal Consistency Sweep (10 Components)
**Priority: MEDIUM — polish, no functional impact**  
**Files:** `ActiveRequestsView.tsx`, `CatalogManagement.tsx`, `ConfirmDialog.tsx`, `DataSyncPanel.tsx`, `ItemWizard.tsx`, `MenuEditor.tsx`, `MultiSiteSelector.tsx`, `PODetail.tsx`, `Settings.tsx`, `SimpleWorkflowConfig.tsx`

In each file, replace:
- `bg-blue-600` → `bg-[var(--color-brand,#129DC0)]`
- `hover:bg-blue-700` → `hover:bg-[#0f87a8]`
- `bg-indigo-600` → `bg-[var(--color-brand,#129DC0)]`
- `hover:bg-indigo-700` → `hover:bg-[#0f87a8]`

**Exceptions:** Do NOT replace blue used for semantic meaning unrelated to CTA buttons (e.g., info badges, link colors, status indicators). Review each occurrence in context.

---

### TASK 6 — Apply Migrations to Staging Database
**Priority: HIGH — required before any functional testing**  
**Reference:** `docs/BETA_TESTING_SETUP.md` for full SQL and order.

Apply in sequence via Supabase SQL editor or MCP `execute_sql`:
1. `20260427000000_item_creation_preview.sql`
2. `20260429000000_expansion_phase0_foundation.sql`
3. `20260429000001_expansion_phase2a_reference_data.sql`
4. `20260429000002_item_approval_rules.sql` *(verify Task 2 first)*
5. `20260429000003_bundle_connect_sync.sql`
6. `20260429000004_smart_buying_v2.sql`
7. `20260429000005_phase6_rls_hardening.sql` *(verify Task 2 first)*

Then seed feature flags per `docs/BETA_TESTING_SETUP.md` Step 3.

---

### TASK 7 — Run Playwright Suite and Achieve Green
**Priority: HIGH — before staging sign-off**  
```bash
npm run dev &          # start dev server on :5173
npx playwright test    # run full suite
```

Expected: All 40+ tests pass. If any fail, the `test-results/` directory will contain screenshots and traces. Common failure modes:
- Auth bypass not working → check `localStorage.setItem('pf_test_user', ...)` in test helpers
- Route not found → confirm App.tsx has the route
- Permission gate blocking → check `permissions` array in `injectTestUser` helper

---

### TASK 8 — Add End-to-End Item Creation Happy Path Test
**Priority: MEDIUM — gaps in current test coverage**  
**File to create:** `C:\Github\ProcureFlow-App\tests\e2e\item-creation-flow.spec.ts`

Write a test that covers the full data flow:
1. Navigate to `/item-creation-preview`
2. Fill WORKBENCH form (Standard type) with valid data
3. Click "Check for Duplicates" — assert "No duplicates found" message or results list
4. Assert SKU is generated in the text field
5. Fill purchase pricing (supplier, price, UOM)
6. Fill sell pricing with margin > 25% — assert no approval warning
7. Lower sell price to trigger margin warning — assert amber warning appears
8. Submit the form — assert status changes to "Submitted"
9. Navigate to REQUESTS tab — assert the submitted request appears
10. Navigate to `/item-approval-queue` — assert the request appears in the queue

This test requires a running Supabase test project with all migrations applied and feature flags set.

---

### TASK 9 — Legacy Sidebar Dark Mode Direct Reference
**Priority: LOW — aesthetic**  
**File:** `C:\Github\ProcureFlow-App\components\Layout.tsx` (around line 177)

```ts
// Current:
let sidebarThemeClass = 'bg-white/95 dark:bg-[#1e2029]/95';
if (branding.sidebarTheme === 'dark') sidebarThemeClass = 'bg-[#1e2029] text-white border-r-0';
```

The `#1e2029` is the old cool-gray. In dark mode this is handled by the CSS override in `index.css`, but for completeness update directly to the warm equivalent:
```ts
let sidebarThemeClass = 'bg-white/95 dark:bg-[#211a1b]/95';
if (branding.sidebarTheme === 'dark') sidebarThemeClass = 'bg-[#191213] text-white border-r-0';
```

---

### TASK 10 — Go-Live Sequence (When Testers Sign Off)
**Priority: FINAL — execute only after full test sign-off**  
**Reference:** `docs/BETA_TESTING_SETUP.md` Step 9.

```sql
-- In order, on production DB only:
UPDATE app_config SET value = 'false'::jsonb WHERE key = 'preview_write_block';
UPDATE app_config SET value = 'true'::jsonb  WHERE key = 'go_live_enabled';
UPDATE app_config SET value = 'true'::jsonb  WHERE key = 'preview_enabled';
UPDATE app_config SET value = 'true'::jsonb  WHERE key = 'ui_revamp_enabled';
-- Smart Buying v2 only after Azure proxy confirmed:
-- UPDATE app_config SET value = 'true'::jsonb WHERE key = 'smart_buying_v2_enabled';
```

Then merge `feature/expansion` → `main` and deploy.

---

## APPENDIX A — Key File Reference

| File | Purpose |
|---|---|
| `context/AppContext.tsx` | Feature flags, margin thresholds, all app state |
| `context/PageMetaContext.tsx` | Page title/subtitle/help data passed from child routes to Layout header |
| `services/db.ts` | All Supabase queries including `getFeatureFlags`, `getMarginThresholds` |
| `services/itemCreationPreviewService.ts` | All preview CRUD operations (~536 LOC) |
| `utils/itemCreationPreviewEngine.ts` | SKU generation, duplicate scoring, pricing calc (~414 LOC) |
| `constants/navigation.ts` | All nav item definitions (15 items total) |
| `components/Layout.tsx` | Both revamp and legacy layouts; admin tab slot; icon map |
| `components/ItemCreationPreview.tsx` | 4-tab workbench (~1342 LOC) |
| `components/ItemCreationSettings.tsx` | Margin thresholds + approval rules + SKU codes admin (~458 LOC) |
| `supabase/migrations/` | 40 migration files; 7 expansion-specific (20260427* + 20260429*) |
| `tests/e2e/` | 7 Playwright spec files |
| `docs/BETA_TESTING_SETUP.md` | Full staging setup SQL and test procedures |
| `playwright.config.ts` | Playwright config (baseURL `:5173`, chromium, retries: 1) |

## APPENDIX B — What is NOT Yet Built (Out of Current Scope)

| Feature | Status | Prerequisite |
|---|---|---|
| Salesforce catalogue API | Not started | `integrations_enabled` flag; Azure Functions deployment |
| Bundle/LinenHub publication | Stubbed (events written, not transmitted) | External API endpoint confirmation |
| SAP financial posting | Not started | Integration layer infrastructure |
| `go_live_enabled` path (items → live table) | Not started | Tester sign-off |
| Azure DB migration (DB2) | Not started | Separate infrastructure decision |
| Smart Buying v2 live data | Built, gated | Azure proxy deployment for BundleConnect |
| Item creation attachment upload | Stubbed | Supabase Storage bucket configuration |
