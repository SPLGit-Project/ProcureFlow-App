import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { supabase } from '../lib/supabaseClient.ts';
import { itemCreationPreviewService } from '../services/itemCreationPreviewService.ts';
import { PreviewItemRequestBundle } from '../types.ts';
import ItemApprovalReview from './ItemApprovalReview.tsx';
import { ClipboardCheck, RefreshCw, Clock, AlertCircle, ChevronRight } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueueItem {
    id: string;
    request_number: string;
    proposed_description: string;
    requestor_name: string;
    lifecycle_status: string;
    created_at: string;
    item_group: string | null;
    business_unit: string | null;
    instance_started_at: string | null;
    sla_hours: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SlaCountdown({ startedAt, slaHours }: { startedAt: string | null; slaHours: number | null }) {
    if (!startedAt || !slaHours) return null;
    const elapsed = (Date.now() - new Date(startedAt).getTime()) / 3600000;
    const remaining = slaHours - elapsed;
    if (remaining <= 0) return <span className="text-xs font-bold text-red-600 dark:text-red-400">Overdue</span>;
    const h = Math.floor(remaining);
    const m = Math.floor((remaining - h) * 60);
    const urgent = remaining < slaHours * 0.25;
    return (
        <span className={`text-xs font-medium ${urgent ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
            <Clock size={11} className="inline mr-1" />{h}h {m}m
        </span>
    );
}

const STATUS_BADGE: Record<string, string> = {
    Submitted:        'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    'Pending Review': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    'In Approval':    'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
};

// ── Main component ────────────────────────────────────────────────────────────

export default function ItemApprovalQueue() {
    const { hasPermission, currentUser } = useApp();

    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [bundle, setBundle] = useState<PreviewItemRequestBundle | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadQueue = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('preview_item_requests')
                .select(`
                    id, request_number, proposed_description, requestor_name,
                    lifecycle_status, created_at, item_group, business_unit,
                    preview_item_approval_instances (started_at, status)
                `)
                .in('lifecycle_status', ['Submitted', 'Pending Review', 'In Approval'])
                .order('created_at', { ascending: true });
            if (error) throw error;

            interface RawRow {
                id: string; request_number: string; proposed_description: string;
                requestor_name: string; lifecycle_status: string; created_at: string;
                item_group: string | null; business_unit: string | null;
                preview_item_approval_instances: { started_at: string; status: string }[];
            }

            const rows = (data as unknown as RawRow[]).map(row => {
                const pending = row.preview_item_approval_instances?.find(i => i.status === 'Pending');
                return {
                    id: row.id,
                    request_number: row.request_number,
                    proposed_description: row.proposed_description,
                    requestor_name: row.requestor_name,
                    lifecycle_status: row.lifecycle_status,
                    created_at: row.created_at,
                    item_group: row.item_group,
                    business_unit: row.business_unit,
                    instance_started_at: pending?.started_at ?? null,
                    sla_hours: 48,
                } as QueueItem;
            });
            setQueue(rows);
            if (rows.length > 0 && !selectedId) setSelectedId(rows[0].id);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    }, [selectedId]);

    const loadBundle = useCallback(async (id: string) => {
        try {
            const bundles = await itemCreationPreviewService.listBundles();
            const found = bundles.find(b => b.request.id === id) ?? null;
            setBundle(found);
        } catch (err) {
            console.error('Failed to load bundle:', err);
        }
    }, []);

    useEffect(() => { loadQueue(); }, [loadQueue]);

    useEffect(() => {
        if (selectedId) loadBundle(selectedId);
        else setBundle(null);
    }, [selectedId, loadBundle]);

    const handleDecision = useCallback(async (
        requestId: string,
        decision: 'Approve' | 'Reject' | 'Escalate',
        comments: string
    ) => {
        setIsSaving(true);
        try {
            await itemCreationPreviewService.recordApprovalDecision(
                requestId, decision,
                currentUser?.id, currentUser?.name, comments
            );
            await loadQueue();
            setSelectedId(null);
            setBundle(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    }, [currentUser, loadQueue]);

    // ── Permission gate ───────────────────────────────────────────────────────

    if (!hasPermission('approve_item_requests') && !hasPermission('manage_development')) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="text-center p-8 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 shadow-xl max-w-md">
                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <ClipboardCheck size={32} />
                    </div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">Access Restricted</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">You need the <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">approve_item_requests</code> permission to access the approval queue.</p>
                </div>
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                        <ClipboardCheck size={24} className="text-amber-500" />
                        Item Approval Queue
                    </h1>
                    <p className="text-gray-500 dark:text-slate-400 mt-1">
                        {queue.length} request{queue.length !== 1 ? 's' : ''} pending approval
                    </p>
                </div>
                <button
                    onClick={loadQueue}
                    disabled={isLoading}
                    className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                    <RefreshCw size={16} className={isLoading ? 'animate-spin text-gray-400' : 'text-gray-500'} />
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
                    <AlertCircle size={14} className="shrink-0" />
                    {error}
                    <button className="ml-auto underline" onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            {queue.length === 0 && !isLoading ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-600 gap-3">
                    <ClipboardCheck size={40} className="opacity-30" />
                    <p className="text-sm font-medium">No requests pending your approval.</p>
                    <p className="text-xs">New item creation requests will appear here once submitted.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-1 min-h-0">
                    {/* Queue list */}
                    <div className="lg:col-span-2 flex flex-col gap-2 overflow-y-auto">
                        {queue.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setSelectedId(item.id)}
                                className={`w-full text-left p-4 rounded-2xl border transition-all ${
                                    selectedId === item.id
                                        ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-sm'
                                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e2029] hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-mono text-xs text-gray-400 dark:text-gray-500 mb-0.5">{item.request_number}</div>
                                        <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">{item.proposed_description}</div>
                                    </div>
                                    <ChevronRight size={16} className={`shrink-0 mt-0.5 transition-transform ${selectedId === item.id ? 'rotate-90 text-amber-500' : 'text-gray-400'}`} />
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[item.lifecycle_status] ?? 'bg-gray-100 text-gray-600'}`}>
                                        {item.lifecycle_status}
                                    </span>
                                    <SlaCountdown startedAt={item.instance_started_at} slaHours={item.sla_hours} />
                                </div>
                                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                                    {item.requestor_name} · {new Date(item.created_at).toLocaleDateString()}
                                    {item.business_unit && ` · ${item.business_unit}`}
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Review panel */}
                    <div className="lg:col-span-3 overflow-y-auto">
                        {bundle ? (
                            <ItemApprovalReview
                                bundle={bundle}
                                isSaving={isSaving}
                                onApprove={(id, comments) => handleDecision(id, 'Approve', comments)}
                                onReject={(id, comments) => handleDecision(id, 'Reject', comments)}
                                onRequestRevision={(id, comments) => handleDecision(id, 'Escalate', comments)}
                            />
                        ) : selectedId ? (
                            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                                <RefreshCw size={16} className="animate-spin mr-2" /> Loading request…
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                                Select a request from the list to review.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
