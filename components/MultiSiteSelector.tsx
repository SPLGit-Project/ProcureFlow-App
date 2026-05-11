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
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`${baseStyles} ${variantStyles[variant]}`}
            >
                <span className="flex items-center gap-2 min-w-0">
                    <MapPin size={12} className="shrink-0 opacity-60" />
                    <span className="truncate">{label}</span>
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                    {selectedSiteIds.length > 0 && selectedSiteIds.length < sites.length && (
                        <span className="bg-tranquil shadow-sm shadow-tranquil/30 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                            {selectedSiteIds.length}
                        </span>
                    )}
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* Dropdown — positioned to break out of sidebar constraints */}
            {isOpen && (
                <>
                    {/* Invisible overlay for mobile — prevents click-through */}
                    <div className="fixed inset-0 z-40 md:hidden" onClick={() => setIsOpen(false)} />
                    
                    <div className={`
                        z-50 bg-white dark:bg-nocturne shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden
                        animate-in fade-in slide-in-from-bottom-4 md:zoom-in-95 duration-200
                        fixed left-0 right-0 bottom-0 top-auto rounded-t-2xl rounded-b-none max-h-[85vh]
                        md:absolute md:top-full md:left-0 md:right-auto md:bottom-auto md:mt-2 md:min-w-[300px] md:max-h-[450px] md:w-max md:rounded-xl md:slide-in-from-top-2
                        flex flex-col
                    `}>
                        {/* Mobile Drag Handle */}
                        <div className="md:hidden pt-3 pb-1 flex justify-center bg-white dark:bg-nocturne">
                            <div className="w-10 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full" />
                        </div>

                        {/* Header */}
                        <div className="px-4 py-3 md:py-3 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-white/95 dark:bg-nocturne/95 backdrop-blur-sm sticky top-0 z-10 shrink-0">
                            <div className="flex items-center gap-2">
                                <MapPin size={14} className="text-tranquil dark:text-tranquil/80" />
                                <span className="text-xs font-bold tracking-wide text-gray-900 dark:text-white">Site Access</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-white/5 p-1 rounded-lg">
                                    <button type="button"
                                        onClick={() => onChange(sites.map(s => s.id))}
                                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10 shadow-sm transition-all"
                                    >
                                        All
                                    </button>
                                    <button type="button"
                                        onClick={() => onChange([])}
                                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-white dark:hover:bg-white/10 dark:hover:text-red-400 shadow-sm transition-all"
                                    >
                                        None
                                    </button>
                                </div>
                                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 ml-1">
                                    {selectedSiteIds.length}/{sites.length}
                                </span>
                                {/* Close button for mobile */}
                                <button type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="md:hidden ml-2 p-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 rounded-full text-gray-500 dark:text-gray-300 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Site List */}
                        <div className="overflow-y-auto p-2 md:p-3 flex-1 min-h-0 scrollbar-hide">
                            {sites.length === 0 ? (
                                <div className="p-8 text-center text-sm text-gray-400 italic">
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
                                                    group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200
                                                    active:scale-[0.98] select-none
                                                    ${isSelected 
                                                        ? 'bg-tranquil/5 dark:bg-tranquil/10 text-tranquil dark:text-white' 
                                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
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
                                                <div className={`w-7 h-7 ${getColor(index)} rounded-lg flex items-center justify-center shrink-0 shadow-sm opacity-90 group-hover:opacity-100 transition-opacity`}>
                                                    <span className="text-white text-[9px] font-bold tracking-wide">{getInitials(site.name)}</span>
                                                </div>

                                                {/* Site Name */}
                                                <div className="flex-1 min-w-0">
                                                    <div className={`truncate text-sm ${isSelected ? 'font-semibold' : 'font-medium'}`}>
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
