
import React from 'react';
import { 
  X, LogOut, UserCog, ChevronDown, 
  Settings, Shield, Globe, ChevronRight
} from 'lucide-react';
import { UserRole } from '../types.ts';
import { useApp } from '../context/AppContext.tsx';
import { useNavigate } from 'react-router-dom';

interface AccountDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

const AccountDrawer = ({ isOpen, onClose }: AccountDrawerProps) => {
    const { currentUser, roles, switchRole, logout } = useApp();
    const navigate = useNavigate();
    const [isRoleSwitcherExpanded, setIsRoleSwitcherExpanded] = React.useState(false);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-fade-in" 
                onClick={onClose}
            ></div>

            {/* Drawer Content */}
            <div className={`relative w-full max-w-sm bg-white dark:bg-[#1e2029] h-full shadow-2xl flex flex-col border-l border-default animate-slide-in-right`}>
                
                {/* Header */}
                <div className="p-6 border-b border-default bg-gray-50/50 dark:bg-white/5 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-primary dark:text-white">Account Settings</h2>
                    <button 
                        type="button"
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors text-tertiary"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    
                    {/* User Profile Card */}
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-white/5 dark:to-white/[0.02] border border-default rounded-3xl p-6 text-center shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--color-brand)]/5 rounded-full -translate-y-12 translate-x-12 blur-2xl"></div>
                        
                        <div className="relative mx-auto w-24 h-24 mb-4">
                            <img 
                                src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || '')}&background=random&color=fff`} 
                                alt="User" 
                                className="w-full h-full rounded-[2.5rem] bg-gray-200 border-4 border-white dark:border-gray-800 shadow-xl object-cover"
                            />
                            <div className="absolute -bottom-1 -right-1 p-2 bg-emerald-500 text-white rounded-2xl border-4 border-white dark:border-gray-800 shadow-lg">
                                <Shield size={14} />
                            </div>
                        </div>

                        <h3 className="text-xl font-black text-primary dark:text-white truncate">{currentUser?.name}</h3>
                        <p className="text-xs text-secondary dark:text-gray-400 font-medium mt-1 uppercase tracking-widest">
                            {roles.find(r => r.id === currentUser?.role)?.name || currentUser?.role}
                        </p>
                    </div>

                    {/* Quick Settings Links */}
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-tertiary dark:text-gray-500 uppercase tracking-widest pl-1 mb-3">Preferences</p>
                        
                        <button 
                            type="button"
                            onClick={() => { onClose(); navigate('/settings', { state: { activeTab: 'PROFILE' } }); }}
                            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-surface border border-default hover:border-[var(--color-brand)]/30 hover:shadow-md transition-all group"
                        >
                            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                <UserCog size={20} />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-bold text-primary dark:text-white">Edit Profile</p>
                                <p className="text-[10px] text-tertiary dark:text-gray-500 mt-0.5">Manage your personal info</p>
                            </div>
                            <ChevronRight size={18} className="text-tertiary group-hover:translate-x-0.5 transition-transform" />
                        </button>

                        <button 
                            type="button"
                            onClick={() => { onClose(); navigate('/settings'); }}
                            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-surface border border-default hover:border-[var(--color-brand)]/30 hover:shadow-md transition-all group"
                        >
                            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20 group-hover:bg-purple-500 group-hover:text-white transition-all">
                                <Settings size={20} />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-bold text-primary dark:text-white">System Settings</p>
                                <p className="text-[10px] text-tertiary dark:text-gray-500 mt-0.5">App configuration & sites</p>
                            </div>
                            <ChevronRight size={18} className="text-tertiary group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>

                    {/* Role Switcher (Admin Only) */}
                    {currentUser?.realRole === 'ADMIN' && (
                        <div className="bg-gray-50 dark:bg-white/5 border border-default rounded-3xl overflow-hidden transition-all">
                            <button 
                                type="button"
                                onClick={() => setIsRoleSwitcherExpanded(!isRoleSwitcherExpanded)}
                                className="w-full p-4 flex items-center justify-between text-left group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                                        <Globe size={18} />
                                    </div>
                                    <span className="text-sm font-bold text-primary dark:text-white">Switch View</span>
                                </div>
                                <div className={`transition-transform duration-300 ${isRoleSwitcherExpanded ? 'rotate-180' : ''}`}>
                                    <ChevronDown size={18} className="text-tertiary" />
                                </div>
                            </button>
                            
                            <div className={`overflow-hidden transition-all duration-300 ${isRoleSwitcherExpanded ? 'max-h-96 opacity-100 p-4 pt-0 space-y-2' : 'max-h-0 opacity-0'}`}>
                                <div className="h-px bg-default mb-3"></div>
                                {roles.map(r => (
                                    <label 
                                        key={r.id}
                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${currentUser.role === r.id ? 'bg-[var(--color-brand)]/10 border-[var(--color-brand)]/30 text-[var(--color-brand)]' : 'bg-white dark:bg-gray-800 border-default hover:border-gray-300 dark:hover:border-gray-700'}`}
                                    >
                                        <input 
                                            type="radio" 
                                            name="role" 
                                            value={r.id} 
                                            checked={currentUser.role === r.id}
                                            onChange={() => switchRole(r.id as UserRole)}
                                            className="hidden"
                                        />
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${currentUser.role === r.id ? 'border-[var(--color-brand)]' : 'border-gray-300'}`}>
                                            {currentUser.role === r.id && <div className="w-2 h-2 bg-[var(--color-brand)] rounded-full"></div>}
                                        </div>
                                        <span className="text-xs font-bold">{r.name} View</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-default bg-gray-50/50 dark:bg-white/5 mt-auto">
                    <button 
                        type="button"
                        onClick={() => { onClose(); logout(); }}
                        className="w-full flex items-center justify-center gap-3 py-4 bg-red-500/10 text-red-500 dark:bg-red-500/5 dark:text-red-400 border border-red-500/20 dark:border-red-500/10 rounded-2xl font-black hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white hover:shadow-lg hover:shadow-red-500/20 active:scale-[0.98] transition-all text-sm group"
                    >
                        <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" /> 
                        SIGN OUT
                    </button>
                    <p className="text-[10px] text-center text-tertiary dark:text-gray-500 font-bold mt-4 uppercase tracking-[0.2em] opacity-50">
                        ProcureFlow Enterprise v5.0.1
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AccountDrawer;
