import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Calendar,
  CheckSquare,
  Square,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Check,
  X,
  Search,
  MapPin,
  Clock3,
  Eye,
  Filter,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import type { POStatus, PORequest } from '../types.ts';
import ContextHelp from './ContextHelp';
import PageHeader from './PageHeader';
import { useSetPageMeta } from '../context/PageMetaContext.tsx';
import { isDefaultSupplier } from '../utils/suppliers.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { ToastContainer, useToast } from './ToastNotification';
import { formatCurrency } from '../utils/taxCalculations.ts';
import CustomerCategoryBadge from './CustomerCategoryBadge.tsx';
import ExcelColumnFilter, { SortDirection } from './ExcelColumnFilter.tsx';

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

const COMPLETED_STATUSES: POStatus[] = ['RECEIVED', 'CLOSED'];

const statusLabel = (status: POStatus) => {
  if (status === 'APPROVED_PENDING_CONCUR') return 'Pending Concur PO';
  if (status === 'APPROVED_PENDING_CONCUR_REQUEST') return 'Pending Concur Req';
  if (status === 'PENDING_APPROVAL') return 'Pending Approval';
  if (status === 'VARIANCE_PENDING') return 'Variance Pending';
  if (status === 'DRAFT') return 'Draft';
  if (status === 'CANCELLED') return 'Cancelled (Expired)';
  return status.replace(/_/g, ' ');
};

