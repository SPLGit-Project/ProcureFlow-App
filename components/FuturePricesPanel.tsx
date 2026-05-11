import React, { useState, useEffect } from 'react';
import { 
  Calendar, RefreshCw, AlertCircle, Clock, 
  ChevronRight, ArrowRight, Tag, TrendingUp 
} from 'lucide-react';
import { getFuturePriceChanges } from '../services/sellPricingService';
import { useApp } from '../context/AppContext';


interface FuturePriceRecord {
  price_record_id: string;
  item_id: string;
  sku: string;
  item_name: string;
  price_type: string;
  future_price: number;
  effective_from: string;
  days_until_effective: number;
  margin_percent: number;
}

export const FuturePricesPanel: React.FC = () => {
  const { hasPermission, currentUser } = useApp();
  const [prices, setPrices] = useState<FuturePriceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'ADMIN';
  const canView = hasPermission('view_sell_pricing') || hasPermission('view_purchase_pricing') || isAdmin;


  useEffect(() => {
    if (canView) {
      fetchPrices();
    }
  }, [canView]);

  if (!canView) return null;


  const fetchPrices = async () => {
    setLoading(true);
    try {
      const data = await getFuturePriceChanges();
      setPrices(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch future price changes');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center space-x-2 animate-pulse bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-gray-800">
        <RefreshCw className="text-[#129DC0] animate-spin" size={20} />
        <span className="text-sm font-medium text-gray-400 uppercase tracking-widest">Scanning Future Pricing...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl flex items-center gap-3 text-red-600">
        <AlertCircle size={20} />
        <p className="text-sm font-medium">{error}</p>
        <button onClick={fetchPrices} className="ml-auto p-2 hover:bg-red-100 rounded-lg transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-[#181a21]/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
            <Calendar size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Upcoming Price Changes</h3>
            <p className="text-xs text-gray-500 font-medium">Approved sell prices pending automatic activation</p>
          </div>
        </div>
        <button 
          onClick={fetchPrices}
          className="p-2.5 text-gray-400 hover:text-[#129DC0] hover:bg-[#129DC0]/10 rounded-xl transition-all"
          title="Refresh Data"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      <div className="p-6">
        {prices.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl flex items-center justify-center mb-4 text-gray-300">
              <Clock size={32} />
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">No upcoming price changes</p>
            <p className="text-xs text-gray-500 mt-1">All approved prices are currently active.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {prices.map((record) => (
              <div 
                key={record.price_record_id}
                className={`p-5 rounded-2xl border transition-all hover:shadow-md ${
                  record.days_until_effective <= 7 
                    ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 shadow-blue-500/5' 
                    : 'bg-white dark:bg-[#1a1c23] border-gray-100 dark:border-gray-800'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Item SKU</span>
                    <span className="text-sm font-mono font-bold text-[#129DC0]">{record.sku}</span>
                  </div>
                  <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                    record.days_until_effective <= 7 ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  }`}>
                    {record.days_until_effective === 0 ? 'Today' : 
                     record.days_until_effective === 1 ? 'Tomorrow' : 
                     `In ${record.days_until_effective} Days`}
                  </div>
                </div>

                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 truncate" title={record.item_name}>
                  {record.item_name}
                </h4>

                <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Tag size={12} className="text-gray-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Type</span>
                    </div>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{record.price_type}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={12} className="text-gray-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">New Price</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-gray-900 dark:text-white">${record.future_price.toFixed(2)}</span>
                      <span className="text-[10px] font-bold text-green-500">({record.margin_percent.toFixed(1)}%)</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Clock size={12} className="text-gray-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Effective From</span>
                    </div>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{new Date(record.effective_from).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
