# CORE RUNTIME SEMANTICS

> **Purpose**: Provider-agnostic runtime behavior definitions. This document NEVER changes when swapping authentication, deployment, or CI/CD modules.

---

## 1. Multi-Site Behavior

### 1.1 Storage Locations

[OBSERVED: context/AppContext.tsx:10-25, 30-31]

| Location | Key | Purpose |
|----------|-----|---------|
| React State | `activeSiteIds: string[]` | Session selection |
| localStorage | `activeSiteIds` | Persistence across sessions |
| Database | `users.site_ids` | User assignments (server-side truth) |

### 1.2 Site Selection Flow

```
User Login
    ↓
Load users.site_ids from database
    ↓
Check localStorage for previous activeSiteIds
    ↓
If localStorage has valid subset of site_ids → use it
Else → default to all assigned sites
    ↓
User can change selection in UI
    ↓
Selection saved to localStorage
```

### 1.3 Empty Site Selection Behavior

[OBSERVED: context/AppContext.tsx:234]

```typescript
if (!activeSiteIds.length) return [];
```

**Semantics**: No sites selected = no data displayed. This is intentional for security.

### 1.4 Site Assignment Model

**CRITICAL**: [OBSERVED: fix_users_table.sql:5, services/db.ts:46]

- Users are assigned to sites via `users.site_ids` TEXT[] column
- This is NOT a join table (no `user_site_assignments` table exists)
- Site IDs are stored as array of UUID strings

**Verification:**
```sql
SELECT id, email, site_ids FROM users WHERE site_ids IS NOT NULL;
-- Expect: Array of UUID strings per user
```

---

## 2. Query Filtering

### 2.1 Filtering Mechanisms

[OBSERVED: services/db.ts:478+, context/AppContext.tsx:234-236]

| Query | Filter Type | Location |
|-------|-------------|----------|
| `getPOs(siteIds)` | Supabase `.in()` | Database level |
| `filteredPos` | JavaScript `.filter()` | Client memory |

### 2.2 Query Pattern

All data queries follow this pattern:

```typescript
// In db.ts service layer
const { data } = await supabase
  .from('po_requests')
  .select('*')
  .in('site_id', activeSiteIds);

// In AppContext - additional client-side filtering  
const filteredPos = purchaseOrders.filter(po => 
  activeSiteIds.includes(po.site_id)
);
```

### 2.3 Data Isolation Guarantee

**CURRENT STATE**: Application-level filtering only.

| Layer | Filtering | Enforced |
|-------|-----------|----------|
| Database RLS | None (permissive policies) | NO |
| API Layer | `.in()` clause | YES |
| Client State | `.filter()` | YES |

**SECURITY NOTE**: A malicious client could bypass app-level filtering. RLS hardening is a post-replication improvement.

---

## 3. User Status Flow

### 3.1 Status Values

[OBSERVED: context/AppContext.tsx:36, REPLICATION_BLUEPRINT:258-263]

| Status | Meaning | Route |
|--------|---------|-------|
| `pending` | User logged in but awaiting admin approval | `/pending-approval` |
| `approved` | User approved, full access granted | Protected routes |
| `disabled` | User access revoked | Blocked |

### 3.2 Approval Gating

[OBSERVED: App.tsx, context/AppContext.tsx:36]

```
User Login
    ↓
Check user.status in database
    ↓
If status = 'pending' → Redirect to /pending-approval
If status = 'approved' → Allow protected routes
If status = 'disabled' → Sign out
```

### 3.3 First-Time User Flow

```
New User OAuth Login
    ↓
Domain validation (client-side)
    ↓
Create user record with status = 'pending'
    ↓
Show OnboardingWizard (/pending-approval)
    ↓
Admin approves user (status → 'approved')
    ↓
User refreshes → gains access
```

---

## 4. Session Management

### 4.1 Session Storage

[OBSERVED: lib/supabaseClient.ts:11-18]

| Setting | Value | Purpose |
|---------|-------|---------|
| Storage | `window.localStorage` | Session persistence |
| Key Pattern | `sb-*-auth-token` | Supabase session token |
| Persist Session | `true` | Survive page reload |
| Auto Refresh | `true` | Token refresh before expiry |

### 4.2 Session Lifecycle

