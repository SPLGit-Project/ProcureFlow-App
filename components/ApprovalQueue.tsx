import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { supabase } from '../lib/supabaseClient.ts';
import { 
  getPendingApprovalsForCurrentUser, 
  recordApprovalDecision, 
  checkAndMarkSlaBreaches,
  ApprovalInstance
} from '../services/approvalEngineService.ts';
import { ItemRequestStatus } from '../types.ts';
import { 
  ClipboardCheck, 
  AlertCircle, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle, 
  XCircle, 
  ArrowRight,
  RefreshCw,
  Eye,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApprovalMetrics {
  pending: number;
  breached: number;
  approvedToday: number;
  rejectedToday: number;
}

interface ExtendedApprovalInstance extends ApprovalInstance {
  item_requests: {
    request_number: string;
    proposed_description: string;
    lifecycle_status: string;
    request_type: string;
    item_group: string;
    division: string;
    department?: string;
    purchase_enabled: boolean;
    sale_enabled: boolean;
    required_activation_date?: string;
    created_at: string;
  };
  total_stages?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SlaBadge({ deadline, breached }: { deadline: string; breached: boolean }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const diffMs = new Date(deadline).getTime() - now.getTime();
  const diffHours = Math.abs(Math.floor(diffMs / 3600000));
  const diffMins = Math.abs(Math.floor((diffMs % 3600000) / 60000));

  if (breached || diffMs < 0) {
    return (
      <div className="flex items-center gap-1 text-red-600 dark:text-red-400 font-bold text-xs">
        <AlertCircle size={14} />
        <span>Overdue by {diffHours}h {diffMins}m</span>
      </div>
    );
  }

  const isUrgent = diffMs < 4 * 3600000; // Less than 4 hours
  const colorClass = isUrgent ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className={`flex items-center gap-1 font-bold text-xs ${colorClass}`}>
      <Clock size={14} />
      <span>{diffHours}h {diffMins}m remaining</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ApprovalQueue() {
  const { hasPermission, currentUser } = useApp();
  
  const [approvals, setApprovals] = useState<ExtendedApprovalInstance[]>([]);
  const [metrics, setMetrics] = useState<ApprovalMetrics>({ pending: 0, breached: 0, approvedToday: 0, rejectedToday: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [decisionForm, setDecisionForm] = useState<{ instanceId: string; decision: 'APPROVED' | 'REJECTED' } | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canApprove = hasPermission('approve_item_requests');
  const canViewSell = hasPermission('view_sell_pricing');
  const canViewPurchase = hasPermission('view_purchase_pricing');

  const fetchQueue = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    
    try {
      if (!currentUser?.role) return;
      
      const data = await getPendingApprovalsForCurrentUser(currentUser.role);
      
      // Get total stages for each request to show "Stage X of Y"
      const requestIds = [...new Set(data.map(a => a.request_id))];
      const { data: stagesCount } = await supabase
        .from('item_approval_instances')
        .select('request_id, id')
        .in('request_id', requestIds)
        .neq('status', 'SUPERSEDED');

      const stageMap: Record<string, number> = {};
      stagesCount?.forEach(s => {
        stageMap[s.request_id] = (stageMap[s.request_id] || 0) + 1;
      });

      setApprovals(data.map(a => ({
        ...a,
        total_stages: stageMap[a.request_id] || 0
      })) as ExtendedApprovalInstance[]);

      // Fetch Metrics
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const { data: decisionsToday } = await supabase
        .from('item_approval_decisions')
        .select('decision')
        .gte('decided_at', todayISO)
        .eq('decided_by', currentUser.id);

      const approvedToday = decisionsToday?.filter(d => d.decision === 'APPROVED').length || 0;
      const rejectedToday = decisionsToday?.filter(d => d.decision === 'REJECTED').length || 0;

      setMetrics({
        pending: data.length,
        breached: data.filter(a => a.sla_breached).length,
        approvedToday,
        rejectedToday
      });

      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch approval queue:', err);
      setError(err.message || 'Failed to load approvals');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentUser]);

  const runSlaCheck = useCallback(async () => {
    try {
      await checkAndMarkSlaBreaches();
      await fetchQueue(true);
    } catch (err) {
      console.error('SLA check failed:', err);
    }
  }, [fetchQueue]);

  useEffect(() => {
    if (canApprove) {
      fetchQueue();
      runSlaCheck();
      
      const queueInterval = setInterval(() => fetchQueue(true), 30000); // 30s refresh
      const slaInterval = setInterval(runSlaCheck, 300000); // 5m SLA check
      
      return () => {
        clearInterval(queueInterval);
        clearInterval(slaInterval);
      };
    }
  }, [canApprove, fetchQueue, runSlaCheck]);

  const handleDecision = async () => {
    if (!decisionForm || comment.trim().length < 10) return;
    
    setIsSubmitting(true);
    setError(null);
    try {
      await recordApprovalDecision({
        instanceId: decisionForm.instanceId,
        decision: decisionForm.decision,
        comments: comment
      });
      
      setDecisionForm(null);
      setComment('');
      await fetchQueue(true);
    } catch (err: any) {
      setError(err.message || 'Failed to record decision');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render Parts ────────────────────────────────────────────────────────────

  if (!canApprove) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-6">
          <XCircle size={40} />
        </div>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Access Denied</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md">
          You do not have the <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-sm">approve_item_requests</code> permission required to view this queue.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12 animate-page-entry">
      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pending Approvals', value: metrics.pending, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'SLA Breached', value: metrics.breached, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: 'Approved Today', value: metrics.approvedToday, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Rejected Today', value: metrics.rejectedToday, icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
        ].map((m, idx) => (
          <div key={idx} className={`p-5 rounded-2xl border border-gray-100 dark:border-white/5 bg-white dark:bg-nocturne shadow-sm flex items-center gap-4`}>
            <div className={`w-12 h-12 rounded-xl ${m.bg} ${m.color} flex items-center justify-center shrink-0`}>
              <m.icon size={24} />
            </div>
            <div>
              <div className="text-2xl font-black text-gray-900 dark:text-white">{m.value}</div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
            Work Queue
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-bold text-gray-500">
              {approvals.length}
            </span>
          </h3>
          <button 
            onClick={() => fetchQueue(false)} 
            disabled={isRefreshing}
            className="flex items-center gap-2 text-xs font-bold text-[var(--color-brand)] hover:opacity-80 transition-opacity"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh Queue
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center gap-3 text-sm text-red-600 dark:text-red-400">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-100 dark:bg-white/5 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : approvals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-nocturne rounded-3xl border border-dashed border-gray-200 dark:border-white/10 text-center">
            <ClipboardCheck size={48} className="text-gray-200 dark:text-gray-700 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">No approvals awaiting your action</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-center">Take a break, you're all caught up!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {approvals.map(approval => (
              <ApprovalCard 
                key={approval.id} 
                approval={approval}
                isExpanded={expandedId === approval.id}
                onToggleExpand={() => setExpandedId(expandedId === approval.id ? null : approval.id)}
                onStartDecision={(decision) => {
                  setDecisionForm({ instanceId: approval.id, decision });
                  setComment('');
                }}
                isDeciding={decisionForm?.instanceId === approval.id}
                decisionType={decisionForm?.instanceId === approval.id ? decisionForm.decision : null}
                onCancelDecision={() => setDecisionForm(null)}
                onConfirmDecision={handleDecision}
                comment={comment}
                setComment={setComment}
                isSubmitting={isSubmitting}
                canViewSell={canViewSell}
                canViewPurchase={canViewPurchase}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Approval Card Sub-component ──────────────────────────────────────────────

function ApprovalCard({ 
  approval, 
  isExpanded, 
  onToggleExpand,
  onStartDecision,
  isDeciding,
  decisionType,
  onCancelDecision,
  onConfirmDecision,
  comment,
  setComment,
  isSubmitting,
  canViewSell,
  canViewPurchase
}: { 
  approval: ExtendedApprovalInstance;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStartDecision: (decision: 'APPROVED' | 'REJECTED') => void;
  isDeciding: boolean;
  decisionType: 'APPROVED' | 'REJECTED' | null;
  onCancelDecision: () => void;
  onConfirmDecision: () => void;
  comment: string;
  setComment: (c: string) => void;
  isSubmitting: boolean;
  canViewSell: boolean;
  canViewPurchase: boolean;
}) {
  return (
    <div className={`bg-white dark:bg-nocturne rounded-2xl border transition-all duration-300 ${isExpanded ? 'border-[var(--color-brand)] shadow-lg' : 'border-gray-100 dark:border-white/5 hover:border-gray-200 dark:hover:border-white/10 shadow-sm'}`}>
      <div className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-xs font-bold text-gray-400 tracking-wider">
                {approval.item_requests.request_number}
              </span>
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-[10px] font-black text-gray-500 uppercase">
                Stage {approval.stage_order} of {approval.total_stages || '?'}
              </span>
            </div>
            <h4 className="text-base font-black text-gray-900 dark:text-white truncate">
              {approval.item_requests.proposed_description}
            </h4>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">
              Rule: <span className="text-[var(--color-brand)]">{approval.rule_name}</span>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            <SlaBadge deadline={approval.sla_deadline} breached={approval.sla_breached} />
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onStartDecision('APPROVED')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm shadow-emerald-600/20"
              >
                Approve
              </button>
              <Link
                to={`/items/requests/${approval.request_id}/approve`}
                className="px-4 py-2 bg-[var(--color-brand)] hover:opacity-90 text-white rounded-xl text-xs font-bold transition-colors shadow-sm shadow-[var(--color-brand)]/20 flex items-center gap-1.5"
              >
                <Eye size={14} />
                Review
              </Link>
              <button 
                onClick={() => onStartDecision('REJECTED')}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm shadow-rose-600/20"
              >
                Reject
              </button>
              <button 
                onClick={onToggleExpand}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
              >
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Decision Form (Inline) */}
        {isDeciding && (
          <div className="mt-6 p-4 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 animate-slide-up">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
              Comments (required — minimum 10 characters)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={`Provide a reason for ${decisionType?.toLowerCase()}...`}
              className="w-full h-24 p-3 bg-white dark:bg-[#15171e] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none transition-all resize-none"
            />
            <div className="flex items-center justify-between mt-3">
              <span className={`text-[10px] font-bold ${comment.length < 10 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {comment.length} characters (min 10)
              </span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={onCancelDecision}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={onConfirmDecision}
                  disabled={comment.length < 10 || isSubmitting}
                  className={`px-5 py-2 rounded-xl text-xs font-black text-white transition-all ${
                    decisionType === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw size={14} className="animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    `Confirm ${decisionType === 'APPROVED' ? 'Approval' : 'Rejection'}`
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Expanded View */}
        {isExpanded && (
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-white/5 space-y-6 animate-slide-down">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Item Info</h5>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Request Type</span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{approval.item_requests.request_type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Item Group</span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{approval.item_requests.item_group || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Department</span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{approval.item_requests.department || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Division</span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{approval.item_requests.division || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {(canViewSell || canViewPurchase) && (
                <div>
                  <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Financials</h5>
                  <div className="space-y-3">
                    {canViewSell && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Sell Price (Ex GST)</span>
                          <span className="text-xs font-bold text-emerald-600">Pending Review</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Proposed Margin</span>
                          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                            <TrendingUp size={12} />
                            --%
                          </span>
                        </div>
                      </>
                    )}
                    {canViewPurchase && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Cost Basis (Landed)</span>
                        <span className="text-xs font-bold text-amber-600">--</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Workflow</h5>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Target Systems</span>
                    <div className="flex gap-1">
                      {approval.item_requests.purchase_enabled && <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-[10px] font-black rounded">SAP</span>}
                      {approval.item_requests.sale_enabled && <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 text-[10px] font-black rounded">BUNDLE</span>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Effective Date</span>
                    <span className="text-xs font-bold text-[var(--color-brand)]">
                      {approval.item_requests.required_activation_date 
                        ? new Date(approval.item_requests.required_activation_date).toLocaleDateString()
                        : 'ASAP'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Link 
                to={`/items/requests/${approval.request_id}/approve`}
                className="flex items-center gap-2 text-xs font-bold text-[var(--color-brand)] hover:underline"
              >
                Open Approval Wizard
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
