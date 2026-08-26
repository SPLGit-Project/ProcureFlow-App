import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
    AlertCircle,
    AlignLeft,
    BarChart3,
    Building2,
    CheckCircle2,
    Download,
    FileText,
    Package,
    PackageCheck,
    Search,
    TrendingUp,
    Layers,
    ArrowRight,
    ArrowRightLeft,
    History,
    Calendar
} from 'lucide-react';
import PageHeader from './PageHeader.tsx';
import { useSetPageMeta } from '../context/PageMetaContext.tsx';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis
} from 'recharts';
import type { Item, PORequest, POStatus, Site } from '../types.ts';

type ReportType = 'OUTSTANDING_DELIVERIES' | 'ALL_DELIVERIES' | 'DELIVERY_VARIANCE' | 'FINANCE_SUMMARY' | 'PO_STATUS' | 'DELIVERY_RECONCILIATION' | 'ITEM_REQUEST_HISTORY' | 'MONTHLY_SUMMARY' | 'LINEN_INJECTION' | 'SUPPLIER_INVENTORY' | 'SUPPLIER_ITEM_MAPPING' | 'SUPPLIER_PRICE_VARIANCE';
type ReportRow = Record<string, string | number>;

interface LinenInjectionReportRow extends ReportRow {
    id: string;
    poNumber: string;
    concurPoNumber: string;
    requestNumber: string;
    concurRequestNumber: string;
    requestDate: string;
    closedDate: string;
    latestDeliveryDate: string;
    deliveryDates: string;
    dockets: string;
    invoices: string;
    site: string;
    siteId: string;
    supplier: string;
    supplierId: string;
    itemId: string;
    item: string;
    sku: string;
    category: string;
    orderedQty: number;
    injectedQty: number;
    unitPrice: number;
    injectedValue: number;
    orderedValue: number;
    injectedValueIncGst?: number;
    orderedValueIncGst?: number;
    requester: string;
    status: POStatus;
}

interface MonthlySummaryReportRow extends ReportRow {
    id: string;
    monthKey: string;
    month: string;
    poNumber: string;
    concurPoNumber: string;
    requestNumber: string;
    concurRequestNumber: string;
    requestDate: string;
    needByDate?: string;
    site: string;
    supplier: string;
    item: string;
    sku: string;
    orderedQty: number;
    receivedQty: number;
    remainingQty: number;
    deliveryDates: string;
    dockets: string;
    invoices: string;
    unitPrice: number;
    orderedValue: number;
    receivedValue: number;
    openValue: number;
    taxRate?: number;
    taxAmount?: number;
    orderedValueIncGst?: number;
    receivedValueIncGst?: number;
    openValueIncGst?: number;
    status: POStatus;
}

interface MonthlySummaryAggregatedRow extends ReportRow {
    monthKey: string;
    month: string;
    totalPoAmount: number;
    totalPoAmountIncGst?: number;
    grAmount: number;
    grAmountIncGst?: number;
    openPoAmount: number;
    openPoAmountIncGst?: number;
}
type ViewMode = 'CHART' | 'RAW_DATA';
type ChartMetric = 'DATE' | 'SUPPLIER' | 'SITE' | 'ITEM';
type VarianceType = 'Pending' | 'Over delivered' | 'Short closed';

interface OutstandingDeliveryReportRow extends ReportRow {
    id: string;
    poNumber: string;
    supplier: string;
    site: string;
    item: string;
    latestDeliveryDate: string;
    deliveryDates: string;
    ordered: number;
    received: number;
    remaining: number;
    unitPrice: number;
    remainingValue: number;
    completionPct: number;
    status: POStatus;
}

interface DeliveryVarianceReportRow extends ReportRow {
    id: string;
    exceptionType: VarianceType;
    poNumber: string;
    supplier: string;
    site: string;
    item: string;
    requestDate: string;
    deliveryDate: string;
    qtyOrdered: number;
    qtyReceived: number;
    deltaQty: number;
    unitPrice: number;
    varianceValue: number;
    status: POStatus;
}

interface DeliveryReconciliationRow extends ReportRow {
    id: string;
    poNumber: string;
    supplier: string;
    site: string;
    item: string;
    orderedQty: number;
    receivedQty: number;
    pendingQty: number;
    overQty: number;
    unitPrice: number;
    orderedValue: number;
    receivedValue: number;
    pendingValue: number;
    varianceValue: number;
    orderedValueIncGst?: number;
    receivedValueIncGst?: number;
    pendingValueIncGst?: number;
    varianceValueIncGst?: number;
    status: POStatus;
}

interface ItemRequestHistoryRow extends ReportRow {
    id: string;
    itemId: string;
    item: string;
    sku: string;
    site: string;
    siteId: string;
    poNumber: string;
    displayId: string;
    supplier: string;
    requester: string;
    requestDate: string;
    orderedQty: number;
    receivedQty: number;
    remainingQty: number;
    unitPrice: number;
    totalValue: number;
    status: POStatus;
    latestDeliveryDate: string;
}

interface CsvColumn {
    key: string;
    label: string;
}

const REPORT_TITLES: Record<ReportType, string> = {
    OUTSTANDING_DELIVERIES: 'Outstanding Deliveries Report',
    ALL_DELIVERIES: 'All Deliveries Log',
    DELIVERY_VARIANCE: 'Delivery Variance Analysis',
    FINANCE_SUMMARY: 'Finance Capitalization Summary',
    PO_STATUS: 'All PO Status Report',
    DELIVERY_RECONCILIATION: 'Full Delivery Reconciliation',
    ITEM_REQUEST_HISTORY: 'Item Request History by Site',
    MONTHLY_SUMMARY: 'Monthly PO & Receipting Summary',
    LINEN_INJECTION: 'Linen Injection Report',
    SUPPLIER_INVENTORY: 'Available Supplier Inventory Report',
    SUPPLIER_ITEM_MAPPING: 'Supplier Item Mapping Report',
    SUPPLIER_PRICE_VARIANCE: 'Supplier Price Sync Variance Report'
};

const REPORT_DESCRIPTIONS: Record<ReportType, string> = {
    OUTSTANDING_DELIVERIES: 'Action-first view of PO lines still awaiting receipt, grouped by supplier and site to make follow-up work clear.',
    ALL_DELIVERIES: 'Comprehensive log of all completed deliveries across all sites, including received quantities and item pricing.',
    DELIVERY_VARIANCE: 'Exception-only view of pending, over-delivered, and short-closed delivery lines that need review.',
    FINANCE_SUMMARY: 'Detailed breakdown of all received goods with their capitalization status and invoice numbers. Use this for month-end reconciliation.',
    PO_STATUS: 'High-level overview of all Purchase Orders and their current approval status in the workflow.',
    DELIVERY_RECONCILIATION: 'Complete picture of order fulfillment. Compare ordered vs. received quantities across all PO lines to identify pending amounts and value variances.',
    ITEM_REQUEST_HISTORY: 'Search and select an item to see its most recent request activity at each site, with a detailed line-level export for deeper review.',
    MONTHLY_SUMMARY: 'Reconcile PO requests since July 2025. Groups POs monthly, showing total issued PO values, goods received (GR) values, and remaining open values.',
    LINEN_INJECTION: 'Comprehensive breakdown of all linen injected into circulation from closed purchase orders, detailing item quantities, unit pricing, and total injected value across sites and suppliers.',
    SUPPLIER_INVENTORY: 'Provides by supplier the most recent inventory stock data available within the app, including SOH, available quantities, and stock on backorder.',
    SUPPLIER_ITEM_MAPPING: 'Provides a complete overview of the mapping of supplier items to corresponding items in the internal catalogue.',
    SUPPLIER_PRICE_VARIANCE: 'Compares supplier price reports against the internal catalogue prices for confirmed mappings, highlighting variations and sync status.'
};

const DELIVERY_REPORTS: ReportType[] = ['OUTSTANDING_DELIVERIES', 'DELIVERY_VARIANCE', 'DELIVERY_RECONCILIATION'];
const FILTERABLE_REPORTS: ReportType[] = [...DELIVERY_REPORTS, 'ITEM_REQUEST_HISTORY', 'MONTHLY_SUMMARY', 'LINEN_INJECTION', 'SUPPLIER_INVENTORY', 'SUPPLIER_ITEM_MAPPING', 'SUPPLIER_PRICE_VARIANCE'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ACTIVE_DELIVERY_STATUSES: POStatus[] = ['ACTIVE', 'APPROVED_PENDING_CONCUR', 'APPROVED_PENDING_CONCUR_REQUEST', 'VARIANCE_PENDING'];
const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4'];

const currency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const numberValue = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });
const percentValue = (value: number) => `${Math.round(value)}%`;
const statusLabel = (status: string) => status.replaceAll('_', ' ');
const reportFileName = (report: ReportType) => `${report === 'OUTSTANDING_DELIVERIES' ? 'outstanding-deliveries' : report === 'DELIVERY_VARIANCE' ? 'delivery-variance' : report === 'LINEN_INJECTION' ? 'linen-injection' : report.toLowerCase().replaceAll('_', '-')}-${new Date().toISOString().split('T')[0]}.csv`;

const getPoNumber = (po: PORequest, linePoNumber?: string) => linePoNumber || po.concurPoNumber || po.lines[0]?.concurPoNumber || 'Pending';

const getLatestDeliveryDateForLine = (po: PORequest, poLineId: string) => {
    const dates = (po.deliveries || [])
        .filter((delivery) => delivery.lines.some((line) => line.poLineId === poLineId))
        .map((delivery) => delivery.date)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return dates[0] || '-';
};

const getDeliveryDatesForLine = (po: PORequest, poLineId: string) => {
    const dates = Array.from(new Set((po.deliveries || [])
        .filter((delivery) => delivery.lines.some((line) => line.poLineId === poLineId))
        .map((delivery) => delivery.date)
        .filter(Boolean)))
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    return dates.length > 0 ? dates.join('; ') : '-';
};

const getDocketsForLine = (po: PORequest, poLineId: string) => {
    const dockets = Array.from(new Set((po.deliveries || [])
        .filter((delivery) => delivery.lines.some((line) => line.poLineId === poLineId))
        .map((delivery) => delivery.docketNumber)
        .filter(Boolean)))
        .sort((a, b) => a.localeCompare(b));

    return dockets.length > 0 ? dockets.join('; ') : '-';
};

const getInvoicesForLine = (po: PORequest, poLineId: string) => {
    const invoices = Array.from(new Set((po.deliveries || [])
        .flatMap((delivery) => delivery.lines
            .filter((line) => line.poLineId === poLineId)
            .map((line) => line.invoiceNumber)
        )
        .filter(Boolean)))
        .sort((a, b) => a.localeCompare(b));

    return invoices.length > 0 ? invoices.join('; ') : '-';
};

const buildOutstandingDeliveryRows = (pos: PORequest[]): OutstandingDeliveryReportRow[] => {
    const rows = pos.flatMap((po) => {
        if (!ACTIVE_DELIVERY_STATUSES.includes(po.status)) return [];

        return po.lines.flatMap((line) => {
            const ordered = Number(line.quantityOrdered || 0);
            const received = Number(line.quantityReceived || 0);
            const remaining = ordered - received;

            if (remaining <= 0 || line.isForceClosed) return [];

            return [{
                id: line.id,
                poNumber: getPoNumber(po, line.concurPoNumber),
                supplier: po.supplierName,
                site: po.site,
                item: line.itemName,
                latestDeliveryDate: getLatestDeliveryDateForLine(po, line.id),
                deliveryDates: getDeliveryDatesForLine(po, line.id),
                ordered,
                received,
                remaining,
                unitPrice: Number(line.unitPrice || 0),
                remainingValue: remaining * Number(line.unitPrice || 0),
                completionPct: ordered > 0 ? Math.min(100, Math.max(0, (received / ordered) * 100)) : 0,
                status: po.status
            }];
        });
    });

    return rows.sort((a, b) => b.remainingValue - a.remainingValue || b.remaining - a.remaining || a.supplier.localeCompare(b.supplier));
};

const buildDeliveryVarianceRows = (pos: PORequest[]): DeliveryVarianceReportRow[] => {
    const rows = pos.flatMap((po) => po.lines.flatMap((line) => {
        const ordered = Number(line.quantityOrdered || 0);
        const received = Number(line.quantityReceived || 0);
        const deltaQty = received - ordered;
        let exceptionType: VarianceType | null = null;

        if (received < ordered && line.isForceClosed) {
            exceptionType = 'Short closed';
        } else if (received < ordered) {
            exceptionType = 'Pending';
        } else if (received > ordered) {
            exceptionType = 'Over delivered';
        }

        if (!exceptionType) return [];

        return [{
            id: line.id,
            exceptionType,
            poNumber: getPoNumber(po, line.concurPoNumber),
            supplier: po.supplierName,
            site: po.site,
            item: line.itemName,
            requestDate: po.requestDate,
            deliveryDate: getLatestDeliveryDateForLine(po, line.id),
            qtyOrdered: ordered,
            qtyReceived: received,
            deltaQty,
            unitPrice: Number(line.unitPrice || 0),
            varianceValue: Math.abs(deltaQty) * Number(line.unitPrice || 0),
            status: po.status
        }];
    }));

    const priority: Record<VarianceType, number> = { 'Over delivered': 0, 'Short closed': 1, Pending: 2 };
    return rows.sort((a, b) => priority[a.exceptionType] - priority[b.exceptionType] || b.varianceValue - a.varianceValue);
};

const buildAllDeliveriesRows = (pos: PORequest[]): ReportRow[] => {
    const data: ReportRow[] = [];

    pos.forEach((po) => {
        if (!po.deliveries || po.deliveries.length === 0) return;

        po.deliveries.forEach((delivery) => {
            delivery.lines.forEach((line) => {
                const poLine = po.lines.find((candidate) => candidate.id === line.poLineId);
                const unitPrice = poLine ? Number(poLine.unitPrice || 0) : 0;
                data.push({
                    id: line.id,
                    site: po.site,
                    poNumber: getPoNumber(po, poLine?.concurPoNumber),
                    supplier: po.supplierName,
                    item: poLine ? poLine.itemName : 'Unknown Item',
                    qty: Number(line.quantity || 0),
                    price: unitPrice,
                    totalPrice: Number(line.quantity || 0) * unitPrice,
                    deliveryDate: delivery.date,
                    docket: delivery.docketNumber || '-',
                    receivedBy: delivery.receivedBy || 'System'
                });
            });
        });
    });

    return data;
};

const buildFinanceRows = (pos: PORequest[]): ReportRow[] => {
    const data: ReportRow[] = [];

    pos.forEach((po) => {
        if (!po.deliveries || po.deliveries.length === 0) return;

        po.deliveries.forEach((delivery) => {
            delivery.lines.forEach((line) => {
                const poLine = po.lines.find((candidate) => candidate.id === line.poLineId);
                const amountEx = Number(line.quantity || 0) * Number(poLine?.unitPrice || 0);
                const taxRate = poLine?.taxRate ?? 10.0;
                const taxAmount = Number((amountEx * (taxRate / 100)).toFixed(2));
                const amountIncGst = Number((amountEx + taxAmount).toFixed(2));
                data.push({
                    id: line.id,
                    poNumber: getPoNumber(po, poLine?.concurPoNumber),
                    supplier: po.supplierName,
                    invoice: line.invoiceNumber || '-',
                    docket: delivery.docketNumber,
                    receivedDate: delivery.date,
                    amount: amountEx,
                    taxAmount,
                    amountIncGst,
                    isCapitalised: line.isCapitalised ? 'Yes' : 'No',
                    capDate: line.capitalisedDate || '-'
                });
            });
        });
    });

    return data;
};

const buildPoStatusRows = (pos: PORequest[]): ReportRow[] => pos.map((po) => {
    const subtotal = po.subtotalAmount ?? po.totalAmount;
    const gst = po.taxTotalAmount ?? Number((subtotal * 0.10).toFixed(2));
    const totalIncGst = po.totalAmountIncGst ?? Number((subtotal + gst).toFixed(2));
    return {
        id: po.id,
        displayId: po.displayId || '',
        supplier: po.supplierName,
        requester: po.requesterName,
        date: po.requestDate,
        subtotalExGst: subtotal,
        taxGst: gst,
        totalIncGst: totalIncGst,
        total: totalIncGst,
        status: po.status,
        lineCount: po.lines.length
    };
});

const buildReconciliationRows = (pos: PORequest[]): DeliveryReconciliationRow[] => {
    return pos.flatMap((po) => po.lines.map((line) => {
        const ordered = Number(line.quantityOrdered || 0);
        const received = Number(line.quantityReceived || 0);
        const unitPrice = Number(line.unitPrice || 0);
        const taxRate = line.taxRate ?? 10.0;
        
        const pendingQty = Math.max(0, ordered - received);
        const overQty = Math.max(0, received - ordered);
        
        const orderedValue = ordered * unitPrice;
        const receivedValue = received * unitPrice;
        const pendingValue = pendingQty * unitPrice;
        const varianceValue = receivedValue - orderedValue;

        const orderedValueIncGst = Number((orderedValue * (1 + taxRate / 100)).toFixed(2));
        const receivedValueIncGst = Number((receivedValue * (1 + taxRate / 100)).toFixed(2));
        const pendingValueIncGst = Number((pendingValue * (1 + taxRate / 100)).toFixed(2));
        const varianceValueIncGst = Number((varianceValue * (1 + taxRate / 100)).toFixed(2));

        return {
            id: line.id,
            poNumber: getPoNumber(po, line.concurPoNumber),
            supplier: po.supplierName,
            site: po.site,
            item: line.itemName,
            orderedQty: ordered,
            receivedQty: received,
            pendingQty,
            overQty,
            unitPrice,
            orderedValue,
            receivedValue,
            pendingValue,
            varianceValue,
            orderedValueIncGst,
            receivedValueIncGst,
            pendingValueIncGst,
            varianceValueIncGst,
            status: po.status
        };
    })).sort((a, b) => b.orderedValue - a.orderedValue);
};

const buildItemRequestHistoryRows = (pos: PORequest[]): ItemRequestHistoryRow[] => {
    return pos.flatMap((po) => po.lines.map((line) => {
        const orderedQty = Number(line.quantityOrdered || 0);
        const receivedQty = Number(line.quantityReceived || 0);
        const unitPrice = Number(line.unitPrice || 0);

        return {
            id: line.id,
            itemId: line.itemId,
            item: line.itemName,
            sku: line.sku,
            site: po.site,
            siteId: po.siteId || '',
            poNumber: getPoNumber(po, line.concurPoNumber),
            displayId: po.displayId || po.id.substring(0, 8),
            supplier: po.supplierName,
            requester: po.requesterName,
            requestDate: po.requestDate,
            orderedQty,
            receivedQty,
            remainingQty: Math.max(0, orderedQty - receivedQty),
            unitPrice,
            totalValue: orderedQty * unitPrice,
            status: po.status,
            latestDeliveryDate: getLatestDeliveryDateForLine(po, line.id)
        };
    })).sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
};

