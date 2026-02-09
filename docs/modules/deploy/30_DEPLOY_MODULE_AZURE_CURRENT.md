# DEPLOY MODULE: Azure App Service (CURRENT)

> **Module Type**: Deployment Platform
> **Provider**: Azure App Service (Node.js runtime)
> **Status**: CURRENT PRODUCTION

---

## Module Interface Contract

### Inputs (Operator-Provided)

| Input | Source | Required |
|-------|--------|----------|
| Azure Web App Name | Azure Portal → App Services | YES |
| Azure Publish Profile | Azure Portal → Download publish profile | YES |
| Startup Command | Configure in Azure Portal | YES |
| Production Domain | Azure Portal | YES |

### Outputs (Artifacts Produced)

| Output | Location | Format |
|--------|----------|--------|
| Running Application | https://<app-name>.azurewebsites.net | HTTPS endpoint |
| Version Endpoint | https://<app-name>/version.json | JSON |

### Dependencies

| Module | Requirement |
|--------|-------------|
| CORE_SYSTEM | `dist/` output directory |
| CICD | Artifact upload for deployment |
| AUTH | Redirect URLs configured for domain |

### Required Ports

| Port | Purpose |
|------|---------|
| 8080 | Application listening port |

### Required Build Artifact Shape

| Path | Content |
|------|---------|
| `dist/` | Vite build output (static files) |
| `dist/index.html` | SPA entry point |
| `dist/version.json` | Version metadata |
| `package.json` | Must include `serve` dependency and `start` script |

---

## Provider Configuration

### 1. Canonical Hosting Model

[DERIVED: from Azure Web App Node.js runtime requirements]

**Canonical Statement**: Azure App Service runs a Node process that serves the static `dist/` output using the `serve` dependency.

The application produces a static SPA bundle during build. At runtime, Azure Web Apps (Node.js) executes `npm start`, which runs the `serve` package to serve these static files with SPA fallback routing.

### 2. Azure App Service Configuration

| Setting | Value | Evidence |
|---------|-------|----------|
| App Name | `ProcureFlow-App-SPL` | [OBSERVED: workflow:55] |
| Runtime | Node 20 LTS | [OBSERVED: workflow:24] |
| Startup Command | `npm start` | [REQUIRES-OPERATOR] |
| Always On | Enabled | [REQUIRES-OPERATOR] |
| HTTPS Only | Enabled | [REQUIRES-OPERATOR] |

### 3. Required package.json Configuration

[OBSERVED: SYSTEM_ARCHITECTURE_COMPLETION_v3.md Appendix A]

**CRITICAL**: The following patch MUST be applied before deployment:

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

**Apply Patch:**
```bash
# Edit package.json to add serve and start script
npm install
git add package.json package-lock.json
git commit -m "Add serve dependency and start script for Azure"
git push
```

### 4. Start/Run Contract

| Item | Required Value | Status |
|------|----------------|--------|
| `serve` in dependencies | `"serve": "^14.2.4"` | [DERIVED: must be added] |
| `start` script | `"serve -s dist -l 8080"` | [DERIVED: must be added] |
| Azure Startup Command | `npm start` | [REQUIRES-OPERATOR] |

---

## Azure Portal Setup Steps

### Step 1: Create Web App

1. Azure Portal → App Services → Create
2. Basics:
   - Resource Group: [REQUIRES-OPERATOR: Select or create]
   - Name: `ProcureFlow-App-SPL` (or appropriate name)
   - Publish: Code
   - Runtime stack: Node 20 LTS
   - Operating System: Linux (recommended)
   - Region: [REQUIRES-OPERATOR: Select nearest]

### Step 2: Configure Startup Command

1. Web App → Configuration → General settings
2. Startup Command: `npm start`
3. Save

### Step 3: Enable Always On

1. Web App → Configuration → General settings
2. Always On: On
3. Save

### Step 4: Enable HTTPS Only

1. Web App → Configuration → General settings
2. HTTPS Only: On
3. Save

### Step 5: Download Publish Profile

1. Web App → Overview → Download publish profile
2. Save XML file
3. Add contents to GitHub Secret: `AZUREAPPSERVICE_PUBLISHPROFILE_*`

---

## SPA Routing Requirement

The `serve -s` flag enables SPA (Single Page Application) mode:
- All routes that don't match a static file return `index.html`
- Client-side routing works correctly
- Deep links work on page refresh

**Verification:**
```bash
# Navigate to any route directly
curl -I https://<app-url>/requests/123
# Expected: 200 OK (not 404)
```

---

## Redirect URL Configuration

[REQUIRES-OPERATOR] After deployment, configure auth redirect URLs:

### For Supabase

Dashboard → Authentication → URL Configuration:
- Site URL: `https://<app-name>.azurewebsites.net`
- Redirect URLs: Add `https://<app-name>.azurewebsites.net/**`

### For Azure Entra

Azure Portal → App registrations → Authentication:
- Add Redirect URI: `https://<supabase-ref>.supabase.co/auth/v1/callback`

---

## Invariants

These MUST remain true for this module:

| # | Invariant | Verification |
|---|-----------|--------------|
| 1 | Port 8080 exposed | `serve -l 8080` in start script |
| 2 | SPA fallback enabled | `serve -s` flag present |
| 3 | HTTPS enforced | Azure HTTPS Only setting |
| 4 | Static files served | `dist/` accessible via URL |
| 5 | version.json accessible | `curl <url>/version.json` returns JSON |

---

## Failure Modes

| Error | Symptom | Fix |
|-------|---------|-----|
| App won't start | "Application Error" page | Check startup command, logs |
| 404 on routes | SPA routing broken | Ensure `serve -s` flag |
| serve not found | Startup fails | Add serve to dependencies |
| Cold start slow | First request timeout | Enable "Always On" |
| Mixed content | Assets blocked | Enable HTTPS Only |

---

## Verification Checklist

| # | Check | Method | Expected |
|---|-------|--------|----------|
| 1 | App accessible | Browser navigate | Login page loads |
| 2 | HTTPS working | Browser check | Lock icon, no warnings |
| 3 | version.json accessible | `curl <url>/version.json` | Valid JSON |
| 4 | SPA routing works | Direct deep link | Page loads (not 404) |
| 5 | Startup command set | Azure Portal check | `npm start` |
| 6 | Always On enabled | Azure Portal check | Toggle ON |
| 7 | serve in package.json | View file | Dependency present |
| 8 | start script correct | View file | `serve -s dist -l 8080` |

---

## Operator Inputs Summary

| # | Input | Where to Get | Where to Apply |
|---|-------|--------------|----------------|
| 1 | Azure Web App Name | Choose/Create | Azure Portal → App Services |
| 2 | Azure Publish Profile | Azure Portal → Download | GitHub Secret |
| 3 | Azure Startup Command | N/A | Azure Portal → Configuration → `npm start` |
| 4 | Production Domain | Azure Portal → Custom domains | Supabase redirect URLs |

---

## Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Created | 2026-02-08 |
| Provider | Azure App Service (Node.js) |
| Source | `SYSTEM_ARCHITECTURE_COMPLETION_v3.md` Section F |
| Canonical Truth | `SYSTEM_ARCHITECTURE_COMPLETION_v3.md` |
