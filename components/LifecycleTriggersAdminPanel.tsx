import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, Clock, AlertTriangle, AlertOctagon, Save, RotateCcw, 
  CheckCircle2, Info, Layers, Bell, Check
} from 'lucide-react';
import { LifecycleTriggersConfig, DEFAULT_LIFECYCLE_TRIGGERS } from '../types.ts';
import { db } from '../services/db.ts';
import { useApp } from '../context/AppContext.tsx';
import { evaluateAllStagesStatus } from '../utils/lifecycleTriggers.ts';
import { useToast } from './ToastNotification.tsx';

export default function LifecycleTriggersAdminPanel() {
  const { pos } = useApp();
  const { success, error } = useToast();

  const [config, setConfig] = useState<LifecycleTriggersConfig>(DEFAULT_LIFECYCLE_TRIGGERS);
  const [initialConfig, setInitialConfig] = useState<LifecycleTriggersConfig>(DEFAULT_LIFECYCLE_TRIGGERS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    db.getLifecycleTriggersConfig()
      .then(loaded => {
        if (active) {
          setConfig(loaded);
          setInitialConfig(loaded);
        }
      })
      .catch(err => {
        console.error('Failed to load lifecycle triggers config:', err);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const isDirty = useMemo(() => {
    return JSON.stringify(config) !== JSON.stringify(initialConfig);
  }, [config, initialConfig]);

  // Live simulation of how many orders trigger warnings/alerts with current form config
  const simulatedStageStatus = useMemo(() => {
    return evaluateAllStagesStatus(pos, config);
  }, [pos, config]);

  const totalSimulatedAlerts = useMemo(() => {
    return Object.values(simulatedStageStatus).reduce((sum, s) => sum + s.alertCount, 0);
  }, [simulatedStageStatus]);

  const totalSimulatedWarnings = useMemo(() => {
    return Object.values(simulatedStageStatus).reduce((sum, s) => sum + s.warningCount, 0);
  }, [simulatedStageStatus]);

  const handleFieldChange = (key: keyof LifecycleTriggersConfig, val: number) => {
    const num = Math.max(1, isNaN(val) ? 1 : val);
    setConfig(prev => ({ ...prev, [key]: num }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await db.updateLifecycleTriggersConfig(config);
      setInitialConfig(config);
      success('Lifecycle triggers saved successfully!');
    } catch (err: any) {
      console.error('Failed to save lifecycle triggers:', err);
      error(`Failed to save triggers: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    setConfig(DEFAULT_LIFECYCLE_TRIGGERS);
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
        <Activity className="animate-spin text-[var(--color-brand)]" size={20} />
        <span>Loading lifecycle trigger rules...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      {/* ── HEADER BANNER ──────────────────────────────────────────────────────── */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-transparent border border-amber-500/20 dark:border-amber-500/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0 mt-1">
              <Activity size={26} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-base font-black uppercase tracking-wider text-gray-900 dark:text-white">
                  Procurement Lifecycle Stage Triggers &amp; Operational SLAs
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-500/20 flex items-center gap-1">
                  <Bell size={12} />
                  Real-time Visual Pulsing Engine
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed max-w-3xl">
                Configure warning (Amber) and critical alert (Red) thresholds for each stage of the 6-stage procurement lifecycle. When requests exceed these rules, the corresponding stage cards on the Home workspace pulse dynamically to highlight required actions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-auto">
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="px-3.5 py-2.5 text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <RotateCcw size={14} />
              <span>Defaults</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer ${
                isDirty
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20'
                  : 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed'
              }`}
            >
              <Save size={15} />
              <span>{isSaving ? 'Saving...' : isDirty ? 'Save Triggers' : 'Saved'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── LIVE SIMULATION KPI METRICS ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <Layers size={13} />
            Total Monitored POs
          </span>
          <p className="text-2xl font-black text-gray-950 dark:text-white mt-1">
            {pos.length}
          </p>
          <span className="text-[11px] text-gray-500 mt-0.5 block">
            Orders evaluated across all active sites
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-nocturne border border-amber-200 dark:border-amber-900/40 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <AlertTriangle size={13} />
            Active Warnings (Amber Pulse)
          </span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {totalSimulatedWarnings}
          </p>
          <span className="text-[11px] text-gray-500 mt-0.5 block">
            Orders currently hitting warning thresholds
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-nocturne border border-rose-200 dark:border-rose-900/40 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
            <AlertOctagon size={13} />
            Critical Alerts (Red Pulse)
          </span>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {totalSimulatedAlerts}
          </p>
          <span className="text-[11px] text-gray-500 mt-0.5 block">
            Orders exceeding critical SLA limits
          </span>
        </div>
      </div>

      {/* ── STAGE RULES CONFIGURATION GRID ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* STAGE 1: Requisition & Approval */}
        <div className="p-5 rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center justify-center">
                1
              </span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                  Stage 1: Requisition &amp; Approval
                </h4>
                <span className="text-[10px] text-gray-500">
                  Awaiting financial sign-off by designated approver
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {simulatedStageStatus[1].alertCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                  {simulatedStageStatus[1].alertCount} Alert
                </span>
              )}
              {simulatedStageStatus[1].warningCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                  {simulatedStageStatus[1].warningCount} Warn
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>Warning Trigger (Amber)</span>
                <span className="text-[10px] text-gray-400">{config.stage1WarningHours} hours ({Math.round(config.stage1WarningHours / 24 * 10) / 10}d)</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={config.stage1WarningHours}
                  onChange={(e) => handleFieldChange('stage1WarningHours', parseInt(e.target.value))}
                  className="w-24 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-amber-500"
                />
                <span className="text-xs text-gray-500">hours without manager approval</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>Critical Alert Trigger (Red)</span>
                <span className="text-[10px] text-gray-400">{config.stage1AlertHours} hours ({Math.round(config.stage1AlertHours / 24 * 10) / 10}d)</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={config.stage1AlertHours}
                  onChange={(e) => handleFieldChange('stage1AlertHours', parseInt(e.target.value))}
                  className="w-24 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-rose-500"
                />
                <span className="text-xs text-gray-500">hours without manager approval</span>
              </div>
            </div>
          </div>
        </div>

        {/* STAGE 2: Approved, Pending Concur PR */}
        <div className="p-5 rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 font-black text-xs flex items-center justify-center">
                2
              </span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                  Stage 2: Pending Concur Request
                </h4>
                <span className="text-[10px] text-gray-500">
                  Approved in ProcureFlow awaiting SAP Concur PR entry
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {simulatedStageStatus[2].alertCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                  {simulatedStageStatus[2].alertCount} Alert
                </span>
              )}
              {simulatedStageStatus[2].warningCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                  {simulatedStageStatus[2].warningCount} Warn
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>Warning Trigger (Amber)</span>
                <span className="text-[10px] text-gray-400">{config.stage2WarningDays} days</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={config.stage2WarningDays}
                  onChange={(e) => handleFieldChange('stage2WarningDays', parseInt(e.target.value))}
                  className="w-24 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-amber-500"
                />
                <span className="text-xs text-gray-500">days without Concur Request #</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>Critical Alert Trigger (Red)</span>
                <span className="text-[10px] text-gray-400">{config.stage2AlertDays} days</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={config.stage2AlertDays}
                  onChange={(e) => handleFieldChange('stage2AlertDays', parseInt(e.target.value))}
                  className="w-24 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-rose-500"
                />
                <span className="text-xs text-gray-500">days without Concur Request #</span>
              </div>
            </div>
          </div>
        </div>

        {/* STAGE 3: Approved, Pending Concur PO */}
        <div className="p-5 rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center">
                3
              </span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                  Stage 3: Pending Concur PO Generation
                </h4>
                <span className="text-[10px] text-gray-500">
                  Concur PR approved awaiting final SAP Concur PO number
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {simulatedStageStatus[3].alertCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                  {simulatedStageStatus[3].alertCount} Alert
                </span>
              )}
              {simulatedStageStatus[3].warningCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                  {simulatedStageStatus[3].warningCount} Warn
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>Warning Trigger (Amber)</span>
                <span className="text-[10px] text-gray-400">{config.stage3WarningDays} days</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={config.stage3WarningDays}
                  onChange={(e) => handleFieldChange('stage3WarningDays', parseInt(e.target.value))}
                  className="w-24 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-amber-500"
                />
                <span className="text-xs text-gray-500">days without Concur PO #</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>Critical Alert Trigger (Red)</span>
                <span className="text-[10px] text-gray-400">{config.stage3AlertDays} days</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={config.stage3AlertDays}
                  onChange={(e) => handleFieldChange('stage3AlertDays', parseInt(e.target.value))}
                  className="w-24 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-rose-500"
                />
                <span className="text-xs text-gray-500">days without Concur PO #</span>
              </div>
            </div>
          </div>
        </div>

        {/* STAGE 4: Active Order / In Transit (Need-by SLA) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center justify-center">
                4
              </span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                  Stage 4: Active Order &amp; Delivery SLA
                </h4>
                <span className="text-[10px] text-gray-500">
                  Open PO in transit evaluated against line item need-by dates
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {simulatedStageStatus[4].alertCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                  {simulatedStageStatus[4].alertCount} Alert
                </span>
              )}
              {simulatedStageStatus[4].warningCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                  {simulatedStageStatus[4].warningCount} Warn
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>Need-By Proximity Warning (Amber)</span>
                <span className="text-[10px] text-gray-400">within {config.stage4WarningDaysToNeedBy} days</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={config.stage4WarningDaysToNeedBy}
                  onChange={(e) => handleFieldChange('stage4WarningDaysToNeedBy', parseInt(e.target.value))}
                  className="w-24 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-amber-500"
                />
                <span className="text-xs text-gray-500">days prior to need-by date or overdue &lt;14d</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>Critical Overdue Alert (Red)</span>
                <span className="text-[10px] text-gray-400">&gt; {config.stage4AlertOverdueDays} days overdue</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={config.stage4AlertOverdueDays}
                  onChange={(e) => handleFieldChange('stage4AlertOverdueDays', parseInt(e.target.value))}
                  className="w-24 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-rose-500"
                />
                <span className="text-xs text-gray-500">days overdue past need-by date</span>
              </div>
            </div>
          </div>
        </div>

        {/* STAGE 5: Receiving & Physical Verification */}
        <div className="p-5 rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 shadow-2xs space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 font-black text-xs flex items-center justify-center">
                5
              </span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                  Stage 5: Receiving, Discrepancies &amp; Closure Readiness
                </h4>
                <span className="text-[10px] text-gray-500">
                  Goods physically received at plant site awaiting final verification &amp; order closure
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {simulatedStageStatus[5].alertCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                  {simulatedStageStatus[5].alertCount} Alert
                </span>
              )}
              {simulatedStageStatus[5].warningCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                  {simulatedStageStatus[5].warningCount} Warn
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>Stagnant Partial Delivery Warning (Amber)</span>
                <span className="text-[10px] text-gray-400">{config.stage5WarningDays} days</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={config.stage5WarningDays}
                  onChange={(e) => handleFieldChange('stage5WarningDays', parseInt(e.target.value))}
                  className="w-24 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-amber-500"
                />
                <span className="text-xs text-gray-500">days sitting in partial receipt status</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>100% Received Unclosed Alert (Red)</span>
                <span className="text-[10px] text-gray-400">{config.stage5AlertDays} days</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={config.stage5AlertDays}
                  onChange={(e) => handleFieldChange('stage5AlertDays', parseInt(e.target.value))}
                  className="w-24 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-rose-500"
                />
                <span className="text-xs text-gray-500">days fully received without closing</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── FOOTER NOTE ────────────────────────────────────────────────────────── */}
      <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/80 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
        <Info size={15} className="text-amber-500 shrink-0" />
        <span>
          Stage 6 (Reconciliation &amp; Closed) triggers a warning when orders are completed with unresolved discrepancies or invoice variances.
        </span>
      </div>
    </div>
  );
}
