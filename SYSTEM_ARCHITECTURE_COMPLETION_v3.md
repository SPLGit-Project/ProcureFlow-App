# SYSTEM_ARCHITECTURE_COMPLETION.md (v3)

> **Purpose**: Engineering-grade architecture documentation enabling complete application replication in a fresh environment with zero tribal knowledge.

---

## CONTRADICTION REPORT

| Source | Claim | Truth | Evidence | Corrective Action |
|--------|-------|-------|----------|-------------------|
| REPLICATION_BLUEPRINT.md:148 | `user_site_assignments` table exists | **FALSE** - Table does not exist in schema.sql | [OBSERVED: schema.sql:1-326] - No CREATE TABLE statement for `user_site_assignments` | Remove table reference; document `users.site_ids` TEXT[] instead |
| REPLICATION_BLUEPRINT.md:163-164 | FKs exist: `user_site_assignments.user_id → users.id` | **FALSE** - No such table or FK | [OBSERVED: schema.sql:1-326] | Remove FK references from documentation |
| REPLICATION_BLUEPRINT.md:697 | "Users assigned to sites via `user_site_assignments` table" | **FALSE** - Uses `users.site_ids` array column | [OBSERVED: fix_users_table.sql:5, services/db.ts:46] | Correct to: "Users assigned via `users.site_ids` TEXT[] column" |
| VERIFIED_BLUEPRINT.md:56 | Claims `users.site_ids` column exists | **TRUE** | [OBSERVED: fix_users_table.sql:5, services/db.ts:46] | N/A - Correct |
| VERIFIED_BLUEPRINT.md:76 | `GEMINI_API_KEY` required env var | **PARTIALLY TRUE** - Only for mapping engine, not core app | [OBSERVED: vite.config.ts:59-60] | Clarify as optional |

---

## A. ARCHITECTURE DEFINITION OF DONE

| # | Requirement | Pass Condition | Verification Command |
|---|-------------|----------------|---------------------|
| 1 | uuid-ossp extension | Extension exists | `SELECT extname FROM pg_extension WHERE extname='uuid-ossp';` → 1 row |
| 2 | All 16 tables exist | Count = 16 | `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';` → 16+ |
| 3 | RLS enabled on all tables | All have rowsecurity=true | `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=false;` → 0 rows |
| 4 | `users.site_ids` column exists | Column present | `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='site_ids';` → 1 row |
| 5 | `idx_items_sap_norm` index exists | Index present | `SELECT indexname FROM pg_indexes WHERE indexname='idx_items_sap_norm';` → 1 row |
| 6 | OAuth redirect works | Session established | Browser: Login → redirect → `localStorage` has `sb-*-auth-token` |
| 7 | SW registered | Active SW | DevTools → Application → Service Workers → `sw.js` status: activated |
| 8 | `dist/` produced with version.json | Build output contains version file | `ls dist/version.json` → file exists |
| 9 | Site filtering works | POs filter by site | Select site → Network tab shows query with `site_id` filter |
| 10 | Deployed version.json accessible | Matches build gitHash | `curl https://<app-url>/version.json` → returns JSON with gitHash matching `git rev-parse --short HEAD` |

---

## B. REPO REALITY SNAPSHOT

### B.1 Stack + Versions
[OBSERVED: package.json:1-32]

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | ^19.2.1 |
| Language | TypeScript | ~5.8.2 |
| Build Tool | Vite | ^6.2.0 |
| Router | react-router-dom | ^7.10.1 |
| Database SDK | @supabase/supabase-js | ^2.87.1 |
| Charts | Recharts | ^3.5.1 |
| Icons | lucide-react | ^0.555.0 |
| Excel Parser | xlsx | ^0.18.5 |
| UUID | uuid | ^13.0.0 |
| Drag & Drop | react-dropzone | ^14.3.8 |

### B.2 Build Tool + Output
[OBSERVED: vite.config.ts:1-90, package.json:6-12]

