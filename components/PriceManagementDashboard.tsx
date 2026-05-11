import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Plus,
  ChevronRight,
  ChevronLeft,
  DollarSign,
  Calendar,
  History as HistoryIcon,
  Clock,
  TrendingUp,
  Tag,
  Package,
  Globe,
  ShoppingCart,
  Zap,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  MoreVertical,
  Ban
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import {
  getCurrentPricesTable,
  getDistinctCategories,
  updateSellPriceStatus,
  createSellPrice,
  getCostBasisForItem,
  getMarginThreshold,
  getFuturePriceChanges
} from '../services/sellPricingService';
import { FuturePricesPanel } from './FuturePricesPanel';
import PricingSchedulesList from './PricingSchedulesList';
import { PriceHistoryPanel } from './PriceHistoryPanel';
import { SellPriceType } from '../types';
import { supabase } from '../lib/supabaseClient';
import PageHeader from './PageHeader';
import { useToast, ToastContainer } from './ToastNotification';
import { ConfirmDialog } from './ConfirmDialog';

const PriceManagementDashboard: React.FC = () => {
  const { hasPermission } = useApp();
  const navigate = useNavigate();
  const { toasts, dismissToast } = useToast();
  const [activeTab, setActiveTab] = useState<'current' | 'future' | 'schedules' | 'history'>('current');
  
  // Tab 1: Current Prices State
  const [currentPrices, setCurrentPrices] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: '',
    priceType: '',
    searchSku: ''
  });
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Tab 4: History Search State
  const [historySearch, setHistorySearch] = useState('');
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<{id: string, name: string, sku: string} | null>(null);
  const [historySearchResults, setHistorySearchResults] = useState<any[]>([]);

  // Slide-over State
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [selectedItemForNewVersion, setSelectedItemForNewVersion] = useState<any>(null);

  const canManage = hasPermission('manage_sell_pricing');

  useEffect(() => {
    if (activeTab === 'current') {
      fetchCurrentPrices();
      fetchCategories();
    }
  }, [activeTab, filters]);

  const fetchCategories = async () => {
    try {
      const cats = await getDistinctCategories();
      setCategories(cats);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchCurrentPrices = async () => {
    setLoading(true);
    try {
      const data = await getCurrentPricesTable(filters);
      setCurrentPrices(data);
    } catch (err) {
      console.error('Failed to fetch current prices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (currentPrices.length === 0) return;
    
    const headers = ['SKU', 'Item Name', 'Category', 'Price Type', 'Sell Price', 'Margin %', 'Effective From'];
    const rows = currentPrices.map(p => [
      p.sku,
      p.name,
      p.category,
      p.price_type,
      p.sell_price_ex_gst,
      p.margin_percent,
      p.effective_from
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `current_prices_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getMarginStyle = (margin: number) => {
    if (margin >= 25) return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400';
    if (margin >= 20) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400';
  };

  const paginatedPrices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return currentPrices.slice(start, start + pageSize);
  }, [currentPrices, page]);

  const totalPages = Math.ceil(currentPrices.length / pageSize);

  const handleHistorySearch = async (val: string) => {
    setHistorySearch(val);
    if (val.length < 2) {
      setHistorySearchResults([]);
      return;
    }
    const { data } = await supabase
      .from('items')
      .select('id, name, sku')
      .or(`sku.ilike.%${val}%,name.ilike.%${val}%`)
      .limit(5);
    setHistorySearchResults(data || []);
  };

  if (!hasPermission('manage_sell_pricing')) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500">
        <Ban size={48} className="mb-4 opacity-20" />
        <h2 className="text-xl font-bold uppercase tracking-tight">Access Restricted</h2>
        <p className="text-sm font-medium">You need 'manage_sell_pricing' permission to access this hub.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-20 animate-page-entry">
      <PageHeader
        title="Price Management"
        subtitle="Authoritative hub for all sell pricing state and execution."
      />
      {/* Header Actions */}
      <div className="flex justify-end">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('schedules')}
            className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 text-xs font-black uppercase tracking-widest rounded-2xl shadow-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
          >
            <Zap size={16} className="text-amber-500" />
            Bulk Uplifts
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-2xl w-fit">
        {[
          { id: 'current', label: 'Current Prices', icon: DollarSign },
          { id: 'future', label: 'Future Changes', icon: Calendar },
          { id: 'schedules', label: 'Schedules', icon: Clock },
          { id: 'history', label: 'Price History', icon: HistoryIcon },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id 
                ? 'bg-white dark:bg-nocturne text-[#129DC0] shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-8">
        {activeTab === 'current' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white/50 dark:bg-white/5 p-4 rounded-3xl border border-gray-100 dark:border-gray-800">
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search SKU or Name..."
                  value={filters.searchSku}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchSku: e.target.value }))}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-nocturne border border-gray-100 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#129DC0] transition-all"
                />
              </div>
              <select 
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                className="py-3 px-4 bg-white dark:bg-nocturne border border-gray-100 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#129DC0]"
              >
                <option value="">All Categories</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <select 
                value={filters.priceType}
                onChange={(e) => setFilters(prev => ({ ...prev, priceType: e.target.value }))}
                className="py-3 px-4 bg-white dark:bg-nocturne border border-gray-100 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#129DC0]"
              >
                <option value="">All Price Types</option>
                <option value="STANDARD">Standard</option>
                <option value="GROUP">Group</option>
                <option value="CUSTOMER_SPECIFIC">Customer-Specific</option>
                <option value="CONTRACT">Contract</option>
                <option value="PROMOTIONAL">Promotional</option>
              </select>
              <button 
                onClick={handleExportCSV}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
              >
                <Download size={16} />
                Export CSV
              </button>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-nocturne rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 dark:bg-[#181a21]/50 border-b border-gray-200 dark:border-gray-800">
                      <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Item / SKU</th>
                      <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Category</th>
                      <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Price Type</th>
                      <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Sell Price (ex)</th>
                      <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Margin %</th>
                      <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Effective</th>
                      <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Publication</th>
                      <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={8} className="p-5 h-20 bg-gray-50/20 dark:bg-white/5" />
                        </tr>
                      ))
                    ) : paginatedPrices.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-20 text-center">
                          <div className="flex flex-col items-center justify-center text-gray-400">
                            <Search size={48} className="mb-4 opacity-10" />
                            <p className="font-bold">No active prices found</p>
                            <p className="text-xs">Try adjusting your filters or search term.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedPrices.map((price) => (
                        <tr key={price.sell_price_record_id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group">
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-[#129DC0]/10 rounded-xl flex items-center justify-center text-[#129DC0]">
                                <Package size={20} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">{price.name}</p>
                                <p className="text-[10px] font-mono text-gray-400 font-bold uppercase tracking-tight">{price.sku}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-5">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-tight">{price.category}</span>
                          </td>
                          <td className="p-5">
                            <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">
                              {price.price_type}
                            </span>
                          </td>
                          <td className="p-5">
                            <span className="text-sm font-black text-gray-900 dark:text-white">${price.sell_price_ex_gst.toFixed(2)}</span>
                          </td>
                          <td className="p-5">
                            <span className={`px-2 py-1 rounded text-xs font-black ${getMarginStyle(price.margin_percent)}`}>
                              {price.margin_percent.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-5">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-gray-900 dark:text-white">{new Date(price.effective_from).toLocaleDateString()}</span>
                              {price.effective_to && (
                                <span className="text-[10px] text-gray-400 font-medium">Until {new Date(price.effective_to).toLocaleDateString()}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-5">
                            <div className="flex gap-1.5">
                              {price.publish_to_bundle && <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500" title="Bundle"><ShoppingCart size={14} /></div>}
                              {price.publish_to_linenhub && <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500" title="LinenHub"><Globe size={14} /></div>}
                              {price.publish_to_salesforce && <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500" title="Salesforce"><TrendingUp size={14} /></div>}
                            </div>
                          </td>
                          <td className="p-5 text-right">
                            <button 
                              onClick={() => {
                                setSelectedItemForNewVersion(price);
                                setIsSlideOverOpen(true);
                              }}
                              className="px-4 py-2 bg-[#129DC0]/10 text-[#129DC0] hover:bg-[#129DC0] hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                            >
                              New Version
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/30 dark:bg-[#181a21]/30">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, currentPrices.length)} of {currentPrices.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button 
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                      className="p-2 bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-xl disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setPage(i + 1)}
                          className={`w-8 h-8 rounded-xl text-xs font-black ${
                            page === i + 1 
                              ? 'bg-[#129DC0] text-white' 
                              : 'bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                      {totalPages > 5 && <span className="px-2 text-gray-400">...</span>}
                    </div>
                    <button 
                      disabled={page === totalPages}
                      onClick={() => setPage(p => p + 1)}
                      className="p-2 bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-xl disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'future' && (
          <div className="space-y-6">
            <FuturePricesPanelWithCancel />
          </div>
        )}

        {activeTab === 'schedules' && (
          <div className="space-y-6">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => navigate('/pricing/schedules/new')}
                className="flex items-center gap-2 px-6 py-3 bg-[var(--color-brand)] text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-[var(--color-brand)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Plus size={18} />
                New Schedule
              </button>
            </div>
            <PricingSchedulesList />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-8 max-w-5xl mx-auto">
            <div className="bg-white dark:bg-nocturne p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
              <HistoryIcon size={48} className="mx-auto mb-4 text-[#129DC0] opacity-20" />
              <h2 className="text-xl font-black uppercase tracking-tight mb-2">Item Pricing History Audit</h2>
              <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">
                Search for an item to view its full chronological version history of both purchase and sell prices.
              </p>
              
              <div className="relative max-w-xl mx-auto">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Enter SKU or Item Name..."
                  value={historySearch}
                  onChange={(e) => handleHistorySearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-2xl text-base outline-none focus:ring-4 focus:ring-[#129DC0]/10 focus:border-[#129DC0] transition-all"
                />
                
                {historySearchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
                    {historySearchResults.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedHistoryItem(item);
                          setHistorySearchResults([]);
                          setHistorySearch('');
                        }}
                        className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-white/5 text-left border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors"
                      >
                        <div className="w-10 h-10 bg-[#129DC0]/10 rounded-xl flex items-center justify-center text-[#129DC0]">
                          <Package size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{item.name}</p>
                          <p className="text-[10px] font-mono text-gray-400 font-bold uppercase tracking-widest">{item.sku}</p>
                        </div>
                        <ArrowRight size={16} className="ml-auto text-gray-300" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedHistoryItem && (
              <div className="animate-slide-up">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#129DC0] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#129DC0]/30">
                      <Package size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{selectedHistoryItem.name}</h2>
                      <p className="text-xs font-mono font-bold text-[#129DC0] tracking-widest uppercase">{selectedHistoryItem.sku}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedHistoryItem(null)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>
                
                <PriceHistoryPanel itemId={selectedHistoryItem.id} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Slide-over for New Version */}
      <NewVersionSlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        item={selectedItemForNewVersion}
        onSaved={fetchCurrentPrices}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

// Component for Tab 2 with Cancel Button
const FuturePricesPanelWithCancel = () => {
  const [prices, setPrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const { toasts, dismissToast, success, error } = useToast();

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getFuturePriceChanges();
        setPrices(data || []);
      } catch (err: any) {
        console.error('Failed to fetch future prices:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [refreshKey]);

  const runCancel = async (id: string) => {
    try {
      await updateSellPriceStatus(id, 'REJECTED');
      setRefreshKey(k => k + 1);
      success('Scheduled price cancelled.');
    } catch (err: any) {
      error(err.message || 'Failed to cancel price.');
    }
  };

  const handleCancel = (id: string) => setPendingCancelId(id);

  if (loading) return <div className="h-48 bg-gray-50 animate-pulse rounded-3xl" />;

  return (
    <div className="space-y-6">
       <div className="bg-white dark:bg-nocturne rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-[#181a21]/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
              <Calendar size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Approved Future Prices</h3>
              <p className="text-sm text-gray-500 font-medium">Prices scheduled for automatic activation on their effective date.</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          {prices.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center">
              <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-3xl flex items-center justify-center mb-4 text-gray-200">
                <Clock size={40} />
              </div>
              <p className="font-bold text-lg">No future changes scheduled</p>
              <p className="text-sm text-gray-500">Approved price versions with future dates will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {prices.map((record) => (
                <div 
                  key={record.price_record_id}
                  className="p-6 bg-white dark:bg-[#1a1c23] border border-gray-100 dark:border-gray-800 rounded-3xl hover:shadow-xl transition-all relative group"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 block mb-1">Item SKU</span>
                      <span className="text-sm font-mono font-bold text-[#129DC0]">{record.sku}</span>
                    </div>
                    <div className="px-3 py-1.5 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">
                      T-{record.days_until_effective} Days
                    </div>
                  </div>

                  <h4 className="text-base font-black text-gray-900 dark:text-white mb-4 line-clamp-1">{record.item_name}</h4>

                  <div className="space-y-4 pt-6 border-t border-gray-50 dark:border-gray-800">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Price Type</span>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">{record.price_type}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">New Price</span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-gray-900 dark:text-white">${record.future_price.toFixed(2)}</span>
                        <span className="text-[10px] font-black text-green-500">({record.margin_percent.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Effective Date</span>
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{new Date(record.effective_from).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="mt-8">
                    <button 
                      onClick={() => handleCancel(record.price_record_id)}
                      className="w-full py-3 border-2 border-red-500/10 text-red-500 hover:bg-red-500 hover:text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2"
                    >
                      <X size={16} />
                      Cancel Change
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={pendingCancelId !== null}
        title="Cancel Scheduled Price?"
        message="This will set the scheduled price status to REJECTED and it will not be activated on its effective date. This cannot be undone."
        confirmLabel="Cancel Price Change"
        variant="danger"
        onConfirm={() => { const id = pendingCancelId!; setPendingCancelId(null); runCancel(id); }}
        onCancel={() => setPendingCancelId(null)}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

// New Version Slide-over
const NewVersionSlideOver: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  item: any;
  onSaved: () => void;
}> = ({ isOpen, onClose, item, onSaved }) => {
  const [formData, setFormData] = useState({
    price_type: 'STANDARD' as SellPriceType,
    customer_reference: '',
    sale_uom: 'EACH',
    sell_price_ex_gst: 0,
    tax_code: 'GST',
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: '',
    publish_to_salesforce: false,
    publish_to_bundle: false,
    publish_to_linenhub: false,
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [costBasis, setCostBasis] = useState(0);
  const [marginThreshold, setMarginThreshold] = useState(25);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && item) {
      setFormData({
        price_type: item.price_type as SellPriceType,
        customer_reference: '', // Require re-entry or keep empty
        sale_uom: 'EACH', // Default
        sell_price_ex_gst: item.sell_price_ex_gst,
        tax_code: 'GST',
        effective_from: new Date().toISOString().split('T')[0],
        effective_to: '',
        publish_to_salesforce: item.publish_to_salesforce,
        publish_to_bundle: item.publish_to_bundle,
        publish_to_linenhub: item.publish_to_linenhub,
        notes: `Revision of existing ${item.price_type} price.`
      });
      loadContext();
    }
  }, [isOpen, item]);

  const loadContext = async () => {
    try {
      const [basis, threshold] = await Promise.all([
        getCostBasisForItem(item.item_id),
        getMarginThreshold()
      ]);
      setCostBasis(basis);
      setMarginThreshold(threshold);
    } catch (err) {
      console.error(err);
    }
  };

  const marginDetails = useMemo(() => {
    const sellPrice = formData.sell_price_ex_gst;
    if (sellPrice <= 0) return { percent: 0, amount: 0, color: 'text-gray-400', isBelowThreshold: false };

    const amount = sellPrice - costBasis;
    const percent = (amount / sellPrice) * 100;
    
    let color = '#9ca3af';
    if (percent >= marginThreshold) color = '#10b981';
    else if (percent >= marginThreshold - 5) color = '#f59e0b';
    else color = '#ef4444';

    return { 
      percent: percent.toFixed(2), 
      amount: amount.toFixed(2), 
      color,
      isBelowThreshold: percent < marginThreshold
    };
  }, [formData.sell_price_ex_gst, costBasis, marginThreshold]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createSellPrice({
        item_id: item.item_id,
        ...formData,
        cost_basis: costBasis
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      
      <div className="relative w-full max-w-xl bg-white dark:bg-nocturne shadow-2xl h-full flex flex-col animate-slide-in-right overflow-y-auto">
        <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-nocturne/80 backdrop-blur-md z-10">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#129DC0] mb-1 block">Pricing Revision</span>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">New Price Version</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all"><X size={24} /></button>
        </div>

        <div className="p-8 space-y-10">
          {/* Context Card */}
          <div className="bg-gray-50 dark:bg-[#181a21] p-6 rounded-3xl border border-gray-100 dark:border-gray-800">
            <div className="flex gap-4 items-center mb-6">
              <div className="w-14 h-14 bg-white dark:bg-nocturne rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center justify-center text-[#129DC0] shadow-sm">
                <Package size={28} />
              </div>
              <div>
                <p className="text-sm font-black text-gray-900 dark:text-white">{item.name}</p>
                <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">{item.sku}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-white dark:bg-nocturne rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Active Price</p>
                <p className="text-lg font-black text-gray-900 dark:text-white">${item.sell_price_ex_gst.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-white dark:bg-nocturne rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Landed Cost</p>
                <p className="text-lg font-black text-[#129DC0]">${costBasis.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8 pb-20">
            {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-sm font-bold flex items-center gap-3"><AlertCircle size={20} />{error}</div>}

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Price Type</label>
                <select
                  value={formData.price_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_type: e.target.value as any }))}
                  className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-[#129DC0]/10 focus:border-[#129DC0] transition-all"
                >
                  <option value="STANDARD">Standard</option>
                  <option value="GROUP">Group</option>
                  <option value="CUSTOMER_SPECIFIC">Customer-Specific</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="PROMOTIONAL">Promotional</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">New Sell Price (ex)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                    <input 
                      type="number"
                      step="0.01"
                      value={formData.sell_price_ex_gst}
                      onChange={(e) => setFormData(prev => ({ ...prev, sell_price_ex_gst: parseFloat(e.target.value) || 0 }))}
                      className="w-full pl-10 pr-4 py-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-2xl text-lg font-black outline-none focus:ring-4 focus:ring-[#129DC0]/10 focus:border-[#129DC0] transition-all"
                    />
                  </div>
                </div>
                <div className="flex flex-col justify-end">
                  <div className="p-4 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-800 text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">New Margin</p>
                    <p className="text-xl font-black" style={{ color: marginDetails.color }}>{marginDetails.percent}%</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Effective From</label>
                  <input 
                    type="date"
                    value={formData.effective_from}
                    onChange={(e) => setFormData(prev => ({ ...prev, effective_from: e.target.value }))}
                    className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-[#129DC0]/10 focus:border-[#129DC0] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Effective To</label>
                  <input 
                    type="date"
                    value={formData.effective_to}
                    onChange={(e) => setFormData(prev => ({ ...prev, effective_to: e.target.value }))}
                    className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-[#129DC0]/10 focus:border-[#129DC0] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Publication Sync</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'publish_to_bundle', label: 'Bundle', icon: ShoppingCart },
                    { key: 'publish_to_linenhub', label: 'LinenHub', icon: Globe },
                    { key: 'publish_to_salesforce', label: 'Salesforce', icon: TrendingUp },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, [p.key]: !prev[p.key as keyof typeof prev] }))}
                      className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
                        formData[p.key as keyof typeof formData] 
                          ? 'bg-[#129DC0]/10 border-[#129DC0] text-[#129DC0]' 
                          : 'bg-white dark:bg-white/5 border-gray-100 dark:border-gray-800 text-gray-400'
                      }`}
                    >
                      <p.icon size={20} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Revision Notes</label>
                <textarea 
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Why is this price being updated?"
                  className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-[#129DC0]/10 focus:border-[#129DC0] transition-all min-h-[100px] resize-none"
                />
              </div>
            </div>

            {marginDetails.isBelowThreshold && (
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-6 rounded-3xl flex gap-4 items-start animate-slide-up">
                <AlertCircle className="text-amber-600 shrink-0" size={24} />
                <p className="text-xs font-bold text-amber-800 dark:text-amber-200 leading-relaxed">
                  Low Margin Warning: This price results in a margin of {marginDetails.percent}%, which is below the {marginThreshold}% threshold. 
                  Saving this will trigger a commercial approval workflow.
                </p>
              </div>
            )}

            <div className="pt-4 sticky bottom-0 bg-white dark:bg-nocturne pb-8">
              <button type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#129DC0] text-white text-sm font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-[#129DC0]/20 hover:bg-[#0f87a8] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                ) : (
                  <>Save Price Version</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PriceManagementDashboard;
