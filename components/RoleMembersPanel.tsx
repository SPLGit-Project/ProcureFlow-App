import React, { useState, useMemo } from 'react';
import { 
    Users, 
    UserPlus, 
    UserMinus, 
    Search, 
    Shield, 
    Check, 
    Star, 
    Mail, 
    AlertCircle,
    Building2
} from 'lucide-react';
import { RoleDefinition, User, Site } from '../types.ts';

interface RoleMembersPanelProps {
    role: RoleDefinition;
    allUsers: User[];
    allSites: Site[];
    onAssignUserToRole: (userId: string, roleId: string) => Promise<void>;
    onRemoveUserFromRole: (userId: string, roleId: string) => Promise<void>;
}

export const RoleMembersPanel: React.FC<RoleMembersPanelProps> = ({
    role,
    allUsers,
    allSites,
    onAssignUserToRole,
    onRemoveUserFromRole
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isAssignDropdownOpen, setIsAssignDropdownOpen] = useState(false);
    const [assignSearchTerm, setAssignSearchTerm] = useState('');
    const [processingUserId, setProcessingUserId] = useState<string | null>(null);

    // Users with this role
    const members = useMemo(() => {
        return allUsers.filter(u => {
            if (u.status === 'ARCHIVED') return false;
            const userRoles = u.roleIds || [u.role];
            return userRoles.includes(role.id);
        });
    }, [allUsers, role.id]);

    // Filtered members by search
    const filteredMembers = useMemo(() => {
        if (!searchTerm.trim()) return members;
        const term = searchTerm.toLowerCase();
        return members.filter(m => 
            m.name.toLowerCase().includes(term) || 
            m.email.toLowerCase().includes(term) || 
            (m.jobTitle || '').toLowerCase().includes(term)
        );
    }, [members, searchTerm]);

    // Candidates who DO NOT have this role
    const nonMemberCandidates = useMemo(() => {
        return allUsers.filter(u => {
            if (u.status === 'ARCHIVED') return false;
            const userRoles = u.roleIds || [u.role];
            const doesNotHave = !userRoles.includes(role.id);
            if (!doesNotHave) return false;
            if (!assignSearchTerm.trim()) return true;
            const term = assignSearchTerm.toLowerCase();
            return u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
        });
    }, [allUsers, role.id, assignSearchTerm]);

    const handleAssign = async (userId: string) => {
        setProcessingUserId(userId);
        try {
            await onAssignUserToRole(userId, role.id);
            setAssignSearchTerm('');
            setIsAssignDropdownOpen(false);
        } catch (e) {
            console.error('Failed to assign user to role', e);
        } finally {
            setProcessingUserId(null);
        }
    };

    const handleRemove = async (userId: string) => {
        if (!window.confirm(`Are you sure you want to remove this role from the selected user?`)) return;
        setProcessingUserId(userId);
        try {
            await onRemoveUserFromRole(userId, role.id);
        } catch (e) {
            console.error('Failed to remove user from role', e);
        } finally {
            setProcessingUserId(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header / Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center">
                        <Users size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white">Active Role Members</h4>
                        <p className="text-[11px] text-gray-400">{members.length} personnel assigned to {role.name}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-1 sm:flex-initial justify-end">
                    {/* Search members */}
                    <div className="relative flex-1 sm:w-56">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Filter members..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20"
                        />
                    </div>

                    {/* Add Member Dropdown Button */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsAssignDropdownOpen(!isAssignDropdownOpen)}
                            className="btn-primary flex items-center gap-1.5 text-xs py-2 px-3 shadow-none"
                        >
                            <UserPlus size={14} /> Assign Member
                        </button>

                        {isAssignDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#181a24] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 z-30 animate-slide-up">
                                <div className="text-xs font-bold text-gray-900 dark:text-white mb-2">Assign User to {role.name}</div>
                                <div className="relative mb-2">
                                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search user to assign..."
                                        value={assignSearchTerm}
                                        onChange={(e) => setAssignSearchTerm(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
                                    />
                                </div>

                                <div className="max-h-48 overflow-y-auto custom-scrollbar divide-y divide-gray-100 dark:divide-gray-800/60">
                                    {nonMemberCandidates.length === 0 ? (
                                        <div className="p-3 text-center text-[11px] text-gray-400">All active users already hold this role.</div>
                                    ) : (
                                        nonMemberCandidates.map(candidate => (
                                            <div
                                                key={candidate.id}
                                                onClick={() => handleAssign(candidate.id)}
                                                className="p-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
                                            >
                                                <div className="min-w-0 pr-2">
                                                    <div className="font-bold text-xs text-gray-900 dark:text-white truncate">{candidate.name}</div>
                                                    <div className="text-[10px] text-gray-400 truncate">{candidate.email}</div>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    disabled={processingUserId === candidate.id}
                                                    className="px-2 py-0.5 rounded bg-[var(--color-brand)]/10 text-[var(--color-brand)] text-[10px] font-bold uppercase hover:bg-[var(--color-brand)] hover:text-white transition-colors"
                                                >
                                                    {processingUserId === candidate.id ? '...' : 'Add'}
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Members Table */}
            <div className="bg-white dark:bg-[#15171e] border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50/70 dark:bg-white/[0.02] border-b border-gray-100 dark:border-gray-800 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                        <tr>
                            <th className="px-6 py-3">Team Member</th>
                            <th className="px-6 py-3">Email & Title</th>
                            <th className="px-6 py-3">Site Locations</th>
                            <th className="px-6 py-3 text-center">Primary Role</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                        {filteredMembers.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-2 text-gray-300">
                                        <Users size={24} />
                                    </div>
                                    <p className="font-bold text-sm text-gray-700 dark:text-gray-300">No members currently assigned</p>
                                    <p className="text-xs text-gray-400 mt-1">Click "Assign Member" above to grant {role.name} to users.</p>
                                </td>
                            </tr>
                        ) : (
                            filteredMembers.map(member => {
                                const isPrimary = member.role === role.id;
                                const userSites = (member.siteIds || []).map(id => allSites.find(s => s.id === id)?.name).filter(Boolean);

                                return (
                                    <tr key={member.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center font-bold text-xs text-gray-700 dark:text-gray-200 overflow-hidden shadow-sm">
                                                    {member.avatar ? <img src={member.avatar} alt="" className="w-full h-full object-cover" /> : member.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-gray-900 dark:text-white">{member.name}</span>
                                                    <div className="text-[10px] text-gray-400">{member.status || 'Active'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3.5">
                                            <div className="font-medium text-gray-700 dark:text-gray-300">{member.email}</div>
                                            <div className="text-[10px] text-gray-400">{member.jobTitle || 'No Title Set'}</div>
                                        </td>
                                        <td className="px-6 py-3.5">
                                            {userSites.length > 0 ? (
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-600 dark:text-gray-300">
                                                        {userSites[0]}
                                                    </span>
                                                    {userSites.length > 1 && (
                                                        <span className="text-[9px] font-bold text-gray-400">
                                                            +{userSites.length - 1} more
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-gray-400 italic">No sites bound</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3.5 text-center">
                                            {isPrimary ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                                                    <Star size={10} className="fill-emerald-500 text-emerald-500" /> Primary
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Secondary</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3.5 text-right">
                                            <button
                                                type="button"
                                                disabled={processingUserId === member.id}
                                                onClick={() => handleRemove(member.id)}
                                                className="px-2.5 py-1 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-[10px] font-bold uppercase transition-colors"
                                            >
                                                {processingUserId === member.id ? '...' : 'Remove'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RoleMembersPanel;
