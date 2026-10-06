import type { Item, SupplierProductMap, SupplierStockSnapshot } from '../types.ts';
import { canonicalSupplierName } from './suppliers.ts';

const code = (value?: string) => (value || '').trim().toUpperCase();

/** Resolve an actual supplier stock pool, preferring the confirmed supplier SKU. */
export function resolveStockPool(itemId: string, supplierId: string,
  suppliers: Array<{ id: string; name: string }>, mappings: SupplierProductMap[], snapshots: SupplierStockSnapshot[], item?: Pick<Item, 'name' | 'sku'>) {
  const supplier = suppliers.find(s => s.id === supplierId);
  const canonical = supplier ? canonicalSupplierName(supplier.name) : supplierId;
  const ids = new Set(suppliers.filter(s => canonicalSupplierName(s.name) === canonical).map(s => s.id));
  ids.add(supplierId);
  const maps = mappings.filter(m => m.productId === itemId && ids.has(m.supplierId) && m.mappingStatus === 'CONFIRMED')
    .sort((a, b) => Number(b.manualOverride) - Number(a.manualOverride) || (b.matchPriority || 0) - (a.matchPriority || 0) || (a.id || '').localeCompare(b.id));
  const mapping = maps[0];
  const candidates = snapshots.filter(s => ids.has(s.supplierId));
  const exact = mapping ? candidates.filter(s => code(s.supplierSku) === code(mapping.supplierSku)) : [];
  const targets = new Set([mapping?.supplierSku, mapping?.supplierCustomerStockCode, mapping?.internalSku].filter(Boolean).map(code));
  let matches = exact.length ? exact : candidates.filter(s =>
    [s.supplierSku, s.customerStockCode, s.customerStockCodeRaw, s.customerStockCodeNorm].some(c => !!c && targets.has(code(c))));
  const isNcc = canonical.includes('ncc');
  const itemMatches = item ? matches.filter(s => code(s.productName) === code(item.name)) : [];
  if (itemMatches.length) matches = itemMatches;
  const snapshot = matches.sort((a, b) => Date.parse(b.snapshotDate) - Date.parse(a.snapshotDate) ||
    (isNcc ? Number(b.stockType === 'CUSTOM') - Number(a.stockType === 'CUSTOM') : 0) || (a.id || '').localeCompare(b.id))[0];
  const poolSku = snapshot?.sourceSupplierSku || snapshot?.supplierSku || mapping?.supplierSku;
  const poolCustomerCode = code(snapshot?.customerStockCode || snapshot?.customerStockCodeRaw || snapshot?.customerStockCodeNorm);
  const itemIds = new Set([itemId]);
  if (poolSku) mappings.filter(m => ids.has(m.supplierId) && m.mappingStatus === 'CONFIRMED' && (isNcc
    ? !!poolCustomerCode && [m.supplierCustomerStockCode, m.supplierSku, m.internalSku].some(c => code(c) === poolCustomerCode)
    : code(m.supplierSku) === code(snapshot?.supplierSku || poolSku) && (!snapshot?.sourceSupplierSku || !m.productName || code(m.productName) === code(snapshot.productName))))
    .forEach(m => itemIds.add(m.productId));
  const peers = snapshot ? snapshots.filter(s => ids.has(s.supplierId) && code(s.sourceSupplierSku || s.supplierSku) === code(poolSku) &&
    Date.parse(s.snapshotDate) === Date.parse(snapshot.snapshotDate) && (!isNcc || code(s.customerStockCode || s.customerStockCodeRaw || s.customerStockCodeNorm) === poolCustomerCode)) : [];
  const sameDateMatches = snapshot ? matches.filter(s => Date.parse(s.snapshotDate) === Date.parse(snapshot.snapshotDate) && (!isNcc || s.stockType === snapshot.stockType)) : [];
  const ambiguousMapping = new Set(sameDateMatches.map(s => code(s.sourceSupplierSku || s.supplierSku))).size > 1;
  const hasConflict = ambiguousMapping || new Set(peers.map(s => Number(s.availableQty ?? s.stockOnHand ?? 0))).size > 1;
  return { mapping, snapshot, supplierIds: ids, itemIds, canonical,
    hasConflict, priceVaries: new Set(peers.map(s => Number(s.sellPrice ?? s.unitPrice ?? 0))).size > 1,
    key: `${canonical}:${code(poolSku) || itemId}${isNcc && poolCustomerCode ? ':' + poolCustomerCode : ''}` };
}

/** Never borrow another supplier's catalogue price for an offer. */
export function getSupplierOfferPrice(item: Item, supplierId: string,
  suppliers: Array<{ id: string; name: string }>, mappings: SupplierProductMap[], snapshots: SupplierStockSnapshot[]): number {
  const pool = resolveStockPool(item.id, supplierId, suppliers, mappings, snapshots, item);
  if (pool.hasConflict) return 0;
  const itemCode = code(item.sku || item.sapItemCodeNorm);
  const pricedSnapshot = snapshots.filter(s => pool.supplierIds.has(s.supplierId) && code(s.sourceSupplierSku || s.supplierSku) === code(pool.snapshot?.sourceSupplierSku || pool.snapshot?.supplierSku) &&
    [s.customerStockCode, s.customerStockCodeRaw, s.customerStockCodeNorm].some(c => !!c && code(c) === itemCode))
    .sort((a, b) => Date.parse(b.snapshotDate) - Date.parse(a.snapshotDate) || (a.id || '').localeCompare(b.id))[0] || pool.snapshot;
  const supplierPrice = Number(pricedSnapshot?.sellPrice ?? pricedSnapshot?.unitPrice ?? 0);
  if (Number.isFinite(supplierPrice) && supplierPrice > 0) return supplierPrice;
  return item.supplierId && pool.supplierIds.has(item.supplierId) ? Math.max(0, Number(item.unitPrice) || 0) : 0;
}
