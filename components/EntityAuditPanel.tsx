import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import {
    History, User, RefreshCw, ChevronDown, ChevronUp,
    Plus, Trash2, Edit2, AlertCircle, ArrowRight
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawAuditLog {
    id: string;
    action_type: string;
    performed_by: string | null;
    summary: {
        table?: string;
        operation?: 'INSERT' | 'UPDATE' | 'DELETE';
        recordId?: string;
        changedCount?: number;
    };
    details: {
        changedFields?: Record<string, { old: unknown; new: unknown }>;
        old?: Record<string, unknown>;
        new?: Record<string, unknown>;
    };
    created_at: string;
    performer?: { name: string } | { name: string }[] | any;
}

interface EntityAuditPanelProps {
    /** Primary entity ID (e.g. the item.id or po.id) */
    recordId: string;
    /** Optional additional related record IDs to include (e.g. po_line ids) */
    relatedIds?: string[];
    /** Limit to specific table names */
    tableFilter?: string[];
    /** Label shown in the empty-state */
    entityLabel?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
    status: 'Status',
    unit_price: 'Unit Price',
    quantity_ordered: 'Quantity Ordered',
    quantity_received: 'Quantity Received',
    total_price: 'Total Price',
    updated_at: 'Updated At',
    created_at: 'Created At',
    active_flag: 'Active',
    name: 'Name',
    description: 'Description',
    sku: 'SKU',
    category: 'Category',
    sub_category: 'Sub-Category',
    range_name: 'Range',
    stock_type: 'Stock Type',
    item_pool: 'Item Pool',
    item_catalog: 'Item Catalog',
    item_type: 'Item Type',
    rfid_flag: 'RFID Tagged',
    cog_flag: 'COG Item',
    cog_customer: 'COG Customer',
    item_colour: 'Colour',
    item_pattern: 'Pattern',
    item_material: 'Material',
    item_size: 'Size',
    uom: 'Unit of Measure',
    upq: 'Units Per Qty',
    concur_request_number: 'Concur Request #',
    concur_po_number: 'Concur PO #',
    approval_history: 'Approval History',
    docket_number: 'Docket #',
    received_by: 'Received By',
    is_capitalised: 'Capitalised',
    invoice_number: 'Invoice #',
    quantity: 'Quantity',
};

const HIDDEN_FIELDS = new Set([
    'id', 'created_at', 'updated_at', 'sap_item_code_norm', 'sap_item_code_raw',
    'specs', 'supplier_id', 'site_id', 'requester_id', 'approver_id',
    'po_request_id', 'delivery_id', 'po_line_id', 'received_by_id'
]);

function humanizeField(key: string): string {
    return FIELD_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatValue(val: unknown): string {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'number') return val.toString();
    if (typeof val === 'object') return JSON.stringify(val).substring(0, 60);
    const s = String(val);
    // Detect ISO dates
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
        try { return new Date(s).toLocaleString(); } catch { return s; }
    }
    return s;
}

function getOperationColor(op: string | undefined) {
    if (op === 'INSERT') return {
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        text: 'text-emerald-700 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-500/30',
        icon: <Plus size={14} />,
        dot: 'bg-emerald-500'
    };
    if (op === 'DELETE') return {
        bg: 'bg-red-50 dark:bg-red-900/20',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-200 dark:border-red-500/30',
        icon: <Trash2 size={14} />,
        dot: 'bg-red-500'
    };
    return {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-500/30',
        icon: <Edit2 size={14} />,
        dot: 'bg-blue-500'
    };
}

