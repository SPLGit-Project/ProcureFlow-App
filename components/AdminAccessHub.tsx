import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { UserCheck, UserX, Clock, Search, Shield, Building2, MapPin, X, LayoutGrid, ListFilter, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { User, UserRole } from '../types';

const AdminAccessHub = () => {
    const { users, reloadData, roles, sites } = useApp();
    const [activeTab, setActiveTab] = useState<'pending' | 'directory'>('pending');
    const [filter, setFilter] = useState('');
    
    // Approval Configuration
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [grantAllSites, setGrantAllSites] = useState(false);
    const [specificSiteIds, setSpecificSiteIds] = useState<string[]>([]);
    const [selectedRole, setSelectedRole] = useState<string>('SITE_USER');
    const [isProcessing, setIsProcessing] = useState(false);

    // Derived Lists
    const pendingUsers = users.filter(u => u.status === 'PENDING_APPROVAL');
    const activeUsers = users.filter(u => u.status === 'APPROVED');
    const displayedUsers = activeTab === 'pending' ? pendingUsers : activeUsers.filter(u => u.name.toLowerCase().includes(filter.toLowerCase()) || u.email.toLowerCase().includes(filter.toLowerCase()));

    const openApprovalModal = (user: User) => {
        // Smart Defaults: 
        // 1. If "ALL SITES" requested, default grantAll to true.
        // 2. Parse requested sites from reason
        const reason = user.approvalReason || '';
        const requestedAll = reason.includes("ALL SITES");
        
        let initialSites: string[] = [];
        if (!requestedAll) {
             // Try to fuzzy match requested site names to IDs (simple heuristic)
             initialSites = sites.filter(s => reason.includes(s.name)).map(s => s.id);
        }

        setGrantAllSites(requestedAll);
        setSpecificSiteIds(initialSites);
        setSelectedRole('SITE_USER'); // Default safest role
        setSelectedUser(user);
    };

    const handleApprove = async () => {
        if (!selectedUser) return;
        setIsProcessing(true);
        try {
            // If Grant All, we might store a specialized flag or just ALL site IDs. 
            // For now, let's store ALL site IDs to be explicit, but maybe a wildcard is better?
            // "site_ids" array in DB. Let's just put all IDs if "All" selected.
            // Or better: Use a special reserved ID 'ALL' or empty array means none?
            // Let's go with literal IDs for safety, unless we want a dynamic "All" group.
            // Requirement said "Grant either all those sites or a single site".
            
            const finalSiteIds = grantAllSites ? sites.map(s => s.id) : specificSiteIds;

            const { error } = await supabase
                .from('users')
                .update({ 
                    status: 'APPROVED',
                    role_id: selectedRole,
                    site_ids: finalSiteIds
                })
                .eq('id', selectedUser.id);

            if (error) throw error;
            await reloadData();
            setSelectedUser(null);
        } catch (error) {
            console.error("Approval failed", error);
            alert("Failed to approve user.");
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleReject = async (userId: string) => {
        if(!confirm("Reject this user account?")) return;
        try {
             await supabase.from('users').update({ status: 'REJECTED' }).eq('id', userId);
             reloadData();
        } catch(e) { console.error(e); }
    };

    const toggleSpecificSite = (siteId: string) => {
        if (grantAllSites) setGrantAllSites(false); // Switch to manual mode if unchecked
        setSpecificSiteIds(prev => prev.includes(siteId) ? prev.filter(id => id !== siteId) : [...prev, siteId]);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header / Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Access Hub</h2>
                    <p className="text-gray-500 text-sm">Manage permissions, onboard users, and secure the platform.</p>
                </div>
                
                <div className="flex bg-gray-100 dark:bg-[#1e2029] p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('pending')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'pending' ? 'bg-white dark:bg-[#2b2d36] text-[var(--color-brand)] shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
                    >
                        <Clock size={16} /> inbox
                        {pendingUsers.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{pendingUsers.length}</span>}
                    </button>
                    <button 
                        onClick={() => setActiveTab('directory')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'directory' ? 'bg-white dark:bg-[#2b2d36] text-[var(--color-brand)] shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
                    >
                        <LayoutGrid size={16} /> Directory
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm min-h-[400px]">
                {/* Pending Inbox */}
                {activeTab === 'pending' && (
                    <div className="p-0">
                        {displayedUsers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                <CheckCircle size={48} className="mb-4 text-green-100 dark:text-green-900/30" />
                                <p>All caught up! No pending requests.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {displayedUsers.map(user => (
                                    <div key={user.id} className="p-6 flex flex-col md:flex-row gap-6 hover:bg-gray-50 dark:hover:bg-[#15171e] transition-colors group">
                                        <div className="flex items-start gap-4 flex-1">
                                            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600 font-bold shrink-0">
                                                {user.avatar ? <img src={user.avatar} className="w-full h-full rounded-full" /> : user.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-gray-900 dark:text-white">{user.name}</h4>
                                                    <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded">{user.jobTitle || 'No Title'}</span>
                                                </div>
                                                <div className="text-sm text-gray-500 mb-2">{user.email} &bull; {user.department}</div>
                                                
                                                <div className="inline-block bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 rounded-lg px-3 py-2">
                                                    <p className="text-xs text-amber-800 dark:text-amber-400 font-medium uppercase mb-0.5">Requesting Access To:</p>
                                                    <p className="text-sm text-gray-900 dark:text-white font-medium">
                                                        {user.approvalReason?.replace('Requested Access: ', '') || "Unspecified"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3 self-center">
                                            <button onClick={() => handleReject(user.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Reject">
                                                <UserX size={20} />
                                            </button>
                                            <button 
                                                onClick={() => openApprovalModal(user)}
                                                className="bg-[var(--color-brand)] text-white px-5 py-2 rounded-lg font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
                                            >
                                                <Shield size={16} /> Review & Grant
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Directory */}
                {activeTab === 'directory' && (
                    <div className="p-6">
                        <div className="relative mb-6">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Search directory..." 
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                             {displayedUsers.map(user => (
                                 <div key={user.id} className="p-4 border border-gray-100 dark:border-gray-800 rounded-xl flex items-center gap-4 hover:border-blue-200 transition-colors">
                                     <div className="w-10 h-10 bg-gray-100 dark:bg-[#15171e] rounded-full flex items-center justify-center font-bold text-gray-500">
                                         {user.avatar ? <img src={user.avatar} className="w-full h-full rounded-full" /> : user.name.charAt(0)}
                                     </div>
                                     <div className="overflow-hidden">
                                         <div className="font-semibold text-gray-900 dark:text-white truncate">{user.name}</div>
                                         <div className="text-xs text-gray-500 truncate">{user.jobTitle}</div>
                                     </div>
                                     <div className="ml-auto">
                                         <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                                             {user.role === 'ADMIN' ? 'Admin' : 'User'}
                                         </span>
                                     </div>
                                 </div>
                             ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Grant Access Modal */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-[#15171e]">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Grant Access</h3>
                                <p className="text-xs text-gray-500">for {selectedUser.name}</p>
                            </div>
                            <button onClick={() => setSelectedUser(null)}><X size={20} className="text-gray-400" /></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* Role Selection */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Security Role</label>
                                <select 
                                    value={selectedRole} 
                                    onChange={e => setSelectedRole(e.target.value)}
                                    className="w-full p-2.5 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-brand)] dark:text-white"
                                >
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>

                            {/* Site Access */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs font-bold text-gray-500 uppercase block">Site Access</label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <div className={`w-10 h-6 rounded-full p-1 transition-colors ${grantAllSites ? 'bg-[var(--color-brand)]' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${grantAllSites ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </div>
                                        <input type="checkbox" className="hidden" checked={grantAllSites} onChange={() => setGrantAllSites(!grantAllSites)} />
                                        <span className={`text-xs font-semibold ${grantAllSites ? 'text-[var(--color-brand)]' : 'text-gray-500'}`}>Grant All Sites</span>
                                    </label>
                                </div>

                                <div className={`border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden transition-opacity ${grantAllSites ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                                    <div className="bg-gray-50 dark:bg-[#15171e] px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500">
                                        Select Specific Sites
                                    </div>
                                    <div className="max-h-40 overflow-y-auto p-2 space-y-1">
                                        {sites.map(site => (
                                            <label key={site.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-[#15171e] rounded-lg cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded accent-[var(--color-brand)]"
                                                    checked={specificSiteIds.includes(site.id)}
                                                    onChange={() => toggleSpecificSite(site.id)}
                                                />
                                                <span className="text-sm text-gray-700 dark:text-gray-200">{site.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#15171e] flex justify-end gap-3">
                            <button onClick={() => setSelectedUser(null)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg">Cancel</button>
                            <button 
                                onClick={handleApprove}
                                disabled={isProcessing}
                                className="bg-[var(--color-brand)] text-white px-6 py-2 rounded-lg font-semibold shadow-lg shadow-blue-500/20"
                            >
                                {isProcessing ? 'Saving...' : 'Confirm Access'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminAccessHub;
