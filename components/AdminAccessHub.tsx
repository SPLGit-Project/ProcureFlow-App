import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { UserCheck, UserX, Clock, Search, Shield, Building2, MapPin, X, LayoutGrid, ListFilter, CheckCircle, UserPlus, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { User, UserRole } from '../types';

const AdminAccessHub = () => {
    const { users, reloadData, roles, sites, searchDirectory, addUser } = useApp();
    const [activeTab, setActiveTab] = useState<'pending' | 'directory'>('pending');
    const [filter, setFilter] = useState('');
    
    // Approval Configuration
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [grantAllSites, setGrantAllSites] = useState(false);
    const [specificSiteIds, setSpecificSiteIds] = useState<string[]>([]);
    const [selectedRole, setSelectedRole] = useState<string>('SITE_USER');
    const [isProcessing, setIsProcessing] = useState(false);

    // Directory Search State
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [dirQuery, setDirQuery] = useState('');
    const [dirResults, setDirResults] = useState<any[]>([]);
    const [isSearchingDir, setIsSearchingDir] = useState(false);

    // Derived Lists
    const pendingUsers = users.filter(u => u.status === 'PENDING_APPROVAL');
    const activeUsers = users.filter(u => u.status === 'APPROVED');
    const displayedUsers = activeTab === 'pending' ? pendingUsers : activeUsers.filter(u => u.name.toLowerCase().includes(filter.toLowerCase()) || u.email.toLowerCase().includes(filter.toLowerCase()));

    // Debounced Search
    useEffect(() => {
        const timeout = setTimeout(async () => {
            if (dirQuery.length > 2) {
                setIsSearchingDir(true);
                const results = await searchDirectory(dirQuery);
                setDirResults(results);
                setIsSearchingDir(false);
            } else {
                setDirResults([]);
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [dirQuery, searchDirectory]);

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
            const finalSiteIds = grantAllSites ? sites.map(s => s.id) : specificSiteIds;

            // Check if user exists (if coming from Directory Add)
            const exists = users.find(u => u.id === selectedUser.id);
            
            if (exists) {
                // Update Existing
                 const { error } = await supabase
                .from('users')
                .update({ 
                    status: 'APPROVED',
                    role_id: selectedRole,
                    site_ids: finalSiteIds
                })
                .eq('id', selectedUser.id);
                if (error) throw error;
            } else {
                // Add New (From Directory)
                const newUser = {
                    ...selectedUser,
                    status: 'APPROVED',
                    role: selectedRole,
                    siteIds: finalSiteIds,
                    createdAt: new Date().toISOString()
                };
                // We need to use addUser from context which handles Supabase insert? 
                // Wait, useApp().addUser inserts into state, but we need DB insert.
                // context/AppContext.tsx addUser implementation checks?
                // Actually, let's just do direct DB insert for safety here as we are Admin.
                const { error } = await supabase.from('users').insert([{
                    id: selectedUser.id,
                    email: selectedUser.email,
                    name: selectedUser.name,
                    job_title: selectedUser.jobTitle,
                    department: selectedUser.department,
                    role_id: selectedRole,
                    site_ids: finalSiteIds,
                    status: 'APPROVED',
                    avatar_url: selectedUser.avatar
                }]);
                 if (error) throw error;
            }

            await reloadData();
            setSelectedUser(null);
            setIsSearchModalOpen(false);
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

    const handleDirectorySelect = (dirUser: any) => {
        // Convert Directory User to App User format for modal
        const mockUser: User = {
            id: dirUser.id, // ID from Azure AD
            name: dirUser.name,
            email: dirUser.email,
            jobTitle: dirUser.jobTitle,
            department: dirUser.department,
            role: 'SITE_USER',
            siteIds: [],
            status: 'PENDING_APPROVAL', // Temporary status for modal logic
            approvalReason: 'Added by Admin via Directory',
            avatar: '',
            createdAt: new Date().toISOString()
        };
        openApprovalModal(mockUser);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header / Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Access Hub</h2>
                    <p className="text-gray-500 text-sm">Manage permissions, onboard users, and secure the platform.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex bg-gray-100 dark:bg-[#1e2029] p-1 rounded-lg">
                        <button 
                            onClick={() => setActiveTab('pending')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'pending' ? 'bg-white dark:bg-[#2b2d36] text-[var(--color-brand)] shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
                        >
                            <Clock size={16} /> Inbox
                            {pendingUsers.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{pendingUsers.length}</span>}
                        </button>
                        <button 
                            onClick={() => setActiveTab('directory')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'directory' ? 'bg-white dark:bg-[#2b2d36] text-[var(--color-brand)] shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
                        >
                            <ListFilter size={16} /> Active Users
                        </button>
                    </div>

                    <button 
                        onClick={() => { setDirQuery(''); setDirResults([]); setIsSearchModalOpen(true); }}
                        className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2 rounded-lg font-semibold shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <UserPlus size={18} /> Add User
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

                {/* Local Directory (Active Users) */}
                {activeTab === 'directory' && (
                    <div className="p-6">
                        <div className="relative mb-6">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Search active users..." 
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

            {/* Grant Access Modal (Shared for Approval & Add) */}
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

            {/* Smart Directory Search Modal */}
             {isSearchModalOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/20 backdrop-blur-sm animate-fade-in" onClick={() => setIsSearchModalOpen(false)}>
                    <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Find User in Directory</h3>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input 
                                    autoFocus
                                    type="text" 
                                    placeholder="Type name or email to search Azure AD..." 
                                    value={dirQuery}
                                    onChange={e => setDirQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-[var(--color-brand)] text-lg"
                                />
                                {isSearchingDir && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" size={18} />}
                            </div>
                        </div>
                        
                        <div className="max-h-[400px] overflow-y-auto p-2">
                            {dirQuery.length < 3 && dirResults.length === 0 && (
                                <div className="p-8 text-center text-gray-400">
                                    <Search size={32} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Type at least 3 characters to search.</p>
                                </div>
                            )}

                            {dirResults.length > 0 ? (
                                <div className="space-y-1">
                                    {dirResults.map(u => (
                                        <button 
                                            key={u.id}
                                            onClick={() => handleDirectorySelect(u)}
                                            className="w-full text-left p-3 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl flex items-center gap-4 transition-colors group border border-transparent hover:border-blue-100"
                                        >
                                            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center font-bold text-gray-500 text-sm group-hover:bg-blue-100 group-hover:text-blue-600">
                                                {u.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-900 dark:text-white">{u.name}</div>
                                                <div className="text-xs text-gray-500">{u.email} &bull; {u.department || 'No Dept'}</div>
                                            </div>
                                            <UserPlus size={16} className="ml-auto text-gray-300 group-hover:text-blue-500" />
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                dirQuery.length >= 3 && !isSearchingDir && (
                                    <div className="p-8 text-center text-gray-400">
                                        <p>No users found in directory.</p>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminAccessHub;
