import type { Item, POLineItem, Supplier, SupplierProductMap, SupplierStockSnapshot } from '../types.ts';
import { resolveStockPool } from './stockOffers.ts';
import { calculateLinePricing } from './taxCalculations.ts';

export interface OrderPackRule {
  size: number | null;
  source: 'supplier' | 'catalogue' | 'unknown' | 'conflict';
}

const validPack = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};
const code = (value?: string) => (value || '').trim().toUpperCase();

/** Supplier pack quantities are already in ordering units, not stock conversion factors. */
export function getOrderPackRule(item: Item | undefined, supplierId: string,
  suppliers: Pick<Supplier, 'id' | 'name'>[], mappings: SupplierProductMap[],
  snapshots: SupplierStockSnapshot[]): OrderPackRule {
  if (!item || !supplierId) return { size: null, source: 'unknown' };
  const pool = resolveStockPool(item.id, supplierId, suppliers, mappings, snapshots, item);
  if (pool.hasConflict) return { size: null, source: 'conflict' };
  const snapshot = pool.snapshot;
  const peers = snapshot ? snapshots.filter(s => pool.supplierIds.has(s.supplierId) &&
    code(s.supplierSku) === code(snapshot.supplierSku) &&
    Date.parse(s.snapshotDate) === Date.parse(snapshot.snapshotDate) &&
    (code(snapshot.productName) !== code(item.name) || code(s.productName) === code(item.name)) &&
    (!pool.canonical.includes('ncc') || s.stockType === snapshot.stockType)) : [];
  const packs = new Set(peers.map(s => validPack(s.cartonQty)).filter((p): p is number => p !== null));
  if (packs.size > 1) return { size: null, source: 'conflict' };
  const supplierPack = validPack(snapshot?.cartonQty);
  if (supplierPack) return { size: supplierPack, source: 'supplier' };
  // A legacy catalogue value of 1 is a default, not confirmation of loose-unit ordering.
  const cataloguePack = validPack(item.upq);
  return cataloguePack && cataloguePack > 1
    ? { size: cataloguePack, source: 'catalogue' } : { size: null, source: 'unknown' };
}

export function roundOrderQuantity(quantity: number, size: number): number {
  if (!validPack(size)) throw new Error('A confirmed bale/carton size is required.');
  const raw = Number.isFinite(quantity) ? Math.max(1, Math.ceil(quantity)) : 1;
  const rounded = Math.ceil(raw / size) * size;
  if (!Number.isSafeInteger(rounded)) throw new Error('Quantity is too large.');
  return rounded;
}

export function isPackQuantity(quantity: number, size: number | null): boolean {
  return size !== null && Number.isSafeInteger(quantity) && quantity > 0 && quantity % size === 0;
}

export function packRuleLabel(rule: OrderPackRule): string {
  if (rule.source === 'conflict') return 'Conflicting pack sizes — ask Procurement to correct the supplier data.';
  if (!rule.size) return 'Pack size unavailable — ask Procurement to confirm the bale/carton size.';
  return `Bale/carton: ${rule.size.toLocaleString()} units${rule.source === 'catalogue' ? ' (catalogue)' : ''}`;
}

export function assertOrderPackQuantities(lines: POLineItem[], supplierId: string, items: Item[],
  suppliers: Pick<Supplier, 'id' | 'name'>[], mappings: SupplierProductMap[], snapshots: SupplierStockSnapshot[]) {
  for (const line of lines) {
    const rule = getOrderPackRule(items.find(i => i.id === line.itemId), supplierId, suppliers, mappings, snapshots);
    if (!isPackQuantity(line.quantityOrdered, rule.size)) {
      throw new Error(`${line.itemName || line.sku}: ${rule.size
        ? `quantity must be a positive whole multiple of ${rule.size} units.`
        : packRuleLabel(rule)} Review the quantity before saving or submitting.`);
    }
  }
}

export function withPackQuantity(line: POLineItem, quantity: number, size: number): POLineItem {
  return { ...line, ...calculateLinePricing(roundOrderQuantity(quantity, size), line.unitPrice,
    line.taxCode || 'GST', line.taxRate ?? 10), upq: size };
}
