import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Play,
  RefreshCw,
  Settings2,
  WifiOff,
  XCircle
} from 'lucide-react';
import {
  BcSiteSyncStatus,
  BcSyncSiteConfig,
  bundleConnectSyncService
} from '../services/bundleConnectSyncService';
import { azureDbService, AzureDbConfig } from '../services/azureDbService';
import { useToast, ToastContainer } from './ToastNotification';

// ── Status helpers ────────────────────────────────────────────────────────────

const lagClass = (lagHours?: number, alertHours = 24) => {
  if (lagHours === undefined) return 'text-gray-400';
  if (lagHours > alertHours) return 'text-red-500';
  if (lagHours > alertHours * 0.5) return 'text-amber-500';
  return 'text-emerald-500';
};

const lagLabel = (lagHours?: number): string => {
  if (lagHours === undefined) return 'Never synced';
  if (lagHours < 1) return `${Math.round(lagHours * 60)}m ago`;
  if (lagHours < 24) return `${lagHours.toFixed(1)}h ago`;
  return `${Math.floor(lagHours / 24)}d ago`;
};

const statusBadge = (status: BcSiteSyncStatus) => {
  if (status.config.excluded)
    return <span className="rounded-full border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-white/5 text-gray-500 text-[10px] font-bold px-2 py-0.5">Excluded</span>;
  if (status.hasErrors)
    return <span className="rounded-full border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/20 text-red-700 dark:text-red-300 text-[10px] font-bold px-2 py-0.5">Error</span>;
  if (status.isRunning)
    return <span className="rounded-full border border-blue-200 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5 flex items-center gap-1"><RefreshCw size={9} className="animate-spin" /> Running</span>;
  if (!status.config.enabled)
    return <span className="rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e2029] text-gray-500 text-[10px] font-bold px-2 py-0.5">Disabled</span>;
  if (status.lastSyncedAt)
    return <span className="rounded-full border border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5">Active</span>;
  return <span className="rounded-full border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5">Pending</span>;
};

// ── Site Row ──────────────────────────────────────────────────────────────────