| Aspect | Value | Evidence |
|--------|-------|----------|
| Build command | `npm run build:prod` | [OBSERVED: package.json:9] |
| Build steps | `tsc && vite build --mode production` | [OBSERVED: package.json:11] |
| Output directory | `dist/` | [DERIVED: Vite default] |
| Dev server port | 3000 | [OBSERVED: vite.config.ts:54] |
| Chunk strategy | vendor/ui/db splits | [OBSERVED: vite.config.ts:76-80] |
| Cache busting | Content-based hashing | [OBSERVED: vite.config.ts:72-74] |

### B.3 Routing Model
[OBSERVED: App.tsx, package.json:20]

- **Type**: Client-side SPA with React Router DOM v7
- **Mode**: BrowserRouter (HTML5 History API)
- **Lazy loading**: Yes, components loaded via `React.lazy()`

### B.4 PWA Assets
[OBSERVED: public/manifest.json, public/sw.js, vite.config.ts:20-47]

| Asset | Location | Purpose |
|-------|----------|---------|
| Manifest | `public/manifest.json` | PWA metadata, icons, shortcuts |
| Service Worker | `public/sw.js` | Caching, offline support |
| Version file (pre-build) | `public/version.json` | Generated at buildStart, copied to dist/ |
| Version generator | `vite.config.ts:20-47` | Writes version.json on buildStart |

### B.5 CI/CD Workflow (CURRENT CANONICAL)
[OBSERVED: .github/workflows/main_procureflow-app-spl.yml:1-59]

