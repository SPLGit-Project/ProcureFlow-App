import type { PORequest, Item, SupplierStockSnapshot, SupplierProductMap } from '../types.ts';
import { canonicalSupplierName } from './suppliers.ts';

export const RESERVATION_WINDOW_HOURS = 48;

export interface ReservationTimeRemaining {
    isExpired: boolean;
    totalHoursRemaining: number;
    hours: number;
    minutes: number;
    label: string;
    urgency: 'NORMAL' | 'WARNING' | 'CRITICAL';
}

export interface StockBreakdown {
    supplierSku: string;
    snapshotDate: string;
    rawSnapshotQty: number;
    packConversionFactor: number;
    baseAvailableUnits: number;
    reservedUnits: number;
    committedUnits: number;
    effectiveStockUnits: number;
    availableOrderQty: number;
    orderMultiple: number;
    reservedPOs: number;
    committedPOs: number;
}

/**
 * Checks whether an order is actively reserving supplier stock (approved, awaiting Concur PO #).
 * - If a Concur PR # is linked, the order has satisfied the 48-hour entry window and holds
 *   its reservation while awaiting Concur PO issuance.
 * - If awaiting Concur PR #, reservation is held until the 48-hour window expires.
 */
export function isPOReservingStock(po: PORequest): boolean {
    const isPendingConcur = po.status === 'APPROVED_PENDING_CONCUR' || po.status === 'APPROVED_PENDING_CONCUR_REQUEST';
    if (!isPendingConcur) return false;
    if (po.concurPoNumber && po.concurPoNumber.trim().length > 0) return false;

    // If Concur Request / PR # has been linked, it has passed the 48-hour entry window
    // and actively reserves stock while awaiting Concur PO issuance
    const hasConcurRequest = Boolean(
        (po.concurRequestNumber && po.concurRequestNumber.trim().length > 0) ||
        (po.concurPrNumber && po.concurPrNumber.trim().length > 0)
    );
    if (hasConcurRequest) {
        return true;
    }

    // Check expiry for orders pending Concur PR #
    const expiresAtMs = getPOReservationExpiryMs(po);
    return expiresAtMs > Date.now();
}

/**
 * Determines the exact timestamp in milliseconds when a PO reservation expires.
 */
export function getPOReservationExpiryMs(po: PORequest): number {
    if (po.reservationExpiresAt) {
        return new Date(po.reservationExpiresAt).getTime();
    }
    const approvalTime = po.approvedAt || po.updatedAt || po.requestDate;
    if (approvalTime) {
        return new Date(approvalTime).getTime() + RESERVATION_WINDOW_HOURS * 60 * 60 * 1000;
    }
    return Date.now() + RESERVATION_WINDOW_HOURS * 60 * 60 * 1000;
}

/**
 * Evaluates the remaining reservation time, countdown label, and urgency tier.
 */
export function getReservationTimeRemaining(po: PORequest): ReservationTimeRemaining {
    // If Concur PR # is already linked, reservation window requirement is satisfied
    const prNumber = (po.concurRequestNumber || po.concurPrNumber || '').trim();
    if (prNumber.length > 0) {
        return {
            isExpired: false,
            totalHoursRemaining: Infinity,
            hours: 0,
            minutes: 0,
            label: `Concur PR #${prNumber}`,
            urgency: 'NORMAL'
        };
    }

    const expiresAtMs = getPOReservationExpiryMs(po);
    const nowMs = Date.now();
    const diffMs = expiresAtMs - nowMs;

    if (diffMs <= 0) {
        return {
            isExpired: true,
            totalHoursRemaining: 0,
            hours: 0,
            minutes: 0,
            label: 'Reservation Expired',
            urgency: 'CRITICAL'
        };
    }

    const totalHoursRemaining = diffMs / (1000 * 60 * 60);
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let urgency: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
    if (totalHoursRemaining < 12) {
        urgency = 'CRITICAL';
    } else if (totalHoursRemaining < 24) {
        urgency = 'WARNING';
    }

    const label = hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;

    return {
        isExpired: false,
        totalHoursRemaining,
        hours,
        minutes,
        label,
        urgency
    };
}

/**
 * Calculates the complete dynamic stock running total and breakdown for an item and supplier.
 */
