import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, CheckCircle2, Package, 
  Link as LinkIcon, ClipboardList, 
  ChevronRight, Sparkles, Layers,
  DollarSign
} from 'lucide-react';
import { ItemRequest } from '../types';
import { useApp } from '../context/AppContext';
import PageHeader from './PageHeader';
import {
  getMyItemRequests,
  getRequestsForMasterData,
  getRequestsForPricing,
} from '../services/itemRequestService';
import { getSessionLaundryInsight } from '../constants/linenFacts';

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
  path: string;
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
  const [state, setState] = React.useState<HomeInsightState>({
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
  } = useApp();
  const navigate = useNavigate();
  const insights = useHomeInsights();
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.roleIds?.includes('ADMIN');

  const pendingApprovals = React.useMemo(() => 
    pos.filter(p => p.status === 'PENDING_APPROVAL' && (activeSiteIds.length === 0 || activeSiteIds.includes(p.siteId))),
    [pos, activeSiteIds]
  );

  const pendingConcur = React.useMemo(() => 
    pos.filter(p => (p.status === 'APPROVED_PENDING_CONCUR' || p.status === 'APPROVED_PENDING_CONCUR_REQUEST') && (activeSiteIds.length === 0 || activeSiteIds.includes(p.siteId))),
    [pos, activeSiteIds]
  );

  const activeOrders = React.useMemo(() => 
    pos.filter(p => (p.status === 'ACTIVE' || p.status === 'RECEIVED') && (activeSiteIds.length === 0 || activeSiteIds.includes(p.siteId))),
    [pos, activeSiteIds]
  );

  const myPendingApprovals = React.useMemo(() => 
    (currentUser?.role === 'APPROVER' || currentUser?.roleIds?.includes('APPROVER') || isAdmin || hasPermission('approve_requests')) 
      ? pendingApprovals 
      : [], 
    [currentUser, isAdmin, hasPermission, pendingApprovals]
  );

  const globalPendingConcur = React.useMemo(() => 
    hasPermission('link_concur') ? pendingConcur : [], 
    [hasPermission, pendingConcur]
  );

  const myPendingConcurSync = React.useMemo(() => 
    pendingConcur.filter(p => p.requesterId === currentUser?.id && !hasPermission('link_concur')), 
    [pendingConcur, currentUser, hasPermission]
  );

  const actionConcur = React.useMemo(() => 
    globalPendingConcur.length > 0 ? globalPendingConcur : myPendingConcurSync, 
    [globalPendingConcur, myPendingConcurSync]
  );

  const myPendingDeliveries = React.useMemo(() => activeOrders.filter(p => {
    if (isAdmin) return true;
    if (p.requesterId !== currentUser?.id) return false;
    const remaining = p.lines.reduce((acc, line) => acc + (line.quantityOrdered - (line.quantityReceived || 0)), 0);
    return remaining > 0;
  }), [currentUser, isAdmin, activeOrders]);

  const masterDataQueueCount = React.useMemo(() => 
    hasPermission('manage_item_definition') 
      ? insights.masterDataRequests.filter(r => ['SUBMITTED', 'DUPLICATE_REVIEW', 'PROCUREMENT_REVIEW', 'DATA_REVIEW'].includes(r.status)).length 
      : 0,
    [hasPermission, insights.masterDataRequests]
  );

  const pricingQueueCount = React.useMemo(() => 
    (hasPermission('manage_sell_pricing') || hasPermission('manage_purchase_pricing')) 
      ? insights.pricingRequests.length 
      : 0,
    [hasPermission, insights.pricingRequests]
  );

  const tasks = React.useMemo<ActionTask[]>(() => {
    const t: ActionTask[] = [];
    
    if (myPendingApprovals.length > 0) {
      t.push({
        id: 'approvals',
        title: 'Pending Approvals',
        count: myPendingApprovals.length,
        desc: 'Review and approve or reject purchase requests.',
        icon: CheckCircle2,
        color: 'amber',
        path: '/approvals',
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
        path: '/requests',
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
        path: '/requests',
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

  const approvedTodayCount = React.useMemo(() => {
    return pos.filter(p => {
      if (activeSiteIds.length > 0 && !activeSiteIds.includes(p.siteId)) return false;
      const h = p.approvalHistory.find(hist => hist.action === 'APPROVED');
      return h && new Date(h.date).toDateString() === new Date().toDateString();
    }).length;
  }, [pos, activeSiteIds]);

  const activeSpendsK = React.useMemo(() => {
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
  const laundryInsight = React.useMemo(() => getSessionLaundryInsight(), [currentUser?.id]);
  const isCustomOrAnnouncement = messageType === 'announcement' || (homeExperience?.quoteMode === 'custom' && Boolean(homeExperience.quoteText?.trim()));
  const customMessage = messageType === 'announcement'
    ? (homeExperience?.quoteText?.trim() || 'No announcement is currently active.')
    : (homeExperience?.quoteText?.trim() || '');
  const greeting = applyTemplate(greetingTemplate, templateValues);
  const dailyMessage = applyTemplate(customMessage, templateValues);
  const dailyMessageLabel = messageType === 'announcement' ? 'Announcement' : 'Laundry Insights';

  const totalActionItemCount = tasks.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-7.25rem)] max-w-7xl flex-col gap-4 overflow-hidden animate-page-entry">
      <PageHeader title="Home" subtitle="Workspace" />

      <section className="relative flex-1 overflow-hidden rounded-[1.75rem] border border-transparent bg-transparent text-gray-950 shadow-none dark:border-white/10 dark:bg-nocturne dark:text-white dark:shadow-2xl">
        <div className="relative flex min-h-[520px] flex-col gap-6 p-4 sm:p-5 lg:p-6">
          
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-black leading-tight text-gray-950 md:text-4xl xl:text-[2.85rem] dark:text-white">
                {greeting}
              </h1>
            </div>

            <div className="rounded-2xl border border-gray-200/80 bg-white/85 px-4 py-3 shadow-[0_14px_35px_rgba(15,23,42,0.08)] lg:w-[360px] dark:border-white/10 dark:bg-[#15171e] dark:shadow-none">
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

          <div className="min-h-0 flex-1 border-t border-gray-200/70 pt-5 dark:border-white/10">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-tranquil/10 flex items-center justify-center text-tranquil border border-tranquil/20 shadow-sm">
                  <ClipboardList size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-tranquil">Action Center</p>
                  <h2 className="text-lg font-black leading-tight text-gray-950 sm:text-xl dark:text-white">Active Tasks & Operations</h2>
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
              
              <div className="lg:col-span-2 space-y-3.5">
                {tasks.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => navigate(task.path)}
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
                  <div className="py-12 px-6 flex flex-col items-center justify-center text-center bg-white dark:bg-[#15171e] rounded-2xl border border-dashed border-gray-200 dark:border-white/10 shadow-sm">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-3 shadow-inner">
                      <CheckCircle2 size={28} />
                    </div>
                    <h3 className="font-bold text-base text-gray-900 dark:text-white">All Caught Up!</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No pending tasks require your immediate attention.</p>
                  </div>
                )}
              </div>

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

                <div className="p-4 rounded-2xl bg-gradient-to-br from-white to-gray-50/80 dark:from-[#15171e] dark:to-[#1a1d27] border border-gray-200/80 dark:border-white/10 shadow-sm space-y-3">
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Quick Actions</h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Jump directly to operations</p>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => navigate('/requests')}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-surface border border-default hover:border-[var(--color-brand)]/40 hover:shadow-sm transition-all group text-left"
                    >
                      <span className="text-xs font-bold text-gray-900 dark:text-white">View All Requests</span>
                      <ArrowRight size={14} className="text-gray-400 group-hover:translate-x-1 group-hover:text-[var(--color-brand)] transition-all" />
                    </button>

                    {hasPermission('create_request') && (
                      <button
                        type="button"
                        onClick={() => navigate('/create-request')}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-[var(--color-brand)] text-white rounded-xl font-bold shadow-md shadow-[var(--color-brand)]/20 hover:opacity-95 active:scale-98 transition-all text-xs"
                      >
                        Create New Request <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>
      </section>
    </div>
  );
}
