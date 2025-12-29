import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { UserCheck, UserX, Clock, Search, Shield, Building2, MapPin, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { User, UserRole } from '../types';

const AdminUserApproval = () => {
    const { users, reloadData, roles, sites } = useApp();
    const [pendingUsers, setPendingUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState<string | false>(false);
    
    // Approval Modal State
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [approvalConfig, setApprovalConfig] = useState<{
        role: string;
        siteIds: string[];
    }>({ role: 'SITE_USER', siteIds: [] });

    useEffect(() => {
        setPendingUsers(users.filter(u => u.status === 'PENDING_APPROVAL'));
    }, [users]);

    const handleReject = async (userId: string) => {
        if(!confirm("Are you sure you want to reject this user?")) return;
        setLoading(userId);
        try {
            const { error } = await supabase
                .from('users')
                .update({ status: 'REJECTED' })
                .eq('id', userId);

            if (error) throw error;
            await reloadData();
        } catch (err) {
            console.error("Failed to reject user:", err);
            alert("Failed to reject user");
        } finally {
            setLoading(false);
        }
    };

    const openApprovalModal = (user: User) => {
        setSelectedUser(user);
        setApprovalConfig({
            role: 'SITE_USER', // Default
            siteIds: []
        });
    };

    const handleApprove = async () => {
        if (!selectedUser) return;
        setLoading(selectedUser.id);
        
        try {
            const { error } = await supabase
                .from('users')
                .update({ 
                    status: 'APPROVED',
                    role_id: approvalConfig.role,
                    site_ids: approvalConfig.siteIds 
                })
                .eq('id', selectedUser.id);

            if (error) throw error;
            await reloadData();
            setSelectedUser(null);
        } catch (err) {
            console.error("Failed to approve user:", err);
            alert("Failed to update user status");
        } finally {
            setLoading(false);
        }
    };

    const toggleSite = (siteId: string) => {
        setApprovalConfig(prev => {
            const exists = prev.siteIds.includes(siteId);
            return {
                ...prev,
                siteIds: exists 
                    ? prev.siteIds.filter(id => id !== siteId)
                    : [...prev.siteIds, siteId]
            };
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">User Approvals</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage new user registrations and access requests</p>
                </div>
                <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                    <Clock size={12} />
                    {pendingUsers.length} Pending
                </div>
            </div>

            {pendingUsers.length === 0 ? (
                <div className="bg-white dark:bg-[#1e2029] rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-12 text-center">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-[#15171e] rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                        <UserCheck size={24} />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">No pending requests at the moment</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {pendingUsers.map(user => (
                        <div key={user.id} className="bg-white dark:bg-[#1e2029] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-[#15171e] flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold overflow-hidden shrink-0">
                                        {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : user.name.charAt(0)}
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-gray-900 dark:text-white text-lg">{user.name}</h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                                        
                                        {/* User Context */}
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {user.jobTitle && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs font-medium border border-blue-100 dark:border-blue-800">
                                                    <Building2 size={10} /> {user.jobTitle}
                                                </span>
                                            )}
                                            {user.department && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 text-xs font-medium border border-purple-100 dark:border-purple-800">
                                                    Dep: {user.department}
                                                </span>
                                            )}
                                        </div>
                                        
                                        {user.approvalReason && (
                                            <div className="mt-3 p-3 bg-gray-50 dark:bg-[#15171e] rounded-lg border border-gray-100 dark:border-gray-800 max-w-xl">
                                                <p className="text-xs text-gray-500 mb-1 font-semibold uppercase">Reason for Request</p>
                                                <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{user.approvalReason}"</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 self-start">
                                    <button 
                                        onClick={() => handleReject(user.id)}
                                        disabled={loading === user.id}
                                        className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10"
                                        title="Reject Request"
                                    >
                                        <UserX size={20} />
                                    </button>
                                    <button 
                                        onClick={() => openApprovalModal(user)}
                                        disabled={loading === user.id}
                                        className="flex items-center gap-2 bg-[var(--color-brand)] hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
                                    >
                                        <UserCheck size={18} />
                                        Review & Approve
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Approval Modal */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-[#15171e]">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Approve Access</h3>
                            <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                    <Shield size={16} /> Assign Role
                                </h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {roles.map(role => (
                                        <button
                                            key={role.id}
                                            onClick={() => setApprovalConfig({ ...approvalConfig, role: role.id })}
                                            className={`p-3 rounded-xl border text-left transition-all ${
                                                approvalConfig.role === role.id 
                                                    ? 'border-[var(--color-brand)] bg-blue-50 dark:bg-blue-900/20 ring-1 ring-[var(--color-brand)]' 
                                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                            }`}
                                        >
                                            <div className="font-semibold text-sm text-gray-900 dark:text-white">{role.name}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{role.description}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                    <MapPin size={16} /> Assign Sites
                                </h4>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {sites.map(site => (
                                        <label key={site.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#15171e] cursor-pointer group transition-colors">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                                approvalConfig.siteIds.includes(site.id)
                                                    ? 'bg-[var(--color-brand)] border-[var(--color-brand)]'
                                                    : 'border-gray-300 dark:border-gray-600 group-hover:border-gray-400'
                                            }`}>
                                                {approvalConfig.siteIds.includes(site.id) && <UserCheck size={12} className="text-white" />}
                                            </div>
                                            <input 
                                                type="checkbox" 
                                                className="hidden" 
                                                checked={approvalConfig.siteIds.includes(site.id)}
                                                onChange={() => toggleSite(site.id)}
                                            />
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{site.name}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">{site.suburb}, {site.state}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#15171e] flex justify-end gap-3">
                            <button 
                                onClick={() => setSelectedUser(null)}
                                className="px-4 py-2 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleApprove}
                                disabled={!!loading}
                                className="flex items-center gap-2 bg-[var(--color-brand)] hover:opacity-90 text-white px-6 py-2 rounded-lg font-semibold transition-all"
                            >
                                {loading ? 'Processing...' : 'Confirm Approval'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUserApproval;
