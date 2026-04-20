# Authentication, Session & Browser Management Replication Blueprint

This blueprint outlines the comprehensive logic required to replicate the precise, forensic-level Authentication, Session, and Browser Management architecture found in the ProcureFlow application. It is designed to be easily digestible for an independent AI agent to implement in a new React/Vite/Supabase web application.

## 1. Architecture Overview
- **Tech Stack**: React + Vite + Supabase
- **Auth Provider**: Azure AD (Microsoft) via Supabase OAuth (`signInWithOAuth`)
- **Flow Type**: Implicit Flow (`flowType: 'implicit'`)
- **State Management**: Centralized React Context (`AppContext.tsx`)
- **Persistence**: `window.localStorage` (used for Supabase JWTs, Session tracking, and Logout Notices)

---

## 2. Supabase Configuration & Initialization

**Supabase Client Setup (`lib/supabaseClient.ts`)**
Initialize the Supabase client enforcing the implicit flow and local storage persistence.
```typescript
import { createClient } from '@supabase/supabase-js';

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

---

## 3. Robust Authentication Flow

Authentication must be handled globally to ensure edge cases (e.g., stale locks, missing events, delayed callbacks) are accounted for seamlessly.

### A. Deadlock Prevention
Supabase can occasionally leave stale locks (`sb-lock`) if a tab crashes during auth, preventing future logins. You must clear these on initialization:
```typescript
for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('sb-lock')) {
        localStorage.removeItem(key);
    }
}
```

### B. Smart Robust Initialization and Listener
Setup `supabase.auth.onAuthStateChange` to listen to `SIGNED_IN`, `INITIAL_SESSION`, `SIGNED_OUT`, and `TOKEN_REFRESHED` events.

**Manual Recovery Mechanism:**
If Supabase's auto-detection listener fails to fire within a few seconds but an `access_token` exists in the URL hash, deploy a manual recovery timeout:
1. Detect `#access_token=...&refresh_token=...` in URL.
2. Wait 2.5 seconds. If the listener hasn't fired `SIGNED_IN`, manually trigger:
   `supabase.auth.setSession({ access_token, refresh_token })`

### C. Domain Restriction
Verify the user's domain immediately after resolving the session to prevent unauthorized external access.
```typescript
const email = session.user.email?.toLowerCase();
if (!email?.endsWith('@yourdomain.com')) {
    alert("Access Restricted: Only @yourdomain.com accounts are allowed.");
    await supabase.auth.signOut();
    return;
}
```

---

## 4. User Synchronization & Just-In-Time (JIT) Provisioning

Web apps featuring invite systems require careful mapping between traditional Database records and Auth provider identities.

### A. Profile Lookup Hierarchy
When a user logs in, query the `users` table cautiously:
1. **Fallback Matching**: Look up by `email` (`ilike`) first to catch pre-invited users who don't yet share the same underlying UUID as the `session.user.id`.
2. **Primary Matching**: If no email match, look up by `session.user.id`.

### B. Resolving Missing Indentities (JIT)
If the Database user record's `auth_user_id` does not match the `session.user.id`, execute an RPC function (`link_user_identity()`) to ensure Row Level Security (RLS) is synchronized.

### C. Pre-invited User Merge (Onboarding)
If an existing User record was found via Email but the `id` does not match the provider's `session.user.id`:
1. Execute a database update to change the existing record's `id` to the new `session.user.id`.
2. Delete any old placeholders.
3. Update their status from `PENDING_APPROVAL` to `APPROVED`.

### D. Automated AD Profile Sync
Synchronize properties from the Auth Provider's meta-data (or Microsoft Graph API) into the Database user profile to keep job titles, departments, and avatars up to date.

---

## 5. Idle Session & Timeout Management

Session idling maintains compliance and data security. 

**Constants Checklist (`utils/sessionState.ts`)**:
- `SESSION_IDLE_TIMEOUT_MS`: 30 minutes.
- `SESSION_WARNING_WINDOW_MS`: 5 minutes before timeout.
- `SESSION_ACTIVITY_WRITE_THROTTLE_MS`: 10 seconds.

### A. Tracking Activity Cautiously
Listen to global user events (`pointerdown`, `keydown`, `wheel`, `touchstart`). To prevent rapid Local Storage writes which degrades performance, throttle the database/storage commits using a React Ref to track the last executed write time.

### B. Cross-Tab Synchronization
User activity in one tab must keep the session alive in all tabs.
1. When tracking activity, save a timestamp to Local Storage:
   `localStorage.setItem('pf_session_activity:${userId}', Date.now())`
