import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip,
  CartesianGrid, Legend
} from 'recharts';
import {
  TrendingUp, Package, AlertCircle, ArrowRight, Truck, CheckCircle2,
  Calendar, Layers, Building2, ExternalLink, ShieldCheck,
  Percent, DollarSign, Clock, Filter, ArrowUpRight, BarChart3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from './PageHeader';
import { formatCurrency } from '../utils/taxCalculations';
import { PORequest, POLineItem } from '../types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type TimeframePreset = 'ALL' | 'FY2526' | '90D' | '30D';

export default function Dashboard() {
  const { pos, currentUser, hasPermission, activeSiteIds, siteName } = useApp();
  const navigate = useNavigate();

  const [timeframe, setTimeframe] = useState<TimeframePreset>('ALL');

  // Filter POs by active site and selected timeframe
  const filteredPos = useMemo(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const thirtyDaysAgo = nowMs - 30 * 86400000;
    const ninetyDaysAgo = nowMs - 90 * 86400000;

    return pos.filter((p) => {
      // Exclude draft or rejected
      if (p.status === 'REJECTED' || p.status === 'DRAFT') return false;

      // Site filter
      if (activeSiteIds.length > 0 && !activeSiteIds.includes(p.siteId)) return false;

      // Timeframe filter
      if (timeframe === 'ALL') return true;

      const reqDate = new Date(p.requestDate);
      const reqMs = reqDate.getTime();
      if (isNaN(reqMs)) return true;

      if (timeframe === '30D') return reqMs >= thirtyDaysAgo;
      if (timeframe === '90D') return reqMs >= ninetyDaysAgo;
      if (timeframe === 'FY2526') {
        // FY25/26: July 1, 2025 to June 30, 2026
        const fyStart = new Date(2025, 6, 1).getTime();
        const fyEnd = new Date(2026, 5, 30, 23, 59, 59).getTime();
        return reqMs >= fyStart && reqMs <= fyEnd;
      }

      return true;
    });
  }, [pos, activeSiteIds, timeframe]);

  // ── Executive KPI Metrics ───────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let totalPoEx = 0;
    let totalPoInc = 0;
    let totalGrEx = 0;
    let totalGrInc = 0;
    let totalOpenInc = 0;
    let totalOrderedUnits = 0;
    let totalReceivedUnits = 0;

    filteredPos.forEach((p) => {
      const pInc = p.totalAmountIncGst ?? (p.totalAmount * 1.10);
      totalPoEx += p.totalAmount;
      totalPoInc += pInc;

      let poReceivedEx = 0;
      let poOrderedUnits = 0;
      let poReceivedUnits = 0;

      p.lines.forEach((l) => {
        const ord = l.quantityOrdered || 0;
        const rec = l.quantityReceived || 0;
        poOrderedUnits += ord;
        poReceivedUnits += rec;
        poReceivedEx += (rec * l.unitPrice);
      });

      const poReceivedInc = poReceivedEx * 1.10;
      totalGrEx += poReceivedEx;
      totalGrInc += poReceivedInc;

      totalOrderedUnits += poOrderedUnits;
      totalReceivedUnits += poReceivedUnits;

      if (p.status !== 'CLOSED') {
        const remainingVal = Math.max(0, pInc - poReceivedInc);
        totalOpenInc += remainingVal;
      }
    });

    const fulfillmentRate = totalOrderedUnits > 0
      ? Math.round((totalReceivedUnits / totalOrderedUnits) * 100)
      : 0;

    return {
      totalPoEx,
      totalPoInc,
      totalGrEx,
      totalGrInc,
      totalOpenInc,
      totalOrderedUnits,
      totalReceivedUnits,
      fulfillmentRate,
      orderCount: filteredPos.length
    };
  }, [filteredPos]);

  // ── Monthly Procurement Flow (Recharts Data) ────────────────────────────────
  const monthlyChartData = useMemo(() => {
    const monthMap = new Map<string, {
      monthKey: string;
      monthLabel: string;
      poAmount: number;
      grAmount: number;
      openAmount: number;
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
          poAmount: 0,
          grAmount: 0,
          openAmount: 0,
          orderCount: 0
        });
      }

      const entry = monthMap.get(monthKey)!;
      const poInc = p.totalAmountIncGst ?? (p.totalAmount * 1.10);
      entry.poAmount += poInc;
      entry.orderCount += 1;

      let recValEx = 0;
      p.lines.forEach((l) => {
        recValEx += ((l.quantityReceived || 0) * l.unitPrice);
      });
      const recValInc = recValEx * 1.10;
      entry.grAmount += recValInc;

      if (p.status !== 'CLOSED') {
        entry.openAmount += Math.max(0, poInc - recValInc);
      }
    });

    return Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12) // Show last 12 chronological months
      .map(([_, v]) => v);
  }, [filteredPos]);

  // ── Reason for Request Analysis (Depletion vs New Customer vs Contract) ──────
  const reasonBreakdown = useMemo(() => {
    const map = new Map<string, { reason: string; spend: number; units: number; orderCount: number; color: string }>();
    
    map.set('Depletion', { reason: 'Replacement / Depletion', spend: 0, units: 0, orderCount: 0, color: '#f59e0b' });
    map.set('New Customer', { reason: 'New Customer Launch', spend: 0, units: 0, orderCount: 0, color: '#10b981' });
    map.set('Other', { reason: 'Contract Growth / Other', spend: 0, units: 0, orderCount: 0, color: '#3b82f6' });

    filteredPos.forEach((p) => {
      let key = 'Other';
      if (p.reasonForRequest === 'Depletion') key = 'Depletion';
      else if (p.reasonForRequest === 'New Customer') key = 'New Customer';

      const entry = map.get(key)!;
      const poInc = p.totalAmountIncGst ?? (p.totalAmount * 1.10);
      entry.spend += poInc;
      entry.orderCount += 1;
      p.lines.forEach((l) => {
        entry.units += (l.quantityOrdered || 0);
      });
    });

    const total = kpis.totalPoInc || 1;
    return Array.from(map.values()).map((item) => ({
      ...item,
      pct: Math.round((item.spend / total) * 100)
    }));
  }, [filteredPos, kpis.totalPoInc]);

  // ── Supplier Spend Distribution ─────────────────────────────────────────────
  const supplierSpend = useMemo(() => {
    const map = new Map<string, { supplier: string; spend: number; orders: number; lines: number }>();

    filteredPos.forEach((p) => {
      const sup = p.supplierName || 'Unknown Supplier';
      if (!map.has(sup)) {
        map.set(sup, { supplier: sup, spend: 0, orders: 0, lines: 0 });
      }
      const entry = map.get(sup)!;
      entry.spend += (p.totalAmountIncGst ?? (p.totalAmount * 1.10));
      entry.orders += 1;
      entry.lines += p.lines.length;
    });

    const total = kpis.totalPoInc || 1;
    return Array.from(map.values())
      .map((s) => ({
        ...s,
        sharePct: Math.round((s.spend / total) * 100)
      }))
      .sort((a, b) => b.spend - a.spend);
  }, [filteredPos, kpis.totalPoInc]);

  // ── Site Performance Ranking ────────────────────────────────────────────────
  const sitePerformance = useMemo(() => {
    const map = new Map<string, {
      site: string;
      spend: number;
      orderedUnits: number;
      receivedUnits: number;
      openCount: number;
      topItem: string;
      itemsMap: Map<string, number>;
    }>();

    filteredPos.forEach((p) => {
      const site = p.site || 'National';
      if (!map.has(site)) {
        map.set(site, {
          site,
          spend: 0,
          orderedUnits: 0,
          receivedUnits: 0,
          openCount: 0,
          topItem: '',
          itemsMap: new Map()
        });
      }
      const entry = map.get(site)!;
      entry.spend += (p.totalAmountIncGst ?? (p.totalAmount * 1.10));
      if (p.status !== 'CLOSED') entry.openCount += 1;

      p.lines.forEach((l) => {
        const ord = l.quantityOrdered || 0;
        const rec = l.quantityReceived || 0;
        entry.orderedUnits += ord;
        entry.receivedUnits += rec;

        const curVal = (entry.itemsMap.get(l.itemName) || 0) + (ord * l.unitPrice);
        entry.itemsMap.set(l.itemName, curVal);
      });
    });

    return Array.from(map.values())
      .map((s) => {
        let bestItem = '-';
        let bestVal = 0;
        s.itemsMap.forEach((v, k) => {
          if (v > bestVal) {
            bestVal = v;
            bestItem = k;
          }
        });
        const fulfillment = s.orderedUnits > 0 ? Math.round((s.receivedUnits / s.orderedUnits) * 100) : 0;
        return {
          ...s,
          topItem: bestItem,
          fulfillment
        };
      })
      .sort((a, b) => b.spend - a.spend);
  }, [filteredPos]);

  // ── Top SKU Velocity & Capital Allocation ───────────────────────────────────
  const topSKUs = useMemo(() => {
    const map = new Map<string, {
      name: string;
      sku: string;
      orderedQty: number;
      receivedQty: number;
      spend: number;
      orderCount: number;
    }>();

    filteredPos.forEach((p) => {
      p.lines.forEach((l) => {
        const key = l.itemName;
        if (!map.has(key)) {
          map.set(key, {
            name: l.itemName,
            sku: l.sku || '-',
            orderedQty: 0,
            receivedQty: 0,
            spend: 0,
            orderCount: 0
          });
        }
        const entry = map.get(key)!;
        entry.orderedQty += (l.quantityOrdered || 0);
        entry.receivedQty += (l.quantityReceived || 0);
        entry.spend += ((l.quantityOrdered || 0) * l.unitPrice * 1.10);
        entry.orderCount += 1;
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 8);
  }, [filteredPos]);

  // ── Recent Orders Feed ──────────────────────────────────────────────────────
  const recentOrders = useMemo(() => {
    return [...filteredPos]
      .sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime())
      .slice(0, 5);
  }, [filteredPos]);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-7.25rem)] max-w-7xl flex-col gap-6 overflow-hidden animate-page-entry pb-12">
      <PageHeader title="Executive Dashboard" subtitle="Procurement Analytics & Performance" />

      {/* ── TOP CONTROLS & TIMEFRAME SLICER ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#15171e] p-3.5 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-2xs">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-[var(--color-brand)]" />
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-900 dark:text-white">
              Portfolio Scope
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {activeSiteIds.length === 0
                ? 'Consolidated View (All Laundry Locations)'
                : activeSiteIds.length === 1
                  ? `${siteName(activeSiteIds[0])} Workspace`
                  : `${activeSiteIds.length} Selected Sites`}
            </p>
          </div>
        </div>

        {/* Timeframe selector tabs */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/60 p-1 rounded-xl">
          {[
            { id: 'ALL', label: 'All Time' },
            { id: 'FY2526', label: 'FY 25/26' },
            { id: '90D', label: 'Last 90 Days' },
            { id: '30D', label: 'Last 30 Days' }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTimeframe(t.id as TimeframePreset)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                timeframe === t.id
                  ? 'bg-white dark:bg-[#15171e] text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── EXECUTIVE KPI METRIC CARDS ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Spend */}
        <div className="p-4 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Total PO Issued (Inc GST)
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
              <DollarSign size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-gray-950 dark:text-white tracking-tight">
              {formatCurrency(kpis.totalPoInc)}
            </p>
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">
              <span>Ex GST: {formatCurrency(kpis.totalPoEx)}</span>
              <span>{kpis.orderCount} Orders</span>
            </div>
          </div>
        </div>

        {/* Goods Received */}
        <div className="p-4 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Goods Received (GR Inc GST)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {formatCurrency(kpis.totalGrInc)}
            </p>
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">
              <span>Ex GST: {formatCurrency(kpis.totalGrEx)}</span>
              <span>{kpis.totalReceivedUnits.toLocaleString()} units</span>
            </div>
          </div>
        </div>

        {/* Fulfillment Rate */}
        <div className="p-4 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Delivery Fulfillment Rate
            </span>
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center font-bold">
              <Percent size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-black text-gray-950 dark:text-white tracking-tight">
                {kpis.fulfillmentRate}%
              </p>
              <span className="text-[11px] font-bold text-gray-500">
                {kpis.totalReceivedUnits.toLocaleString()} / {kpis.totalOrderedUnits.toLocaleString()}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, kpis.fulfillmentRate)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Open Commitment */}
        <div className="p-4 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Open Commitment (Inc GST)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Truck size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
              {formatCurrency(kpis.totalOpenInc)}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">
              In-transit &amp; pending orders
            </p>
          </div>
        </div>
      </div>

      {/* ── HERO MONTHLY PROCUREMENT FLOW CHART ───────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Monthly Procurement Flow (PO vs GR vs Open Amount)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Side-by-side breakdown of purchase orders issued and physical goods receipted
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="text-xs font-bold text-[var(--color-brand)] hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Explore Full Reports</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="h-[320px] w-full">
          {monthlyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 15, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#888' }} />
                <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#888' }} />
                <RechartsTooltip
                  formatter={(val: number) => [formatCurrency(val), '']}
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    color: '#fff',
                    borderRadius: '12px',
                    border: 'none',
                    fontSize: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '12px' }} />
                <Bar dataKey="poAmount" name="PO Amount (Inc GST)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="grAmount" name="Goods Received (Inc GST)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="openAmount" name="Open Amount (Inc GST)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-gray-400">
              No procurement activity recorded for this selection.
            </div>
          )}
        </div>
      </div>

      {/* ── STRATEGIC SPEND ANALYTICS: REASON SPLIT & SUPPLIERS ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Reason for Request Analysis */}
        <div className="p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Spend Split by Reason for Request
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Capital Allocation
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Breakdown between replacement inventory (depletion) vs contract additions.
            </p>

            <div className="space-y-3.5">
              {reasonBreakdown.map((r) => (
                <div key={r.reason}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-gray-800 dark:text-gray-200">{r.reason}</span>
                    <span className="font-black text-gray-900 dark:text-white">
                      {formatCurrency(r.spend)} ({r.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${r.pct}%`, backgroundColor: r.color }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                    <span>{r.orderCount} Orders</span>
                    <span>{r.units.toLocaleString()} units</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
            <span className="font-bold text-amber-700 dark:text-amber-300">
              Depletion Cost Impact:
            </span>
            <span className="font-black text-amber-800 dark:text-amber-200">
              {formatCurrency(reasonBreakdown.find((r) => r.reason.includes('Depletion'))?.spend || 0)}
            </span>
          </div>
        </div>

        {/* Supplier Share of Spend */}
        <div className="p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Supplier Share of Spend
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Vendor Distribution
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Primary supplier allocation across active purchase orders.
            </p>

            <div className="space-y-3.5">
              {supplierSpend.slice(0, 4).map((s) => (
                <div key={s.supplier}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-gray-800 dark:text-gray-200 truncate max-w-[200px]" title={s.supplier}>
                      {s.supplier}
                    </span>
                    <span className="font-black text-gray-900 dark:text-white">
                      {formatCurrency(s.spend)} ({s.sharePct}%)
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
              Primary Supplier (Top Spend):
            </span>
            <span className="font-black text-blue-800 dark:text-blue-200 truncate max-w-[200px]">
              {supplierSpend[0]?.supplier || '-'}
            </span>
          </div>
        </div>
      </div>

      {/* ── SITE PROCUREMENT & PERFORMANCE RANKING ────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Site Procurement &amp; Delivery Ranking
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Operating site comparison across total spend, units delivered, and fulfillment
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 font-bold border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="p-3">Laundry Site</th>
                <th className="p-3 text-right">Total Spend (Inc GST)</th>
                <th className="p-3 text-center">Ordered Units</th>
                <th className="p-3 text-center">Delivered Units</th>
                <th className="p-3 text-center">Fulfillment</th>
                <th className="p-3">Top Injected Item</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sitePerformance.map((s) => (
                <tr key={s.site} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                  <td className="p-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Building2 size={14} className="text-gray-400" />
                    <span>{s.site}</span>
                  </td>
                  <td className="p-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(s.spend)}
                  </td>
                  <td className="p-3 text-center font-medium text-gray-700 dark:text-gray-300">
                    {s.orderedUnits.toLocaleString()}
                  </td>
                  <td className="p-3 text-center font-bold text-blue-600 dark:text-blue-400">
                    {s.receivedUnits.toLocaleString()}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      s.fulfillment >= 80
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : s.fulfillment >= 40
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {s.fulfillment}%
                    </span>
                  </td>
                  <td className="p-3 text-gray-600 dark:text-gray-300 truncate max-w-[200px]" title={s.topItem}>
                    {s.topItem}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── TOP SKU VELOCITY & RECENT ORDERS PULSE ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top SKU Ranking (2 Columns) */}
        <div className="lg:col-span-2 p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Top SKU Velocity &amp; Capital Allocation
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Highest-volume inventory items ordered across all sites
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/catalogue')}
              className="text-xs font-bold text-[var(--color-brand)] hover:underline flex items-center gap-1"
            >
              <span>View Catalog</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 font-bold border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="p-2.5">Item Description</th>
                  <th className="p-2.5 text-center">Ordered</th>
                  <th className="p-2.5 text-center text-emerald-600">Received</th>
                  <th className="p-2.5 text-right">Total Invested</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {topSKUs.map((sku) => (
                  <tr key={sku.name} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="p-2.5">
                      <p className="font-bold text-gray-900 dark:text-white truncate max-w-[240px]">{sku.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{sku.sku}</p>
                    </td>
                    <td className="p-2.5 text-center font-medium">{sku.orderedQty.toLocaleString()}</td>
                    <td className="p-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                      {sku.receivedQty.toLocaleString()}
                    </td>
                    <td className="p-2.5 text-right font-black text-gray-900 dark:text-white">
                      {formatCurrency(sku.spend)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Orders Pulse (1 Column) */}
        <div className="p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#15171e] shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Recent Purchase Orders
              </h3>
              <button
                type="button"
                onClick={() => navigate('/requests')}
                className="text-xs font-bold text-[var(--color-brand)] hover:underline flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight size={12} />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Latest procurement submissions.
            </p>

            <div className="space-y-2.5">
              {recentOrders.map((po) => (
                <div
                  key={po.id}
                  onClick={() => navigate(`/requests/${po.id}`)}
                  className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-[var(--color-brand)]/50 hover:shadow-xs transition-all cursor-pointer bg-gray-50/50 dark:bg-gray-900/30"
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-mono font-bold text-xs text-gray-950 dark:text-white">
                      {po.displayId || po.id}
                    </span>
                    <span className="px-2 py-0.2 rounded text-[9px] font-black bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                      {po.status}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate">
                    {po.supplierName}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
                    <span>{po.site}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(po.totalAmountIncGst ?? po.totalAmount * 1.10)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/create')}
            className="w-full mt-4 py-2.5 bg-[var(--color-brand)] text-white text-xs font-bold rounded-xl shadow-xs hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-1.5"
          >
            <span>Create New Request</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