const buildMonthlySummaryRows = (pos: PORequest[], startDateStr: string, endDateStr: string): MonthlySummaryReportRow[] => {
    const startDate = new Date(startDateStr + 'T00:00:00').getTime();
    const endDate = new Date(endDateStr + 'T23:59:59').getTime();
    const rows: MonthlySummaryReportRow[] = [];

    pos.forEach((po) => {
        if (po.status === 'DRAFT' || po.status === 'REJECTED') return;

        const requestTime = new Date(po.requestDate).getTime();
        if (isNaN(requestTime) || requestTime < startDate || requestTime > endDate) return;

        const dateObj = new Date(po.requestDate);
        const year = dateObj.getFullYear();
        const monthNum = dateObj.getMonth();
        const monthKey = `${year}-${String(monthNum + 1).padStart(2, '0')}`;
        const monthDisplay = `${MONTH_NAMES[monthNum]} ${year}`;

        const site = po.site || 'Unknown Site';
        const supplier = po.supplierName || 'Unknown Supplier';

        po.lines.forEach((line) => {
            const ordered = Number(line.quantityOrdered || 0);
            const received = Number(line.quantityReceived || 0);
            const remaining = line.isForceClosed ? 0 : Math.max(0, ordered - received);
            const unitPrice = Number(line.unitPrice || 0);
            const taxRate = line.taxRate ?? 10.0;

            const orderedValue = ordered * unitPrice;
            const receivedValue = received * unitPrice;
            const openValue = remaining * unitPrice;

            const taxAmount = Number((orderedValue * (taxRate / 100)).toFixed(2));
            const orderedValueIncGst = Number((orderedValue + taxAmount).toFixed(2));
            const receivedValueIncGst = Number((receivedValue * (1 + taxRate / 100)).toFixed(2));
            const openValueIncGst = Number((openValue * (1 + taxRate / 100)).toFixed(2));

            const requestNumber = po.displayId || po.id.substring(0, 8);
            const concurRequestNumber = po.concurRequestNumber || '';
            const concurPoNumber = line.concurPoNumber || po.concurPoNumber || '';
            const poNumber = concurPoNumber || 'Pending';

            const deliveryDates = getDeliveryDatesForLine(po, line.id);
            const dockets = getDocketsForLine(po, line.id);
            const invoices = getInvoicesForLine(po, line.id);

            rows.push({
                id: line.id,
                monthKey,
                month: monthDisplay,
                poNumber,
                concurPoNumber,
                requestNumber,
                concurRequestNumber,
                requestDate: po.requestDate,
                needByDate: line.needByDate || (po.requestDate ? po.requestDate.split('T')[0] : ''),
                supplier,
                site,
                item: line.itemName || 'Unknown Item',
                sku: line.sku || '',
                orderedQty: ordered,
                receivedQty: received,
                remainingQty: remaining,
                deliveryDates,
                dockets,
                invoices,
                unitPrice,
                orderedValue,
                receivedValue,
                openValue,
                taxRate,
                taxAmount,
                orderedValueIncGst,
                receivedValueIncGst,
                openValueIncGst,
                status: po.status
            });
        });
    });

    return rows.sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
};

const buildLinenInjectionRows = (pos: PORequest[], itemsList: Item[]): LinenInjectionReportRow[] => {
    const itemCategoryMap = new Map<string, string>();
    (itemsList || []).forEach((item) => {
        if (item.id && item.category) itemCategoryMap.set(item.id, item.category);
        if (item.sku && item.category) itemCategoryMap.set(item.sku, item.category);
    });

    const rows: LinenInjectionReportRow[] = [];

    pos.forEach((po) => {
        if (po.status !== 'CLOSED') return;

        const site = po.site || 'Unknown Site';
        const supplier = po.supplierName || 'Unknown Supplier';
        const requestNumber = po.displayId || po.id.substring(0, 8);
        const concurRequestNumber = po.concurRequestNumber || '';

        const closedEvent = (po.approvalHistory || []).slice().reverse().find(
            (e) => e.action === 'ADMIN_OVERRIDE' || e.comments?.toLowerCase().includes('complete') || e.comments?.toLowerCase().includes('closed')
        );
        const latestDelivery = (po.deliveries || []).map(d => d.date).filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || '-';
        const closedDate = closedEvent?.date || (latestDelivery !== '-' ? latestDelivery : po.requestDate);

        po.lines.forEach((line) => {
            const orderedQty = Number(line.quantityOrdered || 0);
            const receivedQty = Number(line.quantityReceived || 0);
            // In a closed PO, received quantity reflects the physical quantity delivered/injected into the site.
            // If receipts were logged, injectedQty is receivedQty; if closed with 0 recorded receipts, fallback to orderedQty.
            const injectedQty = receivedQty > 0 ? receivedQty : orderedQty;
            const unitPrice = Number(line.unitPrice || 0);
            const injectedValue = injectedQty * unitPrice;
            const orderedValue = orderedQty * unitPrice;
            const taxRate = line.taxRate ?? 10.0;
            const injectedValueIncGst = Number((injectedValue * (1 + taxRate / 100)).toFixed(2));
            const orderedValueIncGst = Number((orderedValue * (1 + taxRate / 100)).toFixed(2));

            const concurPoNumber = line.concurPoNumber || po.concurPoNumber || '';
            const poNumber = getPoNumber(po, line.concurPoNumber);
            const deliveryDates = getDeliveryDatesForLine(po, line.id);
            const latestDeliveryDate = getLatestDeliveryDateForLine(po, line.id);
            const dockets = getDocketsForLine(po, line.id);
            const invoices = getInvoicesForLine(po, line.id);
            const category = itemCategoryMap.get(line.itemId) || itemCategoryMap.get(line.sku) || 'Linen / Textiles';

            rows.push({
                id: line.id,
                poNumber,
                concurPoNumber,
                requestNumber,
                concurRequestNumber,
                requestDate: po.requestDate,
                closedDate,
                latestDeliveryDate,
                deliveryDates,
                dockets,
                invoices,
                site,
                siteId: po.siteId || '',
                supplier,
                supplierId: po.supplierId || '',
                itemId: line.itemId || '',
                item: line.itemName || 'Unknown Item',
                sku: line.sku || '',
                category,
                orderedQty,
                injectedQty,
                unitPrice,
                injectedValue,
                orderedValue,
                injectedValueIncGst,
                orderedValueIncGst,
                requester: po.requesterName || 'Unknown',
                status: po.status
            });
        });
    });

    return rows.sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
};

const buildSupplierInventoryRows = (
    snapshots: any[],
    suppliersList: any[]
): ReportRow[] => {
    const latestMap = new Map<string, any>();
    snapshots.forEach((s) => {
        const key = `${s.supplierId}:${s.supplierSku}`;
        const existing = latestMap.get(key);
        if (!existing || new Date(s.snapshotDate).getTime() > new Date(existing.snapshotDate).getTime()) {
            latestMap.set(key, s);
        }
    });

    const data: ReportRow[] = [];
    latestMap.forEach((snap) => {
        const supplier = suppliersList.find((s) => s.id === snap.supplierId);
        const soh = Number(snap.stockOnHand || 0);
        const sellPrice = Number(snap.sellPrice || 0);
        data.push({
            id: snap.id,
            supplierId: snap.supplierId,
            supplier: supplier ? supplier.name : 'Unknown Supplier',
            supplierSku: snap.supplierSku,
            productName: snap.productName || 'Unknown Product',
            customerStockCode: snap.customerStockCode || '',
            soh,
            available: Number(snap.availableQty || 0),
            committed: Number(snap.committedQty || 0),
            backOrdered: Number(snap.backOrderedQty || 0),
            sellPrice,
            totalValue: soh * sellPrice,
            snapshotDate: snap.snapshotDate ? new Date(snap.snapshotDate).toLocaleDateString() : '-'
        });
    });

    return data.sort((a, b) => String(a.supplier).localeCompare(String(b.supplier)) || String(a.supplierSku).localeCompare(String(b.supplierSku)));
};

const buildSupplierItemMappingRows = (
    mappingsList: any[],
    itemsList: any[],
    suppliersList: any[]
): ReportRow[] => {
    return mappingsList.map((m) => {
        const supplier = suppliersList.find((s) => s.id === m.supplierId);
        const item = itemsList.find((i) => i.id === m.productId);
        return {
            id: m.id,
            supplierId: m.supplierId,
            supplier: supplier ? supplier.name : 'Unknown Supplier',
            supplierSku: m.supplierSku,
            supplierCustomerCode: m.supplierCustomerStockCode || '',
            internalSku: item ? item.sku : '-',
            internalName: item ? item.name : 'Unmapped',
            status: m.mappingStatus || 'PROPOSED',
            method: m.mappingMethod || 'AUTO',
            confidence: Math.round((m.confidenceScore || 0) * 100),
            conversionFactor: m.packConversionFactor || 1,
            updatedAt: m.updatedAt ? new Date(m.updatedAt).toLocaleDateString() : '-'
        };
    }).sort((a, b) => String(a.supplier).localeCompare(String(b.supplier)) || String(a.supplierSku).localeCompare(String(b.supplierSku)));
};

const buildSupplierPriceVarianceRows = (
    mappingsList: any[],
    snapshots: any[],
    itemsList: any[],
    suppliersList: any[]
): ReportRow[] => {
    const latestMap = new Map<string, any>();
    snapshots.forEach((s) => {
        const existing = latestMap.get(`${s.supplierId}:${s.supplierSku}`);
        if (!existing || new Date(s.snapshotDate).getTime() > new Date(existing.snapshotDate).getTime()) {
            latestMap.set(`${s.supplierId}:${s.supplierSku}`, s);
        }
    });

    const data: ReportRow[] = [];
    mappingsList.filter(m => m.mappingStatus === 'CONFIRMED').forEach((m) => {
        const supplier = suppliersList.find((s) => s.id === m.supplierId);
        const item = itemsList.find((i) => i.id === m.productId);
        const snap = latestMap.get(`${m.supplierId}:${m.supplierSku}`);
        
        if (item && snap && snap.sellPrice !== undefined) {
            const supplierPrice = Number(snap.sellPrice || 0);
            const internalPrice = Number(item.unitPrice || 0);
            const varianceAmount = supplierPrice - internalPrice;
            const variancePercent = internalPrice > 0 ? (varianceAmount / internalPrice) * 100 : 0;
            
            let status = 'Matching';
            if (varianceAmount > 0.01) {
                status = 'Supplier Higher';
            } else if (varianceAmount < -0.01) {
                status = 'Supplier Lower';
            }

            data.push({
                id: m.id,
                supplierId: m.supplierId,
                supplier: supplier ? supplier.name : 'Unknown Supplier',
                supplierSku: m.supplierSku,
                internalSku: item.sku,
                internalName: item.name,
                supplierPrice,
                internalPrice,
                varianceAmount,
                variancePercent,
                status
            });
        }
    });

    return data.sort((a, b) => String(a.supplier).localeCompare(String(b.supplier)) || Math.abs(Number(b.varianceAmount)) - Math.abs(Number(a.varianceAmount)));
};

