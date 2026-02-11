import React, { useState } from 'react';
import { WorkflowConfiguration, WorkflowType, RoleDefinition, User, WorkflowPreviewData } from '../types';
import { 
    CheckCircle, Bell, Truck, DollarSign, Mail, Save, Eye, Send,
    ChevronDown, ChevronUp, User as UserIcon, Shield, Zap, X
} from 'lucide-react';

interface SimpleWorkflowConfigProps {
    workflows: WorkflowConfiguration[];
    roles: RoleDefinition[];
    users: User[];
    appName: string;
    onSave: (workflows: WorkflowConfiguration[]) => Promise<void>;
    onTest: (workflow: WorkflowConfiguration) => Promise<void>;
}

const WORKFLOW_METADATA: Record<WorkflowType, {
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    trigger: string;
}> = {
    'APPROVAL': {
        title: 'Request Approval',
        description: 'Notify approvers when a PO request is submitted',
        icon: <CheckCircle size={24} />,
        color: 'blue',
        trigger: 'When a purchase order is submitted'
    },
    'POST_APPROVAL': {
        title: 'Post-Approval Notification',
        description: 'Notify requester when their PO is approved',
        icon: <Bell size={24} />,
        color: 'green',
        trigger: 'When a purchase order is approved'
    },
    'POST_DELIVERY': {
        title: 'Post-Delivery Notification',
        description: 'Notify when an order is delivered',
        icon: <Truck size={24} />,
        color: 'purple',
        trigger: 'When an order is marked as delivered'
    },
    'POST_CAPITALIZATION': {
        title: 'Post-Capitalization Notification',
        description: 'Notify when an order is finalized/capitalized',
        icon: <DollarSign size={24} />,
        color: 'amber',
        trigger: 'When an order is capitalized'
    }
};