| Aspect | Value |
|--------|-------|
| Trigger | Push to `main` branch, manual dispatch |
| Runner | `ubuntu-latest` |
| Node version | 20.x |
| Install command | `npm install` |
| Build env vars | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` from secrets |
| Artifact scope | `.` (entire directory) |
| Deploy target | Azure Web App `ProcureFlow-App-SPL` |
| Slot | Production |
| Auth method | Publish profile secret |

This is the **CURRENT CANONICAL** workflow. [OBSERVED: .github/workflows/main_procureflow-app-spl.yml:39] The artifact uploads the entire directory (path: `.`). This behavior is preserved.

### B.6 Hosting Model
[DERIVED: from Azure Web App Node.js runtime requirements]

**Canonical Statement**: Azure App Service runs a Node process that serves the static `dist/` output using the `serve` dependency.

The application produces a static SPA bundle during build. At runtime, Azure Web Apps (Node.js) executes `npm start`, which runs the `serve` package to serve these static files with SPA fallback routing.

---

## C. DATABASE CONTRACT

### C.1 Table Inventory
[OBSERVED: schema.sql:1-326]

| # | Table | Primary Key | Foreign Keys | Constraints |
|---|-------|-------------|--------------|-------------|
| 1 | `roles` | `id TEXT` | - | - |
| 2 | `users` | `id UUID` | `role_id → roles.id` | UNIQUE(email) |
| 3 | `sites` | `id UUID` | - | - |
| 4 | `suppliers` | `id UUID` | - | - |
| 5 | `items` | `id UUID` | `supplier_id → suppliers.id` | UNIQUE(sku) |
| 6 | `catalog_items` | `id UUID` | `item_id → items.id`, `supplier_id → suppliers.id` | - |
| 7 | `stock_snapshots` | `id UUID` | `supplier_id → suppliers.id` | - |
| 8 | `po_requests` | `id UUID` | `requester_id → users.id`, `site_id → sites.id`, `supplier_id → suppliers.id` | - |
| 9 | `po_lines` | `id UUID` | `po_request_id → po_requests.id` (CASCADE), `item_id → items.id` | - |
| 10 | `po_approvals` | `id UUID` | `po_request_id → po_requests.id` (CASCADE), `approver_id → users.id` | - |
| 11 | `deliveries` | `id UUID` | `po_request_id → po_requests.id` | - |
| 12 | `delivery_lines` | `id UUID` | `delivery_id → deliveries.id` (CASCADE), `po_line_id → po_lines.id` | - |
| 13 | `workflow_steps` | `id UUID` | `approver_role → roles.id` | - |
| 14 | `notification_settings` | `id UUID` | - | - |
| 15 | `supplier_product_map` | `id UUID` | `supplier_id → suppliers.id`, `product_id → items.id` | UNIQUE(supplier_id, product_id, supplier_sku) |
| 16 | `product_availability` | `id UUID` | `product_id → items.id`, `supplier_id → suppliers.id` | UNIQUE(product_id, supplier_id) |

### C.2 Indexes
[OBSERVED: schema.sql:305-306, 324]

| Index | Table | Columns | Type |
|-------|-------|---------|------|
| `idx_stock_snapshots_norm` | stock_snapshots | customer_stock_code_norm | BTREE |
| `idx_stock_snapshots_alt_norm` | stock_snapshots | customer_stock_code_alt_norm | BTREE |
| `idx_items_sap_norm` | items | sap_item_code_norm | UNIQUE |

### C.3 RLS Policy Matrix
[OBSERVED: schema.sql:176-289]

| Table | RLS Status | Policy Name | Behavior | Risk Classification |
|-------|------------|-------------|----------|---------------------|
| `roles` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `users` | ENABLED | Users can view their own profile | `USING (auth.uid() = id)` SELECT only | RESTRICTIVE |
| `users` | ENABLED | Admins can view and edit all users | `USING (role_id = 'ADMIN')` ALL | CONDITIONAL |
| `sites` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `suppliers` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `items` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `catalog_items` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `stock_snapshots` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `po_requests` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `po_lines` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `po_approvals` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `deliveries` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `delivery_lines` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `workflow_steps` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `notification_settings` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `supplier_product_map` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `product_availability` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |

**Note**: Data isolation is APPLICATION-LEVEL ONLY via `activeSiteIds` filtering. See POST-REPLICATION IMPROVEMENT PLAN for RLS hardening.

### C.4 Apply Order (Canonical)

**Step 1: Run schema.sql**
```bash
psql $DATABASE_URL -f schema.sql
```
**Verification:**
```sql
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';
-- Expected: 16
```

**Step 2: Run migration**
[OBSERVED: supabase/migrations/20240130_add_unique_constraint_supplier_product_map.sql]
```bash
psql $DATABASE_URL -f supabase/migrations/20240130_add_unique_constraint_supplier_product_map.sql
```
**Verification:**
```sql
SELECT conname FROM pg_constraint WHERE conname LIKE '%supplier_product_map%';
-- Expected: supplier_product_map_supplier_id_supplier_sku_key
```

**Step 3: Run fix_users_table.sql**
[OBSERVED: fix_users_table.sql:1-8]
```bash
psql $DATABASE_URL -f fix_users_table.sql
```
**Verification:**
```sql
SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='site_ids';
-- Expected: 1 row
```

**Step 4 (Development only): Seed data**
```bash
psql $DATABASE_URL -f seed.sql
```

### C.5 Column Additions via Scripts
[OBSERVED: schema.sql:243-324, fix_users_table.sql:4-7]

| Table | Column | Type | Added By |
|-------|--------|------|----------|
| users | site_ids | TEXT[] | fix_users_table.sql |
| users | status | TEXT | fix_users_table.sql |
| items | default_order_multiple | INTEGER | schema.sql:244 |
| items | active_flag | BOOLEAN | schema.sql:245 |
| items | sap_item_code_raw | TEXT | schema.sql:319 |
| items | sap_item_code_norm | TEXT | schema.sql:320 |
| stock_snapshots | customer_stock_code_raw | TEXT | schema.sql:301 |
| stock_snapshots | customer_stock_code_norm | TEXT | schema.sql:302 |
| stock_snapshots | customer_stock_code_alt_norm | TEXT | schema.sql:303 |
| stock_snapshots | sell_price | NUMERIC | schema.sql:314 |

---

## D. AUTH/SSO CONTRACT

### D.1 Supabase Provider Configuration
[OBSERVED: lib/supabaseClient.ts:11-18]

| Setting | Value | Evidence |
|---------|-------|----------|
| Flow Type | `implicit` | [OBSERVED: supabaseClient.ts:13] |
| Detect Session in URL | `true` | [OBSERVED: supabaseClient.ts:14] |
| Auto Refresh Token | `true` | [OBSERVED: supabaseClient.ts:15] |
| Persist Session | `true` | [OBSERVED: supabaseClient.ts:16] |
| Storage | `window.localStorage` | [OBSERVED: supabaseClient.ts:17] |

**Supabase Dashboard Configuration:**

| Field | Value |
|-------|-------|
| Provider | Azure (Microsoft) |
| Client ID | [REQUIRES-OPERATOR] |
| Client Secret | [REQUIRES-OPERATOR] |
| Redirect URL | `https://<supabase-project-ref>.supabase.co/auth/v1/callback` |
| Scopes | `openid profile email User.Read` |

