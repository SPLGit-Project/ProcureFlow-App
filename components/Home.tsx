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
  Clock, ExternalLink, AlertTriangle, RefreshCw,
  Info, RotateCcw, HelpCircle, ChevronDown
} from 'lucide-react';
import { ItemRequest, PORequest, POLineItem, POStatus, ApprovalEvent, DeliveryHeader, PermissionId } from '../types';
import { useApp } from '../context/AppContext';
import PageHeader from './PageHeader';
import DeliveryModal from './DeliveryModal';
import { formatCurrency } from '../utils/taxCalculations';

// ── ProcureFlow Role-Tailored Insights Engine ─────────────────────────────────

interface ProcureFlowTip {
  id: string;
  category: 'REQUESTER' | 'APPROVER' | 'PROCUREMENT' | 'RECEIVING' | 'GENERAL';
  badgeLabel: string;
  title: string;
  tip: string;
  permissionRequired?: PermissionId;
  roleRequired?: string[];
}

const PROCUREFLOW_TIPS: ProcureFlowTip[] = [
  // General & Requester
  {
    id: 'req-need-by',
    category: 'REQUESTER',
    badgeLabel: 'Ordering Tip',
    title: 'Need-By Date Tracking',
    tip: 'Specify "Need-By" dates on your order lines so suppliers and logistics teams can prioritize urgent shipments.'
  },
  {
    id: 'req-concur-id',
    category: 'REQUESTER',
    badgeLabel: 'ERP Tracking',
    title: 'Concur Request Linkage',
    tip: 'Once your order is approved, click "Log Concur Req #" directly on your Stage 2 cards to attach the reference ID.'
  },
  {
    id: 'req-reasons',
    category: 'REQUESTER',
    badgeLabel: 'Best Practice',
    title: 'Request Reason Clarity',
    tip: 'Selecting the correct reason (Depletion vs New Customer) accelerates management approval turnaround times.'
  },
  {
    id: 'req-quick-view',
    category: 'GENERAL',
    badgeLabel: 'Navigation',
    title: 'Instant Line Inspection',
    tip: 'Use the "Quick View" button on any card to view line items, quantities, and pricing without leaving this dashboard.'
  },
  {
    id: 'req-site-scope',
    category: 'GENERAL',
    badgeLabel: 'Multi-Site Scope',
    title: 'Filter by Location',
    tip: 'Switch active laundry sites using the site selector in the top header to focus your workspace on specific branches.'
  },

  // Approver
  {
    id: 'appr-quick-decision',
    category: 'APPROVER',
    badgeLabel: 'Approver Hint',
    title: 'One-Click Approvals',
    tip: 'Review financial totals and approve or reject purchase requests directly from the Stage 1 view in seconds.',
    permissionRequired: 'approve_requests'
  },
  {
    id: 'appr-audit-trail',
    category: 'APPROVER',
    badgeLabel: 'Audit Compliance',
    title: 'Decision Remarks',
    tip: 'Add concise decision comments when approving or rejecting requests to maintain transparent compliance audit logs.',
    permissionRequired: 'approve_requests'
  },
  {
    id: 'appr-spend-kpi',
    category: 'APPROVER',
    badgeLabel: 'Spend Control',
    title: 'GST-Inclusive Pricing',
    tip: 'Total spend including GST is calculated live on every request card for accurate budget threshold verification.',
    permissionRequired: 'approve_requests'
  },

  // Procurement & Admin
  {
    id: 'proc-link-po',
    category: 'PROCUREMENT',
    badgeLabel: 'Procurement Step',
    title: 'Concur PO Linkage',
    tip: 'Entering the finalized Concur PO number in Stage 3 immediately activates the order for physical warehouse receiving.',
    permissionRequired: 'link_concur'
  },
  {
    id: 'proc-stage-flow',
    category: 'PROCUREMENT',
    badgeLabel: 'Workflow Guide',
    title: '6-Stage Lifecycle',
    tip: 'Orders advance cleanly through 6 distinct stages—from requisition and approval to Concur sync, delivery, and closure.',
    permissionRequired: 'link_concur'
  },
  {
    id: 'proc-catalog',
    category: 'PROCUREMENT',
    badgeLabel: 'Master Data',
    title: 'Contract Pricing',
    tip: 'Keep master item definitions and contract prices updated to eliminate price variance discrepancies on delivery.',
    permissionRequired: 'manage_item_definition'
  },

  // Receiving & Warehouse
  {
    id: 'rec-docket-entry',
    category: 'RECEIVING',
    badgeLabel: 'Receiving Guide',
    title: 'Supplier Docket Numbers',
    tip: 'Always enter the supplier delivery docket number and date received to enable seamless 3-way matching in Concur.'
  },
  {
    id: 'rec-partial-shipments',
    category: 'RECEIVING',
    badgeLabel: 'Receiving Guide',
    title: 'Partial Deliveries',
    tip: 'Log partial deliveries as shipments arrive. The order remains active in Stage 5 until all items are received.'
  },
  {
    id: 'rec-force-close',
    category: 'RECEIVING',
    badgeLabel: 'Reconciliation',
    title: 'Closing Balance Lines',
    tip: 'When a supplier cannot fulfill remaining backorders, force-close remaining lines during receipting to finalize Stage 6.'
  }
];

