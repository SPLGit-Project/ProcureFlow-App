import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip,
  CartesianGrid, Legend
} from 'recharts';
import {
  TrendingUp, ArrowRight, Truck,
  Calendar, Layers, Building2,
  DollarSign, BarChart3,
  X, Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from './PageHeader';
import { formatCurrency } from '../utils/taxCalculations';
import { PORequest, POLineItem } from '../types';
import {
  classifyLegacyPO,
  normalizeBranchCode,
  getBranchDisplayName,
  STANDARD_BRANCH_CODES
} from '../utils/budgetTracking';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type TimeframePreset = 'ALL' | 'FY2627' | 'YTD' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';

function parseDateMs(dateStr?: string): number {
  if (!dateStr) return NaN;
  const direct = new Date(dateStr).getTime();
  if (!isNaN(direct)) return direct;
  const parts = dateStr.split(/[/.-]/);
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    let y = parseInt(parts[2], 10);
    if (y < 100) y += 2000;
    const parsed = new Date(y, m, d).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  return NaN;
}

function matchesTimeframe(
  reqDateStr: string,
  preset: TimeframePreset,
  customStart?: string,
  customEnd?: string
): boolean {
  if (preset === 'ALL') return true;
  const reqMs = parseDateMs(reqDateStr);
  if (isNaN(reqMs)) return true;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  if (preset === 'FY2627') {
    // FY26-27 Year-To-Date (from 1 July 2026 up to current date)
    const fyStart = new Date(2026, 6, 1, 0, 0, 0, 0).getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    return reqMs >= fyStart && reqMs <= endOfToday;
  }

  if (preset === 'YTD') {
    const ytdStart = new Date(currentYear, 0, 1, 0, 0, 0, 0).getTime();
    const ytdEnd = now.getTime();
    return reqMs >= ytdStart && reqMs <= ytdEnd;
  }

  if (preset === 'THIS_MONTH') {
    const start = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0).getTime();
    const end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999).getTime();
    return reqMs >= start && reqMs <= end;
  }

  if (preset === 'LAST_MONTH') {
    const start = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0).getTime();
    const end = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999).getTime();
    return reqMs >= start && reqMs <= end;
  }

  if (preset === 'CUSTOM') {
    const startMs = customStart ? new Date(`${customStart}T00:00:00`).getTime() : null;
    const endMs = customEnd ? new Date(`${customEnd}T23:59:59.999`).getTime() : null;
    if (startMs && reqMs < startMs) return false;
    if (endMs && reqMs > endMs) return false;
    return true;
  }

  return true;
}

