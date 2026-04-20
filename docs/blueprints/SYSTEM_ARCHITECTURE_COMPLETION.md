# SYSTEM_ARCHITECTURE_COMPLETION.md

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
| VERIFIED_BLUEPRINT.md:111 | Startup command: `pm2 serve dist` | **FALSE** - pm2 is NOT in package.json dependencies | [OBSERVED: package.json:14-30] | Use `serve` directly via npm start |

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
| 8 | `dist/` produced | Build output exists | `ls dist/index.html` → file exists |
| 9 | `version.json` in build output | File exists in dist | `ls dist/version.json` → file exists |
| 10 | Site filtering works | POs filter by site | Select site → Network tab shows query with `site_id` filter |
| 11 | Deployed version.json accessible | Matches build | `curl https://<app-url>/version.json` → returns valid JSON with gitHash |

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
| Build command (default) | `npm run build:prod` | [OBSERVED: package.json:9] |
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
| Version file | `public/version.json` | Generated at build time, copied to dist/ |
| Version generator | `vite.config.ts:20-47` | Writes version.json on buildStart |

### B.5 CI/CD Workflow
[OBSERVED: .github/workflows/main_procureflow-app-spl.yml:1-59]

| Aspect | Value |
|--------|-------|
| Trigger | Push to `main` OR manual dispatch |
| Runner | `ubuntu-latest` |
| Node version | 20.x |
| Build env vars | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` from secrets |
| Artifact scope | `.` (entire directory) |
| Deploy target | Azure Web App `ProcureFlow-App-SPL` |
| Slot | Production |
| Auth method | Publish profile secret |

**OBSERVED CANONICAL**: The current workflow uploads the entire directory (path: `.`). This is the observed canonical behavior. [OBSERVED: .github/workflows/main_procureflow-app-spl.yml:39]

### B.6 Hosting Model
[DERIVED: from build output + Azure Web App requirements]

**Canonical Model**: Node process serves static `dist/` via `serve` package.

The application produces a static SPA bundle. Azure Web Apps (Node.js runtime) runs a Node process that serves these static files with SPA fallback routing. This requires:
1. `serve` package as a production dependency
2. `start` script that invokes `serve`
3. Azure startup command: `npm start`

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
| `roles` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE - Security risk |
| `users` | ENABLED | Users can view their own profile | `USING (auth.uid() = id)` SELECT only | RESTRICTIVE - Self-only read |
| `users` | ENABLED | Admins can view and edit all users | `USING (role_id = 'ADMIN')` ALL | CONDITIONAL - Admin bypass |
| `sites` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE - Security risk |
| `suppliers` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE - Security risk |
| `items` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE - Security risk |
| `catalog_items` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE - Security risk |
| `stock_snapshots` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE - Security risk |
| `po_requests` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE - Security risk |
| `po_lines` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE - Security risk |
| `po_approvals` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE - Security risk |
| `deliveries` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE - Security risk |
| `delivery_lines` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE - Security risk |
| `workflow_steps` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE - Security risk |
| `notification_settings` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE - Security risk |
| `supplier_product_map` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE - Security risk |
| `product_availability` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE - Security risk |

**SECURITY NOTE**: All tables except `users` have fully permissive RLS. Data isolation is APPLICATION-LEVEL ONLY via `activeSiteIds` filtering in JavaScript. See POST-REPLICATION IMPROVEMENT PLAN.

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

**Step 3: Run fix_users_table.sql (if not already applied)**
[OBSERVED: fix_users_table.sql:1-8]
```bash
psql $DATABASE_URL -f fix_users_table.sql
```
**Verification:**
```sql
SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='site_ids';
-- Expected: 1 row
```

**Step 4 (Optional): Seed data for development**
```bash
psql $DATABASE_URL -f seed.sql
```
**Verification:**
```sql
SELECT COUNT(*) FROM roles;
-- Expected: > 0
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

**Supabase Dashboard Configuration (REQUIRES-OPERATOR):**

| Field | Expected Value |
|-------|----------------|
| Provider | Azure (Microsoft) |
| Client ID | [REQUIRES-OPERATOR: Azure Entra App Client ID] |
| Client Secret | [REQUIRES-OPERATOR: Azure Entra App Client Secret] |
| Redirect URL | `https://<supabase-project-ref>.supabase.co/auth/v1/callback` |
| Scopes | `openid profile email User.Read` |

