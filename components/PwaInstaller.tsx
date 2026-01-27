import React, { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, X, Smartphone, Monitor, Zap, Wifi, Home, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstaller() {
  const { branding } = useApp();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [userEngaged, setUserEngaged] = useState(false);

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
      
      // Auto-show prompt if user is engaged and not dismissed recently
      const lastDismissed = localStorage.getItem('pwa_prompt_dismissed');
      const now = Date.now();
      // Show again after 7 days if dismissed
      if (!isStandaloneMode && userEngaged && (!lastDismissed || now - parseInt(lastDismissed) > 7 * 24 * 60 * 60 * 1000)) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS (no beforeinstallprompt) - show if not standalone and not dismissed
    if (isIosDevice && !isStandaloneMode && userEngaged) {
        const lastDismissed = localStorage.getItem('pwa_prompt_dismissed');
        const now = Date.now();
        if (!lastDismissed || now - parseInt(lastDismissed) > 7 * 24 * 60 * 60 * 1000) {
            setShowPrompt(true);
        }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearTimeout(engagementTimer);
    };
  }, [userEngaged]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Dismissal time increased to 7 days
    localStorage.setItem('pwa_prompt_dismissed', Date.now().toString());
  };

  if (isStandalone) return null;

  return (
    <>
      {/* Success Confirmation */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 shadow-xl animate-slide-down flex items-center gap-3">
          <CheckCircle size={24} className="text-green-600" />
          <div>
            <p className="font-bold text-green-900 dark:text-green-100">Successfully Installed!</p>
            <p className="text-sm text-green-700 dark:text-green-300">Find {branding.appName} on your home screen</p>
          </div>
        </div>
      )}

      {/* Main Modal Prompt */}
      {showPrompt && (
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center pointer-events-none p-4 md:p-0">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto transition-opacity duration-300" onClick={handleDismiss} />
        
        <div className="bg-white dark:bg-[#1e2029] w-full max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden pointer-events-auto animate-slide-up relative">
          {/* Header */}
          <div className="bg-gradient-to-r from-[var(--color-brand)] to-blue-600 p-6 text-white relative">
              <button onClick={handleDismiss} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors">
                  <X size={20} />
              </button>
              <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center overflow-hidden">
                      <img src={branding.logoUrl || '/icons/icon-192x192.png'} alt="App Icon" className="w-full h-full object-cover" />
                  </div>
                  <div>
                      <h3 className="font-bold text-lg">Install {branding.appName}</h3>
                      <p className="text-blue-100 text-sm">Get the best experience</p>
                  </div>
              </div>
          </div>

          {/* Content */}
          <div className="p-6">
              <div className="flex flex-col gap-4">
                  {/* Benefits */}
                  <div className="space-y-3">
                      <div className="flex items-center gap-3 text-sm">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                              <Zap size={16} className="text-blue-600" />
                          </div>
                          <span className="text-gray-700 dark:text-gray-300"><strong>Faster loading</strong> - Instant access</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                          <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                              <Wifi size={16} className="text-green-600" />
                          </div>
                          <span className="text-gray-700 dark:text-gray-300"><strong>Works offline</strong> - No internet needed</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                          <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                              <Home size={16} className="text-purple-600" />
                          </div>
                          <span className="text-gray-700 dark:text-gray-300"><strong>Home screen access</strong> - One tap to open</span>
                      </div>
                  </div>

                  {isIOS ? (
                      <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 space-y-3 text-sm text-gray-700 dark:text-gray-300 mt-2">
                          <p className="font-bold text-gray-900 dark:text-white mb-2">How to install on iPhone/iPad:</p>
                          <div className="flex items-start gap-3">
                              <span className="w-6 h-6 flex items-center justify-center bg-blue-500 text-white rounded-full font-bold text-xs shrink-0">1</span>
                              <span>Tap the <Share size={14} className="inline mx-1 text-blue-500" /> <strong>Share</strong> button in Safari (bottom of screen)</span>
                          </div>
                          <div className="flex items-start gap-3">
                              <span className="w-6 h-6 flex items-center justify-center bg-blue-500 text-white rounded-full font-bold text-xs shrink-0">2</span>
                              <span>Scroll down and tap <PlusSquare size={14} className="inline mx-1" /> <strong>"Add to Home Screen"</strong></span>
                          </div>
                          <div className="flex items-start gap-3">
                              <span className="w-6 h-6 flex items-center justify-center bg-blue-500 text-white rounded-full font-bold text-xs shrink-0">3</span>
                              <span>Tap <strong>"Add"</strong> in the top right corner</span>
                          </div>
                      </div>
                  ) : (
                      <button 
                          onClick={handleInstallClick}
                          className="w-full bg-[var(--color-brand)] hover:brightness-110 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
                      >
                          <Download size={20} />
                          Install App
                      </button>
                  )}

                  <button
                      onClick={handleDismiss}
                      className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors text-center"
                  >
                      Maybe later
                  </button>
              </div>
          </div>
        </div>
      </div>
      )}

      {/* Persistent Floating Button (Fab) - Shows if dismissed but installable */}
      {!showPrompt && !isStandalone && (deferredPrompt || isIOS) && (
          <button
            onClick={() => setShowPrompt(true)} 
            className="fixed bottom-6 right-6 z-40 bg-[var(--color-brand)] text-white p-4 rounded-full shadow-xl shadow-blue-500/30 hover:scale-110 transition-transform flex items-center gap-2 pr-6"
            title="Install App"
          >
              <Download size={24} />
              <span className="font-bold">Install</span>
          </button>
      )}
    </>
  );
}
