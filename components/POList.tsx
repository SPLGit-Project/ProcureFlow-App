import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Link } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  Link2,
  ListFilter,
  MapPin,
  Search,
  Truck,
  XCircle
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { POStatus } from '../types';
import ContextHelp from './ContextHelp';

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

const IN_PROGRESS_STATUSES: POStatus[] = ['ACTIVE', 'PARTIALLY_RECEIVED', 'VARIANCE_PENDING'];
const COMPLETED_STATUSES: POStatus[] = ['RECEIVED', 'CLOSED'];

const statusLabel = (status: POStatus) => {
  if (status === 'APPROVED_PENDING_CONCUR') return 'Pending Concur';
  if (status === 'PENDING_APPROVAL') return 'Pending Approval';
  if (status === 'PARTIALLY_RECEIVED') return 'Partially Received';
  if (status === 'VARIANCE_PENDING') return 'Variance Pending';
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
        'APPROVED_PENDING_CONCUR',
        ...IN_PROGRESS_STATUSES,
        ...COMPLETED_STATUSES,
        'REJECTED',
        'DRAFT'
      ],
      icon: ListFilter
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
      statuses: ['APPROVED_PENDING_CONCUR'],
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
  const { pos, hasPermission, currentUser, userSites, siteName: resolveSiteName } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
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
      counts[option.id] = siteScopedPos.filter((po) => option.statuses.includes(po.status)).length;
    }
    return counts;
  }, [quickFilters, siteScopedPos]);

  const selectedQuickFilter = useMemo(
    () => quickFilters.find((option) => option.id === selectedQuickFilterId) ?? quickFilters[0],
    [quickFilters, selectedQuickFilterId]
  );

  const filteredPos = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    const byStatus = selectedQuickFilter
      ? siteScopedPos.filter((po) => selectedQuickFilter.statuses.includes(po.status))
      : siteScopedPos;

    const bySearch = searchValue
      ? byStatus.filter((po) => {
          return (
            po.supplierName.toLowerCase().includes(searchValue) ||
            (po.displayId || po.id).toLowerCase().includes(searchValue) ||
            (po.site || '').toLowerCase().includes(searchValue) ||
            po.requesterName.toLowerCase().includes(searchValue) ||
            po.totalAmount.toString().includes(searchValue) ||
            po.lines.some((line) => line.concurPoNumber?.toLowerCase().includes(searchValue))
          );
        })
      : byStatus;

    return [...bySearch].sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
  }, [siteScopedPos, searchTerm, selectedQuickFilter]);

  const StatusBadge = ({ status }: { status: POStatus }) => {
    let colorClass =
      'bg-gray-100 dark:bg-gray-700/30 text-secondary dark:text-gray-400 border-gray-200 dark:border-gray-700';

    if (status === 'PENDING_APPROVAL') {
      colorClass =
        'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 border-yellow-200 dark:border-yellow-500/20';
    } else if (status === 'APPROVED_PENDING_CONCUR') {
      colorClass =
        'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-500 border-blue-200 dark:border-blue-500/20';
    } else if (status === 'ACTIVE' || status === 'PARTIALLY_RECEIVED' || status === 'VARIANCE_PENDING') {
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
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            {filter === 'PENDING' ? 'Pending Approvals' : filter === 'COMPLETED' ? 'Completed Requests' : 'Requests'}
            <ContextHelp
              title="Approval Process"
              description="Understand the phases of approval and how to manage requests."
              linkTarget="approval-workflow"
            />
          </h1>
          <p className="text-secondary dark:text-gray-400 text-sm mt-1">Manage purchase orders and approvals</p>
        </div>
        {filter === 'ALL' && hasPermission('create_request') && (
          <Link
            to="/create"
            className="w-full md:w-auto bg-[var(--color-brand)] text-white px-5 py-3 rounded-xl hover:opacity-90 font-semibold shadow-lg shadow-[var(--color-brand)]/20 transition-all text-center"
          >
            + New Request
          </Link>
        )}
      </div>

      <div className="bg-surface rounded-2xl elevation-1 border border-default overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by ID, Site, Supplier, Requester, Amount, or Concur Ref..."
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
                    className={`group flex h-10 shrink-0 items-center rounded-full border transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40 ${
                      isActive
                        ? 'bg-[var(--color-brand)]/12 border-[var(--color-brand)]/40 text-[var(--color-brand)] pl-3 pr-4 shadow-sm'
                        : 'bg-gray-50 dark:bg-[#15171e] border-gray-200 dark:border-gray-700 text-secondary dark:text-gray-300 pl-3 pr-3 hover:bg-gray-100 dark:hover:bg-[#20232e] hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <Icon size={16} className={`transition-transform duration-300 ${isActive ? 'scale-100' : 'group-hover:scale-110'}`} />
                    <span
                      className={`overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-300 ${
                        isActive ? 'ml-2 max-w-[11rem] opacity-100' : 'ml-0 max-w-0 opacity-0 group-hover:ml-2 group-hover:max-w-[11rem] group-hover:opacity-100'
                      }`}
                    >
                      {option.label}
                    </span>
                    <span
                      className={`overflow-hidden transition-all duration-300 ${
                        isActive ? 'ml-2 max-w-[4rem] opacity-100' : 'ml-0 max-w-0 opacity-0 group-hover:ml-2 group-hover:max-w-[4rem] group-hover:opacity-100'
                      }`}
                    >
                      <span
                        className={`inline-flex min-w-6 items-center justify-center rounded-md px-1.5 py-0.5 text-xs ${
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

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm text-secondary dark:text-gray-400">
            <thead className="bg-gray-50 dark:bg-[#15171e] text-xs uppercase text-tertiary dark:text-gray-500 font-semibold border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-6 py-4">Request ID</th>
                <th className="px-6 py-4">Ref</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Site</th>
                <th className="px-6 py-4">Supplier</th>
                {filter === 'PENDING' && <th className="px-6 py-4">Requester</th>}
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {filteredPos.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-[#2b2d3b] transition-colors group">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white group-hover:text-[var(--color-brand)] transition-colors">
                    {po.displayId || po.id}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">
                    {po.lines[0]?.concurPoNumber ? (
                      <span className="bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold">
                        {po.lines[0]?.concurPoNumber}
                      </span>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-700">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">{new Date(po.requestDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                      <MapPin size={11} className="text-gray-400" />
                      {po.site || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-700 dark:text-gray-300 font-medium">{po.supplierName}</td>
                  {filter === 'PENDING' && (
                    <td className="px-6 py-4 flex items-center gap-2">
                      <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${po.requesterName}`}
                        className="w-6 h-6 rounded-full bg-gray-100"
                      />
                      <span className="truncate max-w-[100px]">{po.requesterName}</span>
                    </td>
                  )}
                  <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                    ${po.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge status={po.status} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Link
                      to={`/requests/${po.id}`}
                      className="text-gray-400 hover:text-[var(--color-brand)] p-2 rounded-lg inline-block transition-colors"
                    >
                      <Eye size={18} />
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredPos.length === 0 && (
                <tr>
                  <td colSpan={filter === 'PENDING' ? 9 : 8} className="text-center py-12 text-tertiary dark:text-gray-600">
                    No requests found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
          {filteredPos.map((po) => (
            <Link key={po.id} to={`/requests/${po.id}`} className="block p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              <div className="mb-3 space-y-2">
                <div className="font-bold text-gray-900 dark:text-white truncate">{po.supplierName}</div>
                <div className="text-xs text-tertiary dark:text-gray-500 flex items-center gap-2 flex-wrap">
                  <span className="font-mono">{po.displayId || po.id}</span>
                  <span aria-hidden="true" className="text-gray-300 dark:text-gray-700">
                    |
                  </span>
                  <span>{new Date(po.requestDate).toLocaleDateString()}</span>
                  <span aria-hidden="true" className="text-gray-300 dark:text-gray-700">
                    |
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin size={10} />
                    <span className="truncate">{po.site || 'Unknown'}</span>
                  </span>
                </div>
                <StatusBadge status={po.status} />
              </div>

              <div className="flex items-center justify-between text-sm gap-3">
                <div className="text-secondary dark:text-gray-500 flex items-center gap-1 min-w-0">
                  {po.lines[0]?.concurPoNumber && (
                    <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded text-xs font-mono border border-indigo-200 dark:border-indigo-500/20 truncate">
                      {po.lines[0]?.concurPoNumber}
                    </span>
                  )}
                </div>
                <div className="font-bold text-gray-900 dark:text-white text-base">${po.totalAmount.toLocaleString()}</div>
              </div>

              {filter === 'PENDING' && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 text-xs text-tertiary dark:text-gray-500">
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${po.requesterName}`}
                    className="w-5 h-5 rounded-full bg-gray-100"
                  />
                  <span>Requested by {po.requesterName}</span>
                </div>
              )}
            </Link>
          ))}
          {filteredPos.length === 0 && (
            <div className="text-center py-12 text-tertiary dark:text-gray-600 px-4">No requests found.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default POList;
