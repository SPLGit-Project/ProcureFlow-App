import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, CheckCircle2, Package, 
  Link as LinkIcon, ClipboardList, 
  ChevronRight, Sparkles, Layers,
  DollarSign, FileText, ShieldCheck,
  Link2, ShoppingCart, Truck, CheckCheck,
  Search, Filter, X, Eye, AlertCircle,
  Building2, Calendar, User, Check,
  Clock, ExternalLink, AlertTriangle, RefreshCw
} from 'lucide-react';
import { ItemRequest, PORequest, POLineItem, POStatus, ApprovalEvent, DeliveryHeader } from '../types';
import { useApp } from '../context/AppContext';
import PageHeader from './PageHeader';
import DeliveryModal from './DeliveryModal';
import {
  getMyItemRequests,
  getRequestsForMasterData,
  getRequestsForPricing,
} from '../services/itemRequestService';
import { getSessionLaundryInsight } from '../constants/linenFacts';
import { formatCurrency } from '../utils/taxCalculations';

// ── Lifecycle Stage Configuration ─────────────────────────────────────────────

export interface LifecycleStageConfig {
  num: number;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  badgeClass: string;
  bgLightClass: string;
  textClass: string;
  borderClass: string;
  ringClass: string;
  description: string;
}

export const LIFECYCLE_STAGES: LifecycleStageConfig[] = [
  {
    num: 1,
    label: 'Requested',
    shortLabel: 'Req',
    icon: FileText,
    color: 'amber',
    badgeClass: 'bg-amber-500 text-white',
    bgLightClass: 'bg-amber-50 dark:bg-amber-950/30',
    textClass: 'text-amber-700 dark:text-amber-300',
    borderClass: 'border-amber-200 dark:border-amber-800/40',
    ringClass: 'ring-amber-500/20',
    description: 'Request submitted & awaiting financial approval decision.'
  },
  {
    num: 2,
    label: 'Approved',
    shortLabel: 'Appr',
    icon: ShieldCheck,
    color: 'sky',
    badgeClass: 'bg-sky-500 text-white',
    bgLightClass: 'bg-sky-50 dark:bg-sky-950/30',
    textClass: 'text-sky-700 dark:text-sky-300',
    borderClass: 'border-sky-200 dark:border-sky-800/40',
    ringClass: 'ring-sky-500/20',
    description: 'Financial approval granted. Next step: Log Concur Request #.'
  },
  {
    num: 3,
    label: 'Req. Logged',
    shortLabel: 'Logged',
    icon: Link2,
    color: 'indigo',
    badgeClass: 'bg-indigo-500 text-white',
    bgLightClass: 'bg-indigo-50 dark:bg-indigo-950/30',
    textClass: 'text-indigo-700 dark:text-indigo-300',
    borderClass: 'border-indigo-200 dark:border-indigo-800/40',
    ringClass: 'ring-indigo-500/20',
    description: 'Concur Request logged. Next step: Link Concur PO #.'
  },
  {
    num: 4,
    label: 'In Concur',
    shortLabel: 'Concur',
    icon: ShoppingCart,
    color: 'blue',
    badgeClass: 'bg-blue-600 text-white',
    bgLightClass: 'bg-blue-50 dark:bg-blue-950/30',
    textClass: 'text-blue-700 dark:text-blue-300',
    borderClass: 'border-blue-200 dark:border-blue-800/40',
    ringClass: 'ring-blue-500/20',
    description: 'PO generated in Concur & active. Next step: Initial delivery receipting.'
  },
  {
    num: 5,
    label: 'Delivery',
    shortLabel: 'Delivery',
    icon: Truck,
    color: 'emerald',
    badgeClass: 'bg-emerald-500 text-white',
    bgLightClass: 'bg-emerald-50 dark:bg-emerald-950/30',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-200 dark:border-emerald-800/40',
    ringClass: 'ring-emerald-500/20',
    description: 'Partially delivered or active. Next step: Receive remaining goods or close PO.'
  },
  {
    num: 6,
    label: 'Complete',
    shortLabel: 'Closed',
    icon: CheckCheck,
    color: 'slate',
    badgeClass: 'bg-slate-600 text-white',
    bgLightClass: 'bg-slate-50 dark:bg-slate-900/30',
    textClass: 'text-slate-700 dark:text-slate-300',
    borderClass: 'border-slate-200 dark:border-slate-800/40',
    ringClass: 'ring-slate-500/20',
    description: 'All goods fully received and order archived.'
  },
];

