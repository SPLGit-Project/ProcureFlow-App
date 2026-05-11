import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock, DollarSign, ExternalLink, RefreshCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getRequestsForPricing } from '../services/itemRequestService';
import { ItemRequest } from '../types';
import PageHeader from './PageHeader';

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

export default function PricingReviewQueue() {
  const { hasPermission } = useApp();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ItemRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const canManage = hasPermission('manage_sell_pricing') || hasPermission('manage_purchase_pricing');

  const fetchRequests = async (silent = false) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      setRequests(await getRequestsForPricing());
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(() => fetchRequests(true), 60000);
    return () => clearInterval(interval);
  }, []);

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-20 text-center">
        <AlertCircle size={48} className="mb-4 text-gray-300" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Access Denied</h2>
        <p className="text-gray-500 mt-2">You do not have permission to view the Pricing Queue.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-page-entry max-w-6xl mx-auto">
      <PageHeader title="Pricing Queue" subtitle="Complete pricing setup for item requests before approval." />
      <div className="flex justify-end">
        <button
          onClick={() => fetchRequests(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500 bg-white dark:bg-nocturne border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-sm"
        >
          <RefreshCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh Queue
        </button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 bg-gray-50 dark:bg-white/5 rounded-2xl animate-pulse border border-gray-100 dark:border-gray-800" />
          ))
        ) : requests.length > 0 ? (
          requests.map(request => (
            <div key={request.id} className="bg-white dark:bg-nocturne border border-gray-100 dark:border-gray-800 rounded-2xl p-6 hover:shadow-lg transition-all relative overflow-hidden">
              {request.is_urgent && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-bl-xl">
                  Urgent
                </div>
              )}
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[var(--color-brand)]/10 flex items-center justify-center shrink-0 border border-[var(--color-brand)]/20">
                      <DollarSign size={24} className="text-[var(--color-brand)]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-xs font-mono text-gray-400 dark:text-gray-600">
                          {request.id.substring(0, 8).toUpperCase()}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border bg-amber-50 text-amber-600 border-amber-100">
                          Pricing Review
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-1">{request.item_description}</h3>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-1">{request.business_reason}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs font-medium text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} />
                      <span>{formatRelativeTime(request.status_changed_at || request.created_at)}</span>
                    </div>
                    {request.target_sap && <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/10 text-blue-600 rounded text-[9px] font-black uppercase">SAP</span>}
                    {request.target_bundle && <span className="px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/10 text-purple-600 rounded text-[9px] font-black uppercase">Bundle</span>}
                    {request.target_linenhub && <span className="px-1.5 py-0.5 bg-teal-50 dark:bg-teal-900/10 text-teal-600 rounded text-[9px] font-black uppercase">LinenHub</span>}
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/items/requests/${request.id}/pricing`)}
                  className="self-end md:self-center px-4 py-2 bg-[var(--color-brand)] text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-[var(--color-brand)]/20 hover:bg-[var(--color-brand-dark)] transition-all flex items-center gap-2"
                >
                  <ExternalLink size={14} /> Setup Pricing
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400 bg-gray-50/50 dark:bg-white/5 rounded-[2rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
            <CheckCircle2 size={48} className="mb-4 opacity-20" />
            <p className="font-bold text-sm tracking-tight">No requests are waiting for pricing.</p>
          </div>
        )}
      </div>
    </div>
  );
}
