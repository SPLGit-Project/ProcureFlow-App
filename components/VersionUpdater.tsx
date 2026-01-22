
import React, { useEffect, useState } from 'react';
import { RefreshCw, X, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

/**
 * Smart Version Updater
 * 
 * Periodically checks for a new version.json file on the server.
 * If the server version differs from the version loaded on mount,
 * it prompts the user to refresh.
 */
const VersionUpdater: React.FC = () => {
    const { branding } = useApp();
    // Use the build-time version injected by Vite
    const [initialVersion] = useState<string | null>(import.meta.env.VITE_APP_VERSION || null);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const CHECK_INTERVAL = 60 * 1000; // Check every 1 minute

    useEffect(() => {
       console.log("App Version:", initialVersion);
    }, [initialVersion]);

    useEffect(() => {
        if (!initialVersion) return;

        const checkVersion = async () => {
            if (document.hidden) return; // Don't check if tab is hidden
            
            try {
                const res = await fetch('/version.json?t=' + Date.now());
                if (res.ok) {
                    const data = await res.json();
                    if (data.version && data.version !== initialVersion) {
                        console.log(`New version available: ${data.version} (Create: ${initialVersion})`);
                        setUpdateAvailable(true);
                        setIsVisible(true);
                    }
                }
            } catch (e) {
                // Ignore errors (network offline, etc.)
            }
        };

        const intervalId = setInterval(checkVersion, CHECK_INTERVAL);
        
        // Also check when window gains focus
        const onFocus = () => checkVersion();
        window.addEventListener('focus', onFocus);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', onFocus);
        };
    }, [initialVersion]);

    const handleRefresh = () => {
        window.location.reload();
    };

    if (!updateAvailable || !isVisible) return null;

    const isDark = branding.sidebarTheme === 'dark'; // Approximate theme matching

    return (
        <div className={`fixed bottom-4 right-4 z-[100] max-w-sm w-full animate-slide-up shadow-2xl rounded-xl overflow-hidden border ${isDark ? 'bg-[#1e2029] border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-800'}`}>
            <div className={`h-1 w-full bg-[var(--color-brand)]`}></div>
            <div className="p-4 flex items-start gap-4">
                <div className={`p-2 rounded-full shrink-0 ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                    <RefreshCw size={20} className="animate-spin-slow" />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-sm mb-1">Update Available</h3>
                    <p className={`text-xs mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        A new version of {branding.appName} has been deployed. Refresh to get the latest features and fixes.
                    </p>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleRefresh}
                            className="flex-1 bg-[var(--color-brand)] text-white text-xs font-bold py-2 px-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={12} /> Refresh Now
                        </button>
                        <button 
                            onClick={() => setIsVisible(false)}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            Later
                        </button>
                    </div>
                </div>
                <button 
                    onClick={() => setIsVisible(false)}
                    className={`shrink-0 ${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};

export default VersionUpdater;
