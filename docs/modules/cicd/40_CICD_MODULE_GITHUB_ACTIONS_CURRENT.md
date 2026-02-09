# CICD MODULE: GitHub Actions (CURRENT)

> **Module Type**: CI/CD Pipeline
> **Provider**: GitHub Actions
> **Status**: CURRENT PRODUCTION

---

## Module Interface Contract

### Inputs (Operator-Provided)

| Input | Source | Required |
|-------|--------|----------|
| VITE_SUPABASE_URL | Supabase Dashboard | YES |
| VITE_SUPABASE_ANON_KEY | Supabase Dashboard | YES |
| AZUREAPPSERVICE_PUBLISHPROFILE_* | Azure Portal | YES |

### Outputs (Artifacts Produced)

| Output | Location | Format |
|--------|----------|--------|
| Build Artifact | GitHub Actions artifact store | Directory (`.`) |
| Deployed Application | Azure App Service | Running app |

### Dependencies

| Module | Requirement |
|--------|-------------|
| AUTH | Environment variables for Supabase |
| DEPLOY | Publish profile, startup command configured |

### Required Build Artifact Shape

| Path | Content |
|------|---------|
| `.` (entire directory) | Full project including dist/ and node_modules |

---

## Workflow Configuration

### Workflow File Location

[OBSERVED: .github/workflows/main_procureflow-app-spl.yml:1-59]

`.github/workflows/main_procureflow-app-spl.yml`

### Complete Workflow (Current Canonical)

```yaml
name: Build and deploy Node.js app to Azure Web App - ProcureFlow-App-SPL

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js version
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: npm install, build, and test
        run: |
          npm install
          npm run build --if-present
          npm run test --if-present
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Upload artifact for deployment job
        uses: actions/upload-artifact@v4
        with:
          name: node-app
          path: .

  deploy:
    runs-on: ubuntu-latest
    needs: build
    environment:
      name: 'Production'
      url: ${{ steps.deploy-to-webapp.outputs.webapp-url }}
    
    steps:
      - name: Download artifact from build job
        uses: actions/download-artifact@v4
        with:
          name: node-app

      - name: 'Deploy to Azure Web App'
        id: deploy-to-webapp
        uses: azure/webapps-deploy@v3
        with:
          app-name: 'ProcureFlow-App-SPL'
          slot-name: 'Production'
          package: .
          publish-profile: ${{ secrets.AZUREAPPSERVICE_PUBLISHPROFILE_XXXXXXXXXXXXXXXXXXXXXXXX }}
```

---

## Pipeline Behavior

### Triggers

[OBSERVED: .github/workflows/main_procureflow-app-spl.yml:27-28]

| Trigger | Condition |
|---------|-----------|
| Push | Branch `main` |
| Manual | `workflow_dispatch` |

### Build Steps

| Step | Command | Purpose |
|------|---------|---------|
| Checkout | `actions/checkout@v4` | Get source code |
| Setup Node | `actions/setup-node@v4` | Node 20.x with npm cache |
| Install | `npm install` | Install dependencies |
| Build | `npm run build` | Compile and bundle |
| Test | `npm run test --if-present` | Run tests if defined |
| Upload | `actions/upload-artifact@v4` | Store build artifact |

### Deploy Steps

| Step | Action | Purpose |
|------|--------|---------|
| Download | `actions/download-artifact@v4` | Retrieve build artifact |
| Deploy | `azure/webapps-deploy@v3` | Push to Azure |

### Artifact Scope

[OBSERVED: .github/workflows/main_procureflow-app-spl.yml:39]

```yaml
path: .
```

**CURRENT CANONICAL**: The workflow uploads the entire directory. This behavior is preserved as canonical.

---

## Environment Variables Injection

[OBSERVED: .github/workflows/main_procureflow-app-spl.yml:31-33]

Environment variables are injected at build time:

```yaml
env:
  VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
  VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```

**CRITICAL**: These are baked into the JavaScript bundle at build time. They are NOT runtime-configurable.

---

## GitHub Secrets Configuration

### Required Secrets

| Secret Name | Purpose | Source |
|-------------|---------|--------|
| `VITE_SUPABASE_URL` | Supabase API endpoint | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase public key | Supabase Dashboard → Settings → API |
| `AZUREAPPSERVICE_PUBLISHPROFILE_*` | Azure deployment auth | Azure Portal → Download publish profile |

### Configuration Steps

1. Navigate to: Repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret with name and value

---

## Optional: Deterministic Installs

[OBSERVED: SYSTEM_ARCHITECTURE_COMPLETION_v3.md Appendix B]

For deterministic builds, change `npm install` to `npm ci`:

```diff
- npm install
+ npm ci
```

**Rationale**: `npm ci` uses `package-lock.json` exactly, ensuring reproducible builds.

This is OPTIONAL. The current workflow uses `npm install`.

---

## Invariants

These MUST remain true for this module:

| # | Invariant | Verification |
|---|-----------|--------------|
| 1 | Node 20.x used | Workflow has `node-version: '20.x'` |
| 2 | Build env vars injected | Secrets referenced in env block |
| 3 | Artifact includes dist/ | Check uploaded artifact |
| 4 | Deploy uses publish profile | Secret in deploy step |
| 5 | Triggers on main push | `branches: [main]` in triggers |

---

## Failure Modes

| Error | Symptom | Fix |
|-------|---------|-----|
| Build fails | Red X on Actions | Check build logs, fix code errors |
| Secret not found | Error in logs | Verify secret names match exactly |
| Deploy fails | Red X on deploy step | Check publish profile validity |
| version.json missing | Build warning | Check vite.config.ts plugin |
| Node version mismatch | Dep install fails | Ensure node-version: '20.x' |

---

## Verification Checklist

| # | Check | Method | Expected |
|---|-------|--------|----------|
| 1 | Workflow file exists | View `.github/workflows/` | YAML file present |
| 2 | Secrets configured | GitHub → Settings → Secrets | All 3 secrets present |
| 3 | Push triggers build | Push to main | Action runs |
| 4 | Build succeeds | Actions tab | Green checkmark |
| 5 | Deploy succeeds | Actions tab | Green checkmark |
| 6 | App accessible | Browser | Login page loads |
| 7 | version.json matches | Compare git hash | Build hash = deployed hash |

---

## Monitoring Pipeline

### View Pipeline Status

1. Repository → Actions tab
2. Click workflow run
3. View build and deploy job logs

### Common Log Locations

| Issue | Log Location |
|-------|--------------|
| Install errors | Build job → "npm install" step |
| Build errors | Build job → "npm run build" step |
| Deploy errors | Deploy job → "Deploy to Azure" step |

---

## Operator Inputs Summary

| # | Input | Where to Get | Where to Apply |
|---|-------|--------------|----------------|
| 1 | VITE_SUPABASE_URL | Supabase Dashboard → API | GitHub Secret |
| 2 | VITE_SUPABASE_ANON_KEY | Supabase Dashboard → API | GitHub Secret |
| 3 | Azure Publish Profile | Azure Portal → Download | GitHub Secret (full XML content) |

---

## Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Created | 2026-02-08 |
| Provider | GitHub Actions |
| Source | `SYSTEM_ARCHITECTURE_COMPLETION_v3.md` Section B.5, F |
| Canonical Truth | `SYSTEM_ARCHITECTURE_COMPLETION_v3.md` |
