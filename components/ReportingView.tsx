import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
    AlertCircle,
    BarChart3,
    CheckCircle2,
    Download,
    FileText,
    Package,
    Search,
    TrendingUp,
    Layers,
    ArrowRightLeft,
    History
} from 'lucide-react';
import PageHeader from './PageHeader.tsx';
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
import type { PORequest, POStatus } from '../types.ts';

type ReportType = 'OUTSTANDING_DELIVERIES' | 'ALL_DELIVERIES' | 'DELIVERY_VARIANCE' | 'FINANCE_SUMMARY' | 'PO_STATUS' | 'DELIVERY_RECONCILIATION' | 'ITEM_REQUEST_HISTORY';
type ReportRow = Record<string, string | number>;
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
    ITEM_REQUEST_HISTORY: 'Item Request History by Site'
};

const REPORT_DESCRIPTIONS: Record<ReportType, string> = {
    OUTSTANDING_DELIVERIES: 'Action-first view of PO lines still awaiting receipt, grouped by supplier and site to make follow-up work clear.',
    ALL_DELIVERIES: 'Comprehensive log of all completed deliveries across all sites, including received quantities and item pricing.',
    DELIVERY_VARIANCE: 'Exception-only view of pending, over-delivered, and short-closed delivery lines that need review.',
    FINANCE_SUMMARY: 'Detailed breakdown of all received goods with their capitalization status and invoice numbers. Use this for month-end reconciliation.',
    PO_STATUS: 'High-level overview of all Purchase Orders and their current approval status in the workflow.',
    DELIVERY_RECONCILIATION: 'Complete picture of order fulfillment. Compare ordered vs. received quantities across all PO lines to identify pending amounts and value variances.',
    ITEM_REQUEST_HISTORY: 'Search and select an item to see its most recent request activity at each site, with a detailed line-level export for deeper review.'
};

const DELIVERY_REPORTS: ReportType[] = ['OUTSTANDING_DELIVERIES', 'DELIVERY_VARIANCE', 'DELIVERY_RECONCILIATION'];
const FILTERABLE_REPORTS: ReportType[] = [...DELIVERY_REPORTS, 'ITEM_REQUEST_HISTORY'];
const ACTIVE_DELIVERY_STATUSES: POStatus[] = ['ACTIVE', 'APPROVED_PENDING_CONCUR', 'APPROVED_PENDING_CONCUR_REQUEST', 'VARIANCE_PENDING'];
const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4'];

const currency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const numberValue = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });
const percentValue = (value: number) => `${Math.round(value)}%`;
const statusLabel = (status: string) => status.replaceAll('_', ' ');
const reportFileName = (report: ReportType) => `${report === 'OUTSTANDING_DELIVERIES' ? 'outstanding-deliveries' : report === 'DELIVERY_VARIANCE' ? 'delivery-variance' : report.toLowerCase().replaceAll('_', '-')}-${new Date().toISOString().split('T')[0]}.csv`;

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
                data.push({
                    id: line.id,
                    poNumber: getPoNumber(po, poLine?.concurPoNumber),
                    supplier: po.supplierName,
                    invoice: line.invoiceNumber || '-',
                    docket: delivery.docketNumber,
                    receivedDate: delivery.date,
                    amount: Number(line.quantity || 0) * Number(poLine?.unitPrice || 0),
                    isCapitalised: line.isCapitalised ? 'Yes' : 'No',
                    capDate: line.capitalisedDate || '-'
                });
            });
        });
    });

    return data;
};

const buildPoStatusRows = (pos: PORequest[]): ReportRow[] => pos.map((po) => ({
    id: po.id,
    displayId: po.displayId || '',
    supplier: po.supplierName,
    requester: po.requesterName,
    date: po.requestDate,
    total: po.totalAmount,
    status: po.status,
    lineCount: po.lines.length
}));