### D.2 Azure Entra App Registration
[DERIVED: from OAuth flow requirements]

1. **Create App Registration**
   - Azure Portal → Entra ID → App registrations → New registration
   - Name: `ProcureFlow` (or similar)
   - Supported account types: Single tenant (org only) or Multi-tenant

2. **Configure Redirect URIs**
   - Platform: Web
   - Redirect URI: `https://<supabase-ref>.supabase.co/auth/v1/callback`

3. **API Permissions**
   - Microsoft Graph → Delegated permissions:
     - `openid`
     - `profile`
     - `email`
     - `User.Read` (for job title, department sync)

4. **Client Secret**
   - Certificates & secrets → New client secret
   - Copy value immediately (shown only once)
   - Add to Supabase Azure provider config

### D.3 Domain Restriction
[OBSERVED: context/AppContext.tsx:505-511]

```typescript
if (!email?.toLowerCase().endsWith('@splservices.com.au')) {
    console.error("Auth: Unauthorized domain:", email);
    alert("Access Restricted: Only @splservices.com.au accounts are allowed.");
    await supabase.auth.signOut();
    return;
}
```

**Enforcement Point**: Client-side, after OAuth completes, before user record creation.

**Verification**: Attempt login with non-@splservices.com.au email → Should see alert and immediate signout.

### D.4 Auth Failure Mode Table

| Error | Symptom | Root Cause | Fix |
|-------|---------|------------|-----|
| Redirect fails | Browser stays on Azure login | Incorrect redirect URI | Check Supabase + Azure AD redirect URIs match exactly |
| "Access Restricted" alert | User signed out immediately | Non-@splservices email | Use correct @splservices.com.au account |
| White screen after login | Token not parsed | URL fragment handling issue | Check `detectSessionInUrl: true`, clear localStorage |
| Session lost on refresh | Token not persisting | `persistSession: false` or storage issue | Verify localStorage access, check storage setting |
| Graph API fails | No job title/photo | Missing User.Read scope | Add scope in Azure AD, re-consent |
| User stuck on pending | Never approved | No admin action | Admin must approve user via Settings |

---

## E. ENVIRONMENT & CONFIG CONTRACT

### E.1 Environment Variables
[OBSERVED: lib/supabaseClient.ts:4-5, vite.config.ts:59-61]

| Variable | Source File | Required | Purpose |
|----------|-------------|----------|---------|
| `VITE_SUPABASE_URL` | supabaseClient.ts:4 | YES | Supabase API endpoint |
| `VITE_SUPABASE_ANON_KEY` | supabaseClient.ts:5 | YES | Supabase public/anon key |
| `GEMINI_API_KEY` | vite.config.ts:59-60 | NO | AI mapping features (optional) |

### E.2 Injection Points
[OBSERVED: .github/workflows/main_procureflow-app-spl.yml:31-33]

| Context | Source | Method |
|---------|--------|--------|
| Local Dev | `.env` / `.env.local` | Vite loadEnv |
| GitHub Actions | Repository Secrets | Env var injection at build |
| Runtime | Baked into JS bundle | `import.meta.env.*` |

**IMPORTANT**: Environment variables are baked into the JavaScript bundle at build time. They are NOT runtime-configurable.

### E.3 Mode Precedence
[OBSERVED: package.json:7-11, vite.config.ts:51]

| Mode | Command | Uses Env |
|------|---------|----------|
| Development | `npm run dev` | `--mode staging` |
| Production | `npm run build` | `--mode production` |
| Staging Build | `npm run build:staging` | `--mode staging` |

[OBSERVED: vite.config.ts:51] `const env = loadEnv(mode, '.', '');`

### E.4 Template: .env.local
```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
GEMINI_API_KEY=AIza... (optional)
```

---

## F. CI/CD & HOSTING CONTRACT

### F.1 Canonical Hosting Model

**Model**: Node process serves static `dist/` via `serve` package.

[DERIVED: Azure Web Apps with Node.js runtime requires a Node process. The `serve` package provides static file serving with SPA fallback.]

