import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { SystemAuditLog } from '../types';
import { History, User, FileText, CheckCircle, XCircle, AlertTriangle, Search } from 'lucide-react';

export const AuditLogViewer: React.FC = () => {
    const { getAuditLogs, users } = useApp();
    const [logs, setLogs] = useState<SystemAuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filterUser, setFilterUser] = useState<string>('');
    const [filterAction, setFilterAction] = useState<string>('');

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const data = await getAuditLogs();
            setLogs(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter(l => {
        if (filterUser && !l.performedByName?.toLowerCase().includes(filterUser.toLowerCase())) return false;
        if (filterAction && !l.actionType.toLowerCase().includes(filterAction.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white">System Audit Log</h2>
                    <p className="text-sm text-gray-500">Track critical system actions and background tasks.</p>
                </div>
                <button onClick={fetchLogs} className="btn-secondary flex items-center gap-2">
                    <History size={16} /> Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-xl">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Filter by User..."
                        className="w-full pl-10 input-field"
                        value={filterUser}
                        onChange={e => setFilterUser(e.target.value)}
                    />
                </div>
                 <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Filter by Action Type..."
                        className="w-full pl-10 input-field"
                        value={filterAction}
                        onChange={e => setFilterAction(e.target.value)}
                    />
                </div>
            </div>

            {/* Timeline */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="text-center py-12 text-gray-400">Loading history...</div>
                ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">No logs found.</div>
                ) : (
                    filteredLogs.map(log => (
                        <div key={log.id} className="bg-white dark:bg-[#15171e] p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex gap-4">
                            <div className="flex-shrink-0 mt-1">
                                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                                    <FileText size={18} />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-gray-900 dark:text-white text-base">
                                        {formatActionType(log.actionType)}
                                    </h4>
                                    <span className="text-xs text-gray-400 font-mono">
                                        {new Date(log.createdAt).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                    <User size={12} />
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                        {log.performedByName || 'System User'}
                                    </span>
                                    <span className="text-gray-300">•</span>
                                    <span className="font-mono text-[10px] opacity-70">ID: {log.id}</span>
                                </div>
                                
                                {/* Summary Badge */}
                                <div className="mt-3 flex gap-2">
                                    {log.summary && renderSummaryBadges(log.summary)}
                                </div>

                                {/* Details Toggle could go here */}
                                {log.details && (
                                    <div className="mt-3 p-3 bg-gray-50 dark:bg-black/20 rounded-lg text-xs font-mono text-gray-600 dark:text-gray-400 overflow-x-auto">
                                        <pre>{JSON.stringify(log.details, null, 2)}</pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

function formatActionType(type: string) {
    return type.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

function renderSummaryBadges(summary: any) {
    if (typeof summary !== 'object') return <span className="badge-gray">{String(summary)}</span>;

    const badges = [];
    if (summary.created) badges.push(
        <span key="created" className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-xs font-bold">
            <CheckCircle size={12} /> {summary.created} Created
        </span>
    );
    if (summary.updated) badges.push(
        <span key="updated" className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-bold">
             <AlertTriangle size={12} /> {summary.updated} Updated
        </span>
    );
     if (summary.deactivated) badges.push(
        <span key="deactivated" className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-bold">
             <XCircle size={12} /> {summary.deactivated} Archived
        </span>
    );
    
    return badges.length > 0 ? badges : <span className="text-xs italic opacity-50">No changes recorded</span>;
}
