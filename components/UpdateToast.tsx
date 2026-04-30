import React, { useEffect, useState, useRef, useCallback } from 'react';
import { RefreshCw, X, Download, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
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

type UpdateState = 
  | 'idle'           // No update available
  | 'available'      // Update detected
  | 'preparing'      // Preparing to update
  | 'clearing'       // Clearing caches
  | 'reloading';     // About to reload

interface VersionInfo {
  version: string;
  gitHash?: string;
  buildTime?: string;
}

const CHECK_INTERVAL_MS = 60 * 1000; // 1 minute
const AUTO_DISMISS_MS = 60 * 1000; // 1 minute

/**
 * UpdateToast - Professional update notification with progress states
 * Provides seamless update experience with visual feedback
 */
export default function UpdateToast() {
  const { branding } = useApp();
  const [state, setState] = useState<UpdateState>('idle');
  const [isVisible, setIsVisible] = useState(false);
  const [newVersion, setNewVersion] = useState<VersionInfo | null>(null);
  const [progress, setProgress] = useState(0);
  
  const initialVersion = useRef<string | null>(
    (import.meta.env.VITE_APP_VERSION as string) || null
  );
  const dismissTimer = useRef<number | null>(null);
  const checkInterval = useRef<number | null>(null);

  // Theme-aware styling
  const isDark = branding.sidebarTheme === 'dark' || 
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  /**
   * Check for updates by comparing build-time version with server version
   */
  const checkForUpdates = useCallback(async () => {
    if (document.hidden) return;
    
    try {
      const serverVersion = await fetchCurrentVersion();
      if (!serverVersion?.version) return;

      // Compare against build-time version (most reliable)
      if (initialVersion.current && 
          serverVersion.version !== initialVersion.current) {
        console.log('UpdateToast: New version available', {
          current: initialVersion.current,
          new: serverVersion.version
        });
        
        setNewVersion(serverVersion as VersionInfo);
        setState('available');
        setIsVisible(true);

        // Auto-dismiss timer
        if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
        dismissTimer.current = window.setTimeout(() => {
          setIsVisible(false);
        }, AUTO_DISMISS_MS);
      }
    } catch (error) {
      console.error('UpdateToast: Check failed', error);
    }
  }, []);

  /**
   * Perform the update with progress feedback
   */
  const performUpdate = useCallback(async () => {
    setState('preparing');
    setProgress(10);

    try {
      // Step 1: Notify service worker
      setState('preparing');
      setProgress(20);
      await notifyServiceWorker({ type: 'CLEAR_CACHE' });
      
      // Step 2: Clear auth session
      setProgress(40);
      await supabase.auth.signOut();

      // Step 3: Clear all caches
      setState('clearing');
      setProgress(60);
      await clearAllCaches();

      // Step 4: Unregister service workers
      setProgress(80);
      await unregisterServiceWorkers();

      // Step 5: Store new version before reload
      if (newVersion?.version) {
        storeVersion(newVersion.version);
      }

      // Step 6: Reload
      setState('reloading');
      setProgress(100);
      
      // Brief delay to show 100% progress
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Redirect to login with update flag
      window.location.href = window.location.origin + '/login?updated=true';
      
    } catch (error) {
      console.error('UpdateToast: Update failed', error);
      // Fallback: simple hard reload
      hardReload();
    }
  }, [newVersion]);

  /**
   * Dismiss the notification
   */
  const dismiss = useCallback(() => {
    setIsVisible(false);
    if (dismissTimer.current) {
        window.clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
    }
  }, []);

  /**
   * Setup version checking
   */
  useEffect(() => {
    // Initial check after short delay
    const initialCheck = window.setTimeout(checkForUpdates, 2000);

    // Periodic checks
    checkInterval.current = window.setInterval(checkForUpdates, CHECK_INTERVAL_MS);

    // Check when tab becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Check when window gains focus
    const handleFocus = () => checkForUpdates();
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearTimeout(initialCheck);
      if (checkInterval.current) window.clearInterval(checkInterval.current);
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkForUpdates]);

  // Don't render if not visible or idle
  if (!isVisible || state === 'idle') return null;

  const isUpdating = ['preparing', 'clearing', 'reloading'].includes(state);

  const getStatusText = () => {
    switch (state) {
      case 'available': return 'A new version is available';
      case 'preparing': return 'Preparing update...';
      case 'clearing': return 'Clearing caches...';
      case 'reloading': return 'Reloading app...';
      default: return '';
    }
  };

  const getIcon = () => {
    if (isUpdating) {
      return <RefreshCw size={18} className="animate-spin text-[#129DC0]" />;
    }
    return <Zap size={18} className="text-[#129DC0]" />;
  };

  return (
    <div 
      className={`
        fixed bottom-4 right-4 z-[100] max-w-sm w-full
        animate-slide-up
      `}
      role="alert"
      aria-live="polite"
    >
      <div
        className={`rounded-2xl overflow-hidden shadow-2xl border ${isDark ? 'bg-[#1a1d27] border-white/10' : 'bg-white border-gray-200'}`}
      >
        {/* Progress Bar */}
        <div className="h-1 bg-gray-200 dark:bg-white/10 relative overflow-hidden">
          <div
            className="h-full bg-[#129DC0] transition-all duration-500 ease-out"
            style={{ width: isUpdating ? `${progress}%` : '0%' }}
          />
          {state === 'available' && (
            <div className="absolute inset-0 bg-[#129DC0]/30 animate-pulse" />
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="p-2 rounded-xl shrink-0 bg-[#129DC0]/15">
              {getIcon()}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <h3 className={`
                font-bold text-sm mb-1
                ${isDark ? 'text-white' : 'text-gray-900'}
              `}>
                {isUpdating ? 'Updating...' : 'Update Available'}
              </h3>
              <p className={`
                text-xs mb-3
                ${isDark ? 'text-gray-400' : 'text-secondary'}
              `}>
                {getStatusText()}
                {newVersion?.gitHash && !isUpdating && (
                  <span className="font-mono ml-1 opacity-60">
                    ({newVersion.gitHash.substring(0, 7)})
                  </span>
                )}
              </p>

              {/* Actions */}
              {!isUpdating && (
                <div className="flex gap-2">
                  <button
                    onClick={performUpdate}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-[#129DC0] text-white shadow-sm hover:bg-[#0f87a8] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#129DC0] focus:ring-offset-2"
                  >
                    <Download size={14} />
                    Update Now
                  </button>
                  <button
                    onClick={dismiss}
                    className={`
                      px-3 py-2 rounded-lg text-sm font-medium
                      transition-colors
                      ${isDark 
                        ? 'text-gray-400 hover:bg-white/10 hover:text-white' 
                        : 'text-secondary hover:bg-gray-100 hover:text-gray-900'
                      }
                    `}
                  >
                    Later
                  </button>
                </div>
              )}

              {/* Progress Status */}
              {isUpdating && (
                <div className={`
                  flex items-center gap-2 text-xs
                  ${isDark ? 'text-gray-400' : 'text-secondary'}
                `}>
                  <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#129DC0] transition-all duration-300 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="font-mono">{progress}%</span>
                </div>
              )}
            </div>

            {/* Close Button (only when not updating) */}
            {!isUpdating && (
              <button
                onClick={dismiss}
                className={`
                  shrink-0 p-1 rounded-lg transition-colors
                  ${isDark 
                    ? 'text-gray-500 hover:text-white hover:bg-white/10' 
                    : 'text-tertiary hover:text-secondary hover:bg-gray-100'
                  }
                `}
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