const SimpleWorkflowConfig: React.FC<SimpleWorkflowConfigProps> = ({
    workflows,
    roles,
    users,
    appName,
    onSave,
    onTest
}) => {
    const [localWorkflows, setLocalWorkflows] = useState<WorkflowConfiguration[]>(workflows);
    const [expandedWorkflow, setExpandedWorkflow] = useState<WorkflowType | null>('APPROVAL');
    const [previewingWorkflow, setPreviewingWorkflow] = useState<WorkflowType | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const updateWorkflow = (workflowType: WorkflowType, updates: Partial<WorkflowConfiguration>) => {
        setLocalWorkflows(localWorkflows.map(w => 
            w.workflowType === workflowType ? { ...w, ...updates } : w
        ));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(localWorkflows);
            alert('Workflow configurations saved successfully!');
        } catch (error) {
            alert('Failed to save workflows');
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleTest = async (workflow: WorkflowConfiguration) => {
        try {
            await onTest(workflow);
            alert(`Test notification sent for ${WORKFLOW_METADATA[workflow.workflowType].title}`);
        } catch (error) {
            alert('Failed to send test notification');
            console.error(error);
        }
    };

    const getPreviewData = (): WorkflowPreviewData => ({
        approver_name: 'John Smith',
        requester_name: 'Jane Doe',
        po_number: 'PO-2024-045',
        total_amount: '1,250.00',
        supplier_name: 'Acme Supplies',
        site_name: 'Sydney Office',
        app_name: appName,
        approval_link: '#',
        po_link: '#',
        approval_date: new Date().toLocaleDateString(),
        delivery_date: new Date().toLocaleDateString(),
        capitalization_date: new Date().toLocaleDateString(),
        reason_for_request: 'Quarterly office supplies replenishment',
        recipient_name: 'Finance Team'
    });

    const renderPreview = (template: string): string => {
        const data = getPreviewData();
        let preview = template;
        Object.entries(data).forEach(([key, value]) => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            preview = preview.replace(regex, value);
        });
        return preview;
    };

    const getColorClasses = (color: string) => ({
        border: `border-${color}-500`,
        bg: `bg-${color}-50 dark:bg-${color}-900/10`,
        text: `text-${color}-600 dark:text-${color}-400`,
        button: `bg-${color}-500 hover:bg-${color}-600`
    });

    return (
        <div className="max-w-6xl mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between bg-white dark:bg-[#1e2029] p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Workflow Configuration</h2>
                    <p className="text-sm text-gray-500 mt-1">Configure email and in-app notifications for key events</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-3 bg-[var(--color-brand)] text-white rounded-lg hover:opacity-90 font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                >
                    {isSaving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save size={18} />
                            Save All Changes
                        </>
                    )}
                </button>
            </div>

            {/* Workflow Cards */}
            {localWorkflows.map((workflow) => {
                const meta = WORKFLOW_METADATA[workflow.workflowType];
                const isExpanded = expandedWorkflow === workflow.workflowType;

                return (
                    <div
                        key={workflow.workflowType}
                        className={`bg-white dark:bg-[#1e2029] rounded-xl shadow-sm border-2 transition-all ${
                            workflow.isEnabled 
                                ? `border-${meta.color}-500` 
                                : 'border-gray-200 dark:border-gray-800'
                        }`}
                    >
                        {/* Card Header */}
                        <div
                            className="p-6 cursor-pointer"
                            onClick={() => setExpandedWorkflow(isExpanded ? null : workflow.workflowType)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl bg-${meta.color}-100 dark:bg-${meta.color}-900/20 text-${meta.color}-600 dark:text-${meta.color}-400 flex items-center justify-center`}>
                                        {meta.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{meta.title}</h3>
                                        <p className="text-sm text-gray-500">{meta.description}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                                        workflow.isEnabled 
                                            ? `bg-${meta.color}-100 dark:bg-${meta.color}-900/20 text-${meta.color}-600` 
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                                    }`}>
                                        {workflow.isEnabled ? 'ENABLED' : 'DISABLED'}
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            updateWorkflow(workflow.workflowType, { isEnabled: !workflow.isEnabled });
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            workflow.isEnabled ? `bg-${meta.color}-500` : 'bg-gray-300 dark:bg-gray-600'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                workflow.isEnabled ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </div>
                            </div>
                        </div>

                        {/* Card Content - Expanded */}
                        {isExpanded && (
                            <div className="px-6 pb-6 space-y-6 border-t border-gray-200 dark:border-gray-800 pt-6">
                                {/* Trigger Info */}
                                <div className={`p-4 rounded-lg bg-${meta.color}-50 dark:bg-${meta.color}-900/10 border border-${meta.color}-200 dark:border-${meta.color}-800`}>
                                    <div className="flex items-start gap-2">
                                        <Zap size={16} className={`text-${meta.color}-600 mt-0.5`} />
                                        <div>
                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Trigger</div>
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{meta.trigger}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Recipient Configuration */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                                        Who should receive this notification?
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {(['ROLE', 'USER', 'REQUESTER'] as const).map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => updateWorkflow(workflow.workflowType, { recipientType: type })}
                                                className={`px-4 py-3 rounded-lg border-2 transition-all font-medium ${
                                                    workflow.recipientType === type
                                                        ? `border-${meta.color}-500 bg-${meta.color}-50 dark:bg-${meta.color}-900/20 text-${meta.color}-600`
                                                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                                                }`}
                                            >
                                                {type === 'ROLE' && <Shield size={16} className="inline mr-2" />}
                                                {type === 'USER' && <UserIcon size={16} className="inline mr-2" />}
                                                {type === 'REQUESTER' && <UserIcon size={16} className="inline mr-2" />}
                                                {type === 'ROLE' ? 'Role' : type === 'USER' ? 'Specific User' : 'Requester'}
                                            </button>
                                        ))}
                                    </div>
                                    
                                    {workflow.recipientType === 'ROLE' && (
                                        <select
                                            value={workflow.recipientId || ''}
                                            onChange={(e) => updateWorkflow(workflow.workflowType, { recipientId: e.target.value })}
                                            className="mt-3 w-full px-4 py-2.5 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-brand)] dark:text-white"
                                        >
                                            <option value="">Select a role...</option>
                                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                        </select>
                                    )}
                                    
                                    {workflow.recipientType === 'USER' && (
                                        <select
                                            value={workflow.recipientId || ''}
                                            onChange={(e) => updateWorkflow(workflow.workflowType, { recipientId: e.target.value })}
                                            className="mt-3 w-full px-4 py-2.5 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-brand)] dark:text-white"
                                        >
                                            <option value="">Select a user...</option>
                                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                    )}
                                </div>

                                <div className="h-px bg-gray-200 dark:bg-gray-800" />

                                {/* Email Notification */}
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300">
                                            <Mail size={18} />
                                            Email Notification
                                        </label>
                                        <button
                                            onClick={() => updateWorkflow(workflow.workflowType, { emailEnabled: !workflow.emailEnabled })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                workflow.emailEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                                            }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                    workflow.emailEnabled ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    {workflow.emailEnabled && (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Subject</label>
                                                <input
                                                    type="text"
                                                    value={workflow.emailSubject}
                                                    onChange={(e) => updateWorkflow(workflow.workflowType, { emailSubject: e.target.value })}
                                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-brand)] dark:text-white"
                                                placeholder="Email subject with {{variables}}"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Body (HTML)</label>
                                                <textarea
                                                    value={workflow.emailBody}
                                                    onChange={(e) => updateWorkflow(workflow.workflowType, { emailBody: e.target.value })}
                                                    rows={6}
                                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-brand)] dark:text-white font-mono text-sm"
                                                    placeholder="Email body with {{variables}}"
                                                />
                                            </div>
                                            <button
                                                onClick={() => setPreviewingWorkflow(workflow.workflowType)}
                                                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-colors flex items-center gap-2"
                                            >
                                                <Eye size={16} />
                                                Preview Email
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="h-px bg-gray-200 dark:bg-gray-800" />

                                {/* In-App Notification */}
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300">
                                            <Bell size={18} />
                                            In-App Notification
                                        </label>
                                        <button
                                            onClick={() => updateWorkflow(workflow.workflowType, { inappEnabled: !workflow.inappEnabled })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                workflow.inappEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                                            }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                    workflow.inappEnabled ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    {workflow.inappEnabled && (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Title</label>
                                                <input
                                                    type="text"
                                                    value={workflow.inappTitle}
                                                    onChange={(e) => updateWorkflow(workflow.workflowType, { inappTitle: e.target.value })}
                                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-brand)] dark:text-white"
                                                    placeholder="Notification title"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Message</label>
                                                <input
                                                    type="text"
                                                    value={workflow.inappMessage}
                                                    onChange={(e) => updateWorkflow(workflow.workflowType, { inappMessage: e.target.value })}
                                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-brand)] dark:text-white"
                                                    placeholder="Notification message with {{variables}}"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end gap-3 pt-4">
                                    <button
                                        onClick={() => handleTest(workflow)}
                                        className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-colors flex items-center gap-2"
                                    >
                                        <Send size={16} />
                                        Send Test
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Email Preview Modal */}
            {previewingWorkflow && (() => {
                const workflow = localWorkflows.find(w => w.workflowType === previewingWorkflow);
                if (!workflow) return null;

                return (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-white/5">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Email Preview</h3>
                                    <p className="text-sm text-gray-500">{WORKFLOW_METADATA[workflow.workflowType].title}</p>
                                </div>
                                <button
                                    onClick={() => setPreviewingWorkflow(null)}
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="bg-white dark:bg-[#1e2029] rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
                                    {/* Email Header */}
                                    <div className="bg-gray-100 dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                                        <div className="text-xs text-gray-500 mb-1">Subject:</div>
                                        <div className="font-bold text-gray-900 dark:text-white">
                                            {renderPreview(workflow.emailSubject)}
                                        </div>
                                    </div>
                                    
                                    {/* Email Body */}
                                    <div
                                        className="p-6"
                                        dangerouslySetInnerHTML={{ __html: renderPreview(workflow.emailBody) }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default SimpleWorkflowConfig;
