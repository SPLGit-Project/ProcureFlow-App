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
    itemField?: ItemField;
    icon: React.ElementType;
    defaults?: string[];
}

const TAXONOMY_GROUPS: SetupGroup[] = [
    { type: 'POOL', label: 'Pools', itemField: 'itemPool', icon: Layers },
    { type: 'CATALOG', label: 'Catalogues', itemField: 'itemCatalog', icon: BookOpen },
    { type: 'TYPE', label: 'Types', itemField: 'itemType', icon: Tag },
    { type: 'CATEGORY', label: 'Categories', itemField: 'category', icon: FolderTree },
    { type: 'SUB_CATEGORY', label: 'Sub-categories', itemField: 'subCategory', icon: ListChecks },
    { type: 'UOM', label: 'Units of measure', itemField: 'uom', icon: Database }
];

// Workflow dropdowns (request form options)
const WORKFLOW_DROPDOWN_TYPES: AttributeType[] = [
    'PREVIEW_REQUEST_TYPE', 'PREVIEW_DEPARTMENT', 'PREVIEW_BUSINESS_UNIT',
    'PREVIEW_BUSINESS_REASON', 'PREVIEW_PRICE_TYPE', 'PREVIEW_TAX_CODE'
];

const WORKFLOW_GROUPS: SetupGroup[] = ITEM_PREVIEW_OPTION_GROUPS
    .filter(group => WORKFLOW_DROPDOWN_TYPES.includes(group.type as AttributeType))
    .map(group => ({
        type: group.type,
        label: group.label,
        icon: ListChecks,
        defaults: group.defaults
    }));

// Item creation reference data (commercial + financial)
const ITEM_CREATION_REF_TYPES: AttributeType[] = [
    'PREVIEW_CUSTOMER_PRICING_GROUP', 'PREVIEW_SAP_MAPPING', 'PREVIEW_SUPPLIER_EXT'
];

const ITEM_CREATION_GROUPS: SetupGroup[] = ITEM_PREVIEW_OPTION_GROUPS
    .filter(group => ITEM_CREATION_REF_TYPES.includes(group.type as AttributeType))
    .map(group => ({
        type: group.type,
        label: group.label,
        icon: group.type === 'PREVIEW_SAP_MAPPING' ? DollarSign
            : group.type === 'PREVIEW_CUSTOMER_PRICING_GROUP' ? Tag
            : Database,
        defaults: group.defaults
    }));

const normalizeValue = (value: unknown) => String(value || '').trim();