export default function Dashboard() {
  const { pos, activeSiteIds, siteName } = useApp();
  const navigate = useNavigate();

  const [timeframe, setTimeframe] = useState<TimeframePreset>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Filter POs by active site and selected timeframe
  const filteredPos = useMemo(() => {
    return pos.filter((p) => {
      // Exclude draft or rejected
      if (p.status === 'REJECTED' || p.status === 'DRAFT') return false;

      // Site filter
      if (activeSiteIds.length > 0 && !activeSiteIds.includes(p.siteId)) return false;

      // Timeframe filter
      if (!matchesTimeframe(p.requestDate, timeframe, customStartDate, customEndDate)) {
        return false;
      }

      return true;
    });
  }, [pos, activeSiteIds, timeframe, customStartDate, customEndDate]);

  // ── Executive Reason-Based Spend KPI Metrics ──────────────────────────────
  const spendKpis = useMemo(() => {
    let totalSpendEx = 0;
    let totalSpendInc = 0;
    let totalGst = 0;

    let depletionSpendEx = 0;
    let depletionOrders = 0;

    let newBusinessSpendEx = 0;
    let newBusinessOrders = 0;

    let otherSpendEx = 0;
    let otherOrders = 0;

    let accommodationSpendEx = 0;
    let accommodationOrders = 0;

    let healthcareSpendEx = 0;
    let healthcareOrders = 0;

    filteredPos.forEach((p) => {
      const pEx = p.totalAmount || (p.totalAmountIncGst ? p.totalAmountIncGst / 1.10 : 0);
      const pInc = p.totalAmountIncGst ?? (pEx * 1.10);
      const gst = Math.max(0, pInc - pEx);

      totalSpendEx += pEx;
      totalSpendInc += pInc;
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

      // Request Reason Classification: Depletion vs New Business vs Other
      const isOtherReason = p.reasonForRequest === 'Other' || isLinenHub || classified.spendType === 'LINEN_HUB' || p.spendType === 'LINEN_HUB';
      const isNewBusinessReason = !isOtherReason && (
        p.reasonForRequest === 'New Customer' ||
        classified.spendType === 'NEW_BUSINESS' ||
        p.spendType === 'NEW_BUSINESS' ||
        desc.includes('NEW BUSINESS') ||
        desc.includes('NEW CUST')
      );

      if (isOtherReason) {
        otherSpendEx += pEx;
        otherOrders++;
      } else if (isNewBusinessReason) {
        newBusinessSpendEx += pEx;
        newBusinessOrders++;
      } else {
        depletionSpendEx += pEx;
        depletionOrders++;
      }

      // Sector Classification: Accommodation vs Healthcare
      if (classified.sector === 'HEALTHCARE' || p.sector === 'HEALTHCARE') {
        healthcareSpendEx += pEx;
        healthcareOrders++;
      } else {
        accommodationSpendEx += pEx;
        accommodationOrders++;
      }
    });

    const total = totalSpendEx || 1;

    return {
      totalSpendEx,
      totalSpendInc,
      totalGst,
      orderCount: filteredPos.length,

      depletionSpendEx,
      depletionOrders,
      depletionPct: (depletionSpendEx / total) * 100,

      newBusinessSpendEx,
      newBusinessOrders,
      newBusinessPct: (newBusinessSpendEx / total) * 100,

      otherSpendEx,
      otherOrders,
      otherPct: (otherSpendEx / total) * 100,

      accommodationSpendEx,
      accommodationOrders,
      accommodationPct: (accommodationSpendEx / total) * 100,

      healthcareSpendEx,
      healthcareOrders,
      healthcarePct: (healthcareSpendEx / total) * 100,
    };
  }, [filteredPos]);

  // ── Monthly Net Spend Flow ────────────────────────────────────────────────
  const monthlySpendData = useMemo(() => {
    const monthMap = new Map<string, {
      monthKey: string;
      monthLabel: string;
      depletionSpend: number;
      newBusinessSpend: number;
      otherSpend: number;
      totalSpend: number;
      orderCount: number;
    }>();

    filteredPos.forEach((p) => {
      const d = new Date(p.requestDate);
      if (isNaN(d.getTime())) return;

      let year = d.getFullYear();
      if (year < 100) year += 2000;
      const m = d.getMonth();
      const monthKey = `${year}-${String(m + 1).padStart(2, '0')}`;
      const monthLabel = `${MONTH_NAMES[m]} ${String(year).slice(-2)}`;

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          monthKey,
          monthLabel,
          depletionSpend: 0,
          newBusinessSpend: 0,
          otherSpend: 0,
          totalSpend: 0,
          orderCount: 0
        });
      }

      const entry = monthMap.get(monthKey)!;
      const pEx = p.totalAmount || (p.totalAmountIncGst ? p.totalAmountIncGst / 1.10 : 0);

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

      const isOtherReason = p.reasonForRequest === 'Other' || isLinenHub || classified.spendType === 'LINEN_HUB' || p.spendType === 'LINEN_HUB';
      const isNewBusinessReason = !isOtherReason && (
        p.reasonForRequest === 'New Customer' ||
        classified.spendType === 'NEW_BUSINESS' ||
        p.spendType === 'NEW_BUSINESS' ||
        desc.includes('NEW BUSINESS') ||
        desc.includes('NEW CUST')
      );

      if (isOtherReason) {
        entry.otherSpend += pEx;
      } else if (isNewBusinessReason) {
        entry.newBusinessSpend += pEx;
      } else {
        entry.depletionSpend += pEx;
      }

      entry.totalSpend += pEx;
      entry.orderCount += 1;
    });

    return Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([_, v]) => ({
        ...v,
        depletionSpend: Math.round(v.depletionSpend),
        newBusinessSpend: Math.round(v.newBusinessSpend),
        otherSpend: Math.round(v.otherSpend),
        totalSpend: Math.round(v.totalSpend)
      }));
  }, [filteredPos]);

  // ── Facility Spend Breakdown across Operating Locations ──────────────────
  const facilitySpend = useMemo(() => {
    const map = new Map<string, {
      branchCode: string;
      siteName: string;
      actualSpendEx: number;
      actualSpendInc: number;
      depletionSpendEx: number;
      newBusinessSpendEx: number;
      otherSpendEx: number;
      accommodationSpendEx: number;
      healthcareSpendEx: number;
      orderCount: number;
    }>();

    STANDARD_BRANCH_CODES.forEach((bCode) => {
      map.set(bCode, {
        branchCode: bCode,
        siteName: getBranchDisplayName(bCode),
        actualSpendEx: 0,
        actualSpendInc: 0,
        depletionSpendEx: 0,
        newBusinessSpendEx: 0,
        otherSpendEx: 0,
        accommodationSpendEx: 0,
        healthcareSpendEx: 0,
        orderCount: 0,
      });
    });

    filteredPos.forEach((p) => {
      const desc = (p.comments || p.reasonForRequest || p.customerName || (p.lines?.[0]?.itemName ?? '')).toUpperCase();
      const bCode = normalizeBranchCode(p.site || p.siteId, desc);

      if (!map.has(bCode)) {
        map.set(bCode, {
          branchCode: bCode,
          siteName: getBranchDisplayName(bCode),
          actualSpendEx: 0,
          actualSpendInc: 0,
          depletionSpendEx: 0,
          newBusinessSpendEx: 0,
          otherSpendEx: 0,
          accommodationSpendEx: 0,
          healthcareSpendEx: 0,
          orderCount: 0,
        });
      }

      const entry = map.get(bCode)!;
      const pEx = p.totalAmount || (p.totalAmountIncGst ? p.totalAmountIncGst / 1.10 : 0);
      const pInc = p.totalAmountIncGst ?? (pEx * 1.10);

      entry.actualSpendEx += pEx;
      entry.actualSpendInc += pInc;
      entry.orderCount += 1;

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
      const isLinenHub = bCode === 'HOL' || p.siteId === 'site-hol' || siteLower.includes('linen hub') || siteLower.includes('holdings') || siteLower === 'hol';

      const isOtherReason = p.reasonForRequest === 'Other' || isLinenHub || classified.spendType === 'LINEN_HUB' || p.spendType === 'LINEN_HUB';
      const isNewBusinessReason = !isOtherReason && (
        p.reasonForRequest === 'New Customer' ||
        classified.spendType === 'NEW_BUSINESS' ||
        p.spendType === 'NEW_BUSINESS' ||
        desc.includes('NEW BUSINESS') ||
        desc.includes('NEW CUST')
      );

      if (isOtherReason) {
        entry.otherSpendEx += pEx;
      } else if (isNewBusinessReason) {
        entry.newBusinessSpendEx += pEx;
      } else {
        entry.depletionSpendEx += pEx;
      }

      if (classified.sector === 'HEALTHCARE' || p.sector === 'HEALTHCARE') {
        entry.healthcareSpendEx += pEx;
      } else {
        entry.accommodationSpendEx += pEx;
      }
    });

    const totalNetworkSpendEx = spendKpis.totalSpendEx || 1;

    return Array.from(map.values())
      .filter((p) => p.actualSpendEx > 0)
      .map((p) => {
        const shareOfTotal = (p.actualSpendEx / totalNetworkSpendEx) * 100;

        let primaryCategory = 'Depletion';
        if (p.otherSpendEx > p.depletionSpendEx && p.otherSpendEx > p.newBusinessSpendEx) {
          primaryCategory = 'Other';
        } else if (p.newBusinessSpendEx > p.depletionSpendEx) {
          primaryCategory = 'New Business';
        }

        return {
          ...p,
          shareOfTotal,
          primaryCategory
        };
      })
      .sort((a, b) => b.actualSpendEx - a.actualSpendEx);
  }, [filteredPos, spendKpis.totalSpendEx]);

  // ── Supplier Spend Concentration ───────────────────────────────────────────
  const supplierSpend = useMemo(() => {
    const map = new Map<string, { supplier: string; spendEx: number; spendInc: number; orders: number; lines: number }>();

    filteredPos.forEach((p) => {
      const sup = p.supplierName || 'Unknown Supplier';
      if (!map.has(sup)) {
        map.set(sup, { supplier: sup, spendEx: 0, spendInc: 0, orders: 0, lines: 0 });
      }
      const entry = map.get(sup)!;
      const pEx = p.totalAmount || (p.totalAmountIncGst ? p.totalAmountIncGst / 1.10 : 0);
      const pInc = p.totalAmountIncGst ?? (pEx * 1.10);
      entry.spendEx += pEx;
      entry.spendInc += pInc;
      entry.orders += 1;
      entry.lines += p.lines.length;
    });

    const totalEx = spendKpis.totalSpendEx || 1;
    return Array.from(map.values())
      .map((s) => ({
        ...s,
        sharePct: Math.round((s.spendEx / totalEx) * 100)
      }))
      .sort((a, b) => b.spendEx - a.spendEx);
  }, [filteredPos, spendKpis.totalSpendEx]);

  // ── Top Linen Item Cost Drivers ────────────────────────────────────────────
  const topItems = useMemo(() => {
    const map = new Map<string, {
      name: string;
      sku: string;
      orderedQty: number;
      spendEx: number;
      spendInc: number;
      orderCount: number;
      avgUnitPrice: number;
    }>();

    filteredPos.forEach((p) => {
      p.lines.forEach((l) => {
        const key = l.itemName;
        if (!map.has(key)) {
          map.set(key, {
            name: l.itemName,
            sku: l.sku || '-',
            orderedQty: 0,
            spendEx: 0,
            spendInc: 0,
            orderCount: 0,
            avgUnitPrice: l.unitPrice || 0
          });
        }
        const entry = map.get(key)!;
        const qty = l.quantityOrdered || 0;
        const lineEx = qty * (l.unitPrice || 0);
        entry.orderedQty += qty;
        entry.spendEx += lineEx;
        entry.spendInc += lineEx * 1.10;
        entry.orderCount += 1;
        if (entry.orderedQty > 0) {
          entry.avgUnitPrice = entry.spendEx / entry.orderedQty;
        }
      });
    });

    const totalItemSpendEx = Array.from(map.values()).reduce((sum, i) => sum + i.spendEx, 0) || 1;

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        spendSharePct: Math.round((item.spendEx / totalItemSpendEx) * 100)
      }))
      .sort((a, b) => b.spendEx - a.spendEx)
      .slice(0, 8);
  }, [filteredPos]);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-7.25rem)] max-w-7xl flex-col gap-5 sm:gap-6 overflow-hidden animate-page-entry px-3 sm:px-6 pb-12">
      <PageHeader title="Executive Dashboard" subtitle="Procurement Spend Analytics" />

      {/* ── TOP CONTROLS & TIMEFRAME PRESETS ─────────────────────────────────── */}
      <div className="bg-white dark:bg-[#15171e] p-3.5 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-2xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center font-bold shrink-0">
              <BarChart3 size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-black uppercase tracking-widest text-gray-900 dark:text-white">
                  Portfolio Scope
                </h2>
                {timeframe !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                    {timeframe === 'FY2627' ? 'FY26-27 YTD' : ''} {filteredPos.length} filtered {filteredPos.length === 1 ? 'order' : 'orders'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[280px] sm:max-w-none">
                {activeSiteIds.length === 0
                  ? 'Consolidated View (All Laundry Locations)'
                  : activeSiteIds.length === 1
                    ? `${siteName(activeSiteIds[0])} Workspace`
                    : `${activeSiteIds.length} Selected Sites`}
              </p>
            </div>
          </div>

          {/* Timeframe selector tabs */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/60 p-1 rounded-xl overflow-x-auto scrollbar-hide max-w-full shrink-0">
            {[
              { id: 'ALL', label: 'All Time' },
              { id: 'FY2627', label: 'FY26-27' },
              { id: 'YTD', label: 'YTD' },
              { id: 'THIS_MONTH', label: 'This Month' },
              { id: 'LAST_MONTH', label: 'Last Month' },
              { id: 'CUSTOM', label: 'Date Range', icon: Calendar }
            ].map((t) => {
              const Icon = (t as any).icon;
              const isActive = timeframe === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTimeframe(t.id as TimeframePreset)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-white dark:bg-[#15171e] text-gray-900 dark:text-white shadow-xs'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {Icon && <Icon size={13} className={isActive ? 'text-[var(--color-brand)]' : 'text-gray-400'} />}
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Date Range Picker Drawer */}
        {timeframe === 'CUSTOM' && (
          <div className="p-3 bg-gray-50/90 dark:bg-white/5 rounded-xl border border-gray-200/80 dark:border-white/10 animate-fade-in flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-gray-600 dark:text-gray-300 uppercase text-[10px] tracking-wider flex items-center gap-1">
                <Calendar size={13} className="text-[var(--color-brand)]" />
                Custom Range:
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#15171e] text-gray-900 dark:text-white font-medium focus:ring-1 focus:ring-[var(--color-brand)] outline-none"
                  placeholder="Start date"
                />
                <span className="text-gray-400 font-bold">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#15171e] text-gray-900 dark:text-white font-medium focus:ring-1 focus:ring-[var(--color-brand)] outline-none"
                  placeholder="End date"
                />
              </div>
              {(customStartDate || customEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Clear dates"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick shortcuts */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              <span className="text-[10px] font-bold text-gray-400 uppercase hidden md:inline">Quick Presets:</span>
              {[
                { label: 'Past 7 Days', days: 7 },
                { label: 'Past 30 Days', days: 30 },
                { label: 'Past 60 Days', days: 60 },
                { label: 'Past 90 Days', days: 90 }
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    const end = new Date();
                    const start = new Date(end.getTime() - p.days * 86400000);
                    setCustomStartDate(start.toISOString().split('T')[0]);
                    setCustomEndDate(end.toISOString().split('T')[0]);
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shadow-2xs whitespace-nowrap"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 4 REASON-BASED SPEND CARDS (DEPLETION, NEW BUSINESS, OTHER) ──────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Total Net Spend (Ex GST) */}
        <div className="p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Total Net Spend
              </span>
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                Consolidated Spend
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold shrink-0">
              <DollarSign size={18} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-gray-950 dark:text-white tracking-tight">
              {formatCurrency(spendKpis.totalSpendEx)}
            </p>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-800/80 flex flex-col gap-1 font-medium">
              <div className="flex items-center justify-between">
                <span>Gross (Inc GST):</span>
                <span className="font-bold text-gray-700 dark:text-gray-300">{formatCurrency(spendKpis.totalSpendInc)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span>GST: {formatCurrency(spendKpis.totalGst)}</span>
                <span className="font-black text-blue-600 dark:text-blue-400">{spendKpis.orderCount} Total Orders</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Depletion (Reason: Depletion) */}
        <div className="p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Depletion
                </span>
              </div>
              <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mt-0.5">
                Reason: Depletion
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold shrink-0">
              <Layers size={18} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-gray-950 dark:text-white tracking-tight">
              {formatCurrency(spendKpis.depletionSpendEx)}
            </p>
            {/* Share progress bar */}
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mt-2.5">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, spendKpis.depletionPct)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-2 font-medium">
              <span className="font-black text-gray-900 dark:text-white">{spendKpis.depletionOrders} Orders</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{spendKpis.depletionPct.toFixed(1)}% of spend</span>
            </div>
          </div>
        </div>

        {/* Card 3: New Business (Reason: New Business) */}
        <div className="p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  New Business
                </span>
              </div>
              <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mt-0.5">
                Reason: New Business
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold shrink-0">
              <TrendingUp size={18} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-gray-950 dark:text-white tracking-tight">
              {formatCurrency(spendKpis.newBusinessSpendEx)}
            </p>
            {/* Share progress bar */}
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mt-2.5">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, spendKpis.newBusinessPct)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-2 font-medium">
              <span className="font-black text-gray-900 dark:text-white">{spendKpis.newBusinessOrders} Orders</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{spendKpis.newBusinessPct.toFixed(1)}% of spend</span>
            </div>
          </div>
        </div>

        {/* Card 4: Other (Reason: Other) */}
        <div className="p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                  Other
                </span>
              </div>
              <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mt-0.5">
                Reason: Other (Dedicated)
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-bold shrink-0">
              <Truck size={18} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-gray-950 dark:text-white tracking-tight">
              {formatCurrency(spendKpis.otherSpendEx)}
            </p>
            {/* Share progress bar */}
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mt-2.5">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, spendKpis.otherPct)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-2 font-medium">
              <span className="font-black text-gray-900 dark:text-white">{spendKpis.otherOrders} Orders</span>
              <span className="font-bold text-cyan-600 dark:text-cyan-400">{spendKpis.otherPct.toFixed(1)}% of spend</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── COMMERCIAL SECTOR DISTRIBUTION BAR (ACCOMMODATION / HEALTHCARE) ── */}
      <div className="bg-white dark:bg-[#15171e] px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 shrink-0">
          <Building2 size={16} className="text-[var(--color-brand)] shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-wider text-gray-900 dark:text-white">
            Commercial Sector Split:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
            <span className="text-gray-600 dark:text-gray-300 font-semibold">Accommodation:</span>
            <span className="font-black text-gray-950 dark:text-white">{formatCurrency(spendKpis.accommodationSpendEx)}</span>
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">({spendKpis.accommodationOrders} Orders • {spendKpis.accommodationPct.toFixed(1)}%)</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-gray-200 dark:bg-gray-700" />
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
            <span className="text-gray-600 dark:text-gray-300 font-semibold">Healthcare:</span>
            <span className="font-black text-gray-950 dark:text-white">{formatCurrency(spendKpis.healthcareSpendEx)}</span>
            <span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold">({spendKpis.healthcareOrders} Orders • {spendKpis.healthcarePct.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {/* ── HERO MONTHLY NET SPEND TREND (EX GST) ────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Monthly Net Spend Trend (Ex GST)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Chronological net expenditure by request reason (Depletion replacement, New Business growth, Other dedicated)
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="text-xs font-bold text-[var(--color-brand)] hover:underline flex items-center gap-1 self-start sm:self-auto shrink-0"
          >
            <span>Explore Full Reports</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="h-[280px] sm:h-[340px] w-full">
          {monthlySpendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySpendData} margin={{ top: 20, right: 15, left: -5, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fill: '#888' }} interval="preserveStartEnd" />
                <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#888' }} />
                <RechartsTooltip
                  formatter={(val: number, name: string) => [formatCurrency(val), name]}
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    color: '#fff',
                    borderRadius: '12px',
                    border: 'none',
                    fontSize: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }} />
                <Bar dataKey="depletionSpend" name="Depletion (Replacement)" stackId="spend" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                <Bar dataKey="newBusinessSpend" name="New Business (Growth)" stackId="spend" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="otherSpend" name="Other (Dedicated)" stackId="spend" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-gray-400">
              No procurement expenditure recorded for this selection.
            </div>
          )}
        </div>
      </div>

      {/* ── FACILITY SPEND BREAKDOWN (EX GST) ─────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>Facility Spend Breakdown (Ex GST)</span>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                11 Locations
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Net procurement expenditure across Specialised Linen Services laundry facilities
            </p>
          </div>
          <span className="text-xs font-bold text-gray-500 self-start sm:self-auto">
            Amounts Net of GST
          </span>
        </div>

        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 font-bold border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="p-3">Laundry Facility</th>
                <th className="p-3 text-right">Net Spend (Ex GST)</th>
                <th className="p-3 text-right">Gross Spend (Inc GST)</th>
                <th className="p-3 text-center">Sector Split (Accom / Health)</th>
                <th className="p-3 text-center">Primary Stream</th>
                <th className="p-3 text-right">Share of Spend</th>
                <th className="p-3 text-center">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {facilitySpend.map((s) => (
                <tr key={s.branchCode} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                  <td className="p-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Building2 size={14} className="text-[var(--color-brand)] shrink-0" />
                    <span className="truncate">{s.siteName}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-bold">
                      {s.branchCode}
                    </span>
                  </td>
                  <td className="p-3 text-right font-black text-gray-950 dark:text-white whitespace-nowrap">
                    {formatCurrency(s.actualSpendEx)}
                  </td>
                  <td className="p-3 text-right font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatCurrency(s.actualSpendInc)}
                  </td>
                  <td className="p-3 text-center">
                    {(() => {
                      const tot = s.accommodationSpendEx + s.healthcareSpendEx;
                      if (tot === 0) return <span className="text-gray-400">-</span>;
                      const aPct = Math.round((s.accommodationSpendEx / tot) * 100);
                      const hPct = 100 - aPct;
                      return (
                        <div className="flex items-center justify-center gap-1 font-mono text-[11px]">
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">{aPct}%</span>
                          <span className="text-gray-400">/</span>
                          <span className="text-purple-600 dark:text-purple-400 font-bold">{hPct}%</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      s.primaryCategory === 'Depletion'
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                        : s.primaryCategory === 'New Business'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300'
                    }`}>
                      {s.primaryCategory}
                    </span>
                  </td>
                  <td className="p-3 text-right font-bold text-gray-700 dark:text-gray-300">
                    {s.shareOfTotal.toFixed(1)}%
                  </td>
                  <td className="p-3 text-center text-gray-500">
                    {s.orderCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── STRATEGIC SPEND ANALYTICS: SUPPLIERS & TOP LINEN SKUS ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Supplier Spend Concentration */}
        <div className="p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Supplier Spend Concentration (Ex GST)
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Vendor Outlay
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Net expenditure distribution across approved manufacturing partners.
            </p>

            <div className="space-y-3.5">
              {supplierSpend.slice(0, 4).map((s) => (
                <div key={s.supplier}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-gray-800 dark:text-gray-200 truncate max-w-[180px] sm:max-w-[220px]" title={s.supplier}>
                      {s.supplier}
                    </span>
                    <span className="font-black text-gray-900 dark:text-white">
                      {formatCurrency(s.spendEx)} ({s.sharePct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-brand)] rounded-full transition-all duration-500"
                      style={{ width: `${s.sharePct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                    <span>{s.orders} Orders</span>
                    <span>{s.lines} Line Items</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs flex items-center justify-between">
            <span className="font-bold text-blue-700 dark:text-blue-300">
              Primary Partner:
            </span>
            <span className="font-black text-blue-800 dark:text-blue-200 truncate max-w-[180px]">
              {supplierSpend[0]?.supplier || '-'} ({supplierSpend[0]?.sharePct || 0}%)
            </span>
          </div>
        </div>

        {/* Top Linen SKU Cost Drivers */}
        <div className="p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Top Linen Item Cost Drivers (Ex GST)
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Expenditure Ranking
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Highest-cost linen product lines driving financial expenditure across plants.
            </p>

            <div className="space-y-3.5">
              {topItems.slice(0, 4).map((item) => (
                <div key={item.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-gray-800 dark:text-gray-200 truncate max-w-[180px] sm:max-w-[220px]" title={item.name}>
                      {item.name}
                    </span>
                    <span className="font-black text-gray-900 dark:text-white">
                      {formatCurrency(item.spendEx)} ({item.spendSharePct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${item.spendSharePct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                    <span>{item.orderedQty.toLocaleString()} units</span>
                    <span>Avg {formatCurrency(item.avgUnitPrice)}/ea</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
            <span className="font-bold text-amber-700 dark:text-amber-300">
              Top Expenditure Line:
            </span>
            <span className="font-black text-amber-800 dark:text-amber-200 truncate max-w-[180px]">
              {topItems[0]?.name || '-'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
