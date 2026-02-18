import React, { useState, useEffect, useRef } from 'react';
import { WorkflowConfiguration, WorkflowType, RoleDefinition, User, WorkflowPreviewData } from '../types.ts';
import { 
    CheckCircle, Bell, Truck, DollarSign, Mail, Save, Eye, Send,
    ChevronDown, ChevronUp, User as UserIcon, Shield, Zap, X, Plus, Check
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
        description: 'Notify when all deliveries are received',
        icon: <Truck size={24} />,
        color: 'purple',
        trigger: 'When order status changes to COMPLETE'
    },
    'POST_CAPITALIZATION': {
        title: 'Post-Capitalization Notification',
        description: 'Notify when an order is finalized/capitalized',
        icon: <DollarSign size={24} />,
        color: 'amber',
        trigger: 'When an order is capitalized'
    }
};

const SimpleWorkflowConfig = ({
    workflows,
    roles,
    users,
    appName,
    onSave,
    onTest
}: SimpleWorkflowConfigProps) => {
    const [localWorkflows, setLocalWorkflows] = useState<WorkflowConfiguration[]>(workflows);
    const [expandedWorkflow, setExpandedWorkflow] = useState<WorkflowType | null>(null);
    const [previewModal, setPreviewModal] = useState<{ open: boolean; workflow: WorkflowConfiguration | null }>({ 
        open: false, 
        workflow: null 
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [showSaved, setShowSaved] = useState(false);
    const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync localWorkflows when parent prop changes (e.g. after reload)
    useEffect(() => {
        setLocalWorkflows(workflows);
        setIsDirty(false);
    }, [workflows]);

    const updateWorkflow = (workflowType: WorkflowType, updates: Partial<WorkflowConfiguration>) => {
        setLocalWorkflows(prev => prev.map(wf => 
            wf.workflowType === workflowType ? { ...wf, ...updates } : wf
        ));
        setIsDirty(true);
        setShowSaved(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(localWorkflows);
            setIsDirty(false);
            setShowSaved(true);
            if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
            savedTimerRef.current = setTimeout(() => setShowSaved(false), 4000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleTest = async (workflow: WorkflowConfiguration) => {
        try {
            await onTest(workflow);
        } catch (error) {
            console.error('Test notification failed:', error);
        }
    };

    const getPreviewData = (): WorkflowPreviewData => {
        return {
            approver_name: 'John Approver',
            requester_name: 'Jane Requester',
            recipient_name: 'Recipient Name',
            po_number: 'PO-2024-001',
            total_amount: '5,250.00',
            supplier_name: 'ABC Supplies Pty Ltd',
            site_name: 'Head Office - Melbourne',
            item_count: '12',
            status: 'PENDING_APPROVAL',
            request_date: new Date().toLocaleDateString(),
            approval_date: new Date().toLocaleDateString(),
            delivery_date: new Date().toLocaleDateString(),
            capitalization_date: new Date().toLocaleDateString(),
            app_name: appName,
            app_logo: '',
            organization_name: appName,
            current_year: new Date().getFullYear().toString(),
            action_link: `${globalThis.location.origin}/requests?id=sample`,
            action_text: 'Take Action',
            approval_link: `${globalThis.location.origin}/requests?id=sample`,
            po_link: `${globalThis.location.origin}/requests?id=sample`,
            reason_for_request: 'Stock replenishment for Q1 2024'
        };
    };

    const renderPreview = (template: string): string => {
        const data = getPreviewData();
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key as keyof WorkflowPreviewData] || match;
        });
    };

    const getColorClasses = (color: string) => {
        const colors = {
            blue: 'border-blue-500 bg-blue-50',
            green: 'border-green-500 bg-green-50',
            purple: 'border-purple-500 bg-purple-50',
            amber: 'border-amber-500 bg-amber-50'
        };
        return colors[color as keyof typeof colors] || colors.blue;
    };

    const toggleRecipient = (workflow: WorkflowConfiguration, id: string) => {
        const currentIds = workflow.recipientIds || [];
        const newIds = currentIds.includes(id)
            ? currentIds.filter(existingId => existingId !== id)
            : [...currentIds, id];
        
        updateWorkflow(workflow.workflowType, { recipientIds: newIds });
    };

    const _getRecipientLabel = (workflow: WorkflowConfiguration): string => {
        const ids = workflow.recipientIds || [];
        if (ids.length === 0) return 'Select recipients...';
        
        if (workflow.recipientType === 'ROLE') {
            const selectedRoles = roles.filter(r => ids.includes(r.id));
            return selectedRoles.map(r => r.name).join(', ');
        } else if (workflow.recipientType === 'USER') {
            const selectedUsers = users.filter(u => ids.includes(u.id));
            return selectedUsers.map(u => u.name).join(', ');
        }
        
        return 'Select recipients...';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-primary dark:text-white">Workflow Notifications</h2>
                    <p className="text-secondary dark:text-gray-400 mt-1">Configure automated email and in-app notifications for key events</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Saved confirmation badge */}
                    {showSaved && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold animate-fade-in">
                            <Check size={14} /> All changes saved
                        </span>
                    )}
                    {/* Unsaved changes indicator */}
                    {isDirty && !showSaved && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            Unsaved changes
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving || (!isDirty && !isSaving)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all disabled:cursor-not-allowed ${
                            isDirty
                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/30'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}
                    >
                        {isSaving ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={20} />
                                Save All
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Workflow Cards */}
            <div className="space-y-4">
                {localWorkflows.map((workflow) => {
                    const metadata = WORKFLOW_METADATA[workflow.workflowType];
                    const isExpanded = expandedWorkflow === workflow.workflowType;

                    return (
                        <div
                            key={workflow.workflowType}
                            className={`border-2 rounded-xl bg-white shadow-sm ${getColorClasses(metadata.color)}`}
                        >
                            {/* Card Header */}
                            <div
                                className="p-6 cursor-pointer flex items-center justify-between"
                                onClick={() => setExpandedWorkflow(isExpanded ? null : workflow.workflowType)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-lg bg-${metadata.color}-100`}>
                                        {metadata.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-primary dark:text-gray-900">{metadata.title}</h3>
                                        <p className="text-sm text-secondary dark:text-gray-600">{metadata.description}</p>
                                        <p className="text-xs text-tertiary dark:text-gray-500 mt-1">
                                            <Zap size={12} className="inline mr-1" />
                                            {metadata.trigger}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={workflow.isEnabled}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                updateWorkflow(workflow.workflowType, { isEnabled: e.target.checked });
                                            }}
                                            className="w-5 h-5"
                                        />
                                        <span className="font-medium text-primary dark:text-gray-900">Enabled</span>
                                    </label>
                                    {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                </div>
                            </div>

                            {/* Card Body (Expanded) */}
                            {isExpanded && (
                                <div className="border-t-2 border-gray-200 p-6 bg-white space-y-6">
                                    {/* Recipient Configuration */}
                                    <div>
                                        <h4 className="font-semibold text-primary dark:text-gray-900 mb-3">Who should receive this notification?</h4>
                                        
                                        {/* Recipient Type Selection */}
                                        <div className="grid grid-cols-3 gap-3 mb-4">
                                            <button
                                                type="button"
                                                className={`p-3 rounded-lg border-2 flex items-center gap-2 ${
                                                    workflow.recipientType === 'ROLE' 
                                                        ? 'border-blue-500 bg-blue-50' 
                                                        : 'border-gray-300 hover:border-gray-400'
                                                }`}
                                                onClick={() => updateWorkflow(workflow.workflowType, { recipientType: 'ROLE', recipientIds: [] })}
                                            >
                                                <Shield size={16} />
                                                Role
                                            </button>
                                            <button
                                                type="button"
                                                className={`p-3 rounded-lg border-2 flex items-center gap-2 ${
                                                    workflow.recipientType === 'USER' 
                                                        ? 'border-blue-500 bg-blue-50' 
                                                        : 'border-gray-300 hover:border-gray-400'
                                                }`}
                                                onClick={() => updateWorkflow(workflow.workflowType, { recipientType: 'USER', recipientIds: [] })}
                                            >
                                                <UserIcon size={16} />
                                                Specific User(s)
                                            </button>
                                            <button
                                                type="button"
                                                className={`p-3 rounded-lg border-2 flex items-center gap-2 ${
                                                    workflow.recipientType === 'REQUESTER' 
                                                        ? 'border-blue-500 bg-blue-50' 
                                                        : 'border-gray-300 hover:border-gray-400'
                                                }`}
                                                onClick={() => updateWorkflow(workflow.workflowType, { recipientType: 'REQUESTER', recipientIds: [] })}
                                            >
                                                <UserIcon size={16} />
                                                Requester
                                            </button>
                                        </div>

                                        {/* Multi-Select for Roles */}
                                        {workflow.recipientType === 'ROLE' && (
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-secondary dark:text-gray-700">Select Role(s)</label>
                                                <div className="border-2 rounded-lg p-3 bg-gray-50 max-h-48 overflow-y-auto space-y-2">
                                                    {roles.map(role => (
                                                        <label key={role.id} className="flex items-center gap-2 hover:bg-gray-100 p-2 rounded cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={(workflow.recipientIds || []).includes(role.id)}
                                                                onChange={() => toggleRecipient(workflow, role.id)}
                                                                className="w-4 h-4"
                                                            />
                                                            <Shield size={14} className="text-blue-600" />
                                                            <span className="text-sm">{role.name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Multi-Select for Users */}
                                        {workflow.recipientType === 'USER' && (
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-secondary dark:text-gray-700">Select User(s)</label>
                                                <div className="border-2 rounded-lg p-3 bg-gray-50 max-h-48 overflow-y-auto space-y-2">
                                                    {users.map(user => (
                                                        <label key={user.id} className="flex items-center gap-2 hover:bg-gray-100 p-2 rounded cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={(workflow.recipientIds || []).includes(user.id)}
                                                                onChange={() => toggleRecipient(workflow, user.id)}
                                                                className="w-4 h-4"
                                                            />
                                                            <UserIcon size={14} className="text-green-600" />
                                                            <span className="text-sm text-primary dark:text-gray-900">{user.name}</span>
                                                            <span className="text-xs text-tertiary dark:text-gray-500">({user.email})</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Include Requester Checkbox (for ROLE and USER types) */}
                                        {(workflow.recipientType === 'ROLE' || workflow.recipientType === 'USER') && (
                                            <label className="flex items-center gap-2 mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                <input
                                                    type="checkbox"
                                                    checked={workflow.includeRequester || false}
                                                    onChange={(e) => updateWorkflow(workflow.workflowType, { includeRequester: e.target.checked })}
                                                    className="w-4 h-4"
                                                />
                                                <Plus size={16} className="text-blue-600" />
                                                <span className="text-sm font-medium text-primary dark:text-gray-900">
                                                    Also notify the requester (in addition to selected recipients)
                                                </span>
                                            </label>
                                        )}

                                        {/* Selected Recipients Display */}
                                        {(workflow.recipientIds && workflow.recipientIds.length > 0) && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {workflow.recipientIds.map(id => {
                                                    const item = workflow.recipientType === 'ROLE'
                                                        ? roles.find(r => r.id === id)
                                                        : users.find(u => u.id === id);
                                                    
                                                    if (!item) return null;
                                                    
                                                    return (
                                                        <span
                                                            key={id}
                                                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                                                        >
                                                            {workflow.recipientType === 'ROLE' ? <Shield size={12} /> : <UserIcon size={12} />}
                                                            {'name' in item ? item.name : ''}
                                                            <X
                                                                size={14}
                                                                className="cursor-pointer hover:text-blue-900"
                                                                onClick={() => toggleRecipient(workflow, id)}
                                                            />
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Email Notification */}
                                    <div className="border-t-2 pt-6">
                                        <label className="flex items-center gap-2 mb-4">
                                            <input
                                                type="checkbox"
                                                checked={workflow.emailEnabled}
                                                onChange={(e) => updateWorkflow(workflow.workflowType, { emailEnabled: e.target.checked })}
                                                className="w-5 h-5"
                                            />
                                            <Mail size={20} />
                                            <span className="font-semibold text-primary dark:text-gray-900">Email Notification</span>
                                        </label>

                                        {workflow.emailEnabled && (
                                            <div className="pl-7 space-y-4">
                                                <div>
                                                    <label className="text-sm font-medium text-secondary dark:text-gray-700">Subject</label>
                                                    <input
                                                        type="text"
                                                        value={workflow.emailSubject}
                                                        onChange={(e) => updateWorkflow(workflow.workflowType, { emailSubject: e.target.value })}
                                                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                                                        placeholder="Email subject line..."
                                                    />
                                                </div>

                                                <div>
                                                    <label className="text-sm font-medium text-secondary dark:text-gray-700">Body (HTML)</label>
                                                    <textarea
                                                        value={workflow.emailBody}
                                                        onChange={(e) => updateWorkflow(workflow.workflowType, { emailBody: e.target.value })}
                                                        className="w-full mt-1 px-3 py-2 border rounded-lg font-mono text-xs"
                                                        rows={8}
                                                        placeholder="Email body with HTML..."
                                                    />
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewModal({ open: true, workflow })}
                                                    className="flex items-center gap-2 px-4 py-2 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
                                                >
                                                    <Eye size={16} />
                                                    Preview Email
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* In-App Notification */}
                                    <div className="border-t-2 pt-6">
                                        <label className="flex items-center gap-2 mb-4">
                                            <input
                                                type="checkbox"
                                                checked={workflow.inappEnabled}
                                                onChange={(e) => updateWorkflow(workflow.workflowType, { inappEnabled: e.target.checked })}
                                                className="w-5 h-5"
                                            />
                                            <Bell size={20} />
                                            <span className="font-semibold text-primary dark:text-gray-900">In-App Notification</span>
                                        </label>

                                        {workflow.inappEnabled && (
                                            <div className="pl-7 space-y-4">
                                                <div>
                                                    <label className="text-sm font-medium text-secondary dark:text-gray-700">Title</label>
                                                    <input
                                                        type="text"
                                                        value={workflow.inappTitle}
                                                        onChange={(e) => updateWorkflow(workflow.workflowType, { inappTitle: e.target.value })}
                                                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                                                        placeholder="Notification title..."
                                                    />
                                                </div>

                                                <div>
                                                    <label className="text-sm font-medium text-secondary dark:text-gray-700">Message</label>
                                                    <textarea
                                                        value={workflow.inappMessage}
                                                        onChange={(e) => updateWorkflow(workflow.workflowType, { inappMessage: e.target.value })}
                                                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                                                        rows={3}
                                                        placeholder="Notification message..."
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Test Button */}
                                    <div className="border-t-2 pt-6">
                                        <button
                                            type="button"
                                            onClick={() => handleTest(workflow)}
                                            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-primary dark:text-gray-900 rounded-lg hover:bg-gray-300"
                                        >
                                            <Send size={16} />
                                            Send Test Notification
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Email Preview Modal */}
            {previewModal.open && previewModal.workflow && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b flex items-center justify-between">
                            <h3 className="text-xl font-bold">Email Preview</h3>
                            <button
                                type="button"
                                onClick={() => setPreviewModal({ open: false, workflow: null })}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                                <div className="text-sm font-medium text-secondary dark:text-gray-700">Subject:</div>
                                <div className="text-lg font-bold">{renderPreview(previewModal.workflow.emailSubject)}</div>
                            </div>
                            <div
                                className="prose max-w-none"
                                dangerouslySetInnerHTML={{ __html: renderPreview(previewModal.workflow.emailBody) }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SimpleWorkflowConfig;
