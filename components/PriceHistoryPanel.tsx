import React, { useState, useEffect } from 'react';
import { 
  History, Clock, CheckCircle2, AlertCircle, XCircle, 
  ArrowUpRight, ArrowDownRight, TrendingUp, Info 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getPriceVersionHistory } from '../services/sellPricingService';
import { ItemPurchasePrice, ItemSellPrice } from '../types';

interface PriceHistoryPanelProps {
  itemId: string;
  showPurchasePrices?: boolean;
  showSellPrices?: boolean;
}

export const PriceHistoryPanel: React.FC<PriceHistoryPanelProps> = ({ 
  itemId, 
  showPurchasePrices: propShowPurchase, 
  showSellPrices: propShowSell 
}) => {
  const { hasPermission, currentUser } = useApp();
  const [data, setData] = useState<{
    purchasePrices: ItemPurchasePrice[];
    sellPrices: ItemSellPrice[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.roleIds?.includes('ADMIN');
  const canViewPurchase = propShowPurchase ?? (hasPermission('view_purchase_pricing') || isAdmin);
  const canViewSell = propShowSell ?? (hasPermission('view_sell_pricing') || isAdmin);

  useEffect(() => {
    if (itemId) {
      fetchHistory();
    }
  }, [itemId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const history = await getPriceVersionHistory(itemId);
      setData(history);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch price history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest border border-green-200">Active</span>;
      case 'APPROVED_FUTURE':
        return <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest border border-blue-200">Future</span>;
      case 'SUPERSEDED':
        return <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-black uppercase tracking-widest border border-gray-200 line-through">Superseded</span>;
      case 'DRAFT':
        return <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-black uppercase tracking-widest border border-gray-200">Draft</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-widest border border-red-200">Rejected</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-black uppercase tracking-widest border border-gray-200">{status}</span>;
    }
  };

  const getMarginClass = (margin: number) => {
    if (margin >= 25) return 'text-green-600 dark:text-green-400';
    if (margin >= 20) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center space-x-2 animate-pulse">
        <Clock className="text-gray-300 animate-spin" size={20} />
        <span className="text-sm font-medium text-gray-400 uppercase tracking-widest">Loading Price History...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl flex items-center gap-3 text-red-600">
        <AlertCircle size={20} />
        <p className="text-sm font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 py-4">
      {/* Purchase Price History */}
      {canViewPurchase && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                <History size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Purchase Price History</h3>
                <p className="text-xs text-gray-500 font-medium">Historical audit of all supplier pricing agreements</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <Info size={12} /> Date Effective Logic
            </div>
          </div>

          {data?.purchasePrices.length === 0 ? (
            <div className="p-12 text-center bg-gray-50 dark:bg-[#15171e] rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
              <p className="text-sm text-gray-400 italic">No price history yet</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-[#181a21]/50 border-b border-gray-200 dark:border-gray-800">
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Supplier</th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">UOM</th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Price ex-GST</th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Landed Cost</th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Pref</th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Effective From</th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Effective To</th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data?.purchasePrices.map((price) => (
                    <tr key={price.id} className={`hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors ${price.status === 'SUPERSEDED' ? 'opacity-60' : ''}`}>
                      <td className="p-4">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{(price as any).suppliers?.name || 'Unknown'}</p>
                        <p className="text-[10px] font-mono text-gray-400">{price.supplier_item_code || 'No SKU'}</p>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-medium text-gray-500">{price.purchase_uom}</span>
                      </td>
                      <td className="p-4">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">${price.purchase_price_ex_gst.toFixed(2)}</p>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">{price.currency}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-sm font-black text-indigo-500">${price.landed_cost.toFixed(2)}</p>
                      </td>
                      <td className="p-4 text-center">
                        {price.is_preferred_supplier ? (
                          <div className="flex justify-center"><CheckCircle2 size={16} className="text-green-500" /></div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <p className="text-xs font-bold text-gray-900 dark:text-white">{new Date(price.effective_from).toLocaleDateString()}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-xs font-medium text-gray-500">{price.effective_to ? new Date(price.effective_to).toLocaleDateString() : 'Forever'}</p>
                      </td>
                      <td className="p-4 text-right">
                        {getStatusBadge(price.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Sell Price History */}
      {canViewSell && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center text-cyan-500">
                <TrendingUp size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Sell Price History</h3>
                <p className="text-xs text-gray-500 font-medium">Customer-facing price lists and margin performance</p>
              </div>
            </div>
          </div>

          {data?.sellPrices.length === 0 ? (
            <div className="p-12 text-center bg-gray-50 dark:bg-[#15171e] rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
              <p className="text-sm text-gray-400 italic">No price history yet</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-[#181a21]/50 border-b border-gray-200 dark:border-gray-800">
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Price Type</th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer Ref</th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">UOM</th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Sell Price</th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Margin %</th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Effective From</th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Effective To</th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data?.sellPrices.map((price) => (
                    <tr key={price.id} className={`hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors ${price.status === 'SUPERSEDED' ? 'opacity-60' : ''}`}>
                      <td className="p-4">
                        <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400">
                          {price.price_type}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{price.customer_id || 'Global'}</p>
                        {price.contract_id && <p className="text-[10px] font-mono text-cyan-600">Contract Locked</p>}
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-medium text-gray-500">{price.sale_uom}</span>
                      </td>
                      <td className="p-4">
                        <p className="text-sm font-black text-gray-900 dark:text-white">${price.sell_price_ex_gst.toFixed(2)}</p>
                      </td>
                      <td className="p-4">
                        <p className={`text-sm font-black ${price.status === 'ACTIVE' ? getMarginClass(price.margin_percent) : 'text-gray-400'}`}>
                          {price.margin_percent.toFixed(1)}%
                        </p>
                      </td>
                      <td className="p-4">
                        <p className="text-xs font-bold text-gray-900 dark:text-white">{new Date(price.effective_from).toLocaleDateString()}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-xs font-medium text-gray-500">{price.effective_to ? new Date(price.effective_to).toLocaleDateString() : 'Forever'}</p>
                      </td>
                      <td className="p-4 text-right">
                        {getStatusBadge(price.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
