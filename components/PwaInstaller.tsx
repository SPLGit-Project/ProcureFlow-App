import React, { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, X, Smartphone, Monitor } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstaller() {
  const { branding } = useApp();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

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

    // Capture install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Auto-show prompt if not installed and not dismissed recently
      const lastDismissed = localStorage.getItem('pwa_prompt_dismissed');
      const now = Date.now();
      // Show again after 24 hours if dismissed
      if (!isStandaloneMode && (!lastDismissed || now - parseInt(lastDismissed) > 24 * 60 * 60 * 1000)) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS (no beforeinstallprompt) - show if not standalone and not dismissed
    if (isIosDevice && !isStandaloneMode) {
        const lastDismissed = localStorage.getItem('pwa_prompt_dismissed');
        const now = Date.now();
        if (!lastDismissed || now - parseInt(lastDismissed) > 24 * 60 * 60 * 1000) {
            setShowPrompt(true);
        }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa_prompt_dismissed', Date.now().toString());
  };

  if (isStandalone || !showPrompt) return null;

  return (
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
                    <img src={branding.logoUrl} alt="App Icon" className="w-full h-full object-cover" />
                </div>
                <div>
                    <h3 className="font-bold text-lg">Install {branding.appName}</h3>
                    <p className="text-blue-100 text-sm">Best experience on {isIOS ? 'iPhone' : 'Device'}</p>
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="p-6">
            <div className="flex flex-col gap-4">
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                    Install this application on your home screen for quick access and a better fullscreen experience.
                </p>

                {isIOS ? (
                    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
                        <div className="flex items-center gap-3">
                            <span className="w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-white/10 rounded-full font-bold text-xs">1</span>
                            <span>Tap the <Share size={16} className="inline mx-1 text-blue-500" /> <strong>Share</strong> button below</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-white/10 rounded-full font-bold text-xs">2</span>
                            <span>Select <PlusSquare size={16} className="inline mx-1" /> <strong>Add to Home Screen</strong></span>
                        </div>
                    </div>
                ) : (
                    <button 
                        onClick={handleInstallClick}
                        className="w-full bg-[var(--color-brand)] hover:brightness-110 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <Download size={20} />
                        Install App
                    </button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
