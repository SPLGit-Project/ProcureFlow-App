import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, MapPin, X } from 'lucide-react';
import { Site } from '../types.ts';

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

    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        if (isOpen) document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen]);

    const handleToggle = (siteId: string) => {
        const newIds = selectedSiteIds.includes(siteId)
            ? selectedSiteIds.filter(id => id !== siteId)
            : [...selectedSiteIds, siteId];
        onChange(newIds);
    };

    // Display label
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

    // Consistent color for site avatars
    const getColor = (index: number) => {
        const colors = [
            'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 
            'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
            'bg-indigo-500', 'bg-orange-500', 'bg-teal-500', 'bg-pink-500'
        ];
        return colors[index % colors.length];
    };

    const getInitials = (name: string) => 
        name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    // Styles based on variant
    const baseStyles = "w-full rounded-lg text-xs p-2.5 outline-none cursor-pointer font-bold transition-all flex items-center justify-between gap-2 relative";
    const variantStyles = {
        light: "bg-gray-50 text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-white shadow-sm",
        dark: "bg-white/10 text-white hover:bg-white/20 border border-white/10",
        brand: "bg-black/30 text-white border border-white/10 hover:bg-black/40"
    };

    // For single-site users, show a static badge instead of a dropdown
    if (sites.length <= 1) {
        const siteName = sites[0]?.name || 'No Sites Assigned';
        return (
            <div className={`${className}`}>
                <div className={`${baseStyles} ${variantStyles[variant]} cursor-default`}>
                    <span className="flex items-center gap-2">
                        <MapPin size={12} className="opacity-60" />
                        <span className="truncate">{siteName}</span>
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Trigger Button */}
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`${baseStyles} ${variantStyles[variant]}`}
            >
                <span className="flex items-center gap-2 min-w-0">
                    <MapPin size={12} className="shrink-0 opacity-60" />
                    <span className="truncate">{label}</span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                    {selectedSiteIds.length > 0 && selectedSiteIds.length < sites.length && (
                        <span className="bg-tranquil shadow-sm shadow-tranquil/30 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                            {selectedSiteIds.length}
                        </span>
                    )}
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </span>
            </button>

            {/* Dropdown Popup */}
            {isOpen && (
                <>
                    {/* Dim backdrop overlay for mobile / tablet */}
                    <div 
                        className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 animate-fade-in" 
                        onClick={() => setIsOpen(false)} 
                    />
                    
                    <div className="absolute top-full left-0 mt-2 w-full min-w-[260px] sm:min-w-[300px] max-w-[92vw] sm:max-w-sm bg-white dark:bg-nocturne shadow-2xl border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden z-50 flex flex-col max-h-[75vh] sm:max-h-[420px] animate-slide-up">
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/80 dark:bg-white/5 backdrop-blur-sm sticky top-0 z-10 shrink-0">
                            <div className="flex items-center gap-2">
                                <MapPin size={14} className="text-tranquil dark:text-tranquil/80 shrink-0" />
                                <span className="text-xs font-bold tracking-wide text-gray-900 dark:text-white">Site Access</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 bg-gray-200/70 dark:bg-white/10 p-1 rounded-lg">
                                    <button type="button"
                                        onClick={() => onChange(sites.map(s => s.id))}
                                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-white/20 shadow-xs transition-all cursor-pointer"
                                    >
                                        All
                                    </button>
                                    <button type="button"
                                        onClick={() => onChange([])}
                                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-white dark:hover:bg-white/20 dark:hover:text-red-400 shadow-xs transition-all cursor-pointer"
                                    >
                                        None
                                    </button>
                                </div>
                                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                                    {selectedSiteIds.length}/{sites.length}
                                </span>
                                <button type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors cursor-pointer"
                                    title="Close"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                        </div>

                        {/* Site List */}
                        <div className="overflow-y-auto p-2 flex-1 min-h-0 divide-y divide-gray-50 dark:divide-white/5">
                            {sites.length === 0 ? (
                                <div className="p-8 text-center text-xs text-gray-400 italic">
                                    No sites assigned to your account.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    {sites.map((site, index) => {
                                        const isSelected = selectedSiteIds.includes(site.id);
                                        return (
                                            <div 
                                                key={site.id}
                                                onClick={() => handleToggle(site.id)}
                                                className={`
                                                    group flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150
                                                    active:scale-[0.99] select-none
                                                    ${isSelected 
                                                        ? 'bg-tranquil/10 dark:bg-tranquil/20 text-tranquil dark:text-white' 
                                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5'
                                                    }
                                                `}
                                            >
                                                {/* Checkbox */}
                                                <div className={`
                                                    w-4 h-4 rounded-[4px] border-2 flex items-center justify-center transition-all shrink-0
                                                    ${isSelected 
                                                        ? 'bg-tranquil border-tranquil text-white' 
                                                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-transparent group-hover:border-tranquil/50'
                                                    }
                                                `}>
                                                    {isSelected && <Check size={10} strokeWidth={3} />}
                                                </div>

                                                {/* Site Avatar */}
                                                <div className={`w-6 h-6 ${getColor(index)} rounded-lg flex items-center justify-center shrink-0 shadow-xs opacity-90 group-hover:opacity-100 transition-opacity`}>
                                                    <span className="text-white text-[9px] font-bold tracking-wide">{getInitials(site.name)}</span>
                                                </div>

                                                {/* Site Name */}
                                                <div className="flex-1 min-w-0">
                                                    <div className={`truncate text-xs ${isSelected ? 'font-bold' : 'font-medium'}`}>
                                                        {site.name}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
