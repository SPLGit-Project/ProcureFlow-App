import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.tsx';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Mail,
  ShoppingCart,
  X,
  Send,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  Scale,
  Check,
  TrendingDown,
  TrendingUp,
  PackageCheck,
  Filter,
  RotateCcw
} from 'lucide-react';
import PageHeader from './PageHeader.tsx';
import { isDefaultSupplier, dedupeSuppliersForDisplay } from '../utils/suppliers.ts';
import { calculateItemRunningStock, StockBreakdown } from '../utils/reservationUtils.ts';
import { formatCurrency } from '../utils/taxCalculations.ts';
import { MASTER_HIERARCHY } from '../utils/hierarchyData.ts';
import type { Item, Supplier, AttributeOption } from '../types.ts';

export interface DirectoryRow {
  key: string;
  itemId: string;
  itemName: string;
  internalSku: string;
  supplierId: string;
  supplierName: string;
  isDefault: boolean;
  supplierSku: string;
  itemPool: string;
  itemCatalog: string;
  itemType: string;
  category: string;
  subCategory: string;
  unitPrice: number;
  packMultiple: number;
  breakdown: StockBreakdown;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'RESERVED_PRESSURE' | 'OUT_OF_STOCK';
}

export interface SupplierOffer {
  supplierId: string;
  supplierName: string;
  isDefault: boolean;
  supplierSku: string;
  unitPrice: number;
  availableStock: number;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'RESERVED_PRESSURE' | 'OUT_OF_STOCK';
  packMultiple: number;
  row: DirectoryRow;
}

export interface ItemComparisonGroup {
  key: string;
  itemId: string;
  itemName: string;
  internalSku: string;
  itemPool: string;
  itemCatalog: string;
  itemType: string;
  category: string;
  subCategory: string;
  defaultOffer?: SupplierOffer;
  alternateOffers: SupplierOffer[];
  totalOffers: number;
  hasMatch: boolean;
  minPrice: number;
  maxPrice: number;
  cheapestSupplierName: string;
}

/**
 * Collects distinct, non-empty, case-insensitive badges across itemType, category, and subCategory.
 * Completely eliminates duplicate pills (e.g. 'Table Linen · Table Linen') when itemType and category share the same value.
 */
export function getItemTaxonomyBadges(itemOrRow: {
  itemPool?: string;
  itemCatalog?: string;
  itemType?: string;
  category?: string;
  subCategory?: string;
}): string[] {
  const seen = new Set<string>();
  const badges: string[] = [];

  const candidates = [itemOrRow.itemType, itemOrRow.category, itemOrRow.subCategory];
  for (const c of candidates) {
    if (!c) continue;
    const trimmed = c.trim();
    if (!trimmed || trimmed === 'Unassigned' || trimmed === 'Unclassified' || trimmed === 'Other' || trimmed === 'TBA') continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      badges.push(trimmed);
    }
  }

  return badges;
}

/**
 * Resolves all 5 Classification Hierarchy Tiers directly leveraging Admin Classification Tiers:
 * Tier 1: Pools (POOL)
 * Tier 2: Catalogues (CATALOG)
 * Tier 3: Item Types (TYPE)
 * Tier 4: Categories (CATEGORY)
 * Tier 5: Sub-categories (SUB_CATEGORY)
 */
export function resolveItemClassification(
  itemOrSnap: {
    itemPool?: string;
    itemCatalog?: string;
    itemType?: string;
    category?: string;
    subCategory?: string;
    name?: string;
    productName?: string;
  },
  attributeOptions?: AttributeOption[]
): {
  itemPool: string;
  itemCatalog: string;
  itemType: string;
  category: string;
  subCategory: string;
} {
  let resolvedPool = (itemOrSnap.itemPool || '').trim();
  let resolvedCatalog = (itemOrSnap.itemCatalog || '').trim();
  let resolvedType = (itemOrSnap.itemType || '').trim();
  let resolvedCat = (itemOrSnap.category || '').trim();
  let resolvedSub = (itemOrSnap.subCategory || '').trim();

  const catToTypeMap = new Map<string, string>();

  if (attributeOptions && attributeOptions.length > 0) {
    const typeOpts = attributeOptions.filter(o => o.type === 'TYPE' && o.activeFlag !== false);
    const catOpts = attributeOptions.filter(o => o.type === 'CATEGORY' && o.activeFlag !== false);

    catOpts.forEach(o => {
      const parentId = o.parentId || (o.parentIds && o.parentIds[0]);
      if (parentId) {
        const parentType = typeOpts.find(t => t.id === parentId);
        if (parentType) {
          catToTypeMap.set(o.value.trim().toLowerCase(), parentType.value.trim());
        }
      }
    });
  }

  // Fallback mapping from MASTER_HIERARCHY
  for (const pool of Object.keys(MASTER_HIERARCHY)) {
    for (const cat of Object.keys(MASTER_HIERARCHY[pool])) {
      for (const typeKey of Object.keys(MASTER_HIERARCHY[pool][cat])) {
        for (const catKey of Object.keys(MASTER_HIERARCHY[pool][cat][typeKey])) {
          if (!catToTypeMap.has(catKey.trim().toLowerCase())) {
            catToTypeMap.set(catKey.trim().toLowerCase(), typeKey.trim());
          }
        }
      }
    }
  }

  // 1. Resolve Category (Tier 4: Categories)
  if (!resolvedCat || resolvedCat === 'Unassigned' || resolvedCat === 'Other' || resolvedCat === 'TBA') {
    const rawName = (itemOrSnap.name || itemOrSnap.productName || '').toUpperCase();
    if (rawName.includes('SHEET')) resolvedCat = 'Sheet';
    else if (rawName.includes('TOWEL') || rawName.includes('WASHER')) resolvedCat = 'Towel';
    else if (rawName.includes('PILLOW')) resolvedCat = 'Pillow Case';
    else if (rawName.includes('DOONA') || rawName.includes('QUILT')) resolvedCat = 'Doona Cover';
    else if (rawName.includes('BLANKET')) resolvedCat = 'Blanket';
    else if (rawName.includes('BEDSPREAD')) resolvedCat = 'Bedspread';
    else if (rawName.includes('NAPKIN') || rawName.includes('SERVIETTE')) resolvedCat = 'Napkin';
    else if (rawName.includes('APRON') || rawName.includes('BIB')) resolvedCat = 'Apron';
    else if (rawName.includes('GOWN')) resolvedCat = 'Gown';
    else if (rawName.includes('SCRUB')) resolvedCat = 'Scrubs-Top';
    else if (rawName.includes('MOP')) resolvedCat = 'Mop';
    else if (rawName.includes('MAT')) resolvedCat = 'Mat';
    else if (rawName.includes('RUG')) resolvedCat = 'Rug';
    else if (rawName.includes('ROBE')) resolvedCat = 'Robe';
    else if (rawName.includes('CLOTH')) resolvedCat = 'Cloth';
    else if (rawName.includes('UNIFORM') || rawName.includes('SHIRT')) resolvedCat = 'Uniform';
  }

  // 2. Resolve Item Type (Tier 3: Item Types)
  if (!resolvedType || resolvedType === 'Unclassified' || resolvedType === 'Other') {
    if (resolvedCat && catToTypeMap.has(resolvedCat.toLowerCase())) {
      resolvedType = catToTypeMap.get(resolvedCat.toLowerCase())!;
    } else {
      const rawName = (itemOrSnap.name || itemOrSnap.productName || '').toUpperCase();
      if (rawName.includes('SHEET') || rawName.includes('PILLOW') || rawName.includes('DOONA') || rawName.includes('QUILT') || rawName.includes('BLANKET') || rawName.includes('BEDSPREAD')) {
        resolvedType = 'Bed Linen';
      } else if (rawName.includes('TOWEL') || rawName.includes('WASHER') || rawName.includes('ROBE') || rawName.includes('BATH')) {
        resolvedType = 'Bath Linen';
      } else if (rawName.includes('NAPKIN') || rawName.includes('SERVIETTE') || rawName.includes('TABLE')) {
        resolvedType = 'Table Linen';
      } else if (rawName.includes('GOWN') || rawName.includes('SCRUB') || rawName.includes('THEATRE') || rawName.includes('PATIENT')) {
        resolvedType = 'Hospital Wear';
      } else if (rawName.includes('UNIFORM') || rawName.includes('WORKWEAR') || rawName.includes('JACKET') || rawName.includes('SHIRT') || rawName.includes('APRON')) {
        resolvedType = 'Work Wear';
      } else if (rawName.includes('MOP') || rawName.includes('DUSTER') || rawName.includes('BAG') || rawName.includes('MAT') || rawName.includes('CLEANING')) {
        resolvedType = 'Cleaning';
      }
    }
  }

  // 3. Resolve Catalogue (Tier 2: Catalogues)
  if (!resolvedCatalog) {
    if (resolvedType === 'Table Linen' || resolvedType === 'Kitchen Linen') {
      resolvedCatalog = 'Food & Beverages';
    } else if (resolvedType === 'Hospital Wear' || resolvedType === 'Theatre') {
      resolvedCatalog = 'Health Care';
    } else if (resolvedType === 'Bed Linen' || resolvedType === 'Bath Linen') {
      resolvedCatalog = 'Accommodation';
    } else {
      resolvedCatalog = 'Accommodation';
    }
  }

  // 4. Resolve Pool (Tier 1: Pools)
  if (!resolvedPool) {
    resolvedPool = 'General Pool';
  }

  return {
    itemPool: resolvedPool,
    itemCatalog: resolvedCatalog,
    itemType: resolvedType,
    category: resolvedCat,
    subCategory: resolvedSub
  };
}

