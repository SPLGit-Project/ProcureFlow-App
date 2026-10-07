import type { POLineItem } from '../types.ts';

export function readOrderPackSnapshot(row: { upq?: number | string | null; uom?: string | null; pack_supplier_id?: string | null }) {
  const size = Number(row.upq);
  return {
    upq: Number.isSafeInteger(size) && size > 0 ? size : undefined,
    uom: row.uom || undefined,
    packSupplierId: row.pack_supplier_id || undefined,
  };
}

/** History uses the saved pack only: supplier reports and catalogue edits must not rewrite it. */
export function linePackLabel(line: Pick<POLineItem, 'upq' | 'uom' | 'quantityOrdered'>): string {
  const size = readOrderPackSnapshot(line).upq;
  const unit = line.uom || 'units';
  if (line.quantityOrdered === 0) return `Unplanned receipt · no quantity ordered (${unit})`;
  if (!size) return 'Pack size not recorded (legacy order)';
  const count = line.quantityOrdered / size;
  const packs = Number.isInteger(count) ? `${count.toLocaleString()} full packs` : `${count.toLocaleString()} pack equivalents`;
  return `Bale/carton: ${size.toLocaleString()} ${unit} · ${packs}`;
}

export const ORDER_PACK_EXPORT_COLUMNS = [
  { key: 'orderUom', label: 'Ordering UOM' },
  { key: 'orderPackSize', label: 'Bale/carton size at order' },
  { key: 'orderedPacks', label: 'Ordered pack equivalents' },
];
const lineReports = new Set(['OUTSTANDING_DELIVERIES', 'ALL_DELIVERIES', 'DELIVERY_VARIANCE',
  'FINANCE_SUMMARY', 'DELIVERY_RECONCILIATION', 'ITEM_REQUEST_HISTORY', 'MONTHLY_SUMMARY', 'LINEN_INJECTION']);
export function appendOrderPackColumns(report: string, columns: { key: string; label: string }[]) {
  return lineReports.has(report)
    ? [...columns, ...ORDER_PACK_EXPORT_COLUMNS.filter(c => !columns.some(old => old.key === c.key))] : columns;
}

export function orderPackReportFields(line?: Pick<POLineItem, 'upq' | 'uom' | 'quantityOrdered'>): Record<string, string | number> {
  const size = line && readOrderPackSnapshot(line).upq;
  return { orderUom: line?.uom || '', orderPackSize: size || '',
    orderedPacks: size && line ? line.quantityOrdered / size : '',
    orderPackLabel: line ? linePackLabel(line) : 'Pack size not recorded' };
}
