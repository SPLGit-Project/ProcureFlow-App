import React from 'react';
import { useApp } from '../context/AppContext';
import { Clock, LogOut } from 'lucide-react';

const PendingApproval = () => {
    const { logout, currentUser } = useApp();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#15171e] flex flex-col items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-8 w-full max-w-md text-center animate-slide-up">
                <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Clock className="text-amber-600 dark:text-amber-400" size={32} />
                </div>
                
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Pending Approval</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Hi {currentUser?.name}, your account is currently pending approval by an administrator. 
                    You will be able to access the dashboard once your request is processed.
                </p>

                <div className="space-y-4">
                    <div className="p-4 bg-gray-50 dark:bg-[#15171e] rounded-xl text-left border border-gray-100 dark:border-gray-800">
                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Signed in as</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{currentUser?.email}</p>
                    </div>

                    <button 
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors py-2"
                    >
                        <LogOut size={16} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PendingApproval;