### D.2 Azure Entra App Registration
[DERIVED: from OAuth flow requirements]

1. Azure Portal → Entra ID → App registrations → New registration
2. Configure Redirect URI: `https://<supabase-ref>.supabase.co/auth/v1/callback`
3. Add API Permissions: `openid`, `profile`, `email`, `User.Read`
4. Create Client Secret and add to Supabase provider config

### D.3 Domain Restriction
[OBSERVED: context/AppContext.tsx:505-511]

```typescript
if (!email?.toLowerCase().endsWith('@splservices.com.au')) {
    alert("Access Restricted: Only @splservices.com.au accounts are allowed.");
    await supabase.auth.signOut();
    return;
}
```

**Enforcement**: Client-side, after OAuth, before user record creation.

### D.4 Auth Failure Mode Table

| Error | Symptom | Fix |
|-------|---------|-----|
| Redirect fails | Browser stays on Azure login | Verify redirect URIs match |
| "Access Restricted" alert | Immediate signout | Use @splservices.com.au account |
| White screen after login | Token not parsed | Clear localStorage, verify `detectSessionInUrl: true` |
| Session lost on refresh | Token not persisting | Verify localStorage access |
| Graph API fails | No job title | Add User.Read scope, re-consent |

---

## E. ENVIRONMENT & CONFIG CONTRACT

### E.1 Environment Variables
[OBSERVED: lib/supabaseClient.ts:4-5, vite.config.ts:59-61]

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | YES | Supabase API endpoint |
| `VITE_SUPABASE_ANON_KEY` | YES | Supabase public key |
| `GEMINI_API_KEY` | NO | AI mapping features (optional) |

### E.2 Injection Points
[OBSERVED: .github/workflows/main_procureflow-app-spl.yml:31-33]

| Context | Source | Method |
|---------|--------|--------|
| Local Dev | `.env` / `.env.local` | Vite loadEnv |
| GitHub Actions | Repository Secrets | Env var injection at build |
| Runtime | Baked into JS bundle | `import.meta.env.*` |

**IMPORTANT**: Variables are baked into the bundle at build time. NOT runtime-configurable.

### E.3 Mode Precedence
[OBSERVED: package.json:7-11]

| Mode | Command |
|------|---------|
| Development | `npm run dev` (staging mode) |
| Production | `npm run build` (production mode) |

### E.4 Template: .env.local
```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
GEMINI_API_KEY=AIza... (optional)
```

---

## F. CI/CD & HOSTING CONTRACT

### F.1 Canonical Hosting Model

**Statement**: Azure App Service runs a Node process that serves the static `dist/` output using the `serve` dependency.

[DERIVED: Azure Web Apps (Node.js runtime) requires a runnable Node process]

### F.2 Canonical Start/Run Contract

