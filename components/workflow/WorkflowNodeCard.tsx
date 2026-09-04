import React from 'react';
import { 
    Zap, GitBranch, UserCheck, Bell, Play, 
    MoreVertical, Trash2, Copy, Settings, Clock, 
    Shield, User as UserIcon, AlertTriangle, AlertCircle, 
    CheckCircle2, ArrowRight, Layers, MessageSquare, Mail
} from 'lucide-react';
import { CanvasNode, User, RoleDefinition } from '../../types';

interface WorkflowNodeCardProps {
    node: CanvasNode;
    isSelected: boolean;
    isSimulating?: boolean;
    isSimActive?: boolean;
    users: User[];
    roles: RoleDefinition[];
    onSelect: (node: CanvasNode) => void;
    onDelete: (id: string) => void;
    onDuplicate: (node: CanvasNode) => void;
    onStartDrag: (e: React.MouseEvent, node: CanvasNode) => void;
}

export const WorkflowNodeCard: React.FC<WorkflowNodeCardProps> = ({
    node,
    isSelected,
    isSimulating = false,
    isSimActive = false,
    users,
    roles,
    onSelect,
    onDelete,
    onDuplicate,
    onStartDrag
}) => {
    // Styling configurations based on node type
    const getNodeStyle = () => {
        switch (node.type) {
            case 'TRIGGER':
                return {
                    bg: 'bg-emerald-500/10 dark:bg-emerald-950/40',
                    border: 'border-emerald-500/40 dark:border-emerald-500/30',
                    accent: 'bg-emerald-500 text-white',
                    icon: <Zap size={16} className="text-white" />,
                    tag: 'Trigger Event',
                    glow: 'shadow-emerald-500/10'
                };
            case 'CONDITION':
                return {
                    bg: 'bg-amber-500/10 dark:bg-amber-950/40',
                    border: 'border-amber-500/40 dark:border-amber-500/30',
                    accent: 'bg-amber-500 text-white',
                    icon: <GitBranch size={16} className="text-white" />,
                    tag: 'Rule Splitter',
                    glow: 'shadow-amber-500/10'
                };
            case 'APPROVAL':
                return {
                    bg: 'bg-purple-500/10 dark:bg-purple-950/40',
                    border: 'border-purple-500/40 dark:border-purple-500/30',
                    accent: 'bg-purple-600 text-white',
                    icon: <UserCheck size={16} className="text-white" />,
                    tag: 'Approval Gate',
                    glow: 'shadow-purple-500/10'
                };
            case 'NOTIFICATION':
                return {
                    bg: 'bg-sky-500/10 dark:bg-sky-950/40',
                    border: 'border-sky-500/40 dark:border-sky-500/30',
                    accent: 'bg-sky-500 text-white',
                    icon: <Bell size={16} className="text-white" />,
                    tag: 'Notification',
                    glow: 'shadow-sky-500/10'
                };
            case 'ACTION':
                return {
                    bg: 'bg-indigo-500/10 dark:bg-indigo-950/40',
                    border: 'border-indigo-500/40 dark:border-indigo-500/30',
                    accent: 'bg-indigo-600 text-white',
                    icon: <Play size={16} className="text-white" />,
                    tag: 'Auto Action',
                    glow: 'shadow-indigo-500/10'
                };
            default:
                return {
                    bg: 'bg-gray-100 dark:bg-white/5',
                    border: 'border-gray-200 dark:border-white/10',
                    accent: 'bg-gray-700 text-white',
                    icon: <Layers size={16} className="text-white" />,
                    tag: 'Node',
                    glow: 'shadow-gray-500/10'
                };
        }
    };

    const style = getNodeStyle();

    // Approver resolution for APPROVAL nodes
    const approverUser = users.find(u => u.id === (node.data.approver_user_id || node.data.approver_id));
    const approverRole = roles.find(r => r.id === (node.data.approver_role || node.data.approver_id));

    return (
        <div
            style={{ transform: `translate3d(${node.x}px, ${node.y}px, 0)` }}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(node);
            }}
            className={`absolute w-80 rounded-2xl bg-white/95 dark:bg-[#161821]/95 backdrop-blur-xl border transition-all duration-200 select-none shadow-xl ${
                isSelected 
                    ? 'ring-2 ring-[var(--color-brand)] border-transparent shadow-2xl scale-[1.02] z-30' 
                    : `${style.border} hover:shadow-2xl hover:border-[var(--color-brand)]/50 z-10`
            } ${isSimActive ? 'ring-4 ring-amber-400 border-amber-400 shadow-amber-400/20 scale-[1.03] z-40' : ''}`}
        >
            {/* Input Port Anchor (Top Center) */}
            {node.type !== 'TRIGGER' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white dark:bg-[#161821] border-2 border-gray-400 dark:border-gray-500 flex items-center justify-center shadow-md group-hover:border-[var(--color-brand)] transition-colors">
                    <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-400" />
                </div>
            )}

            {/* Top Accent Header Bar */}
            <div 
                onMouseDown={(e) => onStartDrag(e, node)}
                className="px-3.5 py-2.5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing rounded-t-2xl bg-gray-50/50 dark:bg-white/[0.02]"
            >
                <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1.5 rounded-lg ${style.accent} shrink-0 shadow-sm`}>
                        {style.icon}
                    </div>
                    <div className="min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-400 block leading-tight">
                            {style.tag}
                        </span>
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate leading-tight mt-0.5">
                            {node.title}
                        </h4>
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDuplicate(node);
                        }}
                        className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                        title="Duplicate node"
                    >
                        <Copy size={13} />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(node.id);
                        }}
                        className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="Delete node"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>

            {/* Node Body Content */}
            <div className="p-3.5 space-y-2.5 text-xs">
                {/* TRIGGER CONTENT */}
                {node.type === 'TRIGGER' && (
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-400 font-medium">Event:</span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
                                {node.data.trigger_event || 'PO_SUBMITTED'}
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Fires automatically when a requisition is submitted for purchase approval.
                        </p>
                    </div>
                )}

                {/* APPROVAL CONTENT */}
                {node.type === 'APPROVAL' && (
                    <div className="space-y-2">
                        {/* Approver Target */}
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] uppercase font-bold text-gray-400">Assigned To</span>
                            {node.data.approver_type === 'USER' && approverUser ? (
                                <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 px-2 py-1 rounded-lg">
                                    <div className="w-4 h-4 rounded-full overflow-hidden shrink-0 border border-blue-300">
                                        <img 
                                            src={approverUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(approverUser.name)}&size=32`} 
                                            alt={approverUser.name} 
                                            className="w-full h-full object-cover" 
                                        />
                                    </div>
                                    <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 truncate max-w-[120px]">
                                        {approverUser.name}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/40 px-2 py-1 rounded-lg">
                                    <Shield size={12} className="text-purple-600 dark:text-purple-400 shrink-0" />
                                    <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 truncate max-w-[120px]">
                                        {approverRole?.name || node.data.approver_role || node.data.approver_id || 'Role'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* SLA Target & Escalation */}
                        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-gray-100 dark:border-white/5">
                            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                <Clock size={12} className="text-amber-500" />
                                <span>SLA: <strong>{node.data.sla_hours || 24}h</strong></span>
                            </div>
                            <span className="text-[10px] text-gray-400">
                                Escalate &gt; {node.data.escalate_after_hours || 48}h
                            </span>
                        </div>
                    </div>
                )}

                {/* CONDITION CONTENT */}
                {node.type === 'CONDITION' && (
                    <div className="space-y-2">
                        <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl p-2 font-mono text-[11px] text-amber-900 dark:text-amber-200">
                            {node.data.condition ? (
                                <div className="flex items-center gap-1.5">
                                    <span className="font-bold">{node.data.condition.field}</span>
                                    <span className="text-amber-600 dark:text-amber-400">{node.data.condition.operator}</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">${String(node.data.condition.value)}</span>
                                </div>
                            ) : (
                                <span>total_amount &gt;= $5,000</span>
                            )}
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-bold pt-1">
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                Branch YES
                            </span>
                            <span className="text-rose-500 dark:text-rose-400 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                Branch NO
                            </span>
                        </div>
                    </div>
                )}

                {/* NOTIFICATION CONTENT */}
                {node.type === 'NOTIFICATION' && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 font-bold text-[10px] uppercase flex items-center gap-1">
                                <Bell size={10} />
                                In-App Pop-up
                            </span>
                            <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-bold text-[10px] uppercase flex items-center gap-1">
                                <MessageSquare size={10} />
                                Teams
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-bold text-[10px] uppercase flex items-center gap-1">
                                <Mail size={10} />
                                Email
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-600 dark:text-gray-300 line-clamp-1 italic">
                            &ldquo;{node.data.notification_title || 'Purchase Order Approval Required: PO-2026-9042'}&rdquo;
                        </p>
                    </div>
                )}

                {/* ACTION CONTENT */}
                {node.type === 'ACTION' && (
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">
                            <CheckCircle2 size={14} />
                            <span>{node.data.auto_action || 'Auto-Approve & Release to Supplier'}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Executes system status transition automatically upon stage verification.
                        </p>
                    </div>
                )}
            </div>

            {/* Output Port Anchors (Bottom Center or Dual for Condition) */}
            {node.type === 'CONDITION' ? (
                <div className="flex justify-between px-8 relative -bottom-3">
                    <div 
                        title="Branch YES"
                        className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shadow-md hover:scale-110 transition-transform"
                    >
                        Y
                    </div>
                    <div 
                        title="Branch NO"
                        className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-black shadow-md hover:scale-110 transition-transform"
                    >
                        N
                    </div>
                </div>
            ) : (
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white dark:bg-[#161821] border-2 border-gray-400 dark:border-gray-500 flex items-center justify-center shadow-md hover:border-[var(--color-brand)] transition-colors">
                    <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-400" />
                </div>
            )}
        </div>
    );
};

export default WorkflowNodeCard;
