import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import UpdateNotification from './UpdateNotification';
import {
  clearAllCaches,
  unregisterServiceWorkers,
  notifyServiceWorker,
  fetchCurrentVersion,
  getStoredVersion,
  storeVersion,
  versionsAreDifferent,
  hardReload
} from '../utils/cacheManager';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const AUTO_DISMISS_MS = 30 * 1000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds

export default function UpdateManager() {
  const [showNotification, setShowNotification] = useState(false);
  const currentVersion = useRef<string | null>(null);
  const retryCount = useRef(0);
  const dismissTimer = useRef<NodeJS.Timeout | null>(null);
  const checkInterval = useRef<NodeJS.Timeout | null>(null);

  /**
   * Initialize version tracking
   */
  const initializeVersion = useCallback(async () => {
    try {
      const versionInfo = await fetchCurrentVersion();
      if (versionInfo?.version) {
        currentVersion.current = versionInfo.version;
        
        // Store in localStorage for persistence
        const storedVersion = getStoredVersion();
        if (!storedVersion) {
          storeVersion(versionInfo.version);
        }
        
        console.log('UpdateManager: Initialized with version', currentVersion.current);
      }
    } catch (error) {
      console.error('UpdateManager: Failed to initialize version', error);
    }
  }, []);

  /**
   * Check for updates with retry logic
   */
  const checkForUpdates = useCallback(async () => {
    try {
      const versionInfo = await fetchCurrentVersion();
      
      if (!versionInfo?.version) {
        throw new Error('Invalid version data');
      }

      const serverVersion = versionInfo.version;
      const storedVersion = getStoredVersion();

      // Check if version has changed
      if (currentVersion.current && versionsAreDifferent(serverVersion, currentVersion.current)) {
        console.warn('UpdateManager: New version detected!', {
          current: currentVersion.current,
          new: serverVersion,
          stored: storedVersion
        });

        // Show notification to user
        setShowNotification(true);

        // Auto-dismiss after 30 seconds
        if (dismissTimer.current) {
          clearTimeout(dismissTimer.current);
        }
        dismissTimer.current = setTimeout(() => {
          setShowNotification(false);
        }, AUTO_DISMISS_MS);

        // Reset retry count on successful check
        retryCount.current = 0;
      }
    } catch (error) {
      console.error('UpdateManager: Update check failed', error);

      // Retry logic with exponential backoff
      if (retryCount.current < MAX_RETRIES) {
        retryCount.current++;
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount.current - 1);
        console.log(`UpdateManager: Retrying in ${delay}ms (attempt ${retryCount.current}/${MAX_RETRIES})`);
        
        setTimeout(() => {
          checkForUpdates();
        }, delay);
      } else {
        console.error('UpdateManager: Max retries reached, giving up');
        retryCount.current = 0; // Reset for next interval
      }
    }
  }, []);

  /**
   * Handle update - clear caches and reload
   */
  const handleUpdate = useCallback(async () => {
    console.log('UpdateManager: User initiated update...');
    setShowNotification(false);

    try {
      // 1. Notify service worker to clear caches
      await notifyServiceWorker({ type: 'CLEAR_CACHE' });

      // 2. Sign out from Supabase (clears auth session)
      await supabase.auth.signOut();

      // 3. Clear all browser caches and storage
      await clearAllCaches();

      // 4. Unregister service workers
      await unregisterServiceWorkers();

      // 5. Hard reload to login page
      window.location.href = window.location.origin + '/login?updated=true';
    } catch (error) {
      console.error('UpdateManager: Update failed, attempting fallback', error);
      
      // Fallback: Simple hard reload
      hardReload();
    }
  }, []);

  /**
   * Handle dismiss notification
   */
  const handleDismiss = useCallback(() => {
    console.log('UpdateManager: User dismissed update notification');
    setShowNotification(false);
    
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, []);

  /**
   * Setup update checking
   */
  useEffect(() => {
    // Initialize version on mount
    initializeVersion();

    // Check for updates periodically
    checkInterval.current = setInterval(checkForUpdates, CHECK_INTERVAL_MS);

    // Check when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('UpdateManager: Tab visible, checking for updates...');
        checkForUpdates();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
      }
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [initializeVersion, checkForUpdates]);

  // Render notification if update is available
  return showNotification ? (
    <UpdateNotification onUpdate={handleUpdate} onDismiss={handleDismiss} />
  ) : null;
}
