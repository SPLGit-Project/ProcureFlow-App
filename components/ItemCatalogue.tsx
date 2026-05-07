import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext.tsx';
import { supabase } from '../lib/supabaseClient.ts';
import {
  BookOpen, Search, RefreshCw, AlertCircle, Package,
  Cpu, CheckCircle2, XCircle, SlidersHorizontal, X,
  Download, Edit2, History, Archive, CheckCircle,
} from 'lucide-react';
import PageHeader from './PageHeader';
import { generateItemCode } from '../utils/itemNameGenerator';
import { ItemWizard } from './ItemWizard.tsx';
import { EntityAuditPanel } from './EntityAuditPanel.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { useToast } from './ToastNotification';
import { Item } from '../types.ts';

// ── Export column map ─────────────────────────────────────────────────────────

const EXPORT_COLUMNS: { key: keyof Item | string; label: string }[] = [
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'subCategory', label: 'Sub Category' },
  { key: 'itemPool', label: 'Pool' },
  { key: 'itemCatalog', label: 'Catalogue' },
  { key: 'itemType', label: 'Type' },
  { key: 'itemSize', label: 'Size' },
  { key: 'itemColour', label: 'Colour' },
  { key: 'itemMaterial', label: 'Material' },
  { key: 'itemWeight', label: 'Weight (g/m²)' },
  { key: 'rfidFlag', label: 'RFID' },
  { key: 'cogFlag', label: 'COG' },
  { key: 'activeFlag', label: 'Status' },
  { key: 'sapItemCodeRaw', label: 'SAP Code' },
  { key: 'uom', label: 'UOM' },
  { key: 'upq', label: 'UPQ' },
  { key: 'unitPrice', label: 'Unit Price' },
  { key: 'minLevel', label: 'Min Level' },
  { key: 'maxLevel', label: 'Max Level' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getProposedMdCode(item: Item): string {
  const parts: string[] = [];
  if (item.name) parts.push(item.name);
  if (item.itemCatalog) parts.push(item.itemCatalog);
  if (item.itemPool) parts.push(item.itemPool);
  if (item.itemColour) parts.push(item.itemColour);
  if (item.itemSize) parts.push(item.itemSize);

  const itemTypeCode: 'P' | 'S' =
    item.itemType?.toLowerCase().includes('sale') ? 'S' : 'P';

  return generateItemCode(parts.join(' '), {
    itemType: itemTypeCode,
    rfid: item.rfidFlag ?? false,
  });
}

function getDisplayWeight(item: Item): string | null {
  if (item.itemWeight != null) return `${item.itemWeight} g/m²`;
  const gsm = (item as Item & { specs?: { gsm?: unknown } }).specs?.gsm;
  if (gsm != null) return `${gsm} gsm`;
  return null;
}

type TabType = 'all' | 'workflow' | 'legacy';

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, highlight,
}: { label: string; value: number; sub?: string; highlight?: boolean }) {
  return (
    <div className={`border rounded-2xl px-5 py-4 flex flex-col gap-1 transition-colors ${
      highlight
        ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
        : 'bg-white dark:bg-[#1e2029] border-gray-100 dark:border-gray-800'
    }`}>
      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</span>
      <span className={`text-2xl font-black ${highlight ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
        {value.toLocaleString()}
      </span>
      {sub && <span className="text-[11px] text-gray-400">{sub}</span>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ItemCatalogue() {
  const {
    items,
    updateItem,
    archiveItem,
    reloadData,
    suppliers,
    attributeOptions,
    upsertAttributeOption,
  } = useApp();
  const { success, error: showError } = useToast();

  const [workflowItemIds, setWorkflowItemIds] = useState<Set<string>>(new Set());
  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & tabs
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [filterActiveOnly, setFilterActiveOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPool, setFilterPool] = useState('');
  const [filterCatalog, setFilterCatalog] = useState('');
  const [filterRfid, setFilterRfid] = useState<boolean | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Action modals
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [auditItem, setAuditItem] = useState<Item | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Item | null>(null);

  // ── Load workflow IDs ────────────────────────────────────────────────────

  useEffect(() => {
    supabase
      .from('item_requests')
      .select('resulting_item_id')
      .not('resulting_item_id', 'is', null)
      .then(({ data }) => {
        setWorkflowItemIds(
          new Set((data ?? []).map((r: { resulting_item_id: string }) => r.resulting_item_id))
        );
        setIsLoadingWorkflow(false);
      });
  }, []);

  // ── Refresh ──────────────────────────────────────────────────────────────

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await reloadData(true);
    setIsRefreshing(false);
  };

  // ── Base set (respects active-only toggle) ───────────────────────────────

  const baseSet = useMemo(
    () => (filterActiveOnly ? items.filter(i => i.activeFlag !== false) : items),
    [items, filterActiveOnly]
  );

  // ── Stats (computed from baseSet — reflect the active-only filter) ────────

  const allItemsCount = items.length;
  const stats = useMemo(() => ({
    total: baseSet.length,
    workflow: baseSet.filter(i => workflowItemIds.has(i.id)).length,
    legacy: baseSet.filter(i => !workflowItemIds.has(i.id)).length,
    rfid: baseSet.filter(i => i.rfidFlag).length,
    inactive: filterActiveOnly ? items.filter(i => i.activeFlag === false).length : baseSet.filter(i => i.activeFlag !== false).length,
  }), [baseSet, workflowItemIds, items, filterActiveOnly]);

  // ── Filter options from the full item list ───────────────────────────────

  const allPools = useMemo(() =>
    [...new Set(items.map(i => i.itemPool).filter(Boolean))].sort() as string[],
    [items]
  );
  const allCatalogs = useMemo(() =>
    [...new Set(items.map(i => i.itemCatalog).filter(Boolean))].sort() as string[],
    [items]
  );

  // ── Filtered items ───────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return baseSet.filter(item => {
      if (activeTab === 'workflow' && !workflowItemIds.has(item.id)) return false;
      if (activeTab === 'legacy' && workflowItemIds.has(item.id)) return false;
      if (filterPool && item.itemPool !== filterPool) return false;
      if (filterCatalog && item.itemCatalog !== filterCatalog) return false;
      if (filterRfid !== null && !!item.rfidFlag !== filterRfid) return false;
      if (q) {
        const nameHit = item.name.toLowerCase().includes(q);
        const sapHit = (item.sapItemCodeRaw ?? item.sku ?? '').toLowerCase().includes(q);
        const skuHit = (item.sku ?? '').toLowerCase().includes(q);
        if (!nameHit && !sapHit && !skuHit) return false;
      }
      return true;
    });
  }, [baseSet, workflowItemIds, activeTab, search, filterPool, filterCatalog, filterRfid]);

  const hasSubFilters = !!(search || filterPool || filterCatalog || filterRfid !== null);

  const clearSubFilters = () => {
    setSearch('');
    setFilterPool('');
    setFilterCatalog('');
    setFilterRfid(null);
  };

  // ── Export ───────────────────────────────────────────────────────────────

  const handleExport = () => {
    const data = filtered.map(item => {
      const row: Record<string, unknown> = {};
      EXPORT_COLUMNS.forEach(col => {
        let val: unknown = item[col.key as keyof Item];
        if (col.key === 'rfidFlag' || col.key === 'cogFlag') val = val ? 'Yes' : 'No';
        if (col.key === 'activeFlag') val = val !== false ? 'Active' : 'Archived';
        row[col.label] = val ?? '';
      });
      row['Proposed MD Code'] = getProposedMdCode(item);
      row['Source'] = workflowItemIds.has(item.id) ? 'Workflow' : 'Legacy';
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Item Catalogue');
    XLSX.writeFile(wb, `Item_Catalogue_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    success('Catalogue exported successfully');
  };

  // ── Edit save ────────────────────────────────────────────────────────────

  const handleWizardSave = async (itemData: Partial<Item>) => {
    try {
      if (editingItem) {
        await updateItem({ ...editingItem, ...itemData });
        success('Item updated successfully');
        setEditingItem(null);
        await reloadData(true);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update item');
    }
  };

  // ── Archive ──────────────────────────────────────────────────────────────

  const handleArchiveConfirm = async () => {
    if (!confirmArchive) return;
    try {
      await archiveItem(confirmArchive.id);
      success(`"${confirmArchive.name}" archived`);
      setConfirmArchive(null);
      await reloadData(true);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to archive item');
    }
  };

  const isLoading = isLoadingWorkflow;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-page-entry max-w-7xl mx-auto">

      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Item Catalogue"
          subtitle="Unified master item list — legacy and workflow-created items."
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            title="Export current view to Excel"
            className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500 bg-white dark:bg-[#1e2029] border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-sm"
          >
            <Download size={14} /> Export
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500 bg-white dark:bg-[#1e2029] border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-sm"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Active-only toggle — prominent, always visible */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setFilterActiveOnly(v => !v)}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest border transition-all ${
            filterActiveOnly
              ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/25'
              : 'bg-white dark:bg-[#1e2029] border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <CheckCircle size={16} className={filterActiveOnly ? 'text-white' : 'text-gray-400'} />
          {filterActiveOnly ? 'Active Items Only' : 'Showing All Items'}
        </button>
        {!filterActiveOnly && (
          <p className="text-xs text-gray-400">
            Includes <span className="font-bold text-gray-600 dark:text-gray-300">{items.filter(i => i.activeFlag === false).length}</span> archived item{items.filter(i => i.activeFlag === false).length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Stats strip — values reflect the active-only filter */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard
            label={filterActiveOnly ? 'Active Items' : 'Total Items'}
            value={stats.total}
            highlight={filterActiveOnly}
            sub={filterActiveOnly ? `of ${allItemsCount.toLocaleString()} total` : undefined}
          />
          <StatCard
            label="Workflow"
            value={stats.workflow}
            sub={filterActiveOnly ? 'active workflow items' : 'via request flow'}
          />
          <StatCard
            label="Legacy"
            value={stats.legacy}
            sub={filterActiveOnly ? 'active legacy items' : 'pre-existing'}
          />
          <StatCard label="RFID Enabled" value={stats.rfid} />
          <StatCard
            label={filterActiveOnly ? 'Archived (hidden)' : 'Active'}
            value={stats.inactive}
            sub={filterActiveOnly ? 'not shown above' : undefined}
          />
        </div>
      )}

      {/* Tabs + search + filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 p-1 bg-gray-50 dark:bg-white/5 rounded-2xl w-fit border border-gray-100 dark:border-gray-800">
          {([
            { id: 'all' as TabType, label: 'All', count: baseSet.length },
            { id: 'workflow' as TabType, label: 'Workflow', count: stats.workflow },
            { id: 'legacy' as TabType, label: 'Legacy', count: stats.legacy },
          ]).map(tab => (
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
              showFilters || (filterPool || filterCatalog || filterRfid !== null)
                ? 'bg-[var(--color-brand)]/10 border-[var(--color-brand)]/30 text-[var(--color-brand)]'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 bg-white dark:bg-[#1e2029] hover:bg-gray-50 dark:hover:bg-white/5'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filters
            {(filterPool || filterCatalog || filterRfid !== null) && (
              <span className="w-2 h-2 rounded-full bg-[var(--color-brand)]" />
            )}
          </button>
          {hasSubFilters && (
            <button
              onClick={clearSubFilters}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <X size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-5 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-gray-800">
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
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">

        {/* Table header bar */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5 flex items-center gap-3 flex-wrap">
          <Package size={16} className="text-[var(--color-brand)]" />
          <span className="font-bold text-gray-800 dark:text-white text-sm">
            {filtered.length.toLocaleString()} item{filtered.length !== 1 ? 's' : ''}
          </span>
          {hasSubFilters && (
            <span className="text-xs text-gray-400">— filtered from {baseSet.length.toLocaleString()}</span>
          )}
          {activeTab === 'legacy' && (
            <span className="ml-auto text-[10px] text-gray-400">
              MD codes are proposals only — computed from item attributes, not written to the database
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
            {hasSubFilters && (
              <button onClick={clearSubFilters} className="mt-2 text-xs underline opacity-60 hover:opacity-100">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-auto max-h-[60vh]">
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
                  <th className="px-4 py-3 font-black border-b border-gray-100 dark:border-gray-800 text-right sticky right-0 bg-gray-50 dark:bg-[#15171e] shadow-[-8px_0_10px_-8px_rgba(0,0,0,0.06)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {filtered.map(item => {
                  const isWorkflow = workflowItemIds.has(item.id);
                  const proposedCode = getProposedMdCode(item);
                  const displayWeight = getDisplayWeight(item);
                  const attrs = [item.itemSize, item.itemColour, item.itemMaterial]
                    .filter(Boolean).join(' · ');
                  const isInactive = item.activeFlag === false;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isInactive
                          ? 'opacity-50 hover:opacity-70 bg-gray-50/30 dark:bg-white/[0.02]'
                          : 'hover:bg-gray-50/50 dark:hover:bg-white/5'
                      }`}
                    >
                      {/* Name */}
                      <td className="px-4 py-3 max-w-[240px]">
                        <p className="font-semibold text-gray-900 dark:text-white truncate" title={item.name}>
                          {item.name}
                        </p>
                        {item.category && (
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">{item.category}</p>
                        )}
                      </td>

                      {/* MD Code */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isWorkflow ? (
                          <div>
                            <span className="font-mono text-xs font-bold text-[var(--color-brand)]">{proposedCode}</span>
                            <p className="text-[9px] uppercase tracking-widest text-[var(--color-brand)]/60 mt-0.5 font-black">Workflow</p>
                          </div>
                        ) : (
                          <div>
                            <span className="font-mono text-xs text-gray-400 italic">{proposedCode}</span>
                            <p className="text-[9px] uppercase tracking-widest text-gray-300 dark:text-gray-600 mt-0.5 font-black">Proposed</p>
                          </div>
                        )}
                      </td>

                      {/* SAP Code */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                          {item.sapItemCodeRaw ?? item.sku ?? '—'}
                        </span>
                      </td>

                      {/* Pool / Catalogue */}
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {item.itemPool && (
                          <span className="block font-medium text-gray-700 dark:text-gray-300">{item.itemPool}</span>
                        )}
                        {item.itemCatalog && (
                          <span className="text-gray-400 text-[11px]">{item.itemCatalog}</span>
                        )}
                        {!item.itemPool && !item.itemCatalog && (
                          <span className="text-gray-300 dark:text-gray-700">—</span>
                        )}
                      </td>

                      {/* Attributes */}
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[160px] truncate">
                        {attrs || <span className="text-gray-300 dark:text-gray-700">—</span>}
                      </td>

                      {/* Weight */}
                      <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {displayWeight ?? <span className="text-gray-300 dark:text-gray-700">—</span>}
                      </td>

                      {/* RFID */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.rfidFlag ? (
                          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-teal-600 dark:text-teal-400">
                            <Cpu size={11} /> RFID
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-300 dark:text-gray-600 font-black uppercase tracking-widest">Non-RFID</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isInactive ? (
                          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                            <XCircle size={11} /> Archived
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={11} /> Active
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right sticky right-0 bg-white dark:bg-[#1e2029] shadow-[-8px_0_10px_-8px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingItem(item)}
                            title="Edit item"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => setAuditItem(item)}
                            title="View audit history"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                          >
                            <History size={15} />
                          </button>
                          {!isInactive && (
                            <button
                              onClick={() => setConfirmArchive(item)}
                              title="Archive item"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                            >
                              <Archive size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingItem && (
        <ItemWizard
          isOpen
          onClose={() => setEditingItem(null)}
          onSave={handleWizardSave}
          existingItem={editingItem}
          items={items}
          suppliers={suppliers}
          attributeOptions={attributeOptions}
          upsertAttributeOption={upsertAttributeOption}
        />
      )}

      {/* Audit history modal */}
      {auditItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <History size={22} className="text-blue-500" /> Audit History
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {auditItem.name} <span className="font-mono text-xs">({auditItem.sku})</span>
                </p>
              </div>
              <button
                onClick={() => setAuditItem(null)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <EntityAuditPanel recordId={auditItem.id} tableFilter={['items']} entityLabel="item" />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end bg-gray-50 dark:bg-white/5">
              <button
                onClick={() => setAuditItem(null)}
                className="px-5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive confirm */}
      <ConfirmDialog
        isOpen={!!confirmArchive}
        title="Archive Item?"
        message={`Archive "${confirmArchive?.name}" (${confirmArchive?.sku})? It will be hidden from active lists but can be restored.`}
        confirmLabel="Archive"
        variant="danger"
        onConfirm={handleArchiveConfirm}
        onCancel={() => setConfirmArchive(null)}
      />
    </div>
  );
}
