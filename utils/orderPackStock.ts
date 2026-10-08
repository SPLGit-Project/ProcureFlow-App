import type { Item, PORequest, Supplier, SupplierProductMap, SupplierStockSnapshot } from '../types.ts';
import { getOrderPackRule } from './orderPacks.ts';
import { calculateItemRunningStock } from './reservationUtils.ts';

/** Shared request/directory/report projection; physical stock remains in ordering units. */
export function calculatePackOrderStock(itemId: string, supplierId: string,
  suppliers: Pick<Supplier, 'id' | 'name'>[], mappings: SupplierProductMap[],
  snapshots: SupplierStockSnapshot[], pos: PORequest[], item?: Item) {
  const rule = getOrderPackRule(item, supplierId, suppliers, mappings, snapshots);
  const stock = calculateItemRunningStock(itemId, supplierId, suppliers, mappings, snapshots, pos, rule.size || 1, item);
  return { ...stock, orderMultiple: rule.size || 0, availableOrderQty: rule.size ? stock.availableOrderQty : 0 };
}
