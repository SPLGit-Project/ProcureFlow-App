import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { calculateBuyingPlan, ItemContext, AllocatedItem } from '../utils/shortSupplyEngine.ts';
import { azureDbService, ShortSupplyRow, StarMetric } from '../services/azureDbService.ts';
import { BC_ACTIVE_SITES, BcSiteCode } from '../services/bundleConnectSyncService.ts';
import PageHeader from './PageHeader';
import {
    DollarSign, BarChart3, Package, TrendingUp, Save, Clock,
    RefreshCw, Database, Upload, History, AlertCircle, CheckCircle2
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RefItemProps {
    stk_key: string;
    site_code: string | null;
    depreciation_months: number;
    shrinkage_percent: number;
    star_override: number | null;
}

interface RefItemPricing {
    stk_key: string;
    site_code: string | null;
    purchase_price: number;
}

interface SavedPlanItem {
    itemId: string;
    itemName: string;
    allocatedQty: number;
    estimatedSpend: number;
    annualUplift: number;
    starDays: number;
    efficiency: number;
}

interface SavedPlan {
    id: string;
    created_at: string;
    created_by: string | null;
    sites: string[];
    budget: number;
    ss_percent: number;
    data_mode: 'live' | 'manual';
    total_spend: number | null;
    total_uplift: number | null;
    total_units: number | null;
    plan_items: SavedPlanItem[];
    notes: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SmartBuyingDashboard() {
    const { activeSiteIds, hasPermission, featureFlags } = useApp();
    const v2Enabled = featureFlags?.smartBuyingV2Enabled ?? false;

    // All hooks declared before any conditional return (Rules of Hooks)
    const [budget, setBudget] = useState(50000);
    const [ssPercent, setSsPercent] = useState(100);
    const [allocatedPlans, setAllocatedPlans] = useState<AllocatedItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [items, setItems] = useState<ItemContext[]>([]);
    const [dataMode, setDataMode] = useState<'live' | 'manual'>('manual');
    const [selectedSites, setSelectedSites] = useState<BcSiteCode[]>(['MEL']);
    const [activeView, setActiveView] = useState<'plan' | 'history'>('plan');
    const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const activeSiteId = activeSiteIds.length > 0 ? activeSiteIds[0] : null;

    // ── Data fetching ──────────────────────────────────────────────────────────

    const fetchLiveData = useCallback(async () => {
        if (selectedSites.length === 0) return;
        setIsLoading(true);
        setLoadError(null);
        try {
            const [shortSupplyRows, starMetrics, refProps, refPricing] = await Promise.all([
                azureDbService.getShortSupplyData(selectedSites),
                azureDbService.getStarMetrics(selectedSites),
                supabase
                    .from('ref_short_supply_item_properties')
                    .select('stk_key,site_code,depreciation_months,shrinkage_percent,star_override')
                    .eq('is_active', true)
                    .then(r => (r.data || []) as RefItemProps[]),
                supabase
                    .from('ref_short_supply_pricing')
                    .select('stk_key,site_code,purchase_price')
                    .eq('is_active', true)
                    .lte('effective_from', new Date().toISOString().slice(0, 10))
                    .or('effective_to.is.null,effective_to.gte.' + new Date().toISOString().slice(0, 10))
                    .then(r => (r.data || []) as RefItemPricing[]),
            ]);

            // Build lookup maps for overrides
            const starMap = new Map<string, number>();
            starMetrics.forEach((m: StarMetric) => {
                starMap.set(`${m.siteCode}:${m.stkKey}`, m.starDays);
            });

            const propMap = new Map<string, RefItemProps>();
            (refProps as RefItemProps[]).forEach(p => {
                const key = p.site_code ? `${p.site_code}:${p.stk_key}` : `*:${p.stk_key}`;
                propMap.set(key, p);
            });

            const priceMap = new Map<string, number>();
            (refPricing as RefItemPricing[]).forEach(p => {
                const key = p.site_code ? `${p.site_code}:${p.stk_key}` : `*:${p.stk_key}`;
                priceMap.set(key, p.purchase_price);
            });

            const mapped: ItemContext[] = shortSupplyRows.map((row: ShortSupplyRow) => {
                const siteSpecificKey = `${row.siteCode}:${row.stkKey}`;
                const globalKey = `*:${row.stkKey}`;
                const props = propMap.get(siteSpecificKey) ?? propMap.get(globalKey);
                const price = priceMap.get(siteSpecificKey) ?? priceMap.get(globalKey);

                // STAR: row may have it pre-joined; fall back to StarMetric; then property override
                const starFromRow = row.starDays ?? 0;
                const starFromMetric = starMap.get(siteSpecificKey) ?? 0;
                const starFromOverride = props?.star_override ?? 0;
                const starDays = starFromOverride > 0 ? starFromOverride
                    : starFromRow > 0 ? starFromRow
                    : starFromMetric;

                return {
                    id:                 `${row.siteCode}:${row.stkKey}`,
                    name:               `${row.description} (${row.siteCode})`,
                    shortQty:           row.shortQty,
                    starDays,
                    depreciationMonths: props?.depreciation_months ?? 36,
                    shrinkagePercent:   props?.shrinkage_percent ?? 5,
                    revenuePerCycle:    row.launderChg + row.hireChg,
                    purchasePrice:      price ?? 0,
                    weightKg:           row.weight,
                };
            });

            setItems(mapped);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setLoadError(`Live data load failed: ${msg}`);
        } finally {
            setIsLoading(false);
        }
    }, [selectedSites]);

    const fetchManualData = useCallback(async () => {
        if (!activeSiteId) return;
        setIsLoading(true);
        setLoadError(null);
        try {
            const now = new Date();
            const { data, error } = await supabase
                .from('short_supply_facts')
                .select(`
                    ordered_qty, short_qty, master_item_id,
                    items:master_item_id (name),
                    metrics:item_operational_metrics!master_item_id (star_days,revenue_per_cycle,weight_kg),
                    properties:ref_item_properties!master_item_id (depreciation_months,shrinkage_percent),
                    pricing:ref_item_pricing!master_item_id (purchase_price)
                `)
                .eq('site_id', activeSiteId)
                .eq('period_month', now.getMonth() + 1)
                .eq('period_year', now.getFullYear());

            if (error) throw error;

            interface SsfRow {
                short_qty: number;
                master_item_id: string;
                items: { name: string } | null;
                metrics: { star_days: number; revenue_per_cycle: number; weight_kg: number }[] | null;
                properties: { depreciation_months: number; shrinkage_percent: number }[] | null;
                pricing: { purchase_price: number }[] | null;
            }

            setItems(((data as unknown) as SsfRow[]).map(row => ({
                id:                 row.master_item_id,
                name:               row.items?.name || 'Unknown Item',
                shortQty:           row.short_qty || 0,
                starDays:           row.metrics?.[0]?.star_days || 0,
                depreciationMonths: row.properties?.[0]?.depreciation_months || 36,
                shrinkagePercent:   row.properties?.[0]?.shrinkage_percent || 5,
                revenuePerCycle:    row.metrics?.[0]?.revenue_per_cycle || 0,
                purchasePrice:      row.pricing?.[0]?.purchase_price || 0,
                weightKg:           row.metrics?.[0]?.weight_kg || 0,
            })));
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setLoadError(`Data load failed: ${msg}`);
        } finally {
            setIsLoading(false);
        }
    }, [activeSiteId]);

    useEffect(() => {
        if (dataMode === 'live') {
            fetchLiveData();
        } else {
            fetchManualData();
        }
    }, [dataMode, fetchLiveData, fetchManualData]);

    useEffect(() => {
        setAllocatedPlans(calculateBuyingPlan(items, budget, ssPercent));
    }, [items, budget, ssPercent]);

    // Load saved plans history
    const fetchSavedPlans = useCallback(async () => {
        const { data } = await supabase
            .from('short_supply_plans')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
        if (data) setSavedPlans(data as SavedPlan[]);
    }, []);

    useEffect(() => {
        if (activeView === 'history') fetchSavedPlans();
    }, [activeView, fetchSavedPlans]);

    // ── Summary ───────────────────────────────────────────────────────────────

    const summary = useMemo(() => {
        let totalSpend = 0, totalUplift = 0, totalUnits = 0;
        allocatedPlans.forEach(p => {
            totalSpend  += p.estimatedSpend;
            totalUplift += p.annualUplift;
            totalUnits  += p.allocatedQty;
        });
        return { totalSpend, totalUplift, totalUnits, remaining: budget - totalSpend };
    }, [allocatedPlans, budget]);

    // ── Save plan ─────────────────────────────────────────────────────────────

    const handleSavePlan = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        try {
            const planItems: SavedPlanItem[] = allocatedPlans.map(p => ({
                itemId:        p.id,
                itemName:      p.name,
                allocatedQty:  p.allocatedQty,
                estimatedSpend: p.estimatedSpend,
                annualUplift:  p.annualUplift,
                starDays:      items.find(i => i.id === p.id)?.starDays ?? 0,
                efficiency:    p.efficiency,
            }));

            const { error } = await supabase.from('short_supply_plans').insert({
                sites:        dataMode === 'live' ? selectedSites : [activeSiteId ?? 'unknown'],
                budget,
                ss_percent:   ssPercent,
                data_mode:    dataMode,
                total_spend:  summary.totalSpend,
                total_uplift: summary.totalUplift,
                total_units:  summary.totalUnits,
                plan_items:   planItems,
            });

            if (error) throw error;
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setLoadError(`Save failed: ${msg}`);
        } finally {
            setIsSaving(false);
        }
    };

    // ── Site toggle (multi-select) ────────────────────────────────────────────

    const toggleSite = (site: BcSiteCode) => {
        setSelectedSites(prev =>
            prev.includes(site) ? prev.filter(s => s !== site) : [...prev, site]
        );
    };

    // ── Permission gate (after all hooks) ────────────────────────────────────

    if (!hasPermission('manage_development')) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="text-center p-8 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 shadow-xl max-w-md">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <BarChart3 size={32} />
                    </div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">Access Restricted</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">You do not have the 'manage_development' permission required to access the Smart Buying Dashboard.</p>
                </div>
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <PageHeader
                        title={v2Enabled ? 'Smart Buying v2' : 'Smart Buying'}
                        subtitle="Predictive procurement based on short supply facts & efficiency"
                    />
                </div>
                <div className="flex items-center gap-3">
                    {/* View toggle */}
                    <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
                        <button
                            onClick={() => setActiveView('plan')}
                            className={`px-4 py-2 flex items-center gap-1.5 transition-colors ${activeView === 'plan' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold' : 'bg-white dark:bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-50'}`}
                        >
                            <BarChart3 size={14} />
                            Plan
                        </button>
                        <button
                            onClick={() => setActiveView('history')}
                            className={`px-4 py-2 flex items-center gap-1.5 transition-colors ${activeView === 'history' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold' : 'bg-white dark:bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-50'}`}
                        >
                            <History size={14} />
                            History
                        </button>
                    </div>

                    {activeView === 'plan' && (
                        <button
                            type="button"
                            onClick={handleSavePlan}
                            disabled={isSaving || summary.totalUnits === 0}
                            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-medium tracking-wide shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? <Clock size={18} className="animate-spin" /> : saveSuccess ? <CheckCircle2 size={18} /> : <Save size={18} />}
                            <span>{saveSuccess ? 'Saved!' : 'Save Plan'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Error / loading banners */}
            {loadError && (
                <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
                    <AlertCircle size={16} className="shrink-0" />
                    {loadError}
                    <button className="ml-auto text-red-500 hover:text-red-700 underline" onClick={() => setLoadError(null)}>Dismiss</button>
                </div>
            )}

            {/* ── HISTORY VIEW ─────────────────────────────────────────────── */}
            {activeView === 'history' && (
                <div className="bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
                        <h2 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                            <History size={16} className="text-[var(--color-brand)]" />
                            Saved Buying Plans
                        </h2>
                        <button onClick={fetchSavedPlans} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                            <RefreshCw size={12} /> Refresh
                        </button>
                    </div>
                    {savedPlans.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 text-sm">No saved plans yet. Create and save a plan to see it here.</div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {savedPlans.map(plan => (
                                <div key={plan.id} className="p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                                    {plan.sites.join(', ')} — ${(plan.budget / 1000).toFixed(0)}k budget
                                                </span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${plan.data_mode === 'live' ? 'bg-[var(--color-tranquil,#129DC0)]/10 text-[var(--color-tranquil,#129DC0)]' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                                    {plan.data_mode === 'live' ? 'Live Data' : 'Manual'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {new Date(plan.created_at).toLocaleString()} · SS {plan.ss_percent}%
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 space-y-0.5">
                                            <div className="text-sm font-bold text-gray-900 dark:text-white">${(plan.total_spend ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                            <div className="text-xs text-emerald-600 dark:text-emerald-400">↑ ${(plan.total_uplift ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} uplift</div>
                                            <div className="text-xs text-gray-500">{plan.total_units ?? 0} units</div>
                                        </div>
                                    </div>
                                    {plan.plan_items.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {plan.plan_items.slice(0, 5).map(item => (
                                                <span key={item.itemId} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                                                    {item.itemName.split('(')[0].trim()} ×{item.allocatedQty}
                                                </span>
                                            ))}
                                            {plan.plan_items.length > 5 && (
                                                <span className="text-xs text-gray-400">+{plan.plan_items.length - 5} more</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── PLAN VIEW ────────────────────────────────────────────────── */}
            {activeView === 'plan' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* LEFT COLUMN: Controls */}
                    <div className="lg:col-span-1 flex flex-col gap-6">

                        {/* Data Source — only shown when v2 is enabled */}
                        {v2Enabled && (
                            <div className="bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
                                <h2 className="text-sm font-bold tracking-wider uppercase text-gray-500 dark:text-slate-400 mb-4">Data Source</h2>
                                <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden text-sm mb-4">
                                    <button
                                        onClick={() => setDataMode('manual')}
                                        className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors ${dataMode === 'manual' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold' : 'bg-white dark:bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-50'}`}
                                    >
                                        <Upload size={13} />
                                        Manual
                                    </button>
                                    <button
                                        onClick={() => setDataMode('live')}
                                        className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors ${dataMode === 'live' ? 'bg-[var(--color-tranquil,#129DC0)] text-white font-semibold' : 'bg-white dark:bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-50'}`}
                                    >
                                        <Database size={13} />
                                        Live
                                    </button>
                                </div>

                                {dataMode === 'live' && (
                                    <>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Select sites (BundleConnect via Azure DB):</p>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {BC_ACTIVE_SITES.map(site => (
                                                <button
                                                    key={site}
                                                    onClick={() => toggleSite(site)}
                                                    className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-colors ${selectedSites.includes(site)
                                                        ? 'bg-[var(--color-tranquil,#129DC0)] border-[var(--color-tranquil,#129DC0)] text-white'
                                                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                                                    }`}
                                                >
                                                    {site}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={fetchLiveData}
                                            disabled={isLoading || selectedSites.length === 0}
                                            className="w-full py-2 text-sm font-medium text-white bg-[var(--color-tranquil,#129DC0)] rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isLoading ? <Clock size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                            {isLoading ? 'Loading…' : 'Refresh from BundleConnect'}
                                        </button>
                                    </>
                                )}

                                {dataMode === 'manual' && (
                                    <p className="text-xs text-gray-400 dark:text-gray-500">Using ingested short supply data from Supabase. Switch to Live to query BundleConnect via Azure DB.</p>
                                )}
                            </div>
                        )}

                        {/* Model Constraints */}
                        <div className="bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
                            <h2 className="text-sm font-bold tracking-wider uppercase text-gray-500 dark:text-slate-400 mb-6">Model Constraints</h2>
                            <div className="space-y-6">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-slate-200">Budget ($)</label>
                                        <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-[var(--color-brand)]">
                                            ${budget.toLocaleString()}
                                        </span>
                                    </div>
                                    <input
                                        type="range" min="0" max="200000" step="5000"
                                        value={budget}
                                        onChange={e => setBudget(Number(e.target.value))}
                                        className="w-full accent-[var(--color-brand)]"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-slate-200">Short Supply %</label>
                                        <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-blue-500">{ssPercent}%</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="100" step="5"
                                        value={ssPercent}
                                        onChange={e => setSsPercent(Number(e.target.value))}
                                        className="w-full accent-blue-500"
                                    />
                                    <p className="text-xs text-gray-400 mt-2">Model fulfilling only a partial % of historical shorts.</p>
                                </div>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="bg-gradient-to-br from-[var(--color-brand)] to-blue-600 rounded-2xl p-5 shadow-sm text-white">
                            <h2 className="text-sm font-bold tracking-wider uppercase text-white/70 mb-4">Summary</h2>
                            <div className="space-y-4">
                                <div className="flex justify-between items-end border-b border-white/20 pb-2">
                                    <div className="flex items-start gap-2">
                                        <DollarSign size={16} className="mt-0.5 text-white/70" />
                                        <div>
                                            <span className="text-xs text-white/70 font-medium block">Est. Spend</span>
                                            <span className="font-bold text-xl">${summary.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-end border-b border-white/20 pb-2">
                                    <div className="flex items-start gap-2">
                                        <TrendingUp size={16} className="mt-0.5 text-white/70" />
                                        <div>
                                            <span className="text-xs text-white/70 font-medium block">Annual Uplift</span>
                                            <span className="font-bold text-xl">${summary.totalUplift.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Package size={16} className="mt-0.5 text-white/70" />
                                    <div>
                                        <span className="text-xs text-white/70 font-medium block">Total Units</span>
                                        <span className="font-bold text-xl">{summary.totalUnits.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Allocation table */}
                    <div className="lg:col-span-3 bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                            <h2 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                                <BarChart3 size={18} className="text-[var(--color-brand)]" />
                                Allocated Buying Plan (Sequentially Ranked)
                            </h2>
                            {isLoading && (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                    <Clock size={12} className="animate-spin" /> Refreshing…
                                </span>
                            )}
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-[#15171e] text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                                        <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800">Item</th>
                                        <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800 text-right">Short Qty</th>
                                        {v2Enabled && (
                                            <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800 text-right text-[var(--color-tranquil,#129DC0)]">STAR Days</th>
                                        )}
                                        <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800 text-right">Raw Units</th>
                                        <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800 text-right">Efficiency</th>
                                        <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800 text-right bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400">Allocated</th>
                                        <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800 text-right">Est. Spend</th>
                                        <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800 text-right">Annual Uplift</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {allocatedPlans.map((plan, idx) => {
                                        const itemCtx = items.find(i => i.id === plan.id);
                                        return (
                                            <tr key={plan.id} className={`border-b border-gray-100 dark:border-gray-800/50 transition-colors ${plan.allocatedQty === 0 ? 'bg-red-50/30 dark:bg-red-900/10 opacity-60' : 'hover:bg-gray-50/50 dark:hover:bg-white/5'}`}>
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                    <span className="text-xs text-gray-400 dark:text-gray-600 mr-2">{idx + 1}.</span>
                                                    {plan.name}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-600 dark:text-slate-400">{plan.adjustedShort.toFixed(0)}</td>
                                                {v2Enabled && (
                                                    <td className="px-4 py-3 text-right text-[var(--color-tranquil,#129DC0)] font-mono">
                                                        {itemCtx?.starDays ? itemCtx.starDays.toFixed(1) : <span className="text-gray-300 dark:text-gray-700">—</span>}
                                                    </td>
                                                )}
                                                <td className="px-4 py-3 text-right text-gray-600 dark:text-slate-400">{plan.rawUnits.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right text-gray-600 dark:text-slate-400 font-mono">{plan.efficiency.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-900/5">
                                                    {plan.allocatedQty.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-gray-800 dark:text-slate-200">
                                                    ${plan.estimatedSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                                                    ${plan.annualUplift.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {allocatedPlans.length === 0 && !isLoading && (
                                        <tr>
                                            <td colSpan={v2Enabled ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                                                {dataMode === 'live'
                                                    ? 'Select sites and click "Refresh from BundleConnect" to load live data.'
                                                    : 'No data available. Please ingest short supply data first.'}
                                            </td>
                                        </tr>
                                    )}

                                    {isLoading && allocatedPlans.length === 0 && (
                                        <tr>
                                            <td colSpan={v2Enabled ? 8 : 7} className="px-4 py-8 text-center text-gray-400">
                                                <Clock size={20} className="animate-spin mx-auto mb-2" />
                                                Loading data…
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
