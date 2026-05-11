import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Info,
  FileText,
  Target,
  ArrowRight,
  TrendingUp,
  Calendar,
  Filter,
  Eye,
  Percent,
  Check,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { createPricingSchedule, previewPricingSchedule, submitScheduleForApproval } from '../services/pricingScheduleService';
import { PricingSchedule } from '../types';
import PageHeader from './PageHeader';

const BASIS_OPTIONS = [
  { id: 'CPI', label: 'CPI (Consumer Price Index)', hint: 'e.g. ABS CPI Q1 2026 = 3.8%' },
  { id: 'MWA', label: 'MWA (Minimum Wage Adjustment)', hint: 'Fair Work Commission determination' },
  { id: 'BUSINESS_DECISION', label: 'Business Decision', hint: 'Requires detailed justification' }
];

const UPLIFT_METHODS = [
  { id: 'PERCENTAGE_INCREASE', label: 'Percentage Increase (%)' },
  { id: 'PERCENTAGE_DECREASE', label: 'Percentage Decrease (%)' },
  { id: 'FIXED_AMOUNT_INCREASE', label: 'Fixed Amount Increase ($)' },
  { id: 'FIXED_AMOUNT_DECREASE', label: 'Fixed Amount Decrease ($)' },
  { id: 'REPLACE_WITH_NEW_PRICE', label: 'Replace with New Price ($)' }
];

const ROUNDING_RULES = [
  { id: 'ROUND_TO_CENT', label: 'Round to Nearest Cent' },
  { id: 'ROUND_UP', label: 'Round Up to Nearest Cent' },
  { id: 'NO_ROUNDING', label: 'No Rounding' }
];

const PRICE_TYPES = ['STANDARD', 'GROUP', 'CUSTOMER_SPECIFIC', 'CONTRACT'];

