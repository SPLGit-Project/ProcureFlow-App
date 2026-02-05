# ProcureFlow PWA and User Management/Azure Logic

This document provides an exhaustive, detailed design and implementation guide for the Progressive Web App (PWA) functionality and User Management with Azure AD integration in ProcureFlow. This documentation is designed to enable clean replication of these features in another application.

---

## Table of Contents

1. [PWA Logic](#1-pwa-logic)
   - [1.1 Overview](#11-overview)
   - [1.2 File Structure](#12-file-structure)
   - [1.3 Web App Manifest](#13-web-app-manifest)
   - [1.4 Service Worker](#14-service-worker)
   - [1.5 Version Management](#15-version-management)
   - [1.6 Service Worker Registration](#16-service-worker-registration)
   - [1.7 HTML Configuration](#17-html-configuration)
   - [1.8 Dynamic Branding & Manifest](#18-dynamic-branding--manifest)
2. [User Management & Azure Logic](#2-user-management--azure-logic)
   - [2.1 Overview](#21-overview)
   - [2.2 Architecture](#22-architecture)
   - [2.3 Supabase Client Configuration](#23-supabase-client-configuration)
   - [2.4 Azure AD OAuth Flow](#24-azure-ad-oauth-flow)
   - [2.5 User Authentication Flow](#25-user-authentication-flow)
   - [2.6 User Registration Logic](#26-user-registration-logic)
   - [2.7 Session Management](#27-session-management)
   - [2.8 Microsoft Graph API Integration](#28-microsoft-graph-api-integration)
   - [2.9 User Impersonation](#29-user-impersonation)
   - [2.10 Role-Based Access Control (RBAC)](#210-role-based-access-control-rbac)
   - [2.11 User Data Model](#211-user-data-model)
   - [2.12 Database Schema (Supabase)](#212-database-schema-supabase)
3. [Notification System Integration](#3-notification-system-integration)
4. [Replication Checklist](#4-replication-checklist)

---

## 1. PWA Logic

### 1.1 Overview

The PWA implementation enables ProcureFlow to be installable on desktop and mobile devices with offline capabilities, intelligent caching, and automatic version management. Key features include:

- **Installability**: Full manifest.json with icons, shortcuts, and display modes
- **Offline Support**: Service worker with multi-tier caching strategies
- **Automatic Updates**: Version-based cache invalidation with timestamp from build
- **iOS Compatibility**: Apple-specific meta tags and touch icons

### 1.2 File Structure

```
project-root/
├── public/
│   ├── manifest.json        # Web app manifest
│   ├── sw.js                # Service worker
│   ├── version.json         # Auto-generated version file
│   ├── favicon.ico          # App favicon
│   └── icons/               # PWA icons (various sizes)
│       ├── icon-72x72.png
│       ├── icon-96x96.png
│       ├── icon-128x128.png
│       ├── icon-144x144.png
│       ├── icon-152x152.png
│       ├── icon-192x192.png
│       ├── icon-384x384.png
│       ├── icon-512x512.png
│       ├── icon-maskable-192x192.png
│       ├── icon-maskable-512x512.png
│       ├── apple-touch-icon.png
│       ├── apple-touch-icon-152x152.png
│       ├── apple-touch-icon-167x167.png
│       └── apple-touch-icon-180x180.png
├── vite.config.ts           # Build config with version generator
├── index.html               # HTML entry point with PWA meta tags
└── index.tsx                # Entry point with SW registration
```

### 1.3 Web App Manifest

**File**: `public/manifest.json`

The manifest defines how the app appears when installed:

```json
{
  "name": "ProcureFlow - Procurement Management",
  "short_name": "ProcureFlow",
  "description": "Modern procurement and inventory management system for healthcare and hospitality",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "display_override": ["window-controls-overlay", "standalone"],
  "background_color": "#15171e",
  "theme_color": "#2563eb",
  "orientation": "any",
  "categories": ["business", "productivity", "utilities"],
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-maskable-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/icon-maskable-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "shortcuts": [
    {
      "name": "New Purchase Order",
      "short_name": "New PO",
      "description": "Create a new purchase order",
      "url": "/purchase-orders?action=new",
      "icons": [{ "src": "/icons/icon-192x192.png", "sizes": "192x192" }]
    },
    {
      "name": "Stock Levels",
      "short_name": "Stock",
      "description": "View current stock levels",
      "url": "/stock",
      "icons": [{ "src": "/icons/icon-192x192.png", "sizes": "192x192" }]
    },
    {
      "name": "Dashboard",
      "short_name": "Dashboard",
      "description": "View dashboard overview",
      "url": "/",
      "icons": [{ "src": "/icons/icon-192x192.png", "sizes": "192x192" }]
    }
  ]
}
```

#### Key Configuration Options

| Property | Purpose | Notes |
|----------|---------|-------|
| `display: "standalone"` | App runs without browser UI | Use `fullscreen` for immersive apps |
| `display_override` | Fallback chain | `window-controls-overlay` for desktop PWAs |
| `background_color` | Splash screen background | Match your app's primary background |
| `theme_color` | Browser UI theming | Used in address bar, task switcher |
| `purpose: "maskable"` | Adaptive icons | Required for modern Android devices |
| `shortcuts` | Quick actions | Appears on long-press/right-click of icon |

### 1.4 Service Worker

**File**: `public/sw.js`

The service worker implements intelligent caching with automatic version management:

```javascript
/**
 * ProcureFlow Service Worker
 * Implements intelligent caching with automatic version management
 */

const APP_NAME = 'procureflow';
let CACHE_VERSION = 'v1'; // Default, will be updated from version.json

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

/**
 * Fetch and set the current cache version from version.json
 */
async function updateCacheVersion() {
  try {
    const response = await fetch('/version.json?cache-bust=' + Date.now());
    const data = await response.json();
    CACHE_VERSION = `${APP_NAME}-${data.version}`;
    console.log('SW: Cache version updated to:', CACHE_VERSION);
    return CACHE_VERSION;
  } catch (error) {
    console.error('SW: Failed to fetch version.json, using default:', error);
    return `${APP_NAME}-${Date.now()}`;
  }
}

/**
 * Install Event - Cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('SW: Installing...');
  
  event.waitUntil(
    (async () => {
      // Update cache version from version.json
      await updateCacheVersion();
      
      // Open cache and add static assets
      const cache = await caches.open(CACHE_VERSION);
      console.log('SW: Caching static assets with version:', CACHE_VERSION);
      
      try {
        await cache.addAll(STATIC_ASSETS);
        console.log('SW: Static assets cached successfully');
      } catch (error) {
        console.error('SW: Failed to cache some assets:', error);
      }
      
      // Force the waiting service worker to become active immediately
      self.skipWaiting();
    })()
  );
});

/**
 * Activate Event - Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('SW: Activating...');
  
  event.waitUntil(
    (async () => {
      // Update cache version
      await updateCacheVersion();
      
      // Delete old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_VERSION && cacheName.startsWith(APP_NAME)) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
      
      // Take control of all clients immediately
      await self.clients.claim();
      console.log('SW: Activated with version:', CACHE_VERSION);
    })()
  );
});

/**
 * Fetch Event - Intelligent caching strategy
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip non-http(s) requests (chrome-extension, etc.)
  if (!url.protocol.startsWith('http')) return;
  
  event.respondWith(
    (async () => {
      try {
        // Strategy 1: Network-first for HTML and API calls
        if (
          request.headers.get('accept')?.includes('text/html') ||
          url.pathname.endsWith('.html') ||
          url.pathname === '/' ||
          url.pathname.includes('/api/') ||
          url.pathname.includes('supabase')
        ) {
          try {
            const networkResponse = await fetch(request);
            
            // Cache successful responses
            if (networkResponse.ok) {
              const cache = await caches.open(CACHE_VERSION);
              cache.put(request, networkResponse.clone());
            }
            
            return networkResponse;
          } catch (error) {
            // Network failed, try cache
            const cachedResponse = await caches.match(request);
            if (cachedResponse) {
              console.log('SW: Serving from cache (network failed):', url.pathname);
              return cachedResponse;
            }
            throw error;
          }
        }
        
        // Strategy 2: Cache-first for static assets (JS, CSS, images, fonts)
        if (
          url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/)
        ) {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Not in cache, fetch from network and cache
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            const cache = await caches.open(CACHE_VERSION);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }
        
        // Strategy 3: Network-only for everything else
        return fetch(request);
        
      } catch (error) {
        console.error('SW: Fetch failed:', url.pathname, error);
        
        // Try to return cached version as last resort
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Return offline page or error
        return new Response('Offline - Please check your connection', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain'
          })
        });
      }
    })()
  );
});

/**
 * Message Event - Handle commands from the app
 */
self.addEventListener('message', (event) => {
  console.log('SW: Received message:', event.data);
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      (async () => {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => {
            console.log('SW: Clearing cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
        console.log('SW: All caches cleared');
      })()
    );
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});
```

#### Caching Strategies

| Strategy | Used For | Behavior |
|----------|----------|----------|
| **Network-first** | HTML, API calls | Try network, fallback to cache |
| **Cache-first** | Static assets (JS, CSS, images) | Try cache, fallback to network |
| **Network-only** | Everything else | Always fetch from network |

#### Message Commands

The service worker accepts messages from the app:

```javascript
// Clear all caches
navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_CACHE' });

// Force update
navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });

// Get version
const messageChannel = new MessageChannel();
messageChannel.port1.onmessage = (event) => {
  console.log('SW Version:', event.data.version);
};
navigator.serviceWorker.controller?.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2]);
```

### 1.5 Version Management

**File**: `vite.config.ts`

The Vite configuration includes a custom plugin that generates a `version.json` file on each build:

```typescript
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import { execSync } from 'child_process';

// Generate timestamp once per build
const BUILD_TIMESTAMP = Date.now().toString();

// Get git commit hash (if available)
function getGitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch (error) {
    console.warn('Vite: Could not get git hash, using fallback');
    return 'unknown';
  }
}

// Enhanced version generator plugin
const versionGenerator = () => {
  return {
    name: 'version-generator',
    buildStart() {
      const gitHash = getGitHash();
      const versionData = {
        version: BUILD_TIMESTAMP,
        buildTime: new Date().toISOString(),
        gitHash: gitHash,
        environment: process.env.NODE_ENV || 'development'
      };
      
      const publicDir = path.resolve(__dirname, 'public');
      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
      
      fs.writeFileSync(
        path.resolve(publicDir, 'version.json'),
        JSON.stringify(versionData, null, 2)
      );
      
      console.log('Vite: version.json generated');
      console.log('  - Version:', BUILD_TIMESTAMP);
      console.log('  - Git Hash:', gitHash);
      console.log('  - Environment:', versionData.environment);
    }
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), versionGenerator()],
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(BUILD_TIMESTAMP) 
    },
    build: {
      rollupOptions: {
        output: {
          // Use content-based hashing for cache busting
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',
          
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: ['lucide-react', 'recharts'],
            db: ['@supabase/supabase-js']
          }
        }
      },
      chunkSizeWarningLimit: 1000
    }
  };
});
```

#### Generated version.json

```json
{
  "version": "1706889600000",
  "buildTime": "2024-02-02T12:00:00.000Z",
  "gitHash": "a1b2c3d",
  "environment": "production"
}
```

### 1.6 Service Worker Registration

**File**: `index.tsx`

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW: Registered with scope:', registration.scope);
      })
      .catch(error => {
        console.error('SW: Registration failed:', error);
      });
  });
}
```

### 1.7 HTML Configuration

**File**: `index.html`

Critical PWA-related meta tags and configurations:

```html
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    
    <!-- Cache Control -->
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    
    <!-- Theme Color -->
    <meta name="theme-color" content="#2563eb" />
    
    <!-- iOS PWA Configuration -->
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="ProcureFlow">
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
    <link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon-152x152.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180x180.png">
    <link rel="apple-touch-icon" sizes="167x167" href="/icons/apple-touch-icon-167x167.png">
    
    <!-- App Version (dynamic) -->
    <meta name="app-version" content="dynamic" />
    
    <!-- Manifest -->
    <link rel="manifest" href="/manifest.json" />
    
    <title>ProcureFlow</title>
    
    <!-- HTTPS Redirect -->
    <script>
      if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
         window.location.href = window.location.href.replace('http:', 'https:');
      }
    </script>
  </head>
  <body class="bg-gray-50 dark:bg-[#15171e] text-slate-700 dark:text-slate-200 antialiased">
    <div id="root"></div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>
```

### 1.8 Dynamic Branding & Manifest

The app supports runtime branding customization that updates PWA assets dynamically:

**File**: `context/AppContext.tsx` (excerpt)

```typescript
useEffect(() => {
  const root = window.document.documentElement;
  
  // 1. Favicon
  const linkFavicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
  linkFavicon.type = 'image/x-icon';
  linkFavicon.rel = 'icon';
  linkFavicon.href = branding.logoUrl;
  document.getElementsByTagName('head')[0].appendChild(linkFavicon);

  // 2. Apple Touch Icon
  const linkApple = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement || document.createElement('link');
  linkApple.rel = 'apple-touch-icon';
  linkApple.href = branding.logoUrl;
  document.getElementsByTagName('head')[0].appendChild(linkApple);

  // 3. Meta Theme Color
  const metaTheme = document.querySelector("meta[name='theme-color']") as HTMLMetaElement || document.createElement('meta');
  metaTheme.name = 'theme-color';
  metaTheme.content = branding.primaryColor;
  document.getElementsByTagName('head')[0].appendChild(metaTheme);

  // 4. Dynamic Manifest
  const manifest = {
    name: branding.appName,
    short_name: branding.appName.length > 12 ? branding.appName.substring(0, 12) : branding.appName,
    start_url: ".",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: branding.primaryColor,
    orientation: "portrait",
    icons: [
      {
        src: branding.logoUrl,
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: branding.logoUrl,
        sizes: "512x512",
        type: "image/png"
      }
    ]
  };
  
  const stringManifest = JSON.stringify(manifest);
  const blob = new Blob([stringManifest], {type: 'application/json'});
  const manifestURL = URL.createObjectURL(blob);
  
  const linkManifest = document.querySelector("link[rel='manifest']") as HTMLLinkElement || document.createElement('link');
  linkManifest.rel = 'manifest';
  linkManifest.href = manifestURL;
  document.getElementsByTagName('head')[0].appendChild(linkManifest);
}, [branding]);
```

---

## 2. User Management & Azure Logic

### 2.1 Overview

The user management system integrates:
- **Supabase Auth** as the authentication provider
- **Azure AD (Entra ID)** as the identity provider via OAuth
- **Microsoft Graph API** for directory services, profile sync, and email
- **Custom RBAC** with permission-based access control
- **User impersonation** for admin troubleshooting

### 2.2 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         User's Browser                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │  React App  │───▶│  AppContext │───▶│  Supabase Client    │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│                            │                      │              │
│                   Uses Graph API         OAuth Auth Flow         │
│                            │                      │              │
│                            ▼                      ▼              │
└────────────────────────────┼──────────────────────┼──────────────┘
                             │                      │
                             ▼                      ▼
                 ┌──────────────────────┐    ┌──────────────────┐
                 │  Microsoft Graph API │    │   Supabase Auth  │
                 │  - User Profile      │    │   (Azure AD      │
                 │  - Directory Search  │    │    Provider)     │
                 │  - Send Email        │    └────────┬─────────┘
                 └──────────────────────┘             │
                                                      │
                                              ┌───────▼────────┐
                                              │   Azure AD     │
                                              │  (Entra ID)    │
                                              │  - OAuth 2.0   │
                                              │  - ID Tokens   │
                                              └────────────────┘
```

### 2.3 Supabase Client Configuration

**File**: `lib/supabaseClient.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',           // OAuth implicit flow for SPAs
    detectSessionInUrl: true,       // Automatically detect tokens in URL hash
    autoRefreshToken: true,         // Automatically refresh expired tokens
    persistSession: true,           // Persist session across page reloads
    storage: window.localStorage    // Use localStorage for session storage
  }
});
```

#### Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2.4 Azure AD OAuth Flow

#### Login Function

```typescript
const login = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'openid profile email User.Read User.ReadBasic.All Mail.Send offline_access',
      redirectTo: window.location.origin
    }
  });
  if (error) {
    console.error("Login failed:", error.message);
    alert(`Login failed: ${error.message}`);
  }
};
```

#### Required OAuth Scopes

| Scope | Purpose |
|-------|---------|
| `openid` | OpenID Connect authentication |
| `profile` | User profile information |
| `email` | User email address |
| `User.Read` | Read current user's profile from Graph |
| `User.ReadBasic.All` | Search directory for other users |
| `Mail.Send` | Send emails on behalf of user |
| `offline_access` | Refresh token for long-lived sessions |

#### Supabase Azure Provider Configuration

In your Supabase dashboard (Authentication → Providers → Azure):

```
# Azure AD App Registration Details
Tenant ID: your-azure-tenant-id
Client ID: your-azure-client-id
Client Secret: your-azure-client-secret (if using confidential client)

# Redirect URL (configure in Azure Portal)
https://your-project.supabase.co/auth/v1/callback
```

### 2.5 User Authentication Flow

The authentication flow handles multiple scenarios robustly:

```typescript
useEffect(() => {
  let mounted = true;

  // Safety timeout to prevent infinite loading
  const safetyTimeout = setTimeout(() => {
    if (mounted && isLoadingAuth) {
      console.warn("Auth: Safety timeout triggered (30s)");
      setIsLoadingAuth(false);
    }
  }, 30000);

  const initializeAuth = async () => {
    setIsLoadingAuth(true);

    // 1. Cleanup Stale Supabase Locks
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('sb-lock')) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn("Auth: Failed to clear locks", e);
    }

    // 2. Check for URL Errors
    const searchParams = new URLSearchParams(window.location.search);
    const urlError = searchParams.get('error');
    if (urlError) {
      alert(`Sign-in Error: ${searchParams.get('error_description') || urlError}`);
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsLoadingAuth(false);
      return;
    }

    // 3. Setup Auth State Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session) {
          await handleUserAuth(session);
        } else if (event === 'INITIAL_SESSION') {
          setIsLoadingAuth(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
      }
    });

    // 4. Manual Token Recovery (for stuck OAuth flows)
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      setTimeout(async () => {
        if (!mounted || isAuthenticated) return;
        
        const params = new URLSearchParams(hash.substring(1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (access_token) {
          try {
            const { data: { session }, error } = await supabase.auth.setSession({
              access_token,
              refresh_token: refresh_token || '',
            });
            
            if (session) {
              await handleUserAuth(session);
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          } catch (e) {
            alert("Authentication failed. Please try signing in again.");
            setIsLoadingAuth(false);
          }
        }
      }, 2500);
    }

    return () => subscription?.unsubscribe();
  };

  const authPromise = initializeAuth();

  return () => {
    mounted = false;
    clearTimeout(safetyTimeout);
    authPromise.then(cleanup => cleanup && cleanup());
  };
}, []);
```

### 2.6 User Registration Logic

The `handleUserAuth` function manages user lookup, creation, and invitation merging:

```typescript
const handleUserAuth = async (session: any, silent = false) => {
  const email = session.user.email;

  // 1. Domain Restriction
  if (!email?.toLowerCase().endsWith('@splservices.com.au')) {
    alert("Access Restricted: Only @splservices.com.au accounts are allowed.");
    await supabase.auth.signOut();
    return;
  }

  // 2. Fetch Azure AD Profile via Graph API
  let adProfile = { jobTitle: '', department: '', officeLocation: '' };
  const providerToken = session.provider_token;
  
  if (providerToken) {
    try {
      const resp = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${providerToken}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        adProfile = {
          jobTitle: data.jobTitle || '',
          department: data.department || '',
          officeLocation: data.officeLocation || ''
        };
      }
    } catch (e) {
      console.warn("Auth: Graph Sync failed", e);
    }
  }

  // 3. Lookup User in Database
  let { data: rawData, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();

  let userData: User | null = rawData ? mapDbUserToUser(rawData) : null;

  if (!userData) {
    // 4a. Check for Pre-Invited User (by email)
    const { data: existingByEmail } = await supabase
      .from('users')
      .select('*')
      .ilike('email', email)
      .single();

    if (existingByEmail) {
      // Merge invitation with real Auth ID
      await supabase
        .from('users')
        .update({ 
          id: session.user.id,
          status: 'APPROVED',
          avatar: session.user.user_metadata.avatar_url || existingByEmail.avatar,
          last_sign_in_at: new Date().toISOString()
        })
        .eq('id', existingByEmail.id);
      
      // Reload merged user
      const { data: mergedUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      userData = mergedUser ? mapDbUserToUser(mergedUser) : null;
    } else {
      // 4b. Create New User
      const { data: count } = await supabase.rpc('get_user_count');
      const isFirstUser = count === 0;

      const dbUser = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata.full_name || session.user.email?.split('@')[0],
        role_id: isFirstUser ? 'ADMIN' : 'SITE_USER',
        status: isFirstUser ? 'APPROVED' : 'PENDING_APPROVAL',
        avatar: session.user.user_metadata.avatar_url || '',
        job_title: adProfile.jobTitle,
        department: adProfile.department || adProfile.officeLocation,
        created_at: new Date().toISOString(),
        site_ids: []
      };

      await supabase.from('users').insert([dbUser]);
      userData = mapDbUserToUser(dbUser);
    }
  } else {
    // 5. Sync Existing User with Azure AD Profile
    if (adProfile.jobTitle || adProfile.department) {
      await supabase.from('users').update({
        job_title: adProfile.jobTitle || userData.jobTitle,
        department: adProfile.department || userData.department
      }).eq('id', userData.id);
    }
  }

  // 6. Set Context State
  setCurrentUser(userData);
  setIsAuthenticated(true);
  setIsPendingApproval(userData.status !== 'APPROVED');
  
  if (userData.status === 'APPROVED') {
    reloadData(silent);
  }
};
```

### 2.7 Session Management

#### Keep-Alive and Visibility Handling

```typescript
// Session Keep-Alive on Tab Focus
const handleVisibilityChange = async () => {
  if (document.visibilityState === 'visible' || document.hasFocus()) {
    const now = Date.now();
    
    // Skip if data is fresh (< 5 minutes)
    if (currentUser && (now - lastFetchTime.current < 5 * 60 * 1000)) {
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      await handleUserAuth(session, true); // Silent refresh
    }
  }
};

document.addEventListener('visibilitychange', handleVisibilityChange);
window.addEventListener('focus', handleVisibilityChange);

// Passive Keep-Alive Ping (Every 9 minutes)
const keepAliveInterval = setInterval(async () => {
  if (!document.hidden) {
    await supabase.auth.getSession();
  }
}, 9 * 60 * 1000);
```

#### Logout

```typescript
const logout = async () => {
  await supabase.auth.signOut();
  // State cleanup happens via onAuthStateChange listener
};
```

### 2.8 Microsoft Graph API Integration

#### 1. Profile Sync (On Login)

```typescript
// Fetch user profile from Azure AD
const resp = await fetch('https://graph.microsoft.com/v1.0/me', {
  headers: { Authorization: `Bearer ${providerToken}` }
});

if (resp.ok) {
  const data = await resp.json();
  // data.displayName, data.jobTitle, data.department, data.officeLocation
}
```

#### 2. Directory Search

```typescript
const searchDirectory = async (query: string): Promise<DirectoryUser[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.provider_token;
  
  if (!token) return [];
  
  const escapedQuery = query.replace(/"/g, '\\"');
  const url = `https://graph.microsoft.com/v1.0/users?$search="displayName:${escapedQuery}" OR "mail:${escapedQuery}"&$select=id,displayName,mail,jobTitle,department,officeLocation&$top=10`;
  
  const resp = await fetch(url, {
    headers: { 
      Authorization: `Bearer ${token}`,
      ConsistencyLevel: 'eventual'  // Required for $search
    }
  });
  
  if (resp.ok) {
    const data = await resp.json();
    return data.value.map((u: any) => ({
      id: u.id,
      name: u.displayName,
      email: u.mail,
      jobTitle: u.jobTitle,
      department: u.department || u.officeLocation
    }));
  }
  
  return [];
};
```

#### 3. Send Email

```typescript
const sendWelcomeEmail = async (toEmail: string, name: string): Promise<boolean> => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.provider_token;
  
  if (!token) return false;

  const emailPayload = {
    message: {
      subject: `Welcome to ${branding.appName}`,
      body: {
        contentType: "HTML",
        content: `
          <p>Hi ${name},</p>
          <p>You have been invited to join <strong>${branding.appName}</strong>.</p>
          <p>Click here to get started: <a href="${window.location.origin}">${window.location.origin}</a></p>
        `
      },
      toRecipients: [
        { emailAddress: { address: toEmail } }
      ]
    },
    saveToSentItems: true
  };

  const resp = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emailPayload)
  });

  return resp.ok;
};
```

### 2.9 User Impersonation

Admin users can impersonate other users for troubleshooting:

```typescript
// State for impersonation
const [currentUser, setCurrentUser] = useState<User | null>(null);
const [originalUser, setOriginalUser] = useState<User | null>(() => {
  try {
    const stored = sessionStorage.getItem('procureflow_original_user');
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
});

// Persist impersonation state across page reloads
useEffect(() => {
  if (originalUser) {
    sessionStorage.setItem('procureflow_original_user', JSON.stringify(originalUser));
    if (currentUser) {
      sessionStorage.setItem('procureflow_impersonated_user', JSON.stringify(currentUser));
    }
  } else {
    sessionStorage.removeItem('procureflow_original_user');
    sessionStorage.removeItem('procureflow_impersonated_user');
  }
}, [originalUser, currentUser]);

// Impersonate a user
const impersonateUser = (targetUser: User) => {
  if (!currentUser) return;
  console.log(`Impersonation: Switching view to ${targetUser.name} (${targetUser.role})`);
  setOriginalUser(currentUser);   // Store real admin
  setCurrentUser(targetUser);     // Switch to target user's view
  
  // Reset site context if target has limited access
  if (targetUser.role !== 'ADMIN' && targetUser.siteIds.length > 0) {
    setActiveSiteId(targetUser.siteIds[0]);
  }
};

// Stop impersonation
const stopImpersonation = () => {
  if (!originalUser) return;
  console.log("Impersonation: Returning to admin view");
  setCurrentUser(originalUser);
  setOriginalUser(null);
  setActiveSiteId(null); // Reset to show all sites
};
```

**Important**: During impersonation, the real user (`originalUser`) is preserved so that:
1. The admin can return to their original view
2. Backend auth tokens are still the admin's tokens
3. Audit logs can track who was impersonating

### 2.10 Role-Based Access Control (RBAC)

#### Permission Checking

```typescript
const hasPermission = (permissionId: PermissionId): boolean => {
  if (!currentUser) return false;
  
  // Admins have all permissions implicitly
  if (currentUser.role === 'ADMIN') return true;
  
  // Look up role definition
  const roleDef = roles.find(r => r.id === currentUser.role);
  return roleDef ? roleDef.permissions.includes(permissionId) : false;
};
```

#### Available Permissions

```typescript
export type PermissionId = 
  | 'view_dashboard'
  | 'view_items'
  | 'view_stock'
  | 'view_mapping'
  | 'view_suppliers'
  | 'view_sites'
  | 'view_workflow'
  | 'view_security'
  | 'view_notifications'
  | 'view_branding'
  | 'create_request'
  | 'view_all_requests'
  | 'approve_requests'
  | 'link_concur'
  | 'receive_goods'
  | 'view_finance'
  | 'manage_finance'
  | 'manage_settings'
  | 'manage_items'
  | 'manage_suppliers';
```

#### Role Definition Interface

```typescript
export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  permissions: PermissionId[];
  isSystem: boolean;  // System roles cannot be deleted
}
```

### 2.11 User Data Model

```typescript
export interface User {
  id: string;                       // Auth user ID (from Supabase/Azure)
  name: string;
  role: UserRole;                   // Current active role
  realRole?: UserRole;              // Original role (preserved during session switches)
  avatar: string;                   // URL to profile image
  email: string;
  jobTitle?: string;                // Synced from Azure AD
  status?: 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED' | 'ARCHIVED';
  createdAt?: string;
  siteIds: string[];                // Multi-site access control
  department?: string;              // Synced from Azure AD
  approvalReason?: string;          // For pending approval workflow
  invitedAt?: string;               // When invitation was sent
  invitationExpiresAt?: string;     // When invitation expires
}
```

### 2.12 Database Schema (Supabase)

```sql
-- Users table (public schema)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role_id TEXT NOT NULL DEFAULT 'SITE_USER',
  status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  avatar TEXT,
  job_title TEXT,
  department TEXT,
  approval_reason TEXT,
  site_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  invited_at TIMESTAMPTZ,
  invitation_expires_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
);

-- Roles table
CREATE TABLE public.roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  permissions TEXT[] DEFAULT '{}',
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all users" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can manage users" ON public.users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role_id = 'ADMIN'
    )
  );
```

---

## 3. Notification System Integration

The notification system uses Microsoft Graph API for email and supports multiple channels:

```typescript
const sendNotification = async (event: NotificationEventType, data: any) => {
  // 1. Get Matching Rules
  const rules = notificationRules.filter(r => r.eventType === event && r.isActive);
  if (rules.length === 0) return;

  // 2. Build Targets Map
  const targets = new Map<string, {
    userId?: string,
    emailAddress?: string,
    email: boolean,
    inApp: boolean,
    teams: boolean
  }>();

  // Process recipients from rules...
  for (const rule of rules) {
    for (const recipient of rule.recipients) {
      if (recipient.type === 'USER') {
        mergeTarget(recipient.id, { userId: recipient.id }, recipient.channels);
      } else if (recipient.type === 'ROLE') {
        const roleUsers = users.filter(u => u.role === recipient.id);
        roleUsers.forEach(u => mergeTarget(u.id, { userId: u.id, emailAddress: u.email }, recipient.channels));
      } else if (recipient.type === 'REQUESTER') {
        // Dynamic requester resolution
      } else if (recipient.type === 'EMAIL') {
        mergeTarget(`email:${recipient.id}`, { emailAddress: recipient.id }, recipient.channels);
      }
    }
  }

  // 3. Dispatch Notifications
  // Teams webhook
  if (sendTeams && teamsWebhookUrl) {
    await fetch(teamsWebhookUrl, {
      method: 'POST',
      body: JSON.stringify({ text: message })
    });
  }

  // In-app notifications
  for (const [key, target] of targets.entries()) {
    if (target.inApp && target.userId) {
      await db.addNotification({
        userId: target.userId,
        title: event,
        message: JSON.stringify(data),
        link: ''
      });
    }
    
    // Email via Graph API
    if (target.email && target.emailAddress) {
      const token = session?.provider_token;
      if (token) {
        await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(emailPayload)
        });
      }
    }
  }
};
```

---

## 4. Replication Checklist

### PWA Setup

- [ ] Create `public/manifest.json` with all icon sizes
- [ ] Generate icons (72, 96, 128, 144, 152, 192, 384, 512) + maskable variants
- [ ] Create Apple touch icons for iOS
- [ ] Implement `public/sw.js` with caching strategies
- [ ] Add version generator plugin to build config
- [ ] Configure `index.html` with PWA meta tags
- [ ] Add service worker registration in entry point
- [ ] Test offline functionality
- [ ] Test install prompt on mobile devices

### Azure AD Integration

- [ ] Create Azure AD App Registration in Azure Portal
- [ ] Configure redirect URIs for Supabase callback
- [ ] Request API permissions: `User.Read`, `User.ReadBasic.All`, `Mail.Send`
- [ ] Configure Supabase Azure provider with Tenant/Client IDs
- [ ] Implement Supabase client with proper auth options
- [ ] Create `handleUserAuth` function with Graph API sync
- [ ] Implement domain restriction logic
- [ ] Handle user invitation/merge flow
- [ ] Set up session keep-alive and visibility handling

### User Management

- [ ] Create `users` table with proper schema
- [ ] Set up RLS policies for user access
- [ ] Implement RBAC with roles and permissions
- [ ] Create user invitation flow with email
- [ ] Implement impersonation for admins
- [ ] Add multi-site access control
- [ ] Set up notification rules and dispatch

### Required Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Azure AD (configured in Supabase dashboard, not in env)
# - Tenant ID
# - Client ID
# - Client Secret (if confidential client)
```

---

*Document Version: 1.0*  
*Last Updated: February 2026*
