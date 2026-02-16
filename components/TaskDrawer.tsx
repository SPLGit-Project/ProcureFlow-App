
import React, { useMemo } from 'react';
import { 
  X, CheckCircle2, AlertCircle, Clock, Link as LinkIcon, 
  Package, ChevronRight, Bell, Calendar, ArrowRight,
  ClipboardList, Info, ExternalLink
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

interface TaskDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

const TaskDrawer: React.FC<TaskDrawerProps> = ({ isOpen, onClose }) => {
    const { pos, currentUser, hasPermission, activeSiteIds } = useApp();
    const navigate = useNavigate();

    // --- Task Logic (Extracted from Dashboard) ---
    const pendingApprovals = useMemo(() => pos.filter(p => p.status === 'PENDING_APPROVAL' && activeSiteIds.includes(p.siteId)), [pos, activeSiteIds]);
    const pendingConcur = useMemo(() => pos.filter(p => p.status === 'APPROVED_PENDING_CONCUR' && activeSiteIds.includes(p.siteId)), [pos, activeSiteIds]);
    const activeOrders = useMemo(() => pos.filter(p => (p.status === 'ACTIVE' || p.status === 'PARTIALLY_RECEIVED' || p.status === 'RECEIVED') && activeSiteIds.includes(p.siteId)), [pos, activeSiteIds]);

    const myPendingApprovals = useMemo(() => 
        (currentUser?.role === 'APPROVER' || currentUser?.role === 'ADMIN') ? pendingApprovals : [], 
    [currentUser, pendingApprovals]);

    const globalPendingConcur = useMemo(() => hasPermission('link_concur') ? pendingConcur : [], [hasPermission, pendingConcur]);
    const myPendingConcurSync = useMemo(() => pendingConcur.filter(p => p.requesterId === currentUser?.id && !hasPermission('link_concur')), [pendingConcur, currentUser, hasPermission]);
    const actionConcur = useMemo(() => globalPendingConcur.length > 0 ? globalPendingConcur : myPendingConcurSync, [globalPendingConcur, myPendingConcurSync]);

    const myPendingDeliveries = useMemo(() => activeOrders.filter(p => {
        if (currentUser?.role === 'ADMIN') return true;
        if (p.requesterId !== currentUser?.id) return false;
        const remaining = p.lines.reduce((acc, line) => acc + (line.quantityOrdered - (line.quantityReceived || 0)), 0);
        return remaining > 0;
    }), [currentUser, activeOrders]);

    const tasks = useMemo(() => {
        const t = [];
        if (myPendingApprovals.length > 0) {
            t.push({
                id: 'approvals',
                title: 'Pending Approvals',
                count: myPendingApprovals.length,
                desc: 'Review and approve/reject purchase requests.',
                icon: CheckCircle2,
                color: 'amber',
                path: '/approvals'
            });
        }
        if (actionConcur.length > 0) {
            t.push({
                id: 'concur',
                title: 'Concur Linkage',
                count: actionConcur.length,
                desc: 'Links approved requests to Concur PO numbers.',
                icon: LinkIcon,
                color: 'blue',
                path: '/requests'
            });
        }
        if (myPendingDeliveries.length > 0) {
            t.push({
                id: 'deliveries',
                title: 'Pending Deliveries',
                count: myPendingDeliveries.length,
                desc: 'Confirm receipt of goods for active orders.',
                icon: Package,
                color: 'emerald',
                path: '/requests'
            });
        }
        return t;
    }, [myPendingApprovals, actionConcur, myPendingDeliveries]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
                onClick={onClose}
            ></div>

            {/* Drawer Content */}
            <div className={`relative w-full max-w-md bg-white dark:bg-[#1e2029] h-full shadow-2xl flex flex-col border-l border-default animate-slide-in-right`}>
                
                {/* Header */}
                <div className="p-6 border-b border-default bg-gray-50/50 dark:bg-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-brand)]/10 flex items-center justify-center text-[var(--color-brand)]">
                            <ClipboardList size={22} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-primary dark:text-white">Action Center</h2>
                            <p className="text-xs text-secondary dark:text-gray-400 font-medium">Your tasks & notifications</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors text-tertiary"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    
                    {/* Tasks Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-tertiary dark:text-gray-500 uppercase tracking-widest">Active Tasks</h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 dark:bg-white/10 rounded-full text-secondary">
                                {tasks.reduce((sum, t) => sum + t.count, 0)} Items
                            </span>
                        </div>

                        {tasks.length > 0 ? (
                            <div className="space-y-3">
                                {tasks.map((task) => (
                                    <div 
                                        key={task.id}
                                        onClick={() => { navigate(task.path); onClose(); }}
                                        className={`group p-4 rounded-2xl border border-default bg-surface hover:border-${task.color}-500/30 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden`}
                                    >
                                        <div className={`absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform text-${task.color}-500`}>
                                            <task.icon size={80} />
                                        </div>
                                        
                                        <div className="flex items-start gap-4">
                                            <div className={`p-3 rounded-xl bg-${task.color}-500/10 text-${task.color}-500 border border-${task.color}-500/20`}>
                                                <task.icon size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <h4 className="font-bold text-primary dark:text-white truncate">{task.title}</h4>
                                                    <div className={`px-2 py-0.5 rounded-full bg-${task.color}-500 text-white text-[10px] font-bold`}>
                                                        {task.count}
                                                    </div>
                                                </div>
                                                <p className="text-xs text-secondary dark:text-gray-400 mt-1 leading-relaxed">
                                                    {task.desc}
                                                </p>
                                            </div>
                                            <div className="self-center text-tertiary group-hover:translate-x-1 transition-transform">
                                                <ChevronRight size={18} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-12 flex flex-col items-center justify-center text-center bg-gray-50/50 dark:bg-white/5 rounded-3xl border border-dashed border-default">
                                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4 shadow-inner">
                                    <CheckCircle2 size={32} />
                                </div>
                                <h4 className="font-bold text-primary dark:text-white">All Caught Up!</h4>
                                <p className="text-sm text-tertiary dark:text-gray-500 mt-1">No pending tasks require your attention.</p>
                            </div>
                        )}
                    </div>

                    {/* Quick Stats Section */}
                    <div className="space-y-4 pt-4">
                        <h3 className="text-xs font-black text-tertiary dark:text-gray-500 uppercase tracking-widest">Insights</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-4 rounded-2xl bg-surface border border-default">
                                <p className="text-[10px] font-bold text-tertiary dark:text-gray-500 uppercase tracking-wider mb-1">Approved Today</p>
                                <p className="text-2xl font-black text-primary dark:text-white">
                                    {pos.filter(p => {
                                        const h = p.approvalHistory.find(h => h.action === 'APPROVED');
                                        return h && new Date(h.date).toDateString() === new Date().toDateString();
                                    }).length}
                                </p>
                            </div>
                            <div className="p-4 rounded-2xl bg-surface border border-default">
                                <p className="text-[10px] font-bold text-tertiary dark:text-gray-500 uppercase tracking-wider mb-1">Active Spends</p>
                                <p className="text-2xl font-black text-primary dark:text-white">
                                    ${Math.round(pos.filter(p => p.status === 'ACTIVE').reduce((sum, p) => sum + p.totalAmount, 0) / 1000)}k
                                </p>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-default bg-gray-50/50 dark:bg-white/5">
                    <button 
                        onClick={() => { navigate('/requests'); onClose(); }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-[var(--color-brand)] text-white rounded-xl font-bold shadow-lg shadow-[var(--color-brand)]/20 hover:opacity-90 active:scale-95 transition-all text-sm"
                    >
                        View All Requests <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskDrawer;
