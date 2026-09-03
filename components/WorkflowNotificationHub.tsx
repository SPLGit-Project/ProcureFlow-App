import React, { useState, useEffect, useMemo } from 'react';
import { 
    GitMerge, Bell, MessageSquare, Mail, Sliders, Play, 
    Plus, Edit2, Trash2, CheckCircle2, AlertTriangle, AlertCircle, 
    Clock, Shield, User as UserIcon, Save, X, Eye, Send, 
    RefreshCw, Zap, ArrowRight, ExternalLink, Check, Copy, Activity,
    Loader2
} from 'lucide-react';
import { 
    UnifiedWorkflowDefinition, 
    WorkflowStageDefinition, 
    NotificationTemplate, 
    NotificationDeliveryLog,
    RoleDefinition,
    User,
    EnhancedAppNotification
} from '../types';
import { workflowEngineService } from '../services/workflowEngineService';
import { notificationEngineService, interpolateTemplate, buildTeamsAdaptiveCard, buildEmailHtml, PROCUREFLOW_LOGO_URL, PROCUREFLOW_ICON_URL } from '../services/notificationEngineService';
import { playNotificationChime } from '../services/realtimeNotificationService';
import { useApp } from '../context/AppContext';
import { useToast } from './ToastNotification';
import PageHeader from './PageHeader';

