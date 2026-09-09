import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  X, Sparkles, Layers, FileText, ShieldCheck,
  ShoppingCart, Truck, CheckCheck, Search, Filter,
  ExternalLink, ChevronRight, BookOpen, Lightbulb,
  Building2, DollarSign, ArrowRight, CheckCircle2,
  Calendar, Clock, AlertTriangle, RefreshCw
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PermissionId } from '../types';

export interface ScreenInsight {
  id: string;
  category: 'REQUESTER' | 'APPROVER' | 'PROCUREMENT' | 'RECEIVING' | 'GENERAL';
  badgeLabel: string;
  title: string;
  tip: string;
  actionText?: string;
  actionPath?: string;
  permissionRequired?: PermissionId;
}

export interface RouteInsightMeta {
  screenTitle: string;
  screenSubtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentColor: string;
  primaryTips: ScreenInsight[];
}

// ── Screen-Specific Curated Insights Repository ───────────────────────────────
const ROUTE_INSIGHTS_MAP: Record<string, RouteInsightMeta> = {
  '/': {
    screenTitle: 'Home Workspace & Lifecycle Stages',
    screenSubtitle: '6-Stage procurement lifecycle, requests awaiting completion, and SLA triggers.',
    icon: Layers,
    accentColor: 'text-amber-500',
    primaryTips: [
      {
        id: 'home-awaiting-completion',
        category: 'RECEIVING',
        badgeLabel: 'Quick Action',
        title: 'Clearing Requests Awaiting Completion',
        tip: 'The default home view displays all active deliveries. When an order is 100% received in full, click "Close Order" to instantly archive it and clear it from your queue.',
        actionText: 'View Awaiting Deliveries',
        actionPath: '/'
      },
      {
        id: 'home-stage-toggle',
        category: 'GENERAL',
        badgeLabel: 'Navigation',
        title: 'Interactive Stage Filtering',
        tip: 'Click any lifecycle stage card (Stage 1 to 6) to filter the worklist below to that stage. Click the same card again to unselect it and return to Requests Awaiting Completion.'
      },
      {
        id: 'home-sla-triggers',
        category: 'PROCUREMENT',
        badgeLabel: 'SLA Guard',
        title: 'Responding to Alert & Warning Triggers',
        tip: 'Pulsing indicators in the top right of each stage card highlight orders breaching SLA thresholds (e.g. pending approval > 3d, missing Concur PO > 7d, overdue delivery > 14d).'
      },
      {
        id: 'home-need-by-date',
        category: 'REQUESTER',
        badgeLabel: 'Best Practice',
        title: 'Need-By Delivery Deadlines',
        tip: 'Order cards display the target "Due" date. Keep need-by dates realistic so warehouse teams and suppliers can prioritize urgent hospital or laundry shipments.'
      }
    ]
  },
  '/requests': {
    screenTitle: 'Active Purchase Requests',
    screenSubtitle: 'Filter, inspect, and progress all operational purchase orders in flight.',
    icon: FileText,
    accentColor: 'text-indigo-500',
    primaryTips: [
      {
        id: 'req-concur-sync',
        category: 'PROCUREMENT',
        badgeLabel: 'ERP Tracking',
        title: 'Concur Request & PO Linkage',
        tip: 'Use the quick action buttons on Stage 2 and Stage 3 orders to attach Concur Purchase Request and formal Concur PO numbers in seconds.',
        permissionRequired: 'link_concur'
      },
      {
        id: 'req-multi-site',
        category: 'GENERAL',
        badgeLabel: 'Scope Control',
        title: 'Filter by Active Laundry Site',
        tip: 'Use the site dropdown in the top header to narrow your active orders list to specific branches like Melbourne, Sydney, or Brisbane.'
      },
      {
        id: 'req-inspections',
        category: 'GENERAL',
        badgeLabel: 'Quick Inspection',
        title: 'Inspect Order Line Items Inline',
        tip: 'Click "Quick View" on any order card to review item quantities, pricing breakdown, and supplier details without losing your place in the list.'
      }
    ]
  },
  '/create': {
    screenTitle: 'Create Purchase Request',
    screenSubtitle: 'Step-by-step requisition wizard with catalog pricing and delivery requirements.',
    icon: ShoppingCart,
    accentColor: 'text-emerald-500',
    primaryTips: [
      {
        id: 'create-need-by',
        category: 'REQUESTER',
        badgeLabel: 'Critical Step',
        title: 'Specify Line-Level Need-By Dates',
        tip: 'Assigning a Need-By date on order lines enables automated tracking and alerts procurement if a supplier fails to dispatch on schedule.'
      },
      {
        id: 'create-catalog-pricing',
        category: 'REQUESTER',
        badgeLabel: 'Cost Accuracy',
        title: 'Pre-Approved Contract Pricing',
        tip: 'Items added from the pre-approved master catalogue automatically populate current contract prices and GST calculations to eliminate invoice variances.'
      },
      {
        id: 'create-reasons',
        category: 'REQUESTER',
        badgeLabel: 'Approval Speed',
        title: 'Accurate Requisition Reasons',
        tip: 'Choose between Depletion (BAU replacement) and New Customer injection to route requests to the appropriate financial budget approvals without delay.'
      }
    ]
  },
  '/completed': {
    screenTitle: 'Completed & Archived Orders',
    screenSubtitle: 'Historical orders, goods receipt audit trails, and supplier delivery performance.',
    icon: CheckCheck,
    accentColor: 'text-slate-500',
    primaryTips: [
      {
        id: 'comp-audit',
        category: 'GENERAL',
        badgeLabel: 'Compliance',
        title: 'Delivery Docket Verification',
        tip: 'Every completed order retains recorded supplier docket numbers, dates received, and receiving staff names for audit compliance.'
      },
      {
        id: 'comp-variance',
        category: 'RECEIVING',
        badgeLabel: 'Reconciliation',
        title: 'Variance & Force-Closed Balances',
        tip: 'Orders closed with short shipments display detailed remarks on backordered quantities that were force-closed.'
      }
    ]
  },
  '/smart-buying': {
    screenTitle: 'Smart Buying & Availability',
    screenSubtitle: 'Real-time supplier stock-on-hand (SOH), multi-vendor availability, and pricing optimization.',
    icon: Lightbulb,
    accentColor: 'text-amber-500',
    primaryTips: [
      {
        id: 'sb-soh',
        category: 'PROCUREMENT',
        badgeLabel: 'Inventory',
        title: 'Supplier Stock-on-Hand Tracking',
        tip: 'Smart Buying cross-references incoming supplier inventory reports so you can order items that suppliers currently hold in stock, reducing backorder delays.'
      },
      {
        id: 'sb-price-opt',
        category: 'PROCUREMENT',
        badgeLabel: 'Cost Savings',
        title: 'Price Comparison Across Vendors',
        tip: 'Compare tiered pricing and pack sizes across approved suppliers to minimize unit costs across laundry sites.'
      }
    ]
  },
  '/reports': {
    screenTitle: 'EOM Tracking & Concur Parity',
    screenSubtitle: 'Ash’s 12-Month Linen Budget tracking model and automated Concur reconciliation.',
    icon: DollarSign,
    accentColor: 'text-indigo-500',
    primaryTips: [
      {
        id: 'rep-concur-intake',
        category: 'PROCUREMENT',
        badgeLabel: 'Auto Ingestion',
        title: 'Automated Concur Email Intake',
        tip: 'Concur monthly reports and weekly depletion trackers emailed to Procurement@splservices.com.au are ingested automatically for cent-for-cent parity audits.'
      },
      {
        id: 'rep-weekly-versions',
        category: 'PROCUREMENT',
        badgeLabel: 'Weekly Reports',
        title: 'Weekly Snapshot Superseding',
        tip: 'The newest weekly snapshot (e.g. 04.09, 11.09) is selected by default, while earlier weekly versions remain selectable in the dropdown for auditing.'
      },
      {
        id: 'rep-balance',
        category: 'APPROVER',
        badgeLabel: 'Budgeting',
        title: 'Monthly Site Budget Balancing',
        tip: 'When adjusting monthly site budgets in the 12-Month Grid, the national monthly baseline ($826,750) must balance across branches before saving.'
      }
    ]
  },
  '/settings': {
    screenTitle: 'System Settings & SLA Triggers',
    screenSubtitle: 'Configure warning thresholds, monitored intake emails, and approval rules.',
    icon: ShieldCheck,
    accentColor: 'text-purple-500',
    primaryTips: [
      {
        id: 'set-triggers',
        category: 'PROCUREMENT',
        badgeLabel: 'SLA Configuration',
        title: 'Lifecycle Warning & Alert Days',
        tip: 'Admins can customize the exact day thresholds for each stage (Approval pending, Concur PR pending, Concur PO pending, Delivery overdue) under Lifecycle Triggers.',
        permissionRequired: 'manage_settings'
      },
      {
        id: 'set-inbox',
        category: 'PROCUREMENT',
        badgeLabel: 'Email Setup',
        title: 'Monitored Concur Mailbox',
        tip: 'Ensure the monitored mailbox is set to Procurement@splservices.com.au to capture weekly finance spend reports automatically.',
        permissionRequired: 'manage_settings'
      }
    ]
  }
};

