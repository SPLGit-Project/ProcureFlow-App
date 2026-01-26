/**
 * Cache Management Utilities
 * Provides browser-agnostic cache clearing and version management
 */

export interface VersionInfo {
  version: string;
  buildTime?: string;
  gitHash?: string;
  environment?: string;
}

/**
 * Clear all browser caches, storage, and service workers
 * Works across all major browsers
 */
export async function clearAllCaches(): Promise<void> {
  console.log('CacheManager: Starting comprehensive cache clear...');
  
  try {
    // 1. Clear all Cache Storage (Service Worker caches)
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          console.log(`CacheManager: Deleting cache: ${cacheName}`);
          return caches.delete(cacheName);
        })
      );
    }

    // 2. Clear Local Storage
    localStorage.clear();
    console.log('CacheManager: Cleared localStorage');

    // 3. Clear Session Storage
    sessionStorage.clear();
    console.log('CacheManager: Cleared sessionStorage');

    // 4. Clear IndexedDB (if used)
    if ('indexedDB' in window) {
      const databases = await indexedDB.databases();
      databases.forEach(db => {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
          console.log(`CacheManager: Deleted IndexedDB: ${db.name}`);
        }
      });
    }

    console.log('CacheManager: All caches cleared successfully');
  } catch (error) {
    console.error('CacheManager: Error clearing caches:', error);
    throw error;
  }
}

/**
 * Unregister all service workers
 */
export async function unregisterServiceWorkers(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(registration => {
          console.log('CacheManager: Unregistering service worker');
          return registration.unregister();
        })
      );
      console.log('CacheManager: All service workers unregistered');
    } catch (error) {
      console.error('CacheManager: Error unregistering service workers:', error);
      throw error;
    }
  }
}

/**
 * Send a message to the active service worker
 */
export async function notifyServiceWorker(message: any): Promise<void> {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage(message);
      console.log('CacheManager: Message sent to service worker:', message);
    } catch (error) {
      console.error('CacheManager: Error sending message to service worker:', error);
    }
  }
}

/**
 * Fetch the current version from version.json
 */
export async function fetchCurrentVersion(): Promise<VersionInfo | null> {
  try {
    const response = await fetch('/version.json?cache-bust=' + Date.now(), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch version.json: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('CacheManager: Error fetching version:', error);
    return null;
  }
}

/**
 * Get the stored version from localStorage
 */
export function getStoredVersion(): string | null {
  return localStorage.getItem('app_version');
}

/**
 * Store the current version in localStorage
 */
export function storeVersion(version: string): void {
  localStorage.setItem('app_version', version);
  console.log('CacheManager: Stored version:', version);
}

/**
 * Compare two version strings
 * Returns true if versions are different
 */
export function versionsAreDifferent(v1: string | null, v2: string | null): boolean {
  if (!v1 || !v2) return false;
  return v1 !== v2;
}

/**
 * Perform a hard reload bypassing all caches
 */
export function hardReload(): void {
  console.log('CacheManager: Performing hard reload...');
  
  // Try multiple methods for maximum browser compatibility
  
  // Method 1: location.reload(true) - deprecated but still works in some browsers
  try {
    (window.location as any).reload(true);
    return;
  } catch (e) {
    // Continue to next method
  }
  
  // Method 2: Replace location with cache-busting parameter
  const url = new URL(window.location.href);
  url.searchParams.set('_reload', Date.now().toString());
  window.location.href = url.toString();
}