// ── 6-Stage Lifecycle Configuration ───────────────────────────────────────────

export interface LifecycleStageConfig {
  num: number;
  id: 'REQUESTED' | 'APPROVED' | 'REQ_LOGGED' | 'IN_CONCUR' | 'DELIVERY' | 'CLOSED';
  label: string;
  stageTitle: string;
  shortLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  badgeClass: string;
  bgLightClass: string;
  borderClass: string;
  activeRing: string;
  textClass: string;
  descriptor: string;
  purpose: string;
  actionRequired: string;
  responsibleRole: string;
  concurMapping: string;
}

export const LIFECYCLE_STAGES: LifecycleStageConfig[] = [
  {
    num: 1,
    id: 'REQUESTED',
    label: 'Requested',
    stageTitle: 'Stage 1 - Requested',
    shortLabel: 'Req',
    icon: FileText,
    color: 'amber',
    badgeClass: 'bg-amber-500 text-white',
    bgLightClass: 'bg-amber-50 dark:bg-amber-950/20',
    borderClass: 'border-amber-200 dark:border-amber-800/40',
    activeRing: 'ring-2 ring-amber-500 border-amber-500 shadow-md',
    textClass: 'text-amber-700 dark:text-amber-300',
    descriptor: 'Requisition submitted and awaiting financial management approval decision.',
    purpose: 'Initial requisition created by site staff. Validates operational need, quantities, and pricing before financial commitment.',
    actionRequired: 'Assigned financial approver reviews line items, reasons, and budget impact to Approve or Reject the request.',
    responsibleRole: 'Financial Approver / General Manager',
    concurMapping: 'Pre-ERP Requisition (Not yet in Concur)'
  },
  {
    num: 2,
    id: 'APPROVED',
    label: 'Approved',
    stageTitle: 'Stage 2 - Approved',
    shortLabel: 'Appr',
    icon: ShieldCheck,
    color: 'sky',
    badgeClass: 'bg-sky-500 text-white',
    bgLightClass: 'bg-sky-50 dark:bg-sky-950/20',
    borderClass: 'border-sky-200 dark:border-sky-800/40',
    activeRing: 'ring-2 ring-sky-500 border-sky-500 shadow-md',
    textClass: 'text-sky-700 dark:text-sky-300',
    descriptor: 'Financial approval granted; awaiting Concur Request ID reference logging.',
    purpose: 'Management authorization completed. The order is now ready for formal requisition entry into the corporate Concur ERP system.',
    actionRequired: 'Requester or Procurement logs the Concur Purchase Request number (e.g. SYD1610) to link ERP tracking.',
    responsibleRole: 'Order Requester / Procurement Team',
    concurMapping: 'Concur Purchase Request Created'
  },
  {
    num: 3,
    id: 'REQ_LOGGED',
    label: 'Requested Logged',
    stageTitle: 'Stage 3 - Requested Logged',
    shortLabel: 'Logged',
    icon: Link2,
    color: 'indigo',
    badgeClass: 'bg-indigo-500 text-white',
    bgLightClass: 'bg-indigo-50 dark:bg-indigo-950/20',
    borderClass: 'border-indigo-200 dark:border-indigo-800/40',
    activeRing: 'ring-2 ring-indigo-500 border-indigo-500 shadow-md',
    textClass: 'text-indigo-700 dark:text-indigo-300',
    descriptor: 'Concur Request logged; awaiting finalized Concur PO number from procurement.',
    purpose: 'Concur Request reference recorded. Central Procurement is now processing and generating the finalized Concur Purchase Order number.',
    actionRequired: 'Procurement team generates the formal PO in Concur and links the Concur PO # (e.g. MEL2801) to activate the order with the supplier.',
    responsibleRole: 'Central Procurement Team / Admin',
    concurMapping: 'Concur Request Approved → PO Pending'
  },
  {
    num: 4,
    id: 'IN_CONCUR',
    label: 'In Concur',
    stageTitle: 'Stage 4 - In Concur',
    shortLabel: 'Concur',
    icon: ShoppingCart,
    color: 'blue',
    badgeClass: 'bg-blue-600 text-white',
    bgLightClass: 'bg-blue-50 dark:bg-blue-950/20',
    borderClass: 'border-blue-200 dark:border-blue-800/40',
    activeRing: 'ring-2 ring-blue-500 border-blue-500 shadow-md',
    textClass: 'text-blue-700 dark:text-blue-300',
    descriptor: 'Concur PO generated & order is active with supplier awaiting shipment.',
    purpose: 'Final purchase order has been transmitted to the supplier. Goods are being manufactured, picked, and prepared for dispatch to laundry sites.',
    actionRequired: 'Warehouse receiving team waits for physical delivery and records the initial delivery docket receipt upon arrival.',
    responsibleRole: 'Supplier (Fulfillment) & Site Receiving Staff',
    concurMapping: 'Concur PO Active & Dispatched'
  },
  {
    num: 5,
    id: 'DELIVERY',
    label: 'Delivery',
    stageTitle: 'Stage 5 - Delivery',
    shortLabel: 'Delivery',
    icon: Truck,
    color: 'emerald',
    badgeClass: 'bg-emerald-500 text-white',
    bgLightClass: 'bg-emerald-50 dark:bg-emerald-950/20',
    borderClass: 'border-emerald-200 dark:border-emerald-800/40',
    activeRing: 'ring-2 ring-emerald-500 border-emerald-500 shadow-md',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    descriptor: 'Goods arriving on site; active physical delivery receipting and docket logging.',
    purpose: 'Shipment has arrived or is actively delivering in partial batches. Dockets and delivered quantities are recorded to ensure 3-way matching.',
    actionRequired: 'Receiving staff logs delivery dockets, confirms physical item counts, and marks lines complete when all goods are received.',
    responsibleRole: 'Site Warehouse / Laundry Receiving Team',
    concurMapping: 'Goods Receipting (GR) in Progress'
  },
  {
    num: 6,
    id: 'CLOSED',
    label: 'Order Closed',
    stageTitle: 'Stage 6 - Order Closed',
    shortLabel: 'Closed',
    icon: CheckCheck,
    color: 'slate',
    badgeClass: 'bg-slate-600 text-white',
    bgLightClass: 'bg-slate-50 dark:bg-slate-900/20',
    borderClass: 'border-slate-200 dark:border-slate-800/40',
    activeRing: 'ring-2 ring-slate-500 border-slate-500 shadow-md',
    textClass: 'text-slate-700 dark:text-slate-300',
    descriptor: 'All goods fully received and reconciled; purchase order complete and archived.',
    purpose: 'All ordered items have been 100% delivered, reconciled against supplier invoices, and capitalised into laundry stock.',
    actionRequired: 'No further action required. Order is archived in history and reflected across financial and injection reports.',
    responsibleRole: 'System / Finance Reconciled',
    concurMapping: 'Fully Receipted & Closed in Concur'
  },
];

