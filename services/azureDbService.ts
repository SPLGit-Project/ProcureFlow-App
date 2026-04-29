/**
 * Azure Database client service.
 *
 * Provides typed query methods for reading BundleConnect data that has been
 * synced to the Azure Database (via bundleConnectSyncService). Smart Buying v2
 * and the Integration Layer both consume data through this service rather than
 * querying MySQL replicas directly.
 *
 * Connection config is stored in `app_config` under key `azure_db_config` as
 * encrypted JSON. In the browser, queries are routed through a Supabase Edge
 * Function (`azure-db-proxy`) which holds the actual connection credentials.
 * When that function is not yet deployed, all methods fall back to returning
 * empty result sets (safe default — no crashes, no mock data leaking).
 *
 * SITE CODES: MEL | PER | CNS | ADL | ALB | BNE  (SYD excluded)
 */

import { supabase } from '../lib/supabaseClient';
import { BcSiteCode } from './bundleConnectSyncService';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AzureDbConfig {
    host: string;
    port: number;
    database: string;
    proxyFunctionUrl?: string;   // Supabase Edge Function URL for browser-side queries
    connected: boolean;
}

export interface RfidTransRow {
    siteCode: BcSiteCode;
    stkKey: string;
    transType: string;
    transDate: string;
    recordNumber: number;
}

export interface StockRow {
    siteCode: BcSiteCode;
    stkKey: string;
    description: string;
    launderChg: number;
    hireChg: number;
    weight: number;
    recordNumber: number;
}

export interface CordersRow {
    siteCode: BcSiteCode;
    stkKey: string;
    ordQty: number;
    ordDate: string;
    shortQty: number;
    recordNumber: number;
}

export interface AutoreturnRow {
    siteCode: BcSiteCode;
    stkKey: string;
    returnQty: number;
    returnDate: string;
    recordNumber: number;
}

export interface StarMetric {
    siteCode: BcSiteCode;
    stkKey: string;
    starDays: number;       // avg days in cycle from rfidtrans calculation
    sampleCount: number;
}

export interface ShortSupplyRow {
    siteCode:     BcSiteCode;
    stkKey:       string;
    description:  string;
    ordQty:       number;
    shortQty:     number;
    launderChg:   number;
    hireChg:      number;
    weight:       number;
    starDays?:    number;
    suggestedBuy: number;
}

// ── Config helpers ────────────────────────────────────────────────────────────

export const azureDbService = {

    async getConfig(): Promise<AzureDbConfig | null> {
        const { data } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', 'azure_db_config')
            .maybeSingle();
        if (!data?.value) return null;
        try {
            return data.value as AzureDbConfig;
        } catch {
            return null;
        }
    },

    async saveConfig(config: Partial<AzureDbConfig>): Promise<void> {
        const existing = await azureDbService.getConfig();
        const merged = { ...(existing || {}), ...config };
        const { error } = await supabase.from('app_config').upsert({
            key:        'azure_db_config',
            value:      merged,
            updated_at: new Date().toISOString(),
        });
        if (error) throw error;
    },

    // ── Query proxy ──────────────────────────────────────────────────────────
    // All data queries route through the Edge Function when deployed.
    // Falls back to empty results when the function is not yet live.

    async proxyQuery<T>(
        queryType: string,
        params: Record<string, unknown>
    ): Promise<T[]> {
        const config = await azureDbService.getConfig();
        if (!config?.proxyFunctionUrl || !config.connected) {
            console.warn(`[azureDbService] proxy not configured — returning empty for ${queryType}`);
            return [];
        }

        const { data, error } = await supabase.functions.invoke('azure-db-proxy', {
            body: { queryType, params },
        });

        if (error) {
            console.error('[azureDbService] proxy error:', error);
            throw new Error(`Azure DB query failed (${queryType}): ${error.message}`);
        }

        return (data?.rows ?? []) as T[];
    },

    // ── Smart Buying queries ─────────────────────────────────────────────────

    /**
     * Short supply data for one or more sites.
     * Joins corders + stock + autoreturn_log → the core Smart Buying input.
     */
    async getShortSupplyData(sites: BcSiteCode[]): Promise<ShortSupplyRow[]> {
        return azureDbService.proxyQuery<ShortSupplyRow>('SHORT_SUPPLY', { sites });
    },

    /**
     * STAR (Stock Turn And Return) metric — average days in hire cycle.
     * Calculated from rfidtrans WHERE trans_type IN ('1','2').
     * ADL: also include types '6','D'. BNE type '8' weighted at 55%.
     */
    async getStarMetrics(sites: BcSiteCode[]): Promise<StarMetric[]> {
        return azureDbService.proxyQuery<StarMetric>('STAR_METRICS', { sites });
    },

    /**
     * Raw corders rows (orders + short supply quantities).
     * MEL falls back to autoreturn_log when corders is sparse.
     */
    async getCorders(siteCode: BcSiteCode, since?: string): Promise<CordersRow[]> {
        return azureDbService.proxyQuery<CordersRow>('CORDERS', { siteCode, since });
    },

    /**
     * Stock master rows for revenue and weight enrichment.
     */
    async getStock(siteCode: BcSiteCode, stkKeys?: string[]): Promise<StockRow[]> {
        return azureDbService.proxyQuery<StockRow>('STOCK', { siteCode, stkKeys });
    },

    /**
     * Suggested buy from autoreturn_log (used as MEL corders fallback and
     * as a supplementary buy signal for all sites).
     */
    async getSuggestedBuy(siteCode: BcSiteCode, since?: string): Promise<AutoreturnRow[]> {
        return azureDbService.proxyQuery<AutoreturnRow>('AUTORETURN', { siteCode, since });
    },

    // ── Connection test ──────────────────────────────────────────────────────

    /**
     * Ping the proxy function to verify connectivity.
     * Returns latency in ms, or throws on failure.
     */
    async testConnection(): Promise<{ latencyMs: number; azureVersion: string }> {
        const start = Date.now();
        const result = await azureDbService.proxyQuery<{ version: string }>('PING', {});
        return {
            latencyMs:    Date.now() - start,
            azureVersion: result[0]?.version ?? 'unknown',
        };
    },
};
