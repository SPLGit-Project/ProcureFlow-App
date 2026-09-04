import React, { useState } from 'react';
import { 
    Zap, GitBranch, UserCheck, Bell, Play, Plus, 
    Search, ChevronDown, ChevronRight, MessageSquare, 
    Mail, Shield, User as UserIcon, CheckCircle2, AlertTriangle, Layers
} from 'lucide-react';
import { CanvasNodeType, CanvasNode } from '../../types';

interface PaletteItem {
    type: CanvasNodeType;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    color: string;
    defaultData: Record<string, unknown>;
}

interface WorkflowNodePaletteProps {
    onAddNode: (item: PaletteItem) => void;
}

export const WorkflowNodePalette: React.FC<WorkflowNodePaletteProps> = ({ onAddNode }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [openCategory, setOpenCategory] = useState<string | null>('ALL');

    const paletteCategories: Array<{
        id: string;
        name: string;
        icon: React.ReactNode;
        items: PaletteItem[];
    }> = [
        {
            id: 'TRIGGERS',
            name: 'Triggers',
            icon: <Zap size={14} className="text-emerald-500" />,
            items: [
                {
                    type: 'TRIGGER',
                    title: 'PO Submitted',
                    subtitle: 'Fires when an order is submitted for approval',
                    icon: <Zap size={14} className="text-emerald-500" />,
                    color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                    defaultData: { trigger_event: 'PO_SUBMITTED' }
                },
                {
                    type: 'TRIGGER',
                    title: 'Delivery Variance Detected',
                    subtitle: 'Fires when qty received ≠ qty ordered',
                    icon: <AlertTriangle size={14} className="text-emerald-500" />,
                    color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                    defaultData: { trigger_event: 'DELIVERY_VARIANCE' }
                },
                {
                    type: 'TRIGGER',
                    title: 'Overdue Delivery (>14d)',
                    subtitle: 'Fires when delivery is past due without updated date',
                    icon: <Zap size={14} className="text-emerald-500" />,
                    color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                    defaultData: { trigger_event: 'DELIVERY_OVERDUE_14D' }
                },
                {
                    type: 'TRIGGER',
                    title: 'Item Master Requested',
                    subtitle: 'Fires when a new item creation is initiated',
                    icon: <Zap size={14} className="text-emerald-500" />,
                    color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                    defaultData: { trigger_event: 'ITEM_REQUEST_SUBMITTED' }
                }
            ]
        },
        {
            id: 'CONDITIONS',
            name: 'Logic & Branching',
            icon: <GitBranch size={14} className="text-amber-500" />,
            items: [
                {
                    type: 'CONDITION',
                    title: 'Threshold Condition ($5,000)',
                    subtitle: 'Split flow based on requisition total amount',
                    icon: <GitBranch size={14} className="text-amber-500" />,
                    color: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                    defaultData: {
                        condition: {
                            field: 'total_amount',
                            operator: 'GREATER_THAN',
                            value: 5000
                        }
                    }
                },
                {
                    type: 'CONDITION',
                    title: 'Facility Rule Splitter',
                    subtitle: 'Route flow by facility (e.g. Site - Adelaide)',
                    icon: <GitBranch size={14} className="text-amber-500" />,
                    color: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                    defaultData: {
                        condition: {
                            field: 'site_id',
                            operator: 'EQUALS',
                            value: 'Site - Adelaide'
                        }
                    }
                }
            ]
        },
        {
            id: 'APPROVALS',
            name: 'Approval Gates',
            icon: <UserCheck size={14} className="text-purple-500" />,
            items: [
                {
                    type: 'APPROVAL',
                    title: 'Department Manager Review',
                    subtitle: 'Assigned to Department Manager Role (SLA: 24h)',
                    icon: <Shield size={14} className="text-purple-500" />,
                    color: 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400',
                    defaultData: {
                        approver_type: 'ROLE',
                        approver_id: 'APPROVER',
                        approver_role: 'APPROVER',
                        sla_hours: 24,
                        escalate_to_role: 'ADMIN',
                        escalate_after_hours: 36
                    }
                },
                {
                    type: 'APPROVAL',
                    title: 'Executive Financial Sign-off',
                    subtitle: 'Assigned to System Administrator / Exec (SLA: 48h)',
                    icon: <Shield size={14} className="text-purple-500" />,
                    color: 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400',
                    defaultData: {
                        approver_type: 'ROLE',
                        approver_id: 'ADMIN',
                        approver_role: 'ADMIN',
                        sla_hours: 48,
                        escalate_to_role: 'ADMIN',
                        escalate_after_hours: 72
                    }
                },
                {
                    type: 'APPROVAL',
                    title: 'Individual User Gate',
                    subtitle: 'Assigned to designated person (e.g. Aaron Bell)',
                    icon: <UserIcon size={14} className="text-purple-500" />,
                    color: 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400',
                    defaultData: {
                        approver_type: 'USER',
                        approver_id: '',
                        approver_user_id: '',
                        sla_hours: 24,
                        escalate_to_role: 'ADMIN',
                        escalate_after_hours: 48
                    }
                }
            ]
        },
        {
            id: 'NOTIFICATIONS',
            name: 'Multi-Channel Notifications',
            icon: <Bell size={14} className="text-sky-500" />,
            items: [
                {
                    type: 'NOTIFICATION',
                    title: 'In-App Pop-up Toast Alert',
                    subtitle: 'Fires interactive alert card in bottom right',
                    icon: <Bell size={14} className="text-sky-500" />,
                    color: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
                    defaultData: {
                        channel: 'IN_APP',
                        severity: 'WARNING',
                        notification_title: 'Purchase Order Approval Required: PO-2026-9042',
                        notification_body: 'PO-2026-9042 for $14,280.00 requires your review.',
                        action_label: 'Review PO',
                        action_url: '/requests'
                    }
                },
                {
                    type: 'NOTIFICATION',
                    title: 'Microsoft Teams Channel Alert',
                    subtitle: 'Dispatches Adaptive Card to Site Teams Channel',
                    icon: <MessageSquare size={14} className="text-indigo-500" />,
                    color: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
                    defaultData: {
                        channel: 'TEAMS',
                        notification_title: 'New Purchase Order Awaiting Approval',
                        site_id: 'DEFAULT'
                    }
                },
                {
                    type: 'NOTIFICATION',
                    title: 'M365 Outlook Email',
                    subtitle: 'Sends branded email notification via Graph API',
                    icon: <Mail size={14} className="text-emerald-500" />,
                    color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                    defaultData: {
                        channel: 'EMAIL',
                        notification_title: 'Purchase Order Approval Required'
                    }
                }
            ]
        },
        {
            id: 'ACTIONS',
            name: 'Automated Actions',
            icon: <Play size={14} className="text-indigo-500" />,
            items: [
                {
                    type: 'ACTION',
                    title: 'Auto-Approve & Release',
                    subtitle: 'Transitions status to APPROVED automatically',
                    icon: <CheckCircle2 size={14} className="text-indigo-500" />,
                    color: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
                    defaultData: { auto_action: 'AUTO_APPROVE' }
                },
                {
                    type: 'ACTION',
                    title: 'Mark Ready to Close',
                    subtitle: 'Flags completed order for final archiving',
                    icon: <CheckCircle2 size={14} className="text-indigo-500" />,
                    color: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
                    defaultData: { auto_action: 'READY_TO_CLOSE' }
                },
                {
                    type: 'ACTION',
                    title: 'Sync to Concur ERP',
                    subtitle: 'Initiates automated Concur PO link matching',
                    icon: <Play size={14} className="text-indigo-500" />,
                    color: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
                    defaultData: { auto_action: 'SYNC_CONCUR' }
                }
            ]
        }
    ];

    const filteredCategories = paletteCategories.map(cat => ({
        ...cat,
        items: cat.items.filter(item => 
            item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(cat => cat.items.length > 0);

    return (
        <div className="w-72 bg-white/80 dark:bg-[#14161f]/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col h-full shadow-lg overflow-hidden shrink-0 select-none">
            {/* Palette Header */}
            <div className="p-3.5 border-b border-gray-100 dark:border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                        <Layers size={14} className="text-[var(--color-brand)]" />
                        Action Library
                    </h3>
                    <span className="text-[10px] text-gray-400 font-medium">Drag or Click</span>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search building blocks..."
                        className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[var(--color-brand)] transition-colors"
                    />
                </div>
            </div>

            {/* Category List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                {filteredCategories.map(cat => (
                    <div key={cat.id} className="space-y-1.5">
                        <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1.5 uppercase text-[10px] font-black tracking-wider">
                                {cat.icon}
                                {cat.name}
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium">
                                {cat.items.length}
                            </span>
                        </div>

                        <div className="space-y-1.5">
                            {cat.items.map((item, idx) => (
                                <div
                                    key={idx}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('application/json', JSON.stringify(item));
                                    }}
                                    onClick={() => onAddNode(item)}
                                    className="p-2.5 rounded-xl border border-gray-200/80 dark:border-white/5 bg-white dark:bg-[#1a1d27] hover:border-[var(--color-brand)] hover:shadow-md transition-all duration-150 cursor-grab active:cursor-grabbing group"
                                >
                                    <div className="flex items-center justify-between gap-1.5">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className={`p-1.5 rounded-lg border ${item.color} shrink-0`}>
                                                {item.icon}
                                            </div>
                                            <div className="min-w-0">
                                                <h5 className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-[var(--color-brand)] transition-colors">
                                                    {item.title}
                                                </h5>
                                                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                                                    {item.subtitle}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onAddNode(item);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-gray-400 hover:text-[var(--color-brand)] hover:bg-gray-100 dark:hover:bg-white/10 transition-all shrink-0"
                                            title="Add node to flow"
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WorkflowNodePalette;
