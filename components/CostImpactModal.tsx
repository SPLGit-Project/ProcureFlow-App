
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  X, TrendingUp, AlertCircle, Filter, FileText, DollarSign, 
  ChevronRight, Calendar, MapPin, LayoutGrid, BarChart2,
  CheckCircle2, Clock, Package, Truck, ChevronDown, Check
} from 'lucide-react';
import { 
  BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { useApp } from '../context/AppContext';

interface CostImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CostImpactModal: React.FC<CostImpactModalProps> = ({ isOpen, onClose }) => {
  const { pos, userSites } = useApp();
  
  // View States
  const [viewMode, setViewMode] = useState<'trends' | 'snapshot'>('trends');
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>(userSites.map(s => s.id));
  const [isSiteDropdownOpen, setIsSiteDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Date/Month States
  const [dateRange, setDateRange] = useState({
    start: `${new Date().getFullYear()}-01-01`,
    end: new Date().toISOString().split('T')[0]
  });
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSiteDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
            received += (lineReceivedVal - lineCapVal);
            pending += (lineTotal - lineReceivedVal);
        });
    });

    return { pending, received, capitalised, total: totalValue };
  }, [globalFilteredData, selectedMonth]);

  const toggleSite = (id: string) => {
    setSelectedSiteIds(prev => 
        prev.includes(id) ? (prev.length > 1 ? prev.filter(x => x !== id) : prev) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-app w-full h-full md:h-auto md:max-w-7xl md:max-h-[95vh] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-strong animate-slide-up relative">
        
        {/* Top Navigation Bar - High Contrast Header */}
        <div className="p-4 md:p-6 border-b border-default bg-surface flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
               <TrendingUp className="text-red-500" size={24} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-primary dark:text-white tracking-tight">Financial Impact Hub</h2>
              <div className="flex items-center gap-2 text-[10px] font-black text-secondary dark:text-gray-400 uppercase tracking-[0.2em] mt-0.5">
                 <MapPin size={10} className="text-[var(--color-brand)]" />
                 {selectedSiteIds.length === userSites.length ? 'Across All Sites' : `${selectedSiteIds.length} Scopes Active`}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
             <div className="flex bg-surface-raised p-1 rounded-xl border border-default">
                <button 
                   onClick={() => setViewMode('trends')}
                   className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-black transition-all ${viewMode === 'trends' ? 'bg-elevated text-primary dark:text-white shadow-lg border border-default active:scale-95' : 'text-secondary dark:text-gray-400 hover:text-white'}`}
                >
                   <BarChart2 size={16} /> <span className="hidden sm:inline">TRENDS</span>
                </button>
                <button 
                   onClick={() => setViewMode('snapshot')}
                   className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-black transition-all ${viewMode === 'snapshot' ? 'bg-elevated text-primary dark:text-white shadow-lg border border-default active:scale-95' : 'text-secondary dark:text-gray-400 hover:text-white'}`}
                >
                   <LayoutGrid size={16} /> <span className="hidden sm:inline">SNAPSHOT</span>
                </button>
             </div>
             <button onClick={onClose} className="ml-auto p-2.5 hover:bg-surface-raised rounded-xl transition-all active:scale-95 border border-transparent hover:border-default text-tertiary dark:text-gray-400 hover:text-primary">
                <X size={20} />
             </button>
          </div>
        </div>

        {/* Global Control Bar - Enhanced Contrast for Dark Mode */}
        <div className="bg-surface border-b border-default p-4 md:px-8 py-4 flex flex-wrap items-center gap-6 z-20">
            {/* Site Dropdown */}
            <div className="relative" ref={dropdownRef}>
               <span className="text-[10px] font-black text-secondary dark:text-gray-300 uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                  <Filter size={10} /> SITE FILTER
               </span>
               <button 
                  onClick={() => setIsSiteDropdownOpen(!isSiteDropdownOpen)}
                  className="w-[240px] flex items-center justify-between bg-surface-raised hover:bg-elevated border border-default px-4 py-2.5 rounded-xl text-sm font-bold text-primary dark:text-white transition-all shadow-sm group"
               >
                  <div className="flex items-center gap-2 truncate">
                     <div className="w-5 h-5 rounded-md bg-[var(--color-brand)]/10 flex items-center justify-center text-[var(--color-brand)] border border-[var(--color-brand)]/20 shadow-sm">
                        <MapPin size={12} />
                     </div>
                     <span className="truncate">
                        {selectedSiteIds.length === userSites.length ? 'All Sites Selected' : `${selectedSiteIds.length} Scopes Active`}
                     </span>
                  </div>
                  <ChevronDown size={16} className={`text-tertiary dark:text-gray-400 group-hover:text-primary dark:group-hover:text-white transition-transform ${isSiteDropdownOpen ? 'rotate-180' : ''}`} />
               </button>

               {isSiteDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-[280px] bg-elevated border border-strong rounded-2xl shadow-2xl z-50 p-2 animate-slide-down">
                     <div className="flex items-center justify-between p-2 mb-1 border-b border-default">
                        <span className="text-[10px] font-black text-secondary dark:text-gray-400 uppercase tracking-widest">Active Sites</span>
                        <button 
                           onClick={() => setSelectedSiteIds(userSites.map(s => s.id))}
                           className="text-[10px] font-bold text-[var(--color-brand)] hover:underline"
                        >
                           Select All
                        </button>
                     </div>
                     <div className="max-h-[300px] overflow-y-auto space-y-1 p-1">
                        {userSites.map(site => {
                           const isSelected = selectedSiteIds.includes(site.id);
                           return (
                              <button 
                                 key={site.id}
                                 onClick={() => toggleSite(site.id)}
                                 className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all ${isSelected ? 'bg-[var(--color-brand)]/10 dark:bg-[var(--color-brand)]/20 text-primary dark:text-white' : 'hover:bg-surface-raised text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-white'}`}
                              >
                                 <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isSelected ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white' : 'border-default bg-surface'}`}>
                                    {isSelected && <Check size={12} strokeWidth={4} />}
                                 </div>
                                 <span className="text-sm font-bold truncate">{site.name}</span>
                              </button>
                           );
                        })}
                     </div>
                  </div>
               )}
            </div>

            <div className="h-10 w-[1px] bg-default hidden md:block opacity-50"></div>

            {/* Date / Month Selectors */}
            {viewMode === 'trends' ? (
                <div className="flex items-center gap-6">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-black text-secondary dark:text-gray-300 uppercase tracking-widest">ANALYSIS PORTAL</span>
                        <div className="flex items-center gap-2">
                           <input type="date" value={dateRange.start} onChange={(e)=>setDateRange(p=>({...p, start:e.target.value}))} className="bg-surface-raised border border-default px-3 py-2 rounded-xl text-xs font-bold text-primary dark:text-white dark:bg-slate-800/50 focus:ring-2 focus:ring-[var(--color-brand)]/20 outline-none" />
                           <span className="text-secondary dark:text-gray-500 text-xs font-black font-mono">TO</span>
                           <input type="date" value={dateRange.end} onChange={(e)=>setDateRange(p=>({...p, end:e.target.value}))} className="bg-surface-raised border border-default px-3 py-2 rounded-xl text-xs font-bold text-primary dark:text-white dark:bg-slate-800/50 focus:ring-2 focus:ring-[var(--color-brand)]/20 outline-none" />
                        </div>
                    </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 w-[180px]">
                    <span className="text-[10px] font-black text-secondary dark:text-gray-300 uppercase tracking-widest">FOCUS MONTH</span>
                    <input type="month" value={selectedMonth} onChange={(e)=>setSelectedMonth(e.target.value)} className="bg-surface-raised border border-default px-4 py-2 rounded-xl text-xs font-bold text-primary dark:text-white dark:bg-slate-800/50 focus:ring-2 focus:ring-[var(--color-brand)]/20 outline-none w-full" />
                </div>
            )}
        </div>

        {/* Main Application Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 bg-app transition-all">
           
           {viewMode === 'trends' ? (
              <>
                 {/* High Level Stats Portal */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                    <MetricCard label="Total Period Spend" val={metrics.total} format="currency" icon={DollarSign} color="blue" />
                    <MetricCard label="Replacement Impact" val={metrics.replacement} format="currency" sub={`${metrics.pct}% Cost Weight`} icon={TrendingUp} color="red" />
                    <MetricCard label="Resource Units" val={metrics.totalQty} format="number" sub="Processed Inventory" icon={Package} color="purple" />
                    <MetricCard label="Efficiency Index" val={100 - metrics.pct} format="pct" sub={metrics.pct > 30 ? 'Optimization Needed' : 'Efficient Pipeline'} icon={CheckCircle2} color={metrics.pct < 20 ? 'emerald' : metrics.pct < 40 ? 'amber' : 'red'} />
                 </div>

                 {/* Visualization Deck */}
                 <div className="bg-surface rounded-[2rem] border border-strong p-6 md:p-10 shadow-2xl relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                       <div>
                          <h3 className="text-xl font-black text-primary dark:text-white tracking-tight mb-2">Monthly Spend Trajectory</h3>
                          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full border border-emerald-500/20 w-fit">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
                             <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none">LIVE FINANCIAL FEED</span>
                          </div>
                       </div>
                       <div className="flex flex-wrap gap-6 bg-app dark:bg-slate-900 shadow-inner px-6 py-4 rounded-2xl border border-default">
                          <div className="flex items-center gap-3">
                             <div className="w-4 h-4 rounded-lg bg-red-500 shadow-lg shadow-red-500/40"></div>
                             <div>
                                <p className="text-[9px] font-black text-tertiary dark:text-gray-500 uppercase leading-none mb-1">IMPACT</p>
                                <p className="text-xs font-bold text-primary dark:text-white">Replacement</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-3 border-l border-default pl-6">
                             <div className="w-4 h-4 rounded-lg bg-emerald-500 shadow-lg shadow-emerald-500/40"></div>
                             <div>
                                <p className="text-[9px] font-black text-tertiary dark:text-gray-500 uppercase leading-none mb-1">CORE</p>
                                <p className="text-xs font-bold text-primary dark:text-white">Contract</p>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="h-[340px] md:h-[420px] w-full">
                       {monthlyTrend.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={monthlyTrend} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                                <defs>
                                   <linearGradient id="replacementGradient" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#ff4b2b" stopOpacity={1} />
                                      <stop offset="100%" stopColor="#ff4b2b" stopOpacity={0.8} />
                                   </linearGradient>
                                   <linearGradient id="contractGradient" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.8} />
                                   </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="var(--border-default)" opacity={0.3} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 800}} dy={15} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 800}} tickFormatter={(v)=>`$${Math.round(v/1000)}k`} />
                                <Tooltip 
                                   cursor={{ fill: 'var(--bg-tertiary)', opacity: 0.1 }}
                                   contentStyle={{ 
                                       backgroundColor: 'var(--bg-elevated)', 
                                       borderRadius: '20px', 
                                       border: '1px solid var(--border-strong)', 
                                       boxShadow: 'var(--shadow-xl)',
                                       padding: '16px'
                                   }}
                                   itemStyle={{ fontWeight: 800, fontSize: '12px' }}
                                />
                                <Bar dataKey="Replacement" stackId="a" fill="url(#replacementGradient)" radius={[0, 0, 8, 8]} barSize={44} />
                                <Bar dataKey="Contract" stackId="a" fill="url(#contractGradient)" radius={[8, 8, 0, 0]} barSize={44} />
                             </BarChart>
                          </ResponsiveContainer>
                       ) : (
                          <div className="h-full flex flex-col items-center justify-center bg-surface-raised rounded-3xl border border-dashed border-strong/50">
                             <Package size={48} className="text-tertiary dark:text-secondary opacity-20 mb-4" />
                             <p className="text-sm font-black text-secondary dark:text-gray-400 uppercase tracking-[0.2em]">Void Data Period</p>
                          </div>
                       )}
                    </div>
                 </div>
              </>
           ) : (
              /* High Precision Snapshot View */
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
                 
                 <div className="flex flex-col lg:flex-row gap-8 items-stretch">
                    {/* Primary Month Focus Card */}
                    <div className="lg:w-1/2 bg-elevated border border-strong p-10 rounded-[2.5rem] flex flex-col justify-center relative overflow-hidden group shadow-2xl">
                        <div className="absolute -right-16 -bottom-16 opacity-[0.03] group-hover:rotate-6 group-hover:scale-110 transition-all duration-1000 pointer-events-none text-primary">
                           <Calendar size={320} />
                        </div>
                        <div className="flex items-center gap-3 mb-6">
                           <div className="px-3 py-1 bg-[var(--color-brand)]/10 dark:bg-[var(--color-brand)]/20 text-[var(--color-brand)] text-[10px] font-black uppercase tracking-widest rounded-full border border-[var(--color-brand)]/20">
                              MONTHLY AUDIT
                           </div>
                           <span className="text-xs font-bold text-secondary dark:text-gray-400">{selectedMonth} Reporting Cycle</span>
                        </div>
                        <h4 className="text-[10px] font-black text-tertiary dark:text-gray-400 uppercase tracking-[0.3em] mb-2 pl-1 italic">Consolidated Total</h4>
                        <div className="flex items-baseline gap-2">
                           <span className="text-6xl font-black text-primary dark:text-white tracking-tighter">${snapshotData.total.toLocaleString()}</span>
                        </div>
                        <div className="mt-10 p-4 bg-app/50 dark:bg-slate-900/50 rounded-2xl border border-default flex items-center gap-4">
                           <div className="p-2.5 bg-elevated rounded-xl border border-default shadow-sm">
                              <LayoutGrid size={18} className="text-[var(--color-brand)]" />
                           </div>
                           <p className="text-xs font-bold text-secondary dark:text-gray-400 leading-relaxed">
                              Snapshot includes <span className="text-primary dark:text-white font-black underline decoration-[var(--color-brand)]/40 decoration-2 underline-offset-4">{globalFilteredData.filter(po => po.requestDate?.startsWith(selectedMonth)).length} transactions</span> in this cycle.
                           </p>
                        </div>
                    </div>

                    {/* High Precision Mini-Stat Deck */}
                    <div className="lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <SnapshotStat label="Pending Value" val={snapshotData.pending} color="amber" icon={Clock} desc="Capital exposure awaiting arrival" />
                        <SnapshotStat label="Received Value" val={snapshotData.received} color="blue" icon={Truck} desc="Assets logged waiting final lock" />
                        <SnapshotStat label="Capitalised" val={snapshotData.capitalised} color="emerald" icon={CheckCircle2} desc="Finalized financial outcome" />
                        <div className="hidden lg:flex sm:col-span-2 lg:col-span-3 bg-surface border border-default p-6 rounded-[1.5rem] items-center gap-6 group hover:border-strong transition-all">
                           <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl group-hover:scale-110 transition-transform">
                              <DollarSign size={24} strokeWidth={3} />
                           </div>
                           <div className="flex-1">
                              <div className="flex justify-between items-end mb-2">
                                 <span className="text-[10px] font-black text-tertiary dark:text-gray-500 uppercase tracking-widest leading-none">CAPITALISATION PROGRESS</span>
                                 <span className="text-sm font-black text-emerald-500">
                                    {snapshotData.total > 0 ? Math.round((snapshotData.capitalised / snapshotData.total) * 100) : 0}%
                                 </span>
                              </div>
                              <div className="h-2 bg-app rounded-full overflow-hidden">
                                 <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${snapshotData.total > 0 ? (snapshotData.capitalised / snapshotData.total) * 100 : 0}%` }}></div>
                              </div>
                           </div>
                        </div>
                    </div>
                 </div>

                 {/* Detailed Analytic Grid */}
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                     <div className="bg-surface rounded-3xl border border-strong p-8 md:p-10 shadow-xl">
                        <div className="flex items-center justify-between mb-10">
                           <h4 className="text-lg font-black text-primary dark:text-white tracking-tight flex items-center gap-3">
                              <FileText size={20} className="text-[var(--color-brand)]" /> Pipeline Distribution
                           </h4>
                           <span className="text-[10px] font-black text-tertiary dark:text-gray-300 uppercase tracking-widest px-3 py-1 bg-surface-raised rounded-lg border border-default">Precise Audit</span>
                        </div>
                        <div className="space-y-12">
                           <ProgressBar label="Capitalised Data" val={snapshotData.capitalised} total={snapshotData.total} color="bg-emerald-500" icon={CheckCircle2} />
                           <ProgressBar label="Inbound (Unlocked)" val={snapshotData.received} total={snapshotData.total} color="bg-blue-500" icon={Truck} />
                           <ProgressBar label="Awaiting Delivery" val={snapshotData.pending} total={snapshotData.total} color="bg-amber-500" icon={Clock} />
                        </div>
                     </div>

                     <div className="bg-elevated rounded-3xl border border-strong p-10 flex flex-col justify-center items-center text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-brand)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                        <div className={`w-28 h-28 rounded-[2rem] flex items-center justify-center mb-8 relative z-10 transition-transform duration-700 group-hover:rotate-[10deg] ${
                           snapshotData.total === 0 ? 'bg-secondary/10 text-secondary' :
                           snapshotData.capitalised > snapshotData.total * 0.85 ? 'bg-emerald-500/10 text-emerald-500 shadow-lg shadow-emerald-500/10 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 shadow-lg shadow-amber-500/10 border border-amber-500/20'
                        }`}>
                           <AlertCircle size={48} strokeWidth={2.5} />
                        </div>
                        <h4 className="text-2xl font-black text-primary dark:text-white mb-4 relative z-10">Data Integrity Pulse</h4>
                        <div className="max-w-sm relative z-10">
                           <p className="text-sm text-secondary dark:text-gray-300 font-bold leading-relaxed mb-6">
                              {snapshotData.total === 0 ? 'Monthly cycle contains zero validated transactions. System is idling.' : 
                               snapshotData.capitalised === snapshotData.total ? 'Audit complete. All transactions for this cycle have reached terminal capitalisation. Data hygiene is optimal.' : 
                               `Attention required: Approximately $${snapshotData.pending.toLocaleString()} in capital is still trapped in the delivery pipeline for this cycle.`}
                           </p>
                           {snapshotData.total > 0 && snapshotData.capitalised < snapshotData.total && (
                              <button className="text-[10px] font-black text-white dark:text-white uppercase tracking-widest px-8 py-3.5 bg-[var(--color-brand)] rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.3)] hover:scale-105 active:scale-95 transition-all border border-white/10">
                                 VIEW BLOCKED ITEMS
                              </button>
                           )}
                        </div>
                     </div>
                 </div>
              </div>
           )}

        </div>

        {/* Global Terminal Footer */}
        <div className="p-4 md:px-10 py-6 border-t border-strong bg-surface flex flex-col sm:flex-row justify-between items-center gap-6 z-10">
           <div className="flex items-center gap-6">
              <div className="flex items-baseline gap-2">
                 <span className="text-[10px] font-black text-tertiary dark:text-gray-400 uppercase tracking-[0.3em]">Module</span>
                 <span className="text-xs font-black text-primary dark:text-white">FIN_ANALYSIS_V2.2</span>
              </div>
              <div className="w-[1px] h-4 bg-default hidden sm:block opacity-50"></div>
              <div className="text-[10px] font-black text-tertiary dark:text-emerald-400 uppercase tracking-[0.3em] flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse"></div>
                 Active Session Secure
              </div>
           </div>
           
           <button 
                onClick={onClose}
                className="w-full sm:w-auto px-12 py-4 bg-primary text-app font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all text-white border border-white/10"
           >
                Close Portal
           </button>
        </div>

      </div>
    </div>
  );
};

// --- Analytic Sub-Components ---

const MetricCard = ({ label, val, format, sub, icon: Icon, color }: any) => {
    const colorTheme: any = {
        blue: { glass: 'bg-blue-400/10', border: 'border-blue-500/30', text: 'text-blue-400', iconBg: 'bg-blue-400/20' },
        red: { glass: 'bg-red-400/10', border: 'border-red-500/30', text: 'text-red-400', iconBg: 'bg-red-400/20' },
        purple: { glass: 'bg-purple-400/10', border: 'border-purple-500/30', text: 'text-purple-400', iconBg: 'bg-purple-400/20' },
        emerald: { glass: 'bg-emerald-400/10', border: 'border-emerald-500/30', text: 'text-emerald-400', iconBg: 'bg-emerald-400/20' },
        amber: { glass: 'bg-amber-400/10', border: 'border-amber-500/30', text: 'text-amber-400', iconBg: 'bg-amber-400/20' },
    };

    const formattedVal = format === 'currency' ? `$${val.toLocaleString()}` : format === 'pct' ? `${val}%` : val.toLocaleString();

    return (
        <div className={`bg-elevated p-8 rounded-[2rem] border ${colorTheme[color].border} shadow-xl hover:shadow-2xl transition-all group relative overflow-hidden flex flex-col items-start`}>
            {/* Visual Decoration */}
            <div className={`absolute -right-6 -bottom-6 opacity-[0.05] group-hover:scale-110 group-hover:rotate-[-10deg] transition-all duration-700 ${colorTheme[color].text}`}>
                <Icon size={120} />
            </div>
            
            <div className={`w-14 h-14 rounded-2xl ${colorTheme[color].iconBg} flex items-center justify-center mb-6 border border-white/10 shadow-inner`}>
                <Icon size={24} className={`${colorTheme[color].text} drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]`} />
            </div>
            
            <div className="relative z-10 w-full">
               <p className="text-[11px] font-black text-white/50 dark:text-gray-400 uppercase tracking-[0.2em] mb-2">{label}</p>
               <h3 className="text-3xl font-black text-primary dark:text-white tracking-tight mb-3 transition-colors">{formattedVal}</h3>
               {sub && (
                  <div className="flex items-center gap-2">
                     <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${colorTheme[color].glass} ${colorTheme[color].text} uppercase border border-${color}-400/20`}>
                        {sub}
                     </span>
                  </div>
               )}
            </div>
        </div>
    );
};

