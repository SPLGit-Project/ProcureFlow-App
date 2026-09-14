import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  Link2,
  ListFilter,
  MapPin,
  Search,
  Truck,
  XCircle,
  Calendar,
  CheckSquare,
  Square,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Sparkles,
  Check,
  X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { POStatus, PORequest } from '../types.ts';
import ContextHelp from './ContextHelp';
import PageHeader from './PageHeader';
import { useSetPageMeta } from '../context/PageMetaContext.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { ToastContainer, useToast } from './ToastNotification';
import { formatCurrency } from '../utils/taxCalculations.ts';
import CustomerCategoryBadge from './CustomerCategoryBadge.tsx';

const getPONeedByDate = (po: PORequest): { dateStr: string | null; isOverdue: boolean } => {
  const unfulfilledWithNeedBy = po.lines.find(l => (l.quantityReceived || 0) < l.quantityOrdered && l.needByDate);
  const rawDate = unfulfilledWithNeedBy?.needByDate || po.lines.find(l => l.needByDate)?.needByDate || null;
  if (!rawDate) return { dateStr: null, isOverdue: false };

  const targetDate = new Date(rawDate).getTime();
  const now = Date.now();
  const isComplete = po.status === 'CLOSED' || po.status === 'RECEIVED';
  const isOverdue = !isComplete && targetDate < now;
  return { dateStr: rawDate, isOverdue };
};

type BaseFilter = 'ALL' | 'PENDING' | 'COMPLETED';

type QuickFilterOption = {
  id: string;
  label: string;
  statuses: POStatus[];
  icon: LucideIcon;
};

type SiteFilterOption = {
  id: string;
  label: string;
  count: number;
  siteId?: string;
  normalizedSiteName?: string;
};

const IN_PROGRESS_STATUSES: POStatus[] = ['ACTIVE', 'VARIANCE_PENDING'];
const COMPLETED_STATUSES: POStatus[] = ['RECEIVED', 'CLOSED'];

const statusLabel = (status: POStatus) => {
  if (status === 'APPROVED_PENDING_CONCUR') return 'Pending Concur PO';
  if (status === 'APPROVED_PENDING_CONCUR_REQUEST') return 'Pending Concur Req';
  if (status === 'PENDING_APPROVAL') return 'Pending Approval';
  if (status === 'VARIANCE_PENDING') return 'Variance Pending';
  if (status === 'DRAFT') return 'Draft';
  return status.replace(/_/g, ' ');
};

const quickFilterConfigByPage = (filter: BaseFilter): QuickFilterOption[] => {
  if (filter === 'PENDING') {
    return [
      {
        id: 'pending-approval',
        label: 'Pending Approval',
        statuses: ['PENDING_APPROVAL'],
        icon: Clock3
      }
    ];
  }

  if (filter === 'COMPLETED') {
    return [
      {
        id: 'all-completed',
        label: 'All Completed',
        statuses: COMPLETED_STATUSES,
        icon: CheckCircle2
      },
      {
        id: 'received',
        label: 'Received',
        statuses: ['RECEIVED'],
        icon: Truck
      },
      {
        id: 'closed',
        label: 'Closed',
        statuses: ['CLOSED'],
        icon: CheckCircle2
      }
    ];
  }

  return [
    {
      id: 'all',
      label: 'All Requests',
      statuses: [
        'PENDING_APPROVAL',
        'APPROVED_PENDING_CONCUR_REQUEST',
        'APPROVED_PENDING_CONCUR',
        ...IN_PROGRESS_STATUSES,
        ...COMPLETED_STATUSES,
        'REJECTED',
        'DRAFT'
      ],
      icon: ListFilter
    },
    {
      id: 'drafts',
      label: 'Drafts',
      statuses: ['DRAFT'],
      icon: Bookmark
    },
    {
      id: 'pending-approval',
      label: 'Pending Approval',
      statuses: ['PENDING_APPROVAL'],
      icon: Clock3
    },
    {
      id: 'pending-concur',
      label: 'Pending Concur',
      statuses: ['APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR'],
      icon: Link2
    },
    {
      id: 'in-progress',
      label: 'In Progress',
      statuses: IN_PROGRESS_STATUSES,
      icon: Activity
    },
    {
      id: 'received',
      label: 'Received',
      statuses: ['RECEIVED'],
      icon: Truck
    },
    {
      id: 'closed',
      label: 'Closed',
      statuses: ['CLOSED'],
      icon: CheckCircle2
    },
    {
      id: 'rejected',
      label: 'Rejected',
      statuses: ['REJECTED'],
      icon: XCircle
    }
  ];
};

