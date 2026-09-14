import React from 'react';
import { SpendCategory } from '../types.ts';
import {
  CUSTOMER_CATEGORY_OPTIONS,
  getCategoryConfig,
} from '../utils/categoryConfig.ts';

interface CustomerCategorySelectorProps {
  value: SpendCategory;
  onChange: (category: SpendCategory) => void;
  disabled?: boolean;
  label?: string;
  showSelectedName?: boolean;
  showDescription?: boolean;
  className?: string;
}

export const CustomerCategorySelector: React.FC<CustomerCategorySelectorProps> = ({
  value,
  onChange,
  disabled = false,
  label = 'Customer Category',
  showSelectedName = true,
  showDescription = true,
  className = '',
}) => {
  const activeConfig = getCategoryConfig(value);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Header Label & Active Category Name */}
      <div className="flex items-center justify-between mb-1">
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          {label}
        </label>
        {showSelectedName && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold transition-all">
            <span className={`w-2 h-2 rounded-full ${activeConfig.colors.dot} shrink-0`} />
            <span className={activeConfig.colors.text}>{activeConfig.label}</span>
          </div>
        )}
      </div>

      {/* 5 Equal Icon Buttons Row */}
      <div className="grid grid-cols-5 gap-1.5">
        {CUSTOMER_CATEGORY_OPTIONS.map((cat) => {
          const Icon = cat.icon;
          const isSelected = value === cat.id;
          const tooltipText = `${cat.label} • ${cat.description}`;

          return (
            <div key={cat.id} className="relative group">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(cat.id)}
                title={tooltipText}
                aria-label={cat.label}
                className={`w-full h-10 flex items-center justify-center rounded-xl border transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isSelected
                    ? `${cat.colors.activeBg} ${cat.colors.activeText} ${cat.colors.activeBorder} shadow-sm ring-2 ${cat.colors.ring}`
                    : `bg-white dark:bg-[#15171e] text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 ${cat.colors.hoverBg}`
                }`}
              >
                <Icon
                  size={18}
                  className={`transition-transform duration-150 group-hover:scale-110 ${
                    isSelected ? 'text-white' : ''
                  }`}
                />
              </button>

              {/* Floating Hover Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150 transform translate-y-1 group-hover:translate-y-0 z-50 whitespace-nowrap shadow-xl">
                <div className="bg-gray-900 dark:bg-gray-800 text-white text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-700/70 flex flex-col items-center">
                  <span className="font-bold">{cat.label}</span>
                  <span className="text-[9px] text-gray-300 font-normal">{cat.description}</span>
                </div>
                <div className="w-2 h-1 mx-auto -mt-px border-solid border-t-gray-900 dark:border-t-gray-800 border-t-4 border-x-transparent border-x-4 border-b-0" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Helpful Selected Category Scope Subtitle */}
      {showDescription && (
        <div className="flex items-center justify-between px-0.5 text-[10px] text-gray-400 dark:text-gray-500">
          <span className="truncate">{activeConfig.description}</span>
        </div>
      )}
    </div>
  );
};

export default CustomerCategorySelector;
