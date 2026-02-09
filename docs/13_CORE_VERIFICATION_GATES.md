# CORE VERIFICATION GATES

> **Purpose**: Provider-agnostic verification checklists. These tests MUST pass regardless of which authentication, deployment, or CI/CD modules are in use.

---

## 1. Architecture Definition of Done

[OBSERVED: SYSTEM_ARCHITECTURE_COMPLETION_v3.md Section A]

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

## 2. Database Verification Script

Run this SQL script after schema application to verify all gates:

```sql
-- Gate 1: uuid-ossp extension
SELECT 'Gate 1' as gate, 
       CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END as result
FROM pg_extension WHERE extname='uuid-ossp';

-- Gate 2: Table count
SELECT 'Gate 2' as gate,
       CASE WHEN COUNT(*) >= 16 THEN 'PASS' ELSE 'FAIL' END as result
FROM information_schema.tables 
WHERE table_schema='public' AND table_type='BASE TABLE';

-- Gate 3: RLS enabled
SELECT 'Gate 3' as gate,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM pg_tables WHERE schemaname='public' AND rowsecurity=false;

-- Gate 4: users.site_ids column
SELECT 'Gate 4' as gate,
       CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END as result
FROM information_schema.columns 
WHERE table_name='users' AND column_name='site_ids';

-- Gate 5: idx_items_sap_norm index
SELECT 'Gate 5' as gate,
       CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END as result
FROM pg_indexes WHERE indexname='idx_items_sap_norm';
```

**Expected Output:**
```
 gate  | result
-------+--------
 Gate 1| PASS
 Gate 2| PASS
 Gate 3| PASS
 Gate 4| PASS
 Gate 5| PASS
```

---

## 3. Build Verification Checklist

Execute after `npm run build`:

| # | Check | Command | Expected |
|---|-------|---------|----------|
| 1 | dist/ exists | `ls -la dist/` | Directory with files |
| 2 | index.html present | `ls dist/index.html` | File exists |
| 3 | version.json present | `ls dist/version.json` | File exists |
| 4 | version.json valid | `cat dist/version.json` | Valid JSON with gitHash |
| 5 | Assets hashed | `ls dist/assets/` | Files with hash in name |

**Verification Script (PowerShell):**
```powershell
# Run from project root after build
$errors = @()

if (!(Test-Path "dist")) { $errors += "dist/ missing" }
if (!(Test-Path "dist/index.html")) { $errors += "index.html missing" }
if (!(Test-Path "dist/version.json")) { $errors += "version.json missing" }

if (Test-Path "dist/version.json") {
    $version = Get-Content "dist/version.json" | ConvertFrom-Json
    if (!$version.gitHash) { $errors += "version.json missing gitHash" }
}

if ($errors.Count -eq 0) {
    Write-Host "BUILD VERIFICATION: PASS" -ForegroundColor Green
} else {
    Write-Host "BUILD VERIFICATION: FAIL" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "  - $_" }
}
```

---

## 4. First Deploy Smoke Test

[OBSERVED: SYSTEM_ARCHITECTURE_COMPLETION_v3.md Section F.6]

Execute after deployment:

| Step | Action | Expected | PASS/FAIL |
|------|--------|----------|-----------|
| 1 | Navigate to app URL | Login page loads | [ ] |
| 2 | Check browser console | No red errors | [ ] |
| 3 | Click "Sign in with Microsoft" | Redirect to Azure AD | [ ] |
| 4 | Complete login | Dashboard loads | [ ] |
| 5 | DevTools → Service Workers | `sw.js` activated | [ ] |
| 6 | DevTools → Local Storage | `sb-*-auth-token` present | [ ] |
| 7 | `curl https://<app-url>/version.json` | Returns valid JSON | [ ] |

---

## 5. Functional Verification Checklist

[OBSERVED: REPLICATION_BLUEPRINT.md Section 11]

| Check | How to Verify | Expected |
|-------|---------------|----------|
| App loads | Navigate to app URL | See login page |
| Microsoft login works | Click SSO, complete flow | Redirect to dashboard |
| User created in DB | Check `users` table | New row with email |
| Dashboard loads | After login | Dashboard with no errors |
| Data queries work | Open Settings | Sites/suppliers/items load |
| PWA installable | Chrome address bar | Install prompt available |
| Service worker registered | DevTools → App → SW | Status: activated |

---

## 6. Console Verification

Open browser DevTools after login. Check for:

| Message | Status |
|---------|--------|
| `SW: Service Worker registered successfully` | MUST appear |
| `Auth: Session established` | MUST appear |
| Red errors in Console | MUST NOT appear |
| Network requests to Supabase returning 200s | MUST verify |

---

## 7. Database Post-Deployment Verification

```sql
-- Check users exist
SELECT id, email, status, role_id FROM users;
-- Expected: At least 1 row after first login

-- Check roles exist
SELECT * FROM roles;
-- Expected: SITE_USER, APPROVER, ADMIN roles

-- Check sites exist  
SELECT * FROM sites;
-- Expected: At least 1 row (from seed or manual creation)
```

---

## 8. Module-Specific Verification

Each module defines its own verification gates. After swapping a module, run:

1. **Module-specific gates** from the new module document
2. **Core verification gates** from this document
3. **No-regression checklist** from `90_SWAP_FRAMEWORK.md`

### Module Verification Cross-Reference

| Module | Verification Document | Section |
|--------|----------------------|---------|
| AUTH | `20_AUTH_MODULE_*.md` | Verification Checklist |
| DEPLOY | `30_DEPLOY_MODULE_*.md` | Verification Checklist |
| CICD | `40_CICD_MODULE_*.md` | Verification Checklist |
| PWA | `50_PWA_MODULE_*.md` | Verification Checklist |

---

## 9. Invariant Verification Summary

These invariants MUST hold true across ALL module configurations:

| # | Invariant | Test |
|---|-----------|------|
| 1 | Build produces dist/ | `ls dist/` succeeds |
| 2 | version.json in dist/ | `ls dist/version.json` succeeds |
| 3 | 16+ tables in database | SQL count query |
| 4 | RLS enabled on all tables | SQL rowsecurity query |
| 5 | users.site_ids exists | SQL column query |
| 6 | Session in localStorage | Browser check after login |
| 7 | SW registered at /sw.js | DevTools check |
| 8 | OAuth flow completes | End-to-end login test |
| 9 | Site filtering works | PO query with site filter |
| 10 | version.json accessible at URL | curl test |

---

## 10. Failure Mode Table

| Failure | Symptom | Root Cause | Fix Pointer |
|---------|---------|------------|-------------|
| Gate 1 fails | Extension missing | schema.sql not run | Re-run schema.sql |
| Gate 2 fails | Table count wrong | Incomplete migration | Check all SQL scripts ran |
| Gate 3 fails | RLS disabled | Policy issue | Re-run RLS section of schema |
| Gate 4 fails | Column missing | fix_users_table.sql not run | Run fix_users_table.sql |
| Gate 6 fails | No auth token | OAuth misconfiguration | Check AUTH module |
| Gate 7 fails | No service worker | sw.js missing | Check public/sw.js exists |
| Gate 8 fails | No version.json | Build script issue | Check vite.config.ts |
| Gate 9 fails | No site filter | App bug | Check db.ts query patterns |
| Gate 10 fails | 404 on version.json | Deployment issue | Check DEPLOY module |

---

## Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Created | 2026-02-08 |
| Source | `SYSTEM_ARCHITECTURE_COMPLETION_v3.md` Sections A, F.6, H |
| Canonical Truth | `SYSTEM_ARCHITECTURE_COMPLETION_v3.md` |