// Helper to determine stage number and next step metadata
export function getPOStageInfo(po: PORequest, currentUser: any, hasPermission: (perm: string) => boolean) {
  let stageNum = 1;
  let nextActionTitle = 'Review & Approve';
  let nextActionDesc = 'Financial approval required to proceed.';
  let actionType: 'APPROVE' | 'CONCUR_REQ' | 'CONCUR_PO' | 'DELIVERY' | 'QUICK_VIEW' = 'APPROVE';
  let canAction = false;

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.roleIds?.includes('ADMIN');
  const isApprover = currentUser?.role === 'APPROVER' || currentUser?.roleIds?.includes('APPROVER') || hasPermission('approve_requests');
  const canLinkConcur = hasPermission('link_concur');
  const isRequester = po.requesterId === currentUser?.id;

  if (po.status === 'PENDING_APPROVAL' || po.status === 'DRAFT') {
    stageNum = 1;
    nextActionTitle = 'Approve / Reject Request';
    nextActionDesc = 'Awaiting financial approver review & decision.';
    actionType = 'APPROVE';
    canAction = isApprover || isAdmin;
  } else if (po.status === 'APPROVED_PENDING_CONCUR_REQUEST') {
    stageNum = 2;
    nextActionTitle = 'Log Concur Request #';
    nextActionDesc = 'Enter Concur Request ID to track in ERP.';
    actionType = 'CONCUR_REQ';
    canAction = isRequester || canLinkConcur || isAdmin;
  } else if (po.status === 'APPROVED_PENDING_CONCUR') {
    stageNum = 3;
    nextActionTitle = 'Link Concur PO #';
    nextActionDesc = 'Attach finalized Concur PO number to activate order.';
    actionType = 'CONCUR_PO';
    canAction = canLinkConcur || isAdmin;
  } else if (po.status === 'ACTIVE') {
    stageNum = 4;
    nextActionTitle = 'Record Goods Receipt';
    nextActionDesc = 'Log supplier delivery docket & received quantities.';
    actionType = 'DELIVERY';
    canAction = true;
  } else if (po.status === 'RECEIVED' || po.status === 'VARIANCE_PENDING') {
    stageNum = 5;
    const remaining = po.lines.reduce((acc, line) => acc + Math.max(0, line.quantityOrdered - (line.quantityReceived || 0)), 0);
    nextActionTitle = remaining > 0 ? 'Receive Remaining Goods' : 'Reconcile & Close';
    nextActionDesc = remaining > 0 ? `${remaining.toLocaleString()} units remaining across order lines.` : 'All lines delivered.';
    actionType = 'DELIVERY';
    canAction = true;
  } else if (po.status === 'CLOSED') {
    stageNum = 6;
    nextActionTitle = 'Order Completed';
    nextActionDesc = 'Fully receipted & reconciled.';
    actionType = 'QUICK_VIEW';
    canAction = false;
  } else if (po.status === 'REJECTED') {
    stageNum = 1;
    nextActionTitle = 'Request Rejected';
    nextActionDesc = 'Rejected during approval review.';
    actionType = 'QUICK_VIEW';
    canAction = false;
  }

  const stageConfig = LIFECYCLE_STAGES[stageNum - 1] || LIFECYCLE_STAGES[0];

  return {
    stageNum,
    stageConfig,
    nextActionTitle,
    nextActionDesc,
    actionType,
    canAction
  };
}

interface HomeInsightState {
  isLoading: boolean;
  hasPartialError: boolean;
  myItemRequests: ItemRequest[];
  masterDataRequests: ItemRequest[];
  pricingRequests: ItemRequest[];
}

interface ActionTask {
  id: string;
  title: string;
  count: number;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  path?: string;
  tabKey?: string;
  bgClass: string;
  textClass: string;
  badgeClass: string;
  borderHoverClass: string;
}

const greetingOptions = [
  'Good day, {first_name}. Your workspace is focused.',
  'Welcome back, {first_name}. Your next move is ready.',
  '{first_name}, ProcureFlow has prioritised the work that matters.',
  'Good to see you, {first_name}. Start with the signal that creates flow.',
  '{first_name}, your command view is tuned for {site_label}.',
];

