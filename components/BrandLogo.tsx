import React from 'react';
import defaultProcureFlowLogo from '../docs/Logo Branding/LOGO-NEW/Procureflow_Logo.png';

type BrandLogoSize = 'sm' | 'md' | 'lg';

interface BrandLogoProps {
  appName?: string;
  logoUrl?: string;
  size?: BrandLogoSize;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
}

const sizeClasses: Record<BrandLogoSize, string> = {
  sm: 'h-8 w-8 rounded-lg p-1 text-sm',
  md: 'h-11 w-11 rounded-xl p-1.5 text-xl',
  lg: 'h-16 w-16 rounded-xl p-2 text-2xl',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  appName = 'ProcureFlow',
  logoUrl,
  size = 'md',
  alt,
  className = '',
  fallbackClassName = 'border border-gray-200 dark:border-white/10 bg-white text-gray-950 shadow-black/10',
}) => {
  const effectiveLogo = logoUrl || defaultProcureFlowLogo;
  const firstLetter = appName.trim().charAt(0) || 'P';

  return (
    <div
      className={[
        'flex shrink-0 items-center justify-center overflow-hidden font-bold leading-none shadow-md',
        sizeClasses[size],
        effectiveLogo
          ? 'border border-gray-200 dark:border-white/10 bg-white text-gray-950 shadow-black/10'
          : fallbackClassName,
        className,
      ].join(' ')}
    >
      {effectiveLogo ? (
        <img
          src={effectiveLogo}
          alt={alt || `${appName} logo`}
          className="block max-h-full max-w-full object-contain"
        />
      ) : (
        <span>{firstLetter}</span>
      )}
    </div>
  );
};
