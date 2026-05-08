import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  ClipboardCheck,
  AlertCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  Loader2,
  RefreshCcw,
} from 'lucide-react';
import { getRequestsForMasterData, ItemRequestWithUser } from '../services/itemRequestService';
import { useNavigate } from 'react-router-dom';
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

const ProcurementQueue = () => {
  const { hasPermission } = useApp();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ItemRequestWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const canManage = hasPermission('manage_item_definition');

  const fetchRequests = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const data = await getRequestsForMasterData() as ItemRequestWithUser[];
      setRequests(data.filter(r => r.status === 'PROCUREMENT_REVIEW'));
    } catch (err) {
      console.error('Failed to fetch requests:', err);
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
        <p className="text-gray-500 mt-2">You do not have permission to view the Procurement Queue.</p>
      </div>
    );
  }

  const getSLAColor = (createdAt: string) => {
    const age = (new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    if (age > 48) return 'text-red-500 bg-red-50 dark:bg-red-900/10 border-red-100';
    if (age > 24) return 'text-amber-500 bg-amber-50 dark:bg-amber-900/10 border-amber-100';
    return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100';
  };

  const RequestCard = ({ request }: { request: ItemRequestWithUser }) => {
    const meta = (request.metadata ?? {}) as Record<string, unknown>;
    const proposedCode = typeof meta.proposedCode === 'string' ? meta.proposedCode : null;
    return (
      <div className="bg-white dark:bg-[#1e2029] border border-gray-100 dark:border-gray-800 rounded-2xl p-6 hover:shadow-lg transition-all group relative overflow-hidden">
        {request.is_urgent && (
          <div className="absolute top-0 right-0 px-3 py-1 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-bl-xl">
            Urgent
          </div>
        )}
        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div className="flex-1 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0 border border-violet-100 dark:border-violet-500/20">
                <ClipboardCheck size={24} className="text-violet-500" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs font-mono text-gray-400 dark:text-gray-600">
                    {request.id.substring(0, 8).toUpperCase()}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${getSLAColor(request.created_at)}`}>
                    Procurement Review
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-1">
                  {request.item_description}
                </h3>
                <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                  {request.business_reason}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs font-medium text-gray-400">
              <div className="flex items-center gap-1.5">
                <Clock size={14} />
                <span>{formatRelativeTime(request.created_at)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-[10px] font-black uppercase">
                  {(request.requestor_name || 'U').substring(0, 1)}
                </div>
                <span>{request.requestor_name || request.requestor_id.substring(0, 8)}</span>
              </div>
              {proposedCode && (
                <span className="font-mono text-[10px] font-black px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                  {proposedCode}
                </span>
              )}
              {request.is_urgent && (
                <span className="px-1.5 py-0.5 bg-red-50 dark:bg-red-900/10 text-red-600 rounded text-[9px] font-black uppercase border border-red-100">
                  Urgent
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            <button
              onClick={() => navigate(`/items/requests/${request.id}/procurement-review`)}
              className="px-4 py-2 bg-violet-500 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-violet-500/20 hover:bg-violet-600 transition-all flex items-center gap-2"
            >
              <ExternalLink size={14} /> Start Review
            </button>
            <button
              onClick={() => navigate(`/items/requests/${request.id}`)}
              className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-all"
              title="View Details"
            >
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-page-entry max-w-6xl mx-auto">
      <PageHeader
        title="Procurement Queue"
        subtitle="Review and complete technical details before Master Data handover."
      />
      <div className="flex justify-end">
        <button
          onClick={() => fetchRequests(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all disabled:opacity-50"
        >
          <RefreshCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-gray-300" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center mb-4 border border-violet-100 dark:border-violet-500/20">
            <ClipboardCheck size={32} className="text-violet-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">No items awaiting procurement review</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Items routed for procurement review will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map(request => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProcurementQueue;
