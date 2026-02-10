import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, MapPin, X } from 'lucide-react';
import { Site } from '../types';

interface MultiSiteSelectorProps {
    sites: Site[];
    selectedSiteIds: string[];
    onChange: (ids: string[]) => void;
    className?: string;
    variant?: 'light' | 'dark' | 'brand';
}

export const MultiSiteSelector: React.FC<MultiSiteSelectorProps> = ({ 
    sites, 
    selectedSiteIds, 
    onChange,
    className = '',
    variant = 'light'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = (siteId: string) => {
        const newIds = selectedSiteIds.includes(siteId)
            ? selectedSiteIds.filter(id => id !== siteId)
            : [...selectedSiteIds, siteId];
        onChange(newIds);
    };

    const handleSelectAll = () => {
        if (selectedSiteIds.length === sites.length) {
            onChange([]); // Deselect all
        } else {
            onChange(sites.map(s => s.id)); // Select all
        }
    };

    // Calculate display label
    let label = 'Select Sites...';
    if (selectedSiteIds.length === 0) {
        label = 'No Site Selected';
    } else if (selectedSiteIds.length === sites.length && sites.length > 0) {
        label = 'All Sites';
    } else if (selectedSiteIds.length === 1) {
        const site = sites.find(s => s.id === selectedSiteIds[0]);
        label = site ? site.name : 'Unknown Site';
    } else {
        label = `${selectedSiteIds.length} Sites Selected`;
    }

    // Styles based on variant
    const baseStyles = "w-full rounded-lg text-xs p-2.5 outline-none cursor-pointer font-bold transition-all flex items-center justify-between gap-2 relative";
    const variantStyles = {
        light: "bg-gray-50 text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-white shadow-sm",
        dark: "bg-white/10 text-white hover:bg-white/20 border border-white/10",
        brand: "bg-black/30 text-white border border-white/10 hover:bg-black/40"
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Trigger Button */}
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`${baseStyles} ${variantStyles[variant]}`}
            >
                <span className="truncate">{label}</span>
                <ChevronDown size={14} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                
                {/* Badge for partial selection */}
                {selectedSiteIds.length > 0 && selectedSiteIds.length < sites.length && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>
                )}
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-1.5 z-50 bg-white dark:bg-[#1e2029] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top min-w-[260px]"
                     style={{ right: 0 }}
                >
                    {/* Header Actions */}
                    <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                        <button 
                            onClick={handleSelectAll}
                            className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:underline px-1"
                        >
                            {selectedSiteIds.length === sites.length ? 'Deselect All' : 'Select All'}
                        </button>
                        <span className="text-[11px] text-gray-400 font-semibold bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full">
                            {selectedSiteIds.length}/{sites.length}
                        </span>
                    </div>

                    {/* Site List */}
                    <div className="max-h-96 overflow-y-auto p-1.5 custom-scrollbar">
                        {sites.length === 0 ? (
                            <div className="p-6 text-center text-xs text-gray-400 italic">No sites available</div>
                        ) : (
                            sites.map((site, index) => {
                                const isSelected = selectedSiteIds.includes(site.id);
                                // Generate a consistent color based on site name
                                const colors = [
                                    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 
                                    'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
                                    'bg-indigo-500', 'bg-orange-500', 'bg-teal-500', 'bg-pink-500'
                                ];
                                const colorClass = colors[index % colors.length];
                                const initials = site.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

                                return (
                                    <div 
                                        key={site.id}
                                        onClick={() => handleToggle(site.id)}
                                        className={`
                                            flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm mb-1 transition-all
                                            ${isSelected 
                                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800' 
                                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                                            }
                                        `}
                                    >
                                        {/* Checkbox */}
                                        <div className={`
                                            w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0
                                            ${isSelected 
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                                                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-transparent'
                                            }
                                        `}>
                                            {isSelected && <Check size={12} strokeWidth={3} />}
                                        </div>

                                        {/* Site Avatar */}
                                        <div className={`w-7 h-7 ${colorClass} rounded-lg flex items-center justify-center shrink-0 shadow-sm`}>
                                            <span className="text-white text-[10px] font-bold">{initials}</span>
                                        </div>

                                        {/* Site Name */}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold truncate text-[13px]">{site.name}</div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
