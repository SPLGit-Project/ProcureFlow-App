import React, { useState, useEffect } from 'react';
import { 
    X, Bell, Volume2, Mail, MessageSquare, Moon, Clock, 
    Save, CheckCircle2, ShieldAlert, Sliders, Lock
} from 'lucide-react';
import { UserNotificationPreferences } from '../types';
import { notificationEngineService } from '../services/notificationEngineService';
import { playNotificationChime } from '../services/realtimeNotificationService';
import { useToast } from './ToastNotification';
import { useApp } from '../context/AppContext';
import { getUserEligibleScenarios, NOTIFICATION_SCENARIOS, isScenarioAllowedForRoles } from '../utils/notificationScenarios';

interface NotificationPreferencesModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

export const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
    isOpen,
    onClose,
    userId
}) => {
    const { success, error } = useToast();
    const { currentUser, roles, users, hasPermission } = useApp();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [prefs, setPrefs] = useState<UserNotificationPreferences>({
        user_id: userId,
        email_enabled: true,
        in_app_enabled: true,
        teams_enabled: true,
        sound_enabled: true,
        digest_frequency: 'INSTANT',
        quiet_hours_enabled: false,
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00',
        category_overrides: {
            APPROVAL: { in_app: true, email: true, teams: true },
            STATUS_CHANGE: { in_app: true, email: true, teams: false },
            ITEM_LIFECYCLE: { in_app: true, email: true, teams: true },
            DELIVERY: { in_app: true, email: false, teams: false },
            ALERT: { in_app: true, email: true, teams: true }
        }
    });

    useEffect(() => {
        if (!isOpen || !userId) return;

        const loadPrefs = async () => {
            setIsLoading(true);
            try {
                const data = await notificationEngineService.getUserPreferences(userId);
                if (data) {
                    setPrefs(data);
                }
            } catch (err) {
                console.error('Failed to load user notification preferences:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadPrefs();
    }, [isOpen, userId]);

    if (!isOpen) return null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await notificationEngineService.saveUserPreferences(prefs);
            success('Notification preferences saved successfully');
            onClose();
        } catch (err) {
            console.error('Failed to save preferences:', err);
            error('Failed to save preferences');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleCategoryChannel = (category: string, channel: 'in_app' | 'email' | 'teams') => {
        setPrefs(prev => {
            const current = prev.category_overrides[category] || { in_app: true, email: true, teams: true };
            return {
                ...prev,
                category_overrides: {
                    ...prev.category_overrides,
                    [category]: {
                        ...current,
                        [channel]: !current[channel]
                    }
                }
            };
        });
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            
            <div className="relative w-full max-w-2xl bg-white dark:bg-[#1a1d27] rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-white/10 animate-slide-up flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center">
                            <Sliders size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Notification Preferences</h2>
                            <p className="text-xs text-gray-500">Customize how and when you receive notifications</p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {isLoading ? (
                        <div className="py-12 flex justify-center items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-brand)]" />
                        </div>
                    ) : (
                        <>
                            {/* Global Channel Toggles */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Global Channels</h3>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* In-App */}
                                    <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
                                                <Bell size={18} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">In-App Alerts</div>
                                                <div className="text-xs text-gray-500">Live notifications in app</div>
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={prefs.in_app_enabled}
                                            onChange={e => setPrefs({ ...prefs, in_app_enabled: e.target.checked })}
                                            className="w-5 h-5 accent-[var(--color-brand)] rounded"
                                        />
                                    </div>

                                    {/* Sound Chimes */}
                                    <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                                                <Volume2 size={18} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">Audio Chimes</div>
                                                <button 
                                                    type="button" 
                                                    onClick={() => playNotificationChime('subtle')}
                                                    className="text-[11px] text-[var(--color-brand)] font-bold hover:underline"
                                                >
                                                    Play test chime
                                                </button>
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={prefs.sound_enabled}
                                            onChange={e => setPrefs({ ...prefs, sound_enabled: e.target.checked })}
                                            className="w-5 h-5 accent-[var(--color-brand)] rounded"
                                        />
                                    </div>

                                    {/* Email */}
                                    <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                                                <Mail size={18} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">Email Digest</div>
                                                <div className="text-xs text-gray-500">Actionable email alerts</div>
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={prefs.email_enabled}
                                            onChange={e => setPrefs({ ...prefs, email_enabled: e.target.checked })}
                                            className="w-5 h-5 accent-[var(--color-brand)] rounded"
                                        />
                                    </div>

                                    {/* Teams */}
                                    <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500">
                                                <MessageSquare size={18} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">MS Teams</div>
                                                <div className="text-xs text-gray-500">Direct webhook alerts</div>
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={prefs.teams_enabled}
                                            onChange={e => setPrefs({ ...prefs, teams_enabled: e.target.checked })}
                                            className="w-5 h-5 accent-[var(--color-brand)] rounded"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Quiet Hours */}
                            <div className="p-5 rounded-2xl border border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500">
                                            <Moon size={18} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-900 dark:text-white">Quiet Hours</div>
                                            <div className="text-xs text-gray-500">Mute non-urgent audio chimes and popups</div>
                                        </div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={prefs.quiet_hours_enabled}
                                        onChange={e => setPrefs({ ...prefs, quiet_hours_enabled: e.target.checked })}
                                        className="w-5 h-5 accent-[var(--color-brand)] rounded"
                                    />
                                </div>

                                {prefs.quiet_hours_enabled && (
                                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-white/5">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Start Time</label>
                                            <input
                                                type="time"
                                                value={prefs.quiet_hours_start || '22:00'}
                                                onChange={e => setPrefs({ ...prefs, quiet_hours_start: e.target.value })}
                                                className="w-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">End Time</label>
                                            <input
                                                type="time"
                                                value={prefs.quiet_hours_end || '07:00'}
                                                onChange={e => setPrefs({ ...prefs, quiet_hours_end: e.target.value })}
                                                className="w-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Category Granular Matrix */}
                            {(() => {
                                const targetUser = users?.find(u => u.id === userId) || (currentUser?.id === userId ? currentUser : null);
                                const eligibleScenarios = getUserEligibleScenarios(targetUser, roles, hasPermission);
                                const userRoleNames = (targetUser?.roleIds || [targetUser?.role]).filter(Boolean).map(rid => roles.find(r => r.id === rid)?.name || rid).join(', ') || 'Standard Member';

                                return (
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Scenario Channel Routing</h3>
                                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                                    {eligibleScenarios.length} Active
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 mt-0.5">
                                                Workflows unlocked for assigned roles: <span className="font-bold text-gray-700 dark:text-gray-300">{userRoleNames}</span>.
                                            </p>
                                        </div>
                                        
                                        <div className="border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden bg-white dark:bg-nocturne">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-gray-50/80 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 text-[10px] uppercase font-black tracking-widest text-gray-400">
                                                    <tr>
                                                        <th className="px-4 py-3">Procurement Scenario</th>
                                                        <th className="px-4 py-3 text-center">In-App</th>
                                                        <th className="px-4 py-3 text-center">Email</th>
                                                        <th className="px-4 py-3 text-center">Teams</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs font-medium">
                                                    {eligibleScenarios.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                                                                <div className="flex flex-col items-center gap-2">
                                                                    <Lock size={20} className="text-gray-300 dark:text-gray-600" />
                                                                    <p className="font-bold text-xs text-gray-500">No active notification scenarios</p>
                                                                    <p className="text-[11px]">No workflows are currently assigned to your roles ({userRoleNames}).</p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        eligibleScenarios.map(cat => {
                                                            const current = prefs.category_overrides[cat.key] || { in_app: true, email: true, teams: true };
                                                            return (
                                                                <tr key={cat.key} className="hover:bg-gray-50/50 dark:hover:bg-white/5">
                                                                    <td className="px-4 py-3">
                                                                        <div className="flex items-center gap-2 mb-0.5">
                                                                            <span className="font-bold text-gray-900 dark:text-white">{cat.title}</span>
                                                                            <span className="text-[8px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">
                                                                                {cat.badge}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-[10px] text-gray-400 leading-tight">{cat.desc}</p>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={current.in_app !== false}
                                                                            onChange={() => toggleCategoryChannel(cat.key, 'in_app')}
                                                                            className="w-4 h-4 accent-[var(--color-brand)] rounded cursor-pointer"
                                                                        />
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={current.email !== false}
                                                                            onChange={() => toggleCategoryChannel(cat.key, 'email')}
                                                                            className="w-4 h-4 accent-[var(--color-brand)] rounded cursor-pointer"
                                                                        />
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={current.teams !== false}
                                                                            onChange={() => toggleCategoryChannel(cat.key, 'teams')}
                                                                            className="w-4 h-4 accent-[var(--color-brand)] rounded cursor-pointer"
                                                                        />
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
                            })()}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-white dark:bg-[#1a1d27] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white rounded-xl text-sm font-bold hover:bg-gray-50 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 px-4 py-3 bg-[var(--color-brand)] text-white rounded-xl text-sm font-bold shadow-lg shadow-[rgba(var(--color-brand-rgb),0.2)] hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <Save size={18} />
                                Save Preferences
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationPreferencesModal;