const getMonthlySummaryData = (rows: MonthlySummaryReportRow[]): MonthlySummaryAggregatedRow[] => {
    const summaryMap: Record<string, MonthlySummaryAggregatedRow> = {};

    rows.forEach((row) => {
        const { monthKey, month, orderedValue, receivedValue, openValue, orderedValueIncGst, receivedValueIncGst, openValueIncGst } = row;
        if (!summaryMap[monthKey]) {
            summaryMap[monthKey] = {
                monthKey,
                month,
                totalPoAmount: 0,
                totalPoAmountIncGst: 0,
                grAmount: 0,
                grAmountIncGst: 0,
                openPoAmount: 0,
                openPoAmountIncGst: 0
            };
        }
        summaryMap[monthKey].totalPoAmount += orderedValue;
        summaryMap[monthKey].totalPoAmountIncGst = (summaryMap[monthKey].totalPoAmountIncGst || 0) + (orderedValueIncGst ?? orderedValue * 1.10);
        summaryMap[monthKey].grAmount += receivedValue;
        summaryMap[monthKey].grAmountIncGst = (summaryMap[monthKey].grAmountIncGst || 0) + (receivedValueIncGst ?? receivedValue * 1.10);
        summaryMap[monthKey].openPoAmount += openValue;
        summaryMap[monthKey].openPoAmountIncGst = (summaryMap[monthKey].openPoAmountIncGst || 0) + (openValueIncGst ?? openValue * 1.10);
    });

    return Object.values(summaryMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
};

const getCsvColumns = (report: ReportType, data: ReportRow[]): CsvColumn[] => {
    if (report === 'OUTSTANDING_DELIVERIES') {
        return [
            { key: 'poNumber', label: 'PO Number' },
            { key: 'supplier', label: 'Supplier' },
            { key: 'site', label: 'Site' },
            { key: 'item', label: 'Item' },
            { key: 'latestDeliveryDate', label: 'Latest Delivery Date' },
            { key: 'deliveryDates', label: 'Delivery Dates' },
            { key: 'ordered', label: 'Ordered Qty' },
            { key: 'received', label: 'Received Qty' },
            { key: 'remaining', label: 'Remaining Qty' },
            { key: 'unitPrice', label: 'Unit Price' },
            { key: 'remainingValue', label: 'Remaining Value' },
            { key: 'completionPct', label: 'Completion %' },
            { key: 'status', label: 'PO Status' }
        ];
    }

    if (report === 'DELIVERY_VARIANCE') {
        return [
            { key: 'exceptionType', label: 'Exception Type' },
            { key: 'poNumber', label: 'PO Number' },
            { key: 'supplier', label: 'Supplier' },
            { key: 'site', label: 'Site' },
            { key: 'item', label: 'Item' },
            { key: 'requestDate', label: 'Request Raised Date' },
            { key: 'deliveryDate', label: 'Latest Delivery Date' },
            { key: 'qtyOrdered', label: 'Ordered Qty' },
            { key: 'qtyReceived', label: 'Received Qty' },
            { key: 'deltaQty', label: 'Delta Qty' },
            { key: 'unitPrice', label: 'Unit Price' },
            { key: 'varianceValue', label: 'Variance Value' },
            { key: 'status', label: 'PO Status' }
        ];
    }

    if (report === 'DELIVERY_RECONCILIATION') {
        return [
            { key: 'poNumber', label: 'PO Number' },
            { key: 'supplier', label: 'Supplier' },
            { key: 'site', label: 'Site' },
            { key: 'item', label: 'Item' },
            { key: 'orderedQty', label: 'Ordered Qty' },
            { key: 'receivedQty', label: 'Received Qty' },
            { key: 'pendingQty', label: 'Pending Qty' },
            { key: 'overQty', label: 'Over Qty' },
            { key: 'unitPrice', label: 'Unit Price' },
            { key: 'orderedValue', label: 'Ordered Value (Ex GST)' },
            { key: 'orderedValueIncGst', label: 'Ordered Value (Inc GST)' },
            { key: 'receivedValue', label: 'Delivered Value (Ex GST)' },
            { key: 'receivedValueIncGst', label: 'Delivered Value (Inc GST)' },
            { key: 'pendingValue', label: 'Pending Value (Ex GST)' },
            { key: 'varianceValue', label: 'Value Variance (Ex GST)' },
            { key: 'status', label: 'PO Status' }
        ];
    }

    if (report === 'ITEM_REQUEST_HISTORY') {
        return [
            { key: 'item', label: 'Item' },
            { key: 'sku', label: 'SKU' },
            { key: 'site', label: 'Site' },
            { key: 'requestDate', label: 'Request Date' },
            { key: 'poNumber', label: 'PO Number' },
            { key: 'displayId', label: 'Request ID' },
            { key: 'supplier', label: 'Supplier' },
            { key: 'requester', label: 'Requester' },
            { key: 'orderedQty', label: 'Ordered Qty' },
            { key: 'receivedQty', label: 'Received Qty' },
            { key: 'remainingQty', label: 'Remaining Qty' },
            { key: 'unitPrice', label: 'Unit Price' },
            { key: 'totalValue', label: 'Ordered Value' },
            { key: 'latestDeliveryDate', label: 'Latest Delivery Date' },
            { key: 'status', label: 'PO Status' }
        ];
    }

    if (report === 'FINANCE_SUMMARY') {
        return [
            { key: 'receivedDate', label: 'Received Date' },
            { key: 'docket', label: 'Docket Number' },
            { key: 'supplier', label: 'Supplier' },
            { key: 'poNumber', label: 'PO Number' },
            { key: 'invoice', label: 'Invoice Number' },
            { key: 'amount', label: 'Value (Ex GST)' },
            { key: 'taxAmount', label: 'GST (10%)' },
            { key: 'amountIncGst', label: 'Total (Inc GST)' },
            { key: 'isCapitalised', label: 'Capitalised' },
            { key: 'capDate', label: 'Capitalised Date' }
        ];
    }

    if (report === 'PO_STATUS') {
        return [
            { key: 'displayId', label: 'Request / PO Number' },
            { key: 'supplier', label: 'Supplier' },
            { key: 'requester', label: 'Requester' },
            { key: 'date', label: 'Request Date' },
            { key: 'subtotalExGst', label: 'Subtotal (Ex GST)' },
            { key: 'taxGst', label: 'GST (10%)' },
            { key: 'totalIncGst', label: 'Total (Inc GST / Concur)' },
            { key: 'lineCount', label: 'Item Lines' },
            { key: 'status', label: 'Status' }
        ];
    }

    if (report === 'MONTHLY_SUMMARY') {
        return [
            { key: 'month', label: 'Month' },
            { key: 'requestNumber', label: 'Request Number' },
            { key: 'concurRequestNumber', label: 'Concur Request Number' },
            { key: 'poNumber', label: 'PO Number' },
            { key: 'concurPoNumber', label: 'Concur PO Number' },
            { key: 'needByDate', label: 'Need by Date' },
            { key: 'requestDate', label: 'Request Date' },
            { key: 'site', label: 'Site' },
            { key: 'supplier', label: 'Supplier' },
            { key: 'item', label: 'Item' },
            { key: 'sku', label: 'SKU' },
            { key: 'orderedQty', label: 'Ordered Qty' },
            { key: 'receivedQty', label: 'Received Qty' },
            { key: 'remainingQty', label: 'Remaining Qty' },
            { key: 'deliveryDates', label: 'Delivery Dates' },
            { key: 'dockets', label: 'Delivery Dockets' },
            { key: 'invoices', label: 'Invoice Numbers' },
            { key: 'unitPrice', label: 'Unit Price (Ex GST)' },
            { key: 'orderedValue', label: 'Ordered Value (Ex GST)' },
            { key: 'taxAmount', label: 'GST (10%)' },
            { key: 'orderedValueIncGst', label: 'Ordered Value (Inc GST)' },
            { key: 'receivedValue', label: 'Received Value (Ex GST)' },
            { key: 'receivedValueIncGst', label: 'Received Value (Inc GST)' },
            { key: 'openValue', label: 'Open Value (Ex GST)' },
            { key: 'openValueIncGst', label: 'Open Value (Inc GST)' },
            { key: 'status', label: 'PO Status' }
        ];
    }

    if (report === 'LINEN_INJECTION') {
        return [
            { key: 'requestNumber', label: 'Request Number' },
            { key: 'concurRequestNumber', label: 'Concur Request Number' },
            { key: 'poNumber', label: 'PO Number' },
            { key: 'concurPoNumber', label: 'Concur PO Number' },
            { key: 'requestDate', label: 'Request Date' },
            { key: 'closedDate', label: 'Completion / Closed Date' },
            { key: 'site', label: 'Site' },
            { key: 'supplier', label: 'Supplier' },
            { key: 'item', label: 'Item Name' },
            { key: 'sku', label: 'SKU' },
            { key: 'category', label: 'Category' },
            { key: 'injectedQty', label: 'Injected QTY' },
            { key: 'orderedQty', label: 'Ordered QTY' },
            { key: 'unitPrice', label: 'Unit Price' },
            { key: 'injectedValue', label: 'Injected Value ($)' },
            { key: 'orderedValue', label: 'Ordered Value ($)' },
            { key: 'deliveryDates', label: 'Delivery Dates' },
            { key: 'dockets', label: 'Delivery Dockets' },
            { key: 'invoices', label: 'Invoice Numbers' },
            { key: 'requester', label: 'Requester' },
            { key: 'status', label: 'Status' }
        ];
    }

    if (report === 'SUPPLIER_INVENTORY') {
        return [
            { key: 'supplier', label: 'Supplier' },
            { key: 'supplierSku', label: 'Supplier SKU' },
            { key: 'productName', label: 'Product Name' },
            { key: 'customerStockCode', label: 'Customer Stock Code' },
            { key: 'soh', label: 'SOH' },
            { key: 'available', label: 'Available' },
            { key: 'committed', label: 'Committed' },
            { key: 'backOrdered', label: 'Back Ordered' },
            { key: 'sellPrice', label: 'Sell Price' },
            { key: 'totalValue', label: 'Total Value' },
            { key: 'snapshotDate', label: 'As Of' }
        ];
    }
    if (report === 'SUPPLIER_ITEM_MAPPING') {
        return [
            { key: 'supplier', label: 'Supplier' },
            { key: 'supplierSku', label: 'Supplier SKU' },
            { key: 'supplierCustomerCode', label: 'Customer Code Ref' },
            { key: 'internalSku', label: 'Mapped Internal SKU' },
            { key: 'internalName', label: 'Mapped Item Name' },
            { key: 'confidence', label: 'Confidence %' },
            { key: 'method', label: 'Method' },
            { key: 'conversionFactor', label: 'Factor' },
            { key: 'status', label: 'Status' },
            { key: 'updatedAt', label: 'Updated At' }
        ];
    }
    if (report === 'SUPPLIER_PRICE_VARIANCE') {
        return [
            { key: 'supplier', label: 'Supplier' },
            { key: 'supplierSku', label: 'Supplier SKU' },
            { key: 'internalSku', label: 'Internal SKU' },
            { key: 'internalName', label: 'Mapped Name' },
            { key: 'supplierPrice', label: 'Supplier Price' },
            { key: 'internalPrice', label: 'Catalog Price' },
            { key: 'varianceAmount', label: 'Variance $' },
            { key: 'variancePercent', label: 'Variance %' },
            { key: 'status', label: 'Status' }
        ];
    }

    return data[0] ? Object.keys(data[0]).map((key) => ({ key, label: key })) : [];
};

const escapeCsvValue = (value: string | number | undefined) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const buildCsv = (report: ReportType, data: ReportRow[]) => {
    const columns = getCsvColumns(report, data);
    const headers = columns.map((column) => escapeCsvValue(column.label)).join(',');
    const rows = data.map((row) => columns.map((column) => escapeCsvValue(row[column.key])).join(','));
    return [headers, ...rows].join('\n');
};

const ReportingView = () => {
    const { pos, allPos, sites, cachedReports, cachedRunTimes, setReportCache, stockSnapshots, mappings, items, suppliers, hasPermission } = useApp();
    const reportPos = (allPos && allPos.length > 0) ? allPos : pos;
    useSetPageMeta({ disableBodyScroll: true });
    const [activeReport, setActiveReport] = useState<ReportType>(() => {
        const saved = sessionStorage.getItem('pf_active_report');
        return (saved as ReportType) || 'OUTSTANDING_DELIVERIES';
    });
    const [isLoading, setIsLoading] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('CHART');
    const [chartMetric, setChartMetric] = useState<ChartMetric>('SUPPLIER');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSite, setSelectedSite] = useState('ALL');
    const [selectedSupplier, setSelectedSupplier] = useState('ALL');
    const [selectedItemId, setSelectedItemId] = useState('ALL');
    const [dateRangeType, setDateRangeType] = useState<'RECENT' | 'HISTORICAL' | 'ALL' | 'CUSTOM'>(() => {
        const saved = sessionStorage.getItem('pf_active_report');
        return saved === 'LINEN_INJECTION' ? 'ALL' : 'RECENT';
    });
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [monthlyStartDate, setMonthlyStartDate] = useState('2025-07-01');
    const [monthlyEndDate, setMonthlyEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    const handleStartDateChange = (val: string) => {
        setMonthlyStartDate(val);
        setReportCache('MONTHLY_SUMMARY', []);
    };

    const handleEndDateChange = (val: string) => {
        setMonthlyEndDate(val);
        setReportCache('MONTHLY_SUMMARY', []);
    };

    useEffect(() => {
        sessionStorage.setItem('pf_active_report', activeReport);
    }, [activeReport]);

    const reportData = (cachedReports[activeReport] || []) as ReportRow[];
    const lastRun = cachedRunTimes[activeReport];
    const isDeliveryReport = DELIVERY_REPORTS.includes(activeReport);
    const isItemHistoryReport = activeReport === 'ITEM_REQUEST_HISTORY';
    const isLinenInjectionReport = activeReport === 'LINEN_INJECTION';
    const isDateFilterableReport = isItemHistoryReport || isLinenInjectionReport;
    const isFilterableReport = FILTERABLE_REPORTS.includes(activeReport);
    const canUseChart = activeReport === 'ALL_DELIVERIES' || isDeliveryReport || isItemHistoryReport || activeReport === 'MONTHLY_SUMMARY' || isLinenInjectionReport || activeReport === 'SUPPLIER_INVENTORY' || activeReport === 'SUPPLIER_ITEM_MAPPING' || activeReport === 'SUPPLIER_PRICE_VARIANCE';

    const siteOptions = useMemo(() => {
        const fromData = reportData.map((row) => String(row.site || '')).filter(Boolean);
        const fromContext = (sites || []).map((s) => s.name).filter(Boolean);
        return ['ALL', ...Array.from(new Set([...fromData, ...fromContext])).sort((a, b) => a.localeCompare(b))];
    }, [reportData, sites]);
    const supplierOptions = useMemo(() => ['ALL', ...Array.from(new Set(reportData.map((row) => String(row.supplier || '')).filter(Boolean))).sort((a, b) => a.localeCompare(b))], [reportData]);

    const itemOptions = useMemo(() => {
        const options = new Map<string, { id: string; label: string }>();
        reportData.forEach((row) => {
            const id = String(row.itemId || row.item || '');
            if (!id) return;
            const sku = String(row.sku || '').trim();
            const label = `${String(row.item || 'Unknown Item')}${sku ? ` (${sku})` : ''}`;
            if (!options.has(id)) options.set(id, { id, label });
        });
        return [{ id: 'ALL', label: 'All items' }, ...Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label))];
    }, [reportData]);

    const visibleReportData = useMemo(() => {
        if (!isFilterableReport) return reportData;

        const query = searchTerm.trim().toLowerCase();
        return reportData.filter((row) => {
            const matchesSearch = !query || [
                row.poNumber,
                row.concurPoNumber,
                row.requestNumber,
                row.concurRequestNumber,
                row.dockets,
                row.invoices,
                row.displayId,
                row.supplier,
                row.site,
                row.item,
                row.sku,
                row.category,
                row.requester,
                row.status,
                row.exceptionType,
                row.month
            ].some((value) => String(value || '').toLowerCase().includes(query));
            const matchesSite = selectedSite === 'ALL' || row.site === selectedSite;
            const matchesSupplier = selectedSupplier === 'ALL' || row.supplier === selectedSupplier;
            const matchesItem = selectedItemId === 'ALL' || row.itemId === selectedItemId || row.item === selectedItemId;

            let matchesDate = true;
            if (isDateFilterableReport) {
                if (dateRangeType === 'ALL') {
                    matchesDate = true;
                } else {
                    const rawDate = (activeReport === 'LINEN_INJECTION' ? (row.closedDate || row.latestDeliveryDate || row.requestDate) : row.requestDate) as string;
                    if (rawDate && rawDate !== '-') {
                        const dateTime = new Date(rawDate).getTime();
                        if (!isNaN(dateTime)) {
                            if (dateRangeType === 'RECENT') {
                                const threshold = new Date();
                                threshold.setDate(threshold.getDate() - 30);
                                matchesDate = dateTime >= threshold.getTime();
                            } else if (dateRangeType === 'HISTORICAL') {
                                const startDate = new Date('2025-07-01T00:00:00');
                                matchesDate = dateTime >= startDate.getTime();
                            } else if (dateRangeType === 'CUSTOM') {
                                if (customStartDate) {
                                    const start = new Date(customStartDate + 'T00:00:00');
                                    if (!isNaN(start.getTime())) {
                                        matchesDate = matchesDate && dateTime >= start.getTime();
                                    }
                                }
                                if (customEndDate) {
                                    const end = new Date(customEndDate + 'T23:59:59');
                                    if (!isNaN(end.getTime())) {
                                        matchesDate = matchesDate && dateTime <= end.getTime();
                                    }
                                }
                            }
                        }
                    }
                }
            }

            return matchesSearch && matchesSite && matchesSupplier && matchesItem && matchesDate;
        });
    }, [isFilterableReport, isDateFilterableReport, activeReport, reportData, searchTerm, selectedItemId, selectedSite, selectedSupplier, dateRangeType, customStartDate, customEndDate]);

    const outstandingRows = visibleReportData as OutstandingDeliveryReportRow[];
    const varianceRows = visibleReportData as DeliveryVarianceReportRow[];
    const outstandingSummary = useMemo(() => {
        const totalValue = outstandingRows.reduce((sum, row) => sum + row.remainingValue, 0);
        const totalUnits = outstandingRows.reduce((sum, row) => sum + row.remaining, 0);
        const avgCompletion = outstandingRows.length ? outstandingRows.reduce((sum, row) => sum + row.completionPct, 0) / outstandingRows.length : 0;
        return { totalValue, totalUnits, avgCompletion, lineCount: outstandingRows.length };
    }, [outstandingRows]);
    const reconciliationRows = visibleReportData as DeliveryReconciliationRow[];
    const itemHistoryRows = visibleReportData as ItemRequestHistoryRow[];
    const linenInjectionRows = visibleReportData as LinenInjectionReportRow[];

    const reconciliationSummary = useMemo(() => {
        const totalOrdered = reconciliationRows.reduce((sum, row) => sum + row.orderedValue, 0);
        const totalReceived = reconciliationRows.reduce((sum, row) => sum + row.receivedValue, 0);
        const totalPending = reconciliationRows.reduce((sum, row) => sum + row.pendingValue, 0);
        const totalVariance = reconciliationRows.reduce((sum, row) => sum + row.varianceValue, 0);
        return { totalOrdered, totalReceived, totalPending, totalVariance, lineCount: reconciliationRows.length };
    }, [reconciliationRows]);

    const varianceSummary = useMemo(() => {
        const pending = varianceRows.filter((row) => row.exceptionType === 'Pending');
        const over = varianceRows.filter((row) => row.exceptionType === 'Over delivered');
        const shortClosed = varianceRows.filter((row) => row.exceptionType === 'Short closed');
        return {
            totalValue: varianceRows.reduce((sum, row) => sum + row.varianceValue, 0),
            pendingValue: pending.reduce((sum, row) => sum + row.varianceValue, 0),
            overValue: over.reduce((sum, row) => sum + row.varianceValue, 0),
            shortClosedValue: shortClosed.reduce((sum, row) => sum + row.varianceValue, 0),
            pendingCount: pending.length,
            overCount: over.length,
            shortClosedCount: shortClosed.length
        };
    }, [varianceRows]);

    const itemHistorySummary = useMemo(() => {
        const latestBySite = new Map<string, ItemRequestHistoryRow>();
        itemHistoryRows.forEach((row) => {
            const current = latestBySite.get(row.site);
            if (!current || new Date(row.requestDate).getTime() > new Date(current.requestDate).getTime()) {
                latestBySite.set(row.site, row);
            }
        });

        return {
            lineCount: itemHistoryRows.length,
            siteCount: latestBySite.size,
            totalOrdered: itemHistoryRows.reduce((sum, row) => sum + row.orderedQty, 0),
            totalValue: itemHistoryRows.reduce((sum, row) => sum + row.totalValue, 0),
            latestRowsBySite: Array.from(latestBySite.values()).sort((a, b) => a.site.localeCompare(b.site))
        };
    }, [itemHistoryRows]);

    const linenInjectionSummary = useMemo(() => {
        const totalInjectedValue = linenInjectionRows.reduce((sum, row) => sum + row.injectedValue, 0);
        const totalInjectedUnits = linenInjectionRows.reduce((sum, row) => sum + row.injectedQty, 0);
        const totalOrderedUnits = linenInjectionRows.reduce((sum, row) => sum + row.orderedQty, 0);
        const totalOrderedValue = linenInjectionRows.reduce((sum, row) => sum + row.orderedValue, 0);
        const uniquePos = new Set(linenInjectionRows.map((row) => row.poNumber || row.requestNumber));
        const uniqueSites = new Set(linenInjectionRows.map((row) => row.site));
        const uniqueSuppliers = new Set(linenInjectionRows.map((row) => row.supplier));
        const uniqueItems = new Set(linenInjectionRows.map((row) => row.item));

        return {
            totalInjectedValue,
            totalInjectedUnits,
            totalOrderedUnits,
            totalOrderedValue,
            closedPoCount: uniquePos.size,
            lineCount: linenInjectionRows.length,
            siteCount: uniqueSites.size,
            supplierCount: uniqueSuppliers.size,
            itemCount: uniqueItems.size
        };
    }, [linenInjectionRows]);

    const handleSiteChange = (site: string) => {
        setSelectedSite(site);
        if (activeReport === 'LINEN_INJECTION') {
            if (site !== 'ALL' && chartMetric === 'SITE') {
                setChartMetric('ITEM');
            } else if (site === 'ALL' && chartMetric === 'ITEM') {
                setChartMetric('SITE');
            }
        }
    };

    const switchReport = (report: ReportType) => {
        setActiveReport(report);
        setViewMode('CHART');
        setChartMetric(report === 'ALL_DELIVERIES' ? 'DATE' : report === 'LINEN_INJECTION' ? 'SITE' : 'SUPPLIER');
        setSearchTerm('');
        setSelectedSite('ALL');
        setSelectedSupplier('ALL');
        setSelectedItemId('ALL');
        setDateRangeType(report === 'LINEN_INJECTION' ? 'ALL' : 'RECENT');
        setCustomStartDate('');
        setCustomEndDate('');
        setMonthlyStartDate('2025-07-01');
        setMonthlyEndDate(() => new Date().toISOString().split('T')[0]);
    };

    const runReport = () => {
        setIsLoading(true);

        window.setTimeout(() => {
            let data: ReportRow[] = [];

            if (activeReport === 'OUTSTANDING_DELIVERIES') {
                data = buildOutstandingDeliveryRows(reportPos);
            } else if (activeReport === 'DELIVERY_VARIANCE') {
                data = buildDeliveryVarianceRows(reportPos);
            } else if (activeReport === 'FINANCE_SUMMARY') {
                data = buildFinanceRows(reportPos);
            } else if (activeReport === 'ALL_DELIVERIES') {
                data = buildAllDeliveriesRows(reportPos);
            } else if (activeReport === 'PO_STATUS') {
                data = buildPoStatusRows(reportPos);
            } else if (activeReport === 'DELIVERY_RECONCILIATION') {
                data = buildReconciliationRows(reportPos);
            } else if (activeReport === 'ITEM_REQUEST_HISTORY') {
                data = buildItemRequestHistoryRows(reportPos);
            } else if (activeReport === 'MONTHLY_SUMMARY') {
                data = buildMonthlySummaryRows(reportPos, monthlyStartDate, monthlyEndDate);
            } else if (activeReport === 'LINEN_INJECTION') {
                data = buildLinenInjectionRows(reportPos, items);
            } else if (activeReport === 'SUPPLIER_INVENTORY') {
                data = buildSupplierInventoryRows(stockSnapshots, suppliers);
            } else if (activeReport === 'SUPPLIER_ITEM_MAPPING') {
                data = buildSupplierItemMappingRows(mappings, items, suppliers);
            } else if (activeReport === 'SUPPLIER_PRICE_VARIANCE') {
                data = buildSupplierPriceVarianceRows(mappings, stockSnapshots, items, suppliers);
            }

            setReportCache(activeReport, data);
            setIsLoading(false);
        }, 500);
    };

    const exportCSV = () => {
        if (visibleReportData.length === 0) return;

        const csv = buildCsv(activeReport, visibleReportData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', reportFileName(activeReport));
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const getChartData = () => {
        if (visibleReportData.length === 0) return [];

        const aggregated: Record<string, number> = {};
        visibleReportData.forEach((row) => {
            let key = 'Unknown';
            if (chartMetric === 'DATE') key = String(row.deliveryDate || row.date || 'Unknown');
            if (chartMetric === 'SUPPLIER') key = String(row.supplier || 'Unknown');
            if (chartMetric === 'SITE') key = String(row.site || 'Unknown');
            if (chartMetric === 'ITEM') key = String(row.item || 'Unknown');

            const value = activeReport === 'ALL_DELIVERIES' ? Number(row.totalPrice || 0) : Number(row.totalValue || 0);
            aggregated[key] = (aggregated[key] || 0) + value;
        });

        return Object.entries(aggregated)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => (chartMetric === 'DATE' ? a.name.localeCompare(b.name) : b.value - a.value));
    };

    const outstandingChartData = useMemo(() => {
        const grouped: Record<string, { name: string; remainingValue: number; remainingUnits: number; lineCount: number }> = {};
        const groupBy = chartMetric === 'SITE' ? 'site' : 'supplier';

        outstandingRows.forEach((row) => {
            const key = String(row[groupBy] || 'Unknown');
            grouped[key] ||= { name: key, remainingValue: 0, remainingUnits: 0, lineCount: 0 };
            grouped[key].remainingValue += row.remainingValue;
            grouped[key].remainingUnits += row.remaining;
            grouped[key].lineCount += 1;
        });

        return Object.values(grouped).sort((a, b) => b.remainingValue - a.remainingValue).slice(0, 12);
    }, [chartMetric, outstandingRows]);

    const varianceChartData = useMemo(() => {
        const grouped: Record<string, { name: string; pendingValue: number; overValue: number; shortClosedValue: number }> = {};
        const groupBy = chartMetric === 'SITE' ? 'site' : 'supplier';

        varianceRows.forEach((row) => {
            const key = String(row[groupBy] || 'Unknown');
            grouped[key] ||= { name: key, pendingValue: 0, overValue: 0, shortClosedValue: 0 };
            if (row.exceptionType === 'Pending') grouped[key].pendingValue += row.varianceValue;
            if (row.exceptionType === 'Over delivered') grouped[key].overValue += row.varianceValue;
            if (row.exceptionType === 'Short closed') grouped[key].shortClosedValue += row.varianceValue;
        });

        return Object.values(grouped)
            .sort((a, b) => (b.pendingValue + b.overValue + b.shortClosedValue) - (a.pendingValue + a.overValue + a.shortClosedValue))
            .slice(0, 12);
    }, [chartMetric, varianceRows]);

    const itemHistoryChartData = useMemo(() => {
        const grouped: Record<string, { name: string; orderedQty: number; requestCount: number; orderedValue: number; latestRequest: string }> = {};
        itemHistoryRows.forEach((row) => {
            let key = 'Unknown';
            if (chartMetric === 'ITEM') {
                const skuStr = row.sku ? ` (${row.sku})` : '';
                key = `${row.item || 'Unknown'}${skuStr}`;
            } else if (chartMetric === 'SUPPLIER') {
                key = row.supplier || 'Unknown';
            } else if (chartMetric === 'SITE') {
                key = row.site || 'Unknown';
            } else if (chartMetric === 'DATE') {
                key = row.requestDate || 'Unknown';
            }

            grouped[key] ||= { name: key, orderedQty: 0, requestCount: 0, orderedValue: 0, latestRequest: row.requestDate };
            grouped[key].orderedQty += row.orderedQty;
            grouped[key].requestCount += 1;
            grouped[key].orderedValue += row.totalValue;
            if (new Date(row.requestDate).getTime() > new Date(grouped[key].latestRequest).getTime()) {
                grouped[key].latestRequest = row.requestDate;
            }
        });

        return Object.values(grouped).sort((a, b) => b.orderedQty - a.orderedQty).slice(0, 12);
    }, [itemHistoryRows, chartMetric]);

    const linenInjectionChartData = useMemo(() => {
        const grouped: Record<string, { name: string; injectedValue: number; orderedValue: number; injectedQty: number; orderedQty: number; lineCount: number }> = {};
        linenInjectionRows.forEach((row) => {
            let key = 'Unknown';
            if (chartMetric === 'SITE') key = row.site || 'Unknown Site';
            else if (chartMetric === 'SUPPLIER') key = row.supplier || 'Unknown Supplier';
            else if (chartMetric === 'ITEM') {
                const skuStr = row.sku ? ` (${row.sku})` : '';
                key = `${row.item || 'Unknown'}${skuStr}`;
            } else if (chartMetric === 'DATE') {
                const dateObj = new Date(row.requestDate);
                if (!isNaN(dateObj.getTime())) {
                    key = `${MONTH_NAMES[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
                } else {
                    key = row.requestDate || 'Unknown';
                }
            }

            grouped[key] ||= { name: key, injectedValue: 0, orderedValue: 0, injectedQty: 0, orderedQty: 0, lineCount: 0 };
            grouped[key].injectedValue += row.injectedValue;
            grouped[key].orderedValue += row.orderedValue;
            grouped[key].injectedQty += row.injectedQty;
            grouped[key].orderedQty += row.orderedQty;
            grouped[key].lineCount += 1;
        });

        return Object.values(grouped).sort((a, b) => b.injectedValue - a.injectedValue).slice(0, 12);
    }, [linenInjectionRows, chartMetric]);

    const hasActiveFilters = Boolean(
        searchTerm.trim() ||
        selectedSite !== 'ALL' ||
        selectedSupplier !== 'ALL' ||
        selectedItemId !== 'ALL' ||
        (activeReport === 'MONTHLY_SUMMARY' && (
            monthlyStartDate !== '2025-07-01' ||
            monthlyEndDate !== new Date().toISOString().split('T')[0]
        )) ||
        (isDateFilterableReport && (
            dateRangeType !== 'RECENT' ||
            customStartDate !== '' ||
            customEndDate !== ''
        ))
    );

    if (!hasPermission('view_reports')) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center p-8 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 shadow-xl max-w-md">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <BarChart3 size={32} />
                    </div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">Access Restricted</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">You do not have the 'view_reports' permission required to access the Reporting tools.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col space-y-4 md:space-y-6 overflow-hidden pb-20 md:pb-0 animate-fade-in">
            <PageHeader title="Reports & Analytics" subtitle="Generate reports for delivery tracking and financial auditing." />

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 flex-1 min-h-0 overflow-hidden">
                <div className="xl:col-span-1 space-y-2 flex flex-col min-h-0 shrink-0">
                    <div className="bg-white dark:bg-nocturne rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-2 overflow-y-auto max-h-[300px] xl:max-h-none">
                        <div className="flex flex-col sm:flex-row xl:flex-col gap-2">
                            <ReportButton active={activeReport === 'OUTSTANDING_DELIVERIES'} icon={AlertCircle} label="Outstanding Deliveries" onClick={() => switchReport('OUTSTANDING_DELIVERIES')} />
                            <ReportButton active={activeReport === 'ALL_DELIVERIES'} icon={Package} label="All Deliveries" onClick={() => switchReport('ALL_DELIVERIES')} />
                            <ReportButton active={activeReport === 'LINEN_INJECTION'} icon={PackageCheck} label="Linen Injection" onClick={() => switchReport('LINEN_INJECTION')} />
                            <ReportButton active={activeReport === 'DELIVERY_VARIANCE'} icon={TrendingUp} label="Delivery Variance" onClick={() => switchReport('DELIVERY_VARIANCE')} />
                            <ReportButton active={activeReport === 'DELIVERY_RECONCILIATION'} icon={Layers} label="Full Reconciliation" onClick={() => switchReport('DELIVERY_RECONCILIATION')} />
                            <ReportButton active={activeReport === 'ITEM_REQUEST_HISTORY'} icon={History} label="Item Request History" onClick={() => switchReport('ITEM_REQUEST_HISTORY')} />
                            <ReportButton active={activeReport === 'MONTHLY_SUMMARY'} icon={Calendar} label="Monthly PO & GR Summary" onClick={() => switchReport('MONTHLY_SUMMARY')} />
                            <ReportButton active={activeReport === 'FINANCE_SUMMARY'} icon={TrendingUp} label="Finance Summary" onClick={() => switchReport('FINANCE_SUMMARY')} />
                            <ReportButton active={activeReport === 'PO_STATUS'} icon={FileText} label="PO Status Report" onClick={() => switchReport('PO_STATUS')} />
                            <div className="border-t border-gray-200 dark:border-gray-800 my-2 pt-2 text-[10px] font-black text-gray-400 uppercase tracking-widest px-4">Supplier Insights</div>
                            <ReportButton active={activeReport === 'SUPPLIER_INVENTORY'} icon={Package} label="Supplier Available Inventory" onClick={() => switchReport('SUPPLIER_INVENTORY')} />
                            <ReportButton active={activeReport === 'SUPPLIER_ITEM_MAPPING'} icon={ArrowRightLeft} label="Supplier Item Mapping" onClick={() => switchReport('SUPPLIER_ITEM_MAPPING')} />
                            <ReportButton active={activeReport === 'SUPPLIER_PRICE_VARIANCE'} icon={TrendingUp} label="Supplier Price Variance" onClick={() => switchReport('SUPPLIER_PRICE_VARIANCE')} />
                        </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl p-4">
                        <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase mb-2">Report Description</h4>
                        <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">{REPORT_DESCRIPTIONS[activeReport]}</p>
                    </div>
                </div>

                <div className="xl:col-span-3 flex flex-col min-h-0">
                    <div className="bg-white dark:bg-nocturne rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col flex-1 min-h-0 overflow-hidden">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col lg:flex-row justify-between lg:items-center gap-4 shrink-0">
                            <div className="min-w-0">
                                <h2 className="font-bold text-gray-900 dark:text-white">{REPORT_TITLES[activeReport]}</h2>
                                {lastRun && <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 flex items-center gap-1"><CheckCircle2 size={10} /> Data updated at: {lastRun}</p>}
                            </div>
                            <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full lg:w-auto">
                                <button type="button" onClick={runReport} disabled={isLoading} className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
                                    {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <BarChart3 size={16} />}
                                    Run Report
                                </button>
                                <button type="button" onClick={exportCSV} className="btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto" disabled={visibleReportData.length === 0}>
                                    <Download size={16} /> Export CSV
                                </button>
                            </div>
                        </div>

                        {reportData.length > 0 && !isLoading && (
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5 space-y-3 shrink-0">
                                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                                    {canUseChart ? (
                                        <div className="flex bg-white dark:bg-[#15171e] p-1 rounded-lg border border-gray-200 dark:border-gray-800 w-full sm:w-fit">
                                            <button
                                                type="button"
                                                onClick={() => setViewMode('CHART')}
                                                className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'CHART' ? 'bg-[var(--color-brand)] text-white shadow-sm' : 'text-secondary dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                                            >
                                                Interactive Chart
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setViewMode('RAW_DATA')}
                                                className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'RAW_DATA' ? 'bg-[var(--color-brand)] text-white shadow-sm' : 'text-secondary dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                                            >
                                                Raw Data
                                            </button>
                                        </div>
                                    ) : <div />}

                                    {canUseChart && viewMode === 'CHART' && (
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="text-sm font-bold text-gray-900 dark:text-white flex flex-wrap items-center gap-x-4 gap-y-1">
                                                {activeReport !== 'MONTHLY_SUMMARY' && activeReport !== 'LINEN_INJECTION' && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-medium text-tertiary dark:text-gray-500">
                                                            {activeReport === 'OUTSTANDING_DELIVERIES' ? 'Total Outstanding:' : activeReport === 'DELIVERY_VARIANCE' ? 'Total Variance:' : activeReport === 'ITEM_REQUEST_HISTORY' ? 'Total Ordered Units:' : 'Total Value:'}
                                                        </span>
                                                        {activeReport === 'OUTSTANDING_DELIVERIES' && currency(outstandingSummary.totalValue)}
                                                        {activeReport === 'DELIVERY_VARIANCE' && currency(varianceSummary.totalValue)}
                                                        {activeReport === 'ALL_DELIVERIES' && currency(getChartData().reduce((sum, item) => sum + item.value, 0))}
                                                        {activeReport === 'ITEM_REQUEST_HISTORY' && numberValue(itemHistorySummary.totalOrdered)}
                                                    </div>
                                                )}
                                                {activeReport === 'ITEM_REQUEST_HISTORY' && (
                                                    <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-gray-800 pl-4">
                                                        <span className="text-xs font-medium text-tertiary dark:text-gray-500">Total Ordered Value:</span>
                                                        {currency(itemHistorySummary.totalValue)}
                                                    </div>
                                                )}
                                                {activeReport === 'LINEN_INJECTION' && (
                                                    <>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs font-medium text-tertiary dark:text-gray-500">Total Injected Value:</span>
                                                            {currency(linenInjectionSummary.totalInjectedValue)}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-gray-800 pl-4">
                                                            <span className="text-xs font-medium text-tertiary dark:text-gray-500">Injected Units:</span>
                                                            {numberValue(linenInjectionSummary.totalInjectedUnits)}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-gray-800 pl-4">
                                                            <span className="text-xs font-medium text-tertiary dark:text-gray-500">Closed Orders:</span>
                                                            {linenInjectionSummary.closedPoCount}
                                                        </div>
                                                    </>
                                                )}
                                                {activeReport === 'MONTHLY_SUMMARY' && (() => {
                                                    const summaryData = getMonthlySummaryData(visibleReportData as MonthlySummaryReportRow[]);
                                                    const totalPo = summaryData.reduce((sum, r) => sum + r.totalPoAmount, 0);
                                                    const totalPoInc = summaryData.reduce((sum, r) => sum + (r.totalPoAmountIncGst || r.totalPoAmount * 1.10), 0);
                                                    const totalGr = summaryData.reduce((sum, r) => sum + r.grAmount, 0);
                                                    const totalGrInc = summaryData.reduce((sum, r) => sum + (r.grAmountIncGst || r.grAmount * 1.10), 0);
                                                    const totalOpen = summaryData.reduce((sum, r) => sum + r.openPoAmount, 0);
                                                    const totalOpenInc = summaryData.reduce((sum, r) => sum + (r.openPoAmountIncGst || r.openPoAmount * 1.10), 0);
                                                    return (
                                                        <>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs font-medium text-tertiary dark:text-gray-500">Total PO Issued (Inc GST):</span>
                                                                <span className="font-bold">{currency(totalPoInc)}</span>
                                                                <span className="text-[10px] text-gray-400">({currency(totalPo)} ex)</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-gray-800 pl-4">
                                                                <span className="text-xs font-medium text-tertiary dark:text-gray-500">Total Received (Inc GST):</span>
                                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{currency(totalGrInc)}</span>
                                                                <span className="text-[10px] text-gray-400">({currency(totalGr)} ex)</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-gray-800 pl-4">
                                                                <span className="text-xs font-medium text-tertiary dark:text-gray-500">Total Open (Inc GST):</span>
                                                                <span className="font-bold text-orange-500">{currency(totalOpenInc)}</span>
                                                                <span className="text-[10px] text-gray-400">({currency(totalOpen)} ex)</span>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                            {activeReport !== 'MONTHLY_SUMMARY' && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-medium text-tertiary dark:text-gray-500">Group By:</span>
                                                    <select
                                                        value={isDeliveryReport && chartMetric === 'DATE' ? 'SUPPLIER' : chartMetric}
                                                        onChange={(event) => setChartMetric(event.target.value as ChartMetric)}
                                                        className="text-xs bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)] outline-none"
                                                    >
                                                        {activeReport === 'ALL_DELIVERIES' && <option value="DATE">Delivery Date</option>}
                                                        {(activeReport === 'ITEM_REQUEST_HISTORY' || activeReport === 'LINEN_INJECTION') && <option value="ITEM">Item</option>}
                                                        {activeReport === 'LINEN_INJECTION' && <option value="DATE">Month / Date</option>}
                                                        <option value="SUPPLIER">Supplier</option>
                                                        <option value="SITE">Site</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {isFilterableReport && (
                                    <div className="space-y-3">
                                        <div className={`grid grid-cols-1 gap-2 ${
                                            isDateFilterableReport 
                                                ? 'md:grid-cols-[minmax(0,1fr)_minmax(180px,260px)_150px_170px_auto]' 
                                                : activeReport === 'MONTHLY_SUMMARY'
                                                    ? 'md:grid-cols-[minmax(0,1fr)_130px_140px_180px_180px_auto]'
                                                    : 'md:grid-cols-[minmax(0,1fr)_160px_180px_auto]'
                                        }`}>
                                            <label className="relative block">
                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary dark:text-gray-500" />
                                                <input
                                                    value={searchTerm}
                                                    onChange={(event) => setSearchTerm(event.target.value)}
                                                    placeholder={isDateFilterableReport ? 'Search item, SKU, PO, site, supplier' : 'Search reports'}
                                                    className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)] outline-none"
                                                />
                                            </label>
                                            {activeReport !== 'SUPPLIER_INVENTORY' && activeReport !== 'SUPPLIER_ITEM_MAPPING' && activeReport !== 'SUPPLIER_PRICE_VARIANCE' && (
                                                <select
                                                    value={selectedSite}
                                                    onChange={(event) => handleSiteChange(event.target.value)}
                                                    className="text-sm bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)] outline-none font-medium"
                                                >
                                                    {siteOptions.map((site) => <option key={site} value={site}>{site === 'ALL' ? 'All sites' : site}</option>)}
                                                </select>
                                            )}
                                            <select
                                                value={selectedSupplier}
                                                onChange={(event) => setSelectedSupplier(event.target.value)}
                                                className="text-sm bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)] outline-none"
                                            >
                                                {supplierOptions.map((supplier) => <option key={supplier} value={supplier}>{supplier === 'ALL' ? 'All suppliers' : supplier}</option>)}
                                            </select>
                                            {isDateFilterableReport && (
                                                <select
                                                    value={selectedItemId}
                                                    onChange={(event) => setSelectedItemId(event.target.value)}
                                                    className="text-sm bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)] outline-none"
                                                >
                                                    {itemOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                                                </select>
                                            )}
                                            {activeReport === 'MONTHLY_SUMMARY' && (
                                                <>
                                                    <div className="flex items-center gap-1.5 min-w-[140px]">
                                                        <span className="text-xs text-tertiary dark:text-gray-500 whitespace-nowrap">From:</span>
                                                        <input
                                                            type="date"
                                                            value={monthlyStartDate}
                                                            onChange={(event) => handleStartDateChange(event.target.value)}
                                                            className="w-full text-xs bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-lg px-2.5 py-1.5 text-gray-900 dark:text-white focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)] outline-none"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1.5 min-w-[140px]">
                                                        <span className="text-xs text-tertiary dark:text-gray-500 whitespace-nowrap">To:</span>
                                                        <input
                                                            type="date"
                                                            value={monthlyEndDate}
                                                            onChange={(event) => handleEndDateChange(event.target.value)}
                                                            className="w-full text-xs bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-lg px-2.5 py-1.5 text-gray-900 dark:text-white focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)] outline-none"
                                                        />
                                                    </div>
                                                </>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSearchTerm('');
                                                    setSelectedSite('ALL');
                                                    setSelectedSupplier('ALL');
                                                    setSelectedItemId('ALL');
                                                    setDateRangeType('RECENT');
                                                    setCustomStartDate('');
                                                    setCustomEndDate('');
                                                    setMonthlyStartDate('2025-07-01');
                                                    setMonthlyEndDate(new Date().toISOString().split('T')[0]);
                                                    setReportCache('MONTHLY_SUMMARY', []);
                                                }}
                                                disabled={!hasActiveFilters}
                                                className="btn-secondary px-3 py-2 text-sm disabled:opacity-50"
                                            >
                                                Clear
                                            </button>
                                        </div>

                                        {isDateFilterableReport && (
                                            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                                                <span className="text-xs font-semibold text-secondary dark:text-gray-400">Date Range:</span>
                                                <select
                                                    value={dateRangeType}
                                                    onChange={(event) => setDateRangeType(event.target.value as any)}
                                                    className="text-xs bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-lg px-2.5 py-1.5 text-gray-900 dark:text-white focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)] outline-none"
                                                >
                                                    <option value="RECENT">Last 30 Days</option>
                                                    <option value="HISTORICAL">Since July 2025</option>
                                                    <option value="ALL">All Time</option>
                                                    <option value="CUSTOM">Custom Range...</option>
                                                </select>

                                                {dateRangeType === 'CUSTOM' && (
                                                    <div className="flex items-center gap-2 animate-fade-in">
                                                        <input
                                                            type="date"
                                                            value={customStartDate}
                                                            onChange={(event) => setCustomStartDate(event.target.value)}
                                                            className="text-xs bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-lg px-2.5 py-1 text-gray-900 dark:text-white focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)] outline-none"
                                                        />
                                                        <span className="text-xs text-tertiary dark:text-gray-500">to</span>
                                                        <input
                                                            type="date"
                                                            value={customEndDate}
                                                            onChange={(event) => setCustomEndDate(event.target.value)}
                                                            className="text-xs bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-lg px-2.5 py-1 text-gray-900 dark:text-white focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)] outline-none"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex-1 p-0 overflow-auto min-h-0 relative flex flex-col">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center flex-1 h-full text-tertiary dark:text-gray-400 py-20 min-h-[300px]">
                                    <div className="w-8 h-8 border-4 border-[var(--color-brand)]/20 border-t-[var(--color-brand)] rounded-full animate-spin" />
                                    <p className="text-xs mt-3 font-semibold text-gray-500 uppercase tracking-widest animate-pulse">Generating Report...</p>
                                </div>
                            ) : reportData.length === 0 ? (
                                <EmptyState />
                            ) : visibleReportData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center flex-1 h-full text-tertiary dark:text-gray-400 space-y-3 py-20 min-h-[300px]">
                                    <AlertCircle size={32} className="opacity-50" />
                                    <div className="text-center">
                                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">No Matching Rows</h3>
                                        <p className="text-xs mt-1">Adjust the current filters to expand the report view.</p>
                                    </div>
                                </div>
                            ) : activeReport === 'OUTSTANDING_DELIVERIES' && viewMode === 'CHART' ? (
                                <OutstandingDeliveryVisual rows={outstandingRows} summary={outstandingSummary} chartData={outstandingChartData} />
                            ) : activeReport === 'DELIVERY_VARIANCE' && viewMode === 'CHART' ? (
                                <DeliveryVarianceVisual rows={varianceRows} summary={varianceSummary} chartData={varianceChartData} />
                            ) : activeReport === 'DELIVERY_RECONCILIATION' && viewMode === 'CHART' ? (
                                <DeliveryReconciliationVisual rows={reconciliationRows} summary={reconciliationSummary} />
                            ) : activeReport === 'ITEM_REQUEST_HISTORY' && viewMode === 'CHART' ? (
                                <ItemRequestHistoryVisual summary={itemHistorySummary} chartData={itemHistoryChartData} selectedItemLabel={itemOptions.find((item) => item.id === selectedItemId)?.label || 'All items'} chartMetric={chartMetric} />
                            ) : activeReport === 'LINEN_INJECTION' && viewMode === 'CHART' ? (
                                <LinenInjectionVisual
                                    rows={linenInjectionRows}
                                    summary={linenInjectionSummary}
                                    chartData={linenInjectionChartData}
                                    chartMetric={chartMetric}
                                    selectedSite={selectedSite}
                                    onSelectSite={handleSiteChange}
                                    availableSites={sites}
                                />
                            ) : activeReport === 'MONTHLY_SUMMARY' && viewMode === 'CHART' ? (
                                <MonthlySummaryVisual rows={getMonthlySummaryData(visibleReportData as MonthlySummaryReportRow[])} />
                            ) : activeReport === 'ALL_DELIVERIES' && viewMode === 'CHART' ? (
                                <AllDeliveriesVisual data={getChartData()} />
                            ) : activeReport === 'SUPPLIER_INVENTORY' && viewMode === 'CHART' ? (
                                <SupplierInventoryVisual rows={visibleReportData} chartMetric={chartMetric} />
                            ) : activeReport === 'SUPPLIER_ITEM_MAPPING' && viewMode === 'CHART' ? (
                                <SupplierItemMappingVisual rows={visibleReportData} chartMetric={chartMetric} />
                            ) : activeReport === 'SUPPLIER_PRICE_VARIANCE' && viewMode === 'CHART' ? (
                                <SupplierPriceVarianceVisual rows={visibleReportData} chartMetric={chartMetric} />
                            ) : (
                                <ReportTable activeReport={activeReport} rows={visibleReportData} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface ReportButtonProps {
    active: boolean;
    icon: ComponentType<{ size?: number }>;
    label: string;
    onClick: () => void;
}

const ReportButton = ({ active, icon: Icon, label, onClick }: ReportButtonProps) => (
    <button
        type="button"
        onClick={onClick}
        className={`w-full sm:shrink-0 xl:w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-[var(--color-brand)] text-white' : 'text-secondary dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}
    >
        <Icon size={18} />
        {label}
    </button>
);

const EmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-tertiary dark:text-gray-400 space-y-4 py-20">
        <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center">
            <BarChart3 size={32} className="opacity-50" />
        </div>
        <div className="text-center">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">No Data Generated</h3>
            <p className="text-xs mt-1">Click "Run report" to generate the latest data.</p>
        </div>
    </div>
);

const MetricCard = ({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub: string; icon: ComponentType<{ size?: number; className?: string }>; color: string }) => (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4 min-w-0">
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase text-tertiary dark:text-gray-500 tracking-wide">{label}</p>
                <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white truncate">{value}</p>
                <p className="mt-1 text-xs text-secondary dark:text-gray-400">{sub}</p>
            </div>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                <Icon size={18} className="text-white" />
            </div>
        </div>
    </div>
);

const OutstandingDeliveryVisual = ({ rows, summary, chartData }: { rows: OutstandingDeliveryReportRow[]; summary: { totalValue: number; totalUnits: number; avgCompletion: number; lineCount: number }; chartData: Array<{ name: string; remainingValue: number; remainingUnits: number; lineCount: number }> }) => (
    <div data-testid="outstanding-report-visual" className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <MetricCard label="Outstanding Value" value={currency(summary.totalValue)} sub={`${summary.lineCount} line${summary.lineCount === 1 ? '' : 's'} awaiting action`} icon={AlertCircle} color="bg-orange-500" />
            <MetricCard label="Outstanding Units" value={numberValue(summary.totalUnits)} sub="Unreceived ordered quantity" icon={Package} color="bg-sky-500" />
            <MetricCard label="Average Completion" value={percentValue(summary.avgCompletion)} sub="Across visible PO lines" icon={CheckCircle2} color="bg-emerald-500" />
            <MetricCard label="Suppliers" value={String(new Set(rows.map((row) => row.supplier)).size)} sub="With visible outstanding lines" icon={TrendingUp} color="bg-violet-500" />
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Outstanding Value by Follow-up Group</h3>
                    <span className="text-xs text-tertiary dark:text-gray-500">{chartData.length} groups</span>
                </div>
                <div className="h-[320px] min-w-[520px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 70 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.18} vertical={false} />
                            <XAxis dataKey="name" angle={-35} textAnchor="end" height={88} interval={0} tick={{ fontSize: 11, fill: '#888' }} />
                            <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString()}`} tick={{ fontSize: 12, fill: '#888' }} />
                            <RechartsTooltip
                                formatter={(value: number, name: string) => [name === 'remainingUnits' ? numberValue(value) : currency(value), name === 'remainingUnits' ? 'Remaining units' : 'Remaining value']}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend />
                            <Bar dataKey="remainingValue" name="Remaining value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Highest Priority Lines</h3>
                <div className="space-y-4">
                    {rows.slice(0, 5).map((row) => (
                        <div key={row.id} className="space-y-2">
                            <div className="flex justify-between gap-3 text-xs">
                                <div className="min-w-0">
                                    <p className="font-bold text-gray-900 dark:text-white truncate">{row.item}</p>
                                    <p className="text-tertiary dark:text-gray-500 truncate">{row.supplier} - {row.poNumber}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-bold text-orange-500">{currency(row.remainingValue)}</p>
                                    <p className="text-tertiary dark:text-gray-500">{numberValue(row.remaining)} units</p>
                                </div>
                            </div>
                            <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.completionPct}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

const DeliveryVarianceVisual = ({ rows, summary, chartData }: { rows: DeliveryVarianceReportRow[]; summary: { totalValue: number; pendingValue: number; overValue: number; shortClosedValue: number; pendingCount: number; overCount: number; shortClosedCount: number }; chartData: Array<{ name: string; pendingValue: number; overValue: number; shortClosedValue: number }> }) => (
    <div data-testid="variance-report-visual" className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <MetricCard label="Variance Exceptions" value={String(rows.length)} sub={currency(summary.totalValue)} icon={AlertCircle} color="bg-slate-600" />
            <MetricCard label="Pending" value={currency(summary.pendingValue)} sub={`${summary.pendingCount} open line${summary.pendingCount === 1 ? '' : 's'}`} icon={Package} color="bg-orange-500" />
            <MetricCard label="Over Delivered" value={currency(summary.overValue)} sub={`${summary.overCount} line${summary.overCount === 1 ? '' : 's'} above order`} icon={TrendingUp} color="bg-red-500" />
            <MetricCard label="Short Closed" value={currency(summary.shortClosedValue)} sub={`${summary.shortClosedCount} forced closure${summary.shortClosedCount === 1 ? '' : 's'}`} icon={CheckCircle2} color="bg-sky-500" />
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Variance Value by Exception Type</h3>
                <span className="text-xs text-tertiary dark:text-gray-500">{chartData.length} groups</span>
            </div>
            <div className="h-[340px] min-w-[560px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 70 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.18} vertical={false} />
                        <XAxis dataKey="name" angle={-35} textAnchor="end" height={88} interval={0} tick={{ fontSize: 11, fill: '#888' }} />
                        <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString()}`} tick={{ fontSize: 12, fill: '#888' }} />
                        <RechartsTooltip formatter={(value: number) => currency(value)} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend />
                        <Bar dataKey="pendingValue" stackId="variance" name="Pending" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="overValue" stackId="variance" name="Over delivered" fill="#ef4444" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="shortClosedValue" stackId="variance" name="Short closed" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    </div>
);

const AllDeliveriesVisual = ({ data }: { data: Array<{ name: string; value: number }> }) => (
    <div className="h-[400px] w-full min-w-[560px] p-6">
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 12, fill: '#888' }} />
                <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString()}`} tick={{ fontSize: 12, fill: '#888' }} />
                <RechartsTooltip
                    formatter={(value: number) => [currency(value), 'Total Value']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {data.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    </div>
);



const DeliveryReconciliationVisual = ({ rows, summary }: { rows: DeliveryReconciliationRow[]; summary: { totalOrdered: number; totalReceived: number; totalPending: number; totalVariance: number; lineCount: number } }) => {
    const chartData = useMemo(() => {
        const grouped: Record<string, { name: string; ordered: number; received: number; pending: number }> = {};
        rows.forEach(row => {
            const key = row.supplier;
            grouped[key] ||= { name: key, ordered: 0, received: 0, pending: 0 };
            grouped[key].ordered += row.orderedValue;
            grouped[key].received += row.receivedValue;
            grouped[key].pending += row.pendingValue;
        });
        return Object.values(grouped).sort((a, b) => b.ordered - a.ordered).slice(0, 10);
    }, [rows]);

    return (
        <div data-testid="reconciliation-report-visual" className="p-4 md:p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <MetricCard label="Total Ordered" value={currency(summary.totalOrdered)} sub={`${summary.lineCount} lines reconciled`} icon={Package} color="bg-blue-600" />
                <MetricCard label="Total Received" value={currency(summary.totalReceived)} sub="Delivered value to date" icon={CheckCircle2} color="bg-emerald-600" />
                <MetricCard label="Pending Value" value={currency(summary.totalPending)} sub="Remaining value to be delivered" icon={AlertCircle} color="bg-orange-500" />
                <MetricCard label="Net Variance" value={currency(summary.totalVariance)} sub="Difference (Received - Ordered)" icon={ArrowRightLeft} color={summary.totalVariance >= 0 ? 'bg-emerald-500' : 'bg-red-500'} />
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4">
                <div className="flex items-center justify-between gap-3 mb-6">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Ordered vs. Received Value</h3>
                        <p className="text-xs text-tertiary dark:text-gray-500 mt-1">Top 10 suppliers by ordered volume</p>
                    </div>
                </div>
                <div className="h-[360px] min-w-[600px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                            <XAxis dataKey="name" angle={-35} textAnchor="end" height={80} interval={0} tick={{ fontSize: 11, fill: '#888' }} />
                            <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString()}`} tick={{ fontSize: 11, fill: '#888' }} />
                            <RechartsTooltip formatter={(value: number) => currency(value)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Bar dataKey="ordered" name="Ordered Value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="received" name="Received Value" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                 <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30">
                     <h4 className="text-sm font-bold text-orange-900 dark:text-orange-400 flex items-center gap-2 mb-2">
                         <AlertCircle size={16} /> Pending Fulfillment
                     </h4>
                     <p className="text-xs text-orange-700 dark:text-orange-500/80 leading-relaxed">
                         There is currently {currency(summary.totalPending)} in pending orders that have not yet been received. 
                         Check the "Outstanding Deliveries" report for a detailed follow-up list.
                     </p>
                 </div>
                 <div className={`p-4 rounded-xl border ${summary.totalVariance >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30' : 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30'}`}>
                     <h4 className={`text-sm font-bold flex items-center gap-2 mb-2 ${summary.totalVariance >= 0 ? 'text-emerald-900 dark:text-emerald-400' : 'text-red-900 dark:text-red-400'}`}>
                         <ArrowRightLeft size={16} /> Variance Insight
                     </h4>
                     <p className={`text-xs leading-relaxed ${summary.totalVariance >= 0 ? 'text-emerald-700 dark:text-emerald-500/80' : 'text-red-700 dark:text-red-500/80'}`}>
                         {summary.totalVariance >= 0 
                            ? `You have received ${currency(summary.totalVariance)} more than originally ordered. This may indicate over-deliveries or price increases.`
                            : `You have a shortfall of ${currency(Math.abs(summary.totalVariance))} between ordered and received value.`}
                     </p>
                 </div>
            </div>
        </div>
    );
};

