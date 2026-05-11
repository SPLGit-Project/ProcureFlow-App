import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Clock,
  AlertCircle,
  FileText,
  Check,
  ChevronDown,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { getMyItemRequests } from '../services/itemRequestService';
import { generateItemCode } from '../utils/itemNameGenerator';
import { ItemRequest, ItemRequestType, ItemRequestStatus } from '../types';
import { useApp } from '../context/AppContext';
import PageHeader from './PageHeader';

// ── Label maps ─────────────────────────────────────────────────────────────────

const REQUEST_TYPE_LABELS: Record<ItemRequestType, string> = {
  PURCHASE_AND_SALE: 'Purchase & Sale',
  PURCHASE_ONLY: 'Purchase Only',
  SALE_ONLY: 'Sale Only',
  COG: 'COG',
  BUNDLE_LINENHUB_ONLY: 'Bundle/LinenHub',
  REPLACEMENT: 'Replacement',
  CUSTOMER_SPECIFIC: 'Customer-Specific',
  SHARED_CATALOGUE: 'Shared Catalogue',
};

const STATUS_CONFIG: Record<ItemRequestStatus, { label: string; color: string }> = {
  DRAFT:               { label: 'Draft',               color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
  SUBMITTED:           { label: 'Submitted',           color: 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  DUPLICATE_REVIEW:    { label: 'Duplicate Review',    color: 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  PROCUREMENT_REVIEW:  { label: 'Procurement Review',  color: 'bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400' },
  DATA_REVIEW:         { label: 'Data Review',         color: 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  PRICING_REVIEW:      { label: 'Pricing Review',      color: 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  APPROVAL_PENDING:    { label: 'Approval Pending',    color: 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  REVISION_REQUIRED:   { label: 'Revision Required',   color: 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400' },
  APPROVED:            { label: 'Approved',            color: 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400' },
  PUBLISHING:          { label: 'Publishing',          color: 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400' },
  PARTIALLY_PUBLISHED: { label: 'Partially Published', color: 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400' },
  FULLY_PUBLISHED:     { label: 'Fully Published',     color: 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400' },
  ACTIVE:              { label: 'Active',              color: 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400' },
  REPLACED:            { label: 'Replaced',            color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
  RETIRED:             { label: 'Retired',             color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
  REJECTED:            { label: 'Rejected',            color: 'bg-red-200 dark:bg-red-500/20 text-red-800 dark:text-red-500' },
};

// ── Timeline ───────────────────────────────────────────────────────────────────

/**
 * Ordered list of visible workflow stages. REJECTED / REPLACED / RETIRED are
 * terminal off-ramps shown separately when the request is in that state.
 */
const WORKFLOW_STAGES: { status: ItemRequestStatus; label: string; sublabel: string }[] = [
  { status: 'SUBMITTED',           label: 'Submitted',           sublabel: 'Received by Master Data team' },
  { status: 'DUPLICATE_REVIEW',    label: 'Duplicate Check',     sublabel: 'Checking for existing matches' },
  { status: 'DATA_REVIEW',         label: 'Item Definition',     sublabel: 'SAP & catalogue setup' },
  { status: 'PRICING_REVIEW',      label: 'Pricing Review',      sublabel: 'Buy & sell prices being set' },
  { status: 'APPROVAL_PENDING',    label: 'Approval',            sublabel: 'Awaiting approver sign-off' },
  { status: 'APPROVED',            label: 'Approved',            sublabel: 'Approved — publishing to systems' },
  { status: 'ACTIVE',              label: 'Active',              sublabel: 'Live in all target systems' },
];

/** Map each status to the index of the stage it represents in WORKFLOW_STAGES */
const STATUS_TO_STAGE_INDEX: Partial<Record<ItemRequestStatus, number>> = {
  SUBMITTED:           0,
  DUPLICATE_REVIEW:    1,
  DATA_REVIEW:         2,
  PRICING_REVIEW:      3,
  APPROVAL_PENDING:    4,
  REVISION_REQUIRED:   4, // Still in approval stage, just needing rework
  APPROVED:            5,
  PUBLISHING:          5,
  PARTIALLY_PUBLISHED: 5,
  FULLY_PUBLISHED:     5,
  ACTIVE:              6,
};

const TERMINAL_NEGATIVE: ItemRequestStatus[] = ['REJECTED', 'REPLACED', 'RETIRED'];

interface StatusTimelineProps {
  status: ItemRequestStatus;
}

function StatusTimeline({ status }: StatusTimelineProps) {
  const isTerminalNeg = TERMINAL_NEGATIVE.includes(status);
  const activeIdx = STATUS_TO_STAGE_INDEX[status] ?? -1;

  return (
    <div className="px-6 pb-5 pt-2">
      {isTerminalNeg ? (
        <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/20 rounded-xl">
          <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-500">
            <span className="text-xs font-black">✕</span>
          </div>
          <p className="text-sm font-bold text-red-700 dark:text-red-400">
            {STATUS_CONFIG[status]?.label}
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-0 overflow-x-auto pb-1">
          {WORKFLOW_STAGES.map((stage, idx) => {
            const isDone    = idx < activeIdx;
            const isActive  = idx === activeIdx;
            const isPending = idx > activeIdx;
            const isLast    = idx === WORKFLOW_STAGES.length - 1;

            return (
              <React.Fragment key={stage.status}>
                <div className="flex flex-col items-center gap-1.5 shrink-0 w-[88px]">
                  {/* Bubble */}
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                    isDone
                      ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white'
                      : isActive
                      ? 'bg-white dark:bg-nocturne border-[var(--color-brand)] text-[var(--color-brand)]'
                      : 'bg-white dark:bg-nocturne border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600'
                  }`}>
                    {isDone
                      ? <Check size={12} strokeWidth={3} />
                      : <span className="text-[10px] font-black">{idx + 1}</span>
                    }
                  </div>
                  {/* Label */}
                  <p className={`text-[10px] text-center font-bold leading-tight ${
                    isDone    ? 'text-[var(--color-brand)]'
                    : isActive ? 'text-gray-900 dark:text-white'
                    : 'text-gray-400 dark:text-gray-600'
                  }`}>
                    {stage.label}
                  </p>
                  {/* Sublabel — only visible on active */}
                  {isActive && (
                    <p className="text-[9px] text-center text-gray-400 dark:text-gray-500 leading-tight px-1">
                      {stage.sublabel}
                    </p>
                  )}
                </div>

                {/* Connector */}
                {!isLast && (
                  <div className="flex-1 mt-3.5 min-w-[12px]">
                    <div className={`h-0.5 w-full rounded transition-all ${
                      idx < activeIdx ? 'bg-[var(--color-brand)]' : 'bg-gray-200 dark:bg-gray-700'
                    }`} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function MyItemRequests() {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [requests, setRequests]     = useState<ItemRequest[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getMyItemRequests(currentUser?.id);
        setRequests(data);
      } catch (error) {
        console.error('Failed to load requests', error);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [currentUser?.id]);

  const filteredRequests = requests.filter(r =>
    generateItemCode(r.item_description).toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.item_description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col gap-6 animate-page-entry">

      {/* Header row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="My Item Requests"
          subtitle="Track and manage your requests for new items."
        />
        <button
          onClick={() => navigate('/items/new-request')}
          className="bg-[var(--color-brand)] text-white px-5 py-2 rounded-xl font-bold shadow-lg shadow-[var(--color-brand)]/20 hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 shrink-0 text-sm"
        >
          <Plus size={16} /> New Item Request
        </button>
      </div>

      {/* Table card */}
      <div className="bg-white dark:bg-nocturne rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col">

        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by request number or description…"
              className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2.5 bg-gray-50 dark:bg-white/5 text-gray-500 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 transition-colors">
              <Filter size={18} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#15171e]/50">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 w-8" />
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">Item Code</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">Description</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 text-right">Created</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">Loading requests</td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="px-6 py-20 flex flex-col items-center">
                      <FileText size={48} className="text-gray-200 dark:text-gray-700 mb-4" />
                      <p className="text-gray-500 dark:text-gray-400 font-medium">No item requests found.</p>
                      <button
                        onClick={() => navigate('/items/new-request')}
                        className="mt-4 text-[var(--color-brand)] font-bold text-sm hover:underline"
                      >
                        Create your first request
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map(request => {
                  const isExpanded = expandedId === request.id;
                  return (
                    <React.Fragment key={request.id}>
                      <tr
                        className={`transition-colors cursor-pointer group ${
                          isExpanded
                            ? "bg-gray-50 dark:bg-white/5"
                            : "hover:bg-gray-50 dark:hover:bg-white/5 border-b border-gray-100 dark:border-gray-800"
                        }`}
                        onClick={() => toggleExpand(request.id)}
                      >
                        <td className="pl-4 pr-2 py-5 w-8">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold font-mono text-gray-900 dark:text-white group-hover:text-[var(--color-brand)] transition-colors">
                              {generateItemCode(request.item_description)}
                            </span>
                            {request.is_urgent && (
                              <span className="bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-500 text-[10px] font-black px-1.5 py-0.5 rounded border border-red-200 dark:border-red-500/20 flex items-center gap-0.5">
                                <Zap size={9} /> URGENT
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                            {REQUEST_TYPE_LABELS[request.request_type] || request.request_type}
                          </span>
                        </td>
                        <td className="px-6 py-5 min-w-[200px] max-w-xs">
                          <p className="text-sm text-gray-700 dark:text-gray-300 truncate" title={request.item_description}>
                            {request.item_description}
                          </p>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider ${STATUS_CONFIG[request.status]?.color || "bg-gray-100"}`}>
                            {STATUS_CONFIG[request.status]?.label || request.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-sm text-gray-900 dark:text-white font-medium">{formatDate(request.created_at)}</span>
                            <div className="flex items-center gap-1 mt-0.5 text-gray-400">
                              <Clock size={12} />
                              <span className="text-[10px] uppercase font-bold">
                                {new Date(request.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-gray-800">
                          <td colSpan={6} className="px-0 py-0">
                            <StatusTimeline status={request.status} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/10 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
        <div className="bg-indigo-100 dark:bg-indigo-500/20 p-4 rounded-2xl text-indigo-600 dark:text-indigo-400">
          <AlertCircle size={32} />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h4 className="font-bold text-indigo-900 dark:text-white mb-1">New Item Process</h4>
          <p className="text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed">
            Requests typically take 2-3 business days to be reviewed. Click any row to expand the progress timeline.
            Pricing and supplier assignment happens during the Pricing Review stage.
          </p>
        </div>
        <button
          onClick={() => navigate('/help?category=item-creation')}
          className="whitespace-nowrap px-6 py-2.5 bg-white dark:bg-white/10 text-indigo-600 dark:text-white font-bold rounded-xl border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-white/20 transition-all text-sm"
        >
          Learn More
        </button>
      </div>

    </div>
  );
}