const getDayIndex = (seed: string, length: number) => {
  if (length <= 0) return 0;
  const today = new Date();
  const daySeed = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}-${seed}`;
  let hash = 0;
  for (let index = 0; index < daySeed.length; index += 1) {
    hash = (hash * 31 + daySeed.charCodeAt(index)) % 2147483647;
  }
  return hash % length;
};

const applyTemplate = (
  value: string,
  replacements: Record<string, string>
) => Object.entries(replacements).reduce(
  (text, [token, replacement]) => text.replace(new RegExp(`{${token}}`, 'g'), replacement),
  value
);

function useHomeInsights() {
  const { currentUser, hasPermission } = useApp();
  const [state, setState] = useState<HomeInsightState>({
    isLoading: true,
    hasPartialError: false,
    myItemRequests: [],
    masterDataRequests: [],
    pricingRequests: [],
  });

  React.useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!currentUser) return;
      setState(prev => ({ ...prev, isLoading: true, hasPartialError: false }));

      const [myItems, masterData, pricing] = await Promise.allSettled([
        getMyItemRequests(currentUser.id),
        hasPermission('manage_item_definition') ? getRequestsForMasterData() : Promise.resolve([] as ItemRequest[]),
        hasPermission('manage_sell_pricing') || hasPermission('manage_purchase_pricing')
          ? getRequestsForPricing()
          : Promise.resolve([] as ItemRequest[]),
      ]);

      if (!isMounted) return;

      setState({
        isLoading: false,
        hasPartialError: [myItems, masterData, pricing].some(result => result.status === 'rejected'),
        myItemRequests: myItems.status === 'fulfilled' ? myItems.value : [],
        masterDataRequests: masterData.status === 'fulfilled' ? masterData.value : [],
        pricingRequests: pricing.status === 'fulfilled' ? pricing.value : [],
      });
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [currentUser, hasPermission]);

  return state;
}

export default function Home() {
  const {
    currentUser,
    pos,
    hasPermission,
    activeSiteIds,
    siteName,
    branding,
    updatePOStatus,
    linkConcurRequest,
    linkConcurPO,
    addDelivery
  } = useApp();
  const navigate = useNavigate();
  const insights = useHomeInsights();
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.roleIds?.includes('ADMIN');
  const isApprover = currentUser?.role === 'APPROVER' || currentUser?.roleIds?.includes('APPROVER') || hasPermission('approve_requests');
  const canLinkConcur = hasPermission('link_concur');

  // Next-Action Command Center state
  const [actionTab, setActionTab] = useState<'ALL' | 'APPROVALS' | 'CONCUR' | 'DELIVERIES' | 'MY_REQUESTS'>('ALL');
  const [actionSearch, setActionSearch] = useState('');
  const [activeModal, setActiveModal] = useState<{
    type: 'APPROVE' | 'CONCUR_REQ' | 'CONCUR_PO' | 'DELIVERY' | 'QUICK_VIEW';
    po: PORequest;
  } | null>(null);

  // Approval modal state
  const [approvalComment, setApprovalComment] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Concur request modal state
  const [concurReqInput, setConcurReqInput] = useState('');

  // Concur PO modal state
  const [concurPoInput, setConcurPoInput] = useState('');

  // Summary groupings
  const pendingApprovals = useMemo(() => 
    pos.filter(p => p.status === 'PENDING_APPROVAL' && (activeSiteIds.length === 0 || activeSiteIds.includes(p.siteId))),
    [pos, activeSiteIds]
  );

  const pendingConcur = useMemo(() => 
    pos.filter(p => (p.status === 'APPROVED_PENDING_CONCUR' || p.status === 'APPROVED_PENDING_CONCUR_REQUEST') && (activeSiteIds.length === 0 || activeSiteIds.includes(p.siteId))),
    [pos, activeSiteIds]
  );

  const activeOrders = useMemo(() => 
    pos.filter(p => (p.status === 'ACTIVE' || p.status === 'RECEIVED') && (activeSiteIds.length === 0 || activeSiteIds.includes(p.siteId))),
    [pos, activeSiteIds]
  );

  const myPendingApprovals = useMemo(() => 
    isApprover || isAdmin ? pendingApprovals : [], 
    [isAdmin, isApprover, pendingApprovals]
  );

  const globalPendingConcur = useMemo(() => 
    canLinkConcur || isAdmin ? pendingConcur : [], 
    [canLinkConcur, isAdmin, pendingConcur]
  );

  const myPendingConcurSync = useMemo(() => 
    pendingConcur.filter(p => p.requesterId === currentUser?.id && !canLinkConcur && !isAdmin), 
    [pendingConcur, currentUser, canLinkConcur, isAdmin]
  );

  const actionConcur = useMemo(() => 
    globalPendingConcur.length > 0 ? globalPendingConcur : myPendingConcurSync, 
    [globalPendingConcur, myPendingConcurSync]
  );

  const myPendingDeliveries = useMemo(() => activeOrders.filter(p => {
    if (isAdmin) return true;
    if (p.requesterId !== currentUser?.id) return false;
    const remaining = p.lines.reduce((acc, line) => acc + (line.quantityOrdered - (line.quantityReceived || 0)), 0);
    return remaining > 0;
  }), [currentUser, isAdmin, activeOrders]);

  const masterDataQueueCount = useMemo(() => 
    hasPermission('manage_item_definition') 
      ? insights.masterDataRequests.filter(r => ['SUBMITTED', 'DUPLICATE_REVIEW', 'PROCUREMENT_REVIEW', 'DATA_REVIEW'].includes(r.status)).length 
      : 0,
    [hasPermission, insights.masterDataRequests]
  );

  const pricingQueueCount = useMemo(() => 
    (hasPermission('manage_sell_pricing') || hasPermission('manage_purchase_pricing')) 
      ? insights.pricingRequests.length 
      : 0,
    [hasPermission, insights.pricingRequests]
  );

  const tasks = useMemo<ActionTask[]>(() => {
    const t: ActionTask[] = [];
    
    if (myPendingApprovals.length > 0) {
      t.push({
        id: 'approvals',
        title: 'Pending Approvals',
        count: myPendingApprovals.length,
        desc: 'Review and approve or reject purchase requests.',
        icon: CheckCircle2,
        color: 'amber',
        tabKey: 'APPROVALS',
        bgClass: 'bg-amber-500/10 dark:bg-amber-500/15',
        textClass: 'text-amber-600 dark:text-amber-400',
        badgeClass: 'bg-amber-500',
        borderHoverClass: 'hover:border-amber-500/40',
      });
    }

    if (actionConcur.length > 0) {
      t.push({
        id: 'concur',
        title: 'Concur Linkage',
        count: actionConcur.length,
        desc: 'Link approved requests to Concur PO numbers.',
        icon: LinkIcon,
        color: 'blue',
        tabKey: 'CONCUR',
        bgClass: 'bg-blue-500/10 dark:bg-blue-500/15',
        textClass: 'text-blue-600 dark:text-blue-400',
        badgeClass: 'bg-blue-500',
        borderHoverClass: 'hover:border-blue-500/40',
      });
    }

    if (myPendingDeliveries.length > 0) {
      t.push({
        id: 'deliveries',
        title: 'Pending Deliveries',
        count: myPendingDeliveries.length,
        desc: 'Confirm receipt of goods for active purchase orders.',
        icon: Package,
        color: 'emerald',
        tabKey: 'DELIVERIES',
        bgClass: 'bg-emerald-500/10 dark:bg-emerald-500/15',
        textClass: 'text-emerald-600 dark:text-emerald-400',
        badgeClass: 'bg-emerald-500',
        borderHoverClass: 'hover:border-emerald-500/40',
      });
    }

    if (masterDataQueueCount > 0) {
      t.push({
        id: 'master-data',
        title: 'Master Data Setup',
        count: masterDataQueueCount,
        desc: 'Catalog lifecycle items pending master data review.',
        icon: Layers,
        color: 'purple',
        path: '/items/master-data-queue',
        bgClass: 'bg-purple-500/10 dark:bg-purple-500/15',
        textClass: 'text-purple-600 dark:text-purple-400',
        badgeClass: 'bg-purple-500',
        borderHoverClass: 'hover:border-purple-500/40',
      });
    }

    if (pricingQueueCount > 0) {
      t.push({
        id: 'pricing-queue',
        title: 'Pricing Review Queue',
        count: pricingQueueCount,
        desc: 'Item requests awaiting pricing configuration and review.',
        icon: DollarSign,
        color: 'green',
        path: '/items/pricing-queue',
        bgClass: 'bg-green-500/10 dark:bg-green-500/15',
        textClass: 'text-green-600 dark:text-green-400',
        badgeClass: 'bg-green-500',
        borderHoverClass: 'hover:border-green-500/40',
      });
    }

    return t;
  }, [myPendingApprovals, actionConcur, myPendingDeliveries, masterDataQueueCount, pricingQueueCount]);

  // Actionable Requests Worklist
  const actionablePOs = useMemo(() => {
    return pos
      .filter((p) => {
        // Site filter
        if (activeSiteIds.length > 0 && !activeSiteIds.includes(p.siteId)) return false;

        // Exclude closed or rejected unless explicitly viewing
        if (p.status === 'CLOSED' || p.status === 'REJECTED') return false;

        // Tab filtering
        if (actionTab === 'APPROVALS') {
          return p.status === 'PENDING_APPROVAL';
        }
        if (actionTab === 'CONCUR') {
          return p.status === 'APPROVED_PENDING_CONCUR_REQUEST' || p.status === 'APPROVED_PENDING_CONCUR';
        }
        if (actionTab === 'DELIVERIES') {
          return p.status === 'ACTIVE' || p.status === 'RECEIVED' || p.status === 'VARIANCE_PENDING';
        }
        if (actionTab === 'MY_REQUESTS') {
          return p.requesterId === currentUser?.id;
        }

        // 'ALL' tab: show requests relevant to current user role / permissions
        if (isAdmin) return true;
        if (p.requesterId === currentUser?.id) return true;
        if (isApprover && p.status === 'PENDING_APPROVAL') return true;
        if (canLinkConcur && (p.status === 'APPROVED_PENDING_CONCUR' || p.status === 'APPROVED_PENDING_CONCUR_REQUEST')) return true;

        return p.status === 'ACTIVE' || p.status === 'RECEIVED';
      })
      .filter((p) => {
        if (!actionSearch.trim()) return true;
        const q = actionSearch.toLowerCase();
        return (
          (p.displayId || '').toLowerCase().includes(q) ||
          (p.concurPoNumber || '').toLowerCase().includes(q) ||
          (p.concurRequestNumber || '').toLowerCase().includes(q) ||
          (p.supplierName || '').toLowerCase().includes(q) ||
          (p.site || '').toLowerCase().includes(q) ||
          (p.customerName || '').toLowerCase().includes(q) ||
          (p.requesterName || '').toLowerCase().includes(q) ||
          p.lines.some((l) => (l.itemName || '').toLowerCase().includes(q) || (l.sku || '').toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
  }, [pos, activeSiteIds, actionTab, actionSearch, isAdmin, isApprover, canLinkConcur, currentUser]);

  const approvedTodayCount = useMemo(() => {
    return pos.filter(p => {
      if (activeSiteIds.length > 0 && !activeSiteIds.includes(p.siteId)) return false;
      const h = p.approvalHistory.find(hist => hist.action === 'APPROVED');
      return h && new Date(h.date).toDateString() === new Date().toDateString();
    }).length;
  }, [pos, activeSiteIds]);

  const activeSpendsK = useMemo(() => {
    const total = pos
      .filter(p => p.status === 'ACTIVE' && (activeSiteIds.length === 0 || activeSiteIds.includes(p.siteId)))
      .reduce((sum, p) => sum + p.totalAmount, 0);
    return Math.round(total / 1000);
  }, [pos, activeSiteIds]);

  const firstName = currentUser?.name?.split(' ')[0] || 'there';
  const fullName = currentUser?.name || firstName;
  const siteLabel = activeSiteIds.length === 0
    ? 'no active site selected'
    : activeSiteIds.length === 1
      ? siteName(activeSiteIds[0])
      : `${activeSiteIds.length} active sites`;
  const homeExperience = branding.homeExperience;
  const templateValues = {
    first_name: firstName,
    name: fullName,
    site_label: siteLabel,
    app_name: branding.appName || 'ProcureFlow',
  };
  const greetingTemplate = homeExperience?.greetingMode === 'custom' && homeExperience.greetingText?.trim()
    ? homeExperience.greetingText
    : greetingOptions[getDayIndex(currentUser?.id || firstName, greetingOptions.length)];
  const messageType = homeExperience?.messageType || 'quote';
  const laundryInsight = useMemo(() => getSessionLaundryInsight(), [currentUser?.id]);
  const isCustomOrAnnouncement = messageType === 'announcement' || (homeExperience?.quoteMode === 'custom' && Boolean(homeExperience.quoteText?.trim()));
  const customMessage = messageType === 'announcement'
    ? (homeExperience?.quoteText?.trim() || 'No announcement is currently active.')
    : (homeExperience?.quoteText?.trim() || '');
  const greeting = applyTemplate(greetingTemplate, templateValues);
  const dailyMessage = applyTemplate(customMessage, templateValues);
  const dailyMessageLabel = messageType === 'announcement' ? 'Announcement' : 'Laundry Insights';

  const totalActionItemCount = tasks.reduce((sum, t) => sum + t.count, 0);

  // ── Inline Action Handlers ──────────────────────────────────────────────────

  const handleOpenActionModal = (po: PORequest) => {
    const stageInfo = getPOStageInfo(po, currentUser, hasPermission);
    setApprovalComment('');
    setConcurReqInput(po.concurRequestNumber || '');
    setConcurPoInput(po.concurPoNumber || '');
    setActiveModal({ type: stageInfo.actionType, po });
  };

  const handleExecuteApproval = async (approved: boolean) => {
    if (!activeModal?.po) return;
    setIsSubmittingAction(true);
    try {
      const event: ApprovalEvent = {
        id: `ev-${Date.now()}`,
        action: approved ? 'APPROVED' : 'REJECTED',
        approverName: currentUser?.name || 'Approver',
        date: new Date().toISOString().split('T')[0],
        comments: approvalComment.trim() || (approved ? 'Approved via Home Action Center' : 'Rejected via Home Action Center')
      };
      await updatePOStatus(activeModal.po.id, approved ? 'APPROVED_PENDING_CONCUR_REQUEST' : 'REJECTED', event);
      setActiveModal(null);
    } catch (err: any) {
      alert(`Approval action failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleExecuteConcurReq = async (skip = false) => {
    if (!activeModal?.po) return;
    setIsSubmittingAction(true);
    try {
      if (skip) {
        const event: ApprovalEvent = {
          id: `ev-${Date.now()}`,
          action: 'ADMIN_OVERRIDE',
          approverName: currentUser?.name || 'System',
          date: new Date().toISOString().split('T')[0],
          comments: 'Concur Request step skipped'
        };
        await updatePOStatus(activeModal.po.id, 'APPROVED_PENDING_CONCUR', event);
      } else {
        if (!concurReqInput.trim()) {
          alert('Please enter a valid Concur Request Number.');
          setIsSubmittingAction(false);
          return;
        }
        await linkConcurRequest(activeModal.po.id, concurReqInput.trim());
      }
      setActiveModal(null);
    } catch (err: any) {
      alert(`Failed to save Concur Request: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleExecuteConcurPO = async () => {
    if (!activeModal?.po) return;
    if (!concurPoInput.trim()) {
      alert('Please enter a valid Concur PO Number.');
      return;
    }
    setIsSubmittingAction(true);
    try {
      await linkConcurPO(activeModal.po.id, concurPoInput.trim());
      setActiveModal(null);
    } catch (err: any) {
      alert(`Failed to link Concur PO: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-7.25rem)] max-w-7xl flex-col gap-6 overflow-hidden animate-page-entry pb-12">
      <PageHeader title="Home" subtitle="Workspace" />

      {/* Top Welcome Header & Insight Banner */}
      <section className="relative flex-1 overflow-hidden rounded-[1.75rem] border border-transparent bg-transparent text-gray-950 shadow-none dark:border-white/10 dark:bg-nocturne dark:text-white dark:shadow-2xl">
        <div className="relative flex flex-col gap-6 p-4 sm:p-5 lg:p-6">
          
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-black leading-tight text-gray-950 md:text-4xl xl:text-[2.85rem] dark:text-white">
                {greeting}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium">
                Track open procurement requests across all 6 lifecycle stages and take direct action without leaving your dashboard.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200/80 bg-white/85 px-4 py-3 shadow-[0_14px_35px_rgba(15,23,42,0.08)] lg:w-[360px] dark:border-white/10 dark:bg-[#15171e] dark:shadow-none shrink-0">
              <div className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-tranquil" />
                <p className="text-[10px] font-black uppercase tracking-widest text-tranquil">{dailyMessageLabel}</p>
              </div>
              {isCustomOrAnnouncement ? (
                <p className="mt-2 text-sm font-semibold leading-6 text-gray-700 dark:text-white/70">{dailyMessage}</p>
              ) : (
                <div className="mt-2 space-y-1.5 text-xs">
                  <p className="font-bold leading-snug text-gray-900 dark:text-white">
                    <span className="mr-1.5 font-black text-tranquil">Q:</span>
                    {laundryInsight.question}
                  </p>
                  <p className="font-medium leading-relaxed text-gray-600 dark:text-white/70">
                    <span className="mr-1.5 font-black text-tranquil">A:</span>
                    {laundryInsight.answer}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 6 Dedicated Stage Legend Bar */}
          <div className="rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white/70 dark:bg-[#15171e]/70 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <Layers size={13} className="text-tranquil" />
                6-Stage Procurement Flow
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 hidden sm:inline">
                Hover or click any stage to understand required operations
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {LIFECYCLE_STAGES.map((stage) => {
                const IconComp = stage.icon;
                return (
                  <div
                    key={stage.num}
                    className={`flex items-center gap-2 p-2 rounded-xl border ${stage.borderClass} ${stage.bgLightClass} transition-all`}
                    title={`Stage ${stage.num} - ${stage.label}: ${stage.description}`}
                  >
                    <div className={`w-6 h-6 rounded-lg ${stage.badgeClass} flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs`}>
                      <IconComp size={13} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-gray-900 dark:text-white truncate">
                        {stage.num}. {stage.label}
                      </p>
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 truncate">
                        {stage.shortLabel}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Center Overview Summary Cards */}
          <div className="border-t border-gray-200/70 pt-5 dark:border-white/10">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-tranquil/10 flex items-center justify-center text-tranquil border border-tranquil/20 shadow-sm">
                  <ClipboardList size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-tranquil">Action Center</p>
                  <h2 className="text-lg font-black leading-tight text-gray-950 sm:text-xl dark:text-white">Active Tasks &amp; Operations</h2>
                </div>
              </div>
              <span className={`text-xs font-black px-3 py-1 rounded-full shadow-sm ${
                totalActionItemCount > 0 
                  ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20' 
                  : 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20'
              }`}>
                {totalActionItemCount > 0 ? `${totalActionItemCount} Action Items` : 'All Clear'}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
              {/* Task Counters */}
              <div className="lg:col-span-2 space-y-3.5">
                {tasks.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => {
                          if (task.tabKey) setActionTab(task.tabKey as any);
                          else if (task.path) navigate(task.path);
                        }}
                        className={`group p-4 rounded-2xl border border-gray-200/80 bg-white hover:shadow-lg ${task.borderHoverClass} transition-all duration-200 cursor-pointer relative overflow-hidden dark:border-white/10 dark:bg-[#15171e]`}
                      >
                        <div className="flex items-start gap-3.5">
                          <div className={`p-3 rounded-xl ${task.bgClass} ${task.textClass} shrink-0 border border-current/10`}>
                            <task.icon size={22} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">{task.title}</h3>
                              <span className={`px-2.5 py-0.5 rounded-full ${task.badgeClass} text-white text-[11px] font-black shrink-0 shadow-sm`}>
                                {task.count}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">
                              {task.desc}
                            </p>
                          </div>
                          <div className="self-center text-gray-300 dark:text-white/20 group-hover:translate-x-1 group-hover:text-[var(--color-brand)] transition-all">
                            <ChevronRight size={18} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 px-6 flex flex-col items-center justify-center text-center bg-white dark:bg-[#15171e] rounded-2xl border border-dashed border-gray-200 dark:border-white/10 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-2 shadow-inner">
                      <CheckCircle2 size={24} />
                    </div>
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white">All Caught Up!</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">No pending tasks require your immediate action.</p>
                  </div>
                )}
              </div>

              {/* Summary KPIs & Quick Links */}
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-white border border-gray-200/80 dark:bg-[#15171e] dark:border-white/10 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Approved Today</p>
                    <p className="text-2xl font-black text-gray-950 dark:text-white">{approvedTodayCount}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">Orders cleared</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-gray-200/80 dark:bg-[#15171e] dark:border-white/10 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Active Spends</p>
                    <p className="text-2xl font-black text-gray-950 dark:text-white">${activeSpendsK}k</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">In procurement</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-white to-gray-50/80 dark:from-[#15171e] dark:to-[#1a1d27] border border-gray-200/80 dark:border-white/10 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Quick Actions</h3>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">Direct navigation</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => navigate('/requests')}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-surface border border-default hover:border-[var(--color-brand)]/40 hover:shadow-xs transition-all group text-left"
                    >
                      <span className="text-xs font-bold text-gray-900 dark:text-white">View All Requests</span>
                      <ArrowRight size={14} className="text-gray-400 group-hover:translate-x-1 group-hover:text-[var(--color-brand)] transition-all" />
                    </button>

                    {hasPermission('create_request') && (
                      <button
                        type="button"
                        onClick={() => navigate('/create-request')}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-[var(--color-brand)] text-white rounded-xl font-bold shadow-sm hover:opacity-95 active:scale-98 transition-all text-xs"
                      >
                        Create New Request <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── NEXT STEP ACTION COMMAND CENTER ────────────────────────────────────── */}
          <div className="border-t border-gray-200/70 pt-6 dark:border-white/10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-brand)] animate-pulse" />
                  <h2 className="text-base font-black text-gray-950 dark:text-white uppercase tracking-wider">
                    Next-Step Action Worklist
                  </h2>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  See what action is required for each open request and execute it directly without navigating away.
                </p>
              </div>

              {/* Action Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {[
                  { id: 'ALL', label: 'All Actionable', count: actionablePOs.length },
                  { id: 'APPROVALS', label: 'Pending Approvals', count: myPendingApprovals.length },
                  { id: 'CONCUR', label: 'Concur Linkage', count: actionConcur.length },
                  { id: 'DELIVERIES', label: 'Deliveries', count: myPendingDeliveries.length },
                  { id: 'MY_REQUESTS', label: 'My Requests', count: pos.filter(p => p.requesterId === currentUser?.id && p.status !== 'CLOSED').length }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActionTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      actionTab === tab.id
                        ? 'bg-[var(--color-brand)] text-white shadow-xs'
                        : 'bg-white dark:bg-[#15171e] text-gray-600 dark:text-gray-400 border border-gray-200/80 dark:border-gray-800 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      actionTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Filter / Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
              <div className="relative flex-1 w-full">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by Request #, Concur PO, Supplier, Site, Item name, or SKU..."
                  value={actionSearch}
                  onChange={(e) => setActionSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-900 dark:text-white focus:border-[var(--color-brand)] outline-none transition-colors"
                />
                {actionSearch && (
                  <button
                    type="button"
                    onClick={() => setActionSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 font-medium">
                Showing {actionablePOs.length} request{actionablePOs.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Actionable Request Cards Grid */}
            {actionablePOs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {actionablePOs.map((po) => {
                  const stageInfo = getPOStageInfo(po, currentUser, hasPermission);
                  const StageIcon = stageInfo.stageConfig.icon;
                  const totalItems = po.lines.reduce((sum, l) => sum + (l.quantityOrdered || 0), 0);
                  const receivedItems = po.lines.reduce((sum, l) => sum + (l.quantityReceived || 0), 0);

                  return (
                    <div
                      key={po.id}
                      className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-3.5 group"
                    >
                      {/* Top Header: Stage Badge, Request Display ID, Site, Date */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            {/* Dedicated Stage Badge */}
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-xs ${stageInfo.stageConfig.bgLightClass} ${stageInfo.stageConfig.borderClass} ${stageInfo.stageConfig.textClass}`}>
                              <StageIcon size={14} />
                              <span>Stage {stageInfo.stageNum}: {stageInfo.stageConfig.label}</span>
                            </div>
                            <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                              {po.displayId || po.id}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-semibold text-gray-700 dark:text-gray-300">
                              {po.site || 'Site'}
                            </span>
                            <span>{new Date(po.requestDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}</span>
                          </div>
                        </div>

                        {/* Supplier, Customer / Reason, & Amount */}
                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-gray-400">Supplier</p>
                            <p className="font-bold text-gray-900 dark:text-white truncate" title={po.supplierName}>
                              {po.supplierName || 'Unknown Supplier'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-gray-400">Total Spend (Inc GST)</p>
                            <p className="font-black text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(po.totalAmountIncGst ?? po.totalAmount * 1.10)}
                            </p>
                          </div>
                          {po.customerName && (
                            <div className="col-span-2">
                              <p className="text-[10px] uppercase font-bold text-gray-400">Customer / Project</p>
                              <p className="font-medium text-gray-700 dark:text-gray-300 truncate">{po.customerName}</p>
                            </div>
                          )}
                        </div>

                        {/* 6-Stage Dedicated Lifecycle Progress Indicator */}
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-2.5 border border-gray-100 dark:border-gray-800/80 mb-3">
                          <div className="flex items-center justify-between relative">
                            <div className="absolute top-[11px] left-2 right-2 h-[2px] bg-gray-200 dark:bg-gray-800 -z-0" />
                            {LIFECYCLE_STAGES.map((st) => {
                              const isCompleted = st.num < stageInfo.stageNum;
                              const isCurrent = st.num === stageInfo.stageNum;
                              const StepIconComp = st.icon;

                              return (
                                <div key={st.num} className="flex flex-col items-center relative z-10" title={`Stage ${st.num}: ${st.label}`}>
                                  <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                      isCompleted
                                        ? 'bg-emerald-500 text-white shadow-xs'
                                        : isCurrent
                                          ? `${st.badgeClass} ring-2 ${st.ringClass} scale-110 shadow-xs`
                                          : 'bg-white dark:bg-[#15171e] text-gray-400 border border-gray-200 dark:border-gray-700'
                                    }`}
                                  >
                                    {isCompleted ? <Check size={12} /> : <StepIconComp size={11} />}
                                  </div>
                                  <span className={`text-[9px] mt-1 font-medium ${isCurrent ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-400 dark:text-gray-600'}`}>
                                    {st.shortLabel}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Next Action Required Callout Banner */}
                        <div className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${stageInfo.stageConfig.bgLightClass} ${stageInfo.stageConfig.borderClass}`}>
                          <div className={`p-1.5 rounded-lg ${stageInfo.stageConfig.badgeClass} shrink-0 shadow-2xs`}>
                            <StageIcon size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                Next Action: {stageInfo.nextActionTitle}
                              </span>
                              {po.status === 'ACTIVE' || po.status === 'RECEIVED' ? (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                  {receivedItems} / {totalItems} units
                                </span>
                              ) : null}
                            </div>
                            <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
                              {stageInfo.nextActionDesc}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Action Button Row */}
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                        {stageInfo.actionType === 'APPROVE' && (isApprover || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => handleOpenActionModal(po)}
                            className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
                          >
                            <ShieldCheck size={14} />
                            <span>Review &amp; Approve</span>
                          </button>
                        )}

                        {stageInfo.actionType === 'CONCUR_REQ' && (canLinkConcur || isAdmin || po.requesterId === currentUser?.id) && (
                          <button
                            type="button"
                            onClick={() => handleOpenActionModal(po)}
                            className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
                          >
                            <Link2 size={14} />
                            <span>Log Concur Req #</span>
                          </button>
                        )}

                        {stageInfo.actionType === 'CONCUR_PO' && (canLinkConcur || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => handleOpenActionModal(po)}
                            className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
                          >
                            <ShoppingCart size={14} />
                            <span>Link Concur PO #</span>
                          </button>
                        )}

                        {stageInfo.actionType === 'DELIVERY' && (
                          <button
                            type="button"
                            onClick={() => handleOpenActionModal(po)}
                            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
                          >
                            <Truck size={14} />
                            <span>Record Goods Receipt</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setActiveModal({ type: 'QUICK_VIEW', po })}
                          className="py-2 px-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1 shrink-0"
                          title="Quick Inspect Order Lines & Deliveries"
                        >
                          <Eye size={14} />
                          <span>Quick View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => navigate(`/requests/${po.id}`)}
                          className="p-2 text-gray-400 hover:text-[var(--color-brand)] hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors shrink-0"
                          title="Open Full Request Details Page"
                        >
                          <ExternalLink size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 px-6 flex flex-col items-center justify-center text-center bg-white dark:bg-[#15171e] rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 shadow-2xs">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-2.5">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">No Action Items Found</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
                  {actionSearch ? 'No open requests matched your search query.' : 'There are currently no open requests requiring action in this category.'}
                </p>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* ── INLINE MODALS EXECUTED DIRECTLY ON HOME SCREEN ───────────────────── */}

      {/* 1. Inline Approval / Rejection Modal */}
      {activeModal?.type === 'APPROVE' && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-nocturne rounded-2xl shadow-xl max-w-lg w-full flex flex-col max-h-[90vh] animate-slide-up border border-gray-200 dark:border-gray-800">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">Review &amp; Approve Request</h2>
                  <p className="text-xs text-gray-500 font-mono">{activeModal.po.displayId || activeModal.po.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isSubmittingAction}
                className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-[#15171e] rounded-xl border border-gray-100 dark:border-gray-800 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Supplier</span>
                  <p className="font-bold text-gray-900 dark:text-white">{activeModal.po.supplierName}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Total Spend (Inc GST)</span>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(activeModal.po.totalAmountIncGst ?? activeModal.po.totalAmount * 1.10)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Operating Site</span>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">{activeModal.po.site}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Requester</span>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">{activeModal.po.requesterName}</p>
                </div>
              </div>

              {/* Order Lines summary */}
              <div>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                  Order Items ({activeModal.po.lines.length})
                </span>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                  {activeModal.po.lines.map((line, idx) => (
                    <div key={line.id || idx} className="p-2.5 flex justify-between items-center">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-gray-900 dark:text-white truncate">{line.itemName}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{line.sku || 'No SKU'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-gray-900 dark:text-white">{line.quantityOrdered} units</span>
                        <p className="text-[10px] text-gray-500">{formatCurrency(line.totalPrice)} ex</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Approval Notes / Decision Comments
                </label>
                <textarea
                  rows={3}
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  placeholder="Optional approval or rejection remarks..."
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#15171e] text-xs text-gray-900 dark:text-white focus:border-[var(--color-brand)] outline-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2.5 bg-gray-50/50 dark:bg-[#15171e]/50">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isSubmittingAction}
                className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExecuteApproval(false)}
                disabled={isSubmittingAction}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50"
              >
                Reject Request
              </button>
              <button
                type="button"
                onClick={() => handleExecuteApproval(true)}
                disabled={isSubmittingAction}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmittingAction && <RefreshCw size={12} className="animate-spin" />}
                Approve Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Inline Concur Request Modal */}
      {activeModal?.type === 'CONCUR_REQ' && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-nocturne rounded-2xl shadow-xl max-w-md w-full flex flex-col animate-slide-up border border-gray-200 dark:border-gray-800">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
                  <Link2 size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">Log Concur Request #</h2>
                  <p className="text-xs text-gray-500 font-mono">{activeModal.po.displayId || activeModal.po.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isSubmittingAction}
                className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Enter the Concur Request reference ID for <strong>{activeModal.po.supplierName}</strong> ({formatCurrency(activeModal.po.totalAmountIncGst ?? activeModal.po.totalAmount * 1.10)}).
              </p>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Concur Request Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SYD1610"
                  value={concurReqInput}
                  onChange={(e) => setConcurReqInput(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#15171e] text-xs font-mono text-gray-900 dark:text-white focus:border-[var(--color-brand)] outline-none font-bold"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center gap-2 bg-gray-50/50 dark:bg-[#15171e]/50">
              <button
                type="button"
                onClick={() => handleExecuteConcurReq(true)}
                disabled={isSubmittingAction}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
              >
                Skip to PO Link
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  disabled={isSubmittingAction}
                  className="px-3.5 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleExecuteConcurReq(false)}
                  disabled={isSubmittingAction}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingAction && <RefreshCw size={12} className="animate-spin" />}
                  Save Concur Req #
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Inline Concur PO Link Modal */}
      {activeModal?.type === 'CONCUR_PO' && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-nocturne rounded-2xl shadow-xl max-w-md w-full flex flex-col animate-slide-up border border-gray-200 dark:border-gray-800">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">Link Final Concur PO #</h2>
                  <p className="text-xs text-gray-500 font-mono">{activeModal.po.displayId || activeModal.po.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isSubmittingAction}
                className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Enter the Concur PO number generated by procurement for <strong>{activeModal.po.supplierName}</strong>. This will activate the order for delivery receipting.
              </p>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Concur Purchase Order #
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MEL2801"
                  value={concurPoInput}
                  onChange={(e) => setConcurPoInput(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#15171e] text-xs font-mono text-gray-900 dark:text-white focus:border-[var(--color-brand)] outline-none font-bold"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2 bg-gray-50/50 dark:bg-[#15171e]/50">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isSubmittingAction}
                className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteConcurPO}
                disabled={isSubmittingAction}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmittingAction && <RefreshCw size={12} className="animate-spin" />}
                Activate Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Inline Delivery Modal */}
      {activeModal?.type === 'DELIVERY' && (
        <DeliveryModal
          po={activeModal.po}
          currentUser={currentUser}
          onClose={() => setActiveModal(null)}
          onSubmit={async (header: DeliveryHeader, closedLineIds: string[], additionalLines: POLineItem[]) => {
            await addDelivery(activeModal.po.id, header, closedLineIds, additionalLines);
            setActiveModal(null);
          }}
        />
      )}

      {/* 5. Inline Quick Inspect Modal */}
      {activeModal?.type === 'QUICK_VIEW' && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-nocturne rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] animate-slide-up border border-gray-200 dark:border-gray-800">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-base text-gray-900 dark:text-white">
                    {activeModal.po.displayId || activeModal.po.id}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    {activeModal.po.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {activeModal.po.site} · {activeModal.po.supplierName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-gray-50 dark:bg-[#15171e] rounded-xl border border-gray-100 dark:border-gray-800 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Requested</span>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {new Date(activeModal.po.requestDate).toLocaleDateString('en-AU')}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Requester</span>
                  <p className="font-semibold text-gray-900 dark:text-white truncate">{activeModal.po.requesterName}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Concur PO #</span>
                  <p className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {activeModal.po.concurPoNumber || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Total (Inc GST)</span>
                  <p className="font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(activeModal.po.totalAmountIncGst ?? activeModal.po.totalAmount * 1.10)}
                  </p>
                </div>
              </div>

              {/* Order Lines */}
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2">
                  Order Line Items ({activeModal.po.lines.length})
                </h4>
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 font-bold border-b border-gray-200 dark:border-gray-800">
                      <tr>
                        <th className="p-2.5">Item / SKU</th>
                        <th className="p-2.5 text-center">Ordered</th>
                        <th className="p-2.5 text-center text-emerald-600">Received</th>
                        <th className="p-2.5 text-right">Unit Price</th>
                        <th className="p-2.5 text-right">Total (Ex)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {activeModal.po.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="p-2.5">
                            <p className="font-bold text-gray-900 dark:text-white">{line.itemName}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{line.sku || '-'}</p>
                          </td>
                          <td className="p-2.5 text-center font-medium">{line.quantityOrdered}</td>
                          <td className="p-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                            {line.quantityReceived || 0}
                          </td>
                          <td className="p-2.5 text-right">{formatCurrency(line.unitPrice)}</td>
                          <td className="p-2.5 text-right font-semibold">{formatCurrency(line.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Delivery History */}
              {activeModal.po.deliveries && activeModal.po.deliveries.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2">
                    Recorded Deliveries ({activeModal.po.deliveries.length})
                  </h4>
                  <div className="space-y-2">
                    {activeModal.po.deliveries.map((del) => (
                      <div key={del.id} className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">Docket #{del.docketNumber || 'No Docket'}</p>
                          <p className="text-[10px] text-gray-500">Received by {del.receivedBy} on {new Date(del.date).toLocaleDateString('en-AU')}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                          {del.lines?.reduce((sum, l) => sum + (l.quantity || 0), 0) || 0} units
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-[#15171e]/50">
              <button
                type="button"
                onClick={() => {
                  const id = activeModal.po.id;
                  setActiveModal(null);
                  navigate(`/requests/${id}`);
                }}
                className="text-xs font-bold text-[var(--color-brand)] hover:underline flex items-center gap-1"
              >
                <span>Open Full Page View</span>
                <ArrowRight size={13} />
              </button>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