const ItemRequestHistoryVisual = ({ summary, chartData, selectedItemLabel, chartMetric }: { summary: { lineCount: number; siteCount: number; totalOrdered: number; totalValue: number; latestRowsBySite: ItemRequestHistoryRow[] }; chartData: Array<{ name: string; orderedQty: number; requestCount: number; orderedValue: number; latestRequest: string }>; selectedItemLabel: string; chartMetric: ChartMetric }) => {
    const metricLabel = chartMetric === 'ITEM' ? 'Item' : chartMetric === 'SUPPLIER' ? 'Supplier' : chartMetric === 'DATE' ? 'Date' : 'Site';
    const groupCountLabel = chartMetric === 'ITEM' ? 'items' : chartMetric === 'SUPPLIER' ? 'suppliers' : chartMetric === 'DATE' ? 'dates' : 'sites';

    return (
        <div data-testid="item-request-history-report-visual" className="p-4 md:p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <MetricCard label="Request Lines" value={numberValue(summary.lineCount)} sub={selectedItemLabel} icon={History} color="bg-slate-600" />
                <MetricCard label="Sites Requested" value={numberValue(summary.siteCount)} sub="With matching request history" icon={Layers} color="bg-sky-500" />
                <MetricCard label="Ordered Units" value={numberValue(summary.totalOrdered)} sub="Across visible request lines" icon={Package} color="bg-emerald-600" />
                <MetricCard label="Ordered Value" value={currency(summary.totalValue)} sub="Based on request unit price" icon={TrendingUp} color="bg-violet-500" />
            </div>

            <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Request Quantity by {metricLabel}</h3>
                            <p className="text-xs text-tertiary dark:text-gray-500 mt-1">Use Raw Data or Export CSV for complete line history</p>
                        </div>
                        <span className="text-xs text-tertiary dark:text-gray-500">{chartData.length} {groupCountLabel}</span>
                    </div>
                    <div className="h-[340px] min-w-[560px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 70 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.18} vertical={false} />
                                <XAxis dataKey="name" angle={-35} textAnchor="end" height={88} interval={0} tick={{ fontSize: 11, fill: '#888' }} />
                                <YAxis tick={{ fontSize: 12, fill: '#888' }} />
                                <RechartsTooltip
                                    formatter={(value: number, name: string) => [name === 'orderedValue' ? currency(value) : numberValue(value), name === 'orderedQty' ? 'Ordered units' : name === 'requestCount' ? 'Request lines' : 'Ordered value']}
                                    labelFormatter={(label) => `${metricLabel}: ${label}`}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend />
                                <Bar dataKey="orderedQty" name="Ordered units" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="requestCount" name="Request lines" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Most Recent Request by Site</h3>
                <div className="space-y-3">
                    {summary.latestRowsBySite.slice(0, 8).map((row) => (
                        <div key={`${row.site}-${row.id}`} className="rounded-lg border border-gray-100 dark:border-gray-800 p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{row.site}</p>
                                    <p className="text-xs text-tertiary dark:text-gray-500 truncate">{row.item}</p>
                                </div>
                                <span className="text-xs font-bold text-[var(--color-brand)] shrink-0">{numberValue(row.orderedQty)}</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-secondary dark:text-gray-400">
                                <span>{row.requestDate}</span>
                                <span className="font-mono">{row.poNumber}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );
};

const MonthlySummaryVisual = ({ rows }: { rows: MonthlySummaryAggregatedRow[] }) => {
    const summary = useMemo(() => {
        const totalPo = rows.reduce((sum, r) => sum + r.totalPoAmount, 0);
        const totalPoInc = rows.reduce((sum, r) => sum + (r.totalPoAmountIncGst || r.totalPoAmount * 1.10), 0);
        const totalGr = rows.reduce((sum, r) => sum + r.grAmount, 0);
        const totalGrInc = rows.reduce((sum, r) => sum + (r.grAmountIncGst || r.grAmount * 1.10), 0);
        const totalOpen = rows.reduce((sum, r) => sum + r.openPoAmount, 0);
        const totalOpenInc = rows.reduce((sum, r) => sum + (r.openPoAmountIncGst || r.openPoAmount * 1.10), 0);
        const rate = totalPo > 0 ? (totalGr / totalPo) * 100 : 0;
        return { totalPo, totalPoInc, totalGr, totalGrInc, totalOpen, totalOpenInc, rate, monthCount: rows.length };
    }, [rows]);

    const chartData = useMemo(() => {
        return [...rows].reverse();
    }, [rows]);

    return (
        <div data-testid="monthly-summary-report-visual" className="p-4 md:p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <MetricCard label="Total PO Issued (Inc GST)" value={currency(summary.totalPoInc)} sub={`Ex GST: ${currency(summary.totalPo)} · ${summary.monthCount} mo`} icon={Package} color="bg-blue-600" />
                <MetricCard label="Total Received (GR Inc GST)" value={currency(summary.totalGrInc)} sub={`Ex GST: ${currency(summary.totalGr)}`} icon={CheckCircle2} color="bg-emerald-600" />
                <MetricCard label="Total Open Value (Inc GST)" value={currency(summary.totalOpenInc)} sub={`Ex GST: ${currency(summary.totalOpen)}`} icon={AlertCircle} color="bg-orange-500" />
                <MetricCard label="Fulfillment Rate" value={percentValue(summary.rate)} sub="Goods Received vs PO Issued" icon={TrendingUp} color="bg-violet-600" />
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4">
                <div className="flex items-center justify-between gap-3 mb-6">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Monthly PO, GR &amp; Open Amount Comparison</h3>
                        <p className="text-xs text-tertiary dark:text-gray-500 mt-1">Side-by-side monthly overview since July 2025</p>
                    </div>
                </div>
                <div className="h-[360px] min-w-[600px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                            <XAxis dataKey="month" angle={-35} textAnchor="end" height={80} interval={0} tick={{ fontSize: 11, fill: '#888' }} />
                            <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString()}`} tick={{ fontSize: 11, fill: '#888' }} />
                            <RechartsTooltip formatter={(value: number) => currency(value)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Bar dataKey="totalPoAmount" name="PO Amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="grAmount" name="GR Amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="openPoAmount" name="Open PO Amount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

const LinenInjectionVisual = ({
    rows,
    summary,
    chartData,
    chartMetric,
    selectedSite,
    onSelectSite,
    availableSites
}: {
    rows: LinenInjectionReportRow[];
    summary: {
        totalInjectedValue: number;
        totalInjectedUnits: number;
        totalOrderedUnits: number;
        totalOrderedValue: number;
        closedPoCount: number;
        lineCount: number;
        siteCount: number;
        supplierCount: number;
        itemCount: number;
    };
    chartData: Array<{ name: string; injectedValue: number; orderedValue: number; injectedQty: number; orderedQty: number; lineCount: number }>;
    chartMetric: ChartMetric;
    selectedSite: string;
    onSelectSite: (site: string) => void;
    availableSites?: Site[];
}) => {
    const isSingleSite = selectedSite !== 'ALL';
    const metricLabel = chartMetric === 'ITEM' ? 'Item' : chartMetric === 'SUPPLIER' ? 'Supplier' : chartMetric === 'DATE' ? 'Month / Date' : 'Site';
    const [chartViewType, setChartViewType] = useState<'VALUE' | 'QTY'>('VALUE');
    const [chartOrientation, setChartOrientation] = useState<'HORIZONTAL_BAR' | 'VERTICAL_CLUSTERED'>('HORIZONTAL_BAR');

    // Multi-site comparison metrics (seeded with all available operating sites)
    const siteComparison = useMemo(() => {
        const siteMap = new Map<string, {
            site: string;
            injectedValue: number;
            injectedQty: number;
            orderCount: Set<string>;
            itemCount: Set<string>;
            topItem: { name: string; value: number };
            itemsMap: Map<string, { name: string; value: number }>;
        }>();

        // Seed available organizational sites
        (availableSites || []).forEach((s) => {
            if (s.name) {
                siteMap.set(s.name, {
                    site: s.name,
                    injectedValue: 0,
                    injectedQty: 0,
                    orderCount: new Set(),
                    itemCount: new Set(),
                    topItem: { name: '', value: 0 },
                    itemsMap: new Map()
                });
            }
        });

        rows.forEach((r) => {
            const site = r.site || 'Unknown Site';
            if (!siteMap.has(site)) {
                siteMap.set(site, {
                    site,
                    injectedValue: 0,
                    injectedQty: 0,
                    orderCount: new Set(),
                    itemCount: new Set(),
                    topItem: { name: '', value: 0 },
                    itemsMap: new Map()
                });
            }
            const entry = siteMap.get(site)!;
            entry.injectedValue += r.injectedValue;
            entry.injectedQty += r.injectedQty;
            entry.orderCount.add(r.poNumber || r.requestNumber);
            entry.itemCount.add(r.item);

            const currentItemVal = (entry.itemsMap.get(r.item)?.value || 0) + r.injectedValue;
            entry.itemsMap.set(r.item, { name: r.item, value: currentItemVal });
            if (currentItemVal > entry.topItem.value) {
                entry.topItem = { name: r.item, value: currentItemVal };
            }
        });

        return Array.from(siteMap.values())
            .map((s) => ({
                site: s.site,
                injectedValue: s.injectedValue,
                injectedQty: s.injectedQty,
                orderCount: s.orderCount.size,
                itemCount: s.itemCount.size,
                topItemName: s.topItem.name,
                spendPct: summary.totalInjectedValue > 0 ? (s.injectedValue / summary.totalInjectedValue) * 100 : 0
            }))
            .sort((a, b) => b.injectedValue - a.injectedValue || a.site.localeCompare(b.site));
    }, [rows, summary.totalInjectedValue, availableSites]);

    const activeSitesCount = siteComparison.filter(s => s.injectedValue > 0 || s.injectedQty > 0).length;

    // Single-site item & cost breakdown
    const siteItemBreakdown = useMemo(() => {
        const itemMap = new Map<string, {
            item: string;
            sku: string;
            category: string;
            supplier: string;
            unitPrice: number;
            injectedQty: number;
            orderedQty: number;
            injectedValue: number;
            latestDate: string;
        }>();

        rows.forEach((r) => {
            const key = r.sku ? `${r.item}__${r.sku}` : r.item;
            if (!itemMap.has(key)) {
                itemMap.set(key, {
                    item: r.item,
                    sku: r.sku,
                    category: r.category,
                    supplier: r.supplier,
                    unitPrice: r.unitPrice,
                    injectedQty: 0,
                    orderedQty: 0,
                    injectedValue: 0,
                    latestDate: r.closedDate || r.latestDeliveryDate || r.requestDate
                });
            }
            const entry = itemMap.get(key)!;
            entry.injectedQty += r.injectedQty;
            entry.orderedQty += r.orderedQty;
            entry.injectedValue += r.injectedValue;
            if (r.unitPrice) entry.unitPrice = r.unitPrice;
            if (r.closedDate && (!entry.latestDate || new Date(r.closedDate).getTime() > new Date(entry.latestDate).getTime())) {
                entry.latestDate = r.closedDate;
            }
        });

        return Array.from(itemMap.values())
            .map((item) => ({
                ...item,
                spendPct: summary.totalInjectedValue > 0 ? (item.injectedValue / summary.totalInjectedValue) * 100 : 0
            }))
            .sort((a, b) => b.injectedValue - a.injectedValue);
    }, [rows, summary.totalInjectedValue]);

    // Single-site supplier breakdown
    const siteSupplierBreakdown = useMemo(() => {
        const supplierMap = new Map<string, { supplier: string; injectedValue: number; injectedQty: number }>();
        rows.forEach((r) => {
            const supp = r.supplier || 'Unknown Supplier';
            if (!supplierMap.has(supp)) {
                supplierMap.set(supp, { supplier: supp, injectedValue: 0, injectedQty: 0 });
            }
            const entry = supplierMap.get(supp)!;
            entry.injectedValue += r.injectedValue;
            entry.injectedQty += r.injectedQty;
        });

        return Array.from(supplierMap.values())
            .map((supp) => ({
                ...supp,
                spendPct: summary.totalInjectedValue > 0 ? (supp.injectedValue / summary.totalInjectedValue) * 100 : 0
            }))
            .sort((a, b) => b.injectedValue - a.injectedValue);
    }, [rows, summary.totalInjectedValue]);

    // Top network items (for multi-site mode)
    const topItems = useMemo(() => {
        const itemMap = new Map<string, { item: string; sku: string; supplier: string; totalQty: number; totalValue: number; siteCount: Set<string> }>();
        rows.forEach((r) => {
            const key = r.sku ? `${r.item}__${r.sku}` : r.item;
            if (!itemMap.has(key)) {
                itemMap.set(key, { item: r.item, sku: r.sku, supplier: r.supplier, totalQty: 0, totalValue: 0, siteCount: new Set() });
            }
            const existing = itemMap.get(key)!;
            existing.totalQty += r.injectedQty;
            existing.totalValue += r.injectedValue;
            existing.siteCount.add(r.site);
        });
        return Array.from(itemMap.values()).sort((a, b) => b.totalValue - a.totalValue).slice(0, 5);
    }, [rows]);

    return (
        <div data-testid="linen-injection-report-visual" className="p-4 md:p-6 space-y-6">
            {/* Focus Context Banner */}
            {isSingleSite ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                            <Building2 size={16} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">Site Focus</span>
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-600 text-white">{selectedSite}</span>
                            </div>
                            <p className="text-xs text-emerald-800/80 dark:text-emerald-400 mt-0.5">
                                Showing item-level unit cost, quantities, and total expenditure for {selectedSite}.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onSelectSite('ALL')}
                        className="px-3 py-1.5 bg-white dark:bg-nocturne border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors shrink-0 shadow-sm"
                    >
                        ← View All Sites Comparison
                    </button>
                </div>
            ) : (
                <div className="flex items-center justify-between gap-3 p-3 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl text-xs text-blue-800 dark:text-blue-300">
                    <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                        <span><strong>Multi-Site View:</strong> Comparing linen injection spend across <strong>{activeSitesCount} active sites</strong> ({siteComparison.length} operating facilities). Select a site to view its item &amp; cost breakdown.</span>
                    </div>
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium shrink-0">Filter by Supplier using the dropdown above</span>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <MetricCard
                    label={isSingleSite ? `${selectedSite} Injected Spend` : 'Total Linen Injected'}
                    value={currency(summary.totalInjectedValue)}
                    sub={`${numberValue(summary.totalInjectedUnits)} units delivered`}
                    icon={TrendingUp}
                    color="bg-emerald-600"
                />
                <MetricCard
                    label={isSingleSite ? 'Site Injected Units' : 'Total Injected Units'}
                    value={numberValue(summary.totalInjectedUnits)}
                    sub={`Across ${summary.lineCount} closed line items`}
                    icon={Package}
                    color="bg-sky-500"
                />
                <MetricCard
                    label={isSingleSite ? 'Site Closed Orders' : 'Closed PO Orders'}
                    value={String(summary.closedPoCount)}
                    sub={`Avg ${currency(summary.closedPoCount ? summary.totalInjectedValue / summary.closedPoCount : 0)} per order`}
                    icon={CheckCircle2}
                    color="bg-blue-600"
                />
                <MetricCard
                    label={isSingleSite ? 'Site Item Varieties' : 'Active Operating Sites'}
                    value={isSingleSite ? `${summary.itemCount} Items` : `${summary.siteCount} Sites`}
                    sub={isSingleSite ? `Supplied by ${summary.supplierCount} partner${summary.supplierCount === 1 ? '' : 's'}` : `Across ${summary.itemCount} items from ${summary.supplierCount} suppliers`}
                    icon={Layers}
                    color="bg-violet-600"
                />
            </div>

            {/* Upper Chart & Breakdown Cards */}
            <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_340px] gap-4">
                {/* Left Bar Chart Card */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                    {isSingleSite
                                        ? `Item Injected ${chartViewType === 'VALUE' ? 'Spend ($)' : 'Units (QTY)'} for ${selectedSite}`
                                        : `Site Injected ${chartViewType === 'VALUE' ? 'Spend ($)' : 'Units (QTY)'} Comparison`}
                                </h3>
                                {/* Orientation Toggle: Horizontal Bar vs Vertical Bar */}
                                <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 p-0.5 shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => setChartOrientation('HORIZONTAL_BAR')}
                                        className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                                            chartOrientation === 'HORIZONTAL_BAR'
                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                        title="Horizontal Bar Chart (optimal for long product names)"
                                    >
                                        <AlignLeft size={12} />
                                        Horizontal Bar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setChartOrientation('VERTICAL_CLUSTERED')}
                                        className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                                            chartOrientation === 'VERTICAL_CLUSTERED'
                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                        title="Vertical Bar Chart"
                                    >
                                        <BarChart3 size={12} />
                                        Vertical Bar
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-tertiary dark:text-gray-500 mt-1">
                                {isSingleSite
                                    ? `Ranking top injected items by total expenditure at this facility`
                                    : `Comparing total linen injection investment across operating locations`}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 p-0.5 bg-gray-50 dark:bg-gray-900/50">
                                <button
                                    type="button"
                                    onClick={() => setChartViewType('VALUE')}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                                        chartViewType === 'VALUE'
                                            ? 'bg-white dark:bg-[#1f222e] text-gray-900 dark:text-white shadow-sm font-bold'
                                            : 'text-tertiary dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    Spend ($)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setChartViewType('QTY')}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                                        chartViewType === 'QTY'
                                            ? 'bg-white dark:bg-[#1f222e] text-gray-900 dark:text-white shadow-sm font-bold'
                                            : 'text-tertiary dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    Units (Qty)
                                </button>
                            </div>
                            <span className="text-xs text-tertiary dark:text-gray-500 hidden sm:inline">{chartData.length} {metricLabel.toLowerCase()}s</span>
                        </div>
                    </div>
                    <div className="h-[360px] min-w-[560px]">
                        <ResponsiveContainer width="100%" height="100%">
                            {chartOrientation === 'HORIZONTAL_BAR' ? (
                                <BarChart
                                    layout="vertical"
                                    data={chartData}
                                    margin={{ top: 8, right: 30, left: 10, bottom: 10 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.18} horizontal={false} />
                                    <XAxis
                                        type="number"
                                        tickFormatter={(val) => chartViewType === 'VALUE' ? `$${Number(val).toLocaleString()}` : Number(val).toLocaleString()}
                                        tick={{ fontSize: 11, fill: '#888' }}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={170}
                                        interval={0}
                                        tick={{ fontSize: 11, fill: '#888' }}
                                        tickFormatter={(val) => typeof val === 'string' && val.length > 24 ? `${val.substring(0, 24)}...` : val}
                                    />
                                    <RechartsTooltip
                                        formatter={(value: number) => [
                                            chartViewType === 'VALUE' ? currency(value) : `${numberValue(value)} units`,
                                            chartViewType === 'VALUE' ? 'Injected Spend' : 'Injected Units'
                                        ]}
                                        labelFormatter={(label) => `${metricLabel}: ${label}`}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend />
                                    <Bar
                                        dataKey={chartViewType === 'VALUE' ? 'injectedValue' : 'injectedQty'}
                                        name={chartViewType === 'VALUE' ? 'Injected Spend ($)' : 'Injected Units (QTY)'}
                                        fill="#10b981"
                                        radius={[0, 4, 4, 0]}
                                    />
                                </BarChart>
                            ) : (
                                <BarChart
                                    layout="horizontal"
                                    data={chartData}
                                    margin={{ top: 8, right: 20, left: 0, bottom: 70 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.18} vertical={false} />
                                    <XAxis dataKey="name" angle={-35} textAnchor="end" height={88} interval={0} tick={{ fontSize: 11, fill: '#888' }} />
                                    <YAxis
                                        tickFormatter={(val) => chartViewType === 'VALUE' ? `$${Number(val).toLocaleString()}` : Number(val).toLocaleString()}
                                        tick={{ fontSize: 12, fill: '#888' }}
                                    />
                                    <RechartsTooltip
                                        formatter={(value: number) => [
                                            chartViewType === 'VALUE' ? currency(value) : `${numberValue(value)} units`,
                                            chartViewType === 'VALUE' ? 'Injected Spend' : 'Injected Units'
                                        ]}
                                        labelFormatter={(label) => `${metricLabel}: ${label}`}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend />
                                    <Bar
                                        dataKey={chartViewType === 'VALUE' ? 'injectedValue' : 'injectedQty'}
                                        name={chartViewType === 'VALUE' ? 'Injected Spend ($)' : 'Injected Units (QTY)'}
                                        fill="#10b981"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Right Summary Card */}
                {isSingleSite ? (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4 flex flex-col justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Supplier Spend for {selectedSite}</h3>
                            <div className="space-y-3">
                                {siteSupplierBreakdown.map((supp, idx) => (
                                    <div key={`${supp.supplier}-${idx}`} className="text-xs border-b border-gray-100 dark:border-gray-800 pb-2.5">
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="font-bold text-gray-900 dark:text-white truncate" title={supp.supplier}>{supp.supplier}</p>
                                            <p className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">{currency(supp.injectedValue)}</p>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-tertiary dark:text-gray-500">
                                            <span>{numberValue(supp.injectedQty)} units</span>
                                            <span>{percentValue(supp.spendPct)} of site spend</span>
                                        </div>
                                        <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden mt-1">
                                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, supp.spendPct)}%` }} />
                                        </div>
                                    </div>
                                ))}
                                {siteSupplierBreakdown.length === 0 && (
                                    <div className="text-center py-8 text-xs text-tertiary">No supplier data for this site.</div>
                                )}
                            </div>
                        </div>
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 text-[11px] text-secondary dark:text-gray-400 flex items-center justify-between">
                            <span>Total Site Volume:</span>
                            <span className="font-bold text-gray-900 dark:text-white">{numberValue(summary.totalInjectedUnits)} units</span>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4 flex flex-col justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Top Injected Linen Items</h3>
                            <div className="space-y-3">
                                {topItems.map((item, idx) => (
                                    <div key={`${item.item}-${idx}`} className="flex justify-between items-center text-xs border-b border-gray-100 dark:border-gray-800 pb-2.5">
                                        <div className="min-w-0 pr-2">
                                            <p className="font-bold text-gray-900 dark:text-white truncate" title={item.item}>{item.item}</p>
                                            <p className="text-[10px] text-tertiary dark:text-gray-500 font-mono">
                                                {item.sku || 'No SKU'} • {item.siteCount.size} site{item.siteCount.size === 1 ? '' : 's'}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-bold text-emerald-600 dark:text-emerald-400">{currency(item.totalValue)}</p>
                                            <p className="text-[10px] text-tertiary dark:text-gray-500">{numberValue(item.totalQty)} units</p>
                                        </div>
                                    </div>
                                ))}
                                {topItems.length === 0 && (
                                    <div className="text-center py-8 text-xs text-tertiary">No closed orders in selected range.</div>
                                )}
                            </div>
                        </div>
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 text-[11px] text-secondary dark:text-gray-400 flex items-center justify-between">
                            <span>Network Total Volume:</span>
                            <span className="font-bold text-gray-900 dark:text-white">{numberValue(summary.totalInjectedUnits)} units</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Lower Section: Multi-Site Comparative Matrix OR Single-Site Item Cost Table */}
            {!isSingleSite ? (
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50/50 dark:bg-white/5">
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Building2 size={16} className="text-[var(--color-brand)]" />
                                Site Expenditure Comparison Matrix
                            </h3>
                            <p className="text-xs text-tertiary dark:text-gray-500 mt-0.5">
                                Comparative spend, injected quantities, and top item for each operating location
                            </p>
                        </div>
                        <span className="text-xs font-semibold text-secondary dark:text-gray-400">
                            {activeSitesCount} Active / {siteComparison.length} Total Operating Sites
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-gray-50/80 dark:bg-gray-900/40 text-secondary dark:text-gray-400 uppercase text-[10px] font-bold border-b border-gray-200 dark:border-gray-800">
                                <tr>
                                    <th className="px-4 py-3">Site Location</th>
                                    <th className="px-4 py-3 text-right">Injected Spend ($)</th>
                                    <th className="px-4 py-3">% of Total Spend</th>
                                    <th className="px-4 py-3 text-center">Injected Units</th>
                                    <th className="px-4 py-3 text-center">Closed POs</th>
                                    <th className="px-4 py-3">Top Injected Item</th>
                                    <th className="px-4 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {siteComparison.map((site, idx) => {
                                    const hasActivity = site.injectedValue > 0 || site.injectedQty > 0;
                                    return (
                                        <tr key={`${site.site}-${idx}`} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <div className={`w-6 h-6 rounded flex items-center justify-center font-black text-[10px] shrink-0 ${
                                                    hasActivity ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                                                }`}>
                                                    {idx + 1}
                                                </div>
                                                <span>{site.site}</span>
                                            </td>
                                            <td className={`px-4 py-3 text-right font-bold text-sm ${hasActivity ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-600'}`}>
                                                {currency(site.injectedValue)}
                                            </td>
                                            <td className="px-4 py-3 min-w-[140px]">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                                                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, site.spendPct)}%` }} />
                                                    </div>
                                                    <span className="text-[11px] font-medium text-secondary dark:text-gray-400 w-10 text-right">{percentValue(site.spendPct)}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center font-medium text-gray-800 dark:text-gray-200">
                                                {numberValue(site.injectedQty)}
                                            </td>
                                            <td className="px-4 py-3 text-center text-secondary dark:text-gray-400 font-mono">
                                                {site.orderCount}
                                            </td>
                                            <td className="px-4 py-3 text-secondary dark:text-gray-300 max-w-[200px] truncate" title={site.topItemName}>
                                                {site.topItemName || (hasActivity ? '-' : <span className="italic text-tertiary dark:text-gray-500 text-[11px]">No injection in period</span>)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => onSelectSite(site.site)}
                                                    className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-[var(--color-brand)] hover:text-white dark:hover:bg-[var(--color-brand)] text-gray-700 dark:text-gray-300 rounded font-semibold text-[11px] transition-colors inline-flex items-center gap-1 shadow-sm"
                                                >
                                                    Item Breakdown <ArrowRight size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {siteComparison.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center py-8 text-secondary dark:text-gray-400">No site activity found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50/50 dark:bg-white/5">
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Package size={16} className="text-emerald-600" />
                                Injected Linen Item &amp; Cost Breakdown for {selectedSite}
                            </h3>
                            <p className="text-xs text-tertiary dark:text-gray-500 mt-0.5">
                                Line item quantities, unit prices, total cost, and delivery dates for this site
                            </p>
                        </div>
                        <span className="text-xs font-semibold text-secondary dark:text-gray-400">
                            {siteItemBreakdown.length} Distinct Products
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-gray-50/80 dark:bg-gray-900/40 text-secondary dark:text-gray-400 uppercase text-[10px] font-bold border-b border-gray-200 dark:border-gray-800">
                                <tr>
                                    <th className="px-4 py-3">Item Name / SKU</th>
                                    <th className="px-4 py-3">Category</th>
                                    <th className="px-4 py-3">Supplier</th>
                                    <th className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400">Injected QTY</th>
                                    <th className="px-4 py-3 text-center">Ordered QTY</th>
                                    <th className="px-4 py-3 text-right">Unit Price</th>
                                    <th className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">Total Injected Cost</th>
                                    <th className="px-4 py-3">% Site Spend</th>
                                    <th className="px-4 py-3">Latest Activity</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {siteItemBreakdown.map((item, idx) => (
                                    <tr key={`${item.item}-${idx}`} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-gray-900 dark:text-white max-w-[240px] truncate" title={item.item}>{item.item}</div>
                                            <div className="text-[10px] text-tertiary dark:text-gray-500 font-mono">{item.sku || '-'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-secondary dark:text-gray-400">
                                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-medium">{item.category}</span>
                                        </td>
                                        <td className="px-4 py-3 text-secondary dark:text-gray-300 font-medium">
                                            {item.supplier}
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">
                                            {numberValue(item.injectedQty)}
                                        </td>
                                        <td className="px-4 py-3 text-center text-secondary dark:text-gray-400 font-medium">
                                            {numberValue(item.orderedQty)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-secondary dark:text-gray-400 font-mono">
                                            {currency(item.unitPrice)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 text-sm">
                                            {currency(item.injectedValue)}
                                        </td>
                                        <td className="px-4 py-3 min-w-[120px]">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                                                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, item.spendPct)}%` }} />
                                                </div>
                                                <span className="text-[10px] text-secondary dark:text-gray-400 w-8 text-right">{percentValue(item.spendPct)}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-secondary dark:text-gray-400 whitespace-nowrap text-[11px]">
                                            {item.latestDate}
                                        </td>
                                    </tr>
                                ))}
                                {siteItemBreakdown.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="text-center py-8 text-secondary dark:text-gray-400">No items found for this site.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

const ReportTable = ({ activeReport, rows }: { activeReport: ReportType; rows: ReportRow[] }) => (
    <table className="w-full min-w-[900px] text-sm text-left">
        <thead className="text-xs text-secondary dark:text-gray-500 uppercase bg-gray-50 dark:bg-[#15171e] font-bold border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
            <tr>
                {activeReport === 'SUPPLIER_INVENTORY' && (
                    <>
                        <th className="px-5 py-4">Supplier / SKU</th>
                        <th className="px-5 py-4">Product Name</th>
                        <th className="px-5 py-4">Cust Stock Code</th>
                        <th className="px-5 py-4 text-center">SOH</th>
                        <th className="px-5 py-4 text-center">Available</th>
                        <th className="px-5 py-4 text-center">Committed</th>
                        <th className="px-5 py-4 text-center">Back Ordered</th>
                        <th className="px-5 py-4 text-right">Sell Price</th>
                        <th className="px-5 py-4 text-right">Total Value</th>
                        <th className="px-5 py-4">As Of</th>
                    </>
                )}
                {activeReport === 'SUPPLIER_ITEM_MAPPING' && (
                    <>
                        <th className="px-5 py-4">Supplier / SKU</th>
                        <th className="px-5 py-4">Cust Stock Code</th>
                        <th className="px-5 py-4">Mapped Internal SKU</th>
                        <th className="px-5 py-4">Mapped Item Name</th>
                        <th className="px-5 py-4 text-center">Confidence</th>
                        <th className="px-5 py-4 text-center">Method</th>
                        <th className="px-5 py-4 text-center">Factor</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4">Updated At</th>
                    </>
                )}
                {activeReport === 'SUPPLIER_PRICE_VARIANCE' && (
                    <>
                        <th className="px-5 py-4">Supplier / SKU</th>
                        <th className="px-5 py-4">Mapped Item</th>
                        <th className="px-5 py-4 text-right">Supplier Price</th>
                        <th className="px-5 py-4 text-right">Catalog Price</th>
                        <th className="px-5 py-4 text-right">Price Variance</th>
                        <th className="px-5 py-4 text-center">Variance %</th>
                        <th className="px-5 py-4">Status</th>
                    </>
                )}
                {activeReport === 'OUTSTANDING_DELIVERIES' && (
                    <>
                        <th className="px-5 py-4">PO # / Supplier</th>
                        <th className="px-5 py-4">Site</th>
                        <th className="px-5 py-4">Item</th>
                        <th className="px-5 py-4 text-center">Ordered</th>
                        <th className="px-5 py-4 text-center">Received</th>
                        <th className="px-5 py-4 text-center text-orange-500">Remaining</th>
                        <th className="px-5 py-4 text-right">Remaining Value</th>
                        <th className="px-5 py-4 text-center">Completion</th>
                        <th className="px-5 py-4">Status</th>
                    </>
                )}
                {activeReport === 'ALL_DELIVERIES' && (
                    <>
                        <th className="px-6 py-4">Delivery Date / Docket</th>
                        <th className="px-6 py-4">PO # / Supplier</th>
                        <th className="px-6 py-4">Site</th>
                        <th className="px-6 py-4">Item</th>
                        <th className="px-6 py-4 text-center">Qty</th>
                        <th className="px-6 py-4 text-right">Unit Price</th>
                        <th className="px-6 py-4 text-right">Total Price</th>
                    </>
                )}
                {activeReport === 'DELIVERY_VARIANCE' && (
                    <>
                        <th className="px-5 py-4">Exception</th>
                        <th className="px-5 py-4">PO # / Supplier</th>
                        <th className="px-5 py-4">Site</th>
                        <th className="px-5 py-4">Item</th>
                        <th className="px-5 py-4">Request Raised</th>
                        <th className="px-5 py-4">Latest Delivery</th>
                        <th className="px-5 py-4 text-center">Ordered</th>
                        <th className="px-5 py-4 text-center">Received</th>
                        <th className="px-5 py-4 text-center">Delta</th>
                        <th className="px-5 py-4 text-right">Unit Price</th>
                        <th className="px-5 py-4 text-right text-orange-500">Variance Value</th>
                        <th className="px-5 py-4">Status</th>
                    </>
                )}
                {activeReport === 'DELIVERY_RECONCILIATION' && (
                    <>
                        <th className="px-5 py-4">PO # / Supplier</th>
                        <th className="px-5 py-4">Item</th>
                        <th className="px-5 py-4 text-center">Ordered</th>
                        <th className="px-5 py-4 text-center">Received</th>
                        <th className="px-5 py-4 text-center">Pending</th>
                        <th className="px-5 py-4 text-right">Ordered Value</th>
                        <th className="px-5 py-4 text-right">Delivered Value</th>
                        <th className="px-5 py-4 text-right">Variance</th>
                    </>
                )}
                {activeReport === 'ITEM_REQUEST_HISTORY' && (
                    <>
                        <th className="px-5 py-4">Item / SKU</th>
                        <th className="px-5 py-4">Site</th>
                        <th className="px-5 py-4">Request / PO</th>
                        <th className="px-5 py-4">Supplier</th>
                        <th className="px-5 py-4 text-center">Ordered</th>
                        <th className="px-5 py-4 text-center">Received</th>
                        <th className="px-5 py-4 text-center">Remaining</th>
                        <th className="px-5 py-4 text-right">Ordered Value</th>
                        <th className="px-5 py-4">Status</th>
                    </>
                )}
                {activeReport === 'FINANCE_SUMMARY' && (
                    <>
                        <th className="px-6 py-4">Received / Docket</th>
                        <th className="px-6 py-4">Supplier</th>
                        <th className="px-6 py-4">Invoice #</th>
                        <th className="px-6 py-4 text-right">Value (Ex GST)</th>
                        <th className="px-6 py-4 text-right">GST (10%)</th>
                        <th className="px-6 py-4 text-right">Total (Inc GST)</th>
                        <th className="px-6 py-4 text-center">Capitalised</th>
                        <th className="px-6 py-4">Date</th>
                    </>
                )}
                {activeReport === 'PO_STATUS' && (
                    <>
                        <th className="px-6 py-4">PO Details</th>
                        <th className="px-6 py-4">Requester</th>
                        <th className="px-6 py-4 text-right">Subtotal (Ex GST)</th>
                        <th className="px-6 py-4 text-right">GST (10%)</th>
                        <th className="px-6 py-4 text-right">Total (Inc GST)</th>
                        <th className="px-6 py-4 text-center">Lines</th>
                        <th className="px-6 py-4">Status</th>
                    </>
                )}
                {activeReport === 'MONTHLY_SUMMARY' && (
                    <>
                        <th className="px-5 py-4">Request # / PO # / Date</th>
                        <th className="px-5 py-4">Site / Supplier</th>
                        <th className="px-5 py-4">Item / SKU</th>
                        <th className="px-5 py-4 text-center">Ordered</th>
                        <th className="px-5 py-4 text-center">Received</th>
                        <th className="px-5 py-4 text-center text-orange-500">Remaining</th>
                        <th className="px-5 py-4 text-right">Unit Price (Ex)</th>
                        <th className="px-5 py-4 text-right">Ordered (Inc GST)</th>
                        <th className="px-5 py-4 text-right">Received (Inc GST)</th>
                        <th className="px-5 py-4 text-right text-orange-500">Open (Inc GST)</th>
                        <th className="px-5 py-4">Status</th>
                    </>
                )}
                {activeReport === 'LINEN_INJECTION' && (
                    <>
                        <th className="px-5 py-4">Request # / PO # / Date</th>
                        <th className="px-5 py-4">Site / Requester</th>
                        <th className="px-5 py-4">Supplier</th>
                        <th className="px-5 py-4">Item / SKU</th>
                        <th className="px-5 py-4 text-center text-emerald-600 dark:text-emerald-400">Injected QTY</th>
                        <th className="px-5 py-4 text-center">Ordered QTY</th>
                        <th className="px-5 py-4 text-right">Unit Price (Ex)</th>
                        <th className="px-5 py-4 text-right text-emerald-600 dark:text-emerald-400">Injected (Inc GST)</th>
                        <th className="px-5 py-4 text-right">Ordered (Inc GST)</th>
                        <th className="px-5 py-4">Completion Date</th>
                        <th className="px-5 py-4">Status</th>
                    </>
                )}
            </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {activeReport === 'DELIVERY_RECONCILIATION' ? (
                rows.map((row) => {
                    const r = row as DeliveryReconciliationRow;
                    return (
                        <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                            <td className="px-5 py-4">
                                <p className="font-bold text-gray-900 dark:text-white">{r.poNumber}</p>
                                <p className="text-xs text-tertiary dark:text-gray-500">{r.supplier}</p>
                            </td>
                            <td className="px-5 py-4">
                                <p className="text-gray-900 dark:text-white">{r.item}</p>
                                <p className="text-[10px] text-tertiary dark:text-gray-500">{r.site}</p>
                            </td>
                            <td className="px-5 py-4 text-center font-medium">{numberValue(r.orderedQty)}</td>
                            <td className="px-5 py-4 text-center font-medium">{numberValue(r.receivedQty)}</td>
                            <td className="px-5 py-4 text-center font-bold text-orange-500">{numberValue(r.pendingQty)}</td>
                            <td className="px-5 py-4 text-right font-medium">
                                <div>{currency(Number(r.orderedValueIncGst ?? (Number(r.orderedValue || 0) * 1.10)))}</div>
                                <div className="text-[10px] text-gray-400">({currency(Number(r.orderedValue || 0))} ex)</div>
                            </td>
                            <td className="px-5 py-4 text-right font-medium">
                                <div>{currency(Number(r.receivedValueIncGst ?? (Number(r.receivedValue || 0) * 1.10)))}</div>
                                <div className="text-[10px] text-gray-400">({currency(Number(r.receivedValue || 0))} ex)</div>
                            </td>
                            <td className={`px-5 py-4 text-right font-bold ${Number(r.varianceValue || 0) > 0 ? 'text-red-500' : Number(r.varianceValue || 0) < 0 ? 'text-orange-500' : 'text-emerald-500'}`}>
                                <div>{Number(r.varianceValue || 0) > 0 ? '+' : ''}{currency(Number(r.varianceValueIncGst ?? (Number(r.varianceValue || 0) * 1.10)))}</div>
                                <div className="text-[10px] font-normal text-gray-400">({currency(Number(r.varianceValue || 0))} ex)</div>
                            </td>
                        </tr>
                    );
                })
            ) : (
                rows.map((row, idx) => (
                    <tr key={`${row.id}-${idx}`} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        {activeReport === 'OUTSTANDING_DELIVERIES' && <OutstandingDeliveryRow row={row as OutstandingDeliveryReportRow} />}
                        {activeReport === 'ALL_DELIVERIES' && <AllDeliveryRow row={row} />}
                        {activeReport === 'DELIVERY_VARIANCE' && <DeliveryVarianceRow row={row as DeliveryVarianceReportRow} />}
                        {activeReport === 'ITEM_REQUEST_HISTORY' && <ItemRequestHistoryRowView row={row as ItemRequestHistoryRow} />}
                        {activeReport === 'LINEN_INJECTION' && <LinenInjectionRowView row={row as LinenInjectionReportRow} />}
                        {activeReport === 'MONTHLY_SUMMARY' && <MonthlySummaryRow row={row as MonthlySummaryReportRow} />}
                        {activeReport === 'FINANCE_SUMMARY' && <FinanceRow row={row} />}
                        {activeReport === 'PO_STATUS' && <PoStatusRow row={row} />}
                        {activeReport === 'SUPPLIER_INVENTORY' && <SupplierInventoryRowView row={row} />}
                        {activeReport === 'SUPPLIER_ITEM_MAPPING' && <SupplierItemMappingRowView row={row} />}
                        {activeReport === 'SUPPLIER_PRICE_VARIANCE' && <SupplierPriceVarianceRowView row={row} />}
                    </tr>
                ))
            )}
        </tbody>
    </table>
);

const ItemRequestHistoryRowView = ({ row }: { row: ItemRequestHistoryRow }) => (
    <>
        <td className="px-5 py-3">
            <div className="font-bold text-gray-900 dark:text-white max-w-[260px] truncate" title={row.item}>{row.item}</div>
            <div className="text-xs text-tertiary dark:text-gray-500 font-mono">{row.sku || '-'}</div>
        </td>
        <td className="px-5 py-3 text-secondary dark:text-gray-300">{row.site}</td>
        <td className="px-5 py-3">
            <div className="font-medium text-gray-900 dark:text-white">{row.requestDate}</div>
            <div className="text-xs text-tertiary dark:text-gray-500 font-mono">{row.poNumber} / {row.displayId}</div>
        </td>
        <td className="px-5 py-3">
            <div className="font-medium text-gray-900 dark:text-white">{row.supplier}</div>
            <div className="text-xs text-tertiary dark:text-gray-500">{row.requester}</div>
        </td>
        <td className="px-5 py-3 text-center font-medium">{numberValue(row.orderedQty)}</td>
        <td className="px-5 py-3 text-center text-green-600">{numberValue(row.receivedQty)}</td>
        <td className="px-5 py-3 text-center font-bold text-orange-500">{numberValue(row.remainingQty)}</td>
        <td className="px-5 py-3 text-right font-medium">{currency(row.totalValue)}</td>
        <td className="px-5 py-3"><StatusPill label={statusLabel(row.status)} /></td>
    </>
);

const LinenInjectionRowView = ({ row }: { row: LinenInjectionReportRow }) => (
    <>
        <td className="px-5 py-3">
            <div className="font-bold text-gray-900 dark:text-white">{row.requestNumber}</div>
            {row.concurRequestNumber && (
                <div className="text-[10px] text-tertiary dark:text-gray-500 font-mono">Concur Req: {row.concurRequestNumber}</div>
            )}
            <div className="text-xs text-tertiary dark:text-gray-500 font-mono">PO: {row.poNumber || '-'}</div>
            <div className="text-[10px] text-tertiary dark:text-gray-400">{row.requestDate}</div>
            {row.dockets && row.dockets !== '-' && (
                <div className="text-[9px] text-tertiary dark:text-gray-500 font-mono truncate max-w-[180px] mt-0.5" title={`Dockets: ${row.dockets}`}>Dockets: {row.dockets}</div>
            )}
        </td>
        <td className="px-5 py-3">
            <div className="font-medium text-gray-900 dark:text-white">{row.site}</div>
            <div className="text-xs text-tertiary dark:text-gray-500">{row.requester}</div>
        </td>
        <td className="px-5 py-3">
            <div className="font-medium text-gray-900 dark:text-white">{row.supplier}</div>
        </td>
        <td className="px-5 py-3">
            <div className="font-medium text-gray-900 dark:text-white max-w-[200px] truncate" title={row.item}>{row.item}</div>
            <div className="text-xs text-tertiary dark:text-gray-500 font-mono">{row.sku || '-'}</div>
            <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">{row.category}</div>
            {row.invoices && row.invoices !== '-' && (
                <div className="text-[9px] text-tertiary dark:text-gray-500 font-mono truncate max-w-[180px] mt-0.5" title={`Invoices: ${row.invoices}`}>Invoices: {row.invoices}</div>
            )}
        </td>
        <td className="px-5 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10">
            <div>{numberValue(row.injectedQty)}</div>
            {row.deliveryDates && row.deliveryDates !== '-' && (
                <div className="text-[9px] text-tertiary dark:text-gray-500 font-mono truncate max-w-[120px] mx-auto" title={`Delivered: ${row.deliveryDates}`}>Delivered: {row.deliveryDates}</div>
            )}
        </td>
        <td className="px-5 py-3 text-center font-medium text-gray-600 dark:text-gray-400">{numberValue(row.orderedQty)}</td>
        <td className="px-5 py-3 text-right text-secondary dark:text-gray-400">{currency(row.unitPrice)}</td>
        <td className="px-5 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10">
            <div>{currency(row.injectedValueIncGst ?? row.injectedValue * 1.10)}</div>
            <div className="text-[10px] font-normal text-gray-400">({currency(row.injectedValue)} ex)</div>
        </td>
        <td className="px-5 py-3 text-right font-medium text-gray-600 dark:text-gray-300">
            <div>{currency(row.orderedValueIncGst ?? row.orderedValue * 1.10)}</div>
            <div className="text-[10px] text-gray-400">({currency(row.orderedValue)} ex)</div>
        </td>
        <td className="px-5 py-3">
            <div className="font-medium text-gray-900 dark:text-white text-xs">{row.closedDate}</div>
            {row.latestDeliveryDate && row.latestDeliveryDate !== '-' && row.latestDeliveryDate !== row.closedDate && (
                <div className="text-[10px] text-tertiary dark:text-gray-500">Delivered: {row.latestDeliveryDate}</div>
            )}
        </td>
        <td className="px-5 py-3">
            <StatusPill label="CLOSED" />
        </td>
    </>
);

const MonthlySummaryRow = ({ row }: { row: MonthlySummaryReportRow }) => (
    <>
        <td className="px-5 py-3">
            <div className="font-bold text-gray-900 dark:text-white">{row.requestNumber}</div>
            {row.concurRequestNumber && (
                <div className="text-[10px] text-tertiary dark:text-gray-500 font-mono">Concur Req: {row.concurRequestNumber}</div>
            )}
            <div className="text-xs text-tertiary dark:text-gray-500 font-mono">PO: {row.poNumber || '-'}</div>
            <div className="text-[10px] text-tertiary dark:text-gray-400">{row.requestDate}</div>
            {row.dockets && row.dockets !== '-' && (
                <div className="text-[9px] text-tertiary dark:text-gray-500 font-mono truncate max-w-[180px] mt-0.5" title={`Dockets: ${row.dockets}`}>Dockets: {row.dockets}</div>
            )}
        </td>
        <td className="px-5 py-3">
            <div className="font-medium text-gray-900 dark:text-white">{row.site}</div>
            <div className="text-xs text-tertiary dark:text-gray-500">{row.supplier}</div>
        </td>
        <td className="px-5 py-3">
            <div className="font-medium text-gray-900 dark:text-white max-w-[200px] truncate" title={row.item}>{row.item}</div>
            <div className="text-xs text-tertiary dark:text-gray-500 font-mono">{row.sku || '-'}</div>
            {row.invoices && row.invoices !== '-' && (
                <div className="text-[9px] text-tertiary dark:text-gray-500 font-mono truncate max-w-[180px] mt-0.5" title={`Invoices: ${row.invoices}`}>Invoices: {row.invoices}</div>
            )}
        </td>
        <td className="px-5 py-3 text-center font-medium">{numberValue(row.orderedQty)}</td>
        <td className="px-5 py-3 text-center text-green-600">
            <div className="font-medium">{numberValue(row.receivedQty)}</div>
            {row.deliveryDates && row.deliveryDates !== '-' && (
                <div className="text-[9px] text-tertiary dark:text-gray-500 font-mono truncate max-w-[120px] mx-auto" title={`Delivered: ${row.deliveryDates}`}>Delivered: {row.deliveryDates}</div>
            )}
        </td>
        <td className="px-5 py-3 text-center font-bold text-orange-500 bg-orange-50/50 dark:bg-orange-900/5">{numberValue(row.remainingQty)}</td>
        <td className="px-5 py-3 text-right text-secondary dark:text-gray-400">{currency(row.unitPrice)}</td>
        <td className="px-5 py-3 text-right font-medium">
            <div>{currency(row.orderedValueIncGst ?? row.orderedValue * 1.10)}</div>
            <div className="text-[10px] text-gray-400">({currency(row.orderedValue)} ex)</div>
        </td>
        <td className="px-5 py-3 text-right font-medium text-green-600 dark:text-green-400">
            <div>{currency(row.receivedValueIncGst ?? row.receivedValue * 1.10)}</div>
            <div className="text-[10px] text-gray-400">({currency(row.receivedValue)} ex)</div>
        </td>
        <td className="px-5 py-3 text-right font-bold text-orange-500 bg-orange-50/50 dark:bg-orange-900/5">
            <div>{currency(row.openValueIncGst ?? row.openValue * 1.10)}</div>
            <div className="text-[10px] font-normal text-gray-400">({currency(row.openValue)} ex)</div>
        </td>
        <td className="px-5 py-3"><StatusPill label={statusLabel(row.status)} /></td>
    </>
);

const OutstandingDeliveryRow = ({ row }: { row: OutstandingDeliveryReportRow }) => (
    <>
        <td className="px-5 py-3">
            <div className="font-bold text-gray-900 dark:text-white">{row.supplier}</div>
            <div className="text-xs text-tertiary dark:text-gray-500 font-mono">{row.poNumber}</div>
        </td>
        <td className="px-5 py-3 text-secondary dark:text-gray-300">{row.site}</td>
        <td className="px-5 py-3 text-secondary dark:text-gray-300 max-w-[240px] truncate" title={row.item}>{row.item}</td>
        <td className="px-5 py-3 text-center">{numberValue(row.ordered)}</td>
        <td className="px-5 py-3 text-center text-green-600">{numberValue(row.received)}</td>
        <td className="px-5 py-3 text-center font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/10">{numberValue(row.remaining)}</td>
        <td className="px-5 py-3 text-right font-bold text-gray-900 dark:text-white">{currency(row.remainingValue)}</td>
        <td className="px-5 py-3">
            <div className="flex items-center gap-2">
                <div className="h-2 w-20 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.completionPct}%` }} />
                </div>
                <span className="text-xs text-secondary dark:text-gray-400">{percentValue(row.completionPct)}</span>
            </div>
        </td>
        <td className="px-5 py-3"><StatusPill label={statusLabel(row.status)} /></td>
    </>
);

const DeliveryVarianceRow = ({ row }: { row: DeliveryVarianceReportRow }) => (
    <>
        <td className="px-5 py-3"><VariancePill type={row.exceptionType} /></td>
        <td className="px-5 py-3">
            <div className="font-medium text-gray-900 dark:text-white">{row.poNumber}</div>
            <div className="text-xs text-tertiary dark:text-gray-500">{row.supplier}</div>
        </td>
        <td className="px-5 py-3 text-xs font-medium text-gray-600 dark:text-gray-400">{row.site}</td>
        <td className="px-5 py-3">
            <div className="text-xs font-medium text-gray-900 dark:text-white max-w-[220px] truncate" title={row.item}>{row.item}</div>
        </td>
        <td className="px-5 py-3 text-xs text-secondary dark:text-gray-400 whitespace-nowrap">{row.requestDate}</td>
        <td className="px-5 py-3 text-xs text-secondary dark:text-gray-400 whitespace-nowrap">{row.deliveryDate}</td>
        <td className="px-5 py-3 text-center">{numberValue(row.qtyOrdered)}</td>
        <td className="px-5 py-3 text-center text-green-600">{numberValue(row.qtyReceived)}</td>
        <td className={`px-5 py-3 text-center font-bold ${row.deltaQty < 0 ? 'text-orange-500' : 'text-red-500'}`}>{numberValue(row.deltaQty)}</td>
        <td className="px-5 py-3 text-right text-secondary dark:text-gray-400">{currency(row.unitPrice)}</td>
        <td className="px-5 py-3 text-right font-bold text-orange-500">{currency(row.varianceValue)}</td>
        <td className="px-5 py-3"><StatusPill label={statusLabel(row.status)} /></td>
    </>
);

const AllDeliveryRow = ({ row }: { row: ReportRow }) => (
    <>
        <td className="px-6 py-3">
            <div className="font-bold text-gray-900 dark:text-white">{row.deliveryDate}</div>
            <div className="text-xs text-tertiary dark:text-gray-500 font-mono">{row.docket}</div>
        </td>
        <td className="px-6 py-3">
            <div className="font-medium text-gray-900 dark:text-white">{row.supplier}</div>
            <div className="text-xs text-tertiary dark:text-gray-500 font-mono">{row.poNumber}</div>
        </td>
        <td className="px-6 py-3 text-secondary dark:text-gray-300">{row.site}</td>
        <td className="px-6 py-3 text-secondary dark:text-gray-300 max-w-[200px] truncate" title={String(row.item)}>{row.item}</td>
        <td className="px-6 py-3 text-center font-medium">{row.qty}</td>
        <td className="px-6 py-3 text-right text-secondary dark:text-gray-400">{currency(Number(row.price || 0))}</td>
        <td className="px-6 py-3 text-right font-bold text-gray-900 dark:text-white">{currency(Number(row.totalPrice || 0))}</td>
    </>
);

const FinanceRow = ({ row }: { row: ReportRow }) => (
    <>
        <td className="px-6 py-3">
            <div className="font-bold text-gray-900 dark:text-white">{row.receivedDate}</div>
            <div className="text-xs text-tertiary dark:text-gray-500">{row.docket}</div>
        </td>
        <td className="px-6 py-3">
            <div className="font-medium">{row.supplier}</div>
            <div className="text-xs text-tertiary dark:text-gray-400">{row.poNumber}</div>
        </td>
        <td className="px-6 py-3 font-mono text-xs">{row.invoice}</td>
        <td className="px-6 py-3 text-right font-medium">{currency(Number(row.amount || 0))}</td>
        <td className="px-6 py-3 text-right font-mono text-xs text-gray-500">{currency(Number(row.taxAmount || 0))}</td>
        <td className="px-6 py-3 text-right font-bold text-gray-900 dark:text-white">{currency(Number(row.amountIncGst || 0))}</td>
        <td className="px-6 py-3 text-center">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${row.isCapitalised === 'Yes' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-secondary dark:bg-white/10 dark:text-gray-400'}`}>
                {row.isCapitalised}
            </span>
        </td>
        <td className="px-6 py-3 text-xs text-secondary dark:text-gray-500">{row.capDate}</td>
    </>
);

const PoStatusRow = ({ row }: { row: ReportRow }) => (
    <>
        <td className="px-6 py-3">
            <div className="font-bold text-gray-900 dark:text-white">{row.displayId || String(row.id).substring(0, 8)}</div>
            <div className="text-xs text-tertiary dark:text-gray-500">{row.supplier}</div>
        </td>
        <td className="px-6 py-3">
            <div className="text-sm">{row.requester}</div>
            <div className="text-xs text-tertiary dark:text-gray-400">{row.date}</div>
        </td>
        <td className="px-6 py-3 text-right font-mono text-xs">{currency(Number(row.subtotalExGst ?? (row.total || 0)))}</td>
        <td className="px-6 py-3 text-right font-mono text-xs text-gray-500">{currency(Number(row.taxGst || 0))}</td>
        <td className="px-6 py-3 text-right font-bold text-gray-900 dark:text-white">{currency(Number(row.totalIncGst ?? (row.total || 0)))}</td>
        <td className="px-6 py-3 text-center">{row.lineCount}</td>
        <td className="px-6 py-3"><StatusPill label={statusLabel(String(row.status))} /></td>
    </>
);

const StatusPill = ({ label }: { label: string }) => (
    <span className="inline-flex px-2 py-1 rounded-md text-[10px] font-bold uppercase border bg-gray-50 text-secondary border-gray-200 dark:bg-white/10 dark:text-gray-300 dark:border-gray-700">
        {label}
    </span>
);

const VariancePill = ({ type }: { type: VarianceType }) => {
    const className = type === 'Over delivered'
        ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/50'
        : type === 'Short closed'
            ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800/50'
            : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800/50';

    return <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold uppercase border whitespace-nowrap ${className}`}>{type}</span>;
};

const SupplierInventoryRowView = ({ row }: { row: any }) => (
    <>
        <td className="px-5 py-3">
            <div className="font-bold text-gray-900 dark:text-white">{row.supplier}</div>
            <div className="text-xs text-tertiary dark:text-gray-500 font-mono">{row.supplierSku}</div>
        </td>
        <td className="px-5 py-3 text-secondary dark:text-gray-300 max-w-[240px] truncate" title={row.productName}>{row.productName}</td>
        <td className="px-5 py-3 text-secondary dark:text-gray-300 font-mono">{row.customerStockCode || '-'}</td>
        <td className="px-5 py-3 text-center font-medium">{numberValue(row.soh)}</td>
        <td className="px-5 py-3 text-center font-bold text-emerald-600">{numberValue(row.available)}</td>
        <td className="px-5 py-3 text-center text-secondary">{numberValue(row.committed)}</td>
        <td className="px-5 py-3 text-center text-orange-500">{numberValue(row.backOrdered)}</td>
        <td className="px-5 py-3 text-right font-medium">{currency(row.sellPrice)}</td>
        <td className="px-5 py-3 text-right font-bold text-gray-900 dark:text-white">{currency(row.totalValue)}</td>
        <td className="px-5 py-3 text-xs text-tertiary dark:text-gray-500 whitespace-nowrap">{row.snapshotDate}</td>
    </>
);

const SupplierItemMappingRowView = ({ row }: { row: any }) => (
    <>
        <td className="px-5 py-3">
            <div className="font-bold text-gray-900 dark:text-white">{row.supplier}</div>
            <div className="text-xs text-tertiary dark:text-gray-500 font-mono">{row.supplierSku}</div>
        </td>
        <td className="px-5 py-3 text-secondary dark:text-gray-300 font-mono">{row.supplierCustomerCode || '-'}</td>
        <td className="px-5 py-3 text-secondary dark:text-gray-300 font-mono">{row.internalSku || '-'}</td>
        <td className="px-5 py-3 text-secondary dark:text-gray-300 max-w-[240px] truncate" title={row.internalName}>{row.internalName || '-'}</td>
        <td className="px-5 py-3 text-center">
            <div className="flex flex-col items-center">
                <div className="w-12 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-1">
                    <div 
                        className={`h-full ${row.confidence >= 90 ? 'bg-green-500' : row.confidence >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${row.confidence}%` }}
                    />
                </div>
                <span className={`font-mono text-[10px] font-bold ${row.confidence >= 90 ? 'text-green-500' : row.confidence >= 70 ? 'text-yellow-600' : 'text-red-500'}`}>
                    {row.confidence}%
                </span>
            </div>
        </td>
        <td className="px-5 py-3 text-center"><span className="badge-gray text-[10px]">{row.method}</span></td>
        <td className="px-5 py-3 text-center font-mono text-xs">x{row.conversionFactor}</td>
        <td className="px-5 py-3">
            <span className={`badge ${row.status === 'CONFIRMED' ? 'bg-green-100 text-green-700 border-green-200' : row.status === 'PROPOSED' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                {row.status}
            </span>
        </td>
        <td className="px-5 py-3 text-xs text-tertiary dark:text-gray-500 whitespace-nowrap">{row.updatedAt}</td>
    </>
);

const SupplierPriceVarianceRowView = ({ row }: { row: any }) => (
    <>
        <td className="px-5 py-3">
            <div className="font-bold text-gray-900 dark:text-white">{row.supplier}</div>
            <div className="text-xs text-tertiary dark:text-gray-500 font-mono">{row.supplierSku}</div>
        </td>
        <td className="px-5 py-3">
            <div className="font-medium text-gray-900 dark:text-white max-w-[240px] truncate" title={row.internalName}>{row.internalName}</div>
            <div className="text-xs text-tertiary dark:text-gray-500 font-mono">Catalog: {row.internalSku}</div>
        </td>
        <td className="px-5 py-3 text-right font-medium">{currency(row.supplierPrice)}</td>
        <td className="px-5 py-3 text-right font-medium">{currency(row.internalPrice)}</td>
        <td className={`px-5 py-3 text-right font-bold ${row.varianceAmount > 0 ? 'text-red-500' : row.varianceAmount < 0 ? 'text-emerald-500' : 'text-secondary dark:text-gray-400'}`}>
            {row.varianceAmount > 0 ? '+' : ''}{currency(row.varianceAmount)}
        </td>
        <td className={`px-5 py-3 text-center font-mono text-xs font-bold ${row.varianceAmount > 0 ? 'text-red-500' : row.varianceAmount < 0 ? 'text-emerald-500' : 'text-secondary dark:text-gray-400'}`}>
            {row.varianceAmount > 0 ? '+' : ''}{row.variancePercent.toFixed(1)}%
        </td>
        <td className="px-5 py-3">
            <span className={`badge ${row.status === 'Matching' ? 'bg-green-100 text-green-700 border-green-200' : row.status === 'Supplier Higher' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                {row.status}
            </span>
        </td>
    </>
);

const SupplierInventoryVisual = ({ rows, chartMetric }: { rows: any[]; chartMetric: string }) => {
    const totalValue = rows.reduce((sum, r) => sum + (r.totalValue || 0), 0);
    const totalSoh = rows.reduce((sum, r) => sum + (r.soh || 0), 0);
    const activeSkus = rows.length;
    const uniqueSuppliers = new Set(rows.map(r => r.supplier)).size;

    const chartData = useMemo(() => {
        const grouped: Record<string, number> = {};
        const keyField = chartMetric === 'SITE' ? 'productName' : 'supplier';
        rows.forEach(r => {
            const k = r[keyField] || 'Unknown';
            grouped[k] = (grouped[k] || 0) + (r.totalValue || 0);
        });
        return Object.entries(grouped)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [rows, chartMetric]);

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <MetricCard label="Total Stock Value" value={currency(totalValue)} sub={`${activeSkus} active SKUs tracked`} icon={TrendingUp} color="bg-emerald-500" />
                <MetricCard label="Total SOH Units" value={numberValue(totalSoh)} sub="Total physical stock units" icon={Package} color="bg-sky-500" />
                <MetricCard label="Suppliers Reporting" value={String(uniqueSuppliers)} sub="Suppliers with active stock" icon={CheckCircle2} color="bg-violet-500" />
                <MetricCard label="Average SOH per SKU" value={numberValue(activeSkus ? Math.round(totalSoh / activeSkus) : 0)} sub="Average stock density" icon={AlertCircle} color="bg-orange-500" />
            </div>
            <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Stock Value Distribution</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                                <XAxis dataKey="name" angle={-35} textAnchor="end" height={60} interval={0} tick={{ fontSize: 10, fill: '#888' }} />
                                <YAxis tickFormatter={(val) => `$${Number(val).toLocaleString()}`} tick={{ fontSize: 10, fill: '#888' }} />
                                <RechartsTooltip formatter={(val: number) => currency(val)} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                                <Bar dataKey="value" name="Value" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4">
                    <h3 className="text-sm font-bold text-gray-950 dark:text-white mb-4">Top 5 Highest Value SKUs</h3>
                    <div className="space-y-3">
                        {rows.sort((a, b) => b.totalValue - a.totalValue).slice(0, 5).map(r => (
                            <div key={r.id} className="flex justify-between items-center text-xs border-b border-gray-100 dark:border-gray-800 pb-2">
                                <div className="min-w-0">
                                    <p className="font-bold text-gray-900 dark:text-white truncate">{r.productName}</p>
                                    <p className="text-tertiary dark:text-gray-500 font-mono text-[10px]">Sku: {r.supplierSku} • {r.supplier}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-bold text-gray-950 dark:text-white">{currency(r.totalValue)}</p>
                                    <p className="text-[10px] text-tertiary">{numberValue(r.soh)} units</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const SupplierItemMappingVisual = ({ rows, chartMetric }: { rows: any[]; chartMetric: string }) => {
    const totalMapped = rows.length;
    const confirmed = rows.filter(r => r.status === 'CONFIRMED').length;
    const proposed = rows.filter(r => r.status === 'PROPOSED').length;
    const avgConfidence = Math.round(rows.reduce((sum, r) => sum + (r.confidence || 0), 0) / (totalMapped || 1));

    const chartData = useMemo(() => {
        const counts: Record<string, { total: number; sum: number }> = {};
        const keyField = chartMetric === 'SITE' ? 'internalSku' : 'supplier';
        rows.forEach(r => {
            const k = r[keyField] || 'Unknown';
            counts[k] ||= { total: 0, sum: 0 };
            counts[k].total += 1;
            counts[k].sum += (r.confidence || 0);
        });
        return Object.entries(counts)
            .map(([name, stat]) => ({ name, value: Math.round(stat.sum / stat.total) }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [rows, chartMetric]);

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <MetricCard label="Total Mapped Items" value={String(totalMapped)} sub="Unique SKU connections" icon={ArrowRightLeft} color="bg-sky-500" />
                <MetricCard label="Confirmed Connections" value={String(confirmed)} sub="Ready and ordering active" icon={CheckCircle2} color="bg-emerald-500" />
                <MetricCard label="Proposed Matches" value={String(proposed)} sub="Requires admin review" icon={AlertCircle} color="bg-amber-500" />
                <MetricCard label="Average Match Quality" value={`${avgConfidence}%`} sub="Fuzzy matching accuracy" icon={TrendingUp} color="bg-violet-500" />
            </div>
            <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4">
                    <h3 className="text-sm font-bold text-gray-950 dark:text-white mb-4">Average Match Quality % by Supplier</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                                <XAxis dataKey="name" angle={-35} textAnchor="end" height={60} interval={0} tick={{ fontSize: 10, fill: '#888' }} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#888' }} />
                                <RechartsTooltip formatter={(val: number) => [`${val}%`, 'Confidence']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                                <Bar dataKey="value" name="Confidence %" fill="#0284c7" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4">
                    <h3 className="text-sm font-bold text-gray-950 dark:text-white mb-4">Review Proposals Queue</h3>
                    <div className="space-y-3">
                        {rows.filter(r => r.status === 'PROPOSED').slice(0, 5).map(r => (
                            <div key={r.id} className="flex justify-between items-center text-xs border-b border-gray-100 dark:border-gray-800 pb-2">
                                <div className="min-w-0">
                                    <p className="font-bold text-gray-900 dark:text-white truncate">{r.internalName}</p>
                                    <p className="text-tertiary dark:text-gray-500 font-mono text-[10px]">Sup SKU: {r.supplierSku} • {r.supplier}</p>
                                </div>
                                <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${r.confidence >= 90 ? 'bg-green-100 text-green-700 animate-pulse' : 'bg-amber-100 text-amber-700'}`}>
                                    {r.confidence}% Match
                                </span>
                            </div>
                        ))}
                        {rows.filter(r => r.status === 'PROPOSED').length === 0 && (
                            <div className="text-center py-10 text-xs text-tertiary">All matches confirmed! Zero pending reviews.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const SupplierPriceVarianceVisual = ({ rows, chartMetric }: { rows: any[]; chartMetric: string }) => {
    const totalAudited = rows.length;
    const higher = rows.filter(r => r.varianceAmount > 0.01).length;
    const lower = rows.filter(r => r.varianceAmount < -0.01).length;
    const matching = rows.filter(r => Math.abs(r.varianceAmount) <= 0.01).length;
    const avgVariance = rows.reduce((sum, r) => sum + Math.abs(r.variancePercent || 0), 0) / (totalAudited || 1);

    const chartData = useMemo(() => {
        const grouped: Record<string, number> = {};
        const keyField = chartMetric === 'SITE' ? 'internalSku' : 'supplier';
        rows.forEach(r => {
            const k = r[keyField] || 'Unknown';
            grouped[k] = (grouped[k] || 0) + Math.abs(r.varianceAmount || 0);
        });
        return Object.entries(grouped)
            .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [rows, chartMetric]);

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <MetricCard label="Items Audited" value={String(totalAudited)} sub="Confirmed supplier linkages" icon={ArrowRightLeft} color="bg-sky-500" />
                <MetricCard label="Matching Catalog Price" value={String(matching)} sub="No price variance found" icon={CheckCircle2} color="bg-emerald-500" />
                <MetricCard label="Supplier Price Higher" value={String(higher)} sub="Requires price sheet sync" icon={AlertCircle} color="bg-red-500" />
                <MetricCard label="Average Price Deviation" value={`${avgVariance.toFixed(1)}%`} sub="Average cost difference" icon={TrendingUp} color="bg-violet-500" />
            </div>
            <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4">
                    <h3 className="text-sm font-bold text-gray-950 dark:text-white mb-4">Total Absolute Variance Amount ($) by Category</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                                <XAxis dataKey="name" angle={-35} textAnchor="end" height={60} interval={0} tick={{ fontSize: 10, fill: '#888' }} />
                                <YAxis tickFormatter={(val) => `$${Number(val).toLocaleString()}`} tick={{ fontSize: 10, fill: '#888' }} />
                                <RechartsTooltip formatter={(val: number) => currency(val)} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                                <Bar dataKey="value" name="Absolute Variance" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4">
                    <h3 className="text-sm font-bold text-gray-950 dark:text-white mb-4">Top 5 Pricing Discrepancies</h3>
                    <div className="space-y-3">
                        {rows.sort((a, b) => Math.abs(b.varianceAmount) - Math.abs(a.varianceAmount)).slice(0, 5).map(r => (
                            <div key={r.id} className="flex justify-between items-center text-xs border-b border-gray-100 dark:border-gray-800 pb-2">
                                <div className="min-w-0">
                                    <p className="font-bold text-gray-900 dark:text-white truncate">{r.internalName}</p>
                                    <p className="text-tertiary dark:text-gray-500 font-mono text-[10px]">Catalog SKU: {r.internalSku} • {r.supplier}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className={`font-bold ${r.varianceAmount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                        {r.varianceAmount > 0 ? '+' : ''}{currency(r.varianceAmount)}
                                    </p>
                                    <p className="text-[10px] text-tertiary">{r.variancePercent.toFixed(1)}% diff</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportingView;
