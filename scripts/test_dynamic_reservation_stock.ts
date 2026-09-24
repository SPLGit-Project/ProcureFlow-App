import { 
    calculateItemRunningStock, 
    isPOReservingStock, 
    getReservationTimeRemaining,
    RESERVATION_WINDOW_HOURS 
} from '../utils/reservationUtils.ts';
import type { Item, Supplier, SupplierProductMap, SupplierStockSnapshot, PORequest } from '../types.ts';

function runTests() {
    console.log('=== Running Dynamic Supplier Stock & Reservation Tests ===\n');

    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, testName: string, details?: string) {
        if (condition) {
            console.log(`[PASS] ${testName}`);
            passed++;
        } else {
            console.error(`[FAIL] ${testName}`);
            if (details) console.error(`       Details: ${details}`);
            failed++;
        }
    }

    const testSupplier: Supplier = {
        id: 'sup-1',
        name: 'Spotless Commercial Linen',
        contactEmail: 'orders@spotless.com',
        keyContact: 'Jane Doe',
        phone: '1300 000 000',
        address: '123 Supply Way',
        categories: ['Linen']
    };

    const testItem: Item = {
        id: 'item-101',
        sku: 'LIN-SHT-QUEEN',
        name: 'Queen Flat Sheet - White',
        description: 'Commercial 50/50 poly-cotton',
        unitPrice: 15.50,
        uom: 'EACH',
        defaultOrderMultiple: 5,
        stockLevel: 0,
        supplierId: 'sup-1',
        category: 'Linen'
    };

    const testMapping: SupplierProductMap = {
        id: 'map-1',
        supplierId: 'sup-1',
        productId: 'item-101',
        supplierSku: 'SPL-QFS-WHT',
        matchPriority: 1,
        packConversionFactor: 1,
        mappingStatus: 'CONFIRMED',
        mappingMethod: 'MANUAL',
        confidenceScore: 1.0,
        updatedAt: '2026-09-20T00:00:00Z'
    };

    const now = new Date();
    const mondaySnapshotDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago

    const weeklySnapshot: SupplierStockSnapshot = {
        id: 'snap-1',
        supplierId: 'sup-1',
        supplierSku: 'SPL-QFS-WHT',
        productName: 'Queen Flat Sheet - White',
        stockOnHand: 100,
        committedQty: 0,
        backOrderedQty: 0,
        availableQty: 100, // 100 available from supplier
        totalStockQty: 100,
        snapshotDate: mondaySnapshotDate,
        sourceReportName: 'Weekly_SOH_2026-09-22.xlsx'
    };

    // Test 1: Baseline Stock (No POs)
    {
        const breakdown = calculateItemRunningStock(
            testItem.id,
            testSupplier.id,
            [testSupplier],
            [testMapping],
            [weeklySnapshot],
            [],
            testItem.defaultOrderMultiple
        );

        assert(breakdown.baseAvailableUnits === 100, 'Baseline available units matches supplier snapshot (100)');
        assert(breakdown.reservedUnits === 0, 'Baseline reserved units is 0');
        assert(breakdown.committedUnits === 0, 'Baseline committed units is 0');
        assert(breakdown.availableOrderQty === 100, 'Baseline orderable quantity is 100');
    }

    // Test 2: Pending Approval PO should NOT reserve stock
    {
        const pendingPO: PORequest = {
            id: 'po-1',
            displayId: 'REQ-2026-001',
            requestDate: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(), // 10h ago
            requesterId: 'user-1',
            requesterName: 'Site User',
            site: 'Melbourne Laundry',
            supplierId: 'sup-1',
            supplierName: testSupplier.name,
            status: 'PENDING_APPROVAL',
            totalAmount: 310,
            approvalHistory: [],
            lines: [{
                id: 'line-1',
                itemId: 'item-101',
                itemName: testItem.name,
                sku: 'SPL-QFS-WHT',
                quantityOrdered: 20,
                quantityReceived: 0,
                unitPrice: 15.50,
                totalPrice: 310
            }],
            deliveries: []
        };

        const isReserving = isPOReservingStock(pendingPO);
        assert(!isReserving, 'Unapproved PO (PENDING_APPROVAL) does NOT reserve stock');

        const breakdown = calculateItemRunningStock(
            testItem.id,
            testSupplier.id,
            [testSupplier],
            [testMapping],
            [weeklySnapshot],
            [pendingPO],
            testItem.defaultOrderMultiple
        );

        assert(breakdown.reservedUnits === 0, 'Pending approval PO does not deduct from running stock');
        assert(breakdown.availableOrderQty === 100, 'Orderable stock remains 100 for other users');
    }

    // Test 3: Approved PO (< 48h) RESERVES stock dynamically
    {
        const approvedTime = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(); // Approved 12h ago
        const expiryTime = new Date(new Date(approvedTime).getTime() + RESERVATION_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

        const approvedPO: PORequest = {
            id: 'po-2',
            displayId: 'REQ-2026-002',
            requestDate: approvedTime,
            approvedAt: approvedTime,
            reservationExpiresAt: expiryTime,
            requesterId: 'user-1',
            requesterName: 'Site User',
            site: 'Melbourne Laundry',
            supplierId: 'sup-1',
            supplierName: testSupplier.name,
            status: 'APPROVED_PENDING_CONCUR',
            totalAmount: 310,
            approvalHistory: [{
                id: 'appr-1',
                approverName: 'Finance Manager',
                date: approvedTime,
                action: 'APPROVED'
            }],
            lines: [{
                id: 'line-2',
                itemId: 'item-101',
                itemName: testItem.name,
                sku: 'SPL-QFS-WHT',
                quantityOrdered: 20,
                quantityReceived: 0,
                unitPrice: 15.50,
                totalPrice: 310
            }],
            deliveries: []
        };

        const isReserving = isPOReservingStock(approvedPO);
        assert(isReserving, 'Approved PO within 48h IS actively reserving stock');

        const remaining = getReservationTimeRemaining(approvedPO);
        assert(!remaining.isExpired, 'Reservation is NOT expired (approved 12h ago)');
        assert(remaining.hours === 35 || remaining.hours === 36, `Remaining hours is ~36h (got ${remaining.hours}h)`);
        assert(remaining.urgency === 'NORMAL', 'Urgency is NORMAL (> 24h remaining)');

        const breakdown = calculateItemRunningStock(
            testItem.id,
            testSupplier.id,
            [testSupplier],
            [testMapping],
            [weeklySnapshot],
            [approvedPO],
            testItem.defaultOrderMultiple
        );

        assert(breakdown.reservedUnits === 20, 'Reserved units is 20');
        assert(breakdown.effectiveStockUnits === 80, 'Effective stock units drops from 100 to 80 (100 - 20)');
        assert(breakdown.availableOrderQty === 80, 'Available orderable qty is 80');
    }

    // Test 4: Expired Approved PO (> 48h) does NOT reserve stock (Released back to pool)
    {
        const approvedTime = new Date(now.getTime() - 50 * 60 * 60 * 1000).toISOString(); // Approved 50h ago
        const expiryTime = new Date(new Date(approvedTime).getTime() + RESERVATION_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

        const expiredPO: PORequest = {
            id: 'po-3',
            displayId: 'REQ-2026-003',
            requestDate: approvedTime,
            approvedAt: approvedTime,
            reservationExpiresAt: expiryTime,
            requesterId: 'user-1',
            requesterName: 'Site User',
            site: 'Melbourne Laundry',
            supplierId: 'sup-1',
            supplierName: testSupplier.name,
            status: 'APPROVED_PENDING_CONCUR',
            totalAmount: 310,
            approvalHistory: [],
            lines: [{
                id: 'line-3',
                itemId: 'item-101',
                itemName: testItem.name,
                sku: 'SPL-QFS-WHT',
                quantityOrdered: 20,
                quantityReceived: 0,
                unitPrice: 15.50,
                totalPrice: 310
            }],
            deliveries: []
        };

        const isReserving = isPOReservingStock(expiredPO);
        assert(!isReserving, 'Expired PO (> 48h) does NOT hold reserved stock');

        const remaining = getReservationTimeRemaining(expiredPO);
        assert(remaining.isExpired, 'getReservationTimeRemaining flags PO as expired');
        assert(remaining.urgency === 'CRITICAL', 'Expired PO urgency is CRITICAL');

        const breakdown = calculateItemRunningStock(
            testItem.id,
            testSupplier.id,
            [testSupplier],
            [testMapping],
            [weeklySnapshot],
            [expiredPO],
            testItem.defaultOrderMultiple
        );

        assert(breakdown.reservedUnits === 0, 'Expired reservation units are released (0 reserved)');
        assert(breakdown.availableOrderQty === 100, 'Available stock returns to 100 for other users');
    }

    // Test 5: Concur PO # entered -> Transitions to ACTIVE (Committed stock in delivery)
    {
        const orderTime = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(); // 6h ago

        const activePO: PORequest = {
            id: 'po-4',
            displayId: 'REQ-2026-004',
            requestDate: orderTime,
            concurPoNumber: 'PO-CONCUR-9988',
            concurLinkedAt: orderTime,
            requesterId: 'user-1',
            requesterName: 'Site User',
            site: 'Melbourne Laundry',
            supplierId: 'sup-1',
            supplierName: testSupplier.name,
            status: 'ACTIVE',
            totalAmount: 465,
            approvalHistory: [],
            lines: [{
                id: 'line-4',
                itemId: 'item-101',
                itemName: testItem.name,
                sku: 'SPL-QFS-WHT',
                quantityOrdered: 30,
                quantityReceived: 10, // 10 received, 20 still undelivered
                unitPrice: 15.50,
                totalPrice: 465,
                concurPoNumber: 'PO-CONCUR-9988'
            }],
            deliveries: []
        };

        const isReserving = isPOReservingStock(activePO);
        assert(!isReserving, 'ACTIVE PO with Concur PO # is committed, not in temporary reservation state');

        const breakdown = calculateItemRunningStock(
            testItem.id,
            testSupplier.id,
            [testSupplier],
            [testMapping],
            [weeklySnapshot],
            [activePO],
            testItem.defaultOrderMultiple
        );

        assert(breakdown.reservedUnits === 0, 'Reserved units is 0 for ACTIVE order');
        assert(breakdown.committedUnits === 20, 'Committed units is 20 (30 ordered - 10 received)');
        assert(breakdown.effectiveStockUnits === 80, 'Effective stock units drops from 100 to 80 (100 - 20)');
        assert(breakdown.availableOrderQty === 80, 'Orderable stock is 80');
    }

    // Test 6: Running Total with multiple active states (1 Reserved + 1 Active Delivery)
    {
        const approvedTime = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(); // 4h ago
        const expiryTime = new Date(new Date(approvedTime).getTime() + RESERVATION_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

        const poReserved: PORequest = {
            id: 'po-res-1',
            displayId: 'REQ-RES-1',
            requestDate: approvedTime,
            approvedAt: approvedTime,
            reservationExpiresAt: expiryTime,
            requesterId: 'user-1',
            requesterName: 'Site User A',
            site: 'Melbourne Laundry',
            supplierId: 'sup-1',
            supplierName: testSupplier.name,
            status: 'APPROVED_PENDING_CONCUR',
            totalAmount: 155,
            approvalHistory: [],
            lines: [{
                id: 'line-res-1',
                itemId: 'item-101',
                itemName: testItem.name,
                sku: 'SPL-QFS-WHT',
                quantityOrdered: 15,
                quantityReceived: 0,
                unitPrice: 15.50,
                totalPrice: 155
            }],
            deliveries: []
        };

        const poActive: PORequest = {
            id: 'po-act-1',
            displayId: 'REQ-ACT-1',
            requestDate: approvedTime,
            concurPoNumber: 'PO-CONCUR-5555',
            concurLinkedAt: approvedTime,
            requesterId: 'user-2',
            requesterName: 'Site User B',
            site: 'Sydney Laundry',
            supplierId: 'sup-1',
            supplierName: testSupplier.name,
            status: 'ACTIVE',
            totalAmount: 387.50,
            approvalHistory: [],
            lines: [{
                id: 'line-act-1',
                itemId: 'item-101',
                itemName: testItem.name,
                sku: 'SPL-QFS-WHT',
                quantityOrdered: 25,
                quantityReceived: 0,
                unitPrice: 15.50,
                totalPrice: 387.50,
                concurPoNumber: 'PO-CONCUR-5555'
            }],
            deliveries: []
        };

        const breakdown = calculateItemRunningStock(
            testItem.id,
            testSupplier.id,
            [testSupplier],
            [testMapping],
            [weeklySnapshot],
            [poReserved, poActive],
            testItem.defaultOrderMultiple
        );

        assert(breakdown.baseAvailableUnits === 100, 'Baseline SOH is 100');
        assert(breakdown.reservedUnits === 15, 'Reserved units is 15');
        assert(breakdown.committedUnits === 25, 'Committed units is 25');
        assert(breakdown.effectiveStockUnits === 60, 'Net running total is 60 (100 - 15 - 25)');
        assert(breakdown.availableOrderQty === 60, 'Available orderable qty is 60');
    }

    console.log(`\n========================================`);
    console.log(`Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
