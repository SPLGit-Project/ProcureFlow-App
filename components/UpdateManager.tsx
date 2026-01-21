import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function UpdateManager() {
  const currentVersion = useRef<string | null>(null);
  
  useEffect(() => {
    // Initial fetch to set the reference version
    const fetchInitialVersion = async () => {
      try {
        const response = await fetch('/version.json?cache-bust=' + Date.now());
        const data = await response.json();
        currentVersion.current = data.version;
        console.log('UpdateManager: Initial version set to', currentVersion.current);
      } catch (err) {
        console.error('UpdateManager: Failed to fetch initial version', err);
      }
    };

    fetchInitialVersion();

    const checkUpdates = async () => {
      try {
        const response = await fetch('/version.json?cache-bust=' + Date.now());
        if (!response.ok) return;
        
        const data = await response.json();
        const serverVersion = data.version;

        if (currentVersion.current && serverVersion !== currentVersion.current) {
          console.warn('UpdateManager: New version detected!', { 
            current: currentVersion.current, 
            new: serverVersion 
          });
          handleForceUpdate();
        }
      } catch (err) {
        console.error('UpdateManager: Update check failed', err);
      }
    };

    const handleForceUpdate = async () => {
      console.log('UpdateManager: Forcing app update and re-login...');
      
      try {
        // 1. Sign out from Supabase (clears cookies/session)
        await supabase.auth.signOut();
        
        // 2. Clear Local Storage
        localStorage.clear();
        
        // 3. Try to unregister service workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            await registration.unregister();
          }
        }
        
        // 4. Hard reload (bypassing cache)
        window.location.href = window.location.origin + '/login?update=true';
      } catch (err) {
        // Fallback hard reload
        window.location.reload();
      }
    };

    // Check every 1 minute (adjust as needed for "smartness")
    const interval = setInterval(checkUpdates, 60000);
    
    // Also check when tab becomes visible
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkUpdates();
      }
    });

    return () => clearInterval(interval);
  }, []);

  return null; // Side-effect only component
}