```
Page Load
    ↓
Check localStorage for sb-*-auth-token
    ↓
If valid → Restore session
If expired → Attempt refresh
If invalid/missing → Redirect to /login
```

### 4.3 Session Verification

**Browser-side:**
```javascript
// DevTools → Application → Local Storage
// Look for key starting with 'sb-'
localStorage.getItem('sb-<project-ref>-auth-token')
```

---

## 5. Domain Restriction

[OBSERVED: context/AppContext.tsx:505-511]

### 5.1 Enforcement Point

```typescript
if (!email?.toLowerCase().endsWith('@splservices.com.au')) {
    alert("Access Restricted: Only @splservices.com.au accounts are allowed.");
    await supabase.auth.signOut();
    return;
}
```

### 5.2 Enforcement Location

| Point | Enforced |
|-------|----------|
| OAuth Provider | NO (Azure allows any tenant user) |
| Supabase Auth | NO (passes through) |
| Client Application | YES (after OAuth, before user creation) |
| Database RLS | NO |

**Implication**: Domain restriction is client-side only. A modified client could bypass this check.

---

## 6. Role-Based Permissions

### 6.1 Permission Model

[OBSERVED: seed.sql, services/db.ts]

Roles define permission arrays:

```sql
INSERT INTO roles (id, name, permissions) VALUES
  ('SITE_USER', 'Site User', ARRAY['view_dashboard', 'create_request', 'receive_goods']),
  ('APPROVER', 'Approver', ARRAY['view_dashboard', 'view_all_requests', 'approve_requests']),
  ('ADMIN', 'Administrator', ARRAY['view_dashboard', 'create_request', 'view_all_requests', 
    'approve_requests', 'link_concur', 'receive_goods', 'view_finance', 
    'manage_finance', 'manage_settings', 'manage_items', 'manage_suppliers']);
```

### 6.2 Permission Checking

```typescript
// In AppContext
const hasPermission = (permission: string) => {
  return user?.role?.permissions?.includes(permission) ?? false;
};
```

### 6.3 Known Permissions

| Permission | Grants |
|------------|--------|
| `view_dashboard` | Access to dashboard |
| `create_request` | Create purchase orders |
| `view_all_requests` | View all POs (not just own) |
| `approve_requests` | Approve/reject POs |
| `link_concur` | Link POs to Concur system |
| `receive_goods` | Record deliveries |
| `view_finance` | View finance tab |
| `manage_finance` | Edit finance data |
| `manage_settings` | Access settings panel |
| `manage_items` | Edit item catalog |
| `manage_suppliers` | Edit suppliers |

---

## 7. Lazy Loading Semantics

[OBSERVED: App.tsx]

### 7.1 Lazy-Loaded Components

```typescript
const Dashboard = lazy(() => import('./components/Dashboard'));
const POList = lazy(() => import('./components/POList'));
const POCreate = lazy(() => import('./components/POCreate'));
const PODetail = lazy(() => import('./components/PODetail'));
const Settings = lazy(() => import('./components/Settings'));
const FinanceView = lazy(() => import('./components/FinanceView'));
```

### 7.2 Loading Behavior

- Components load on first navigation to route
- Suspense boundary shows loading indicator
- Network errors cause route failure

---

## 8. Service Worker Integration

### 8.1 Registration

[OBSERVED: App.tsx]

```typescript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
```

### 8.2 Registration Timing

- Registered on window `load` event
- Non-blocking (fires after initial paint)
- Failure is non-fatal

---

## 9. Runtime Invariants

These MUST remain true regardless of module swaps:

| # | Invariant | Verification |
|---|-----------|--------------|
| 1 | Empty activeSiteIds returns empty data | Select no sites → no POs shown |
| 2 | Session stored in localStorage | Check `sb-*` key exists after login |
| 3 | Domain restriction at client level | Login with non-matching domain → rejected |
| 4 | Status gating before protected routes | Pending user → /pending-approval |
| 5 | Service worker registered at /sw.js | DevTools → Service Workers → sw.js active |
| 6 | Lazy loading via React.lazy() | Network tab shows dynamic imports |

---

## Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Created | 2026-02-08 |
| Source | `SYSTEM_ARCHITECTURE_COMPLETION_v3.md` Section G, `REPLICATION_BLUEPRINT.md` Section 6 |
| Canonical Truth | `SYSTEM_ARCHITECTURE_COMPLETION_v3.md` |
