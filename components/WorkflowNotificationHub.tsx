import React, { useState, useEffect, useMemo } from 'react';
import { 
    GitMerge, Bell, MessageSquare, Mail, Sliders, Play, 
    Plus, Edit2, Trash2, CheckCircle2, AlertTriangle, AlertCircle, 
    Clock, Shield, User as UserIcon, Save, X, Eye, Send, 
    RefreshCw, Zap, ArrowRight, ExternalLink, Check, Copy, Activity
} from 'lucide-react';
import { 
    UnifiedWorkflowDefinition, 
    WorkflowStageDefinition, 
    NotificationTemplate, 
    NotificationDeliveryLog,
    RoleDefinition,
    User
} from '../types';
import { workflowEngineService } from '../services/workflowEngineService';
import { notificationEngineService, interpolateTemplate } from '../services/notificationEngineService';
import { useApp } from '../context/AppContext';
import { useToast } from './ToastNotification';
import PageHeader from './PageHeader';

export const WorkflowNotificationHub: React.FC = () => {
    const { roles, users, hasPermission, currentUser } = useApp();
    const { success, error, warning } = useToast();

    // Active Top-Level Tab
    const [activeTab, setActiveTab] = useState<'WORKFLOWS' | 'TEMPLATES' | 'CHANNELS' | 'LOGS' | 'ANALYTICS'>('WORKFLOWS');

    // ── 1. Workflows State ────────────────────────────────────────────────────────
    const [workflows, setWorkflows] = useState<UnifiedWorkflowDefinition[]>([]);
    const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
    const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true);
    const [isStageDrawerOpen, setIsStageDrawerOpen] = useState(false);
    const [editingStage, setEditingStage] = useState<WorkflowStageDefinition | null>(null);
    const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);

    // ── 2. Templates State ────────────────────────────────────────────────────────
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('');
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
    const [previewChannel, setPreviewChannel] = useState<'EMAIL' | 'TEAMS' | 'IN_APP'>('EMAIL');
    const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
    const [isSendingTest, setIsSendingTest] = useState(false);

    // ── 3. Channels State ─────────────────────────────────────────────────────────
    const [teamsWebhookUrl, setTeamsWebhookUrl] = useState('');
    const [isSavingChannels, setIsSavingChannels] = useState(false);
    const [isTestingTeams, setIsTestingTeams] = useState(false);

    // ── 4. Telemetry Logs State ───────────────────────────────────────────────────
    const [logs, setLogs] = useState<NotificationDeliveryLog[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [selectedLog, setSelectedLog] = useState<NotificationDeliveryLog | null>(null);
    const [logFilterChannel, setLogFilterChannel] = useState<'ALL' | 'IN_APP' | 'EMAIL' | 'TEAMS'>('ALL');

    useEffect(() => {
        loadWorkflows();
        loadTemplates();
        loadChannels();
        if (activeTab === 'LOGS') {
            loadLogs();
        }
    }, [activeTab]);

    const loadWorkflows = async () => {
        setIsLoadingWorkflows(true);
        try {
            const data = await workflowEngineService.getWorkflows();
            setWorkflows(data);
            if (data.length > 0 && !selectedWorkflowId) {
                setSelectedWorkflowId(data[0].id);
            }
        } catch (err) {
            console.error('Failed to load workflows:', err);
        } finally {
            setIsLoadingWorkflows(false);
        }
    };

    const loadTemplates = async () => {
        setIsLoadingTemplates(true);
        try {
            const data = await notificationEngineService.getTemplates();
            setTemplates(data);
            if (data.length > 0 && !selectedTemplateKey) {
                setSelectedTemplateKey(data[0].template_key);
                setEditingTemplate(data[0]);
            }
        } catch (err) {
            console.error('Failed to load templates:', err);
        } finally {
            setIsLoadingTemplates(false);
        }
    };

    const loadChannels = async () => {
        try {
            const { supabase } = await import('../lib/supabaseClient');
            const { data: config } = await supabase.from('app_config').select('value').eq('key', 'teams_webhook_url').single();
            if (config?.value) {
                setTeamsWebhookUrl(config.value as string);
            }
        } catch {
            // non-fatal
        }
    };

    const loadLogs = async () => {
        setIsLoadingLogs(true);
        try {
            const data = await notificationEngineService.getDeliveryLogs(100);
            setLogs(data);
        } catch (err) {
            console.error('Failed to load logs:', err);
        } finally {
            setIsLoadingLogs(false);
        }
    };

    const activeWorkflow = useMemo(() => {
        return workflows.find(w => w.id === selectedWorkflowId) || workflows[0] || null;
    }, [workflows, selectedWorkflowId]);

    const activeTemplate = useMemo(() => {
        return templates.find(t => t.template_key === selectedTemplateKey) || templates[0] || null;
    }, [templates, selectedTemplateKey]);

    const sampleVariables: Record<string, string> = {
        po_number: 'PO-2026-0842',
        requester_name: 'Sarah Connor',
        supplier_name: 'Pacific Linen Supplies Pty Ltd',
        total_amount: '$4,850.00',
        site_name: 'Melbourne Distribution Hub',
        item_description: 'Standard Bath Towel 650GSM White',
        request_number: 'REQ-2026-019',
        reason: 'Requested quantity exceeds quarterly allocation budget.',
        approver_name: 'Alex Mercer (Operations Lead)',
        rejector_name: 'David Hayes (Commercial Director)',
        docket_number: 'DCK-99214',
        received_by: 'Mark Vance (Storeman)',
        entity_reference: 'PO-2026-0842',
        stage_name: 'Executive Sign-Off',
        assigned_role: 'ADMIN',
        sla_hours: '24',
        sla_deadline: new Date(Date.now() + 86400000).toLocaleString(),
        action_url: `${window.location.origin}/requests`
    };

    const handleSaveWorkflow = async (updated: UnifiedWorkflowDefinition) => {
        setIsSavingWorkflow(true);
        try {
            const saved = await workflowEngineService.saveWorkflow(updated);
            setWorkflows(prev => prev.map(w => w.id === saved.id ? saved : w));
            success('Workflow updated successfully');
        } catch (err) {
            console.error('Failed to save workflow:', err);
            error('Failed to save workflow');
        } finally {
            setIsSavingWorkflow(false);
        }
    };

    const handleToggleWorkflowActive = async (workflow: UnifiedWorkflowDefinition) => {
        await handleSaveWorkflow({ ...workflow, is_enabled: !workflow.is_enabled });
    };

    const handleSaveStage = () => {
        if (!activeWorkflow || !editingStage) return;

        const updatedStages = [...activeWorkflow.stages];
        const existingIdx = updatedStages.findIndex(s => s.stage_id === editingStage.stage_id);

        if (existingIdx >= 0) {
            updatedStages[existingIdx] = editingStage;
        } else {
            updatedStages.push(editingStage);
        }

        handleSaveWorkflow({ ...activeWorkflow, stages: updatedStages });
        setIsStageDrawerOpen(false);
        setEditingStage(null);
    };

    const handleDeleteStage = (stageId: string) => {
        if (!activeWorkflow) return;
        const updatedStages = activeWorkflow.stages.filter(s => s.stage_id !== stageId);
        handleSaveWorkflow({ ...activeWorkflow, stages: updatedStages });
    };

    const handleSaveTemplate = async () => {
        if (!editingTemplate) return;
        try {
            const saved = await notificationEngineService.saveTemplate(editingTemplate);
            setTemplates(prev => prev.map(t => t.template_key === saved.template_key ? saved : t));
            success('Notification template saved successfully');
        } catch (err) {
            console.error('Failed to save template:', err);
            error('Failed to save template');
        }
    };

    const handleSendTestNotification = async () => {
        if (!activeTemplate || !currentUser) return;
        setIsSendingTest(true);
        try {
            const res = await notificationEngineService.dispatchNotification({
                eventType: activeTemplate.event_type,
                templateKey: activeTemplate.template_key,
                recipients: [{ type: 'USER', id: currentUser.id }],
                variables: sampleVariables,
                entityType: 'SYSTEM',
                actionUrl: `${window.location.origin}/requests`
            });
            success(`Test dispatched! (${res.inAppSent} In-App, ${res.teamsSent} Teams)`);
        } catch (err) {
            console.error('Failed to send test notification:', err);
            error('Failed to send test notification');
        } finally {
            setIsSendingTest(false);
        }
    };

    const handleSaveTeamsWebhook = async () => {
        setIsSavingChannels(true);
        try {
            const { supabase } = await import('../lib/supabaseClient');
            await supabase.from('app_config').upsert({
                key: 'teams_webhook_url',
                value: teamsWebhookUrl
            });
            success('Microsoft Teams Webhook configured successfully');
        } catch {
            error('Failed to save Teams webhook URL');
        } finally {
            setIsSavingChannels(false);
        }
    };

    const handleTestTeamsWebhook = async () => {
        if (!teamsWebhookUrl) {
            warning('Please enter a valid webhook URL first');
            return;
        }
        setIsTestingTeams(true);
        try {
            const card = {
                type: 'message',
                attachments: [{
                    contentType: 'application/vnd.microsoft.card.adaptive',
                    contentUrl: null,
                    content: {
                        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                        type: 'AdaptiveCard',
                        version: '1.4',
                        body: [
                            {
                                type: 'TextBlock',
                                text: '🔔 ProcureFlow Test Notification',
                                weight: 'Bolder',
                                size: 'Medium',
                                color: 'Accent'
                            },
                            {
                                type: 'TextBlock',
                                text: 'Your Microsoft Teams Webhook is connected and working perfectly!',
                                wrap: true
                            }
                        ]
                    }
                }]
            };

            const resp = await fetch(teamsWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(card)
            });

            if (resp.ok) {
                success('Test card sent to Microsoft Teams channel!');
            } else {
                error(`Teams webhook responded with status ${resp.status}`);
            }
        } catch {
            error('Failed to send webhook request to Teams');
        } finally {
            setIsTestingTeams(false);
        }
    };

    return (
        <div className="space-y-6 animate-page-entry pb-16 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <PageHeader
                    title="Workflow & Notification Studio"
                    subtitle="Orchestrate conditional routing, multi-tier approvals, and rich multi-channel notification templates."
                />
            </div>

            <div className="flex items-center gap-2 border-b border-gray-200 dark:border-white/10 pb-3 overflow-x-auto custom-scrollbar">
                {[
                    { id: 'WORKFLOWS', label: 'Visual Workflow Studio', icon: GitMerge },
                    { id: 'TEMPLATES', label: 'Notification Templates & Sandbox', icon: Mail },
                    { id: 'CHANNELS', label: 'Channel Integrations', icon: MessageSquare },
                    { id: 'LOGS', label: 'Delivery Audit & Logs', icon: Clock },
                    { id: 'ANALYTICS', label: 'SLA Health & Velocity', icon: Activity }
                ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 ${
                                isActive
                                    ? 'bg-[var(--color-brand)] text-white shadow-lg shadow-[rgba(var(--color-brand-rgb),0.2)]'
                                    : 'bg-white dark:bg-nocturne border border-gray-200 dark:border-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                            }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* TAB 1: WORKFLOWS */}
            {activeTab === 'WORKFLOWS' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {workflows.map(wf => {
                            const isSelected = wf.id === activeWorkflow?.id;
                            return (
                                <div
                                    key={wf.id}
                                    onClick={() => setSelectedWorkflowId(wf.id)}
                                    className={`p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden ${
                                        isSelected
                                            ? 'bg-blue-50/40 dark:bg-[var(--color-brand)]/10 border-[var(--color-brand)] shadow-md'
                                            : 'bg-white dark:bg-nocturne border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-4 mb-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`p-2 rounded-xl ${wf.is_enabled ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'bg-gray-200 dark:bg-white/10 text-gray-400'}`}>
                                                <GitMerge size={18} />
                                            </div>
                                            <h3 className="font-bold text-sm text-gray-900 dark:text-white">{wf.name}</h3>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleWorkflowActive(wf);
                                            }}
                                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors ${
                                                wf.is_enabled
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-gray-100 text-gray-500 dark:bg-white/10'
                                            }`}
                                        >
                                            {wf.is_enabled ? 'Active' : 'Disabled'}
                                        </button>
                                    </div>

                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                        {wf.description}
                                    </p>

                                    <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 dark:border-white/5 text-[11px] text-gray-400 font-medium">
                                        <span>Trigger: <strong className="text-gray-700 dark:text-gray-200">{wf.trigger_event}</strong></span>
                                        <span>•</span>
                                        <span>{wf.stages?.length || 0} Stages</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {activeWorkflow && (
                        <div className="bg-white dark:bg-nocturne rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm p-6 space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-white/5 pb-4">
                                <div>
                                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                        Stage Flow: {activeWorkflow.name}
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-0.5">Sequential stages executed automatically upon trigger</p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingStage({
                                            stage_id: `stage_${Date.now()}`,
                                            stage_name: '',
                                            approver_type: 'ROLE',
                                            approver_id: 'APPROVER',
                                            sla_hours: 24,
                                            description: ''
                                        });
                                        setIsStageDrawerOpen(true);
                                    }}
                                    className="px-4 py-2.5 bg-[var(--color-brand)] text-white rounded-xl text-xs font-bold shadow-lg shadow-[rgba(var(--color-brand-rgb),0.2)] hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 self-start"
                                >
                                    <Plus size={16} />
                                    Add Stage
                                </button>
                            </div>

                            <div className="relative pl-6 space-y-6">
                                <div className="absolute left-9 top-4 bottom-4 w-0.5 bg-gray-200 dark:bg-gray-800" />

                                {activeWorkflow.stages.map((stage, idx) => (
                                    <div key={stage.stage_id} className="relative flex items-start gap-4 group">
                                        <div className="relative z-10 w-7 h-7 rounded-full bg-[var(--color-brand)] text-white text-xs font-black flex items-center justify-center shadow-md">
                                            {idx + 1}
                                        </div>

                                        <div className="flex-1 bg-gray-50/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5 hover:border-[var(--color-brand)]/50 transition-all">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <div>
                                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">{stage.stage_name}</h4>
                                                    <p className="text-xs text-gray-500 mt-0.5">{stage.description || 'Standard verification stage'}</p>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingStage(stage);
                                                            setIsStageDrawerOpen(true);
                                                        }}
                                                        className="p-1.5 text-gray-400 hover:text-[var(--color-brand)] rounded-lg hover:bg-white dark:hover:bg-white/10 transition-colors"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteStage(stage.stage_id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-white dark:hover:bg-white/10 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-gray-200/60 dark:border-white/5 text-xs">
                                                <div>
                                                    <span className="text-[10px] font-black uppercase text-gray-400 block">Approver</span>
                                                    <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1 mt-0.5">
                                                        <Shield size={12} className="text-purple-500" />
                                                        {stage.approver_id}
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-[10px] font-black uppercase text-gray-400 block">SLA Target</span>
                                                    <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1 mt-0.5">
                                                        <Clock size={12} className="text-amber-500" />
                                                        {stage.sla_hours} Hours
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-[10px] font-black uppercase text-gray-400 block">Condition</span>
                                                    <span className="font-bold text-gray-800 dark:text-gray-200 mt-0.5 block">
                                                        {stage.condition ? `${stage.condition.field} ${stage.condition.operator} ${stage.condition.value}` : 'Always Execute'}
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-[10px] font-black uppercase text-gray-400 block">Escalation</span>
                                                    <span className="font-bold text-gray-800 dark:text-gray-200 mt-0.5 block">
                                                        {stage.escalate_to_role ? `${stage.escalate_to_role} (${stage.escalate_after_hours}h)` : 'None'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: TEMPLATES */}
            {activeTab === 'TEMPLATES' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-5 space-y-4">
                            <div className="bg-white dark:bg-nocturne p-4 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm space-y-3">
                                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Select Template</h3>
                                
                                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                                    {templates.map(t => {
                                        const isSelected = t.template_key === selectedTemplateKey;
                                        return (
                                            <div
                                                key={t.template_key}
                                                onClick={() => {
                                                    setSelectedTemplateKey(t.template_key);
                                                    setEditingTemplate(t);
                                                }}
                                                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-blue-50/50 dark:bg-[var(--color-brand)]/15 border-[var(--color-brand)] shadow-sm'
                                                        : 'bg-gray-50/50 dark:bg-white/5 border-gray-200/60 dark:border-white/5 hover:border-gray-300'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-xs font-bold text-gray-900 dark:text-white">{t.name}</h4>
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                                                        {t.category}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-gray-500 mt-1 line-clamp-1">{t.description}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {activeTemplate && (
                                <div className="bg-white dark:bg-nocturne p-4 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm space-y-2.5">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Available Variables</h4>
                                    <p className="text-[11px] text-gray-500">Click a variable tag to copy token to clipboard:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {activeTemplate.variables.map(v => (
                                            <button
                                                key={v}
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`{{${v}}}`);
                                                    success(`Copied {{${v}}} to clipboard`);
                                                }}
                                                className="px-2.5 py-1 bg-gray-100 dark:bg-white/5 hover:bg-[var(--color-brand)]/10 hover:text-[var(--color-brand)] text-gray-700 dark:text-gray-300 rounded-lg text-xs font-mono font-bold transition-colors flex items-center gap-1 border border-gray-200 dark:border-white/5"
                                            >
                                                <Copy size={10} />
                                                &#123;&#123;{v}&#125;&#125;
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleSaveTemplate}
                                    className="flex-1 py-3 bg-[var(--color-brand)] text-white rounded-xl font-bold text-xs shadow-lg shadow-[rgba(var(--color-brand-rgb),0.2)] hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <Save size={16} />
                                    Save Template Changes
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSendTestNotification}
                                    disabled={isSendingTest}
                                    className="px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold text-xs hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
                                >
                                    <Send size={16} className={isSendingTest ? 'animate-pulse' : ''} />
                                    Send Live Test
                                </button>
                            </div>
                        </div>

                        <div className="lg:col-span-7 space-y-4">
                            <div className="bg-white dark:bg-nocturne p-5 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm space-y-4">
                                <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Live Multi-Channel Preview</h3>

                                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
                                        {[
                                            { id: 'EMAIL', label: 'Email HTML', icon: Mail },
                                            { id: 'TEAMS', label: 'MS Teams', icon: MessageSquare },
                                            { id: 'IN_APP', label: 'In-App Card', icon: Bell }
                                        ].map(ch => {
                                            const Icon = ch.icon;
                                            return (
                                                <button
                                                    key={ch.id}
                                                    type="button"
                                                    onClick={() => setPreviewChannel(ch.id as any)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                                        previewChannel === ch.id
                                                            ? 'bg-white dark:bg-nocturne text-gray-900 dark:text-white shadow-sm'
                                                            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                                    }`}
                                                >
                                                    <Icon size={14} />
                                                    {ch.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {activeTemplate && (
                                    <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-gray-200/80 dark:border-white/5 min-h-[380px] flex flex-col justify-center">
                                        {previewChannel === 'EMAIL' && activeTemplate.channels.email && (
                                            <div className="w-full bg-white dark:bg-[#15171e] rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
                                                <div className="p-3 bg-gray-100 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 text-xs text-gray-500 flex items-center gap-2">
                                                    <span className="font-bold text-gray-700 dark:text-gray-300">Subject:</span>
                                                    <span>{interpolateTemplate(activeTemplate.channels.email.subject, sampleVariables)}</span>
                                                </div>
                                                <div 
                                                    className="p-6 prose prose-sm dark:prose-invert max-w-none"
                                                    dangerouslySetInnerHTML={{
                                                        __html: interpolateTemplate(activeTemplate.channels.email.html_body, sampleVariables)
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {previewChannel === 'TEAMS' && activeTemplate.channels.teams && (
                                            <div className="w-full max-w-lg mx-auto bg-white dark:bg-[#1f2430] rounded-2xl shadow-xl border-l-4 border-l-[#0284C7] border-y border-r border-gray-200 dark:border-white/10 p-5 space-y-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-md bg-[#0284C7] text-white flex items-center justify-center text-[10px] font-black">
                                                        PF
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-500">ProcureFlow Bot</span>
                                                </div>

                                                <div>
                                                    <h4 className="text-base font-bold text-gray-900 dark:text-white">
                                                        {interpolateTemplate(activeTemplate.channels.teams.title, sampleVariables)}
                                                    </h4>
                                                    {activeTemplate.channels.teams.subtitle && (
                                                        <p className="text-xs text-gray-500 mt-0.5">
                                                            {interpolateTemplate(activeTemplate.channels.teams.subtitle, sampleVariables)}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-gray-100 dark:border-white/5">
                                                    <div>
                                                        <span className="text-gray-400 block text-[10px] uppercase font-bold">PO Number</span>
                                                        <span className="font-bold text-gray-800 dark:text-gray-200">{sampleVariables.po_number}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Total Amount</span>
                                                        <span className="font-bold text-blue-600 dark:text-blue-400">{sampleVariables.total_amount}</span>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    className="w-full py-2.5 bg-[#0284C7] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
                                                >
                                                    {activeTemplate.channels.teams.cta_label || 'Open in ProcureFlow'}
                                                    <ExternalLink size={12} />
                                                </button>
                                            </div>
                                        )}

                                        {previewChannel === 'IN_APP' && activeTemplate.channels.in_app && (
                                            <div className="w-full max-w-md mx-auto bg-white dark:bg-[#1a1d27] rounded-2xl shadow-xl border border-blue-200 dark:border-[var(--color-brand)]/40 p-4 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-[var(--color-brand)]" />
                                                    <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                                                        {interpolateTemplate(activeTemplate.channels.in_app.title, sampleVariables)}
                                                    </h4>
                                                </div>
                                                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                                    {interpolateTemplate(activeTemplate.channels.in_app.body, sampleVariables)}
                                                </p>
                                                <div className="pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-[11px] text-gray-400">
                                                    <span>Just now</span>
                                                    <span className="font-bold text-[var(--color-brand)]">
                                                        {activeTemplate.channels.in_app.action_label || 'View Details'} &rarr;
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: CHANNELS */}
            {activeTab === 'CHANNELS' && (
                <div className="space-y-6 animate-fade-in max-w-3xl">
                    <div className="bg-white dark:bg-nocturne p-6 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500">
                                <MessageSquare size={22} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">Microsoft Teams Webhook</h3>
                                <p className="text-xs text-gray-500">Directly post rich Adaptive Cards into your team channel</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400">Teams Incoming Webhook Connector URL</label>
                            <input
                                type="url"
                                value={teamsWebhookUrl}
                                onChange={e => setTeamsWebhookUrl(e.target.value)}
                                placeholder="https://outlook.office.com/webhook/..."
                                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={handleSaveTeamsWebhook}
                                disabled={isSavingChannels}
                                className="px-5 py-2.5 bg-[var(--color-brand)] text-white font-bold text-xs rounded-xl shadow-lg shadow-[rgba(var(--color-brand-rgb),0.2)] hover:opacity-90 transition-all flex items-center gap-2"
                            >
                                <Save size={16} />
                                Save Webhook
                            </button>

                            <button
                                type="button"
                                onClick={handleTestTeamsWebhook}
                                disabled={isTestingTeams}
                                className="px-4 py-2.5 bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-white font-bold text-xs rounded-xl hover:bg-gray-200 transition-all flex items-center gap-2"
                            >
                                <Send size={16} className={isTestingTeams ? 'animate-pulse' : ''} />
                                Test Connection Ping
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: LOGS */}
            {activeTab === 'LOGS' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-white dark:bg-nocturne rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
                            <div className="flex items-center gap-2">
                                {['ALL', 'IN_APP', 'EMAIL', 'TEAMS'].map(ch => (
                                    <button
                                        key={ch}
                                        type="button"
                                        onClick={() => setLogFilterChannel(ch as any)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                            logFilterChannel === ch
                                                ? 'bg-[var(--color-brand)] text-white'
                                                : 'bg-gray-100 dark:bg-white/5 text-gray-500 hover:bg-gray-200'
                                        }`}
                                    >
                                        {ch}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={loadLogs}
                                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                            >
                                <RefreshCw size={16} className={isLoadingLogs ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        {isLoadingLogs ? (
                            <div className="py-20 flex justify-center items-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-brand)]" />
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="py-20 text-center text-xs text-gray-400">
                                No delivery logs recorded yet.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-gray-50/80 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 text-[10px] uppercase font-black tracking-widest text-gray-400">
                                        <tr>
                                            <th className="px-5 py-3.5">Timestamp</th>
                                            <th className="px-5 py-3.5">Channel</th>
                                            <th className="px-5 py-3.5">Event</th>
                                            <th className="px-5 py-3.5">Title</th>
                                            <th className="px-5 py-3.5">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-medium">
                                        {logs
                                            .filter(l => logFilterChannel === 'ALL' || l.channel === logFilterChannel)
                                            .map(l => (
                                                <tr key={l.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5">
                                                    <td className="px-5 py-3 text-gray-400">
                                                        {new Date(l.created_at).toLocaleTimeString()}
                                                    </td>
                                                    <td className="px-5 py-3 font-bold text-gray-900 dark:text-white">
                                                        {l.channel}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <span className="font-mono text-[11px] bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded">
                                                            {l.event_type}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-gray-700 dark:text-gray-300 truncate max-w-xs">
                                                        {l.title || '-'}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                            l.status === 'DELIVERED' 
                                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                        }`}>
                                                            {l.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 5: ANALYTICS */}
            {activeTab === 'ANALYTICS' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-nocturne p-5 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Avg Approval Velocity</span>
                            <div className="text-3xl font-black text-gray-900 dark:text-white mt-1">4.2h</div>
                            <p className="text-xs text-green-600 font-bold mt-1">&darr; 35% faster than last month</p>
                        </div>

                        <div className="bg-white dark:bg-nocturne p-5 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">SLA Compliance Rate</span>
                            <div className="text-3xl font-black text-emerald-500 mt-1">98.4%</div>
                            <p className="text-xs text-gray-500 mt-1">Over 440+ processed requests</p>
                        </div>

                        <div className="bg-white dark:bg-nocturne p-5 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Multi-Channel Dispatches</span>
                            <div className="text-3xl font-black text-[var(--color-brand)] mt-1">1,240+</div>
                            <p className="text-xs text-gray-500 mt-1">In-App, Teams, and Email</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Stage Drawer */}
            {isStageDrawerOpen && editingStage && (
                <div className="fixed inset-0 z-[160] flex justify-end">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setIsStageDrawerOpen(false)} />
                    <div className="relative w-full max-w-md bg-white dark:bg-nocturne shadow-2xl h-full flex flex-col animate-slide-in-right border-l border-gray-200 dark:border-white/10">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">Configure Stage</h3>
                            <button type="button" onClick={() => setIsStageDrawerOpen(false)} className="p-2 text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Stage Name</label>
                                <input
                                    type="text"
                                    value={editingStage.stage_name}
                                    onChange={e => setEditingStage({ ...editingStage, stage_name: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm"
                                    placeholder="e.g. Finance Director Sign-Off"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Approver Role</label>
                                <select
                                    value={editingStage.approver_id}
                                    onChange={e => setEditingStage({ ...editingStage, approver_id: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm"
                                >
                                    {roles.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">SLA Deadline (Hours)</label>
                                <input
                                    type="number"
                                    value={editingStage.sla_hours}
                                    onChange={e => setEditingStage({ ...editingStage, sla_hours: parseInt(e.target.value) || 24 })}
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Escalate To Role (Optional)</label>
                                <select
                                    value={editingStage.escalate_to_role || ''}
                                    onChange={e => setEditingStage({ ...editingStage, escalate_to_role: e.target.value || undefined })}
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm"
                                >
                                    <option value="">No Escalation</option>
                                    {roles.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setIsStageDrawerOpen(false)}
                                className="flex-1 py-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveStage}
                                className="flex-1 py-3 bg-[var(--color-brand)] text-white rounded-xl text-xs font-bold shadow-md"
                            >
                                Save Stage
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkflowNotificationHub;
