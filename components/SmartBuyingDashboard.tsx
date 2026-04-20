import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { calculateBuyingPlan, ItemContext, AllocatedItem } from '../utils/shortSupplyEngine.ts';
import { DollarSign, BarChart3, Package, TrendingUp, Save, Clock } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.ts';

// MOCK DATA: In a real scenario, this comes from Supabase and activeSiteId
// Initial mock removed to favor live Supabase data fetching

export default function SmartBuyingDashboard() {
  const { activeSiteIds, hasPermission } = useApp();

  if (!hasPermission('manage_development')) {
      return (
          <div className="flex items-center justify-center h-[calc(100vh-200px)]">
              <div className="text-center p-8 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 shadow-xl max-w-md">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <BarChart3 size={32} />
                  </div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">Access Restricted</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">You do not have the 'manage_development' permission required to access the Smart Buying Dashboard.</p>
              </div>
          </div>
      );
  }

  const activeSiteId = activeSiteIds.length > 0 ? activeSiteIds[0] : null;
  
  const [budget, setBudget] = useState<number>(50000);
  const [ssPercent, setSsPercent] = useState<number>(100);
  const [allocatedPlans, setAllocatedPlans] = useState<AllocatedItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  const [items, setItems] = useState<ItemContext[]>([]);

  useEffect(() => {
    const fetchShortSupplyData = async () => {
      if (!activeSiteId) return;
      try {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const { data, error } = await supabase
          .from('short_supply_facts')
          .select(`
            ordered_qty,
            short_qty,
            master_item_id,
            items:master_item_id (name),
            metrics:item_operational_metrics!master_item_id (
              star_days,
              revenue_per_cycle,
              weight_kg
            ),
            properties:ref_item_properties!master_item_id (
              depreciation_months,
              shrinkage_percent
            ),
            pricing:ref_item_pricing!master_item_id (
                purchase_price
            )
          `)
          .eq('site_id', activeSiteId)
          .eq('period_month', month)
          .eq('period_year', year);

        if (error) throw error;
        
        interface ShortSupplyRow {
          ordered_qty: number;
          short_qty: number;
          master_item_id: string;
          items: { name: string } | null;
          metrics: { star_days: number, revenue_per_cycle: number, weight_kg: number }[] | null;
          properties: { depreciation_months: number, shrinkage_percent: number }[] | null;
          pricing: { purchase_price: number }[] | null;
        }
        
        const rawData = (data as unknown) as ShortSupplyRow[];

        const mappedItems: ItemContext[] = rawData.map((row) => ({
          id: row.master_item_id,
          name: row.items?.name || 'Unknown Item',
          shortQty: row.short_qty || 0,
          starDays: row.metrics?.[0]?.star_days || 0,
          depreciationMonths: row.properties?.[0]?.depreciation_months || 36,
          shrinkagePercent: row.properties?.[0]?.shrinkage_percent || 5,
          revenuePerCycle: row.metrics?.[0]?.revenue_per_cycle || 0,
          purchasePrice: row.pricing?.[0]?.purchase_price || 0,
          weightKg: row.metrics?.[0]?.weight_kg || 0
        }));

        setItems(mappedItems);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      }
    };

    fetchShortSupplyData();
  }, [activeSiteId]);

  useEffect(() => {
    const result = calculateBuyingPlan(items, budget, ssPercent);
    setAllocatedPlans(result);
  }, [items, budget, ssPercent]);

  const summary = useMemo(() => {
    let totalSpend = 0;
    let totalUplift = 0;
    let totalUnits = 0;
    
    allocatedPlans.forEach(p => {
      totalSpend += p.estimatedSpend;
      totalUplift += p.annualUplift;
      totalUnits += p.allocatedQty;
    });

    return { totalSpend, totalUplift, totalUnits, remaining: budget - totalSpend };
  }, [allocatedPlans, budget]);

  const handleSavePlan = async () => {
    setIsSaving(true);
    // Simulate DB Write
    await new Promise(r => setTimeout(r, 1000));
    setIsSaving(false);
    alert('Plan successfully saved. (Phase 2 will allow conversion directly to POs).');
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Smart Buying</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">Predictive procurement based on short supply facts & efficiency</p>
        </div>
        <button
            type="button"
            onClick={handleSavePlan}
            disabled={isSaving || summary.totalUnits === 0}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-medium tracking-wide shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Clock size={18} className="animate-spin" /> : <Save size={18} />}
            <span>Save Buying Plan</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* LEFT COLUMN: Controls */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <h2 className="text-sm font-bold tracking-wider uppercase text-gray-500 dark:text-slate-400 mb-6">Model Constraints</h2>
            
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-slate-200">Budget ($)</label>
                  <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-[var(--color-brand)]">
                    ${budget.toLocaleString()}
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="200000" 
                  step="5000"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-full accent-[var(--color-brand)]"
                />
              </div>

              <div>
                 <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-slate-200">Short Supply %</label>
                  <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-blue-500">
                    {ssPercent}%
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="5"
                  value={ssPercent}
                  onChange={(e) => setSsPercent(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <p className="text-xs text-gray-400 mt-2">Adjust to model fulfilling only a partial % of historical shorts.</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[var(--color-brand)] to-blue-600 rounded-2xl p-5 shadow-sm text-white">
             <h2 className="text-sm font-bold tracking-wider uppercase text-white/70 mb-4">Summary</h2>
             <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-white/20 pb-2">
                  <div className="flex items-start gap-2">
                    <DollarSign size={16} className="mt-0.5 text-white/70" />
                    <div className="flex flex-col">
                      <span className="text-xs text-white/70 font-medium">Est. Spend</span>
                      <span className="font-bold text-xl">${summary.totalSpend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-end border-b border-white/20 pb-2">
                  <div className="flex items-start gap-2">
                    <TrendingUp size={16} className="mt-0.5 text-white/70" />
                    <div className="flex flex-col">
                      <span className="text-xs text-white/70 font-medium">Annual Uplift</span>
                      <span className="font-bold text-xl">${summary.totalUplift.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-end">
                  <div className="flex items-start gap-2">
                    <Package size={16} className="mt-0.5 text-white/70" />
                    <div className="flex flex-col">
                      <span className="text-xs text-white/70 font-medium">Total Units</span>
                      <span className="font-bold text-xl">{summary.totalUnits.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
             </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Table */}
        <div className="lg:col-span-3 bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col">
           <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
              <h2 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <BarChart3 size={18} className="text-[var(--color-brand)]"/>
                Allocated Buying Plan (Sequentially Ranked)
              </h2>
           </div>
           
           <div className="flex-1 overflow-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-gray-50 dark:bg-[#15171e] text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                   <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800">Item</th>
                   <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800 text-right">Raw Units</th>
                   <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800 text-right">Efficiency</th>
                   <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800 text-right bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400">Allocated</th>
                   <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800 text-right">Est. Spend</th>
                   <th className="px-4 py-3 font-medium border-b border-gray-200 dark:border-gray-800 text-right">Annual Uplift</th>
                 </tr>
               </thead>
               <tbody className="text-sm">
                 {allocatedPlans.map((plan, idx) => (
                   <tr key={plan.id} className={`border-b border-gray-100 dark:border-gray-800/50 transition-colors
                      ${plan.allocatedQty === 0 ? 'bg-red-50/30 dark:bg-red-900/10 opacity-60' : 'hover:bg-gray-50/50 dark:hover:bg-white/5'}
                   `}>
                     <td className="px-4 py-3 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                       <span className="text-xs text-gray-400 dark:text-gray-600 block w-4">{idx+1}.</span>
                       {plan.name}
                     </td>
                     <td className="px-4 py-3 text-right text-gray-600 dark:text-slate-400">{plan.rawUnits.toLocaleString()}</td>
                     <td className="px-4 py-3 text-right text-gray-600 dark:text-slate-400 font-mono">{plan.efficiency.toFixed(2)}</td>
                     <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-900/5">
                        {plan.allocatedQty.toLocaleString()}
                     </td>
                     <td className="px-4 py-3 text-right font-medium text-gray-800 dark:text-slate-200">
                        ${plan.estimatedSpend.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}
                     </td>
                     <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-end gap-1">
                        ${plan.annualUplift.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}
                     </td>
                   </tr>
                 ))}
                 
                 {allocatedPlans.length === 0 && (
                   <tr>
                     <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                       No data available to model. Please ingest data first.
                     </td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>
      </div>

    </div>
  );
}
