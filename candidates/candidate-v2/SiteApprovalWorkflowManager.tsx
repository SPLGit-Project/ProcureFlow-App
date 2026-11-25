import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Clock, Shield, CheckCircle2, AlertTriangle, AlertCircle,
  User as UserIcon, Mail, MessageSquare, Bell, Edit2, Save, X, Search,
  Zap, RefreshCw, FileText, Send, Check, ExternalLink, Sliders
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast, ToastContainer } from './ToastNotification';
import PageHeader from './PageHeader';
import { 
  siteApprovalWorkflowService, 
  SiteApprovalWorkflow, 
  ApprovalNotificationRecord, 
  WorkflowAuditEntry, 
  VERIFIED_APPROVAL_IDENTITIES 
} from '../services/siteApprovalWorkflowService';
import { 
  siteApprovalIntegrationService, 
  NotificationDispatchMode 
} from '../services/siteApprovalIntegrationService';

export const SiteApprovalWorkflowManager: React.FC = () => {
  const { sites, currentUser, isUserAdmin, hasPermission } = useApp();
  const { toasts, dismissToast, success, error, info } = useToast();

  const [activeTab, setActiveTab] = useState<'MATRIX' | 'AUDIT'>('MATRIX');
  const [workflows, setWorkflows] = useState<SiteApprovalWorkflow[]>([]);
  const [editingWorkflow, setEditingWorkflow] = useState<SiteApprovalWorkflow | null>(null);
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Live Notification Dispatch Mode
  const [dispatchMode, setDispatchMode] = useState<NotificationDispatchMode>(() => 
    siteApprovalIntegrationService.getDispatchMode()
  );
  const [isSendingTestAlert, setIsSendingTestAlert] = useState(false);
  const [testSiteId, setTestSiteId] = useState<string>('44444444-4444-4444-8444-444444444444');

  // Logs
  const [notificationLogs, setNotificationLogs] = useState<ApprovalNotificationRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<WorkflowAuditEntry[]>([]);

  // Permissions
  const canManageWorkflows = useMemo(() => {
    if (!currentUser) return false;
    return (
      currentUser.role === 'ADMIN' || 
      (typeof isUserAdmin === 'function' && isUserAdmin()) || 
      hasPermission('manage_workflows') || 
      hasPermission('manage_lifecycle_triggers')
    );
  }, [currentUser, hasPermission, isUserAdmin]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const list = await siteApprovalWorkflowService.getSiteWorkflows();
      setWorkflows(list);
      setNotificationLogs(siteApprovalWorkflowService.getNotificationLogs());
      setAuditLogs(siteApprovalWorkflowService.getAuditLogs());
      setDispatchMode(siteApprovalIntegrationService.getDispatchMode());
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleDispatchMode = () => {
    if (!canManageWorkflows) {
      error('Unauthorized: You require System Admin or manage_workflows permission.');
      return;
    }
    const nextMode: NotificationDispatchMode = dispatchMode === 'LIVE' ? 'PREVIEW' : 'LIVE';
    siteApprovalIntegrationService.setDispatchMode(nextMode);
    setDispatchMode(nextMode);
    if (nextMode === 'LIVE') {
      success('Live Notification Dispatch Activated: Approvers will receive automated In-App, Email, and Teams alerts.');
    } else {
      info('Preview Mode Activated: Notifications will be generated and logged to outbox without sending live emails or Teams webhooks.');
    }
  };

  const handleSendTestNotification = async () => {
    if (!currentUser?.email) {
      error('User email not found. Please log in with a valid account.');
      return;
    }
    setIsSendingTestAlert(true);
    try {
      const targetWorkflow = workflows.find(w => w.site_id === testSiteId) || workflows[0];
      const res = await siteApprovalIntegrationService.dispatchTestNotification({
        siteId: targetWorkflow?.site_id || testSiteId,
        siteName: targetWorkflow?.site_name || 'SPL Melbourne',
        recipientEmail: currentUser.email,
        recipientName: currentUser.name || 'Current User',
        recipientId: currentUser.id,
      });
      if (res.success) {
        success(`Test notification sent successfully to ${currentUser.email} for ${targetWorkflow?.site_name || 'facility'}!`);
        await loadData();
      }
    } catch (err: any) {
      error(`Failed to dispatch test notification: ${err?.message || 'Network error'}`);
    } finally {
      setIsSendingTestAlert(false);
    }
  };

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
      escalation_mode: 'AUTO',
      escalation_sla_hours: 72,
      sla_status: 'ACTIVE_AUTO',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setIsEditingModalOpen(true);
  };

  const handleSaveModal = async () => {
    if (!editingWorkflow) return;
    if (!canManageWorkflows) {
      error('Unauthorized: You require System Admin or manage_workflows permission.');
      return;
    }
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

  const filteredWorkflows = useMemo(() => {
    if (!searchQuery.trim()) return workflows;
    const q = searchQuery.toLowerCase();
    return workflows.filter(w => 
      w.site_name.toLowerCase().includes(q) ||
      w.approval_manager_name.toLowerCase().includes(q) ||
      w.approval_manager_email.toLowerCase().includes(q) ||
      w.escalation_manager_name.toLowerCase().includes(q)
    );
  }, [workflows, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 text-sky-600 dark:text-sky-400">
            <Building2 size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
              Site Approval Workflows & Notifications
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Designated facility approvers, automated notifications, and 72-hour escalation management across all 11 SPL facilities.
            </p>
          </div>
        </div>
      </div>

      {/* ── LIVE NOTIFICATION DISPATCH CONTROL BAR ──────────────────────────────── */}
      <div className="rounded-2xl p-5 border shadow-sm transition-all bg-gradient-to-r from-sky-500/10 via-white to-blue-500/10 dark:from-sky-950/30 dark:via-nocturne dark:to-blue-950/30 border-sky-300 dark:border-sky-800/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className={`p-3 rounded-xl flex items-center justify-center shrink-0 ${
              dispatchMode === 'LIVE'
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
            }`}>
              <Zap size={20} className={dispatchMode === 'LIVE' ? 'animate-pulse' : ''} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black tracking-wide uppercase ${
                  dispatchMode === 'LIVE'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${dispatchMode === 'LIVE' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
                  {dispatchMode === 'LIVE' ? 'Live Notifications: Active' : 'Preview Mode Active'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {workflows.length} Facilities Configured
                </span>
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">
                {dispatchMode === 'LIVE'
                  ? 'Approving Site Managers automatically receive live In-App alerts, Microsoft Graph emails, and Teams Adaptive Cards when staff raise requests.'
                  : 'Notifications are logged to the durable outbox without sending external emails or Teams webhooks.'}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleToggleDispatchMode}
              disabled={!canManageWorkflows}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                dispatchMode === 'LIVE'
                  ? 'bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/15 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-white/10'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
              }`}
              title={canManageWorkflows ? 'Toggle Live / Preview dispatch mode' : 'Requires admin permission'}
            >
              <Sliders size={14} />
              <span>{dispatchMode === 'LIVE' ? 'Switch to Preview Mode' : 'Turn On Live Dispatch'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendTestNotification}
              disabled={isSendingTestAlert}
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-sm shadow-sky-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSendingTestAlert ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Sending Alert...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Send Test Alert</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── TOP TABS: ROUTING MATRIX vs AUDIT ────────────────────────────────────── */}
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
          <span>Facility Approvers ({workflows.length})</span>
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
          <span>Audit Trail & Notification Telemetry</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300">
            {auditLogs.length}
          </span>
        </button>
      </div>

      {/* ── TAB 1: FACILITY ROUTING MATRIX ───────────────────────────────────────── */}
      {activeTab === 'MATRIX' && (
        <div className="space-y-4">
          {/* Search bar & summary */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search facility, manager, or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-surface border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>All 11 facilities covered</span>
              </span>
              <span className="text-gray-300 dark:text-gray-600">•</span>
              <span className="flex items-center gap-1.5">
                <Clock size={13} className="text-sky-500" />
                <span>72h Escalation to COO Eb</span>
              </span>
            </div>
          </div>

          {/* Facility Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkflows.map(wf => {
              const isMelbourne = wf.site_name.toLowerCase().includes('melbourne');
              const initials = wf.approval_manager_name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || 'SM';

              return (
                <div
                  key={wf.site_id}
                  className={`rounded-2xl p-5 border transition-all space-y-4 shadow-sm hover:shadow-md ${
                    isMelbourne
                      ? 'bg-gradient-to-b from-sky-50/60 to-white dark:from-sky-950/20 dark:to-nocturne border-sky-400/80 dark:border-sky-500/40 ring-1 ring-sky-300 dark:ring-sky-700/50'
                      : 'bg-white dark:bg-nocturne border-gray-200 dark:border-white/10'
                  }`}
                >
                  {/* Facility Title & Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white">{wf.site_name}</h3>
                        {isMelbourne && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
                            Pilot
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                        {wf.site_id.slice(0, 8)}...
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(wf.site_id)}
                      disabled={!canManageWorkflows}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40"
                      title={canManageWorkflows ? 'Edit Approver / SLA' : 'Requires admin permission'}
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>

                  {/* Primary Approver */}
                  <div className="p-3 rounded-xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">
                      <span>Designated Approving Manager</span>
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={11} /> Entra Verified
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          {wf.approval_manager_name || 'Unassigned'}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                          {wf.approval_manager_email || 'No email specified'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Escalation & SLA */}
                  <div className="pt-2 border-t border-gray-100 dark:border-white/5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500 dark:text-gray-400">Escalates To:</span>
                      <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[160px]">
                        {wf.escalation_manager_name || 'Ebrahim Mokhtari (COO)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500 dark:text-gray-400">Escalation SLA:</span>
                      <span className="inline-flex items-center gap-1 font-bold text-sky-700 dark:text-sky-300">
                        <Clock size={11} />
                        {wf.escalation_sla_hours}h {wf.escalation_mode === 'AUTO' ? 'Auto SLA' : 'Manual Mode'}
                      </span>
                    </div>
                  </div>

                  {/* Notification Channels Active */}
                  <div className="pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-[10px]">
                    <span className="text-gray-400 dark:text-gray-500 uppercase tracking-wider font-bold">Channels</span>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold">
                        <Bell size={10} /> In-App
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold">
                        <Mail size={10} /> Email
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-bold">
                        <MessageSquare size={10} /> Teams
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredWorkflows.length === 0 && (
            <div className="p-8 text-center rounded-2xl border border-dashed border-gray-300 dark:border-white/10 text-gray-500 text-xs">
              No facility workflows match "{searchQuery}".
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: AUDIT TRAIL ───────────────────────────────────────────────────── */}
      {activeTab === 'AUDIT' && (
        <div className="rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-white/10 overflow-hidden shadow-sm space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-gray-900 dark:text-white">Workflow & Telemetry Audit Trail</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Real-time log of purchase requisition routing events, manager decisions, and notification dispatches.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
              {auditLogs.length} Events Recorded
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/10 text-gray-400 dark:text-gray-500 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">PO / Requisition</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {auditLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('en-AU', { 
                        day: '2-digit', 
                        month: 'short', 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit' 
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-gray-900 dark:text-white">
                      {log.display_id || log.po_id}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300 font-medium">
                      {log.actor_name}
                      <span className="text-gray-400 text-[10px] block">({log.actor_role})</span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400 font-mono text-[11px]">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {auditLogs.length === 0 && (
            <p className="text-center py-8 text-xs text-gray-400">No workflow events recorded yet.</p>
          )}
        </div>
      )}

      {/* ── EDIT FACILITY APPROVER MODAL ─────────────────────────────────────────── */}
      {isEditingModalOpen && editingWorkflow && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-nocturne rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <Building2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Edit Workflow: {editingWorkflow.site_name}
                  </h3>
                  <p className="text-[11px] text-gray-500">Configure site approver and escalation SLA</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Site Approval Manager Name
                </label>
                <input
                  type="text"
                  value={editingWorkflow.approval_manager_name}
                  onChange={e => setEditingWorkflow({ ...editingWorkflow, approval_manager_name: e.target.value })}
                  placeholder="e.g. Matthew Mancuso"
                  className="w-full bg-gray-50 dark:bg-surface border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Site Approval Manager Email
                </label>
                <input
                  type="email"
                  value={editingWorkflow.approval_manager_email}
                  onChange={e => setEditingWorkflow({ ...editingWorkflow, approval_manager_email: e.target.value })}
                  placeholder="e.g. matthew.mancuso@splservices.com.au"
                  className="w-full bg-gray-50 dark:bg-surface border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Escalation Mode
                  </label>
                  <select
                    value={editingWorkflow.escalation_mode || 'AUTO'}
                    onChange={e => setEditingWorkflow({ ...editingWorkflow, escalation_mode: e.target.value as any })}
                    className="w-full bg-gray-50 dark:bg-surface border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white font-medium"
                  >
                    <option value="AUTO">AUTO (Automatic on SLA)</option>
                    <option value="MANUAL">MANUAL (On-Demand Button)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Escalation SLA (Hours)
                  </label>
                  <input
                    type="number"
                    value={editingWorkflow.escalation_sla_hours || 72}
                    onChange={e => setEditingWorkflow({ ...editingWorkflow, escalation_sla_hours: parseInt(e.target.value) || 72 })}
                    min="1"
                    className="w-full bg-gray-50 dark:bg-surface border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Escalation Target
                </label>
                <input
                  type="text"
                  disabled
                  value={`${editingWorkflow.escalation_manager_name} (${editingWorkflow.escalation_manager_email})`}
                  className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-gray-500 font-medium cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-gray-100 dark:border-white/10 gap-2">
              <button
                type="button"
                onClick={() => setIsEditingModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Save size={13} />
                <span>Save Workflow</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default SiteApprovalWorkflowManager;