const SiteRow: React.FC<{
  status: BcSiteSyncStatus;
  onForceSync: (code: string) => void;
  onToggleEnable: (code: string, enabled: boolean) => void;
  isSyncing: boolean;
}> = ({ status, onForceSync, onToggleEnable, isSyncing }) => {
  const [expanded, setExpanded] = useState(false);
  const { config } = status;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-white/5 text-left transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center font-black text-sm text-gray-700 dark:text-gray-200 shrink-0">
          {config.siteCode}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-900 dark:text-white">{config.siteName}</span>
            {statusBadge(status)}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs">
            <span className={lagClass(status.lagHours, config.lagAlertHours)}>
              <Clock size={11} className="inline mr-0.5" />
              {lagLabel(status.lagHours)}
            </span>
            {status.replicaLagSeconds !== undefined && (
              <span className={status.replicaLagSeconds > 60 ? 'text-amber-500' : 'text-gray-400'}>
                Replica lag: {status.replicaLagSeconds}s
              </span>
            )}
            <span className="text-gray-400">
              {status.watermarks.reduce((a, w) => a + w.rowsSynced, 0).toLocaleString()} rows
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!config.excluded && (
            <>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onToggleEnable(config.siteCode, !config.enabled); }}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                  config.enabled
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                {config.enabled ? 'Enabled' : 'Enable'}
              </button>
              <button
                type="button"
                disabled={isSyncing || config.excluded}
                onClick={e => { e.stopPropagation(); onForceSync(config.siteCode); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20 text-xs font-bold hover:bg-blue-100 disabled:opacity-40"
              >
                <Play size={11} /> Sync
              </button>
            </>
          )}
          {expanded ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-4">
          {config.excluded && config.exclusionReason && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/20 p-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {config.exclusionReason}
            </div>
          )}

          {/* Watermarks table */}
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Table Watermarks</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-gray-400 uppercase">
                  <tr>
                    <th className="text-left pb-1.5">Table</th>
                    <th className="text-right pb-1.5">Record #</th>
                    <th className="text-right pb-1.5">Rows</th>
                    <th className="text-right pb-1.5">Last Sync</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {status.watermarks.map(w => (
                    <tr key={w.tableName}>
                      <td className="py-1.5 font-mono text-gray-700 dark:text-gray-300">{w.tableName}</td>
                      <td className="py-1.5 text-right font-mono">{w.lastRecordNumber.toLocaleString()}</td>
                      <td className="py-1.5 text-right">{w.rowsSynced.toLocaleString()}</td>
                      <td className="py-1.5 text-right text-gray-400">
                        {w.lastSyncedAt ? new Date(w.lastSyncedAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {status.watermarks.length === 0 && (
                    <tr><td colSpan={4} className="py-3 text-center text-gray-400">No watermarks yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent jobs */}
          {status.recentJobs.length > 0 && (
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase mb-2">Recent Jobs</div>
              <div className="space-y-1.5">
                {status.recentJobs.slice(0, 5).map(job => (
                  <div key={job.id} className="flex items-center gap-3 text-xs rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2">
                    {job.status === 'completed' && <CheckCircle size={13} className="text-emerald-500 shrink-0" />}
                    {job.status === 'failed' && <XCircle size={13} className="text-red-500 shrink-0" />}
                    {job.status === 'running' && <RefreshCw size={13} className="text-blue-500 animate-spin shrink-0" />}
                    {job.status === 'pending' && <Clock size={13} className="text-gray-400 shrink-0" />}
                    {job.status === 'skipped' && <AlertCircle size={13} className="text-gray-400 shrink-0" />}
                    <span className="font-mono text-gray-700 dark:text-gray-300 w-24 shrink-0">{job.tableName}</span>
                    <span className="text-gray-400">{new Date(job.createdAt).toLocaleString()}</span>
                    {job.rowsWritten !== undefined && <span className="ml-auto text-gray-500">{job.rowsWritten.toLocaleString()} rows</span>}
                    {job.errorMessage && <span className="text-red-500 truncate max-w-xs">{job.errorMessage}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Panel ────────────────────────────────────────────────────────────────

const DataSyncPanel: React.FC = () => {
  const [siteStatuses, setSiteStatuses] = useState<BcSiteSyncStatus[]>([]);
  const [azureConfig, setAzureConfig] = useState<AzureDbConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingSite, setSyncingSite] = useState<string | null>(null);
  const [testingConn, setTestingConn] = useState(false);
  const [connLatency, setConnLatency] = useState<number | null>(null);
  const [showAzureConfig, setShowAzureConfig] = useState(false);
  const [azureHost, setAzureHost] = useState('');
  const [azurePort, setAzurePort] = useState('5432');
  const [azureDb, setAzureDb] = useState('');
  const [azureProxyUrl, setAzureProxyUrl] = useState('');
  const { toasts, dismissToast, success, error, info } = useToast();

  const load = async () => {
    setIsLoading(true);
    try {
      const [statuses, config] = await Promise.all([
        bundleConnectSyncService.getAllSiteStatus(),
        azureDbService.getConfig()
      ]);
      setSiteStatuses(statuses);
      setAzureConfig(config);
      if (config) {
        setAzureHost(config.host || '');
        setAzurePort(String(config.port || 5432));
        setAzureDb(config.database || '');
        setAzureProxyUrl(config.proxyFunctionUrl || '');
      }
    } catch (err) {
      error(`Failed to load sync state: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleForceSync = async (siteCode: string) => {
    setSyncingSite(siteCode);
    try {
      await bundleConnectSyncService.requestManualSync(siteCode as never);
      success(`Sync requested for ${siteCode}. The backend will process this shortly.`);
      await load();
    } catch (err) {
      error((err as Error).message);
    } finally {
      setSyncingSite(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const activeSites = siteStatuses.filter(s => s.config.enabled && !s.config.excluded);
      await Promise.all(activeSites.map(s => bundleConnectSyncService.requestManualSync(s.config.siteCode)));
      success(`Sync requested for ${activeSites.length} active sites.`);
      await load();
    } catch (err) {
      error((err as Error).message);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleToggleEnable = async (siteCode: string, enabled: boolean) => {
    try {
      await bundleConnectSyncService.updateSiteConfig(siteCode as never, { enabled });
      await load();
    } catch (err) {
      error((err as Error).message);
    }
  };

  const handleTestConnection = async () => {
    setTestingConn(true);
    setConnLatency(null);
    try {
      const result = await azureDbService.testConnection();
      setConnLatency(result.latencyMs);
      success(`Connected to Azure DB in ${result.latencyMs}ms (${result.azureVersion})`);
    } catch (err) {
      error(`Connection test failed: ${(err as Error).message}`);
    } finally {
      setTestingConn(false);
    }
  };

  const handleSaveAzureConfig = async () => {
    try {
      await azureDbService.saveConfig({
        host: azureHost,
        port: Number(azurePort),
        database: azureDb,
        proxyFunctionUrl: azureProxyUrl || undefined,
        connected: false,
      });
      success('Azure DB config saved.');
      setShowAzureConfig(false);
      await load();
    } catch (err) {
      error((err as Error).message);
    }
  };

  // ── Summary stats ──────────────────────────────────────────────────────────
  const activeSites    = siteStatuses.filter(s => s.config.enabled && !s.config.excluded);
  const sitesWithErrors = siteStatuses.filter(s => s.hasErrors);
  const sitesLagging   = siteStatuses.filter(s =>
    s.lagHours !== undefined && s.lagHours > s.config.lagAlertHours
  );
  const totalRows = siteStatuses
    .flatMap(s => s.watermarks)
    .reduce((acc, w) => acc + w.rowsSynced, 0);

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">BundleConnect Data Sync</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            High-watermark CDC from MySQL port-3307 replicas to Azure Database. Zero table locks on source.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowAzureConfig(v => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
          >
            <Settings2 size={15} /> Azure Config
          </button>
          <button
            type="button"
            onClick={load}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            type="button"
            disabled={syncingAll || activeSites.length === 0}
            onClick={handleSyncAll}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40"
          >
            <Play size={15} /> Sync All Active
          </button>
        </div>
      </div>

      {/* Azure DB config panel */}
      {showAzureConfig && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Database size={15} /> Azure Database Connection
            </h3>
            {azureConfig?.connected ? (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><CheckCircle size={13} /> Connected</span>
            ) : (
              <span className="text-xs font-bold text-gray-400 flex items-center gap-1"><WifiOff size={13} /> Not connected</span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-xs font-bold text-gray-500 uppercase">Host</span>
              <input className="input-field w-full" placeholder="your-server.database.azure.com" value={azureHost} onChange={e => setAzureHost(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold text-gray-500 uppercase">Port</span>
              <input className="input-field w-full" type="number" value={azurePort} onChange={e => setAzurePort(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold text-gray-500 uppercase">Database Name</span>
              <input className="input-field w-full" placeholder="bundleconnect_sync" value={azureDb} onChange={e => setAzureDb(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold text-gray-500 uppercase">Proxy Function URL</span>
              <input className="input-field w-full" placeholder="https://your-project.supabase.co/functions/v1/azure-db-proxy" value={azureProxyUrl} onChange={e => setAzureProxyUrl(e.target.value)} />
            </label>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="button" onClick={handleSaveAzureConfig} className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold">
              Save Config
            </button>
            <button
              type="button"
              disabled={testingConn}
              onClick={handleTestConnection}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 text-sm font-bold disabled:opacity-50"
            >
              <Activity size={14} className={testingConn ? 'animate-pulse' : ''} />
              {testingConn ? 'Testing…' : 'Test Connection'}
            </button>
            {connLatency !== null && (
              <span className="self-center text-xs text-emerald-600 font-bold">{connLatency}ms</span>
            )}
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Sites',    value: activeSites.length,    icon: CheckCircle,  color: 'text-emerald-500' },
          { label: 'Sites w/ Errors', value: sitesWithErrors.length, icon: XCircle,     color: sitesWithErrors.length > 0 ? 'text-red-500' : 'text-gray-400' },
          { label: 'Lagging Sites',   value: sitesLagging.length,    icon: AlertTriangle, color: sitesLagging.length > 0 ? 'text-amber-500' : 'text-gray-400' },
          { label: 'Total Rows Synced', value: totalRows.toLocaleString(), icon: Database, color: 'text-blue-500' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-4">
              <Icon size={18} className={`${stat.color} mb-2`} />
              <div className="text-xl font-black text-gray-900 dark:text-white">{stat.value}</div>
              <div className="text-xs font-bold text-gray-500 uppercase mt-0.5">{stat.label}</div>
            </div>
          );
        })}
      </div>

      {/* Per-site status */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <RefreshCw size={22} className="animate-spin text-gray-400" />
          </div>
        ) : (
          siteStatuses.map(status => (
            <SiteRow
              key={status.config.siteCode}
              status={status}
              onForceSync={handleForceSync}
              onToggleEnable={handleToggleEnable}
              isSyncing={syncingSite === status.config.siteCode || syncingAll}
            />
          ))
        )}
      </div>

      {/* Architecture note */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <Activity size={14} /> Sync Architecture
        </h3>
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1.5">
          <p><strong className="text-gray-700 dark:text-gray-300">Source:</strong> BundleConnect MySQL 5.7 port-3307 replicas (read-only, MyISAM). Sync uses high-watermark polling on <code className="font-mono bg-gray-100 dark:bg-white/10 px-1 rounded">record_number</code> index — no table locks acquired.</p>
          <p><strong className="text-gray-700 dark:text-gray-300">Destination:</strong> Azure Database (InnoDB/native). Schema enforces FK constraints that MyISAM cannot.</p>
          <p><strong className="text-gray-700 dark:text-gray-300">Batching:</strong> 500 rows per batch with configurable rate limiting. Replica lag monitored; sync pauses if lag exceeds 60s.</p>
          <p><strong className="text-gray-700 dark:text-gray-300">SYD:</strong> Excluded — source 3306→3307 replication not yet restored.</p>
          <p><strong className="text-gray-700 dark:text-gray-300">ADL / BNE:</strong> Site-specific filters applied (ADL type 6/D assets; BNE type-8 items weighted at 55%).</p>
        </div>
      </div>
    </div>
  );
};

export default DataSyncPanel;
