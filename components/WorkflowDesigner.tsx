import React, { useState, useCallback } from 'react';
import { WorkflowNode, WorkflowNodeType, WorkflowNodeConfig, RoleDefinition, User, EmailTemplateData, NotificationRecipient } from '../types';
import { 
    PlayCircle, CheckCircle, Mail, Bell, GitBranch, Clock, Plus, X, 
    User as UserIcon, Shield, Edit2, Trash2, Save, AlertCircle, Send,
    ChevronDown, ChevronRight, Settings as SettingsIcon, Zap
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface WorkflowDesignerProps {
    roles: RoleDefinition[];
    users: User[];
    emailTemplates?: EmailTemplateData[];
    onSave: (nodes: WorkflowNode[]) => Promise<void>;
}

const WorkflowDesigner: React.FC<WorkflowDesignerProps> = ({ 
    roles, 
    users,
    emailTemplates = [],
    onSave 
}) => {
    // Sample initial workflow
    const [nodes, setNodes] = useState<WorkflowNode[]>([
        {
            id: 'start',
            type: 'START',
            label: 'Start',
            position: { x: 400, y: 50 },
            config: {},
            connections: ['node-1'],
            isActive: true
        },
        {
            id: 'node-1',
            type: 'APPROVAL',
            label: 'Manager Approval',
            position: { x: 400, y: 200 },
            config: {
                approverType: 'ROLE',
                approverId: roles[0]?.id || 'ADMIN',
                emailTemplateId: '00000000-0000-0000-0000-000000000001'
            },
            connections: ['end'],
            isActive: true
        },
        {
            id: 'end',
            type: 'END',
            label: 'Approved',
            position: { x: 400, y: 350 },
            config: {},
            connections: [],
            isActive: true
        }
    ]);

    const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
    const [toolboxExpanded, setToolboxExpanded] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Node type configurations
    const nodeTypes: { type: WorkflowNodeType; label: string; icon: React.ReactNode; color: string; description: string }[] = [
        { type: 'APPROVAL', label: 'Approval', icon: <CheckCircle size={20} />, color: 'bg-blue-500', description: 'Require approval from user or role' },
        { type: 'NOTIFICATION', label: 'Notify', icon: <Bell size={20} />, color: 'bg-purple-500', description: 'Send notification to recipients' },
        { type: 'SEND_EMAIL', label: 'Send Email', icon: <Mail size={20} />, color: 'bg-green-500', description: 'Send custom email' },
        { type: 'CONDITIONAL', label: 'Condition', icon: <GitBranch size={20} />, color: 'bg-amber-500', description: 'Branch based on conditions' },
        { type: 'DELAY', label: 'Wait', icon: <Clock size={20} />, color: 'bg-gray-500', description: 'Wait for specified time' },
    ];

    const addNode = useCallback((type: WorkflowNodeType) => {
        const newNode: WorkflowNode = {
            id: uuidv4(),
            type,
            label: nodeTypes.find(nt => nt.type === type)?.label || 'New Node',
            position: { x: 400, y: nodes.length * 150 + 100 },
            config: type === 'APPROVAL' ? { approverType: 'ROLE', approverId: roles[0]?.id } : {},
            connections: [],
            isActive: true
        };
        setNodes([...nodes, newNode]);
        setSelectedNode(newNode);
    }, [nodes, roles]);

    const updateNode = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
        setNodes(nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n));
        if (selectedNode?.id === nodeId) {
            setSelectedNode({ ...selectedNode, ...updates });
        }
    }, [nodes, selectedNode]);

    const deleteNode = useCallback((nodeId: string) => {
        if (nodeId === 'start' || nodeId === 'end') return; // Can't delete start/end
        setNodes(nodes.filter(n => n.id !== nodeId));
        if (selectedNode?.id === nodeId) setSelectedNode(null);
    }, [nodes, selectedNode]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(nodes);
            alert('Workflow saved successfully!');
        } catch (error) {
            alert('Failed to save workflow');
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const getNodeColor = (type: WorkflowNodeType): string => {
        const colors: Record<WorkflowNodeType, string> = {
            START: 'border-gray-400 bg-gray-50 dark:bg-gray-800',
            END: 'border-green-400 bg-green-50 dark:bg-green-900/20',
            APPROVAL: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
            NOTIFICATION: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20',
            SEND_EMAIL: 'border-green-500 bg-green-50 dark:bg-green-900/20',
            CONDITIONAL: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20',
            DELAY: 'border-gray-500 bg-gray-50 dark:bg-gray-800'
        };
        return colors[type] || 'border-gray-300';
    };

    const getNodeIcon = (type: WorkflowNodeType) => {
        const icons: Record<WorkflowNodeType, React.ReactNode> = {
            START: <PlayCircle size={24} className="text-gray-600" />,
            END: <CheckCircle size={24} className="text-green-600" />,
            APPROVAL: <CheckCircle size={24} className="text-blue-600" />,
            NOTIFICATION: <Bell size={24} className="text-purple-600" />,
            SEND_EMAIL: <Mail size={24} className="text-green-600" />,
            CONDITIONAL: <GitBranch size={24} className="text-amber-600" />,
            DELAY: <Clock size={24} className="text-gray-600" />
        };
        return icons[type];
    };

    return (
        <div className="flex h-[calc(100vh-200px)] gap-4 bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            {/* Left Toolbox */}
            <div className={`transition-all duration-300 ${toolboxExpanded ? 'w-80' : 'w-16'} bg-gray-50 dark:bg-[#15171e] border-r border-gray-200 dark:border-gray-800 flex flex-col`}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    {toolboxExpanded && (
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider">Toolbox</h3>
                    )}
                    <button
                        onClick={() => setToolboxExpanded(!toolboxExpanded)}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        {toolboxExpanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                    </button>
                </div>

                {toolboxExpanded && (
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">Actions</div>
                        {nodeTypes.map(({ type, label, icon, color, description }) => (
                            <button
                                key={type}
                                onClick={() => addNode(type)}
                                className="w-full group flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-[var(--color-brand)] bg-white dark:bg-[#1e2029] transition-all hover:shadow-md active:scale-95"
                            >
                                <div className={`w-10 h-10 rounded-lg ${color} bg-opacity-10 flex items-center justify-center flex-shrink-0`}>
                                    {icon}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <div className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-[var(--color-brand)] transition-colors">
                                        {label}
                                    </div>
                                    <div className="text-[10px] text-gray-500 line-clamp-1">{description}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Center Canvas */}
            <div className="flex-1 flex flex-col">
                {/* Toolbar */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Workflow Designer</h2>
                        <p className="text-xs text-gray-500 mt-1">{nodes.length} nodes configured</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg hover:opacity-90 font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    Save Workflow
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Canvas */}
                <div
                    className="flex-1 overflow-auto p-8 relative"
                    style={{
                        backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
                        backgroundSize: '20px 20px'
                    }}
                >
                    <div className="min-w-max min-h-full relative">
                        {nodes.map((node, idx) => {
                            const nextNode = nodes.find(n => node.connections.includes(n.id));
                            
                            return (
                                <div key={node.id}>
                                    {/* Node Card */}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            left: node.position.x,
                                            top: node.position.y,
                                            transform: 'translate(-50%, 0)'
                                        }}
                                    >
                                        <div
                                            onClick={() => setSelectedNode(node)}
                                            className={`w-64 bg-white dark:bg-[#1e2029] rounded-xl border-2 shadow-lg cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 ${
                                                getNodeColor(node.type)
                                            } ${
                                                selectedNode?.id === node.id ? 'ring-4 ring-[var(--color-brand)] ring-opacity-50' : ''
                                            }`}
                                        >
                                            {/* Node Header */}
                                            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-shrink-0">
                                                        {getNodeIcon(node.type)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-gray-900 dark:text-white truncate">
                                                            {node.label}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                                                            {node.type}
                                                        </div>
                                                    </div>
                                                    {node.type !== 'START' && node.type !== 'END' && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteNode(node.id);
                                                            }}
                                                            className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 rounded transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Node Content */}
                                            <div className="p-4">
                                                {node.type === 'APPROVAL' && node.config.approverId && (
                                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                                        {node.config.approverType === 'USER' ? <UserIcon size={14} /> : <Shield size={14} />}
                                                        <span>
                                                            {node.config.approverType === 'USER'
                                                                ? users.find(u => u.id === node.config.approverId)?.name
                                                                : roles.find(r => r.id === node.config.approverId)?.name}
                                                        </span>
                                                    </div>
                                                )}
                                                {node.type === 'NOTIFICATION' && (
                                                    <div className="text-sm text-gray-600 dark:text-gray-300">
                                                        {node.config.notificationRecipients?.length || 0} recipient(s)
                                                    </div>
                                                )}
                                                {node.type === 'DELAY' && (
                                                    <div className="text-sm text-gray-600 dark:text-gray-300">
                                                        Wait {node.config.delayHours || 0} hours
                                                    </div>
                                                )}
                                            </div>

                                            {/* Connector Dots */}
                                            {node.type !== 'START' && (
                                                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-[#1e2029] border-2 border-gray-400 dark:border-gray-600 rounded-full" />
                                            )}
                                            {node.type !== 'END' && (
                                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-[#1e2029] border-2 border-gray-400 dark:border-gray-600 rounded-full" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Connection Line */}
                                    {nextNode && (
                                        <svg
                                            style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 0,
                                                pointerEvents: 'none',
                                                width: '100%',
                                                height: '100%'
                                            }}
                                        >
                                            <line
                                                x1={node.position.x}
                                                y1={node.position.y + 80}
                                                x2={nextNode.position.x}
                                                y2={nextNode.position.y}
                                                stroke="#94a3b8"
                                                strokeWidth="2"
                                                strokeDasharray="5,5"
                                            />
                                        </svg>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Right Configuration Panel */}
            {selectedNode && (
                <WorkflowNodeConfigPanel
                    node={selectedNode}
                    roles={roles}
                    users={users}
                    emailTemplates={emailTemplates}
                    onUpdate={(updates) => updateNode(selectedNode.id, updates)}
                    onClose={() => setSelectedNode(null)}
                />
            )}
        </div>
    );
};

// Configuration Panel Component
interface WorkflowNodeConfigPanelProps {
    node: WorkflowNode;
    roles: RoleDefinition[];
    users: User[];
    emailTemplates: EmailTemplateData[];
    onUpdate: (updates: Partial<WorkflowNode>) => void;
    onClose: () => void;
}

const WorkflowNodeConfigPanel: React.FC<WorkflowNodeConfigPanelProps> = ({
    node,
    roles,
    users,
    emailTemplates,
    onUpdate,
    onClose
}) => {
    const [localConfig, setLocalConfig] = useState<WorkflowNodeConfig>(node.config);

    const updateConfig = (updates: Partial<WorkflowNodeConfig>) => {
        const newConfig = { ...localConfig, ...updates };
        setLocalConfig(newConfig);
        onUpdate({ config: newConfig });
    };

    return (
        <div className="w-96 bg-white dark:bg-[#1e2029] border-l border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
                <div className="flex items-center gap-2">
                    <SettingsIcon size={18} className="text-gray-600" />
                    <h3 className="font-bold text-gray-900 dark:text-white">Configure Node</h3>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Node Label */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Node Label
                    </label>
                    <input
                        type="text"
                        value={node.label}
                        onChange={(e) => onUpdate({ label: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-brand)] dark:text-white"
                    />
                </div>

                {/* Approval Node Config */}
                {node.type === 'APPROVAL' && (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Approver Type
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => updateConfig({ approverType: 'ROLE', approverId: roles[0]?.id })}
                                    className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all ${
                                        localConfig.approverType === 'ROLE'
                                            ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
                                            : 'border-gray-200 dark:border-gray-700'
                                    }`}
                                >
                                    <Shield size={16} className="inline mr-2" />
                                    Role
                                </button>
                                <button
                                    onClick={() => updateConfig({ approverType: 'USER', approverId: users[0]?.id })}
                                    className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all ${
                                        localConfig.approverType === 'USER'
                                            ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
                                            : 'border-gray-200 dark:border-gray-700'
                                    }`}
                                >
                                    <UserIcon size={16} className="inline mr-2" />
                                    User
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {localConfig.approverType === 'ROLE' ? 'Select Role' : 'Select User'}
                            </label>
                            <select
                                value={localConfig.approverId || ''}
                                onChange={(e) => updateConfig({ approverId: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-brand)] dark:text-white"
                            >
                                {localConfig.approverType === 'ROLE'
                                    ? roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)
                                    : users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Email Template
                            </label>
                            <select
                                value={localConfig.emailTemplateId || ''}
                                onChange={(e) => updateConfig({ emailTemplateId: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-brand)] dark:text-white"
                            >
                                <option value="">Default Template</option>
                                {emailTemplates.filter(t => t.type === 'APPROVAL').map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    </>
                )}

                {/* Delay Node Config */}
                {node.type === 'DELAY' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Delay Duration (hours)
                        </label>
                        <input
                            type="number"
                            value={localConfig.delayHours || 0}
                            onChange={(e) => updateConfig({ delayHours: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-brand)] dark:text-white"
                            min="0"
                        />
                    </div>
                )}

                {/* Active Toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#15171e] rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Node Active</span>
                    <button
                        onClick={() => onUpdate({ isActive: !node.isActive })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            node.isActive ? 'bg-[var(--color-brand)]' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                node.isActive ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                    </button>
                </div>
            </div>
        </div>
    );
};

// Missing import
import { ChevronLeft } from 'lucide-react';

export default WorkflowDesigner;
