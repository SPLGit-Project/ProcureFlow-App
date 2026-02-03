import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, CheckCircle, XCircle, Truck, Link as LinkIcon, Package, Calendar, User, FileText, Info, DollarSign, AlertTriangle, Shield } from 'lucide-react';
import { DeliveryHeader, POStatus } from '../types';
import DeliveryModal from './DeliveryModal';
import ConcurExportModal from './ConcurExportModal';
import { db } from '../services/db';
import { supabase } from '../lib/supabaseClient';
import { Save, Edit2 } from 'lucide-react';

const PODetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pos, suppliers, updatePOStatus, currentUser, hasPermission, addDelivery, linkConcurPO } = useApp();
  
  const [activeTab, setActiveTab] = useState<'LINES' | 'DELIVERIES' | 'HISTORY'>('LINES');
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [isConcurModalOpen, setIsConcurModalOpen] = useState(false);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [concurInput, setConcurInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  // Local state for edits
  const [headerEdits, setHeaderEdits] = useState({ clientName: '', reason: '', comments: '' });

  const po = pos.find(p => p.id === id);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const supplier = po ? suppliers.find(s => s.id === po.supplierId) : undefined;

  const timelineEvents = useMemo(() => {
    if (!po) return [];
    
    const events: Array<{
      id: string;
      date: Date;
      type: string;
      title: string;
      subtitle: string;
      description?: string;
      icon: any;
      colorClass: string;
    }> = [];

    // 1. Approval History
    po.approvalHistory.forEach((h, idx) => {
      let icon = FileText;
      let colorClass = 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
      let title = h.action;

      if (h.action === 'SUBMITTED') {
        icon = FileText;
        colorClass = 'bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20';
        title = 'Request Submitted';
      } else if (h.action === 'APPROVED') {
        icon = CheckCircle;
        colorClass = 'bg-green-100 text-green-600 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20';
        title = 'Request Approved';
      } else if (h.action === 'REJECTED') {
        icon = XCircle;
        colorClass = 'bg-red-100 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20';
        title = 'Request Rejected';
      }

      events.push({
        id: `auth-${idx}`,
        date: new Date(h.date),
        type: h.action,
        title,
        subtitle: `by ${h.approverName}`,
        description: h.comments,
        icon,
        colorClass
      });
    });

    // 2. Deliveries
    po.deliveries.forEach((d, idx) => {
      events.push({
        id: `del-${idx}`,
        date: new Date(d.date),
        type: 'DELIVERY',
        title: 'Goods Received',
        subtitle: `Docket: ${d.docketNumber} • Received by ${d.receivedBy}`,
        description: `Received ${d.lines.reduce((s,l)=>s+l.quantity,0)} items`,
        icon: Truck,
        colorClass: 'bg-indigo-100 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20'
      });
    });

    // 3. Capitalisation
    po.deliveries.forEach(d => {
      d.lines.forEach((l, idx) => {
        if (l.isCapitalised && l.capitalisedDate) {
          const poLine = po.lines.find(pl => pl.id === l.poLineId);
          events.push({
            id: `cap-${d.id}-${idx}`,
            date: new Date(l.capitalisedDate),
            type: 'CAPITALISATION',
            title: 'Asset Capitalised',
            subtitle: poLine ? poLine.itemName : 'Unknown Item',
            description: l.invoiceNumber ? `Invoice #${l.invoiceNumber}` : undefined,
            icon: DollarSign,
            colorClass: 'bg-purple-100 text-purple-600 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20'
          });
        }
      });
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [po]);

  if (!po) return <div className="p-8 text-gray-900 dark:text-white">PO Not Found</div>;

  const canApprove = hasPermission('approve_requests') && po.status === 'PENDING_APPROVAL';
  const canLinkConcur = (hasPermission('link_concur') || po.requesterId === currentUser?.id) && po.status === 'APPROVED_PENDING_CONCUR';
  const canReceive = (hasPermission('receive_goods') || po.requesterId === currentUser?.id) && (po.status === 'ACTIVE' || po.status === 'PARTIALLY_RECEIVED');

  const getStepStatus = (step: number) => {
      let currentStep = 1;
      if (po.status === 'PENDING_APPROVAL') currentStep = 1;
      if (po.status === 'APPROVED_PENDING_CONCUR') currentStep = 2;
      if (po.status === 'ACTIVE') currentStep = 3;
      if (po.status === 'PARTIALLY_RECEIVED') currentStep = 4;
      if (po.status === 'RECEIVED' || po.status === 'CLOSED') currentStep = 5;
      if (po.status === 'REJECTED') return step === 2 ? 'error' : step < 2 ? 'complete' : 'pending';
      if (po.status === 'VARIANCE_PENDING') return step === 4 ? 'warning' : step < 4 ? 'complete' : 'pending';

      if (step < currentStep) return 'complete';
      if (step === currentStep) return 'current';
      return 'pending';
  };

  const steps = [
      { num: 1, label: 'Requested' },
      { num: 2, label: 'Approved' },
      { num: 3, label: 'In Concur' },
      { num: 4, label: 'Delivered' },
      { num: 5, label: 'Complete' },
  ];

  const handleApproval = (approved: boolean) => {
      updatePOStatus(po.id, approved ? 'APPROVED_PENDING_CONCUR' : 'REJECTED', {
          id: `ev-${Date.now()}`,
          action: approved ? 'APPROVED' : 'REJECTED',
          approverName: currentUser.name,
          date: new Date().toISOString().split('T')[0],
          comments: approved ? 'Approved via web portal' : 'Rejected via web portal'
      });
  };

  const handleConcurLink = () => {
      if(!concurInput) return;
      linkConcurPO(po.id, concurInput);
      setIsConcurModalOpen(false);
  };

  const handleDeliverySubmit = (delivery: DeliveryHeader, closedLineIds: string[]) => {
      addDelivery(po.id, delivery, closedLineIds);
      setIsDeliveryModalOpen(false);
  };

  const handleStartEdit = () => {
       if (!po) return;
       setHeaderEdits({
           clientName: po.customerName || '',
           reason: po.reasonForRequest || '',
           comments: po.comments || ''
       });
       setIsEditing(true);
  };

  const handleSaveHeader = async () => {
       if (!po) return;
       try {
           await db.updatePODetails(po.id, {
               clientName: headerEdits.clientName,
               reasonForRequest: headerEdits.reason,
               comments: headerEdits.comments
           });
           setIsEditing(false);
           window.location.reload(); 
       } catch (err: any) {
           console.error(err);
           alert('Failed to save changes: ' + err.message);
       }
  };

  const handleUpdateDeliveryHeader = async (delId: string, field: string, val: string) => {
      try {
          const updates: any = {};
          if (field === 'docket') updates.docketNumber = val;
          if (field === 'date') updates.date = val;
          if (field === 'receivedBy') updates.receivedBy = val;
          
          await db.updateDeliveryHeader(delId, updates);
      } catch (e: any) {
          console.error(e);
          alert("Failed to update delivery: " + e.message);
      }
  };
  
  const handleUpdateInvoice = async (lineId: string, val: string) => {
      try {
           await db.updateDeliveryLineFinanceInfo(lineId, { invoiceNumber: val });
      } catch (e: any) {
           console.error(e);
      }
  };

  /* Side Effect: If forcing to RECEIVED/CLOSED and no deliveries exist, create dummy delivery so it appears in Finance Review */
  const ensureDeliveryRecord = async (targetStatus: string) => {
      // Only strictly relevant for statuses that imply goods receipt
      if (!['RECEIVED', 'CLOSED', 'PARTIALLY_RECEIVED'].includes(targetStatus)) return;
      if (!po || po.deliveries.length > 0) return;

      try {
          // 1. Create Header
          const docket = `ADMIN-FORCE-${new Date().toISOString().split('T')[0]}`;
          const { data: delHeader, error: delErr } = await supabase
              .from('deliveries')
              .insert({
                  po_request_id: po.id,
                  docket_number: docket,
                  date: new Date().toISOString(),
                  received_by: currentUser?.name || 'Admin',
              })
              .select()
              .single();

          if (delErr) throw delErr;

          // 2. Create Lines (Full Receipt)
          if (delHeader && po.lines.length > 0) {
              const linesToInsert = po.lines.map(l => ({
                  delivery_id: delHeader.id,
                  po_line_id: l.id,
                  quantity: l.quantityOrdered, // Assume full receipt
                  is_capitalised: false
              }));

              const { error: linesErr } = await supabase
                  .from('delivery_lines')
                  .insert(linesToInsert);
              
              if (linesErr) throw linesErr;
          }
      } catch (e) {
          console.error("Failed to auto-create delivery record", e);
          // Don't block the status update, just log
      }
  };

  const handleForceStatusUpdate = async (newStatus: string) => {
      if (!po) return;
      try {
            // Run side-effects first
            await ensureDeliveryRecord(newStatus);

            await updatePOStatus(po.id, newStatus as POStatus, {
                id: `admin-override-${Date.now()}`,
                action: 'ADMIN_OVERRIDE',
                approverName: currentUser?.name || 'Admin',
                date: new Date().toISOString().split('T')[0],
                comments: `Admin forced status to ${newStatus}`
            });
            setIsStatusModalOpen(false);
            // updatePOStatus triggers context reload, but slight delay might be needed or just let UI react
      } catch (e: any) {
          console.error(e);
          alert("Failed to update status: " + e.message);
      }
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-500 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors font-medium text-sm">
        <ArrowLeft size={16} className="mr-1" /> Back to List
      </button>

      {/* Header Info */}
      <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4 md:p-6 mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-6">
           <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{po.displayId || po.id}</h1>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border
                    ${po.status === 'ACTIVE' || po.status === 'RECEIVED' ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-500 border-green-200 dark:border-green-500/20' : 
                      po.status === 'PENDING_APPROVAL' ? 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 border-yellow-200 dark:border-yellow-500/20' :
                      po.status === 'APPROVED_PENDING_CONCUR' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-500 border-blue-200 dark:border-blue-500/20' : 
                      po.status === 'VARIANCE_PENDING' ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-500 border-amber-200 dark:border-amber-500/20' : 
                      po.status === 'REJECTED' ? 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-500 border-red-200 dark:border-red-500/20' : 'bg-gray-100 dark:bg-gray-700/30 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                    }`}>
                    {po.status === 'APPROVED_PENDING_CONCUR' ? 'Pending Concur Sync' : po.status.replace(/_/g, ' ')}
                  </span>
              </div>
               <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1">
                   <Calendar size={14}/> {new Date(po.requestDate).toLocaleDateString()} by <span className="text-gray-700 dark:text-gray-300 font-medium">{po.requesterName}</span>
               </p>
            </div>
            
            <div className="flex flex-wrap gap-3 w-full lg:w-auto">
               {/* Admin Edit Toggle */}
               {currentUser?.role === 'ADMIN' && (
                   !isEditing ? (
                       <button onClick={handleStartEdit} className="p-2.5 text-gray-500 hover:text-gray-900 border border-gray-200 rounded-xl hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors">
                           <Edit2 size={18} />
                       </button>
                   ) : (
                       <button onClick={handleSaveHeader} className="p-2.5 bg-green-600 text-white rounded-xl hover:bg-green-500 transition-colors shadow-sm">
                           <Save size={18} />
                       </button>
                   )
               )}
               {currentUser?.role === 'ADMIN' && (
                    <button onClick={() => setIsStatusModalOpen(true)} className="p-2.5 text-amber-600 hover:text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-500 dark:hover:text-amber-400 transition-colors" title="Admin: Force Status">
                        <Shield size={18} />
                    </button>
               )}
              {canApprove && (
                  <>
                    <button onClick={() => handleApproval(false)} className="flex-1 lg:flex-none justify-center px-4 py-2.5 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2 font-medium">
                        <XCircle size={18} /> Reject
                    </button>
                    <button onClick={() => handleApproval(true)} className="flex-1 lg:flex-none justify-center px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-500 flex items-center gap-2 shadow-lg shadow-green-600/20 font-medium">
                        <CheckCircle size={18} /> Approve
                    </button>
                  </>
              )}
               {po.status === 'APPROVED_PENDING_CONCUR' && (
                   <button onClick={() => setIsExportModalOpen(true)} className="w-full lg:w-auto justify-center px-4 py-2.5 bg-white dark:bg-white/10 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-white rounded-xl hover:bg-gray-50 dark:hover:bg-white/20 flex items-center gap-2 font-medium shadow-sm transition-all">
                       <FileText size={18} /> Details for Concur
                   </button>
               )}
              {canLinkConcur && (
                   <button onClick={() => setIsConcurModalOpen(true)} className="w-full lg:w-auto justify-center px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 flex items-center gap-2 shadow-lg shadow-indigo-600/20 animate-pulse font-medium">
                      <LinkIcon size={18} /> Link Concur PO
                   </button>
              )}
              {canReceive && (
                  <button onClick={() => setIsDeliveryModalOpen(true)} className="w-full lg:w-auto justify-center px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 flex items-center gap-2 shadow-lg shadow-blue-600/20 font-medium">
                      <Truck size={18} /> Record Delivery
                  </button>
              )}
              {po.status === 'VARIANCE_PENDING' && hasPermission('approve_requests') && (
                   <button onClick={() => updatePOStatus(po.id, 'RECEIVED', {
                       id: `ev-${Date.now()}`,
                       action: 'APPROVED',
                       approverName: currentUser?.name || 'Admin',
                       date: new Date().toISOString().split('T')[0],
                       comments: 'Variance Approved'
                   })} className="w-full lg:w-auto justify-center px-4 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 flex items-center gap-2 shadow-lg shadow-amber-500/20 font-medium animate-pulse">
                       <CheckCircle size={18} /> Approve Variance
                   </button>
              )}
           </div>
        </div>

        {/* Additional Request Details */}
        {(po.customerName || po.reasonForRequest || po.comments || isEditing) && (
            <div className="bg-gray-50 dark:bg-[#15171e] rounded-xl p-4 border border-gray-100 dark:border-gray-800 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex gap-3 items-start">
                    <div className="p-2 bg-gray-200 dark:bg-gray-800 rounded-lg text-gray-500"><User size={16}/></div>
                    <div className="w-full">
                        <p className="text-xs text-gray-500 uppercase font-bold">Customer</p>
                        {isEditing ? (
                            <input 
                                className="w-full mt-1 px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                value={headerEdits.clientName}
                                onChange={e => setHeaderEdits({...headerEdits, clientName: e.target.value})}
                            />
                        ) : (
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{po.customerName || '-'}</p>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 items-start">
                    <div className="p-2 bg-gray-200 dark:bg-gray-800 rounded-lg text-gray-500"><Info size={16}/></div>
                    <div className="w-full">
                        <p className="text-xs text-gray-500 uppercase font-bold">Reason</p>
                         {isEditing ? (
                            <input 
                                className="w-full mt-1 px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                value={headerEdits.reason}
                                onChange={e => setHeaderEdits({...headerEdits, reason: e.target.value})}
                            />
                        ) : (
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{po.reasonForRequest || '-'}</p>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 items-start md:col-span-1">
                    <div className="p-2 bg-gray-200 dark:bg-gray-800 rounded-lg text-gray-500"><FileText size={16}/></div>
                    <div className="w-full">
                        <p className="text-xs text-gray-500 uppercase font-bold">Comments</p>
                         {isEditing ? (
                            <textarea 
                                className="w-full mt-1 px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                rows={2}
                                value={headerEdits.comments}
                                onChange={e => setHeaderEdits({...headerEdits, comments: e.target.value})}
                            />
                        ) : (
                            <p className="text-sm text-gray-600 dark:text-gray-300 italic">{po.comments ? `"${po.comments}"` : '-'}</p>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Responsive Lifecycle Stepper */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-6 mb-6">
            <div className="overflow-x-auto pb-2 scrollbar-hide">
                <div className="flex items-center justify-between relative min-w-[500px] md:min-w-0">
                     <div className="absolute top-[14px] left-0 w-full h-[2px] bg-gray-100 dark:bg-gray-800 -z-10"></div>
                     
                     {steps.map((step, idx) => {
                         const status = getStepStatus(step.num);
                         return (
                             <div key={step.num} className="flex flex-col items-center px-4 bg-white dark:bg-[#1e2029]">
                                 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300
                                    ${status === 'complete' ? 'bg-green-500 border-green-500 text-white shadow-green-500/30 shadow-md' : 
                                      status === 'current' ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white shadow-[var(--color-brand)]/30 shadow-md scale-110' : 
                                      status === 'error' ? 'bg-red-500 border-red-500 text-white' :
                                      status === 'warning' ? 'bg-amber-500 border-amber-500 text-white shadow-amber-500/30 shadow-md' :
                                      'bg-white dark:bg-[#1e2029] border-gray-200 dark:border-gray-700 text-gray-400'
                                    }`}>
                                     {status === 'complete' ? <CheckCircle size={16}/> : status === 'warning' ? <AlertTriangle size={16}/> : step.num}
                                 </div>
                                 <span className={`text-xs mt-2 font-medium transition-colors ${status === 'pending' ? 'text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-white'}`}>{step.label}</span>
                             </div>
                         )
                     })}
                </div>
            </div>
        </div>
      </div>

      {/* Tabs and Tables */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-6 overflow-x-auto scrollbar-hide">
          <button onClick={() => setActiveTab('LINES')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'LINES' ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Order Lines</button>
          <button onClick={() => setActiveTab('DELIVERIES')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'DELIVERIES' ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Deliveries ({po.deliveries.length})</button>
          <button onClick={() => setActiveTab('HISTORY')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'HISTORY' ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>History</button>
      </div>
      
      <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden min-h-[300px]">
          {activeTab === 'LINES' && (
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                      <thead className="bg-gray-50 dark:bg-[#15171e] text-xs uppercase text-gray-500 font-bold border-b border-gray-200 dark:border-gray-800">
                          <tr>
                              <th className="px-6 py-4">Item Details</th>
                              <th className="px-6 py-4 text-center">Ordered</th>
                              <th className="px-6 py-4 text-center">Received</th>
                              <th className="px-6 py-4 text-right">Unit Price</th>
                              <th className="px-6 py-4 text-right">Total</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                          {po.lines.map(line => (
                              <tr key={line.id} className="hover:bg-gray-50 dark:hover:bg-[#2b2d3b] transition-colors">
                                  <td className="px-6 py-4">
                                      <div className="font-bold text-gray-900 dark:text-white">{line.itemName}</div>
                                      <div className="text-xs text-gray-500 font-mono mt-0.5">{line.sku}</div>
                                  </td>
                                  <td className="px-6 py-4 text-center font-medium text-gray-900 dark:text-white">{line.quantityOrdered}</td>
                                  <td className="px-6 py-4 text-center">
                                      <div className="flex flex-col items-center justify-center">
                                          <span className={line.quantityReceived >= line.quantityOrdered ? 'text-green-600 dark:text-green-500 font-bold' : 'text-gray-500'}>
                                              {line.quantityReceived}
                                          </span>
                                          {line.quantityReceived > line.quantityOrdered && (
                                              <span className="text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-500/20 mt-1 whitespace-nowrap">
                                                  +{line.quantityReceived - line.quantityOrdered} Over
                                              </span>
                                          )}
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 text-right">${line.unitPrice.toFixed(2)}</td>
                                  <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">${line.totalPrice.toLocaleString()}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}
          
          {activeTab === 'DELIVERIES' && (
               <div className="p-4 md:p-6 space-y-6">
                    {po.deliveries.length === 0 ? (
                        <div className="text-center text-gray-400 py-12 flex flex-col items-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                            <Package size={48} className="mb-2 opacity-20"/>
                            <p>No deliveries recorded yet.</p>
                        </div>
                    ) : (
                        po.deliveries.map(del => (
                            <div key={del.id} className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-gray-50 dark:bg-[#15171e] px-4 md:px-6 py-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 p-2 rounded-lg"><Truck size={18}/></div>
                                        <div>
                                            <span className="font-bold text-gray-900 dark:text-white block text-sm md:text-base">
                                                {isEditing ? (
                                                    <input 
                                                        className="px-1 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm"
                                                        defaultValue={del.docketNumber}
                                                        onBlur={(e) => handleUpdateDeliveryHeader(del.id, 'docket', e.target.value)}
                                                    />
                                                ) : del.docketNumber}
                                            </span>
                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                 {isEditing ? (
                                                    <>
                                                        <input 
                                                            type="date"
                                                            className="px-1 border rounded dark:bg-gray-800 dark:border-gray-700 w-24"
                                                            defaultValue={del.date.toString().split('T')[0]}
                                                             onBlur={(e) => handleUpdateDeliveryHeader(del.id, 'date', e.target.value)}
                                                        />
                                                        •
                                                        <input 
                                                            className="px-1 border rounded dark:bg-gray-800 dark:border-gray-700 w-24"
                                                            defaultValue={del.receivedBy}
                                                            onBlur={(e) => handleUpdateDeliveryHeader(del.id, 'receivedBy', e.target.value)}
                                                        />
                                                    </>
                                                 ) : (
                                                    `${del.date} • ${del.receivedBy}`
                                                 )}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 bg-white dark:bg-[#1e2029]">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-xs text-gray-500 text-left uppercase">
                                                <th className="pb-2 font-bold">Item</th>
                                                <th className="pb-2 text-right font-bold">Rec. Qty</th>
                                                <th className="pb-2 pl-4 font-bold hidden md:table-cell">Invoice</th>
                                                <th className="pb-2 text-center font-bold hidden md:table-cell">Capitalised</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {del.lines.map(dLine => {
                                                const poLine = po.lines.find(l => l.id === dLine.poLineId);
                                                return (
                                                    <tr key={dLine.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                                                        <td className="py-3 text-gray-700 dark:text-gray-300 font-medium">{poLine?.itemName}</td>
                                                        <td className="py-3 text-right font-bold text-gray-900 dark:text-white">{dLine.quantity}</td>
                                                        
                                                        {/* Invoice - Read Only */}
                                                        <td className="py-3 pl-4 hidden md:table-cell">
                                                            {isEditing ? (
                                                                <input 
                                                                    className="w-24 px-1 py-0.5 text-xs border rounded bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                                                    defaultValue={dLine.invoiceNumber || ''}
                                                                    onBlur={(e) => handleUpdateInvoice(dLine.id, e.target.value)}
                                                                    placeholder="Inv #"
                                                                />
                                                            ) : (
                                                                <span className="text-gray-700 dark:text-gray-300 font-mono text-xs bg-gray-100 dark:bg-white/5 px-2 py-1 rounded">
                                                                    {dLine.invoiceNumber || '-'}
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* Capitalisation - Read Only */}
                                                        <td className="py-3 text-center hidden md:table-cell">
                                                             {dLine.isCapitalised ? (
                                                                <div className="flex flex-col items-center">
                                                                    <span className="text-green-600 dark:text-green-500 font-bold text-xs bg-green-50 dark:bg-green-500/10 px-2 py-0.5 rounded border border-green-200 dark:border-green-500/20">
                                                                        YES
                                                                    </span>
                                                                    {dLine.capitalisedDate && <span className="text-[10px] text-gray-400 mt-0.5">{dLine.capitalisedDate}</span>}
                                                                </div>
                                                             ) : (
                                                                <span className="text-gray-400 text-xs">NO</span>
                                                             )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    )}
               </div>
          )}
          
          {activeTab === 'HISTORY' && (
              <div className="p-6">
                   <div className="relative border-l-2 border-gray-100 dark:border-gray-800 ml-4 space-y-8 my-4">
                    {timelineEvents.map((event, idx) => (
                        <div key={event.id} className="relative pl-8 group">
                            {/* Icon Marker */}
                            <div className={`absolute -left-[20px] top-0 p-2 rounded-full border-4 border-white dark:border-[#1e2029] ${event.colorClass} shadow-sm z-10`}>
                                <event.icon size={16} />
                            </div>

                            <div className="ml-4">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                                    <p className="font-bold text-gray-900 dark:text-white text-sm">{event.title}</p>
                                    <span className="hidden sm:inline text-gray-300 dark:text-gray-600">•</span>
                                    <p className="text-xs text-gray-500 font-mono">{event.date.toLocaleDateString()}</p>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-300">{event.subtitle}</p>
                                {event.description && (
                                    <div className="mt-2 bg-gray-50 dark:bg-[#15171e] p-3 rounded-xl text-sm text-gray-600 dark:text-gray-400 italic border border-gray-100 dark:border-gray-700 inline-block">
                                        "{event.description}"
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {timelineEvents.length === 0 && (
                        <div className="text-gray-500 text-sm italic pl-8">No history recorded.</div>
                    )}
                </div>
              </div>
          )}
      </div>

      {isDeliveryModalOpen && (
          <DeliveryModal 
            po={po} 
            onClose={() => setIsDeliveryModalOpen(false)} 
            onSubmit={handleDeliverySubmit} 
            currentUser={currentUser}
          />
      )}

      {isConcurModalOpen && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-800 transform transition-all scale-100">
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Link Concur PO</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Enter the SAP Concur PO Number to synchronize.
                    </p>
                </div>
                <input 
                    type="text" 
                    autoFocus
                    placeholder="e.g. PO-88123"
                    className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-300 dark:border-gray-700 rounded-xl p-3 mb-6 focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)] outline-none text-gray-900 dark:text-white"
                    value={concurInput}
                    onChange={e => setConcurInput(e.target.value)}
                />
                <div className="flex justify-end gap-3">
                    <button onClick={() => setIsConcurModalOpen(false)} className="px-4 py-2.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg font-medium">Cancel</button>
                    <button onClick={handleConcurLink} disabled={!concurInput} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-50 font-bold shadow-lg shadow-indigo-500/20">Sync & Activate</button>
                </div>
            </div>
        </div>
      )}

      {isExportModalOpen && (
          <ConcurExportModal po={po} onClose={() => setIsExportModalOpen(false)} />
      )}

      {isStatusModalOpen && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl max-w-sm w-full p-6 border border-gray-200 dark:border-gray-800">
                <div className="mb-4">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Shield size={20} className="text-amber-500"/> Force Status Update
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                        Override the current workflow state.
                    </p>
                </div>
                
                <div className="space-y-2 mb-6">
                    {['PENDING_APPROVAL', 'APPROVED_PENDING_CONCUR', 'ACTIVE', 'RECEIVED', 'CLOSED', 'REJECTED'].map(s => (
                        <button 
                            key={s}
                            onClick={() => handleForceStatusUpdate(s)}
                            className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                ${po.status === s ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-500/30' : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'}
                            `}
                        >
                            {s}
                        </button>
                    ))}
                </div>

                <div className="flex justify-end">
                    <button onClick={() => setIsStatusModalOpen(false)} className="px-4 py-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-medium text-sm">Cancel</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default PODetail;