// ── Global Role-Based Fallback Tips ───────────────────────────────────────────
const GLOBAL_ROLE_TIPS: ScreenInsight[] = [
  {
    id: 'g-appr-decisions',
    category: 'APPROVER',
    badgeLabel: 'Approver Hint',
    title: 'Transparent Approval Decisions',
    tip: 'Adding decision remarks when approving or rejecting orders creates a permanent audit log that speeds up finance verification.',
    permissionRequired: 'approve_requests'
  },
  {
    id: 'g-rec-dockets',
    category: 'RECEIVING',
    badgeLabel: 'Receiving Guide',
    title: 'Always Log Docket Numbers',
    tip: 'Entering the physical delivery docket number upon receipt is essential for 3-way matching when finance reconciles supplier invoices.'
  },
  {
    id: 'g-proc-po-link',
    category: 'PROCUREMENT',
    badgeLabel: 'Procurement Step',
    title: 'Concur PO Linkage Unlocks Receiving',
    tip: 'Orders cannot be receipted in the warehouse until the formal Concur PO # is attached, ensuring all deliveries match ERP commitments.',
    permissionRequired: 'link_concur'
  },
  {
    id: 'g-req-need-by',
    category: 'REQUESTER',
    badgeLabel: 'Ordering Tip',
    title: 'Need-By Date Lead Times',
    tip: 'Provide at least standard supplier lead time (usually 5–10 business days) on your Need-By dates to avoid rush freight surcharges.'
  }
];