const POList = ({ filter = 'ALL' }: { filter?: BaseFilter }) => {
  const { pos, hasPermission, currentUser, reloadData, updatePOsNeedByDate } = useApp();
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.roleIds?.includes('ADMIN');
  useSetPageMeta({ disableBodyScroll: true });
  const location = useLocation();
  const navigate = useNavigate();
  const { toasts, dismissToast, success } = useToast();
  const handledDeleteNotificationRef = useRef<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Column filter & sorting state (Excel-like experience)
  const [openColumnFilter, setOpenColumnFilter] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[] | null>>({
    site: null,
    customer: null,
    date: null,
    needBy: null,
    supplier: null,
    concurPr: null,
    concurPo: null,
    requester: null,
    status: null,
  });
  const [sortConfig, setSortConfig] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);
  const [amountFilter, setAmountFilter] = useState<{ min?: number; max?: number } | null>(null);
  const [onlyOverdue, setOnlyOverdue] = useState<boolean>(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState<boolean>(false);

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

  const handleSort = (column: string, direction: SortDirection) => {
    if (!direction) {
      setSortConfig(null);
    } else {
      setSortConfig({ column, direction });
    }
  };

  const handleClearAllFilters = () => {
    setColumnFilters({
      site: null,
      customer: null,
      date: null,
      needBy: null,
      supplier: null,
      concurPr: null,
      concurPo: null,
      requester: null,
      status: null,
    });
    setOnlyOverdue(false);
    setAmountFilter(null);
    setSortConfig(null);
    setSearchTerm('');
  };

  const columnData = useMemo(() => {
    const baseList = routeScopedPos.filter((po) => {
      if (po.status === 'DRAFT' && !isAdmin && po.requesterId !== currentUser?.id) return false;
      return true;
    });

    const siteCounts: Record<string, number> = {};
    const customerCounts: Record<string, number> = {};
    const dateCounts: Record<string, number> = {};
    const needByCounts: Record<string, number> = {};
    const supplierCounts: Record<string, number> = {};
    const concurPrCounts: Record<string, number> = {};
    const concurPoCounts: Record<string, number> = {};
    const requesterCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    let overdueCount = 0;

    for (const po of baseList) {
      const siteVal = (po.site || '').trim() || 'Unknown';
      siteCounts[siteVal] = (siteCounts[siteVal] || 0) + 1;

      const custVal = (po.customerName || '').trim() || '(Blanks)';
      customerCounts[custVal] = (customerCounts[custVal] || 0) + 1;

      const dateVal = new Date(po.requestDate).toLocaleDateString();
      dateCounts[dateVal] = (dateCounts[dateVal] || 0) + 1;

      const { dateStr, isOverdue } = getPONeedByDate(po);
      if (isOverdue) overdueCount++;
      const needByVal = dateStr
        ? new Date(dateStr).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
        : '(Blanks)';
      needByCounts[needByVal] = (needByCounts[needByVal] || 0) + 1;

      const suppVal = (po.supplierName || '').trim() || 'Unknown';
      supplierCounts[suppVal] = (supplierCounts[suppVal] || 0) + 1;

      const prVal = (po.concurRequestNumber || po.concurPrNumber || '').trim() || '(Blanks)';
      concurPrCounts[prVal] = (concurPrCounts[prVal] || 0) + 1;

      const poVal = (po.lines.find((l) => l.concurPoNumber)?.concurPoNumber || po.concurPoNumber || '').trim() || '(Blanks)';
      concurPoCounts[poVal] = (concurPoCounts[poVal] || 0) + 1;

      const reqVal = (po.requesterName || '').trim() || 'Unknown';
      requesterCounts[reqVal] = (requesterCounts[reqVal] || 0) + 1;

      statusCounts[po.status] = (statusCounts[po.status] || 0) + 1;
    }

    return {
      site: {
        values: Object.keys(siteCounts).sort((a, b) => a.localeCompare(b)),
        counts: siteCounts
      },
      customer: {
        values: Object.keys(customerCounts).sort((a, b) => {
          if (a === '(Blanks)') return 1;
          if (b === '(Blanks)') return -1;
          return a.localeCompare(b);
        }),
        counts: customerCounts
      },
      date: {
        values: Object.keys(dateCounts).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()),
        counts: dateCounts
      },
      needBy: {
        values: Object.keys(needByCounts).sort((a, b) => {
          if (a === '(Blanks)') return 1;
          if (b === '(Blanks)') return -1;
          return new Date(a).getTime() - new Date(b).getTime();
        }),
        counts: needByCounts,
        overdueCount
      },
      supplier: {
        values: Object.keys(supplierCounts).sort((a, b) => a.localeCompare(b)),
        counts: supplierCounts
      },
      concurPr: {
        values: Object.keys(concurPrCounts).sort((a, b) => {
          if (a === '(Blanks)') return 1;
          if (b === '(Blanks)') return -1;
          return a.localeCompare(b);
        }),
        counts: concurPrCounts
      },
      concurPo: {
        values: Object.keys(concurPoCounts).sort((a, b) => {
          if (a === '(Blanks)') return 1;
          if (b === '(Blanks)') return -1;
          return a.localeCompare(b);
        }),
        counts: concurPoCounts
      },
      requester: {
        values: Object.keys(requesterCounts).sort((a, b) => a.localeCompare(b)),
        counts: requesterCounts
      },
      status: {
        values: Object.keys(statusCounts).sort((a, b) => statusLabel(a as POStatus).localeCompare(statusLabel(b as POStatus))),
        counts: statusCounts
      }
    };
  }, [routeScopedPos, isAdmin, currentUser?.id]);

  const filteredPos = useMemo(() => {
    let result = routeScopedPos;

    // Non-admins only see their own drafts
    if (!isAdmin) {
      result = result.filter((po) => po.status !== 'DRAFT' || po.requesterId === currentUser?.id);
    }

    // 1. Global Search
    const searchValue = searchTerm.trim().toLowerCase();
    if (searchValue) {
      result = result.filter((po) => {
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
      });
    }

    // 2. Column filters
    if (columnFilters.site && columnFilters.site.length > 0) {
      const allowed = new Set(columnFilters.site);
      result = result.filter((po) => allowed.has((po.site || '').trim() || 'Unknown'));
    }

    if (columnFilters.customer && columnFilters.customer.length > 0) {
      const allowed = new Set(columnFilters.customer);
      result = result.filter((po) => allowed.has((po.customerName || '').trim() || '(Blanks)'));
    }

    if (columnFilters.date && columnFilters.date.length > 0) {
      const allowed = new Set(columnFilters.date);
      result = result.filter((po) => allowed.has(new Date(po.requestDate).toLocaleDateString()));
    }

    if (onlyOverdue) {
      result = result.filter((po) => getPONeedByDate(po).isOverdue);
    }

    if (columnFilters.needBy && columnFilters.needBy.length > 0) {
      const allowed = new Set(columnFilters.needBy);
      result = result.filter((po) => {
        const { dateStr } = getPONeedByDate(po);
        const needByVal = dateStr
          ? new Date(dateStr).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
          : '(Blanks)';
        return allowed.has(needByVal);
      });
    }

    if (columnFilters.supplier && columnFilters.supplier.length > 0) {
      const allowed = new Set(columnFilters.supplier);
      result = result.filter((po) => allowed.has((po.supplierName || '').trim() || 'Unknown'));
    }

    if (columnFilters.concurPr && columnFilters.concurPr.length > 0) {
      const allowed = new Set(columnFilters.concurPr);
      result = result.filter((po) => allowed.has((po.concurRequestNumber || po.concurPrNumber || '').trim() || '(Blanks)'));
    }

    if (columnFilters.concurPo && columnFilters.concurPo.length > 0) {
      const allowed = new Set(columnFilters.concurPo);
      result = result.filter((po) => {
        const poVal = (po.lines.find((l) => l.concurPoNumber)?.concurPoNumber || po.concurPoNumber || '').trim() || '(Blanks)';
        return allowed.has(poVal);
      });
    }

    if (columnFilters.requester && columnFilters.requester.length > 0) {
      const allowed = new Set(columnFilters.requester);
      result = result.filter((po) => allowed.has((po.requesterName || '').trim() || 'Unknown'));
    }

    if (columnFilters.status && columnFilters.status.length > 0) {
      const allowed = new Set(columnFilters.status);
      result = result.filter((po) => allowed.has(po.status));
    }

    if (amountFilter) {
      if (amountFilter.min !== undefined) {
        result = result.filter((po) => {
          const amt = po.totalAmountIncGst ?? (po.totalAmount * 1.10);
          return amt >= amountFilter.min!;
        });
      }
      if (amountFilter.max !== undefined) {
        result = result.filter((po) => {
          const amt = po.totalAmountIncGst ?? (po.totalAmount * 1.10);
          return amt <= amountFilter.max!;
        });
      }
    }

    // 3. Sorting
    if (sortConfig) {
      const { column, direction } = sortConfig;
      const dir = direction === 'asc' ? 1 : -1;

      return [...result].sort((a, b) => {
        switch (column) {
          case 'site':
            return (a.site || '').localeCompare(b.site || '') * dir;
          case 'customer':
            return (a.customerName || '').localeCompare(b.customerName || '') * dir;
          case 'date':
            return (new Date(a.requestDate).getTime() - new Date(b.requestDate).getTime()) * dir;
          case 'needBy': {
            const dateA = getPONeedByDate(a).dateStr;
            const dateB = getPONeedByDate(b).dateStr;
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return (new Date(dateA).getTime() - new Date(dateB).getTime()) * dir;
          }
          case 'supplier':
            return (a.supplierName || '').localeCompare(b.supplierName || '') * dir;
          case 'concurPr':
            return (a.concurRequestNumber || a.concurPrNumber || '').localeCompare(b.concurRequestNumber || b.concurPrNumber || '') * dir;
          case 'concurPo': {
            const poA = a.lines.find((l) => l.concurPoNumber)?.concurPoNumber || a.concurPoNumber || '';
            const poB = b.lines.find((l) => l.concurPoNumber)?.concurPoNumber || b.concurPoNumber || '';
            return poA.localeCompare(poB) * dir;
          }
          case 'requester':
            return (a.requesterName || '').localeCompare(b.requesterName || '') * dir;
          case 'total': {
            const amtA = a.totalAmountIncGst ?? (a.totalAmount * 1.10);
            const amtB = b.totalAmountIncGst ?? (b.totalAmount * 1.10);
            return (amtA - amtB) * dir;
          }
          case 'status':
            return statusLabel(a.status).localeCompare(statusLabel(b.status)) * dir;
          default:
            return 0;
        }
      });
    }

    return [...result].sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
  }, [routeScopedPos, isAdmin, currentUser?.id, searchTerm, columnFilters, onlyOverdue, amountFilter, sortConfig]);

  const activeFilterChips = useMemo(() => {
    const chips: { id: string; label: string; onRemove: () => void }[] = [];

    if (columnFilters.site && columnFilters.site.length > 0) {
      chips.push({
        id: 'site',
        label: `Site: ${columnFilters.site.length === 1 ? columnFilters.site[0] : `${columnFilters.site[0]} (+${columnFilters.site.length - 1})`}`,
        onRemove: () => setColumnFilters((p) => ({ ...p, site: null }))
      });
    }

    if (columnFilters.customer && columnFilters.customer.length > 0) {
      chips.push({
        id: 'customer',
        label: `Customer: ${columnFilters.customer.length === 1 ? columnFilters.customer[0] : `${columnFilters.customer[0]} (+${columnFilters.customer.length - 1})`}`,
        onRemove: () => setColumnFilters((p) => ({ ...p, customer: null }))
      });
    }

    if (columnFilters.date && columnFilters.date.length > 0) {
      chips.push({
        id: 'date',
        label: `Date: ${columnFilters.date.length === 1 ? columnFilters.date[0] : `${columnFilters.date.length} dates`}`,
        onRemove: () => setColumnFilters((p) => ({ ...p, date: null }))
      });
    }

    if (onlyOverdue) {
      chips.push({
        id: 'overdue',
        label: 'Need By: Overdue only',
        onRemove: () => setOnlyOverdue(false)
      });
    }

    if (columnFilters.needBy && columnFilters.needBy.length > 0) {
      chips.push({
        id: 'needBy',
        label: `Need By: ${columnFilters.needBy.length === 1 ? columnFilters.needBy[0] : `${columnFilters.needBy.length} dates`}`,
        onRemove: () => setColumnFilters((p) => ({ ...p, needBy: null }))
      });
    }

    if (columnFilters.supplier && columnFilters.supplier.length > 0) {
      chips.push({
        id: 'supplier',
        label: `Supplier: ${columnFilters.supplier.length === 1 ? columnFilters.supplier[0] : `${columnFilters.supplier[0]} (+${columnFilters.supplier.length - 1})`}`,
        onRemove: () => setColumnFilters((p) => ({ ...p, supplier: null }))
      });
    }

    if (columnFilters.concurPr && columnFilters.concurPr.length > 0) {
      chips.push({
        id: 'concurPr',
        label: `Concur PR: ${columnFilters.concurPr.length === 1 ? columnFilters.concurPr[0] : `${columnFilters.concurPr.length} PRs`}`,
        onRemove: () => setColumnFilters((p) => ({ ...p, concurPr: null }))
      });
    }

    if (columnFilters.concurPo && columnFilters.concurPo.length > 0) {
      chips.push({
        id: 'concurPo',
        label: `Concur PO: ${columnFilters.concurPo.length === 1 ? columnFilters.concurPo[0] : `${columnFilters.concurPo.length} POs`}`,
        onRemove: () => setColumnFilters((p) => ({ ...p, concurPo: null }))
      });
    }

    if (columnFilters.requester && columnFilters.requester.length > 0) {
      chips.push({
        id: 'requester',
        label: `Requester: ${columnFilters.requester.length === 1 ? columnFilters.requester[0] : `${columnFilters.requester[0]} (+${columnFilters.requester.length - 1})`}`,
        onRemove: () => setColumnFilters((p) => ({ ...p, requester: null }))
      });
    }

    if (columnFilters.status && columnFilters.status.length > 0) {
      const statusNames = columnFilters.status.map((s) => statusLabel(s as POStatus));
      chips.push({
        id: 'status',
        label: `Status: ${statusNames.length === 1 ? statusNames[0] : `${statusNames[0]} (+${statusNames.length - 1})`}`,
        onRemove: () => setColumnFilters((p) => ({ ...p, status: null }))
      });
    }

    if (amountFilter && (amountFilter.min !== undefined || amountFilter.max !== undefined)) {
      let amtLabel = 'Amount: ';
      if (amountFilter.min !== undefined && amountFilter.max !== undefined) {
        amtLabel += `$${amountFilter.min} - $${amountFilter.max}`;
      } else if (amountFilter.min !== undefined) {
        amtLabel += `> $${amountFilter.min}`;
      } else {
        amtLabel += `< $${amountFilter.max}`;
      }
      chips.push({
        id: 'amount',
        label: amtLabel,
        onRemove: () => setAmountFilter(null)
      });
    }

    if (sortConfig) {
      const sortColName =
        sortConfig.column === 'needBy'
          ? 'Need By'
          : sortConfig.column === 'concurPr'
          ? 'Concur PR'
          : sortConfig.column === 'concurPo'
          ? 'Concur PO'
          : sortConfig.column.charAt(0).toUpperCase() + sortConfig.column.slice(1);
      chips.push({
        id: 'sort',
        label: `Sort: ${sortColName} (${sortConfig.direction === 'asc' ? 'Asc' : 'Desc'})`,
        onRemove: () => setSortConfig(null)
      });
    }

    return chips;
  }, [columnFilters, onlyOverdue, amountFilter, sortConfig]);

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
    } else if (status === 'CANCELLED') {
      colorClass =
        'bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20';
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

          {/* Active Filter Chips & Results Summary Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-1">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {activeFilterChips.length > 0 ? (
                <>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1 shrink-0 mr-1">
                    <Filter size={13} className="text-[var(--color-brand)]" />
                    <span>Active Filters ({activeFilterChips.length}):</span>
                  </span>
                  {activeFilterChips.map((chip) => (
                    <span
                      key={chip.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-brand)]/10 text-[var(--color-brand)] border border-[var(--color-brand)]/20 shadow-2xs"
                    >
                      <span>{chip.label}</span>
                      <button
                        type="button"
                        onClick={chip.onRemove}
                        className="p-0.5 rounded-full hover:bg-[var(--color-brand)]/20 transition-colors cursor-pointer"
                        title="Remove filter"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={handleClearAllFilters}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer ml-1"
                  >
                    <RotateCcw size={11} />
                    <span>Clear all</span>
                  </button>
                </>
              ) : (
                <span className="text-xs text-tertiary dark:text-gray-500 flex items-center gap-1.5">
                  <SlidersHorizontal size={13} className="text-gray-400" />
                  <span>Click column headers to filter or sort data (Excel-style)</span>
                </span>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
              {/* Mobile Filter Button (since table headers are hidden on small screens) */}
              <div className="md:hidden">
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#15171e] text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 cursor-pointer"
                >
                  <Filter size={12} className="text-[var(--color-brand)]" />
                  <span>Filter Columns</span>
                  <ChevronDown size={12} />
                </button>
              </div>

              <p className="text-xs font-medium text-tertiary dark:text-gray-500 whitespace-nowrap">
                Showing <span className="font-bold text-gray-900 dark:text-white">{filteredPos.length}</span> of {routeScopedPos.length} requests
              </p>
            </div>
          </div>

          {/* Mobile Filter Drawer / Panel */}
          {mobileFilterOpen && (
            <div className="md:hidden p-3.5 bg-gray-50 dark:bg-[#15171e] rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3 animate-scale-up">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Filter size={13} className="text-[var(--color-brand)]" />
                  Filter Columns
                </span>
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <ExcelColumnFilter
                    title="Site"
                    columnId="site"
                    values={columnData.site.values}
                    valueCounts={columnData.site.counts}
                    selectedValues={columnFilters.site ?? null}
                    onApplyFilter={(sel) => setColumnFilters((p) => ({ ...p, site: sel }))}
                    onClearFilter={() => setColumnFilters((p) => ({ ...p, site: null }))}
                    sortDirection={sortConfig?.column === 'site' ? sortConfig.direction : null}
                    onSort={(dir) => handleSort('site', dir)}
                    isOpen={openColumnFilter === 'mobile-site'}
                    onToggle={() => setOpenColumnFilter((p) => (p === 'mobile-site' ? null : 'mobile-site'))}
                    onClose={() => setOpenColumnFilter(null)}
                  />
                </div>
                <div>
                  <ExcelColumnFilter
                    title="Status"
                    columnId="status"
                    values={columnData.status.values}
                    valueCounts={columnData.status.counts}
                    selectedValues={columnFilters.status ?? null}
                    onApplyFilter={(sel) => setColumnFilters((p) => ({ ...p, status: sel }))}
                    onClearFilter={() => setColumnFilters((p) => ({ ...p, status: null }))}
                    renderValueLabel={(val) => <StatusBadge status={val as POStatus} />}
                    sortDirection={sortConfig?.column === 'status' ? sortConfig.direction : null}
                    onSort={(dir) => handleSort('status', dir)}
                    isOpen={openColumnFilter === 'mobile-status'}
                    onToggle={() => setOpenColumnFilter((p) => (p === 'mobile-status' ? null : 'mobile-status'))}
                    onClose={() => setOpenColumnFilter(null)}
                  />
                </div>
                <div>
                  <ExcelColumnFilter
                    title="Supplier"
                    columnId="supplier"
                    values={columnData.supplier.values}
                    valueCounts={columnData.supplier.counts}
                    selectedValues={columnFilters.supplier ?? null}
                    onApplyFilter={(sel) => setColumnFilters((p) => ({ ...p, supplier: sel }))}
                    onClearFilter={() => setColumnFilters((p) => ({ ...p, supplier: null }))}
                    sortDirection={sortConfig?.column === 'supplier' ? sortConfig.direction : null}
                    onSort={(dir) => handleSort('supplier', dir)}
                    isOpen={openColumnFilter === 'mobile-supplier'}
                    onToggle={() => setOpenColumnFilter((p) => (p === 'mobile-supplier' ? null : 'mobile-supplier'))}
                    onClose={() => setOpenColumnFilter(null)}
                  />
                </div>
                <div>
                  <ExcelColumnFilter
                    title="Customer"
                    columnId="customer"
                    values={columnData.customer.values}
                    valueCounts={columnData.customer.counts}
                    selectedValues={columnFilters.customer ?? null}
                    onApplyFilter={(sel) => setColumnFilters((p) => ({ ...p, customer: sel }))}
                    onClearFilter={() => setColumnFilters((p) => ({ ...p, customer: null }))}
                    sortDirection={sortConfig?.column === 'customer' ? sortConfig.direction : null}
                    onSort={(dir) => handleSort('customer', dir)}
                    isOpen={openColumnFilter === 'mobile-customer'}
                    onToggle={() => setOpenColumnFilter((p) => (p === 'mobile-customer' ? null : 'mobile-customer'))}
                    onClose={() => setOpenColumnFilter(null)}
                  />
                </div>
              </div>
            </div>
          )}
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
                  <th className="px-4 py-3.5 w-10 text-center">
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
                <th className="px-3 py-3 whitespace-nowrap">
                  <ExcelColumnFilter
                    title="Site"
                    columnId="site"
                    values={columnData.site.values}
                    valueCounts={columnData.site.counts}
                    selectedValues={columnFilters.site ?? null}
                    onApplyFilter={(sel) => setColumnFilters((p) => ({ ...p, site: sel }))}
                    onClearFilter={() => setColumnFilters((p) => ({ ...p, site: null }))}
                    sortDirection={sortConfig?.column === 'site' ? sortConfig.direction : null}
                    onSort={(dir) => handleSort('site', dir)}
                    isOpen={openColumnFilter === 'site'}
                    onToggle={() => setOpenColumnFilter((p) => (p === 'site' ? null : 'site'))}
                    onClose={() => setOpenColumnFilter(null)}
                  />
                </th>
                <th className="px-3 py-3 whitespace-nowrap">
                  <ExcelColumnFilter
                    title="Customer"
                    columnId="customer"
                    values={columnData.customer.values}
                    valueCounts={columnData.customer.counts}
                    selectedValues={columnFilters.customer ?? null}
                    onApplyFilter={(sel) => setColumnFilters((p) => ({ ...p, customer: sel }))}
                    onClearFilter={() => setColumnFilters((p) => ({ ...p, customer: null }))}
                    sortDirection={sortConfig?.column === 'customer' ? sortConfig.direction : null}
                    onSort={(dir) => handleSort('customer', dir)}
                    isOpen={openColumnFilter === 'customer'}
                    onToggle={() => setOpenColumnFilter((p) => (p === 'customer' ? null : 'customer'))}
                    onClose={() => setOpenColumnFilter(null)}
                  />
                </th>
                <th className="px-3 py-3 whitespace-nowrap">
                  <ExcelColumnFilter
                    title="Date"
                    columnId="date"
                    sortType="date"
                    values={columnData.date.values}
                    valueCounts={columnData.date.counts}
                    selectedValues={columnFilters.date ?? null}
                    onApplyFilter={(sel) => setColumnFilters((p) => ({ ...p, date: sel }))}
                    onClearFilter={() => setColumnFilters((p) => ({ ...p, date: null }))}
                    sortDirection={sortConfig?.column === 'date' ? sortConfig.direction : null}
                    onSort={(dir) => handleSort('date', dir)}
                    isOpen={openColumnFilter === 'date'}
                    onToggle={() => setOpenColumnFilter((p) => (p === 'date' ? null : 'date'))}
                    onClose={() => setOpenColumnFilter(null)}
                  />
                </th>
                <th className="px-3 py-3 whitespace-nowrap">
                  <ExcelColumnFilter
                    title="Need By"
                    columnId="needBy"
                    sortType="date"
                    values={columnData.needBy.values}
                    valueCounts={columnData.needBy.counts}
                    selectedValues={columnFilters.needBy ?? null}
                    onApplyFilter={(sel) => setColumnFilters((p) => ({ ...p, needBy: sel }))}
                    onClearFilter={() => setColumnFilters((p) => ({ ...p, needBy: null }))}
                    sortDirection={sortConfig?.column === 'needBy' ? sortConfig.direction : null}
                    onSort={(dir) => handleSort('needBy', dir)}
                    extraContent={
                      <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={onlyOverdue}
                          onChange={(e) => setOnlyOverdue(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-amber-300 dark:border-amber-600 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                          <Clock3 size={12} className="text-amber-600" />
                          <span>Show Overdue Only ({columnData.needBy.overdueCount})</span>
                        </span>
                      </label>
                    }
                    isOpen={openColumnFilter === 'needBy'}
                    onToggle={() => setOpenColumnFilter((p) => (p === 'needBy' ? null : 'needBy'))}
                    onClose={() => setOpenColumnFilter(null)}
                  />
                </th>
                <th className="px-3 py-3 whitespace-nowrap">
                  <ExcelColumnFilter
                    title="Supplier"
                    columnId="supplier"
                    values={columnData.supplier.values}
                    valueCounts={columnData.supplier.counts}
                    selectedValues={columnFilters.supplier ?? null}
                    onApplyFilter={(sel) => setColumnFilters((p) => ({ ...p, supplier: sel }))}
                    onClearFilter={() => setColumnFilters((p) => ({ ...p, supplier: null }))}
                    sortDirection={sortConfig?.column === 'supplier' ? sortConfig.direction : null}
                    onSort={(dir) => handleSort('supplier', dir)}
                    isOpen={openColumnFilter === 'supplier'}
                    onToggle={() => setOpenColumnFilter((p) => (p === 'supplier' ? null : 'supplier'))}
                    onClose={() => setOpenColumnFilter(null)}
                  />
                </th>
                <th className="px-3 py-3 whitespace-nowrap">
                  <ExcelColumnFilter
                    title="Concur PR #"
                    columnId="concurPr"
                    values={columnData.concurPr.values}
                    valueCounts={columnData.concurPr.counts}
                    selectedValues={columnFilters.concurPr ?? null}
                    onApplyFilter={(sel) => setColumnFilters((p) => ({ ...p, concurPr: sel }))}
                    onClearFilter={() => setColumnFilters((p) => ({ ...p, concurPr: null }))}
                    sortDirection={sortConfig?.column === 'concurPr' ? sortConfig.direction : null}
                    onSort={(dir) => handleSort('concurPr', dir)}
                    isOpen={openColumnFilter === 'concurPr'}
                    onToggle={() => setOpenColumnFilter((p) => (p === 'concurPr' ? null : 'concurPr'))}
                    onClose={() => setOpenColumnFilter(null)}
                  />
                </th>
                <th className="px-3 py-3 whitespace-nowrap">
                  <ExcelColumnFilter
                    title="Concur PO #"
                    columnId="concurPo"
                    values={columnData.concurPo.values}
                    valueCounts={columnData.concurPo.counts}
                    selectedValues={columnFilters.concurPo ?? null}
                    onApplyFilter={(sel) => setColumnFilters((p) => ({ ...p, concurPo: sel }))}
                    onClearFilter={() => setColumnFilters((p) => ({ ...p, concurPo: null }))}
                    sortDirection={sortConfig?.column === 'concurPo' ? sortConfig.direction : null}
                    onSort={(dir) => handleSort('concurPo', dir)}
                    isOpen={openColumnFilter === 'concurPo'}
                    onToggle={() => setOpenColumnFilter((p) => (p === 'concurPo' ? null : 'concurPo'))}
                    onClose={() => setOpenColumnFilter(null)}
                  />
                </th>
                {filter === 'PENDING' && (
                  <th className="px-3 py-3 whitespace-nowrap">
                    <ExcelColumnFilter
                      title="Requester"
                      columnId="requester"
                      values={columnData.requester.values}
                      valueCounts={columnData.requester.counts}
                      selectedValues={columnFilters.requester ?? null}
                      onApplyFilter={(sel) => setColumnFilters((p) => ({ ...p, requester: sel }))}
                      onClearFilter={() => setColumnFilters((p) => ({ ...p, requester: null }))}
                      sortDirection={sortConfig?.column === 'requester' ? sortConfig.direction : null}
                      onSort={(dir) => handleSort('requester', dir)}
                      isOpen={openColumnFilter === 'requester'}
                      onToggle={() => setOpenColumnFilter((p) => (p === 'requester' ? null : 'requester'))}
                      onClose={() => setOpenColumnFilter(null)}
                    />
                  </th>
                )}
                <th className="px-3 py-3 text-right whitespace-nowrap">
                  <div className="flex justify-end">
                    <ExcelColumnFilter
                      title="Total (Inc GST)"
                      columnId="total"
                      align="right"
                      sortType="numeric"
                      values={[]}
                      selectedValues={amountFilter && (amountFilter.min !== undefined || amountFilter.max !== undefined) ? ['filtered'] : null}
                      onApplyFilter={() => {}}
                      onClearFilter={() => setAmountFilter(null)}
                      sortDirection={sortConfig?.column === 'total' ? sortConfig.direction : null}
                      onSort={(dir) => handleSort('total', dir)}
                      extraContent={
                        <div className="space-y-2 text-left">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                            Filter Amount Range (Inc GST)
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              placeholder="Min $"
                              value={amountFilter?.min ?? ''}
                              onChange={(e) =>
                                setAmountFilter((prev) => ({
                                  ...prev,
                                  min: e.target.value ? Number(e.target.value) : undefined
                                }))
                              }
                              className="w-full px-2 py-1.5 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg text-xs"
                            />
                            <span className="text-gray-400 font-bold">-</span>
                            <input
                              type="number"
                              placeholder="Max $"
                              value={amountFilter?.max ?? ''}
                              onChange={(e) =>
                                setAmountFilter((prev) => ({
                                  ...prev,
                                  max: e.target.value ? Number(e.target.value) : undefined
                                }))
                              }
                              className="w-full px-2 py-1.5 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg text-xs"
                            />
                          </div>
                          <div className="flex flex-wrap gap-1 pt-1">
                            <button
                              type="button"
                              onClick={() => setAmountFilter({ max: 1000 })}
                              className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 cursor-pointer"
                            >
                              &lt; $1k
                            </button>
                            <button
                              type="button"
                              onClick={() => setAmountFilter({ min: 1000, max: 10000 })}
                              className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 cursor-pointer"
                            >
                              $1k - $10k
                            </button>
                            <button
                              type="button"
                              onClick={() => setAmountFilter({ min: 10000 })}
                              className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 cursor-pointer"
                            >
                              &gt; $10k
                            </button>
                            {(amountFilter?.min !== undefined || amountFilter?.max !== undefined) && (
                              <button
                                type="button"
                                onClick={() => setAmountFilter(null)}
                                className="px-2 py-1 text-[10px] font-bold text-red-500 hover:underline ml-auto cursor-pointer"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        </div>
                      }
                      isOpen={openColumnFilter === 'total'}
                      onToggle={() => setOpenColumnFilter((p) => (p === 'total' ? null : 'total'))}
                      onClose={() => setOpenColumnFilter(null)}
                    />
                  </div>
                </th>
                <th className="px-3 py-3 text-center whitespace-nowrap">
                  <div className="flex justify-center">
                    <ExcelColumnFilter
                      title="Status"
                      columnId="status"
                      align="right"
                      values={columnData.status.values}
                      valueCounts={columnData.status.counts}
                      selectedValues={columnFilters.status ?? null}
                      onApplyFilter={(sel) => setColumnFilters((p) => ({ ...p, status: sel }))}
                      onClearFilter={() => setColumnFilters((p) => ({ ...p, status: null }))}
                      renderValueLabel={(val) => <StatusBadge status={val as POStatus} />}
                      sortDirection={sortConfig?.column === 'status' ? sortConfig.direction : null}
                      onSort={(dir) => handleSort('status', dir)}
                      isOpen={openColumnFilter === 'status'}
                      onToggle={() => setOpenColumnFilter((p) => (p === 'status' ? null : 'status'))}
                      onClose={() => setOpenColumnFilter(null)}
                    />
                  </div>
                </th>
                <th className="px-4 py-3.5 text-center whitespace-nowrap text-tertiary dark:text-gray-500">Action</th>
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
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{po.supplierName}</span>
                        {(!isDefaultSupplier(po.supplierName) || po.isNonDefaultSupplier) && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60" title="Non-default supplier requested">
                            Alt
                          </span>
                        )}
                      </div>
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
