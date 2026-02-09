# DEPLOY MODULE: Template

> **Module Type**: Deployment Platform
> **Provider**: [REQUIRES-OPERATOR: Choose platform]
> **Status**: TEMPLATE

---

## Module Interface Contract

### Inputs (Operator-Provided)

| Input | Source | Required |
|-------|--------|----------|
| Hosting Platform Credentials | [REQUIRES-OPERATOR: Platform dashboard] | YES |
| Deployment Authentication | [REQUIRES-OPERATOR: API key, publish profile, etc.] | YES |
| Production Domain | [REQUIRES-OPERATOR: DNS configuration] | YES |
| Startup Command | [REQUIRES-OPERATOR: Platform-specific] | YES |

### Outputs (Artifacts Produced)

| Output | Location | Format |
|--------|----------|--------|
| Running Application | [REQUIRES-OPERATOR: Production URL] | HTTPS endpoint |
| Version Endpoint | https://<domain>/version.json | JSON |

### Dependencies

| Module | Requirement |
|--------|-------------|
| CORE_SYSTEM | `dist/` output directory with `version.json` |
| CICD | Artifact upload and deployment trigger |
| AUTH | Redirect URLs configured for domain |

### Required Ports

| Port | Purpose |
|------|---------|
| [REQUIRES-OPERATOR: 8080 or other] | Application listening port |

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

The application is a static SPA that requires:
1. A Node.js runtime (or static file server)
2. SPA-mode routing (all routes return index.html)
3. HTTPS enforcement

### 2. package.json Requirements

The following MUST be present in package.json:

```json
{
  "scripts": {
    "start": "serve -s dist -l [REQUIRES-OPERATOR: PORT]"
  },
  "dependencies": {
    "serve": "^14.2.4"
  }
}
```

### 3. Provider-Specific Configuration

[REQUIRES-OPERATOR: Document platform-specific setup steps]

#### Example Platforms:

**Vercel:**
- vercel.json configuration
- Build command: `npm run build`
- Output Directory: `dist`

**Netlify:**
- netlify.toml configuration
- Publish directory: `dist`
- Redirect rules for SPA

**AWS S3 + CloudFront:**
- S3 bucket configuration
- CloudFront distribution
- Error page redirect to index.html

**Railway:**
- Procfile or start command
- Port configuration from environment

**Render:**
- Build command and start command
- Static site or web service

**DigitalOcean App Platform:**
- App specification YAML
- Routes configuration

---

## SPA Routing Requirement

All deployment platforms MUST support SPA routing:

| Platform | Configuration |
|----------|---------------|
| Node + serve | `serve -s` flag |
| Nginx | `try_files $uri /index.html` |
| Apache | `.htaccess` with rewrite rules |
| Vercel | `rewrites` in vercel.json |
| Netlify | `[[redirects]]` in netlify.toml |
| CloudFront | Error pages → index.html |

**Verification:**
```bash
# Navigate to any route directly
curl -I https://<domain>/requests/123
# Expected: 200 OK (not 404)
```

---

## Redirect URL Configuration

[REQUIRES-OPERATOR] After deployment, update auth redirect URLs:

### Supabase Dashboard

Dashboard → Authentication → URL Configuration:
- Site URL: [REQUIRES-OPERATOR: Production URL]
- Redirect URLs: Add `[REQUIRES-OPERATOR: Production URL]/**`

### OAuth Provider

Update redirect URI in OAuth provider settings if needed.

---

## Invariants

These MUST remain true for this module:

| # | Invariant | Verification |
|---|-----------|--------------|
| 1 | Static files served | `dist/` accessible via URL |
| 2 | SPA fallback enabled | Deep links return 200 |
| 3 | HTTPS enforced | No mixed content warnings |
| 4 | version.json accessible | `curl <url>/version.json` returns JSON |
| 5 | Port configured correctly | App responds on expected port |

---

## Failure Modes

| Error | Symptom | Fix |
|-------|---------|-----|
| App won't start | Error page | Check startup command and logs |
| 404 on routes | SPA routing broken | Configure fallback to index.html |
| Mixed content | Assets blocked | Enable HTTPS, fix asset URLs |
| version.json 404 | Update check fails | Verify build includes version.json |
| Cold start timeout | First request fails | Configure keep-alive or scaling |

---

## Verification Checklist

| # | Check | Method | Expected |
|---|-------|--------|----------|
| 1 | App accessible | Browser navigate | Login page loads |
| 2 | HTTPS working | Browser check | Lock icon, no warnings |
| 3 | version.json accessible | `curl <url>/version.json` | Valid JSON |
| 4 | SPA routing works | Direct deep link | Page loads (not 404) |
| 5 | Assets load | DevTools Network | All 200 status |
| 6 | Static files cached | Response headers | Cache-Control present |
| 7 | serve dependency present | package.json | In dependencies |
| 8 | start script correct | package.json | Points to serve |

---

## Operator Inputs Summary

| # | Input | Where to Get | Where to Apply |
|---|-------|--------------|----------------|
| 1 | Platform Credentials | [REQUIRES-OPERATOR: Platform] | Platform dashboard |
| 2 | Deployment Auth | [REQUIRES-OPERATOR: API/profile] | CICD secrets |
| 3 | Production Domain | [REQUIRES-OPERATOR: DNS] | Platform + Supabase |
| 4 | Port Number | [REQUIRES-OPERATOR: Platform docs] | start script |

---

## Migration from Azure App Service

If migrating from Azure:

| Azure Setting | New Platform Setting |
|---------------|----------------------|
| Startup Command: `npm start` | [REQUIRES-OPERATOR: Equivalent] |
| Port: 8080 | [REQUIRES-OPERATOR: May differ] |
| Publish Profile | [REQUIRES-OPERATOR: New auth method] |
| Always On | [REQUIRES-OPERATOR: Keep-alive config] |
| HTTPS Only | [REQUIRES-OPERATOR: SSL config] |

---

## Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Created | 2026-02-08 |
| Status | TEMPLATE |
| Based On | 30_DEPLOY_MODULE_AZURE_CURRENT.md |
