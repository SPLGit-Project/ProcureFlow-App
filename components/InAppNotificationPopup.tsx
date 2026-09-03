import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Bell, CheckCircle2, AlertTriangle, AlertCircle, Info, 
    X, ArrowRight
} from 'lucide-react';
import { EnhancedAppNotification } from '../types';
import { notificationEngineService } from '../services/notificationEngineService';

interface InAppNotificationPopupItemProps {
    notification: EnhancedAppNotification;
    onDismiss: (id: string) => void;
    onOpenDrawer?: () => void;
    onRefresh?: () => void;
}

const InAppNotificationPopupItem: React.FC<InAppNotificationPopupItemProps> = ({
    notification,
    onDismiss,
    onOpenDrawer,
    onRefresh
}) => {
    const navigate = useNavigate();
    const [isHovered, setIsHovered] = useState(false);
    const [progress, setProgress] = useState(100);
    const duration = 8000; // 8 seconds
    const intervalTime = 50;

    useEffect(() => {
        if (isHovered) return;

        const timer = setInterval(() => {
            setProgress(prev => {
                const next = prev - (intervalTime / duration) * 100;
                if (next <= 0) {
                    clearInterval(timer);
                    onDismiss(notification.id);
                    return 0;
                }
                return next;
            });
        }, intervalTime);

        return () => clearInterval(timer);
    }, [isHovered, notification.id, onDismiss]);

    const handleAction = async (e: React.MouseEvent) => {
        e.stopPropagation();
        onDismiss(notification.id);

        try {
            await notificationEngineService.markAsRead(notification.id);
            if (onRefresh) onRefresh();
        } catch {
            // non-fatal
        }

        if (notification.action_url) {
            if (notification.action_url.startsWith('http')) {
                window.open(notification.action_url, '_blank');
            } else {
                navigate(notification.action_url);
            }
        } else if (onOpenDrawer) {
            onOpenDrawer();
        }
    };

    const handleCardClick = () => {
        if (notification.action_url) {
            handleAction({ stopPropagation: () => {} } as React.MouseEvent);
        } else if (onOpenDrawer) {
            onDismiss(notification.id);
            onOpenDrawer();
        }
    };

    // Severity styling mapping
    const getSeverityConfig = () => {
        switch (notification.severity) {
            case 'CRITICAL':
                return {
                    border: 'border-red-500/50 dark:border-red-500/40',
                    bgAccent: 'bg-red-500/10 text-red-600 dark:text-red-400',
                    pill: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 border-red-200 dark:border-red-900/50',
                    bar: 'bg-red-500',
                    icon: <AlertCircle size={18} className="text-red-500" />,
                    glow: 'shadow-red-500/10'
                };
            case 'WARNING':
                return {
                    border: 'border-amber-500/50 dark:border-amber-500/40',
                    bgAccent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                    pill: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-900/50',
                    bar: 'bg-amber-500',
                    icon: <AlertTriangle size={18} className="text-amber-500" />,
                    glow: 'shadow-amber-500/10'
                };
            case 'SUCCESS':
                return {
                    border: 'border-emerald-500/50 dark:border-emerald-500/40',
                    bgAccent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                    pill: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50',
                    bar: 'bg-emerald-500',
                    icon: <CheckCircle2 size={18} className="text-emerald-500" />,
                    glow: 'shadow-emerald-500/10'
                };
            default:
                return {
                    border: 'border-indigo-500/50 dark:border-indigo-500/40',
                    bgAccent: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
                    pill: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/50',
                    bar: 'bg-indigo-500',
                    icon: <Bell size={18} className="text-indigo-500" />,
                    glow: 'shadow-indigo-500/10'
                };
        }
    };

    const config = getSeverityConfig();

    // Category label
    const getCategoryLabel = () => {
        switch (notification.category) {
            case 'APPROVAL': return 'Approval Request';
            case 'STATUS_CHANGE': return 'Status Update';
            case 'DELIVERY': return 'Delivery Alert';
            case 'ITEM_LIFECYCLE': return 'Item Master';
            case 'PRICING': return 'Pricing Update';
            case 'ALERT': return 'System Alert';
            default: return 'Notification';
        }
    };

    // Metadata badges
    const meta = (notification.metadata || {}) as Record<string, unknown>;
    const poNumber = meta.po_number || meta.poNumber || (notification.entity_type === 'PO' ? notification.entity_id : null);
    const amount = meta.total_amount || meta.totalAmount || meta.amount;
    const siteName = meta.site_name || meta.siteName;

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleCardClick}
            className={`relative w-full max-w-md bg-white/95 dark:bg-[#181b24]/95 backdrop-blur-xl border ${config.border} rounded-2xl shadow-2xl ${config.glow} overflow-hidden transition-all duration-300 hover:scale-[1.01] cursor-pointer group animate-slide-up select-none`}
            role="alert"
        >
            {/* Top accent border line */}
            <div className={`h-1 w-full ${config.bar}`} />

            <div className="p-4 space-y-2.5">
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className={`p-1.5 rounded-xl ${config.bgAccent} shrink-0`}>
                            {config.icon}
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${config.pill} truncate`}>
                            {getCategoryLabel()}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Just now
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDismiss(notification.id);
                        }}
                        className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors shrink-0"
                        title="Dismiss alert"
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Content */}
                <div className="space-y-1">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white leading-snug line-clamp-1">
                        {notification.title}
                    </h4>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2">
                        {notification.message}
                    </p>
                </div>

                {/* Metadata Pills */}
                {(poNumber || amount || siteName) && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {poNumber && (
                            <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 font-mono text-[10px] font-bold text-gray-700 dark:text-gray-300">
                                {String(poNumber)}
                            </span>
                        )}
                        {amount && (
                            <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                                {String(amount)}
                            </span>
                        )}
                        {siteName && (
                            <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                                {String(siteName)}
                            </span>
                        )}
                    </div>
                )}

                {/* Action Bar */}
                <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-white/5">
                    <span className="text-[10px] text-gray-400 font-medium">
                        {isHovered ? 'Paused' : 'Auto-dismissing'}
                    </span>

                    <div className="flex items-center gap-2">
                        {notification.action_url && (
                            <button
                                type="button"
                                onClick={handleAction}
                                className="px-3 py-1.5 bg-[var(--color-brand)] text-white text-xs font-bold rounded-lg shadow-sm hover:opacity-90 transition-all flex items-center gap-1 group-hover:scale-105"
                            >
                                {notification.action_label || 'View Details'}
                                <ArrowRight size={12} />
                            </button>
                        )}
                        {onOpenDrawer && !notification.action_url && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDismiss(notification.id);
                                    onOpenDrawer();
                                }}
                                className="text-xs font-bold text-[var(--color-brand)] hover:underline flex items-center gap-1"
                            >
                                View All &rarr;
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Auto-Dismiss Progress Bar */}
            <div className="h-0.5 w-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                <div 
                    className={`h-full ${config.bar} transition-all ease-linear`}
                    style={{ 
                        width: `${progress}%`,
                        transitionDuration: `${intervalTime}ms`
                    }}
                />
            </div>
        </div>
    );
};

export interface InAppNotificationPopupContainerProps {
    popups: EnhancedAppNotification[];
    onDismiss: (id: string) => void;
    onOpenDrawer?: () => void;
    onRefresh?: () => void;
}

export const InAppNotificationPopupContainer: React.FC<InAppNotificationPopupContainerProps> = ({
    popups,
    onDismiss,
    onOpenDrawer,
    onRefresh
}) => {
    if (!popups || popups.length === 0) return null;

    return (
        <div 
            className="fixed top-5 right-5 z-[99999] flex flex-col gap-3 max-w-[calc(100vw-2.5rem)] w-[400px] pointer-events-none"
            aria-live="polite"
        >
            {popups.map(popup => (
                <div key={popup.id} className="pointer-events-auto">
                    <InAppNotificationPopupItem
                        notification={popup}
                        onDismiss={onDismiss}
                        onOpenDrawer={onOpenDrawer}
                        onRefresh={onRefresh}
                    />
                </div>
            ))}
        </div>
    );
};

export default InAppNotificationPopupContainer;
