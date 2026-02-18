
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AttributeOption, AttributeType, Item } from '../types';
import { 
    Plus, Edit2, Trash2, FolderTree, Tag, Layers, 
    BookOpen, Save, X, 
    Network, List as ListIcon, ChevronRight, Check,
    Search, ArrowRightLeft, Maximize2, Minimize2,
    ChevronsUp, ChevronsDown, MousePointer2 as _MousePointer2
} from 'lucide-react';
import { useToast } from './ToastNotification';

interface CatalogManagementProps {
    options: AttributeOption[];
    items?: Item[]; // Allow passing items for counts
    upsertOption: (option: Partial<AttributeOption>) => Promise<void>;
    deleteOption: (id: string) => Promise<void>;
}

// Grouping related attributes for better UX
const GROUPED_TABS: { id: string, label: string, icon: typeof Network, types: AttributeType[] }[] = [
    { id: 'TAXONOMY', label: 'Taxonomy', icon: Network, types: ['CATEGORY', 'SUB_CATEGORY', 'TYPE', 'CATALOG', 'POOL'] },
    { id: 'ATTRIBUTES', label: 'Attributes', icon: Tag, types: ['UOM'] },
];

type ViewMode = 'LIST' | 'TAXONOMY' | 'MIND_MAP';

const CatalogManagement = ({ 
    options = [], 
    items = [],
    upsertOption, 
    deleteOption 
}: CatalogManagementProps) => {
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
    const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]); // New: For managing children of a parent
    const [isSaving, setIsSaving] = useState(false);

    // Hierarchy State
    const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
    const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
    const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);

    // Mind Map Zoom/Pan State
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    // --- Miller Columns UI Polish State ---
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [minimizedColumns, setMinimizedColumns] = useState<Record<string, boolean>>({});

    const toggleMinimize = (colId: string) => {
        setMinimizedColumns(prev => ({ ...prev, [colId]: !prev[colId] }));
    };

    const scrollToRight = () => {
        setTimeout(() => {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTo({
                    left: scrollContainerRef.current.scrollWidth,
                    behavior: 'smooth'
                });
            }
        }, 100);
    };

    // Data Filtering
    // Data Filtering & Memoization for Modal Lists
    const allPools = useMemo(() => safeOptions.filter(o => o.type === 'POOL').sort((a,b) => a.value.localeCompare(b.value)), [safeOptions]);
    const allCatalogs = useMemo(() => safeOptions.filter(o => o.type === 'CATALOG').sort((a,b) => a.value.localeCompare(b.value)), [safeOptions]);
    const allTypes = useMemo(() => safeOptions.filter(o => o.type === 'TYPE').sort((a,b) => a.value.localeCompare(b.value)), [safeOptions]);
    const allCategories = useMemo(() => safeOptions.filter(o => o.type === 'CATEGORY').sort((a,b) => a.value.localeCompare(b.value)), [safeOptions]);
    const allSubCategories = useMemo(() => safeOptions.filter(o => o.type === 'SUB_CATEGORY').sort((a,b) => a.value.localeCompare(b.value)), [safeOptions]);
    
    // Auto-select first category if in Taxonomy view and none selected
    // REMOVED: Legacy auto-selection logic (incompatible with 5-level hierarchy)
    // useEffect(() => {
    //    if (viewMode === 'TAXONOMY' && allCategories.length > 0 && !selectedParentId) {
    //        setSelectedParentId(allCategories[0].id);
    //    }
    // }, [viewMode, allCategories, selectedParentId]);

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
            
            // Smart Parent Pre-selection
            
            // Smart Parent Pre-selection
            let defaultParents: string[] = [];
            const targetType = forcedType || (activeTabId === 'TAXONOMY' ? 'CATEGORY' : activeTabId as AttributeType);
            
            let activeParentId: string | null = null;
            if (targetType === 'CATALOG') activeParentId = selectedPoolId;
            else if (targetType === 'TYPE') activeParentId = selectedCatalogId;
            else if (targetType === 'CATEGORY') activeParentId = selectedTypeId;
            else if (targetType === 'SUB_CATEGORY') activeParentId = selectedParentId;

            if (activeParentId) defaultParents = [activeParentId];
            
            setSelectedParentIds(defaultParents);
            
            // Smart Child Pre-selection (For "Link Existing" mode)
            if (activeParentId) {
                const linkedChildren = safeOptions
                    .filter(o => o.type === targetType && (o.parentIds?.includes(activeParentId!) || o.parentId === activeParentId))
                    .map(o => o.id);
                setSelectedChildIds(linkedChildren);
            } else {
                setSelectedChildIds([]);
            }
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // 1. Handle Bulk Linking (If we are in "Create" mode and have a parent context)
            // Determine active parent context based on selectedType
            let activeContextId: string | null = null;
            if (selectedType === 'CATALOG') activeContextId = selectedPoolId;
            else if (selectedType === 'TYPE') activeContextId = selectedCatalogId;
            else if (selectedType === 'CATEGORY') activeContextId = selectedTypeId;
            else if (selectedType === 'SUB_CATEGORY') activeContextId = selectedParentId;

            // Only run bulk logic if we are NOT editing a specific option (i.e., we are in "Manage" mode)
            if (!editingOption && activeContextId) {
                // Find all items of this type
                const potentialChildren = safeOptions.filter(o => o.type === selectedType);
                
                // Diffing Logic
                for (const child of potentialChildren) {
                    const isSelected = selectedChildIds.includes(child.id);
                    const isCurrentlyLinked = child.parentIds?.includes(activeContextId) || child.parentId === activeContextId;
                    
                    if (isSelected && !isCurrentlyLinked) {
                        // LINK: Add parentId
                        await upsertOption({
                            ...child,
                            parentIds: [...(child.parentIds || []), activeContextId]
                        });
                    } else if (!isSelected && isCurrentlyLinked) {
                        // UNLINK: Remove parentId
                        // Only remove if it has multiple parents? Or allow strict removal? user said "associate these...". Assuming full control.
                        const newParents = (child.parentIds || []).filter(pid => pid !== activeContextId);
                        await upsertOption({
                            ...child,
                            parentIds: newParents, 
                            parentId: newParents.length > 0 ? newParents[0] : undefined // fallback for legacy parentId
                        });
                    }
                }
            }

            // 2. Handle Create/Update Single Item (If value provided)
            if (value.trim()) {
                await upsertOption({
                    id: editingOption?.id,
                    type: selectedType,
                    value: value.trim(),
                    parentIds: selectedType !== 'POOL' ? selectedParentIds : [],
                    activeFlag: true
                });
            }

            success(`${selectedType} saved successfully`);
            setIsModalOpen(false);
        } catch (err: unknown) {
            error('Failed to save: ' + (err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (globalThis.confirm('Are you sure you want to delete this option?')) {
            try {
                await deleteOption(id);
                success('Option deleted successfully');
                if (selectedParentId === id) setSelectedParentId(null);
            } catch (err: unknown) {
                error('Failed to delete: ' + (err as Error).message);
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

    const toggleChildSelection = (id: string) => {
        setSelectedChildIds(prev => 
            prev.includes(id) 
                ? prev.filter(c => c !== id) 
                : [...prev, id]
        );
    };

    // Sub-Categories for selected parent
    const _associatedSubCategories = useMemo(() => {
        if (!selectedParentId) return [];
        return allSubCategories.filter(s => s.parentIds?.includes(selectedParentId) || s.parentId === selectedParentId);
    }, [selectedParentId, allSubCategories]);

    // --- 5-Level Hierarchy Mind Map Logic ---
    const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([]);

    // Initialize with pools expanded
    useEffect(() => {
        if (expandedNodeIds.length === 0 && safeOptions.length > 0) {
            setExpandedNodeIds(safeOptions.filter(o => o.type === 'POOL').map(o => o.id));
        }
    }, [safeOptions, expandedNodeIds.length]);

    const toggleNodeExpansion = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedNodeIds(prev => 
            prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]
        );
    };

    const mindMapData = useMemo(() => {
        // 1. Organize Data by Type
        const pools = safeOptions.filter(o => o.type === 'POOL');
        const catalogs = safeOptions.filter(o => o.type === 'CATALOG');
        const types = safeOptions.filter(o => o.type === 'TYPE');
        const categories = safeOptions.filter(o => o.type === 'CATEGORY');
        const subCategories = safeOptions.filter(o => o.type === 'SUB_CATEGORY');
        const _uoms = safeOptions.filter(o => o.type === 'UOM');

        const nodes: { id: string; type: string; label: string; x: number; y: number; itemCount: number; width: number; height: number; original?: AttributeOption }[] = [];
        const links: { source: string; target: string }[] = [];

        // Layout Config
        const LEVEL_WIDTH = 300;
        const NODE_HEIGHT = 80;
        const NODE_GAP = 20;
        const START_X = 50;
        const START_Y = 50;

        // Level 0: Global Root
        const rootNode = {
            id: 'root',
            type: 'ROOT',
            label: 'Product Catalog',
            x: START_X,
            y: 0, 
            itemCount: 0, // items not available in props
            width: 200, height: 60
        };
        nodes.push(rootNode);

        // Helper to layout a level with smarter positioning
        const buildLevel = (
            options: AttributeOption[], 
            levelIndex: number, 
            prevLevelNodes: { id: string; y: number; height: number }[],
            getParents: (opt: AttributeOption) => string[]
        ) => {
            const myNodes: typeof nodes = [];
            // Sort to cluster by parent for better aesthetics
            const sorted = [...options].sort((a, b) => {
                const pA = getParents(a)[0] || '';
                const pB = getParents(b)[0] || '';
                if (pA && pB && pA !== pB) {
                    const parentNodeA = prevLevelNodes.find(n => n.id === pA);
                    const parentNodeB = prevLevelNodes.find(n => n.id === pB);
                    if (parentNodeA && parentNodeB) return parentNodeA.y - parentNodeB.y;
                }
                return a.value.localeCompare(b.value);
            });

            // Smart stacking with slight clustering
            let currentY = START_Y;
            
            // Adjust start Y based on first parent to align visually
            if (sorted.length > 0 && prevLevelNodes.length > 0) {
                 const firstParents = getParents(sorted[0]);
                 const parentNode = prevLevelNodes.find(n => firstParents.includes(n.id));
                 if (parentNode) currentY = Math.max(START_Y, parentNode.y - ((sorted.length * NODE_HEIGHT)/2) + (parentNode.height/2));
            }

            // Correction to avoid negative Y
            currentY = Math.max(START_Y, currentY);

            sorted.forEach(opt => {
                let count = 0;
                if (items.length > 0) {
                     if (opt.type === 'SUB_CATEGORY') count = items.filter(i => i.subCategory === opt.value).length;
                     else if (opt.type === 'CATEGORY') count = items.filter(i => i.category === opt.value).length;
                     else if (opt.type === 'TYPE') count = items.filter(i => i.itemType === opt.value).length;
                     else if (opt.type === 'CATALOG') count = items.filter(i => i.itemCatalog === opt.value).length;
                     else if (opt.type === 'POOL') count = items.filter(i => i.itemPool === opt.value).length; 
                }

                // Attempt to place near parent average
                const _myParents = getParents(opt);
                
                // If we aren't strict stacking, we could try to use parent average Y
                // But strict stacking prevents overlap. Let's stick to strict flow for now to prevent collisions, 
                // but we sorted by parent Y above, so they should naturally cluster.
                
                const node = {
                    id: opt.id,
                    type: opt.type,
                    label: opt.value,
                    original: opt,
                    x: START_X + (levelIndex * LEVEL_WIDTH),
                    y: currentY,
                    itemCount: count,
                    width: 240, height: 80
                };
                myNodes.push(node);
                currentY += NODE_HEIGHT + NODE_GAP;

                // Links
                const pIds = getParents(opt);
                if (pIds.length > 0) {
                    pIds.forEach(pid => {
                         const _parentExists = nodes.find(n => n.id === pid);
                         // Only draw link if parent node is actually in our visual subset
                         const isParentVisible = prevLevelNodes.some(n => n.id === pid);
                         if (isParentVisible) {
                             links.push({ source: pid, target: node.id });
                         }
                    });
                } else if (levelIndex === 1) {
                    links.push({ source: 'root', target: node.id });
                }
            });
            nodes.push(...myNodes);
            return myNodes; // Return these nodes for next level
        };

        const _poolNodes = buildLevel(pools, 1, [], _o => []);
        
        // Filter children based on expanded parents
        // Key Fix: Filter active nodes based on ALL expanded parents to support multi-parent logic visually
        const activeCatalogs = catalogs.filter(c => (c.parentIds || []).some(pid => expandedNodeIds.includes(pid)) || (c.parentId && expandedNodeIds.includes(c.parentId)));
        const catalogNodes = buildLevel(activeCatalogs, 2, _poolNodes, o => (o.parentIds && o.parentIds.length > 0) ? o.parentIds : (o.parentId ? [o.parentId] : []));
        
        const activeTypes = types.filter(t => (t.parentIds || []).some(pid => expandedNodeIds.includes(pid)) || (t.parentId && expandedNodeIds.includes(t.parentId)));
        const typeNodes = buildLevel(activeTypes, 3, catalogNodes, o => (o.parentIds && o.parentIds.length > 0) ? o.parentIds : (o.parentId ? [o.parentId] : []));
        
        const activeCategories = categories.filter(c => (c.parentIds || []).some(pid => expandedNodeIds.includes(pid)) || (c.parentId && expandedNodeIds.includes(c.parentId)));
        const categoryNodes = buildLevel(activeCategories, 4, typeNodes, o => (o.parentIds && o.parentIds.length > 0) ? o.parentIds : (o.parentId ? [o.parentId] : []));
        
        const activeSubCategories = subCategories.filter(s => (s.parentIds || []).some(pid => expandedNodeIds.includes(pid)) || (s.parentId && expandedNodeIds.includes(s.parentId)));
        const _subCategoryNodes = buildLevel(activeSubCategories, 5, categoryNodes, o => (o.parentIds && o.parentIds.length > 0) ? o.parentIds : (o.parentId ? [o.parentId] : []));

        // Center Root vertically based on pools
        if (_poolNodes.length > 0) {
            const minY = Math.min(..._poolNodes.map(n => n.y));
            const maxY = Math.max(..._poolNodes.map(n => n.y));
            rootNode.y = (minY + maxY) / 2;
        }

        return { nodes, links };
    }, [safeOptions, items, expandedNodeIds]);

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

    // Helper for Bézier curve paths with smoother curvature
    const getCurvePath = (sX: number, sY: number, tX: number, tY: number) => {
        const midX = (sX + tX) / 2;
        // Add a slight vertical curve for better separation?
        return `M ${sX} ${sY} C ${midX} ${sY}, ${midX} ${tY}, ${tX} ${tY}`;
    };

    // Calculate node Y position based on parents to reduce crossing
    const _calculateSmartY = (
        nodeParents: string[], 
        prevLevelNodes: { id: string; y: number }[], 
        defaultY: number
    ) => {
        const connectedParents = prevLevelNodes.filter(p => nodeParents.includes(p.id));
        if (connectedParents.length === 0) return defaultY;
        
        // Average Y of parents
        const avgY = connectedParents.reduce((sum, p) => sum + p.y, 0) / connectedParents.length;
        return avgY;
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
                                type="button"
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
                        type="button"
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
                        type="button"
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
                    /* 5-LEVEL HIERARCHY TAXONOMY VIEW */
                    <div ref={scrollContainerRef} className="flex-1 flex gap-4 overflow-x-auto p-4 custom-scrollbar scroll-smooth">
                        {/* 1. POOLS */}
                        <div className={`transition-all duration-300 flex flex-col bg-white dark:bg-[#1e2029] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden ${minimizedColumns['POOL'] ? 'min-w-[80px] w-[80px]' : 'min-w-[280px] w-[280px]'}`}>
                            <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex justify-between items-center">
                                {!minimizedColumns['POOL'] && (
                                    <h4 className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center gap-2">
                                        <Layers size={14} /> Pools
                                    </h4>
                                )}
                                <div className="flex items-center gap-1">
                                    {!minimizedColumns['POOL'] && (
                                    <button 
                                        type="button"
                                        onClick={() => handleOpenModal(undefined, 'POOL')} className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg hover:bg-blue-200"><Plus size={14} /></button>
                                    )}
                                    <button 
                                        type="button"
                                        onClick={() => toggleMinimize('POOL')} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                        {minimizedColumns['POOL'] ? <Maximize2 size={14} className="mx-auto" /> : <Minimize2 size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {minimizedColumns['POOL'] ? (
                                    <div className="h-full flex flex-col items-center pt-4 space-y-4">
                                        {selectedPoolId && (
                                            <div className="vertical-text text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest whitespace-nowrap rotate-180" style={{ writingMode: 'vertical-rl' }}>
                                                {safeOptions.find(o => o.id === selectedPoolId)?.value}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    safeOptions.filter(o => o.type === 'POOL').sort((a,b) => a.value.localeCompare(b.value)).map(pool => (
                                        <div 
                                            key={pool.id}
                                            onClick={() => { 
                                                // STRICT RESET LOGIC: Reset all downstream selections
                                                setSelectedPoolId(pool.id); 
                                                setSelectedCatalogId(null); 
                                                setSelectedTypeId(null); 
                                                setSelectedParentId(null);
                                                
                                                // Auto-minimize downstream columns (optional "accordion" feel)
                                                // setMinimizedColumns({ ...minimizedColumns, 'CATALOG': false, 'TYPE': true, 'CATEGORY': true }); 
                                                
                                                scrollToRight();
                                            }}
                                            className={`group relative p-3 rounded-xl cursor-pointer text-sm font-bold flex justify-between items-center transition-all ${selectedPoolId === pool.id ? 'bg-blue-600 text-white shadow-lg scale-105 z-10' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                                        >
                                            <span>{pool.value}</span>
                                            <div className="flex items-center gap-2">
                                                {selectedPoolId === pool.id && <ChevronRight size={14} />}
                                                <div className={`flex gap-1 ${selectedPoolId === pool.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleOpenModal(pool); }} className={`p-1 ${selectedPoolId === pool.id ? 'hover:text-blue-200' : 'hover:text-blue-500'}`}><Edit2 size={12}/></button>
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(pool.id); }} className={`p-1 ${selectedPoolId === pool.id ? 'hover:text-red-200' : 'hover:text-red-500'}`}><Trash2 size={12}/></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* 2. CATALOGS */}
                        {selectedPoolId && (
                            <div className={`transition-all duration-300 flex flex-col bg-white dark:bg-[#1e2029] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden animate-in fade-in slide-in-from-left-4 duration-300 ${minimizedColumns['CATALOG'] ? 'min-w-[80px] w-[80px]' : 'min-w-[280px] w-[280px]'}`}>
                                <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex justify-between items-center">
                                    {!minimizedColumns['CATALOG'] && (
                                        <h4 className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                                            <BookOpen size={14} /> Catalogs
                                        </h4>
                                    )}
                                    <div className="flex items-center gap-1">
                                        {!minimizedColumns['CATALOG'] && (
                                            <button type="button" onClick={() => handleOpenModal(undefined, 'CATALOG')} className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg hover:bg-emerald-200"><Plus size={14} /></button>
                                        )}
                                        <button type="button" onClick={() => toggleMinimize('CATALOG')} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                            {minimizedColumns['CATALOG'] ? <Maximize2 size={14} className="mx-auto" /> : <Minimize2 size={14} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                    {minimizedColumns['CATALOG'] ? (
                                        <div className="h-full flex flex-col items-center pt-4 space-y-4">
                                            {selectedCatalogId && (
                                                <div className="vertical-text text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest whitespace-nowrap rotate-180" style={{ writingMode: 'vertical-rl' }}>
                                                    {safeOptions.find(o => o.id === selectedCatalogId)?.value}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            {safeOptions.filter(o => o.type === 'CATALOG' && (o.parentIds?.includes(selectedPoolId) || o.parentId === selectedPoolId)).sort((a,b) => a.value.localeCompare(b.value)).map(cat => (
                                                <div 
                                                    key={cat.id}
                                                    onClick={() => { 
                                                        setSelectedCatalogId(cat.id); 
                                                        setSelectedTypeId(null); 
                                                        setSelectedParentId(null);
                                                        scrollToRight();
                                                    }}
                                                    className={`group relative p-3 rounded-xl cursor-pointer text-sm font-bold flex justify-between items-center transition-all ${selectedCatalogId === cat.id ? 'bg-emerald-600 text-white shadow-lg scale-105 z-10' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                                                >
                                                    <span>{cat.value}</span>
                                                    <div className="flex items-center gap-2">
                                                        {selectedCatalogId === cat.id && <ChevronRight size={14} />}
                                                        <div className={`flex gap-1 ${selectedCatalogId === cat.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleOpenModal(cat); }} className={`p-1 ${selectedCatalogId === cat.id ? 'hover:text-emerald-200' : 'hover:text-blue-500'}`}><Edit2 size={12}/></button>
                                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(cat.id); }} className={`p-1 ${selectedCatalogId === cat.id ? 'hover:text-red-200' : 'hover:text-red-500'}`}><Trash2 size={12}/></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {safeOptions.filter(o => o.type === 'CATALOG' && (o.parentIds?.includes(selectedPoolId) || o.parentId === selectedPoolId)).length === 0 && (
                                                <div className="p-4 text-center text-xs text-gray-400 italic">No catalogs in this pool.</div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 3. TYPES */}
                        {selectedCatalogId && (
                            <div className={`transition-all duration-300 flex flex-col bg-white dark:bg-[#1e2029] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden animate-in fade-in slide-in-from-left-4 duration-300 ${minimizedColumns['TYPE'] ? 'min-w-[80px] w-[80px]' : 'min-w-[280px] w-[280px]'}`}>
                                <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex justify-between items-center">
                                    {!minimizedColumns['TYPE'] && (
                                        <h4 className="text-xs font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 flex items-center gap-2">
                                            <Tag size={14} /> Types
                                        </h4>
                                    )}
                                    <div className="flex items-center gap-1">
                                        {!minimizedColumns['TYPE'] && (
                                            <button type="button" onClick={() => handleOpenModal(undefined, 'TYPE')} className="p-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg hover:bg-purple-200"><Plus size={14} /></button>
                                        )}
                                        <button type="button" onClick={() => toggleMinimize('TYPE')} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                            {minimizedColumns['TYPE'] ? <Maximize2 size={14} className="mx-auto" /> : <Minimize2 size={14} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                    {minimizedColumns['TYPE'] ? (
                                        <div className="h-full flex flex-col items-center pt-4 space-y-4">
                                            {selectedTypeId && (
                                                <div className="vertical-text text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest whitespace-nowrap rotate-180" style={{ writingMode: 'vertical-rl' }}>
                                                    {safeOptions.find(o => o.id === selectedTypeId)?.value}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            {safeOptions.filter(o => o.type === 'TYPE' && (o.parentIds?.includes(selectedCatalogId) || o.parentId === selectedCatalogId)).sort((a,b) => a.value.localeCompare(b.value)).map(type => (
                                                <div 
                                                    key={type.id}
                                                    onClick={() => { 
                                                        setSelectedTypeId(type.id); 
                                                        setSelectedParentId(null);
                                                        scrollToRight();
                                                    }}
                                                    className={`group relative p-3 rounded-xl cursor-pointer text-sm font-bold flex justify-between items-center transition-all ${selectedTypeId === type.id ? 'bg-purple-600 text-white shadow-lg scale-105 z-10' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                                                >
                                                    <span>{type.value}</span>
                                                    <div className="flex items-center gap-2">
                                                        {selectedTypeId === type.id && <ChevronRight size={14} />}
                                                        <div className={`flex gap-1 ${selectedTypeId === type.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleOpenModal(type); }} className={`p-1 ${selectedTypeId === type.id ? 'hover:text-purple-200' : 'hover:text-blue-500'}`}><Edit2 size={12}/></button>
                                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(type.id); }} className={`p-1 ${selectedTypeId === type.id ? 'hover:text-red-200' : 'hover:text-red-500'}`}><Trash2 size={12}/></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {safeOptions.filter(o => o.type === 'TYPE' && (o.parentIds?.includes(selectedCatalogId) || o.parentId === selectedCatalogId)).length === 0 && (
                                                <div className="p-4 text-center text-xs text-gray-400 italic">No types in this catalog.</div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 4. CATEGORIES */}
                        {selectedTypeId && (
                            <div className={`transition-all duration-300 flex flex-col bg-white dark:bg-[#1e2029] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden animate-in fade-in slide-in-from-left-4 duration-300 ${minimizedColumns['CATEGORY'] ? 'min-w-[80px] w-[80px]' : 'min-w-[280px] w-[280px]'}`}>
                                <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex justify-between items-center">
                                    {!minimizedColumns['CATEGORY'] && (
                                        <h4 className="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-2">
                                            <FolderTree size={14} /> Categories
                                        </h4>
                                    )}
                                    <div className="flex items-center gap-1">
                                        {!minimizedColumns['CATEGORY'] && (
                                            <button type="button" onClick={() => handleOpenModal(undefined, 'CATEGORY')} className="p-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-lg hover:bg-amber-200"><Plus size={14} /></button>
                                        )}
                                        <button type="button" onClick={() => toggleMinimize('CATEGORY')} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                            {minimizedColumns['CATEGORY'] ? <Maximize2 size={14} className="mx-auto" /> : <Minimize2 size={14} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                    {minimizedColumns['CATEGORY'] ? (
                                        <div className="h-full flex flex-col items-center pt-4 space-y-4">
                                            {selectedParentId && (
                                                <div className="vertical-text text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest whitespace-nowrap rotate-180" style={{ writingMode: 'vertical-rl' }}>
                                                    {safeOptions.find(o => o.id === selectedParentId)?.value}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            {safeOptions.filter(o => o.type === 'CATEGORY' && (o.parentIds?.includes(selectedTypeId) || o.parentId === selectedTypeId)).sort((a,b) => a.value.localeCompare(b.value)).map(cat => (
                                                <div 
                                                    key={cat.id}
                                                    onClick={() => {
                                                        setSelectedParentId(cat.id);
                                                        scrollToRight();
                                                    }}
                                                    className={`group relative p-3 rounded-xl cursor-pointer text-sm font-bold flex justify-between items-center transition-all ${selectedParentId === cat.id ? 'bg-amber-600 text-white shadow-lg scale-105 z-10' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                                                >
                                                    <span>{cat.value}</span>
                                                    <div className="flex items-center gap-2">
                                                        {selectedParentId === cat.id && <ChevronRight size={14} />}
                                                        <div className={`flex gap-1 ${selectedParentId === cat.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleOpenModal(cat); }} className={`p-1 ${selectedParentId === cat.id ? 'hover:text-amber-200' : 'hover:text-blue-500'}`}><Edit2 size={12}/></button>
                                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(cat.id); }} className={`p-1 ${selectedParentId === cat.id ? 'hover:text-red-200' : 'hover:text-red-500'}`}><Trash2 size={12}/></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {safeOptions.filter(o => o.type === 'CATEGORY' && (o.parentIds?.includes(selectedTypeId) || o.parentId === selectedTypeId)).length === 0 && (
                                                <div className="p-4 text-center text-xs text-gray-400 italic">No categories in this type.</div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 5. SUB-CATEGORIES */}
                        {selectedParentId && (
                            <div className="min-w-[280px] flex flex-col bg-white dark:bg-[#1e2029] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden animate-in fade-in slide-in-from-left-4 duration-300">
                                <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex justify-between items-center">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 flex items-center gap-2">
                                        <Tag size={14} /> Sub-Categories
                                    </h4>
                                    <button type="button" onClick={() => handleOpenModal(undefined, 'SUB_CATEGORY')} className="p-1.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-lg hover:bg-rose-200"><Plus size={14} /></button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                    {safeOptions.filter(o => o.type === 'SUB_CATEGORY' && (o.parentIds?.includes(selectedParentId) || o.parentId === selectedParentId)).sort((a,b) => a.value.localeCompare(b.value)).map(sub => (
                                        <div 
                                            key={sub.id}
                                            className="group relative p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 hover:border-rose-300 transition-all"
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{sub.value}</span>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button type="button" onClick={() => handleOpenModal(sub)} className="p-1 hover:text-blue-500"><Edit2 size={12}/></button>
                                                    <button type="button" onClick={() => handleDelete(sub.id)} className="p-1 hover:text-red-500"><Trash2 size={12}/></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {safeOptions.filter(o => o.type === 'SUB_CATEGORY' && (o.parentIds?.includes(selectedParentId) || o.parentId === selectedParentId)).length === 0 && (
                                        <div className="p-4 text-center text-xs text-gray-400 italic">No sub-categories linked.</div>
                                    )}
                                </div>
                            </div>
                        )}
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
                                type="button"
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
                                                        <button type="button" onClick={() => handleOpenModal(opt)} className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-xl text-blue-600 transition-all"><Edit2 size={16} /></button>
                                                        <button type="button" onClick={() => handleDelete(opt.id)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl text-red-600 transition-all"><Trash2 size={16} /></button>
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
                                <button type="button" title="Expand All" onClick={() => setExpandedNodeIds(options.map(o => o.id))} className="p-2 bg-white/80 dark:bg-white/10 hover:bg-emerald-100 dark:hover:bg-white/20 backdrop-blur-xl rounded-lg text-emerald-600 dark:text-emerald-400 transition-all shadow-md"><ChevronsDown size={16}/></button>
                                <button type="button" title="Collapse All" onClick={() => setExpandedNodeIds([])} className="p-2 bg-white/80 dark:bg-white/10 hover:bg-rose-100 dark:hover:bg-white/20 backdrop-blur-xl rounded-lg text-rose-600 dark:text-rose-400 transition-all shadow-md"><ChevronsUp size={16}/></button>
                                <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>
                                <button type="button" onClick={() => setScale(s => Math.min(s + 0.1, 2))} className="p-2 bg-white/80 dark:bg-white/10 hover:bg-blue-100 dark:hover:bg-white/20 backdrop-blur-xl rounded-lg text-blue-600 dark:text-white transition-all shadow-md"><Plus size={16}/></button>
                                <button type="button" onClick={() => setScale(s => Math.max(s - 0.1, 0.4))} className="p-2 bg-white/80 dark:bg-white/10 hover:bg-blue-100 dark:hover:bg-white/20 backdrop-blur-xl rounded-lg text-blue-600 dark:text-white transition-all shadow-md"><Minimize2 size={16}/></button>
                                <button type="button" onClick={() => { setScale(0.8); setOffset({x: 50, y: 150}); }} className="p-2 bg-white/80 dark:bg-white/10 hover:bg-blue-100 dark:hover:bg-white/20 backdrop-blur-xl rounded-lg text-blue-600 dark:text-white transition-all shadow-md"><ArrowRightLeft size={16} className="rotate-90"/></button>
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
                                       onClick={(e) => { e.stopPropagation(); node.type !== 'ROOT' && handleOpenModal(node.original); }}
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
                                            {node.label}
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
                                            <g transform={`translate(${node.width - 20}, ${node.height/2})`} onClick={(e) => toggleNodeExpansion(node.id, e)} className="cursor-pointer hover:scale-125 transition-transform">
                                                <circle r={8} fill={expandedNodeIds.includes(node.id) ? "#ef4444" : "#22c55e"} className="opacity-20" />
                                                <circle r={6} fill="none" stroke={expandedNodeIds.includes(node.id) ? "#ef4444" : "#22c55e"} strokeWidth={1.5} />
                                                <line x1={-3} y1={0} x2={3} y2={0} stroke={expandedNodeIds.includes(node.id) ? "#ef4444" : "#22c55e"} strokeWidth={1.5} />
                                                {!expandedNodeIds.includes(node.id) && <line x1={0} y1={-3} x2={0} y2={3} stroke="#22c55e" strokeWidth={1.5} />}
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
{/* Premium Dynamic Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setIsModalOpen(false)} />
                    <div className="relative bg-white dark:bg-[#1e2029] rounded-[40px] shadow-[0_35px_80px_-15px_rgba(0,0,0,0.8)] w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-gray-800 animate-in slide-in-from-bottom-12 duration-500 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="px-10 py-8 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gradient-to-br from-gray-50 to-white dark:from-[#1e2029] dark:to-[#181a21] flex-shrink-0">
                            <div className="flex items-center gap-6">
                                <div className={`p-4 rounded-3xl text-white shadow-2xl ${selectedType === 'CATEGORY' ? 'bg-blue-600 shadow-blue-500/20' : 'bg-emerald-600 shadow-emerald-500/20'}`}>
                                    {editingOption ? <Edit2 size={24} /> : <Plus size={24} />}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">
                                        {editingOption ? 'Edit Attribute' : 'Manage Links'}
                                    </h3>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Classification Engine</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="p-3 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">
                                <X size={24} />
                            </button>
                        </div>
                        
                        {/* Mode Tabs (Only for Create/Link context) */}
                        {!editingOption && selectedType !== 'POOL' && (
                            <div className="flex border-b border-gray-100 dark:border-gray-800 px-10 pt-4 gap-4 bg-gray-50/50 dark:bg-gray-800/20 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => { setValue(''); setSelectedChildIds([]); }} 
                                    className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${
                                        !value && selectedChildIds.length > 0 ? 'border-transparent text-gray-400 hover:text-gray-600' : 'border-blue-600 text-blue-600'
                                    }`}
                                >
                                    Create New
                                </button>
                                <button
                                     type="button"
                                     onClick={() => { setValue(''); /* Logic to switch to Link Existing focus if needed */ }}
                                     className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${
                                        selectedChildIds.length > 0 ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                                     }`}
                                >
                                    Link Existing
                                </button>
                            </div>
                        )}

                        {/* Modal Body */}
                        <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                            
                            {/* Type Selector  */}
                            <div className="grid grid-cols-5 gap-2">
                                {(['POOL', 'CATALOG', 'TYPE', 'CATEGORY', 'SUB_CATEGORY'] as AttributeType[]).map(t => (
                                    <button 
                                        type="button"
                                        key={t}
                                        onClick={() => setSelectedType(t)}
                                        className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all font-bold text-[9px] uppercase tracking-widest ${
                                            selectedType === t 
                                            ? t === 'POOL' ? 'bg-blue-600 border-blue-600 text-white'
                                            : t === 'CATALOG' ? 'bg-emerald-600 border-emerald-600 text-white'
                                            : t === 'TYPE' ? 'bg-purple-600 border-purple-600 text-white'
                                            : t === 'CATEGORY' ? 'bg-amber-600 border-amber-600 text-white'
                                            : 'bg-rose-600 border-rose-600 text-white'
                                            : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                                        }`}
                                    >
                                        {t === 'POOL' && <Layers size={12} />}
                                        {t === 'CATALOG' && <BookOpen size={12} />}
                                        {t === 'TYPE' && <Tag size={12} />}
                                        {t === 'CATEGORY' && <FolderTree size={12} />}
                                        {t === 'SUB_CATEGORY' && <Network size={12} />}
                                        <span className="truncate w-full text-center">{t.replace('_', ' ')}</span>
                                    </button>
                                ))}
                            </div>

                            {/* ITEM SELECTION / CREATION AREA */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">
                                        {selectedType.replace('_', ' ')} Selection
                                    </label>
                                    {!editingOption && <span className="text-[10px] text-gray-400 italic">Create new OR select existing</span>}
                                </div>
                                
                                {/* 1. Create Input */}
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                        <Plus size={18} className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        value={value}
                                        onChange={e => {
                                            setValue(e.target.value);
                                            if (e.target.value) setSelectedChildIds([]); // Clear selections if typing new
                                        }}
                                        placeholder={`Create New ${selectedType.replace('_', ' ')} Name...`}
                                        className={`w-full pl-12 pr-6 py-4 text-lg font-bold border-2 rounded-2xl outline-none transition-all ${
                                            value 
                                            ? 'border-blue-500 bg-blue-50/10 text-gray-900 dark:text-white shadow-lg shadow-blue-500/10'
                                            : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1a1c23] text-gray-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                                        }`}
                                    />
                                </div>

                                {/* 2. Link Existing List (OR Separator) */}
                                {!editingOption && selectedType !== 'POOL' && (
                                    <>
                                        { !value && <div className="flex items-center gap-4 py-2">
                                            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800"></div>
                                            <span className="text-[10px] font-black uppercase text-gray-300">OR SELECT EXISTING</span>
                                            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800"></div>
                                        </div> }

                                        <div className={`transition-all duration-300 ${value ? 'opacity-40 pointer-events-none grayscale' : 'opacity-100'}`}>
                                            <div className="bg-gray-50 dark:bg-black/20 rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[240px]">
                                                {/* Search Existing */}
                                                <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-800/50 flex gap-2">
                                                    <Search size={14} className="text-gray-400 my-auto" />
                                                    <input 
                                                        className="bg-transparent w-full text-xs font-bold outline-none text-gray-700 dark:text-gray-300 placeholder:text-gray-300"
                                                        placeholder={`Search existing ${selectedType.toLowerCase().replace('_', ' ')}s...`}
                                                    />
                                                </div>
                                                <div className="p-3 overflow-y-auto custom-scrollbar grid grid-cols-2 md:grid-cols-3 gap-2">
                                                    {(selectedType === 'CATALOG' ? allCatalogs : 
                                                      selectedType === 'TYPE' ? allTypes : 
                                                      selectedType === 'CATEGORY' ? allCategories : 
                                                      selectedType === 'SUB_CATEGORY' ? allSubCategories : 
                                                      []).map(child => (
                                                        <button
                                                            type="button"
                                                            key={child.id}
                                                            onClick={() => toggleChildSelection(child.id)}
                                                            className={`flex items-center gap-2 p-2.5 rounded-xl text-[11px] font-bold text-left transition-all border ${
                                                                selectedChildIds.includes(child.id)
                                                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-md ring-2 ring-emerald-500/20'
                                                                    : 'bg-white dark:bg-[#1a1c23] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:border-emerald-500/50 hover:bg-emerald-50/10'
                                                            }`}
                                                        >
                                                            <div className={`flex-shrink-0 w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                                                                selectedChildIds.includes(child.id) ? 'bg-white border-white' : 'border-gray-300 dark:border-gray-600'
                                                            }`}>
                                                                {selectedChildIds.includes(child.id) && <Check size={10} className="text-emerald-600 font-black" />}
                                                            </div>
                                                            <span className="truncate">{child.value}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="p-2 bg-gray-100/50 dark:bg-gray-800/50 text-[10px] text-center text-gray-400 font-bold tracking-wide">
                                                    {selectedChildIds.length} items selected
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* PARENT CONTEXT AREA */}
                            {selectedType !== 'POOL' && (
                                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom-2">
                                    <div className="flex items-center justify-between px-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                            <Network size={12} />
                                            Parent Context ({selectedType === 'CATALOG' ? 'POOLS' : selectedType === 'TYPE' ? 'CATALOGS' : selectedType === 'CATEGORY' ? 'TYPES' : 'CATEGORIES'})
                                        </label>
                                        <span className={`text-[10px] font-black px-3 py-1 rounded-full ${selectedParentIds.length ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                            {selectedParentIds.length} Active Parents
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[160px] overflow-y-auto p-4 bg-blue-50/20 dark:bg-blue-900/5 rounded-3xl border border-blue-100/50 dark:border-blue-900/10 custom-scrollbar">
                                        {(selectedType === 'CATALOG' ? allPools : 
                                            selectedType === 'TYPE' ? allCatalogs : 
                                            selectedType === 'CATEGORY' ? allTypes : 
                                            allCategories).map(parent => (
                                            <button
                                                type="button"
                                                key={parent.id}
                                                onClick={() => toggleParentSelection(parent.id)}
                                                className={`flex items-center gap-3 p-3 rounded-2xl text-[11px] font-bold text-left transition-all border ${
                                                    selectedParentIds.includes(parent.id)
                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                                        : 'bg-white dark:bg-[#1a1c23] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:border-blue-500/50'
                                                }`}
                                            >
                                                <div className={`flex-shrink-0 w-4 h-4 rounded-md border-2 flex items-center justify-center transition-colors ${
                                                    selectedParentIds.includes(parent.id) ? 'bg-white border-white' : 'border-gray-300 dark:border-gray-600'
                                                }`}>
                                                    {selectedParentIds.includes(parent.id) && <Check size={10} className="text-blue-600 font-black" />}
                                                </div>
                                                <span className="truncate">{parent.value}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-gray-400 text-center italic font-medium">
                                        Items will be linked to the selected parents.
                                    </p>
                                </div>
                            )}

                        </div>

                        {/* Modal Footer */}
                        <div className="px-10 py-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-4 bg-gray-50/50 dark:bg-gray-800/20 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-8 py-4 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all"
                            >
                                Discard
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving || (!value.trim() && selectedChildIds.length === 0)}
                                className={`flex items-center gap-3 px-10 py-4 text-xs font-black uppercase tracking-widest text-white rounded-2xl transition-all shadow-2xl disabled:opacity-50 active:scale-95 group/btn ${
                                    value ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/40' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/40'
                                }`}
                            >
                                {isSaving ? (
                                    <div className="w-4 h-4 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save size={18} className="group-hover/btn:rotate-12 transition-transform" />
                                )}
                                <span>
                                    {editingOption ? 'Update Attribute' : value ? 'Create & Link' : `Link ${selectedChildIds.length} Items`}
                                </span>
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
