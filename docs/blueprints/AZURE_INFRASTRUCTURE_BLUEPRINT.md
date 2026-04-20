# Azure Infrastructure & GitHub Blueprint

This document outlines the current hosting configuration, deployment pipeline, and infrastructure setup for the ProcureFlow application.

## 1. Hosting Architecture

**Service**: Azure Web App (App Service)
**Resource Name**: `ProcureFlow-App-SPL`
**Environment**: Production
**Runtime**: Node.js 20.x

### Deployment Model
- **Platform**: Hosted as a standard Azure Web App (likely Linux-based given the Node runtime preference, though Windows is possible).
- **Application Type**: Single Page Application (SPA) built with Vite/React.
- **Serving Mechanism**:
  - The application is built into static assets (HTML/CSS/JS) in the `dist/` folder.
  - *Note*: Since `package.json` lacks a `start` script, the Azure Web App must be configured with a custom startup command (e.g., `npx serve -s dist` or `pm2 serve /home/site/wwwroot/dist --no-daemon --spa`) or uses an IIS `web.config` if running on Windows.

## 2. GitHub Configuration

### Repository Structure
- **Root**: Application source code.
- **.github/workflows**: CI/CD pipeline definitions.
- **public/**: Static assets (PWA manifest, icons) copied to root on build.

### CI/CD Pipeline (`main_procureflow-app-spl.yml`)

The deployment is automated via **GitHub Actions**.

#### Trigger
- **Push to Branch**: `main`
- **Manual Trigger**: `workflow_dispatch` enabled.

#### Job 1: Build
**Runner**: `ubuntu-latest`

1.  **Checkout Code**: pulling the repository content.
2.  **Setup Node.js**: Sets version to `20.x`.
3.  **Install & Build**:
    - `npm install`: Installs dependencies.
    - `npm run build`: Executes `tsc && vite build --mode production`.
    - **Environment Injection**: Injects `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from GitHub Secrets during build time (these are baked into the static JS bundle).
4.  **Artifact Upload**:
    - Archives the entire working directory (including `dist` and `node_modules`) as an artifact named `node-app`.

#### Job 2: Deploy
**Runner**: `ubuntu-latest`
**Dependencies**: Waits for `Build` job completion.

1.  **Download Artifact**: Retrieves the `node-app` artifact.
2.  **Deploy to Azure**:
    - **Action**: `azure/webapps-deploy@v3`
    - **Target App**: `ProcureFlow-App-SPL`
    - **Slot**: `Production`
    - **Package**: `.` (Deploys the root of the artifact).
    - **Authentication**: Uses a Publish Profile stored in GitHub Secrets (`AZUREAPPSERVICE_PUBLISHPROFILE_...`).

## 3. Configuration & Secrets

### GitHub Secrets
These secrets must be maintained in the GitHub Repository settings (Settings > Secrets and variables > Actions):

| Secret Name | Purpose |
|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL (baked into build). |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous API key (baked into build). |
| `AZUREAPPSERVICE_PUBLISHPROFILE_...` | Authentication profile for deploying to the specific Azure Web App instance. |

### Application Config
- **Build Tool**: Vite (`vite.config.ts`)
- **Package Manager**: NPM
- **Output Directory**: `dist/`

## 4. Recommendations for Robustness

1.  **Startup Script**: Add a `start` script to `package.json` (e.g., `"start": "npx serve -s dist"`) to explicitly define how Azure should launch the app.
2.  **Artifact Optimization**: The current workflow uploads the entire root directory (`.`). This includes `node_modules` (heavy) and source code (unnecessary for prod).
    - *Improvement*: Configure the "Upload artifact" step to only upload the `dist` folder and a minimal `package.json` or server script if needed.
3.  **Azure Static Web Apps**: Consider migrating to **Azure Static Web Apps (SWA)**.
    - SWA is purpose-built for Vite/React SPAs.
    - Cheaper (often free for standard use).
    - Handles global distribution (CDN) automatically.
    - Simplifies the workflow (don't need to manage Node versions or startup commands).