| Item | Required Value | Status |
|------|----------------|--------|
| `serve` in dependencies | `"serve": "^14.2.4"` | [DERIVED: must be added - see Appendix A] |
| `start` script | `"serve -s dist -l 8080"` | [DERIVED: must be added - see Appendix A] |
| Azure Startup Command | `npm start` | [REQUIRES-OPERATOR: configure in Azure Portal] |

**Current State**: [OBSERVED: package.json:14-30] `serve` is NOT currently in dependencies.

The package.json patch in Appendix A MUST be applied before deployment.

### F.3 Pipeline Behavior

**CURRENT CANONICAL** [OBSERVED: .github/workflows/main_procureflow-app-spl.yml:27-28]:
- Install: `npm install`
- Build: `npm run build`

After applying the package.json patch (Appendix A), `npm install` will install `serve` because it is listed in dependencies. No additional install steps are needed.

**OPTIONAL**: Switch to `npm ci` for deterministic installs. See Appendix B for optional workflow patch.

### F.4 Artifact Scope

**CURRENT CANONICAL** [OBSERVED: .github/workflows/main_procureflow-app-spl.yml:39]:
```yaml
path: .
```

The workflow uploads the entire directory. This behavior is preserved as canonical.

### F.5 Azure App Service Configuration

| Setting | Value | Evidence |
|---------|-------|----------|
| App Name | `ProcureFlow-App-SPL` | [OBSERVED: workflow:55] |
| Runtime | Node 20 LTS | [OBSERVED: workflow:24] |
| Startup Command | `npm start` | [REQUIRES-OPERATOR] |
| Always On | Enabled | [REQUIRES-OPERATOR] |
| HTTPS Only | Enabled | [REQUIRES-OPERATOR] |

### F.6 First Deploy Smoke Test

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to app URL | Login page loads |
| 2 | Check browser console | No red errors |
| 3 | Click "Sign in with Microsoft" | Redirect to Azure AD |
| 4 | Complete login | Dashboard loads |
| 5 | DevTools → Service Workers | `sw.js` activated |
| 6 | DevTools → Local Storage | `sb-*-auth-token` present |
| 7 | `curl https://<app-url>/version.json` | Returns valid JSON |

---

## G. RUNTIME SEMANTICS CONTRACT

### G.1 Multi-Site Behavior
[OBSERVED: context/AppContext.tsx:10-25, 30-31]

**Storage Locations:**
| Location | Key | Purpose |
|----------|-----|---------|
| React State | `activeSiteIds: string[]` | Session selection |
| localStorage | `activeSiteIds` | Persistence |
| Database | `users.site_ids` | User assignments |

**Empty activeSiteIds**: [OBSERVED: context/AppContext.tsx:234]
```typescript
if (!activeSiteIds.length) return [];
```
No sites selected = no data displayed.

### G.2 Query Filtering
[OBSERVED: services/db.ts:478+, context/AppContext.tsx:234-236]

| Query | Filter Type | Location |
|-------|-------------|----------|
| `getPOs(siteIds)` | Supabase `.in()` | Database level |
| `filteredPos` | JavaScript `.filter()` | Client memory |

### G.3 Approval Gating
[OBSERVED: App.tsx, context/AppContext.tsx:36]

| User Status | Route |
|-------------|-------|
| Unauthenticated | `/login` |
| `PENDING_APPROVAL` | `/pending-approval` |
| `APPROVED` | Protected routes |

---

## H. PWA BREAK-GLASS RUNBOOK

### H.1 Validate Service Worker
1. DevTools → Application → Service Workers
2. Verify `sw.js` shows "activated and running"

### H.2 Check Cache Version
1. DevTools → Cache Storage
2. Look for `procureflow-{timestamp}`

### H.3 Force Clear Caches
1. DevTools → Application → Storage → Clear site data
2. Reload page

### H.4 Verify version.json

**Build output:**
```bash
ls dist/version.json
cat dist/version.json
```

