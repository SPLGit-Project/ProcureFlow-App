
import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  BarChart, Bar, Cell, ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, Clock, AlertCircle, CheckCircle2, 
  ArrowRight, Truck, Database, FileText, ChevronRight, MapPin
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { pos, currentUser, hasPermission, isLoadingData } = useApp();
  const navigate = useNavigate();

  // --- Filter State ---
  const allSites = React.useMemo(() => Array.from(new Set(pos.map(p => p.site).filter(Boolean))) as string[], [pos]);
  const [selectedSite, setSelectedSite] = React.useState<string>('All');

  // --- Filtered Data ---
  const filteredPos = React.useMemo(() => {
     if (selectedSite === 'All') return pos;
     return pos.filter(p => p.site === selectedSite);
  }, [pos, selectedSite]);



  // --- Pipeline Metrics (Filtered) ---
  const pendingApprovals = filteredPos.filter(p => p.status === 'PENDING_APPROVAL');
  const pendingConcur = filteredPos.filter(p => p.status === 'APPROVED_PENDING_CONCUR');
  const activeOrders = filteredPos.filter(p => p.status === 'ACTIVE' || p.status === 'PARTIALLY_RECEIVED');
  
  // --- Actionable Insights ---
  const myPendingApprovals = currentUser.role === 'APPROVER' || currentUser.role === 'ADMIN'
      ? pendingApprovals 
      : [];
      
  const globalPendingConcur = hasPermission('link_concur') ? pendingConcur : [];
  const myPendingConcurSync = pendingConcur.filter(p => p.requesterId === currentUser.id && !hasPermission('link_concur'));
  const actionConcur = globalPendingConcur.length > 0 ? globalPendingConcur : myPendingConcurSync;

  const myPendingDeliveries = activeOrders.filter(p => {
        if (currentUser.role === 'ADMIN' && selectedSite !== 'All') return true; 
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
        const approved = po.approvalHistory.find(h => h.action === 'APPROVED'); // First approval usually enough for metric? Or final?
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

  if (isLoadingData) {
      return (
          <div className="flex h-[50vh] w-full items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-gray-900 dark:border-white"></div>
          </div>
      );
  }

  const StatCard = ({ title, value, icon: Icon, color, onClick }: any) => (
      <div 
        onClick={onClick}
        className={`group bg-surface border border-default elevation-1 hover:elevation-2 transition-elevation p-5 rounded-2xl relative overflow-hidden cursor-pointer`}
      >
          <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-10 transition-opacity bg-${color}-500`}></div>
          <div className="flex justify-between items-start mb-3">
              <div className={`p-2.5 rounded-xl bg-${color}-50 dark:bg-${color}-500/10 text-${color}-600 dark:text-${color}-500 group-hover:scale-110 transition-transform`}>
                  <Icon size={22} />
              </div>
              <span className="flex items-center text-gray-400 text-xs font-medium gap-1 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
                  View <ChevronRight size={12}/>
              </span>
          </div>
          <div>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1 tracking-tight">{value}</h3>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          </div>
      </div>
  );

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto pb-8 animate-fade-in">
      
      {/* Welcome & Site Filter */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-2">
         <div>
             <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Dashboard</h1>
             <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm md:text-base">
                 Overview for <span className="font-semibold text-gray-700 dark:text-gray-200">{currentUser.name}</span>
             </p>
         </div>
         
         <div className="flex gap-3 w-full md:w-auto">
             <select 
                value={selectedSite} 
                onChange={(e) => setSelectedSite(e.target.value)}
                className="bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-white py-3 px-4 rounded-xl shadow-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none font-medium appearance-none pr-8 cursor-pointer"
                style={{ backgroundImage: 'none' }} 
             >
                 <option value="All">All Sites</option>
                 {/* Show sites available to the user (or all for Admin) */}
                 {(currentUser.role === 'ADMIN' ? useApp().sites : useApp().sites.filter(s => currentUser.siteIds.includes(s.id)))
                    .map(site => (
                     <option key={site.id} value={site.name}>{site.name}</option>
                 ))}
             </select>
             <button onClick={() => navigate('/create')} className="whitespace-nowrap bg-[var(--color-brand)] text-white px-5 py-3 rounded-xl font-semibold shadow-lg shadow-[var(--color-brand)]/20 hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                 <FileText size={18} /> New Request
             </button>
         </div>
      </div>

      {/* Pipeline Flow Visual */}
      <div className="bg-surface rounded-2xl p-6 border border-default elevation-1 overflow-hidden">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Request Pipeline {selectedSite !== 'All' ? `(${selectedSite})` : ''}</h3>
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

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <StatCard title="Total Value (YTD)" value={`$${Math.round(totalSpend/1000)}k`} icon={TrendingUp} color="purple" onClick={() => navigate('/reports')}/>
          <StatCard title="Pending Actions" value={myPendingApprovals.length + actionConcur.length + uncapitalizedDeliveries + myPendingDeliveries.length} icon={AlertCircle} color="red" onClick={() => navigate('/requests')} />
          <StatCard title="Active Suppliers" value={new Set(filteredPos.map(p=>p.supplierName)).size} icon={Truck} color="orange" onClick={() => navigate('/reports')} />
          <StatCard title="Avg. Approval" value={avgApprovalTime} icon={Clock} color="cyan" onClick={() => navigate('/reports')} />
      </div>

      {/* Metrics & Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Depletion/Replacement Analysis */}
          <div className="lg:col-span-2 space-y-6">
              {/* Cost Impact Breakdown */}
              <div className="bg-elevated rounded-2xl p-6 border border-strong elevation-2 flex flex-col md:flex-row items-center gap-6">
                  <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Cost Impact Analysis</h3>
                      <p className="text-sm text-gray-500 mb-6">Financial impact of replacements (Depletion) vs Contract inclusions.</p>
                      
                      <div className="flex flex-col gap-4">
                          <div>
                              <div className="flex justify-between text-sm font-medium mb-1">
                                  <span className="text-red-500">Replacement / Depletion</span>
                                  <span className="text-gray-900 dark:text-white">${Math.round(spendSplitData[0].value).toLocaleString()}</span>
                              </div>
                              <div className="w-full h-3 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${replacePct}%` }}></div>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">Direct cost impact from lost/damaged inventory.</p>
                          </div>
                          <div>
                              <div className="flex justify-between text-sm font-medium mb-1">
                                  <span className="text-emerald-500">New / Contract (Net Zero)</span>
                                  <span className="text-gray-900 dark:text-white">${Math.round(spendSplitData[1].value).toLocaleString()}</span>
                              </div>
                              <div className="w-full h-3 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${100 - replacePct}%` }}></div>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">Covered under contract hire terms.</p>
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
                               <div className="text-[10px] uppercase text-gray-500 font-bold">Replacement</div>
                           </div>
                       </div>
                  </div>
              </div>

               {/* Top Depletion Items */}
               <div className="bg-surface rounded-2xl p-6 border border-default elevation-1 flex-1">
                  <div className="flex items-center justify-between mb-4">
                       <h3 className="text-lg font-bold text-gray-900 dark:text-white">Highest Depletion Items</h3>
                       <button onClick={() => navigate('/reports')} className="text-xs text-[var(--color-brand)] font-medium hover:underline">Full Report</button>
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
                                      <div className="text-[10px] text-gray-500">Units Replaced</div>
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

          {/* User Tasks (Right Column) */}
          <div className="bg-surface rounded-2xl p-6 border border-default elevation-1 flex flex-col h-full">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">My Tasks</h3>
              <div className="space-y-3 overflow-y-auto max-h-[600px] custom-scrollbar">
                     {myPendingApprovals.length > 0 && (
                         <div onClick={() => navigate('/approvals')} className="p-3 bg-amber-50 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 font-bold">{myPendingApprovals.length}</div>
                             <div>
                                 <div className="font-bold text-gray-900">Approvals</div>
                                 <div className="text-xs text-gray-500">Requires review</div>
                             </div>
                         </div>
                     )}
                      {actionConcur.length > 0 && (
                         <div onClick={() => navigate('/requests')} className="p-3 bg-blue-50 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold">{actionConcur.length}</div>
                             <div>
                                 <div className="font-bold text-gray-900">Link Concur</div>
                                 <div className="text-xs text-gray-500">Sync POs</div>
                             </div>
                         </div>
                     )}
                     {myPendingDeliveries.length > 0 && (
                         <div onClick={() => navigate('/requests')} className="p-3 bg-emerald-50 rounded-xl cursor-pointer hover:bg-emerald-100 transition-colors flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-700 font-bold">{myPendingDeliveries.length}</div>
                             <div>
                                 <div className="font-bold text-gray-900">Receiving</div>
                                 <div className="text-xs text-gray-500">Confirm deliveries</div>
                             </div>
                         </div>
                     )}
                     {myPendingApprovals.length === 0 && actionConcur.length === 0 && myPendingDeliveries.length === 0 && (
                         <div className="text-center py-10 text-gray-400">
                             <CheckCircle2 size={32} className="mx-auto mb-2 opacity-50"/>
                             All caught up!
                         </div>
                     )}
              </div>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
