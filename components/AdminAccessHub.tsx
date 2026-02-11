import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { UserCheck, UserX, Clock, Search, Shield, Building2, MapPin, X, LayoutGrid, ListFilter, CheckCircle, UserPlus, Loader2, AlertCircle, Check, Mail } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { User, UserRole } from '../types';
import { useToast, ToastContainer } from './ToastNotification';
import { getTimeUntilExpiry, formatInviteDate } from '../utils/inviteHelpers';

const AdminAccessHub = () => {
    const { users, reloadData, roles, sites, searchDirectory, sendWelcomeEmail, resendWelcomeEmail } = useApp();
    const { toasts, dismissToast, success, error, warning } = useToast();
    
    // Approval Configuration
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [grantAllSites, setGrantAllSites] = useState(false);
    const [specificSiteIds, setSpecificSiteIds] = useState<string[]>([]);
    const [selectedRole, setSelectedRole] = useState<string>('SITE_USER');
    const [isProcessing, setIsProcessing] = useState(false);
    const [resendingUserId, setResendingUserId] = useState<string | null>(null);

    // Derived Lists
    const pendingRequests = users.filter(u => u.status === 'PENDING_APPROVAL' && !u.invitedAt);
    const activeInvitations = users.filter(u => u.status === 'PENDING_APPROVAL' && u.invitedAt);

    const openApprovalModal = (user: User) => {
        const reason = user.approvalReason || '';
        const requestedAll = reason.includes("ALL SITES");
        
        let initialSites: string[] = [];
        if (!requestedAll) {
             initialSites = sites.filter(s => reason.includes(s.name)).map(s => s.id);
        }

        setGrantAllSites(requestedAll);
        setSpecificSiteIds(initialSites);
        setSelectedRole('SITE_USER'); 
        setSelectedUser(user);
    };

    const handleApprove = async () => {
        if (!selectedUser) return;
        setIsProcessing(true);
        try {
            const finalSiteIds = grantAllSites ? sites.map(s => s.id) : specificSiteIds;
            const exists = users.find(u => u.id === selectedUser.id);
            
            if (exists) {
                 const { error } = await supabase.from('users').update({ 
                    status: 'APPROVED',
                    role_id: selectedRole,
                    site_ids: finalSiteIds
                }).eq('id', selectedUser.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('users').insert([{
                    id: selectedUser.id,
                    email: selectedUser.email,
                    name: selectedUser.name,
                    job_title: selectedUser.jobTitle,
                    department: selectedUser.department,
                    role_id: selectedRole,
                    site_ids: finalSiteIds,
                    status: 'APPROVED',
                    avatar: selectedUser.avatar
                }]);
                if (error) throw error;
                if (error) throw error;
                const emailSent = await sendWelcomeEmail(selectedUser.email, selectedUser.name);
                if (!emailSent) {
                    const fallbackLink = window.location.origin;
                    if (confirm("Approval processed, but welcome email failed to send (Delegated Graph error). \n\nWould you like to copy the application link to manually send it to the user?")) {
                        navigator.clipboard.writeText(fallbackLink);
                        alert("Link copied to clipboard!");
                    }
                }
            }

            await reloadData();
            setSelectedUser(null);
            console.log(`Auth: Approval processed for ${selectedUser.email} [Success]`);
            // alert("Approval processed successfully."); // Removing redundant alert if confirm/clip-copy was used
        } catch (error) {
            console.error("Auth: Approval failed", error);
            alert("Failed to approve user.");
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleReject = async (userId: string) => {
        if(!confirm("Are you sure you want to reject this request?")) return;
        try {
             await supabase.from('users').update({ status: 'REJECTED' }).eq('id', userId);
             reloadData();
        } catch(e) { console.error(e); }
    };

    const toggleSpecificSite = (siteId: string) => {
        if (grantAllSites) setGrantAllSites(false);
        setSpecificSiteIds(prev => prev.includes(siteId) ? prev.filter(id => id !== siteId) : [...prev, siteId]);
    };

    const UserRow = ({ user, type, key }: { user: User, type: 'REQUEST' | 'INVITE', key?: string }) => {
        const isAccountCreated = !!(user.jobTitle || user.department);
        const expiryInfo = user.invitationExpiresAt ? getTimeUntilExpiry(user.invitationExpiresAt) : null;
        const isResending = resendingUserId === user.id;

        const handleResendInvite = async () => {
            // Confirmation dialog
            if (!confirm(`Resend invitation to ${user.name} (${user.email})?\n\nThis will generate a new invitation link valid for 48 hours.`)) {
                return;
            }

            setResendingUserId(user.id);
            try {
                const inviteSuccess = await resendWelcomeEmail(user.email, user.name);
                if (inviteSuccess) {
                    success(`Invitation sent to ${user.name}`, 4000);
                    await reloadData(); // Refresh to show updated expiry
                } else {
                    const fallbackLink = window.location.origin;
                    if (confirm("Email failed to send (Delegated Graph error). \n\nWould you like to copy the application link to manually send it to the user?")) {
                        navigator.clipboard.writeText(fallbackLink);
                        alert("Link copied to clipboard!");
                    } else {
                        error('Failed to send invitation. Please try again.', 5000);
                    }
                }
            } catch (err) {
                error('An error occurred while sending the invitation.', 5000);
                console.error('Resend error:', err);
            } finally {
                setResendingUserId(null);
            }
        };

        return (
            <div className="p-6 flex flex-col md:flex-row gap-6 hover:bg-gray-50 dark:hover:bg-white/5 transition-all group">
                <div className="flex items-start gap-4 flex-1">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border-2 border-white dark:border-[#1e2029] shadow-md group-hover:scale-105 transition-transform">
                        <img 
                            src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&color=fff`} 
                            alt={user.name} 
                            className="w-full h-full object-cover" 
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">{user.name}</h4>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${isAccountCreated ? 'bg-green-100 dark:bg-green-900/10 text-green-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                {isAccountCreated ? 'Account Created' : 'Invite Sent'}
                            </span>
                        </div>
                        <div className="text-xs font-medium text-gray-500 mb-3">{user.email} &bull; {user.department || 'General'}</div>
                        
                        <div className="flex flex-wrap gap-2">
                            <div className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/50 rounded-xl px-3 py-1.5">
                                <AlertCircle size={12} className="text-amber-600"/>
                                <p className="text-[10px] text-amber-800 dark:text-amber-400 font-bold uppercase tracking-tight">
                                    {user.approvalReason?.replace('Requested Access: ', '') || "Awaiting Setup"}
                                </p>
                            </div>
                            {user.invitedAt && (
                                <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 rounded-xl px-3 py-1.5 text-blue-600">
                                    <Clock size={12} />
                                    <p className="text-[10px] font-bold uppercase tracking-tight">
                                        Invited: {formatInviteDate(user.invitedAt)}
                                    </p>
                                </div>
                            )}
                            {expiryInfo && (
                                <div className={`inline-flex items-center gap-2 border rounded-xl px-3 py-1.5 ${
                                    expiryInfo.isExpired 
                                        ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/50 text-red-600' 
                                        : expiryInfo.isExpiringSoon
                                        ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/50 text-amber-600 animate-pulse'
                                        : 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/50 text-blue-600'
                                }`}>
                                    <Clock size={12} />
                                    <p className="text-[10px] font-bold uppercase tracking-tight">
                                        {expiryInfo.displayText}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 self-center">
                    <button 
                        onClick={handleResendInvite}
                        disabled={isResending}
                        className="w-10 h-10 flex items-center justify-center text-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all border border-transparent hover:border-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Resend Welcome Email"
                    >
                        {isResending ? (
                            <Loader2 size={20} className="animate-spin" />
                        ) : (
                            <Mail size={20} />
                        )}
                    </button>
                    <button 
                        onClick={() => {
                            if (confirm(`Are you sure you want to reject ${user.name}'s request?`)) {
                                handleReject(user.id);
                            }
                        }} 
                        className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all border border-transparent hover:border-red-100" 
                        title="Reject"
                    >
                        <UserX size={20} />
                    </button>
                    <button 
                        onClick={() => openApprovalModal(user)}
                        className="h-10 px-5 bg-amber-500 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all flex items-center gap-2"
                    >
                        <Shield size={16} /> Grant Access
                    </button>
                </div>
            </div>
        );
    };

    const [dirQuery, setDirQuery] = useState('');
    const [dirResults, setDirResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (dirQuery.length > 2) {
                console.log(`UI: Triggering directory search for "${dirQuery}"...`);
                setIsSearching(true);
                const results = await searchDirectory(dirQuery);
                setDirResults(results);
                setIsSearching(false);
            } else {
                setDirResults([]);
            }
        }, 250); // Debounce 250ms (faster UX for directory search)
        return () => clearTimeout(delayDebounceFn);
    }, [dirQuery, searchDirectory]);

    return (
        <>
            <div className="space-y-6 animate-fade-in">
            {/* Directory Search / Quick Invite */}
            <div className="bg-white dark:bg-[#1e2029] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search directory to invite (Name or Email)..." 
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none transition-all"
                            value={dirQuery}
                            onChange={(e) => setDirQuery(e.target.value)}
                        />
                        {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-brand)] animate-spin" size={18} />}
                    </div>
                </div>

                {dirResults.length > 0 && (
                    <div className="mt-4 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-50 dark:divide-gray-800/50 animate-slide-up">
                        {dirResults.map(res => {
                            const alreadyExists = users.some(u => u.email.toLowerCase() === res.email.toLowerCase());
                            return (
                                <div key={res.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center font-black text-xs uppercase">
                                            {res.name.substring(0, 2)}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-900 dark:text-white">{res.name}</div>
                                            <div className="text-[10px] text-gray-500 font-medium">{res.email} &bull; {res.jobTitle || 'Unknown Position'}</div>
                                        </div>
                                    </div>
                                    {alreadyExists ? (
                                        <div className="px-3 py-1 rounded-full bg-green-50 dark:bg-green-900/10 text-green-600 text-[10px] font-black uppercase">Active Member</div>
                                    ) : (
                                        <button 
                                            onClick={() => {
                                                setSelectedUser({
                                                    id: crypto.randomUUID(), // Temp ID until session creation
                                                    name: res.name,
                                                    email: res.email,
                                                    jobTitle: res.jobTitle,
                                                    department: res.department,
                                                    avatar: '',
                                                    role: 'SITE_USER',
                                                    siteIds: [],
                                                    status: 'PENDING_APPROVAL'
                                                });
                                                setDirQuery('');
                                                setDirResults([]);
                                            }}
                                            className="px-3 py-1.5 bg-[var(--color-brand)] text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-md shadow-[var(--color-brand)]/20 hover:opacity-90 active:scale-95 transition-all"
                                        >
                                            Invite to Platform
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pending Inbox Integration */}
            <div className="bg-white dark:bg-[#1e2029] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden min-h-[400px]">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5 flex justify-between items-center">
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Clock size={14} className="text-amber-500"/> Pending Approvals & Invitations
                    </h2>
                    <div className="flex gap-2">
                        <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-500 text-[10px] font-black">{pendingRequests.length} Requests</span>
                        <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-500 text-[10px] font-black">{activeInvitations.length} Invitations</span>
                    </div>
                </div>

                <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                    {/* section: Pending Requests */}
                    {pendingRequests.length > 0 && (
                        <div className="px-6 py-2 bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-gray-800">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Self-Requested Access</span>
                        </div>
                    )}
                    {pendingRequests.map(user => (
                        <UserRow key={user.id} user={user} type="REQUEST" />
                    ))}

                    {/* section: Active Invitations */}
                    {activeInvitations.length > 0 && (
                        <div className="px-6 py-2 bg-gray-50/50 dark:bg-white/5 border-y border-gray-100 dark:border-gray-800">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sent Invitations</span>
                        </div>
                    )}
                    {activeInvitations.map(user => (
                        <UserRow key={user.id} user={user} type="INVITE" />
                    ))}

                    {pendingRequests.length === 0 && activeInvitations.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                            <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle size={32} className="text-green-500/30" />
                            </div>
                            <p className="font-bold text-sm tracking-tight text-gray-300">Clean Slate! No pending requests or invitations.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Grant Access Modal (Shared for Approval & Add) */}
            {selectedUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in" onClick={() => setSelectedUser(null)}>
                    <div className="bg-white dark:bg-[#1e2029] rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-white/10" onClick={e => e.stopPropagation()}>
                        <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                            <div>
                                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Review Access</h3>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Configuring {selectedUser.name}</p>
                            </div>
                            <button onClick={() => setSelectedUser(null)} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800"><X size={20} className="text-gray-400" /></button>
                        </div>
                        
                        <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar">
                            {/* Role Selection */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block px-1">Security Role</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {roles.map(r => (
                                        <button 
                                            key={r.id}
                                            onClick={() => setSelectedRole(r.id)}
                                            className={`p-4 rounded-2xl text-left transition-all border flex items-center justify-between group ${selectedRole === r.id ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 ring-4 ring-[var(--color-brand)]/5' : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'}`}
                                        >
                                            <div>
                                                <div className={`font-black uppercase tracking-tight text-sm ${selectedRole === r.id ? 'text-[var(--color-brand)]' : 'text-gray-900 dark:text-white'}`}>{r.name}</div>
                                                <div className="text-[10px] font-medium text-gray-400">{r.description}</div>
                                            </div>
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectedRole === r.id ? 'border-[var(--color-brand)] bg-[var(--color-brand)]' : 'border-gray-200 dark:border-gray-700 group-hover:border-gray-300'}`}>
                                                {selectedRole === r.id && <Check size={12} className="text-white"/>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Site Access */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Site Access</label>
                                    <button 
                                        onClick={() => {
                                            if (grantAllSites) {
                                                setGrantAllSites(false);
                                                setSpecificSiteIds([]);
                                            } else {
                                                setGrantAllSites(true);
                                                setSpecificSiteIds(sites.map(s => s.id));
                                            }
                                        }}
                                        className={`text-[10px] font-black uppercase tracking-widest ${grantAllSites ? 'text-[var(--color-brand)]' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        {grantAllSites ? 'Deselect All' : 'Select All Sites'}
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    {sites.map(site => (
                                        <button 
                                            key={site.id}
                                            onClick={() => toggleSpecificSite(site.id)}
                                            className={`p-3 rounded-xl border text-[11px] font-black uppercase tracking-tight text-center transition-all ${specificSiteIds.includes(site.id) ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white shadow-lg shadow-[var(--color-brand)]/20' : 'border-gray-100 dark:border-gray-800 text-gray-500 hover:border-gray-200 dark:hover:border-gray-700 bg-gray-50/50 dark:bg-white/5'}`}
                                        >
                                            {site.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5 flex gap-3">
                            <button onClick={() => setSelectedUser(null)} className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-2xl transition-colors">Cancel</button>
                            <button 
                                onClick={handleApprove}
                                disabled={isProcessing}
                                className="flex-[2] bg-[var(--color-brand)] text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-[var(--color-brand)]/30 hover:-translate-y-0.5 transition-all active:translate-y-0 disabled:opacity-50"
                            >
                                {isProcessing ? 'Processing...' : 'Confirm Approval'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </>
    );
};

export default AdminAccessHub;
