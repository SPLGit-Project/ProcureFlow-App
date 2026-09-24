import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.tsx';
import {
  Boxes,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Mail,
  ExternalLink,
  PlusCircle,
  Building,
  Package,
  Layers,
  Sparkles,
  ArrowRight,
  X,
  Send,
  Info,
  Clock,
  ChevronRight,
  ShieldCheck,
  LayoutGrid,
  List
} from 'lucide-react';
import PageHeader from './PageHeader.tsx';
import { isDefaultSupplier, dedupeSuppliersForDisplay } from '../utils/suppliers.ts';
import { calculateItemRunningStock, StockBreakdown } from '../utils/reservationUtils.ts';
import { formatCurrency } from '../utils/taxCalculations.ts';
import type { Item, Supplier } from '../types.ts';

interface DirectoryRow {
  key: string;
  itemId: string;
  itemName: string;
  internalSku: string;
  supplierId: string;
  supplierName: string;
  isDefault: boolean;
  supplierSku: string;
  category: string;
  unitPrice: number;
  packMultiple: number;
  breakdown: StockBreakdown;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'RESERVED_PRESSURE' | 'OUT_OF_STOCK';
}

const SupplierStockDirectory: React.FC = () => {
  const navigate = useNavigate();
  const { items, suppliers, stockSnapshots, mappings, pos, userSites, reloadData, isLoadingData } = useApp();

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  const displaySuppliers = useMemo(() => dedupeSuppliersForDisplay(suppliers), [suppliers]);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'PRESSURE' | 'OUT_OF_STOCK'>('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('TABLE');

  // Contact Ash modal state
  const [selectedItemForRequest, setSelectedItemForRequest] = useState<DirectoryRow | null>(null);
  const [requestSiteId, setRequestSiteId] = useState(userSites[0]?.id || '');
  const [requestQty, setRequestQty] = useState('50');
  const [requestReason, setRequestReason] = useState('NCC Stockout / Unavailable');
  const [requestNotes, setRequestNotes] = useState('');
  const [isCopiedEmail, setIsCopiedEmail] = useState(false);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.category && i.category.trim()) set.add(i.category.trim());
    });
    (stockSnapshots || []).forEach(s => {
      if (s.category && s.category.trim()) set.add(s.category.trim());
    });
    return Array.from(set).sort();
  }, [items, stockSnapshots]);

  // Build directory rows
  const directoryRows = useMemo<DirectoryRow[]>(() => {
    const rows: DirectoryRow[] = [];
    const processedKeys = new Set<string>();

    items.forEach(item => {
      if (item.activeFlag === false) return;

      const suppliersToProcess: string[] = [];
      if (item.supplierId) suppliersToProcess.push(item.supplierId);

      (mappings || [])
        .filter(m => m.productId === item.id)
        .forEach(m => {
          if (!suppliersToProcess.includes(m.supplierId)) {
            suppliersToProcess.push(m.supplierId);
          }
        });

      (stockSnapshots || [])
        .filter(s =>
          (s.customerStockCode && s.customerStockCode.toLowerCase() === (item.sku || '').toLowerCase()) ||
          (s.customerStockCodeNorm && item.sapItemCodeNorm && s.customerStockCodeNorm === item.sapItemCodeNorm) ||
          (s.supplierSku && s.supplierSku.toLowerCase() === (item.sku || '').toLowerCase())
        )
        .forEach(s => {
          if (!suppliersToProcess.includes(s.supplierId)) {
            suppliersToProcess.push(s.supplierId);
          }
        });

      suppliersToProcess.forEach(supId => {
        const supplier = suppliers.find(s => s.id === supId);
        if (!supplier) return;

        const isDefault = isDefaultSupplier(supplier.name);
        const mapping = (mappings || []).find(m => m.productId === item.id && m.supplierId === supId);
        const supplierSku = mapping?.supplierSku || item.sku || '-';
        const rowKey = `${supId}:${supplierSku}:${item.id}`;

        if (processedKeys.has(rowKey)) return;
        processedKeys.add(rowKey);

        const breakdown = calculateItemRunningStock(
          item.id,
          supId,
          suppliers,
          mappings,
          stockSnapshots,
          pos,
          item.defaultOrderMultiple || 1
        );

        let stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'RESERVED_PRESSURE' | 'OUT_OF_STOCK' = 'IN_STOCK';
        if (breakdown.availableOrderQty <= 0) {
          stockStatus = 'OUT_OF_STOCK';
        } else if (breakdown.reservedUnits > 0 && breakdown.availableOrderQty < breakdown.baseAvailableUnits * 0.3) {
          stockStatus = 'RESERVED_PRESSURE';
        } else if (breakdown.availableOrderQty < 50) {
          stockStatus = 'LOW_STOCK';
        }

        rows.push({
          key: rowKey,
          itemId: item.id,
          itemName: item.name,
          internalSku: item.sku || '-',
          supplierId: supId,
          supplierName: supplier.name,
          isDefault,
          supplierSku,
          category: item.category || 'General',
          unitPrice: item.unitPrice || 0,
          packMultiple: item.defaultOrderMultiple || breakdown.packConversionFactor || 1,
          breakdown,
          stockStatus
        });
      });
    });

    // Also include supplier snapshots that didn't have an item match
    (stockSnapshots || []).forEach(snap => {
      const supplier = suppliers.find(s => s.id === snap.supplierId);
      if (!supplier) return;
      const rowKey = `${snap.supplierId}:${snap.supplierSku}:snapshot`;
      if (processedKeys.has(rowKey)) return;

      const alreadyHasRow = rows.some(r => r.supplierId === snap.supplierId && (r.supplierSku === snap.supplierSku || r.internalSku === snap.customerStockCode));
      if (alreadyHasRow) return;

      processedKeys.add(rowKey);
      const isDefault = isDefaultSupplier(supplier.name);
      const available = snap.availableQty || snap.stockOnHand || 0;
      const breakdown: StockBreakdown = {
        supplierSku: snap.supplierSku,
        snapshotDate: snap.snapshotDate || new Date().toISOString(),
        rawSnapshotQty: available,
        packConversionFactor: snap.cartonQty || 1,
        baseAvailableUnits: available,
        reservedUnits: 0,
        committedUnits: 0,
        effectiveStockUnits: available,
        availableOrderQty: available,
        orderMultiple: 1,
        reservedPOs: 0,
        committedPOs: 0
      };

      let stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'RESERVED_PRESSURE' | 'OUT_OF_STOCK' = 'IN_STOCK';
      if (breakdown.availableOrderQty <= 0) {
        stockStatus = 'OUT_OF_STOCK';
      } else if (breakdown.availableOrderQty < 50) {
        stockStatus = 'LOW_STOCK';
      }

      rows.push({
        key: rowKey,
        itemId: snap.id,
        itemName: snap.productName || snap.supplierSku,
        internalSku: snap.customerStockCode || snap.supplierSku,
        supplierId: snap.supplierId,
        supplierName: supplier.name,
        isDefault,
        supplierSku: snap.supplierSku,
        category: snap.category || 'General',
        unitPrice: snap.sellPrice || snap.unitPrice || 0,
        packMultiple: snap.cartonQty || 1,
        breakdown,
        stockStatus
      });
    });

    // Default supplier (NCC) items first, then alphabetical
    return rows.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.itemName.localeCompare(b.itemName);
    });
  }, [items, suppliers, mappings, stockSnapshots, pos]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return directoryRows.filter(row => {
      if (selectedSupplierId !== 'ALL' && row.supplierId !== selectedSupplierId) return false;
      if (selectedCategory !== 'ALL' && row.category !== selectedCategory) return false;

      if (stockStatusFilter === 'IN_STOCK' && row.breakdown.availableOrderQty <= 0) return false;
      if (stockStatusFilter === 'LOW_STOCK' && (row.stockStatus !== 'LOW_STOCK' || row.breakdown.availableOrderQty <= 0)) return false;
      if (stockStatusFilter === 'PRESSURE' && row.stockStatus !== 'RESERVED_PRESSURE') return false;
      if (stockStatusFilter === 'OUT_OF_STOCK' && row.breakdown.availableOrderQty > 0) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = row.itemName.toLowerCase().includes(query);
        const matchesInternalSku = row.internalSku.toLowerCase().includes(query);
        const matchesSupplierSku = row.supplierSku.toLowerCase().includes(query);
        const matchesSupplierName = row.supplierName.toLowerCase().includes(query);
        const matchesCategory = row.category.toLowerCase().includes(query);
        if (!matchesName && !matchesInternalSku && !matchesSupplierSku && !matchesSupplierName && !matchesCategory) {
          return false;
        }
      }

      return true;
    });
  }, [directoryRows, selectedSupplierId, selectedCategory, stockStatusFilter, searchTerm]);

  // Metrics
  const metrics = useMemo(() => {
    const totalProducts = directoryRows.length;
    const nccRows = directoryRows.filter(r => r.isDefault);
    const nccAvailableStock = nccRows.reduce((acc, r) => acc + r.breakdown.availableOrderQty, 0);

    const alternateRows = directoryRows.filter(r => !r.isDefault);
    const alternateSuppliersCount = new Set(alternateRows.map(r => r.supplierName)).size;
    const alternateAvailableStock = alternateRows.reduce((acc, r) => acc + r.breakdown.availableOrderQty, 0);

    const pendingAlternatePOs = pos.filter(p => p.status === 'PENDING_APPROVAL' && (!isDefaultSupplier(p.supplierName) || p.isNonDefaultSupplier)).length;

    return {
      totalProducts,
      nccRowsCount: nccRows.length,
      nccAvailableStock,
      alternateSuppliersCount,
      alternateAvailableStock,
      pendingAlternatePOs
    };
  }, [directoryRows, pos]);

  const handleOpenContactModal = (row?: DirectoryRow) => {
    if (row) {
      setSelectedItemForRequest(row);
    } else {
      const firstAlternate = directoryRows.find(r => !r.isDefault);
      setSelectedItemForRequest(firstAlternate || directoryRows[0] || null);
    }
  };

  const handleSendEmailToAsh = () => {
    if (!selectedItemForRequest) return;
    const siteName = userSites.find(s => s.id === requestSiteId)?.name || 'All Sites';
    const subject = encodeURIComponent(`[ProcureFlow] Request Alternate Supplier Approval: ${selectedItemForRequest.supplierName} - ${selectedItemForRequest.itemName}`);
    const body = encodeURIComponent(
      `Hi Ashish,\n\n` +
      `I am requesting approval to procure the following item from an alternate supplier instead of our default supplier (NCC Apparel):\n\n` +
      `• Item Name: ${selectedItemForRequest.itemName}\n` +
      `• Internal SKU: ${selectedItemForRequest.internalSku}\n` +
      `• Requested Alternate Supplier: ${selectedItemForRequest.supplierName}\n` +
      `• Supplier SKU: ${selectedItemForRequest.supplierSku}\n` +
      `• Unit Price: ${formatCurrency(selectedItemForRequest.unitPrice)}\n` +
      `• Current Available Stock: ${selectedItemForRequest.breakdown.availableOrderQty} units\n` +
      `• Delivery Site: ${siteName}\n` +
      `• Requested Quantity: ${requestQty} units\n` +
      `• Primary Reason: ${requestReason}\n` +
      `• Additional Justification / Notes: ${requestNotes || 'N/A'}\n\n` +
      `Could you please review and confirm if we may proceed with this requisition?\n\n` +
      `Thank you,\n` +
      `ProcureFlow User`
    );

    window.location.href = `mailto:ashish.chhabra@splservices.com.au?cc=aaron.bell@splservices.com.au&subject=${subject}&body=${body}`;
  };

  const handleProceedToCreatePO = (supplierId: string, reason?: string) => {
    const encodedReason = encodeURIComponent(reason || 'Alternate supplier requested via directory');
    navigate(`/create?supplierId=${supplierId}&reason=${encodedReason}`);
  };

  if (isLoadingData && items.length === 0 && stockSnapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <p className="text-sm font-semibold text-slate-500">Loading supplier stock directory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          title="Supplier Stock Directory"
          subtitle="Comprehensive real-time inventory directory across all national suppliers. NCC Apparel is SPL's primary default supplier."
        />
        <div className="flex items-center gap-3 ml-auto">
          <button
            type="button"
            onClick={() => handleOpenContactModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Mail size={16} /> Contact Ash for Alternate Supplier
          </button>
          <button
            type="button"
            onClick={() => navigate('/create')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <PlusCircle size={16} /> Create Requisition
          </button>
        </div>
      </div>

      {/* Contracted Default Supplier Policy Card */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-indigo-800/40">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <CheckCircle2 size={14} className="text-emerald-400" /> NCC Apparel · SPL Primary Contracted Supplier
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-slate-200 border border-white/10">
                <ShieldCheck size={14} className="text-blue-300" /> Standard Procurement Policy
              </span>
            </div>

            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
              Single-Source Supplier Transparency & Fair Allocation
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
              ProcureFlow automatically defaults to <b>NCC Apparel</b> for all standard requisitions. If an item is urgently required from an alternate supplier (such as Simba Global, HOST Supplies, or Frenkel Textiles), review live running stock below and request approval from <b>Ashish Chhabra</b>.
            </p>

            <div className="pt-2 flex flex-wrap gap-4 text-xs text-slate-300">
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Procurement Lead: <b>Ashish Chhabra</b> (ashish.chhabra@splservices.com.au)</span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                <span>Automation & Tech: <b>Aaron Bell</b> (aaron.bell@splservices.com.au)</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
                Alternate Supplier Request Process
              </span>
              <p className="text-xs text-slate-200 leading-relaxed">
                Requisitions with alternate suppliers are flagged for review before approval. Ensure you provide business justification (e.g. stockout, customer specification).
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenContactModal()}
              className="w-full py-2.5 px-4 bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              Request Alternate Authorization <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-nocturne rounded-2xl border border-default shadow-sm">
          <span className="text-xs font-bold text-secondary uppercase tracking-wider block">Total Catalog Items</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-primary dark:text-white font-mono">{metrics.totalProducts}</span>
            <span className="text-xs text-secondary">mapped products</span>
          </div>
          <p className="text-[11px] text-tertiary mt-1">Across all national supplier feeds</p>
        </div>

        <div className="p-5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">NCC Inventory (Default)</span>
            <span className="text-[10px] font-bold bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 px-1.5 py-0.5 rounded">Primary</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
              {metrics.nccAvailableStock.toLocaleString()}
            </span>
            <span className="text-xs text-emerald-600 font-semibold">orderable units</span>
          </div>
          <p className="text-[11px] text-emerald-700/80 mt-1">{metrics.nccRowsCount} items ready for immediate order</p>
        </div>

        <div className="p-5 bg-blue-50/60 dark:bg-blue-950/20 rounded-2xl border border-blue-200 dark:border-blue-800/40 shadow-sm">
          <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider block">Alternate Suppliers</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-700 dark:text-blue-400 font-mono">
              {metrics.alternateAvailableStock.toLocaleString()}
            </span>
            <span className="text-xs text-blue-600 font-semibold">units across {metrics.alternateSuppliersCount} suppliers</span>
          </div>
          <p className="text-[11px] text-blue-700/80 mt-1">Simba Global, HOST Supplies, Frenkel</p>
        </div>

        <div className="p-5 bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-800/40 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">Pending Alternate POs</span>
            <span className="text-[10px] font-bold bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded">Review</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-700 dark:text-amber-400 font-mono">
              {metrics.pendingAlternatePOs}
            </span>
            <span className="text-xs text-amber-600 font-semibold">requiring Ash's review</span>
          </div>
          <p className="text-[11px] text-amber-700/80 mt-1">Non-default supplier approvals</p>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white dark:bg-nocturne rounded-2xl p-5 border border-default shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          {/* Universal Search */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search product, SKU, supplier, category..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 dark:bg-surface border border-default rounded-xl pl-10 pr-4 py-2.5 text-sm text-primary dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-gray-50 dark:bg-surface border border-default rounded-xl px-3 py-2.5 text-xs text-primary dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Stock Status Filter */}
            <select
              value={stockStatusFilter}
              onChange={e => setStockStatusFilter(e.target.value as any)}
              className="bg-gray-50 dark:bg-surface border border-default rounded-xl px-3 py-2.5 text-xs text-primary dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">All Stock Levels</option>
              <option value="IN_STOCK">In Stock (&gt;0)</option>
              <option value="LOW_STOCK">Low Stock (&lt;50)</option>
              <option value="PRESSURE">Reservation Pressure</option>
              <option value="OUT_OF_STOCK">Out of Stock (0)</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex border border-default rounded-xl overflow-hidden bg-gray-50 dark:bg-surface p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('TABLE')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'TABLE' ? 'bg-white dark:bg-nocturne text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                title="Table view"
              >
                <List size={16} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('GRID')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'GRID' ? 'bg-white dark:bg-nocturne text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                title="Grid cards view"
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Supplier Selector Chips */}
        <div className="pt-2 border-t border-default flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <span className="text-[11px] font-bold uppercase tracking-wider text-secondary mr-1 shrink-0">Supplier:</span>
          <button
            type="button"
            onClick={() => setSelectedSupplierId('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedSupplierId === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'bg-gray-100 dark:bg-surface text-secondary hover:text-primary hover:bg-gray-200'
            }`}
          >
            All Suppliers ({directoryRows.length})
          </button>

          {displaySuppliers.map(s => {
            const isDefault = isDefaultSupplier(s.name);
            const count = directoryRows.filter(r => r.supplierId === s.id).length;
            const isSelected = selectedSupplierId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSupplierId(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? isDefault
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20'
                      : 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : isDefault
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100'
                    : 'bg-gray-100 dark:bg-surface text-secondary hover:text-primary hover:bg-gray-200'
                }`}
              >
                {isDefault && <CheckCircle2 size={13} className={isSelected ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'} />}
                <span>{s.name}</span>
                {isDefault && <span className="text-[9px] uppercase tracking-wider font-extrabold px-1 rounded bg-black/10">Default</span>}
                <span className="opacity-70 text-[10px]">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Results Container */}
      <div className="bg-white dark:bg-nocturne rounded-2xl border border-default shadow-sm overflow-hidden">
        <div className="p-4 px-6 border-b border-default flex items-center justify-between bg-gray-50/50 dark:bg-surface/50">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-primary dark:text-white text-sm">
              Available Supplier Stock Catalog
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40">
              {filteredRows.length} matches
            </span>
          </div>
          <span className="text-xs text-tertiary">
            Real-time running balances accounting for 48h active reservations
          </span>
        </div>

        {/* Table View */}
        {viewMode === 'TABLE' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-gray-50 dark:bg-surface text-secondary uppercase font-bold text-[10px] tracking-wider border-b border-default">
                <tr>
                  <th className="px-5 py-3.5">Product / Internal SKU</th>
                  <th className="px-5 py-3.5">Supplier & Code</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5 text-right">Unit Price</th>
                  <th className="px-5 py-3.5 text-center">Baseline SOH</th>
                  <th className="px-5 py-3.5 text-center">Active 48h Holds</th>
                  <th className="px-5 py-3.5 text-center">In Delivery</th>
                  <th className="px-5 py-3.5 text-right font-black">Net Orderable</th>
                  <th className="px-5 py-3.5 text-center">Stock Health</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default font-medium">
                {filteredRows.length > 0 ? (
                  filteredRows.map(row => (
                    <tr key={row.key} className="hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors">
                      {/* Product */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-primary dark:text-white text-sm max-w-xs truncate" title={row.itemName}>
                          {row.itemName}
                        </div>
                        <div className="text-[11px] text-tertiary font-mono mt-0.5">
                          SKU: {row.internalSku}
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-primary dark:text-white text-xs">{row.supplierName}</span>
                          {row.isDefault ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60">
                              Default
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">
                              Alternate
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-tertiary font-mono mt-0.5">
                          Code: {row.supplierSku}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-5 py-4 text-secondary">
                        {row.category}
                      </td>

                      {/* Price */}
                      <td className="px-5 py-4 text-right font-mono font-bold text-primary dark:text-white">
                        {formatCurrency(row.unitPrice)}
                      </td>

                      {/* Baseline SOH */}
                      <td className="px-5 py-4 text-center font-mono text-secondary">
                        <div>{row.breakdown.baseAvailableUnits.toLocaleString()}</div>
                        {row.breakdown.snapshotDate && (
                          <div className="text-[9px] text-tertiary">
                            {new Date(row.breakdown.snapshotDate).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Reserved */}
                      <td className="px-5 py-4 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                        {row.breakdown.reservedUnits > 0 ? `-${row.breakdown.reservedUnits.toLocaleString()}` : '0'}
                      </td>

                      {/* Committed */}
                      <td className="px-5 py-4 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                        {row.breakdown.committedUnits > 0 ? `-${row.breakdown.committedUnits.toLocaleString()}` : '0'}
                      </td>

                      {/* Net Orderable */}
                      <td className="px-5 py-4 text-right font-mono font-extrabold text-sm">
                        <span className={row.breakdown.availableOrderQty > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          {row.breakdown.availableOrderQty.toLocaleString()}
                        </span>
                        <div className="text-[10px] text-tertiary font-normal">
                          Pack: {row.packMultiple}
                        </div>
                      </td>

                      {/* Health Badge */}
                      <td className="px-5 py-4 text-center">
                        {row.stockStatus === 'IN_STOCK' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                            In Stock
                          </span>
                        )}
                        {row.stockStatus === 'RESERVED_PRESSURE' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
                            High Holds
                          </span>
                        )}
                        {row.stockStatus === 'LOW_STOCK' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-300">
                            Low Stock
                          </span>
                        )}
                        {row.stockStatus === 'OUT_OF_STOCK' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300">
                            Out of Stock
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!row.isDefault ? (
                            <button
                              type="button"
                              onClick={() => handleOpenContactModal(row)}
                              className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1"
                              title="Request Ash for alternate approval"
                            >
                              <Mail size={12} /> Contact Ash
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleProceedToCreatePO(row.supplierId)}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1"
                            >
                              <PlusCircle size={12} /> Order
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleProceedToCreatePO(row.supplierId, row.isDefault ? undefined : 'Alternate supplier selected via directory')}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                            title="Open requisition with this supplier"
                          >
                            <ExternalLink size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-secondary">
                      No products match your search or filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View */
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRows.map(row => (
              <div
                key={row.key}
                className="bg-gray-50/60 dark:bg-surface/60 rounded-2xl p-5 border border-default hover:border-blue-500/40 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">{row.category}</span>
                    {row.isDefault ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300">
                        <CheckCircle2 size={11} /> NCC (Default)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-300">
                        Alternate Supplier
                      </span>
                    )}
                  </div>

                  <h4 className="font-bold text-primary dark:text-white text-base leading-snug">{row.itemName}</h4>
                  <div className="flex items-center justify-between text-xs text-secondary mt-1 font-mono">
                    <span>SKU: {row.internalSku}</span>
                    <span>Code: {row.supplierSku}</span>
                  </div>

                  <div className="mt-4 p-3 bg-white dark:bg-nocturne rounded-xl border border-default grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-[9px] text-secondary uppercase block font-bold">Baseline</span>
                      <span className="text-xs font-bold font-mono">{row.breakdown.baseAvailableUnits}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-blue-600 uppercase block font-bold">Reserved</span>
                      <span className="text-xs font-bold font-mono text-blue-600">-{row.breakdown.reservedUnits}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-emerald-600 uppercase block font-bold">Net Available</span>
                      <span className="text-sm font-black font-mono text-emerald-600">{row.breakdown.availableOrderQty}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-default flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-secondary uppercase block">Unit Price</span>
                    <span className="text-sm font-bold text-primary dark:text-white font-mono">{formatCurrency(row.unitPrice)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {!row.isDefault ? (
                      <button
                        type="button"
                        onClick={() => handleOpenContactModal(row)}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Mail size={13} /> Request Ash
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleProceedToCreatePO(row.supplierId)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <PlusCircle size={13} /> Requisition
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contact Ashish Modal */}
      {selectedItemForRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-nocturne rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-default animate-scale-up space-y-5">
            <div className="flex items-start justify-between pb-3 border-b border-default">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800/40">
                  Alternate Supplier Approval Request
                </span>
                <h3 className="text-lg font-bold text-primary dark:text-white mt-1">
                  Request Authorization: Ashish Chhabra
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemForRequest(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            {/* Item Card Highlight */}
            <div className="bg-gray-50 dark:bg-surface p-4 rounded-2xl border border-default flex items-center justify-between">
              <div>
                <h4 className="font-bold text-primary dark:text-white text-sm">{selectedItemForRequest.itemName}</h4>
                <div className="text-xs text-secondary mt-0.5">
                  Requested Supplier: <b className="text-primary dark:text-white">{selectedItemForRequest.supplierName}</b> · SKU: {selectedItemForRequest.supplierSku}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedItemForRequest.breakdown.availableOrderQty} available
                </span>
                <span className="text-[10px] text-tertiary block font-mono">
                  {formatCurrency(selectedItemForRequest.unitPrice)} / unit
                </span>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-1.5">
                    Delivery Site <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={requestSiteId}
                    onChange={e => setRequestSiteId(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-surface border border-default rounded-xl p-2.5 text-xs text-primary dark:text-white font-medium"
                  >
                    {userSites.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-1.5">
                    Quantity Needed <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={requestQty}
                    onChange={e => setRequestQty(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-surface border border-default rounded-xl p-2.5 text-xs text-primary dark:text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-1.5">
                  Reason for Alternate Supplier <span className="text-red-500">*</span>
                </label>
                <select
                  value={requestReason}
                  onChange={e => setRequestReason(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-surface border border-default rounded-xl p-2.5 text-xs text-primary dark:text-white font-medium"
                >
                  <option value="NCC Stockout / Unavailable">NCC Stockout / Unavailable</option>
                  <option value="Specialised Technical Specification">Specialised Technical Specification</option>
                  <option value="Customer Mandated Requirement">Customer Mandated Requirement</option>
                  <option value="Urgent Delivery Lead Time">Urgent Delivery Lead Time</option>
                  <option value="Other Business Justification">Other Business Justification</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-1.5">
                  Detailed Justification / Notes
                </label>
                <textarea
                  rows={3}
                  value={requestNotes}
                  onChange={e => setRequestNotes(e.target.value)}
                  placeholder="Provide context on why this item cannot be sourced through default supplier NCC Apparel..."
                  className="w-full bg-gray-50 dark:bg-surface border border-default rounded-xl p-3 text-xs text-primary dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-default flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-tertiary">
                Recipient: <b>ashish.chhabra@splservices.com.au</b>
              </span>
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSelectedItemForRequest(null)}
                  className="px-4 py-2.5 rounded-xl border border-default text-secondary hover:text-primary text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendEmailToAsh}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Send size={14} /> Send Email to Ash
                </button>
                <button
                  type="button"
                  onClick={() => handleProceedToCreatePO(selectedItemForRequest.supplierId, requestReason)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  Raise in App <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierStockDirectory;
