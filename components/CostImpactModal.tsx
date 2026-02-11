
import React, { useState, useMemo } from 'react';
import { 
  X, Calendar, TrendingUp, TrendingDown, DollarSign, 
  BarChart2, PieChart as PieChartIcon, Filter
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { PORequest } from '../types';

interface CostImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: PORequest[];
}

const CostImpactModal: React.FC<CostImpactModalProps> = ({ isOpen, onClose, orders }) => {
  // Default range: Last 90 Days? Or YTD? Let's do YTD.
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  if (!isOpen) return null;

  // --- Filtering & Logic ---
  const filteredData = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    
    return orders.filter(po => {
      // Basic sanity check on status and date
      if (!po || po.status === 'REJECTED' || po.status === 'DRAFT' || !po.requestDate) return false;
      
      try {
          // Date filter
          const poDate = po.requestDate.split('T')[0];
          return poDate >= dateRange.start && poDate <= dateRange.end;
      } catch (e) {
          console.warn('Invalid PO Request Date:', po);
          return false;
      }
    });
  }, [orders, dateRange]);

  // KPIs
  const metrics = useMemo(() => {
    let replacement = 0;
    let contract = 0;
    let total = 0;

    filteredData.forEach(po => {
        const amount = po.totalAmount || 0;
        if (po.reasonForRequest === 'Depletion') {
            replacement += amount;
        } else {
            contract += amount;
        }
    });
    total = replacement + contract;
    
    return {
        replacement,
        contract,
        total,
        pct: total > 0 ? Math.round((replacement / total) * 100) : 0
    };
  }, [filteredData]);

  // Chart Data: Monthly Breakdown
  const trendData = useMemo(() => {
    const months: Record<string, { replacement: number; contract: number }> = {};

    filteredData.forEach(po => {
        if (!po.requestDate) return;
        const date = new Date(po.requestDate);
        if (isNaN(date.getTime())) return;
        
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const amount = po.totalAmount || 0;
        
        if (!months[key]) months[key] = { replacement: 0, contract: 0 };
        
        if (po.reasonForRequest === 'Depletion') {
            months[key].replacement += amount;
        } else {
            months[key].contract += amount;
        }
    });

    return Object.entries(months)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, data]) => ({
            name, // YYYY-MM
            Replacement: data.replacement,
            Contract: data.contract
        }));
  }, [filteredData]);

  // Top Items Analysis (Depletion Only)
  const topItems = useMemo(() => {
     const itemMap: Record<string, { qty: number, cost: number }> = {};
     
     filteredData
        .filter(p => p.reasonForRequest === 'Depletion')
        .forEach(p => {
             if (!p.lines || !Array.isArray(p.lines)) return;
             p.lines.forEach(line => {
                 if (!line || !line.itemName) return;
                 if (!itemMap[line.itemName]) itemMap[line.itemName] = { qty: 0, cost: 0 };
                 
                 const qty = line.quantityOrdered || 0;
                 const price = line.unitPrice || 0;
                 itemMap[line.itemName].qty += qty;
                 itemMap[line.itemName].cost += (qty * price);
             });
        });

     return Object.entries(itemMap)
        .sort((a, b) => b[1].cost - a[1].cost)
        .slice(0, 10);
  }, [filteredData]);

  // Pie Data (Category Split for Replacements) - Assuming categories exist on items or POs, 
  // currently types.ts suggests `lines` have `itemName`, maybe need to lookup category or assume PO level?
  // Let's stick to just Spend Split pie for now on the Overview if needed, or skip.
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-default animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-default flex justify-between items-center bg-surface-raised">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="text-[var(--color-brand)]" />
              Cost Impact Analysis
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Detailed breakdown of replacement costs vs contract inclusions</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50 dark:bg-[#111827]/50">
           
           {/* Filters */}
           <div className="flex flex-wrap items-end gap-4 bg-surface p-4 rounded-xl border border-default shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Filter size={16} /> Filters
              </div>
              <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                  <input 
                    type="date" 
                    value={dateRange.start} 
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                  />
              </div>
              <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                  <input 
                    type="date" 
                    value={dateRange.end} 
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                  />
              </div>
           </div>

           {/* Metrics Grid */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-surface p-5 rounded-xl border border-default shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <DollarSign size={40} className="text-gray-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">Total Spend</p>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">${metrics.total.toLocaleString()}</h3>
                  <div className="mt-2 text-xs text-gray-400">Selected Period</div>
              </div>
              
              <div className="bg-surface p-5 rounded-xl border border-default shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <TrendingDown size={40} className="text-red-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">Replacement Cost</p>
                  <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">${metrics.replacement.toLocaleString()}</h3>
                  <div className="mt-2 text-xs text-red-500/80 font-medium">
                      {metrics.pct}% of Total
                  </div>
              </div>

               <div className="bg-surface p-5 rounded-xl border border-default shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <TrendingUp size={40} className="text-emerald-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">Contract / New</p>
                  <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">${metrics.contract.toLocaleString()}</h3>
                   <div className="mt-2 text-xs text-emerald-500/80 font-medium">
                      {100 - metrics.pct}% of Total
                  </div>
              </div>

              <div className="bg-surface p-5 rounded-xl border border-default shadow-sm flex flex-col justify-center items-center text-center">
                  <div className="text-sm font-medium text-gray-500 mb-2">Efficiency Rating</div>
                  <div className={`text-xl font-bold px-3 py-1 rounded-full ${
                      metrics.pct < 20 ? 'bg-emerald-100 text-emerald-700' : 
                      metrics.pct < 50 ? 'bg-amber-100 text-amber-700' : 
                      'bg-red-100 text-red-700'
                  }`}>
                      {metrics.pct < 20 ? 'Excellent' : metrics.pct < 50 ? 'Moderate' : 'High Depletion'}
                  </div>
              </div>
           </div>

           {/* Charts Section */}
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Trend Chart */}
              <div className="lg:col-span-2 bg-surface p-6 rounded-xl border border-default shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                      <BarChart2 size={18} className="text-gray-400"/> Spending Trend
                  </h3>
                  <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={trendData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                              <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} tickFormatter={(value) => `$${value/1000}k`} />
                              <Tooltip 
                                  contentStyle={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', border: '1px solid var(--color-border)' }}
                                  itemStyle={{ color: 'var(--color-text)' }}
                                  formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                              />
                              <Legend wrapperStyle={{ paddingTop: '20px' }} />
                              <Bar dataKey="Replacement" stackId="a" fill="#ef4444" radius={[0, 0, 4, 4]} />
                              <Bar dataKey="Contract" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              {/* Top Items Table */}
              <div className="bg-surface p-6 rounded-xl border border-default shadow-sm flex flex-col">
                   <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <PieChartIcon size={18} className="text-gray-400"/> Top Depletion Items
                  </h3>
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                      <div className="space-y-3">
                        {topItems.map(([name, data], idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-lg">
                                <div className="flex-1 min-w-0 pr-3">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={name}>{name}</div>
                                    <div className="text-xs text-gray-500">{data.qty} units</div>
                                </div>
                                <div className="text-right whitespace-nowrap">
                                    <div className="text-sm font-bold text-gray-900 dark:text-white">${data.cost.toLocaleString()}</div>
                                </div>
                            </div>
                        ))}
                        {topItems.length === 0 && (
                            <div className="text-center py-10 text-gray-400">No data available</div>
                        )}
                      </div>
                  </div>
              </div>
           </div>

        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-default bg-surface-raised flex justify-end">
            <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};

export default CostImpactModal;
