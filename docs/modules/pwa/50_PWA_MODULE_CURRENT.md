# PWA MODULE: Service Worker v1 (CURRENT)

> **Module Type**: Progressive Web App
> **Provider**: Custom Service Worker
> **Status**: CURRENT PRODUCTION

---

## Module Interface Contract

### Inputs (Operator-Provided)

| Input | Source | Required |
|-------|--------|----------|
| App Icons | Design team | YES |
| Theme Colors | Brand guidelines | YES |

### Outputs (Artifacts Produced)

| Output | Location | Format |
|--------|----------|--------|
| Service Worker | `public/sw.js` | JavaScript |
| Manifest | `public/manifest.json` | JSON |
| Version File | `dist/version.json` | JSON (generated) |
| Icons | `public/icons/` | PNG |

### Dependencies

| Module | Requirement |
|--------|-------------|
| CORE_SYSTEM | Build produces dist/ |
| DEPLOY | Serves files from correct paths |

---

## PWA Assets

### 1. Manifest Configuration

[OBSERVED: public/manifest.json]

```json
{
  "name": "ProcureFlow",
  "short_name": "ProcureFlow",
  "description": "Procurement Management System",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#1e293b",
  "background_color": "#0f172a",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "New Request", "url": "/create", "icons": [...] },
    { "name": "Approvals", "url": "/approvals", "icons": [...] }
  ]
}
```

### 2. Service Worker Location

[OBSERVED: public/sw.js]

| Asset | Location | Purpose |
|-------|----------|---------|
| Manifest | `public/manifest.json` | PWA metadata, icons, shortcuts |
| Service Worker | `public/sw.js` | Caching, offline support |
| Version file (pre-build) | `public/version.json` | Generated at buildStart, copied to dist/ |
| Version generator | `vite.config.ts:20-47` | Writes version.json on buildStart |

---

## Service Worker Behavior

### Caching Strategies

[OBSERVED: public/sw.js]

| Request Type | Strategy | Fallback |
|--------------|----------|----------|
| HTML, API, Supabase | Network-first | Cache |
| Static assets (JS, CSS, images) | Cache-first | Network |
| Other | Network-only | None |

### Version Management

- Fetches `/version.json` on activation
- Cache names prefixed with version: `ProcureFlow-{timestamp}`
- Old caches deleted on new version

### Registration

[OBSERVED: App.tsx]

```typescript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
```

---

## Version File Generation

[OBSERVED: vite.config.ts:20-47]

```typescript
const versionGenerator = () => ({
  name: 'version-generator',
  buildStart() {
    const versionData = {
      version: Date.now().toString(),
      buildTime: new Date().toISOString(),
      gitHash: execSync('git rev-parse --short HEAD').toString().trim(),
      environment: process.env.NODE_ENV
    };
    fs.writeFileSync('public/version.json', JSON.stringify(versionData, null, 2));
  }
});
```

### version.json Format

```json
{
  "version": "1707400000000",
  "buildTime": "2026-02-08T06:00:00.000Z",
  "gitHash": "abc1234",
  "environment": "production"
}
```

---

## Required Icons

Generate icons in these sizes:

| Size | Filename | Purpose |
|------|----------|---------|
| 72x72 | icon-72x72.png | App icon |
| 96x96 | icon-96x96.png | App icon |
| 128x128 | icon-128x128.png | App icon |
| 144x144 | icon-144x144.png | App icon |
| 152x152 | icon-152x152.png | App icon |
| 192x192 | icon-192x192.png | App icon (manifest) |
| 384x384 | icon-384x384.png | App icon |
| 512x512 | icon-512x512.png | Splash screen (manifest) |
| 512x512 | icon-maskable-512x512.png | Android adaptive (manifest) |

---

## Break-Glass Runbook

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

## Invariants

These MUST remain true for this module:

| # | Invariant | Verification |
|---|-----------|--------------|
| 1 | sw.js in public/ | File exists |
| 2 | manifest.json in public/ | File exists |
| 3 | SW registered at /sw.js | DevTools → SW active |
| 4 | version.json generated | dist/version.json after build |
| 5 | Icons all present | All sizes in public/icons/ |

---

## Failure Modes

| Error | Symptom | Fix |
|-------|---------|-----|
| SW not registered | No offline support | Check App.tsx registration code |
| Cache not updating | Old version shown | Clear site data, refresh |
| version.json missing | Update check fails | Check vite.config.ts plugin |
| Icons missing | Install prompt fails | Add all required icon sizes |
| Wrong start_url | App opens to wrong page | Update manifest.json |

---

## Verification Checklist

| # | Check | Method | Expected |
|---|-------|--------|----------|
| 1 | SW registered | DevTools → Application → SW | Status: activated |
| 2 | Cache created | DevTools → Cache Storage | procureflow-* cache |
| 3 | version.json in build | `ls dist/version.json` | File exists |
| 4 | version.json accessible | `curl <url>/version.json` | Valid JSON |
| 5 | Manifest valid | DevTools → Application → Manifest | No errors |
| 6 | PWA installable | Browser location bar | Install button/prompt |
| 7 | Icons load | DevTools → Network | 200 for icon requests |

---

## Console Messages

After successful registration, expect:

```
SW: Service Worker registered successfully
```

On version update:

```
SW: New version available, updating...
```

---

## Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Created | 2026-02-08 |
| Provider | Custom Service Worker |
| Source | `SYSTEM_ARCHITECTURE_COMPLETION_v3.md` Section B.4, H |
| Canonical Truth | `SYSTEM_ARCHITECTURE_COMPLETION_v3.md` |
