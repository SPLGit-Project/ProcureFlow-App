import React from 'react';
import { getCategoryConfig } from '../utils/categoryConfig.ts';

interface CustomerCategoryBadgeProps {
  category?: string | null;
  showLabel?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const CustomerCategoryBadge: React.FC<CustomerCategoryBadgeProps> = ({
  category,
  showLabel = false,
  size = 'sm',
  className = '',
}) => {
  const config = getCategoryConfig(category);
  const Icon = config.icon;

  const sizeStyles = {
    xs: {
      badge: 'p-1 text-[10px] gap-1',
      iconSize: 12,
    },
    sm: {
      badge: 'px-1.5 py-0.5 text-[11px] gap-1.5',
      iconSize: 13,
    },
    md: {
      badge: 'px-2 py-1 text-xs gap-2',
      iconSize: 15,
    },
  }[size];

  const tooltipText = `${config.label} • ${config.description}`;

  return (
    <div
      className={`relative inline-flex items-center group cursor-help ${className}`}
      title={tooltipText}
      aria-label={tooltipText}
    >
      <span
        className={`inline-flex items-center rounded-lg border font-semibold transition-all ${config.colors.badgeBg} ${config.colors.badgeText} ${config.colors.badgeBorder} ${sizeStyles.badge}`}
      >
        <Icon size={sizeStyles.iconSize} className="shrink-0" />
        {showLabel && <span className="font-bold">{config.label}</span>}
      </span>

      {/* Hover Floating Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150 transform translate-y-1 group-hover:translate-y-0 z-40 whitespace-nowrap shadow-xl">
        <div className="bg-gray-900 dark:bg-gray-800 text-white text-[11px] px-2.5 py-1 rounded-lg border border-gray-700/60 flex flex-col items-center">
          <span className="font-bold">{config.label}</span>
          <span className="text-[9px] text-gray-300 font-normal">{config.description}</span>
        </div>
        <div className="w-2 h-1 mx-auto -mt-px border-solid border-t-gray-900 dark:border-t-gray-800 border-t-4 border-x-transparent border-x-4 border-b-0" />
      </div>
    </div>
  );
};

export default CustomerCategoryBadge;
