import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip,
  CartesianGrid, Legend, ReferenceLine
} from 'recharts';
import {
  TrendingUp, Package, AlertCircle, ArrowRight, Truck, CheckCircle2,
  Calendar, Layers, Building2, ExternalLink, ShieldCheck,
  Percent, DollarSign, Clock, Filter, ArrowUpRight, BarChart3,
  Tag, RotateCcw, X, Scale, Receipt, Landmark, PieChart
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from './PageHeader';
import { formatCurrency } from '../utils/taxCalculations';
import { PORequest, POLineItem } from '../types';
import {
  classifyLegacyPO,
  DEFAULT_FY27_BUDGETS,
  GRAND_TOTAL_FY27_BUDGET,
  TOTAL_DEPLETION_BUDGET,
  TOTAL_NEW_BUSINESS_BUDGET,
  LINEN_HUB_TOTAL_BUDGET,
  normalizeBranchCode,
  getBranchDisplayName,
  STANDARD_BRANCH_CODES
} from '../utils/budgetTracking';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type TimeframePreset = 'ALL' | 'FY2627' | 'FY_YTD' | 'YTD' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';
export type DashboardCategory = 'ALL' | 'DEPLETION' | 'ACCOMMODATION' | 'HEALTHCARE' | 'NEW_BUSINESS' | 'LINEN_HUB';

interface CategoryOption {
  id: DashboardCategory;
  label: string;
  dotColor: string;
  activeColor: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { id: 'ALL', label: 'All Categories', dotColor: 'bg-gray-400', activeColor: 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' },
  { id: 'DEPLETION', label: 'Depletion', dotColor: 'bg-amber-500', activeColor: 'bg-amber-500 text-white shadow-amber-500/20' },
  { id: 'ACCOMMODATION', label: 'Accommodation', dotColor: 'bg-blue-500', activeColor: 'bg-blue-600 text-white shadow-blue-500/20' },
  { id: 'HEALTHCARE', label: 'Healthcare', dotColor: 'bg-purple-500', activeColor: 'bg-purple-600 text-white shadow-purple-500/20' },
  { id: 'NEW_BUSINESS', label: 'New Business', dotColor: 'bg-emerald-500', activeColor: 'bg-emerald-600 text-white shadow-emerald-500/20' },
  { id: 'LINEN_HUB', label: 'Linen Hub', dotColor: 'bg-cyan-500', activeColor: 'bg-cyan-600 text-white shadow-cyan-500/20' }
];

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
    const fyStart = new Date(2026, 6, 1, 0, 0, 0, 0).getTime();
    const fyEnd = new Date(2027, 5, 30, 23, 59, 59, 999).getTime();
    return reqMs >= fyStart && reqMs <= fyEnd;
  }

  if (preset === 'FY_YTD') {
    const fyStartYear = currentMonth >= 6 ? currentYear : currentYear - 1;
    const fyStart = new Date(fyStartYear, 6, 1, 0, 0, 0, 0).getTime();
    const fyEnd = now.getTime();
    return reqMs >= fyStart && reqMs <= fyEnd;
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

function matchesCategory(po: PORequest, cat: DashboardCategory): boolean {
  if (cat === 'ALL') return true;

  const desc = (po.comments || po.reasonForRequest || po.customerName || (po.lines?.[0]?.itemName ?? '')).toUpperCase();
  const classified = classifyLegacyPO({
    description: desc,
    site: po.site || po.siteId,
    concurPoNumber: po.concurPoNumber || po.concurRequestNumber,
    customerName: po.customerName,
    reasonForRequest: po.reasonForRequest,
    spendType: po.spendType,
    sector: po.sector,
    contractStream: po.contractStream,
  });

  const siteLower = (po.site || '').toLowerCase();
  const isLinenHub = po.siteId === 'site-hol' || siteLower.includes('linen hub') || siteLower.includes('holdings') || siteLower === 'hol';

  switch (cat) {
    case 'DEPLETION':
      return !isLinenHub && (
        classified.spendType === 'DEPLETION' ||
        po.reasonForRequest === 'Depletion' ||
        po.spendType === 'DEPLETION' ||
        desc.includes('DEPLETION') ||
        desc.includes('DEP')
      );

    case 'NEW_BUSINESS':
      return !isLinenHub && (
        classified.spendType === 'NEW_BUSINESS' ||
        po.reasonForRequest === 'New Customer' ||
        po.spendType === 'NEW_BUSINESS' ||
        desc.includes('NEW BUSINESS') ||
        desc.includes('NEW CUST') ||
        desc.includes('NB')
      );

    case 'LINEN_HUB':
      return isLinenHub || classified.spendType === 'LINEN_HUB' || po.spendType === 'LINEN_HUB' || desc.includes('LINEN HUB');

    case 'ACCOMMODATION':
      return (
        classified.sector === 'ACCOMMODATION' ||
        po.sector === 'ACCOMMODATION' ||
        desc.includes('HOTEL') ||
        desc.includes('RESORT') ||
        po.lines?.some(l => (l.itemName || '').toUpperCase().includes('ACCOM'))
      );

    case 'HEALTHCARE':
      return (
        classified.sector === 'HEALTHCARE' ||
        po.sector === 'HEALTHCARE' ||
        desc.includes('HOSPITAL') ||
        desc.includes('HEALTHCARE') ||
        desc.includes('HSV') ||
        desc.includes('RHC') ||
        po.lines?.some(l => (l.itemName || '').toUpperCase().includes('HEALTH') || (l.itemName || '').toUpperCase().includes('GOWN') || (l.itemName || '').toUpperCase().includes('SCRUB'))
      );

    default:
      return true;
  }
}

export default function Dashboard() {
  const { pos, currentUser, hasPermission, activeSiteIds, siteName } = useApp();
  const navigate = useNavigate();

  const [timeframe, setTimeframe] = useState<TimeframePreset>('ALL');
  const [category, setCategory] = useState<DashboardCategory>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Filter POs by active site, selected timeframe, and selected category
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

      // Category filter
      if (!matchesCategory(p, category)) {
        return false;
      }

      return true;
    });
  }, [pos, activeSiteIds, timeframe, category, customStartDate, customEndDate]);

  // Compute category order counts under current site & timeframe
  const categoryCounts = useMemo(() => {
    const counts: Record<DashboardCategory, number> = {
      ALL: 0,
      DEPLETION: 0,
      ACCOMMODATION: 0,
      HEALTHCARE: 0,
      NEW_BUSINESS: 0,
      LINEN_HUB: 0
    };

    pos.forEach((p) => {
      if (p.status === 'REJECTED' || p.status === 'DRAFT') return;
      if (activeSiteIds.length > 0 && !activeSiteIds.includes(p.siteId)) return;
      if (!matchesTimeframe(p.requestDate, timeframe, customStartDate, customEndDate)) return;

      counts.ALL++;
      if (matchesCategory(p, 'DEPLETION')) counts.DEPLETION++;
      if (matchesCategory(p, 'ACCOMMODATION')) counts.ACCOMMODATION++;
      if (matchesCategory(p, 'HEALTHCARE')) counts.HEALTHCARE++;
      if (matchesCategory(p, 'NEW_BUSINESS')) counts.NEW_BUSINESS++;
      if (matchesCategory(p, 'LINEN_HUB')) counts.LINEN_HUB++;
    });

    return counts;
  }, [pos, activeSiteIds, timeframe, customStartDate, customEndDate]);

  // ── Executive Financial Spend & P&L KPI Metrics ────────────────────────────
  const financialKpis = useMemo(() => {
    let totalSpendEx = 0;
    let totalSpendInc = 0;
    let totalGst = 0;

    let depletionSpendEx = 0;
    let newBusinessSpendEx = 0;
    let linenHubSpendEx = 0;

    let accommodationSpendEx = 0;
    let healthcareSpendEx = 0;

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

      // Spend Nature (Ex GST)
      if (isLinenHub || classified.spendType === 'LINEN_HUB' || p.spendType === 'LINEN_HUB') {
        linenHubSpendEx += pEx;
      } else if (classified.spendType === 'NEW_BUSINESS' || p.reasonForRequest === 'New Customer' || p.spendType === 'NEW_BUSINESS') {
        newBusinessSpendEx += pEx;
      } else {
        depletionSpendEx += pEx;
      }

      // Sector (Ex GST)
      if (classified.sector === 'HEALTHCARE' || p.sector === 'HEALTHCARE') {
        healthcareSpendEx += pEx;
      } else {
        accommodationSpendEx += pEx;
      }
    });

    // Budget determination based on active site scope
    let siteAnnualBudget = GRAND_TOTAL_FY27_BUDGET;
    let siteMonthlyBudget = GRAND_TOTAL_FY27_BUDGET / 12;

    if (activeSiteIds.length === 1) {
      const bCode = normalizeBranchCode(siteName(activeSiteIds[0]));
      if (bCode === 'HOL') {
        siteAnnualBudget = LINEN_HUB_TOTAL_BUDGET;
        siteMonthlyBudget = LINEN_HUB_TOTAL_BUDGET / 12;
      } else if (DEFAULT_FY27_BUDGETS[bCode]) {
        siteAnnualBudget = DEFAULT_FY27_BUDGETS[bCode].annualTotalBudget;
        siteMonthlyBudget = DEFAULT_FY27_BUDGETS[bCode].annualTotalBudget / 12;
      }
    }

    // Determine pro-rata budget target for selected timeframe
    const now = new Date();
    let proRataBudget = siteAnnualBudget;
    let periodLabel = 'FY27 Annual Budget Envelope';

    if (timeframe === 'THIS_MONTH' || timeframe === 'LAST_MONTH') {
      proRataBudget = siteMonthlyBudget;
      periodLabel = timeframe === 'THIS_MONTH' ? 'Monthly Budget (This Month)' : 'Monthly Budget (Last Month)';
    } else if (timeframe === 'FY_YTD') {
      const monthsElapsed = now.getMonth() >= 6 ? (now.getMonth() - 6 + 1) : (now.getMonth() + 7);
      proRataBudget = siteMonthlyBudget * monthsElapsed;
      periodLabel = `FYTD Budget (${monthsElapsed} Months Pro-Rata)`;
    } else if (timeframe === 'YTD') {
      const monthsElapsed = now.getMonth() + 1;
      proRataBudget = siteMonthlyBudget * monthsElapsed;
      periodLabel = `YTD Budget (${monthsElapsed} Months Pro-Rata)`;
    } else if (timeframe === 'FY2627') {
      proRataBudget = siteAnnualBudget;
      periodLabel = 'FY26-27 Full Year Budget';
    } else if (timeframe === 'CUSTOM') {
      const startMs = customStartDate ? new Date(`${customStartDate}T00:00:00`).getTime() : null;
      const endMs = customEndDate ? new Date(`${customEndDate}T23:59:59.999`).getTime() : null;
      if (startMs && endMs && endMs > startMs) {
        const days = Math.max(1, Math.round((endMs - startMs) / 86400000));
        proRataBudget = (siteAnnualBudget / 365) * days;
        periodLabel = `Custom Window (${days} Days Pro-Rata)`;
      }
    }

    // Variance = Actual - Budget. Negative indicates favourable under-budget execution.
    const varianceEx = totalSpendEx - proRataBudget;
    const variancePct = proRataBudget > 0 ? (varianceEx / proRataBudget) * 100 : 0;
    const isFavourable = varianceEx <= 0;
    const budgetConsumptionPct = proRataBudget > 0 ? Math.round((totalSpendEx / proRataBudget) * 100) : 0;

    return {
      totalSpendEx,
      totalSpendInc,
      totalGst,
      depletionSpendEx,
      newBusinessSpendEx,
      linenHubSpendEx,
      accommodationSpendEx,
      healthcareSpendEx,
      orderCount: filteredPos.length,
      proRataBudget,
      periodLabel,
      varianceEx,
      variancePct,
      isFavourable,
      budgetConsumptionPct,
      siteAnnualBudget,
      siteMonthlyBudget
    };
  }, [filteredPos, activeSiteIds, siteName, timeframe, customStartDate, customEndDate]);

  // ── Monthly Net Spend Flow vs Budget Envelope ──────────────────────────────
  const monthlySpendData = useMemo(() => {
    const monthMap = new Map<string, {
      monthKey: string;
      monthLabel: string;
      depletionSpend: number;
      newBusinessSpend: number;
      linenHubSpend: number;
      totalSpend: number;
      budgetBaseline: number;
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
          linenHubSpend: 0,
          totalSpend: 0,
          budgetBaseline: Math.round(financialKpis.siteMonthlyBudget),
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

      if (isLinenHub || classified.spendType === 'LINEN_HUB' || p.spendType === 'LINEN_HUB') {
        entry.linenHubSpend += pEx;
      } else if (classified.spendType === 'NEW_BUSINESS' || p.reasonForRequest === 'New Customer' || p.spendType === 'NEW_BUSINESS') {
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
        linenHubSpend: Math.round(v.linenHubSpend),
        totalSpend: Math.round(v.totalSpend)
      }));
  }, [filteredPos, financialKpis.siteMonthlyBudget]);

  // ── Plant-by-Plant Spend vs FY27 Budget Performance ─────────────────────────
  const plantSpendPerformance = useMemo(() => {
    const map = new Map<string, {
      branchCode: string;
      siteName: string;
      actualSpendEx: number;
      actualSpendInc: number;
      depletionSpendEx: number;
      newBusinessSpendEx: number;
      linenHubSpendEx: number;
      accommodationSpendEx: number;
      healthcareSpendEx: number;
      orderCount: number;
      allocatedBudget: number;
    }>();

    STANDARD_BRANCH_CODES.forEach((bCode) => {
      let allocatedBudget = 0;
      if (bCode === 'HOL') {
        allocatedBudget = LINEN_HUB_TOTAL_BUDGET;
      } else if (DEFAULT_FY27_BUDGETS[bCode]) {
        allocatedBudget = DEFAULT_FY27_BUDGETS[bCode].annualTotalBudget;
      }

      if (timeframe === 'THIS_MONTH' || timeframe === 'LAST_MONTH') {
        allocatedBudget = allocatedBudget / 12;
      } else if (timeframe === 'FY_YTD') {
        const now = new Date();
        const monthsElapsed = now.getMonth() >= 6 ? (now.getMonth() - 6 + 1) : (now.getMonth() + 7);
        allocatedBudget = (allocatedBudget / 12) * monthsElapsed;
      } else if (timeframe === 'YTD') {
        const now = new Date();
        const monthsElapsed = now.getMonth() + 1;
        allocatedBudget = (allocatedBudget / 12) * monthsElapsed;
      }

      map.set(bCode, {
        branchCode: bCode,
        siteName: getBranchDisplayName(bCode),
        actualSpendEx: 0,
        actualSpendInc: 0,
        depletionSpendEx: 0,
        newBusinessSpendEx: 0,
        linenHubSpendEx: 0,
        accommodationSpendEx: 0,
        healthcareSpendEx: 0,
        orderCount: 0,
        allocatedBudget
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
          linenHubSpendEx: 0,
          accommodationSpendEx: 0,
          healthcareSpendEx: 0,
          orderCount: 0,
          allocatedBudget: 0
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

      const isLinenHub = bCode === 'HOL' || classified.spendType === 'LINEN_HUB' || p.spendType === 'LINEN_HUB';

      if (isLinenHub) {
        entry.linenHubSpendEx += pEx;
      } else if (classified.spendType === 'NEW_BUSINESS' || p.reasonForRequest === 'New Customer' || p.spendType === 'NEW_BUSINESS') {
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

    const totalNetworkSpendEx = financialKpis.totalSpendEx || 1;

    return Array.from(map.values())
      .filter((p) => p.actualSpendEx > 0 || p.allocatedBudget > 0)
      .map((p) => {
        const varianceEx = p.actualSpendEx - p.allocatedBudget;
        const variancePct = p.allocatedBudget > 0 ? (varianceEx / p.allocatedBudget) * 100 : 0;
        const isFavourable = varianceEx <= 0;
        const shareOfTotal = (p.actualSpendEx / totalNetworkSpendEx) * 100;
        const budgetConsumptionPct = p.allocatedBudget > 0 ? Math.min(200, Math.round((p.actualSpendEx / p.allocatedBudget) * 100)) : 0;

        return {
          ...p,
          varianceEx,
          variancePct,
          isFavourable,
          shareOfTotal,
          budgetConsumptionPct
        };
      })
      .sort((a, b) => b.actualSpendEx - a.actualSpendEx);
  }, [filteredPos, financialKpis.totalSpendEx, timeframe]);

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

    const totalEx = financialKpis.totalSpendEx || 1;
    return Array.from(map.values())
      .map((s) => ({
        ...s,
        sharePct: Math.round((s.spendEx / totalEx) * 100)
      }))
      .sort((a, b) => b.spendEx - a.spendEx);
  }, [filteredPos, financialKpis.totalSpendEx]);

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

  // ── Recent Orders Feed ──────────────────────────────────────────────────────
  const recentOrders = useMemo(() => {
    return [...filteredPos]
      .sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime())
      .slice(0, 5);
  }, [filteredPos]);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-7.25rem)] max-w-7xl flex-col gap-5 sm:gap-6 overflow-hidden animate-page-entry px-3 sm:px-6 pb-12">
      <PageHeader title="Executive Dashboard" subtitle="Procurement Analytics & Performance" />

      {/* ── TOP CONTROLS, TIMEFRAME SLICER & CATEGORY FILTER ────────────────── */}
      <div className="bg-white dark:bg-[#15171e] p-3.5 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-2xs space-y-3.5">
        {/* Tier 1: Portfolio Scope Identity & Timeframe Toggles */}
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
                {(timeframe !== 'ALL' || category !== 'ALL') && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                    {filteredPos.length} filtered {filteredPos.length === 1 ? 'order' : 'orders'}
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
              { id: 'FY_YTD', label: 'FY YTD' },
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

        {/* Custom Date Range Picker Drawer (when Date Range is active) */}
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

        {/* Tier 2: Category Filter Toggles */}
        <div className="pt-2.5 border-t border-gray-100 dark:border-gray-800/80 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 shrink-0">
            <Tag size={13} className="text-gray-400" />
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Category:
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5">
            {CATEGORY_OPTIONS.map((cat) => {
              const isSelected = category === cat.id;
              const count = categoryCounts[cat.id];
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(category === cat.id && cat.id !== 'ALL' ? 'ALL' : cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    isSelected
                      ? `${cat.activeColor} shadow-sm`
                      : 'bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {cat.id !== 'ALL' && (
                    <span className={`w-2 h-2 rounded-full ${cat.dotColor} shrink-0 ${isSelected ? 'ring-2 ring-white/60' : ''}`} />
                  )}
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    isSelected
                      ? 'bg-black/20 text-white dark:bg-white/20'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}

            {(category !== 'ALL' || timeframe !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setTimeframe('ALL');
                  setCategory('ALL');
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shrink-0 ml-1"
                title="Reset all filters"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── MONTH-END P&L RECONCILIATION ASSURANCE BRIDGE ────────────────────── */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 dark:border-emerald-500/30 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0 mt-0.5">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Month-End P&amp;L Reconciliation Assurance
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                  100% General Ledger Parity
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                All spend metrics reflect strictly Ex-GST accounting treatment matching SAP B1 and the audited FY27 EOM Budget Reconciliation matrix.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/reporting?tab=EOM_BUDGET_RECONCILIATION')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-100/90 dark:bg-emerald-950/50 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 rounded-xl transition-all shrink-0 self-start md:self-auto border border-emerald-500/20"
          >
            <span>Open Full EOM 2D Pivot Table</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* ── EXECUTIVE FINANCIAL KPI CARDS (P&L SPEND FOCUS) ─────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Total Net P&L Spend (Ex-GST) */}
        <div className="p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Net P&amp;L Spend (Ex GST)
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
              <DollarSign size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-xl sm:text-2xl font-black text-gray-950 dark:text-white tracking-tight">
                {formatCurrency(financialKpis.totalSpendEx)}
              </p>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                P&amp;L Recognized
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800/80 font-medium">
              <span>Gross (Inc GST): {formatCurrency(financialKpis.totalSpendInc)}</span>
              <span>GST: {formatCurrency(financialKpis.totalGst)}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Spend vs Budget Run-Rate & Variance */}
        <div className="p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Spend vs Budget Run-Rate
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
              financialKpis.isFavourable ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
            }`}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-1">
              <p className={`text-xl sm:text-2xl font-black tracking-tight ${
                financialKpis.isFavourable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {financialKpis.isFavourable ? '-' : '+'}{formatCurrency(Math.abs(financialKpis.varianceEx))}
              </p>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                financialKpis.isFavourable
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
              }`}>
                {financialKpis.isFavourable ? 'Favourable' : 'Over Budget'} ({financialKpis.variancePct > 0 ? `+${financialKpis.variancePct.toFixed(1)}%` : `${financialKpis.variancePct.toFixed(1)}%`})
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  financialKpis.isFavourable ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, financialKpis.budgetConsumptionPct)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-1.5 font-medium">
              <span className="truncate max-w-[140px]">{financialKpis.periodLabel}</span>
              <span className="font-bold">{formatCurrency(financialKpis.proRataBudget)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Commercial Sector Spend (Accommodation vs Healthcare) */}
        <div className="p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Commercial Sector Spend
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
              <Building2 size={16} />
            </div>
          </div>
          <div>
            {(() => {
              const totalSec = (financialKpis.accommodationSpendEx + financialKpis.healthcareSpendEx) || 1;
              const accomPct = Math.round((financialKpis.accommodationSpendEx / totalSec) * 100);
              const healthPct = 100 - accomPct;
              return (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Accom: {formatCurrency(financialKpis.accommodationSpendEx)}
                    </span>
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      Health: {formatCurrency(financialKpis.healthcareSpendEx)}
                    </span>
                  </div>
                  {/* Split bar */}
                  <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex mt-2">
                    <div style={{ width: `${accomPct}%` }} className="bg-blue-500 transition-all duration-500" />
                    <div style={{ width: `${healthPct}%` }} className="bg-purple-500 transition-all duration-500" />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-1.5 font-medium">
                    <span>Accommodation {accomPct}%</span>
                    <span>Healthcare {healthPct}%</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Card 4: Spend Nature Split (Depletion vs New Business vs Linen Hub) */}
        <div className="p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Spend Nature Allocation
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Layers size={16} />
            </div>
          </div>
          <div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Depletion (Operating)
                </span>
                <span className="font-black text-gray-900 dark:text-white">
                  {formatCurrency(financialKpis.depletionSpendEx)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  New Business (Growth)
                </span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {formatCurrency(financialKpis.newBusinessSpendEx)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                  Linen Hub (Holding)
                </span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {formatCurrency(financialKpis.linenHubSpendEx)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── HERO MONTHLY NET SPEND TREND VS FY27 BUDGET BASELINE ─────────────── */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>Monthly Net Spend Trend vs FY27 Budget Baseline (Ex GST)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                P&amp;L Recognized
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Monthly net expenditure stacked by spend nature (Depletion operating cost, New Business growth pool, Linen Hub buffer) against the monthly budget baseline ({formatCurrency(financialKpis.siteMonthlyBudget)}/mo)
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/reporting?tab=EOM_BUDGET_RECONCILIATION')}
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
                <ReferenceLine
                  y={financialKpis.siteMonthlyBudget}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: `Budget Baseline: ${formatCurrency(financialKpis.siteMonthlyBudget)}`,
                    fill: '#ef4444',
                    position: 'top',
                    fontSize: 10,
                    fontWeight: 'bold'
                  }}
                />
                <Bar dataKey="depletionSpend" name="Depletion (Operating P&L)" stackId="spend" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                <Bar dataKey="newBusinessSpend" name="New Business (Growth Pool)" stackId="spend" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="linenHubSpend" name="Linen Hub (Holding Pool)" stackId="spend" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-gray-400">
              No procurement expenditure recorded for this selection.
            </div>
          )}
        </div>
      </div>

      {/* ── WHERE IS THE MONEY SPENT: PLANT SPEND VS BUDGET CROSS-TABULATION ── */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>Plant-by-Plant Spend vs FY27 Budget Cross-Tabulation</span>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                11 Facilities
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Net P&amp;L expenditure by laundry facility compared against pro-rata FY27 budget allocations ($14.521M network envelope)
            </p>
          </div>
          <span className="text-xs font-bold text-gray-500 self-start sm:self-auto">
            Consolidated Ex GST
          </span>
        </div>

        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-left text-xs min-w-[720px]">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 font-bold border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="p-3">Laundry Facility</th>
                <th className="p-3 text-right">Actual Spend (Ex GST)</th>
                <th className="p-3 text-right">Allocated Budget</th>
                <th className="p-3 text-center">Variance vs Budget</th>
                <th className="p-3 text-center">Sector Split (Accom / Health)</th>
                <th className="p-3 text-right">Share of Spend</th>
                <th className="p-3 text-center">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {plantSpendPerformance.map((s) => (
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
                    {formatCurrency(s.allocatedBudget)}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      s.isFavourable
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                    }`}>
                      {s.isFavourable ? '-' : '+'}{formatCurrency(Math.abs(s.varianceEx))} ({s.variancePct > 0 ? `+${s.variancePct.toFixed(1)}%` : `${s.variancePct.toFixed(1)}%`})
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {(() => {
                      const tot = s.accommodationSpendEx + s.healthcareSpendEx;
                      if (tot === 0) return <span className="text-gray-400">-</span>;
                      const aPct = Math.round((s.accommodationSpendEx / tot) * 100);
                      const hPct = 100 - aPct;
                      return (
                        <div className="flex items-center justify-center gap-1 font-mono text-[11px]">
                          <span className="text-blue-600 dark:text-blue-400 font-bold">{aPct}%</span>
                          <span className="text-gray-400">/</span>
                          <span className="text-purple-600 dark:text-purple-400 font-bold">{hPct}%</span>
                        </div>
                      );
                    })()}
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

      {/* ── STRATEGIC SPEND DRIVERS: SUPPLIER CONCENTRATION & TOP ITEMS ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Supplier Concentration */}
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
              Net P&amp;L expenditure distribution across approved manufacturing partners.
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
                    <span>{s.orders} Purchase Orders</span>
                    <span>{s.lines} Line Items</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs flex items-center justify-between">
            <span className="font-bold text-blue-700 dark:text-blue-300">
              Primary Manufacturing Partner:
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
              Top Expenditure Item:
            </span>
            <span className="font-black text-amber-800 dark:text-amber-200 truncate max-w-[180px]">
              {topItems[0]?.name || '-'}
            </span>
          </div>
        </div>
      </div>

      {/* ── RECENT ORDERS PULSE (FINANCIAL BREAKDOWN) ─────────────────────────── */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] p-4 sm:p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Recent Procurement Commitments
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Latest purchase orders recognized with both Net Ex-GST and Gross Inc-GST values
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/requests')}
            className="text-xs font-bold text-[var(--color-brand)] hover:underline flex items-center gap-1 shrink-0"
          >
            <span>View All Requests</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          {recentOrders.map((po) => {
            const poEx = po.totalAmount || (po.totalAmountIncGst ? po.totalAmountIncGst / 1.10 : 0);
            const poInc = po.totalAmountIncGst ?? (poEx * 1.10);
            return (
              <div
                key={po.id}
                onClick={() => navigate(`/requests/${po.id}`)}
                className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-[var(--color-brand)]/50 hover:shadow-xs transition-all cursor-pointer bg-gray-50/50 dark:bg-gray-900/30 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-mono font-bold text-xs text-gray-950 dark:text-white">
                      {po.displayId || po.id}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                      {po.status}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate">
                    {po.supplierName}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">
                    {po.site}
                  </p>
                </div>
                <div className="pt-2 mt-2 border-t border-gray-200/60 dark:border-gray-800/80">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] text-gray-400">Ex GST:</span>
                    <span className="text-xs font-black text-gray-900 dark:text-white">
                      {formatCurrency(poEx)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-[10px] text-gray-400">
                    <span>Inc GST:</span>
                    <span>{formatCurrency(poInc)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