export const WorkflowNotificationHub: React.FC = () => {
    const { roles, users, hasPermission, currentUser, refreshNotifications, setIsNotificationDrawerOpen, sites, triggerNotificationPopup } = useApp();
    const [showTeamsGuide, setShowTeamsGuide] = useState(false);
    const [testEmailRecipient, setTestEmailRecipient] = useState(currentUser?.email || 'aaron.bell@splservices.com.au');
    const [isSendingRealEmail, setIsSendingRealEmail] = useState(false);
    const [isTriggeringInApp, setIsTriggeringInApp] = useState(false);
    const { success, error, warning } = useToast();

    // Active Top-Level Tab
    const [activeTab, setActiveTab] = useState<'WORKFLOWS' | 'TEMPLATES' | 'CHANNELS' | 'LOGS' | 'ANALYTICS'>('WORKFLOWS');

    // Filter active users with verified ProcureFlow system access
    const activeSystemUsers = useMemo(() => {
        return (users || []).filter(u => {
            const isApproved = u.status === 'APPROVED' || (!u.status && Boolean(u.email));
            const isNotDeactivated = u.status !== 'ARCHIVED' && u.status !== 'REJECTED';
            return isApproved && isNotDeactivated && Boolean(u.name || u.email);
        }).sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));
    }, [users]);

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
    const [siteWebhooks, setSiteWebhooks] = useState<Record<string, string>>({});
    const [selectedSiteId, setSelectedSiteId] = useState<string>('');
    const [testingSiteId, setTestingSiteId] = useState<string | null>(null);
    const [isTestingAllSites, setIsTestingAllSites] = useState(false);
    const [siteTestResults, setSiteTestResults] = useState<Record<string, { status: 'SUCCESS' | 'FAILED'; time: string; latency?: number }>>({});
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
            const defaultUrl = await notificationEngineService.getTeamsWebhookUrl();
            const webhooks = await notificationEngineService.getSiteTeamsWebhooks();
            setSiteWebhooks(webhooks);

            const initialSite = (sites || []).find(s => s.name?.toLowerCase().includes('melbourne')) || (sites || [])[0];
            const initialId = initialSite?.id || '';
            if (initialId) {
                setSelectedSiteId(initialId);
                setTeamsWebhookUrl(webhooks[initialId] || defaultUrl);
            } else {
                setTeamsWebhookUrl(defaultUrl);
            }

            if (currentUser?.email) setTestEmailRecipient(currentUser.email);
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
            success(`Test dispatched! (${res.inAppSent} In-App, ${res.emailsSent} Email, ${res.teamsSent} Teams)`);
        } catch (err) {
            console.error('Failed to send test notification:', err);
            error('Failed to send test notification');
        } finally {
            setIsSendingTest(false);
        }
    };

    const handleSelectSite = (siteId: string) => {
        setSelectedSiteId(siteId);
        if (siteId === 'DEFAULT') {
            notificationEngineService.getTeamsWebhookUrl().then(url => setTeamsWebhookUrl(url));
        } else {
            setTeamsWebhookUrl(siteWebhooks[siteId] || '');
        }
    };

    const handleSaveTeamsWebhook = async () => {
        setIsSavingChannels(true);
        try {
            if (selectedSiteId && selectedSiteId !== 'DEFAULT') {
                await notificationEngineService.saveSiteTeamsWebhookUrl(selectedSiteId, teamsWebhookUrl);
                setSiteWebhooks(prev => ({ ...prev, [selectedSiteId]: teamsWebhookUrl.trim() }));
                const siteName = sites?.find(s => s.id === selectedSiteId)?.name || 'Facility';
                success(`Webhook URL for ${siteName} saved successfully!`);
            } else {
                await notificationEngineService.saveTeamsWebhookUrl(teamsWebhookUrl);
                success('Default Microsoft Teams Webhook URL saved successfully');
            }
        } catch {
            error('Failed to save Teams webhook URL');
        } finally {
            setIsSavingChannels(false);
        }
    };

    const handleTestSingleSite = async (siteId: string, customUrl?: string) => {
        const urlToTest = (customUrl !== undefined ? customUrl : (siteWebhooks[siteId] || teamsWebhookUrl))?.trim();
        const siteObj = sites?.find(s => s.id === siteId);
        const siteName = siteObj?.name || (siteId === 'DEFAULT' ? 'Default Channel' : 'Facility');

        if (!urlToTest) {
            warning(`No webhook URL configured for ${siteName}`);
            return;
        }

        setTestingSiteId(siteId);
        setIsTestingTeams(true);
        const startTime = Date.now();
        try {
            const cardPayload = buildTeamsAdaptiveCard({
                title: `ProcureFlow Channel Verified — ${siteName}`,
                subtitle: 'Specialised Linen Services Alerts Network • Live Test',
                colorHex: '059669',
                facts: [
                    { title: 'Facility', value: siteName },
                    { title: 'Location', value: `${siteObj?.suburb || ''}, ${siteObj?.state || ''}`.trim() || 'Australia' },
                    { title: 'Tested By', value: currentUser?.name || 'Administrator' },
                    { title: 'Status', value: 'Connected & Operational' },
                    { title: 'Timestamp', value: new Date().toLocaleTimeString() }
                ],
                actionUrl: `${window.location.origin}/settings`,
                actionLabel: 'Open ProcureFlow Admin',
                iconUrl: PROCUREFLOW_ICON_URL
            });

            const resp = await fetch(urlToTest, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cardPayload)
            });

            const latency = Date.now() - startTime;
            if (resp.ok) {
                setSiteTestResults(prev => ({
                    ...prev,
                    [siteId]: { status: 'SUCCESS', time: new Date().toLocaleTimeString(), latency }
                }));
                success(`Test card posted to ${siteName} in MS Teams! (${latency}ms)`);
            } else {
                setSiteTestResults(prev => ({
                    ...prev,
                    [siteId]: { status: 'FAILED', time: new Date().toLocaleTimeString() }
                }));
                error(`${siteName} webhook responded with status ${resp.status}`);
            }
        } catch (e: any) {
            setSiteTestResults(prev => ({
                ...prev,
                [siteId]: { status: 'FAILED', time: new Date().toLocaleTimeString() }
            }));
            error(`Failed to send test alert to ${siteName}: ${e.message}`);
        } finally {
            setTestingSiteId(null);
            setIsTestingTeams(false);
        }
    };

    const handleTestTeamsWebhook = async () => {
        if (!teamsWebhookUrl) {
            warning('Please enter a valid Microsoft Teams webhook URL first');
            return;
        }
        await handleTestSingleSite(selectedSiteId || 'DEFAULT', teamsWebhookUrl);
    };

    const handleTestAllSites = async () => {
        setIsTestingAllSites(true);
        let successCount = 0;
        let failCount = 0;

        for (const site of (sites || [])) {
            const url = siteWebhooks[site.id];
            if (!url) {
                failCount++;
                continue;
            }

            const startTime = Date.now();
            try {
                const cardPayload = buildTeamsAdaptiveCard({
                    title: `ProcureFlow Channel Verified — ${site.name}`,
                    subtitle: 'Specialised Linen Services Alerts Network • Nationwide Verification',
                    colorHex: '059669',
                    facts: [
                        { title: 'Facility', value: site.name },
                        { title: 'State', value: site.state || 'N/A' },
                        { title: 'Tested By', value: currentUser?.name || 'Administrator' },
                        { title: 'Status', value: 'Connected & Operational' }
                    ],
                    actionUrl: `${window.location.origin}/settings`,
                    actionLabel: 'Open ProcureFlow',
                    iconUrl: PROCUREFLOW_ICON_URL
                });

                const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(cardPayload)
                });

                const latency = Date.now() - startTime;
                if (resp.ok) {
                    successCount++;
                    setSiteTestResults(prev => ({
                        ...prev,
                        [site.id]: { status: 'SUCCESS', time: new Date().toLocaleTimeString(), latency }
                    }));
                } else {
                    failCount++;
                    setSiteTestResults(prev => ({
                        ...prev,
                        [site.id]: { status: 'FAILED', time: new Date().toLocaleTimeString() }
                    }));
                }
            } catch {
                failCount++;
                setSiteTestResults(prev => ({
                    ...prev,
                    [site.id]: { status: 'FAILED', time: new Date().toLocaleTimeString() }
                }));
            }
        }

        setIsTestingAllSites(false);
        if (successCount > 0) {
            success(`Batch verification complete: ${successCount} facility channels verified in MS Teams!`);
        }
        if (failCount > 0) {
            warning(`${failCount} facility channels could not be reached.`);
        }
    };

    const handleSendRealTestEmail = async () => {
        if (!testEmailRecipient) {
            warning('Please enter a recipient email address');
            return;
        }
        setIsSendingRealEmail(true);
        try {
            const { supabase } = await import('../lib/supabaseClient');
            const emailHtml = buildEmailHtml({
                title: 'Action Required: PO-2026-9042 Approval Notification',
                bodyHtml: `
                    <p>Hi ${currentUser?.name ? currentUser.name.split(' ')[0] : 'there'},</p>
                    <p>This is a real-time notification from <strong>ProcureFlow Enterprise</strong> confirming your live email delivery integration via Microsoft Graph API.</p>
                    <p>A new purchase order <strong>PO-2026-9042</strong> has been submitted and is currently awaiting your executive sign-off.</p>
                `,
                facts: [
                    { label: 'PO Number', value: 'PO-2026-9042' },
                    { label: 'Supplier', value: 'Pacific Linen Supplies Pty Ltd' },
                    { label: 'Total Amount', value: '$14,280.00' },
                    { label: 'Delivery Site', value: 'Melbourne Central Hub' },
                    { label: 'Requester', value: currentUser?.name || 'Aaron Bell' }
                ],
                actionUrl: `${window.location.origin}/requests`,
                actionLabel: 'Review & Authorise PO in ProcureFlow',
                logoUrl: PROCUREFLOW_LOGO_URL
            });

            const { data, error: sendErr } = await supabase.functions.invoke('send-notification-email', {
                body: {
                    to: testEmailRecipient,
                    subject: 'ProcureFlow Notification: Purchase Order PO-2026-9042 Awaiting Approval',
                    html: emailHtml,
                    from_email: 'aaron.bell@splservices.com.au'
                }
            });

            if (sendErr) {
                error(`Failed to send email: ${sendErr.message}`);
            } else {
                success(`Real email sent via Microsoft Graph to ${testEmailRecipient}! Check your Outlook inbox.`);
            }
        } catch (e: any) {
            error(`Failed to send test email: ${e.message}`);
        } finally {
            setIsSendingRealEmail(false);
        }
    };

    const handleTriggerRealInApp = async () => {
        if (!currentUser) return;
        setIsTriggeringInApp(true);
        try {
            const { supabase } = await import('../lib/supabaseClient');
            const newNotifPayload: EnhancedAppNotification = {
                id: `test-notif-${Date.now()}`,
                user_id: currentUser.id,
                title: 'Purchase Order Approval Required: PO-2026-9042',
                message: `PO-2026-9042 for $14,280.00 submitted by ${currentUser.name} requires your review.`,
                type: 'PO_APPROVAL_REQUEST',
                category: 'APPROVAL',
                severity: 'WARNING',
                action_url: '/requests',
                action_label: 'Review PO',
                entity_type: 'PO',
                entity_id: 'PO-2026-9042',
                is_read: false,
                metadata: {
                    po_number: 'PO-2026-9042',
                    total_amount: '$14,280.00'
                },
                created_at: new Date().toISOString()
            };

            const { data: insertedData, error: insErr } = await supabase.from('user_notifications').insert({
                user_id: currentUser.id,
                title: newNotifPayload.title,
                message: newNotifPayload.message,
                type: newNotifPayload.type,
                category: 'APPROVAL',
                severity: newNotifPayload.severity,
                action_url: newNotifPayload.action_url,
                action_label: newNotifPayload.action_label,
                entity_type: newNotifPayload.entity_type,
                entity_id: newNotifPayload.entity_id,
                is_read: false,
                metadata: newNotifPayload.metadata
            }).select().single();

            if (insErr) {
                error(`Failed to create in-app notification: ${insErr.message}`);
            } else {
                playNotificationChime('alert');
                const finalNotif = (insertedData as EnhancedAppNotification) || newNotifPayload;
                if (triggerNotificationPopup) {
                    triggerNotificationPopup(finalNotif);
                }
                if (refreshNotifications) refreshNotifications();
                success('In-App notification pop-up triggered! Check the interactive alert on your screen.');
            }
        } catch (e: any) {
            error(`Failed to trigger in-app notification: ${e.message}`);
        } finally {
            setIsTriggeringInApp(false);
        }
    };

    return (
        <div className="space-y-6 animate-page-entry pb-16 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <PageHeader
                    title="System Configuration"
                    subtitle="System Configuration"
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
                                            approver_id: roles[0]?.id || 'APPROVER',
                                            approver_role: roles[0]?.id || 'APPROVER',
                                            approver_user_id: activeSystemUsers[0]?.id || '',
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
                                                    {(() => {
                                                        const isUser = stage.approver_type === 'USER' || (stage.approver_type === 'BOTH' && Boolean(stage.approver_user_id));
                                                        const assignedUser = users.find(u => u.id === (stage.approver_user_id || stage.approver_id));
                                                        const roleId = stage.approver_role || (stage.approver_type === 'ROLE' ? stage.approver_id : undefined);
                                                        const assignedRole = roles.find(r => r.id === roleId || r.name === roleId);

                                                        if (stage.approver_type === 'BOTH' && assignedUser) {
                                                            return (
                                                                <div className="mt-0.5">
                                                                    <div className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 truncate" title={`${assignedUser.name || assignedUser.email} (Fallback: ${assignedRole?.name || stage.approver_role || 'Role'})`}>
                                                                        <UserIcon size={12} className="text-blue-500 shrink-0" />
                                                                        <span className="truncate">{assignedUser.name || assignedUser.email}</span>
                                                                        <span className="text-[9px] px-1 py-0.2 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-bold shrink-0">User</span>
                                                                    </div>
                                                                    <div className="text-[10px] text-gray-400 truncate mt-0.5 flex items-center gap-1">
                                                                        <Shield size={10} className="text-purple-400 shrink-0" />
                                                                        <span className="truncate">Fallback: {assignedRole?.name || stage.approver_role || 'Role'}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        if (isUser && assignedUser) {
                                                            return (
                                                                <div className="mt-0.5">
                                                                    <div className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 truncate" title={`${assignedUser.name} (${assignedUser.email})`}>
                                                                        <UserIcon size={12} className="text-blue-500 shrink-0" />
                                                                        <span className="truncate">{assignedUser.name || assignedUser.email}</span>
                                                                        <span className="text-[9px] px-1 py-0.2 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-bold shrink-0">Individual</span>
                                                                    </div>
                                                                    <div className="text-[10px] text-gray-400 truncate mt-0.5">
                                                                        {assignedUser.email}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <div className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 mt-0.5 truncate" title={assignedRole?.name || stage.approver_id}>
                                                                <Shield size={12} className="text-purple-500 shrink-0" />
                                                                <span className="truncate">{assignedRole?.name || stage.approver_id}</span>
                                                                <span className="text-[9px] px-1 py-0.2 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-bold shrink-0">Role</span>
                                                            </div>
                                                        );
                                                    })()}
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
                                                    <span className="font-bold text-gray-800 dark:text-gray-200 mt-0.5 block truncate">
                                                        {stage.condition ? `${stage.condition.field} ${stage.condition.operator} ${stage.condition.value}` : 'Always Execute'}
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-[10px] font-black uppercase text-gray-400 block">Escalation</span>
                                                    <span className="font-bold text-gray-800 dark:text-gray-200 mt-0.5 block truncate">
                                                        {(() => {
                                                            const escUser = stage.escalate_to_user_id ? users.find(u => u.id === stage.escalate_to_user_id) : null;
                                                            const escRole = stage.escalate_to_role ? (roles.find(r => r.id === stage.escalate_to_role)?.name || stage.escalate_to_role) : null;
                                                            if (escUser) return `${escUser.name || escUser.email} (${stage.escalate_after_hours || 48}h)`;
                                                            if (escRole) return `${escRole} (${stage.escalate_after_hours || 48}h)`;
                                                            return 'None';
                                                        })()}
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
                                                    <span className="font-semibold text-gray-900 dark:text-white">{interpolateTemplate(activeTemplate.channels.email.subject, sampleVariables)}</span>
                                                </div>
                                                <div className="p-6">
                                                    {/* In-Body Logo Header */}
                                                    <div className="mb-5 pb-4 border-b border-gray-100 dark:border-white/10">
                                                        <img 
                                                            src="/Procureflow_Logo.png" 
                                                            alt="ProcureFlow Logo" 
                                                            className="h-8 max-w-[190px] object-contain"
                                                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = PROCUREFLOW_LOGO_URL; }}
                                                        />
                                                    </div>
                                                    <div 
                                                        className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200"
                                                        dangerouslySetInnerHTML={{
                                                            __html: interpolateTemplate(activeTemplate.channels.email.html_body, sampleVariables)
                                                        }}
                                                    />
                                                </div>
                                                <div className="p-4 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/5 text-center">
                                                    <a 
                                                        href={`${window.location.origin}/requests`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-[#0284c7] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#0369a1] transition-colors"
                                                    >
                                                        Open in ProcureFlow &rarr;
                                                    </a>
                                                </div>
                                            </div>
                                        )}

                                        {previewChannel === 'TEAMS' && activeTemplate.channels.teams && (
                                            <div className="w-full max-w-lg mx-auto bg-white dark:bg-[#1f2430] rounded-2xl shadow-xl border-l-4 border-l-[#0284C7] border-y border-r border-gray-200 dark:border-white/10 p-5 space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 flex items-center justify-center overflow-hidden shrink-0">
                                                        <img 
                                                            src="/Procureflow_Icon.png" 
                                                            alt="ProcureFlow Icon" 
                                                            className="w-7 h-7 object-contain" 
                                                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = PROCUREFLOW_ICON_URL; }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-bold text-gray-900 dark:text-white block">ProcureFlow</span>
                                                        <span className="text-[10px] text-gray-400">Adaptive Card v1.4 • Automated Notification</span>
                                                    </div>
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
                                                    <div>
                                                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Requester</span>
                                                        <span className="font-bold text-gray-800 dark:text-gray-200">{sampleVariables.requester_name}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Site</span>
                                                        <span className="font-bold text-gray-800 dark:text-gray-200">{sampleVariables.site_name}</span>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    className="w-full py-2.5 bg-[#0284C7] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
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
                <div className="space-y-6 animate-fade-in max-w-4xl">
                    {/* CHANNEL 1: MICROSOFT TEAMS NATIONWIDE FACILITY NETWORK */}
                    <div className="bg-white dark:bg-nocturne p-6 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-white/5 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500">
                                    <MessageSquare size={22} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        Microsoft Teams Facility Webhook Channels
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                            {Object.keys(siteWebhooks).length} of {(sites || []).length} Connected
                                        </span>
                                    </h3>
                                    <p className="text-xs text-gray-500">Directly post rich Adaptive Cards v1.4 into dedicated Specialised Linen Services site channels</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleTestAllSites}
                                    disabled={isTestingAllSites}
                                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                                    title="Test all 11 site channels simultaneously"
                                >
                                    {isTestingAllSites ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                                    Test All 11 Sites
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowTeamsGuide(!showTeamsGuide)}
                                    className="text-xs font-bold text-[var(--color-brand)] hover:underline flex items-center gap-1 self-start sm:self-auto ml-1"
                                >
                                    {showTeamsGuide ? 'Hide Guide' : 'Setup Guide'}
                                </button>
                            </div>
                        </div>

                        {showTeamsGuide && (
                            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-2xl text-xs space-y-2 text-gray-700 dark:text-gray-300">
                                <h4 className="font-bold text-indigo-900 dark:text-indigo-300">Quick 3-Step Microsoft Teams Setup:</h4>
                                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                                    <li>Open your Microsoft Teams client & locate the facility channel under <strong>ProcureFlow - Alerts</strong> (e.g. <strong>Site - Adelaide</strong>).</li>
                                    <li>Click <strong>&bull;&bull;&bull; (More options)</strong> next to the channel name &rarr; select <strong>Workflows</strong>.</li>
                                    <li>Search for <strong>"Send webhook alerts to a channel"</strong>, complete the prompt, copy the generated URL, and paste it into the facility field below.</li>
                                </ol>
                            </div>
                        )}

                        {/* Individual Facility Selector & Live Tester */}
                        <div className="bg-gray-50/70 dark:bg-white/[0.02] p-5 rounded-2xl border border-gray-100 dark:border-white/5 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                                        Select Facility to Inspect or Test
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={selectedSiteId}
                                            onChange={e => handleSelectSite(e.target.value)}
                                            className="bg-white dark:bg-nocturne border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] shadow-sm"
                                        >
                                            <option value="DEFAULT">Default Fallback Channel (General)</option>
                                            {(sites || []).map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} ({s.state}) {siteWebhooks[s.id] ? '✓ Connected' : '(Pending)'}
                                                </option>
                                            ))}
                                        </select>
                                        {selectedSiteId && selectedSiteId !== 'DEFAULT' && (
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                siteWebhooks[selectedSiteId] 
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                            }`}>
                                                {siteWebhooks[selectedSiteId] ? 'Connected' : 'Pending Webhook'}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {selectedSiteId && (
                                    <div className="flex items-center gap-2 self-end sm:self-auto">
                                        <button
                                            type="button"
                                            onClick={handleSaveTeamsWebhook}
                                            disabled={isSavingChannels}
                                            className="px-4 py-2 bg-[var(--color-brand)] text-white font-bold text-xs rounded-xl shadow-sm hover:opacity-90 transition-all flex items-center gap-1.5"
                                        >
                                            <Save size={14} />
                                            Save Webhook
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleTestSingleSite(selectedSiteId, teamsWebhookUrl)}
                                            disabled={testingSiteId === selectedSiteId || !teamsWebhookUrl}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                            <Send size={14} className={testingSiteId === selectedSiteId ? 'animate-pulse' : ''} />
                                            {testingSiteId === selectedSiteId ? 'Sending...' : 'Send Test Adaptive Card'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                                    {selectedSiteId === 'DEFAULT' ? 'Default Tenant Webhook URL' : `${sites?.find(s => s.id === selectedSiteId)?.name || 'Facility'} Webhook URL`}
                                </label>
                                <input
                                    type="url"
                                    value={teamsWebhookUrl}
                                    onChange={e => setTeamsWebhookUrl(e.target.value)}
                                    placeholder="https://...powerplatform.com:443/powerautomate/.../invoke?..."
                                    className="w-full bg-white dark:bg-nocturne border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                                />
                            </div>
                        </div>

                        {/* Complete Facility Channels Table */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">
                                    Nationwide Facility Channels & Live Status
                                </h4>
                                <span className="text-[11px] text-gray-500">
                                    Click <strong>Test</strong> on any row to dispatch a live Adaptive Card to that channel
                                </span>
                            </div>

                            <div className="border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden bg-white dark:bg-nocturne">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/10 text-[10px] uppercase font-black tracking-widest text-gray-400">
                                        <tr>
                                            <th className="px-4 py-3">Facility</th>
                                            <th className="px-3 py-3">Channel Name</th>
                                            <th className="px-3 py-3 text-center">Status</th>
                                            <th className="px-3 py-3 text-center">Latest Result</th>
                                            <th className="px-4 py-3 text-right">Quick Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-medium">
                                        {(sites || []).map(site => {
                                            const hasWebhook = Boolean(siteWebhooks[site.id]);
                                            const isSelected = selectedSiteId === site.id;
                                            const testResult = siteTestResults[site.id];
                                            const isTestingThis = testingSiteId === site.id || isTestingAllSites;

                                            return (
                                                <tr 
                                                    key={site.id} 
                                                    className={`hover:bg-gray-50/60 dark:hover:bg-white/5 transition-colors ${
                                                        isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                                                    }`}
                                                >
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                            {site.name}
                                                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-bold">
                                                                {site.state}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 font-normal">
                                                            {site.suburb ? `${site.suburb}, ${site.state}` : site.address}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                                                        Site - {site.name.replace(/^SPL\s+/i, '')}
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        {hasWebhook ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                                <Check size={10} /> Connected
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                                Pending URL
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        {testResult ? (
                                                            testResult.status === 'SUCCESS' ? (
                                                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                                                                    <Check size={12} /> 202 OK {testResult.latency ? `(${testResult.latency}ms)` : ''}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-rose-500 flex items-center justify-center gap-1">
                                                                    <AlertTriangle size={12} /> Failed
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className="text-[10px] text-gray-400 italic">Ready</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelectSite(site.id)}
                                                                className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-nocturne text-gray-700 dark:text-gray-300 transition-all"
                                                            >
                                                                Configure
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleTestSingleSite(site.id)}
                                                                disabled={isTestingThis || !hasWebhook}
                                                                className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 disabled:opacity-40"
                                                                title={`Send test alert to ${site.name}`}
                                                            >
                                                                {isTestingThis ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                                                                Test
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* CHANNEL 2: REAL EMAIL (MICROSOFT GRAPH) */}
                    <div className="bg-white dark:bg-nocturne p-6 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm space-y-5">
                        <div className="flex items-center gap-3 border-b border-gray-100 dark:border-white/5 pb-4">
                            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
                                <Mail size={22} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    Microsoft 365 Exchange Online (Email Channel)
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                        Connected &bull; MS Graph API
                                    </span>
                                </h3>
                                <p className="text-xs text-gray-500">Delivers responsive HTML emails with in-body Procureflow logo directly to user inboxes</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400">Target Inbox For Live Test</label>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="email"
                                    value={testEmailRecipient}
                                    onChange={e => setTestEmailRecipient(e.target.value)}
                                    placeholder="aaron.bell@splservices.com.au"
                                    className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                                />
                                <button
                                    type="button"
                                    onClick={handleSendRealTestEmail}
                                    disabled={isSendingRealEmail}
                                    className="px-5 py-3 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shrink-0"
                                >
                                    <Send size={16} className={isSendingRealEmail ? 'animate-spin' : ''} />
                                    Send Live Test Email to My Inbox
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* CHANNEL 3: IN-APP REALTIME PUSH */}
                    <div className="bg-white dark:bg-nocturne p-6 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm space-y-5">
                        <div className="flex items-center gap-3 border-b border-gray-100 dark:border-white/5 pb-4">
                            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
                                <Bell size={22} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    In-App Realtime Stream, Interactive Pop-ups & Drawer
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                        Connected &bull; Supabase Realtime
                                    </span>
                                </h3>
                                <p className="text-xs text-gray-500">Triggers interactive floating alert pop-ups, Web Audio sound chimes, increments the header badge, and updates drawer live</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                            <button
                                type="button"
                                onClick={handleTriggerRealInApp}
                                disabled={isTriggeringInApp}
                                className="px-5 py-2.5 bg-amber-500 text-white font-bold text-xs rounded-xl shadow-md hover:bg-amber-600 transition-all flex items-center gap-2"
                            >
                                <Zap size={16} className={isTriggeringInApp ? 'animate-pulse' : ''} />
                                Trigger In-App Notification Pop-up (Live Alert)
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsNotificationDrawerOpen(true)}
                                className="px-5 py-2.5 bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-white font-bold text-xs rounded-xl hover:bg-gray-200 transition-all flex items-center gap-2"
                            >
                                <Eye size={16} />
                                Open Notification Drawer
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

                            {/* Approver Assignment Configuration */}
                            <div className="space-y-3 pt-1">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5">Approver Assignment Type</label>
                                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200/60 dark:border-white/10">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingStage({
                                                    ...editingStage,
                                                    approver_type: 'ROLE',
                                                    approver_id: editingStage.approver_role || roles[0]?.id || 'APPROVER'
                                                });
                                            }}
                                            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                                                editingStage.approver_type === 'ROLE'
                                                    ? 'bg-white dark:bg-nocturne text-[var(--color-brand)] shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                            }`}
                                        >
                                            <Shield size={13} />
                                            <span>Role</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const firstUser = activeSystemUsers[0];
                                                setEditingStage({
                                                    ...editingStage,
                                                    approver_type: 'USER',
                                                    approver_id: editingStage.approver_user_id || firstUser?.id || '',
                                                    approver_user_id: editingStage.approver_user_id || firstUser?.id || ''
                                                });
                                            }}
                                            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                                                editingStage.approver_type === 'USER'
                                                    ? 'bg-white dark:bg-nocturne text-[var(--color-brand)] shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                            }`}
                                        >
                                            <UserIcon size={13} />
                                            <span>Individual</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const firstUser = activeSystemUsers[0];
                                                const firstRole = roles[0]?.id || 'APPROVER';
                                                setEditingStage({
                                                    ...editingStage,
                                                    approver_type: 'BOTH',
                                                    approver_id: editingStage.approver_user_id || firstUser?.id || '',
                                                    approver_user_id: editingStage.approver_user_id || firstUser?.id || '',
                                                    approver_role: editingStage.approver_role || firstRole
                                                });
                                            }}
                                            className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-xs font-bold transition-all ${
                                                editingStage.approver_type === 'BOTH'
                                                    ? 'bg-white dark:bg-nocturne text-[var(--color-brand)] shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                            }`}
                                        >
                                            <span className="flex items-center gap-0.5">
                                                <UserIcon size={11} />+<Shield size={11} />
                                            </span>
                                            <span>Both</span>
                                        </button>
                                    </div>
                                </div>

                                {/* When ROLE or BOTH is selected */}
                                {(editingStage.approver_type === 'ROLE' || editingStage.approver_type === 'BOTH') && (
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                                            {editingStage.approver_type === 'BOTH' ? 'Fallback Approver Role' : 'Approver Role'}
                                        </label>
                                        <select
                                            value={editingStage.approver_type === 'BOTH' ? (editingStage.approver_role || roles[0]?.id) : editingStage.approver_id}
                                            onChange={e => {
                                                if (editingStage.approver_type === 'BOTH') {
                                                    setEditingStage({ ...editingStage, approver_role: e.target.value });
                                                } else {
                                                    setEditingStage({ ...editingStage, approver_id: e.target.value, approver_role: e.target.value });
                                                }
                                            }}
                                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white font-medium"
                                        >
                                            {roles.map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-[11px] text-gray-400 mt-1">
                                            {editingStage.approver_type === 'BOTH'
                                                ? 'If the assigned individual is absent, users holding this role can review and sign off.'
                                                : 'Any active user assigned this system role is authorized to review and approve.'}
                                        </p>
                                    </div>
                                )}

                                {/* When INDIVIDUAL or BOTH is selected */}
                                {(editingStage.approver_type === 'USER' || editingStage.approver_type === 'BOTH') && (
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-[10px] font-black uppercase text-gray-400">
                                                {editingStage.approver_type === 'BOTH' ? 'Designated Individual Approver' : 'Assigned Individual'}
                                            </label>
                                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                <CheckCircle2 size={11} /> Verified System Access
                                            </span>
                                        </div>
                                        <select
                                            value={editingStage.approver_type === 'BOTH' ? (editingStage.approver_user_id || activeSystemUsers[0]?.id) : editingStage.approver_id}
                                            onChange={e => {
                                                const selectedUserId = e.target.value;
                                                if (editingStage.approver_type === 'BOTH') {
                                                    setEditingStage({ ...editingStage, approver_user_id: selectedUserId, approver_id: selectedUserId });
                                                } else {
                                                    setEditingStage({ ...editingStage, approver_id: selectedUserId, approver_user_id: selectedUserId });
                                                }
                                            }}
                                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white font-medium"
                                        >
                                            {activeSystemUsers.map(u => {
                                                const roleName = roles.find(r => r.id === u.role)?.name || u.role;
                                                return (
                                                    <option key={u.id} value={u.id}>
                                                        {u.name || u.email} ({u.email}) — Role: {roleName}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        <p className="text-[11px] text-gray-400 mt-1">
                                            Only approved accounts with active ProcureFlow credentials can be assigned.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">SLA Deadline (Hours)</label>
                                <input
                                    type="number"
                                    value={editingStage.sla_hours}
                                    onChange={e => setEditingStage({ ...editingStage, sla_hours: parseInt(e.target.value) || 24 })}
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white font-medium"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400">Escalate To (Optional)</label>
                                    <span className="text-[10px] text-gray-400">Role or Individual</span>
                                </div>
                                <select
                                    value={editingStage.escalate_to_user_id ? `USER:${editingStage.escalate_to_user_id}` : (editingStage.escalate_to_role ? `ROLE:${editingStage.escalate_to_role}` : '')}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (!val) {
                                            setEditingStage({ ...editingStage, escalate_to_role: undefined, escalate_to_user_id: undefined, escalate_to_type: undefined });
                                        } else if (val.startsWith('USER:')) {
                                            setEditingStage({ ...editingStage, escalate_to_user_id: val.replace('USER:', ''), escalate_to_role: undefined, escalate_to_type: 'USER' });
                                        } else if (val.startsWith('ROLE:')) {
                                            setEditingStage({ ...editingStage, escalate_to_role: val.replace('ROLE:', ''), escalate_to_user_id: undefined, escalate_to_type: 'ROLE' });
                                        }
                                    }}
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white font-medium"
                                >
                                    <option value="">No Escalation</option>
                                    <optgroup label="System Roles">
                                        {roles.map(r => (
                                            <option key={`role_${r.id}`} value={`ROLE:${r.id}`}>Role: {r.name}</option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="Specific Individuals (Verified System Access)">
                                        {activeSystemUsers.map(u => (
                                            <option key={`user_${u.id}`} value={`USER:${u.id}`}>Individual: {u.name || u.email} ({u.email})</option>
                                        ))}
                                    </optgroup>
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
