/**
 * BundleConnect → Azure Database sync service.
 *
 * Architecture: the actual MySQL reads and Azure writes happen in a backend
 * process (Supabase Edge Function / scheduled job). This service is the
 * browser-side client that:
 *   - reads sync state from Supabase (config, watermarks, jobs, lag)
 *   - enqueues manual sync requests
 *   - provides health metrics for the DATA SYNC Settings panel
 *
 * The backend process uses high-watermark polling on the `record_number` index
 * (present on all MyISAM tables in BundleConnect) to avoid issuing table-level
 * locks on the port-3307 read replica.
 */

import { supabase } from '../lib/supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BcSiteCode = 'MEL' | 'PER' | 'CNS' | 'ADL' | 'ALB' | 'BNE' | 'SYD';

export const BC_ACTIVE_SITES: BcSiteCode[] = ['MEL', 'PER', 'CNS', 'ADL', 'ALB', 'BNE'];
export const BC_ALL_SITES: BcSiteCode[] = [...BC_ACTIVE_SITES, 'SYD'];

export const BC_SYNC_TABLES = [
    'rfidtrans', 'rfidstock', 'stock', 'corders',
    'autoreturn_log', 'debtors', 'rfidward', 'invhdr', 'invline'
] as const;
export type BcSyncTable = typeof BC_SYNC_TABLES[number];

export interface BcSyncSiteConfig {
    id: string;
    siteCode: BcSiteCode;
    siteName: string;
    port: number;
    enabled: boolean;
    excluded: boolean;
    exclusionReason?: string;
    batchSize: number;
    rateLimitMs: number;
    lagAlertHours: number;
}

export interface BcSyncWatermark {
    siteCode: BcSiteCode;
    tableName: BcSyncTable;
    lastRecordNumber: number;
    lastSyncedAt?: string;
    rowsSynced: number;
}

export interface BcSyncJob {
    id: string;
    siteCode: BcSiteCode;
    tableName: BcSyncTable;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    triggeredBy: 'schedule' | 'manual' | 'retry';
    startedAt?: string;
    completedAt?: string;
    rowsFetched?: number;
    rowsWritten?: number;
    watermarkStart?: number;
    watermarkEnd?: number;
    errorMessage?: string;
    replicaLagSeconds?: number;
    createdAt: string;
}

