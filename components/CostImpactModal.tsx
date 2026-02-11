
import React, { useState, useMemo } from 'react';
import { 
  X, TrendingUp, AlertCircle, Filter, FileText, DollarSign, 
  ChevronRight, Calendar, MapPin, LayoutGrid, BarChart2,
  CheckCircle2, Clock, Package, Truck
} from 'lucide-react';
import { 
  BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { useApp } from '../context/AppContext';
import { PORequest } from '../types';

interface CostImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CostImpactModal: React.FC<CostImpactModalProps> = ({ isOpen, onClose }) => {
  const { pos, userSites, siteName } = useApp();
  
  // View States
  const [viewMode, setViewMode] = useState<'trends' | 'snapshot'>('trends');
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>(userSites.map(s => s.id));
  
  // Date/Month States
  const [dateRange, setDateRange] = useState({
    start: `${new Date().getFullYear()}-01-01`,
    end: new Date().toISOString().split('T')[0]
  });
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM

  if (!isOpen) return null;

  // --- Data Logic: General Filtering ---
  const globalFilteredData = useMemo(() => {
    return pos.filter(po => {
        if (!po || po.status === 'REJECTED' || po.status === 'DRAFT') return false;
        if (!po.siteId || !selectedSiteIds.includes(po.siteId)) return false;
        return true;
    });
  }, [pos, selectedSiteIds]);

  // --- Trend View Data ---
  const trendFilteredData = useMemo(() => {
    return globalFilteredData.filter(po => {
        if (!po.requestDate) return false;
        const poDate = String(po.requestDate).split('T')[0];
        return poDate >= dateRange.start && poDate <= dateRange.end;
    });
  }, [globalFilteredData, dateRange]);

  const metrics = useMemo(() => {
    let replacement = 0;
    let contract = 0;
    let totalQty = 0;

    trendFilteredData.forEach(po => {
        replacement += (po.reasonForRequest === 'Depletion' ? (Number(po.totalAmount) || 0) : 0);
        contract += (po.reasonForRequest !== 'Depletion' ? (Number(po.totalAmount) || 0) : 0);
        
        po.lines?.forEach(l => {
            totalQty += (Number(l.quantityOrdered) || 0);
        });
    });
    
    const total = replacement + contract;
    const pct = total > 0 ? Math.round((replacement / total) * 100) : 0;
    
    return { replacement, contract, total, pct, totalQty };
  }, [trendFilteredData]);

  const monthlyTrend = useMemo(() => {
     const months: Record<string, { Replacement: number; Contract: number }> = {};
     trendFilteredData.forEach(po => {
        if (!po.requestDate) return;
        const date = new Date(po.requestDate);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!months[key]) months[key] = { Replacement: 0, Contract: 0 };
        
        if (po.reasonForRequest === 'Depletion') months[key].Replacement += (Number(po.totalAmount) || 0);
        else months[key].Contract += (Number(po.totalAmount) || 0);
     });

     return Object.entries(months)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, data]) => ({ name, ...data }));
  }, [trendFilteredData]);

  // --- Snapshot View Data ---
  const snapshotData = useMemo(() => {
    let pending = 0;
    let received = 0;
    let capitalised = 0;
    let totalValue = 0;

    const targetMonthPos = globalFilteredData.filter(po => {
        return po.requestDate?.startsWith(selectedMonth);
    });

    targetMonthPos.forEach(po => {
        totalValue += (Number(po.totalAmount) || 0);
        
        po.lines?.forEach(line => {
            const lineTotal = (Number(line.quantityOrdered) || 0) * (Number(line.unitPrice) || 0);
            
            // Check deliveries for this line across this PO
            let lineReceivedVal = 0;
            let lineCapVal = 0;

            po.deliveries?.forEach(del => {
                del.lines?.forEach(delLine => {
                    if (delLine.poLineId === line.id) {
                        const val = (Number(delLine.quantity) || 0) * (Number(line.unitPrice) || 0);
                        lineReceivedVal += val;
                        if (delLine.isCapitalised) lineCapVal += val;
                    }
                });
            });

            capitalised += lineCapVal;
            received += (lineReceivedVal - lineCapVal); // Received but not yet capitalised
            pending += (lineTotal - lineReceivedVal); // Remaining to be received
        });
    });

    return { pending, received, capitalised, total: totalValue };
  }, [globalFilteredData, selectedMonth]);

  const toggleSite = (id: string) => {
    setSelectedSiteIds(prev => 
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/70 backdrop-blur-md">
      <div className="bg-surface w-full h-full md:h-auto md:max-w-7xl md:max-h-[92vh] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-default animate-slide-up">
        
        {/* Top Navigation Bar */}
        <div className="p-4 md:p-6 border-b border-default bg-surface flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-2xl">
               <TrendingUp className="text-red-500" size={24} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-primary tracking-tight">Financial Impact Hub</h2>
              <div className="flex items-center gap-2 text-xs font-bold text-secondary uppercase tracking-widest mt-0.5">
                 <MapPin size={12} />
                 {selectedSiteIds.length === userSites.length ? 'Across All Sites' : `${selectedSiteIds.length} Sites Selected`}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
             <div className="flex bg-app p-1 rounded-xl border border-default transition-all">
                <button 
                   onClick={() => setViewMode('trends')}
                   className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'trends' ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
                >
                   <BarChart2 size={16} /> <span className="hidden sm:inline">Trends</span>
                </button>
                <button 
                   onClick={() => setViewMode('snapshot')}
                   className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'snapshot' ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
                >
                   <LayoutGrid size={16} /> <span className="hidden sm:inline">Snapshot</span>
                </button>
             </div>
             <button onClick={onClose} className="ml-auto p-2.5 hover:bg-surface-raised rounded-xl transition-all active:scale-95 border border-transparent hover:border-default">
                <X size={20} className="text-secondary" />
             </button>
          </div>
        </div>

        {/* Filters & Controls */}
        <div className="bg-app border-b border-default p-4 md:p-6 overflow-x-auto">
           <div className="flex flex-wrap items-center gap-6 min-w-max">
              
              {/* Site Selector Badges */}
              <div className="flex flex-col gap-2">
                 <span className="text-[10px] font-black text-secondary uppercase tracking-widest flex items-center gap-1">
                    <Filter size={10} /> Active Scopes
                 </span>
                 <div className="flex gap-2">
                    <button 
                        onClick={() => setSelectedSiteIds(userSites.map(s => s.id))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedSiteIds.length === userSites.length ? 'bg-primary text-white border-primary' : 'bg-surface border-default text-secondary hover:border-primary'}`}
                    >
                        All
                    </button>
                    {userSites.map(site => (
                        <button 
                            key={site.id}
                            onClick={() => toggleSite(site.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedSiteIds.includes(site.id) ? 'bg-surface border-primary text-primary shadow-sm ring-1 ring-primary/20' : 'bg-surface border-default text-secondary hover:border-primary'}`}
                        >
                            {site.name}
                        </button>
                    ))}
                 </div>
              </div>

              {/* View Specific Controls */}
              <div className="h-10 w-[1px] bg-default hidden md:block"></div>

              {viewMode === 'trends' ? (
                <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-secondary uppercase tracking-widest">Start Date</span>
                        <input type="date" value={dateRange.start} onChange={(e)=>setDateRange(p=>({...p, start:e.target.value}))} className="bg-surface border border-default px-3 py-1.5 rounded-lg text-xs font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-secondary uppercase tracking-widest">End Date</span>
                        <input type="date" value={dateRange.end} onChange={(e)=>setDateRange(p=>({...p, end:e.target.value}))} className="bg-surface border border-default px-3 py-1.5 rounded-lg text-xs font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                    </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-secondary uppercase tracking-widest">Focus Month</span>
                    <input type="month" value={selectedMonth} onChange={(e)=>setSelectedMonth(e.target.value)} className="bg-surface border border-default px-4 py-1.5 rounded-lg text-xs font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                </div>
              )}
           </div>
        </div>

        {/* Workspace Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 bg-app/50">
           
           {viewMode === 'trends' ? (
              <>
                 {/* High Level Stats */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <MetricCard label="Total Period Spend" val={metrics.total} format="currency" icon={DollarSign} color="blue" />
                    <MetricCard label="Replacement Impact" val={metrics.replacement} format="currency" sub={`${metrics.pct}% of total`} icon={TrendingUp} color="red" />
                    <MetricCard label="Total Resources" val={metrics.totalQty} format="number" sub="Units Processed" icon={Package} color="purple" />
                    <MetricCard label="Efficiency Score" val={100 - metrics.pct} format="pct" sub={metrics.pct > 30 ? 'High Depletion' : 'Healthy'} icon={CheckCircle2} color={metrics.pct < 20 ? 'emerald' : metrics.pct < 40 ? 'amber' : 'red'} />
                 </div>

                 {/* Main Chart */}
                 <div className="bg-surface rounded-3xl border border-default p-6 md:p-8 shadow-sm">
                    <div className="flex justify-between items-center mb-10">
                       <div>
                          <h3 className="text-lg font-bold text-primary">Monthly Spend Outcome</h3>
                          <p className="text-sm text-secondary">Historical month-on-month comparison of allocation</p>
                       </div>
                       <div className="flex gap-4">
                          <div className="flex items-center gap-2 text-xs font-bold text-secondary">
                             <div className="w-3 h-3 rounded-full bg-red-500"></div> Replacement
                          </div>
                          <div className="flex items-center gap-2 text-xs font-bold text-secondary">
                             <div className="w-3 h-3 rounded-full bg-emerald-500"></div> Contract
                          </div>
                       </div>
                    </div>
                    <div className="h-[300px] md:h-[400px] w-full">
                       {monthlyTrend.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={monthlyTrend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 10, fontWeight: 700}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 10, fontWeight: 700}} tickFormatter={(v)=>`$${v/1000}k`} />
                                <Tooltip 
                                   cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                   contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-lg)' }}
                                   itemStyle={{ fontWeight: 700 }}
                                />
                                <Bar dataKey="Replacement" stackId="a" fill="#ef4444" radius={[0, 0, 4, 4]} barSize={40} />
                                <Bar dataKey="Contract" stackId="a" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
                             </BarChart>
                          </ResponsiveContainer>
                       ) : (
                          <div className="h-full flex items-center justify-center text-secondary font-bold text-sm bg-app/50 rounded-2xl border border-dashed border-default">
                             No data found for this period
                          </div>
                       )}
                    </div>
                 </div>
              </>
           ) : (
              /* MONTHLY SNAPSHOT VIEW */
              <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 
                 <div className="flex flex-col md:flex-row gap-6 md:items-stretch">
                    {/* Month Total Card */}
                    <div className="flex-1 bg-surface-raised border border-default p-8 rounded-3xl flex flex-col justify-center relative overflow-hidden group">
                        <div className="absolute -right-10 -bottom-10 opacity-5 group-hover:rotate-12 transition-transform duration-700">
                           <Calendar size={200} />
                        </div>
                        <span className="text-xs font-black text-secondary uppercase tracking-widest mb-2">Month Total Value</span>
                        <h2 className="text-5xl font-black text-primary tracking-tighter">${snapshotData.total.toLocaleString()}</h2>
                        <p className="text-sm text-secondary mt-4 font-medium">Snapshot of all validated POs created in {selectedMonth}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:w-3/5">
                        <SnapshotStat label="Pending Value" val={snapshotData.pending} color="amber" icon={Clock} desc="Requested/Approved not yet received" />
                        <SnapshotStat label="Received Value" val={snapshotData.received} color="blue" icon={Truck} desc="On-site waiting for finance" />
                        <SnapshotStat label="Capitalised Value" val={snapshotData.capitalised} color="emerald" icon={CheckCircle2} desc="Finalised and accounted" />
                    </div>
                 </div>

                 {/* Detailed Breakdown Section */}
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                     <div className="bg-surface rounded-3xl border border-default p-6 md:p-8">
                        <h4 className="font-bold text-primary mb-6 flex items-center gap-2">
                           <FileText size={18} className="text-secondary" /> Allocation Percentage
                        </h4>
                        <div className="space-y-8">
                           <ProgressBar label="Capitalised" val={snapshotData.capitalised} total={snapshotData.total} color="bg-emerald-500" />
                           <ProgressBar label="Received (Pending Cap)" val={snapshotData.received} total={snapshotData.total} color="bg-blue-500" />
                           <ProgressBar label="Remaining Pending" val={snapshotData.pending} total={snapshotData.total} color="bg-amber-500" />
                        </div>
                     </div>

                     <div className="bg-surface rounded-3xl border border-default p-6 md:p-8 flex flex-col justify-center items-center text-center">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
                           snapshotData.capitalised > snapshotData.total * 0.8 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                           <AlertCircle size={40} />
                        </div>
                        <h4 className="text-xl font-bold text-primary mb-2">Month Integrity</h4>
                        <p className="text-sm text-secondary max-w-xs font-medium">
                           {snapshotData.total === 0 ? 'No data to analyze for this month.' : 
                            snapshotData.capitalised === snapshotData.total ? 'All transactions for this month have been capitalised. Perfect data hygiene.' : 
                            `There is still $${snapshotData.pending.toLocaleString()} worth of pending deliveries for this month.`}
                        </p>
                     </div>
                 </div>
              </div>
           )}

        </div>

        {/* Universal Footer */}
        <div className="p-4 md:p-6 border-t border-default bg-surface flex justify-between items-center bg-surface-raised">
           <div className="hidden sm:block text-[10px] font-bold text-secondary uppercase tracking-widest">
              Financial Analysis Engine v2.1
           </div>
           <button 
                onClick={onClose}
                className="w-full sm:w-auto px-10 py-3 bg-primary text-white font-bold text-sm rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
           >
                Close Analysis
           </button>
        </div>

      </div>
    </div>
  );
};

