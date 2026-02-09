# AUTH MODULE: Template

> **Module Type**: Authentication
> **Provider**: [REQUIRES-OPERATOR: Choose provider]
> **Status**: TEMPLATE

---

## Module Interface Contract

### Inputs (Operator-Provided)

| Input | Source | Required |
|-------|--------|----------|
| OAuth Client ID | [REQUIRES-OPERATOR: Provider dashboard] | YES |
| OAuth Client Secret | [REQUIRES-OPERATOR: Provider dashboard] | YES |
| Authorized Redirect URIs | [REQUIRES-OPERATOR: Provider dashboard] | YES |
| Domain Restriction | [REQUIRES-OPERATOR: Organizational policy] | NO |

### Outputs (Artifacts Produced)

| Output | Location | Format |
|--------|----------|--------|
| Session Token | `localStorage['sb-*-auth-token']` | JWT |
| User Record | `users` table | Database row |
| Auth State | `AppContext.user` | React state |

### Dependencies

| Module | Requirement |
|--------|-------------|
| CORE_DATA_CONTRACT | `users` table with `role_id`, `status`, `site_ids` columns |
| CORE_RUNTIME_SEMANTICS | Domain restriction logic, status flow |

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | YES | Supabase API endpoint |
| `VITE_SUPABASE_ANON_KEY` | YES | Supabase public key |

---

## Provider Configuration

### 1. Supabase Client Configuration

The Supabase client configuration remains the same regardless of OAuth provider:

```typescript
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      flowType: 'implicit',
      detectSessionInUrl: true,
      autoRefreshToken: true,
      persistSession: true,
      storage: window.localStorage
    }
  }
);
```

### 2. Supabase Dashboard: Enable Provider

[REQUIRES-OPERATOR]

1. Navigate to: Supabase Dashboard → Authentication → Providers
2. Find your chosen provider
3. Enable the provider toggle
4. Configure:
   - Client ID: [REQUIRES-OPERATOR]
   - Client Secret: [REQUIRES-OPERATOR]
   - Any provider-specific settings

### 3. Provider-Side Configuration

[REQUIRES-OPERATOR]

1. Create OAuth application in provider's dashboard
2. Configure Redirect URI: `https://<supabase-project-ref>.supabase.co/auth/v1/callback`
3. Configure required scopes: [REQUIRES-OPERATOR: List required scopes]
4. Copy Client ID and Secret to Supabase

### 4. Domain Restriction (Optional)

[REQUIRES-OPERATOR]

If domain restriction is required, update `AppContext.tsx`:

```typescript
// Line ~506
const DOMAIN_ALLOW = '[REQUIRES-OPERATOR: your-domain.com]';
if (!email?.toLowerCase().endsWith(DOMAIN_ALLOW)) {
    alert(`Access Restricted: Only ${DOMAIN_ALLOW} accounts are allowed.`);
    await supabase.auth.signOut();
    return;
}
```

---

## Supported Providers (Supabase)

| Provider | Notes |
|----------|-------|
| Google | Requires GCP Console setup |
| GitHub | Requires GitHub OAuth App |
| Discord | Requires Discord Developer Portal |
| Apple | Requires Apple Developer account |
| Azure/Microsoft | Requires Entra ID app registration |
| Facebook | Requires Meta Developer setup |
| Twitter | Requires Twitter Developer account |
| Bitbucket | Requires Atlassian account |
| GitLab | Requires GitLab application |
| Slack | Requires Slack app |
| Spotify | Requires Spotify Developer |
| Twitch | Requires Twitch Developer |
| LinkedIn | Requires LinkedIn Developer |
| Notion | Requires Notion integration |
| Zoom | Requires Zoom Marketplace |

---

## Invariants

These MUST remain true for this module:

| # | Invariant | Verification |
|---|-----------|--------------|
| 1 | Implicit flow configured | supabaseClient.ts has `flowType: 'implicit'` |
| 2 | Redirect URL matches | Provider and Supabase URLs identical |
| 3 | Session persists | localStorage has sb-* key after login |
| 4 | User record created | users table has row after first login |
| 5 | Domain restriction active (if configured) | Non-domain login rejected |

---

## Failure Modes

| Error | Symptom | Fix |
|-------|---------|-----|
| Redirect fails | Browser stays on provider login | Verify redirect URIs match exactly |
| "Access Restricted" alert | Immediate signout | Use correct domain account |
| White screen after login | Token not parsed | Clear localStorage, verify `detectSessionInUrl: true` |
| Session lost on refresh | Token not persisting | Verify localStorage access not blocked |
| Provider API fails | Missing user data | Check scopes, re-consent |

---

## Verification Checklist

| # | Check | Method | Expected |
|---|-------|--------|----------|
| 1 | Provider enabled | Supabase Dashboard | Toggle ON |
| 2 | Client ID configured | Supabase Dashboard | Present |
| 3 | Redirect URLs match | Compare dashboards | Identical |
| 4 | Login flow completes | Browser test | Dashboard loads |
| 5 | Session token present | Check localStorage | sb-* key exists |
| 6 | User record created | Query users table | New row exists |
| 7 | Domain restriction works | Login test | Rejected if configured |
| 8 | Scopes correct | User profile data | All expected fields present |

---

## Operator Inputs Summary

| # | Input | Where to Get | Where to Apply |
|---|-------|--------------|----------------|
| 1 | OAuth Client ID | [REQUIRES-OPERATOR: Provider dashboard] | Supabase Dashboard → Provider |
| 2 | OAuth Client Secret | [REQUIRES-OPERATOR: Provider dashboard] | Supabase Dashboard → Provider |
| 3 | Domain Restriction | [REQUIRES-OPERATOR: Business decision] | AppContext.tsx if needed |

---

## Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Created | 2026-02-08 |
| Status | TEMPLATE |
| Based On | 20_AUTH_MODULE_CURRENT.md |
