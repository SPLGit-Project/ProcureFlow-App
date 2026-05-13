import React, { useState, useMemo } from 'react';
import { 
    ChevronDown, 
    Shield, 
    Layout, 
    Zap, 
    Search,
    Filter
} from 'lucide-react';
import { PermissionId, RoleDefinition } from '../types.ts';
import { PERMISSION_GROUPS } from '../constants/permissions.ts';

interface RoleTreeManagerProps {
    activeRole: RoleDefinition;
    onUpdatePermissions: (newPermissions: PermissionId[]) => void;
    saveStatus?: 'idle' | 'saving' | 'saved';
}

const RoleTreeManager: React.FC<RoleTreeManagerProps> = ({ 
    activeRole, 
    onUpdatePermissions,
    saveStatus = 'idle'
}) => {
    const [expandedGroups, setExpandedGroups] = useState<string[]>(PERMISSION_GROUPS.map(g => g.id));
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'ALL' | 'SCREEN' | 'ACTION'>('ALL');

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => 
            prev.includes(groupId) 
                ? prev.filter(id => id !== groupId) 
                : [...prev, groupId]
        );
    };

    const togglePermission = (permissionId: PermissionId) => {
        if (activeRole.id === 'ADMIN' && permissionId === 'manage_settings') return; // Protect admin
        
        const isEnabled = activeRole.permissions.includes(permissionId);
        const newPermissions = isEnabled
            ? activeRole.permissions.filter(p => p !== permissionId)
            : [...activeRole.permissions, permissionId];
        
        onUpdatePermissions(newPermissions);
    };

    const toggleGroupBulk = (groupId: string, select: boolean) => {
        const group = PERMISSION_GROUPS.find(g => g.id === groupId);
        if (!group) return;

        const groupPermIds = group.permissions.map(p => p.id);
        let newPermissions: PermissionId[];

        if (select) {
            newPermissions = Array.from(new Set([...activeRole.permissions, ...groupPermIds]));
        } else {
            // Respect admin lock
            newPermissions = activeRole.permissions.filter(p => {
                if (activeRole.id === 'ADMIN' && p === 'manage_settings') return true;
                return !groupPermIds.includes(p);
            });
        }

        onUpdatePermissions(newPermissions);
    };

    const filteredGroups = useMemo(() => {
        return PERMISSION_GROUPS.map(group => {
            const matchedPermissions = group.permissions.filter(p => {
                const matchesSearch = p.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                     p.description.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesType = filterType === 'ALL' || p.type === filterType;
                return matchesSearch && matchesType;
            });

            return {
                ...group,
                permissions: matchedPermissions
            };
        }).filter(group => group.permissions.length > 0);
    }, [searchTerm, filterType]);

    const stats = useMemo(() => {
        const total = PERMISSION_GROUPS.reduce((acc, g) => acc + g.permissions.length, 0);
        const active = activeRole.permissions.length;
        return { total, active, percent: Math.round((active / total) * 100) };
    }, [activeRole.permissions]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input 
                            type="text"
                            placeholder="Search permissions..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 transition-all"
                        />
                    </div>
                    <div className="flex bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl p-1">
                        {(['ALL', 'SCREEN', 'ACTION'] as const).map(t => (
                            <button
                                type="button"
                                key={t}
                                onClick={() => setFilterType(t)}
                                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all ${filterType === t ? 'bg-[var(--color-brand)] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                            >
                                {t === 'ALL' ? 'Everything' : t === 'SCREEN' ? 'Screens' : 'Actions'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex flex-col items-end">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Coverage</div>
                        <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-[var(--color-brand)] transition-all duration-500" 
                                    style={{ width: `${stats.percent}%` }}
                                />
                            </div>
                            <span className="text-xs font-black text-gray-700 dark:text-gray-300">{stats.percent}%</span>
                        </div>
                    </div>
                    {saveStatus !== 'idle' && (
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight border animate-fade-in ${
                            saveStatus === 'saving' ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-green-50 border-green-100 text-green-600'
                        }`}>
                            {saveStatus === 'saving' ? 'Saving changes...' : 'Changes synced'}
                        </div>
                    )}
                </div>
            </div>

            {/* Tree Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {filteredGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <Filter size={48} className="opacity-10 mb-4" />
                        <p className="text-sm font-medium">No permissions match your criteria.</p>
                    </div>
                ) : (
                    filteredGroups.map(group => {
                        const isExpanded = expandedGroups.includes(group.id);
                        const groupPermIds = group.permissions.map(p => p.id);
                        const selectedInGroup = groupPermIds.filter(id => activeRole.permissions.includes(id));
                        const isAllSelected = selectedInGroup.length === groupPermIds.length;

                        return (
                            <div key={group.id} className="group/category border border-gray-100 dark:border-gray-800/50 rounded-2xl overflow-hidden transition-all hover:border-gray-200 dark:hover:border-gray-700">
                                {/* Group Header */}
                                <div className={`px-4 py-3 flex items-center justify-between cursor-pointer select-none transition-colors ${isExpanded ? 'bg-gray-50/80 dark:bg-white/5 border-b border-gray-100 dark:border-gray-800' : 'bg-white dark:bg-nocturne'}`} onClick={() => toggleGroup(group.id)}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl transition-all ${isExpanded ? 'bg-[var(--color-brand)] text-white shadow-lg shadow-[var(--color-brand)]/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                                            <group.icon size={18} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{group.label}</h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] font-bold text-gray-400">{group.permissions.length} total</span>
                                                <span className="w-1 h-1 rounded-full bg-gray-300" />
                                                <span className="text-[10px] font-bold text-[var(--color-brand)]">{selectedInGroup.length} enabled</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4">
                                        <button 
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleGroupBulk(group.id, !isAllSelected);
                                            }}
                                            className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                                                isAllSelected 
                                                    ? 'bg-red-50 border-red-100 text-red-500 hover:bg-red-100' 
                                                    : 'bg-[var(--color-brand)]/5 border-[var(--color-brand)]/20 text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10'
                                            }`}
                                        >
                                            {isAllSelected ? 'Deselect Group' : 'Grant Group'}
                                        </button>
                                        <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                            <ChevronDown size={20} className="text-gray-400" />
                                        </div>
                                    </div>
                                </div>

                                {/* Group Body (Tree Items) */}
                                {isExpanded && (
                                    <div className="bg-white dark:bg-[#15171e]/50 divide-y divide-gray-50 dark:divide-gray-800/50">
                                        {group.permissions.map((perm) => {
                                            const isEnabled = activeRole.permissions.includes(perm.id);
                                            const isLocked = activeRole.id === 'ADMIN' && perm.id === 'manage_settings';

                                            return (
                                                <div 
                                                    key={perm.id} 
                                                    className={`group/item flex items-center justify-between p-4 pl-8 hover:bg-gray-50 dark:hover:bg-white/5 transition-all ${isEnabled ? 'bg-[var(--color-brand)]/[0.02]' : ''}`}
                                                >
                                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                                        {/* Visual Tree Connector */}
                                                        <div className="relative self-stretch flex items-center">
                                                            <div className="absolute left-[-20px] top-[-16px] bottom-[-16px] w-[1px] bg-gray-100 dark:bg-gray-800" />
                                                            <div className="absolute left-[-20px] top-1/2 w-4 h-[1px] bg-gray-100 dark:bg-gray-800" />
                                                        </div>

                                                        <div className={`p-2 rounded-lg transition-colors ${isEnabled ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                                                            {perm.type === 'SCREEN' ? <Layout size={14} /> : <Zap size={14} />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-xs font-bold transition-colors ${isEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>{perm.label}</span>
                                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${perm.type === 'SCREEN' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                                                    {perm.type}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{perm.description}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        {isLocked && (
                                                            <span title="System Protected">
                                                                <Shield size={12} className="text-gray-300" />
                                                            </span>
                                                        )}
                                                        <button 
                                                            type="button"
                                                            disabled={isLocked}
                                                            onClick={() => togglePermission(perm.id)}
                                                            className={`relative w-10 h-5 rounded-full transition-all duration-300 focus:outline-none ring-offset-2 focus:ring-2 ${
                                                                isEnabled 
                                                                    ? 'bg-[var(--color-brand)] focus:ring-[var(--color-brand)]/30' 
                                                                    : 'bg-gray-200 dark:bg-gray-700 focus:ring-gray-300'
                                                            } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            <div className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full shadow-sm transition-transform duration-300 ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer Summary */}
            <div className="px-6 py-3 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                        Screens: {activeRole.permissions.filter(id => PERMISSION_GROUPS.flatMap(g => g.permissions).find(p => p.id === id && p.type === 'SCREEN')).length}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        Actions: {activeRole.permissions.filter(id => PERMISSION_GROUPS.flatMap(g => g.permissions).find(p => p.id === id && p.type === 'ACTION')).length}
                    </div>
                </div>
                <div className="text-[10px] font-medium text-gray-400 italic">
                    Tip: Use Select All on a category to grant full access to a module.
                </div>
            </div>
        </div>
    );
};

export default RoleTreeManager;
