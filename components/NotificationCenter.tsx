import React, { useState, useEffect, useMemo } from 'react';
import { 
    Bell, Check, Trash2, Search, Filter, Sliders, ExternalLink,
    CheckCircle2, AlertTriangle, AlertCircle, Info, Clock, 
    RefreshCw, MailOpen, Archive, CheckSquare, Square
} from 'lucide-react';
import { EnhancedAppNotification } from '../types';
import { useApp } from '../context/AppContext';
import { notificationEngineService } from '../services/notificationEngineService';
import { useNavigate } from 'react-router-dom';
import PageHeader from './PageHeader';
import NotificationPreferencesModal from './NotificationPreferencesModal';
import { useToast } from './ToastNotification';

export const NotificationCenter: React.FC = () => {
    const { currentUser } = useApp();
    const navigate = useNavigate();
    const { success, error } = useToast();

    const [notifications, setNotifications] = useState<EnhancedAppNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isPrefsOpen, setIsPrefsOpen] = useState(false);

    const loadNotifications = async () => {
        if (!currentUser?.id) return;
        setIsLoading(true);
        try {
            const data = await notificationEngineService.getUserNotifications(currentUser.id, 100);
            setNotifications(data);
        } catch (err) {
            console.error('Failed to load notifications:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, [currentUser?.id]);

    const filteredList = useMemo(() => {
        return notifications.filter(n => {
            if (categoryFilter !== 'ALL' && n.category !== categoryFilter) return false;
            if (statusFilter === 'UNREAD' && n.is_read) return false;
            if (statusFilter === 'READ' && !n.is_read) return false;

            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const matchTitle = n.title?.toLowerCase().includes(query);
                const matchMsg = n.message?.toLowerCase().includes(query);
                const matchEntity = n.entity_id?.toLowerCase().includes(query);
                if (!matchTitle && !matchMsg && !matchEntity) return false;
            }

            return true;
        });
    }, [notifications, categoryFilter, statusFilter, searchQuery]);

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedIds.length === filteredList.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredList.map(n => n.id));
        }
    };

    const handleMarkSelectedAsRead = async () => {
        try {
            for (const id of selectedIds) {
                await notificationEngineService.markAsRead(id);
            }
            setNotifications(prev => prev.map(n => selectedIds.includes(n.id) ? { ...n, is_read: true } : n));
            setSelectedIds([]);
            success('Marked selected notifications as read');
        } catch {
            error('Failed to update notifications');
        }
    };

    const handleArchiveSelected = async () => {
        try {
            for (const id of selectedIds) {
                await notificationEngineService.archiveNotification(id);
            }
            setNotifications(prev => prev.filter(n => !selectedIds.includes(n.id)));
            setSelectedIds([]);
            success('Archived selected notifications');
        } catch {
            error('Failed to archive notifications');
        }
    };

    const handleMarkAllAsRead = async () => {
        if (!currentUser?.id) return;
        try {
            await notificationEngineService.markAllAsRead(currentUser.id);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            success('All notifications marked as read');
        } catch {
            error('Failed to mark all as read');
        }
    };

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case 'CRITICAL':
                return <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Critical</span>;
            case 'WARNING':
                return <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Warning</span>;
            case 'SUCCESS':
                return <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Success</span>;
            default:
                return <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Info</span>;
        }
    };

    return (
        <div className="space-y-6 animate-page-entry pb-12 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <PageHeader
                    title="Notification Center"
                    subtitle="Manage and track your operational alerts, approvals, and system notifications."
                />
                
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={() => setIsPrefsOpen(true)}
                        className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-nocturne text-gray-700 dark:text-gray-200 font-bold text-xs hover:bg-gray-50 dark:hover:bg-white/5 transition-all flex items-center gap-2 shadow-sm"
                    >
                        <Sliders size={16} />
                        Preferences
                    </button>
                    
                    <button
                        type="button"
                        onClick={handleMarkAllAsRead}
                        className="px-4 py-2.5 rounded-xl bg-[var(--color-brand)] text-white font-bold text-xs shadow-lg shadow-[rgba(var(--color-brand-rgb),0.2)] hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Check size={16} />
                        Mark All Read
                    </button>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white dark:bg-nocturne p-4 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-80">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search notifications..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                    />
                </div>

                {/* Filter Badges */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {[
                        { id: 'ALL', label: 'All Categories' },
                        { id: 'APPROVAL', label: 'Approvals' },
                        { id: 'STATUS_CHANGE', label: 'Status Updates' },
                        { id: 'ITEM_LIFECYCLE', label: 'Item Master Data' },
                        { id: 'DELIVERY', label: 'Deliveries' },
                        { id: 'ALERT', label: 'SLA Alerts' }
                    ].map(cat => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setCategoryFilter(cat.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                categoryFilter === cat.id
                                    ? 'bg-[var(--color-brand)] text-white shadow-sm'
                                    : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                            }`}
                        >
                            {cat.label}
                        </button>
                    ))}

                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1 hidden sm:block" />

                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                        className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-300"
                    >
                        <option value="ALL">All Status</option>
                        <option value="UNREAD">Unread Only</option>
                        <option value="READ">Read Only</option>
                    </select>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="p-3 bg-blue-50 dark:bg-[var(--color-brand)]/10 border border-blue-200 dark:border-[var(--color-brand)]/30 rounded-2xl flex items-center justify-between animate-slide-down">
                    <div className="flex items-center gap-3 pl-2">
                        <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                            {selectedIds.length} notifications selected
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleMarkSelectedAsRead}
                            className="px-3 py-1.5 bg-white dark:bg-nocturne border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 flex items-center gap-1.5"
                        >
                            <MailOpen size={14} /> Mark Read
                        </button>
                        <button
                            type="button"
                            onClick={handleArchiveSelected}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 flex items-center gap-1.5"
                        >
                            <Archive size={14} /> Archive
                        </button>
                    </div>
                </div>
            )}

            {/* Main Notifications Table */}
            <div className="bg-white dark:bg-nocturne rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
                    <button
                        type="button"
                        onClick={handleSelectAll}
                        className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white"
                    >
                        {selectedIds.length === filteredList.length && filteredList.length > 0 ? (
                            <CheckSquare size={16} className="text-[var(--color-brand)]" />
                        ) : (
                            <Square size={16} />
                        )}
                        Select All ({filteredList.length})
                    </button>

                    <button
                        type="button"
                        onClick={loadNotifications}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        title="Refresh notifications"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {isLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-brand)] mb-3" />
                        <span className="text-xs text-gray-400">Loading notifications...</span>
                    </div>
                ) : filteredList.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-center px-4">
                        <div className="w-16 h-16 rounded-3xl bg-gray-100 dark:bg-white/5 text-gray-400 flex items-center justify-center mb-4">
                            <Bell size={32} />
                        </div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">No notifications found</h3>
                        <p className="text-xs text-gray-500 mt-1 max-w-sm">
                            You're all caught up! You will be notified here as soon as there are actionable events or updates.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-white/5">
                        {filteredList.map((notif) => {
                            const isSelected = selectedIds.includes(notif.id);
                            return (
                                <div
                                    key={notif.id}
                                    className={`p-5 flex items-start gap-4 transition-colors ${
                                        !notif.is_read 
                                            ? 'bg-blue-50/30 dark:bg-[var(--color-brand)]/5 font-medium' 
                                            : 'hover:bg-gray-50/50 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleToggleSelect(notif.id)}
                                        className="mt-1 text-gray-400 hover:text-gray-600"
                                    >
                                        {isSelected ? (
                                            <CheckSquare size={18} className="text-[var(--color-brand)]" />
                                        ) : (
                                            <Square size={18} />
                                        )}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            {getSeverityBadge(notif.severity)}
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                                {notif.category}
                                            </span>
                                            <span className="text-[11px] text-gray-400 ml-auto flex items-center gap-1">
                                                <Clock size={12} />
                                                {new Date(notif.created_at).toLocaleString()}
                                            </span>
                                        </div>

                                        <h4 className={`text-sm font-bold ${!notif.is_read ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                            {notif.title}
                                        </h4>

                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                            {notif.message}
                                        </p>

                                        {notif.action_url && (
                                            <div className="mt-3">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (notif.action_url?.startsWith('http')) {
                                                            window.open(notif.action_url, '_blank');
                                                        } else if (notif.action_url) {
                                                            navigate(notif.action_url);
                                                        }
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-white/10 text-[var(--color-brand)] font-bold text-xs hover:bg-[var(--color-brand)] hover:text-white transition-all shadow-sm"
                                                >
                                                    {notif.action_label || 'View Details'}
                                                    <ExternalLink size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Notification Preferences Modal */}
            {currentUser?.id && (
                <NotificationPreferencesModal
                    isOpen={isPrefsOpen}
                    onClose={() => setIsPrefsOpen(false)}
                    userId={currentUser.id}
                />
            )}
        </div>
    );
};

export default NotificationCenter;
