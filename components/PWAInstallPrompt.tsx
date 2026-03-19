/**
 * @deprecated PWAInstallPrompt.tsx is superseded by PwaInstaller.tsx (Fix H5).
 *
 * This component has been replaced to eliminate the dual `beforeinstallprompt`
 * listener conflict that caused Edge/Chrome PWA install button failures.
 *
 * All PWA install functionality is now handled exclusively by PwaInstaller.tsx.
 * Remove this import from any component and use <PwaInstaller /> instead.
 */
import React from 'react';
import PwaInstaller from './PwaInstaller';

// Re-export as named export for backwards compatibility
export const PWAInstallPrompt = () => <PwaInstaller />;

export default PWAInstallPrompt;
