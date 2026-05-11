import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  DollarSign,
} from 'lucide-react';
import { ItemRequest } from '../types';
import { useApp } from '../context/AppContext';
import PageHeader from './PageHeader';
import {
  getMyItemRequests,
  getRequestsForMasterData,
  getRequestsForPricing,
} from '../services/itemRequestService';

type IconType = React.ComponentType<{ size?: number; className?: string }>;

interface CommandApp {
  id: string;
  title: string;
  label: string;
  description: string;
  path: string;
  icon: IconType;
  visible: boolean;
  metric: number | string;
  metricLabel: string;
  detail: string;
  signals: string[];
  accent: string;
  iconTone: string;
  glow: string;
}

interface HomeInsightState {
  isLoading: boolean;
  hasPartialError: boolean;
  myItemRequests: ItemRequest[];
  masterDataRequests: ItemRequest[];
  pricingRequests: ItemRequest[];
}

const greetingOptions = [
  'Good day, {first_name}. Your workspace is focused.',
  'Welcome back, {first_name}. Your next move is ready.',
  '{first_name}, MercerFlow has prioritised the work that matters.',
  'Good to see you, {first_name}. Start with the signal that creates flow.',
  '{first_name}, your command view is tuned for {site_label}.',
];

const dailyQuotes = [
  'Progress improves when the next best action is obvious.',
  'Small improvements, repeated daily, become operational advantage.',
  'Clear priorities turn busy teams into effective teams.',
  'Leadership is making the important work easier to see.',
  'Quality improves when decisions are visible, timely, and owned.',
  'Continuous improvement starts with one well-chosen action.',
  'The strongest systems reduce noise before they ask for effort.',
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
  const [activeAppId, setActiveAppId] = React.useState<string | null>(null);

  const procurementSignals = React.useMemo(() => {
    const pendingApprovals = hasPermission('approve_requests')
      ? pos.filter(po => po.status === 'PENDING_APPROVAL').length
      : 0;
    const pendingConcur = hasPermission('link_concur')
      ? pos.filter(po => po.status === 'APPROVED_PENDING_CONCUR' || po.status === 'APPROVED_PENDING_CONCUR_REQUEST').length
      : 0;
    const openDeliveries = pos.filter(po => {
      if (po.status !== 'ACTIVE' && po.status !== 'RECEIVED') return false;
      if (currentUser?.role !== 'ADMIN' && po.requesterId !== currentUser?.id) return false;
      return po.lines.some(line => (line.quantityOrdered - (line.quantityReceived || 0)) > 0 && !line.isForceClosed);
    }).length;
    const uncapitalisedLines = hasPermission('manage_finance')
      ? pos.flatMap(po => po.deliveries.flatMap(delivery => delivery.lines)).filter(line => !line.isCapitalised).length
      : 0;

    return { pendingApprovals, pendingConcur, openDeliveries, uncapitalisedLines };
  }, [currentUser?.id, currentUser?.role, hasPermission, pos]);

  const itemSignals = React.useMemo(() => {
    const masterDataQueue = insights.masterDataRequests.filter(request =>
      ['SUBMITTED', 'DUPLICATE_REVIEW', 'PROCUREMENT_REVIEW', 'DATA_REVIEW'].includes(request.status)
    ).length;
    const myRevisionRequired = insights.myItemRequests.filter(request => request.status === 'REVISION_REQUIRED').length;
    const activeMyItems = insights.myItemRequests.filter(request =>
      !['ACTIVE', 'REJECTED', 'REPLACED', 'RETIRED'].includes(request.status)
    ).length;

    return {
      activeMyItems,
      masterDataQueue,
      myRevisionRequired,
      pricingQueue: insights.pricingRequests.length,
    };
  }, [insights.masterDataRequests, insights.myItemRequests, insights.pricingRequests.length]);

  const commandApps = React.useMemo<CommandApp[]>(() => {
    const apps: CommandApp[] = [
      {
        id: 'items',
        title: 'Item Management',
        label: 'Catalogue lifecycle',
        description: 'Govern requests, queues, and catalogue visibility.',
        path: hasPermission('manage_item_definition') ? '/items/master-data-queue' : '/items/my-requests',
        icon: BookOpen,
        visible: hasPermission('view_dashboard') || hasPermission('view_items') || hasPermission('manage_item_definition'),
        metric: itemSignals.activeMyItems + itemSignals.masterDataQueue + itemSignals.myRevisionRequired,
        metricLabel: 'item signals',
        detail: 'Create item requests, respond to revisions, complete master-data review, and inspect catalogue readiness.',
        signals: [
          `${itemSignals.masterDataQueue} setup queue`,
          `${itemSignals.myRevisionRequired} revisions`,
          `${itemSignals.activeMyItems} in your flow`,
        ],
        accent: 'from-emerald-300/30 via-emerald-500/15 to-tranquil/10 text-emerald-100',
        iconTone: '!text-emerald-500 dark:!text-emerald-200',
        glow: 'shadow-emerald-500/15',
      },
      {
        id: 'procurement',
        title: 'Procurement',
        label: 'Request operations',
        description: 'Move purchase activity from request to receiving.',
        path: '/procurement/dashboard',
        icon: ClipboardCheck,
        visible: hasPermission('view_dashboard'),
        metric: procurementSignals.pendingApprovals + procurementSignals.pendingConcur + procurementSignals.openDeliveries,
        metricLabel: 'procurement signals',
        detail: 'Review the request pipeline, resolve approvals, link Concur references, and monitor active delivery work.',
        signals: [
          `${procurementSignals.pendingApprovals} approvals`,
          `${procurementSignals.pendingConcur} Concur links`,
          `${procurementSignals.openDeliveries} receiving actions`,
        ],
        accent: 'from-tranquil/35 via-cyan-400/15 to-sky-500/10 text-cyan-100',
        iconTone: '!text-cyan-500 dark:!text-cyan-100',
        glow: 'shadow-cyan-500/15',
      },
      {
        id: 'pricing',
        title: 'Pricing',
        label: 'Price governance',
        description: 'Resolve price reviews and future schedules.',
        path: hasPermission('manage_sell_pricing') ? '/pricing/dashboard' : '/items/pricing-queue',
        icon: DollarSign,
        visible: hasPermission('manage_sell_pricing') || hasPermission('manage_purchase_pricing') || hasPermission('manage_pricing_schedules'),
        metric: itemSignals.pricingQueue,
        metricLabel: 'pricing reviews',
        detail: 'Resolve pricing queues, maintain price records, and prepare schedule activity before catalogue approval.',
        signals: [
          `${itemSignals.pricingQueue} open reviews`,
          hasPermission('manage_pricing_schedules') ? 'Schedules enabled' : 'Queue access',
          'Margin-aware review',
        ],
        accent: 'from-amber-300/35 via-yellow-500/15 to-orange-500/10 text-amber-100',
        iconTone: '!text-amber-500 dark:!text-amber-100',
        glow: 'shadow-amber-500/15',
      },
      {
        id: 'finance',
        title: 'Finance',
        label: 'Financial review',
        description: 'Check capitalisation and cost impact.',
        path: '/finance',
        icon: BarChart3,
        visible: hasPermission('view_finance') || hasPermission('manage_finance'),
        metric: procurementSignals.uncapitalisedLines,
        metricLabel: 'finance checks',
        detail: 'Review capitalisation, received-goods finance signals, invoice details, and cost reporting.',
        signals: [
          `${procurementSignals.uncapitalisedLines} checks`,
          'Reports available',
          'Cost impact view',
        ],
        accent: 'from-indigo-300/30 via-blue-500/15 to-violet-500/10 text-blue-100',
        iconTone: '!text-blue-500 dark:!text-blue-100',
        glow: 'shadow-blue-500/15',
      },
    ];

    return apps.filter(app => app.visible);
  }, [hasPermission, itemSignals, procurementSignals]);

  const activeApp = commandApps.find(app => app.id === activeAppId) ?? null;
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
    app_name: branding.appName || 'MercerFlow',
  };
  const greetingTemplate = homeExperience?.greetingMode === 'custom' && homeExperience.greetingText?.trim()
    ? homeExperience.greetingText
    : greetingOptions[getDayIndex(currentUser?.id || firstName, greetingOptions.length)];
  const messageType = homeExperience?.messageType || 'quote';
  const quoteTemplate = messageType === 'announcement'
    ? (homeExperience?.quoteText?.trim() || 'No announcement is currently active.')
    : homeExperience?.quoteMode === 'custom' && homeExperience.quoteText?.trim()
      ? homeExperience.quoteText
      : dailyQuotes[getDayIndex(`${currentUser?.id || firstName}-quote`, dailyQuotes.length)];
  const greeting = applyTemplate(greetingTemplate, templateValues);
  const dailyMessage = applyTemplate(quoteTemplate, templateValues);
  const dailyMessageLabel = messageType === 'announcement' ? 'Announcement' : "Today's focus";

  React.useEffect(() => {
    if (activeAppId && !commandApps.some(app => app.id === activeAppId)) {
      setActiveAppId(null);
    }
  }, [activeAppId, commandApps]);

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

            <div className="rounded-2xl border border-gray-200/80 bg-white/85 px-4 py-3 shadow-[0_14px_35px_rgba(15,23,42,0.08)] lg:w-[330px] dark:border-white/10 dark:bg-[#15171e] dark:shadow-none">
              <p className="text-[10px] font-black uppercase tracking-widest text-tranquil">{dailyMessageLabel}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-gray-700 dark:text-white/70">{dailyMessage}</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 border-t border-gray-200/70 pt-5 dark:border-white/10">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-tranquil">App drawer</p>
                <h2 className="mt-1 text-xl font-black leading-tight text-gray-950 dark:text-white">MercerFlow Apps</h2>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-white/30">{commandApps.length} available</p>
            </div>

            {commandApps.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {commandApps.map(app => {
                  const Icon = app.icon;
                  const isActive = activeApp?.id === app.id;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => setActiveAppId(isActive ? null : app.id)}
                      aria-expanded={isActive}
                      className={`group relative min-h-[126px] transform-gpu overflow-hidden rounded-[1.25rem] border p-3 text-left transition-all duration-300 sm:min-h-[172px] sm:rounded-[1.35rem] sm:p-4 lg:min-h-[194px] ${
                        isActive
                          ? `-translate-y-1 scale-[1.02] border-tranquil/70 bg-white shadow-[0_24px_50px_rgba(18,157,192,0.22),0_8px_18px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.95)] dark:bg-[#1d2029] dark:shadow-2xl ${app.glow}`
                          : 'border-gray-200/85 bg-white shadow-[0_18px_42px_rgba(15,23,42,0.13),0_7px_16px_rgba(15,23,42,0.06),0_2px_0_rgba(255,255,255,0.95)_inset] hover:-translate-y-1 hover:border-tranquil/35 hover:shadow-[0_26px_55px_rgba(15,23,42,0.16),0_9px_18px_rgba(15,23,42,0.07),0_2px_0_rgba(255,255,255,0.95)_inset] active:translate-y-0 dark:border-white/10 dark:bg-[#15171e] dark:shadow-[0_18px_42px_rgba(0,0,0,0.3)] dark:hover:border-white/22 dark:hover:bg-[#1d2029]'
                      }`}
                    >
                      <div className={`absolute inset-x-0 top-0 h-16 bg-gradient-to-br ${app.accent} opacity-55 transition-opacity group-hover:opacity-80 sm:h-24 dark:opacity-70 dark:group-hover:opacity-100`} />
                      <div className="absolute inset-x-4 bottom-0 h-px bg-white/80 dark:bg-white/5" />
                      <div className="relative flex h-full flex-col justify-between">
                        <div>
                          <div className="mb-2 flex items-start justify-between sm:mb-3">
                            <span className={`flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/60 bg-gradient-to-br ${app.accent} shadow-[0_10px_24px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur sm:h-12 sm:w-12 sm:rounded-[1.05rem] dark:border-white/15`}>
                              <Icon size={21} className={`${app.iconTone} sm:size-6`} />
                            </span>
                            <span className={`flex h-7 w-7 items-center justify-center rounded-xl border transition-all sm:h-9 sm:w-9 sm:rounded-2xl ${
                              isActive ? 'rotate-90 border-tranquil bg-tranquil text-white' : 'border-gray-200 bg-white/65 text-gray-500 group-hover:bg-tranquil group-hover:text-white dark:border-white/10 dark:bg-nocturne/40 dark:text-white/55'
                            }`}>
                              <ArrowRight size={14} className="sm:size-4" />
                            </span>
                          </div>
                          <p className="hidden text-[9px] font-black uppercase tracking-widest text-gray-500 sm:block dark:text-white/55">{app.label}</p>
                          <h2 className="mt-1 text-[15px] font-black leading-tight text-gray-950 sm:text-xl dark:text-white">{app.title}</h2>
                          <p className="mt-2 hidden text-sm leading-5 text-gray-600 sm:line-clamp-2 dark:text-white/70">{app.description}</p>
                        </div>
                        <div className="mt-2 flex items-end justify-between sm:mt-4">
                          <div>
                            <p className="text-xl font-black text-gray-950 sm:text-2xl dark:text-white">{app.metric}</p>
                            <p className="max-w-[84px] truncate text-[8px] font-black uppercase tracking-widest text-gray-500 sm:max-w-none sm:text-[9px] dark:text-white/50">{app.metricLabel}</p>
                          </div>
                          <span className="hidden rounded-full border border-gray-200 bg-white/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-gray-500 sm:inline-flex dark:border-white/10 dark:bg-white/10 dark:text-white/55">
                            {isActive ? 'Selected' : 'Open view'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 text-sm font-semibold text-gray-600 dark:border-white/10 dark:bg-[#15171e] dark:text-white/70">
                No module apps are available for your current access. Contact an administrator if this looks incorrect.
              </div>
            )}

            <div className={`grid transition-all duration-300 ease-out ${activeApp ? 'mt-4 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
                {activeApp && (
                  <div className="rounded-[1.35rem] border border-gray-200/80 bg-white/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_16px_35px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#15171e] dark:shadow-inner">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-tranquil">App expanded</p>
                        <h3 className="mt-1 text-2xl font-black text-gray-950 dark:text-white">{activeApp.title}</h3>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-white/60">{activeApp.detail}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(activeApp.path)}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-tranquil px-5 py-3 text-sm font-black text-white shadow-lg shadow-tranquil/20 transition hover:bg-[#0f87a8] active:scale-[0.98]"
                      >
                        Open {activeApp.title}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {activeApp.signals.map(signal => (
                        <div key={signal} className="rounded-xl border border-gray-200 bg-white/75 px-3 py-2 text-xs font-bold text-gray-600 dark:border-white/10 dark:bg-[#11141b] dark:text-white/70">
                          {signal}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {insights.hasPartialError && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-700 dark:text-amber-100">
          Some live item signals are unavailable. Module routing remains available.
        </div>
      )}
    </div>
  );
}
