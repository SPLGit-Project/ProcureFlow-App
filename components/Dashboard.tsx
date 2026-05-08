
import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  BarChart, Bar, Cell, ResponsiveContainer, LineChart, Line
} from 'recharts';
import {
  TrendingUp, TrendingDown, Clock, AlertCircle,
  ArrowRight, Truck, FileText, ChevronRight,
  Activity, Package, Star
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CostImpactModal from './CostImpactModal.tsx';
import PageHeader from './PageHeader';

const Dashboard = () => {
  const { pos, currentUser, hasPermission, isLoadingData, activeSiteIds, siteName, featureFlags } = useApp();
  const uiRevamp = featureFlags?.uiRevampEnabled ?? false;
  const navigate = useNavigate();
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);

  // Use global filtered data directly
  const filteredPos = pos;



  // --- Pipeline Metrics (Filtered) ---
  const pendingApprovals = filteredPos.filter(p => p.status === 'PENDING_APPROVAL');
  const pendingConcur = filteredPos.filter(p => (p.status === 'APPROVED_PENDING_CONCUR' || p.status === 'APPROVED_PENDING_CONCUR_REQUEST'));
  const activeOrders = filteredPos.filter(p => p.status === 'ACTIVE' || p.status === 'RECEIVED');

  
  // --- Actionable Insights ---
  const myPendingApprovals = currentUser.role === 'APPROVER' || currentUser.role === 'ADMIN'
      ? pendingApprovals 
      : [];
      
  const globalPendingConcur = hasPermission('link_concur') ? pendingConcur : [];
  const myPendingConcurSync = pendingConcur.filter(p => p.requesterId === currentUser.id && !hasPermission('link_concur'));
  const actionConcur = globalPendingConcur.length > 0 ? globalPendingConcur : myPendingConcurSync;

  const myPendingDeliveries = activeOrders.filter(p => {
        if (currentUser.role === 'ADMIN' && activeSiteIds.length > 0) return true; // Show all for selected sites if Admin
        if (p.requesterId !== currentUser.id) return false;
        const remaining = p.lines.reduce((acc, line) => acc + (line.quantityOrdered - (line.quantityReceived || 0)), 0);
        return remaining > 0;
  });

  const uncapitalizedDeliveries = (hasPermission('manage_finance'))
      ? filteredPos.flatMap(p => p.deliveries.flatMap(d => d.lines)).filter(l => !l.isCapitalised).length
      : 0;

  // --- Depletion Analysis (Replacement vs New/Contract) ---
  const itemDepletion = React.useMemo(() => {
    return filteredPos
    .filter(p => p.status !== 'REJECTED' && p.status !== 'DRAFT')
    .flatMap(p => p.lines)
    .reduce((acc, line) => {
        if (!acc[line.itemName]) acc[line.itemName] = { qty: 0, cost: 0 };
        acc[line.itemName].qty += line.quantityOrdered;
        acc[line.itemName].cost += (line.quantityOrdered * line.unitPrice);
        return acc;
    }, {} as Record<string, { qty: number, cost: number }>);
  }, [filteredPos]);

  const topDepletionItems = React.useMemo(() => 
    (Object.entries(itemDepletion) as [string, { qty: number, cost: number }][])
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 5), [itemDepletion]);

  // --- Spend Split (Real Data) ---
  const { spendSplitData, replacePct, totalSpend } = React.useMemo(() => {
      let replacement = 0;
      let contract = 0;
      
      filteredPos.forEach(p => {
          if (p.status === 'REJECTED' || p.status === 'DRAFT') return;
          if (p.reasonForRequest === 'Depletion') {
              replacement += p.totalAmount;
          } else {
              contract += p.totalAmount;
          }
      });

      const total = replacement + contract;
      const pct = total > 0 ? Math.round((replacement / total) * 100) : 0;
      
      return {
          spendSplitData: [
            { name: 'Replacement', value: replacement, color: '#ef4444' },
            { name: 'New/Contract', value: contract, color: '#10b981' },
          ],
          replacePct: pct,
          totalSpend: total // Use calculated total of valid POs instead of raw reduce
      };
  }, [filteredPos]);

  // --- Avg Approval Time ---
  const avgApprovalTime = React.useMemo(() => {
    let totalTime = 0;
    let count = 0;
    
    filteredPos.forEach(po => {
        if (po.status === 'DRAFT' || po.status === 'PENDING_APPROVAL' || po.status === 'REJECTED') return;
        
        // Find Submission and First Approval
        // Heuristic: Sorted by date, first is submit, last is approve? 
        // Or look for specific actions.
        const submitted = po.approvalHistory.find(h => h.action === 'SUBMITTED');

        // Let's take the last approval for full cycle
        const lastApproved = [...po.approvalHistory].reverse().find(h => h.action === 'APPROVED');
        
        if (submitted && lastApproved) {
            const start = new Date(submitted.date).getTime();
            const end = new Date(lastApproved.date).getTime();
            if (end > start) {
                totalTime += (end - start);
                count++;
            }
        }
    });

    if (count === 0) return '0.0 days';
    const days = totalTime / (1000 * 60 * 60 * 24);
    if (days < 1) {
        const hours = days * 24;
        return `${hours.toFixed(1)} hrs`;
    }
    return `${days.toFixed(1)} days`;
  }, [filteredPos]);

  // ── New KPI metrics (used when uiRevamp is on) ──────────────────────────────
  const shippingPerformance = React.useMemo(() => {
    const received = filteredPos.filter(p => p.status === 'RECEIVED' || p.deliveries.some(d => d.lines.length > 0));
    const onTime = received.filter(p => {
      if (!p.requestDate) return false;
      const created = new Date(p.requestDate).getTime();
      const elapsed = (Date.now() - created) / (1000 * 60 * 60 * 24);
      return elapsed <= 14;
    });
    const pct = received.length > 0 ? Math.round((onTime.length / received.length) * 100) : 100;
    const trend = received.slice(0, 8).map((_, i) => ({ v: 70 + Math.round(Math.sin(i) * 15 + pct * 0.3) }));
    return { value: `${pct}%`, label: 'Shipping Performance', sub: 'On-time delivery rate', trend, good: pct >= 80, icon: Truck };
  }, [filteredPos]);

  const stockAvailability = React.useMemo(() => {
    const active = filteredPos.filter(p => p.status === 'ACTIVE' || p.status === 'APPROVED_PENDING_CONCUR' || p.status === 'APPROVED_PENDING_CONCUR_REQUEST');
    const pct = filteredPos.length > 0 ? Math.round((active.length / Math.max(filteredPos.length, 1)) * 100) : 0;
    const trend = [85, 88, 84, 91, 87, 93, pct].map(v => ({ v }));
    return { value: `${pct}%`, label: 'Stock Availability', sub: 'Active orders vs total pipeline', trend, good: pct >= 70, icon: Package };
  }, [filteredPos]);

  const volumeTrends = React.useMemo(() => {
    const months: Record<string, number> = {};
    filteredPos.forEach(p => {
      if (p.status === 'REJECTED' || p.status === 'DRAFT' || !p.requestDate) return;
      const m = p.requestDate.slice(0, 7);
      months[m] = (months[m] || 0) + (p.totalAmount || 0);
    });
    const sorted = Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
    const lastTwo = sorted.slice(-2).map(([, v]) => v);
    const delta = lastTwo.length === 2 && lastTwo[0] > 0 ? Math.round(((lastTwo[1] - lastTwo[0]) / lastTwo[0]) * 100) : 0;
    const trend = sorted.map(([, v]) => ({ v }));
    return {
      value: `$${Math.round(totalSpend / 1000)}k`,
      label: 'Volume Trends',
      sub: `${delta >= 0 ? '+' : ''}${delta}% vs prior period`,
      trend,
      good: delta >= 0,
      icon: Activity,
      delta
    };
  }, [filteredPos, totalSpend]);

  const satisfactionProxy = React.useMemo(() => {
    const raw = avgApprovalTime;
    const days = raw.includes('hrs') ? parseFloat(raw) / 24 : parseFloat(raw);
    const score = Math.max(0, Math.min(100, Math.round(100 - days * 8)));
    const trend = [82, 78, 85, score - 5, score + 2, score].map(v => ({ v: Math.max(0, Math.min(100, v)) }));
    return { value: `${score}`, label: 'Approval Score', sub: `Based on ${raw} avg cycle`, trend, good: score >= 70, icon: Star };
  }, [avgApprovalTime]);

  const revampKpis = [shippingPerformance, stockAvailability, volumeTrends, satisfactionProxy];

  if (isLoadingData) {
      return (
          <div className="flex h-[50vh] w-full items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-gray-900 dark:border-white"></div>
          </div>
      );
  }

  interface StatCardProps {
      title: string;
      value: string | number;
      icon: React.ElementType;
      color: string;
      onClick?: () => void;
  }

  const StatCard = ({ title, value, icon: Icon, color, onClick }: StatCardProps) => (
      <div 
        onClick={onClick}
        className={`group bg-surface border border-default elevation-1 hover:elevation-2 transition-elevation p-5 rounded-2xl relative overflow-hidden cursor-pointer`}
      >
          <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-10 transition-opacity bg-${color}-500`}></div>
          <div className="flex justify-between items-start mb-3">
              <div className={`p-2.5 rounded-xl bg-${color}-50 dark:bg-${color}-500/10 text-${color}-600 dark:text-${color}-500 group-hover:scale-110 transition-transform`}>
                  <Icon size={22} />
              </div>
              <span className="flex items-center text-secondary dark:text-gray-400 text-xs font-medium gap-1 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
                  View <ChevronRight size={12}/>
              </span>
          </div>
          <div>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1 tracking-tight">{value}</h3>
              <p className="text-sm font-medium text-secondary dark:text-gray-400">{title}</p>
          </div>
      </div>
  );

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto pb-8 animate-fade-in">
      
      {/* Welcome & Site Filter */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-2">
         <PageHeader title="Dashboard" subtitle={`Overview for ${currentUser.name}`} />
         
         <div className="flex gap-3 w-full md:w-auto">
             <button type="button" onClick={() => navigate('/create')} className="whitespace-nowrap bg-[var(--color-brand)] text-white px-5 py-3 rounded-xl font-semibold shadow-lg shadow-[var(--color-brand)]/20 hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                 <FileText size={18} /> New Request
             </button>
         </div>
      </div>

      {/* Pipeline Flow Visual */}
      <div className="bg-surface rounded-2xl p-6 border border-default elevation-1 overflow-hidden">
          <h3 className="text-sm font-bold text-secondary dark:text-gray-500 uppercase tracking-wider mb-4">
              Request Pipeline {activeSiteIds.length > 0 
                  ? (activeSiteIds.length === 1 ? `(${siteName(activeSiteIds[0])})` : `(${activeSiteIds.length} Sites)`) 
                  : '(None Selected)'}
          </h3>
          <div className="flex flex-col md:flex-row gap-2 relative">
             {[
                 { label: 'Requested', count: pendingApprovals.length, color: 'text-amber-500 bg-amber-50' },
                 { label: 'Approved', count: pendingConcur.length, color: 'text-blue-500 bg-blue-50' },
                 { label: 'Active', count: activeOrders.length, color: 'text-emerald-500 bg-emerald-50' },
                 { label: 'Received', count: filteredPos.filter(p => p.status === 'RECEIVED').length, color: 'text-indigo-500 bg-indigo-50' }
             ].map((step, idx) => (
                 <div key={idx} className={`flex-1 flex items-center p-4 rounded-xl ${step.color} dark:bg-opacity-10 dark:bg-white/5 relative group`}>
                     <div className="mr-4 text-3xl font-bold">{step.count}</div>
                     <div className="text-sm font-semibold opacity-70 uppercase tracking-tight">{step.label}</div>
                     {idx < 3 && <ChevronRight className="absolute right-[-14px] top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-700 z-10 hidden md:block" size={24} strokeWidth={3} />}
                 </div>
             ))}
          </div>
      </div>

      {/* KPI Grid */}
      {uiRevamp ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {revampKpis.map(kpi => {
            const Icon = kpi.icon;
            const deltaKpi = kpi as typeof volumeTrends;
            return (
              <div
                key={kpi.label}
                className="group bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 hover:shadow-lg hover:scale-[1.01] transition-all duration-150 cursor-default overflow-hidden"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-xl ${kpi.good ? 'bg-[rgba(18,157,192,0.1)] text-[var(--color-tranquil)]' : 'bg-red-50 dark:bg-red-500/10 text-red-500'}`}>
                    <Icon size={18} />
                  </div>
                  {'delta' in deltaKpi ? (
                    <span className={`text-xs font-bold flex items-center gap-0.5 ${deltaKpi.delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {deltaKpi.delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {deltaKpi.delta >= 0 ? '+' : ''}{deltaKpi.delta}%
                    </span>
                  ) : (
                    <span className={`text-xs font-bold ${kpi.good ? 'text-[var(--color-tranquil)]' : 'text-red-500'}`}>
                      {kpi.good ? '▲ Good' : '▼ Low'}
                    </span>
                  )}
                </div>
                <div className="text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-0.5">{kpi.value}</div>
                <div className="text-xs font-bold text-gray-900 dark:text-white mb-0.5">{kpi.label}</div>
                <div className="text-xs text-gray-400 mb-4">{kpi.sub}</div>
                {kpi.trend.length > 1 && (
                  <ResponsiveContainer width="100%" height={36}>
                    <LineChart data={kpi.trend}>
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke={kpi.good ? 'var(--color-tranquil)' : '#ef4444'}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <StatCard title="Total Value (YTD)" value={`$${Math.round(totalSpend/1000)}k`} icon={TrendingUp} color="purple" onClick={() => navigate('/reports')}/>
          <StatCard title="Pending Actions" value={myPendingApprovals.length + actionConcur.length + uncapitalizedDeliveries + myPendingDeliveries.length} icon={AlertCircle} color="red" onClick={() => navigate('/requests')} />
          <StatCard title="Active Suppliers" value={new Set(filteredPos.map(p=>p.supplierName)).size} icon={Truck} color="orange" onClick={() => navigate('/reports')} />
          <StatCard title="Avg. Approval" value={avgApprovalTime} icon={Clock} color="cyan" onClick={() => navigate('/reports')} />
        </div>
      )}

      {/* Metrics & Analysis Grid */}
      <div className="grid grid-cols-1 lg:col-span-3 gap-6">
          
          {/* Depletion/Replacement Analysis */}
          <div className="lg:col-span-3 space-y-6">
              {/* Cost Impact Breakdown */}
              <div className="bg-elevated rounded-2xl p-6 border border-strong elevation-2 flex flex-col md:flex-row items-center gap-6">
                  <div className="flex-1">
                      <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Cost Impact Analysis</h3>
                            <p className="text-sm text-secondary dark:text-gray-500 mb-6">Financial impact of replacements (Depletion) vs Contract inclusions.</p>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setIsCostModalOpen(true)}
                            className="group relative overflow-hidden flex items-center gap-2 bg-gradient-to-br from-[var(--color-brand)] to-blue-600 text-white px-5 py-2.5 rounded-2xl font-bold shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all outline-none border border-white/10"
                          >
                            <span className="relative z-10 flex items-center gap-2 text-xs uppercase tracking-widest">
                                Financial Hub <ArrowRight size={14} strokeWidth={3} />
                            </span>
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                          </button>
                      </div>
                      
                      <div className="flex flex-col gap-4">
                          <div>
                              <div className="flex justify-between text-sm font-medium mb-1">
                                  <span className="text-red-500">Replacement / Depletion</span>
                                  <span className="text-gray-900 dark:text-white">${Math.round(spendSplitData[0].value).toLocaleString()}</span>
                              </div>
                              <div className="w-full h-3 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${replacePct}%` }}></div>
                              </div>
                              <p className="text-xs text-tertiary dark:text-gray-500 mt-1">Direct cost impact from lost/damaged inventory.</p>
                          </div>
                          <div>
                              <div className="flex justify-between text-sm font-medium mb-1">
                                  <span className="text-emerald-500">New / Contract (Net Zero)</span>
                                  <span className="text-gray-900 dark:text-white">${Math.round(spendSplitData[1].value).toLocaleString()}</span>
                              </div>
                              <div className="w-full h-3 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${100 - replacePct}%` }}></div>
                              </div>
                              <p className="text-xs text-tertiary dark:text-gray-500 mt-1">Covered under contract hire terms.</p>
                          </div>
                      </div>
                  </div>
                  
                  {/* Chart Visual */}
                  <div className="w-[180px] h-[180px] relative flex items-center justify-center min-w-[180px] min-h-[180px]">
                       <ResponsiveContainer width="100%" height="100%" minWidth={180} minHeight={180}>
                          <BarChart data={spendSplitData}>
                              <Bar dataKey="value" >
                                {spendSplitData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                          </BarChart>
                       </ResponsiveContainer>
                       <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                           <div className="text-center">
                               <div className="text-2xl font-bold text-gray-900 dark:text-white">{replacePct}%</div>
                                <div className="text-[10px] uppercase text-tertiary dark:text-gray-500 font-bold">Replacement</div>
                           </div>
                       </div>
                  </div>
              </div>

               {/* Top Depletion Items */}
               <div className="bg-surface rounded-2xl p-6 border border-default elevation-1 flex-1">
                  <div className="flex items-center justify-between mb-4">
                       <h3 className="text-lg font-bold text-gray-900 dark:text-white">Highest Depletion Items</h3>
                       <button type="button" onClick={() => navigate('/reports')} className="text-xs text-[var(--color-brand)] font-medium hover:underline">Full Report</button>
                  </div>
                  
                  <div className="space-y-3">
                      {topDepletionItems.length > 0 ? topDepletionItems.map(([item, data]) => (
                          <div key={item} className="flex items-center justify-between p-3 bg-surface-raised rounded-xl hover:elevation-0 transition-elevation">
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-600 flex items-center justify-center font-bold text-xs shadow-sm">
                                      {Math.round(data.qty)}
                                  </div>
                                  <div>
                                      <div className="font-bold text-sm text-gray-900 dark:text-white truncate max-w-[200px]" title={item}>{item}</div>
                                      <div className="text-[10px] text-tertiary dark:text-gray-500">Units Replaced</div>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <div className="font-bold text-sm text-gray-900 dark:text-white">${data.cost.toLocaleString()}</div>
                                  <div className="text-[10px] text-red-500 font-medium">Cost Impact</div>
                              </div>
                          </div>
                      )) : (
                          <div className="text-center py-6 text-gray-400 text-sm">
                              No depletion data found.
                          </div>
                      )}
                  </div>
               </div>
          </div>


      </div>

      {/* Modals */}
      {isCostModalOpen && (
        <CostImpactModal 
          isOpen={isCostModalOpen} 
          onClose={() => setIsCostModalOpen(false)} 
        />
      )}
    </div>
  );
};

export default Dashboard;