**Deployed:**
```bash
curl https://<app-url>/version.json
```

Compare `gitHash` with:
```bash
git rev-parse --short HEAD
```

---

## I. OPERATOR INPUTS NEEDED

| # | Input | Where to Find |
|---|-------|---------------|
| 1 | Supabase Project URL | Supabase Dashboard → Settings → API |
| 2 | Supabase Anon Key | Supabase Dashboard → Settings → API |
| 3 | Azure Entra Client ID | Azure Portal → App registrations |
| 4 | Azure Entra Client Secret | Azure Portal → Certificates & secrets |
| 5 | Azure Entra Tenant ID | Azure Portal → Entra ID → Overview |
| 6 | Azure Web App Name | Azure Portal → App Services |
| 7 | Azure Publish Profile | Azure Portal → Download publish profile |
| 8 | Azure Startup Command | Set to: `npm start` |
| 9 | Production Domain | Azure Portal |

---

## J. POST-REPLICATION IMPROVEMENT PLAN

> Not required for replication. Address after app is running.

### J.1 RLS Hardening (CRITICAL)
Implement site-based RLS policies to replace permissive policies.

### J.2 Deterministic Installs
Change `npm install` to `npm ci` in workflow (optional patch in Appendix B).

---

## APPENDIX A: REQUIRED PATCH - package.json

This patch adds `serve` dependency and `start` script. **MUST be applied before deployment.**

```diff
diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -9,7 +9,8 @@
     "build": "npm run build:prod",
     "build:staging": "tsc && vite build --mode staging",
     "build:prod": "tsc && vite build --mode production",
-    "preview": "vite preview"
+    "preview": "vite preview",
+    "start": "serve -s dist -l 8080"
   },
   "dependencies": {
     "@supabase/supabase-js": "^2.87.1",
@@ -18,6 +19,7 @@
     "react-dom": "^19.2.1",
     "react-dropzone": "^14.3.8",
     "react-router-dom": "^7.10.1",
     "recharts": "^3.5.1",
+    "serve": "^14.2.4",
     "uuid": "^13.0.0",
     "xlsx": "^0.18.5"
   },
```

**Apply:**
```bash
# Edit package.json to add serve and start script
npm install
git add package.json package-lock.json
git commit -m "Add serve dependency and start script for Azure"
git push
```

---

## APPENDIX B: OPTIONAL PATCH - GitHub Actions Workflow

This patch changes `npm install` to `npm ci` for deterministic installs. **OPTIONAL.**

```diff
diff --git a/.github/workflows/main_procureflow-app-spl.yml b/.github/workflows/main_procureflow-app-spl.yml
--- a/.github/workflows/main_procureflow-app-spl.yml
+++ b/.github/workflows/main_procureflow-app-spl.yml
@@ -26,7 +26,7 @@
 
       - name: npm install, build, and test
         run: |
-          npm install
+          npm ci
           npm run build --if-present
           npm run test --if-present
```

---

## REPLICATION READINESS DECLARATION

**STATUS: YES**

Replication is achievable. Prerequisites:
1. Apply the package.json patch (Appendix A) to add `serve` dependency and `start` script
2. Commit and push the patch
3. Configure Azure Web App startup command to `npm start`
4. Provide all 9 operator inputs listed in Section I

No FAIL-CLOSED violations detected in this document. All replication-critical instructions use a single canonical path with no alternatives.

---

## DOCUMENT METADATA

| Field | Value |
|-------|-------|
| Version | 3.0 |
| Created | 2026-02-08 |
| Last Updated | 2026-02-08T15:49:00+11:00 |
| Canonical Hosting | Node process via `serve` package |
| Startup Command | `npm start` → `serve -s dist -l 8080` |
| Artifact Scope | `.` (entire directory) - OBSERVED CANONICAL |
| Table `user_site_assignments` | **DOES NOT EXIST** |
| User site assignment | `users.site_ids` TEXT[] column |
