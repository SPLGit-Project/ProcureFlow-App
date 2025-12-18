import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { UserCheck, UserX, Clock, Search, Shield } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { User } from '../types';

const AdminUserApproval = () => {
    const { users, reloadData } = useApp();
    const [pendingUsers, setPendingUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setPendingUsers(users.filter(u => u.status === 'PENDING_APPROVAL'));
    }, [users]);

    const handleAction = async (userId: string, status: 'APPROVED' | 'REJECTED') => {
        setLoading(userId as any);
        try {
            const { error } = await supabase
                .from('users')
                .update({ status })
                .eq('id', userId);

            if (error) throw error;
            await reloadData();
        } catch (err) {
            console.error("Failed to update user status:", err);
            alert("Failed to update user status");
        } finally {
            setLoading(false as any);
        }
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
                        <div key={user.id} className="bg-white dark:bg-[#1e2029] rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#15171e] flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold overflow-hidden">
                                    {user.avatar ? <img src={user.avatar} alt="" /> : user.name.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white">{user.name}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => handleAction(user.id, 'REJECTED')}
                                    disabled={!!loading}
                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                    title="Reject Request"
                                >
                                    <UserX size={20} />
                                </button>
                                <button 
                                    onClick={() => handleAction(user.id, 'APPROVED')}
                                    disabled={!!loading}
                                    className="flex items-center gap-2 bg-[var(--color-brand)] hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                                >
                                    <UserCheck size={18} />
                                    Approve Access
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminUserApproval;
