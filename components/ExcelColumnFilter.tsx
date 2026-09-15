import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Filter,
  Search,
  Check,
  X
} from 'lucide-react';

export type SortDirection = 'asc' | 'desc' | null;
export type SortType = 'alpha' | 'date' | 'numeric';

export interface ExcelColumnFilterProps {
  title: string;
  columnId: string;
  values: string[];
  valueCounts?: Record<string, number>;
  selectedValues: string[] | null; // null means no filter (all included)
  onApplyFilter: (selected: string[] | null) => void;
  onClearFilter: () => void;
  sortDirection: SortDirection;
  onSort: (direction: SortDirection) => void;
  sortType?: SortType;
  renderValueLabel?: (value: string) => React.ReactNode;
  align?: 'left' | 'right';
  extraContent?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  showFilterOnly?: boolean; // If true, hide sorting options
}

export const ExcelColumnFilter: React.FC<ExcelColumnFilterProps> = ({
  title,
  columnId,
  values,
  valueCounts = {},
  selectedValues,
  onApplyFilter,
  onClearFilter,
  sortDirection,
  onSort,
  sortType = 'alpha',
  renderValueLabel,
  align = 'left',
  extraContent,
  isOpen,
  onToggle,
  onClose,
  showFilterOnly = false
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  // Local draft of selected values while popover is open
  const [draftSelected, setDraftSelected] = useState<Set<string>>(
    () => new Set(selectedValues ?? values)
  );

  // Sync draft when opened or when selectedValues change
  useEffect(() => {
    if (isOpen) {
      setDraftSelected(new Set(selectedValues ?? values));
      setSearchTerm('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, selectedValues, values]);

  // Outside click & escape listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const isFiltered = Boolean(selectedValues !== null && selectedValues.length < values.length);

  // Filtered values based on search inside popover
  const filteredValues = useMemo(() => {
    if (!searchTerm.trim()) return values;
    const term = searchTerm.toLowerCase();
    return values.filter((v) => v.toLowerCase().includes(term));
  }, [values, searchTerm]);

  // Select all state for visible filtered values
  const allVisibleSelected = useMemo(() => {
    if (filteredValues.length === 0) return false;
    return filteredValues.every((v) => draftSelected.has(v));
  }, [filteredValues, draftSelected]);

  const someVisibleSelected = useMemo(() => {
    return filteredValues.some((v) => draftSelected.has(v));
  }, [filteredValues, draftSelected]);

  const handleToggleSelectAllVisible = () => {
    setDraftSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filteredValues.forEach((v) => next.delete(v));
      } else {
        filteredValues.forEach((v) => next.add(v));
      }
      return next;
    });
  };

  const handleToggleValue = (value: string) => {
    setDraftSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const handleApply = () => {
    if (draftSelected.size >= values.length) {
      // All values selected equals no filter
      onApplyFilter(null);
    } else {
      onApplyFilter(Array.from(draftSelected));
    }
    onClose();
  };

  const handleClear = () => {
    setDraftSelected(new Set(values));
    onClearFilter();
    onClose();
  };

  // Sort labels based on sortType
  const sortLabels = useMemo(() => {
    switch (sortType) {
      case 'date':
        return {
          asc: 'Sort Oldest to Newest',
          desc: 'Sort Newest to Oldest'
        };
      case 'numeric':
        return {
          asc: 'Sort Smallest to Largest',
          desc: 'Sort Largest to Smallest'
        };
      case 'alpha':
      default:
        return {
          asc: 'Sort A to Z',
          desc: 'Sort Z to A'
        };
    }
  }, [sortType]);

  return (
    <div ref={containerRef} className="relative inline-flex items-center select-none text-left">
      {/* Header Button */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={`Filter ${title}`}
        className={`group inline-flex items-center gap-1.5 py-1 px-1.5 rounded-lg transition-all text-xs font-semibold uppercase tracking-wider cursor-pointer ${
          isFiltered
            ? 'text-[var(--color-brand)] bg-[var(--color-brand)]/10 ring-1 ring-[var(--color-brand)]/30'
            : sortDirection
            ? 'text-[var(--color-brand)]'
            : 'text-tertiary dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        <span>{title}</span>

        {/* Sort indicator if active */}
        {sortDirection === 'asc' && (
          <ArrowUp size={13} className="text-[var(--color-brand)] shrink-0 animate-fade-in" />
        )}
        {sortDirection === 'desc' && (
          <ArrowDown size={13} className="text-[var(--color-brand)] shrink-0 animate-fade-in" />
        )}

        {/* Filter funnel icon */}
        <span
          className={`p-0.5 rounded transition-colors ${
            isFiltered
              ? 'bg-[var(--color-brand)] text-white'
              : 'text-gray-400 group-hover:text-gray-700 dark:text-gray-500 dark:group-hover:text-gray-200'
          }`}
          title={isFiltered ? `Filtered (${selectedValues?.length} selected)` : `Filter by ${title}`}
        >
          <Filter size={11} className={isFiltered ? 'fill-current' : ''} />
        </span>
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div
          className={`absolute top-full z-50 mt-1.5 w-72 sm:w-80 rounded-2xl bg-white dark:bg-[#1a1d26] border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden animate-scale-up text-xs font-normal normal-case ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          style={{ minWidth: '270px' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-[#15171e]/80">
            <div className="flex items-center gap-2">
              <Filter size={13} className="text-[var(--color-brand)]" />
              <span className="font-bold text-gray-900 dark:text-white">
                Filter &amp; Sort: {title}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              aria-label="Close filter"
            >
              <X size={14} />
            </button>
          </div>

          {/* Sort Controls (unless hidden) */}
          {!showFilterOnly && (
            <div className="p-2 border-b border-gray-100 dark:border-gray-800 space-y-1">
              <button
                type="button"
                onClick={() => {
                  onSort(sortDirection === 'asc' ? null : 'asc');
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  sortDirection === 'asc'
                    ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] font-bold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#232734]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <ArrowUp size={14} className="text-[var(--color-brand)]" />
                  <span>{sortLabels.asc}</span>
                </span>
                {sortDirection === 'asc' && <Check size={14} />}
              </button>

              <button
                type="button"
                onClick={() => {
                  onSort(sortDirection === 'desc' ? null : 'desc');
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  sortDirection === 'desc'
                    ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] font-bold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#232734]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <ArrowDown size={14} className="text-[var(--color-brand)]" />
                  <span>{sortLabels.desc}</span>
                </span>
                {sortDirection === 'desc' && <Check size={14} />}
              </button>

              {sortDirection !== null && (
                <button
                  type="button"
                  onClick={() => onSort(null)}
                  className="w-full text-left px-2.5 py-1 text-[11px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 underline cursor-pointer"
                >
                  Clear sort
                </button>
              )}
            </div>
          )}

          {/* Extra Custom Filter Content (e.g. Min/Max Range or Overdue switch) */}
          {extraContent && (
            <div className="p-2.5 border-b border-gray-100 dark:border-gray-800">
              {extraContent}
            </div>
          )}

          {/* Search Input */}
          <div className="p-2.5 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search values..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Select All Row */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50/50 dark:bg-[#15171e]/50 border-b border-gray-100 dark:border-gray-800 text-[11px]">
            <label className="flex items-center gap-2 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                ref={(el) => {
                  if (el) {
                    el.indeterminate = someVisibleSelected && !allVisibleSelected;
                  }
                }}
                onChange={handleToggleSelectAllVisible}
                className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-[var(--color-brand)] focus:ring-[var(--color-brand)] cursor-pointer"
              />
              <span>
                {searchTerm ? '(Select All Search Results)' : '(Select All)'}
              </span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDraftSelected(new Set(values))}
                className="text-[11px] text-[var(--color-brand)] hover:underline font-medium cursor-pointer"
              >
                All
              </button>
              <span className="text-gray-300 dark:text-gray-700">|</span>
              <button
                type="button"
                onClick={() => setDraftSelected(new Set())}
                className="text-[11px] text-gray-500 hover:underline font-medium cursor-pointer"
              >
                None
              </button>
            </div>
          </div>

          {/* Values Checkbox List */}
          <div className="max-h-52 overflow-y-auto p-1.5 space-y-0.5 divide-y divide-gray-50 dark:divide-gray-800/40">
            {filteredValues.length === 0 ? (
              <div className="py-6 text-center text-gray-400 dark:text-gray-500 text-xs">
                No matching values found
              </div>
            ) : (
              filteredValues.map((value) => {
                const isChecked = draftSelected.has(value);
                const count = valueCounts[value];

                return (
                  <label
                    key={value}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#232734] cursor-pointer select-none transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleValue(value)}
                        className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-[var(--color-brand)] focus:ring-[var(--color-brand)] shrink-0 cursor-pointer"
                      />
                      <div className="truncate text-gray-800 dark:text-gray-200">
                        {renderValueLabel ? renderValueLabel(value) : value || '(Blanks)'}
                      </div>
                    </div>

                    {count !== undefined && (
                      <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 shrink-0 ml-1">
                        ({count})
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-[#15171e] border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={handleClear}
              disabled={!isFiltered && draftSelected.size === values.length}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Clear Filter
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-[var(--color-brand)] hover:opacity-90 shadow-sm transition-all cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExcelColumnFilter;
