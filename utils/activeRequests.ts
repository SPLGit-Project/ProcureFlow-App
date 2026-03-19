import type { PORequest, POStatus } from '../types.ts';

export type ActiveRequestFilterMode = 'PENDING' | 'ACTIVE' | 'ALL';

export type ActiveRequestStatusFilter = 'ALL' | POStatus;

export interface ActiveRequestFilters {
    filterMode: ActiveRequestFilterMode;
    searchTerm: string;
    selectedSite: string;
    selectedStatus: ActiveRequestStatusFilter;
    fromDate: string | null;
    toDate: string | null;
}

export const ACTIVE_REQUEST_EXPORT_HEADERS = [
    'PO Number',
    'Date',
    'Site',
    'Supplier',
    'Requester',
    'Status',
    'Concur Request #',
    'Concur PO #',
    'Amount'
] as const;

export const formatActiveRequestStatus = (status: POStatus) => {
    if (status === 'APPROVED_PENDING_CONCUR') return 'Pending Concur PO';
    if (status === 'APPROVED_PENDING_CONCUR_REQUEST') return 'Pending Concur Req';
    if (status === 'ACTIVE') return 'Active (Linked)';
    return status.replace(/_/g, ' ');
};

export const normalizeActiveRequestDateValue = (value: string | null) => {
    const trimmed = (value ?? '').trim();
    return trimmed ? trimmed : null;
};

export const getActiveRequestTimestamp = (requestDate: string, endOfDay = false) => {
    const safeDate = requestDate.includes('T')
        ? requestDate
        : `${requestDate}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`;
    return new Date(safeDate).getTime();
};

export const csvEscape = (value: string | number) => {
    const stringValue = String(value ?? '');
    if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
};

export const getActiveRequests = (pos: PORequest[]) =>
    pos.filter((po) => ['APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR', 'ACTIVE'].includes(po.status));

export const filterActiveRequests = (requests: PORequest[], filters: ActiveRequestFilters) => {
    const normalizedFromDate = normalizeActiveRequestDateValue(filters.fromDate);
    const normalizedToDate = normalizeActiveRequestDateValue(filters.toDate);
    const searchLower = filters.searchTerm.trim().toLowerCase();

    return requests
        .filter((po) => {
            const isPendingConcurPO = po.status === 'APPROVED_PENDING_CONCUR';
            const isPendingConcurReq = po.status === 'APPROVED_PENDING_CONCUR_REQUEST';
            const isPendingConcur = isPendingConcurPO || isPendingConcurReq;
            const isActive = po.status === 'ACTIVE';

            if (filters.filterMode === 'PENDING' && !isPendingConcur) return false;
            if (filters.filterMode === 'ACTIVE' && !isActive) return false;
            if (filters.filterMode === 'ALL' && !isPendingConcur && !isActive) return false;

            if (filters.selectedStatus !== 'ALL' && po.status !== filters.selectedStatus) return false;
            if (filters.selectedSite !== 'ALL' && (po.site || 'Unknown') !== filters.selectedSite) return false;

            const requestTimestamp = getActiveRequestTimestamp(po.requestDate);
            if (normalizedFromDate && requestTimestamp < getActiveRequestTimestamp(normalizedFromDate)) return false;
            if (normalizedToDate && requestTimestamp > getActiveRequestTimestamp(normalizedToDate, true)) return false;

            if (!searchLower) return true;

            return (
                (po.displayId || po.id).toLowerCase().includes(searchLower) ||
                po.supplierName.toLowerCase().includes(searchLower) ||
                po.requesterName.toLowerCase().includes(searchLower) ||
                (po.site || '').toLowerCase().includes(searchLower) ||
                po.totalAmount.toString().includes(searchLower)
            );
        })
        .sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
};

export const buildActiveRequestsCsv = (requests: PORequest[]) => {
    const rows = requests.map((po) => {
        const concurPoNum = po.lines.find((line) => !!line.concurPoNumber)?.concurPoNumber || '';
        return [
            po.displayId || po.id,
            new Date(po.requestDate).toLocaleDateString(),
            po.site || 'Unknown',
            po.supplierName,
            po.requesterName,
            formatActiveRequestStatus(po.status),
            po.concurRequestNumber || '',
            concurPoNum,
            po.totalAmount.toFixed(2)
        ];
    });

    return [ACTIVE_REQUEST_EXPORT_HEADERS, ...rows]
        .map((row) => row.map((value) => csvEscape(value)).join(','))
        .join('\n');
};
