
import React, { useState, useMemo } from 'react';
import { 
  X, TrendingUp, AlertCircle, Filter, FileText, DollarSign, ChevronRight
} from 'lucide-react';
import { 
  BarChart, Bar, Cell, ResponsiveContainer, Tooltip
} from 'recharts';
import { PORequest } from '../types';

interface CostImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: PORequest[];
}

const CostImpactModal: React.FC<CostImpactModalProps> = ({ isOpen, onClose, orders }) => {
  // Safe date range defaults
  const [dateRange, setDateRange] = useState({
    start: `${new Date().getFullYear()}-01-01`,
    end: new Date().toISOString().split('T')[0]
  });

  // --- Defensive Data Filtering ---
  const filteredData = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    
    return orders.filter(po => {
      try {
          if (!po || po.status === 'REJECTED' || po.status === 'DRAFT') return false;
          if (!po.requestDate) return false;
          
          const poDate = String(po.requestDate).split('T')[0];
          return poDate >= dateRange.start && poDate <= dateRange.end;
      } catch (e) {
          return false;
      }
    });
  }, [orders, dateRange]);

  // --- Defensive Metrics Calculation ---
  const metrics = useMemo(() => {
    let replacement = 0;
    let contract = 0;

    filteredData.forEach(po => {
        try {
            const amount = Number(po.totalAmount) || 0;
            if (po.reasonForRequest === 'Depletion') {
                replacement += amount;
            } else {
                contract += amount;
            }
        } catch (e) { /* ignore single record error */ }
    });
    
    const total = replacement + contract;
    const pct = total > 0 ? Math.round((replacement / total) * 100) : 0;
    
    return { replacement, contract, total, pct };
  }, [filteredData]);

  // --- Defensive Chart Data ---
  const trendData = useMemo(() => {
    try {
        const months: Record<string, { Replacement: number; Contract: number }> = {};

        filteredData.forEach(po => {
            if (!po.requestDate) return;
            const date = new Date(po.requestDate);
            if (isNaN(date.getTime())) return;
            
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const amount = Number(po.totalAmount) || 0;
            
            if (!months[key]) months[key] = { Replacement: 0, Contract: 0 };
            
            if (po.reasonForRequest === 'Depletion') {
                months[key].Replacement += amount;
            } else {
                months[key].Contract += amount;
            }
        });

        return Object.entries(months)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([name, data]) => ({
                name,
                Replacement: data.Replacement || 0,
                Contract: data.Contract || 0
            }));
    } catch (e) {
        return [];
    }
  }, [filteredData]);

  // --- Defensive Top Items ---
  const topItems = useMemo(() => {
     try {
         const itemMap: Record<string, { qty: number, cost: number }> = {};
         
         filteredData
            .filter(p => p.reasonForRequest === 'Depletion')
            .forEach(p => {
                 if (p.lines && Array.isArray(p.lines)) {
                     p.lines.forEach(line => {
                         if (line && line.itemName) {
                             const name = String(line.itemName);
                             if (!itemMap[name]) itemMap[name] = { qty: 0, cost: 0 };
                             
                             const qty = Number(line.quantityOrdered) || 0;
                             const price = Number(line.unitPrice) || 0;
                             itemMap[name].qty += qty;
                             itemMap[name].cost += (qty * price);
                         }
                     });
                 }
            });

         return Object.entries(itemMap)
            .sort((a, b) => (b[1]?.cost || 0) - (a[1]?.cost || 0))
            .slice(0, 10);
     } catch (e) {
         return [];
     }
  }, [filteredData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-default animate-slide-up">
        
        {/* Header */}
        <div className="p-6 border-b border-default flex justify-between items-center bg-surface-raised">
          <div>
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <TrendingUp className="text-red-500" />
              Detailed Cost Analysis
            </h2>
            <p className="text-sm text-secondary">In-depth view of spend allocation and replacement impact</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-raised rounded-lg transition-all active:scale-95">
            <X size={20} className="text-secondary" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-app">
           
           {/* Controls */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface p-4 rounded-xl border border-default">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <Filter size={16} /> Date Range Filter
              </div>
              <div className="flex items-center gap-2">
                  <label className="text-xs text-secondary font-bold whitespace-nowrap">From:</label>
                  <input 
                    type="date" 
                    value={dateRange.start} 
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="input-field py-1.5 text-xs text-primary bg-surface border-default rounded-lg"
                  />
              </div>
              <div className="flex items-center gap-2">
                  <label className="text-xs text-secondary font-bold whitespace-nowrap">To:</label>
                  <input 
                    type="date" 
                    value={dateRange.end} 
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="input-field py-1.5 text-xs text-primary bg-surface border-default rounded-lg"
                  />
              </div>
           </div>

           {/* Top Stats */}
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
               {[
                   { label: 'Total Spend', val: `$${metrics.total.toLocaleString()}`, color: 'text-primary', icon: DollarSign },
                   { label: 'Replacements', val: `$${metrics.replacement.toLocaleString()}`, color: 'text-red-500', icon: TrendingDown, sub: `${metrics.pct}% Impact` },
                   { label: 'Contract/New', val: `$${metrics.contract.toLocaleString()}`, color: 'text-emerald-500', icon: TrendingUp, sub: `${100-metrics.pct}% Content` },
                   { label: 'Analysis Status', val: metrics.pct > 50 ? 'Critical' : 'Healthy', color: metrics.pct > 50 ? 'text-red-500' : 'text-emerald-500', icon: AlertCircle }
               ].map((stat, i) => (
                   <div key={i} className="bg-surface p-5 rounded-xl border border-default shadow-sm hover:elevation-1 transition-all">
                       <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">{stat.label}</p>
                       <h3 className={`text-2xl font-bold ${stat.color}`}>{stat.val}</h3>
                       {stat.sub && <div className="text-[10px] font-bold text-secondary mt-1">{stat.sub}</div>}
                   </div>
               ))}
           </div>

           {/* Main Data Section */}
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               
               {/* Visual Breakdown */}
               <div className="lg:col-span-2 bg-surface p-6 rounded-2xl border border-default flex flex-col min-h-[400px]">
                   <h3 className="text-lg font-bold text-primary mb-6 flex items-center gap-2">
                       <FileText size={18} className="text-secondary" /> Spending Allocation over Time
                   </h3>
                   <div className="flex-1 w-full bg-app rounded-xl p-4 min-h-[300px]">
                        {trendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={trendData}>
                                    <Tooltip 
                                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                      contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                    />
                                    <Bar dataKey="Replacement" stackId="a" fill="#ef4444" radius={[0, 0, 4, 4]} />
                                    <Bar dataKey="Contract" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-secondary gap-3 opacity-50">
                                <FileText size={48} />
                                <p className="text-sm font-medium">No results for this selection</p>
                            </div>
                        )}
                   </div>
               </div>

               {/* Itemized Impact */}
               <div className="bg-surface p-6 rounded-2xl border border-default flex flex-col h-full">
                    <h3 className="text-lg font-bold text-primary mb-6">Top Resource Depletion</h3>
                    <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                        {topItems.map(([name, data], idx) => (
                            <div key={idx} className="bg-app p-4 rounded-xl border border-subtle flex items-center justify-between group hover:border-red-200 dark:hover:border-red-900/50 transition-colors">
                                <div className="flex-1 min-w-0 pr-3">
                                    <div className="text-xs font-bold text-primary truncate" title={name}>{name}</div>
                                    <div className="text-[10px] text-secondary mt-1">{data.qty} units replaced</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-black text-primary">${data.cost.toLocaleString()}</div>
                                </div>
                            </div>
                        ))}
                        {topItems.length === 0 && (
                            <div className="text-center py-20 text-secondary text-xs italic">No items identified</div>
                        )}
                    </div>
               </div>

           </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-default bg-surface-raised flex justify-end gap-3">
            <button 
                onClick={onClose}
                className="px-8 py-2.5 bg-surface hover:bg-surface-raised text-primary font-bold text-sm border border-default rounded-xl transition-all active:scale-95"
            >
                Return to Dashboard
            </button>
        </div>

      </div>
    </div>
  );
};

// Generic placeholder for missing icons used above
const TrendingDown = ({ size, className }: any) => <TrendingUp size={size} className={className} style={{ transform: 'rotate(90deg)' }} />;

export default CostImpactModal;