const SnapshotStat = ({ label, val, color, icon: Icon, desc }: any) => {
    const themes: any = {
        amber: { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
        blue: { text: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
        emerald: { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' }
    };
    
    return (
        <div className="p-8 rounded-[2rem] border border-strong bg-surface flex flex-col items-center text-center group hover:bg-elevated transition-all duration-500 shadow-lg relative overflow-hidden">
            <div className={`p-5 rounded-2.5xl bg-app border border-default ${themes[color].text} mb-6 transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-2 group-hover:shadow-2xl`}>
                <Icon size={28} strokeWidth={2.5} />
            </div>
            <h4 className="text-2xl font-black text-primary dark:text-white group-hover:scale-105 transition-transform tracking-tight">${val.toLocaleString()}</h4>
            <span className="text-[11px] font-black text-tertiary dark:text-gray-300 uppercase tracking-[0.25em] mt-3 group-hover:text-primary transition-colors">{label}</span>
            <div className="mt-6 w-full h-[1px] bg-default scale-x-50 group-hover:scale-x-100 transition-transform duration-700 opacity-50"></div>
            <p className="mt-6 text-[10px] font-bold text-secondary dark:text-gray-400 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">{desc}</p>
        </div>
    );
};

const ProgressBar = ({ label, val, total, color, icon: Icon }: any) => {
    const pct = total > 0 ? (val / total) * 100 : 0;
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-end">
                <div className="flex items-center gap-3">
                   <Icon size={16} className="text-tertiary dark:text-gray-500" />
                   <span className="text-sm font-black text-primary dark:text-white uppercase tracking-widest">{label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                   <span className="text-sm font-black text-primary dark:text-white underline decoration-2 decoration-default underline-offset-4">${val.toLocaleString()}</span>
                   <span className="text-[10px] font-bold text-tertiary dark:text-gray-500">({Math.round(pct)}%)</span>
                </div>
            </div>
            <div className="h-4 bg-app dark:bg-slate-900 rounded-full overflow-hidden border border-default p-1 shadow-inner">
                <div className={`h-full ${color} rounded-full transition-all duration-1000 relative shadow-lg`} style={{ width: `${pct}%` }}>
                   <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
            </div>
        </div>
    );
};

export default CostImpactModal;
