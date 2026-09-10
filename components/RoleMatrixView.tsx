import React, { useState, useMemo } from 'react';
import { 
    X, 
    Search, 
    Check, 
    Minus, 
    Download, 
    Filter, 
    Shield, 
    Layers, 
    Grid,
    SlidersHorizontal,
    Info
} from 'lucide-react';
import { RoleDefinition, PermissionId } from '../types.ts';
import { PERMISSION_GROUPS } from '../constants/permissions.ts';

interface RoleMatrixViewProps {
    isOpen: boolean;
    onClose: () => void;
    roles: RoleDefinition[];
    onTogglePermission?: (roleId: string, permissionId: PermissionId) => Promise<void>;
}

export const RoleMatrixView: React.FC<RoleMatrixViewProps> = ({
    isOpen,
    onClose,
    roles,
    onTogglePermission
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedModule, setSelectedModule] = useState<string>('ALL');
    const [selectedType, setSelectedType] = useState<'ALL' | 'SCREEN' | 'ACTION' | 'EXPORT'>('ALL');

    // Filtered permissions list
    const filteredGroups = useMemo(() => {
        return PERMISSION_GROUPS.map(group => {
            if (selectedModule !== 'ALL' && group.id !== selectedModule) return null;
            const matchedPerms = group.permissions.filter(p => {
                const matchesSearch = p.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                      p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                      p.id.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesType = selectedType === 'ALL' || p.type === selectedType;
                return matchesSearch && matchesType;
            });
            if (matchedPerms.length === 0) return null;
            return { ...group, permissions: matchedPerms };
        }).filter(Boolean) as typeof PERMISSION_GROUPS;
    }, [searchTerm, selectedModule, selectedType]);

    // CSV Export for Compliance
    const handleExportMatrix = () => {
        const headers = ['Category', 'Permission Name', 'Permission ID', 'Type', ...roles.map(r => r.name)];
        const rows: string[][] = [];

        PERMISSION_GROUPS.forEach(group => {
            group.permissions.forEach(perm => {
                const row = [
                    group.label,
                    `"${perm.label.replace(/"/g, '""')}"`,
                    perm.id,
                    perm.type,
                    ...roles.map(r => r.permissions.includes(perm.id) ? 'GRANTED' : 'DENIED')
                ];
                rows.push(row);
            });
        });

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `ProcureFlow_Security_Role_Matrix_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-[#181a24] rounded-3xl shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-800 animate-slide-up">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center">
                            <Grid size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Security Roles Audit Matrix</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Cross-tabulated authorization overview across all roles and permissions</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleExportMatrix}
                            className="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-white/5 text-xs font-bold text-gray-700 dark:text-gray-300 transition-all flex items-center gap-2"
                        >
                            <Download size={14} /> Export CSV Matrix
                        </button>
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Filter Toolbar */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#15171e] flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-[260px]">
                        <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search capability or ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#181a24] border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20"
                            />
                        </div>

                        {/* Module Selector */}
                        <select
                            value={selectedModule}
                            onChange={(e) => setSelectedModule(e.target.value)}
                            className="bg-gray-50 dark:bg-[#181a24] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-bold outline-none text-gray-700 dark:text-gray-300"
                        >
                            <option value="ALL">All Categories</option>
                            {PERMISSION_GROUPS.map(g => (
                                <option key={g.id} value={g.id}>{g.label}</option>
                            ))}
                        </select>

                        {/* Type Filter */}
                        <div className="flex bg-gray-50 dark:bg-[#181a24] border border-gray-200 dark:border-gray-700 rounded-xl p-1">
                            {(['ALL', 'SCREEN', 'ACTION', 'EXPORT'] as const).map(t => (
                                <button
                                    type="button"
                                    key={t}
                                    onClick={() => setSelectedType(t)}
                                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${selectedType === t ? 'bg-[var(--color-brand)] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    {t === 'ALL' ? 'All' : t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-400">
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Granted</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-700" /> Denied</div>
                    </div>
                </div>

                {/* The Matrix Table */}
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 z-20 bg-gray-100/90 dark:bg-[#15171e]/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
                            <tr>
                                <th className="p-4 min-w-[280px] sticky left-0 z-30 bg-gray-100/90 dark:bg-[#15171e]/90 text-[10px] font-black uppercase tracking-wider text-gray-500">
                                    Capability / Permission
                                </th>
                                {roles.map(role => (
                                    <th key={role.id} className="p-4 text-center min-w-[140px] border-l border-gray-200/50 dark:border-gray-800">
                                        <div className="font-black text-xs text-gray-900 dark:text-white truncate" title={role.name}>
                                            {role.name}
                                        </div>
                                        <div className="text-[9px] font-mono text-gray-400 mt-0.5">{role.id}</div>
                                        {role.isSystem && (
                                            <span className="mt-1 inline-block text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-gray-200 dark:bg-gray-800 text-gray-500">
                                                System
                                            </span>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                            {filteredGroups.map(group => (
                                <React.Fragment key={group.id}>
                                    {/* Category Subheader */}
                                    <tr className="bg-gray-50/70 dark:bg-white/[0.02]">
                                        <td 
                                            colSpan={roles.length + 1} 
                                            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-brand)] bg-gray-50/90 dark:bg-[#15171e]/90 sticky left-0"
                                        >
                                            <div className="flex items-center gap-2">
                                                <group.icon size={13} />
                                                <span>{group.label}</span>
                                                <span className="text-gray-400 font-normal">({group.permissions.length} capabilities)</span>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Permission Rows */}
                                    {group.permissions.map(perm => (
                                        <tr key={perm.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                                            <td className="p-4 sticky left-0 z-10 bg-white dark:bg-[#181a24] border-r border-gray-100 dark:border-gray-800">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-gray-900 dark:text-white">{perm.label}</span>
                                                    <span className={`text-[8px] font-black px-1.5 py-0.2 rounded uppercase ${
                                                        perm.type === 'SCREEN' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        perm.type === 'EXPORT' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                    }`}>
                                                        {perm.type}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{perm.description}</div>
                                            </td>

                                            {roles.map(role => {
                                                const isGranted = role.permissions.includes(perm.id);
                                                const isLocked = role.id === 'ADMIN' && perm.id === 'manage_settings';

                                                return (
                                                    <td 
                                                        key={role.id} 
                                                        className={`p-3 text-center border-l border-gray-100 dark:border-gray-800/60 transition-colors ${
                                                            isGranted ? 'bg-emerald-500/[0.03]' : ''
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-center">
                                                            {onTogglePermission && !isLocked ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onTogglePermission(role.id, perm.id)}
                                                                    className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                                                                        isGranted 
                                                                            ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20 hover:scale-105' 
                                                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                                    }`}
                                                                >
                                                                    {isGranted ? <Check size={14} /> : <Minus size={12} />}
                                                                </button>
                                                            ) : (
                                                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                                                                    isGranted ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'text-gray-300 dark:text-gray-700'
                                                                }`}>
                                                                    {isGranted ? <Check size={14} /> : <Minus size={12} />}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/[0.02] flex items-center justify-between text-xs text-gray-500">
                    <div>
                        Showing <span className="font-bold text-gray-900 dark:text-white">{filteredGroups.reduce((acc, g) => acc + g.permissions.length, 0)}</span> capabilities across <span className="font-bold text-gray-900 dark:text-white">{roles.length}</span> roles
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                        <Info size={13} />
                        <span>Changes made here update the role definition in real time.</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoleMatrixView;