**Why this model:**
- Azure Web Apps (Node.js) expects a runnable Node process
- `serve` is lightweight, purpose-built for SPAs
- No alternatives: the application must run on Azure Web Apps as specified

**Rejected alternatives:**
- `pm2` - NOT in package.json [OBSERVED: package.json:14-30], adds unnecessary process management complexity
- `npx serve` - Non-deterministic; may fetch different versions across deploys

### F.2 Required Repository Changes

**Current state**: [OBSERVED: package.json:14-30]
- `serve` is NOT a dependency
- No `start` script exists

**REQUIRED PATCH**: See Appendix A for exact git diff.

After applying the patch:

| Item | Value | Status |
|------|-------|--------|
| `serve` dependency | `"serve": "^14.2.4"` | [DERIVED: latest stable as of 2026-02] |
| `start` script | `"serve -s dist -l 8080"` | [DERIVED: fixed port for Azure compatibility] |

**Port Configuration Note** [ASSUMED]: Azure Web Apps typically expects port 8080. The `-l 8080` flag sets a fixed port. If Azure provides a `PORT` environment variable, the startup command can be adjusted in Azure configuration, but the package.json script uses a deterministic fixed port for reproducibility.

### F.3 CI/CD Pipeline

**OBSERVED CANONICAL** [OBSERVED: .github/workflows/main_procureflow-app-spl.yml:1-59]:

The current workflow:
1. Checks out code
2. Installs dependencies with `npm install`
3. Builds with `npm run build`
4. Uploads entire directory as artifact (path: `.`)
5. Deploys to Azure Web App

**Post-Patch Behavior**:
- `npm install` will install `serve` as it's now in dependencies
- Pipeline does NOT use `npm ci` currently [OBSERVED: .github/workflows/main_procureflow-app-spl.yml:28]
- `serve` must be in package.json dependencies; it will be installed by `npm install`

**Recommended workflow improvement** (optional, not required for replication):
- Change `npm install` to `npm ci` for deterministic installs
- See Appendix A for optional workflow patch

### F.4 Azure App Service Configuration

| Setting | Required Value | Evidence |
|---------|----------------|----------|
| App Name | `ProcureFlow-App-SPL` | [OBSERVED: .github/workflows/main_procureflow-app-spl.yml:55] |
| Runtime | Node 20 LTS | [OBSERVED: .github/workflows/main_procureflow-app-spl.yml:24] |
| OS | Linux | [DERIVED: ubuntu-latest runner] |
| Startup Command | `npm start` | [DERIVED: runs the start script which invokes serve] |
| Always On | Enabled | [REQUIRES-OPERATOR] |
| HTTPS Only | Enabled | [REQUIRES-OPERATOR] |

### F.5 First Deploy Smoke Test

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to app URL | Login page loads |
| 2 | Check browser console | No red errors |
| 3 | Click "Sign in with Microsoft" | Redirect to Azure AD |
| 4 | Complete login | Return to app, dashboard loads |
| 5 | Check DevTools → Application → Service Workers | `sw.js` registered |
| 6 | Check DevTools → Application → Storage → Local Storage | `sb-*-auth-token` present |
| 7 | Check Network tab | Supabase requests return 200 |
| 8 | `curl https://<app-url>/version.json` | Returns valid JSON with gitHash |

---

## G. RUNTIME SEMANTICS CONTRACT

### G.1 Multi-Site Behavior
[OBSERVED: context/AppContext.tsx:10-25, 30-31, 156, 218-222]

**Storage Locations:**
| Location | Key | Purpose |
|----------|-----|---------|
| React State | `activeSiteIds: string[]` | Current session selection |
| localStorage | `activeSiteIds` | Persistence across sessions |
| Database | `users.site_ids` | User's assigned sites |

**Initialization Flow:**
[OBSERVED: context/AppContext.tsx:11-25]
1. Check `localStorage.getItem('activeSiteIds')`
2. If found, parse JSON array
3. If not found, check legacy key `activeSiteId` (migration)
4. Default to empty array `[]`

**Empty activeSiteIds Behavior:**
[OBSERVED: context/AppContext.tsx:234]
```typescript
if (!activeSiteIds.length) return []; // STRICT: No sites = No data
```
When no sites selected, app shows no PO data.

