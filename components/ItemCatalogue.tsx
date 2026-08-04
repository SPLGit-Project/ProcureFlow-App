import { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext.tsx';
import { supabase } from '../lib/supabaseClient.ts';
import {
  BookOpen, Search, RefreshCw, Package,
  Cpu, CheckCircle2, XCircle, SlidersHorizontal, X,
  Download, Edit2, History, Archive, CheckCircle, Plus, RotateCcw,
} from 'lucide-react';
import PageHeader from './PageHeader';
import { generateItemCode } from '../utils/itemNameGenerator';
import { ItemWizard } from './ItemWizard.tsx';
import { EntityAuditPanel } from './EntityAuditPanel.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { useToast } from './ToastNotification';
import { Item } from '../types.ts';

// ── Raw DB row type (snake_case from Supabase) ────────────────────────────────

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
  unit_price: number | null;
  uom: string | null;
  upq: number | null;
  min_level: number | null;
  max_level: number | null;
}

// ── Export columns ─────────────────────────────────────────────────────────────

const EXPORT_COLUMNS: { key: keyof ItemRow; label: string }[] = [
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'sub_category', label: 'Sub Category' },
  { key: 'item_pool', label: 'Pool' },
  { key: 'item_catalog', label: 'Catalogue' },
  { key: 'item_type', label: 'Type' },
  { key: 'item_size', label: 'Size' },
  { key: 'item_colour', label: 'Colour' },
  { key: 'item_material', label: 'Material' },
  { key: 'item_weight', label: 'Weight (g/m²)' },
  { key: 'rfid_flag', label: 'RFID' },
  { key: 'cog_flag', label: 'COG' },
  { key: 'active_flag', label: 'Status' },
  { key: 'sap_item_code_raw', label: 'SAP Code' },
  { key: 'uom', label: 'UOM' },
  { key: 'upq', label: 'UPQ' },
  { key: 'unit_price', label: 'Unit Price' },
  { key: 'min_level', label: 'Min Level' },
  { key: 'max_level', label: 'Max Level' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function doesItemMatchSearch(item: ItemRow, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;

  const cleanQ = q.replace(/[$]/g, '').trim();

  // 1. Core Names & Codes
  if (item.name.toLowerCase().includes(q)) return true;
  if (item.short_name?.toLowerCase().includes(q)) return true;
  if ((item.sku ?? '').toLowerCase().includes(q)) return true;
  if ((item.sap_item_code_raw ?? '').toLowerCase().includes(q)) return true;
  if ((item.range_name ?? '').toLowerCase().includes(q)) return true;
  if (getProposedMdCode(item).toLowerCase().includes(q)) return true;

  // 2. Taxonomy & Categorization
  if ((item.category ?? '').toLowerCase().includes(q)) return true;
  if ((item.sub_category ?? '').toLowerCase().includes(q)) return true;
  if ((item.item_pool ?? '').toLowerCase().includes(q)) return true;
  if ((item.item_catalog ?? '').toLowerCase().includes(q)) return true;
  if ((item.item_type ?? '').toLowerCase().includes(q)) return true;

  // 3. Product Attributes & UOM
  if ((item.item_colour ?? '').toLowerCase().includes(q)) return true;
  if ((item.item_material ?? '').toLowerCase().includes(q)) return true;
  if ((item.item_size ?? '').toLowerCase().includes(q)) return true;
  if ((item.uom ?? '').toLowerCase().includes(q)) return true;
  if (item.upq != null && item.upq.toString().includes(cleanQ)) return true;

  // 4. Unit Price
  if (item.unit_price != null) {
    const priceNum = item.unit_price.toString();
    const priceFixed = item.unit_price.toFixed(2);
    const priceFormatted = `$${priceFixed}`;
    if (
      priceNum.includes(cleanQ) ||
      priceFixed.includes(cleanQ) ||
      priceFormatted.toLowerCase().includes(q)
    ) {
      return true;
    }
  }

  // 5. Weight & GSM
  const weight = item.item_weight;
  const specGsm = item.specs?.gsm ?? item.specs?.weight;
  if (weight != null) {
    const wStr = weight.toString();
    if (
      wStr.includes(cleanQ) ||
      `${wStr} g/m²`.toLowerCase().includes(q) ||
      `${wStr} gsm`.toLowerCase().includes(q) ||
      `${wStr}gsm`.toLowerCase().includes(q)
    ) {
      return true;
    }
  }
  if (specGsm != null) {
    const gStr = String(specGsm).toLowerCase();
    if (
      gStr.includes(cleanQ) ||
      `${gStr} gsm`.includes(q) ||
      `${gStr}gsm`.includes(q) ||
      `${gStr} g/m²`.includes(q)
    ) {
      return true;
    }
  }

  // 6. Generic specs JSON recursive search
  if (item.specs && typeof item.specs === 'object') {
    for (const [key, val] of Object.entries(item.specs)) {
      if (val != null) {
        const valStr = String(val).toLowerCase();
        if (valStr.includes(q) || (cleanQ && valStr.includes(cleanQ))) return true;
        if (key.toLowerCase().includes(q)) return true;
      }
    }
  }

  return false;
}

type TabType = 'all' | 'workflow' | 'legacy';

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, highlight, onClick, clickable
}: { label: string; value: number; sub?: string; highlight?: boolean; onClick?: () => void; clickable?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={`border rounded-2xl px-5 py-4 flex flex-col gap-1 transition-all ${
        clickable ? 'cursor-pointer hover:border-[var(--color-brand)] hover:shadow-md hover:-translate-y-0.5 group' : ''
      } ${
        highlight
          ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
          : 'bg-white dark:bg-nocturne border-gray-100 dark:border-gray-800'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</span>
        {clickable && <RotateCcw size={14} className="text-gray-400 group-hover:text-[var(--color-brand)] transition-colors" />}
      </div>
      <span className={`text-2xl font-black ${highlight ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
        {value.toLocaleString()}
      </span>
      {sub && <span className="text-[11px] text-gray-400">{sub}</span>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ItemCatalogue() {
  const {
    addItem,
    updateItem,
    archiveItem,
    reactivateItem,
    reloadData,
    suppliers,
    attributeOptions,
    upsertAttributeOption,
    items: contextItems,
    currentUser,
  } = useApp();
  const { success, error: showError } = useToast();

  // ── Data (direct Supabase query — unfiltered, full table access) ─────────
  const [items, setItems] = useState<ItemRow[]>([]);
  const [workflowItemIds, setWorkflowItemIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Filters & tabs ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [filterActiveOnly, setFilterActiveOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPool, setFilterPool] = useState('');
  const [filterCatalog, setFilterCatalog] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMaterial, setFilterMaterial] = useState('');
  const [filterColour, setFilterColour] = useState('');
  const [filterRfid, setFilterRfid] = useState<boolean | null>(null);
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterMinGsm, setFilterMinGsm] = useState('');
  const [filterMaxGsm, setFilterMaxGsm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // ── Admin gate ────────────────────────────────────────────────────────────
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.roleIds?.includes('ADMIN');

  // ── Action modals ─────────────────────────────────────────────────────────
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemRow | null>(null);
  const [auditItem, setAuditItem] = useState<ItemRow | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<ItemRow | null>(null);
  const [confirmReactivate, setConfirmReactivate] = useState<ItemRow | null>(null);

  // ── Archived items modal state ───────────────────────────────────────────
  const [isArchivedModalOpen, setIsArchivedModalOpen] = useState(false);
  const [archivedSearch, setArchivedSearch] = useState('');
  const [reinstatingId, setReinstatingId] = useState<string | null>(null);

  // ── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async (silent = false) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      let allItems: any[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('items')
          .select(
            'id, sku, name, short_name, category, sub_category, ' +
            'item_pool, item_catalog, item_type, item_colour, item_material, ' +
            'item_size, item_weight, rfid_flag, cog_flag, active_flag, ' +
            'sap_item_code_raw, range_name, specs, created_at, ' +
            'unit_price, uom, upq, min_level, max_level'
          )
          .order('name')
          .range(from, from + step - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allItems.push(...data);
        if (data.length < step) break;
        from += step;
      }

      const { data: workflowData, error: workflowErr } = await supabase
        .from('item_requests')
        .select('resulting_item_id')
        .not('resulting_item_id', 'is', null);

      if (workflowErr) throw workflowErr;

      setItems(allItems as unknown as ItemRow[]);
      setWorkflowItemIds(
        new Set((workflowData ?? []).map((r: { resulting_item_id: string }) => r.resulting_item_id))
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showError]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived filter options (from full unfiltered list) ────────────────────

  const allPools = useMemo(() =>
    [...new Set(items.map(i => i.item_pool).filter(Boolean))].sort() as string[],
    [items]
  );
  const allCatalogs = useMemo(() =>
    [...new Set(items.map(i => i.item_catalog).filter(Boolean))].sort() as string[],
    [items]
  );
  const allCategories = useMemo(() =>
    [...new Set(items.map(i => i.category).filter(Boolean))].sort() as string[],
    [items]
  );
  const allMaterials = useMemo(() =>
    [...new Set(items.map(i => i.item_material).filter(Boolean))].sort() as string[],
    [items]
  );
  const allColours = useMemo(() =>
    [...new Set(items.map(i => i.item_colour).filter(Boolean))].sort() as string[],
    [items]
  );

  // ── Base set (respects active-only toggle) ────────────────────────────────

  const baseSet = useMemo(
    () => filterActiveOnly ? items.filter(i => i.active_flag !== false) : items,
    [items, filterActiveOnly]
  );

  // ── Stats (computed from baseSet) ─────────────────────────────────────────

  const stats = useMemo(() => ({
    total: baseSet.length,
    workflow: baseSet.filter(i => workflowItemIds.has(i.id)).length,
    legacy: baseSet.filter(i => !workflowItemIds.has(i.id)).length,
    rfid: baseSet.filter(i => i.rfid_flag).length,
    // 5th card: when active-only, show archived count (hidden); otherwise show active count
    fifth: filterActiveOnly
      ? items.filter(i => i.active_flag === false).length
      : baseSet.filter(i => i.active_flag !== false).length,
  }), [baseSet, workflowItemIds, items, filterActiveOnly]);

  // ── Filtered rows ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return baseSet.filter(item => {
      if (activeTab === 'workflow' && !workflowItemIds.has(item.id)) return false;
      if (activeTab === 'legacy' && workflowItemIds.has(item.id)) return false;
      if (filterPool && item.item_pool !== filterPool) return false;
      if (filterCatalog && item.item_catalog !== filterCatalog) return false;
      if (filterCategory && item.category !== filterCategory) return false;
      if (filterMaterial && item.item_material !== filterMaterial) return false;
      if (filterColour && item.item_colour !== filterColour) return false;
      if (filterRfid !== null && !!item.rfid_flag !== filterRfid) return false;

      if (filterMinPrice !== '') {
        const minP = parseFloat(filterMinPrice);
        if (!isNaN(minP) && (item.unit_price == null || item.unit_price < minP)) return false;
      }
      if (filterMaxPrice !== '') {
        const maxP = parseFloat(filterMaxPrice);
        if (!isNaN(maxP) && (item.unit_price == null || item.unit_price > maxP)) return false;
      }

      const itemGsm = item.item_weight ?? (typeof item.specs?.gsm === 'number' ? item.specs.gsm : (parseFloat(String(item.specs?.gsm ?? '')) || null));
      if (filterMinGsm !== '') {
        const minG = parseFloat(filterMinGsm);
        if (!isNaN(minG) && (itemGsm == null || itemGsm < minG)) return false;
      }
      if (filterMaxGsm !== '') {
        const maxG = parseFloat(filterMaxGsm);
        if (!isNaN(maxG) && (itemGsm == null || itemGsm > maxG)) return false;
      }

      if (search && !doesItemMatchSearch(item, search)) return false;

      return true;
    });
  }, [
    baseSet, workflowItemIds, activeTab, search,
    filterPool, filterCatalog, filterCategory, filterMaterial, filterColour,
    filterRfid, filterMinPrice, filterMaxPrice, filterMinGsm, filterMaxGsm,
  ]);

  const hasSubFilters = !!(
    search || filterPool || filterCatalog || filterCategory ||
    filterMaterial || filterColour || filterRfid !== null ||
    filterMinPrice || filterMaxPrice || filterMinGsm || filterMaxGsm
  );

  const activeFilterCount = (filterPool ? 1 : 0) +
    (filterCatalog ? 1 : 0) +
    (filterCategory ? 1 : 0) +
    (filterMaterial ? 1 : 0) +
    (filterColour ? 1 : 0) +
    (filterRfid !== null ? 1 : 0) +
    (filterMinPrice || filterMaxPrice ? 1 : 0) +
    (filterMinGsm || filterMaxGsm ? 1 : 0);

  const clearSubFilters = () => {
    setSearch('');
    setFilterPool('');
    setFilterCatalog('');
    setFilterCategory('');
    setFilterMaterial('');
    setFilterColour('');
    setFilterRfid(null);
    setFilterMinPrice('');
    setFilterMaxPrice('');
    setFilterMinGsm('');
    setFilterMaxGsm('');
  };

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = () => {
    const data = filtered.map(item => {
      const row: Record<string, unknown> = {};
      EXPORT_COLUMNS.forEach(col => {
        let val: unknown = item[col.key];
        if (col.key === 'rfid_flag' || col.key === 'cog_flag') val = val ? 'Yes' : 'No';
        if (col.key === 'active_flag') val = val !== false ? 'Active' : 'Archived';
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

  // ── Edit ──────────────────────────────────────────────────────────────────

  // Build an Item (camelCase) from the raw row for the wizard
  const toItem = (row: ItemRow): Item => ({
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: '',
    unitPrice: row.unit_price ?? 0,
    uom: row.uom ?? 'Each',
    upq: row.upq ?? 1,
    category: row.category ?? '',
    subCategory: row.sub_category ?? undefined,
    stockLevel: 0,
    supplierId: '',
    activeFlag: row.active_flag ?? true,
    itemPool: row.item_pool ?? undefined,
    itemCatalog: row.item_catalog ?? undefined,
    itemType: row.item_type ?? undefined,
    itemColour: row.item_colour ?? undefined,
    itemMaterial: row.item_material ?? undefined,
    itemSize: row.item_size ?? undefined,
    itemWeight: row.item_weight ?? undefined,
    rfidFlag: row.rfid_flag ?? false,
    cogFlag: row.cog_flag ?? false,
    sapItemCodeRaw: row.sap_item_code_raw ?? undefined,
    minLevel: row.min_level ?? undefined,
    maxLevel: row.max_level ?? undefined,
  });

  const handleCreateSave = async (itemData: Partial<Item>) => {
    try {
      await addItem({ ...itemData, id: itemData.id || crypto.randomUUID() } as Item);
      success('Item added to catalogue');
      setIsCreatingItem(false);
      await Promise.all([loadData(true), reloadData(true)]);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to add item');
    }
  };

  const handleWizardSave = async (itemData: Partial<Item>) => {
    if (!editingItem) return;
    try {
      await updateItem({ ...toItem(editingItem), ...itemData });
      success('Item updated successfully');
      setEditingItem(null);
      await Promise.all([loadData(true), reloadData(true)]);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update item');
    }
  };

  // ── Archive ───────────────────────────────────────────────────────────────

  const handleArchiveConfirm = async () => {
    if (!confirmArchive) return;
    try {
      await archiveItem(confirmArchive.id);
      success(`"${confirmArchive.name}" archived`);
      setConfirmArchive(null);
      await Promise.all([loadData(true), reloadData(true)]);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to archive item');
    }
  };

  const handleReactivateConfirm = async () => {
    if (!confirmReactivate) return;
    try {
      await reactivateItem(confirmReactivate.id);
      success(`"${confirmReactivate.name}" restored to active catalogue`);
      setConfirmReactivate(null);
      await Promise.all([loadData(true), reloadData(true)]);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to restore item');
    }
  };

  // ── Archived Items List & Reinstate Handler ─────────────────────────────

  const archivedItems = useMemo(() => {
    return items.filter(i => i.active_flag === false);
  }, [items]);

  const filteredArchivedItems = useMemo(() => {
    const q = archivedSearch.toLowerCase().trim();
    if (!q) return archivedItems;
    return archivedItems.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.sku ?? '').toLowerCase().includes(q) ||
      (i.sap_item_code_raw ?? '').toLowerCase().includes(q) ||
      (i.category ?? '').toLowerCase().includes(q)
    );
  }, [archivedItems, archivedSearch]);

  const handleReinstateSingle = async (item: ItemRow) => {
    setReinstatingId(item.id);
    try {
      await reactivateItem(item.id);
      success(`"${item.name}" reinstated and restored to active catalogue`);
      await Promise.all([loadData(true), reloadData(true)]);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to reinstate item');
    } finally {
      setReinstatingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-page-entry max-w-7xl mx-auto">

      {/* Header row — Export, Refresh, Active-only all in one line */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Item Catalogue"
          subtitle="Unified master item list — legacy and workflow-created items."
        />

        <div className="flex items-center gap-2">
          {/* Active-only toggle — same height as other buttons */}
          <button
            onClick={() => setFilterActiveOnly(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl border transition-all ${
              filterActiveOnly
                ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/25 hover:bg-emerald-600'
                : 'bg-white dark:bg-nocturne border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5'
            }`}
          >
            <CheckCircle size={14} className={filterActiveOnly ? 'text-white' : 'text-gray-400'} />
            {filterActiveOnly ? 'Active Only' : 'All Items'}
          </button>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

          {isAdmin && (
            <button
              onClick={() => setIsCreatingItem(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-white bg-[var(--color-brand)] rounded-xl hover:bg-[var(--color-brand)]/90 transition-all shadow-sm shadow-[var(--color-brand)]/25"
            >
              <Plus size={14} /> Add Item
            </button>
          )}

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500 bg-white dark:bg-nocturne border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-sm"
          >
            <Download size={14} /> Export
          </button>
          <button
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500 bg-white dark:bg-nocturne border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-sm"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard
            label={filterActiveOnly ? 'Active Items' : 'Total Items'}
            value={stats.total}
            highlight={filterActiveOnly}
            sub={filterActiveOnly ? `of ${items.length.toLocaleString()} total` : undefined}
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
            value={stats.fifth}
            sub={filterActiveOnly ? (stats.fifth > 0 ? 'Click to view & reinstate' : 'No hidden items') : undefined}
            clickable={filterActiveOnly && stats.fifth > 0}
            onClick={() => {
              if (filterActiveOnly && stats.fifth > 0) {
                setIsArchivedModalOpen(true);
              }
            }}
          />
        </div>
      )}

      {/* Tabs + search + filter toggle */}
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
                  ? 'bg-white dark:bg-nocturne text-[var(--color-brand)] shadow-md border border-gray-100/50 dark:border-gray-800/50'
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
              placeholder="Search name, code, price, GSM, attributes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-nocturne text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30 w-72"
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-widest rounded-xl border transition-all ${
              showFilters || activeFilterCount > 0
                ? 'bg-[var(--color-brand)]/10 border-[var(--color-brand)]/30 text-[var(--color-brand)]'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 bg-white dark:bg-nocturne hover:bg-gray-50 dark:hover:bg-white/5'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[var(--color-brand)] text-white text-[9px] font-bold">
                {activeFilterCount}
              </span>
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

      {/* Filter panel — structured controls */}
      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-gray-800">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Item Pool</label>
            <select
              value={filterPool}
              onChange={e => setFilterPool(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-nocturne text-gray-700 dark:text-gray-300"
            >
              <option value="">All Pools</option>
              {allPools.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Catalogue</label>
            <select
              value={filterCatalog}
              onChange={e => setFilterCatalog(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-nocturne text-gray-700 dark:text-gray-300"
            >
              <option value="">All Catalogues</option>
              {allCatalogs.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Category</label>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-nocturne text-gray-700 dark:text-gray-300"
            >
              <option value="">All Categories</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Material</label>
            <select
              value={filterMaterial}
              onChange={e => setFilterMaterial(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-nocturne text-gray-700 dark:text-gray-300"
            >
              <option value="">All Materials</option>
              {allMaterials.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Colour</label>
            <select
              value={filterColour}
              onChange={e => setFilterColour(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-nocturne text-gray-700 dark:text-gray-300"
            >
              <option value="">All Colours</option>
              {allColours.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">RFID</label>
            <select
              value={filterRfid === null ? '' : filterRfid ? 'yes' : 'no'}
              onChange={e => setFilterRfid(e.target.value === '' ? null : e.target.value === 'yes')}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-nocturne text-gray-700 dark:text-gray-300"
            >
              <option value="">All</option>
              <option value="yes">RFID Only</option>
              <option value="no">Non-RFID Only</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Price Range ($)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min $"
                value={filterMinPrice}
                onChange={e => setFilterMinPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-nocturne text-gray-700 dark:text-gray-300"
              />
              <span className="text-gray-400 text-xs">-</span>
              <input
                type="number"
                placeholder="Max $"
                value={filterMaxPrice}
                onChange={e => setFilterMaxPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-nocturne text-gray-700 dark:text-gray-300"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Weight / GSM</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min GSM"
                value={filterMinGsm}
                onChange={e => setFilterMinGsm(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-nocturne text-gray-700 dark:text-gray-300"
              />
              <span className="text-gray-400 text-xs">-</span>
              <input
                type="number"
                placeholder="Max GSM"
                value={filterMaxGsm}
                onChange={e => setFilterMaxGsm(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-nocturne text-gray-700 dark:text-gray-300"
              />
            </div>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {hasSubFilters && (
        <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Active Filters:</span>
          {search && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)] font-medium">
              Search: "{search}"
              <button onClick={() => setSearch('')} className="hover:opacity-75"><X size={12} /></button>
            </span>
          )}
          {filterPool && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 font-medium">
              Pool: {filterPool}
              <button onClick={() => setFilterPool('')} className="hover:opacity-75"><X size={12} /></button>
            </span>
          )}
          {filterCatalog && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 font-medium">
              Catalogue: {filterCatalog}
              <button onClick={() => setFilterCatalog('')} className="hover:opacity-75"><X size={12} /></button>
            </span>
          )}
          {filterCategory && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 font-medium">
              Category: {filterCategory}
              <button onClick={() => setFilterCategory('')} className="hover:opacity-75"><X size={12} /></button>
            </span>
          )}
          {filterMaterial && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 font-medium">
              Material: {filterMaterial}
              <button onClick={() => setFilterMaterial('')} className="hover:opacity-75"><X size={12} /></button>
            </span>
          )}
          {filterColour && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 font-medium">
              Colour: {filterColour}
              <button onClick={() => setFilterColour('')} className="hover:opacity-75"><X size={12} /></button>
            </span>
          )}
          {filterRfid !== null && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 font-medium">
              RFID: {filterRfid ? 'Yes' : 'No'}
              <button onClick={() => setFilterRfid(null)} className="hover:opacity-75"><X size={12} /></button>
            </span>
          )}
          {(filterMinPrice || filterMaxPrice) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-medium">
              Price: ${filterMinPrice || '0'} - ${filterMaxPrice || '∞'}
              <button onClick={() => { setFilterMinPrice(''); setFilterMaxPrice(''); }} className="hover:opacity-75"><X size={12} /></button>
            </span>
          )}
          {(filterMinGsm || filterMaxGsm) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-medium">
              GSM: {filterMinGsm || '0'} - {filterMaxGsm || '∞'}
              <button onClick={() => { setFilterMinGsm(''); setFilterMaxGsm(''); }} className="hover:opacity-75"><X size={12} /></button>
            </span>
          )}
          <button
            onClick={clearSubFilters}
            className="text-xs text-[var(--color-brand)] hover:underline ml-1 font-semibold"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">

        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5 flex items-center gap-3 flex-wrap">
          <Package size={16} className="text-[var(--color-brand)]" />
          <span className="font-bold text-gray-800 dark:text-white text-sm">
            {isLoading ? '—' : `${filtered.length.toLocaleString()} item${filtered.length !== 1 ? 's' : ''}`}
          </span>
          {hasSubFilters && !isLoading && (
            <span className="text-xs text-gray-400">— filtered from {baseSet.length.toLocaleString()}</span>
          )}
          {activeTab !== 'workflow' && !isLoading && (
            <span className="ml-auto text-[10px] text-gray-400">
              MD codes for legacy items are proposals only — computed client-side, not written to the database
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 10 }).map((_, i) => (
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
            {!hasSubFilters && filterActiveOnly && (
              <button
                onClick={() => setFilterActiveOnly(false)}
                className="mt-2 text-xs underline opacity-60 hover:opacity-100"
              >
                Show all items including archived
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
                  const attrs = [item.item_size, item.item_colour, item.item_material]
                    .filter(Boolean).join(' · ');
                  const isInactive = item.active_flag === false;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isInactive
                          ? 'opacity-50 hover:opacity-70'
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
                          {item.sap_item_code_raw ?? item.sku ?? '—'}
                        </span>
                      </td>

                      {/* Pool / Catalogue */}
                      <td className="px-4 py-3 text-xs">
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
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[160px] truncate">
                        {attrs || <span className="text-gray-300 dark:text-gray-700">—</span>}
                      </td>

                      {/* Weight */}
                      <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {displayWeight ?? <span className="text-gray-300 dark:text-gray-700">—</span>}
                      </td>

                      {/* RFID */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.rfid_flag ? (
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
                      <td className="px-4 py-3 text-right sticky right-0 bg-white dark:bg-nocturne shadow-[-8px_0_10px_-8px_rgba(0,0,0,0.06)]">
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
                          {!isInactive ? (
                            <button
                              onClick={() => setConfirmArchive(item)}
                              title="Archive item"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                            >
                              <Archive size={15} />
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmReactivate(item)}
                              title="Restore item"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"
                            >
                              <RefreshCw size={15} />
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

      {/* Create modal (admin only) */}
      {isCreatingItem && (
        <ItemWizard
          isOpen
          onClose={() => setIsCreatingItem(false)}
          onSave={handleCreateSave}
          items={contextItems}
          suppliers={suppliers}
          attributeOptions={attributeOptions}
          upsertAttributeOption={upsertAttributeOption}
        />
      )}

      {/* Edit modal */}
      {editingItem && (
        <ItemWizard
          isOpen
          onClose={() => setEditingItem(null)}
          onSave={handleWizardSave}
          existingItem={toItem(editingItem)}
          items={contextItems}
          suppliers={suppliers}
          attributeOptions={attributeOptions}
          upsertAttributeOption={upsertAttributeOption}
        />
      )}

      {/* Audit history modal */}
      {auditItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-nocturne rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
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
        message={`Archive "${confirmArchive?.name}" (${confirmArchive?.sku})? It will be hidden from active lists but its data is preserved.`}
        confirmLabel="Archive"
        variant="danger"
        onConfirm={handleArchiveConfirm}
        onCancel={() => setConfirmArchive(null)}
      />

      {/* Reactivate confirm */}
      <ConfirmDialog
        isOpen={!!confirmReactivate}
        title="Restore Item?"
        message={`Restore "${confirmReactivate?.name}" (${confirmReactivate?.sku}) to the active catalogue? It will become available for new requests immediately.`}
        confirmLabel="Restore Item"
        variant="success"
        onConfirm={handleReactivateConfirm}
        onCancel={() => setConfirmReactivate(null)}
      />
      {/* Archived (Hidden) Items Modal */}
      {isArchivedModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-nocturne rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Archive size={22} className="text-amber-500" /> Archived (Hidden) Items
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {archivedItems.length} items currently archived. Search and reinstate any item to restore it across ProcureFlow.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsArchivedModalOpen(false);
                  setArchivedSearch('');
                }}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors text-gray-500"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800/60 bg-white dark:bg-nocturne">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={archivedSearch}
                  onChange={e => setArchivedSearch(e.target.value)}
                  placeholder="Search archived SKU, SAP Code, Name or Category (e.g. BM1R)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:border-[var(--color-brand)] dark:text-white"
                />
                {archivedSearch && (
                  <button
                    onClick={() => setArchivedSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-semibold"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredArchivedItems.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Package size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-semibold">
                    {archivedSearch ? 'No archived items match your search.' : 'No archived items found.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredArchivedItems.map(item => (
                    <div
                      key={item.id}
                      className="py-3 px-3 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl flex items-center justify-between gap-4 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900 dark:text-white truncate">
                            {item.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-mono text-xs font-semibold">
                            {item.sku || item.sap_item_code_raw || 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                          {item.category && <span>Category: {item.category}</span>}
                          {item.item_pool && <span>Pool: {item.item_pool}</span>}
                          {item.item_catalog && <span>Catalogue: {item.item_catalog}</span>}
                        </div>
                      </div>

                      <button
                        onClick={() => handleReinstateSingle(item)}
                        disabled={reinstatingId === item.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
                      >
                        {reinstatingId === item.id ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" /> Reinstating...
                          </>
                        ) : (
                          <>
                            <RotateCcw size={14} /> Reinstate Item
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-white/5 text-xs text-gray-500 dark:text-gray-400">
              <span>Showing {filteredArchivedItems.length} of {archivedItems.length} archived items</span>
              <button
                onClick={() => {
                  setIsArchivedModalOpen(false);
                  setArchivedSearch('');
                }}
                className="px-5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
