
import React, { useState, useEffect, useMemo } from 'react';
import { 
    LayoutDashboard, House, PlusCircle, FileText, CheckCircle, Activity, 
    DollarSign, BarChart3, Clock, Settings, HelpCircle, 
    Eye, EyeOff, ArrowUp, ArrowDown, Save, RotateCcw,
    ListTodo, ListChecks, TrendingUp, ShieldCheck, ChevronRight, GripVertical
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DEFAULT_NAV_ITEMS } from '../constants/navigation';
import { MenuItemConfig } from '../types';

interface GroupedItem extends MenuItemConfig {
    label: string;
    iconName: string;
}

const MenuEditor = () => {
    const { branding, updateBranding } = useApp();
    const [items, setItems] = useState<GroupedItem[]>([]);
    const [hasChanges, setHasChanges] = useState(false);

    // Icon Mapping (Must match Layout.tsx)
    const iconMap: Record<string, any> = {
        LayoutDashboard, House, PlusCircle, FileText, CheckCircle, Activity, 
        DollarSign, BarChart3, Clock, Settings, HelpCircle,
        ListTodo, ListChecks, TrendingUp, ShieldCheck
    };

    // Initialize state from branding
    useEffect(() => {
        if (!branding) return;

        const config = branding.menuConfig || [];
        
        const merged = DEFAULT_NAV_ITEMS.map(def => {
            const conf = config.find(c => c.id === def.id);
            return {
                id: def.id,
                label: def.label,
                customLabel: conf?.customLabel,
                iconName: def.iconName,
                order: conf ? conf.order : DEFAULT_NAV_ITEMS.indexOf(def),
                isVisible: conf ? conf.isVisible : true,
                isSystem: def.isSystem,
                path: def.path,
                category: conf?.category || def.category
            };
        });

        // Sort by order
        merged.sort((a, b) => a.order - b.order);
        setItems(merged);
    }, [branding]);

    const groupedItems = useMemo(() => {
        const groups: { category: string; items: GroupedItem[] }[] = [];
        items.forEach(item => {
            const cat = item.category || 'Other';
            let group = groups.find(g => g.category === cat);
            if (!group) {
                group = { category: cat, items: [] };
                groups.push(group);
            }
            group.items.push(item);
        });
        return groups;
    }, [items]);

    const handleMoveItem = (itemId: string, direction: 'up' | 'down') => {
        const index = items.findIndex(i => i.id === itemId);
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === items.length - 1) return;

        const newItems = [...items];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
        newItems.forEach((item, idx) => item.order = idx);

        setItems(newItems);
        setHasChanges(true);
    };

    const handleMoveCategory = (category: string, direction: 'up' | 'down') => {
        const groupIndex = groupedItems.findIndex(g => g.category === category);
        if (direction === 'up' && groupIndex === 0) return;
        if (direction === 'down' && groupIndex === groupedItems.length - 1) return;

        const targetGroupIndex = direction === 'up' ? groupIndex - 1 : groupIndex + 1;
        const currentGroup = groupedItems[groupIndex];
        const targetGroup = groupedItems[targetGroupIndex];

        // We reorder the flat items list by moving the entire group's items
        const newItems = [...items];
        
        // Find ranges
        const currentItems = items.filter(i => (i.category || 'Other') === category);
        const targetItems = items.filter(i => (i.category || 'Other') === targetGroup.category);

        // This is complex in a flat list. Easier way: reorder the groups and then flatten.
        const newGroups = [...groupedItems];
        [newGroups[groupIndex], newGroups[targetGroupIndex]] = [newGroups[targetGroupIndex], newGroups[groupIndex]];
        
        const flattened = newGroups.flatMap(g => g.items);
        flattened.forEach((item, idx) => item.order = idx);

        setItems(flattened);
        setHasChanges(true);
    };

    const handleToggleVisibility = (itemId: string) => {
        setItems(prev => prev.map(item => 
            item.id === itemId ? { ...item, isVisible: !item.isVisible } : item
        ));
        setHasChanges(true);
    };

    const handleLabelChange = (itemId: string, val: string) => {
        setItems(prev => prev.map(item => 
            item.id === itemId ? { ...item, customLabel: val } : item
        ));
        setHasChanges(true);
    };

    const handleCategoryChange = (oldCat: string, newCat: string) => {
        if (!newCat.trim()) return;
        setItems(prev => prev.map(item => 
            (item.category || 'Other') === oldCat ? { ...item, category: newCat } : item
        ));
        setHasChanges(true);
    };

    const handleSave = async () => {
        const configToSave: MenuItemConfig[] = items.map(i => ({
            id: i.id,
            order: i.order,
            isVisible: i.isVisible,
            customLabel: i.customLabel,
            category: i.category
        }));

        await updateBranding({
            ...branding,
            menuConfig: configToSave
        });
        setHasChanges(false);
    };

    const handleReset = () => {
         if (confirm('Reset menu to default?')) {
             updateBranding({
                 ...branding,
                 menuConfig: undefined
             });
         }
    };

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-xl font-bold dark:text-gray-100 flex items-center gap-2">
                        Menu Architecture
                        <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full uppercase tracking-widest">Expansion v2</span>
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Configure sections, ordering, and visibility of the side navigation.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleReset}
                        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl flex items-center gap-2 transition-colors"
                    >
                        <RotateCcw size={16} />
                        Reset
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={!hasChanges}
                        className={`px-6 py-2 text-sm font-bold rounded-xl flex items-center gap-2 transition-all ${
                            hasChanges 
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20' 
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        <Save size={16} />
                        Save Configuration
                    </button>
                </div>
            </div>

            <div className="space-y-8">
                {groupedItems.map((group, gIdx) => (
                    <section key={group.category} className="bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden transition-all">
                        {/* Group Header */}
                        <div className="px-6 py-4 bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400">
                                    <GripVertical size={14} />
                                </div>
                                <input 
                                    type="text"
                                    value={group.category}
                                    onChange={(e) => handleCategoryChange(group.category, e.target.value)}
                                    className="bg-transparent border-none focus:ring-0 text-xs font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-48"
                                />
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => handleMoveCategory(group.category, 'up')}
                                    disabled={gIdx === 0}
                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg disabled:opacity-20"
                                >
                                    <ArrowUp size={16} />
                                </button>
                                <button 
                                    onClick={() => handleMoveCategory(group.category, 'down')}
                                    disabled={gIdx === groupedItems.length - 1}
                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg disabled:opacity-20"
                                >
                                    <ArrowDown size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Group Items */}
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {group.items.map((item, iIdx) => {
                                const Icon = iconMap[item.iconName] || HelpCircle;
                                return (
                                    <div key={item.id} className={`flex items-center gap-4 px-6 py-4 transition-all ${!item.isVisible ? 'opacity-50 grayscale bg-gray-50/30' : 'hover:bg-gray-50/50 dark:hover:bg-white/5'}`}>
                                        <div className="flex-1 flex items-center gap-4">
                                            <div className={`p-2 rounded-xl border transition-colors ${item.isVisible ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400'}`}>
                                                <Icon size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="text" 
                                                        value={item.customLabel || item.label} 
                                                        onChange={(e) => handleLabelChange(item.id, e.target.value)}
                                                        className="bg-transparent border-none focus:ring-0 text-sm font-bold dark:text-white w-full max-w-xs p-0"
                                                        placeholder={item.label}
                                                    />
                                                    {item.isSystem && (
                                                        <span className="text-[9px] font-black uppercase bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 tracking-tighter">System</span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                                                    <span className="truncate">{item.path}</span>
                                                    <ChevronRight size={10} />
                                                    <span className="opacity-60">{item.id}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            {/* Visibility */}
                                            <button 
                                                onClick={() => handleToggleVisibility(item.id)}
                                                disabled={item.isSystem}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                    item.isSystem 
                                                        ? 'text-gray-300 cursor-not-allowed'
                                                        : item.isVisible 
                                                            ? 'text-green-600 bg-green-50 dark:bg-green-900/20 hover:bg-green-100' 
                                                            : 'text-gray-400 bg-gray-100 dark:bg-gray-800 hover:text-gray-600'
                                                }`}
                                            >
                                                {item.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                                                {item.isVisible ? 'VISIBLE' : 'HIDDEN'}
                                            </button>

                                            {/* Item Ordering */}
                                            <div className="flex gap-1">
                                                <button 
                                                    onClick={() => handleMoveItem(item.id, 'up')}
                                                    disabled={items.findIndex(i => i.id === item.id) === 0}
                                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-20"
                                                >
                                                    <ArrowUp size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => handleMoveItem(item.id, 'down')}
                                                    disabled={items.findIndex(i => i.id === item.id) === items.length - 1}
                                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-20"
                                                >
                                                    <ArrowDown size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
};

export default MenuEditor;
