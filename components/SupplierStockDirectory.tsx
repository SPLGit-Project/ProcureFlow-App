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
  LayoutGrid,
  List,
  Scale,
  Check,
  TrendingDown,
  TrendingUp,
  PackageCheck
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
  category: string;
  itemType: string;
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
  category: string;
  itemType: string;
  defaultOffer?: SupplierOffer;
  alternateOffers: SupplierOffer[];
  totalOffers: number;
  hasMatch: boolean;
  minPrice: number;
  maxPrice: number;
  cheapestSupplierName: string;
}

/**
 * Resolves itemType and category directly leveraging Admin Classification Tiers:
 * Tier 3: Item Types (type === 'TYPE' in attribute_options)
 * Tier 4: Categories (type === 'CATEGORY' in attribute_options)
 * Uses MASTER_HIERARCHY and standardized procurement definitions for unclassified items.
 */
export function resolveItemClassification(
  itemOrSnap: {
    category?: string;
    itemType?: string;
    itemCatalog?: string;
    name?: string;
    productName?: string;
  },
  attributeOptions?: AttributeOption[]
): { itemType: string; category: string } {
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

  // 1. Resolve Category (Admin Tier: Categories)
  let resolvedCat = (itemOrSnap.category || '').trim();
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

  // 2. Resolve Item Type (Admin Tier: Item Types)
  let resolvedType = (itemOrSnap.itemType || '').trim();
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

  return {
    itemType: resolvedType,
    category: resolvedCat
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

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('ALL');
  const [selectedItemType, setSelectedItemType] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'PRESSURE' | 'OUT_OF_STOCK'>('ALL');
  const [viewMode, setViewMode] = useState<'TABLE' | 'COMPARE' | 'GRID'>('TABLE');
  const [compareOnlyMatches, setCompareOnlyMatches] = useState<boolean>(true);

  // Pagination state (displays 25 items at a time by default)
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset pagination when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSupplierId, selectedItemType, selectedCategory, stockStatusFilter, viewMode, compareOnlyMatches, pageSize]);

  // Contact Ash modal state
  const [selectedItemForRequest, setSelectedItemForRequest] = useState<DirectoryRow | null>(null);
  const [requestSiteId, setRequestSiteId] = useState(userSites[0]?.id || '');
  const [requestQty, setRequestQty] = useState('50');
  const [requestReason, setRequestReason] = useState('NCC Stockout / Unavailable');
  const [requestNotes, setRequestNotes] = useState('');
  const [isCopiedEmail, setIsCopiedEmail] = useState(false);

  // Build directory rows with clean category and distinct itemType
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

        const { itemType, category } = resolveItemClassification(item, attributeOptions);

        rows.push({
          key: rowKey,
          itemId: item.id,
          itemName: item.name,
          internalSku: item.sku || '-',
          supplierId: supId,
          supplierName: supplier.name,
          isDefault,
          supplierSku,
          category,
          itemType,
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

      const { itemType, category } = resolveItemClassification({
        category: snap.category,
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
        category,
        itemType,
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

  // 1. Available Master Categories (Admin Classification Tier: Item Types)
  const availableItemTypes = useMemo(() => {
    const set = new Set<string>();

    // Seed with configured active TYPE options from Admin Classification Tiers
    (attributeOptions || [])
      .filter(o => o.type === 'TYPE' && o.activeFlag !== false)
      .forEach(o => {
        if (o.value && o.value.trim()) set.add(o.value.trim());
      });

    // Also include any itemType present in the active directory rows
    directoryRows.forEach(r => {
      if (r.itemType && r.itemType.trim()) set.add(r.itemType.trim());
    });

    return Array.from(set).filter(Boolean).sort();
  }, [attributeOptions, directoryRows]);

  // 2. Available Items (Admin Classification Tier: Categories) - dynamically scoped when a Category (Item Type) is selected
  const availableCategories = useMemo(() => {
    const set = new Set<string>();

    if (selectedItemType === 'ALL') {
      // Seed with configured active CATEGORY options from Admin Classification Tiers
      (attributeOptions || [])
        .filter(o => o.type === 'CATEGORY' && o.activeFlag !== false)
        .forEach(o => {
          if (o.value && o.value.trim()) set.add(o.value.trim());
        });

      // Also include any category present in directory rows
      directoryRows.forEach(r => {
        if (r.category && r.category.trim()) set.add(r.category.trim());
      });
    } else {
      // Scoped: rows matching the selected Category (Item Type)
      directoryRows.forEach(r => {
        if (r.itemType === selectedItemType && r.category && r.category.trim()) {
          set.add(r.category.trim());
        }
      });

      // Also include CATEGORY options from Admin whose parent matches the selected Item Type
      const selectedTypeOpt = (attributeOptions || []).find(o => o.type === 'TYPE' && o.value === selectedItemType);
      if (selectedTypeOpt) {
        (attributeOptions || [])
          .filter(o => o.type === 'CATEGORY' && o.activeFlag !== false && (o.parentId === selectedTypeOpt.id || o.parentIds?.includes(selectedTypeOpt.id)))
          .forEach(o => {
            if (o.value && o.value.trim()) set.add(o.value.trim());
          });
      }
    }

    return Array.from(set).filter(Boolean).sort();
  }, [attributeOptions, directoryRows, selectedItemType]);

  const handleItemTypeChange = (newType: string) => {
    setSelectedItemType(newType);
    setSelectedCategory('ALL');
  };

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
          category: row.category,
          itemType: row.itemType,
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

  // Filtered rows for Table and Grid view
  const filteredRows = useMemo(() => {
    return directoryRows.filter(row => {
      if (selectedSupplierId !== 'ALL' && row.supplierId !== selectedSupplierId) return false;
      if (selectedCategory !== 'ALL' && row.category !== selectedCategory) return false;
      if (selectedItemType !== 'ALL' && row.itemType !== selectedItemType) return false;

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
        const matchesItemType = row.itemType.toLowerCase().includes(query);
        if (!matchesName && !matchesInternalSku && !matchesSupplierSku && !matchesSupplierName && !matchesCategory && !matchesItemType) {
          return false;
        }
      }

      return true;
    });
  }, [directoryRows, selectedSupplierId, selectedCategory, selectedItemType, stockStatusFilter, searchTerm]);

  // Filtered comparison groups
  const filteredComparisonGroups = useMemo(() => {
    return comparisonGroups.filter(group => {
      if (compareOnlyMatches && !group.hasMatch) return false;
      if (selectedCategory !== 'ALL' && group.category !== selectedCategory) return false;
      if (selectedItemType !== 'ALL' && group.itemType !== selectedItemType) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchName = group.itemName.toLowerCase().includes(query);
        const matchSku = group.internalSku.toLowerCase().includes(query);
        const matchCategory = group.category.toLowerCase().includes(query);
        const matchItemType = group.itemType.toLowerCase().includes(query);
        const matchSupplier = group.alternateOffers.some(o => o.supplierName.toLowerCase().includes(query)) ||
          (group.defaultOffer && group.defaultOffer.supplierName.toLowerCase().includes(query));
        if (!matchName && !matchSku && !matchCategory && !matchItemType && !matchSupplier) return false;
      }

      return true;
    });
  }, [comparisonGroups, compareOnlyMatches, selectedCategory, selectedItemType, searchTerm]);

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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end flex-wrap">
            {/* 1. Master Category Filter (Admin Classification Tier: Item Types) */}
            <select
              value={selectedItemType}
              onChange={e => handleItemTypeChange(e.target.value)}
              className="bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              title="Filter by master category (Admin Tier: Item Types)"
            >
              <option value="ALL">All Categories</option>
              {availableItemTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* 2. Specific Item Filter (Admin Classification Tier: Categories) */}
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              title="Filter by item classification (Admin Tier: Categories)"
            >
              <option value="ALL">All Items</option>
              {availableCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Stock Status Filter (for Table/Grid) */}
            {viewMode !== 'COMPARE' && (
              <select
                value={stockStatusFilter}
                onChange={e => setStockStatusFilter(e.target.value as any)}
                className="bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ALL">All Stock Levels</option>
                <option value="IN_STOCK">In Stock (&gt;0)</option>
                <option value="LOW_STOCK">Low Stock (&lt;50)</option>
                <option value="PRESSURE">Reservation Pressure</option>
                <option value="OUT_OF_STOCK">Out of Stock (0)</option>
              </select>
            )}

            {/* Comparison Match Toggle (when in Compare Mode) */}
            {viewMode === 'COMPARE' && (
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2">
                <input
                  type="checkbox"
                  checked={compareOnlyMatches}
                  onChange={e => setCompareOnlyMatches(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Only genuine matches (2+ suppliers)</span>
              </label>
            )}

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
                          {row.itemType && (
                            <>
                              <span>·</span>
                              <span className="px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium">{row.itemType}</span>
                            </>
                          )}
                          {row.category && (
                            <>
                              <span>·</span>
                              <span className="px-1.5 py-0.2 rounded bg-gray-100 dark:bg-surface text-secondary font-medium">{row.category}</span>
                            </>
                          )}
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

        {/* 2. COMPARE PRICES VIEW: Genuine Side-by-Side Supplier Matching */}
        {viewMode === 'COMPARE' && (
          <div className="divide-y divide-default">
            {paginatedComparisonGroups.length > 0 ? (
              paginatedComparisonGroups.map(group => {
                const defaultPrice = group.defaultOffer?.unitPrice ?? 0;
                return (
                  <div key={group.key} className="p-4 hover:bg-gray-50/60 dark:hover:bg-white/5 transition-colors">
                    {/* Item Heading */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-primary dark:text-white text-sm">
                            {group.itemName}
                          </h4>
                          {group.hasMatch ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300">
                              <Scale size={11} /> {group.totalOffers} Suppliers Matched
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 dark:bg-surface dark:text-gray-300">
                              Single Supplier (NCC Only)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-tertiary mt-0.5 flex-wrap">
                          <span className="font-mono">SKU: {group.internalSku}</span>
                          {group.itemType && (
                            <>
                              <span>·</span>
                              <span className="text-blue-600 dark:text-blue-400 font-semibold">{group.itemType}</span>
                            </>
                          )}
                          {group.category && (
                            <>
                              <span>·</span>
                              <span className="text-secondary">{group.category}</span>
                            </>
                          )}
                          {group.hasMatch && group.minPrice > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                Lowest Price: {formatCurrency(group.minPrice)} ({group.cheapestSupplierName})
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Side-by-Side Supplier Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {/* Default Preferred: NCC Apparel */}
                      {group.defaultOffer ? (
                        <div className="p-3.5 rounded-xl border-2 border-emerald-400/80 dark:border-emerald-600/60 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                                {group.defaultOffer.supplierName}
                              </span>
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500 text-white">
                                <Check size={10} /> Default
                              </span>
                            </div>
                            <div className="text-[10px] text-emerald-800/80 dark:text-emerald-300 font-mono mb-2">
                              Code: {group.defaultOffer.supplierSku}
                            </div>
                            <div className="flex items-baseline justify-between py-1 border-t border-emerald-200 dark:border-emerald-800/40">
                              <span className="text-xs text-secondary">Unit Price:</span>
                              <span className="text-sm font-black font-mono text-emerald-900 dark:text-white">
                                {formatCurrency(group.defaultOffer.unitPrice)}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between py-1 border-t border-emerald-200 dark:border-emerald-800/40 text-xs">
                              <span className="text-secondary">Available Stock:</span>
                              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {group.defaultOffer.availableStock.toLocaleString()} units
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 pt-2.5 border-t border-emerald-200 dark:border-emerald-800/40">
                            <button
                              type="button"
                              onClick={() => handleOrder(group.defaultOffer!)}
                              className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <ShoppingCart size={13} /> Order NCC
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-surface/50 text-xs text-tertiary flex items-center justify-center text-center">
                          Not available via NCC Apparel
                        </div>
                      )}

                      {/* Alternate Suppliers */}
                      {group.alternateOffers.map(alt => {
                        const priceDelta = defaultPrice > 0 ? alt.unitPrice - defaultPrice : 0;
                        const percentDelta = defaultPrice > 0 ? ((alt.unitPrice - defaultPrice) / defaultPrice) * 100 : 0;
                        const isCheaper = priceDelta < -0.001;
                        const isMoreExpensive = priceDelta > 0.001;

                        return (
                          <div
                            key={alt.supplierId}
                            className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] shadow-sm flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[150px]">
                                  {alt.supplierName || 'Alternate Supplier'}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                  Alternate
                                </span>
                              </div>
                              <div className="text-[10px] text-tertiary font-mono mb-2">
                                Code: {alt.supplierSku}
                              </div>

                              <div className="flex items-baseline justify-between py-1 border-t border-gray-100 dark:border-gray-800">
                                <span className="text-xs text-secondary">Unit Price:</span>
                                <div className="text-right">
                                  <span className="text-sm font-black font-mono text-gray-900 dark:text-white">
                                    {alt.unitPrice > 0 ? formatCurrency(alt.unitPrice) : 'Quote on Req.'}
                                  </span>
                                  {defaultPrice > 0 && (
                                    <div className="text-[10px] font-bold">
                                      {isCheaper && (
                                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 justify-end">
                                          <TrendingDown size={11} /> {formatCurrency(Math.abs(priceDelta))} ({Math.abs(percentDelta).toFixed(1)}% cheaper)
                                        </span>
                                      )}
                                      {isMoreExpensive && (
                                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-0.5 justify-end">
                                          <TrendingUp size={11} /> +{formatCurrency(priceDelta)} (+{percentDelta.toFixed(1)}%)
                                        </span>
                                      )}
                                      {!isCheaper && !isMoreExpensive && (
                                        <span className="text-secondary">$0.00 Parity</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-baseline justify-between py-1 border-t border-default text-xs">
                                <span className="text-secondary">Available Stock:</span>
                                <span className={`font-mono font-bold ${alt.availableStock > 0 ? 'text-primary dark:text-white' : 'text-rose-500'}`}>
                                  {alt.availableStock.toLocaleString()} units
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-default">
                              <button
                                type="button"
                                onClick={() => handleOrder(alt)}
                                className="w-full py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <ShoppingCart size={13} /> Order Alternate
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-12 text-center text-secondary text-xs">
                No matched items found for the current search or filters.
              </div>
            )}
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
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40">
                          {row.category}
                        </span>
                        {row.itemType && (
                          <span className="text-[10px] font-bold text-tertiary px-2 py-0.5 rounded-full bg-gray-100 dark:bg-nocturne">
                            {row.itemType}
                          </span>
                        )}
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
                    <div className="flex items-center gap-1 text-[10px] text-tertiary mt-1 flex-wrap">
                      {row.itemType && (
                        <span className="px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium">
                          {row.itemType}
                        </span>
                      )}
                      {row.category && (
                        <span className="px-1.5 py-0.2 rounded bg-gray-100 dark:bg-surface text-secondary font-medium">
                          {row.category}
                        </span>
                      )}
                    </div>
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
