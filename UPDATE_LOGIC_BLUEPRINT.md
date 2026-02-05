# Application Update Logic Blueprint

This document details the comprehensive update mechanism implemented in the ProcureFlow application. This system ensures that users are notified of new deployments and facilitates a clean, forced refresh to load the latest version.

## 1. Architecture Overview

The update system relies on a "Version File" strategy.
- **Build Time**: A `version.json` file is generated containing the build timestamp and git hash.
- **Runtime (Client)**: The client polls this file.
- **Comparison**: The client compares the server's `version.json` against its own running version (injected at build time).
- **Action**: If a mismatch is detected, an "Update Available" toast appears, which triggers a rigorous cache-clearing and reload process.

## 2. Component Blueprint

### 2.1 Build Process: Version Generation
**File**: `vite.config.ts`

A custom Vite plugin (`version-generator`) runs at the start of the build.
1.  **Captures Metadata**:
    - `version`: Current timestamp (`Date.now()`).
    - `gitHash`: Current git commit (`git rev-parse --short HEAD`).
2.  **Generates File**: Writes `public/version.json`.
3.  **Injects Constant**: Defines `import.meta.env.VITE_APP_VERSION` with the same timestamp.

**Artifacts**:
- `public/version.json` (deployed to server).
- `dist/assets/*.js` (code with baked-in version constant).

### 2.2 Service Worker: Cache Management
**File**: `public/sw.js`

1.  **Initialization**: On `install` and `activate`, the SW fetches `version.json` to determine the `CACHE_VERSION` (e.g., `procureflow-1707000000`).
2.  **Cache Busting**: It deletes caches that do matching the current `CACHE_VERSION`.
3.  **Control**: Listens for the `CLEAR_CACHE` message command to forcefully purge all caches on demand.

### 2.3 Client Utilities: Cache Manager
**File**: `utils/cacheManager.ts`

Centralized logic to handle version checking and cache clearing.

-   **`fetchCurrentVersion()`**: Fetches `/version.json` with a cache-busting query param (`?cache-bust=123...`) and headers (`no-store`) to ensure it gets the live file from the server, not a browser cache.
-   **`clearAllCaches()`**: The "Nuclear Option".
    -   Deletes all `caches` (Service Worker storage).
    -   Clears `localStorage` and `sessionStorage`.
    -   Deletes `indexedDB` databases.
-   **`unregisterServiceWorkers()`**: Unregisters existing SW registrations to ensure a fresh install on reload.

### 2.4 UI Component: Update Toast
**File**: `components/UpdateToast.tsx`

The orchestrator of the user experience.

-   **Polling Strategy**: Checks for updates (`checkForUpdates()`):
    -   On mount (initial check).
    -   Every 60 seconds (interval).
    -   On window focus (`window.addEventListener('focus')`).
    -   On visibility change (`document.addEventListener('visibilitychange')`).
-   **Detection**:
    -   Compares `import.meta.env.VITE_APP_VERSION` (Local) vs `fetchCurrentVersion()` (Server).
    -   If different, sets state to `available` -> Shows Toast.
-   **Update Sequence** (triggered by "Update Now" button):
    1.  **Notify SW**: Sends `CLEAR_CACHE` to Service Worker.
    2.  **Clear Auth**: Signs out of Supabase (safety measure usually).
    3.  **Clear Caches**: Calls `clearAllCaches()`.
    4.  **Unregister SW**: Calls `unregisterServiceWorkers()`.
    5.  **Reload**: Forces a browser reload (`window.location.reload()`).

## 3. Replication Guide for Future Apps

To replicate this reliable update system in a new Vite/React app:

### Step 1: Vite Config
Add the version generator plugin to your `vite.config.ts`.
```typescript
// See: vite.config.ts (lines 20-46)
const versionGenerator = () => { ... }
```

### Step 2: Service Worker
Copy `public/sw.js` logic, specifically the `updateCacheVersion` and `message` listener.

### Step 3: Utilities
Copy `utils/cacheManager.ts` verbatim. It is generic and browser-agnostic.

### Step 4: UI Component
1.  Copy `components/UpdateToast.tsx` and `components/VersionBadge.tsx`.
2.  Mount `UpdateToast` at the root of your application (e.g., in `App.tsx` or `Layout.tsx`).

### Step 5: Environment Variables
Ensure your build pipeline passes any necessary env vars, though this specific logic relies mostly on the generated `version.json` and standard Vite env injection.

## 4. Why This Approach?

-   **Defeats Aggressive Caching**: PWAs and SPAs are notoriously sticky. By comparing a live JSON file against a baked-in constant, we bypass the Service Worker's cache for the check itself.
-   **Atomic Updates**: The `version.json` changes only when a new build is deployed.
-   **Clean Slate**: The "nuclear" cache clearing ensures no stale state, old JS chunks, or mismatched schema data survives the update.
