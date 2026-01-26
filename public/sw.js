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
      
      // Force the waiting service worker to become the active service worker
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
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  event.respondWith(
    (async () => {
      try {
        // Strategy 1: Network-first for HTML and API calls
        // Always get fresh HTML to ensure latest app shell
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
        // These are versioned by Vite's hash, so cache is safe
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
