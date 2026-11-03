import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, CheckCircle2, AlertTriangle, AlertCircle, Clock, 
  User as UserIcon, Mail, MessageSquare, Bell, ArrowRight, 
  RotateCcw, Send, Play, Sparkles, Building2, Check, ExternalLink,
  ChevronRight, RefreshCw, FileText, Lock, Eye, Info, X, Save
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from './ToastNotification';
import PageHeader from './PageHeader';
import { 
  siteApprovalWorkflowService, 
  SiteApprovalWorkflow, 
  ApprovalNotificationRecord, 
  WorkflowAuditEntry, 
  VERIFIED_APPROVAL_IDENTITIES,
  PROCUREFLOW_LOGO_URL 
} from '../services/siteApprovalWorkflowService';

export const SiteApprovalWorkflowManager: React.FC = () => {
  const { sites, users, roles, hasPermission, currentUser } = useApp();
  const { success, error, warning, info } = useToast();

  const [activeTab, setActiveTab] = useState<'MATRIX' | 'DEMO' | 'OFFBOARDING' | 'AUDIT'>('MATRIX');
  const [workflows, setWorkflows] = useState<SiteApprovalWorkflow[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('44444444-4444-4444-8444-444444444444'); // Melbourne default
  const [editingWorkflow, setEditingWorkflow] = useState<SiteApprovalWorkflow | null>(null);
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);

  // Demo state
  const [demoStep, setDemoStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [demoPoId, setDemoPoId] = useState('POR-MELB-DEMO-01');
  const [demoAmount, setDemoAmount] = useState(4850);
  const [demoRequester, setDemoRequester] = useState('Julie Nguyen');
  const [demoDecision, setDemoDecision] = useState<'NONE' | 'APPROVED' | 'REJECTED' | 'ESCALATED'>('NONE');
  const [demoComments, setDemoComments] = useState('');
  const [demoConcurPr, setDemoConcurPr] = useState('');
  const [demoConcurPo, setDemoConcurPo] = useState('');
  const [demoDeliveryUnlocked, setDemoDeliveryUnlocked] = useState(false);
  const [activePreviewChannel, setActivePreviewChannel] = useState<'IN_APP' | 'EMAIL' | 'TEAMS'>('IN_APP');

  // Logs
  const [notificationLogs, setNotificationLogs] = useState<ApprovalNotificationRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<WorkflowAuditEntry[]>([]);
  const [selectedPreviewRecord, setSelectedPreviewRecord] = useState<ApprovalNotificationRecord | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const list = await siteApprovalWorkflowService.getSiteWorkflows();
    setWorkflows(list);
    setNotificationLogs(siteApprovalWorkflowService.getNotificationLogs());
    setAuditLogs(siteApprovalWorkflowService.getAuditLogs());
  };

  const melbourneWorkflow = useMemo(() => {
    return workflows.find(w => w.site_id === '44444444-4444-4444-8444-444444444444') || {
      site_id: '44444444-4444-4444-8444-444444444444',
      site_name: 'SPL Melbourne',
      approval_manager_id: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.id,
      approval_manager_name: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.name,
      approval_manager_email: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.email,
      escalation_manager_id: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.id,
      escalation_manager_name: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.name,
      escalation_manager_email: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.email,
      escalation_sla_hours: 24,
      sla_status: 'DECISION_PENDING',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }, [workflows]);

  const ashMigrationAnalysis = useMemo(() => {
    return siteApprovalWorkflowService.analyzeAshMigration();
  }, []);

  const handleOpenEditModal = (siteId: string) => {
    const existing = workflows.find(w => w.site_id === siteId);
    const siteObj = (sites || []).find(s => s.id === siteId);
    setEditingWorkflow(existing || {
      site_id: siteId,
      site_name: siteObj?.name || 'Facility',
      approval_manager_id: 'mgr_' + siteId.slice(0, 8),
      approval_manager_name: '',
      approval_manager_email: '',
      escalation_manager_id: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.id,
      escalation_manager_name: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.name,
      escalation_manager_email: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.email,
      escalation_sla_hours: 24,
      sla_status: 'DECISION_PENDING',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setIsEditingModalOpen(true);
  };

  const handleSaveModal = async () => {
    if (!editingWorkflow) return;
    if (!editingWorkflow.approval_manager_name.trim()) {
      error('Please enter a Site Approval Manager name');
      return;
    }
    if (!editingWorkflow.approval_manager_email.trim()) {
      error('Please enter a Site Approval Manager email');
      return;
    }
    const saved = await siteApprovalWorkflowService.saveSiteWorkflow(editingWorkflow, currentUser?.name || 'Admin');
    await loadData();
    setIsEditingModalOpen(false);
    success(`Approval workflow for ${saved.site_name} saved and persisted.`);
  };

  // Demo step 1: Submit requisition
  const handleDemoSubmitRequisition = async () => {
    siteApprovalWorkflowService.logAudit({
      po_id: demoPoId,
      display_id: demoPoId,
      site_id: melbourneWorkflow.site_id,
      action: 'ROUTED_TO_SITE_MANAGER',
      actor_id: 'user_julie_01',
      actor_name: demoRequester,
      actor_role: 'SITE_USER',
      details: {
        totalAmount: demoAmount,
        site: 'SPL Melbourne',
        assignedSiteManager: melbourneWorkflow.approval_manager_name,
        assignedSiteManagerEmail: melbourneWorkflow.approval_manager_email,
      },
      timestamp: new Date().toISOString(),
    });

    const notif = await siteApprovalWorkflowService.dispatchSafeNotification({
      eventType: 'SITE_MANAGER_APPROVAL_REQUIRED',
      poId: demoPoId,
      displayId: demoPoId,
      siteId: melbourneWorkflow.site_id,
      siteName: 'SPL Melbourne',
      recipientId: melbourneWorkflow.approval_manager_id,
      recipientName: melbourneWorkflow.approval_manager_name,
      recipientEmail: melbourneWorkflow.approval_manager_email,
      requesterName: demoRequester,
      totalAmount: demoAmount,
    });

    setNotificationLogs(siteApprovalWorkflowService.getNotificationLogs());
    setAuditLogs(siteApprovalWorkflowService.getAuditLogs());
    setDemoStep(2);
    success(`Requisition submitted! Dispatched safe non-sending notification to Site Manager (${melbourneWorkflow.approval_manager_name}).`);
  };

  // Demo step 3: Site manager decision
  const handleDemoDecision = async (decision: 'APPROVED' | 'REJECTED' | 'ESCALATED') => {
    setDemoDecision(decision);

    if (decision === 'APPROVED') {
      siteApprovalWorkflowService.logAudit({
        po_id: demoPoId,
        display_id: demoPoId,
        site_id: melbourneWorkflow.site_id,
        action: 'APPROVED_BY_SITE_MANAGER',
        actor_id: melbourneWorkflow.approval_manager_id,
        actor_name: melbourneWorkflow.approval_manager_name,
        actor_role: 'SITE_MANAGER',
        details: {
          decision: 'APPROVED',
          comments: demoComments || 'Approved for Melbourne laundry production',
          stockReservationExpiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
          statusTransition: 'APPROVED_PENDING_CONCUR_REQUEST',
        },
        timestamp: new Date().toISOString(),
      });

      await siteApprovalWorkflowService.dispatchSafeNotification({
        eventType: 'REQUESTER_PO_APPROVED',
        poId: demoPoId,
        displayId: demoPoId,
        siteId: melbourneWorkflow.site_id,
        siteName: 'SPL Melbourne',
        recipientId: 'user_julie_01',
        recipientName: demoRequester,
        recipientEmail: 'julie.nguyen@splservices.com.au',
        totalAmount: demoAmount,
        decisionComments: demoComments,
      });

      setDemoStep(4);
      success(`Order approved by Matthew Mancuso! Requester (${demoRequester}) notified to raise Concur PR.`);
    } else if (decision === 'REJECTED') {
      siteApprovalWorkflowService.logAudit({
        po_id: demoPoId,
        display_id: demoPoId,
        site_id: melbourneWorkflow.site_id,
        action: 'REJECTED_BY_SITE_MANAGER',
        actor_id: melbourneWorkflow.approval_manager_id,
        actor_name: melbourneWorkflow.approval_manager_name,
        actor_role: 'SITE_MANAGER',
        details: {
          decision: 'REJECTED',
          comments: demoComments || 'Quantity exceeds monthly allocation',
          statusTransition: 'REJECTED',
        },
        timestamp: new Date().toISOString(),
      });

      await siteApprovalWorkflowService.dispatchSafeNotification({
        eventType: 'REQUESTER_PO_REJECTED',
        poId: demoPoId,
        displayId: demoPoId,
        siteId: melbourneWorkflow.site_id,
        siteName: 'SPL Melbourne',
        recipientId: 'user_julie_01',
        recipientName: demoRequester,
        recipientEmail: 'julie.nguyen@splservices.com.au',
        decisionComments: demoComments || 'Quantity exceeds monthly allocation',
      });

      setDemoStep(4);
      warning(`Order rejected. Requester notified with feedback.`);
    } else if (decision === 'ESCALATED') {
      siteApprovalWorkflowService.logAudit({
        po_id: demoPoId,
        display_id: demoPoId,
        site_id: melbourneWorkflow.site_id,
        action: 'ESCALATED_TO_COO',
        actor_id: 'SYSTEM_SCHEDULER',
        actor_name: 'Workflow Engine',
        actor_role: 'SYSTEM',
        details: {
          reason: 'Approval response SLA threshold elapsed.',
          escalated_to: melbourneWorkflow.escalation_manager_name,
          escalated_to_email: melbourneWorkflow.escalation_manager_email,
        },
        timestamp: new Date().toISOString(),
      });

      await siteApprovalWorkflowService.dispatchSafeNotification({
        eventType: 'ESCALATION_MANAGER_ALERT',
        poId: demoPoId,
        displayId: demoPoId,
        siteId: melbourneWorkflow.site_id,
        siteName: 'SPL Melbourne',
        recipientId: melbourneWorkflow.escalation_manager_id,
        recipientName: melbourneWorkflow.escalation_manager_name,
        recipientEmail: melbourneWorkflow.escalation_manager_email,
        totalAmount: demoAmount,
      });

      setDemoStep(4);
      info(`Order escalated to Executive COO (${melbourneWorkflow.escalation_manager_name}).`);
    }

    setNotificationLogs(siteApprovalWorkflowService.getNotificationLogs());
    setAuditLogs(siteApprovalWorkflowService.getAuditLogs());
  };

  // Demo step 5: Enter Concur PR
  const handleLinkConcurPr = () => {
    if (!demoConcurPr.trim()) {
      error('Please enter a Concur PR # (e.g. PR-9848)');
      return;
    }
    siteApprovalWorkflowService.logAudit({
      po_id: demoPoId,
      display_id: demoPoId,
      site_id: melbourneWorkflow.site_id,
      action: 'CONCUR_PR_RECORDED',
      actor_id: 'user_julie_01',
      actor_name: demoRequester,
      actor_role: 'SITE_USER',
      details: {
        concur_request_number: demoConcurPr,
        reservationProtected: true,
        transitionStatus: 'APPROVED_PENDING_CONCUR',
        notes: 'Stock reservation hold is now protected while SAP Concur PO is awaited.',
      },
      timestamp: new Date().toISOString(),
    });
    setAuditLogs(siteApprovalWorkflowService.getAuditLogs());
    success(`Concur PR #${demoConcurPr} recorded! 48-hour stock reservation is protected.`);
  };

  // Demo step 5: Enter Concur PO
  const handleLinkConcurPo = () => {
    if (!demoConcurPo.trim()) {
      error('Please enter a Concur PO # (e.g. PO-2026-9848)');
      return;
    }
    siteApprovalWorkflowService.logAudit({
      po_id: demoPoId,
      display_id: demoPoId,
      site_id: melbourneWorkflow.site_id,
      action: 'CONCUR_PO_LINKED',
      actor_id: 'user_julie_01',
      actor_name: demoRequester,
      actor_role: 'SITE_USER',
      details: {
        concur_po_number: demoConcurPo,
        transitionStatus: 'ACTIVE',
        deliveriesUnlocked: true,
      },
      timestamp: new Date().toISOString(),
    });
    setDemoDeliveryUnlocked(true);
    setAuditLogs(siteApprovalWorkflowService.getAuditLogs());
    success(`Concur PO #${demoConcurPo} linked! Status updated to ACTIVE. Delivery receiving & invoices are now unlocked.`);
  };

  const handleResetDemo = () => {
    setDemoStep(1);
    setDemoDecision('NONE');
    setDemoComments('');
    setDemoConcurPr('');
    setDemoConcurPo('');
    setDemoDeliveryUnlocked(false);
    info('Melbourne approval workflow demo reset to initial state.');
  };

  return (
    <div className="space-y-6 animate-page-entry pb-16">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-gray-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-xl border border-sky-200 dark:border-sky-500/20">
              <Building2 size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Site Approval Workflows</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Per-site approval routing & notification authority — demonstrated for Melbourne with Matthew Mancuso & Eb
              </p>
            </div>
          </div>
        </div>

        {/* Global Status Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Safe Non-Sending Harness Active</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-bold">
            <CheckCircle2 size={13} />
            <span>Melbourne Verified</span>
          </div>
        </div>
      </div>

      {/* SLA Policy Advisory Alert */}
      <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 flex items-start gap-3.5 shadow-sm">
        <AlertTriangle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1 text-xs">
          <p className="font-bold text-amber-900 dark:text-amber-200">
            Escalation SLA Governance Notice (Action Decision Required Before Production Activation)
          </p>
          <p className="text-amber-800/90 dark:text-amber-300/90 mt-1 leading-relaxed">
            Reviewed SPL communications and governance documents confirm that the <strong>48-hour timer applies strictly to supplier stock reservations</strong>, not an approval escalation timer. No formal approval escalation SLA was established. An operational decision from executive leadership is required before enabling automated auto-escalation cron triggers.
          </p>
        </div>
      </div>

      {/* Top Tabs */}
      <div className="flex border-b border-gray-200 dark:border-white/10 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('MATRIX')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'MATRIX'
              ? 'border-sky-600 text-sky-600 dark:border-sky-400 dark:text-sky-400'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Building2 size={15} />
          <span>Facility Routing Matrix</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('DEMO')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'DEMO'
              ? 'border-sky-600 text-sky-600 dark:border-sky-400 dark:text-sky-400'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Play size={15} />
          <span>Melbourne Interactive Demo</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            Live
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('OFFBOARDING')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'OFFBOARDING'
              ? 'border-sky-600 text-sky-600 dark:border-sky-400 dark:text-sky-400'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <RotateCcw size={15} />
          <span>Ashish Offboarding & Migration</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            Traceable
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('AUDIT')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'AUDIT'
              ? 'border-sky-600 text-sky-600 dark:border-sky-400 dark:text-sky-400'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <FileText size={15} />
          <span>Audit Trail & Telemetry</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300">
            {auditLogs.length}
          </span>
        </button>
      </div>

      {/* ── TAB 1: FACILITY ROUTING MATRIX ───────────────────────────────────────── */}
      {activeTab === 'MATRIX' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* SPL Melbourne Card (Highlighted) */}
            <div className="relative rounded-2xl bg-gradient-to-b from-sky-50/50 to-white dark:from-sky-950/20 dark:to-nocturne border-2 border-sky-400/80 dark:border-sky-500/40 p-5 shadow-lg space-y-4">
              <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-sky-600 text-white text-[10px] font-black uppercase tracking-wider">
                Pilot Facility
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-gray-900 dark:text-white">SPL Melbourne</h3>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300">VIC</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Broadmeadows • 44444444-4444-4444-8444-444444444444</p>
              </div>

              {/* Primary Approver */}
              <div className="p-3 rounded-xl bg-white dark:bg-white/5 border border-sky-200 dark:border-sky-500/20 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-sky-700 dark:text-sky-400">
                  <span>Site Approval Manager</span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={11} /> Entra Verified
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-xs">
                    MM
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{melbourneWorkflow.approval_manager_name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{melbourneWorkflow.approval_manager_email}</p>
                  </div>
                </div>
              </div>

              {/* Escalation Approver */}
              <div className="p-3 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">
                  <span>Escalation Authority</span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={11} /> COO Verified
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-xs">
                    EM
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">
                      {melbourneWorkflow.escalation_manager_name} {melbourneWorkflow.escalation_manager_name.includes('Eb') ? '' : '(Eb)'}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{melbourneWorkflow.escalation_manager_email}</p>
                  </div>
                </div>
              </div>

              {/* SLA Status */}
              <div className="pt-1 flex items-center justify-between text-xs border-t border-gray-100 dark:border-white/5">
                <span className="text-gray-500 font-medium">SLA Escalation Window:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Clock size={13} /> Decision Required
                </span>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('DEMO')}
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <Play size={14} />
                  <span>Launch Melbourne Interactive Demo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(melbourneWorkflow.site_id)}
                  aria-label="Configure Melbourne Facility"
                  className="px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 text-gray-700 dark:text-gray-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Shield size={13} />
                  <span>Configure</span>
                </button>
              </div>
            </div>

            {/* Other Facilities in SPL Network */}
            {(sites || [])
              .filter(s => s.id !== '44444444-4444-4444-8444-444444444444')
              .slice(0, 5)
              .map(site => {
                const wf = workflows.find(w => w.site_id === site.id);
                return (
                  <div key={site.id} className="rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-white/10 p-5 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-gray-900 dark:text-white">{site.name}</h3>
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300">{site.state}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{site.suburb}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 text-[10px] font-bold">
                        {wf?.approval_manager_name ? 'Assigned' : 'Standard'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1">
                      <p className="text-[10px] font-black uppercase text-gray-400">Approval Workflow</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        {wf?.approval_manager_name ? (
                          <span className="font-bold text-sky-600 dark:text-sky-400">{wf.approval_manager_name}</span>
                        ) : (
                          'Ready for Site Manager assignment'
                        )}
                      </p>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(site.id)}
                        className="w-full py-2 rounded-xl bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 text-gray-700 dark:text-gray-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Shield size={13} />
                        <span>Configure Facility</span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── TAB 2: MELBOURNE INTERACTIVE DEMO ────────────────────────────────────── */}
      {activeTab === 'DEMO' && (
        <div className="space-y-6">
          {/* Demo Stepper Progress */}
          <div className="bg-white dark:bg-nocturne p-5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-gray-900 dark:text-white">Melbourne End-to-End Approval Simulation</h3>
                <p className="text-xs text-gray-500">Non-sending live preview harness (Safe: no real emails or messages dispatched)</p>
              </div>
              <button
                type="button"
                onClick={handleResetDemo}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10"
              >
                <RotateCcw size={13} />
                <span>Reset Demo</span>
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {[
                { step: 1, title: '1. Requisition Submitted', desc: 'Site order raised' },
                { step: 2, title: '2. Site Manager Notified', desc: 'Matthew Mancuso' },
                { step: 3, title: '3. Approval Decision', desc: 'Approve / Reject' },
                { step: 4, title: '4. Requester Notified', desc: 'Outcome delivered' },
                { step: 5, title: '5. Concur PR Handover', desc: 'Resume normal process' },
              ].map(s => (
                <div
                  key={s.step}
                  className={`p-3 rounded-xl border transition-all ${
                    demoStep === s.step
                      ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-500 text-sky-900 dark:text-sky-300'
                      : demoStep > s.step
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-400'
                  }`}
                >
                  <p className="text-xs font-bold">{s.title}</p>
                  <p className="text-[10px] mt-0.5 opacity-80">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Steps */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Control Panel (6 cols) */}
            <div className="lg:col-span-6 space-y-5">
              {/* STEP 1: Requisition Creation */}
              {demoStep === 1 && (
                <div className="p-6 bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                      Step 1 of 5
                    </span>
                    <span className="text-xs text-gray-400">Target: SPL Melbourne</span>
                  </div>

                  <h3 className="text-base font-black text-gray-900 dark:text-white">Raise Purchase Requisition</h3>
                  <p className="text-xs text-gray-500">
                    A laundry supervisor at SPL Melbourne raises an order for fitted sheets and bath towels.
                  </p>

                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">PO Reference</label>
                      <input
                        type="text"
                        value={demoPoId}
                        onChange={e => setDemoPoId(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Requester</label>
                        <input
                          type="text"
                          value={demoRequester}
                          onChange={e => setDemoRequester(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Total Value (AUD)</label>
                        <input
                          type="number"
                          value={demoAmount}
                          onChange={e => setDemoAmount(Number(e.target.value))}
                          className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDemoSubmitRequisition}
                    className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
                  >
                    <span>Submit Requisition for Approval</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {/* STEP 2 & 3: Site Manager Review & Decision */}
              {(demoStep === 2 || demoStep === 3) && (
                <div className="p-6 bg-white dark:bg-nocturne rounded-2xl border border-sky-400/60 dark:border-sky-500/30 shadow-md space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                      Step {demoStep} of 5
                    </span>
                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400">Site Manager Review</span>
                  </div>

                  <div>
                    <h3 className="text-base font-black text-gray-900 dark:text-white">Site Manager Action (Matthew Mancuso)</h3>
                    <p className="text-xs text-gray-500">
                      Requisition {demoPoId} routed automatically to Matthew Mancuso. Review order and take action.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Order Reference:</span>
                      <span className="font-mono font-bold text-gray-900 dark:text-white">{demoPoId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Facility:</span>
                      <span className="font-bold text-gray-900 dark:text-white">SPL Melbourne</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Requester:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{demoRequester}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Spend:</span>
                      <span className="font-bold text-sky-600 dark:text-sky-400">${demoAmount.toLocaleString()} AUD</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Decision Comments / Notes</label>
                    <textarea
                      rows={2}
                      value={demoComments}
                      onChange={e => setDemoComments(e.target.value)}
                      placeholder="Add review notes, carton check verification, or instructions..."
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleDemoDecision('APPROVED')}
                      className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                    >
                      <CheckCircle2 size={14} />
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDemoDecision('REJECTED')}
                      className="py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                    >
                      <AlertCircle size={14} />
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDemoDecision('ESCALATED')}
                      className="py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                    >
                      <Clock size={14} />
                      <span>Escalate to Eb</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4 & 5: Requester Notification & Concur PR Handover */}
              {(demoStep === 4 || demoStep === 5) && (
                <div className="p-6 bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                      Step 5 of 5: Resume Normal Process
                    </span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {demoDecision === 'APPROVED' ? 'Order Approved' : demoDecision === 'REJECTED' ? 'Order Rejected' : 'Escalated'}
                    </span>
                  </div>

                  {demoDecision === 'APPROVED' && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-base font-black text-gray-900 dark:text-white">Ash's June 17 Concur Handover Flow</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Approved in ProcureFlow &rarr; Requester creates Concur PR &rarr; records PR # &rarr; Concur PO # unlocks deliveries.
                        </p>
                      </div>

                      {/* Stock reservation alert */}
                      <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-500/20 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-sky-800 dark:text-sky-300">
                          <Clock size={14} />
                          <span>48-Hour Supplier Stock Reservation Hold Active</span>
                        </div>
                        <p className="text-sky-700 dark:text-sky-400 text-[11px]">
                          Stock is currently held exclusively for Melbourne. Entering the Concur PR # secures the reservation hold while awaiting SAP Concur PO issuance.
                        </p>
                      </div>

                      {/* Action 1: Record Concur PR */}
                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 space-y-3">
                        <label className="block text-[10px] font-black uppercase text-gray-400">1. Log SAP Concur PR #</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g. PR-9848"
                            value={demoConcurPr}
                            onChange={e => setDemoConcurPr(e.target.value)}
                            className="flex-1 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-mono font-bold"
                          />
                          <button
                            type="button"
                            onClick={handleLinkConcurPr}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-sm"
                          >
                            Save PR #
                          </button>
                        </div>
                      </div>

                      {/* Action 2: Link Concur PO */}
                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 space-y-3">
                        <label className="block text-[10px] font-black uppercase text-gray-400">2. Link SAP Concur PO # (Unlocks Deliveries)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g. PO-2026-9848"
                            value={demoConcurPo}
                            onChange={e => setDemoConcurPo(e.target.value)}
                            className="flex-1 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-mono font-bold"
                          />
                          <button
                            type="button"
                            onClick={handleLinkConcurPo}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-sm"
                          >
                            Link PO #
                          </button>
                        </div>
                      </div>

                      {demoDeliveryUnlocked && (
                        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 text-xs flex items-center gap-3">
                          <CheckCircle2 className="text-emerald-600 flex-shrink-0" size={20} />
                          <div>
                            <p className="font-bold text-emerald-900 dark:text-emerald-200">Requisition Lifecycle Complete</p>
                            <p className="text-emerald-700 dark:text-emerald-400 text-[11px] mt-0.5">
                              Status is ACTIVE. Melbourne warehouse receiving, docket uploads, and invoice matching are fully unlocked.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {demoDecision !== 'APPROVED' && (
                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 text-xs text-gray-600 dark:text-gray-300">
                      Simulation ended with decision: <strong>{demoDecision}</strong>. See notification preview on the right.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Notification Preview & Multi-channel Telemetry (6 cols) */}
            <div className="lg:col-span-6 space-y-5">
              <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">Notification Telemetry Preview</h3>
                    <p className="text-[11px] text-gray-400">Non-sending live rendering preview</p>
                  </div>

                  {/* Channel Toggle */}
                  <div className="flex p-1 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200/60 dark:border-white/10 text-xs">
                    {(['IN_APP', 'EMAIL', 'TEAMS'] as const).map(ch => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setActivePreviewChannel(ch)}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                          activePreviewChannel === ch
                            ? 'bg-white dark:bg-nocturne text-sky-600 dark:text-sky-400 shadow-sm'
                            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        {ch === 'IN_APP' ? 'In-App Toast' : ch === 'EMAIL' ? 'Branded Email' : 'Teams Card'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview Content */}
                {notificationLogs.length === 0 ? (
                  <div className="py-16 text-center text-gray-400 text-xs">
                    <Bell className="mx-auto mb-2 opacity-40" size={32} />
                    <p>No notifications dispatched yet.</p>
                    <p className="text-[11px] mt-1">Submit a requisition in Step 1 to trigger previews.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activePreviewChannel === 'IN_APP' && (
                      <div className="p-4 rounded-xl bg-gray-900 text-white shadow-xl border border-white/10 flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 flex-shrink-0 mt-0.5">
                          <Bell size={18} />
                        </div>
                        <div className="flex-1 text-xs">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-sky-300">{notificationLogs[0]?.title}</p>
                            <span className="text-[10px] text-gray-400">Just now</span>
                          </div>
                          <p className="text-gray-200 mt-1 leading-relaxed">{notificationLogs[0]?.body}</p>
                          <div className="mt-2 text-[10px] font-mono text-gray-400">
                            Recipient: {notificationLogs[0]?.recipient_name} ({notificationLogs[0]?.recipient_email})
                          </div>
                        </div>
                      </div>
                    )}

                    {activePreviewChannel === 'EMAIL' && (
                      <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden shadow-sm">
                        <div className="p-3 bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 text-xs text-gray-500 space-y-1">
                          <p><strong>To:</strong> {notificationLogs.find(l => l.channel === 'EMAIL')?.recipient_name} &lt;{notificationLogs.find(l => l.channel === 'EMAIL')?.recipient_email}&gt;</p>
                          <p><strong>Subject:</strong> {notificationLogs.find(l => l.channel === 'EMAIL')?.title}</p>
                        </div>
                        <div className="p-5 bg-white text-gray-900 max-h-[380px] overflow-y-auto">
                          <div
                            dangerouslySetInnerHTML={{
                              __html: notificationLogs.find(l => l.channel === 'EMAIL')?.html_preview || '<p>Loading preview...</p>',
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {activePreviewChannel === 'TEAMS' && (
                      <div className="rounded-xl bg-[#201f1f] text-white p-5 border border-purple-500/30 shadow-xl space-y-3 font-sans">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                          <div className="w-5 h-5 rounded bg-purple-600 flex items-center justify-center text-[10px] font-bold">
                            T
                          </div>
                          <span className="text-xs font-bold text-purple-300">Microsoft Teams Adaptive Card v1.4</span>
                        </div>
                        <div className="p-4 rounded-lg bg-[#2b2b2b] border border-white/10 space-y-2 text-xs">
                          <p className="font-bold text-sm text-sky-400">{notificationLogs.find(l => l.channel === 'TEAMS')?.title}</p>
                          <p className="text-gray-300">{notificationLogs.find(l => l.channel === 'TEAMS')?.body}</p>
                          <div className="pt-2">
                            <button
                              type="button"
                              className="px-4 py-1.5 bg-sky-600 text-white rounded text-xs font-bold hover:bg-sky-500 transition-colors"
                            >
                              Review in ProcureFlow &rarr;
                            </button>
                          </div>
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

      {/* ── TAB 3: ASHISH OFFBOARDING & TRACEABLE MIGRATION ──────────────────────── */}
      {activeTab === 'OFFBOARDING' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-white/10 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-gray-900 dark:text-white">Ashish Chhabra Offboarding Audit & Reassignment Plan</h3>
                <p className="text-xs text-gray-500">
                  Traceable migration plan following personnel departure. Preserves complete historical audit trail with zero lost requests.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                Action Required (Proposed Only)
              </span>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/30 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-bold">Governance Safety Harbor</p>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                In compliance with project directives, reassignments are proposed for executive approval. No live database routing records are modified without explicit sign-off.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Historical Closed Orders */}
            <div className="p-5 rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-white/10 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-gray-400">Historical Closed Requests (Immutable Archive)</h4>
                <span className="text-[11px] font-bold text-gray-500">2 Orders Preserved</span>
              </div>
              <p className="text-xs text-gray-500">
                Orders completed and closed under Ash's approval remain locked for financial compliance.
              </p>

              <div className="space-y-2 pt-2">
                {ashMigrationAnalysis.closedRequests.map(req => (
                  <div key={req.id} className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/80 dark:border-white/5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-mono font-bold text-gray-900 dark:text-white">{req.display_id}</p>
                      <p className="text-[11px] text-gray-500">{req.site_name}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300">
                      {req.status} (Preserved)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Open Order Proposed Reassignment */}
            <div className="p-5 rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-white/10 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-gray-400">Active Open Orders Requiring Routing Update</h4>
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">1 Order Pending Concur</span>
              </div>
              <p className="text-xs text-gray-500">
                Order currently approved awaiting Concur PR linking. Proposed reassignment:
              </p>

              <div className="space-y-2 pt-2">
                {ashMigrationAnalysis.reassignmentProposal.map(prop => (
                  <div key={prop.request_id} className="p-3.5 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-500/20 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sky-900 dark:text-sky-300">{prop.display_id}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                        Holdings Corporate
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 text-[11px]">Facility: <strong>{prop.site_name}</strong></p>
                    <div className="pt-1 border-t border-sky-100 dark:border-white/5 space-y-1">
                      <p className="text-[11px] text-gray-500">Current Approver: <span className="line-through">{prop.current_routing}</span></p>
                      <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                        Proposed Approver: {prop.proposed_site_manager}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: AUDIT TRAIL ───────────────────────────────────────────────────── */}
      {activeTab === 'AUDIT' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm">
            <h3 className="text-sm font-black text-gray-900 dark:text-white mb-1">Workflow Decision & Notification Audit Logs</h3>
            <p className="text-xs text-gray-500">Unbroken cryptographic trace of all approvals, escalations, and Concur references</p>

            <div className="mt-4 space-y-2">
              {auditLogs.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  No audit entries recorded yet.
                </div>
              ) : (
                auditLogs.map(log => (
                  <div key={log.id} className="p-3.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/80 dark:border-white/5 flex items-start justify-between text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{log.display_id}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300">
                          {log.action}
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300">
                        Actor: <strong>{log.actor_name}</strong> ({log.actor_role})
                      </p>
                      {log.details && (
                        <p className="text-[11px] text-gray-400 font-mono">
                          {JSON.stringify(log.details)}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Configure Facility Modal */}
      {isEditingModalOpen && editingWorkflow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-nocturne rounded-2xl max-w-lg w-full border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="text-sky-600" size={20} />
                <h3 className="text-base font-black text-gray-900 dark:text-white">
                  Configure Facility: {editingWorkflow.site_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                  Site Approval Manager Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Smith"
                  value={editingWorkflow.approval_manager_name}
                  onChange={e => setEditingWorkflow({ ...editingWorkflow, approval_manager_name: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                  Site Approval Manager Email
                </label>
                <input
                  type="email"
                  placeholder="e.g. john.smith@splservices.com.au"
                  value={editingWorkflow.approval_manager_email}
                  onChange={e => setEditingWorkflow({ ...editingWorkflow, approval_manager_email: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                  Escalation Authority (COO)
                </label>
                <input
                  type="text"
                  value={editingWorkflow.escalation_manager_name}
                  onChange={e => setEditingWorkflow({ ...editingWorkflow, escalation_manager_name: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                    Escalation SLA (Hours)
                  </label>
                  <input
                    type="number"
                    value={editingWorkflow.escalation_sla_hours}
                    onChange={e => setEditingWorkflow({ ...editingWorkflow, escalation_sla_hours: Number(e.target.value) })}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                    SLA Status
                  </label>
                  <span className="block px-3 py-2 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 font-bold rounded-xl border border-amber-200 dark:border-amber-800/40">
                    Decision Required
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsEditingModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm flex items-center gap-1.5"
              >
                <Save size={14} />
                <span>Save Facility Workflow</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteApprovalWorkflowManager;
