import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Clock, AlertCircle, FileText,
  User, Tag, Layers, ExternalLink, Trash2
} from 'lucide-react';
import { getItemRequest, deleteItemRequest } from '../services/itemRequestService';
import { generateItemCode } from '../utils/itemNameGenerator';
import { ItemRequest } from '../types';
import { useApp } from '../context/AppContext';
import { PriceHistoryPanel } from './PriceHistoryPanel';
import { PublicationGate } from './PublicationGate';
import { PublicationStatusPanel } from './PublicationStatusPanel';
import WorkflowLifecycle from './WorkflowLifecycle';


const ItemRequestDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<ItemRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'workflow' | 'history'>('workflow');
  const { currentUser } = useApp();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);


  useEffect(() => {
    if (id) {
      fetchRequest();
    }
  }, [id]);

  const fetchRequest = async () => {
    setLoading(true);
    try {
      const data = await getItemRequest(id!);
      if (data) {
        setRequest(data);
      } else {
        setError('Request not found');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch request');
    } finally {
      setLoading(false);
    }
  };

  const handleActionComplete = () => {
    fetchRequest();
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await deleteItemRequest(id);
      // Redirect based on role: admins to the master queue, users to their own requests
      if (currentUser?.role === 'ADMIN') {
        navigate('/items/master-data-queue');
      } else {
        navigate('/items/my-requests');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete request');
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center animate-pulse">
        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full mb-4"></div>
        <div className="h-4 w-48 bg-gray-200 dark:bg-gray-800 rounded mb-2"></div>
        <div className="h-3 w-32 bg-gray-100 dark:bg-gray-900 rounded"></div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Error</h2>
        <p className="text-gray-500 mb-6">{error || 'Something went wrong'}</p>
        <button onClick={() => navigate(-1)} className="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold">
          Go Back
        </button>
      </div>
    );
  }

  const canDelete = currentUser?.role === 'ADMIN' || (
    currentUser?.id === request.requestor_id && 
    !['APPROVED', 'PUBLISHING', 'PARTIALLY_PUBLISHED', 'FULLY_PUBLISHED', 'ACTIVE'].includes(request.status)
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 pb-24">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors group"
        >
          <div className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-800 flex items-center justify-center group-hover:border-gray-900 dark:group-hover:border-white transition-all">
            <ArrowLeft size={16} />
          </div>
          Back
        </button>
        
        <div className="flex items-center gap-3">
          {canDelete && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors mr-2 shadow-sm"
            >
              <Trash2 size={12} />
              Delete Request
            </button>
          )}
          <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
            request.status === 'APPROVED' ? 'bg-green-100 text-green-700 border-green-200' :
            request.status === 'REJECTED' ? 'bg-red-100 text-red-700 border-red-200' :
            'bg-[var(--color-brand)]/10 text-[var(--color-brand)] border-[var(--color-brand)]/20'
          }`}>
            {request.status.replace('_', ' ')}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Priority</p>
            <p className={`text-xs font-bold ${request.is_urgent ? 'text-red-500' : 'text-green-500'}`}>
              {request.is_urgent ? 'URGENT' : 'STANDARD'}
            </p>
          </div>
        </div>
      </div>

      {/* Hero Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2 font-mono">
              {generateItemCode(request.item_description)}
            </h1>
            <p className="text-xl text-gray-500 font-medium">{request.item_description}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-nocturne rounded-2xl border border-gray-100 dark:border-gray-800">
              <User size={14} className="text-[var(--color-brand)] mb-2" />
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Requester</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">User ID: {request.requestor_id.substring(0, 8)}</p>
            </div>
            <div className="p-4 bg-white dark:bg-nocturne rounded-2xl border border-gray-100 dark:border-gray-800">
              <Tag size={14} className="text-[var(--color-brand)] mb-2" />
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{request.request_type.replace('_', ' ')}</p>
            </div>
            <div className="p-4 bg-white dark:bg-nocturne rounded-2xl border border-gray-100 dark:border-gray-800">
              <Clock size={14} className="text-[var(--color-brand)] mb-2" />
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Submitted</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {request.submitted_at ? new Date(request.submitted_at).toLocaleDateString() : 'Draft'}
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-nocturne rounded-2xl border border-gray-100 dark:border-gray-800">
              <Layers size={14} className="text-[var(--color-brand)] mb-2" />
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Target Systems</p>
              <div className="flex gap-1 mt-1">
                {request.target_sap && <span className="w-2 h-2 rounded-full bg-blue-500" title="SAP"></span>}
                {request.target_salesforce && <span className="w-2 h-2 rounded-full bg-cyan-500" title="Salesforce"></span>}
                {request.target_bundle && <span className="w-2 h-2 rounded-full bg-indigo-500" title="Bundle"></span>}
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-[#15171e] p-6 rounded-2xl border border-gray-200 dark:border-gray-800">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Business Reason</h4>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{request.business_reason}</p>
          </div>
        </div>

        <div className="space-y-6">
          <WorkflowLifecycle
            status={request.status}
            requestId={request.id}
            userRole={currentUser?.role}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('workflow')}
          className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === 'workflow'
              ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
              : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
          }`}
        >
          Workflow Stage
        </button>
        {request.resulting_item_id && (
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
              activeTab === 'history'
                ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
            }`}
          >
            Price History
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="animate-slide-up">
        {activeTab === 'history' ? (
          <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm">
             <PriceHistoryPanel itemId={request.resulting_item_id || request.id} />
          </div>
        ) : (
          <>
          <div className="space-y-8">
            {request.status === 'DUPLICATE_REVIEW' ? (
              <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-gray-800 p-10 text-center space-y-4">
                <div className="w-14 h-14 bg-[var(--color-brand)]/10 rounded-2xl flex items-center justify-center mx-auto text-[var(--color-brand)]">
                  <ExternalLink size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Duplicate Check Wizard</h3>
                  <p className="text-gray-500 max-w-md mx-auto mt-2">
                    Duplicate verification now runs in a dedicated guided wizard so the outcome is recorded consistently.
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/items/requests/${request.id}/duplicate-check`)}
                  className="px-6 py-3 rounded-xl bg-[var(--color-brand)] text-white text-xs font-black uppercase tracking-widest"
                >
                  Open Duplicate Check
                </button>
              </div>
            ) : request.status === 'DATA_REVIEW' ? (
              <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-gray-800 p-10 text-center space-y-4">
                <div className="w-14 h-14 bg-[var(--color-brand)]/10 rounded-2xl flex items-center justify-center mx-auto text-[var(--color-brand)]">
                  <ExternalLink size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Item Definition Wizard</h3>
                  <p className="text-gray-500 max-w-md mx-auto mt-2">
                    Master data definition has moved out of this detail page into the sequential wizard flow.
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/items/requests/${request.id}/define`)}
                  className="px-6 py-3 rounded-xl bg-[var(--color-brand)] text-white text-xs font-black uppercase tracking-widest"
                >
                  Open Item Definition
                </button>
              </div>
            ) : request.status === 'PRICING_REVIEW' ? (
              <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-gray-800 p-10 text-center space-y-4">
                <div className="w-14 h-14 bg-[var(--color-brand)]/10 rounded-2xl flex items-center justify-center mx-auto text-[var(--color-brand)]">
                  <ExternalLink size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Pricing Setup Wizard</h3>
                  <p className="text-gray-500 max-w-md mx-auto mt-2">
                    Pricing now runs in a dedicated guided wizard before the request moves to final approval.
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/items/requests/${request.id}/pricing`)}
                  className="px-6 py-3 rounded-xl bg-[var(--color-brand)] text-white text-xs font-black uppercase tracking-widest"
                >
                  Open Pricing Setup
                </button>
              </div>
            ) : request.status === 'APPROVAL_PENDING' ? (
              <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-gray-800 p-10 text-center space-y-4">
                <div className="w-14 h-14 bg-[var(--color-brand)]/10 rounded-2xl flex items-center justify-center mx-auto text-[var(--color-brand)]">
                  <ExternalLink size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Approval Review Wizard</h3>
                  <p className="text-gray-500 max-w-md mx-auto mt-2">
                    Approval decisions now run in a dedicated guided wizard with request, definition, pricing, and decision steps.
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/items/requests/${request.id}/approve`)}
                  className="px-6 py-3 rounded-xl bg-[var(--color-brand)] text-white text-xs font-black uppercase tracking-widest"
                >
                  Open Approval Review
                </button>
              </div>
            ) : request.status === 'APPROVED' ? (
              <div className="space-y-8">
                <PublicationGate 
                  itemId={request.resulting_item_id!} 
                  requestId={request.id} 
                  onPublished={handleActionComplete} 
                />
              </div>
            ) : request.status === 'ACTIVE' ? (
              <div className="space-y-8">
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 p-6 rounded-2xl flex items-center gap-4 text-green-700">
                  <CheckCircle2 size={32} />
                  <div>
                    <h3 className="text-xl font-bold">Item Is Active</h3>
                    <p className="text-sm opacity-80">This item request has been fully authorized and published to downstream systems.</p>
                  </div>
                </div>
                <PublicationStatusPanel itemId={request.resulting_item_id!} />
              </div>
            ) : (
              <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-gray-800 p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto text-gray-300">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Workflow Stage: {request.status.replace('_', ' ')}</h3>
                  <p className="text-gray-500 max-w-md mx-auto mt-2">
                    This request is currently in the {request.status.toLowerCase().replace('_', ' ')} stage.
                    Full read-only summary and audit trail will be rendered here in the next update.
                  </p>
                </div>
                <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                    <div className="p-4 bg-gray-50 dark:bg-[#15171e] rounded-xl border border-gray-200 dark:border-gray-800 text-left">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Duplicate Outcome</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">Verified — No Duplicate</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-[#15171e] rounded-xl border border-gray-200 dark:border-gray-800 text-left">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Technical Definition</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{request.resulting_item_id ? 'Completed' : 'Pending'}</p>
                    </div>
                </div>
              </div>
            )}
          </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-nocturne rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-2xl flex items-center justify-center mb-6">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">Confirm Hard Delete</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
              This will <span className="font-bold text-red-600">permanently remove</span> this request and all its associated audit logs, approval decisions, and pricing drafts from the database. 
              <br/><br/>
              This action cannot be undone. Are you absolutely sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-black uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-6 py-3 rounded-xl bg-red-600 text-white text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 size={14} />
                    Confirm Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default ItemRequestDetail;