function humanizeTableName(table: string): string {
    const map: Record<string, string> = {
        items: 'Item',
        po_requests: 'PO Request',
        po_lines: 'PO Line',
        po_approvals: 'Approval',
        deliveries: 'Delivery',
        delivery_lines: 'Delivery Line',
        preview_item_requests:           'Item Request',
        preview_item_approval_instances: 'Approval Decision',
        preview_publication_events:      'Publication Event',
    };
    return map[table] ?? table.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

interface ChangedFieldsProps {
    changed: Record<string, { old: unknown; new: unknown }>;
}

const ChangedFields: React.FC<ChangedFieldsProps> = ({ changed }) => {
    const entries = Object.entries(changed).filter(([k]) => !HIDDEN_FIELDS.has(k));
    if (entries.length === 0) return null;

    return (
        <div className="mt-3 space-y-2">
            {entries.map(([key, { old: oldVal, new: newVal }]) => (
                <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1.5 text-xs">
                    <span className="font-semibold text-gray-700 dark:text-gray-300 min-w-[130px] shrink-0">
                        {humanizeField(key)}
                    </span>
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 font-mono truncate max-w-[180px]">
                            {formatValue(oldVal)}
                        </span>
                        <ArrowRight size={12} className="text-gray-400 shrink-0" />
                        <span className="px-2 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/20 font-mono truncate max-w-[180px]">
                            {formatValue(newVal)}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const EntityAuditPanel: React.FC<EntityAuditPanelProps> = ({
    recordId,
    relatedIds = [],
    tableFilter,
    entityLabel = 'record'
}) => {
    const [logs, setLogs] = useState<RawAuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);

    const allIds = [recordId, ...relatedIds].filter(Boolean);

    const fetchLogs = useCallback(async () => {
        if (!recordId) return;
        setIsLoading(true);
        setError(null);
        try {
            // Query system_audit_logs where summary->>'recordId' is one of the tracked IDs.
            // Supabase PostgREST supports filter on JSONB with the ->> operator via `.filter()`
            let query = supabase
                .from('system_audit_logs')
                .select('*')
                .order('created_at', { ascending: false });

            // Apply filters
            const allIds = [recordId, ...relatedIds].filter(Boolean);
            if (allIds.length === 1) {
                query = query.filter('summary->>recordId', 'eq', allIds[0]);
            } else if (allIds.length > 1) {
                query = query.in('summary->>recordId', allIds);
            }

            if (tableFilter && tableFilter.length > 0) {
                query = query.in('summary->>table', tableFilter);
            }

            const { data, error: fetchError } = await query.limit(200);
            if (fetchError) throw fetchError;

            const logsData = (data as RawAuditLog[]) || [];

            // 2. Manually resolve performer names to avoid join issues
            const performerIds = [...new Set(logsData.map(l => l.performed_by).filter(Boolean))];
            
            if (performerIds.length > 0) {
                const { data: userData } = await supabase
                    .from('users')
                    .select('id, auth_user_id, name')
                    .or(`id.in.(${performerIds.join(',')}),auth_user_id.in.(${performerIds.join(',')})`);
                
                if (userData) {
                    const userMap = new Map();
                    userData.forEach(u => {
                        if (u.id) userMap.set(u.id, u.name);
                        if (u.auth_user_id) userMap.set(u.auth_user_id, u.name);
                    });
                    
                    logsData.forEach(l => {
                        if (l.performed_by && userMap.has(l.performed_by)) {
                            l.performer = { name: userMap.get(l.performed_by) };
                        }
                    });
                }
            }

            setLogs(logsData);
        } catch (e: unknown) {
            console.error('EntityAuditPanel: fetch failed', e);
            setError(e instanceof Error ? e.message : 'Failed to load audit history.');
        } finally {
            setIsLoading(false);
        }
    }, [recordId, relatedIds.join(','), tableFilter?.join(',')]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400 dark:text-gray-600">
                <div className="w-8 h-8 border-2 border-gray-300 dark:border-gray-700 border-t-[var(--color-brand)] rounded-full animate-spin" />
                <p className="text-sm">Loading audit history...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-red-500">
                <AlertCircle size={32} className="opacity-70" />
                <p className="text-sm font-medium">{error}</p>
                <button type="button" onClick={fetchLogs} className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white underline">
                    Try again
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <History size={16} className="text-[var(--color-brand)]" />
                    <span className="text-sm font-semibold">
                        {logs.length} audit event{logs.length !== 1 ? 's' : ''} recorded
                    </span>
                </div>
                <button
                    type="button"
                    onClick={fetchLogs}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                    <RefreshCw size={12} />
                    Refresh
                </button>
            </div>

            {/* Timeline */}
            {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400 dark:text-gray-500">
                    <History size={40} strokeWidth={1} className="opacity-40" />
                    <p className="text-sm font-medium">No audit events found for this {entityLabel}.</p>
                    <p className="text-xs opacity-70">Changes are automatically captured when data is modified.</p>
                </div>
            ) : (
                <div className="relative">
                    {/* Vertical timeline line */}
                    <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-gray-100 dark:bg-gray-800" />

                    <div className="space-y-3">
                        {logs.map((log) => {
                            const op = log.summary?.operation;
                            const table = log.summary?.table;
                            const colors = getOperationColor(op);
                            const isExpanded = expandedIds.has(log.id);
                            const changedFields = log.details?.changedFields;
                            const hasDetails = changedFields && Object.keys(changedFields).length > 0;
                            const visibleChanges = hasDetails
                                ? Object.entries(changedFields!).filter(([k]) => !HIDDEN_FIELDS.has(k))
                                : [];

                            return (
                                <div key={log.id} className="relative flex gap-3 pl-2">
                                    {/* Timeline dot */}
                                    <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white dark:border-[#1e2029] shadow-sm ${colors.bg} ${colors.text}`}>
                                        {colors.icon}
                                    </div>

                                    {/* Card */}
                                    <div className={`flex-1 rounded-xl border ${colors.border} ${colors.bg} overflow-hidden mb-1 min-w-0`}>
                                        <div
                                            className={`px-4 py-3 ${visibleChanges.length > 0 ? 'cursor-pointer hover:brightness-95 dark:hover:brightness-110 transition-all' : ''}`}
                                            onClick={() => visibleChanges.length > 0 && toggleExpand(log.id)}
                                        >
                                            <div className="flex items-start justify-between gap-2 min-w-0">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${colors.text} ${colors.border} ${colors.bg}`}>
                                                            {op || '?'}
                                                        </span>
                                                        {table && (
                                                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                                                {humanizeTableName(table)}
                                                            </span>
                                                        )}
                                                        {visibleChanges.length > 0 && (
                                                            <span className="text-[10px] text-gray-500 dark:text-gray-500">
                                                                {visibleChanges.length} field{visibleChanges.length !== 1 ? 's' : ''} changed
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                                        <span className="flex items-center gap-1">
                                                            <User size={11} />
                                                            <span className="font-medium text-gray-700 dark:text-gray-300">
                                                                {Array.isArray(log.performer) ? log.performer[0]?.name : log.performer?.name || 'System'}
                                                            </span>
                                                        </span>
                                                        <span className="font-mono text-[11px]">
                                                            {new Date(log.created_at).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>

                                                {visibleChanges.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={e => { e.stopPropagation(); toggleExpand(log.id); }}
                                                        className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                                                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                                    >
                                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                    </button>
                                                )}
                                            </div>

                                            {/* Expanded diff view */}
                                            {isExpanded && changedFields && visibleChanges.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-current/10">
                                                    <ChangedFields
                                                        changed={Object.fromEntries(visibleChanges) as Record<string, { old: unknown; new: unknown }>}
                                                    />
                                                </div>
                                            )}

                                            {/* INSERT: show key new fields */}
                                            {op === 'INSERT' && log.details?.new && (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {['name', 'sku', 'status', 'quantity_ordered', 'unit_price', 'docket_number'].map(field => {
                                                        const val = (log.details.new as Record<string, unknown>)[field];
                                                        if (val === null || val === undefined || val === '') return null;
                                                        return (
                                                            <span key={field} className="text-[11px] px-2 py-0.5 bg-white/60 dark:bg-black/20 rounded border border-current/10 font-mono">
                                                                <span className="opacity-60">{humanizeField(field)}: </span>
                                                                {formatValue(val)}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EntityAuditPanel;
