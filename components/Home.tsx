import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ItemRequest } from '../types';
import { useApp } from '../context/AppContext';
import PageHeader from './PageHeader';
import {
  getMyItemRequests,
  getRequestsForMasterData,
  getRequestsForPricing,
} from '../services/itemRequestService';

import catalogFlowLogo from '../docs/Logo Branding/APP-LOGOS/CatalogFlow-Logo.png';
import priceFlowLogo from '../docs/Logo Branding/APP-LOGOS/PriceFlow-Logo.png';
import procureFlowLogo from '../docs/Logo Branding/APP-LOGOS/ProcureFlow-Logo.png';

interface CommandApp {
  id: string;
  title: string;
  brandName: string;
  label: string;
  description: string;
  path: string;
  logo: string;
  logoPosition?: string;
  visible: boolean;
  metric: number | string;
  metricLabel: string;
  metricLabelShort: string;
  detail: string;
  signals: string[];
  brandColor: string;
  brandRgb: string;
  brandGlow: string;
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
    return { pendingApprovals, pendingConcur, openDeliveries };
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
        brandName: 'CatalogFlow',
        label: 'Catalogue lifecycle',
        description: 'Govern requests, queues, and catalogue visibility.',
        path: hasPermission('manage_item_definition') ? '/items/master-data-queue' : '/items/my-requests',
        logo: catalogFlowLogo,
        logoPosition: 'center 66%',
        visible: hasPermission('view_dashboard') || hasPermission('view_items') || hasPermission('manage_item_definition'),
        metric: itemSignals.activeMyItems + itemSignals.masterDataQueue + itemSignals.myRevisionRequired,
        metricLabel: 'item signals',
        metricLabelShort: 'signals',
        detail: 'Create item requests, respond to revisions, complete master-data review, and inspect catalogue readiness.',
        signals: [
          `${itemSignals.masterDataQueue} setup queue`,
          `${itemSignals.myRevisionRequired} revisions`,
          `${itemSignals.activeMyItems} in your flow`,
        ],
        brandColor: '#9d4edd',
        brandRgb: '157,78,221',
        brandGlow: 'rgba(157,78,221,0.24)',
      },
      {
        id: 'procurement',
        title: 'Procurement',
        brandName: 'ProcureFlow',
        label: 'Request operations',
        description: 'Move purchase activity from request to receiving.',
        path: '/procurement/dashboard',
        logo: procureFlowLogo,
        logoPosition: 'center 66%',
        visible: hasPermission('view_dashboard'),
        metric: procurementSignals.pendingApprovals + procurementSignals.pendingConcur + procurementSignals.openDeliveries,
        metricLabel: 'procurement signals',
        metricLabelShort: 'signals',
        detail: 'Review the request pipeline, resolve approvals, link Concur references, and monitor active delivery work.',
        signals: [
          `${procurementSignals.pendingApprovals} approvals`,
          `${procurementSignals.pendingConcur} Concur links`,
          `${procurementSignals.openDeliveries} receiving actions`,
        ],
        brandColor: '#ff8a00',
        brandRgb: '255,138,0',
        brandGlow: 'rgba(255,138,0,0.24)',
      },
      {
        id: 'pricing',
        title: 'Pricing',
        brandName: 'PriceFlow',
        label: 'Price governance',
        description: 'Resolve price reviews and future schedules.',
        path: hasPermission('manage_sell_pricing') ? '/pricing/dashboard' : '/items/pricing-queue',
        logo: priceFlowLogo,
        logoPosition: 'center 66%',
        visible: hasPermission('manage_sell_pricing') || hasPermission('manage_purchase_pricing') || hasPermission('manage_pricing_schedules'),
        metric: itemSignals.pricingQueue,
        metricLabel: 'pricing reviews',
        metricLabelShort: 'reviews',
        detail: 'Resolve pricing queues, maintain price records, and prepare schedule activity before catalogue approval.',
        signals: [
          `${itemSignals.pricingQueue} open reviews`,
          hasPermission('manage_pricing_schedules') ? 'Schedules enabled' : 'Queue access',
          'Margin-aware review',
        ],
        brandColor: '#58bf43',
        brandRgb: '88,191,67',
        brandGlow: 'rgba(88,191,67,0.24)',
      },
    ];

    return apps.filter(app => app.visible);
  }, [hasPermission, itemSignals, procurementSignals]);

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
                <h2 className="mt-1 text-lg font-black leading-tight text-gray-950 sm:text-xl dark:text-white">MercerFlow Apps</h2>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-white/30">{commandApps.length} available</p>
            </div>

            {commandApps.length > 0 ? (
              <div className="grid grid-cols-2 items-start gap-3 sm:gap-4 xl:grid-cols-3">
                {commandApps.map(app => {
                  const isActive = activeAppId === app.id;
                  const appTileStyle = {
                    '--app-color': app.brandColor,
                    '--app-rgb': app.brandRgb,
                    boxShadow: isActive
                      ? `0 26px 56px ${app.brandGlow}, 0 10px 22px rgba(15,23,42,0.1), inset 0 1px 0 rgba(255,255,255,0.95)`
                      : '0 18px 42px rgba(15,23,42,0.13), 0 7px 16px rgba(15,23,42,0.06), inset 0 2px 0 rgba(255,255,255,0.95)',
                  } as React.CSSProperties;
                  return (
                    <article
                      key={app.id}
                      style={appTileStyle}
                      className={`group relative transform-gpu overflow-hidden rounded-[1.25rem] border text-left transition-all duration-300 sm:rounded-[1.35rem] ${
                        isActive
                          ? 'border-[color:var(--app-color)] bg-white dark:bg-[#1d2029]'
                          : 'min-h-[184px] border-gray-200/85 bg-white hover:-translate-y-1 hover:border-[color:var(--app-color)] active:translate-y-0 sm:min-h-[252px] dark:border-white/10 dark:bg-[#15171e] dark:hover:border-[color:var(--app-color)] dark:hover:bg-[#1d2029]'
                      }`}
                    >
                      <div
                        className={`absolute inset-x-0 top-0 opacity-90 transition-opacity group-hover:opacity-100 ${isActive ? 'h-[170px] sm:h-[210px]' : 'h-[92px] sm:h-[134px]'}`}
                        style={{
                          background: `linear-gradient(135deg, rgba(${app.brandRgb},0.16), rgba(${app.brandRgb},0.04) 46%, rgba(255,255,255,0) 100%)`,
                        }}
                      />
                      <div className="relative flex h-full flex-col">
                        <button
                          type="button"
                          onClick={() => setActiveAppId(isActive ? null : app.id)}
                          aria-expanded={isActive}
                          aria-label={`${isActive ? 'Collapse' : 'Expand'} ${app.brandName}`}
                          className="relative block w-full text-left"
                        >
                          <div className="relative m-2 overflow-hidden rounded-[1rem] border border-white/15 bg-[#100d0f] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:m-3 sm:rounded-[1.1rem]">
                            <div className="relative overflow-hidden">
                              <div
                                className="absolute inset-0"
                                style={{
                                  background: `radial-gradient(circle at 80% 35%, rgba(${app.brandRgb},0.26), transparent 36%), linear-gradient(135deg, #1a1416 0%, #080809 100%)`,
                                }}
                              />
                              <img
                                src={app.logo}
                                alt={`${app.brandName} logo`}
                                className="relative h-[128px] w-full object-cover opacity-95 transition duration-300 group-hover:scale-[1.03] group-hover:opacity-100 sm:h-[176px]"
                                style={{ objectPosition: app.logoPosition || 'center' }}
                              />
                              <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/55 to-transparent" />
                              <span
                                className="absolute bottom-2 right-2 h-2.5 w-8 rounded-full shadow-[0_0_18px_rgba(var(--app-rgb),0.72)] sm:w-10"
                                style={{ backgroundColor: app.brandColor }}
                                aria-hidden="true"
                              />
                            </div>
                          </div>
                        </button>

                        <div className={`flex min-h-0 flex-1 flex-col px-3 pb-3 sm:px-4 sm:pb-4 ${isActive ? 'gap-4 pt-1 sm:gap-4' : 'justify-between'}`}>
                          <div>
                            <div className="mb-1 flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-gray-500 sm:text-[10px] sm:tracking-widest dark:text-white/50">{app.label}</p>
                                <h2 className="mt-2 text-lg font-black leading-tight text-gray-950 sm:text-2xl dark:text-white">{app.brandName}</h2>
                              </div>
                              <button
                                type="button"
                                onClick={() => setActiveAppId(isActive ? null : app.id)}
                                aria-label={`${isActive ? 'Collapse details for' : 'Expand details for'} ${app.brandName}`}
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border transition-all sm:h-9 sm:w-9 sm:rounded-2xl ${
                                  isActive
                                    ? 'rotate-90 border-[color:var(--app-color)] bg-[color:var(--app-color)] text-white'
                                    : 'border-gray-200 bg-white/80 text-gray-500 group-hover:bg-[color:var(--app-color)] group-hover:text-white dark:border-white/10 dark:bg-nocturne/40 dark:text-white/55'
                                }`}
                              >
                                <ArrowRight size={14} className="sm:size-4" />
                              </button>
                            </div>
                            {isActive && (
                              <div className="mt-3 space-y-3">
                                <p className="text-xs font-semibold leading-5 text-gray-600 sm:text-sm sm:leading-6 dark:text-white/72">{app.description}</p>
                                <p className="text-xs font-medium leading-5 text-gray-600 sm:text-sm sm:leading-6 dark:text-white/60">{app.detail}</p>
                              </div>
                            )}
                          </div>

                          {isActive && (
                            <div className="grid gap-2">
                              {app.signals.map(signal => (
                                <div
                                  key={signal}
                                  className="rounded-xl border border-gray-200 bg-white/75 px-3 py-2 text-[11px] font-bold leading-4 text-gray-600 sm:text-xs dark:border-white/10 dark:bg-[#11141b] dark:text-white/70"
                                >
                                  {signal}
                                </div>
                              ))}
                            </div>
                          )}

                          <div className={`flex gap-3 ${isActive ? 'mt-auto flex-col items-stretch border-t border-gray-200/80 pt-4 dark:border-white/10 sm:gap-4' : 'mt-3 items-end justify-between sm:mt-4'}`}>
                            <div>
                              <p className={`font-black text-gray-950 dark:text-white ${isActive ? 'text-2xl sm:text-4xl' : 'text-xl sm:text-2xl'}`}>{app.metric}</p>
                              <p className="max-w-[96px] truncate text-[8px] font-black uppercase tracking-widest text-gray-500 sm:max-w-none sm:text-[9px] dark:text-white/50">
                                <span className="sm:hidden">{app.metricLabelShort}</span>
                                <span className="hidden sm:inline">{app.metricLabel}</span>
                              </p>
                            </div>
                            {isActive ? (
                              <button
                                type="button"
                                onClick={() => navigate(app.path)}
                                className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-black text-white shadow-lg transition hover:brightness-105 active:scale-[0.98] sm:px-5 sm:text-sm"
                                style={{
                                  backgroundColor: app.brandColor,
                                  boxShadow: `0 14px 28px ${app.brandGlow}`,
                                }}
                              >
                                Open app
                                <ArrowRight size={15} />
                              </button>
                            ) : (
                              <span className="hidden rounded-full border border-gray-200 bg-white/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-gray-500 sm:inline-flex dark:border-white/10 dark:bg-white/10 dark:text-white/55">
                                View
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 text-sm font-semibold text-gray-600 dark:border-white/10 dark:bg-[#15171e] dark:text-white/70">
                No module apps are available for your current access. Contact an administrator if this looks incorrect.
              </div>
            )}
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
