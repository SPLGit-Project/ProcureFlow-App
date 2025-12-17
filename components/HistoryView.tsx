
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
    Clock, CheckCircle2, Truck, DollarSign, FileText, ChevronDown, ChevronRight, 
    Calendar, User as UserIcon, Building, ArrowRight
} from 'lucide-react';
import { PORequest, ApprovalEvent, DeliveryHeader } from '../types';

const HistoryView = () => {
    const { pos } = useApp();
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Filter POs that have at least one capitalized delivery line
    // OR are explicitly Closed/Received to show history (User requirement focused on capitalized, but closed is also good history)
    const historyPos = pos.filter(po => {
        const hasCapitalized = po.deliveries.some(d => d.lines.some(l => l.isCapitalised));
        const isClosed = po.status === 'CLOSED' || po.status === 'RECEIVED';
        return hasCapitalized || isClosed;
    }).sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const StatusBadge = ({ status }: { status: string }) => {
        let color = 'bg-gray-100 text-gray-600';
        if (status === 'RECEIVED' || status === 'CLOSED') color = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
        if (status === 'PARTIALLY_RECEIVED') color = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
        
        return (
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border border-transparent ${color}`}>
                {status.replace('_', ' ')}
            </span>
        );
    };

    const TimelineEvent = ({ icon: Icon, title, date, user, color, isLast }: any) => (
        <div className="flex gap-4 relative">
            {/* Connector Line */}
            {!isLast && (
                <div className="absolute left-[15px] top-8 bottom-[-16px] w-0.5 bg-gray-200 dark:bg-gray-700"></div>
            )}
            
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${color === 'green' ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' : color === 'blue' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                <Icon size={14} />
            </div>
            
            <div className="flex-1 pb-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h4>
                        {user && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1"><UserIcon size={10}/> {user}</p>}
                    </div>
                     <span className="text-[10px] font-mono text-gray-400 bg-gray-50 dark:bg-white/5 px-2 py-1 rounded">{date}</span>
                </div>
            </div>
        </div>
    );

    const renderLifecycle = (po: PORequest) => {
        const events: any[] = [];
        
        // 1. Creation
        events.push({
            id: 'created',
            title: 'Request Created',
            date: po.requestDate,
            user: po.requesterName,
            icon: FileText,
            color: 'gray'
        });

        // 2. Approvals
        po.approvalHistory.forEach((app, idx) => {
            events.push({
                id: `approval-${idx}`,
                title: `Request ${app.action === 'APPROVED' ? 'Approved' : 'Rejected'}`,
                date: app.date,
                user: app.approverName,
                icon: CheckCircle2,
                color: app.action === 'APPROVED' ? 'blue' : 'red'
            });
        });

        // 3. Concur (Simulated if status passed)
        if (['APPROVED_PENDING_CONCUR', 'ACTIVE', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED'].includes(po.status)) {
             // In a real app we'd have a date for this
             if (po.status !== 'APPROVED_PENDING_CONCUR') {
                 events.push({
                    id: 'concur',
                    title: 'Sync to Concur',
                    date: 'Auto-Sync', // Placeholder
                    user: 'System',
                    icon: ArrowRight,
                    color: 'blue'
                });
             }
        }

        // 4. Deliveries
        po.deliveries.forEach(del => {
            events.push({
                id: del.id,
                title: `Delivery Received (Doc: ${del.docketNumber})`,
                date: del.date,
                user: del.receivedBy,
                icon: Truck,
                color: 'green'
            });

            // 5. Capitalization (per line, but grouped here for simplicity or listed)
            const capLines = del.lines.filter(l => l.isCapitalised);
            if (capLines.length > 0) {
                 events.push({
                    id: `cap-${del.id}`,
                    title: `Capitalized ${capLines.length} Items`,
                    date: capLines[0].capitalisedDate || del.date,
                    user: 'Finance Team',
                    icon: DollarSign,
                    color: 'green'
                });
            }
        });

        return (
            <div className="mt-4 pl-4 border-l-2 border-gray-100 dark:border-gray-800 ml-4">
                <h3 className="text-xs font-bold uppercase text-gray-400 mb-4 tracking-wider">Lifecycle Journey</h3>
                {events.map((ev, i) => (
                    <TimelineEvent key={i} {...ev} isLast={i === events.length - 1} />
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-20 animate-fade-in max-w-5xl mx-auto">
            <div className="flex items-end justify-between border-b border-gray-200 dark:border-gray-800 pb-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Order History</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Audit trail of completed and capitalized requests.</p>
                </div>
                <div className="text-right hidden sm:block">
                     <div className="text-3xl font-bold text-gray-900 dark:text-white">{historyPos.length}</div>
                     <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Records Found</div>
                </div>
            </div>

            <div className="space-y-4">
                {historyPos.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                        <Clock size={48} className="mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">No History Records</h3>
                        <p className="text-sm text-gray-500">Completed and capitalized orders will appear here.</p>
                    </div>
                ) : (
                    historyPos.map(po => (
                        <div key={po.id} className="bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm transition-all hover:shadow-md overflow-hidden">
                            {/* Header Row */}
                            <div 
                                onClick={() => toggleExpand(po.id)}
                                className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 cursor-pointer bg-gray-50/50 dark:bg-white/[0.02] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    <div className={`p-2 rounded-lg ${expandedId === po.id ? 'bg-gray-200 dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-800'} transition-colors`}>
                                        {expandedId === po.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-900 dark:text-white">{po.lines[0]?.concurPoNumber || po.displayId || po.id}</span>
                                            <StatusBadge status={po.status} />
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                            <span className="flex items-center gap-1"><Building size={10}/> {po.supplierName}</span>
                                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                            <span className="flex items-center gap-1"><Calendar size={10}/> {po.requestDate}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="text-right flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-0 w-full sm:w-auto justify-between sm:justify-start">
                                    <div className="text-sm font-bold text-gray-900 dark:text-white">${po.totalAmount.toLocaleString()}</div>
                                    <div className="text-xs text-gray-500">{po.lines.length} items</div>
                                </div>
                            </div>

                            {/* Expanded Lifecycle View */}
                            {expandedId === po.id && (
                                <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029]">
                                    {renderLifecycle(po)}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default HistoryView;