export interface BcSiteSyncStatus {
    config: BcSyncSiteConfig;
    watermarks: BcSyncWatermark[];
    recentJobs: BcSyncJob[];
    lastSyncedAt?: string;        // max of watermark lastSyncedAt across tables
    lagHours?: number;            // hours since last successful sync
    replicaLagSeconds?: number;   // latest replica lag sample
    hasErrors: boolean;
    isRunning: boolean;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

const mapConfig = (row: Record<string, unknown>): BcSyncSiteConfig => ({
    id:               String(row.id),
    siteCode:         row.site_code as BcSiteCode,
    siteName:         String(row.site_name),
    port:             Number(row.port),
    enabled:          Boolean(row.enabled),
    excluded:         Boolean(row.excluded),
    exclusionReason:  row.exclusion_reason ? String(row.exclusion_reason) : undefined,
    batchSize:        Number(row.batch_size),
    rateLimitMs:      Number(row.rate_limit_ms),
    lagAlertHours:    Number(row.lag_alert_hours),
});

const mapWatermark = (row: Record<string, unknown>): BcSyncWatermark => ({
    siteCode:         row.site_code as BcSiteCode,
    tableName:        row.table_name as BcSyncTable,
    lastRecordNumber: Number(row.last_record_number),
    lastSyncedAt:     row.last_synced_at ? String(row.last_synced_at) : undefined,
    rowsSynced:       Number(row.rows_synced),
});

const mapJob = (row: Record<string, unknown>): BcSyncJob => ({
    id:                 String(row.id),
    siteCode:           row.site_code as BcSiteCode,
    tableName:          row.table_name as BcSyncTable,
    status:             row.status as BcSyncJob['status'],
    triggeredBy:        row.triggered_by as BcSyncJob['triggeredBy'],
    startedAt:          row.started_at ? String(row.started_at) : undefined,
    completedAt:        row.completed_at ? String(row.completed_at) : undefined,
    rowsFetched:        row.rows_fetched ? Number(row.rows_fetched) : undefined,
    rowsWritten:        row.rows_written ? Number(row.rows_written) : undefined,
    watermarkStart:     row.watermark_start ? Number(row.watermark_start) : undefined,
    watermarkEnd:       row.watermark_end ? Number(row.watermark_end) : undefined,
    errorMessage:       row.error_message ? String(row.error_message) : undefined,
    replicaLagSeconds:  row.replica_lag_seconds ? Number(row.replica_lag_seconds) : undefined,
    createdAt:          String(row.created_at),
});

// ── Service ───────────────────────────────────────────────────────────────────

export const bundleConnectSyncService = {

    /** Load all site configs. */
    async getSiteConfigs(): Promise<BcSyncSiteConfig[]> {
        const { data, error } = await supabase
            .from('bundle_connect_sync_config')
            .select('*')
            .order('site_code');
        if (error) throw error;
        return (data || []).map(mapConfig);
    },

    /** Load all watermarks, optionally filtered to one site. */
    async getWatermarks(siteCode?: BcSiteCode): Promise<BcSyncWatermark[]> {
        let q = supabase.from('bundle_connect_sync_watermarks').select('*');
        if (siteCode) q = q.eq('site_code', siteCode);
        const { data, error } = await q.order('site_code').order('table_name');
        if (error) throw error;
        return (data || []).map(mapWatermark);
    },

    /** Load recent sync jobs (last 50 per site). */
    async getRecentJobs(siteCode?: BcSiteCode, limit = 50): Promise<BcSyncJob[]> {
        let q = supabase
            .from('bundle_connect_sync_jobs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (siteCode) q = q.eq('site_code', siteCode);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map(mapJob);
    },

    /** Latest replica lag samples per site. */
    async getReplicaLag(): Promise<Record<BcSiteCode, number | undefined>> {
        const { data, error } = await supabase
            .from('bundle_connect_replica_lag')
            .select('site_code, lag_seconds, sampled_at')
            .order('sampled_at', { ascending: false })
            .limit(7);  // one per site
        if (error) throw error;
        const result: Partial<Record<BcSiteCode, number | undefined>> = {};
        (data || []).forEach(row => {
            const code = row.site_code as BcSiteCode;
            if (!(code in result)) result[code] = row.lag_seconds ?? undefined;
        });
        return result as Record<BcSiteCode, number | undefined>;
    },

    /** Assemble per-site status from the three data sources above. */
    async getAllSiteStatus(): Promise<BcSiteSyncStatus[]> {
        const [configs, watermarks, jobs, lagMap] = await Promise.all([
            bundleConnectSyncService.getSiteConfigs(),
            bundleConnectSyncService.getWatermarks(),
            bundleConnectSyncService.getRecentJobs(undefined, 100),
            bundleConnectSyncService.getReplicaLag(),
        ]);

        return configs.map(config => {
            const siteWatermarks = watermarks.filter(w => w.siteCode === config.siteCode);
            const siteJobs = jobs.filter(j => j.siteCode === config.siteCode);

            const syncedDates = siteWatermarks
                .map(w => w.lastSyncedAt)
                .filter(Boolean)
                .map(d => new Date(d!).getTime());

            const lastSyncedAt = syncedDates.length > 0
                ? new Date(Math.max(...syncedDates)).toISOString()
                : undefined;

            const lagHours = lastSyncedAt
                ? (Date.now() - new Date(lastSyncedAt).getTime()) / (1000 * 60 * 60)
                : undefined;

            return {
                config,
                watermarks: siteWatermarks,
                recentJobs: siteJobs.slice(0, 10),
                lastSyncedAt,
                lagHours,
                replicaLagSeconds: lagMap[config.siteCode],
                hasErrors: siteJobs.some(j => j.status === 'failed'),
                isRunning: siteJobs.some(j => j.status === 'running' || j.status === 'pending'),
            };
        });
    },

    /** Enqueue a manual sync for all tables on a site. */
    async requestManualSync(siteCode: BcSiteCode, requestedBy?: string): Promise<void> {
        const rows = BC_SYNC_TABLES.map(table => ({
            site_code:    siteCode,
            table_name:   table,
            status:       'pending',
            triggered_by: 'manual',
            created_at:   new Date().toISOString(),
        }));
        const { error } = await supabase.from('bundle_connect_sync_jobs').insert(rows);
        if (error) throw error;

        // Record intent in audit log
        await supabase.from('system_audit_logs').insert({
            action:      'BUNDLE_SYNC_REQUESTED',
            entity_type: 'BUNDLE_CONNECT_SYNC',
            entity_id:   siteCode,
            performed_by: requestedBy || null,
            details:     { tables: BC_SYNC_TABLES, triggeredBy: 'manual' }
        }).then(() => {/* fire-and-forget */});
    },

    /** Update site config (enable/disable, batch size, rate limit). */
    async updateSiteConfig(
        siteCode: BcSiteCode,
        patch: Partial<Pick<BcSyncSiteConfig, 'enabled' | 'batchSize' | 'rateLimitMs' | 'lagAlertHours'>>
    ): Promise<void> {
        const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (patch.enabled !== undefined)     dbPatch.enabled = patch.enabled;
        if (patch.batchSize !== undefined)   dbPatch.batch_size = patch.batchSize;
        if (patch.rateLimitMs !== undefined) dbPatch.rate_limit_ms = patch.rateLimitMs;
        if (patch.lagAlertHours !== undefined) dbPatch.lag_alert_hours = patch.lagAlertHours;

        const { error } = await supabase
            .from('bundle_connect_sync_config')
            .update(dbPatch)
            .eq('site_code', siteCode);
        if (error) throw error;
    },

    /**
     * Record a replica lag sample (called by the backend sync process, exposed
     * here so admin tools can also push a manual measurement).
     */
    async recordReplicaLag(siteCode: BcSiteCode, lagSeconds: number): Promise<void> {
        const { error } = await supabase.from('bundle_connect_replica_lag').insert({
            site_code:  siteCode,
            lag_seconds: lagSeconds,
            sampled_at: new Date().toISOString(),
        });
        if (error) throw error;
    },

    /**
     * Per-site site-specific filter rules used by the backend sync process.
     * These are baked into the query logic — kept here as documentation.
     *
     *   ADL: filter trans_type IN ('6', 'D') for rfidtrans (non-standard asset types)
     *   BNE: trans_type = '8' represents 55% hire items — include with weighting flag
     *   SYD: excluded entirely — source 3306→3307 replication not yet restored
     */
    getSiteQueryRules(siteCode: BcSiteCode): {
        rfidtransFilter?: string;
        rfidtransWeight?: number;
        excluded: boolean;
    } {
        switch (siteCode) {
            case 'ADL': return { rfidtransFilter: "trans_type IN ('6','D')", excluded: false };
            case 'BNE': return { rfidtransFilter: "trans_type = '8'", rfidtransWeight: 0.55, excluded: false };
            case 'SYD': return { excluded: true };
            default:    return { excluded: false };
        }
    },
};
