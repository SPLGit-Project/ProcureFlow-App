import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, 
  PlusCircle, 
  CheckCircle2, 
  Edit3, 
  Save, 
  X, 
  Download, 
  Layers, 
  Building2, 
  TrendingUp, 
  AlertCircle,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { db } from '../../services/db.ts';
import { LinenBudgetRecord } from '../../types.ts';
import { DEFAULT_FY27_BUDGETS } from '../../utils/budgetTracking.ts';

export default function LinenBudgetView() {
  const [financialYears, setFinancialYears] = useState<string[]>(['FY27']);
  const [selectedFY, setSelectedFY] = useState<string>('FY27');
  const [budgetRecords, setBudgetRecords] = useState<LinenBudgetRecord[]>([]);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editableRows, setEditableRows] = useState<LinenBudgetRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal for creating a new FY budget
  const [showNewYearModal, setShowNewYearModal] = useState<boolean>(false);
  const [newFYName, setNewFYName] = useState<string>('FY28');
  const [cloneFromFY, setCloneFromFY] = useState<string>('FY27');

  // Load budgets for selected financial year
  const loadBudgets = async () => {
    setIsLoading(true);
    try {
      const records = await db.getLinenBudgets();
      if (records && records.length > 0) {
        // Collect all distinct financial years
        const distinctYears = Array.from(new Set(records.map(r => r.financialYear))).sort();
        setFinancialYears(distinctYears);

        // Filter for selected year
        const currentActive = records.find(r => r.isCurrent)?.financialYear;
        const targetYear = selectedFY || currentActive || distinctYears[0];
        
        let yearRecords = records.filter(r => r.financialYear === targetYear);
        if (yearRecords.length === 0) {
          yearRecords = records.filter(r => r.financialYear === distinctYears[0]);
        }
        
        yearRecords.sort((a, b) => a.sortOrder - b.sortOrder);
        setBudgetRecords(yearRecords);
        setEditableRows(JSON.parse(JSON.stringify(yearRecords)));
      } else {
        // Fallback initial FY27 template
        const fallback = [
          { siteCode: 'MEL', siteName: 'Melbourne', annualDepletion: 2654000, monthlyDepletion: 221166.67, annualNewBusiness: 597080, monthlyNewBusiness: 49756.67, sortOrder: 1, financialYear: 'FY27', isCurrent: true },
          { siteCode: 'SYD', siteName: 'Sydney', annualDepletion: 2784000, monthlyDepletion: 232000.00, annualNewBusiness: 552000, monthlyNewBusiness: 46000.00, sortOrder: 2, financialYear: 'FY27', isCurrent: true },
          { siteCode: 'ADL', siteName: 'Adelaide', annualDepletion: 920000, monthlyDepletion: 76666.67, annualNewBusiness: 224480, monthlyNewBusiness: 18706.67, sortOrder: 3, financialYear: 'FY27', isCurrent: true },
          { siteCode: 'BNE', siteName: 'Brisbane', annualDepletion: 1031000, monthlyDepletion: 85916.67, annualNewBusiness: 302680, monthlyNewBusiness: 25223.33, sortOrder: 4, financialYear: 'FY27', isCurrent: true },
          { siteCode: 'CNS', siteName: 'Cairns', annualDepletion: 706000, monthlyDepletion: 58833.33, annualNewBusiness: 170200, monthlyNewBusiness: 14183.33, sortOrder: 5, financialYear: 'FY27', isCurrent: true },
          { siteCode: 'MKY', siteName: 'Mackay', annualDepletion: 349000, monthlyDepletion: 29083.33, annualNewBusiness: 104880, monthlyNewBusiness: 8740.00, sortOrder: 6, financialYear: 'FY27', isCurrent: true },
          { siteCode: 'PER', siteName: 'Perth', annualDepletion: 996000, monthlyDepletion: 83000.00, annualNewBusiness: 348680, monthlyNewBusiness: 29056.67, sortOrder: 7, financialYear: 'FY27', isCurrent: true },
          { siteCode: 'ALB', siteName: 'Albury', annualDepletion: 481000, monthlyDepletion: 40083.33, annualNewBusiness: 0, monthlyNewBusiness: 0.00, sortOrder: 8, financialYear: 'FY27', isCurrent: true },
          { siteCode: 'LINEN_HUB', siteName: 'LINEN HUB', annualDepletion: 2300000, monthlyDepletion: 191666.67, annualNewBusiness: 0, monthlyNewBusiness: 0.00, sortOrder: 9, financialYear: 'FY27', isCurrent: true }
        ];
        setBudgetRecords(fallback);
        setEditableRows(JSON.parse(JSON.stringify(fallback)));
      }
    } catch (err: any) {
      console.error('Error loading linen budgets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, [selectedFY]);

  // Is the currently selected year marked as isCurrent?
  const isCurrentFY = useMemo(() => {
    return budgetRecords.some(r => r.isCurrent);
  }, [budgetRecords]);

  // Compute table totals
  const currentWorkingRows = isEditMode ? editableRows : budgetRecords;

  const siteRows = useMemo(() => {
    return currentWorkingRows.filter(r => r.siteCode !== 'LINEN_HUB');
  }, [currentWorkingRows]);

  const linenHubRow = useMemo(() => {
    return currentWorkingRows.find(r => r.siteCode === 'LINEN_HUB');
  }, [currentWorkingRows]);

  const totals = useMemo(() => {
    const totalSiteDepletion = siteRows.reduce((acc, r) => acc + (Number(r.annualDepletion) || 0), 0);
    const totalSiteMonthlyDep = siteRows.reduce((acc, r) => acc + (Number(r.monthlyDepletion) || 0), 0);
    const totalSiteNewBusiness = siteRows.reduce((acc, r) => acc + (Number(r.annualNewBusiness) || 0), 0);
    const totalSiteMonthlyNB = siteRows.reduce((acc, r) => acc + (Number(r.monthlyNewBusiness) || 0), 0);
    const totalSiteCombined = totalSiteDepletion + totalSiteNewBusiness;

    const lhDepletion = Number(linenHubRow?.annualDepletion) || 0;
    const lhNewBusiness = Number(linenHubRow?.annualNewBusiness) || 0;
    const grandTotalDepletion = totalSiteDepletion + lhDepletion;
    const grandTotalNewBusiness = totalSiteNewBusiness + lhNewBusiness;
    const grandTotal = totalSiteCombined + lhDepletion + lhNewBusiness;

    return {
      siteDepletion: totalSiteDepletion,
      siteMonthlyDep: totalSiteMonthlyDep,
      siteNewBusiness: totalSiteNewBusiness,
      siteMonthlyNB: totalSiteMonthlyNB,
      siteCombined: totalSiteCombined,
      lhDepletion,
      lhNewBusiness,
      grandTotalDepletion,
      grandTotalNewBusiness,
      grandTotal
    };
  }, [siteRows, linenHubRow]);

  const handleCellChange = (siteCode: string, field: 'annualDepletion' | 'annualNewBusiness', valStr: string) => {
    const num = Math.max(0, parseFloat(valStr) || 0);
    setEditableRows(prev => prev.map(row => {
      if (row.siteCode !== siteCode) return row;
      const updated = { ...row, [field]: num };
      if (field === 'annualDepletion') {
        updated.monthlyDepletion = Number((num / 12).toFixed(2));
      } else if (field === 'annualNewBusiness') {
        updated.monthlyNewBusiness = Number((num / 12).toFixed(2));
      }
      return updated;
    }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      await db.saveLinenBudget(editableRows);
      setBudgetRecords(JSON.parse(JSON.stringify(editableRows)));
      setIsEditMode(false);
      setStatusMessage({ type: 'success', text: `Successfully saved ${selectedFY} budget changes to database.` });
    } catch (err: any) {
      console.error('Failed to save linen budget:', err);
      setStatusMessage({ type: 'error', text: `Failed to save changes: ${err.message || 'Database error'}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetCurrentFY = async () => {
    setIsSaving(true);
    try {
      await db.setCurrentFinancialYear(selectedFY);
      await loadBudgets();
      setStatusMessage({ type: 'success', text: `${selectedFY} is now designated as the active operational budget.` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to set active budget: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNewYear = async () => {
    if (!newFYName.trim()) return;
    setIsSaving(true);
    try {
      await db.createFinancialYearBudget(newFYName.trim().toUpperCase(), cloneFromFY);
      setShowNewYearModal(false);
      setSelectedFY(newFYName.trim().toUpperCase());
      setStatusMessage({ type: 'success', text: `Created new financial year budget ${newFYName.trim().toUpperCase()}.` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to create budget: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const formatAUD = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return '$0';
    return '$' + Math.round(val).toLocaleString('en-AU');
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <DollarSign size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black uppercase tracking-wider text-gray-900 dark:text-white">
                  Linen Budget
                </h1>
                {isCurrentFY ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    Active Budget
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    Inactive FY
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Manage site-by-site annual linen depletion and new business allocations. Changes automatically flow to EOM Reconciliation.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Financial Year Selector */}
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800/80 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Year:</span>
            <select
              value={selectedFY}
              disabled={isEditMode}
              onChange={(e) => {
                setSelectedFY(e.target.value);
                setStatusMessage(null);
              }}
              className="bg-transparent text-sm font-black text-gray-900 dark:text-white outline-none cursor-pointer"
            >
              {financialYears.map(fy => (
                <option key={fy} value={fy} className="text-gray-900 dark:text-gray-100 dark:bg-gray-800">
                  {fy}
                </option>
              ))}
            </select>
          </div>

          {!isCurrentFY && !isEditMode && (
            <button
              type="button"
              onClick={handleSetCurrentFY}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-xl border border-emerald-500/30 transition-all shadow-sm"
              title="Designate this financial year as the active operational budget"
            >
              <CheckCircle2 size={14} />
              <span>Set as Active Budget</span>
            </button>
          )}

          {!isEditMode ? (
            <button
              type="button"
              onClick={() => setIsEditMode(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              <Edit3 size={14} />
              <span>Edit Budget</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditableRows(JSON.parse(JSON.stringify(budgetRecords)));
                  setIsEditMode(false);
                }}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 rounded-xl border border-gray-300 dark:border-gray-700 transition-all"
              >
                <X size={14} />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md hover:shadow-lg transition-all"
              >
                {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Save Changes</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowNewYearModal(true)}
            disabled={isEditMode}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 rounded-xl border border-indigo-500/20 transition-all"
          >
            <PlusCircle size={14} />
            <span>New FY Budget</span>
          </button>
        </div>
      </div>

      {/* ── STATUS ALERT ────────────────────────────────────────────────────── */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl flex items-center justify-between border ${
          statusMessage.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/20'
        }`}>
          <div className="flex items-center gap-3">
            {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span className="text-xs font-bold">{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-xs font-black hover:opacity-70">Dismiss</button>
        </div>
      )}

      {/* ── KPI HIGHLIGHT CARDS ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1c1f2b] border border-gray-200/80 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Group Budget</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
            {formatAUD(totals.grandTotal)}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            Depletion + New B + Linen Hub
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#1c1f2b] border border-gray-200/80 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Depletion</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Building2 size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {formatAUD(totals.grandTotalDepletion)}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            {formatAUD(totals.siteMonthlyDep + (totals.lhDepletion / 12))} / month run rate
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#1c1f2b] border border-gray-200/80 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">New Business Pool</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
            {formatAUD(totals.grandTotalNewBusiness)}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            {formatAUD(totals.siteMonthlyNB)} / month target
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#1c1f2b] border border-gray-200/80 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Linen Hub Allocation</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Layers size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-blue-600 dark:text-blue-400">
            {formatAUD(totals.lhDepletion)}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            Centralized Pool (Holdings)
          </p>
        </div>
      </div>

      {/* ── BUDGET TABLE ────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1c1f2b] rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-900 dark:text-white">
              {selectedFY} Site Linen Budget Matrix
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Net Ex-GST annual budgets. Monthly allocations are automatically derived as (Annual / 12).
            </p>
          </div>
          {isEditMode && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 animate-pulse">
              Edit Mode Active
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-900/60 text-[11px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-800">
                <th className="py-3.5 px-6">Location</th>
                <th className="py-3.5 px-6 text-right">YRLY Depletion ($)</th>
                <th className="py-3.5 px-6 text-right text-gray-400">Per Month ($)</th>
                <th className="py-3.5 px-6 text-right">YRLY New B ($)</th>
                <th className="py-3.5 px-6 text-right text-gray-400">Per Month ($)</th>
                <th className="py-3.5 px-6 text-right font-black text-gray-900 dark:text-white">Total ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80 text-xs">
              {siteRows.map((row) => {
                const total = (Number(row.annualDepletion) || 0) + (Number(row.annualNewBusiness) || 0);
                return (
                  <tr key={row.siteCode} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-6 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500/60"></span>
                      <span>{row.siteName}</span>
                    </td>

                    {/* Depletion Input / View */}
                    <td className="py-3 px-6 text-right font-semibold">
                      {isEditMode ? (
                        <input
                          type="number"
                          value={row.annualDepletion}
                          onChange={(e) => handleCellChange(row.siteCode, 'annualDepletion', e.target.value)}
                          className="w-32 px-2.5 py-1 text-right text-xs font-bold rounded-lg border border-indigo-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        formatAUD(row.annualDepletion)
                      )}
                    </td>

                    {/* Monthly Depletion (Auto Calculated) */}
                    <td className="py-3 px-6 text-right text-gray-500 dark:text-gray-400 font-mono">
                      {formatAUD(row.monthlyDepletion)}
                    </td>

                    {/* New Business Input / View */}
                    <td className="py-3 px-6 text-right font-semibold">
                      {isEditMode ? (
                        <input
                          type="number"
                          value={row.annualNewBusiness}
                          onChange={(e) => handleCellChange(row.siteCode, 'annualNewBusiness', e.target.value)}
                          className="w-32 px-2.5 py-1 text-right text-xs font-bold rounded-lg border border-indigo-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        formatAUD(row.annualNewBusiness)
                      )}
                    </td>

                    {/* Monthly New Business (Auto Calculated) */}
                    <td className="py-3 px-6 text-right text-gray-500 dark:text-gray-400 font-mono">
                      {formatAUD(row.monthlyNewBusiness)}
                    </td>

                    {/* Combined Total */}
                    <td className="py-3 px-6 text-right font-black text-gray-900 dark:text-white font-mono">
                      {formatAUD(total)}
                    </td>
                  </tr>
                );
              })}

              {/* Total Sites Subtotal Row */}
              <tr className="bg-indigo-50/40 dark:bg-indigo-950/20 font-black text-xs border-t-2 border-indigo-500/20">
                <td className="py-3.5 px-6 text-indigo-950 dark:text-indigo-200 uppercase tracking-wider">
                  Total Sites
                </td>
                <td className="py-3.5 px-6 text-right text-indigo-950 dark:text-indigo-200 font-mono">
                  {formatAUD(totals.siteDepletion)}
                </td>
                <td className="py-3.5 px-6 text-right text-indigo-900/60 dark:text-indigo-400 font-mono">
                  {formatAUD(totals.siteMonthlyDep)}
                </td>
                <td className="py-3.5 px-6 text-right text-indigo-950 dark:text-indigo-200 font-mono">
                  {formatAUD(totals.siteNewBusiness)}
                </td>
                <td className="py-3.5 px-6 text-right text-indigo-900/60 dark:text-indigo-400 font-mono">
                  {formatAUD(totals.siteMonthlyNB)}
                </td>
                <td className="py-3.5 px-6 text-right text-indigo-600 dark:text-indigo-400 font-mono">
                  {formatAUD(totals.siteCombined)}
                </td>
              </tr>

              {/* Linen Hub Row */}
              {linenHubRow && (
                <tr className="bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
                  <td className="py-3.5 px-6 font-black text-amber-900 dark:text-amber-300 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span>LINEN HUB</span>
                  </td>
                  <td className="py-3.5 px-6 text-right font-black text-amber-900 dark:text-amber-300">
                    {isEditMode ? (
                      <input
                        type="number"
                        value={linenHubRow.annualDepletion}
                        onChange={(e) => handleCellChange('LINEN_HUB', 'annualDepletion', e.target.value)}
                        className="w-32 px-2.5 py-1 text-right text-xs font-bold rounded-lg border border-amber-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    ) : (
                      formatAUD(linenHubRow.annualDepletion)
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-right text-amber-800/70 dark:text-amber-400/80 font-mono">
                    {formatAUD(linenHubRow.monthlyDepletion)}
                  </td>
                  <td className="py-3.5 px-6 text-right text-gray-400 font-mono">-</td>
                  <td className="py-3.5 px-6 text-right text-gray-400 font-mono">-</td>
                  <td className="py-3.5 px-6 text-right font-black text-amber-900 dark:text-amber-300 font-mono">
                    {formatAUD(linenHubRow.annualDepletion)}
                  </td>
                </tr>
              )}

              {/* Grand Total Row */}
              <tr className="bg-gray-100/90 dark:bg-gray-900/90 font-black text-sm border-t-2 border-gray-300 dark:border-gray-700">
                <td className="py-4 px-6 text-gray-900 dark:text-white uppercase tracking-wider">
                  Grand Total
                </td>
                <td className="py-4 px-6 text-right text-gray-900 dark:text-white font-mono">
                  {formatAUD(totals.grandTotalDepletion)}
                </td>
                <td className="py-4 px-6 text-right text-gray-500 dark:text-gray-400 font-mono">
                  {formatAUD(totals.siteMonthlyDep + (totals.lhDepletion / 12))}
                </td>
                <td className="py-4 px-6 text-right text-gray-900 dark:text-white font-mono">
                  {formatAUD(totals.grandTotalNewBusiness)}
                </td>
                <td className="py-4 px-6 text-right text-gray-500 dark:text-gray-400 font-mono">
                  {formatAUD(totals.siteMonthlyNB)}
                </td>
                <td className="py-4 px-6 text-right text-emerald-600 dark:text-emerald-400 font-mono text-base">
                  {formatAUD(totals.grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CREATE NEW FY MODAL ─────────────────────────────────────────────── */}
      {showNewYearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#1c1f2b] rounded-3xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-base font-black uppercase tracking-wider text-gray-900 dark:text-white">
                Create New FY Linen Budget
              </h3>
              <button onClick={() => setShowNewYearModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Financial Year Tag (e.g. FY28, FY29)
                </label>
                <input
                  type="text"
                  value={newFYName}
                  onChange={(e) => setNewFYName(e.target.value)}
                  placeholder="FY28"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Baseline Figures
                </label>
                <select
                  value={cloneFromFY}
                  onChange={(e) => setCloneFromFY(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none"
                >
                  {financialYears.map(fy => (
                    <option key={fy} value={fy}>Clone initial numbers from {fy}</option>
                  ))}
                  <option value="">Start with all zeros</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowNewYearModal(false)}
                className="px-4 py-2 text-xs font-black uppercase text-gray-600 dark:text-gray-400 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateNewYear}
                disabled={isSaving || !newFYName.trim()}
                className="px-5 py-2 text-xs font-black uppercase text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition-all"
              >
                Create Budget
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
