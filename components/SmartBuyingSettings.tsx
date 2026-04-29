import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import { Plus, Trash2, Save, RefreshCw, AlertCircle, Edit2, X, Check } from 'lucide-react';
import { BC_ACTIVE_SITES } from '../services/bundleConnectSyncService.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ItemProp {
    id: string;
    stk_key: string;
    site_code: string | null;
    depreciation_months: number;
    shrinkage_percent: number;
    star_override: number | null;
    item_group: string | null;
    is_active: boolean;
}

interface ItemPricing {
    id: string;
    stk_key: string;
    site_code: string | null;
    purchase_price: number;
    effective_from: string;
    effective_to: string | null;
    is_active: boolean;
}

const EMPTY_PROP: Omit<ItemProp, 'id'> = {
    stk_key: '', site_code: null, depreciation_months: 36,
    shrinkage_percent: 5, star_override: null, item_group: null, is_active: true,
};

const EMPTY_PRICE: Omit<ItemPricing, 'id'> = {
    stk_key: '', site_code: null, purchase_price: 0,
    effective_from: new Date().toISOString().slice(0, 10),
    effective_to: null, is_active: true,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function SiteSelect({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
    return (
        <select
            value={value ?? ''}
            onChange={e => onChange(e.target.value === '' ? null : e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 min-w-[70px]"
        >
            <option value="">All</option>
            {BC_ACTIVE_SITES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SmartBuyingSettings() {
    const [props, setProps] = useState<ItemProp[]>([]);
    const [pricing, setPricing] = useState<ItemPricing[]>([]);
    const [loadingProps, setLoadingProps] = useState(false);
    const [loadingPricing, setLoadingPricing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [newProp, setNewProp] = useState<Omit<ItemProp, 'id'>>(EMPTY_PROP);
    const [newPrice, setNewPrice] = useState<Omit<ItemPricing, 'id'>>(EMPTY_PRICE);
    const [addingProp, setAddingProp] = useState(false);
    const [addingPrice, setAddingPrice] = useState(false);

    const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

    // ── Fetch ──────────────────────────────────────────────────────────────────

    const fetchProps = useCallback(async () => {
        setLoadingProps(true);
        const { data, error } = await supabase
            .from('ref_short_supply_item_properties')
            .select('*')
            .order('stk_key');
        if (error) setError(error.message);
        else setProps((data || []) as ItemProp[]);
        setLoadingProps(false);
    }, []);

    const fetchPricing = useCallback(async () => {
        setLoadingPricing(true);
        const { data, error } = await supabase
            .from('ref_short_supply_pricing')
            .select('*')
            .order('stk_key');
        if (error) setError(error.message);
        else setPricing((data || []) as ItemPricing[]);
        setLoadingPricing(false);
    }, []);

    useEffect(() => { fetchProps(); fetchPricing(); }, [fetchProps, fetchPricing]);

    // ── CRUD — item properties ─────────────────────────────────────────────────

    const saveProp = async () => {
        if (!newProp.stk_key.trim()) { setError('STK Key is required'); return; }
        const { error } = await supabase.from('ref_short_supply_item_properties').insert({
            ...newProp,
            stk_key: newProp.stk_key.trim().toUpperCase(),
            updated_at: new Date().toISOString(),
        });
        if (error) { setError(error.message); return; }
        setNewProp(EMPTY_PROP);
        setAddingProp(false);
        flash('Item property saved');
        fetchProps();
    };

    const deleteProp = async (id: string) => {
        const { error } = await supabase
            .from('ref_short_supply_item_properties')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) { setError(error.message); return; }
        flash('Deactivated');
        fetchProps();
    };

    // ── CRUD — pricing ─────────────────────────────────────────────────────────

    const savePrice = async () => {
        if (!newPrice.stk_key.trim()) { setError('STK Key is required'); return; }
        if (newPrice.purchase_price <= 0) { setError('Purchase price must be > 0'); return; }
        const { error } = await supabase.from('ref_short_supply_pricing').insert({
            ...newPrice,
            stk_key: newPrice.stk_key.trim().toUpperCase(),
            updated_at: new Date().toISOString(),
        });
        if (error) { setError(error.message); return; }
        setNewPrice(EMPTY_PRICE);
        setAddingPrice(false);
        flash('Pricing entry saved');
        fetchPricing();
    };

    const deletePrice = async (id: string) => {
        const { error } = await supabase
            .from('ref_short_supply_pricing')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) { setError(error.message); return; }
        flash('Deactivated');
        fetchPricing();
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Smart Buying Reference Data</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Per-item property overrides and purchase prices used by the Smart Buying v2 engine when BundleConnect data is insufficient.
                </p>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
                    <AlertCircle size={14} className="shrink-0" />
                    {error}
                    <button className="ml-auto" onClick={() => setError(null)}><X size={14} /></button>
                </div>
            )}
            {success && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm text-emerald-700 dark:text-emerald-300">
                    <Check size={14} className="shrink-0" />
                    {success}
                </div>
            )}

            {/* ── Item Properties ─────────────────────────────────────────────── */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h4 className="text-sm font-bold text-gray-800 dark:text-white">Item Properties</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Override depreciation, shrinkage and STAR days per STK key (or all sites).</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={fetchProps} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <RefreshCw size={14} className={loadingProps ? 'animate-spin text-gray-400' : 'text-gray-500'} />
                        </button>
                        <button
                            onClick={() => setAddingProp(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-xs font-semibold hover:opacity-90"
                        >
                            <Plus size={13} /> Add Entry
                        </button>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase tracking-wider text-gray-500">
                            <tr>
                                <th className="px-3 py-2.5 font-medium">STK Key</th>
                                <th className="px-3 py-2.5 font-medium">Site</th>
                                <th className="px-3 py-2.5 font-medium text-right">Depr. (mo)</th>
                                <th className="px-3 py-2.5 font-medium text-right">Shrinkage %</th>
                                <th className="px-3 py-2.5 font-medium text-right">STAR Override</th>
                                <th className="px-3 py-2.5 font-medium">Group</th>
                                <th className="px-3 py-2.5 font-medium text-center">Active</th>
                                <th className="px-3 py-2.5 font-medium w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {addingProp && (
                                <tr className="bg-blue-50/30 dark:bg-blue-900/10">
                                    <td className="px-3 py-2">
                                        <input className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs w-24 bg-white dark:bg-gray-800" placeholder="STK001" value={newProp.stk_key} onChange={e => setNewProp(p => ({ ...p, stk_key: e.target.value }))} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <SiteSelect value={newProp.site_code} onChange={v => setNewProp(p => ({ ...p, site_code: v }))} />
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <input type="number" min="1" className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs w-16 bg-white dark:bg-gray-800 text-right" value={newProp.depreciation_months} onChange={e => setNewProp(p => ({ ...p, depreciation_months: Number(e.target.value) }))} />
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <input type="number" min="0" max="100" step="0.1" className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs w-16 bg-white dark:bg-gray-800 text-right" value={newProp.shrinkage_percent} onChange={e => setNewProp(p => ({ ...p, shrinkage_percent: Number(e.target.value) }))} />
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <input type="number" min="0" className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs w-16 bg-white dark:bg-gray-800 text-right" placeholder="—" value={newProp.star_override ?? ''} onChange={e => setNewProp(p => ({ ...p, star_override: e.target.value === '' ? null : Number(e.target.value) }))} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs w-20 bg-white dark:bg-gray-800" placeholder="Group A" value={newProp.item_group ?? ''} onChange={e => setNewProp(p => ({ ...p, item_group: e.target.value || null }))} />
                                    </td>
                                    <td className="px-3 py-2 text-center">—</td>
                                    <td className="px-3 py-2">
                                        <div className="flex gap-1">
                                            <button onClick={saveProp} className="p-1 text-emerald-600 hover:text-emerald-700"><Check size={14} /></button>
                                            <button onClick={() => { setAddingProp(false); setNewProp(EMPTY_PROP); }} className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {props.filter(p => p.is_active).map(row => (
                                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                                    <td className="px-3 py-2 font-mono text-xs font-semibold text-gray-900 dark:text-white">{row.stk_key}</td>
                                    <td className="px-3 py-2 text-xs text-gray-500">{row.site_code ?? <span className="text-gray-300 dark:text-gray-600">All</span>}</td>
                                    <td className="px-3 py-2 text-xs text-right text-gray-700 dark:text-gray-300">{row.depreciation_months}</td>
                                    <td className="px-3 py-2 text-xs text-right text-gray-700 dark:text-gray-300">{row.shrinkage_percent}%</td>
                                    <td className="px-3 py-2 text-xs text-right text-[var(--color-tranquil,#129DC0)] font-mono">{row.star_override ?? <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                                    <td className="px-3 py-2 text-xs text-gray-500">{row.item_group ?? <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                                    <td className="px-3 py-2 text-center"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span></td>
                                    <td className="px-3 py-2">
                                        <button onClick={() => deleteProp(row.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                                    </td>
                                </tr>
                            ))}
                            {props.filter(p => p.is_active).length === 0 && !addingProp && (
                                <tr><td colSpan={8} className="px-3 py-6 text-center text-xs text-gray-400">No overrides configured. Defaults: 36 months depreciation, 5% shrinkage.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* ── Purchase Pricing ────────────────────────────────────────────── */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h4 className="text-sm font-bold text-gray-800 dark:text-white">Purchase Price Overrides</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Provide purchase prices for items not in BundleConnect stock table. Date-effective.</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={fetchPricing} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <RefreshCw size={14} className={loadingPricing ? 'animate-spin text-gray-400' : 'text-gray-500'} />
                        </button>
                        <button
                            onClick={() => setAddingPrice(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-xs font-semibold hover:opacity-90"
                        >
                            <Plus size={13} /> Add Entry
                        </button>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase tracking-wider text-gray-500">
                            <tr>
                                <th className="px-3 py-2.5 font-medium">STK Key</th>
                                <th className="px-3 py-2.5 font-medium">Site</th>
                                <th className="px-3 py-2.5 font-medium text-right">Price (ex GST)</th>
                                <th className="px-3 py-2.5 font-medium">Effective From</th>
                                <th className="px-3 py-2.5 font-medium">Effective To</th>
                                <th className="px-3 py-2.5 font-medium text-center">Active</th>
                                <th className="px-3 py-2.5 font-medium w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {addingPrice && (
                                <tr className="bg-blue-50/30 dark:bg-blue-900/10">
                                    <td className="px-3 py-2">
                                        <input className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs w-24 bg-white dark:bg-gray-800" placeholder="STK001" value={newPrice.stk_key} onChange={e => setNewPrice(p => ({ ...p, stk_key: e.target.value }))} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <SiteSelect value={newPrice.site_code} onChange={v => setNewPrice(p => ({ ...p, site_code: v }))} />
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <input type="number" min="0" step="0.01" className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs w-20 bg-white dark:bg-gray-800 text-right" placeholder="0.00" value={newPrice.purchase_price || ''} onChange={e => setNewPrice(p => ({ ...p, purchase_price: Number(e.target.value) }))} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input type="date" className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-800" value={newPrice.effective_from} onChange={e => setNewPrice(p => ({ ...p, effective_from: e.target.value }))} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input type="date" className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-800" value={newPrice.effective_to ?? ''} onChange={e => setNewPrice(p => ({ ...p, effective_to: e.target.value || null }))} />
                                    </td>
                                    <td className="px-3 py-2 text-center">—</td>
                                    <td className="px-3 py-2">
                                        <div className="flex gap-1">
                                            <button onClick={savePrice} className="p-1 text-emerald-600 hover:text-emerald-700"><Check size={14} /></button>
                                            <button onClick={() => { setAddingPrice(false); setNewPrice(EMPTY_PRICE); }} className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {pricing.filter(p => p.is_active).map(row => (
                                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                                    <td className="px-3 py-2 font-mono text-xs font-semibold text-gray-900 dark:text-white">{row.stk_key}</td>
                                    <td className="px-3 py-2 text-xs text-gray-500">{row.site_code ?? <span className="text-gray-300 dark:text-gray-600">All</span>}</td>
                                    <td className="px-3 py-2 text-xs text-right font-mono text-gray-700 dark:text-gray-300">${row.purchase_price.toFixed(2)}</td>
                                    <td className="px-3 py-2 text-xs text-gray-500">{row.effective_from}</td>
                                    <td className="px-3 py-2 text-xs text-gray-500">{row.effective_to ?? <span className="text-gray-300 dark:text-gray-600">Open</span>}</td>
                                    <td className="px-3 py-2 text-center"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span></td>
                                    <td className="px-3 py-2">
                                        <button onClick={() => deletePrice(row.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                                    </td>
                                </tr>
                            ))}
                            {pricing.filter(p => p.is_active).length === 0 && !addingPrice && (
                                <tr><td colSpan={7} className="px-3 py-6 text-center text-xs text-gray-400">No pricing overrides. Items without a price will show efficiency = 0 in the buying plan.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
