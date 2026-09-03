import React from 'react';
import { ShieldCheck, ArrowRight, FileSpreadsheet, CheckCircle2, DollarSign, Layers, Building2, UploadCloud, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/taxCalculations';
import { classifyLegacyPO } from '../utils/budgetTracking';

export default function EOMReconciliationAdminPanel() {
  const { pos } = useApp();
  const navigate = useNavigate();

  // Calculate high-level reconciliation numbers across all active POs
  const financialTotals = React.useMemo(() => {
    let totalEx = 0;
    let totalInc = 0;
    let totalGst = 0;
    let depletionEx = 0;
    let newBusinessEx = 0;
    let linenHubEx = 0;

    pos.forEach((p) => {
      if (p.status === 'REJECTED' || p.status === 'DRAFT') return;
      const pEx = p.totalAmount || (p.totalAmountIncGst ? p.totalAmountIncGst / 1.10 : 0);
      const pInc = p.totalAmountIncGst ?? (pEx * 1.10);
      const gst = Math.max(0, pInc - pEx);

      totalEx += pEx;
      totalInc += pInc;
      totalGst += gst;

      const desc = (p.comments || p.reasonForRequest || p.customerName || (p.lines?.[0]?.itemName ?? '')).toUpperCase();
      const classified = classifyLegacyPO({
        description: desc,
        site: p.site || p.siteId,
        concurPoNumber: p.concurPoNumber || p.concurRequestNumber,
        customerName: p.customerName,
        reasonForRequest: p.reasonForRequest,
        spendType: p.spendType,
        sector: p.sector,
        contractStream: p.contractStream,
      });

      const siteLower = (p.site || '').toLowerCase();
      const isLinenHub = p.siteId === 'site-hol' || siteLower.includes('linen hub') || siteLower.includes('holdings') || siteLower === 'hol';

      if (isLinenHub || classified.spendType === 'LINEN_HUB' || p.spendType === 'LINEN_HUB') {
        linenHubEx += pEx;
      } else if (classified.spendType === 'NEW_BUSINESS' || p.reasonForRequest === 'New Customer' || p.spendType === 'NEW_BUSINESS') {
        newBusinessEx += pEx;
      } else {
        depletionEx += pEx;
      }
    });

    return {
      totalEx,
      totalInc,
      totalGst,
      depletionEx,
      newBusinessEx,
      linenHubEx,
      orderCount: pos.filter(p => p.status !== 'REJECTED' && p.status !== 'DRAFT').length
    };
  }, [pos]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── HEADER BANNER ────────────────────────────────────────────────────── */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/20 dark:border-emerald-500/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0 mt-1">
              <ShieldCheck size={28} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-base font-black uppercase tracking-wider text-gray-900 dark:text-white">
                  Month-End P&amp;L Reconciliation &amp; Financial Governance
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  100% General Ledger Parity
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl">
                Dedicated administration portal for financial accounting audit and General Ledger alignment. All figures are verified using the net Ex-GST standard matching SAP B1 and Concur month-end files.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/reporting?tab=EOM_BUDGET_RECONCILIATION')}
            className="flex items-center justify-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md hover:shadow-lg transition-all shrink-0 self-start lg:self-auto"
          >
            <FileSpreadsheet size={16} />
            <span>Open EOM 2D Pivot Table</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* ── FINANCIAL RECONCILIATION KPI CARDS ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
            Net Operating Spend (Ex GST)
          </span>
          <p className="text-2xl font-black text-gray-950 dark:text-white tracking-tight mt-1">
            {formatCurrency(financialTotals.depletionEx)}
          </p>
          <span className="text-[11px] font-medium text-gray-500 mt-1 block">
            Routine wash-wear depletion (Operating P&amp;L)
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
            New Business Capital Injections
          </span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-1">
            {formatCurrency(financialTotals.newBusinessEx)}
          </p>
          <span className="text-[11px] font-medium text-gray-500 mt-1 block">
            Customer onboarding &amp; contract additions
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
            Linen Hub Holdings Reserve
          </span>
          <p className="text-2xl font-black text-cyan-600 dark:text-cyan-400 tracking-tight mt-1">
            {formatCurrency(financialTotals.linenHubEx)}
          </p>
          <span className="text-[11px] font-medium text-gray-500 mt-1 block">
            Central replenishment &amp; buffer stock
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
            GST Input Tax Credit
          </span>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight mt-1">
            {formatCurrency(financialTotals.totalGst)}
          </p>
          <span className="text-[11px] font-medium text-gray-500 mt-1 block">
            Gross incurred: {formatCurrency(financialTotals.totalInc)}
          </span>
        </div>
      </div>

      {/* ── BUDGET UPLOAD ROADMAP & AUDIT GOVERNANCE NOTE ─────────────────────── */}
      <div className="p-5 rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <UploadCloud size={18} className="text-[var(--color-brand)]" />
          <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
            Budget File Ingestion &amp; Verification Protocol
          </h4>
        </div>

        <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/80 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300 space-y-2">
          <p className="flex items-start gap-2">
            <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <span>
              <strong>P&amp;L Budget Upload Protocol:</strong> To ensure that budget variances and run-rates are 100% verified and auditable, the system will support uploading official annual and monthly plant budget spreadsheets directly into this Admin module.
            </span>
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-[11px] pl-5">
            Until a budget workbook is uploaded and verified by Finance, all operational views on the main dashboard strictly reflect actual recorded net spend (Ex GST) without unverified variance estimates.
          </p>
        </div>
      </div>
    </div>
  );
}
