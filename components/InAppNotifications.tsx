import React, { useState, useRef, useEffect } from 'react';
import { InAppNotification } from '../types';
import { Bell, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface InAppNotificationsProps {
    notifications: InAppNotification[];
    unreadCount: number;
    onMarkAsRead: (notificationId: string) => void;
    onMarkAllAsRead: () => void;
    onClearAll: () => void;
}

const InAppNotifications: React.FC<InAppNotificationsProps> = ({
    notifications,
    unreadCount,
    onMarkAsRead,
    onMarkAllAsRead,
    onClearAll
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleNotificationClick = (notification: InAppNotification) => {
        onMarkAsRead(notification.id);
        setIsOpen(false);
        
        // Navigate to the related PO if available
        if (notification.relatedPoId) {
            navigate(`/requests?highlight=${notification.relatedPoId}`);
        }
    };

    const getTimeAgo = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    const getNotificationIcon = (type: string): string => {
        switch (type) {
            case 'APPROVAL': return '🔔';
            case 'POST_APPROVAL': return '✅';
            case 'POST_DELIVERY': return '📦';
            case 'POST_CAPITALIZATION': return '✓';
            default: return '📢';
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
                <Bell size={20} className="text-gray-600 dark:text-gray-300" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-[#1e2029] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 z-50 animate-fade-in overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/5">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 dark:text-white">Notifications</h3>
                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={onMarkAllAsRead}
                                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        Mark all read
                                    </button>
                                )}
                                {notifications.length > 0 && (
                                    <button
                                        onClick={onClearAll}
                                        className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                                    >
                                        Clear all
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <Bell size={48} className="mx-auto mb-3 opacity-20" />
                                <p className="text-sm">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className={`p-4 border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/5 ${
                                        !notification.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="text-2xl flex-shrink-0">
                                            {getNotificationIcon(notification.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <h4 className={`font-bold text-sm ${
                                                    !notification.isRead 
                                                        ? 'text-gray-900 dark:text-white' 
                                                        : 'text-gray-600 dark:text-gray-400'
                                                }`}>
                                                    {notification.title}
                                                </h4>
                                                {!notification.isRead && (
                                                    <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                {notification.message}
                                            </p>
                                            <div className="text-xs text-gray-400 mt-2">
                                                {getTimeAgo(notification.createdAt)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 5 && (
                        <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/5 text-center">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    navigate('/notifications');
                                }}
                                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                                View all notifications
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default InAppNotifications;