export default function PricingScheduleForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scheduleId = searchParams.get('id');
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [schedule, setSchedule] = useState<PricingSchedule | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [categories, setCategories] = useState<string[]>([]);
  
  // Form State
  const [formData, setFormData] = useState({
    schedule_name: '',
    basis: 'CPI' as 'CPI' | 'MWA' | 'BUSINESS_DECISION',
    basis_reference: '',
    justification: '',
    uplift_method: 'PERCENTAGE_INCREASE',
    uplift_value: 0,
    new_effective_from: '',
    rounding_rule: 'ROUND_TO_CENT',
    minimum_margin_floor: 25,
    price_type_filter: [] as string[],
    item_category_filter: [] as string[]
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCategories();
    if (scheduleId) {
      loadExistingSchedule(scheduleId);
    }
  }, [scheduleId]);

  const loadExistingSchedule = async (id: string) => {
    const { data, error } = await supabase
      .from('pricing_schedules')
      .select('*')
      .eq('id', id)
      .single();
    
    if (data && !error) {
      setSchedule(data);
      setFormData({
        schedule_name: data.schedule_name,
        basis: data.basis,
        basis_reference: data.basis_reference || '',
        justification: data.justification || '',
        uplift_method: data.uplift_method,
        uplift_value: data.uplift_value,
        new_effective_from: data.new_effective_from,
        rounding_rule: data.rounding_rule,
        minimum_margin_floor: data.minimum_margin_floor || 25,
        price_type_filter: data.price_type_filter || [],
        item_category_filter: data.item_category_filter || []
      });
      // If already created, skip to step 2 or 3 depending on status
      if (data.status === 'PENDING_APPROVAL' || data.status === 'APPROVED' || data.status === 'COMPLETED') {
        setStep(2); // Show preview for existing
      }
    }
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('items').select('category');
    if (data) {
      const unique = Array.from(new Set(data.map(i => i.category).filter(Boolean)));
      setCategories(unique as string[]);
    }
  };

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.schedule_name) newErrors.schedule_name = "Schedule name is required.";
    if (formData.basis === 'BUSINESS_DECISION' && formData.justification.length < 20) {
      newErrors.justification = "Justification must be at least 20 characters.";
    }
    if (formData.uplift_value <= 0) newErrors.uplift_value = "Uplift value must be greater than 0.";
    
    // Future date validation
    if (!formData.new_effective_from) {
      newErrors.new_effective_from = "Effective date is required.";
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const effectiveDate = new Date(formData.new_effective_from);
      if (effectiveDate <= today) {
        newErrors.new_effective_from = "Effective date must be in the future.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateStep1()) return;
    setIsSubmitting(true);
    try {
      const newSchedule = await createPricingSchedule(formData);
      setSchedule(newSchedule);
      setStep(2);
      window.scrollTo(0, 0);
    } catch (err: any) {
      alert("Error creating schedule: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunPreview = async () => {
    if (!schedule) return;
    setIsPreviewing(true);
    try {
      // Update filters on schedule before previewing if they changed
      await supabase.from('pricing_schedules').update({
        price_type_filter: formData.price_type_filter,
        item_category_filter: formData.item_category_filter
      }).eq('id', schedule.id);

      const data = await previewPricingSchedule(schedule.id);
      setPreviewData(data);
    } catch (err: any) {
      alert("Error running preview: " + err.message);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!schedule) return;
    setIsSubmitting(true);
    try {
      await submitScheduleForApproval(schedule.id);
      setStep(3);
    } catch (err: any) {
      alert("Error submitting for approval: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePriceType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      price_type_filter: prev.price_type_filter.includes(type)
        ? prev.price_type_filter.filter(t => t !== type)
        : [...prev.price_type_filter, type]
    }));
  };

  const toggleCategory = (cat: string) => {
    setFormData(prev => ({
      ...prev,
      item_category_filter: prev.item_category_filter.includes(cat)
        ? prev.item_category_filter.filter(c => c !== cat)
        : [...prev.item_category_filter, cat]
    }));
  };

  if (step === 3 && schedule) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 animate-fade-in">
        <div className="bg-white dark:bg-nocturne rounded-3xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="bg-blue-500 h-2 w-full"></div>
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="text-blue-600 dark:text-blue-500" size={40} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Schedule Submitted for Approval</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              Pricing schedule {schedule.schedule_number} has been submitted. A Finance Manager will review and approve before execution.
            </p>
            
            <div className="bg-gray-50 dark:bg-[#15171e] rounded-2xl p-6 mb-8 grid grid-cols-2 gap-4 text-left">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Schedule Number</p>
                <p className="text-lg font-mono font-bold text-gray-900 dark:text-white">{schedule.schedule_number}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">PENDING_APPROVAL</p>
              </div>
            </div>

            <button 
              onClick={() => navigate('/pricing/schedules')}
              className="w-full bg-[var(--color-brand)] text-white py-3.5 rounded-xl font-bold shadow-lg shadow-[var(--color-brand)]/20 hover:opacity-90 transition-all"
            >
              Back to Schedules List
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-fade-in">
      <PageHeader 
        title="Create Pricing Schedule" 
        subtitle="Configure bulk price uplifts based on CPI, MWA or business decisions."
      />

      {/* Progress Indicator */}
      <div className="mb-8 px-4">
        <div className="flex items-center justify-between mb-4">
          {[
            { s: 1, t: 'Configure', d: 'Base settings' },
            { s: 2, t: 'Scope & Preview', d: 'Target items' },
            { s: 3, t: 'Review', d: 'Submit for approval' }
          ].map((item, idx) => (
            <React.Fragment key={item.s}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all ${step === item.s ? 'bg-[var(--color-brand)] text-white shadow-lg shadow-[var(--color-brand)]/20' : step > item.s ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-500' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                  {step > item.s ? <CheckCircle2 size={20} /> : item.s}
                </div>
                <div className="hidden sm:block">
                  <p className={`text-sm font-bold ${step === item.s ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{item.t}</p>
                  <p className="text-xs text-gray-500">{item.d}</p>
                </div>
              </div>
              {idx < 2 && <div className={`flex-1 h-px mx-6 ${step > item.s ? 'bg-green-200 dark:bg-green-500/20' : 'bg-gray-200 dark:bg-gray-800'}`}></div>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-nocturne rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        {step === 1 && (
          <div className="p-8 space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                    <FileText size={14} className="text-[var(--color-brand)]" /> Schedule Name
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. Q1 2026 CPI Uplift"
                    className={`w-full bg-gray-50 dark:bg-[#15171e] border rounded-xl p-4 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all ${errors.schedule_name ? 'border-red-300 dark:border-red-500/50' : 'border-gray-200 dark:border-gray-700'}`}
                    value={formData.schedule_name}
                    onChange={(e) => setFormData({ ...formData, schedule_name: e.target.value })}
                  />
                  {errors.schedule_name && <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={12} /> {errors.schedule_name}</p>}
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                    <Target size={14} className="text-[var(--color-brand)]" /> Basis
                  </label>
                  <div className="space-y-2">
                    {BASIS_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, basis: opt.id as any })}
                        className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group ${formData.basis === opt.id 
                          ? 'bg-[var(--color-brand)]/5 border-[var(--color-brand)] text-[var(--color-brand)] shadow-sm' 
                          : 'bg-white dark:bg-[#15171e] border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'}`}
                      >
                        <div>
                          <p className="text-sm font-semibold">{opt.label}</p>
                          <p className="text-[11px] opacity-60">{opt.hint}</p>
                        </div>
                        {formData.basis === opt.id && <CheckCircle2 size={18} />}
                      </button>
                    ))}
                  </div>
                </div>

                {(formData.basis === 'CPI' || formData.basis === 'MWA') && (
                  <div className="animate-fade-in">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                      Basis Reference
                    </label>
                    <input 
                      type="text"
                      placeholder={formData.basis === 'CPI' ? "e.g. ABS CPI Q1 2026 = 3.8%" : "e.g. FWC-2026-01"}
                      className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
                      value={formData.basis_reference}
                      onChange={(e) => setFormData({ ...formData, basis_reference: e.target.value })}
                    />
                  </div>
                )}

                {formData.basis === 'BUSINESS_DECISION' && (
                  <div className="animate-fade-in">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                      Justification (Min 20 chars)
                    </label>
                    <textarea 
                      placeholder="Explain the commercial reason for this price change..."
                      className={`w-full bg-gray-50 dark:bg-[#15171e] border rounded-xl p-4 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all min-h-[100px] ${errors.justification ? 'border-red-300 dark:border-red-500/50' : 'border-gray-200 dark:border-gray-700'}`}
                      value={formData.justification}
                      onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                    />
                    {errors.justification && <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={12} /> {errors.justification}</p>}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                      Uplift Method
                    </label>
                    <select 
                      className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
                      value={formData.uplift_method}
                      onChange={(e) => setFormData({ ...formData, uplift_method: e.target.value })}
                    >
                      {UPLIFT_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                      Value
                    </label>
                    <input 
                      type="number"
                      step="0.01"
                      className={`w-full bg-gray-50 dark:bg-[#15171e] border rounded-xl p-4 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all ${errors.uplift_value ? 'border-red-300 dark:border-red-500/50' : 'border-gray-200 dark:border-gray-700'}`}
                      value={formData.uplift_value}
                      onChange={(e) => setFormData({ ...formData, uplift_value: parseFloat(e.target.value) || 0 })}
                    />
                    {errors.uplift_value && <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={12} /> {errors.uplift_value}</p>}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                    <Calendar size={14} className="text-[var(--color-brand)]" /> New Effective From Date
                  </label>
                  <input 
                    type="date"
                    className={`w-full bg-gray-50 dark:bg-[#15171e] border rounded-xl p-4 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all ${errors.new_effective_from ? 'border-red-300 dark:border-red-500/50' : 'border-gray-200 dark:border-gray-700'}`}
                    value={formData.new_effective_from}
                    onChange={(e) => setFormData({ ...formData, new_effective_from: e.target.value })}
                  />
                  {errors.new_effective_from && <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={12} /> {errors.new_effective_from}</p>}
                  <p className="mt-2 text-[11px] text-gray-400 italic">Must be a future date. Existing prices will be superseded on this day.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                      Rounding Rule
                    </label>
                    <select 
                      className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
                      value={formData.rounding_rule}
                      onChange={(e) => setFormData({ ...formData, rounding_rule: e.target.value })}
                    >
                      {ROUNDING_RULES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                      <Percent size={14} className="text-[var(--color-brand)]" /> Margin Floor %
                    </label>
                    <input 
                      type="number"
                      className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
                      value={formData.minimum_margin_floor}
                      onChange={(e) => setFormData({ ...formData, minimum_margin_floor: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 flex justify-end">
              <button 
                onClick={handleCreate}
                disabled={isSubmitting}
                className="bg-[var(--color-brand)] text-white px-10 py-4 rounded-xl font-bold shadow-lg shadow-[var(--color-brand)]/20 hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : <>Next: Define Scope <ChevronRight size={18} /></>}
              </button>
            </div>
          </div>
        )}

        {step === 2 && schedule && (
          <div className="p-8 space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
                  <Filter size={14} className="text-[var(--color-brand)]" /> Price Type Filter
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRICE_TYPES.map(type => (
                    <button
                      key={type}
                      onClick={() => togglePriceType(type)}
                      className={`px-4 py-2.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-2 ${formData.price_type_filter.includes(type) 
                        ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white' 
                        : 'bg-white dark:bg-white/5 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'}`}
                    >
                      {formData.price_type_filter.includes(type) && <Check size={14} />}
                      {type}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-gray-400">If none selected, all price types will be included.</p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
                  <Filter size={14} className="text-[var(--color-brand)]" /> Item Category Filter
                </label>
                <div className="max-h-40 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                  {categories.map(cat => (
                    <div 
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`p-3 rounded-lg border text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${formData.item_category_filter.includes(cat)
                        ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400'
                        : 'bg-white dark:bg-white/5 border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400'}`}
                    >
                      {cat}
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${formData.item_category_filter.includes(cat) ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 dark:border-gray-700'}`}>
                        {formData.item_category_filter.includes(cat) && <Check size={10} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-col items-center">
              <button
                onClick={handleRunPreview}
                disabled={isPreviewing}
                className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-12 py-4 rounded-xl font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
              >
                {isPreviewing ? 'Analyzing Prices...' : <><Eye size={20} /> Run Dry-Run Preview</>}
              </button>
            </div>

            {previewData && (
              <div className="space-y-6 animate-slide-up">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-blue-50 dark:bg-blue-500/5 rounded-2xl p-6 border border-blue-100 dark:border-blue-500/10">
                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Items Affected</p>
                    <p className="text-3xl font-black text-blue-900 dark:text-white">{previewData.item_count}</p>
                    <p className="text-xs text-blue-500 mt-2">New price versions will be created</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-500/5 rounded-2xl p-6 border border-amber-100 dark:border-amber-500/10">
                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Flagged Items</p>
                    <p className="text-3xl font-black text-amber-900 dark:text-white">{previewData.flagged_count}</p>
                    <p className="text-xs text-amber-500 mt-2">Falling below {formData.minimum_margin_floor}% margin floor</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-500/5 rounded-2xl p-6 border border-green-100 dark:border-green-500/10">
                    <p className="text-xs font-bold text-green-600 dark:text-green-500 uppercase tracking-widest mb-1">Status</p>
                    <p className="text-xl font-bold text-green-900 dark:text-white">Validation Passed</p>
                    <p className="text-xs text-green-500 mt-2">No overlapping versions detected</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#15171e] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="p-4 bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Sample Data (Top 10)</h4>
                    <span className="text-[10px] text-gray-400 italic">Full report available after submission</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-400 border-b border-gray-200 dark:border-gray-800">
                          <th className="px-6 py-4 font-bold uppercase tracking-wider">SKU / Name</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Old Price</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">New Price</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Old Margin</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">New Margin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {previewData.sample.map((row: any, i: number) => (
                          <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${row.new_margin < formData.minimum_margin_floor ? 'bg-amber-50/50 dark:bg-amber-500/5' : ''}`}>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="text-gray-900 dark:text-white font-bold">{row.sku}</div>
                                <div className="text-gray-400 truncate max-w-[200px]">{row.name}</div>
                                {row.new_margin < formData.minimum_margin_floor && <AlertCircle size={14} className="text-amber-500" />}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right text-gray-500 font-mono">${row.old_price.toFixed(2)}</td>
                            <td className="px-6 py-4 text-right text-blue-600 dark:text-blue-400 font-black font-mono">${row.new_price.toFixed(2)}</td>
                            <td className="px-6 py-4 text-right text-gray-500 font-mono">{row.old_margin.toFixed(1)}%</td>
                            <td className={`px-6 py-4 text-right font-black font-mono ${row.new_margin < formData.minimum_margin_floor ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                              {row.new_margin.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-6 flex items-start gap-4">
                  <div className="bg-amber-100 dark:bg-amber-500/20 p-2.5 rounded-xl text-amber-600 dark:text-amber-400 shrink-0">
                    <Info size={20} />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-amber-900 dark:text-amber-400 mb-1">Important Consideration</h5>
                    <p className="text-xs text-amber-800 dark:text-amber-500/80 leading-relaxed">
                      This schedule <strong>does not modify</strong> any existing prices. It creates new date-effective versions. 
                      Full pricing history is preserved and auditable.
                    </p>
                  </div>
                </div>

                <div className="pt-8 border-t border-gray-100 dark:border-gray-800 flex justify-between">
                  <button 
                    onClick={() => setStep(1)}
                    className="bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white px-8 py-4 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-all flex items-center gap-2"
                  >
                    <ChevronLeft size={18} /> Modify Configuration
                  </button>
                  <button 
                    onClick={handleSubmitForApproval}
                    disabled={isSubmitting}
                    className="bg-blue-600 text-white px-12 py-4 rounded-xl font-bold shadow-xl shadow-blue-600/20 hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
                  >
                    {isSubmitting ? 'Submitting...' : <>Submit for Approval <ArrowRight size={18} /></>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
