import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import {
  BookOpen, Search, RefreshCw, AlertCircle, Package,
  Cpu, CheckCircle2, XCircle, SlidersHorizontal, X,
} from 'lucide-react';
import PageHeader from './PageHeader';
import { generateItemCode } from '../utils/itemNameGenerator';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ItemRow {
  id: string;
  sku: string;
  name: string;
  short_name: string | null;
  category: string | null;
  sub_category: string | null;
  item_pool: string | null;
  item_catalog: string | null;
  item_type: string | null;
  item_colour: string | null;
  item_material: string | null;
  item_size: string | null;
  item_weight: number | null;
  rfid_flag: boolean | null;
  cog_flag: boolean | null;
  active_flag: boolean | null;
  sap_item_code_raw: string | null;
  range_name: string | null;
  specs: Record<string, unknown> | null;
  created_at: string | null;
}

type TabType = 'all' | 'workflow' | 'legacy';

// ── Proposed MD code ──────────────────────────────────────────────────────────

function getProposedMdCode(item: ItemRow): string {
  const parts: string[] = [];
  if (item.name) parts.push(item.name);
  if (item.item_catalog) parts.push(item.item_catalog);
  if (item.item_pool) parts.push(item.item_pool);
  if (item.item_colour) parts.push(item.item_colour);
  if (item.item_size) parts.push(item.item_size);

  const itemTypeCode: 'P' | 'S' =
    item.item_type?.toLowerCase().includes('sale') ? 'S' : 'P';

  return generateItemCode(parts.join(' '), {
    itemType: itemTypeCode,
    rfid: item.rfid_flag ?? false,
  });
}

