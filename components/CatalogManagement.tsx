
import React, { useState, useMemo } from 'react';
import { AttributeOption, AttributeType } from '../types';
import { 
    Plus, Edit2, Trash2, FolderTree, Tag, Layers, 
    BookOpen, Scale, AlertTriangle, Save, X, 
    Network, List as ListIcon, ChevronRight, Check,
    Search, Filter, ArrowRightLeft
} from 'lucide-react';
import { useToast } from './ToastNotification';

interface CatalogManagementProps {
    options: AttributeOption[];
    upsertOption: (option: Partial<AttributeOption>) => Promise<void>;
    deleteOption: (id: string) => Promise<void>;
}

const TABS: { id: AttributeType, label: string, icon: any }[] = [
    { id: 'CATEGORY', label: 'Categories', icon: FolderTree },
    { id: 'SUB_CATEGORY', label: 'Sub Categories', icon: Tag },
    { id: 'POOL', label: 'Item Pools', icon: Layers },
    { id: 'CATALOG', label: 'Catalogs', icon: BookOpen },
    { id: 'UOM', label: 'Units of Measure', icon: Scale },
];

type ViewMode = 'LIST' | 'RELATIONSHIPS';

const CatalogManagement: React.FC<CatalogManagementProps> = ({ 
    options = [], 
    upsertOption, 
    deleteOption 
}) => {
    const safeOptions = Array.isArray(options) ? options : [];
    const { success, error } = useToast();
    const [activeTab, setActiveTab] = useState<AttributeType>('CATEGORY');
    const [viewMode, setViewMode] = useState<ViewMode>('LIST');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOption, setEditingOption] = useState<AttributeOption | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Form State
    const [value, setValue] = useState('');
    const [selectedParentIds, setSelectedParentIds] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Relationship View State
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

    // Data Filtering
    const categories = useMemo(() => safeOptions.filter(o => o.type === 'CATEGORY'), [safeOptions]);
    const currentTabOptions = useMemo(() => 
        safeOptions.filter(o => o.type === activeTab)
        .filter(o => o.value.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a,b) => a.value.localeCompare(b.value))
    , [safeOptions, activeTab, searchQuery]);

    const handleOpenModal = (option?: AttributeOption) => {
        if (option) {
            setEditingOption(option);
            setValue(option.value);
            setSelectedParentIds(option.parentIds || (option.parentId ? [option.parentId] : []));
        } else {
            setEditingOption(null);
            setValue('');
            setSelectedParentIds([]);
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!value.trim()) return;
        setIsSaving(true);
        try {
            await upsertOption({
                id: editingOption?.id,
                type: activeTab,
                value: value.trim(),
                parentIds: activeTab === 'SUB_CATEGORY' ? selectedParentIds : [],
                // Keep parentId for backward compatibility if needed, using the first one
                parentId: (activeTab === 'SUB_CATEGORY' && selectedParentIds.length > 0) ? selectedParentIds[0] : undefined,
                activeFlag: true
            });
            success(`${activeTab} saved successfully`);
            setIsModalOpen(false);
        } catch (err: any) {
            error('Failed to save: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this option?')) {
            try {
                await deleteOption(id);
                success('Option deleted successfully');
            } catch (err: any) {
                error('Failed to delete: ' + err.message);
            }
        }
    };

    const toggleParentSelection = (id: string) => {
        setSelectedParentIds(prev => 
            prev.includes(id) 
                ? prev.filter(p => p !== id) 
                : [...prev, id]
        );
    };

    // Relationship Mode Helpers
    const filteredSubCategories = useMemo(() => {
        if (!selectedCategoryId) return [];
        return safeOptions.filter(o => 
            o.type === 'SUB_CATEGORY' && 
            (o.parentIds?.includes(selectedCategoryId) || o.parentId === selectedCategoryId)
        );
    }, [selectedCategoryId, safeOptions]);

    return (
        <div className="space-y-6">
            {/* Header / Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-1">
                <div className="flex space-x-2 overflow-x-auto pb-1 no-scrollbar">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    if (tab.id !== 'SUB_CATEGORY' && tab.id !== 'CATEGORY') setViewMode('LIST');
                                }}
                                className={`flex items-center space-x-2 px-4 py-2 rounded-t-lg transition-all duration-200 whitespace-nowrap border-b-2 font-medium ${
                                    activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                            >
                                <Icon size={18} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {(activeTab === 'SUB_CATEGORY' || activeTab === 'CATEGORY') && (
                    <div className="flex items-center bg-gray-100 dark:bg-[#2b2d31] p-1 rounded-lg">
                        <button 
                            onClick={() => setViewMode('LIST')}
                            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                viewMode === 'LIST' 
                                    ? 'bg-white dark:bg-[#383a40] text-blue-600 dark:text-blue-400 shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <ListIcon size={16} />
                            <span>List View</span>
                        </button>
                        <button 
                            onClick={() => setViewMode('RELATIONSHIPS')}
                            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                viewMode === 'RELATIONSHIPS' 
                                    ? 'bg-white dark:bg-[#383a40] text-blue-600 dark:text-blue-400 shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Network size={16} />
                            <span>Relationship View</span>
                        </button>
                    </div>
                )}
            </div>

            {/* List View */}
            {viewMode === 'LIST' ? (
                <div className="bg-white dark:bg-[#1e2029] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50 dark:bg-gray-800/30">
                        <div className="relative w-full md:w-72">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input 
                                type="text"
                                placeholder={`Search ${TABS.find(t => t.id === activeTab)?.label}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1c23] outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            onClick={() => handleOpenModal()}
                            className="w-full md:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-transform active:scale-95 text-sm font-medium shadow-sm"
                        >
                            <Plus size={18} />
                            <span>Add New</span>
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50/80 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 uppercase text-xs font-semibold">
                                <tr>
                                    <th className="px-6 py-4">Value</th>
                                    {activeTab === 'SUB_CATEGORY' && <th className="px-6 py-4">Parent Categories</th>}
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {currentTabOptions.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-12 text-center text-gray-400 italic">
                                            No options found matching your criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    currentTabOptions.map(opt => {
                                        const parentLabels = categories.filter(c => 
                                            opt.parentIds?.includes(c.id) || opt.parentId === c.id
                                        ).map(c => c.value);

                                        return (
                                            <tr key={opt.id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <span className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                        {opt.value}
                                                    </span>
                                                </td>
                                                {activeTab === 'SUB_CATEGORY' && (
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {parentLabels.length > 0 ? (
                                                                parentLabels.map((lbl, idx) => (
                                                                    <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100/50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                                                                        {lbl}
                                                                    </span>
                                                                ))
                                                            ) : (
                                                                <span className="text-gray-400 text-xs flex items-center gap-1">
                                                                    <AlertTriangle size={12} className="text-amber-500" />
                                                                    No Parent Assigned
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end items-center opacity-0 group-hover:opacity-100 transition-opacity space-x-1">
                                                        <button
                                                            onClick={() => handleOpenModal(opt)}
                                                            className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(opt.id)}
                                                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400 transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* Relationship View (Workflow Design) */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[600px]">
                    {/* Categories Column */}
                    <div className="lg:col-span-4 bg-white dark:bg-[#1e2029] rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
                            <h4 className="text-sm font-bold uppercase text-gray-500 flex items-center gap-2">
                                <FolderTree size={16} className="text-blue-500" />
                                Parent Categories
                            </h4>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                                        selectedCategoryId === cat.id
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    <span className="font-medium">{cat.value}</span>
                                    {selectedCategoryId === cat.id ? (
                                        <ChevronRight size={18} />
                                    ) : (
                                        <span className="text-xs opacity-50 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                                            {safeOptions.filter(o => o.type === 'SUB_CATEGORY' && (o.parentIds?.includes(cat.id) || o.parentId === cat.id)).length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sub-Category Association Flow */}
                    <div className="lg:col-span-8 bg-white dark:bg-[#1e2029] rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden shadow-sm">
                        {selectedCategoryId ? (
                            <>
                                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 flex justify-between items-center">
                                    <div className="flex items-center space-x-3 text-gray-800 dark:text-white">
                                        <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-md">
                                            {categories.find(c => c.id === selectedCategoryId)?.value}
                                        </span>
                                        <ArrowRightLeft size={16} className="text-gray-400" />
                                        <h4 className="text-sm font-bold uppercase text-gray-500">Associated Sub-Categories</h4>
                                    </div>
                                    <button 
                                        onClick={() => handleOpenModal()} 
                                        className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1"
                                    >
                                        <Plus size={14} /> Create New linked Sub-Category
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar">
                                    {filteredSubCategories.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
                                            <Tag size={48} className="text-gray-300 mb-4" />
                                            <p className="text-gray-500 dark:text-gray-400 max-w-xs">
                                                No sub-categories are currently associated with this parent. 
                                                You can link them via the List View or create a new one.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {filteredSubCategories.map(sub => (
                                                <div 
                                                    key={sub.id} 
                                                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#181a21] hover:border-blue-500 transition-all flex items-center justify-between group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                                            <Tag size={16} className="text-blue-600 dark:text-blue-400" />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-gray-900 dark:text-white">{sub.value}</p>
                                                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                                                                Linked to {sub.parentIds?.length || (sub.parentId ? 1 : 0)} parents
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleOpenModal(sub)}
                                                        className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Edit2 size={16}/>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-gray-50/30 dark:bg-black/10">
                                <ArrowRightLeft size={64} className="text-gray-200 dark:text-gray-800 mb-6" />
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Relationship Explorer</h3>
                                <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                                    Select a category from the left to visualize and manage its sub-category connections.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-300">
                        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50/80 dark:bg-gray-800/80">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-500/20">
                                    {editingOption ? <Edit2 size={20} /> : <Plus size={20} />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">
                                        {editingOption ? `Edit ${TABS.find(t => t.id === activeTab)?.label.slice(0, -1)}` : `New ${TABS.find(t => t.id === activeTab)?.label.slice(0, -1)}`}
                                    </h3>
                                    <p className="text-xs text-gray-500 font-medium tracking-tight">Manage catalog attributes</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-200/50 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                                    Name / Value
                                </label>
                                <input
                                    type="text"
                                    value={value}
                                    onChange={e => setValue(e.target.value)}
                                    placeholder={`Enter ${activeTab.toLowerCase()} name...`}
                                    className="w-full px-4 py-3 text-lg font-medium border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#1a1c23] text-gray-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                                    autoFocus
                                />
                            </div>

                            {activeTab === 'SUB_CATEGORY' && (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            Parent Category Associations
                                        </label>
                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded uppercase">
                                            {selectedParentIds.length} Selected
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-4 bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-200 dark:border-gray-800 custom-scrollbar">
                                        {categories.map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => toggleParentSelection(cat.id)}
                                                className={`flex items-center space-x-2 p-2.5 rounded-lg text-sm text-left transition-all ${
                                                    selectedParentIds.includes(cat.id)
                                                        ? 'bg-blue-600 text-white shadow-md'
                                                        : 'bg-white dark:bg-[#1a1c23] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                                                }`}
                                            >
                                                <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                                                    selectedParentIds.includes(cat.id) ? 'bg-white border-white' : 'border-gray-400'
                                                }`}>
                                                    {selectedParentIds.includes(cat.id) && <Check size={12} className="text-blue-600 font-bold" />}
                                                </div>
                                                <span className="truncate font-medium">{cat.value}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-gray-400 text-center italic">
                                        Tip: You can associate this sub-category with multiple parent categories.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="px-8 py-5 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3 bg-gray-50/80 dark:bg-gray-800/80">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !value.trim() || (activeTab === 'SUB_CATEGORY' && selectedParentIds.length === 0)}
                                className="flex items-center space-x-2 px-8 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 active:scale-95"
                            >
                                {isSaving ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save size={18} />
                                )}
                                <span>{editingOption ? 'Update Attribute' : 'Create Attribute'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); }
            `}} />
        </div>
    );
};

export default CatalogManagement;