// --- Sub-Components ---

const MetricCard = ({ label, val, format, sub, icon: Icon, color }: any) => {
    const colorClasses: any = {
        blue: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10',
        red: 'text-red-600 bg-red-50 dark:bg-red-500/10',
        purple: 'text-purple-600 bg-purple-50 dark:bg-purple-500/10',
        emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10',
        amber: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10',
    };

    const formattedVal = format === 'currency' ? `$${val.toLocaleString()}` : format === 'pct' ? `${val}%` : val.toLocaleString();

    return (
        <div className="bg-surface p-6 rounded-3xl border border-default shadow-sm hover:elevation-2 transition-all group overflow-hidden relative">
            <div className={`absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500 text-${color}-600`}>
                <Icon size={80} />
            </div>
            <div className={`w-10 h-10 rounded-xl ${colorClasses[color]} flex items-center justify-center mb-4`}>
                <Icon size={20} />
            </div>
            <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">{label}</p>
            <h3 className="text-2xl font-black text-primary tracking-tight">{formattedVal}</h3>
            {sub && <p className="text-[10px] font-bold text-secondary mt-1 opacity-70">{sub}</p>}
        </div>
    );
};

const SnapshotStat = ({ label, val, color, icon: Icon, desc }: any) => (
    <div className={`p-6 rounded-3xl border border-default bg-surface flex flex-col items-center text-center group hover:bg-${color}-500 transition-all duration-300`}>
        <div className={`p-4 rounded-2xl bg-${color}-50 dark:bg-${color}-500/10 text-${color}-600 mb-4 group-hover:bg-white/20 group-hover:text-white transition-all`}>
            <Icon size={24} />
        </div>
        <h4 className="text-xl font-black text-primary group-hover:text-white">${val.toLocaleString()}</h4>
        <span className="text-[10px] font-black text-secondary uppercase tracking-widest mt-1 group-hover:text-white/80">{label}</span>
        <p className="mt-3 text-[9px] font-bold text-secondary leading-relaxed group-hover:text-white/60">{desc}</p>
    </div>
);

const ProgressBar = ({ label, val, total, color }: any) => {
    const pct = total > 0 ? (val / total) * 100 : 0;
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-end">
                <span className="text-sm font-bold text-primary">{label}</span>
                <span className="text-xs font-medium text-secondary">${val.toLocaleString()} ({Math.round(pct)}%)</span>
            </div>
            <div className="h-2.5 bg-app rounded-full overflow-hidden border border-default">
                <div className={`h-full ${color} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }}></div>
            </div>
        </div>
    );
};

export default CostImpactModal;



