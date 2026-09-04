import React, { useState, useEffect } from 'react';
import { 
    X, Trash2, Check, Shield, User as UserIcon, Clock, 
    AlertTriangle, Bell, MessageSquare, Mail, Play, 
    GitBranch, Zap, Sparkles, ChevronRight
} from 'lucide-react';
import { CanvasNode, User, RoleDefinition, Site, NotificationSeverity } from '../../types';

interface WorkflowNodeInspectorProps {
    node: CanvasNode | null;
    users: User[];
    roles: RoleDefinition[];
    sites: Site[];
    isOpen: boolean;
    onClose: () => void;
    onUpdateNode: (updated: CanvasNode) => void;
    onDeleteNode: (id: string) => void;
}

export const WorkflowNodeInspector: React.FC<WorkflowNodeInspectorProps> = ({
    node,
    users,
    roles,
    sites,
    isOpen,
    onClose,
    onUpdateNode,
    onDeleteNode
}) => {
    if (!isOpen || !node) return null;

    const [title, setTitle] = useState(node.title || '');
    const [data, setData] = useState<Record<string, any>>({ ...node.data });
    const [userSearchQuery, setUserSearchQuery] = useState('');

    useEffect(() => {
        setTitle(node.title || '');
        setData({ ...node.data });
    }, [node]);

    const handleSave = () => {
        onUpdateNode({
            ...node,
            title,
            data
        });
        onClose();
    };

    const filteredUsers = users.filter(u => 
        (u.name && u.name.toLowerCase().includes(userSearchQuery.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(userSearchQuery.toLowerCase()))
    );

    return (
        <div className="fixed inset-y-0 right-0 z-50 w-96 bg-white dark:bg-[#151722] border-l border-gray-200 dark:border-white/10 shadow-2xl flex flex-col animate-slide-left select-none">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-brand)] block">
                        Node Inspector
                    </span>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                        Configure {node.type} Node
                    </h3>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar text-xs">
                {/* General Settings */}
                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                        Node Label / Title
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[var(--color-brand)]"
                    />
                </div>

                {/* APPROVAL CONFIGURATION */}
                {node.type === 'APPROVAL' && (
                    <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-white/5">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                                Assignment Type
                            </label>
                            <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl">
                                {[
                                    { id: 'ROLE', label: 'Role', icon: <Shield size={12} /> },
                                    { id: 'USER', label: 'Individual', icon: <UserIcon size={12} /> },
                                    { id: 'BOTH', label: 'Hybrid', icon: <Sparkles size={12} /> }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setData({ ...data, approver_type: opt.id })}
                                        className={`py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition-all ${
                                            (data.approver_type || 'ROLE') === opt.id
                                                ? 'bg-white dark:bg-[#1a1d27] text-[var(--color-brand)] shadow-sm'
                                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        {opt.icon}
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Role Selector */}
                        {((data.approver_type || 'ROLE') === 'ROLE' || data.approver_type === 'BOTH') && (
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                                    Assigned Approver Role
                                </label>
                                <select
                                    value={data.approver_role || data.approver_id || ''}
                                    onChange={(e) => setData({ ...data, approver_role: e.target.value, approver_id: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[var(--color-brand)]"
                                >
                                    {roles.map(r => (
                                        <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* User Selector */}
                        {(data.approver_type === 'USER' || data.approver_type === 'BOTH') && (
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                                    Assigned Individual User
                                </label>
                                <input
                                    type="text"
                                    placeholder="Filter users by name or email..."
                                    value={userSearchQuery}
                                    onChange={(e) => setUserSearchQuery(e.target.value)}
                                    className="w-full px-3 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[var(--color-brand)]"
                                />

                                <div className="max-h-36 overflow-y-auto space-y-1 custom-scrollbar border border-gray-100 dark:border-white/5 rounded-xl p-1">
                                    {filteredUsers.slice(0, 10).map(u => (
                                        <div
                                            key={u.id}
                                            onClick={() => setData({ ...data, approver_user_id: u.id, approver_id: u.id })}
                                            className={`p-1.5 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                                (data.approver_user_id === u.id || data.approver_id === u.id)
                                                    ? 'bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/40 text-[var(--color-brand)]'
                                                    : 'hover:bg-gray-100 dark:hover:bg-white/5'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-5 h-5 rounded-full overflow-hidden shrink-0">
                                                    <img src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&size=32`} alt={u.name} className="w-full h-full object-cover" />
                                                </div>
                                                <span className="font-bold text-[11px] truncate">{u.name}</span>
                                            </div>
                                            <span className="text-[9px] text-gray-400 truncate">{u.email}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* SLA Configuration */}
                        <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-white/5">
                            <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                                <span>Target SLA Resolution</span>
                                <span className="text-[var(--color-brand)]">{data.sla_hours || 24} Hours</span>
                            </label>
                            <div className="flex gap-1.5">
                                {[12, 24, 48, 72].map(h => (
                                    <button
                                        key={h}
                                        type="button"
                                        onClick={() => setData({ ...data, sla_hours: h })}
                                        className={`flex-1 py-1 rounded-lg font-bold text-[10px] border transition-all ${
                                            (data.sla_hours || 24) === h
                                                ? 'bg-[var(--color-brand)] text-white border-transparent'
                                                : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300'
                                        }`}
                                    >
                                        {h}h
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Escalation */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                                Auto-Escalation Target
                            </label>
                            <select
                                value={data.escalate_to_role || 'ADMIN'}
                                onChange={(e) => setData({ ...data, escalate_to_role: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
                            >
                                {roles.map(r => (
                                    <option key={r.id} value={r.id}>Escalate to: {r.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {/* NOTIFICATION CONFIGURATION */}
                {node.type === 'NOTIFICATION' && (
                    <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-white/5">
                        {/* Channel selector */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                                Notification Channel
                            </label>
                            <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl">
                                {[
                                    { id: 'IN_APP', label: 'In-App', icon: <Bell size={12} /> },
                                    { id: 'TEAMS', label: 'Teams', icon: <MessageSquare size={12} /> },
                                    { id: 'EMAIL', label: 'Email', icon: <Mail size={12} /> }
                                ].map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => setData({ ...data, channel: c.id })}
                                        className={`py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition-all ${
                                            (data.channel || 'IN_APP') === c.id
                                                ? 'bg-white dark:bg-[#1a1d27] text-[var(--color-brand)] shadow-sm'
                                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        {c.icon}
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Severity */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                                Severity Badge
                            </label>
                            <div className="grid grid-cols-4 gap-1">
                                {[
                                    { id: 'INFO', label: 'Info', color: 'bg-indigo-500' },
                                    { id: 'SUCCESS', label: 'Success', color: 'bg-emerald-500' },
                                    { id: 'WARNING', label: 'Warning', color: 'bg-amber-500' },
                                    { id: 'CRITICAL', label: 'Critical', color: 'bg-red-500' }
                                ].map(s => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setData({ ...data, severity: s.id as NotificationSeverity })}
                                        className={`py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                                            (data.severity || 'WARNING') === s.id
                                                ? `${s.color} text-white shadow-sm`
                                                : 'bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-gray-900'
                                        }`}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Message Title */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                                Pop-up Alert Title
                            </label>
                            <input
                                type="text"
                                value={data.notification_title || ''}
                                onChange={(e) => setData({ ...data, notification_title: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
                            />
                        </div>

                        {/* Message Body */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                                Alert Message Body
                            </label>
                            <textarea
                                rows={2}
                                value={data.notification_body || ''}
                                onChange={(e) => setData({ ...data, notification_body: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none resize-none"
                            />
                        </div>

                        {/* Action CTA Button */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 block">Action Button</label>
                                <input
                                    type="text"
                                    value={data.action_label || 'Review PO'}
                                    onChange={(e) => setData({ ...data, action_label: e.target.value })}
                                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 block">Target Route</label>
                                <input
                                    type="text"
                                    value={data.action_url || '/requests'}
                                    onChange={(e) => setData({ ...data, action_url: e.target.value })}
                                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* CONDITION CONFIGURATION */}
                {node.type === 'CONDITION' && (
                    <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-white/5">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                                Field To Evaluate
                            </label>
                            <select
                                value={data.condition?.field || 'total_amount'}
                                onChange={(e) => setData({ 
                                    ...data, 
                                    condition: { 
                                        ...(data.condition || {}), 
                                        field: e.target.value 
                                    } 
                                })}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
                            >
                                <option value="total_amount">Total Amount ($)</option>
                                <option value="site_id">Facility / Site</option>
                                <option value="supplier_id">Supplier</option>
                                <option value="category">Category</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 block">Operator</label>
                                <select
                                    value={data.condition?.operator || 'GREATER_THAN'}
                                    onChange={(e) => setData({ 
                                        ...data, 
                                        condition: { 
                                            ...(data.condition || {}), 
                                            operator: e.target.value 
                                        } 
                                    })}
                                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs"
                                >
                                    <option value="GREATER_THAN">&gt; (Greater)</option>
                                    <option value="GREATER_THAN_OR_EQUAL">&ge; (Greater/Eq)</option>
                                    <option value="LESS_THAN">&lt; (Less)</option>
                                    <option value="EQUALS">== (Equals)</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 block">Threshold Value</label>
                                <input
                                    type="text"
                                    value={data.condition?.value !== undefined ? String(data.condition.value) : '5000'}
                                    onChange={(e) => setData({ 
                                        ...data, 
                                        condition: { 
                                            ...(data.condition || {}), 
                                            value: isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)
                                        } 
                                    })}
                                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between gap-2 bg-gray-50/50 dark:bg-white/[0.02]">
                <button
                    type="button"
                    onClick={() => {
                        onDeleteNode(node.id);
                        onClose();
                    }}
                    className="px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                    <Trash2 size={14} />
                    Delete
                </button>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3.5 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl font-bold text-xs transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-xl font-bold text-xs shadow-md hover:opacity-90 transition-all flex items-center gap-1.5"
                    >
                        <Check size={14} />
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WorkflowNodeInspector;
