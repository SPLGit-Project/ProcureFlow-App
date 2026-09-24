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
 * Checks whether an order is actively reserving supplier stock (approved, awaiting Concur PO #, < 48 hours).
 */
export function isPOReservingStock(po: PORequest): boolean {
    const isPendingConcur = po.status === 'APPROVED_PENDING_CONCUR' || po.status === 'APPROVED_PENDING_CONCUR_REQUEST';
    if (!isPendingConcur) return false;
    if (po.concurPoNumber && po.concurPoNumber.trim().length > 0) return false;

    // Check expiry
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

    const mapping = mappings.find(m => m.productId === itemId && equivalentSupplierIds.includes(m.supplierId) && m.mappingStatus === 'CONFIRMED');
    if (!mapping) return emptyResult;

    const conversionFactor = mapping.packConversionFactor || 1;

    const relevantSnapshots = (stockSnapshots || [])
        .filter(s => equivalentSupplierIds.includes(s.supplierId) && s.supplierSku === mapping.supplierSku)
        .sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime());

    if (relevantSnapshots.length === 0) return emptyResult;
    const latestSnapshot = relevantSnapshots[0];
    const snapshotDateMs = new Date(latestSnapshot.snapshotDate).getTime();

    const baseAvailableUnits = (latestSnapshot.availableQty || 0) * conversionFactor;

    let reservedUnits = 0;
    let committedUnits = 0;
    let reservedPOs = 0;
    let committedPOs = 0;

    (pos || []).forEach(po => {
        // Filter lines matching this item
        const matchingLines = (po.lines || []).filter(l => l.itemId === itemId);
        if (matchingLines.length === 0) return;

        const lineOrderedTotal = matchingLines.reduce((sum, line) => sum + (Number(line.quantityOrdered) || 0), 0);
        const lineReceivedTotal = matchingLines.reduce((sum, line) => sum + (Number(line.quantityReceived) || 0), 0);
        const lineUndelivered = Math.max(0, lineOrderedTotal - lineReceivedTotal);

        // 1. Active Reservations: Approved, waiting for Concur PO #, < 48 hours
        if (isPOReservingStock(po)) {
            const approvalTime = po.approvedAt || po.updatedAt || po.requestDate;
            const approvalMs = approvalTime ? new Date(approvalTime).getTime() : 0;
            // Deduct if approved on or after the snapshot date (or if snapshot is older)
            if (approvalMs >= snapshotDateMs) {
                reservedUnits += lineOrderedTotal;
                if (lineOrderedTotal > 0) reservedPOs++;
            }
        }

        // 2. Committed / Awaiting Delivery: Concur PO # entered, status ACTIVE
        if (po.status === 'ACTIVE' && po.concurPoNumber && po.concurPoNumber.trim().length > 0) {
            const concurLinkedTime = po.concurLinkedAt || po.updatedAt || po.requestDate;
            const concurLinkedMs = concurLinkedTime ? new Date(concurLinkedTime).getTime() : 0;
            // Deduct remaining unfulfilled units if linked on or after snapshot date
            if (concurLinkedMs >= snapshotDateMs) {
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
        rawSnapshotQty: latestSnapshot.availableQty || 0,
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
