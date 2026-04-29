import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { supabase } from '../lib/supabaseClient.ts';
import { BookOpen, Search, RefreshCw, AlertCircle, Package } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CatalogueItem {
    id: string;
    request_number: string;
    proposed_description: string;
    generated_sku: string | null;
    business_unit: string | null;
    division: string | null;
    item_group: string | null;
    current_sell_price: number | null;
    current_margin_percent: number | null;
    sale_enabled: boolean;
    bundle_enabled: boolean;
    linenhub_enabled: boolean;
    lifecycle_status: string;
    created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function PublicationBadge({ label, enabled }: { label: string; enabled: boolean }) {
    if (!enabled) return null;
    return (
        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-tranquil,#129DC0)]/10 text-[var(--color-tranquil,#129DC0)] font-medium border border-[var(--color-tranquil,#129DC0)]/20">
            {label}
        </span>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ItemCatalogue() {
    const { featureFlags } = useApp();

    const [items, setItems] = useState<CatalogueItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [filterBU, setFilterBU] = useState('');
    const [filterDivision, setFilterDivision] = useState('');

    const loadItems = async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (featureFlags?.goLiveEnabled) {
                // Post-go-live: query the live items table
                const { data, error } = await supabase
                    .from('items')
                    .select('id, name, sku, category, sub_category')
                    .order('name');
                if (error) throw error;
                setItems((data || []).map((r: { id: string; name: string; sku: string; category: string; sub_category: string }) => ({
                    id: r.id,
                    request_number: '',
                    proposed_description: r.name,
                    generated_sku: r.sku,
                    business_unit: r.category,
                    division: r.sub_category,
                    item_group: null,
                    current_sell_price: null,
                    current_margin_percent: null,
                    sale_enabled: true,
                    bundle_enabled: false,
                    linenhub_enabled: false,
                    lifecycle_status: 'Live',
                    created_at: '',
                })));
            } else {
                // Pre-go-live: query approved preview requests
                const { data, error } = await supabase
                    .from('preview_item_requests')
                    .select(`
                        id, request_number, proposed_description, generated_sku,
                        business_unit, division, item_group,
                        current_sell_price, current_margin_percent,
                        sale_enabled, bundle_enabled, linenhub_enabled,
                        lifecycle_status, created_at
                    `)
                    .eq('lifecycle_status', 'Approved')
                    .order('created_at', { ascending: false });
                if (error) throw error;
                setItems((data || []) as CatalogueItem[]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadItems(); }, [featureFlags?.goLiveEnabled]);

    // ── Filter ────────────────────────────────────────────────────────────────

    const allBUs = useMemo(() =>
        [...new Set(items.map(i => i.business_unit).filter(Boolean))] as string[],
        [items]
    );
    const allDivisions = useMemo(() =>
        [...new Set(items.map(i => i.division).filter(Boolean))] as string[],
        [items]
    );

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return items.filter(item => {
            if (filterBU && item.business_unit !== filterBU) return false;
            if (filterDivision && item.division !== filterDivision) return false;
            if (q && !item.proposed_description.toLowerCase().includes(q) &&
                !(item.generated_sku ?? '').toLowerCase().includes(q)) return false;
            return true;
        });
    }, [items, search, filterBU, filterDivision]);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                        <BookOpen size={24} className="text-[var(--color-tranquil,#129DC0)]" />
                        Item Catalogue
                        {featureFlags?.goLiveEnabled
                            ? <span className="text-xs font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">Live</span>
                            : <span className="text-xs font-bold bg-amber-400 text-white px-2 py-0.5 rounded-full">Preview</span>
                        }
                    </h1>
                    <p className="text-gray-500 dark:text-slate-400 mt-1">
                        {featureFlags?.goLiveEnabled
                            ? 'All active items in the approved catalogue.'
                            : 'Approved items from the item creation preview. Showing pre-go-live records.'}
                    </p>
                </div>
                <button
                    onClick={loadItems}
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

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search description or SKU…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-tranquil,#129DC0)]/30"
                    />
                </div>
                {allBUs.length > 0 && (
                    <select
                        value={filterBU}
                        onChange={e => setFilterBU(e.target.value)}
                        className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                    >
                        <option value="">All Business Units</option>
                        {allBUs.map(bu => <option key={bu} value={bu}>{bu}</option>)}
                    </select>
                )}
                {allDivisions.length > 0 && (
                    <select
                        value={filterDivision}
                        onChange={e => setFilterDivision(e.target.value)}
                        className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                    >
                        <option value="">All Divisions</option>
                        {allDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                )}
                {(search || filterBU || filterDivision) && (
                    <button
                        onClick={() => { setSearch(''); setFilterBU(''); setFilterDivision(''); }}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="flex-1 bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                        <Package size={16} className="text-[var(--color-tranquil,#129DC0)]" />
                        {filtered.length} item{filtered.length !== 1 ? 's' : ''}
                    </h2>
                </div>

                {isLoading && filtered.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-gray-400 text-sm gap-2">
                        <RefreshCw size={14} className="animate-spin" /> Loading…
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-600 gap-3">
                        <BookOpen size={40} className="opacity-30" />
                        <p className="text-sm font-medium">No approved items yet.</p>
                        <p className="text-xs text-center max-w-xs">
                            {search || filterBU || filterDivision
                                ? 'No items match your filters.'
                                : 'Items appear here after completing the approval workflow in Item Preview.'}
                        </p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead className="bg-gray-50 dark:bg-[#15171e] text-xs uppercase tracking-wider text-gray-500 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800">Description</th>
                                    <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800">SKU</th>
                                    <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800">Business Unit</th>
                                    <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800">Division</th>
                                    <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800 text-right">Sell Price</th>
                                    <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800 text-right">Margin %</th>
                                    <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800">Published To</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                                {filtered.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                            {item.proposed_description}
                                            {item.request_number && (
                                                <div className="text-xs font-mono text-gray-400 mt-0.5">{item.request_number}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                                            {item.generated_sku ?? <span className="text-gray-300 dark:text-gray-700">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{item.business_unit ?? '—'}</td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{item.division ?? '—'}</td>
                                        <td className="px-4 py-3 text-right text-gray-800 dark:text-gray-200 font-mono text-xs">
                                            {item.current_sell_price != null
                                                ? `$${item.current_sell_price.toFixed(2)}`
                                                : <span className="text-gray-300 dark:text-gray-700">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs">
                                            {item.current_margin_percent != null ? (
                                                <span className={item.current_margin_percent < 20 ? 'text-red-500' : item.current_margin_percent < 25 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}>
                                                    {item.current_margin_percent.toFixed(1)}%
                                                </span>
                                            ) : <span className="text-gray-300 dark:text-gray-700">—</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1 flex-wrap">
                                                <PublicationBadge label="Bundle" enabled={item.bundle_enabled} />
                                                <PublicationBadge label="LinenHub" enabled={item.linenhub_enabled} />
                                                <PublicationBadge label="Salesforce" enabled={item.sale_enabled} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