2. Listen to the `storage` event listener on `window` to update the internal React interval timeout timers dynamically.

### C. Handling Logout
When the `SESSION_IDLE_TIMEOUT_MS` threshold is breached:
1. Write a notice to local storage: `pf_session_logout_notice` containing the `{ reason: 'idle', createdAt: Date.now() }`.
2. Trigger the `supabase.auth.signOut()` method.
3. Upon redirecting to the `<Login />` view, the component checks `localStorage` for the logout notice. If the notice is under 15 minutes old, display a yellow warning: *"Your session was signed out after 30 minutes of inactivity."*
4. Immediately destroy the notice key.

---

## 6. Browser & Application Lifecycle Management

To prevent token rot and handle edge cases where tabs are suspended by the browser.

### A. Visibility Change Auto-Refresh
Listen to the document's `visibilitychange` and the window's `focus` events.
When the user returns to the tab after an extended period, check the Session freshness:
```typescript
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            handleUserAuth(session, true); // Silent refresh
        }
    }
});
```

### B. Passive Keep-Alive
Initiate a simple `setInterval` that fires every 9 minutes (well before standard JWT expiry periods) which calls `supabase.auth.getSession()` silently if the document is not hidden. This ensures the Supabase invisible refresh token logic is continually pinged and stays healthy.

### C. UI & Theme Synchronization
Inject PWA Manifest settings dynamically and bind CSS properties targeting `<html class="dark">` based on User Preferences or initial local storage grabs `app-theme` ensuring the UI doesn't stutter before loading initial Context constraints.

---

## 7. End-User Guide: Preparing the Agent for Replication

To seamlessly replicate this advanced Authentication and Session Management architecture in a new project, an AI Agent requires specific configuration details and environmental context from you (the end user).

Please follow this step-by-step process to instruct the AI Agent.

### Step 1: Provide the Tech Stack Configuration
Inform the AI Agent about your target project environment. The agent needs to know framework paths and tooling specifics.
- **What you need to provide:** 
  - The framework being used (e.g., Next.js, Vite+React, etc.).
  - The intended state management library (e.g., React Context, Redux, Zustand).
- **How to provide it (Example):** 
  > *"Agent, my project uses React with Vite, and I want to use standard React Context for global state. Place all context files inside a `/src/context` directory."*

### Step 2: Provide the Supabase Environment Variables
The agent needs to configure the authentication client, meaning it needs your environment variables format.
- **What you need to provide:** 
  - Your exact Environment Variable prefix/format (e.g., `VITE_SUPABASE_URL` vs `NEXT_PUBLIC_SUPABASE_URL`).
- **How to provide it (Example):** 
  > *"Agent, use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as my environment variables for the Supabase implicit flow client initialization."*

### Step 3: Outline the Authentication Provider Details
Inform the agent about how users will actually log in, as this controls the `signInWithOAuth` parameters.
- **What you need to provide:** 
  - The OAuth Provider (e.g., Azure AD, Google, GitHub).
  - Any required domains to restrict access to (e.g., `@mybusiness.com`).
- **How to provide it (Example):** 
  > *"Agent, we are exclusively using Azure AD for login. Please restrict all successful authentications to users with an `@mybusiness.com` email domain."*

### Step 4: Define the Target Database Schema (for JIT Provisioning)
The agent needs your application's `users` table schema to build the Just-In-Time (JIT) provisioning and syncing logic.
- **What you need to provide:** 
  - A copy of your `users` table schema (specifically the primary key structure and how it relates to Auth IDs).
  - The default Role to assign to new users upon login.
- **How to provide it (Example):** 
  > *"Agent, here is my users table schema: [Paste Schema]. Please default all newly authenticated users entering the system who aren't found in the database to the `USER` role."*

### Step 5: Define Session Timeout Parameters
Review and provide the timeouts you want for the idle session functionality.
- **What you need to provide:** 
  - Total allowable idle time (in milliseconds or minutes).
  - Warning window time (e.g., 5 minutes before logout).
- **How to provide it (Example):** 
  > *"Agent, set the session idle timeout to 45 minutes, and enforce a 5-minute warning window before they are automatically logged out."*

---

### Phase 2: Pre-Flight Agent Confirmation
Once you have supplied all of the details above, provide the following exact prompt to the AI Agent so it can begin the replication:

> **"Agent, I have provided the Tech Stack configuration, Supabase Environment Variable format, Auth Provider details (including domain restrictions), Database User Schema, and Session Timeout thresholds. Please formally confirm back to me that you have gathered and understood all of these requirements. Only after explicitly confirming you have everything you need, you may begin the precise implementation and completion of the replication as outlined in the blueprint."**