interface InsightsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InsightsDrawer({ isOpen, onClose }: InsightsDrawerProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Resolve active screen metadata based on route
  const currentRouteMeta = useMemo(() => {
    const path = location.pathname;
    if (ROUTE_INSIGHTS_MAP[path]) return ROUTE_INSIGHTS_MAP[path];
    // Prefix matches
    for (const key of Object.keys(ROUTE_INSIGHTS_MAP)) {
      if (key !== '/' && path.startsWith(key)) {
        return ROUTE_INSIGHTS_MAP[key];
      }
    }
    return ROUTE_INSIGHTS_MAP['/'];
  }, [location.pathname]);

  // Combined tips for this screen + global relevant tips
  const combinedTips = useMemo(() => {
    const screenTips = currentRouteMeta.primaryTips || [];
    const all = [...screenTips, ...GLOBAL_ROLE_TIPS];
    // Deduplicate by ID
    const seen = new Set<string>();
    return all.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      if (t.permissionRequired && !hasPermission(t.permissionRequired)) return false;
      return true;
    });
  }, [currentRouteMeta, hasPermission]);

  // Filtered by category and search
  const filteredTips = useMemo(() => {
    return combinedTips.filter(tip => {
      if (selectedCategory !== 'ALL' && tip.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          tip.title.toLowerCase().includes(q) ||
          tip.tip.toLowerCase().includes(q) ||
          tip.badgeLabel.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [combinedTips, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  const ScreenIcon = currentRouteMeta.icon;

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
      {/* Backdrop blur overlay */}
      <div 
        className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-md sm:max-w-lg bg-white dark:bg-nocturne h-full shadow-2xl border-l border-gray-200 dark:border-white/10 flex flex-col z-10 animate-slide-in-right overflow-hidden">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-gray-950 dark:text-white uppercase tracking-wider">
                  ProcureFlow Insights
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  Live Guidance
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Helpful hints &amp; best practices for this screen
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Close Insights Drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Active Screen Context Banner */}
        <div className="p-4 bg-gray-50/80 dark:bg-white/5 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl bg-white dark:bg-gray-800 shadow-2xs shrink-0 ${currentRouteMeta.accentColor}`}>
              <ScreenIcon size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                Active Screen Context
              </span>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                {currentRouteMeta.screenTitle}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                {currentRouteMeta.screenSubtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Search & Category Filter Pills */}
        <div className="p-4 border-b border-gray-100 dark:border-white/10 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tips, guidelines, shortcuts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-900 dark:text-white focus:border-amber-500 outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide text-xs font-bold pb-0.5">
            {['ALL', 'REQUESTER', 'APPROVER', 'PROCUREMENT', 'RECEIVING'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                }`}
              >
                {cat === 'ALL' ? 'All Tips' : cat.charAt(0) + cat.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Tips Cards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {filteredTips.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs space-y-2">
              <Lightbulb size={24} className="mx-auto text-gray-300 dark:text-gray-600" />
              <p className="font-bold">No tips match your search.</p>
              <p className="text-[11px] text-gray-500">Try searching for a different keyword or switch the role category tab.</p>
            </div>
          ) : (
            filteredTips.map((tip) => (
              <div
                key={tip.id}
                className="p-4 rounded-2xl border border-gray-200/90 dark:border-white/10 bg-white dark:bg-gray-900/60 shadow-2xs hover:shadow-md transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                    {tip.badgeLabel}
                  </span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {tip.category}
                  </span>
                </div>

                <h5 className="text-sm font-bold text-gray-900 dark:text-white leading-snug group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  {tip.title}
                </h5>

                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-normal">
                  {tip.tip}
                </p>

                {tip.actionText && tip.actionPath && (
                  <div className="pt-2 border-t border-gray-100 dark:border-white/5 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate(tip.actionPath!);
                      }}
                      className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{tip.actionText}</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Bottom Drawer Footer */}
        <div className="p-3.5 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span className="text-[11px] font-medium">
            Showing {filteredTips.length} tailored guidance note{filteredTips.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-bold bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl transition-all cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