export function resolveItemCategory(itemOrSnap: any, opts?: AttributeOption[]): string {
  return resolveItemClassification(itemOrSnap, opts).itemType;
}

export function resolveItemType(itemOrSnap: any, opts?: AttributeOption[]): string {
  return resolveItemClassification(itemOrSnap, opts).category;
}

const SupplierStockDirectory: React.FC = () => {
  const navigate = useNavigate();
  const { items, suppliers, stockSnapshots, mappings, pos, userSites, attributeOptions, reloadData, isLoadingData } = useApp();

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  const displaySuppliers = useMemo(() => dedupeSuppliersForDisplay(suppliers), [suppliers]);

  // Filters state - 5-Tier Classification Hierarchy
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('ALL');
  const [selectedPool, setSelectedPool] = useState<string>('ALL');
  const [selectedCatalog, setSelectedCatalog] = useState<string>('ALL');
  const [selectedItemType, setSelectedItemType] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'PRESSURE' | 'OUT_OF_STOCK'>('ALL');
  const [viewMode, setViewMode] = useState<'TABLE' | 'COMPARE' | 'GRID'>('TABLE');
  const [compareOnlyMatches, setCompareOnlyMatches] = useState<boolean>(true);

  // Table Comparison expansion state
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());

  // Pagination state (displays 25 items at a time by default)
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset pagination when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    selectedSupplierId,
    selectedPool,
    selectedCatalog,
    selectedItemType,
    selectedCategory,
    selectedSubCategory,
    stockStatusFilter,
    viewMode,
    compareOnlyMatches,
    pageSize
  ]);

  // Contact Ash modal state
  const [selectedItemForRequest, setSelectedItemForRequest] = useState<DirectoryRow | null>(null);
  const [requestSiteId, setRequestSiteId] = useState(userSites[0]?.id || '');
  const [requestQty, setRequestQty] = useState('50');
  const [requestReason, setRequestReason] = useState('NCC Stockout / Unavailable');
  const [requestNotes, setRequestNotes] = useState('');
  const [isCopiedEmail, setIsCopiedEmail] = useState(false);

  // Build directory rows with clean 5-tier classification
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

        const classification = resolveItemClassification(item, attributeOptions);

        rows.push({
          key: rowKey,
          itemId: item.id,
          itemName: item.name,
          internalSku: item.sku || '-',
          supplierId: supId,
          supplierName: supplier.name,
          isDefault,
          supplierSku,
          itemPool: classification.itemPool,
          itemCatalog: classification.itemCatalog,
          itemType: classification.itemType,
          category: classification.category,
          subCategory: classification.subCategory,
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

      const classification = resolveItemClassification({
        itemPool: snap.stockType,
        category: snap.category,
        subCategory: snap.subCategory,
        name: snap.productName,
        productName: snap.productName
      }, attributeOptions);

      rows.push({
        key: rowKey,
        itemId: snap.id,
        itemName: snap.productName || snap.supplierSku,
        internalSku: snap.customerStockCode || snap.supplierSku,
        supplierId: snap.supplierId,
        supplierName: supplier.name,
        isDefault,
        supplierSku: snap.supplierSku,
        itemPool: classification.itemPool,
        itemCatalog: classification.itemCatalog,
        itemType: classification.itemType,
        category: classification.category,
        subCategory: classification.subCategory,
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
  }, [items, suppliers, mappings, stockSnapshots, pos, attributeOptions]);

  // ── 5-Tier Classification Hierarchy Dropdown Options ──

  // 1. Available Pools (Admin Tier: POOL)
  const availablePools = useMemo(() => {
    const set = new Set<string>();
    (attributeOptions || [])
      .filter(o => o.type === 'POOL' && o.activeFlag !== false)
      .forEach(o => o.value?.trim() && set.add(o.value.trim()));
    directoryRows.forEach(r => r.itemPool?.trim() && set.add(r.itemPool.trim()));
    return Array.from(set).filter(Boolean).sort();
  }, [attributeOptions, directoryRows]);

  // 2. Available Catalogues (Admin Tier: CATALOG - optionally scoped by selectedPool)
  const availableCatalogs = useMemo(() => {
    const set = new Set<string>();
    if (selectedPool === 'ALL') {
      (attributeOptions || [])
        .filter(o => o.type === 'CATALOG' && o.activeFlag !== false)
        .forEach(o => o.value?.trim() && set.add(o.value.trim()));
      directoryRows.forEach(r => r.itemCatalog?.trim() && set.add(r.itemCatalog.trim()));
    } else {
      directoryRows.forEach(r => {
        if (r.itemPool === selectedPool && r.itemCatalog?.trim()) {
          set.add(r.itemCatalog.trim());
        }
      });
      const poolOpt = (attributeOptions || []).find(o => o.type === 'POOL' && o.value === selectedPool);
      if (poolOpt) {
        (attributeOptions || [])
          .filter(o => o.type === 'CATALOG' && o.activeFlag !== false && (o.parentId === poolOpt.id || o.parentIds?.includes(poolOpt.id)))
          .forEach(o => o.value?.trim() && set.add(o.value.trim()));
      }
    }
    return Array.from(set).filter(Boolean).sort();
  }, [attributeOptions, directoryRows, selectedPool]);

  // 3. Available Item Types (Admin Tier: TYPE - optionally scoped by selectedCatalog/Pool)
  const availableItemTypes = useMemo(() => {
    const set = new Set<string>();
    if (selectedCatalog === 'ALL') {
      (attributeOptions || [])
        .filter(o => o.type === 'TYPE' && o.activeFlag !== false)
        .forEach(o => o.value?.trim() && set.add(o.value.trim()));
      directoryRows.forEach(r => {
        if (selectedPool === 'ALL' || r.itemPool === selectedPool) {
          if (r.itemType?.trim()) set.add(r.itemType.trim());
        }
      });
    } else {
      directoryRows.forEach(r => {
        if (r.itemCatalog === selectedCatalog && (selectedPool === 'ALL' || r.itemPool === selectedPool) && r.itemType?.trim()) {
          set.add(r.itemType.trim());
        }
      });
      const catOpt = (attributeOptions || []).find(o => o.type === 'CATALOG' && o.value === selectedCatalog);
      if (catOpt) {
        (attributeOptions || [])
          .filter(o => o.type === 'TYPE' && o.activeFlag !== false && (o.parentId === catOpt.id || o.parentIds?.includes(catOpt.id)))
          .forEach(o => o.value?.trim() && set.add(o.value.trim()));
      }
    }
    return Array.from(set).filter(Boolean).sort();
  }, [attributeOptions, directoryRows, selectedPool, selectedCatalog]);

  // 4. Available Categories (Admin Tier: CATEGORY - optionally scoped by selectedItemType)
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    if (selectedItemType === 'ALL') {
      (attributeOptions || [])
        .filter(o => o.type === 'CATEGORY' && o.activeFlag !== false)
        .forEach(o => o.value?.trim() && set.add(o.value.trim()));
      directoryRows.forEach(r => {
        if (
          (selectedPool === 'ALL' || r.itemPool === selectedPool) &&
          (selectedCatalog === 'ALL' || r.itemCatalog === selectedCatalog)
        ) {
          if (r.category?.trim()) set.add(r.category.trim());
        }
      });
    } else {
      directoryRows.forEach(r => {
        if (r.itemType === selectedItemType && r.category?.trim()) {
          set.add(r.category.trim());
        }
      });
      const selectedTypeOpt = (attributeOptions || []).find(o => o.type === 'TYPE' && o.value === selectedItemType);
      if (selectedTypeOpt) {
        (attributeOptions || [])
          .filter(o => o.type === 'CATEGORY' && o.activeFlag !== false && (o.parentId === selectedTypeOpt.id || o.parentIds?.includes(selectedTypeOpt.id)))
          .forEach(o => o.value?.trim() && set.add(o.value.trim()));
      }
    }
    return Array.from(set).filter(Boolean).sort();
  }, [attributeOptions, directoryRows, selectedPool, selectedCatalog, selectedItemType]);

  // 5. Available Sub-categories (Admin Tier: SUB_CATEGORY - optionally scoped by selectedCategory)
  const availableSubCategories = useMemo(() => {
    const set = new Set<string>();
    if (selectedCategory === 'ALL') {
      (attributeOptions || [])
        .filter(o => o.type === 'SUB_CATEGORY' && o.activeFlag !== false)
        .forEach(o => o.value?.trim() && set.add(o.value.trim()));
      directoryRows.forEach(r => {
        if (
          (selectedItemType === 'ALL' || r.itemType === selectedItemType) &&
          (selectedCatalog === 'ALL' || r.itemCatalog === selectedCatalog) &&
          (selectedPool === 'ALL' || r.itemPool === selectedPool)
        ) {
          if (r.subCategory?.trim()) set.add(r.subCategory.trim());
        }
      });
    } else {
      directoryRows.forEach(r => {
        if (r.category === selectedCategory && r.subCategory?.trim()) {
          set.add(r.subCategory.trim());
        }
      });
      const selectedCatOpt = (attributeOptions || []).find(o => o.type === 'CATEGORY' && o.value === selectedCategory);
      if (selectedCatOpt) {
        (attributeOptions || [])
          .filter(o => o.type === 'SUB_CATEGORY' && o.activeFlag !== false && (o.parentId === selectedCatOpt.id || o.parentIds?.includes(selectedCatOpt.id)))
          .forEach(o => o.value?.trim() && set.add(o.value.trim()));
      }
    }
    return Array.from(set).filter(Boolean).sort();
  }, [attributeOptions, directoryRows, selectedPool, selectedCatalog, selectedItemType, selectedCategory]);

  // Cascading Hierarchy Handlers
  const handlePoolChange = (newPool: string) => {
    setSelectedPool(newPool);
    setSelectedCatalog('ALL');
    setSelectedItemType('ALL');
    setSelectedCategory('ALL');
    setSelectedSubCategory('ALL');
  };

  const handleCatalogChange = (newCat: string) => {
    setSelectedCatalog(newCat);
    setSelectedItemType('ALL');
    setSelectedCategory('ALL');
    setSelectedSubCategory('ALL');
  };

  const handleItemTypeChange = (newType: string) => {
    setSelectedItemType(newType);
    setSelectedCategory('ALL');
    setSelectedSubCategory('ALL');
  };

  const handleCategoryChange = (newCat: string) => {
    setSelectedCategory(newCat);
    setSelectedSubCategory('ALL');
  };

  const handleSubCategoryChange = (newSub: string) => {
    setSelectedSubCategory(newSub);
  };

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setSelectedSupplierId('ALL');
    setSelectedPool('ALL');
    setSelectedCatalog('ALL');
    setSelectedItemType('ALL');
    setSelectedCategory('ALL');
    setSelectedSubCategory('ALL');
    setStockStatusFilter('ALL');
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedSupplierId !== 'ALL' ||
    selectedPool !== 'ALL' ||
    selectedCatalog !== 'ALL' ||
    selectedItemType !== 'ALL' ||
    selectedCategory !== 'ALL' ||
    selectedSubCategory !== 'ALL' ||
    stockStatusFilter !== 'ALL';

  // Build comparison groups (side-by-side comparison of items across suppliers)
  const comparisonGroups = useMemo<ItemComparisonGroup[]>(() => {
    const groupMap = new Map<string, ItemComparisonGroup>();

    directoryRows.forEach(row => {
      const normKey = (row.internalSku && row.internalSku !== '-')
        ? row.internalSku.trim().toUpperCase()
        : row.itemName.trim().toUpperCase();

      if (!groupMap.has(normKey)) {
        groupMap.set(normKey, {
          key: normKey,
          itemId: row.itemId,
          itemName: row.itemName,
          internalSku: row.internalSku,
          itemPool: row.itemPool,
          itemCatalog: row.itemCatalog,
          itemType: row.itemType,
          category: row.category,
          subCategory: row.subCategory,
          alternateOffers: [],
          totalOffers: 0,
          hasMatch: false,
          minPrice: Infinity,
          maxPrice: -Infinity,
          cheapestSupplierName: ''
        });
      }

      const group = groupMap.get(normKey)!;
      const offer: SupplierOffer = {
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        isDefault: row.isDefault,
        supplierSku: row.supplierSku,
        unitPrice: row.unitPrice,
        availableStock: row.breakdown.availableOrderQty,
        stockStatus: row.stockStatus,
        packMultiple: row.packMultiple,
        row
      };

      if (row.isDefault) {
        group.defaultOffer = offer;
      } else {
        if (!group.alternateOffers.some(o => o.supplierId === row.supplierId)) {
          group.alternateOffers.push(offer);
        }
      }
    });

    const list: ItemComparisonGroup[] = [];
    groupMap.forEach(group => {
      const allOffers = [
        ...(group.defaultOffer ? [group.defaultOffer] : []),
        ...group.alternateOffers
      ];
      group.totalOffers = allOffers.length;
      group.hasMatch = group.totalOffers > 1;

      if (allOffers.length > 0) {
        let min = Infinity;
        let max = -Infinity;
        let cheapest = '';
        allOffers.forEach(o => {
          if (o.unitPrice > 0 && o.unitPrice < min) {
            min = o.unitPrice;
            cheapest = o.supplierName;
          }
          if (o.unitPrice > max) {
            max = o.unitPrice;
          }
        });
        group.minPrice = min === Infinity ? 0 : min;
        group.maxPrice = max === -Infinity ? 0 : max;
        group.cheapestSupplierName = cheapest;
      }
      list.push(group);
    });

    return list.sort((a, b) => {
      if (a.hasMatch && !b.hasMatch) return -1;
      if (!a.hasMatch && b.hasMatch) return 1;
      return a.itemName.localeCompare(b.itemName);
    });
  }, [directoryRows]);

  // Filtered rows for Table and Grid view across all 5 classification tiers
  const filteredRows = useMemo(() => {
    return directoryRows.filter(row => {
      if (selectedSupplierId !== 'ALL' && row.supplierId !== selectedSupplierId) return false;
      if (selectedPool !== 'ALL' && row.itemPool !== selectedPool) return false;
      if (selectedCatalog !== 'ALL' && row.itemCatalog !== selectedCatalog) return false;
      if (selectedItemType !== 'ALL' && row.itemType !== selectedItemType) return false;
      if (selectedCategory !== 'ALL' && row.category !== selectedCategory) return false;
      if (selectedSubCategory !== 'ALL' && row.subCategory !== selectedSubCategory) return false;

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
        const matchesPool = (row.itemPool || '').toLowerCase().includes(query);
        const matchesCatalog = (row.itemCatalog || '').toLowerCase().includes(query);
        const matchesItemType = (row.itemType || '').toLowerCase().includes(query);
        const matchesCategory = (row.category || '').toLowerCase().includes(query);
        const matchesSubCategory = (row.subCategory || '').toLowerCase().includes(query);

        if (!matchesName && !matchesInternalSku && !matchesSupplierSku && !matchesSupplierName &&
            !matchesPool && !matchesCatalog && !matchesItemType && !matchesCategory && !matchesSubCategory) {
          return false;
        }
      }

      return true;
    });
  }, [directoryRows, selectedSupplierId, selectedPool, selectedCatalog, selectedItemType, selectedCategory, selectedSubCategory, stockStatusFilter, searchTerm]);

  // Filtered comparison groups across all 5 classification tiers
  const filteredComparisonGroups = useMemo(() => {
    return comparisonGroups.filter(group => {
      if (compareOnlyMatches && !group.hasMatch) return false;
      if (selectedPool !== 'ALL' && group.itemPool !== selectedPool) return false;
      if (selectedCatalog !== 'ALL' && group.itemCatalog !== selectedCatalog) return false;
      if (selectedItemType !== 'ALL' && group.itemType !== selectedItemType) return false;
      if (selectedCategory !== 'ALL' && group.category !== selectedCategory) return false;
      if (selectedSubCategory !== 'ALL' && group.subCategory !== selectedSubCategory) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchName = group.itemName.toLowerCase().includes(query);
        const matchSku = group.internalSku.toLowerCase().includes(query);
        const matchPool = (group.itemPool || '').toLowerCase().includes(query);
        const matchCatalog = (group.itemCatalog || '').toLowerCase().includes(query);
        const matchType = (group.itemType || '').toLowerCase().includes(query);
        const matchCategory = (group.category || '').toLowerCase().includes(query);
        const matchSubCategory = (group.subCategory || '').toLowerCase().includes(query);
        const matchSupplier = group.alternateOffers.some(o => o.supplierName.toLowerCase().includes(query)) ||
          (group.defaultOffer && group.defaultOffer.supplierName.toLowerCase().includes(query));

        if (!matchName && !matchSku && !matchPool && !matchCatalog && !matchType && !matchCategory && !matchSubCategory && !matchSupplier) return false;
      }

      return true;
    });
  }, [comparisonGroups, compareOnlyMatches, selectedPool, selectedCatalog, selectedItemType, selectedCategory, selectedSubCategory, searchTerm]);

  // Total active count based on current view
  const activeTotalCount = viewMode === 'COMPARE' ? filteredComparisonGroups.length : filteredRows.length;
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(activeTotalCount / pageSize));

  // Paginated slices (25 items at a time)
  const paginatedRows = useMemo(() => {
    if (pageSize === -1) return filteredRows;
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const paginatedComparisonGroups = useMemo(() => {
    if (pageSize === -1) return filteredComparisonGroups;
    const start = (currentPage - 1) * pageSize;
    return filteredComparisonGroups.slice(start, start + pageSize);
  }, [filteredComparisonGroups, currentPage, pageSize]);

  // Expansion helpers for Compare Table
  const toggleExpandGroup = (key: string) => {
    setExpandedGroupKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allExpanded = paginatedComparisonGroups.length > 0 && paginatedComparisonGroups.every(g => expandedGroupKeys.has(g.key));

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedGroupKeys(new Set());
    } else {
      setExpandedGroupKeys(new Set(paginatedComparisonGroups.map(g => g.key)));
    }
  };

  // Handles clicking Order: redirects to /create and translates the item & supplier directly into the order cart
  const handleOrder = (row: DirectoryRow | SupplierOffer) => {
    const isDefault = row.isDefault;
    const supplierId = row.supplierId;
    const itemId = 'itemId' in row ? row.itemId : '';
    const internalSku = 'internalSku' in row ? row.internalSku : '';
    const supplierSku = row.supplierSku;
    const reasonParam = !isDefault ? '&reason=' + encodeURIComponent('Alternate supplier selected via stock directory') : '';

    navigate(
      `/create?supplierId=${supplierId}&addItemId=${itemId}&addSku=${encodeURIComponent(internalSku || supplierSku)}&supplierSku=${encodeURIComponent(supplierSku)}&qty=1${reasonParam}`
    );
  };

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

  if (isLoadingData && items.length === 0 && stockSnapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <p className="text-sm font-semibold text-slate-500">Loading supplier stock directory...</p>
      </div>
    );
  }

  const startRecord = activeTotalCount === 0 ? 0 : (currentPage - 1) * (pageSize === -1 ? activeTotalCount : pageSize) + 1;
  const endRecord = pageSize === -1 ? activeTotalCount : Math.min(currentPage * pageSize, activeTotalCount);

  return (
    <div className="space-y-4 animate-fade-in p-4 md:p-6 w-full max-w-full">
      {/* Page Header with Direct, Crisp Subtitle */}
      <PageHeader
        title="Supplier Stock Directory"
        subtitle="Supplier inventory directory"
      />

      {/* Filter and Control Bar */}
      <div className="bg-white dark:bg-nocturne rounded-2xl p-4 border border-default shadow-sm space-y-3">
        {/* Top Controls: Search, Compare Prices Toggle, Table / Grid Toggle */}
        <div className="flex flex-col lg:flex-row gap-3 justify-between items-center">
          {/* Universal Search */}
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
            <input
              type="text"
              placeholder="Search product, SKU, supplier..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 rounded-xl pl-10 pr-9 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end flex-wrap">
            {/* Compare Prices Dedicated Standalone Toggle Button */}
            <button
              type="button"
              onClick={() => setViewMode(prev => prev === 'COMPARE' ? 'TABLE' : 'COMPARE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border shadow-sm ${
                viewMode === 'COMPARE'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20'
                  : 'bg-white dark:bg-[#15171e] border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600'
              }`}
              title="Toggle side-by-side supplier price comparison"
            >
              <Scale size={15} className={viewMode === 'COMPARE' ? 'text-white' : 'text-blue-600'} />
              <span>Compare Prices</span>
              {viewMode === 'COMPARE' && (
                <span className="w-1.5 h-1.5 rounded-full bg-white ml-0.5 animate-pulse" />
              )}
            </button>

            {/* Table & Grid Paired Segmented Control */}
            <div className="flex border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-gray-100 dark:bg-[#15171e] p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('TABLE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'TABLE' ? 'bg-white dark:bg-nocturne text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
                }`}
                title="Directory table view"
              >
                <List size={15} />
                <span>Table</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('GRID')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'GRID' ? 'bg-white dark:bg-nocturne text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
                }`}
                title="Grid cards view"
              >
                <LayoutGrid size={15} />
                <span>Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* 5-Tier Classification Hierarchy Dropdowns + Contextual Controls */}
        <div className="pt-2 border-t border-default flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-secondary mr-1 shrink-0">
            <Filter size={12} />
            <span>Hierarchy:</span>
          </div>

          {/* 1. Pool Filter (Admin Tier: POOL) */}
          <select
            value={selectedPool}
            onChange={e => handlePoolChange(e.target.value)}
            className="bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            title="Filter by Pool (Admin Tier 1)"
          >
            <option value="ALL">All Pools</option>
            {availablePools.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* 2. Catalogue Filter (Admin Tier: CATALOG) */}
          <select
            value={selectedCatalog}
            onChange={e => handleCatalogChange(e.target.value)}
            className="bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            title="Filter by Catalogue (Admin Tier 2)"
          >
            <option value="ALL">All Catalogues</option>
            {availableCatalogs.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* 3. Item Type Filter (Admin Tier: TYPE) */}
          <select
            value={selectedItemType}
            onChange={e => handleItemTypeChange(e.target.value)}
            className="bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            title="Filter by Item Type (Admin Tier 3)"
          >
            <option value="ALL">All Item Types</option>
            {availableItemTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* 4. Category Filter (Admin Tier: CATEGORY) */}
          <select
            value={selectedCategory}
            onChange={e => handleCategoryChange(e.target.value)}
            className="bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            title="Filter by Category (Admin Tier 4)"
          >
            <option value="ALL">All Categories</option>
            {availableCategories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* 5. Sub-category Filter (Admin Tier: SUB_CATEGORY) */}
          <select
            value={selectedSubCategory}
            onChange={e => handleSubCategoryChange(e.target.value)}
            className="bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            title="Filter by Sub-category (Admin Tier 5)"
          >
            <option value="ALL">All Sub-categories</option>
            {availableSubCategories.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Stock Status Filter (for Table/Grid) */}
          {viewMode !== 'COMPARE' && (
            <select
              value={stockStatusFilter}
              onChange={e => setStockStatusFilter(e.target.value as any)}
              className="bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">All Stock Levels</option>
              <option value="IN_STOCK">In Stock (&gt;0)</option>
              <option value="LOW_STOCK">Low Stock (&lt;50)</option>
              <option value="PRESSURE">Reservation Pressure</option>
              <option value="OUT_OF_STOCK">Out of Stock (0)</option>
            </select>
          )}

          {/* Comparison Genuine Match Toggle (when in Compare Mode) */}
          {viewMode === 'COMPARE' && (
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 rounded-xl px-2.5 py-1.5">
              <input
                type="checkbox"
                checked={compareOnlyMatches}
                onChange={e => setCompareOnlyMatches(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Genuine matches only (2+ suppliers)</span>
            </label>
          )}

          {/* Clear Filters Reset Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-bold px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer ml-auto"
              title="Reset all search and hierarchy filters"
            >
              <RotateCcw size={12} />
              <span>Clear Filters</span>
            </button>
          )}
        </div>

        {/* Supplier Selector Pills (for Table and Grid views) */}
        {viewMode !== 'COMPARE' && (
          <div className="pt-2 border-t border-default flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
            <span className="text-[10px] font-bold uppercase tracking-wider text-secondary mr-1 shrink-0">Supplier:</span>
            <button
              type="button"
              onClick={() => setSelectedSupplierId('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedSupplierId === 'ALL'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-gray-100 dark:bg-surface text-secondary hover:text-primary hover:bg-gray-200'
              }`}
            >
              All ({directoryRows.length})
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? isDefault
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-blue-600 text-white shadow-sm'
                      : isDefault
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100'
                      : 'bg-gray-100 dark:bg-surface text-secondary hover:text-primary hover:bg-gray-200'
                  }`}
                >
                  {isDefault && <CheckCircle2 size={12} className={isSelected ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'} />}
                  <span>{s.name}</span>
                  {isDefault && <span className="text-[9px] uppercase tracking-wider font-extrabold px-1 rounded bg-black/10">Default</span>}
                  <span className="opacity-70 text-[10px]">({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Results Container */}
      <div className="bg-white dark:bg-nocturne rounded-2xl border border-default shadow-sm overflow-hidden">
        {/* Header Bar */}
        <div className="p-3.5 px-5 border-b border-default flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50/50 dark:bg-surface/50">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-primary dark:text-white text-xs sm:text-sm">
              {viewMode === 'COMPARE' ? 'Supplier Price & Stock Comparison' : 'Available Supplier Stock Catalog'}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40">
              {activeTotalCount} items
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-secondary">
            <span>
              Showing {startRecord}–{endRecord} of {activeTotalCount}
            </span>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-tertiary">Per page:</span>
              {[25, 50, 100].map(sz => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setPageSize(sz)}
                  className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                    pageSize === sz ? 'bg-blue-600 text-white' : 'text-secondary hover:text-primary'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 1. TABLE VIEW: Fits neatly across all columns with NO side scrolling */}
        {viewMode === 'TABLE' && (
          <div className="w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-gray-50 dark:bg-surface text-secondary uppercase font-bold text-[10px] tracking-wider border-b border-default">
                <tr>
                  <th className="px-3.5 py-3 w-[26%]">Product & Internal SKU</th>
                  <th className="px-3 py-3 w-[18%]">Supplier & Code</th>
                  <th className="px-3 py-3 text-right w-[9%]">Unit Price</th>
                  <th className="px-2 py-3 text-center w-[8%]">Baseline</th>
                  <th className="px-2 py-3 text-center w-[8%]">Holds</th>
                  <th className="px-2 py-3 text-center w-[7%]">Delivery</th>
                  <th className="px-3 py-3 text-right font-black w-[10%]">Net Orderable</th>
                  <th className="px-2 py-3 text-center w-[7%]">Health</th>
                  <th className="px-3 py-3 text-right w-[7%]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default font-medium">
                {paginatedRows.length > 0 ? (
                  paginatedRows.map(row => (
                    <tr key={row.key} className="hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors">
                      {/* Product & SKU */}
                      <td className="px-3.5 py-2.5">
                        <div className="font-bold text-primary dark:text-white text-xs leading-snug line-clamp-2" title={row.itemName}>
                          {row.itemName}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-tertiary mt-0.5 flex-wrap">
                          <span className="font-mono font-semibold">SKU: {row.internalSku}</span>
                          {getItemTaxonomyBadges(row).map(badge => (
                            <React.Fragment key={badge}>
                              <span>·</span>
                              <span className="px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium">
                                {badge}
                              </span>
                            </React.Fragment>
                          ))}
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-primary dark:text-white text-xs truncate max-w-[130px]">{row.supplierName}</span>
                          {row.isDefault ? (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                              Default
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
                              Alt
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-tertiary font-mono mt-0.5 truncate">
                          Code: {row.supplierSku}
                        </div>
                      </td>

                      {/* Unit Price */}
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-primary dark:text-white text-xs">
                        {formatCurrency(row.unitPrice)}
                      </td>

                      {/* Baseline SOH */}
                      <td className="px-2 py-2.5 text-center font-mono text-secondary text-xs">
                        {row.breakdown.baseAvailableUnits.toLocaleString()}
                      </td>

                      {/* Active Holds */}
                      <td className="px-2 py-2.5 text-center font-mono text-xs">
                        {row.breakdown.reservedUnits > 0 ? (
                          <span className="font-bold text-blue-600 dark:text-blue-400">-{row.breakdown.reservedUnits.toLocaleString()}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>

                      {/* In Delivery */}
                      <td className="px-2 py-2.5 text-center font-mono text-xs">
                        {row.breakdown.committedUnits > 0 ? (
                          <span className="font-bold text-amber-600 dark:text-amber-400">-{row.breakdown.committedUnits.toLocaleString()}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>

                      {/* Net Orderable */}
                      <td className="px-3 py-2.5 text-right font-mono font-extrabold text-xs">
                        <span className={row.breakdown.availableOrderQty > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          {row.breakdown.availableOrderQty.toLocaleString()}
                        </span>
                        <div className="text-[9px] text-tertiary font-normal">
                          Pack: {row.packMultiple}
                        </div>
                      </td>

                      {/* Stock Health */}
                      <td className="px-2 py-2.5 text-center">
                        {row.stockStatus === 'IN_STOCK' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                            In Stock
                          </span>
                        )}
                        {row.stockStatus === 'RESERVED_PRESSURE' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
                            High Holds
                          </span>
                        )}
                        {row.stockStatus === 'LOW_STOCK' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-300">
                            Low Stock
                          </span>
                        )}
                        {row.stockStatus === 'OUT_OF_STOCK' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300">
                            Out
                          </span>
                        )}
                      </td>

                      {/* Single Action: Order Button (Translates to request screen with pre-filled item) */}
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOrder(row)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white font-bold text-xs shadow-sm transition-all cursor-pointer ml-auto ${
                            row.isDefault
                              ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                              : 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                          }`}
                          title={row.isDefault ? 'Order this item with NCC' : 'Order this item with alternate supplier'}
                        >
                          <ShoppingCart size={13} />
                          <span>Order</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-secondary">
                      No products match your search or filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. COMPARE PRICES VIEW: Collapsible Table View */}
        {viewMode === 'COMPARE' && (
          <div className="w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-gray-50 dark:bg-surface text-secondary uppercase font-bold text-[10px] tracking-wider border-b border-default">
                <tr>
                  <th className="px-3.5 py-3 w-[36%]">Product & Internal SKU</th>
                  <th className="px-3 py-3 w-[16%]">NCC Preferred (Default)</th>
                  <th className="px-3 py-3 w-[18%]">Lowest Market Offer</th>
                  <th className="px-3 py-3 text-center w-[16%]">Pricing Variance</th>
                  <th className="px-3 py-3 text-right w-[14%]">
                    <button
                      type="button"
                      onClick={toggleExpandAll}
                      className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                    >
                      {allExpanded ? (
                        <>
                          <ChevronUp size={13} />
                          <span>Collapse All</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown size={13} />
                          <span>Expand All</span>
                        </>
                      )}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default font-medium">
                {paginatedComparisonGroups.length > 0 ? (
                  paginatedComparisonGroups.map(group => {
                    const isExpanded = expandedGroupKeys.has(group.key);
                    const defaultPrice = group.defaultOffer?.unitPrice ?? 0;
                    const hasDefault = !!group.defaultOffer;
                    const minPrice = group.minPrice;
                    const priceDiff = hasDefault && minPrice > 0 ? defaultPrice - minPrice : 0;
                    const pctDiff = hasDefault && defaultPrice > 0 ? (priceDiff / defaultPrice) * 100 : 0;
                    const isCheaper = priceDiff > 0.001;
                    const isMoreExpensive = priceDiff < -0.001;

                    const allOffers = [
                      ...(group.defaultOffer ? [group.defaultOffer] : []),
                      ...group.alternateOffers
                    ];

                    const badges = getItemTaxonomyBadges(group);

                    return (
                      <React.Fragment key={group.key}>
                        {/* Parent Item Row */}
                        <tr
                          onClick={() => toggleExpandGroup(group.key)}
                          className={`cursor-pointer transition-colors ${
                            isExpanded
                              ? 'bg-blue-50/40 dark:bg-blue-950/20'
                              : 'hover:bg-gray-50/80 dark:hover:bg-white/5'
                          }`}
                        >
                          {/* Product & SKU */}
                          <td className="px-3.5 py-3">
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  toggleExpandGroup(group.key);
                                }}
                                className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-gray-200 dark:hover:bg-white/10 transition-colors mt-0.5 shrink-0 cursor-pointer"
                                aria-label={isExpanded ? 'Collapse suppliers' : 'Expand suppliers'}
                              >
                                {isExpanded ? <ChevronDown size={16} className="text-blue-600" /> : <ChevronRight size={16} />}
                              </button>
                              <div className="min-w-0">
                                <div className="font-bold text-primary dark:text-white text-xs leading-snug line-clamp-2">
                                  {group.itemName}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-tertiary mt-1 flex-wrap">
                                  <span className="font-mono font-semibold">SKU: {group.internalSku}</span>
                                  {badges.map(b => (
                                    <React.Fragment key={b}>
                                      <span>·</span>
                                      <span className="px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium">
                                        {b}
                                      </span>
                                    </React.Fragment>
                                  ))}
                                  <span>·</span>
                                  {group.hasMatch ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-extrabold text-[9px] bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300">
                                      <Scale size={10} /> {group.totalOffers} Suppliers
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-gray-100 text-gray-700 dark:bg-surface dark:text-gray-300">
                                      1 Supplier
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* NCC Preferred Price */}
                          <td className="px-3 py-3">
                            {group.defaultOffer ? (
                              <div>
                                <div className="font-mono font-bold text-primary dark:text-white text-xs">
                                  {formatCurrency(group.defaultOffer.unitPrice)}
                                </div>
                                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">
                                  {group.defaultOffer.availableStock.toLocaleString()} units avail.
                                </div>
                              </div>
                            ) : (
                              <span className="text-secondary italic text-[11px]">Not supplied by NCC</span>
                            )}
                          </td>

                          {/* Lowest Market Offer */}
                          <td className="px-3 py-3">
                            {minPrice > 0 ? (
                              <div>
                                <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs">
                                  {formatCurrency(minPrice)}
                                </div>
                                <div className="text-[10px] text-tertiary truncate max-w-[150px] mt-0.5">
                                  via {group.cheapestSupplierName}
                                </div>
                              </div>
                            ) : (
                              <span className="text-secondary">—</span>
                            )}
                          </td>

                          {/* Pricing Variance */}
                          <td className="px-3 py-3 text-center">
                            {hasDefault && group.hasMatch ? (
                              isCheaper ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                                  <TrendingDown size={11} /> Save {formatCurrency(priceDiff)} ({pctDiff.toFixed(1)}%)
                                </span>
                              ) : isMoreExpensive ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300">
                                  <TrendingUp size={11} /> +{formatCurrency(Math.abs(priceDiff))}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-secondary border border-gray-200 dark:border-gray-800">
                                  $0.00 Parity
                                </span>
                              )
                            ) : (
                              <span className="text-secondary text-[11px]">—</span>
                            )}
                          </td>

                          {/* Action: Expand Toggle / View Offers */}
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                toggleExpandGroup(group.key);
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                isExpanded
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 hover:bg-blue-100'
                              }`}
                            >
                              <span>{isExpanded ? 'Hide' : 'View Offers'}</span>
                              <span className="px-1 py-0.2 rounded-full bg-black/10 text-[10px]">
                                {group.totalOffers}
                              </span>
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          </td>
                        </tr>

                        {/* Collapsible Child Row: Nested Supplier Breakdown */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 dark:bg-white/[0.02]">
                            <td colSpan={5} className="p-0 border-b border-default">
                              <div className="p-3 pl-8 sm:pl-10 space-y-2 border-l-4 border-blue-500 bg-blue-50/20 dark:bg-blue-950/10">
                                <div className="flex items-center justify-between text-[11px] font-bold text-secondary uppercase tracking-wider">
                                  <span>Supplier Price & Stock Breakdown</span>
                                  <span className="text-[10px] text-tertiary font-normal">
                                    Click Order to load into requisition with pre-filled supplier & item
                                  </span>
                                </div>

                                <table className="w-full text-left border-collapse text-xs bg-white dark:bg-nocturne rounded-xl border border-default overflow-hidden shadow-sm">
                                  <thead className="bg-gray-100 dark:bg-surface text-secondary uppercase font-bold text-[9px] tracking-wider border-b border-default">
                                    <tr>
                                      <th className="px-3 py-2 w-[28%]">Supplier</th>
                                      <th className="px-2.5 py-2 w-[16%]">Supplier Code</th>
                                      <th className="px-3 py-2 text-right w-[14%]">Unit Price</th>
                                      <th className="px-3 py-2 text-center w-[16%]">vs NCC Default</th>
                                      <th className="px-3 py-2 text-right w-[14%]">Net Orderable</th>
                                      <th className="px-3 py-2 text-right w-[12%]">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-default font-medium">
                                    {allOffers.map(offer => {
                                      const isDefault = offer.isDefault;
                                      const delta = defaultPrice > 0 ? offer.unitPrice - defaultPrice : 0;
                                      const pct = defaultPrice > 0 ? (delta / defaultPrice) * 100 : 0;
                                      const isBestPrice = offer.unitPrice === minPrice && group.hasMatch && minPrice > 0;

                                      return (
                                        <tr
                                          key={offer.supplierId}
                                          className={`hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors ${
                                            isDefault ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''
                                          }`}
                                        >
                                          {/* Supplier */}
                                          <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-bold text-primary dark:text-white text-xs truncate max-w-[160px]">
                                                {offer.supplierName}
                                              </span>
                                              {isDefault ? (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                                                  <CheckCircle2 size={10} /> Default
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
                                                  Alternate
                                                </span>
                                              )}
                                            </div>
                                          </td>

                                          {/* Code */}
                                          <td className="px-2.5 py-2.5 font-mono text-[11px] text-tertiary">
                                            {offer.supplierSku}
                                          </td>

                                          {/* Unit Price */}
                                          <td className="px-3 py-2.5 text-right">
                                            <div className="font-mono font-bold text-primary dark:text-white text-xs">
                                              {offer.unitPrice > 0 ? formatCurrency(offer.unitPrice) : 'Quote on Req.'}
                                              {isBestPrice && (
                                                <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                  Lowest
                                                </span>
                                              )}
                                            </div>
                                          </td>

                                          {/* vs NCC Default */}
                                          <td className="px-3 py-2.5 text-center">
                                            {isDefault ? (
                                              <span className="text-secondary font-mono text-[11px]">— (Baseline)</span>
                                            ) : defaultPrice > 0 ? (
                                              delta < -0.001 ? (
                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center gap-1 text-[11px]">
                                                  <TrendingDown size={12} /> -{formatCurrency(Math.abs(delta))} ({Math.abs(pct).toFixed(1)}% cheaper)
                                                </span>
                                              ) : delta > 0.001 ? (
                                                <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center justify-center gap-1 text-[11px]">
                                                  <TrendingUp size={12} /> +{formatCurrency(delta)} (+{pct.toFixed(1)}%)
                                                </span>
                                              ) : (
                                                <span className="text-secondary text-[11px]">$0.00 Parity</span>
                                              )
                                            ) : (
                                              <span className="text-tertiary text-[11px]">—</span>
                                            )}
                                          </td>

                                          {/* Net Orderable */}
                                          <td className="px-3 py-2.5 text-right font-mono font-bold text-xs">
                                            <span className={offer.availableStock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                              {offer.availableStock.toLocaleString()}
                                            </span>
                                            <span className="text-[10px] text-tertiary font-normal ml-1">units</span>
                                          </td>

                                          {/* Action */}
                                          <td className="px-3 py-2.5 text-right">
                                            <button
                                              type="button"
                                              onClick={() => handleOrder(offer)}
                                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-white font-bold text-xs shadow-sm transition-all cursor-pointer ml-auto ${
                                                isDefault
                                                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                                                  : 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                                              }`}
                                              title={isDefault ? 'Order with NCC Apparel' : `Order with alternate supplier ${offer.supplierName}`}
                                            >
                                              <ShoppingCart size={12} />
                                              <span>{isDefault ? 'Order NCC' : 'Order Alt'}</span>
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-secondary">
                      No matched items found for the current search or filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. GRID CARDS VIEW */}
        {viewMode === 'GRID' && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedRows.length > 0 ? (
              paginatedRows.map(row => (
                <div
                  key={row.key}
                  className="bg-white dark:bg-surface border border-default rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        {getItemTaxonomyBadges(row).map(b => (
                          <span key={b} className="text-[10px] font-bold text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40">
                            {b}
                          </span>
                        ))}
                      </div>
                      {row.isDefault ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                          NCC (Default)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
                          Alternate
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-primary dark:text-white text-xs leading-snug line-clamp-2" title={row.itemName}>
                      {row.itemName}
                    </h4>
                    <p className="text-[10px] text-tertiary font-mono mt-0.5">
                      SKU: {row.internalSku} · Code: {row.supplierSku}
                    </p>
                    <p className="text-xs text-secondary mt-1 font-semibold">{row.supplierName}</p>

                    <div className="mt-3 pt-3 border-t border-default flex items-baseline justify-between">
                      <span className="text-xs text-secondary">Unit Price:</span>
                      <span className="text-sm font-black font-mono text-primary dark:text-white">
                        {formatCurrency(row.unitPrice)}
                      </span>
                    </div>

                    <div className="mt-1 pt-1 border-t border-default flex items-baseline justify-between text-xs">
                      <span className="text-secondary">Net Orderable:</span>
                      <span className={`font-mono font-extrabold ${row.breakdown.availableOrderQty > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {row.breakdown.availableOrderQty.toLocaleString()} units
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-default">
                    <button
                      type="button"
                      onClick={() => handleOrder(row)}
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs text-white shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        row.isDefault ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'
                      }`}
                    >
                      <ShoppingCart size={13} />
                      <span>Order</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-secondary text-xs">
                No products match your search or filter criteria.
              </div>
            )}
          </div>
        )}

        {/* Pagination & "Show Next 25" Footer Controls */}
        <div className="p-3.5 px-5 border-t border-default bg-gray-50/50 dark:bg-surface/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-secondary font-medium">
            Showing <span className="font-bold text-primary dark:text-white">{startRecord}–{endRecord}</span> of <span className="font-bold text-primary dark:text-white">{activeTotalCount}</span> items
          </div>

          {/* Show Next 25 Quick Button */}
          {currentPage < totalPages && (
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-bold border border-blue-200 dark:border-blue-800/40 transition-all cursor-pointer shadow-sm"
            >
              <span>Show Next 25</span>
              <ChevronRight size={14} />
            </button>
          )}

          {/* Page Navigation */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="p-1.5 rounded-lg border border-default text-secondary hover:text-primary hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="text-xs font-bold text-secondary px-2">
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="p-1.5 rounded-lg border border-default text-secondary hover:text-primary hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Contact Ash Modal */}
      {selectedItemForRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-nocturne rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-default space-y-4">
            <div className="flex items-start justify-between border-b border-default pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Mail size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-primary dark:text-white">
                    Request Alternate Supplier Authorization
                  </h3>
                  <p className="text-[11px] text-tertiary">Direct request to Ashish Chhabra (Procurement Manager)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemForRequest(null)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-surface rounded-xl border border-default text-xs space-y-1">
              <div className="font-bold text-primary dark:text-white">{selectedItemForRequest.itemName}</div>
              <div className="text-tertiary font-mono text-[11px]">
                SKU: {selectedItemForRequest.internalSku} · Supplier: {selectedItemForRequest.supplierName}
              </div>
              <div className="text-secondary flex items-center gap-3 pt-1">
                <span>Unit Price: <b>{formatCurrency(selectedItemForRequest.unitPrice)}</b></span>
                <span>Stock: <b>{selectedItemForRequest.breakdown.availableOrderQty} units</b></span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-secondary uppercase mb-1">Destination Site</label>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-secondary uppercase mb-1">Quantity Needed</label>
                  <input
                    type="number"
                    value={requestQty}
                    onChange={e => setRequestQty(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-surface border border-default rounded-xl p-2.5 text-xs text-primary dark:text-white font-medium"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-secondary uppercase mb-1">Reason for Alternate</label>
                  <select
                    value={requestReason}
                    onChange={e => setRequestReason(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-surface border border-default rounded-xl p-2.5 text-xs text-primary dark:text-white font-medium"
                  >
                    <option value="NCC Stockout / Unavailable">NCC Stockout / Unavailable</option>
                    <option value="Urgent Delivery Lead Time">Urgent Delivery Lead Time</option>
                    <option value="Customer Mandated Requirement">Customer Mandated Requirement</option>
                    <option value="Specialised Technical Specification">Specialised Technical Specification</option>
                    <option value="Other Business Justification">Other Business Justification</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-secondary uppercase mb-1">Additional Justification</label>
                <textarea
                  value={requestNotes}
                  onChange={e => setRequestNotes(e.target.value)}
                  placeholder="Provide context on why this alternate supplier is needed..."
                  className="w-full bg-gray-50 dark:bg-surface border border-default rounded-xl p-2.5 text-xs text-primary dark:text-white font-medium resize-none h-18"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-default gap-3">
              <button
                type="button"
                onClick={() => setSelectedItemForRequest(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-secondary hover:text-primary transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSendEmailToAsh}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Send size={13} />
                <span>Send Email to Ash</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierStockDirectory;
