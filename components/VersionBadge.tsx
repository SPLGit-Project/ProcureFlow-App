import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, RefreshCw, AlertCircle, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { fetchCurrentVersion, getStoredVersion, storeVersion, versionsAreDifferent } from '../utils/cacheManager';

interface VersionInfo {
  version: string;
  gitHash: string;
  buildTime: string;
  environment: string;
}

type VersionStatus = 'checking' | 'up-to-date' | 'update-available' | 'error';

/**
 * VersionBadge - Subtle version indicator for sidebar
 * Shows current version and update status with click-to-check functionality
 */
export default function VersionBadge() {
  const { branding } = useApp();
  const [status, setStatus] = useState<VersionStatus>('checking');
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Get theme-aware classes
  const isDarkTheme = ['brand', 'dark'].includes(branding.sidebarTheme || '');

  const checkVersion = useCallback(async () => {
    setStatus('checking');
    try {
      const serverVersion = await fetchCurrentVersion();
      if (!serverVersion?.version) {
        setStatus('error');
        return;
      }

      setVersionInfo(serverVersion as VersionInfo);
      setLastChecked(new Date());

      const storedVersion = getStoredVersion();
      
      if (!storedVersion) {
        // First time user - store current version
        storeVersion(serverVersion.version);
        setStatus('up-to-date');
      } else if (versionsAreDifferent(serverVersion.version, storedVersion)) {
        setStatus('update-available');
      } else {
        setStatus('up-to-date');
      }
    } catch (error) {
      console.error('VersionBadge: Check failed', error);
      setStatus('error');
    }
  }, []);

  // Check version on mount and periodically
  useEffect(() => {
    checkVersion();
    
    // Check every 5 minutes
    const interval = setInterval(checkVersion, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [checkVersion]);

  // Format the display version (short git hash)
  const displayVersion = versionInfo?.gitHash 
    ? `v${versionInfo.gitHash.substring(0, 7)}` 
    : 'v---';

  // Format last checked time
  const lastCheckedText = lastChecked 
    ? `Checked ${lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : '';

  // Format build time
  const buildTimeText = versionInfo?.buildTime 
    ? new Date(versionInfo.buildTime).toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';

  const getStatusIcon = () => {
    switch (status) {
      case 'checking':
        return <RefreshCw size={12} className="animate-spin" />;
      case 'up-to-date':
        return <CheckCircle size={12} className="text-green-500" />;
      case 'update-available':
        return <AlertCircle size={12} className="text-blue-500 animate-pulse" />;
      case 'error':
        return <AlertCircle size={12} className="text-orange-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'checking':
        return 'Checking...';
      case 'up-to-date':
        return 'Up to date';
      case 'update-available':
        return 'Update available';
      case 'error':
        return 'Check failed';
    }
  };

  return (
    <div className="relative">
      {/* Main Badge */}
      <button
        onClick={checkVersion}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs
          transition-all duration-200 group
          ${isDarkTheme 
            ? 'text-white/50 hover:text-white/80 hover:bg-white/5' 
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
          }
        `}
        title="Click to check for updates"
      >
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-mono">{displayVersion}</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">{getStatusText()}</span>
        </div>
        
        <RefreshCw 
          size={10} 
          className={`
            opacity-0 group-hover:opacity-100 transition-opacity
            ${status === 'checking' ? 'animate-spin' : ''}
          `}
        />
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div 
          className={`
            absolute bottom-full left-0 right-0 mb-2 p-3 rounded-lg shadow-xl z-50
            text-xs animate-fade-in
            ${isDarkTheme 
              ? 'bg-gray-900 text-white border border-white/10' 
              : 'bg-white text-gray-700 border border-gray-200'
            }
          `}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={isDarkTheme ? 'text-white/50' : 'text-gray-400'}>Version</span>
              <span className="font-mono font-bold">{displayVersion}</span>
            </div>
            
            {versionInfo?.gitHash && (
              <div className="flex items-center justify-between">
                <span className={isDarkTheme ? 'text-white/50' : 'text-gray-400'}>Commit</span>
                <span className="font-mono">{versionInfo.gitHash}</span>
              </div>
            )}
            
            {buildTimeText && (
              <div className="flex items-center justify-between">
                <span className={isDarkTheme ? 'text-white/50' : 'text-gray-400'}>Built</span>
                <span>{buildTimeText}</span>
              </div>
            )}
            
            {lastCheckedText && (
              <div className="flex items-center justify-between">
                <span className={isDarkTheme ? 'text-white/50' : 'text-gray-400'}>Status</span>
                <span>{lastCheckedText}</span>
              </div>
            )}

            {versionInfo?.environment && (
              <div className="flex items-center justify-between">
                <span className={isDarkTheme ? 'text-white/50' : 'text-gray-400'}>Env</span>
                <span className={`
                  px-1.5 py-0.5 rounded text-[10px] font-bold uppercase
                  ${versionInfo.environment === 'production' 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-orange-500/20 text-orange-400'
                  }
                `}>
                  {versionInfo.environment}
                </span>
              </div>
            )}
          </div>

          {/* Tooltip Arrow */}
          <div 
            className={`
              absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45
              ${isDarkTheme ? 'bg-gray-900 border-r border-b border-white/10' : 'bg-white border-r border-b border-gray-200'}
            `}
          />
        </div>
      )}
    </div>
  );
}
