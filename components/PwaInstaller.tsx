import React, { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, X, Smartphone, Zap, Wifi, Home, CheckCircle, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstaller() {
  const { branding, currentUser, updateProfile } = useApp();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [userEngaged, setUserEngaged] = useState(false);
  const [showFloatingButton, setShowFloatingButton] = useState(false);

  // Get hidden preference from currentUser (database)
  const promptHidden = currentUser?.pwaInstallPromptHidden ?? false;

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                            (window.navigator as any).standalone || 
                            document.referrer.includes('android-app://');
    setIsStandalone(isStandaloneMode);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Track user engagement (30 seconds or 2 page views)
    let pageViews = parseInt(sessionStorage.getItem('pwa_page_views') || '0');
    pageViews++;
    sessionStorage.setItem('pwa_page_views', pageViews.toString());

    const engagementTimer = setTimeout(() => {
      setUserEngaged(true);
    }, 30000); // 30 seconds

    if (pageViews >= 2) {
      setUserEngaged(true);
    }

    // Capture install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('PWA: beforeinstallprompt fired');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show banner if not hidden by user and user is engaged
      if (!isStandaloneMode && userEngaged && !promptHidden) {
        setShowBanner(true);
      }
      
      // Always show floating button if available and not already installed
      if (!isStandaloneMode && !promptHidden) {
        setShowFloatingButton(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS (no beforeinstallprompt) - show floating button immediately if not standalone and not hidden
    if (isIosDevice && !isStandaloneMode && !promptHidden) {
        setShowFloatingButton(true);
        // Only show banner after user engagement
        if (userEngaged) {
            setShowBanner(true);
        }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearTimeout(engagementTimer);
    };
  }, [userEngaged, promptHidden]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowBanner(false);
      setShowFloatingButton(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  };

  const handleDismissBanner = () => {
    setShowBanner(false);
  };

  const handleHidePermanently = async () => {
    try {
      await updateProfile({ pwaInstallPromptHidden: true });
      setShowBanner(false);
      setShowFloatingButton(false);
    } catch (error) {
      console.error('Failed to update PWA preference:', error);
    }
  };

  if (isStandalone) return null;

  return (
    <>
      {/* Success Confirmation */}
      {showSuccess && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 z-[9999]">
          <CheckCircle size={20}/>
          <span className="font-bold">App installed successfully!</span>
        </div>
      )}

      {/* Install Banner */}
      {showBanner && (
        <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-brand-dark)] text-white px-4 py-3 shadow-xl z-[9998]" style={{ backdropFilter: 'blur(10px)' }}>
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Smartphone size={24} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">Install {branding.appName || 'ProcureFlow'}</p>
                <p className="text-xs opacity-90 truncate">Quick access with offline support</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isIOS && (
                <button onClick={handleInstallClick} className="px-3 py-1.5 bg-white text-[var(--color-brand)] hover:bg-opacity-90 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md">
                  <Download size={14} /> Install
                </button>
              )}
              <button onClick={handleDismissBanner} className="p-1.5 hover:bg-white/20 rounded transition-colors" aria-label="Dismiss">
                <X size={18} />
              </button>
              <button onClick={handleHidePermanently} className="p-1.5 hover:bg-white/20 rounded transition-colors" aria-label="Hide Permanently" title="Don't show again (re-enable in Settings)">
                <Settings size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Install Button */}
      {showFloatingButton && !showBanner && (
        <div className="fixed bottom-6 right-6 z-[9997]">
          <button onClick={isIOS ? () => setShowBanner(true) : handleInstallClick} className="bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-brand-dark)] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center gap-2 group" title="Install App">
            {isIOS ? <Smartphone size={24} /> : <Download size={24} />}
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap text-sm font-bold">Install App</span>
          </button>
        </div>
      )}

      {/* iOS Instructions */}
      {isIOS && showBanner && (
        <div className="fixed top-16 left-0 right-0 bg-white dark:bg-gray-800 shadow-xl z-[9997] p-4 mx-auto max-w-2xl rounded-b-2xl">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <Home size={20} className="text-[var(--color-brand)]" />
            How to Install on iOS
          </h3>
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-full bg-[var(--color-brand)]/10 flex items-center justify-center flex-shrink-0 font-bold text-[var(--color-brand)] text-xs">1</div>
              <p>Tap the <Share className="inline mx-1" size={16} /> <strong>Share</strong> button at the bottom of your browser</p>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-full bg-[var(--color-brand)]/10 flex items-center justify-center flex-shrink-0 font-bold text-[var(--color-brand)] text-xs">2</div>
              <p>Scroll down and tap <PlusSquare className="inline mx-1" size={16} /> <strong>Add to Home Screen</strong></p>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-full bg-[var(--color-brand)]/10 flex items-center justify-center flex-shrink-0 font-bold text-[var(--color-brand)] text-xs">3</div>
              <p>Tap <strong>Add</strong> to confirm</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
