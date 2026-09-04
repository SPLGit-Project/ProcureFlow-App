import React, { useMemo, useState } from 'react';
import {
    BookOpen,
    Check,
    Database,
    DollarSign,
    Edit2,
    FlaskConical,
    FolderTree,
    Layers,
    ListChecks,
    Plus,
    Save,
    Search,
    Sparkles,
    Tag,
    Trash2,
    X
} from 'lucide-react';
import { AttributeOption, AttributeType, Item } from '../types';
import { ITEM_PREVIEW_OPTION_GROUPS } from '../utils/itemPreviewOptions';
import { useToast } from './ToastNotification';

interface ItemSetupManagementProps {
    options: AttributeOption[];
    items: Item[];
    upsertOption: (option: Partial<AttributeOption>) => Promise<void>;
    deleteOption: (id: string) => Promise<void>;
}

type ItemField = 'itemPool' | 'itemCatalog' | 'itemType' | 'category' | 'subCategory' | 'uom';

interface SetupGroup {
    type: AttributeType;
    label: string;
    description: string;
    itemField?: ItemField;
    icon: React.ElementType;
    defaults?: string[];
}

const TAXONOMY_GROUPS: SetupGroup[] = [
    { type: 'POOL', label: 'Pools', description: 'Linen and inventory pooling classifications.', itemField: 'itemPool', icon: Layers },
    { type: 'CATALOG', label: 'Catalogues', description: 'Master commercial catalogue classifications.', itemField: 'itemCatalog', icon: BookOpen },
    { type: 'TYPE', label: 'Item Types', description: 'Primary product type categorization.', itemField: 'itemType', icon: Tag },
    { type: 'CATEGORY', label: 'Categories', description: 'Broad item hierarchy categories.', itemField: 'category', icon: FolderTree },
    { type: 'SUB_CATEGORY', label: 'Sub-categories', description: 'Granular product sub-classifications.', itemField: 'subCategory', icon: ListChecks },
    { type: 'UOM', label: 'Units of Measure', description: 'Standard stock, order, and packaging units.', itemField: 'uom', icon: Database }
];

const WORKFLOW_DROPDOWN_TYPES: AttributeType[] = [
    'PREVIEW_REQUEST_TYPE', 'PREVIEW_DEPARTMENT', 'PREVIEW_BUSINESS_UNIT',
    'PREVIEW_BUSINESS_REASON', 'PREVIEW_PRICE_TYPE', 'PREVIEW_TAX_CODE'
];

const WORKFLOW_GROUPS: SetupGroup[] = ITEM_PREVIEW_OPTION_GROUPS
    .filter(group => WORKFLOW_DROPDOWN_TYPES.includes(group.type as AttributeType))
    .map(group => ({
        type: group.type,
        label: group.label,
        description: group.description,
        icon: ListChecks,
        defaults: group.defaults
    }));

const ITEM_CREATION_REF_TYPES: AttributeType[] = [
    'PREVIEW_CUSTOMER_PRICING_GROUP', 'PREVIEW_SAP_MAPPING', 'PREVIEW_SUPPLIER_EXT'
];

const ITEM_CREATION_GROUPS: SetupGroup[] = ITEM_PREVIEW_OPTION_GROUPS
    .filter(group => ITEM_CREATION_REF_TYPES.includes(group.type as AttributeType))
    .map(group => ({
        type: group.type,
        label: group.label,
        description: group.description,
        icon: group.type === 'PREVIEW_SAP_MAPPING' ? DollarSign
            : group.type === 'PREVIEW_CUSTOMER_PRICING_GROUP' ? Tag
            : Database,
        defaults: group.defaults
    }));

const normalizeValue = (value: unknown) => String(value || '').trim();

