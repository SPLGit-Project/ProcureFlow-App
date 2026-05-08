import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  ClipboardList,
  Search,
  AlertCircle,
  Clock,
  CheckCircle2,
  ArrowRight,
  History,
  FileSearch,
  CheckCircle,
  RefreshCcw,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { getRequestsForMasterData, ItemRequestWithUser } from '../services/itemRequestService';
import { transitionRequest } from '../services/itemWorkflowService';
import { ItemRequestStatus } from '../types';
import { useNavigate } from 'react-router-dom';
import { useToast } from './ToastNotification';
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


type TabType = 'NEEDS_ACTION' | 'PRICING_REVIEW' | 'PENDING_APPROVAL' | 'REVISION_REQUIRED' | 'PROCUREMENT_REVIEW';

const MasterDataQueue = () => {
  const { hasPermission } = useApp();
  const navigate = useNavigate();
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('NEEDS_ACTION');
  const [requests, setRequests] = useState<ItemRequestWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const canManage = hasPermission('manage_item_definition') || hasPermission('manage_sell_pricing') || hasPermission('manage_purchase_pricing');

  const fetchRequests = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    
    try {
      const data = await getRequestsForMasterData() as ItemRequestWithUser[];
      setRequests(data);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
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
        <p className="text-gray-500 mt-2">You do not have permission to view the Master Data Queue.</p>
      </div>
    );
  }

  const isProcurementPending = (r: ItemRequestWithUser) =>
    !!(r.metadata as Record<string, unknown> | undefined)?.procurement_review_pending;

  const getFilteredRequests = () => {
    switch (activeTab) {
      case 'NEEDS_ACTION':
        return requests.filter(r => ['SUBMITTED', 'DUPLICATE_REVIEW', 'DATA_REVIEW'].includes(r.status));
      case 'PRICING_REVIEW':
        return requests.filter(r => r.status === 'PRICING_REVIEW');
      case 'PENDING_APPROVAL':
        return requests.filter(r => r.status === 'APPROVAL_PENDING');
      case 'REVISION_REQUIRED':
        return requests.filter(r => r.status === 'REVISION_REQUIRED');
      case 'PROCUREMENT_REVIEW':
        return requests.filter(isProcurementPending);
      default:
        return [];
    }
  };

  const getSLAColor = (createdAt: string) => {
    const age = (new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    if (age > 48) return 'text-red-500 bg-red-50 dark:bg-red-900/10 border-red-100';
    if (age > 24) return 'text-amber-500 bg-amber-50 dark:bg-amber-900/10 border-amber-100';
    return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100';
  };

  const handleUpdateStatus = async (id: string, status: ItemRequestStatus) => {
    try {
      await transitionRequest(id, status);
      await fetchRequests(true);
      success('Request status updated.');
    } catch (err) {
      console.error('Update failed:', err);
      error('Failed to update request status. Please try again.');
    }
  };

  const RequestCard = ({ request }: { request: ItemRequestWithUser }) => {
    const meta = (request.metadata ?? {}) as Record<string, unknown>;
    const missingFields = Array.isArray(meta.procurement_missing_fields) ? meta.procurement_missing_fields as string[] : [];
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
            <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-white/5 flex items-center justify-center shrink-0 border border-gray-100 dark:border-gray-800">
              <ClipboardList size={24} className="text-gray-400" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs font-mono text-gray-400 dark:text-gray-600">
                  {request.id.substring(0, 8).toUpperCase()}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${getSLAColor(request.created_at)}`}>
                  {request.status.replace(/_/g, ' ')}
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
            {request.target_sap && <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/10 text-blue-600 rounded text-[9px] font-black uppercase">SAP</span>}
            {request.target_bundle && <span className="px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/10 text-purple-600 rounded text-[9px] font-black uppercase">Bundle</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-center">
          {request.status === 'SUBMITTED' && (
            <button 
              onClick={async () => {
                try {
                  await transitionRequest(request.id, 'DUPLICATE_REVIEW', {
                    notes: 'Duplicate check wizard started from Master Data queue.',
                    metadata: { action: 'START_DUPLICATE_CHECK' },
                  });
                  navigate(`/items/requests/${request.id}/duplicate-check`);
                } catch (err) {
                  error(err instanceof Error ? err.message : 'Failed to start duplicate check.');
                }
              }}
              className="px-4 py-2 bg-amber-500 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all flex items-center gap-2"
            >
              <FileSearch size={14} /> Start Duplicate Check
            </button>
          )}
          {request.status === 'DUPLICATE_REVIEW' && (
            <button 
              onClick={() => navigate(`/items/requests/${request.id}/duplicate-check`)}
              className="px-4 py-2 bg-emerald-500 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center gap-2"
            >
              <CheckCircle size={14} /> Continue Check
            </button>
          )}
          {request.status === 'DATA_REVIEW' && (
            <button 
              onClick={() => navigate(`/items/requests/${request.id}/define`)}
              className="px-4 py-2 bg-[var(--color-brand)] text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-[var(--color-brand)]/20 hover:bg-[var(--color-brand-dark)] transition-all flex items-center gap-2"
            >
              <ExternalLink size={14} /> Define Item
            </button>
          )}
          {request.status === 'PRICING_REVIEW' && (
            <button 
              onClick={() => navigate(`/items/requests/${request.id}/pricing`)}
              className="px-4 py-2 bg-amber-500 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all flex items-center gap-2"
            >
              <ExternalLink size={14} /> Setup Pricing
            </button>
          )}
          <button
            onClick={() => navigate(`/items/requests/${request.id}`)}
            className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-all"
            title="View Details"
          >
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
      {missingFields.length > 0 && (
        <div className="mt-4 pt-4 border-t border-amber-100 dark:border-amber-500/15 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Awaiting from Procurement:</span>
          {missingFields.map((f: string) => (
            <span key={f} className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded border border-amber-200 dark:border-amber-500/20">
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
    );
  };

  return (
    <div className="space-y-8 animate-page-entry max-w-6xl mx-auto">
      <PageHeader
        title="Master Data Queue"
        subtitle="Manage item requests through the definition lifecycle."
      />
      <div className="flex justify-end">
        <button
          onClick={() => fetchRequests(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500 bg-white dark:bg-[#1e2029] border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-sm"
        >
          <RefreshCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh Queue
        </button>
      </div>

      <div className="flex gap-1 p-1 bg-gray-50 dark:bg-white/5 rounded-2xl w-fit border border-gray-100 dark:border-gray-800 flex-wrap">
        {[
          { id: 'NEEDS_ACTION', label: 'Needs Action', icon: AlertCircle, count: requests.filter(r => ['SUBMITTED', 'DUPLICATE_REVIEW', 'DATA_REVIEW'].includes(r.status)).length },
          { id: 'PRICING_REVIEW', label: 'Pricing Review', icon: Clock, count: requests.filter(r => r.status === 'PRICING_REVIEW').length },
          { id: 'PENDING_APPROVAL', label: 'Pending Approval', icon: Clock, count: requests.filter(r => r.status === 'APPROVAL_PENDING').length },
          { id: 'REVISION_REQUIRED', label: 'Revision Required', icon: History, count: requests.filter(r => r.status === 'REVISION_REQUIRED').length },
          { id: 'PROCUREMENT_REVIEW', label: 'Procurement Review', icon: Search, count: requests.filter(isProcurementPending).length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-3 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id 
                ? 'bg-white dark:bg-[#1e2029] text-[var(--color-brand)] shadow-md border border-gray-100/50 dark:border-gray-800/50' 
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? 'bg-[var(--color-brand)] text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-gray-50 dark:bg-white/5 rounded-2xl animate-pulse border border-gray-100 dark:border-gray-800" />
          ))
        ) : getFilteredRequests().length > 0 ? (
          getFilteredRequests().map(request => (
            <RequestCard key={request.id} request={request} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400 bg-gray-50/50 dark:bg-white/5 rounded-[2rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
            <CheckCircle2 size={48} className="mb-4 opacity-20" />
            <p className="font-bold text-sm tracking-tight">No requests found in this category.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MasterDataQueue;
