import React from 'react';

type BrandLogoSize = 'sm' | 'md' | 'lg';

interface BrandLogoProps {
  appName: string;
  logoUrl?: string;
  size?: BrandLogoSize;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
}

const sizeClasses: Record<BrandLogoSize, string> = {
  sm: 'h-8 w-8 rounded-lg p-1 text-sm',
  md: 'h-12 w-12 rounded-xl p-1.5 text-xl',
  lg: 'h-16 w-16 rounded-xl p-2 text-2xl',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  appName,
  logoUrl,
  size = 'md',
  alt,
  className = '',
  fallbackClassName = 'bg-tranquil text-white shadow-tranquil/30',
}) => {
  const firstLetter = appName.trim().charAt(0) || 'M';

  return (
    <div
      className={[
        'flex shrink-0 items-center justify-center overflow-hidden font-bold leading-none shadow-md',
        sizeClasses[size],
        logoUrl
          ? 'border border-gray-200 bg-white text-gray-950 shadow-black/10'
          : fallbackClassName,
        className,
      ].join(' ')}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={alt || `${appName} logo`}
          className="block max-h-full max-w-full object-contain"
        />
      ) : (
        <span>{firstLetter}</span>
      )}
    </div>
  );
};