const buildReconciliationRows = (pos: PORequest[]): DeliveryReconciliationRow[] => {
    return pos.flatMap((po) => po.lines.map((line) => {
        const ordered = Number(line.quantityOrdered || 0);
        const received = Number(line.quantityReceived || 0);
        const unitPrice = Number(line.unitPrice || 0);
        
        const pendingQty = Math.max(0, ordered - received);
        const overQty = Math.max(0, received - ordered);
        
        const orderedValue = ordered * unitPrice;
        const receivedValue = received * unitPrice;
        const pendingValue = pendingQty * unitPrice;
        const varianceValue = receivedValue - orderedValue;

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
            { key: 'orderedValue', label: 'Ordered Value' },
            { key: 'receivedValue', label: 'Delivered Value' },
            { key: 'pendingValue', label: 'Pending Value' },
            { key: 'varianceValue', label: 'Value Variance' },
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
    const { pos, cachedReports, cachedRunTimes, setReportCache } = useApp();
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
    const [dateRangeType, setDateRangeType] = useState<'RECENT' | 'HISTORICAL' | 'ALL' | 'CUSTOM'>('RECENT');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    useEffect(() => {
        sessionStorage.setItem('pf_active_report', activeReport);
    }, [activeReport]);

    const reportData = (cachedReports[activeReport] || []) as ReportRow[];
    const lastRun = cachedRunTimes[activeReport];
    const isDeliveryReport = DELIVERY_REPORTS.includes(activeReport);
    const isItemHistoryReport = activeReport === 'ITEM_REQUEST_HISTORY';
    const isFilterableReport = FILTERABLE_REPORTS.includes(activeReport);
    const canUseChart = activeReport === 'ALL_DELIVERIES' || isDeliveryReport || isItemHistoryReport;

    const siteOptions = useMemo(() => ['ALL', ...Array.from(new Set(reportData.map((row) => String(row.site || '')).filter(Boolean))).sort((a, b) => a.localeCompare(b))], [reportData]);
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
                row.displayId,
                row.supplier,
                row.site,
                row.item,
                row.sku,
                row.requester,
                row.status,
                row.exceptionType
            ].some((value) => String(value || '').toLowerCase().includes(query));
            const matchesSite = selectedSite === 'ALL' || row.site === selectedSite;
            const matchesSupplier = selectedSupplier === 'ALL' || row.supplier === selectedSupplier;
            const matchesItem = selectedItemId === 'ALL' || row.itemId === selectedItemId || row.item === selectedItemId;

            let matchesDate = true;
            if (isItemHistoryReport && row.requestDate) {
                const requestTime = new Date(row.requestDate as string).getTime();
                if (!isNaN(requestTime)) {
                    if (dateRangeType === 'RECENT') {
                        const threshold = new Date();
                        threshold.setDate(threshold.getDate() - 30);
                        matchesDate = requestTime >= threshold.getTime();
                    } else if (dateRangeType === 'HISTORICAL') {
                        const startDate = new Date('2025-07-01T00:00:00');
                        matchesDate = requestTime >= startDate.getTime();
                    } else if (dateRangeType === 'CUSTOM') {
                        if (customStartDate) {
                            const start = new Date(customStartDate + 'T00:00:00');
                            if (!isNaN(start.getTime())) {
                                matchesDate = matchesDate && requestTime >= start.getTime();
                            }
                        }
                        if (customEndDate) {
                            const end = new Date(customEndDate + 'T23:59:59');
                            if (!isNaN(end.getTime())) {
                                matchesDate = matchesDate && requestTime <= end.getTime();
                            }
                        }
                    }
                }
            }

            return matchesSearch && matchesSite && matchesSupplier && matchesItem && matchesDate;
        });
    }, [isFilterableReport, isItemHistoryReport, reportData, searchTerm, selectedItemId, selectedSite, selectedSupplier, dateRangeType, customStartDate, customEndDate]);

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

    const switchReport = (report: ReportType) => {
        setActiveReport(report);
        setViewMode('CHART');
        setChartMetric(report === 'ALL_DELIVERIES' ? 'DATE' : 'SUPPLIER');
        setSearchTerm('');
        setSelectedSite('ALL');
        setSelectedSupplier('ALL');
        setSelectedItemId('ALL');
    };

    const runReport = () => {
        setIsLoading(true);

        window.setTimeout(() => {
            let data: ReportRow[] = [];

            if (activeReport === 'OUTSTANDING_DELIVERIES') {
                data = buildOutstandingDeliveryRows(pos);
            } else if (activeReport === 'DELIVERY_VARIANCE') {
                data = buildDeliveryVarianceRows(pos);
            } else if (activeReport === 'FINANCE_SUMMARY') {
                data = buildFinanceRows(pos);
            } else if (activeReport === 'ALL_DELIVERIES') {
                data = buildAllDeliveriesRows(pos);
            } else if (activeReport === 'PO_STATUS') {
                data = buildPoStatusRows(pos);
            } else if (activeReport === 'DELIVERY_RECONCILIATION') {
                data = buildReconciliationRows(pos);
            } else if (activeReport === 'ITEM_REQUEST_HISTORY') {
                data = buildItemRequestHistoryRows(pos);
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

    const hasActiveFilters = Boolean(
        searchTerm.trim() ||
        selectedSite !== 'ALL' ||
        selectedSupplier !== 'ALL' ||
        selectedItemId !== 'ALL' ||
        (isItemHistoryReport && (
            dateRangeType !== 'RECENT' ||
            customStartDate !== '' ||
            customEndDate !== ''
        ))
    );

    return (
        <div className="space-y-6 pb-20 animate-fade-in">
            <PageHeader title="Reports & Analytics" subtitle="Generate reports for delivery tracking and financial auditing." />

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                <div className="xl:col-span-1 space-y-2">
                    <div className="bg-white dark:bg-nocturne rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-2">
                        <div className="flex flex-col sm:flex-row xl:flex-col gap-2">
                            <ReportButton active={activeReport === 'OUTSTANDING_DELIVERIES'} icon={AlertCircle} label="Outstanding Deliveries" onClick={() => switchReport('OUTSTANDING_DELIVERIES')} />
                            <ReportButton active={activeReport === 'ALL_DELIVERIES'} icon={Package} label="All Deliveries" onClick={() => switchReport('ALL_DELIVERIES')} />
                            <ReportButton active={activeReport === 'DELIVERY_VARIANCE'} icon={TrendingUp} label="Delivery Variance" onClick={() => switchReport('DELIVERY_VARIANCE')} />
                            <ReportButton active={activeReport === 'DELIVERY_RECONCILIATION'} icon={Layers} label="Full Reconciliation" onClick={() => switchReport('DELIVERY_RECONCILIATION')} />
                            <ReportButton active={activeReport === 'ITEM_REQUEST_HISTORY'} icon={History} label="Item Request History" onClick={() => switchReport('ITEM_REQUEST_HISTORY')} />
                            <ReportButton active={activeReport === 'FINANCE_SUMMARY'} icon={TrendingUp} label="Finance Summary" onClick={() => switchReport('FINANCE_SUMMARY')} />
                            <ReportButton active={activeReport === 'PO_STATUS'} icon={FileText} label="PO Status Report" onClick={() => switchReport('PO_STATUS')} />
                        </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl p-4">
                        <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase mb-2">Report Description</h4>
                        <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">{REPORT_DESCRIPTIONS[activeReport]}</p>
                    </div>
                </div>

                <div className="xl:col-span-3">
                    <div className="bg-white dark:bg-nocturne rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 min-h-[420px] md:min-h-[500px] flex flex-col">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col lg:flex-row justify-between lg:items-center gap-4">
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
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5 space-y-3">
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
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-medium text-tertiary dark:text-gray-500">
                                                        {activeReport === 'OUTSTANDING_DELIVERIES' ? 'Total Outstanding:' : activeReport === 'DELIVERY_VARIANCE' ? 'Total Variance:' : activeReport === 'ITEM_REQUEST_HISTORY' ? 'Total Ordered Units:' : 'Total Value:'}
                                                    </span>
                                                    {activeReport === 'OUTSTANDING_DELIVERIES' && currency(outstandingSummary.totalValue)}
                                                    {activeReport === 'DELIVERY_VARIANCE' && currency(varianceSummary.totalValue)}
                                                    {activeReport === 'ALL_DELIVERIES' && currency(getChartData().reduce((sum, item) => sum + item.value, 0))}
                                                    {activeReport === 'ITEM_REQUEST_HISTORY' && numberValue(itemHistorySummary.totalOrdered)}
                                                </div>
                                                {activeReport === 'ITEM_REQUEST_HISTORY' && (
                                                    <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-gray-800 pl-4">
                                                        <span className="text-xs font-medium text-tertiary dark:text-gray-500">Total Ordered Value:</span>
                                                        {currency(itemHistorySummary.totalValue)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-tertiary dark:text-gray-500">Group By:</span>
                                                <select
                                                    value={isDeliveryReport && chartMetric === 'DATE' ? 'SUPPLIER' : chartMetric}
                                                    onChange={(event) => setChartMetric(event.target.value as ChartMetric)}
                                                    className="text-xs bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)] outline-none"
                                                >
                                                    {activeReport === 'ALL_DELIVERIES' && <option value="DATE">Delivery Date</option>}
                                                    {activeReport === 'ITEM_REQUEST_HISTORY' && <option value="ITEM">Item</option>}
                                                    <option value="SUPPLIER">Supplier</option>
                                                    <option value="SITE">Site</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {isFilterableReport && (
                                    <div className="space-y-3">
                                        <div className={`grid grid-cols-1 gap-2 ${isItemHistoryReport ? 'md:grid-cols-[minmax(0,1fr)_minmax(180px,260px)_150px_170px_auto]' : 'md:grid-cols-[minmax(0,1fr)_160px_180px_auto]'}`}>
                                            <label className="relative block">
                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary dark:text-gray-500" />
                                                <input
                                                    value={searchTerm}
                                                    onChange={(event) => setSearchTerm(event.target.value)}
                                                    placeholder={isItemHistoryReport ? 'Search item, SKU, PO, site, supplier' : 'Search reports'}
                                                    className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)] outline-none"
                                                />
                                            </label>
                                            {isItemHistoryReport && (
                                                <select
                                                    value={selectedItemId}
                                                    onChange={(event) => setSelectedItemId(event.target.value)}
                                                    className="text-sm bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)] outline-none"
                                                >
                                                    {itemOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                                                </select>
                                            )}
                                            <select
                                                value={selectedSite}
                                                onChange={(event) => setSelectedSite(event.target.value)}
                                                className="text-sm bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)] outline-none"
                                            >
                                                {siteOptions.map((site) => <option key={site} value={site}>{site === 'ALL' ? 'All sites' : site}</option>)}
                                            </select>
                                            <select
                                                value={selectedSupplier}
                                                onChange={(event) => setSelectedSupplier(event.target.value)}
                                                className="text-sm bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)] outline-none"
                                            >
                                                {supplierOptions.map((supplier) => <option key={supplier} value={supplier}>{supplier === 'ALL' ? 'All suppliers' : supplier}</option>)}
                                            </select>
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
                                                }}
                                                disabled={!hasActiveFilters}
                                                className="btn-secondary px-3 py-2 text-sm disabled:opacity-50"
                                            >
                                                Clear
                                            </button>
                                        </div>

                                        {isItemHistoryReport && (
                                            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                                                <span className="text-xs font-semibold text-secondary dark:text-gray-400">Date Range:</span>
                                                <select
                                                    value={dateRangeType}
                                                    onChange={(event) => setDateRangeType(event.target.value as any)}
                                                    className="text-xs bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-lg px-2.5 py-1.5 text-gray-900 dark:text-white focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)] outline-none"
                                                >
                                                    <option value="RECENT">Last 30 Days</option>
                                                    <option value="HISTORICAL">Most Recent</option>
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

                        <div className="flex-1 p-0 overflow-x-auto">
                            {reportData.length === 0 && !isLoading ? (
                                <EmptyState />
                            ) : visibleReportData.length === 0 && !isLoading ? (
                                <div className="flex flex-col items-center justify-center h-full text-tertiary dark:text-gray-400 space-y-3 py-20">
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
                            ) : activeReport === 'ALL_DELIVERIES' && viewMode === 'CHART' ? (
                                <AllDeliveriesVisual data={getChartData()} />
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

const ReportTable = ({ activeReport, rows }: { activeReport: ReportType; rows: ReportRow[] }) => (
    <table className="w-full min-w-[900px] text-sm text-left">
        <thead className="text-xs text-secondary dark:text-gray-500 uppercase bg-gray-50 dark:bg-[#15171e] font-bold border-b border-gray-200 dark:border-gray-800 sticky top-0">
            <tr>
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
                        <th className="px-6 py-4 text-right">Value</th>
                        <th className="px-6 py-4 text-center">Capitalised</th>
                        <th className="px-6 py-4">Date</th>
                    </>
                )}
                {activeReport === 'PO_STATUS' && (
                    <>
                        <th className="px-6 py-4">PO Details</th>
                        <th className="px-6 py-4">Requester</th>
                        <th className="px-6 py-4 text-right">Total</th>
                        <th className="px-6 py-4 text-center">Lines</th>
                        <th className="px-6 py-4">Status</th>
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
                            <td className="px-5 py-4 text-right font-medium">{currency(r.orderedValue)}</td>
                            <td className="px-5 py-4 text-right font-medium">{currency(r.receivedValue)}</td>
                            <td className={`px-5 py-4 text-right font-bold ${r.varianceValue > 0 ? 'text-red-500' : r.varianceValue < 0 ? 'text-orange-500' : 'text-emerald-500'}`}>
                                {r.varianceValue > 0 ? '+' : ''}{currency(r.varianceValue)}
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
                        {activeReport === 'FINANCE_SUMMARY' && <FinanceRow row={row} />}
                        {activeReport === 'PO_STATUS' && <PoStatusRow row={row} />}
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
        <td className="px-5 py-3 text-right font-bold text-gray-900 dark:text-white">{currency(row.totalValue)}</td>
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
        <td className="px-6 py-3 text-right font-medium">{currency(Number(row.total || 0))}</td>
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

export default ReportingView;
