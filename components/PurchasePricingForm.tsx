import React, { useState, useEffect } from 'react';
import { 
  Plus, Save, AlertCircle, CheckCircle2, Info, DollarSign, 
  Calendar, Truck, Package, Layers, FileText, Star,
  ShieldAlert, History, ArrowRight
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { ItemPurchasePrice, ItemRequest } from '../types';
import { 
  createPurchasePrice, 
  getPurchasePricesForItem, 
  checkDateOverlap,
  setPreferredSupplier
} from '../services/purchasePricingService';
import { useApp } from '../context/AppContext';

interface PurchasePricingFormProps {
  itemId: string;
  requestId: string;
  onComplete: () => void;
}

export const PurchasePricingForm: React.FC<PurchasePricingFormProps> = ({ 
  itemId, 
  requestId, 
  onComplete 
}) => {
  const { hasPermission, suppliers } = useApp();
  
  // Permissions Check
  const canManage = hasPermission('manage_purchase_pricing');
  
  const [existingPrices, setExistingPrices] = useState<ItemPurchasePrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New Price Form State
  const [formData, setFormData] = useState({
    supplier_id: '',
    supplier_item_code: '',
    purchase_price_ex_gst: 0,
    currency: 'AUD',
    purchase_uom: 'EA',
    pack_conversion_factor: 1,
    moq: 1,
    lead_time_days: 0,
    freight_handling_cost: 0,
    is_preferred_supplier: false,
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, [itemId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const prices = await getPurchasePricesForItem(itemId);
      setExistingPrices(prices);
    } catch (err: any) {
      setError('Failed to load existing prices: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value as string) || 0 : val
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    // Validation
    if (!formData.supplier_id || formData.purchase_price_ex_gst <= 0 || !formData.purchase_uom || !formData.effective_from) {
      setError('Please fill in all required fields (Supplier, Price > 0, UOM, Effective From).');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Date Overlap Check
      const hasOverlap = await checkDateOverlap(
        itemId,
        formData.supplier_id,
        formData.purchase_uom,
        formData.effective_from,
        formData.effective_to || null
      );

      if (hasOverlap) {
        setError('A price for this supplier/UOM combination already exists in this date range. Adjust the effective dates.');
        setIsSubmitting(false);
        return;
      }

      // Create Price
      const newPrice = await createPurchasePrice({
        item_id: itemId,
        supplier_id: formData.supplier_id,
        supplier_item_code: formData.supplier_item_code || undefined,
        purchase_price_ex_gst: formData.purchase_price_ex_gst,
        currency: formData.currency,
        purchase_uom: formData.purchase_uom,
        pack_conversion_factor: formData.pack_conversion_factor,
        moq: formData.moq,
        lead_time_days: formData.lead_time_days,
        freight_handling_cost: formData.freight_handling_cost,
        is_preferred_supplier: formData.is_preferred_supplier,
        effective_from: formData.effective_from,
        effective_to: formData.effective_to || undefined,
        notes: formData.notes || undefined
      });

      // Handle preferred supplier cleanup if set
      if (formData.is_preferred_supplier) {
        await setPreferredSupplier(newPrice.id, itemId);
      }

      // Check if first price -> Advance request status
      if (existingPrices.length === 0) {
        const { error: statusError } = await supabase
          .from('item_requests')
          .update({ status: 'PRICING_REVIEW' })
          .eq('id', requestId);
        
        if (statusError) console.warn('Failed to auto-advance request status:', statusError.message);
      }

      setSuccess('Purchase price added successfully.');
      
      // Reset Form (keeping some defaults)
      setFormData(prev => ({
        ...prev,
        supplier_item_code: '',
        purchase_price_ex_gst: 0,
        is_preferred_supplier: false,
        notes: ''
      }));

      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save purchase price.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkComplete = async () => {
    if (!canManage) return;
    
    const hasPrices = existingPrices.some(p => ['ACTIVE', 'APPROVED_FUTURE', 'PENDING_APPROVAL'].includes(p.status));
    if (!hasPrices) {
      setError('You must have at least one valid purchase price to complete this stage.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Advance to PRICING_REVIEW (which is actually the step towards sell pricing)
      // The requirement says "advance the request to sell pricing stage"
      // Based on the workflow, PRICING_REVIEW might be where sell pricing happens or it might be the next step.
      // The prompt says: update({ status: 'PRICING_REVIEW' })
      const { error } = await supabase
        .from('item_requests')
        .update({ status: 'PRICING_REVIEW' })
        .eq('id', requestId);

      if (error) throw error;
      onComplete();
    } catch (err: any) {
      setError('Failed to complete pricing stage: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canManage) {
    return (
      <div className="p-8 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl flex flex-col items-center justify-center text-center gap-4 animate-page-entry">
        <ShieldAlert className="text-amber-500" size={48} />
        <div>
          <h3 className="text-lg font-black text-amber-900 dark:text-amber-200 uppercase tracking-tight">Access Restricted</h3>
          <p className="text-amber-700 dark:text-amber-400">This section is managed by the Procurement team.</p>
        </div>
      </div>
    );
  }

  // Calculated Fields
  const landedCost = formData.purchase_price_ex_gst + formData.freight_handling_cost;

  return (
    <div className="space-y-8 animate-page-entry">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Purchase Pricing</h2>
          <p className="text-gray-500">Configure supplier pricing and landed costs. Multiple suppliers supported.</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleMarkComplete}
            disabled={existingPrices.length === 0 || isSubmitting}
            className="btn-primary bg-[#129DC0] hover:bg-[#0f87a8] flex items-center gap-2 px-6 py-3 rounded-xl font-bold uppercase text-xs tracking-widest transition-all shadow-lg shadow-[#129DC0]/20 disabled:opacity-50"
          >
            Mark Purchase Pricing Complete <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Existing Prices Table */}
      <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#181a21]/50 flex items-center gap-2">
          <History size={18} className="text-[#129DC0]" />
          <h3 className="font-bold text-gray-900 dark:text-white uppercase text-sm tracking-widest">Price History & Status</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-transparent">
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Supplier</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Price (Ex GST)</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">UOM / Conv</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Landed Cost</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Effective</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Pref.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500 italic">Loading prices...</td></tr>
              ) : existingPrices.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500 italic">No purchase prices recorded for this item yet.</td></tr>
              ) : (
                existingPrices.map(price => (
                  <tr key={price.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-gray-900 dark:text-white">{(price as any).suppliers?.name || 'Unknown'}</p>
                      <p className="text-[10px] text-gray-500 font-mono">{price.supplier_item_code || 'No Code'}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-mono font-bold text-[#129DC0]">
                        {price.currency} {price.purchase_price_ex_gst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-medium">{price.purchase_uom}</p>
                      <p className="text-[10px] text-gray-400">x{price.pack_conversion_factor}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {price.currency} {price.landed_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </td>
                    <td className="p-4 text-xs">
                      <p>{new Date(price.effective_from).toLocaleDateString()}</p>
                      <p className="text-gray-400">to {price.effective_to ? new Date(price.effective_to).toLocaleDateString() : 'Open'}</p>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${
                        price.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                        price.status === 'PENDING_APPROVAL' ? 'bg-amber-100 text-amber-700' :
                        price.status === 'APPROVED_FUTURE' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {price.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      {price.is_preferred_supplier ? (
                        <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shadow-sm border border-amber-200">
                          <Star size={12} fill="currentColor" />
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Price Form */}
      <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#181a21]/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plus size={18} className="text-[#129DC0]" />
            <h3 className="font-bold text-gray-900 dark:text-white uppercase text-sm tracking-widest">Add New Price Line</h3>
          </div>
          <div className="flex items-center gap-2">
             <span className="text-[10px] font-black text-[#129DC0] uppercase tracking-widest">Landed Cost Preview:</span>
             <span className="text-lg font-mono font-black text-emerald-600 dark:text-emerald-400">
               {formData.currency} {landedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
             </span>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Supplier Info */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Supplier *</label>
              <select
                name="supplier_id"
                value={formData.supplier_id}
                onChange={handleInputChange}
                className="input-field"
                required
              >
                <option value="">Select Supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Supplier Item Code</label>
              <input
                type="text"
                name="supplier_item_code"
                value={formData.supplier_item_code}
                onChange={handleInputChange}
                className="input-field"
                placeholder="SKU-123-ABC"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Is Preferred?</label>
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 dark:bg-[#181a21] rounded-xl border border-gray-100 dark:border-gray-800 hover:border-[#129DC0]/30 transition-all">
                <input
                  type="checkbox"
                  name="is_preferred_supplier"
                  checked={formData.is_preferred_supplier}
                  onChange={handleInputChange}
                  className="w-5 h-5 rounded border-gray-300 text-[#129DC0] focus:ring-[#129DC0]"
                />
                <span className="text-sm font-bold">Preferred</span>
              </label>
            </div>

            {/* Financials */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Currency</label>
              <select name="currency" value={formData.currency} onChange={handleInputChange} className="input-field">
                <option value="AUD">AUD</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Purchase Price (Ex GST) *</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><DollarSign size={14} /></div>
                <input
                  type="number"
                  name="purchase_price_ex_gst"
                  value={formData.purchase_price_ex_gst}
                  onChange={handleInputChange}
                  className="input-field pl-8"
                  step="0.01"
                  min="0.01"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Freight & Handling / Unit</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Truck size={14} /></div>
                <input
                  type="number"
                  name="freight_handling_cost"
                  value={formData.freight_handling_cost}
                  onChange={handleInputChange}
                  className="input-field pl-8"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
            <div className="space-y-2">
               <label className="text-xs font-black uppercase tracking-widest text-gray-400">Landed Cost (Auto)</label>
               <input
                 type="text"
                 value={`${formData.currency} ${landedCost.toFixed(2)}`}
                 className="input-field bg-gray-50 dark:bg-[#181a21] font-mono font-bold text-emerald-600 cursor-not-allowed"
                 readOnly
               />
            </div>

            {/* Logistics */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Purchase UOM *</label>
              <input
                type="text"
                name="purchase_uom"
                value={formData.purchase_uom}
                onChange={handleInputChange}
                className="input-field"
                placeholder="e.g. EA, KG, PK"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Pack Conv. Factor</label>
              <input
                type="number"
                name="pack_conversion_factor"
                value={formData.pack_conversion_factor}
                onChange={handleInputChange}
                className="input-field"
                step="0.0001"
                min="0.0001"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">MOQ (Units)</label>
              <input
                type="number"
                name="moq"
                value={formData.moq}
                onChange={handleInputChange}
                className="input-field"
                min="1"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Lead Time (Days)</label>
              <input
                type="number"
                name="lead_time_days"
                value={formData.lead_time_days}
                onChange={handleInputChange}
                className="input-field"
                min="0"
              />
            </div>

            {/* Validity */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Effective From *</label>
              <input
                type="date"
                name="effective_from"
                value={formData.effective_from}
                onChange={handleInputChange}
                className="input-field"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Effective To (Optional)</label>
              <input
                type="date"
                name="effective_to"
                value={formData.effective_to}
                onChange={handleInputChange}
                className="input-field"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                className="input-field h-11 resize-none"
                placeholder="Internal pricing notes..."
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 animate-slide-up">
              <AlertCircle size={20} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3 text-emerald-600 animate-slide-up">
              <CheckCircle2 size={20} />
              <p className="text-sm font-medium">{success}</p>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-8 py-4 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black uppercase tracking-widest flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? 'Saving...' : <><Save size={18} /> Save Purchase Price Record</>}
            </button>
          </div>
        </form>
      </div>

      {/* Info Card */}
      <div className="p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-2xl flex gap-4">
        <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center text-[#129DC0] shadow-sm border border-blue-100 dark:border-blue-900">
          <Info size={24} />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-blue-900 dark:text-blue-200 uppercase text-xs tracking-widest mb-1">Governance Rule</h4>
          <p className="text-sm text-blue-700 dark:text-blue-400">
            Purchase prices are restricted to the Procurement team. Date ranges must not overlap for the same Supplier and UOM. 
            Once a price is ACTIVE or SUPERSEDED, it cannot be modified directly; a new version must be created.
          </p>
        </div>
      </div>
    </div>
  );
};