export const ItemSetupManagement: React.FC<ItemSetupManagementProps> = ({
    options,
    items,
    upsertOption,
    deleteOption
}) => {
    const { success, error } = useToast();
    const [activeSection, setActiveSection] = useState<'TAXONOMY' | 'DROPDOWNS' | 'ITEM_CREATION'>('TAXONOMY');
    const [selectedGroupType, setSelectedGroupType] = useState<AttributeType>('POOL');
    const [searchQuery, setSearchQuery] = useState('');
    const [draftValue, setDraftValue] = useState('');
    const [editing, setEditing] = useState<AttributeOption | null>(null);
    const [editValue, setEditValue] = useState('');
    const [savingType, setSavingType] = useState<AttributeType | null>(null);

    const activeOptions = useMemo(
        () => options.filter(option => option.activeFlag !== false),
        [options]
    );

    const savedByType = useMemo(() => {
        const grouped = new Map<AttributeType, AttributeOption[]>();
        activeOptions.forEach(option => {
            if (!grouped.has(option.type)) grouped.set(option.type, []);
            grouped.get(option.type)?.push(option);
        });
        grouped.forEach(groupOptions => groupOptions.sort((a, b) => a.value.localeCompare(b.value)));
        return grouped;
    }, [activeOptions]);

    const itemValueCounts = useMemo(() => {
        const grouped = new Map<AttributeType, Map<string, number>>();
        TAXONOMY_GROUPS.forEach(group => grouped.set(group.type, new Map()));

        items.forEach(item => {
            TAXONOMY_GROUPS.forEach(group => {
                if (!group.itemField) return;
                const value = normalizeValue(item[group.itemField]);
                if (!value) return;
                const values = grouped.get(group.type);
                values?.set(value, (values.get(value) || 0) + 1);
            });
        });

        return grouped;
    }, [items]);

    const taxonomyRows = useMemo(() => {
        return TAXONOMY_GROUPS.map(group => {
            const saved = savedByType.get(group.type) || [];
            const counts = itemValueCounts.get(group.type) || new Map<string, number>();
            const savedValues = new Set(saved.map(option => option.value));
            const discovered = Array.from(counts.entries())
                .filter(([value]) => !savedValues.has(value))
                .map(([value, itemCount]) => ({ value, itemCount }))
                .sort((a, b) => a.value.localeCompare(b.value));

            return { group, saved, discovered };
        });
    }, [itemValueCounts, savedByType]);

    const dropdownRows = useMemo(() => {
        return WORKFLOW_GROUPS.map(group => {
            const saved = savedByType.get(group.type) || [];
            const savedValues = new Set(saved.map(option => option.value));
            const defaultOnly = (group.defaults || [])
                .filter(value => !savedValues.has(value))
                .map(value => ({ value }));
            return { group, saved, defaultOnly };
        });
    }, [savedByType]);

    const itemCreationRows = useMemo(() => {
        return ITEM_CREATION_GROUPS.map(group => {
            const saved = savedByType.get(group.type) || [];
            const savedValues = new Set(saved.map(option => option.value));
            const defaultOnly = (group.defaults || [])
                .filter(value => !savedValues.has(value))
                .map(value => ({ value }));
            return { group, saved, defaultOnly };
        });
    }, [savedByType]);

    const currentGroups = useMemo(() => {
        if (activeSection === 'TAXONOMY') return taxonomyRows;
        if (activeSection === 'DROPDOWNS') return dropdownRows;
        return itemCreationRows;
    }, [activeSection, taxonomyRows, dropdownRows, itemCreationRows]);

    // Ensure selected group type is valid when switching tabs
    React.useEffect(() => {
        const firstGroup = currentGroups[0];
        if (firstGroup && !currentGroups.some(g => g.group.type === selectedGroupType)) {
            setSelectedGroupType(firstGroup.group.type);
        }
    }, [activeSection, currentGroups, selectedGroupType]);

    const activeGroupData = useMemo(() => {
        return currentGroups.find(g => g.group.type === selectedGroupType) || currentGroups[0];
    }, [currentGroups, selectedGroupType]);

    const stats = useMemo(() => {
        const savedTaxonomy = taxonomyRows.reduce((sum, row) => sum + row.saved.length, 0);
        const discoveredTaxonomy = taxonomyRows.reduce((sum, row) => sum + row.discovered.length, 0);
        const savedDropdowns = dropdownRows.reduce((sum, row) => sum + row.saved.length, 0);
        const savedItemCreation = itemCreationRows.reduce((sum, row) => sum + row.saved.length, 0);
        return { savedTaxonomy, discoveredTaxonomy, savedDropdowns, savedItemCreation };
    }, [dropdownRows, taxonomyRows, itemCreationRows]);

    const handleAdd = async (type: AttributeType) => {
        const value = normalizeValue(draftValue);
        if (!value) return;
        setSavingType(type);
        try {
            await upsertOption({ type, value, activeFlag: true });
            setDraftValue('');
            success('Option saved.');
        } catch (err) {
            error((err as Error).message);
        } finally {
            setSavingType(null);
        }
    };

    const handleSaveValue = async (type: AttributeType, value: string) => {
        setSavingType(type);
        try {
            await upsertOption({ type, value, activeFlag: true });
            success('Option saved to shared setup.');
        } catch (err) {
            error((err as Error).message);
        } finally {
            setSavingType(null);
        }
    };

    const handleSaveAll = async (type: AttributeType, values: string[]) => {
        setSavingType(type);
        try {
            for (const value of values) {
                await upsertOption({ type, value, activeFlag: true });
            }
            success('Options saved to shared setup.');
        } catch (err) {
            error((err as Error).message);
        } finally {
            setSavingType(null);
        }
    };

    const handleUpdate = async () => {
        if (!editing || !normalizeValue(editValue)) return;
        setSavingType(editing.type);
        try {
            await upsertOption({ ...editing, value: normalizeValue(editValue), activeFlag: true });
            setEditing(null);
            setEditValue('');
            success('Option updated.');
        } catch (err) {
            error((err as Error).message);
        } finally {
            setSavingType(null);
        }
    };

    const handleDelete = async (option: AttributeOption) => {
        if (!globalThis.confirm(`Remove "${option.value}" from shared item setup?`)) return;
        setSavingType(option.type);
        try {
            await deleteOption(option.id);
            success('Option removed.');
        } catch (err) {
            error((err as Error).message);
        } finally {
            setSavingType(null);
        }
    };

    // Filter values based on search query
    const filteredSaved = useMemo(() => {
        if (!activeGroupData?.saved) return [];
        if (!searchQuery.trim()) return activeGroupData.saved;
        return activeGroupData.saved.filter(opt =>
            opt.value.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [activeGroupData, searchQuery]);

    const filteredDiscovered = useMemo(() => {
        if (!('discovered' in activeGroupData) || !activeGroupData.discovered) return [];
        if (!searchQuery.trim()) return activeGroupData.discovered;
        return activeGroupData.discovered.filter(d =>
            d.value.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [activeGroupData, searchQuery]);

    const filteredDefaults = useMemo(() => {
        if (!('defaultOnly' in activeGroupData) || !activeGroupData.defaultOnly) return [];
        if (!searchQuery.trim()) return activeGroupData.defaultOnly;
        return activeGroupData.defaultOnly.filter(d =>
            d.value.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [activeGroupData, searchQuery]);

    const totalCountInActiveGroup = (activeGroupData?.saved?.length || 0) +
        (('discovered' in activeGroupData ? activeGroupData.discovered?.length : 0) || 0) +
        (('defaultOnly' in activeGroupData ? activeGroupData.defaultOnly?.length : 0) || 0);

    return (
        <div className="space-y-4">
            {/* Top Toolbar: Section Tabs & Compact Metric Pills */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                {/* Main 3 Section Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 dark:bg-white/[0.04] rounded-xl border border-gray-200/70 dark:border-gray-800/80">
                    {[
                        { id: 'TAXONOMY', label: 'Item Categorisation', icon: FolderTree },
                        { id: 'DROPDOWNS', label: 'Shared Dropdowns', icon: ListChecks },
                        { id: 'ITEM_CREATION', label: 'Creation Reference', icon: FlaskConical }
                    ].map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeSection === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => {
                                    setActiveSection(tab.id as 'TAXONOMY' | 'DROPDOWNS' | 'ITEM_CREATION');
                                    setSearchQuery('');
                                    setDraftValue('');
                                }}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    isActive
                                        ? 'bg-white dark:bg-[#1e2029] text-[var(--color-brand)] shadow-sm'
                                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                <Icon size={14} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Sleek Compact Metric Pills */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>Saved Taxonomy:</span>
                        <strong className="font-bold text-emerald-800 dark:text-emerald-200">{stats.savedTaxonomy}</strong>
                    </div>
                    {stats.discoveredTaxonomy > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            <span>Unmapped in Items:</span>
                            <strong className="font-bold text-amber-800 dark:text-amber-200">{stats.discoveredTaxonomy}</strong>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-500/20">
                        <span>Dropdowns:</span>
                        <strong className="font-bold text-blue-800 dark:text-blue-200">{stats.savedDropdowns}</strong>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-500/20">
                        <span>Ref Data:</span>
                        <strong className="font-bold text-purple-800 dark:text-purple-200">{stats.savedItemCreation}</strong>
                    </div>
                </div>
            </div>

            {/* Main Desktop Optimized Workbench Layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start min-h-[460px]">
                {/* Left Category Selector Rail (4 cols on desktop, full on mobile) */}
                <div className="md:col-span-4 xl:col-span-3 space-y-1.5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 px-2 pb-1">
                        Select Classification Tier
                    </div>

                    {/* Mobile horizontal ribbon / Desktop vertical column */}
                    <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible no-scrollbar pb-1 md:pb-0">
                        {currentGroups.map(item => {
                            const group = item.group;
                            const Icon = group.icon;
                            const isSelected = selectedGroupType === group.type;
                            const savedCount = item.saved.length;
                            const unmappedCount = 'discovered' in item ? item.discovered.length : ('defaultOnly' in item ? item.defaultOnly.length : 0);

                            return (
                                <button
                                    key={group.type}
                                    type="button"
                                    onClick={() => {
                                        setSelectedGroupType(group.type);
                                        setSearchQuery('');
                                        setDraftValue('');
                                        setEditing(null);
                                    }}
                                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 shrink-0 md:shrink ${
                                        isSelected
                                            ? 'bg-white dark:bg-[#1a1c24] border-[var(--color-brand)] shadow-md shadow-[var(--color-brand)]/5 ring-1 ring-[var(--color-brand)]'
                                            : 'bg-white/60 dark:bg-white/[0.02] border-gray-200/70 dark:border-gray-800/80 hover:bg-gray-50 dark:hover:bg-white/[0.04] text-gray-600 dark:text-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                            isSelected
                                                ? 'bg-[var(--color-brand)] text-white shadow-sm'
                                                : 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400'
                                        }`}>
                                            <Icon size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className={`text-xs font-bold truncate ${
                                                isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                                            }`}>
                                                {group.label}
                                            </div>
                                            <div className="text-[10px] text-gray-400 truncate">
                                                {savedCount} configured
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                        {unmappedCount > 0 && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                                                +{unmappedCount}
                                            </span>
                                        )}
                                        <span className="text-[11px] font-semibold text-gray-400">
                                            {savedCount}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Interactive Workbench Pane (8 cols on desktop) */}
                <div className="md:col-span-8 xl:col-span-9 bg-white dark:bg-[#15171e] rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4 shadow-sm">
                    {/* Header with Title, Description, and Bulk Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-3">
                            {(() => {
                                const Icon = activeGroupData?.group?.icon || Layers;
                                return (
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                        <Icon size={20} />
                                    </div>
                                );
                            })()}
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <span>{activeGroupData?.group?.label}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300 font-semibold">
                                        {totalCountInActiveGroup} total
                                    </span>
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {activeGroupData?.group?.description || 'Manage selectable values and taxonomy hierarchy.'}
                                </p>
                            </div>
                        </div>

                        {/* Bulk Action Button if unmapped discovered or default fallback exists */}
                        {'discovered' in activeGroupData && activeGroupData.discovered && activeGroupData.discovered.length > 0 && (
                            <button
                                type="button"
                                onClick={() => handleSaveAll(activeGroupData.group.type, activeGroupData.discovered.map(row => row.value))}
                                disabled={savingType === activeGroupData.group.type}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-sm shrink-0"
                            >
                                <Sparkles size={14} />
                                <span>Save All Discovered ({activeGroupData.discovered.length})</span>
                            </button>
                        )}
                        {'defaultOnly' in activeGroupData && activeGroupData.defaultOnly && activeGroupData.defaultOnly.length > 0 && (
                            <button
                                type="button"
                                onClick={() => handleSaveAll(activeGroupData.group.type, activeGroupData.defaultOnly.map(row => row.value))}
                                disabled={savingType === activeGroupData.group.type}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shrink-0"
                            >
                                <Sparkles size={14} />
                                <span>Save All Defaults ({activeGroupData.defaultOnly.length})</span>
                            </button>
                        )}
                    </div>

                    {/* Quick Add and Search Bar (Inline 2-column or flex) */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        {/* Add Input (7 cols) */}
                        <div className="sm:col-span-7 flex gap-1.5">
                            <input
                                className="input-field py-2 text-xs"
                                value={draftValue}
                                onChange={e => setDraftValue(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && draftValue.trim()) {
                                        handleAdd(activeGroupData.group.type);
                                    }
                                }}
                                placeholder={`Add new ${activeGroupData?.group?.label?.toLowerCase() || 'value'}...`}
                            />
                            <button
                                type="button"
                                onClick={() => handleAdd(activeGroupData.group.type)}
                                disabled={savingType === activeGroupData.group.type || !normalizeValue(draftValue)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--color-brand)] hover:opacity-90 text-white text-xs font-bold transition-all shrink-0 disabled:opacity-40"
                            >
                                <Plus size={15} />
                                <span>Add</span>
                            </button>
                        </div>

                        {/* Search Filter (5 cols) */}
                        <div className="sm:col-span-5 relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                className="input-field pl-8 py-2 text-xs"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Filter values..."
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Value Tiles Grid */}
                    <div className="max-h-[380px] overflow-y-auto pr-1 space-y-2.5">
                        {/* 1. Saved Values Section */}
                        {filteredSaved.length > 0 && (
                            <div className="space-y-1.5">
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
                                    Configured & Active Values ({filteredSaved.length})
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                    {filteredSaved.map(option => (
                                        <div
                                            key={option.id}
                                            className="flex items-center justify-between gap-2.5 rounded-xl border border-gray-200/80 bg-gray-50/50 p-2.5 hover:bg-white dark:border-gray-800 dark:bg-white/[0.02] dark:hover:bg-white/[0.05] transition-all group"
                                        >
                                            {editing?.id === option.id ? (
                                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                    <input
                                                        className="input-field py-1 text-xs"
                                                        value={editValue}
                                                        onChange={e => setEditValue(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleUpdate();
                                                            if (e.key === 'Escape') setEditing(null);
                                                        }}
                                                        autoFocus
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleUpdate}
                                                        disabled={savingType === option.type}
                                                        className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600"
                                                        title="Save"
                                                    >
                                                        <Check size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditing(null)}
                                                        className="p-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                                                        title="Cancel"
                                                    >
                                                        <X size={13} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="min-w-0 flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                                        <span className="truncate text-xs font-bold text-gray-800 dark:text-gray-200">
                                                            {option.value}
                                                        </span>
                                                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                                                            Saved
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditing(option);
                                                                setEditValue(option.value);
                                                            }}
                                                            className="p-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-gray-400 hover:text-blue-600 transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Edit2 size={13} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(option)}
                                                            className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-600 transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 2. Discovered Unmapped Values Section (Found in Item master) */}
                        {filteredDiscovered.length > 0 && (
                            <div className="space-y-1.5 pt-2">
                                <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
                                    <Sparkles size={12} />
                                    <span>Found in Existing Items ({filteredDiscovered.length})</span>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                    {filteredDiscovered.map(row => (
                                        <div
                                            key={`${activeGroupData.group.type}-${row.value}`}
                                            className="flex items-center justify-between gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/60 p-2.5 dark:border-amber-500/20 dark:bg-amber-500/10"
                                        >
                                            <div className="min-w-0">
                                                <div className="truncate text-xs font-bold text-gray-800 dark:text-gray-200">
                                                    {row.value}
                                                </div>
                                                <div className="text-[9px] font-bold text-amber-700 dark:text-amber-300">
                                                    Used by {row.itemCount} item{row.itemCount === 1 ? '' : 's'}
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleSaveValue(activeGroupData.group.type, row.value)}
                                                disabled={savingType === activeGroupData.group.type}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition-all shrink-0"
                                            >
                                                <Save size={12} />
                                                <span>Save</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 3. Default Fallbacks Section */}
                        {filteredDefaults.length > 0 && (
                            <div className="space-y-1.5 pt-2">
                                <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider px-1">
                                    Standard Defaults Available ({filteredDefaults.length})
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                    {filteredDefaults.map(row => (
                                        <div
                                            key={`${activeGroupData.group.type}-${row.value}`}
                                            className="flex items-center justify-between gap-2.5 rounded-xl border border-gray-200 bg-white p-2.5 dark:border-gray-800 dark:bg-white/[0.02]"
                                        >
                                            <div className="min-w-0">
                                                <div className="truncate text-xs font-bold text-gray-800 dark:text-gray-200">
                                                    {row.value}
                                                </div>
                                                <div className="text-[9px] text-gray-400 font-semibold">
                                                    Standard Default
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleSaveValue(activeGroupData.group.type, row.value)}
                                                disabled={savingType === activeGroupData.group.type}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 hover:bg-blue-100 text-[11px] font-bold transition-all shrink-0"
                                            >
                                                <Plus size={12} />
                                                <span>Save</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Empty State */}
                        {filteredSaved.length === 0 && filteredDiscovered.length === 0 && filteredDefaults.length === 0 && (
                            <div className="p-8 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-gray-400">
                                <div className="text-xs font-semibold">
                                    {searchQuery ? `No values matching "${searchQuery}"` : 'No values configured yet for this category.'}
                                </div>
                                <p className="text-[11px] text-gray-400 mt-1">Use the input above to create a new option.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ItemSetupManagement;