export function calculateItemRunningStock(
    itemId: string,
    supplierId: string,
    suppliers: Array<{ id: string; name: string }>,
    mappings: SupplierProductMap[],
    stockSnapshots: SupplierStockSnapshot[],
    pos: PORequest[],
    defaultOrderMultiple = 1
): StockBreakdown {
    const emptyResult: StockBreakdown = {
        supplierSku: '',
        snapshotDate: '',
        rawSnapshotQty: 0,
        packConversionFactor: 1,
        baseAvailableUnits: 0,
        reservedUnits: 0,
        committedUnits: 0,
        effectiveStockUnits: 0,
        availableOrderQty: 0,
        orderMultiple: defaultOrderMultiple || 1,
        reservedPOs: 0,
        committedPOs: 0
    };

    const targetSupplier = suppliers.find(s => s.id === supplierId);
    const targetCanonical = targetSupplier ? canonicalSupplierName(targetSupplier.name) : '';
    const equivalentSupplierIds = targetCanonical
        ? suppliers.filter(s => canonicalSupplierName(s.name) === targetCanonical).map(s => s.id)
        : [supplierId];

    let mapping = mappings.find(m => m.productId === itemId && equivalentSupplierIds.includes(m.supplierId) && m.mappingStatus === 'CONFIRMED');
    if (!mapping) {
        mapping = mappings.find(m => m.productId === itemId && equivalentSupplierIds.includes(m.supplierId));
    }
    if (!mapping) return emptyResult;

    const conversionFactor = mapping.packConversionFactor || 1;

    const targetSkus = new Set(
        [
            mapping.supplierSku,
            mapping.supplierCustomerStockCode,
            mapping.internalSku
        ]
        .filter(Boolean)
        .map(sku => (sku as string).trim().toUpperCase())
    );

    const relevantSnapshots = (stockSnapshots || [])
        .filter(s => {
            if (!equivalentSupplierIds.includes(s.supplierId)) return false;
            const snapSku = (s.supplierSku || '').trim().toUpperCase();
            const snapCustomerCode = (s.customerStockCode || '').trim().toUpperCase();
            const snapCustomerCodeNorm = (s.customerStockCodeNorm || '').trim().toUpperCase();
            return (
                (snapSku && targetSkus.has(snapSku)) ||
                (snapCustomerCode && targetSkus.has(snapCustomerCode)) ||
                (snapCustomerCodeNorm && targetSkus.has(snapCustomerCodeNorm))
            );
        })
        .sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime());

    if (relevantSnapshots.length === 0) return emptyResult;
    const latestSnapshot = relevantSnapshots[0];
    const snapshotDateMs = new Date(latestSnapshot.snapshotDate).getTime();

    const rawSnapshotQty = (latestSnapshot.availableQty !== undefined && latestSnapshot.availableQty !== null && latestSnapshot.availableQty > 0)
        ? latestSnapshot.availableQty
        : (latestSnapshot.stockOnHand || latestSnapshot.availableQty || 0);

    const baseAvailableUnits = rawSnapshotQty * conversionFactor;

    let reservedUnits = 0;
    let committedUnits = 0;
    let reservedPOs = 0;
    let committedPOs = 0;

    (pos || []).forEach(po => {
        // Ensure PO is for this supplier (or equivalent canonical supplier) to prevent cross-supplier stock deduction
        const poMatchesSupplier = (po.supplierId && equivalentSupplierIds.includes(po.supplierId)) ||
            (!po.supplierId && po.supplierName && targetCanonical && canonicalSupplierName(po.supplierName) === targetCanonical);
        if (!poMatchesSupplier) return;

        // Filter lines matching this item
        const matchingLines = (po.lines || []).filter(l => l.itemId === itemId);
        if (matchingLines.length === 0) return;

        const lineOrderedTotal = matchingLines.reduce((sum, line) => sum + (Number(line.quantityOrdered) || 0), 0);
        const lineReceivedTotal = matchingLines.reduce((sum, line) => sum + (Number(line.quantityReceived) || 0), 0);
        const lineUndelivered = Math.max(0, lineOrderedTotal - lineReceivedTotal);

        // 1. Active Reservations: Approved, waiting for Concur PO #, < 48 hours or Concur PR linked
        // Reservations are internal holds awaiting Concur PO issuance and have NOT been received by the supplier.
        // Therefore, the supplier's warehouse stock snapshot always includes these items, and they must always be deducted.
        if (isPOReservingStock(po)) {
            reservedUnits += lineOrderedTotal;
            if (lineOrderedTotal > 0) reservedPOs++;
        }

        // 2. Committed / Awaiting Delivery: Concur PO # entered, status ACTIVE or VARIANCE_PENDING
        // Deduct remaining unfulfilled units if linked on or after snapshot date (or if snapshot date is unrecorded)
        if ((po.status === 'ACTIVE' || po.status === 'VARIANCE_PENDING') && po.concurPoNumber && po.concurPoNumber.trim().length > 0) {
            const concurLinkedTime = po.concurLinkedAt || po.updatedAt || po.requestDate;
            const concurLinkedMs = concurLinkedTime ? new Date(concurLinkedTime).getTime() : 0;
            if (!snapshotDateMs || isNaN(snapshotDateMs) || concurLinkedMs >= snapshotDateMs) {
                committedUnits += lineUndelivered;
                if (lineUndelivered > 0) committedPOs++;
            }
        }
    });

    const effectiveStockUnits = Math.max(0, baseAvailableUnits - reservedUnits - committedUnits);
    const orderMult = defaultOrderMultiple || 1;
    const availableOrderQty = Math.floor(effectiveStockUnits / orderMult) * orderMult;

    return {
        supplierSku: mapping.supplierSku,
        snapshotDate: latestSnapshot.snapshotDate,
        rawSnapshotQty,
        packConversionFactor: conversionFactor,
        baseAvailableUnits,
        reservedUnits,
        committedUnits,
        effectiveStockUnits,
        availableOrderQty,
        orderMultiple: orderMult,
        reservedPOs,
        committedPOs
    };
}
