import React, { useState, useMemo, useEffect } from 'react';
import { 
    X, 
    Shield, 
    ChevronRight, 
    ChevronLeft, 
    Check, 
    Copy, 
    Sparkles, 
    FileText, 
    DollarSign, 
    Globe, 
    UserCheck, 
    Search, 
    Filter, 
    AlertCircle,
    Sliders,
    Layers,
    Lock,
    Users
} from 'lucide-react';
import { RoleDefinition, PermissionId, User } from '../types.ts';
import { PERMISSION_GROUPS } from '../constants/permissions.ts';
import { ROLE_PRESETS, RolePreset } from '../constants/rolePresets.ts';

interface RoleCreationWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newRole: RoleDefinition, assignedUserIds: string[]) => Promise<void>;
    existingRoles: RoleDefinition[];
    users: User[];
    cloneFromRole?: RoleDefinition | null;
}

export const RoleCreationWizard: React.FC<RoleCreationWizardProps> = ({
    isOpen,
    onClose,
    onSave,
    existingRoles,
    users,
    cloneFromRole
}) => {
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Step 1: Starter Method & Identity
    const [creationMethod, setCreationMethod] = useState<'BLANK' | 'CLONE' | 'PRESET'>('BLANK');
    const [selectedCloneRoleId, setSelectedCloneRoleId] = useState<string>('');
    const [selectedPresetId, setSelectedPresetId] = useState<string>('');
    const [roleName, setRoleName] = useState('');
    const [roleDescription, setRoleDescription] = useState('');
    const [roleId, setRoleId] = useState('');
    const [isIdManuallyEdited, setIsIdManuallyEdited] = useState(false);

    // Step 2: Governance & Authority Limits
    const [maxOrderLimit, setMaxOrderLimit] = useState<number>(0);
    const [maxApprovalLimit, setMaxApprovalLimit] = useState<number>(0);
    const [siteScopeMode, setSiteScopeMode] = useState<'ALL' | 'ASSIGNED' | 'REGIONAL'>('ASSIGNED');
    const [enforceSod, setEnforceSod] = useState<boolean>(true);

    // Step 3: Permissions
    const [selectedPermissions, setSelectedPermissions] = useState<PermissionId[]>([]);
    const [permSearchTerm, setPermSearchTerm] = useState('');
    const [permFilterType, setPermFilterType] = useState<'ALL' | 'SCREEN' | 'ACTION' | 'EXPORT'>('ALL');
    const [expandedCategories, setExpandedCategories] = useState<string[]>(PERMISSION_GROUPS.map(g => g.id));

    // Step 4: Assigned Users
    const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
    const [userSearchTerm, setUserSearchTerm] = useState('');

    // Pre-populate if cloned
    useEffect(() => {
        if (!isOpen) return;
        if (cloneFromRole) {
            setCreationMethod('CLONE');
            setSelectedCloneRoleId(cloneFromRole.id);
            setRoleName(`${cloneFromRole.name} (Copy)`);
            setRoleId(`${cloneFromRole.id}_COPY`);
            setRoleDescription(cloneFromRole.description ? `Cloned from ${cloneFromRole.name}: ${cloneFromRole.description}` : '');
            setSelectedPermissions([...cloneFromRole.permissions]);
            setMaxApprovalLimit(cloneFromRole.maxApprovalLimit || 0);
            setMaxOrderLimit(cloneFromRole.maxOrderLimit || 0);
            setSiteScopeMode(cloneFromRole.siteScopeMode || 'ASSIGNED');
            setEnforceSod(cloneFromRole.enforceSod !== false);
            setIsIdManuallyEdited(true);
        } else {
            resetWizard();
        }
    }, [isOpen, cloneFromRole]);

    const resetWizard = () => {
        setStep(1);
        setCreationMethod('BLANK');
        setSelectedCloneRoleId('');
        setSelectedPresetId('');
        setRoleName('');
        setRoleDescription('');
        setRoleId('');
        setIsIdManuallyEdited(false);
        setMaxOrderLimit(0);
        setMaxApprovalLimit(0);
        setSiteScopeMode('ASSIGNED');
        setEnforceSod(true);
        setSelectedPermissions([]);
        setAssignedUserIds([]);
        setPermSearchTerm('');
        setUserSearchTerm('');
        setIsSubmitting(false);
    };

    // Auto-slugify role name into roleId if not manually customized
    const handleNameChange = (val: string) => {
        setRoleName(val);
        if (!isIdManuallyEdited) {
            const slug = val
                .toUpperCase()
                .trim()
                .replace(/[^A-Z0-9\s_]/g, '')
                .replace(/\s+/g, '_')
                .slice(0, 32);
            setRoleId(slug);
        }
    };

    // When selecting a preset
    const handlePresetSelect = (preset: RolePreset) => {
        setSelectedPresetId(preset.id);
        setRoleName(preset.name);
        setRoleDescription(preset.description);
        setRoleId(preset.name.toUpperCase().replace(/[^A-Z0-9\s_]/g, '').replace(/\s+/g, '_').slice(0, 32));
        setIsIdManuallyEdited(false);
        setMaxApprovalLimit(preset.maxApprovalLimit);
        setMaxOrderLimit(preset.maxOrderLimit);
        setSiteScopeMode(preset.siteScopeMode);
        setEnforceSod(preset.enforceSod);
        setSelectedPermissions([...preset.permissions]);
    };

    // When selecting a clone source
    const handleCloneSelect = (sourceRoleId: string) => {
        setSelectedCloneRoleId(sourceRoleId);
        const source = existingRoles.find(r => r.id === sourceRoleId);
        if (source) {
            setRoleName(`${source.name} (Copy)`);
            setRoleDescription(source.description ? `Copy of ${source.name}` : '');
            setRoleId(`${source.id}_COPY`.slice(0, 32));
            setIsIdManuallyEdited(true);
            setMaxApprovalLimit(source.maxApprovalLimit || 0);
            setMaxOrderLimit(source.maxOrderLimit || 0);
            setSiteScopeMode(source.siteScopeMode || 'ASSIGNED');
            setEnforceSod(source.enforceSod !== false);
            setSelectedPermissions([...source.permissions]);
        }
    };

    // Toggle single permission
    const togglePermission = (permId: PermissionId) => {
        setSelectedPermissions(prev => 
            prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
        );
    };

    // Bulk toggle category
    const toggleCategory = (categoryId: string, selectAll: boolean) => {
        const group = PERMISSION_GROUPS.find(g => g.id === categoryId);
        if (!group) return;
        const groupIds = group.permissions.map(p => p.id);

        if (selectAll) {
            setSelectedPermissions(prev => Array.from(new Set([...prev, ...groupIds])));
        } else {
            setSelectedPermissions(prev => prev.filter(id => !groupIds.includes(id)));
        }
    };

    // Filtered permissions
    const filteredGroups = useMemo(() => {
        return PERMISSION_GROUPS.map(group => {
            const matched = group.permissions.filter(p => {
                const matchesSearch = p.label.toLowerCase().includes(permSearchTerm.toLowerCase()) ||
                                      p.description.toLowerCase().includes(permSearchTerm.toLowerCase()) ||
                                      p.id.toLowerCase().includes(permSearchTerm.toLowerCase());
                const matchesType = permFilterType === 'ALL' || p.type === permFilterType;
                return matchesSearch && matchesType;
            });
            return { ...group, permissions: matched };
        }).filter(g => g.permissions.length > 0);
    }, [permSearchTerm, permFilterType]);

    // Filtered users for assignment
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            if (u.status === 'ARCHIVED') return false;
            const term = userSearchTerm.toLowerCase();
            return u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term) || (u.jobTitle || '').toLowerCase().includes(term);
        });
    }, [users, userSearchTerm]);

    // Validation
    const isStep1Valid = roleName.trim().length >= 3 && roleId.trim().length >= 2;

    const handleFinalSave = async () => {
        if (!isStep1Valid) return;
        setIsSubmitting(true);
        try {
            const newRole: RoleDefinition = {
                id: roleId.trim(),
                name: roleName.trim(),
                description: roleDescription.trim(),
                permissions: selectedPermissions,
                isSystem: false,
                maxApprovalLimit: Number(maxApprovalLimit) || 0,
                maxOrderLimit: Number(maxOrderLimit) || 0,
                siteScopeMode,
                enforceSod,
                allowedCategories: []
            };
            await onSave(newRole, assignedUserIds);
            onClose();
        } catch (e) {
            console.error('Failed to create role via wizard', e);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-[#181a24] rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-800 animate-slide-up">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center shadow-inner">
                            <Shield size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Create Customizable Security Role</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Step {step} of 4: {
                                step === 1 ? 'Role Identity & Template' :
                                step === 2 ? 'Authority Limits & Governance' :
                                step === 3 ? 'Granular Permissions' : 'Assign Members & Finalize'
                            }</p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Stepper Progress Indicator */}
                <div className="px-8 py-3 bg-white dark:bg-[#15171e] border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    {[
                        { num: 1, label: 'Identity & Source' },
                        { num: 2, label: 'Limits & Scope' },
                        { num: 3, label: 'Permissions' },
                        { num: 4, label: 'Members & Review' },
                    ].map((s, idx) => {
                        const isActive = step === s.num;
                        const isDone = step > s.num;
                        return (
                            <React.Fragment key={s.num}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (s.num === 1 || isStep1Valid) setStep(s.num as any);
                                    }}
                                    disabled={s.num > 1 && !isStep1Valid}
                                    className={`flex items-center gap-2 group transition-all text-left ${isActive ? 'opacity-100' : isDone ? 'opacity-80' : 'opacity-40'}`}
                                >
                                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                                        isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-[var(--color-brand)] text-white shadow-md shadow-[var(--color-brand)]/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                                    }`}>
                                        {isDone ? <Check size={14} /> : s.num}
                                    </div>
                                    <span className={`text-xs font-bold hidden sm:inline ${isActive ? 'text-[var(--color-brand)]' : 'text-gray-600 dark:text-gray-300'}`}>
                                        {s.label}
                                    </span>
                                </button>
                                {idx < 3 && (
                                    <div className={`flex-1 h-[2px] mx-3 rounded-full transition-colors ${step > idx + 1 ? 'bg-emerald-500' : 'bg-gray-100 dark:bg-gray-800'}`} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {/* STEP 1: IDENTITY & TEMPLATE */}
                    {step === 1 && (
                        <div className="space-y-6 animate-fade-in">
                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-3">Choose Starting Point</label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setCreationMethod('BLANK')}
                                        className={`p-4 rounded-2xl border text-left transition-all ${creationMethod === 'BLANK' ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 ring-2 ring-[var(--color-brand)]/20' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-[#15171e]'}`}
                                    >
                                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-2">
                                            <FileText size={18} />
                                        </div>
                                        <div className="font-bold text-sm text-gray-900 dark:text-white">Start from Scratch</div>
                                        <div className="text-[11px] text-gray-400 mt-1">Configure limits and permissions freely from a clean slate.</div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setCreationMethod('PRESET')}
                                        className={`p-4 rounded-2xl border text-left transition-all ${creationMethod === 'PRESET' ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 ring-2 ring-[var(--color-brand)]/20' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-[#15171e]'}`}
                                    >
                                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-2">
                                            <Sparkles size={18} />
                                        </div>
                                        <div className="font-bold text-sm text-gray-900 dark:text-white">Use Preset Template</div>
                                        <div className="text-[11px] text-gray-400 mt-1">Pre-configured best practice roles for operations, finance, & audit.</div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setCreationMethod('CLONE')}
                                        className={`p-4 rounded-2xl border text-left transition-all ${creationMethod === 'CLONE' ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 ring-2 ring-[var(--color-brand)]/20' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-[#15171e]'}`}
                                    >
                                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-2">
                                            <Copy size={18} />
                                        </div>
                                        <div className="font-bold text-sm text-gray-900 dark:text-white">Clone Existing Role</div>
                                        <div className="text-[11px] text-gray-400 mt-1">Duplicate an existing role to customize limits or add privileges.</div>
                                    </button>
                                </div>
                            </div>

                            {/* Preset Picker */}
                            {creationMethod === 'PRESET' && (
                                <div className="space-y-3 p-4 bg-gray-50 dark:bg-white/[0.02] rounded-2xl border border-gray-100 dark:border-gray-800">
                                    <div className="text-xs font-bold text-gray-700 dark:text-gray-300">Select an Operational Preset:</div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto custom-scrollbar p-1">
                                        {ROLE_PRESETS.map(preset => {
                                            const isSelected = selectedPresetId === preset.id;
                                            return (
                                                <button
                                                    type="button"
                                                    key={preset.id}
                                                    onClick={() => handlePresetSelect(preset)}
                                                    className={`p-3 rounded-xl border text-left transition-all flex items-start justify-between gap-3 ${isSelected ? 'border-[var(--color-brand)] bg-white dark:bg-[#181a24] shadow-sm ring-2 ring-[var(--color-brand)]/20' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] hover:border-gray-300'}`}
                                                >
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-xs text-gray-900 dark:text-white">{preset.name}</span>
                                                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">{preset.badge}</span>
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">{preset.description}</p>
                                                    </div>
                                                    {isSelected && <div className="w-5 h-5 rounded-full bg-[var(--color-brand)] text-white flex items-center justify-center flex-shrink-0"><Check size={12} /></div>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Clone Picker */}
                            {creationMethod === 'CLONE' && (
                                <div className="space-y-3 p-4 bg-gray-50 dark:bg-white/[0.02] rounded-2xl border border-gray-100 dark:border-gray-800">
                                    <div className="text-xs font-bold text-gray-700 dark:text-gray-300">Select Role to Duplicate:</div>
                                    <select
                                        value={selectedCloneRoleId}
                                        onChange={(e) => handleCloneSelect(e.target.value)}
                                        className="w-full bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                                    >
                                        <option value="">-- Choose Role to Clone --</option>
                                        {existingRoles.map(r => (
                                            <option key={r.id} value={r.id}>{r.name} ({r.permissions.length} permissions)</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Role Identification Inputs */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1.5">Role Display Name *</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Regional Procurement Lead"
                                        value={roleName}
                                        onChange={(e) => handleNameChange(e.target.value)}
                                        className="w-full bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-[var(--color-brand)] font-bold text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1.5">Role Identifier (System ID) *</label>
                                    <input 
                                        type="text" 
                                        placeholder="REGIONAL_PROCUREMENT_LEAD"
                                        value={roleId}
                                        onChange={(e) => {
                                            setIsIdManuallyEdited(true);
                                            setRoleId(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''));
                                        }}
                                        className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-[var(--color-brand)] font-mono text-gray-700 dark:text-gray-300"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1.5">Role Scope & Purpose Description</label>
                                <textarea 
                                    rows={2}
                                    placeholder="Describe who should hold this role and what authority is granted..."
                                    value={roleDescription}
                                    onChange={(e) => setRoleDescription(e.target.value)}
                                    className="w-full bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-[var(--color-brand)] text-gray-700 dark:text-gray-300 resize-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 2: AUTHORITY LIMITS & GOVERNANCE */}
                    {step === 2 && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 flex items-start gap-3 text-xs text-blue-700 dark:text-blue-300">
                                <Sliders size={18} className="flex-shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-bold">Multi-Dimensional Authority:</span> Financial limits and data boundaries restrict the risk of rogue purchases or unauthorised approvals, regardless of individual permission toggles.
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {/* Order Spend Limit */}
                                <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600"><DollarSign size={16} /></div>
                                        <div>
                                            <div className="font-bold text-xs text-gray-900 dark:text-white">Max Order Creation Limit</div>
                                            <div className="text-[10px] text-gray-400">Maximum order total ($) this role can submit.</div>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                        <input
                                            type="number"
                                            min={0}
                                            step={500}
                                            value={maxOrderLimit}
                                            onChange={(e) => setMaxOrderLimit(Math.max(0, Number(e.target.value)))}
                                            className="w-full pl-8 pr-4 py-2.5 bg-gray-50 dark:bg-[#181a24] border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                                        />
                                    </div>
                                    <div className="text-[10px] text-gray-400 italic">Enter 0 for unlimited ordering limit.</div>
                                </div>

                                {/* Approval Spend Limit */}
                                <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"><Shield size={16} /></div>
                                        <div>
                                            <div className="font-bold text-xs text-gray-900 dark:text-white">Max Approval Limit</div>
                                            <div className="text-[10px] text-gray-400">Maximum purchase value ($) this role can approve.</div>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                        <input
                                            type="number"
                                            min={0}
                                            step={1000}
                                            value={maxApprovalLimit}
                                            onChange={(e) => setMaxApprovalLimit(Math.max(0, Number(e.target.value)))}
                                            className="w-full pl-8 pr-4 py-2.5 bg-gray-50 dark:bg-[#181a24] border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                                        />
                                    </div>
                                    <div className="text-[10px] text-gray-400 italic">Enter 0 for unlimited approval authority.</div>
                                </div>
                            </div>

                            {/* Site Scope Mode */}
                            <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600"><Globe size={16} /></div>
                                    <div>
                                        <div className="font-bold text-xs text-gray-900 dark:text-white">Data Boundary & Site Scoping</div>
                                        <div className="text-[10px] text-gray-400">Controls which sites this role is allowed to view and order against.</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {[
                                        { id: 'ASSIGNED', title: 'Assigned Sites Only', desc: 'Restricted strictly to sites assigned to the user profile.' },
                                        { id: 'REGIONAL', title: 'Regional Scope', desc: 'Allows access to all sites sharing the user’s primary state/region.' },
                                        { id: 'ALL', title: 'All Sites (Enterprise)', desc: 'Unrestricted enterprise-wide access across all company locations.' },
                                    ].map(opt => (
                                        <button
                                            type="button"
                                            key={opt.id}
                                            onClick={() => setSiteScopeMode(opt.id as any)}
                                            className={`p-3.5 rounded-xl border text-left transition-all ${siteScopeMode === opt.id ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 ring-2 ring-[var(--color-brand)]/20' : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-white/5 hover:border-gray-300'}`}
                                        >
                                            <div className="font-bold text-xs text-gray-900 dark:text-white">{opt.title}</div>
                                            <p className="text-[10px] text-gray-400 mt-1">{opt.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Segregation of Duties (SoD) */}
                            <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600"><Lock size={16} /></div>
                                        <div>
                                            <div className="font-bold text-xs text-gray-900 dark:text-white">Enforce Segregation of Duties (SoD)</div>
                                            <div className="text-[10px] text-gray-400">Institutional compliance protection against self-approval and self-receipting.</div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEnforceSod(!enforceSod)}
                                        className={`w-11 h-6 rounded-full transition-colors relative ${enforceSod ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-1 transition-transform ${enforceSod ? 'right-1' : 'left-1'}`} />
                                    </button>
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                    When enabled, users with this role will be blocked from approving their own purchase orders, and blocked from receipting delivery of orders they created, ensuring dual-custody verification.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: GRANULAR PERMISSIONS */}
                    {step === 3 && (
                        <div className="space-y-4 animate-fade-in">
                            {/* Toolbar */}
                            <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                    <div className="relative flex-1">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Filter permissions..."
                                            value={permSearchTerm}
                                            onChange={(e) => setPermSearchTerm(e.target.value)}
                                            className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20"
                                        />
                                    </div>
                                    <div className="flex bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl p-0.5">
                                        {(['ALL', 'SCREEN', 'ACTION', 'EXPORT'] as const).map(t => (
                                            <button
                                                type="button"
                                                key={t}
                                                onClick={() => setPermFilterType(t)}
                                                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${permFilterType === t ? 'bg-[var(--color-brand)] text-white' : 'text-gray-400 hover:text-gray-600'}`}
                                            >
                                                {t === 'ALL' ? 'All' : t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="text-xs font-bold text-gray-500">
                                    <span className="text-[var(--color-brand)]">{selectedPermissions.length}</span> granted
                                </div>
                            </div>

                            {/* Permission Categories */}
                            <div className="space-y-3">
                                {filteredGroups.map(group => {
                                    const groupPermIds = group.permissions.map(p => p.id);
                                    const selectedCount = groupPermIds.filter(id => selectedPermissions.includes(id)).length;
                                    const isAllSelected = selectedCount === groupPermIds.length;
                                    const isExpanded = expandedCategories.includes(group.id);

                                    return (
                                        <div key={group.id} className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-[#15171e]">
                                            <div 
                                                className="px-4 py-3 flex items-center justify-between cursor-pointer select-none bg-gray-50/50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-gray-800/60"
                                                onClick={() => {
                                                    setExpandedCategories(prev => 
                                                        prev.includes(group.id) ? prev.filter(id => id !== group.id) : [...prev, group.id]
                                                    );
                                                }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-1.5 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                                        <group.icon size={16} />
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">{group.label}</span>
                                                        <span className="text-[10px] text-gray-400 ml-2 font-bold">{selectedCount}/{group.permissions.length} enabled</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCategory(group.id, !isAllSelected)}
                                                        className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300"
                                                    >
                                                        {isAllSelected ? 'Clear' : 'Select All'}
                                                    </button>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {group.permissions.map(perm => {
                                                        const isChecked = selectedPermissions.includes(perm.id);
                                                        return (
                                                            <div
                                                                key={perm.id}
                                                                onClick={() => togglePermission(perm.id)}
                                                                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                                                                    isChecked 
                                                                        ? 'bg-[var(--color-brand)]/5 border-[var(--color-brand)]/40 text-gray-900 dark:text-white' 
                                                                        : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 text-gray-500'
                                                                }`}
                                                            >
                                                                <div className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                                                                    isChecked ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white' : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181a24]'
                                                                }`}>
                                                                    {isChecked && <Check size={11} />}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-xs font-bold truncate">{perm.label}</span>
                                                                        <span className={`text-[8px] font-black px-1.5 py-0.2 rounded uppercase ${
                                                                            perm.type === 'SCREEN' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                                            perm.type === 'EXPORT' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                                            'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                                        }`}>
                                                                            {perm.type}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{perm.description}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* STEP 4: MEMBERS & SUMMARY REVIEW */}
                    {step === 4 && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Role Summary Card */}
                            <div className="p-5 rounded-3xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#181a24] dark:to-[#15171e] border border-gray-200 dark:border-gray-800 space-y-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-black text-gray-900 dark:text-white">{roleName}</h3>
                                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300">{roleId}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{roleDescription || 'No description provided.'}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-black text-[var(--color-brand)]">{selectedPermissions.length} Permissions</div>
                                        <div className="text-[10px] text-gray-400">{assignedUserIds.length} Initial Members</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-200/60 dark:border-gray-800">
                                    <div>
                                        <div className="text-[9px] font-black uppercase text-gray-400">Order Limit</div>
                                        <div className="text-xs font-bold text-gray-900 dark:text-white">{maxOrderLimit > 0 ? `$${maxOrderLimit.toLocaleString()}` : 'Unlimited'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black uppercase text-gray-400">Approval Limit</div>
                                        <div className="text-xs font-bold text-gray-900 dark:text-white">{maxApprovalLimit > 0 ? `$${maxApprovalLimit.toLocaleString()}` : 'Unlimited'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black uppercase text-gray-400">Site Scope</div>
                                        <div className="text-xs font-bold text-gray-900 dark:text-white">{siteScopeMode}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black uppercase text-gray-400">SoD Enforcement</div>
                                        <div className={`text-xs font-bold ${enforceSod ? 'text-emerald-500' : 'text-amber-500'}`}>{enforceSod ? 'Enabled' : 'Bypassed'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* User Assignment Section */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                        <Users size={15} className="text-[var(--color-brand)]" />
                                        Assign Initial Team Members ({assignedUserIds.length} Selected)
                                    </label>
                                    <div className="w-52">
                                        <input
                                            type="text"
                                            placeholder="Search directory..."
                                            value={userSearchTerm}
                                            onChange={(e) => setUserSearchTerm(e.target.value)}
                                            className="w-full px-3 py-1 bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
                                        />
                                    </div>
                                </div>

                                <div className="border border-gray-200 dark:border-gray-800 rounded-2xl max-h-52 overflow-y-auto custom-scrollbar divide-y divide-gray-100 dark:divide-gray-800/60 bg-white dark:bg-[#15171e]">
                                    {filteredUsers.length === 0 ? (
                                        <div className="p-6 text-center text-xs text-gray-400">No matching users found in directory.</div>
                                    ) : (
                                        filteredUsers.map(user => {
                                            const isSelected = assignedUserIds.includes(user.id);
                                            return (
                                                <div
                                                    key={user.id}
                                                    onClick={() => {
                                                        setAssignedUserIds(prev => 
                                                            prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id]
                                                        );
                                                    }}
                                                    className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                                                        isSelected ? 'bg-[var(--color-brand)]/5' : 'hover:bg-gray-50 dark:hover:bg-white/5'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-xs text-gray-600 dark:text-gray-300 overflow-hidden">
                                                            {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : user.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-xs text-gray-900 dark:text-white">{user.name}</div>
                                                            <div className="text-[10px] text-gray-400">{user.email} &bull; {user.jobTitle || 'Staff'}</div>
                                                        </div>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                                                        isSelected ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white' : 'border-gray-300 dark:border-gray-700'
                                                    }`}>
                                                        {isSelected && <Check size={12} />}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 sm:p-6 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02]">
                    <button
                        type="button"
                        disabled={step === 1 || isSubmitting}
                        onClick={() => setStep((step - 1) as any)}
                        className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <ChevronLeft size={16} /> Back
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-white transition-all"
                        >
                            Cancel
                        </button>

                        {step < 4 ? (
                            <button
                                type="button"
                                disabled={!isStep1Valid}
                                onClick={() => setStep((step + 1) as any)}
                                className="px-5 py-2.5 rounded-xl bg-[var(--color-brand)] text-white text-xs font-bold hover:opacity-90 transition-all shadow-md shadow-[var(--color-brand)]/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                Continue <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled={isSubmitting || !isStep1Valid}
                                onClick={handleFinalSave}
                                className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-black hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSubmitting ? 'Creating Role...' : 'Deploy Security Role'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoleCreationWizard;