### G.2 Query Filtering Location
[OBSERVED: services/db.ts:478+, context/AppContext.tsx:234-236]

| Query | Filter Type | Location | Evidence |
|-------|-------------|----------|----------|
| `getPOs(siteIds)` | Supabase `.in()` | services/db.ts | Database level |
| `filteredPos` | JavaScript `.filter()` | AppContext.tsx:234-236 | Client memory |

**IMPORTANT**: Both levels filter; Supabase query limits data fetched, JS filter ensures UI consistency.

### G.3 Approval Gating Flow
[OBSERVED: App.tsx, context/AppContext.tsx]

| User Status | Route | Component |
|-------------|-------|-----------|
| Unauthenticated | `/login` | Login.tsx |
| `PENDING_APPROVAL` | `/pending-approval` | OnboardingWizard.tsx |
| `APPROVED` | `/` (protected routes) | Dashboard, etc. |

[OBSERVED: context/AppContext.tsx:36] `isPendingApproval: boolean`

---

## H. PWA BREAK-GLASS RUNBOOK

### H.1 Service Worker + Cache Validation
[OBSERVED: public/sw.js:1-100]

**Check SW Status:**
1. DevTools → Application → Service Workers
2. Verify `sw.js` shows "activated and running"

**Check Cache Version:**
1. DevTools → Application → Cache Storage
2. Look for cache named `procureflow-{timestamp}`
3. The timestamp should match latest build

### H.2 Force Update / Clear Stale Caches

**Method: Clear via DevTools**
1. DevTools → Application → Storage
2. Click "Clear site data"
3. Reload page

**Alternative: Unregister Service Worker**
1. DevTools → Application → Service Workers
2. Click "Unregister"
3. Reload page

### H.3 Verify version.json Currency

**Local build verification:**
```bash
ls dist/version.json
cat dist/version.json
```

**Deployed verification:**
```bash
curl https://<your-app-url>/version.json
```

**Expected output:**
```json
{
  "version": "1707300000000",
  "buildTime": "2026-02-08T...",
  "gitHash": "abc1234",
  "environment": "production"
}
```

Compare `gitHash` with latest commit on `main` branch:
```bash
git rev-parse --short HEAD
```

### H.4 PWA Failure Modes

| Issue | Symptom | Fix |
|-------|---------|-----|
| Old version displayed | Features missing | Clear cache storage via DevTools |
| SW not registered | No offline support | Check console for registration errors |
| version.json 404 | SW uses fallback timestamp | Verify build completed, file in dist/ |
| Cache never clears | Always stale | Unregister SW, clear all data |

---

## I. OPERATOR INPUTS NEEDED

| # | Input | Example | Where to Find | Why Needed |
|---|-------|---------|---------------|------------|
| 1 | Supabase Project URL | `https://xyz.supabase.co` | Supabase Dashboard → Settings → API | Runtime API endpoint |
| 2 | Supabase Anon Key | `eyJ...` | Supabase Dashboard → Settings → API | Client authentication |
| 3 | Azure Entra Client ID | `xxxxxxxx-xxxx-...` | Azure Portal → Entra ID → App registrations | OAuth provider config |
| 4 | Azure Entra Client Secret | `xxxxxxxxx` | Azure Portal → App → Certificates & secrets | OAuth provider config |
| 5 | Azure Entra Tenant ID | `xxxxxxxx-xxxx-...` | Azure Portal → Entra ID → Overview | Single-tenant auth |
| 6 | Azure Web App Name | `ProcureFlow-App-SPL` | Azure Portal → App Services | Deploy target |
| 7 | Azure Publish Profile | XML blob | Azure Portal → App Service → Download | GitHub Actions auth |
| 8 | Azure Startup Command | `npm start` | Azure Portal → App Service → Configuration | Runtime config |
| 9 | Production Domain | `procureflow.azurewebsites.net` | Azure Portal | Redirect URIs, PWA manifest |

---

## J. POST-REPLICATION IMPROVEMENT PLAN

> These items are NOT required for replication. They address security and performance after the app is running.

### J.1 Security: RLS Hardening (CRITICAL)

**Current State**: All tables except `users` have `USING (true)` - fully permissive.

**Risk**: Any authenticated user can query/modify any row in any table.

