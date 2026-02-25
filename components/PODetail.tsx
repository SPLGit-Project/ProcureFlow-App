import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.tsx';
import { ArrowLeft, CheckCircle, XCircle, Truck, Link as LinkIcon, Package, Calendar, User, FileText, Info, DollarSign, AlertTriangle, Shield, Edit2, Save, Building, LucideIcon, Plus, Trash2, Search } from 'lucide-react';
import { DeliveryHeader, Item, POStatus, POLineItem } from '../types.ts';
import DeliveryModal from './DeliveryModal.tsx';
import ConcurExportModal from './ConcurExportModal.tsx';
import { db } from '../services/db.ts';
import { supabase } from '../lib/supabaseClient.ts';
import { v4 as uuidv4 } from 'uuid';
import { getDefaultItemPriceOption, normalizeItemPriceOptions } from '../utils/itemPricing';



const PODetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pos, suppliers, items, updatePOStatus, updatePendingPO, currentUser, hasPermission, addDelivery, linkConcurPO, reloadData, deletePO } = useApp();
  
  const [activeTab, setActiveTab] = useState<'LINES' | 'DELIVERIES' | 'HISTORY'>('LINES');
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [isConcurModalOpen, setIsConcurModalOpen] = useState(false);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isDeletingRequest, setIsDeletingRequest] = useState(false);
  const [concurInput, setConcurInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  // Local state for edits
  const [headerEdits, setHeaderEdits] = useState({ clientName: '', reason: 'Depletion', comments: '' });
  const [editableLines, setEditableLines] = useState<POLineItem[]>([]);
  const [addItemId, setAddItemId] = useState('');
  const [addItemQty, setAddItemQty] = useState('1');
  const [addItemPrice, setAddItemPrice] = useState('0');
  const [addItemPriceOptionId, setAddItemPriceOptionId] = useState('');
  const [addItemSearch, setAddItemSearch] = useState('');
  const [isAddItemPickerOpen, setIsAddItemPickerOpen] = useState(false);
  const [activeAddItemIndex, setActiveAddItemIndex] = useState(0);
  const addItemPickerRef = useRef<HTMLDivElement>(null);

  const po = pos.find(p => p.id === id);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _supplier = po ? suppliers.find(s => s.id === po.supplierId) : undefined;

  const canEditPendingRequest = Boolean(
    po &&
    po.status === 'PENDING_APPROVAL' &&
    currentUser &&
    (currentUser.id === po.requesterId || currentUser.role === 'ADMIN')
  );

  const addableItems = useMemo(() => {
    const activeItems = (items || []).filter(item => item.activeFlag !== false);
    const existingItemIds = new Set((isEditing ? editableLines : po?.lines || []).map(line => line.itemId));
    return activeItems.filter(item => item.id && !existingItemIds.has(item.id));
  }, [items, isEditing, editableLines, po?.lines]);

  const selectedAddItem = useMemo(
    () => addableItems.find(item => item.id === addItemId),
    [addableItems, addItemId]
  );
  const selectedAddItemPriceOptions = useMemo(
    () => selectedAddItem ? normalizeItemPriceOptions(selectedAddItem) : [],
    [selectedAddItem]
  );

  const filteredAddableItems = useMemo(() => {
    const normalizedSearch = addItemSearch.trim().toLowerCase();
    const tokens = normalizedSearch.split(/\s+/).filter(Boolean);
    const ranked = addableItems
      .map(item => {
        const sku = (item.sku || '').toLowerCase();
        const name = (item.name || '').toLowerCase();
        const category = (item.category || '').toLowerCase();
        const subCategory = (item.subCategory || '').toLowerCase();
        const haystack = `${sku} ${name} ${category} ${subCategory}`.trim();

        if (!normalizedSearch) {
          return { item, score: 1 };
        }

        if (tokens.length > 0 && !tokens.every(token => haystack.includes(token))) {
          return { item, score: -1 };
        }

        let score = 0;
        if (sku === normalizedSearch) score += 130;
        if (sku.startsWith(normalizedSearch)) score += 95;
        if (name.startsWith(normalizedSearch)) score += 80;
        if (haystack.includes(normalizedSearch)) score += 40;
        tokens.forEach(token => {
          if (sku.includes(token)) score += 12;
          if (name.includes(token)) score += 8;
          if (category.includes(token) || subCategory.includes(token)) score += 4;
        });
        return { item, score };
      })
      .filter(entry => entry.score >= 0)
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        const nameCompare = (a.item.name || '').localeCompare(b.item.name || '');
        if (nameCompare !== 0) return nameCompare;
        return (a.item.sku || '').localeCompare(b.item.sku || '');
      });

    return ranked.map(entry => entry.item);
  }, [addableItems, addItemSearch]);

  const visibleAddableItems = useMemo(() => filteredAddableItems.slice(0, 60), [filteredAddableItems]);

  const applyAddItemSelection = (selectedItem: Item) => {
    if (!selectedItem?.id) return;
    setAddItemId(selectedItem.id);
    const defaultPriceOption = getDefaultItemPriceOption(selectedItem);
    setAddItemPriceOptionId(defaultPriceOption.id);
    setAddItemPrice(String(defaultPriceOption.price));
    setAddItemSearch('');
    setIsAddItemPickerOpen(false);
    setActiveAddItemIndex(0);
  };

  const handleAddItemSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsAddItemPickerOpen(false);
      return;
    }

    if (!isAddItemPickerOpen && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      setIsAddItemPickerOpen(true);
      event.preventDefault();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveAddItemIndex(prev => Math.min(prev + 1, Math.max(visibleAddableItems.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveAddItemIndex(prev => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const selectedFromKeyboard = visibleAddableItems[activeAddItemIndex] || visibleAddableItems[0];
      if (selectedFromKeyboard) {
        applyAddItemSelection(selectedFromKeyboard);
      }
    }
  };

  useEffect(() => {
    if (!isEditing) return;
    if (addItemId && addableItems.some(item => item.id === addItemId)) return;
    if (addableItems.length === 0) {
      setAddItemId('');
      setAddItemPriceOptionId('');
      setAddItemPrice('0');
      setAddItemSearch('');
      return;
    }

    const firstItem = addableItems[0];
    const defaultPriceOption = getDefaultItemPriceOption(firstItem);
    setAddItemId(firstItem.id);
    setAddItemPriceOptionId(defaultPriceOption.id);
    setAddItemPrice(String(defaultPriceOption.price));
    setAddItemSearch('');
  }, [isEditing, addableItems, addItemId]);

  useEffect(() => {
    if (!isEditing) {
      setIsAddItemPickerOpen(false);
      setAddItemSearch('');
      setActiveAddItemIndex(0);
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isAddItemPickerOpen) return;
    setActiveAddItemIndex(prev => Math.min(prev, Math.max(visibleAddableItems.length - 1, 0)));
  }, [isAddItemPickerOpen, visibleAddableItems.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addItemPickerRef.current && !addItemPickerRef.current.contains(event.target as Node)) {
        setIsAddItemPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const timelineEvents = useMemo(() => {
    if (!po) return [];
    
    const events: Array<{
      id: string;
      date: Date;
      type: string;
      title: string;
      subtitle: string;
      description?: string;
      icon: LucideIcon;
      colorClass: string;
    }> = [];

    // 1. Approval History
    po.approvalHistory.forEach((h, idx) => {
      let icon = FileText;
      let colorClass = 'bg-gray-100 text-secondary border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
      let title: string = h.action;

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

  if (!po) return <div className="p-8 text-primary dark:text-white">PO Not Found</div>;

  const canApprove = hasPermission('approve_requests') && po.status === 'PENDING_APPROVAL';
  const canLinkConcur = (hasPermission('link_concur') || po.requesterId === currentUser?.id) && po.status === 'APPROVED_PENDING_CONCUR';
  const canReceive = (hasPermission('receive_goods') || po.requesterId === currentUser?.id) && (po.status === 'ACTIVE' || po.status === 'PARTIALLY_RECEIVED' || po.status === 'RECEIVED' || po.status === 'VARIANCE_PENDING');
  const canClose = (hasPermission('receive_goods') || po.requesterId === currentUser?.id) && (po.status === 'ACTIVE' || po.status === 'PARTIALLY_RECEIVED' || po.status === 'RECEIVED');
  const canDeletePendingRequest = canEditPendingRequest;
  const linesInView = isEditing ? editableLines : po.lines;


  const getStepStatus = (step: number) => {
      let currentStep = 1;
      if (po.status === 'PENDING_APPROVAL') currentStep = 1;
      if (po.status === 'APPROVED_PENDING_CONCUR') currentStep = 2;
      if (po.status === 'ACTIVE') currentStep = 3;
      if (po.status === 'PARTIALLY_RECEIVED') currentStep = 4;
      if (po.status === 'RECEIVED') currentStep = 5;
      if (po.status === 'CLOSED') currentStep = 6;

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
      { num: 5, label: 'Full' },
      { num: 6, label: 'Complete' },
  ];


  const handleApproval = (approved: boolean) => {
      updatePOStatus(po.id, approved ? 'APPROVED_PENDING_CONCUR' : 'REJECTED', {
          id: `ev-${Date.now()}`,
          action: approved ? 'APPROVED' : 'REJECTED',
          approverName: currentUser?.name || 'Unknown',

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

  const handleCompletePO = async () => {
      if (!globalThis.confirm('Are you sure you want to mark this order as complete? This will finalize all lines and move it to history.')) return;
      
      await updatePOStatus(po.id, 'CLOSED', {
          id: uuidv4(),
          action: 'ADMIN_OVERRIDE', // Or add 'COMPLETED' action? Types say 'ADMIN_OVERRIDE' is available
          approverName: currentUser?.name || 'User',
          date: new Date().toISOString().split('T')[0],
          comments: 'Order marked as complete by user'
      });
  };


  const handleStartEdit = () => {
       if (!po || !canEditPendingRequest) return;
        setHeaderEdits({
            clientName: po.customerName || '',
            reason: po.reasonForRequest || 'Depletion',
            comments: po.comments || ''
        });
        setEditableLines(po.lines.map(line => ({ ...line })));
        setAddItemId('');
        setAddItemPriceOptionId('');
        setAddItemQty('1');
        setAddItemPrice('0');
        setAddItemSearch('');
        setIsAddItemPickerOpen(false);
        setActiveAddItemIndex(0);
        setIsEditing(true);
  };

  const handleCancelEdit = () => {
      setIsEditing(false);
      setEditableLines([]);
      setAddItemId('');
      setAddItemPriceOptionId('');
      setAddItemQty('1');
      setAddItemPrice('0');
      setAddItemSearch('');
      setIsAddItemPickerOpen(false);
      setActiveAddItemIndex(0);
  };

  const handleLineQtyChange = (lineId: string, rawValue: string) => {
      const parsed = Math.max(1, Math.floor(Number(rawValue) || 0));
      setEditableLines(prev => prev.map(line => {
          if (line.id !== lineId) return line;
          return {
              ...line,
              quantityOrdered: parsed,
              totalPrice: Number((parsed * line.unitPrice).toFixed(2))
          };
      }));
  };

  const handleLinePriceChange = (lineId: string, rawValue: string) => {
      const parsed = Math.max(0, Number(rawValue) || 0);
      setEditableLines(prev => prev.map(line => {
          if (line.id !== lineId) return line;
          return {
              ...line,
              unitPrice: parsed,
              totalPrice: Number((line.quantityOrdered * parsed).toFixed(2))
          };
      }));
  };

  const handleRemoveDraftLine = (lineId: string) => {
      setEditableLines(prev => prev.filter(line => line.id !== lineId));
  };

  const handleAddDraftLine = () => {
      const selectedItem =
          addableItems.find(item => item.id === addItemId) ||
          (items || []).find(item => item.id === addItemId && item.activeFlag !== false);
      if (!selectedItem) {
          alert('Please select an active item to add.');
          return;
      }

      const quantityOrdered = Math.max(1, Math.floor(Number(addItemQty) || 0));
      const unitPrice = Math.max(0, Number(addItemPrice) || 0);
      const selectedPriceOption = normalizeItemPriceOptions(selectedItem).find(opt => opt.id === addItemPriceOptionId);

      const newLine: POLineItem = {
          id: uuidv4(),
          itemId: selectedItem.id,
          itemName: selectedItem.name,
          sku: selectedItem.sku,
          quantityOrdered,
          quantityReceived: 0,
          unitPrice,
          totalPrice: Number((quantityOrdered * unitPrice).toFixed(2)),
          priceOptionId: selectedPriceOption?.id,
          priceOptionLabel: selectedPriceOption?.label
      };

      setEditableLines(prev => [...prev, newLine]);
      setAddItemId('');
      setAddItemPriceOptionId('');
      setAddItemQty('1');
      setAddItemPrice('0');
      setAddItemSearch('');
      setIsAddItemPickerOpen(false);
      setActiveAddItemIndex(0);
  };

  const handleSavePendingEdits = async () => {
       if (!po) return;
        try {
            const validReason = (['Depletion', 'New Customer', 'Other'] as const).includes(headerEdits.reason as 'Depletion' | 'New Customer' | 'Other')
                ? (headerEdits.reason as 'Depletion' | 'New Customer' | 'Other')
                : 'Depletion';

            await updatePendingPO(po.id, {
                customerName: headerEdits.clientName,
                reasonForRequest: validReason,
                comments: headerEdits.comments,
                lines: editableLines
            });
            setIsEditing(false);
            setEditableLines([]);
            await reloadData(true);
       } catch (err: unknown) {
           console.error(err);
           alert('Failed to save changes: ' + (err as Error).message);
       }
  };

  const handleUpdateDeliveryHeader = async (delId: string, field: string, val: string) => {
      try {
          const updates: Partial<DeliveryHeader> = {};
          if (field === 'docket') updates.docketNumber = val;
          if (field === 'date') updates.date = val;
          if (field === 'receivedBy') updates.receivedBy = val;
          
          await db.updateDeliveryHeader(delId, updates);
      } catch (e: unknown) {
          console.error(e);
          alert("Failed to update delivery: " + (e as Error).message);
      }
  };
  
  const handleUpdateInvoice = async (lineId: string, val: string) => {
      try {
           await db.updateDeliveryLineFinanceInfo(lineId, { invoiceNumber: val });
      } catch (e: unknown) {
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
      } catch (e: unknown) {
          console.error(e);
          alert("Failed to update status: " + (e as Error).message);
      }
  };

  const handleDeletePO = async () => {
      if (!po) return;
      const isAdmin = currentUser?.role === 'ADMIN';
      if (!isAdmin && !canDeletePendingRequest) {
          alert('Only the requester can delete while pending approval.');
          return;
      }

      if (!globalThis.confirm(`ARE YOU SURE? \n\nThis will permanently delete PO ${po.displayId || po.id} and all associated data (lines, deliveries, approvals). This action cannot be undone.`)) return;
      
      try {
          setIsDeletingRequest(true);
          const deletedRef = po.displayId || po.id;
          await deletePO(po.id);
          navigate('/requests', {
              replace: true,
              state: {
                  deletedRequest: {
                      id: po.id,
                      displayId: deletedRef
                  }
              }
          });
      } catch (e: unknown) {
          console.error(e);
          alert("Failed to delete PO: " + (e as Error).message);
      } finally {
          setIsDeletingRequest(false);
      }
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <button type="button" onClick={() => navigate(-1)} className="flex items-center text-secondary hover:text-primary dark:hover:text-white mb-6 transition-colors font-medium text-sm">
        <ArrowLeft size={16} className="mr-1" /> Back to List
      </button>

      {/* Header Info */}
      <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4 md:p-6 mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-6">
           <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-primary dark:text-white">{po.displayId || po.id}</h1>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border
                    ${po.status === 'ACTIVE' || po.status === 'RECEIVED' ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-500 border-green-200 dark:border-green-500/20' : 
                      po.status === 'PENDING_APPROVAL' ? 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 border-yellow-200 dark:border-yellow-500/20' :
                      po.status === 'APPROVED_PENDING_CONCUR' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-500 border-blue-200 dark:border-blue-500/20' : 
                      po.status === 'VARIANCE_PENDING' ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-500 border-amber-200 dark:border-amber-500/20' : 
                      po.status === 'REJECTED' ? 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-500 border-red-200 dark:border-red-500/20' : 'bg-gray-100 dark:bg-gray-700/30 text-secondary dark:text-gray-400 border-gray-200 dark:border-gray-700'
                    }`}>
                    {po.status === 'APPROVED_PENDING_CONCUR' ? 'Pending Concur Sync' : po.status.replace(/_/g, ' ')}
                  </span>
              </div>
               <p className="text-secondary dark:text-gray-400 text-sm flex items-center gap-1">
                   <Calendar size={14}/> {new Date(po.requestDate).toLocaleDateString()} by <span className="text-primary dark:text-gray-300 font-medium">{po.requesterName}</span>
               </p>
            </div>
            
            <div className="flex flex-wrap gap-3 w-full lg:w-auto">
               {canEditPendingRequest && (
                   !isEditing ? (
                       <button type="button" onClick={handleStartEdit} className="p-2.5 text-secondary hover:text-primary border border-gray-200 rounded-xl hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors" title="Edit pending request">
                           <Edit2 size={18} />
                       </button>
                   ) : (
                       <>
                       <button type="button" onClick={handleSavePendingEdits} className="p-2.5 bg-green-600 text-white rounded-xl hover:bg-green-500 transition-colors shadow-sm" title="Save pending request changes">
                           <Save size={18} />
                       </button>
                       <button type="button" onClick={handleCancelEdit} className="p-2.5 text-secondary hover:text-primary border border-gray-200 rounded-xl hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors" title="Cancel edit">
                           <XCircle size={18} />
                       </button>
                       </>
                   )
               )}
               {canDeletePendingRequest && !isEditing && (
                    <button type="button" onClick={handleDeletePO} className="p-2.5 text-red-600 hover:text-red-700 border border-red-200 rounded-xl hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:text-red-300 transition-colors" title="Delete pending request">
                        <Trash2 size={18} />
                    </button>
               )}
               {currentUser?.role === 'ADMIN' && (
                    <button type="button" onClick={() => setIsStatusModalOpen(true)} className="p-2.5 text-amber-600 hover:text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-500 dark:hover:text-amber-400 transition-colors" title="Admin: Force Status">
                        <Shield size={18} />
                    </button>
               )}
              {canApprove && (
                  <>
                    <button type="button" onClick={() => handleApproval(false)} className="flex-1 lg:flex-none justify-center px-4 py-2.5 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2 font-medium">
                        <XCircle size={18} /> Reject
                    </button>
                    <button type="button" onClick={() => handleApproval(true)} className="flex-1 lg:flex-none justify-center px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-500 flex items-center gap-2 shadow-lg shadow-green-600/20 font-medium">
                        <CheckCircle size={18} /> Approve
                    </button>
                  </>
              )}
               {po.status === 'APPROVED_PENDING_CONCUR' && (
                   <button type="button" onClick={() => setIsExportModalOpen(true)} className="w-full lg:w-auto justify-center px-4 py-2.5 bg-white dark:bg-white/10 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-white rounded-xl hover:bg-gray-50 dark:hover:bg-white/20 flex items-center gap-2 font-medium shadow-sm transition-all">
                       <FileText size={18} /> Details for Concur
                   </button>
               )}
              {canLinkConcur && (
                   <button type="button" onClick={() => setIsConcurModalOpen(true)} className="w-full lg:w-auto justify-center px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 flex items-center gap-2 shadow-lg shadow-indigo-600/20 animate-pulse font-medium">
                      <LinkIcon size={18} /> Link Concur PO
                   </button>
              )}
              {canReceive && (
                  <button type="button" onClick={() => setIsDeliveryModalOpen(true)} className={`w-full lg:w-auto justify-center px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium shadow-lg transition-all ${
                      po.status === 'RECEIVED' 
                        ? 'bg-gray-600 text-white hover:bg-gray-700 shadow-gray-600/20' 
                        : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/20'
                  }`}>
                      <Truck size={18} /> {po.status === 'RECEIVED' ? 'Record Extra Delivery' : 'Record Delivery'}
                  </button>
              )}
              {canClose && (
                  <button type="button" onClick={handleCompletePO} className="w-full lg:w-auto justify-center px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-500 flex items-center gap-2 shadow-lg shadow-green-600/20 font-medium">
                      <CheckCircle size={18} /> Complete Order
                  </button>
              )}

              {po.status === 'VARIANCE_PENDING' && hasPermission('approve_requests') && (
                   <button type="button" onClick={() => updatePOStatus(po.id, 'RECEIVED', {
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
            <div className="bg-gray-50 dark:bg-[#15171e] rounded-xl p-4 border border-gray-100 dark:border-gray-800 mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="flex gap-3 items-start">
                    <div className="p-2 bg-gray-200 dark:bg-gray-800 rounded-lg text-secondary"><User size={16}/></div>
                    <div className="w-full">
                        <p className="text-xs text-secondary uppercase font-bold">Customer</p>
                        {isEditing ? (
                            <input 
                                className="w-full mt-1 px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                value={headerEdits.clientName}
                                onChange={e => setHeaderEdits({...headerEdits, clientName: e.target.value})}
                            />
                        ) : (
                            <p className="text-sm font-medium text-primary dark:text-white">{po.customerName || '-'}</p>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 items-start">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg"><Building size={16}/></div>
                    <div className="w-full">
                        <p className="text-xs text-secondary uppercase font-bold">Supplier</p>
                        <p className="text-sm font-medium text-primary dark:text-white">{po.supplierName}</p>
                    </div>
                </div>

                <div className="flex gap-3 items-start">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg"><LinkIcon size={16}/></div>
                    <div className="w-full">
                        <p className="text-xs text-secondary uppercase font-bold">Concur PO #</p>
                        <p className="text-sm font-medium text-primary dark:text-white">
                             {Array.from(new Set(po.lines.map(l => l.concurPoNumber).filter(Boolean))).join(', ') || '-'}
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 items-start">
                    <div className="p-2 bg-gray-200 dark:bg-gray-800 rounded-lg text-secondary"><Info size={16}/></div>
                    <div className="w-full">
                        <p className="text-xs text-secondary uppercase font-bold">Reason</p>
                         {isEditing ? (
                            <select 
                                className="w-full mt-1 px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                value={headerEdits.reason}
                                onChange={e => setHeaderEdits({...headerEdits, reason: e.target.value})}
                            >
                                <option value="Depletion">Depletion</option>
                                <option value="New Customer">New Customer</option>
                                <option value="Other">Other</option>
                            </select>
                        ) : (
                            <p className="text-sm font-medium text-primary dark:text-white">{po.reasonForRequest || '-'}</p>
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
                            <p className="text-sm text-secondary dark:text-gray-300 italic">{po.comments ? `"${po.comments}"` : '-'}</p>
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
                     
                     {steps.map((step) => {
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
          <button type="button" onClick={() => setActiveTab('LINES')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'LINES' ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-secondary hover:text-primary dark:hover:text-gray-300'}`}>Order Lines</button>
          <button type="button" onClick={() => setActiveTab('DELIVERIES')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'DELIVERIES' ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-secondary hover:text-primary dark:hover:text-gray-300'}`}>Deliveries ({po.deliveries.length})</button>
          <button type="button" onClick={() => setActiveTab('HISTORY')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'HISTORY' ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-secondary hover:text-primary dark:hover:text-gray-300'}`}>History</button>
      </div>
      
      <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden min-h-[300px]">
          {activeTab === 'LINES' && (
              <div className="overflow-x-auto">
                  {isEditing && (
                      <div className="p-4 md:p-5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-[#15171e]">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                              <div className="flex items-start gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#1e2029] text-[var(--color-brand)] dark:text-blue-300 flex items-center justify-center border border-gray-200 dark:border-gray-700 shadow-sm">
                                      <Plus size={18} />
                                  </div>
                                  <div>
                                      <h3 className="text-sm md:text-base font-extrabold text-gray-900 dark:text-white tracking-tight">Add Item To Request</h3>
                                      <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                                          Search by SKU, item name, or category, then set quantity and unit price before adding.
                                      </p>
                                  </div>
                              </div>
                              <div className="inline-flex items-center gap-2 self-start md:self-center px-3 py-1.5 rounded-full text-[11px] font-bold border border-gray-200 text-gray-600 bg-white dark:border-gray-700 dark:text-gray-300 dark:bg-[#1e2029]">
                                  {addableItems.length} active items
                              </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                              <div className="lg:col-span-5">
                                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase mb-1.5">Item Search</label>
                                  <div ref={addItemPickerRef} className="relative">
                                      <Search size={15} className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
                                      <input
                                          type="text"
                                          value={addItemSearch}
                                          onFocus={() => {
                                              if (addableItems.length > 0) {
                                                  setIsAddItemPickerOpen(true);
                                              }
                                          }}
                                          onChange={(e) => {
                                              setAddItemSearch(e.target.value);
                                              setIsAddItemPickerOpen(true);
                                              setActiveAddItemIndex(0);
                                          }}
                                          onKeyDown={handleAddItemSearchKeyDown}
                                          placeholder={addableItems.length === 0 ? 'No active items available to add' : 'Search SKU, item name, category...'}
                                          className="w-full bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] disabled:opacity-60 disabled:cursor-not-allowed"
                                          disabled={addableItems.length === 0}
                                      />
                                      {isAddItemPickerOpen && addableItems.length > 0 && (
                                          <div className="absolute z-40 mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#12151f] shadow-2xl overflow-hidden">
                                              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-[#171a24] flex items-center justify-between gap-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                                                  <span>{filteredAddableItems.length} match{filteredAddableItems.length === 1 ? '' : 'es'}</span>
                                                  {filteredAddableItems.length > visibleAddableItems.length && (
                                                      <span>Showing first {visibleAddableItems.length}</span>
                                                  )}
                                              </div>
                                              <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
                                                  {visibleAddableItems.length === 0 ? (
                                                      <div className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                                                          No active items found. Try SKU or a shorter keyword.
                                                      </div>
                                                  ) : (
                                                      visibleAddableItems.map((item, index) => {
                                                          const isHighlighted = index === activeAddItemIndex;
                                                          const isSelected = item.id === addItemId;
                                                          return (
                                                              <button
                                                                  type="button"
                                                                  key={item.id}
                                                                  onMouseEnter={() => setActiveAddItemIndex(index)}
                                                                  onClick={() => applyAddItemSelection(item)}
                                                                  className={`w-full text-left rounded-lg px-3 py-2.5 border transition-colors ${
                                                                      isHighlighted
                                                                          ? 'border-[var(--color-brand)]/50 bg-[var(--color-brand)]/10 dark:bg-[var(--color-brand)]/15'
                                                                          : isSelected
                                                                              ? 'border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/10'
                                                                              : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#1d2130]'
                                                                  }`}
                                                              >
                                                                  <div className="flex items-center justify-between gap-3">
                                                                      <div className="min-w-0">
                                                                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.name}</p>
                                                                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                                                                              {item.sku}
                                                                              {item.category ? ` - ${item.category}` : ''}
                                                                              {item.subCategory ? ` / ${item.subCategory}` : ''}
                                                                          </p>
                                                                      </div>
                                                                      {isSelected && (
                                                                          <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-brand)]">Selected</span>
                                                                      )}
                                                                  </div>
                                                              </button>
                                                          );
                                                      })
                                                  )}
                                              </div>
                                              <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 dark:text-gray-500">
                                                  Tip: use arrows and Enter to select quickly.
                                              </div>
                                          </div>
                                      )}
                                  </div>
                                  {selectedAddItem ? (
                                      <div className="mt-2 inline-flex items-center gap-2 bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs">
                                          <span className="font-mono font-bold text-[var(--color-brand)]">{selectedAddItem.sku}</span>
                                          <span className="text-gray-700 dark:text-gray-300">{selectedAddItem.name}</span>
                                      </div>
                                  ) : (
                                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Select an item from results, then set quantity and price.</p>
                                  )}
                              </div>
                              <div className="lg:col-span-2">
                                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase mb-1.5">Price Option</label>
                                  {!selectedAddItem ? (
                                      <div className="h-[42px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e2029] px-3 flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                                          Select item first
                                      </div>
                                  ) : selectedAddItemPriceOptions.length > 1 ? (
                                      <select
                                          className="w-full bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/25 focus:border-[var(--color-brand)]"
                                          value={addItemPriceOptionId}
                                          onChange={(e) => {
                                              const nextOptionId = e.target.value;
                                              setAddItemPriceOptionId(nextOptionId);
                                              const selectedOption = selectedAddItemPriceOptions.find(opt => opt.id === nextOptionId);
                                              if (selectedOption) {
                                                  setAddItemPrice(String(selectedOption.price));
                                              }
                                          }}
                                      >
                                          {selectedAddItemPriceOptions.map(option => (
                                              <option key={option.id} value={option.id}>
                                                  {option.label}
                                              </option>
                                          ))}
                                      </select>
                                  ) : (
                                      <div className="h-[42px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e2029] px-3 flex items-center text-xs font-semibold text-gray-500 dark:text-gray-300">
                                          {selectedAddItemPriceOptions[0]?.label || 'Standard'}
                                      </div>
                                  )}
                              </div>
                              <div className="lg:col-span-2">
                                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase mb-1.5">Qty</label>
                                  <input
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={addItemQty}
                                      onChange={(e) => setAddItemQty(e.target.value)}
                                      className="w-full bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/25 focus:border-[var(--color-brand)]"
                                  />
                              </div>
                              <div className="lg:col-span-2">
                                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase mb-1.5">Unit Price</label>
                                  <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={addItemPrice}
                                      onChange={(e) => setAddItemPrice(e.target.value)}
                                      className="w-full bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/25 focus:border-[var(--color-brand)]"
                                  />
                              </div>
                              <div className="lg:col-span-2 flex lg:justify-end">
                                  <button
                                      type="button"
                                      onClick={handleAddDraftLine}
                                      disabled={!addItemId || addableItems.length === 0}
                                      className="w-full lg:w-auto px-4 py-2.5 bg-[var(--color-brand)] text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm shadow-[var(--color-brand)]/25"
                                  >
                                      <Plus size={16} /> Add Item
                                  </button>
                              </div>
                          </div>
                      </div>
                  )}
                  <table className="w-full text-left text-sm text-secondary dark:text-gray-400">
                      <thead className="bg-gray-50 dark:bg-[#15171e] text-xs uppercase text-tertiary dark:text-gray-500 font-bold border-b border-gray-200 dark:border-gray-800">
                          <tr>
                              <th className="px-6 py-4">Item Details</th>
                              <th className="px-6 py-4 text-center">Ordered</th>
                              <th className="px-6 py-4 text-center">Received</th>
                              <th className="px-6 py-4 text-right">Unit Price</th>
                              <th className="px-6 py-4 text-right">Total</th>
                              {isEditing && <th className="px-6 py-4 text-center">Actions</th>}
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                          {linesInView.map(line => (
                              <tr key={line.id} className="hover:bg-gray-50 dark:hover:bg-[#2b2d3b] transition-colors">
                                  <td className="px-6 py-4">
                                      <div className="font-bold text-primary dark:text-white">{line.itemName}</div>
                                      <div className="text-xs text-tertiary dark:text-gray-500 font-mono mt-0.5">{line.sku}</div>
                                      {line.priceOptionLabel && (
                                          <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-1">{line.priceOptionLabel}</div>
                                      )}
                                  </td>
                                  <td className="px-6 py-4 text-center font-medium text-primary dark:text-white">
                                      {isEditing ? (
                                          <input 
                                              type="number" 
                                              className="w-20 px-2 py-1 text-center border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                              value={line.quantityOrdered}
                                              min={1}
                                              step={1}
                                              onChange={(e) => handleLineQtyChange(line.id, e.target.value)}
                                          />
                                      ) : (
                                          line.quantityOrdered
                                      )}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      <div className="flex flex-col items-center justify-center">
                                          <span className={line.quantityReceived >= line.quantityOrdered ? 'text-green-600 dark:text-green-500 font-bold' : 'text-secondary'}>
                                              {line.quantityReceived}
                                          </span>
                                          {line.quantityReceived > line.quantityOrdered && (
                                              <span className="text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-500/20 mt-1 whitespace-nowrap">
                                                  +{line.quantityReceived - line.quantityOrdered} Over
                                              </span>
                                          )}
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                      {isEditing ? (
                                          <div className="flex items-center justify-end gap-1">
                                              <span className="text-gray-400">$</span>
                                              <input 
                                                  type="number" 
                                                  className="w-24 px-2 py-1 text-right border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                                  value={line.unitPrice}
                                                  step="0.01"
                                                  min="0"
                                                  onChange={(e) => handleLinePriceChange(line.id, e.target.value)}
                                              />
                                          </div>
                                      ) : (
                                          `$${line.unitPrice.toFixed(2)}`
                                      )}
                                  </td>
                                  <td className="px-6 py-4 text-right font-bold text-primary dark:text-white">
                                      ${(line.totalPrice ?? (line.quantityOrdered * line.unitPrice)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  {isEditing && (
                                      <td className="px-6 py-4 text-center">
                                          <button
                                              type="button"
                                              onClick={() => handleRemoveDraftLine(line.id)}
                                              disabled={linesInView.length <= 1}
                                              className="p-2 text-red-500 hover:text-red-600 disabled:text-gray-300 disabled:cursor-not-allowed"
                                              title={linesInView.length <= 1 ? 'At least one line is required' : 'Remove line'}
                                          >
                                              <Trash2 size={16} />
                                          </button>
                                      </td>
                                  )}
                              </tr>
                          ))}
                          {linesInView.length === 0 && (
                              <tr>
                                  <td colSpan={isEditing ? 6 : 5} className="px-6 py-10 text-center text-gray-400">
                                      No line items.
                                  </td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          )}
          
          {activeTab === 'DELIVERIES' && (
               <div className="p-4 md:p-6 space-y-6">
                    {po.deliveries.length === 0 ? (
                        <div className="text-center text-tertiary dark:text-gray-400 py-12 flex flex-col items-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
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
                                            <span className="font-bold text-primary dark:text-white block text-sm md:text-base">
                                                {isEditing ? (
                                                    <input 
                                                        className="px-1 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm"
                                                        defaultValue={del.docketNumber}
                                                        onBlur={(e) => handleUpdateDeliveryHeader(del.id, 'docket', e.target.value)}
                                                    />
                                                ) : del.docketNumber}
                                            </span>
                                            <span className="text-xs text-tertiary dark:text-gray-500 flex items-center gap-1">
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
                                            <tr className="text-xs text-tertiary dark:text-gray-500 text-left uppercase">
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
                                                        <td className="py-3 text-secondary dark:text-gray-300 font-medium">{poLine?.itemName}</td>
                                                        <td className="py-3 text-right font-bold text-primary dark:text-white">{dLine.quantity}</td>
                                                        
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
                                                                <span className="text-secondary dark:text-gray-300 font-mono text-xs bg-gray-100 dark:bg-white/5 px-2 py-1 rounded">
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
                    {timelineEvents.map((event) => (
                        <div key={event.id} className="relative pl-8 group">
                            {/* Icon Marker */}
                            <div className={`absolute -left-[20px] top-0 p-2 rounded-full border-4 border-white dark:border-[#1e2029] ${event.colorClass} shadow-sm z-10`}>
                                <event.icon size={16} />
                            </div>

                            <div className="ml-4">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                                    <p className="font-bold text-primary dark:text-white text-sm">{event.title}</p>
                                    <span className="hidden sm:inline text-tertiary dark:text-gray-600">•</span>
                                    <p className="text-xs text-tertiary dark:text-gray-500 font-mono">{event.date.toLocaleDateString()}</p>
                                </div>
                                <p className="text-sm text-secondary dark:text-gray-300">{event.subtitle}</p>
                                {event.description && (
                                    <div className="mt-2 bg-gray-50 dark:bg-[#15171e] p-3 rounded-xl text-sm text-secondary dark:text-gray-400 italic border border-gray-100 dark:border-gray-700 inline-block">
                                        "{event.description}"
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {timelineEvents.length === 0 && (
                        <div className="text-tertiary text-sm italic pl-8">No history recorded.</div>
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
                    <h2 className="text-xl font-bold text-primary dark:text-white">Link Concur PO</h2>
                    <p className="text-sm text-secondary dark:text-gray-400 mt-1">
                        Enter the SAP Concur PO Number to synchronize.
                    </p>
                </div>
                <input 
                    type="text" 
                    autoFocus
                    placeholder="e.g. PO-88123"
                    className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-300 dark:border-gray-700 rounded-xl p-3 mb-6 focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)] outline-none text-primary dark:text-white"
                    value={concurInput}
                    onChange={e => setConcurInput(e.target.value)}
                />
                <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setIsConcurModalOpen(false)} className="px-4 py-2.5 text-secondary hover:text-primary dark:text-gray-400 dark:hover:text-white rounded-lg font-medium">Cancel</button>
                    <button type="button" onClick={handleConcurLink} disabled={!concurInput} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-50 font-bold shadow-lg shadow-indigo-500/20">Sync & Activate</button>
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
                    <h2 className="text-lg font-bold text-primary dark:text-white flex items-center gap-2">
                        <Shield size={20} className="text-amber-500"/> Force Status Update
                    </h2>
                    <p className="text-xs text-secondary mt-1">
                        Override the current workflow state.
                    </p>
                </div>
                
                <div className="space-y-2 mb-6">
                    {['PENDING_APPROVAL', 'APPROVED_PENDING_CONCUR', 'ACTIVE', 'RECEIVED', 'CLOSED', 'REJECTED'].map(s => (
                        <button 
                            type="button"
                            key={s}
                            onClick={() => handleForceStatusUpdate(s)}
                            disabled={isDeletingRequest}
                            className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                ${po.status === s ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-500/30' : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'}
                                ${isDeletingRequest ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                        >
                            {s}
                        </button>
                    ))}
                    
                    <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800">
                        <button 
                            type="button"
                            onClick={handleDeletePO}
                            disabled={isDeletingRequest}
                            className="w-full text-left px-4 py-2 rounded-lg text-sm font-bold transition-colors bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20 border border-transparent hover:border-red-200 dark:hover:border-red-800 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isDeletingRequest ? 'Deleting Request...' : 'DELETE REQUEST'}
                        </button>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button type="button" onClick={() => setIsStatusModalOpen(false)} disabled={isDeletingRequest} className="px-4 py-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed">Cancel</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default PODetail;
