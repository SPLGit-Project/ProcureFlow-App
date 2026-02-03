
import React, { useState, useEffect } from 'react';
import { 
    LayoutDashboard, PlusCircle, FileText, CheckCircle, Activity, 
    DollarSign, BarChart3, Clock, Settings, HelpCircle, 
    Eye, EyeOff, ArrowUp, ArrowDown, Save, RotateCcw
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DEFAULT_NAV_ITEMS } from '../constants/navigation';
import { MenuItemConfig } from '../types';

const MenuEditor = () => {
    const { branding, updateBranding } = useApp();
    const [items, setItems] = useState<MenuItemConfig[]>([]);
    const [hasChanges, setHasChanges] = useState(false);

    // Icon Mapping (Must match Layout.tsx)
    const iconMap: Record<string, any> = {
        LayoutDashboard, PlusCircle, FileText, CheckCircle, Activity, 
        DollarSign, BarChart3, Clock, Settings, HelpCircle
    };

    // Initialize state from branding
    useEffect(() => {
        if (!branding) return;

        const config = branding.menuConfig || [];
        
        // Merge defaults with config
        const merged = DEFAULT_NAV_ITEMS.map(def => {
            const conf = config.find(c => c.id === def.id);
            return {
                id: def.id,
                label: def.label, // Base label for reference
                customLabel: conf?.customLabel,
                iconName: def.iconName,
                // Default props
                order: conf ? conf.order : DEFAULT_NAV_ITEMS.indexOf(def),
                isVisible: conf ? conf.isVisible : true,
                isSystem: def.isSystem
            };
        });

        // Sort by order
        merged.sort((a, b) => a.order - b.order);
        setItems(merged);
    }, [branding]);

    const handleMove = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === items.length - 1) return;

        const newItems = [...items];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        // Swap
        [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
        
        // Re-assign order based on new index
        newItems.forEach((item, idx) => item.order = idx);

        setItems(newItems);
        setHasChanges(true);
    };

    const handleToggleVisibility = (index: number) => {
        const newItems = [...items];
        newItems[index].isVisible = !newItems[index].isVisible;
        setItems(newItems);
        setHasChanges(true);
    };

    const handleLabelChange = (index: number, val: string) => {
        const newItems = [...items];
        newItems[index].customLabel = val;
        setItems(newItems);
        setHasChanges(true);
    };

    const handleSave = async () => {
        // Construct config object to save
        const configToSave: MenuItemConfig[] = items.map(i => ({
            id: i.id,
            order: i.order,
            isVisible: i.isVisible,
            customLabel: i.customLabel
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
                 menuConfig: undefined // Clear config to revert to defaults
             });
         }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-semibold dark:text-gray-100">Menu Customization</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Reorder, rename, or hide menu items.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleReset}
                        className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center gap-2"
                    >
                        <RotateCcw size={16} />
                        Reset Default
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={!hasChanges}
                        className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all ${
                            hasChanges 
                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md' 
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        <Save size={16} />
                        Save Changes
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-[#1e2029] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <div className="pl-2">Order</div>
                    <div>Label</div>
                    <div className="text-center">Visible</div>
                    <div className="pr-2">Actions</div>
                </div>
                
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {items.map((item, idx) => {
                        const Icon = iconMap[item.iconName] || HelpCircle;
                        return (
                            <div key={item.id} className={`grid grid-cols-[auto_1fr_auto_auto] gap-4 p-3 items-center hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${!item.isVisible ? 'opacity-60 bg-gray-50/50 dark:bg-gray-900/50' : ''}`}>
                                {/* Icon & Drag Handle (Visual) */}
                                <div className="pl-2 flex items-center gap-3 text-gray-400">
                                    <span className="text-xs font-mono w-4">{idx + 1}</span>
                                    <Icon size={18} className={item.isVisible ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'} />
                                </div>

                                {/* Label Editor */}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="text" 
                                            value={item.customLabel || item.label} 
                                            onChange={(e) => handleLabelChange(idx, e.target.value)}
                                            className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-0 text-sm font-medium dark:text-gray-200 w-full max-w-xs transition-colors px-1"
                                            placeholder={item.label}
                                        />
                                        {item.customLabel && (
                                            <button 
                                                onClick={() => handleLabelChange(idx, '')}
                                                className="text-xs text-gray-400 hover:text-red-500" 
                                                title="Reset Label"
                                            >
                                                (reset)
                                            </button>
                                        )}
                                        {item.isSystem && <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">SYSTEM</span>}
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-0.5 ml-1">{item.path}</div>
                                </div>

                                {/* Visibility Toggle */}
                                <div className="text-center flex justify-center">
                                    <button 
                                        onClick={() => handleToggleVisibility(idx)}
                                        disabled={item.isSystem}
                                        className={`p-1.5 rounded-lg transition-colors ${
                                            item.isSystem 
                                                ? 'text-gray-300 cursor-not-allowed'
                                                : item.isVisible 
                                                    ? 'text-green-600 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30' 
                                                    : 'text-gray-400 hover:text-gray-600 bg-gray-100 dark:bg-gray-800'
                                        }`}
                                        title={item.isSystem ? "System items cannot be hidden" : (item.isVisible ? "Visible" : "Hidden")}
                                    >
                                        {item.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>
                                </div>

                                {/* Reorder Actions */}
                                <div className="flex gap-1 pr-2">
                                    <button 
                                        onClick={() => handleMove(idx, 'up')}
                                        disabled={idx === 0}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                                        title="Move Up"
                                    >
                                        <ArrowUp size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleMove(idx, 'down')}
                                        disabled={idx === items.length - 1}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                                        title="Move Down"
                                    >
                                        <ArrowDown size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default MenuEditor;