**Recommended Fix**: Implement site-based RLS policies:

```sql
-- Example for po_requests
DROP POLICY IF EXISTS "Allow all public access" ON po_requests;

CREATE POLICY "Users can access their site POs" ON po_requests
FOR ALL USING (
  site_id = ANY(
    (SELECT site_ids FROM users WHERE id = auth.uid())
  )
);
```

### J.2 CI/CD: Use npm ci for Deterministic Installs

**Current State**: Uses `npm install` which may resolve different versions.

**Fix**: Change to `npm ci --omit=dev` for production builds.

### J.3 Performance: Lazy Load Heavy Components

**Current State**: Some components may not be lazy-loaded.

**Recommendation**: Audit all route components for `React.lazy()` usage.

### J.4 Monitoring: Add Error Tracking

**Recommendation**: Integrate Sentry or similar for production error visibility.

---

## REPLICATION READINESS DECLARATION

**STATUS: YES** - Replication is achievable with the Operator Inputs checklist.

**Prerequisites:**
1. Apply the package.json patch (Appendix A) to add `serve` dependency and `start` script
2. Commit and push the patch to trigger CI/CD
3. Configure Azure Web App startup command: `npm start`
4. Provide all 9 operator inputs listed in Section I

**No missing items that cannot be observed** - all remaining unknowns are operator-provided values (credentials, project IDs) that are intentionally not stored in the repository.

---

## APPENDIX A: REQUIRED PATCHES

### Patch 1: package.json (REQUIRED)

This patch adds the `serve` dependency and `start` script required for Azure deployment.

```diff
diff --git a/package.json b/package.json
index abc1234..def5678 100644
--- a/package.json
+++ b/package.json
@@ -6,7 +6,8 @@
   "scripts": {
     "dev": "vite --mode staging",
     "dev:prod": "vite --mode production",
     "build": "npm run build:prod",
     "build:staging": "tsc && vite build --mode staging",
     "build:prod": "tsc && vite build --mode production",
-    "preview": "vite preview"
+    "preview": "vite preview",
+    "start": "serve -s dist -l 8080"
   },
   "dependencies": {
     "@supabase/supabase-js": "^2.87.1",
     "lucide-react": "^0.555.0",
     "react": "^19.2.1",
     "react-dom": "^19.2.1",
     "react-dropzone": "^14.3.8",
     "react-router-dom": "^7.10.1",
     "recharts": "^3.5.1",
+    "serve": "^14.2.4",
     "uuid": "^13.0.0",
     "xlsx": "^0.18.5"
   },
```

**Apply with:**
```bash
git apply patch1.diff
npm install
git add package.json package-lock.json
git commit -m "Add serve dependency and start script for Azure deployment"
git push
```

### Patch 2: GitHub Actions Workflow (OPTIONAL - Recommended)

This optional patch changes `npm install` to `npm ci` for deterministic installs.

```diff
diff --git a/.github/workflows/main_procureflow-app-spl.yml b/.github/workflows/main_procureflow-app-spl.yml
index abc1234..def5678 100644
--- a/.github/workflows/main_procureflow-app-spl.yml
+++ b/.github/workflows/main_procureflow-app-spl.yml
@@ -25,7 +25,7 @@
 
       - name: npm install, build, and test
         run: |
-          npm install
+          npm ci
           npm run build --if-present
           npm run test --if-present
         env:
```

---

## DOCUMENT METADATA

| Field | Value |
|-------|-------|
| Version | 2.1 |
| Created | 2026-02-08 |
| Last Updated | 2026-02-08T15:28:00+11:00 |
| Evidence Standard | All claims tagged [OBSERVED]/[DERIVED]/[REQUIRES-OPERATOR] |
| Schema File | schema.sql (326 lines, 16 tables) |
| Migration Files | 1 (20240130_add_unique_constraint_supplier_product_map.sql) |
| Fix Scripts | fix_users_table.sql |
| RLS Status | Enabled but permissive (application-level filtering only) |
| Table `user_site_assignments` | **DOES NOT EXIST** |
| User site assignment | `users.site_ids` TEXT[] column |
| Canonical Hosting | Node process via `serve` package |
| Startup Command | `npm start` (invokes `serve -s dist -l 8080`) |
