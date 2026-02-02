
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AttributeOption, AttributeType } from '../types';
import { 
    Plus, Edit2, Trash2, FolderTree, Tag, Layers, 
    BookOpen, Scale, AlertTriangle, Save, X, 
    Network, List as ListIcon, ChevronRight, Check,
    Search, Filter, ArrowRightLeft, Maximize2, Minimize2,
    Move, MousePointer2
} from 'lucide-react';
import { useToast } from './ToastNotification';

interface CatalogManagementProps {
    options: AttributeOption[];
    upsertOption: (option: Partial<AttributeOption>) => Promise<void>;
    deleteOption: (id: string) => Promise<void>;
}

// Grouping related attributes for better UX
const GROUPED_TABS: { id: string, label: string, icon: any, types: AttributeType[] }[] = [
    { id: 'TAXONOMY', label: 'Taxonomy', icon: Network, types: ['CATEGORY', 'SUB_CATEGORY'] },
    { id: 'POOL', label: 'Item Pools', icon: Layers, types: ['POOL'] },
    { id: 'CATALOG', label: 'Catalogs', icon: BookOpen, types: ['CATALOG'] },
    { id: 'UOM', label: 'Units of Measure', icon: Scale, types: ['UOM'] },
];

type ViewMode = 'LIST' | 'TAXONOMY' | 'MIND_MAP';

