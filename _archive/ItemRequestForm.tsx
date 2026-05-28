import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Info,
  Package,
  FileText,
  Target,
  ArrowRight,
  PlusCircle,
  Calendar
} from 'lucide-react';
import { createItemRequest, submitItemRequest } from '../services/itemRequestService';
import { ItemRequestType, ItemRequest } from '../types';
import PageHeader from './PageHeader';
import { useToast, ToastContainer } from './ToastNotification';

const REQUEST_TYPE_LABELS: Record<ItemRequestType, string> = {
  PURCHASE_AND_SALE: "Purchase & Sale Item",
  PURCHASE_ONLY: "Purchase Only (internal use, not sold)",
  SALE_ONLY: "Sale Only (no stock managed)",
  COG: "Customer Own Goods (COG)",
  BUNDLE_LINENHUB_ONLY: "Bundle / LinenHub Operational Item",
  REPLACEMENT: "Replacement for Existing Item",
  CUSTOMER_SPECIFIC: "Customer-Specific Item",
  SHARED_CATALOGUE: "Shared Catalogue Item"
};

export default function ItemRequestForm() {
  const navigate = useNavigate();
  const { toasts, dismissToast, error: toastError } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState<ItemRequest | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    request_type: 'PURCHASE_AND_SALE' as ItemRequestType,
    item_description: '',
    business_reason: '',
    required_activation_date: '',
    target_bundle: false,
    target_linenhub: false,
    target_salesforce: false,
    target_sap: true,
    customer_reference: '',
    contract_reference: '',
    replacement_for_item_id: '',
    department: '',
    business_unit: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (formData.item_description.length < 10) {
      newErrors.item_description = "Description must be at least 10 characters.";
    }
    if (formData.business_reason.length < 20) {
      newErrors.business_reason = "Business reason must be at least 20 characters.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const created = await createItemRequest(formData);
      const submitted = await submitItemRequest(created.id);
      setSubmittedRequest(submitted);
      setStep(3);
    } catch (error: any) {
      toastError(error.message || 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 3 && submittedRequest) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 animate-page-entry">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="bg-white dark:bg-[#1e2029] rounded-3xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="bg-green-500 h-2 w-full"></div>
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="text-green-600 dark:text-green-500" size={40} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Request Submitted Successfully</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              Your request has been queued for review by the Master Data team.
            </p>

            <div className="bg-gray-50 dark:bg-[#15171e] rounded-2xl p-6 mb-8 grid grid-cols-2 gap-4 text-left">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Request Number</p>
                <p className="text-lg font-mono font-bold text-gray-900 dark:text-white">{submittedRequest.request_number}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{submittedRequest.status}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => navigate('/items/my-requests')}
                className="flex-1 bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white py-3.5 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
              >
                View My Requests
              </button>
              <button
                onClick={() => {
                  setSubmittedRequest(null);
                  setStep(1);
                  setFormData({
                    request_type: 'PURCHASE_AND_SALE' as ItemRequestType,
                    item_description: '',
                    business_reason: '',
                    required_activation_date: '',
                    target_bundle: false,
                    target_linenhub: false,
                    target_salesforce: false,
                    target_sap: true,
                    customer_reference: '',
                    contract_reference: '',
                    replacement_for_item_id: '',
                    department: '',
                    business_unit: ''
                  });
                }}
                className="flex-1 bg-[var(--color-brand)] text-white py-3.5 rounded-xl font-bold shadow-lg shadow-[var(--color-brand)]/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <PlusCircle size={18} /> New Request
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-page-entry">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <PageHeader
        title="New Item Request"
        subtitle="Request a new product to be added to the organizational catalog."
      />

      {/* Progress Indicator */}
      <div className="mb-8 px-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all ${step === 1 ? 'bg-[var(--color-brand)] text-white shadow-lg shadow-[var(--color-brand)]/20' : 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-500'}`}>
              {step > 1 ? <CheckCircle2 size={20} /> : '1'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-gray-900 dark:text-white">What do you need?</p>
              <p className="text-xs text-gray-500">Item details and justification</p>
            </div>
          </div>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800 mx-6"></div>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all ${step === 2 ? 'bg-[var(--color-brand)] text-white shadow-lg shadow-[var(--color-brand)]/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
              2
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-gray-900 dark:text-white">Where is it needed?</p>
              <p className="text-xs text-gray-500">Target systems and references</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e2029] rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="bg-amber-50 dark:bg-amber-500/5 border-b border-amber-100 dark:border-amber-500/10 p-4 flex items-start gap-3">
          <div className="bg-amber-100 dark:bg-amber-500/20 p-2 rounded-lg text-amber-600 dark:text-amber-500 shrink-0">
            <Info size={18} />
          </div>
          <p className="text-sm text-amber-800 dark:text-amber-400 font-medium leading-relaxed">
            Pricing, SKU codes, and supplier details will be added by the relevant teams after your request is reviewed.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {step === 1 ? (
            <div className="space-y-8 animate-page-entry">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 block">Request Type</label>
                    <div className="grid grid-cols-1 gap-2">
                      {(Object.entries(REQUEST_TYPE_LABELS) as [ItemRequestType, string][]).map(([value, label]) => (
                        <div
                          key={value}
                          onClick={() => setFormData({ ...formData, request_type: value })}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${formData.request_type === value
                            ? 'bg-[var(--color-brand)]/5 border-[var(--color-brand)] text-[var(--color-brand)]'
                            : 'bg-white dark:bg-[#15171e] border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300'}`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${formData.request_type === value ? 'border-[var(--color-brand)] bg-[var(--color-brand)]' : 'border-gray-300 dark:border-gray-600'}`}>
                            {formData.request_type === value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className="text-sm font-medium">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Item Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Describe the item clearly (min. 10 characters)..."
                      className={`w-full bg-gray-50 dark:bg-[#15171e] border rounded-xl p-4 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all resize-none ${errors.item_description ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                      value={formData.item_description}
                      onChange={(e) => setFormData({ ...formData, item_description: e.target.value })}
                    />
                    {errors.item_description && (
                      <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertTriangle size={12} />{errors.item_description}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Business Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Why is this item needed? (min. 20 characters)..."
                      className={`w-full bg-gray-50 dark:bg-[#15171e] border rounded-xl p-4 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all resize-none ${errors.business_reason ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                      value={formData.business_reason}
                      onChange={(e) => setFormData({ ...formData, business_reason: e.target.value })}
                    />
                    {errors.business_reason && (
                      <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertTriangle size={12} />{errors.business_reason}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Required Activation Date
                    </label>
                    <div className="relative">
                      <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        type="date"
                        className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
                        value={formData.required_activation_date}
                        onChange={(e) => setFormData({ ...formData, required_activation_date: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleNext}
                  className="bg-[var(--color-brand)] text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-[var(--color-brand)]/20 hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
                >
                  Next Step <ChevronRight size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-page-entry">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 block">Target Systems</label>
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { id: 'target_sap', label: 'SAP Business One (ERP)', description: 'Core financial and inventory system' },
                        { id: 'target_bundle', label: 'Bundle (Procurement)', description: 'Hospitality procurement portal' },
                        { id: 'target_linenhub', label: 'LinenHub (Linen Ops)', description: 'Linen operational tracking' },
                        { id: 'target_salesforce', label: 'Salesforce (CRM)', description: 'Sales and customer management' }
                      ].map(system => (
                        <div
                          key={system.id}
                          onClick={() => setFormData({ ...formData, [system.id]: !formData[system.id as keyof typeof formData] })}
                          className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-4 ${formData[system.id as keyof typeof formData]
                            ? 'bg-[var(--color-brand)]/5 border-[var(--color-brand)]'
                            : 'bg-white dark:bg-[#15171e] border-gray-200 dark:border-gray-700'}`}
                        >
                          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${formData[system.id as keyof typeof formData] ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                            {formData[system.id as keyof typeof formData] && <CheckCircle2 size={14} />}
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${formData[system.id as keyof typeof formData] ? 'text-[var(--color-brand)]' : 'text-gray-900 dark:text-white'}`}>{system.label}</p>
                            <p className="text-xs text-gray-500">{system.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 block">Additional Context</label>

                  {(formData.request_type === 'CUSTOMER_SPECIFIC' || formData.request_type === 'REPLACEMENT') && (
                    <div className="animate-page-entry">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Customer Reference</label>
                      <input
                        type="text"
                        placeholder="Customer name or account code..."
                        className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
                        value={formData.customer_reference}
                        onChange={(e) => setFormData({ ...formData, customer_reference: e.target.value })}
                      />
                    </div>
                  )}

                  {formData.request_type === 'CUSTOMER_SPECIFIC' && (
                    <div className="animate-page-entry">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Contract Reference</label>
                      <input
                        type="text"
                        placeholder="Contract ID or name..."
                        className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
                        value={formData.contract_reference}
                        onChange={(e) => setFormData({ ...formData, contract_reference: e.target.value })}
                      />
                    </div>
                  )}

                  {formData.request_type === 'REPLACEMENT' && (
                    <div className="animate-page-entry">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Item ID being replaced</label>
                      <input
                        type="text"
                        placeholder="Internal item ID (UUID of the item being replaced)"
                        className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
                        value={formData.replacement_for_item_id}
                        onChange={(e) => setFormData({ ...formData, replacement_for_item_id: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Department</label>
                      <input
                        type="text"
                        placeholder="e.g. Linen, Sales"
                        className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Business Unit</label>
                      <input
                        type="text"
                        placeholder="e.g. Healthcare, Hotel"
                        className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
                        value={formData.business_unit}
                        onChange={(e) => setFormData({ ...formData, business_unit: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white px-8 py-3.5 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-all flex items-center gap-2"
                >
                  <ChevronLeft size={18} /> Previous Step
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-[var(--color-brand)] text-white px-10 py-3.5 rounded-xl font-bold shadow-lg shadow-[var(--color-brand)]/20 hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} /> Submit Request
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