const POList = ({ filter = 'ALL' }: { filter?: BaseFilter }) => {
  const { pos, hasPermission, currentUser, userSites, siteName: resolveSiteName, reloadData, updatePOsNeedByDate } = useApp();
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.roleIds?.includes('ADMIN');
  useSetPageMeta({ disableBodyScroll: true });
  const location = useLocation();
  const navigate = useNavigate();
  const { toasts, dismissToast, success } = useToast();
  const handledDeleteNotificationRef = useRef<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Need-by Date Mass Update State (Admin)
  const [selectedPoIds, setSelectedPoIds] = useState<string[]>([]);
  const [massNeedByDate, setMassNeedByDate] = useState<string>('');
  const [isMassUpdating, setIsMassUpdating] = useState<boolean>(false);
  const [showMassUpdateModal, setShowMassUpdateModal] = useState<boolean>(false);
  const [isMassUpdateConfirmed, setIsMassUpdateConfirmed] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const masterCheckboxRef = useRef<HTMLInputElement | null>(null);
  const quickFilters = useMemo(() => quickFilterConfigByPage(filter), [filter]);
  const [selectedQuickFilterId, setSelectedQuickFilterId] = useState<string>(quickFilters[0]?.id ?? 'all');
  const [selectedSiteFilterId, setSelectedSiteFilterId] = useState<string>('all-sites');
  const [hydratedQuickStorageKey, setHydratedQuickStorageKey] = useState<string | null>(null);
  const [hydratedSiteStorageKey, setHydratedSiteStorageKey] = useState<string | null>(null);
  const quickFilterStorageKey = useMemo(
    () => `pf_requests_last_filter:${currentUser?.id ?? 'anonymous'}:${filter}`,
    [currentUser?.id, filter]
  );
  const siteFilterStorageKey = useMemo(
    () => `pf_requests_last_site_filter:${currentUser?.id ?? 'anonymous'}:${filter}`,
    [currentUser?.id, filter]
  );

  useEffect(() => {
    if (quickFilters.length === 0) return;
    let nextFilterId = quickFilters[0].id;

    try {
      const storedFilterId = localStorage.getItem(quickFilterStorageKey);
      if (storedFilterId && quickFilters.some((option) => option.id === storedFilterId)) {
        nextFilterId = storedFilterId;
      }
    } catch (error) {
      console.warn('POList: Unable to read quick filter preference', error);
    }

    setSelectedQuickFilterId(nextFilterId);
    setHydratedQuickStorageKey(quickFilterStorageKey);
  }, [quickFilters, quickFilterStorageKey]);

  useEffect(() => {
    if (!selectedQuickFilterId) return;
    if (hydratedQuickStorageKey !== quickFilterStorageKey) return;
    if (!quickFilters.some((option) => option.id === selectedQuickFilterId)) return;

    try {
      localStorage.setItem(quickFilterStorageKey, selectedQuickFilterId);
    } catch (error) {
      console.warn('POList: Unable to persist quick filter preference', error);
    }
  }, [selectedQuickFilterId, quickFilterStorageKey, hydratedQuickStorageKey, quickFilters]);

  useEffect(() => {
    const state = location.state as { deletedRequest?: { id?: string; displayId?: string } } | null;
    const deletedRequest = state?.deletedRequest;
    if (!deletedRequest) return;

    const dedupeKey = `${deletedRequest.id || ''}:${deletedRequest.displayId || ''}:${location.key}`;
    if (handledDeleteNotificationRef.current === dedupeKey) return;
    handledDeleteNotificationRef.current = dedupeKey;

    const deletedLabel = deletedRequest.displayId || deletedRequest.id || 'Request';
    success(`${deletedLabel} deleted successfully.`, 3500);
    navigate(location.pathname, { replace: true, state: null });
    void reloadData(true);
  }, [location.key, location.pathname, location.state, navigate, reloadData, success]);

  const routeScopedPos = useMemo(() => {
    if (filter === 'PENDING') {
      return pos.filter((po) => po.status === 'PENDING_APPROVAL');
    }

    if (filter === 'COMPLETED') {
      return pos.filter((po) => COMPLETED_STATUSES.includes(po.status));
    }

    return pos;
  }, [pos, filter]);

  const siteFilterOptions = useMemo(() => {
    const siteOptionsMap = new Map<string, SiteFilterOption>();

    for (const po of routeScopedPos) {
      const trimmedSiteId = po.siteId?.trim() || '';
      const normalizedSiteName = (po.site || '').trim().toLowerCase();
      const key = trimmedSiteId ? `site:${trimmedSiteId}` : normalizedSiteName ? `name:${normalizedSiteName}` : 'unknown';

      if (!siteOptionsMap.has(key)) {
        const labelFromUserSites = trimmedSiteId ? userSites.find((site) => site.id === trimmedSiteId)?.name : '';
        const labelFromSiteName = trimmedSiteId ? resolveSiteName(trimmedSiteId) : '';
        const label = (po.site || '').trim() || labelFromUserSites || labelFromSiteName || 'Unknown Site';

        siteOptionsMap.set(key, {
          id: key,
          label,
          count: 0,
          siteId: trimmedSiteId || undefined,
          normalizedSiteName: normalizedSiteName || undefined
        });
      }

      const option = siteOptionsMap.get(key);
      if (option) {
        option.count += 1;
      }
    }

    const sortedSiteOptions = Array.from(siteOptionsMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    return [{ id: 'all-sites', label: 'All Sites', count: routeScopedPos.length }, ...sortedSiteOptions];
  }, [routeScopedPos, userSites, resolveSiteName]);

  useEffect(() => {
    if (siteFilterOptions.length === 0) return;
    let nextSiteFilterId = siteFilterOptions[0].id;

    try {
      const storedSiteFilterId = localStorage.getItem(siteFilterStorageKey);
      if (storedSiteFilterId && siteFilterOptions.some((option) => option.id === storedSiteFilterId)) {
        nextSiteFilterId = storedSiteFilterId;
      }
    } catch (error) {
      console.warn('POList: Unable to read site filter preference', error);
    }

    setSelectedSiteFilterId(nextSiteFilterId);
    setHydratedSiteStorageKey(siteFilterStorageKey);
  }, [siteFilterOptions, siteFilterStorageKey]);

  useEffect(() => {
    if (!selectedSiteFilterId) return;
    if (hydratedSiteStorageKey !== siteFilterStorageKey) return;
    if (!siteFilterOptions.some((option) => option.id === selectedSiteFilterId)) return;

    try {
      localStorage.setItem(siteFilterStorageKey, selectedSiteFilterId);
    } catch (error) {
      console.warn('POList: Unable to persist site filter preference', error);
    }
  }, [selectedSiteFilterId, siteFilterStorageKey, hydratedSiteStorageKey, siteFilterOptions]);

  const selectedSiteFilter = useMemo(
    () => siteFilterOptions.find((option) => option.id === selectedSiteFilterId) ?? siteFilterOptions[0],
    [siteFilterOptions, selectedSiteFilterId]
  );

  const siteScopedPos = useMemo(() => {
    if (!selectedSiteFilter || selectedSiteFilter.id === 'all-sites') {
      return routeScopedPos;
    }

    return routeScopedPos.filter((po) => {
      if (selectedSiteFilter.siteId) {
        return po.siteId === selectedSiteFilter.siteId;
      }

      const normalizedPoSiteName = (po.site || '').trim().toLowerCase();
      if (selectedSiteFilter.normalizedSiteName) {
        return normalizedPoSiteName === selectedSiteFilter.normalizedSiteName;
      }

      return !po.siteId && !normalizedPoSiteName;
    });
  }, [routeScopedPos, selectedSiteFilter]);

  const quickFilterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const option of quickFilters) {
      counts[option.id] = siteScopedPos.filter((po) => {
        if (!option.statuses.includes(po.status)) return false;
        if (po.status === 'DRAFT' && !isAdmin && po.requesterId !== currentUser?.id) return false;
        return true;
      }).length;
    }
    return counts;
  }, [quickFilters, siteScopedPos, isAdmin, currentUser?.id]);

  const selectedQuickFilter = useMemo(
    () => quickFilters.find((option) => option.id === selectedQuickFilterId) ?? quickFilters[0],
    [quickFilters, selectedQuickFilterId]
  );

  const filteredPos = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    const byStatus = selectedQuickFilter
      ? siteScopedPos.filter((po) => {
          if (!selectedQuickFilter.statuses.includes(po.status)) return false;
          // Non-admins only see their own drafts
          if (po.status === 'DRAFT' && !isAdmin && po.requesterId !== currentUser?.id) return false;
          return true;
        })
      : siteScopedPos;

    const bySearch = searchValue
      ? byStatus.filter((po) => {
          return (
            po.supplierName.toLowerCase().includes(searchValue) ||
            (po.displayId || po.id).toLowerCase().includes(searchValue) ||
            (po.site || '').toLowerCase().includes(searchValue) ||
            po.requesterName.toLowerCase().includes(searchValue) ||
            (po.customerName || '').toLowerCase().includes(searchValue) ||
            po.totalAmount.toString().includes(searchValue) ||
            po.concurRequestNumber?.toLowerCase().includes(searchValue) ||
            po.lines.some((line) => line.concurPoNumber?.toLowerCase().includes(searchValue))
          );
        })
      : byStatus;

    return [...bySearch].sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
  }, [siteScopedPos, searchTerm, selectedQuickFilter]);

  const allVisibleSelected = useMemo(() => {
    return filteredPos.length > 0 && filteredPos.every((po) => selectedPoIds.includes(po.id));
  }, [filteredPos, selectedPoIds]);

  const someVisibleSelected = useMemo(() => {
    return filteredPos.some((po) => selectedPoIds.includes(po.id));
  }, [filteredPos, selectedPoIds]);

  useEffect(() => {
    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  const handleToggleSelectAll = () => {
    if (allVisibleSelected) {
      const visibleIdSet = new Set(filteredPos.map((p) => p.id));
      setSelectedPoIds((prev) => prev.filter((id) => !visibleIdSet.has(id)));
    } else {
      const combined = new Set([...selectedPoIds, ...filteredPos.map((p) => p.id)]);
      setSelectedPoIds(Array.from(combined));
    }
  };

  const toggleSelectPo = (id: string) => {
    setSelectedPoIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExecuteMassUpdate = async () => {
    if (!massNeedByDate || selectedPoIds.length === 0) return;
    setIsMassUpdating(true);
    try {
      await updatePOsNeedByDate(selectedPoIds, massNeedByDate);
      const formattedDate = new Date(massNeedByDate).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      success(`Successfully updated Need-by Date to ${formattedDate} across ${selectedPoIds.length} request(s).`, 4000);
      setSelectedPoIds([]);
      setShowMassUpdateModal(false);
    } catch (err: any) {
      alert(`Failed to update need-by dates: ${err.message}`);
    } finally {
      setIsMassUpdating(false);
    }
  };

  const StatusBadge = ({ status }: { status: POStatus }) => {
    let colorClass =
      'bg-gray-100 dark:bg-gray-700/30 text-secondary dark:text-gray-400 border-gray-200 dark:border-gray-700';

    if (status === 'DRAFT') {
      colorClass =
        'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
    } else if (status === 'PENDING_APPROVAL') {
      colorClass =
        'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 border-yellow-200 dark:border-yellow-500/20';
    } else if (status === 'APPROVED_PENDING_CONCUR' || status === 'APPROVED_PENDING_CONCUR_REQUEST') {
      colorClass =
        'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-500 border-blue-200 dark:border-blue-500/20';
    } else if (status === 'ACTIVE' || status === 'VARIANCE_PENDING') {
      colorClass =
        'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20';
    } else if (status === 'RECEIVED') {
      colorClass =
        'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-500 border-green-200 dark:border-green-500/20';
    } else if (status === 'CLOSED') {
      colorClass =
        'bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-500/20';
    } else if (status === 'REJECTED') {
      colorClass =
        'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-500 border-red-200 dark:border-red-500/20';
    }

    return (
      <span className={`inline-flex shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClass} whitespace-nowrap`}>
        {statusLabel(status)}
      </span>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-4 md:space-y-6 overflow-hidden pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <PageHeader
            title={filter === 'PENDING' ? 'Pending Approvals' : filter === 'COMPLETED' ? 'Completed Requests' : 'Requests'}
            subtitle="Manage purchase orders and approvals"
            helpTitle="Approval Process"
            helpDescription="Understand the phases of approval and how to manage requests."
            helpLinkTarget="approval-workflow"
          />
        </div>
        {filter === 'ALL' && hasPermission('create_request') && (
          <Link
            to="/create"
            className="w-full md:hidden bg-[var(--color-brand)] text-white px-5 py-3 rounded-xl hover:opacity-90 font-semibold shadow-lg shadow-[var(--color-brand)]/20 transition-all text-center"
          >
            + New Request
          </Link>
        )}
      </div>

      <div className="bg-surface rounded-2xl elevation-1 border border-default overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by PR#, PO#, Customer, Site, Supplier, Requester, or Amount..."
              className="pl-10 pr-4 py-2.5 w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)] placeholder-tertiary dark:placeholder-gray-600 transition-colors"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {quickFilters.map((option) => {
                const Icon = option.icon;
                const isActive = option.id === selectedQuickFilterId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedQuickFilterId(option.id)}
                    aria-pressed={isActive}
                    aria-label={option.label}
                    title={option.label}
                    className={`group flex h-9 sm:h-10 shrink-0 items-center rounded-full border transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40 ${
                      isActive
                        ? 'bg-[var(--color-brand)]/12 border-[var(--color-brand)]/40 text-[var(--color-brand)] pl-3 pr-3.5 shadow-sm'
                        : 'bg-gray-50 dark:bg-[#15171e] border-gray-200 dark:border-gray-700 text-secondary dark:text-gray-300 pl-2.5 pr-2.5 sm:pl-3 sm:pr-3 hover:bg-gray-100 dark:hover:bg-[#20232e] hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <Icon size={16} className={`transition-transform duration-300 ${isActive ? 'scale-100' : 'group-hover:scale-110'}`} />
                    <span
                      className={`overflow-hidden whitespace-nowrap text-xs sm:text-sm font-semibold transition-all duration-300 ${
                        isActive
                          ? 'ml-2 max-w-[11rem] opacity-100'
                          : 'ml-1.5 max-w-[11rem] opacity-90 sm:ml-0 sm:max-w-0 sm:opacity-0 sm:group-hover:ml-2 sm:group-hover:max-w-[11rem] sm:group-hover:opacity-100'
                      }`}
                    >
                      {option.label}
                    </span>
                    <span
                      className={`overflow-hidden transition-all duration-300 ${
                        isActive
                          ? 'ml-1.5 max-w-[4rem] opacity-100'
                          : 'ml-1 max-w-[4rem] opacity-90 sm:ml-0 sm:max-w-0 sm:opacity-0 sm:group-hover:ml-2 sm:group-hover:max-w-[4rem] sm:group-hover:opacity-100'
                      }`}
                    >
                      <span
                        className={`inline-flex min-w-5 sm:min-w-6 items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] sm:text-xs font-bold ${
                          isActive
                            ? 'bg-[var(--color-brand)]/20 text-[var(--color-brand)]'
                            : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {quickFilterCounts[option.id] ?? 0}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between xl:justify-end">
              <div className="relative sm:min-w-[220px]">
                <label htmlFor="requests-site-filter" className="sr-only">
                  Filter requests by site
                </label>
                <MapPin
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <select
                  id="requests-site-filter"
                  value={selectedSiteFilterId}
                  onChange={(event) => setSelectedSiteFilterId(event.target.value)}
                  className="w-full appearance-none pl-9 pr-8 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#15171e] text-sm text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
                >
                  {siteFilterOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label} ({option.count})
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-tertiary dark:text-gray-500 sm:text-right">
                Showing {filteredPos.length} of {siteScopedPos.length} requests
              </p>
            </div>
          </div>
        </div>

        {/* Admin Mass Update Bar */}
        {isAdmin && selectedPoIds.length > 0 && (
          <div className="p-3.5 mx-4 mt-3 bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm animate-fade-in shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Calendar size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase text-indigo-950 dark:text-indigo-200">
                    {selectedPoIds.length} request{selectedPoIds.length !== 1 ? 's' : ''} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPoIds([])}
                    className="text-[11px] font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 underline cursor-pointer"
                  >
                    Deselect all
                  </button>
                </div>
                {selectedPoIds.length < filteredPos.length && (
                  <button
                    type="button"
                    onClick={() => setSelectedPoIds(Array.from(new Set([...selectedPoIds, ...filteredPos.map((p) => p.id)])))}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer block"
                  >
                    Select all {filteredPos.length} visible requests
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-1.5 shadow-2xs">
                <label htmlFor="mass-need-by-date" className="text-[10px] font-bold uppercase text-gray-400 shrink-0">
                  Need by:
                </label>
                <input
                  id="mass-need-by-date"
                  type="date"
                  value={massNeedByDate}
                  onChange={(e) => setMassNeedByDate(e.target.value)}
                  className="text-xs bg-transparent text-gray-900 dark:text-white font-medium outline-none cursor-pointer"
                />
              </div>

              {/* Quick Date Presets */}
              <div className="hidden lg:flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 7);
                    setMassNeedByDate(d.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 cursor-pointer"
                  title="7 days from today"
                >
                  +7d
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 14);
                    setMassNeedByDate(d.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 cursor-pointer"
                  title="14 days from today"
                >
                  +14d
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 30);
                    setMassNeedByDate(d.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 cursor-pointer"
                  title="30 days from today"
                >
                  +30d
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!massNeedByDate) {
                    alert('Please select a target need-by date first.');
                    return;
                  }
                  setIsMassUpdateConfirmed(false);
                  setShowMassUpdateModal(true);
                }}
                disabled={!massNeedByDate || isMassUpdating}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <Calendar size={13} />
                <span>Apply to Selected ({selectedPoIds.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-auto flex-1 min-h-0">
          <table className="w-full text-left text-sm text-secondary dark:text-gray-400 relative">
            <thead className="bg-gray-50 dark:bg-[#15171e] text-xs uppercase text-tertiary dark:text-gray-500 font-semibold border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
              <tr>
                {isAdmin && (
                  <th className="px-4 py-4 w-10 text-center">
                    <input
                      ref={masterCheckboxRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      title={allVisibleSelected ? 'Deselect all visible' : 'Select all visible'}
                    />
                  </th>
                )}
                <th className="px-5 py-4">Site</th>
                <th className="px-5 py-4">Customer</th>
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4">Need By</th>
                <th className="px-5 py-4">Supplier</th>
                <th className="px-5 py-4">Concur PR #</th>
                <th className="px-5 py-4">Concur PO #</th>
                {filter === 'PENDING' && <th className="px-5 py-4">Requester</th>}
                <th className="px-5 py-4 text-right">Total (Inc GST)</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {filteredPos.map((po) => {
                const isSelected = selectedPoIds.includes(po.id);
                const { dateStr: poNeedBy, isOverdue } = getPONeedByDate(po);

                return (
                  <tr
                    key={po.id}
                    className={`hover:bg-gray-50 dark:hover:bg-[#2b2d3b] transition-colors group ${
                      isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/25' : ''
                    }`}
                  >
                    {isAdmin && (
                      <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectPo(po.id)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                        <MapPin size={11} className="text-gray-400" />
                        {po.site || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs">
                      {po.customerName ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <CustomerCategoryBadge category={po.sector} size="xs" />
                          <span className="inline-flex max-w-[180px] truncate bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold">
                            {po.customerName}
                          </span>
                        </div>
                      ) : po.sector ? (
                        <CustomerCategoryBadge category={po.sector} size="xs" />
                      ) : (
                        <span className="text-gray-300 dark:text-gray-700">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600 dark:text-gray-400">
                      {new Date(po.requestDate).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 font-sans text-xs">
                      {poNeedBy ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-xs ${
                            isOverdue
                              ? 'text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800'
                              : 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800/80'
                          }`}
                          title={`Need-by delivery date: ${poNeedBy}${isOverdue ? ' (OVERDUE)' : ''}`}
                        >
                          <Clock3 size={11} className={isOverdue ? 'text-amber-600 dark:text-amber-400 animate-pulse' : 'text-gray-400'} />
                          <span>{new Date(poNeedBy).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}</span>
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-700 font-mono">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-300 font-medium truncate max-w-[160px]" title={po.supplierName}>
                      {po.supplierName}
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-300 font-medium font-mono text-xs">
                      {po.concurRequestNumber || '-'}
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-300 font-medium font-mono text-xs">
                      {po.lines.find(l => l.concurPoNumber)?.concurPoNumber || '-'}
                    </td>
                    {filter === 'PENDING' && (
                      <td className="px-5 py-4 flex items-center gap-2">
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${po.requesterName}`}
                          className="w-6 h-6 rounded-full bg-gray-100"
                        />
                        <span className="truncate max-w-[100px]">{po.requesterName}</span>
                      </td>
                    )}
                    <td className="px-5 py-4 text-right font-medium text-gray-900 dark:text-white">
                      <div className="font-semibold">{formatCurrency(po.totalAmountIncGst ?? (po.totalAmount * 1.10))}</div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">({formatCurrency(po.subtotalAmount ?? po.totalAmount)} ex)</div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <StatusBadge status={po.status} />
                    </td>
                    <td className="px-5 py-4 text-center">
                      <Link
                        to={`/requests/${po.id}`}
                        className="text-gray-400 hover:text-[var(--color-brand)] p-2 rounded-lg inline-block transition-colors"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filteredPos.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? (filter === 'PENDING' ? 12 : 11) : (filter === 'PENDING' ? 11 : 10)}
                    className="text-center py-12 text-tertiary dark:text-gray-600"
                  >
                    No requests found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden overflow-y-auto flex-1 min-h-0 divide-y divide-gray-100 dark:divide-gray-800">
          {filteredPos.map((po) => {
            const isSelected = selectedPoIds.includes(po.id);
            const { dateStr: poNeedBy, isOverdue } = getPONeedByDate(po);

            return (
              <div
                key={po.id}
                className={`p-4 transition-colors ${
                  isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/30' : 'hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => toggleSelectPo(po.id)}
                      className="mt-1 p-1 text-gray-400 hover:text-indigo-600 focus:outline-none shrink-0"
                      aria-label={isSelected ? 'Deselect order' : 'Select order'}
                    >
                      {isSelected ? (
                        <CheckSquare size={20} className="text-indigo-600" />
                      ) : (
                        <Square size={20} className="text-gray-400" />
                      )}
                    </button>
                  )}

                  <Link to={`/requests/${po.id}`} className="block flex-1 min-w-0">
                    <div className="mb-2 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-gray-900 dark:text-white truncate">{po.supplierName}</div>
                        <StatusBadge status={po.status} />
                      </div>

                      <div className="text-xs text-tertiary dark:text-gray-500 flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold">{po.displayId || po.id}</span>
                        <span aria-hidden="true" className="text-gray-300 dark:text-gray-700">|</span>
                        <span>{new Date(po.requestDate).toLocaleDateString()}</span>
                        <span aria-hidden="true" className="text-gray-300 dark:text-gray-700">|</span>
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <MapPin size={10} />
                          <span className="truncate">{po.site || 'Unknown'}</span>
                        </span>
                      </div>

                      {poNeedBy && (
                        <div className="flex items-center gap-1.5 text-xs mt-1">
                          <span className="text-[10px] font-bold uppercase text-gray-400">Need by:</span>
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-semibold text-[11px] ${
                              isOverdue
                                ? 'text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800'
                                : 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800'
                            }`}
                          >
                            <Clock3 size={10} className={isOverdue ? 'text-amber-500' : 'text-gray-400'} />
                            <span>{new Date(poNeedBy).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}</span>
                            {isOverdue && <span className="text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400 ml-0.5">Overdue</span>}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-sm gap-3 pt-2 border-t border-gray-100 dark:border-gray-800/60">
                      <div className="text-secondary dark:text-gray-500 flex items-center gap-1.5 min-w-0 text-xs">
                        <span className="uppercase tracking-wide text-gray-400 dark:text-gray-500">Customer</span>
                        <CustomerCategoryBadge category={po.sector} size="xs" />
                        <span className="truncate font-semibold text-gray-700 dark:text-gray-300">
                          {po.customerName || '-'}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900 dark:text-white text-base">{formatCurrency(po.totalAmountIncGst ?? (po.totalAmount * 1.10))}</div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500">({formatCurrency(po.subtotalAmount ?? po.totalAmount)} ex)</div>
                      </div>
                    </div>

                    {filter === 'PENDING' && (
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 text-xs text-tertiary dark:text-gray-500">
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${po.requesterName}`}
                          className="w-5 h-5 rounded-full bg-gray-100"
                        />
                        <span>Requested by {po.requesterName}</span>
                      </div>
                    )}
                  </Link>
                </div>
              </div>
            );
          })}
          {filteredPos.length === 0 && (
            <div className="text-center py-12 text-tertiary dark:text-gray-600 px-4">No requests found.</div>
          )}
        </div>
      </div>

      {/* Mass Update Confirmation Modal */}
      {showMassUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white dark:bg-[#1a1d26] border border-gray-200 dark:border-gray-700 rounded-3xl shadow-2xl p-6 space-y-5 animate-scale-up">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Confirm Mass Update
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Are you sure you want to apply this mass edit?
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowMassUpdateModal(false);
                  setIsMassUpdateConfirmed(false);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-950 dark:text-amber-200 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-300">
                <AlertCircle size={14} className="shrink-0" />
                <span>Are you sure you want to update {selectedPoIds.length} purchase orders?</span>
              </p>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80">
                Target Need-by Date:{' '}
                <span className="font-bold underline text-amber-950 dark:text-amber-100">
                  {new Date(massNeedByDate).toLocaleDateString('en-AU', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </p>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80">
                This will synchronize the need-by delivery date across all line items in every selected order.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Selected Purchase Orders ({selectedPoIds.length}):
              </span>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {pos.filter((p) => selectedPoIds.includes(p.id)).slice(0, 10).map((p) => {
                  const { dateStr } = getPONeedByDate(p);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="font-mono font-bold text-gray-900 dark:text-white">{p.displayId || p.id}</span>
                        <span className="truncate text-gray-500">· {p.supplierName}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 shrink-0">
                        Current: {dateStr ? new Date(dateStr).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' }) : 'None'}
                      </div>
                    </div>
                  );
                })}
                {selectedPoIds.length > 10 && (
                  <p className="text-[11px] text-gray-400 text-center pt-1 font-medium">
                    + {selectedPoIds.length - 10} more orders
                  </p>
                )}
              </div>
            </div>

            {/* Mandatory Confirmation Checkbox */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isMassUpdateConfirmed}
                  onChange={(e) => setIsMassUpdateConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-indigo-600 border-gray-300 dark:border-gray-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-bold text-gray-900 dark:text-white">
                    I confirm that I want to apply this mass edit
                  </span>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    You must check this box to confirm before applying the update.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setShowMassUpdateModal(false);
                  setIsMassUpdateConfirmed(false);
                }}
                disabled={isMassUpdating}
                className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const formattedDate = new Date(massNeedByDate).toLocaleDateString('en-AU', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });
                  setConfirmDialog({
                    isOpen: true,
                    title: 'Are you sure?',
                    message: `Are you sure you want to save this mass edit? You are about to update the need-by delivery date to ${formattedDate} across ${selectedPoIds.length} purchase orders. Every line item in each selected order will be updated to this date.`,
                    confirmLabel: `Yes, Apply to ${selectedPoIds.length} Orders`,
                    onConfirm: () => {
                      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                      handleExecuteMassUpdate();
                    }
                  });
                }}
                disabled={!isMassUpdateConfirmed || isMassUpdating}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isMassUpdating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Applying Changes...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Confirm &amp; Apply Mass Edit ({selectedPoIds.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Pop-up Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel || `Yes, Apply to ${selectedPoIds.length} Orders`}
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default POList;