const CatalogManagement: React.FC<CatalogManagementProps> = ({ 
    options = [], 
    upsertOption, 
    deleteOption 
}) => {
    const safeOptions = Array.isArray(options) ? options : [];
    const { success, error } = useToast();
    const [activeTabId, setActiveTabId] = useState('TAXONOMY');
    const [viewMode, setViewMode] = useState<ViewMode>('TAXONOMY');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOption, setEditingOption] = useState<AttributeOption | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

    // Form State
    const [value, setValue] = useState('');
    const [selectedType, setSelectedType] = useState<AttributeType>('CATEGORY');
    const [selectedParentIds, setSelectedParentIds] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Mind Map Zoom/Pan State
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    // Data Filtering
    const allCategories = useMemo(() => safeOptions.filter(o => o.type === 'CATEGORY').sort((a,b) => a.value.localeCompare(b.value)), [safeOptions]);
    const allSubCategories = useMemo(() => safeOptions.filter(o => o.type === 'SUB_CATEGORY').sort((a,b) => a.value.localeCompare(b.value)), [safeOptions]);
    
    // Auto-select first category if in Taxonomy view and none selected
    useEffect(() => {
        if (viewMode === 'TAXONOMY' && allCategories.length > 0 && !selectedParentId) {
            setSelectedParentId(allCategories[0].id);
        }
    }, [viewMode, allCategories, selectedParentId]);

    const filteredOptions = useMemo(() => {
        const types = GROUPED_TABS.find(t => t.id === activeTabId)?.types || [];
        return safeOptions.filter(o => types.includes(o.type))
            .filter(o => o.value.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a,b) => a.value.localeCompare(b.value));
    }, [safeOptions, activeTabId, searchQuery]);

    const handleOpenModal = (option?: AttributeOption, forcedType?: AttributeType) => {
        if (option) {
            setEditingOption(option);
            setValue(option.value);
            setSelectedType(option.type);
            setSelectedParentIds(option.parentIds || (option.parentId ? [option.parentId] : []));
        } else {
            setEditingOption(null);
            setValue('');
            setSelectedType(forcedType || (activeTabId === 'TAXONOMY' ? 'CATEGORY' : activeTabId as AttributeType));
            setSelectedParentIds(forcedType === 'SUB_CATEGORY' && selectedParentId ? [selectedParentId] : []);
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!value.trim()) return;
        setIsSaving(true);
        try {
            await upsertOption({
                id: editingOption?.id,
                type: selectedType,
                value: value.trim(),
                parentIds: selectedType === 'SUB_CATEGORY' ? selectedParentIds : [],
                activeFlag: true
            });
            success(`${selectedType} saved successfully`);
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
                if (selectedParentId === id) setSelectedParentId(null);
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

    // Sub-Categories for selected parent
    const associatedSubCategories = useMemo(() => {
        if (!selectedParentId) return [];
        return allSubCategories.filter(s => s.parentIds?.includes(selectedParentId) || s.parentId === selectedParentId);
    }, [selectedParentId, allSubCategories]);

    // Mind Map Layout Logic (Horizontal Hierarchy / Decomposition Tree)
    const mindMapData = useMemo(() => {
        const nodes: any[] = [];
        const links: any[] = [];
        
        const cardWidth = 240;
        const cardHeight = 80;
        const columnGap = 120;
        const rowGap = 30;

        // 1. Root Node (leftmost)
        nodes.push({ 
            id: 'root', 
            label: 'Product Catalog', 
            type: 'ROOT', 
            x: 0, 
            y: 0,
            width: cardWidth,
            height: cardHeight
        });

        // 2. Category Nodes (center)
        const totalCatHeight = allCategories.length * (cardHeight + rowGap);
        const startY = -(totalCatHeight / 2) + (cardHeight / 2);

        allCategories.forEach((cat, i) => {
            const cx = cardWidth + columnGap;
            const cy = startY + (i * (cardHeight + rowGap));
            
            nodes.push({ 
                ...cat, 
                x: cx, 
                y: cy, 
                width: cardWidth, 
                height: cardHeight 
            });
            links.push({ source: 'root', target: cat.id });

            // 3. Sub-Category Nodes (rightside)
            const subs = allSubCategories.filter(s => s.parentIds?.includes(cat.id) || s.parentId === cat.id);
            const subColumnX = cx + cardWidth + columnGap;
            
            subs.forEach((sub, si) => {
                // To avoid overlap, we might need a more complex offset, 
                // but for now let's stack them relative to parent
                const sy = cy + ((si - (subs.length - 1) / 2) * (cardHeight / 2 + 10));
                
                // Only add node if not already added OR handle multi-parent x/y?
                // For "Tree" style, we usually duplicate the node or link back.
                // Multi-parent nodes in a tree usually repeat or have multiple links.
                // Let's create unique instances for the visual tree to keep it "tree-like"
                const instanceId = `${cat.id}-${sub.id}`;
                nodes.push({ 
                    ...sub, 
                    id: instanceId,
                    originalId: sub.id,
                    x: subColumnX, 
                    y: sy,
                    width: cardWidth * 0.8,
                    height: cardHeight * 0.7
                });
                links.push({ source: cat.id, target: instanceId });
            });
        });

        return { nodes, links };
    }, [allCategories, allSubCategories]);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setOffset({
            x: e.clientX - dragStart.current.x,
            y: e.clientY - dragStart.current.y
        });
    };

    const handleMouseUp = () => setIsDragging(false);
    const handleWheel = (e: React.WheelEvent) => {
        const newScale = Math.min(Math.max(scale - e.deltaY * 0.001, 0.2), 3);
        setScale(newScale);
    };

    // Helper for Bézier curve paths
    const getCurvePath = (sX: number, sY: number, tX: number, tY: number) => {
        const midX = (sX + tX) / 2;
        return `M ${sX} ${sY} C ${midX} ${sY}, ${midX} ${tY}, ${tX} ${tY}`;
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Header & Main Nav */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-2">
                <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
                    {GROUPED_TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTabId === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTabId(tab.id);
                                    if (tab.id === 'TAXONOMY') setViewMode('TAXONOMY');
                                    else setViewMode('LIST');
                                }}
                                className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl transition-all duration-300 font-bold text-sm ${
                                    isActive
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 -translate-y-0.5'
                                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                                }`}
                            >
                                <Icon size={18} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center bg-gray-100 dark:bg-gray-800/50 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <button 
                        onClick={() => setViewMode(activeTabId === 'TAXONOMY' ? 'TAXONOMY' : 'LIST')}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            viewMode !== 'MIND_MAP' 
                                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xl' 
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
                        }`}
                    >
                        {activeTabId === 'TAXONOMY' ? <Network size={16} /> : <ListIcon size={16} />}
                        <span>{activeTabId === 'TAXONOMY' ? 'Hierarchy Tree' : 'List View'}</span>
                    </button>
                    <button 
                        onClick={() => setViewMode('MIND_MAP')}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            viewMode === 'MIND_MAP' 
                                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xl' 
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
                        }`}
                    >
                        <Maximize2 size={16} />
                        <span>Visual Map</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-h-[600px] flex flex-col">
                {viewMode === 'TAXONOMY' ? (
                    /* UINFINED TAXONOMY VIEW (Split Perspective) */
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
                        {/* Parent Categories Pane */}
                        <div className="lg:col-span-4 flex flex-col bg-white dark:bg-[#1e2029] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden group">
                           <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex justify-between items-center bg-gradient-to-r from-blue-50/20 to-transparent dark:from-blue-900/10 dark:to-transparent">
                                <div>
                                    <h4 className="text-sm font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center gap-2">
                                        <FolderTree size={16} />
                                        Categories
                                    </h4>
                                    <p className="text-[10px] text-gray-500 font-bold mt-1">Manage top-level classification</p>
                                </div>
                                <button 
                                    onClick={() => handleOpenModal(undefined, 'CATEGORY')}
                                    className="p-2 bg-blue-600 text-white rounded-xl hover:scale-110 active:scale-95 transition-all shadow-md"
                                >
                                    <Plus size={18} />
                                </button>
                           </div>
                           <div className="p-4 bg-white dark:bg-[#1a1c23]/50">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input 
                                        type="text"
                                        placeholder="Search categories..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0f1115] outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                                    />
                                </div>
                           </div>
                           <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                                {allCategories.filter(c => c.value.toLowerCase().includes(searchQuery.toLowerCase())).map(cat => (
                                    <div 
                                        key={cat.id} 
                                        onClick={() => setSelectedParentId(cat.id)}
                                        className={`group/item relative flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all duration-300 border ${
                                            selectedParentId === cat.id
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-500/20 -translate-y-0.5'
                                                : 'bg-white dark:bg-[#252833] border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 text-sm">
                                            <div className={`p-2 rounded-xl border transition-colors ${selectedParentId === cat.id ? 'bg-white/20 border-white/30' : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                                                <FolderTree size={16} className={selectedParentId === cat.id ? 'text-white' : 'text-blue-500'} />
                                            </div>
                                            <span className="font-bold tracking-tight">{cat.value}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${selectedParentId === cat.id ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                                {allSubCategories.filter(s => s.parentIds?.includes(cat.id) || s.parentId === cat.id).length}
                                            </span>
                                            {selectedParentId === cat.id ? (
                                                <ChevronRight size={18} />
                                            ) : (
                                                <div className="opacity-0 group-hover/item:opacity-100 flex items-center gap-1 transition-all">
                                                    <button onClick={(e) => { e.stopPropagation(); handleOpenModal(cat); }} className="p-1 hover:text-blue-500"><Edit2 size={12}/></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(cat.id); }} className="p-1 hover:text-red-500"><Trash2 size={12}/></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                           </div>
                        </div>

                        {/* Associated Sub-Categories Pane */}
                        <div className="lg:col-span-8 flex flex-col bg-white dark:bg-[#1e2029] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
                           {selectedParentId ? (
                               <>
                                <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20">
                                            <FolderTree size={14} />
                                            <span className="text-xs font-black uppercase tracking-wider">{allCategories.find(c => c.id === selectedParentId)?.value}</span>
                                        </div>
                                        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-2" />
                                        <h4 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                            <Tag size={16} />
                                            Sub-Categories
                                        </h4>
                                    </div>
                                    <button 
                                        onClick={() => handleOpenModal(undefined, 'SUB_CATEGORY')}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-black hover:bg-blue-100 transition-all border border-blue-200 dark:border-blue-800"
                                    >
                                        <Plus size={16} /> Add Link
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/30 dark:bg-black/20">
                                    {associatedSubCategories.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-6">
                                            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center border-4 border-dashed border-gray-200 dark:border-gray-700">
                                                <Tag size={40} className="text-gray-300 dark:text-gray-600" />
                                            </div>
                                            <div className="max-w-xs">
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">No associations yet</h3>
                                                <p className="text-sm text-gray-500 mt-2 font-medium">Link existng sub-categories or create new ones for this category.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {associatedSubCategories.map(sub => (
                                                <div 
                                                    key={sub.id} 
                                                    className="group/sub relative p-5 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#252833] hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 flex items-center justify-between"
                                                >
                                                    <div className="flex items-center gap-4 overflow-hidden">
                                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl group-hover/sub:scale-110 transition-transform flex-shrink-0">
                                                            <Tag size={18} className="text-blue-600 dark:text-blue-400" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-black text-gray-900 dark:text-white tracking-tight truncate">{sub.value}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[9px] font-black uppercase text-gray-400 tracking-tighter">Parents:</span>
                                                                <div className="flex -space-x-1">
                                                                    {(sub.parentIds || []).slice(0, 3).map((pid, idx) => {
                                                                        const p = allCategories.find(c => c.id === pid);
                                                                        return p ? (
                                                                            <div key={idx} title={p.value} className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900 border border-white dark:border-gray-800 flex items-center justify-center text-[8px] font-bold text-blue-600">
                                                                                {p.value.charAt(0)}
                                                                            </div>
                                                                        ) : null;
                                                                    })}
                                                                    {(sub.parentIds?.length || 0) > 3 && (
                                                                        <div className="w-4 h-4 rounded-full bg-gray-100 dark:bg-gray-800 border border-white dark:border-gray-800 flex items-center justify-center text-[8px] font-bold text-gray-500">
                                                                            +{(sub.parentIds?.length || 0) - 3}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity translate-x-2 group-hover/sub:translate-x-0 ml-4 flex-shrink-0">
                                                        <button onClick={() => handleOpenModal(sub)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors"><Edit2 size={14}/></button>
                                                        <button onClick={() => handleDelete(sub.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"><Trash2 size={14}/></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                               </>
                           ) : (
                               <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-gray-50/20 dark:bg-black/10">
                                    <Network size={64} className="text-gray-200 dark:text-gray-800 mb-6 animate-pulse" />
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-widest">Select a Category</h3>
                                    <p className="text-gray-500 dark:text-gray-400 max-w-sm font-medium">Choose a category from the left to manage its hierarchical connections and properties.</p>
                               </div>
                           )}
                        </div>
                    </div>
                ) : viewMode === 'LIST' ? (
                    /* TRADITIONAL LIST VIEW (For non-taxonomy types) */
                    <div className="flex-1 bg-white dark:bg-[#1e2029] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-6 bg-gray-50/50 dark:bg-gray-800/30">
                            <div className="relative w-full md:w-96">
                                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input 
                                    type="text"
                                    placeholder={`Search ${GROUPED_TABS.find(t => t.id === activeTabId)?.label}...`}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1c23] outline-none focus:ring-4 focus:ring-blue-500/10 font-bold tracking-tight"
                                />
                            </div>
                            <button
                                onClick={() => handleOpenModal()}
                                className="w-full md:w-auto flex items-center justify-center space-x-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all shadow-lg shadow-blue-500/30 font-black uppercase text-xs tracking-widest active:scale-95"
                            >
                                <Plus size={18} />
                                <span>Add New</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 z-10 bg-gray-50/90 dark:bg-gray-800/90 backdrop-blur-md text-gray-500 uppercase text-[10px] font-black tracking-widest">
                                    <tr>
                                        <th className="px-8 py-5">Attribute Value</th>
                                        <th className="px-8 py-5">Type</th>
                                        <th className="px-8 py-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {filteredOptions.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-8 py-20 text-center text-gray-400 italic font-medium">No results found for this selection.</td>
                                        </tr>
                                    ) : (
                                        filteredOptions.map(opt => (
                                            <tr key={opt.id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/5 transition-all">
                                                <td className="px-8 py-5">
                                                    <span className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 inline-block transition-transform group-hover:translate-x-1">
                                                        {opt.value}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-[10px] font-black uppercase tracking-tighter text-gray-500">{opt.type}</span>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => handleOpenModal(opt)} className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-xl text-blue-600 transition-all"><Edit2 size={16} /></button>
                                                        <button onClick={() => handleDelete(opt.id)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl text-red-600 transition-all"><Trash2 size={16} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* DECOMPOSITION TREE VISUALIZATION */
                    <div className="flex-1 relative bg-gray-50 dark:bg-[#0f1115] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing group"
                         onMouseDown={handleMouseDown}
                         onMouseMove={handleMouseMove}
                         onMouseUp={handleMouseUp}
                         onMouseLeave={handleMouseUp}
                         onWheel={handleWheel}
                    >
                        {/* Map HUD */}
                        <div className="absolute top-6 left-6 z-10 flex flex-col gap-3 pointer-events-none">
                            <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-4 rounded-2xl border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white pointer-events-auto shadow-2xl">
                                <h4 className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-2">Category Decomposition</h4>
                                <div className="flex items-center gap-4 text-[10px] font-black tracking-tight opacity-70">
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> CATEGORIES</div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> SUB-CATEGORIES</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pointer-events-auto">
                                <button onClick={() => setScale(s => Math.min(s + 0.1, 2))} className="p-2 bg-white/80 dark:bg-white/10 hover:bg-blue-100 dark:hover:bg-white/20 backdrop-blur-xl rounded-lg text-blue-600 dark:text-white transition-all shadow-md"><Plus size={16}/></button>
                                <button onClick={() => setScale(s => Math.max(s - 0.1, 0.4))} className="p-2 bg-white/80 dark:bg-white/10 hover:bg-blue-100 dark:hover:bg-white/20 backdrop-blur-xl rounded-lg text-blue-600 dark:text-white transition-all shadow-md"><Minimize2 size={16}/></button>
                                <button onClick={() => { setScale(0.8); setOffset({x: 50, y: 150}); }} className="p-2 bg-white/80 dark:bg-white/10 hover:bg-blue-100 dark:hover:bg-white/20 backdrop-blur-xl rounded-lg text-blue-600 dark:text-white transition-all shadow-md"><ArrowRightLeft size={16} className="rotate-90"/></button>
                            </div>
                        </div>

                        {/* Interactive SVG Canvas */}
                        <svg className="w-full h-full" viewBox="0 0 1200 800">
                             <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
                                {/* Links (Bezier Curves) */}
                                {mindMapData.links.map((link, idx) => {
                                    const source = mindMapData.nodes.find(n => n.id === link.source);
                                    const target = mindMapData.nodes.find(n => n.id === link.target);
                                    if (!source || !target) return null;
                                    
                                    // Calculate center points of right side of source and left side of target
                                    const startX = source.x + source.width;
                                    const startY = source.y + source.height / 2;
                                    const endX = target.x;
                                    const endY = target.y + target.height / 2;

                                    return (
                                        <g key={`link-${idx}`}>
                                            <path 
                                                d={getCurvePath(startX, startY, endX, endY)}
                                                fill="none"
                                                stroke={target.type === 'CATEGORY' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(16, 185, 129, 0.2)'}
                                                strokeWidth={2}
                                                className="transition-all duration-1000"
                                            />
                                        </g>
                                    );
                                })}

                                {/* Nodes (Card Style) */}
                                {mindMapData.nodes.map(node => (
                                    <g key={node.id} transform={`translate(${node.x}, ${node.y})`} 
                                       onClick={(e) => { e.stopPropagation(); node.type !== 'ROOT' && handleOpenModal(node.originalId ? safeOptions.find(o => o.id === node.originalId) : node); }}
                                       className="cursor-pointer group/node"
                                    >
                                        {/* Card Background */}
                                        <rect 
                                            width={node.width}
                                            height={node.height}
                                            rx={10}
                                            fill={node.type === 'ROOT' ? '#3B82F6' : '#fff'}
                                            className={`${node.type !== 'ROOT' ? 'dark:fill-[#1e2029]' : ''} shadow-lg shadow-black/5 transition-all group-hover/node:-translate-y-1 group-hover/node:shadow-blue-500/10`}
                                            stroke={node.type === 'ROOT' ? 'none' : 'rgba(0,0,0,0.05)'}
                                        />
                                        
                                        {/* Value Bar (Decomposition style) */}
                                        {node.type !== 'ROOT' && (
                                            <g transform="translate(50, 50)">
                                                <rect width={node.width - 100} height={8} rx={4} fill="rgba(0,0,0,0.05)" className="dark:fill-white/5" />
                                                <rect 
                                                    width={(node.width - 100) * (node.type === 'CATEGORY' ? 0.7 : 0.4)} 
                                                    height={8} 
                                                    rx={4} 
                                                    fill="#F59E0B"
                                                    className="opacity-90"
                                                />
                                            </g>
                                        )}

                                        {/* Icon Container */}
                                        <g transform={`translate(15, ${node.height/2 - 12})`}>
                                            {node.type === 'ROOT' ? (
                                                <Network size={24} color="white" />
                                            ) : node.type === 'CATEGORY' ? (
                                                <FolderTree size={20} className="text-blue-500" />
                                            ) : (
                                                <Tag size={16} className="text-emerald-500" />
                                            )}
                                        </g>

                                        {/* Labels */}
                                        <text 
                                            x={50}
                                            y={node.height / 2 - 5}
                                            fill={node.type === 'ROOT' ? 'white' : 'currentColor'}
                                            className={`font-black tracking-tight ${node.type === 'ROOT' ? 'text-lg' : node.type === 'CATEGORY' ? 'text-sm' : 'text-xs'} dark:text-white`}
                                        >
                                            {node.label || node.value}
                                        </text>

                                        {/* Sub-label (Item Count/Value) */}
                                        {node.type !== 'ROOT' && (
                                            <text 
                                                x={50}
                                                y={node.height / 2 + 35}
                                                className="text-[9px] font-black tracking-widest text-gray-400 dark:text-gray-500 opacity-60 uppercase"
                                            >
                                                {node.type === 'CATEGORY' 
                                                    ? `${allSubCategories.filter(s => s.parentIds?.includes(node.id) || s.parentId === node.id).length} Nodes`
                                                    : 'Active Attribute'
                                                }
                                            </text>
                                        )}

                                        {/* Expansion Indicator (+) */}
                                        {node.type !== 'SUB_CATEGORY' && (
                                            <g transform={`translate(${node.width - 20}, ${node.height/2})`}>
                                                <circle r={7} fill="currentColor" className="text-gray-200 dark:text-gray-800" />
                                                <line x1={-3} y1={0} x2={3} y2={0} stroke="currentColor" strokeWidth={1.5} className="text-gray-600 dark:text-gray-400" />
                                                <line x1={0} y1={-3} x2={0} y2={3} stroke="currentColor" strokeWidth={1.5} className="text-gray-600 dark:text-gray-400" />
                                            </g>
                                        )}
                                    </g>
                                ))}
                             </g>
                        </svg>

                        {/* Map HUD - Right side stats */}
                        <div className="absolute bottom-6 left-6 font-mono text-[10px] text-gray-400 dark:text-gray-600 uppercase tracking-widest pointer-events-none p-4 backdrop-blur-md rounded-xl">
                            Relational Hierarchy Explorer v2.0 // DECOMPOSITION_TREE_ENABLED
                        </div>
                    </div>
                )}
            </div>

            {/* Premium Dynamic Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setIsModalOpen(false)} />
                    <div className="relative bg-white dark:bg-[#1e2029] rounded-[40px] shadow-[0_35px_80px_-15px_rgba(0,0,0,0.8)] w-full max-w-xl overflow-hidden border border-gray-200 dark:border-gray-800 animate-in slide-in-from-bottom-12 duration-500">
                        {/* Modal Header */}
                        <div className="px-10 py-8 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gradient-to-br from-gray-50 to-white dark:from-[#1e2029] dark:to-[#181a21]">
                            <div className="flex items-center gap-6">
                                <div className={`p-4 rounded-3xl text-white shadow-2xl ${selectedType === 'CATEGORY' ? 'bg-blue-600 shadow-blue-500/20' : 'bg-emerald-600 shadow-emerald-500/20'}`}>
                                    {editingOption ? <Edit2 size={24} /> : <Plus size={24} />}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">
                                        {editingOption ? 'Edit Attribute' : 'Create New'}
                                    </h3>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Classification Engine</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-3 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">
                                <X size={24} />
                            </button>
                        </div>
                        
                        {/* Modal Body */}
                        <div className="p-10 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => setSelectedType('CATEGORY')}
                                    className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all font-bold text-xs uppercase tracking-widest ${
                                        selectedType === 'CATEGORY' 
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg' 
                                            : 'bg-transparent border-gray-200 dark:border-gray-800 text-gray-400'
                                    }`}
                                >
                                    <FolderTree size={16} /> Category
                                </button>
                                <button 
                                    onClick={() => setSelectedType('SUB_CATEGORY')}
                                    className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all font-bold text-xs uppercase tracking-widest ${
                                        selectedType === 'SUB_CATEGORY' 
                                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' 
                                            : 'bg-transparent border-gray-200 dark:border-gray-800 text-gray-400'
                                    }`}
                                >
                                    <Tag size={16} /> Sub-Category
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Attribute Name</label>
                                <input
                                    type="text"
                                    value={value}
                                    onChange={e => setValue(e.target.value)}
                                    placeholder="e.g. Bedspreads, Medical Supplies..."
                                    className="w-full px-6 py-5 text-xl font-bold border-2 border-gray-200 dark:border-gray-800 rounded-3xl bg-gray-50 dark:bg-[#1a1c23] text-gray-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300 dark:placeholder:text-gray-700"
                                    autoFocus
                                />
                            </div>

                            {selectedType === 'SUB_CATEGORY' && (
                                <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                                    <div className="flex items-center justify-between px-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Parent Associations</label>
                                        <span className="text-[10px] font-black bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 px-3 py-1 rounded-full">{selectedParentIds.length} Linked</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[220px] overflow-y-auto p-4 bg-gray-50/50 dark:bg-black/20 rounded-3xl border border-gray-100 dark:border-gray-800 custom-scrollbar">
                                        {allCategories.map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => toggleParentSelection(cat.id)}
                                                className={`flex items-center gap-3 p-3 rounded-2xl text-[11px] font-bold text-left transition-all border ${
                                                    selectedParentIds.includes(cat.id)
                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                                        : 'bg-white dark:bg-[#1a1c23] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:border-blue-500/50'
                                                }`}
                                            >
                                                <div className={`flex-shrink-0 w-4 h-4 rounded-md border-2 flex items-center justify-center transition-colors ${
                                                    selectedParentIds.includes(cat.id) ? 'bg-white border-white' : 'border-gray-300 dark:border-gray-600'
                                                }`}>
                                                    {selectedParentIds.includes(cat.id) && <Check size={10} className="text-blue-600 font-black" />}
                                                </div>
                                                <span className="truncate">{cat.value}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-gray-400 text-center italic font-medium">Link this sub-category to one or more primary parent categories.</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-10 py-8 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-4 bg-gray-50/50 dark:bg-gray-800/20">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-8 py-3 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all"
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !value.trim() || (selectedType === 'SUB_CATEGORY' && selectedParentIds.length === 0)}
                                className="flex items-center gap-3 px-10 py-4 text-xs font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 rounded-2xl transition-all shadow-2xl shadow-blue-500/40 disabled:opacity-50 active:scale-95 group/btn"
                            >
                                {isSaving ? (
                                    <div className="w-4 h-4 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save size={18} className="group-hover/btn:rotate-12 transition-transform" />
                                )}
                                <span>{editingOption ? 'Update Attribute' : 'Authorize & Save'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Premium Global Styles */}
            <style dangerouslySetInnerHTML={{ __html: `
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.2); border-radius: 10px; }
                .shadow-glow { box-shadow: 0 0 15px currentColor; }
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slide-in-bottom { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.3s ease-out; }
            `}} />
        </div>
    );
};

export default CatalogManagement;
