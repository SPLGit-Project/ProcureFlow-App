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

    const handleSelectAll = () => {
        if (selectedSiteIds.length === sites.length) {
            onChange([]); // Deselect all
        } else {
            onChange(sites.map(s => s.id)); // Select all
        }
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
                        <span className="bg-blue-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
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
                        z-50 bg-white dark:bg-[#1e2029] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden
                        animate-in fade-in zoom-in-95 duration-150 origin-top
                        fixed left-4 right-4 bottom-4 top-auto max-h-[70vh]
                        md:absolute md:top-full md:left-0 md:right-auto md:bottom-auto md:mt-1.5 md:min-w-[280px] md:max-h-[500px] md:w-max
                        flex flex-col
                    `}>
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/80 dark:bg-white/5 sticky top-0 z-10">
                            <div className="flex items-center gap-2">
                                <MapPin size={14} className="text-gray-400" />
                                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Site Access</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={handleSelectAll}
                                    className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    {selectedSiteIds.length === sites.length ? 'None' : 'All'}
                                </button>
                                <span className="text-[11px] text-gray-400 font-semibold bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full">
                                    {selectedSiteIds.length}/{sites.length}
                                </span>
                                {/* Close button for mobile */}
                                <button 
                                    onClick={() => setIsOpen(false)}
                                    className="md:hidden p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-400"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Site List - flex-1 min-h-0 allows it to scroll correctly within parent constraints */}
                        <div className="overflow-y-auto p-2 flex-1 min-h-0">
                            {sites.length === 0 ? (
                                <div className="p-8 text-center text-sm text-gray-400 italic">
                                    No sites assigned to your account.
                                </div>
                            ) : (
                                sites.map((site, index) => {
                                    const isSelected = selectedSiteIds.includes(site.id);
                                    return (
                                        <div 
                                            key={site.id}
                                            onClick={() => handleToggle(site.id)}
                                            className={`
                                                flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer mb-1 transition-all
                                                active:scale-[0.98] select-none
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
                                            <div className={`w-8 h-8 ${getColor(index)} rounded-lg flex items-center justify-center shrink-0 shadow-sm`}>
                                                <span className="text-white text-[10px] font-bold tracking-wide">{getInitials(site.name)}</span>
                                            </div>

                                            {/* Site Name */}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold truncate text-sm">{site.name}</div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