function getDisplayWeight(item: ItemRow): string | null {
  if (item.item_weight != null) return `${item.item_weight} g/m²`;
  const gsm = item.specs?.gsm;
  if (gsm != null) return `${gsm} gsm`;
  return null;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white dark:bg-[#1e2029] border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</span>
      <span className="text-2xl font-black text-gray-900 dark:text-white">{value.toLocaleString()}</span>
      {sub && <span className="text-[11px] text-gray-400">{sub}</span>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ItemCatalogue() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [workflowItemIds, setWorkflowItemIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [search, setSearch] = useState('');
  const [filterPool, setFilterPool] = useState('');
  const [filterCatalog, setFilterCatalog] = useState('');
  const [filterRfid, setFilterRfid] = useState<boolean | null>(null);
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const loadData = async (silent = false) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const [itemsRes, workflowRes] = await Promise.all([
        supabase
          .from('items')
          .select(
            'id, sku, name, short_name, category, sub_category, ' +
            'item_pool, item_catalog, item_type, item_colour, item_material, ' +
            'item_size, item_weight, rfid_flag, cog_flag, active_flag, ' +
            'sap_item_code_raw, range_name, specs, created_at'
          )
          .order('name'),
        supabase
          .from('item_requests')
          .select('resulting_item_id')
          .not('resulting_item_id', 'is', null),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (workflowRes.error) throw workflowRes.error;

      setItems((itemsRes.data ?? []) as ItemRow[]);
      setWorkflowItemIds(
        new Set((workflowRes.data ?? []).map((r: { resulting_item_id: string }) => r.resulting_item_id))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ── Derived filter options ─────────────────────────────────────────────────

  const allPools = useMemo(() =>
    [...new Set(items.map(i => i.item_pool).filter(Boolean))].sort() as string[],
    [items]
  );
  const allCatalogs = useMemo(() =>
    [...new Set(items.map(i => i.item_catalog).filter(Boolean))].sort() as string[],
    [items]
  );

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total: items.length,
    workflow: items.filter(i => workflowItemIds.has(i.id)).length,
    legacy: items.filter(i => !workflowItemIds.has(i.id)).length,
    rfid: items.filter(i => i.rfid_flag).length,
    active: items.filter(i => i.active_flag).length,
  }), [items, workflowItemIds]);

  // ── Filtered items ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(item => {
      if (activeTab === 'workflow' && !workflowItemIds.has(item.id)) return false;
      if (activeTab === 'legacy' && workflowItemIds.has(item.id)) return false;
      if (filterPool && item.item_pool !== filterPool) return false;
      if (filterCatalog && item.item_catalog !== filterCatalog) return false;
      if (filterRfid !== null && !!item.rfid_flag !== filterRfid) return false;
      if (filterActiveOnly && !item.active_flag) return false;
      if (q) {
        const nameMatch = item.name.toLowerCase().includes(q);
        const sapMatch = (item.sap_item_code_raw ?? '').toLowerCase().includes(q);
        const skuMatch = (item.sku ?? '').toLowerCase().includes(q);
        if (!nameMatch && !sapMatch && !skuMatch) return false;
      }
      return true;
    });
  }, [items, workflowItemIds, activeTab, search, filterPool, filterCatalog, filterRfid, filterActiveOnly]);

  const hasActiveFilters = search || filterPool || filterCatalog || filterRfid !== null || filterActiveOnly;

  const clearFilters = () => {
    setSearch('');
    setFilterPool('');
    setFilterCatalog('');
    setFilterRfid(null);
    setFilterActiveOnly(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-page-entry max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Item Catalogue"
          subtitle="Unified master item list — legacy and workflow-created items."
        />
        <button
          onClick={() => loadData(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500 bg-white dark:bg-[#1e2029] border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-sm"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0" />
          {error}
          <button className="ml-auto text-xs underline opacity-60 hover:opacity-100" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Stats strip */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard label="Total Items" value={stats.total} />
          <StatCard label="Workflow Items" value={stats.workflow} sub="via request flow" />
          <StatCard label="Legacy Items" value={stats.legacy} sub="pre-existing" />
          <StatCard label="RFID Enabled" value={stats.rfid} />
          <StatCard label="Active" value={stats.active} />
        </div>
      )}

      {/* Tabs + filter toggle */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 p-1 bg-gray-50 dark:bg-white/5 rounded-2xl w-fit border border-gray-100 dark:border-gray-800">
          {([
            { id: 'all', label: 'All Items', count: items.length },
            { id: 'workflow', label: 'Workflow', count: stats.workflow },
            { id: 'legacy', label: 'Legacy', count: stats.legacy },
          ] as { id: TabType; label: string; count: number }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-[#1e2029] text-[var(--color-brand)] shadow-md border border-gray-100/50 dark:border-gray-800/50'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === tab.id ? 'bg-[var(--color-brand)] text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500'
              }`}>
                {tab.count.toLocaleString()}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search name or SAP code…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1e2029] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30 w-56"
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-widest rounded-xl border transition-all ${
              showFilters || (filterPool || filterCatalog || filterRfid !== null || filterActiveOnly)
                ? 'bg-[var(--color-brand)]/10 border-[var(--color-brand)]/30 text-[var(--color-brand)]'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 bg-white dark:bg-[#1e2029] hover:bg-gray-50 dark:hover:bg-white/5'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filters
            {(filterPool || filterCatalog || filterRfid !== null || filterActiveOnly) && (
              <span className="w-2 h-2 rounded-full bg-[var(--color-brand)]" />
            )}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <X size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-gray-800">
          {allPools.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Item Pool</label>
              <select
                value={filterPool}
                onChange={e => setFilterPool(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1e2029] text-gray-700 dark:text-gray-300"
              >
                <option value="">All Pools</option>
                {allPools.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
          {allCatalogs.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Catalogue</label>
              <select
                value={filterCatalog}
                onChange={e => setFilterCatalog(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1e2029] text-gray-700 dark:text-gray-300"
              >
                <option value="">All Catalogues</option>
                {allCatalogs.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">RFID</label>
            <select
              value={filterRfid === null ? '' : filterRfid ? 'yes' : 'no'}
              onChange={e => setFilterRfid(e.target.value === '' ? null : e.target.value === 'yes')}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1e2029] text-gray-700 dark:text-gray-300"
            >
              <option value="">All</option>
              <option value="yes">RFID Only</option>
              <option value="no">Non-RFID Only</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</label>
            <button
              onClick={() => setFilterActiveOnly(v => !v)}
              className={`w-full px-3 py-2 text-sm border rounded-xl font-medium transition-all text-left ${
                filterActiveOnly
                  ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e2029] text-gray-500'
              }`}
            >
              {filterActiveOnly ? '✓ Active items only' : 'Include inactive'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5 flex items-center gap-3">
          <Package size={16} className="text-[var(--color-brand)]" />
          <span className="font-bold text-gray-800 dark:text-white text-sm">
            {filtered.length.toLocaleString()} item{filtered.length !== 1 ? 's' : ''}
          </span>
          {hasActiveFilters && (
            <span className="text-xs text-gray-400">— filtered from {items.length.toLocaleString()} total</span>
          )}
          {activeTab === 'legacy' && (
            <span className="ml-auto text-[10px] text-gray-400 font-medium">
              MD codes shown are proposals only — computed from item attributes, not written to the database
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-50 dark:bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <BookOpen size={48} className="mb-4 opacity-20" />
            <p className="font-bold text-sm tracking-tight">No items match your filters.</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-2 text-xs underline opacity-60 hover:opacity-100">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-auto max-h-[65vh]">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-gray-50 dark:bg-[#15171e] text-[10px] uppercase tracking-wider text-gray-400 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 font-black border-b border-gray-100 dark:border-gray-800">Name</th>
                  <th className="px-4 py-3 font-black border-b border-gray-100 dark:border-gray-800">MD Code</th>
                  <th className="px-4 py-3 font-black border-b border-gray-100 dark:border-gray-800">SAP Code</th>
                  <th className="px-4 py-3 font-black border-b border-gray-100 dark:border-gray-800">Pool / Catalogue</th>
                  <th className="px-4 py-3 font-black border-b border-gray-100 dark:border-gray-800">Attributes</th>
                  <th className="px-4 py-3 font-black border-b border-gray-100 dark:border-gray-800">Weight</th>
                  <th className="px-4 py-3 font-black border-b border-gray-100 dark:border-gray-800">RFID</th>
                  <th className="px-4 py-3 font-black border-b border-gray-100 dark:border-gray-800">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {filtered.map(item => {
                  const isWorkflow = workflowItemIds.has(item.id);
                  const proposedCode = getProposedMdCode(item);
                  const displayWeight = getDisplayWeight(item);
                  const attrs = [item.item_size, item.item_colour, item.item_material]
                    .filter(Boolean).join(' · ');

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                      {/* Name */}
                      <td className="px-4 py-3 max-w-[260px]">
                        <p className="font-semibold text-gray-900 dark:text-white truncate" title={item.name}>
                          {item.name}
                        </p>
                        {item.short_name && item.short_name !== item.name && (
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">{item.short_name}</p>
                        )}
                      </td>

                      {/* MD Code */}
                      <td className="px-4 py-3">
                        {isWorkflow ? (
                          <div>
                            <span className="font-mono text-xs font-bold text-[var(--color-brand)]">
                              {proposedCode}
                            </span>
                            <p className="text-[9px] uppercase tracking-widest text-[var(--color-brand)]/60 mt-0.5 font-black">
                              Workflow
                            </p>
                          </div>
                        ) : (
                          <div>
                            <span className="font-mono text-xs text-gray-400 italic">
                              {proposedCode}
                            </span>
                            <p className="text-[9px] uppercase tracking-widest text-gray-300 dark:text-gray-600 mt-0.5 font-black">
                              Proposed
                            </p>
                          </div>
                        )}
                      </td>

                      {/* SAP Code */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                          {item.sap_item_code_raw ?? item.sku ?? (
                            <span className="text-gray-300 dark:text-gray-700">—</span>
                          )}
                        </span>
                      </td>

                      {/* Pool / Catalogue */}
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {item.item_pool && (
                          <span className="block font-medium text-gray-700 dark:text-gray-300">{item.item_pool}</span>
                        )}
                        {item.item_catalog && (
                          <span className="text-gray-400 text-[11px]">{item.item_catalog}</span>
                        )}
                        {!item.item_pool && !item.item_catalog && (
                          <span className="text-gray-300 dark:text-gray-700">—</span>
                        )}
                      </td>

                      {/* Attributes */}
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[180px]">
                        {attrs || <span className="text-gray-300 dark:text-gray-700">—</span>}
                      </td>

                      {/* Weight */}
                      <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">
                        {displayWeight ?? <span className="text-gray-300 dark:text-gray-700">—</span>}
                      </td>

                      {/* RFID */}
                      <td className="px-4 py-3">
                        {item.rfid_flag ? (
                          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-teal-600 dark:text-teal-400">
                            <Cpu size={11} /> RFID
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-300 dark:text-gray-700 font-black uppercase tracking-widest">Non-RFID</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {item.active_flag ? (
                          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={11} /> Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                            <XCircle size={11} /> Inactive
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
