import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { SystemAuditLog } from '../types.ts';
import { History, User, FileText, Search } from 'lucide-react';

export const AuditLogViewer: React.FC = () => {
    const { getAuditLogs } = useApp();
    const [logs, setLogs] = useState<SystemAuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Filters
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState<string>(today);
    const [endDate, setEndDate] = useState<string>(today);
    const [filterUser, setFilterUser] = useState<string>(''); // This will now filter by performedByName locally or we can map to ID
    const [filterAction, setFilterAction] = useState<string>('');

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            // We pass filters to the backend
            // For user filter, if it's a text search, we can't easily filter by ID on backend without a join filter which we implemented partially.
            // Let's rely on date and actionType filtering on backend, and refine by user and text summary on frontend if needed,
            // OR if we want to filter by user ID, we need a user selector.
            // The requirements say "View historical data via date selectors".
            
            const data = await getAuditLogs({
                startDate,
                endDate,
                actionType: filterAction
            });
            setLogs(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [startDate, endDate]); // Auto-refresh when dates change

    // Client-side refinement for name (since backend currently filters by User ID only if provided)
    const filteredLogs = logs.filter(l => {
        if (filterUser && !l.performedByName?.toLowerCase().includes(filterUser.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white">System Audit Log</h2>
                    <p className="text-sm text-gray-500">Track critical system actions and background tasks.</p>
                </div>
                <div className="flex gap-2">
                     <button type="button" onClick={fetchLogs} className="btn-secondary flex items-center gap-2">
                        <History size={16} /> Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="flex gap-2 items-center min-w-[300px]">
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">FROM</span>
                        <input 
                            type="date" 
                            className="w-full pl-12 input-field"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">TO</span>
                        <input 
                            type="date" 
                            className="w-full pl-8 input-field"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>
                </div>

                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Filter by User Name..."
                        className="w-full pl-10 input-field"
                        value={filterUser}
                        onChange={e => setFilterUser(e.target.value)}
                    />
                </div>
                 <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Filter by Action Type (e.g. PO_CREATED)..."
                        className="w-full pl-10 input-field"
                        value={filterAction}
                        onChange={e => setFilterAction(e.target.value)}
                        onBlur={fetchLogs} // Fetch on blur to avoid too many requests
                        onKeyDown={e => e.key === 'Enter' && fetchLogs()}
                    />
                </div>
            </div>

            {/* Timeline */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="text-center py-12 text-gray-400">Loading history...</div>
                ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">No logs found for this period.</div>
                ) : (
                    filteredLogs.map(log => (
                        <div key={log.id} className="bg-white dark:bg-[#15171e] p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex gap-4 transition-all hover:shadow-md">
                            <div className="flex-shrink-0 mt-1">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getActionColor(log.actionType)}`}>
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
                                <div className="mt-3 flex gap-2 flex-wrap">
                                    {log.summary && renderSummaryBadges(log.summary)}
                                </div>

                                {/* Details Toggle could go here */}
                                {log.details && Object.keys(log.details).length > 0 && (
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

function getActionColor(type: string) {
    if (type.includes('FAIL') || type.includes('DELETE') || type.includes('REJECT')) return 'bg-red-50 dark:bg-red-900/20 text-red-600';
    if (type.includes('CREATE') || type.includes('ADD') || type.includes('APPROVE')) return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600';
    if (type.includes('UPDATE') || type.includes('EDIT')) return 'bg-blue-50 dark:bg-blue-900/20 text-blue-600';
    return 'bg-gray-50 dark:bg-gray-800 text-gray-600';
}

function renderSummaryBadges(summary: Record<string, unknown> | null | unknown) {
    if (typeof summary !== 'object' || summary === null) return <span className="badge-gray">{String(summary)}</span>;

    return Object.entries(summary as Record<string, unknown>).map(([key, value]) => (
        <span key={key} className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded text-xs font-medium">
            <span className="opacity-50 uppercase text-[10px]">{key}:</span> {String(value)}
        </span>
    ));
}
