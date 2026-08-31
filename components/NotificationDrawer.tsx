import React, { useState, useMemo } from 'react';
import { 
    X, Bell, CheckCircle2, AlertTriangle, AlertCircle, 
    Info, Clock, ExternalLink, Trash2, Check, Sliders,
    Volume2, VolumeX, Inbox
} from 'lucide-react';
import { EnhancedAppNotification } from '../types';
import { useNavigate } from 'react-router-dom';
import { notificationEngineService } from '../services/notificationEngineService';
import { playNotificationChime } from '../services/realtimeNotificationService';

interface NotificationDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: EnhancedAppNotification[];
    onRefresh: () => void;
    onOpenPreferences: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
    isOpen,
    onClose,
    notifications,
    onRefresh,
    onOpenPreferences
}) => {
    const navigate = useNavigate();
    const [selectedTab, setSelectedTab] = useState<'ALL' | 'ACTION' | 'UPDATES' | 'SYSTEM'>('ALL');
    const [soundMuted, setSoundMuted] = useState(false);

    const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

    const filteredNotifications = useMemo(() => {
        return notifications.filter(n => {
            if (selectedTab === 'ACTION') return n.category === 'APPROVAL' || n.severity === 'WARNING';
            if (selectedTab === 'UPDATES') return n.category === 'STATUS_CHANGE' || n.category === 'DELIVERY' || n.category === 'ITEM_LIFECYCLE';
            if (selectedTab === 'SYSTEM') return n.category === 'ALERT' || n.category === 'SYSTEM';
            return true;
        });
    }, [notifications, selectedTab]);

    if (!isOpen) return null;

    const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        await notificationEngineService.markAsRead(id);
        onRefresh();
    };

    const handleMarkAllRead = async () => {
        if (notifications.length === 0) return;
        const userId = notifications[0]?.user_id;
        if (userId) {
            await notificationEngineService.markAllAsRead(userId);
            onRefresh();
        }
    };

    const handleItemClick = async (notif: EnhancedAppNotification) => {
        if (!notif.is_read) {
            await notificationEngineService.markAsRead(notif.id);
            onRefresh();
        }

        if (notif.action_url) {
            if (notif.action_url.startsWith('http')) {
                window.open(notif.action_url, '_blank');
            } else {
                navigate(notif.action_url);
                onClose();
            }
        }
    };

    const getTimeAgo = (dateStr: string): string => {
        const d = new Date(dateStr);
        const diff = Math.floor((Date.now() - d.getTime()) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const getSeverityIcon = (severity: string, category: string) => {
        if (severity === 'CRITICAL') return <AlertCircle size={18} className="text-red-500" />;
        if (severity === 'WARNING') return <AlertTriangle size={18} className="text-amber-500" />;
        if (severity === 'SUCCESS') return <CheckCircle2 size={18} className="text-emerald-500" />;
        return <Info size={18} className="text-blue-500" />;
    };

    return (
        <div className="fixed inset-0 z-[120] flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />

            {/* Slide-over Panel */}
            <div className="relative w-full max-w-md bg-white dark:bg-nocturne h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-white/10 animate-slide-in-right">
                
                {/* Header */}
                <div className="p-5 border-b border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-2xl bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center">
                            <Bell size={20} />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 min-w-[18px] text-[10px] font-black rounded-full bg-red-500 text-white flex items-center justify-center animate-pulse">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900 dark:text-white">Notifications</h2>
                            <p className="text-xs text-gray-500 font-medium">
                                {unreadCount > 0 ? `${unreadCount} unread alerts` : 'All caught up!'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => {
                                setSoundMuted(!soundMuted);
                                if (soundMuted) playNotificationChime('subtle');
                            }}
                            className={`p-2 rounded-xl transition-colors ${soundMuted ? 'text-gray-400 hover:text-gray-600' : 'text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10'}`}
                            title={soundMuted ? 'Unmute notification sound' : 'Mute notification sound'}
                        >
                            {soundMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>

                        <button
                            type="button"
                            onClick={onOpenPreferences}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                            title="Notification Preferences"
                        >
                            <Sliders size={18} />
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="px-5 pt-3 pb-2 border-b border-gray-100 dark:border-white/5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                        {[
                            { id: 'ALL', label: 'All' },
                            { id: 'ACTION', label: 'Action Required' },
                            { id: 'UPDATES', label: 'Updates' },
                            { id: 'SYSTEM', label: 'System' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setSelectedTab(tab.id as any)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                                    selectedTab === tab.id
                                        ? 'bg-[var(--color-brand)] text-white shadow-sm shadow-[var(--color-brand)]/30'
                                        : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {unreadCount > 0 && (
                        <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="text-[11px] text-[var(--color-brand)] font-bold hover:underline shrink-0 flex items-center gap-1"
                        >
                            <Check size={12} />
                            Mark all read
                        </button>
                    )}
                </div>

                {/* Notification Feed */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
                    {filteredNotifications.length === 0 ? (
                        <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                            <div className="w-16 h-16 rounded-3xl bg-gray-100 dark:bg-white/5 text-gray-400 flex items-center justify-center mb-4">
                                <Inbox size={32} />
                            </div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">No notifications in this view</h4>
                            <p className="text-xs text-gray-500 mt-1 max-w-[240px]">
                                When new approvals or updates arrive, they will appear here in real time.
                            </p>
                        </div>
                    ) : (
                        filteredNotifications.map((notif) => {
                            const isUnread = !notif.is_read;
                            return (
                                <div
                                    key={notif.id}
                                    onClick={() => handleItemClick(notif)}
                                    className={`group relative p-4 rounded-2xl border transition-all cursor-pointer overflow-hidden ${
                                        isUnread
                                            ? 'bg-blue-50/50 dark:bg-[var(--color-brand)]/10 border-blue-200 dark:border-[var(--color-brand)]/30 shadow-sm'
                                            : 'bg-white dark:bg-white/5 border-gray-100 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/20'
                                    }`}
                                >
                                    {isUnread && (
                                        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[var(--color-brand)]" />
                                    )}

                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 shrink-0">
                                            {getSeverityIcon(notif.severity, notif.category)}
                                        </div>

                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center gap-2">
                                                <h4 className={`text-xs font-bold truncate ${isUnread ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                                    {notif.title}
                                                </h4>
                                            </div>

                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">
                                                {notif.message}
                                            </p>

                                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100/80 dark:border-white/5 text-[11px] text-gray-400">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock size={12} />
                                                    <span>{getTimeAgo(notif.created_at)}</span>
                                                </div>

                                                {notif.action_label && (
                                                    <span className="font-bold text-[var(--color-brand)] flex items-center gap-1 group-hover:underline">
                                                        {notif.action_label}
                                                        <ExternalLink size={12} />
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-white/5 flex gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            navigate('/notifications');
                            onClose();
                        }}
                        className="w-full py-3 bg-[var(--color-brand)] text-white rounded-xl font-bold text-xs shadow-lg shadow-[var(--color-brand)]/20 hover:opacity-90 active:scale-95 transition-all text-center flex items-center justify-center gap-2"
                    >
                        <Inbox size={16} />
                        Open Full Notification Center
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationDrawer;