// Helper to determine stage number and next step metadata
export function getPOStageInfo(po: PORequest, currentUser: any, hasPermission: (perm: string) => boolean) {
  let stageNum = 1;
  let nextActionTitle = 'Review & Approve';
  let actionType: 'APPROVE' | 'CONCUR_REQ' | 'CONCUR_PO' | 'DELIVERY' | 'QUICK_VIEW' = 'APPROVE';
  let canAction = false;

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.roleIds?.includes('ADMIN');
  const isApprover = currentUser?.role === 'APPROVER' || currentUser?.roleIds?.includes('APPROVER') || hasPermission('approve_requests');
  const canLinkConcur = hasPermission('link_concur');
  const isRequester = po.requesterId === currentUser?.id;

  if (po.status === 'PENDING_APPROVAL' || po.status === 'DRAFT') {
    stageNum = 1;
    nextActionTitle = 'Review & Approve';
    actionType = 'APPROVE';
    canAction = isApprover || isAdmin;
  } else if (po.status === 'APPROVED_PENDING_CONCUR_REQUEST') {
    stageNum = 2;
    nextActionTitle = 'Log Concur Req #';
    actionType = 'CONCUR_REQ';
    canAction = isRequester || canLinkConcur || isAdmin;
  } else if (po.status === 'APPROVED_PENDING_CONCUR') {
    stageNum = 3;
    nextActionTitle = 'Link Concur PO #';
    actionType = 'CONCUR_PO';
    canAction = canLinkConcur || isAdmin;
  } else if (po.status === 'ACTIVE') {
    stageNum = 4;
    nextActionTitle = 'Record Goods Receipt';
    actionType = 'DELIVERY';
    canAction = true;
  } else if (po.status === 'RECEIVED' || po.status === 'VARIANCE_PENDING') {
    stageNum = 5;
    const remaining = po.lines.reduce((acc, line) => acc + Math.max(0, line.quantityOrdered - (line.quantityReceived || 0)), 0);
    nextActionTitle = remaining > 0 ? 'Receive Goods' : 'Reconcile Order';
    actionType = 'DELIVERY';
    canAction = true;
  } else if (po.status === 'CLOSED') {
    stageNum = 6;
    nextActionTitle = 'View Order';
    actionType = 'QUICK_VIEW';
    canAction = false;
  } else if (po.status === 'REJECTED') {
    stageNum = 1;
    nextActionTitle = 'View Rejected Order';
    actionType = 'QUICK_VIEW';
    canAction = false;
  }

  const stageConfig = LIFECYCLE_STAGES[stageNum - 1] || LIFECYCLE_STAGES[0];

  return {
    stageNum,
    stageConfig,
    nextActionTitle,
    actionType,
    canAction
  };
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
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.roleIds?.includes('ADMIN');
  const isApprover = currentUser?.role === 'APPROVER' || currentUser?.roleIds?.includes('APPROVER') || hasPermission('approve_requests');
  const canLinkConcur = hasPermission('link_concur');

  // Selected stage filter ('ALL' | 1 | 2 | 3 | 4 | 5 | 6)
  const [selectedStage, setSelectedStage] = useState<number | 'ALL'>('ALL');
  const [activeInfoStage, setActiveInfoStage] = useState<number | null>(null);
  const [actionSearch, setActionSearch] = useState('');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'SPEND_DESC' | 'SPEND_ASC' | 'SUPPLIER_ASC'>('NEWEST');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);

  // Modals state
  const [activeModal, setActiveModal] = useState<{
    type: 'APPROVE' | 'CONCUR_REQ' | 'CONCUR_PO' | 'DELIVERY' | 'QUICK_VIEW';
    po: PORequest;
  } | null>(null);

  // Modal form states
  const [approvalComment, setApprovalComment] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [concurReqInput, setConcurReqInput] = useState('');
  const [concurPoInput, setConcurPoInput] = useState('');

  // ── Role-Tailored ProcureFlow Insights ──────────────────────────────────────
  const userEligibleTips = useMemo(() => {
    return PROCUREFLOW_TIPS.filter(tip => {
      if (tip.permissionRequired && !hasPermission(tip.permissionRequired)) {
        return false;
      }
      if (tip.roleRequired && !tip.roleRequired.includes(currentUser?.role || '')) {
        return false;
      }
      return true;
    });
  }, [currentUser, hasPermission]);

  const [tipIndex, setTipIndex] = useState(0);
  const currentTip = userEligibleTips[tipIndex % Math.max(1, userEligibleTips.length)] || PROCUREFLOW_TIPS[0];

  const handleNextTip = () => {
    setTipIndex(prev => (prev + 1) % userEligibleTips.length);
  };

  // ── Filtered POs by Active Sites ────────────────────────────────────────────
  const siteFilteredPOs = useMemo(() => {
    return pos.filter(p => activeSiteIds.length === 0 || activeSiteIds.includes(p.siteId));
  }, [pos, activeSiteIds]);

  // Unique suppliers across current site scope
  const availableSuppliers = useMemo(() => {
    return Array.from(new Set(siteFilteredPOs.map(p => p.supplierName).filter(Boolean))).sort();
  }, [siteFilteredPOs]);

  // Counts per stage
  const stageCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    siteFilteredPOs.forEach(p => {
      if (p.status === 'PENDING_APPROVAL' || p.status === 'DRAFT') counts[1] += 1;
      else if (p.status === 'APPROVED_PENDING_CONCUR_REQUEST') counts[2] += 1;
      else if (p.status === 'APPROVED_PENDING_CONCUR') counts[3] += 1;
      else if (p.status === 'ACTIVE') counts[4] += 1;
      else if (p.status === 'RECEIVED' || p.status === 'VARIANCE_PENDING') counts[5] += 1;
      else if (p.status === 'CLOSED') counts[6] += 1;
    });
    return counts;
  }, [siteFilteredPOs]);

  const totalOpenRequests = useMemo(() => {
    return siteFilteredPOs.filter(p => p.status !== 'CLOSED' && p.status !== 'REJECTED').length;
  }, [siteFilteredPOs]);

  // ── Dynamic Welcome & Action Focus Generator ────────────────────────────────
  const firstName = currentUser?.name?.split(' ')[0] || 'there';
  const siteLabel = activeSiteIds.length === 0
    ? 'All Laundry Sites'
    : activeSiteIds.length === 1
      ? siteName(activeSiteIds[0])
      : `${activeSiteIds.length} Active Sites`;

  const dynamicFocusInsight = useMemo(() => {
    if (stageCounts[1] > 0 && (isApprover || isAdmin)) {
      return (
        <span>
          You have <strong className="text-amber-600 dark:text-amber-400 font-black">{stageCounts[1]} purchase request{stageCounts[1] === 1 ? '' : 's'}</strong> awaiting your financial approval for {siteLabel}.
        </span>
      );
    }
    if (stageCounts[3] > 0 && (canLinkConcur || isAdmin)) {
      return (
        <span>
          You have <strong className="text-indigo-600 dark:text-indigo-400 font-black">{stageCounts[3]} approved order{stageCounts[3] === 1 ? '' : 's'}</strong> ready for Concur PO linkage to unlock deliveries.
        </span>
      );
    }
    if (stageCounts[2] > 0) {
      return (
        <span>
          <strong className="text-sky-600 dark:text-sky-400 font-black">{stageCounts[2]} request{stageCounts[2] === 1 ? '' : 's'}</strong> are approved and ready to log Concur Request reference numbers.
        </span>
      );
    }
    if (stageCounts[4] > 0 || stageCounts[5] > 0) {
      const activeDeliveryCount = stageCounts[4] + stageCounts[5];
      return (
        <span>
          <strong className="text-emerald-600 dark:text-emerald-400 font-black">{activeDeliveryCount} order{activeDeliveryCount === 1 ? '' : 's'}</strong> are active with deliveries expected or in progress.
        </span>
      );
    }
    return <span>All clear! No urgent procurement operations require your attention right now for {siteLabel}.</span>;
  }, [stageCounts, isApprover, isAdmin, canLinkConcur, siteLabel]);

  // ── Stage-Expanded, Filtered & Sorted Requests ──────────────────────────────
  const visiblePOs = useMemo(() => {
    const list = siteFilteredPOs
      .filter(p => {
        // Stage filter
        if (selectedStage !== 'ALL') {
          if (selectedStage === 1) return p.status === 'PENDING_APPROVAL' || p.status === 'DRAFT';
          if (selectedStage === 2) return p.status === 'APPROVED_PENDING_CONCUR_REQUEST';
          if (selectedStage === 3) return p.status === 'APPROVED_PENDING_CONCUR';
          if (selectedStage === 4) return p.status === 'ACTIVE';
          if (selectedStage === 5) return p.status === 'RECEIVED' || p.status === 'VARIANCE_PENDING';
          if (selectedStage === 6) return p.status === 'CLOSED';
        } else {
          // 'ALL': by default show open/active requests
          return p.status !== 'CLOSED' && p.status !== 'REJECTED';
        }
        return true;
      })
      .filter(p => {
        // Supplier filter
        if (selectedSupplier !== 'ALL' && p.supplierName !== selectedSupplier) {
          return false;
        }
        return true;
      })
      .filter(p => {
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
          p.lines.some(l => (l.itemName || '').toLowerCase().includes(q) || (l.sku || '').toLowerCase().includes(q))
        );
      });

    // Sorting
    return list.sort((a, b) => {
      const dateA = new Date(a.requestDate).getTime() || 0;
      const dateB = new Date(b.requestDate).getTime() || 0;
      const spendA = a.totalAmountIncGst ?? (a.totalAmount * 1.10);
      const spendB = b.totalAmountIncGst ?? (b.totalAmount * 1.10);

      switch (sortBy) {
        case 'OLDEST':
          return dateA - dateB;
        case 'SPEND_DESC':
          return spendB - spendA;
        case 'SPEND_ASC':
          return spendA - spendB;
        case 'SUPPLIER_ASC':
          return (a.supplierName || '').localeCompare(b.supplierName || '');
        case 'NEWEST':
        default:
          return dateB - dateA;
      }
    });
  }, [siteFilteredPOs, selectedStage, selectedSupplier, actionSearch, sortBy]);

  // ── Multi-Site Grouping ─────────────────────────────────────────────────────
  const groupedBySite = useMemo(() => {
    const map = new Map<string, PORequest[]>();
    visiblePOs.forEach(p => {
      const siteKey = p.site || 'Other / Unassigned Location';
      if (!map.has(siteKey)) map.set(siteKey, []);
      map.get(siteKey)!.push(p);
    });

    return Array.from(map.entries())
      .map(([site, requests]) => {
        const siteSpend = requests.reduce((sum, r) => sum + (r.totalAmountIncGst ?? (r.totalAmount * 1.10)), 0);
        return {
          site,
          requests,
          siteSpend,
          count: requests.length
        };
      })
      .sort((a, b) => a.site.localeCompare(b.site));
  }, [visiblePOs]);

  // Accordion toggle helpers (collapsed by default when multiple sites exist)
  const toggleSiteExpand = (site: string) => {
    setExpandedSites(prev => {
      const next = new Set(prev);
      if (next.has(site)) {
        next.delete(site);
      } else {
        next.add(site);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedSites(new Set(groupedBySite.map(g => g.site)));
  };

  const handleCollapseAll = () => {
    setExpandedSites(new Set());
  };

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
    <div className="mx-auto flex min-h-[calc(100dvh-7.25rem)] max-w-7xl flex-col gap-5 overflow-hidden animate-page-entry px-3 sm:px-6 pb-12">
      <PageHeader title="Home" subtitle="Workspace" />

      {/* Top Welcome Header & ProcureFlow Insights */}
      <section className="relative flex-1 overflow-hidden rounded-[1.75rem] border border-transparent bg-transparent text-gray-950 shadow-none dark:border-white/10 dark:bg-nocturne dark:text-white dark:shadow-2xl">
        <div className="relative flex flex-col gap-5 sm:gap-6 p-3.5 sm:p-5 lg:p-6">
          
          {/* Header Row: Greeting & Dynamic Focus + Compact Insights Trigger Button */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
            <div className="space-y-1.5 min-w-0 max-w-3xl">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-tight text-gray-950 dark:text-white">
                  Good to see you, {firstName}.
                </h1>
                {/* ProcureFlow Insights Interactive Icon Trigger */}
                <button
                  type="button"
                  onClick={() => setIsInsightsOpen(true)}
                  className="px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs hover:scale-102 shrink-0 active:scale-95 cursor-pointer"
                  title="Click to view tailored ProcureFlow Insights"
                >
                  <Sparkles size={13} className="text-amber-500 shrink-0 animate-pulse" />
                  <span className="text-[11px] font-bold">Insights</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    {currentTip.badgeLabel}
                  </span>
                </button>
              </div>
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300 leading-relaxed">
                {dynamicFocusInsight}
              </p>
            </div>
          </div>

          {/* ── HERO 6-STAGE INTERACTIVE WORKSPACE SELECTOR ──────────────────────── */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-[var(--color-brand)]" />
                <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Procurement Lifecycle Stages
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStage('ALL')}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-all ${
                    selectedStage === 'ALL'
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  All Open ({totalOpenRequests})
                </button>
              </div>
            </div>

            {/* Large 6-Stage Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {LIFECYCLE_STAGES.map((stage) => {
                const IconComp = stage.icon;
                const count = stageCounts[stage.num] || 0;
                const isSelected = selectedStage === stage.num;
                const isInfoActive = activeInfoStage === stage.num;

                return (
                  <div
                    key={stage.num}
                    onClick={() => setSelectedStage(stage.num)}
                    className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col items-center text-center justify-between gap-3 group ${
                      isSelected
                        ? `${stage.bgLightClass} ${stage.activeRing}`
                        : 'bg-white dark:bg-[#15171e] border-gray-200/80 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 shadow-2xs hover:shadow-md'
                    }`}
                  >
                    {/* Top Row: Info Icon & Live Count Badge */}
                    <div className="w-full flex items-center justify-between">
                      {/* Info Tooltip Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveInfoStage(stage.num);
                        }}
                        className="p-1 text-gray-400 hover:text-[var(--color-brand)] dark:hover:text-white rounded-md transition-colors"
                        title={`Learn about Stage ${stage.num}: ${stage.label}`}
                      >
                        <Info size={13} />
                      </button>

                      {/* Live Count Badge */}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                        count > 0 ? stage.badgeClass : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                      }`}>
                        {count}
                      </span>
                    </div>

                    {/* Centered Large Stage Icon */}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold transition-all shadow-xs ${
                      isSelected
                        ? `${stage.badgeClass} scale-105 shadow-md`
                        : `${stage.bgLightClass} ${stage.textClass} group-hover:scale-105`
                    }`}>
                      <IconComp size={22} />
                    </div>

                    {/* Stage Label & Title Underneath */}
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Stage {stage.num}
                      </p>
                      <p className="text-xs font-bold text-gray-900 dark:text-white mt-0.5">
                        {stage.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── SLEEK STAGE-EXPANDED REQUESTS WORKLIST ───────────────────────────── */}
          <div className="border-t border-gray-200/70 pt-5 dark:border-white/10">
            {/* Header & Controls Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-brand)] animate-pulse" />
                  <h3 className="text-sm font-black text-gray-950 dark:text-white uppercase tracking-wider">
                    {selectedStage === 'ALL'
                      ? 'All Open Requests'
                      : LIFECYCLE_STAGES[selectedStage - 1].stageTitle}
                    <span className="ml-2 text-xs font-bold text-gray-500 lowercase">
                      ({visiblePOs.length} order{visiblePOs.length === 1 ? '' : 's'})
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {selectedStage === 'ALL'
                    ? 'Showing active requests across all lifecycle stages.'
                    : LIFECYCLE_STAGES[selectedStage - 1].descriptor}
                </p>
              </div>

              {/* Controls: Search, Supplier Filter, Sort Dropdown & Expand Toggle */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search Bar */}
                <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search requests..."
                    value={actionSearch}
                    onChange={(e) => setActionSearch(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-900 dark:text-white focus:border-[var(--color-brand)] outline-none"
                  />
                  {actionSearch && (
                    <button
                      type="button"
                      onClick={() => setActionSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Supplier Filter */}
                <div className="relative">
                  <select
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="py-1.5 pl-3 pr-7 rounded-xl bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 focus:border-[var(--color-brand)] outline-none cursor-pointer appearance-none"
                  >
                    <option value="ALL">All Suppliers</option>
                    {availableSuppliers.map((sup) => (
                      <option key={sup} value={sup}>
                        {sup}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>

                {/* Sort By Dropdown */}
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="py-1.5 pl-3 pr-7 rounded-xl bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 focus:border-[var(--color-brand)] outline-none cursor-pointer appearance-none"
                  >
                    <option value="NEWEST">Newest First</option>
                    <option value="OLDEST">Oldest First</option>
                    <option value="SPEND_DESC">Highest Spend</option>
                    <option value="SPEND_ASC">Lowest Spend</option>
                    <option value="SUPPLIER_ASC">Supplier (A-Z)</option>
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>

                {/* Multi-Site Expand / Collapse All */}
                {groupedBySite.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (expandedSites.size === groupedBySite.length) {
                        handleCollapseAll();
                      } else {
                        handleExpandAll();
                      }
                    }}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl transition-colors whitespace-nowrap"
                  >
                    {expandedSites.size === groupedBySite.length ? 'Collapse All' : 'Expand All'}
                  </button>
                )}
              </div>
            </div>

            {/* ── Multi-Site Grouped Accordions or Direct Grid ─────────────────── */}
            {visiblePOs.length > 0 ? (
              groupedBySite.length > 1 ? (
                <div className="space-y-4">
                  {groupedBySite.map(({ site, requests, siteSpend, count }) => {
                    const isExpanded = expandedSites.has(site);

                    return (
                      <div
                        key={site}
                        className="rounded-2xl border border-gray-200/90 dark:border-gray-800/90 bg-white/60 dark:bg-[#15171e]/60 overflow-hidden shadow-2xs transition-all"
                      >
                        {/* Site Accordion Header */}
                        <button
                          type="button"
                          onClick={() => toggleSiteExpand(site)}
                          className="w-full p-3.5 flex items-center justify-between bg-gray-50/80 dark:bg-gray-900/50 hover:bg-gray-100/80 dark:hover:bg-gray-800/50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <div className="w-7 h-7 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center font-bold">
                              <Building2 size={14} />
                            </div>
                            <span className="font-bold text-sm text-gray-950 dark:text-white">
                              {site}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gray-200/80 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                              {count} order{count === 1 ? '' : 's'}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(siteSpend)} Inc GST
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold">
                            <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                            <ChevronDown
                              size={16}
                              className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </div>
                        </button>

                        {/* Site Orders Grid */}
                        {isExpanded && (
                          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5 border-t border-gray-100 dark:border-gray-800/60">
                            {requests.map((po) => {
                              const stageInfo = getPOStageInfo(po, currentUser, hasPermission);
                              const StageIcon = stageInfo.stageConfig.icon;
                              const totalItems = po.lines.reduce((sum, l) => sum + (l.quantityOrdered || 0), 0);
                              const receivedItems = po.lines.reduce((sum, l) => sum + (l.quantityReceived || 0), 0);

                              return (
                                <div
                                  key={po.id}
                                  className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-3 group"
                                >
                                  {/* Top Header: Request Display ID, Site Badge, Date */}
                                  <div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                      <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-lg ${stageInfo.stageConfig.bgLightClass} ${stageInfo.stageConfig.textClass} shrink-0`}>
                                          <StageIcon size={14} />
                                        </div>
                                        <span className="font-mono font-bold text-sm text-gray-950 dark:text-white">
                                          {po.displayId || po.id}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1.5 text-xs">
                                        <span className="px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 font-semibold text-gray-700 dark:text-gray-300">
                                          {po.site || 'Site'}
                                        </span>
                                        <span className="text-gray-400 font-medium">
                                          {new Date(po.requestDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Supplier, Amount & Customer / Project */}
                                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
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

                                    {/* Line items summary / delivery progress */}
                                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
                                      <span>{po.lines.length} Line Item{po.lines.length === 1 ? '' : 's'} ({totalItems} units)</span>
                                      {(po.status === 'ACTIVE' || po.status === 'RECEIVED') && (
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                          {receivedItems} / {totalItems} units received
                                        </span>
                                      )}
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
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {visiblePOs.map((po) => {
                    const stageInfo = getPOStageInfo(po, currentUser, hasPermission);
                    const StageIcon = stageInfo.stageConfig.icon;
                    const totalItems = po.lines.reduce((sum, l) => sum + (l.quantityOrdered || 0), 0);
                    const receivedItems = po.lines.reduce((sum, l) => sum + (l.quantityReceived || 0), 0);

                    return (
                      <div
                        key={po.id}
                        className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-3 group"
                      >
                        {/* Top Header: Request Display ID, Site Badge, Date */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              {/* Small Stage Indicator */}
                              <div className={`p-1.5 rounded-lg ${stageInfo.stageConfig.bgLightClass} ${stageInfo.stageConfig.textClass} shrink-0`}>
                                <StageIcon size={14} />
                              </div>
                              <span className="font-mono font-bold text-sm text-gray-950 dark:text-white">
                                {po.displayId || po.id}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 font-semibold text-gray-700 dark:text-gray-300">
                                {po.site || 'Site'}
                              </span>
                              <span className="text-gray-400 font-medium">
                                {new Date(po.requestDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}
                              </span>
                            </div>
                          </div>

                          {/* Supplier, Amount & Customer / Project */}
                          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
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

                          {/* Line items summary / delivery progress */}
                          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
                            <span>{po.lines.length} Line Item{po.lines.length === 1 ? '' : 's'} ({totalItems} units)</span>
                            {(po.status === 'ACTIVE' || po.status === 'RECEIVED') && (
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                {receivedItems} / {totalItems} units received
                              </span>
                            )}
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
              )
            ) : (
              <div className="py-12 px-6 flex flex-col items-center justify-center text-center bg-white dark:bg-[#15171e] rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 shadow-2xs">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-2.5">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">No Requests Found</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
                  {actionSearch || selectedSupplier !== 'ALL'
                    ? 'No requests matched your active filters or search criteria.'
                    : selectedStage === 'ALL'
                      ? 'No open purchase requests require action.'
                      : `No requests are currently in ${LIFECYCLE_STAGES[selectedStage - 1].stageTitle}.`}
                </p>
                {(actionSearch || selectedSupplier !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionSearch('');
                      setSelectedSupplier('ALL');
                    }}
                    className="mt-3 text-xs font-bold text-[var(--color-brand)] hover:underline"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      </section>

      {/* ── RICH STAGE GUIDANCE MODAL ────────────────────────────────────────── */}
      {activeInfoStage !== null && (() => {
        const stage = LIFECYCLE_STAGES[activeInfoStage - 1];
        if (!stage) return null;
        const IconComp = stage.icon;

        return (
          <div
            className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in"
            onClick={() => setActiveInfoStage(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-nocturne rounded-2xl shadow-2xl max-w-lg w-full flex flex-col animate-slide-up border border-gray-200 dark:border-gray-800 overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-[#15171e]/50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${stage.badgeClass} shadow-md`}>
                    <IconComp size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      Procurement Lifecycle Stage {stage.num} of 6
                    </span>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">
                      {stage.label}
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveInfoStage(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 text-xs">
                {/* Purpose */}
                <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#15171e] border border-gray-200/80 dark:border-gray-800">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                    Stage Purpose
                  </span>
                  <p className="text-gray-800 dark:text-gray-200 font-medium leading-relaxed">
                    {stage.purpose}
                  </p>
                </div>

                {/* Required Action & Responsible Role */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40">
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
                      Action Required
                    </span>
                    <p className="text-gray-800 dark:text-gray-200 font-medium leading-relaxed">
                      {stage.actionRequired}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-1">
                      Responsible Role
                    </span>
                    <p className="text-gray-800 dark:text-gray-200 font-bold leading-relaxed">
                      {stage.responsibleRole}
                    </p>
                  </div>
                </div>

                {/* ERP / Concur Mapping */}
                <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                      Concur ERP Integration State
                    </span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      {stage.concurMapping}
                    </span>
                  </div>
                  <Link2 size={18} className="text-indigo-500 shrink-0" />
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-[#15171e]/50">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStage(stage.num);
                    setActiveInfoStage(null);
                  }}
                  className="text-xs font-bold text-[var(--color-brand)] hover:underline flex items-center gap-1"
                >
                  <span>Filter by this Stage ({stageCounts[stage.num] || 0} orders)</span>
                  <ArrowRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInfoStage(null)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-xl"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── PROCUREFLOW INSIGHTS MODAL ───────────────────────────────────────── */}
      {isInsightsOpen && (
        <div
          className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in"
          onClick={() => setIsInsightsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-nocturne rounded-2xl shadow-2xl max-w-md w-full flex flex-col animate-slide-up border border-gray-200 dark:border-gray-800 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gradient-to-r from-amber-500/10 via-brand/5 to-transparent">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shadow-xs shrink-0">
                  <Sparkles size={18} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                    ProcureFlow Insight
                  </span>
                  <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                    {currentTip.title}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInsightsOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                  Topic: {currentTip.badgeLabel}
                </span>
                <span className="text-[11px] font-medium text-gray-400">
                  Tip {tipIndex + 1} of {userEligibleTips.length}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium bg-gray-50 dark:bg-[#15171e] p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                {currentTip.tip}
              </p>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-[#15171e]/50">
              <button
                type="button"
                onClick={handleNextTip}
                className="text-xs font-bold text-[var(--color-brand)] hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Next Insight</span>
              </button>
              <button
                type="button"
                onClick={() => setIsInsightsOpen(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

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