const ItemSetupManagement = ({ options, items, upsertOption, deleteOption }: ItemSetupManagementProps) => {
    const { success, error } = useToast();
    const [activeSection, setActiveSection] = useState<'TAXONOMY' | 'DROPDOWNS' | 'ITEM_CREATION'>('TAXONOMY');
    const [draftValues, setDraftValues] = useState<Record<string, string>>({});
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

    const stats = useMemo(() => {
        const savedTaxonomy = taxonomyRows.reduce((sum, row) => sum + row.saved.length, 0);
        const discoveredTaxonomy = taxonomyRows.reduce((sum, row) => sum + row.discovered.length, 0);
        const savedDropdowns = dropdownRows.reduce((sum, row) => sum + row.saved.length, 0);
        const savedItemCreation = itemCreationRows.reduce((sum, row) => sum + row.saved.length, 0);
        return { savedTaxonomy, discoveredTaxonomy, savedDropdowns, savedItemCreation };
    }, [dropdownRows, taxonomyRows, itemCreationRows]);

    const handleAdd = async (type: AttributeType) => {
        const value = normalizeValue(draftValues[type]);
        if (!value) return;
        setSavingType(type);
        try {
            await upsertOption({ type, value, activeFlag: true });
            setDraftValues(prev => ({ ...prev, [type]: '' }));
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

    const renderSavedOption = (option: AttributeOption) => (
        <div key={option.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-800 dark:bg-[#15171e]">
            {editing?.id === option.id ? (
                <input
                    className="input-field py-2"
                    value={editValue}
                    onChange={event => setEditValue(event.target.value)}
                />
            ) : (
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{option.value}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">Saved</div>
                </div>
            )}

            <div className="flex shrink-0 gap-1">
                {editing?.id === option.id ? (
                    <>
                        <button type="button" onClick={handleUpdate} disabled={savingType === option.type} className="icon-btn-blue" title="Save"><Check size={15} /></button>
                        <button type="button" onClick={() => setEditing(null)} className="icon-btn-red" title="Cancel"><X size={15} /></button>
                    </>
                ) : (
                    <>
                        <button type="button" onClick={() => { setEditing(option); setEditValue(option.value); }} className="icon-btn-blue" title="Edit"><Edit2 size={15} /></button>
                        <button type="button" onClick={() => handleDelete(option)} className="icon-btn-red" title="Remove"><Trash2 size={15} /></button>
                    </>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.03]">
                    <div className="text-xs font-bold uppercase text-gray-500">Saved taxonomy</div>
                    <div className="mt-1 text-2xl font-black text-gray-900 dark:text-white">{stats.savedTaxonomy}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.03]">
                    <div className="text-xs font-bold uppercase text-gray-500">Found in items</div>
                    <div className="mt-1 text-2xl font-black text-gray-900 dark:text-white">{stats.discoveredTaxonomy}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.03]">
                    <div className="text-xs font-bold uppercase text-gray-500">Saved dropdowns</div>
                    <div className="mt-1 text-2xl font-black text-gray-900 dark:text-white">{stats.savedDropdowns}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.03]">
                    <div className="text-xs font-bold uppercase text-gray-500">Item creation ref</div>
                    <div className="mt-1 text-2xl font-black text-gray-900 dark:text-white">{stats.savedItemCreation}</div>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800">
                {[
                    { id: 'TAXONOMY', label: 'Item categorisation', icon: FolderTree },
                    { id: 'DROPDOWNS', label: 'Shared dropdowns', icon: ListChecks },
                    { id: 'ITEM_CREATION', label: 'Item creation reference', icon: FlaskConical }
                ].map(section => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    return (
                        <button
                            key={section.id}
                            type="button"
                            onClick={() => setActiveSection(section.id as 'TAXONOMY' | 'DROPDOWNS' | 'ITEM_CREATION')}
                            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
                                isActive
                                    ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            <Icon size={16} /> {section.label}
                        </button>
                    );
                })}
            </div>

            {activeSection === 'TAXONOMY' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {taxonomyRows.map(({ group, saved, discovered }) => {
                        const Icon = group.icon;
                        const isSaving = savingType === group.type;
                        return (
                            <div key={group.type} className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-white/[0.03]">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                                            <Icon size={18} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white">{group.label}</h3>
                                            <div className="text-xs text-gray-500">{saved.length} saved, {discovered.length} found in items</div>
                                        </div>
                                    </div>
                                    {discovered.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => handleSaveAll(group.type, discovered.map(row => row.value))}
                                            disabled={isSaving}
                                            className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300"
                                        >
                                            Save found
                                        </button>
                                    )}
                                </div>

                                <div className="mt-4 flex gap-2">
                                    <input
                                        className="input-field"
                                        value={draftValues[group.type] || ''}
                                        onChange={event => setDraftValues(prev => ({ ...prev, [group.type]: event.target.value }))}
                                        placeholder={`Add ${group.label.toLowerCase()}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleAdd(group.type)}
                                        disabled={isSaving || !normalizeValue(draftValues[group.type])}
                                        className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                                    >
                                        <Plus size={16} /> Add
                                    </button>
                                </div>

                                <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                                    {saved.map(renderSavedOption)}
                                    {discovered.map(row => (
                                        <div key={`${group.type}-${row.value}`} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-500/20 dark:bg-amber-500/10">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{row.value}</div>
                                                <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">{row.itemCount} item{row.itemCount === 1 ? '' : 's'} using this</div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleSaveValue(group.type, row.value)}
                                                disabled={isSaving}
                                                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                                            >
                                                <Save size={13} /> Save
                                            </button>
                                        </div>
                                    ))}
                                    {saved.length === 0 && discovered.length === 0 && (
                                        <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700">
                                            No values found yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {activeSection === 'ITEM_CREATION' && (
                <div className="space-y-4">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/10 p-4">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                            These reference values are used by the Item Creation workflow for commercial and financial classification. They drive customer pricing groups, SAP GL mapping, and supplier tier classification on item requests.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {itemCreationRows.map(({ group, saved, defaultOnly }) => {
                            const Icon = group.icon;
                            const isSaving = savingType === group.type;
                            return (
                                <div key={group.type} className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-white/[0.03]">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-lg bg-purple-50 p-2 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300">
                                                <Icon size={18} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 dark:text-white">{group.label}</h3>
                                                <div className="text-xs text-gray-500">{saved.length > 0 ? `${saved.length} saved values` : 'Using fallback defaults'}</div>
                                            </div>
                                        </div>
                                        {defaultOnly.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handleSaveAll(group.type, defaultOnly.map(row => row.value))}
                                                disabled={isSaving}
                                                className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300"
                                            >
                                                Save defaults
                                            </button>
                                        )}
                                    </div>

                                    <div className="mt-4 flex gap-2">
                                        <input
                                            className="input-field"
                                            value={draftValues[group.type] || ''}
                                            onChange={event => setDraftValues(prev => ({ ...prev, [group.type]: event.target.value }))}
                                            placeholder={`Add ${group.label.toLowerCase()}`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleAdd(group.type)}
                                            disabled={isSaving || !normalizeValue(draftValues[group.type])}
                                            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                                        >
                                            <Plus size={16} /> Add
                                        </button>
                                    </div>

                                    <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                                        {saved.map(renderSavedOption)}
                                        {defaultOnly.map(row => (
                                            <div key={`${group.type}-${row.value}`} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-800 dark:bg-[#15171e]">
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{row.value}</div>
                                                    <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Fallback active</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveValue(group.type, row.value)}
                                                    disabled={isSaving}
                                                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
                                                >
                                                    <Save size={13} /> Save
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeSection === 'DROPDOWNS' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {dropdownRows.map(({ group, saved, defaultOnly }) => {
                        const isSaving = savingType === group.type;
                        return (
                            <div key={group.type} className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-white/[0.03]">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white">{group.label}</h3>
                                        <div className="text-xs text-gray-500">{saved.length > 0 ? `${saved.length} saved options` : 'Using fallback defaults'}</div>
                                    </div>
                                    {defaultOnly.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => handleSaveAll(group.type, defaultOnly.map(row => row.value))}
                                            disabled={isSaving}
                                            className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300"
                                        >
                                            Save defaults
                                        </button>
                                    )}
                                </div>

                                <div className="mt-4 flex gap-2">
                                    <input
                                        className="input-field"
                                        value={draftValues[group.type] || ''}
                                        onChange={event => setDraftValues(prev => ({ ...prev, [group.type]: event.target.value }))}
                                        placeholder={`Add ${group.label.toLowerCase()}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleAdd(group.type)}
                                        disabled={isSaving || !normalizeValue(draftValues[group.type])}
                                        className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                                    >
                                        <Plus size={16} /> Add
                                    </button>
                                </div>

                                <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                                    {saved.map(renderSavedOption)}
                                    {defaultOnly.map(row => (
                                        <div key={`${group.type}-${row.value}`} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-800 dark:bg-[#15171e]">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{row.value}</div>
                                                <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{saved.length > 0 ? 'Default not saved' : 'Fallback active'}</div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleSaveValue(group.type, row.value)}
                                                disabled={isSaving}
                                                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
                                            >
                                                <Save size={13} /> Save
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ItemSetupManagement;
