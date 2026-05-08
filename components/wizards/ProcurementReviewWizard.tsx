import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import ItemRequestWizardShell, { WizardStep } from '../ItemRequestWizardShell';
import { transitionRequest } from '../../services/itemWorkflowService';
import { useToast, ToastContainer } from '../ToastNotification';
import { AlertCircle, Check } from 'lucide-react';

const STEPS: WizardStep[] = [
  { id: 'summary',  label: 'Request Summary', description: 'Review what was submitted' },
  { id: 'details',  label: 'Complete Details', description: 'Fill in any missing technical data' },
  { id: 'forward',  label: 'Confirm & Forward', description: 'Send to Master Data for final QA' },
];

const UOM_OPTIONS = ['EA', 'DZ', 'PAR', 'SET', 'PKT', 'KG', 'M'];
const MATERIALS = ['100% Cotton', 'Polyester / Cotton Blend', '100% Polyester', 'Bamboo Blend', 'Microfibre', 'Terry', 'Fleece', 'Other'];
const GRADES = ['Hotel Grade', 'Premium Hotel Grade', 'Commercial Grade', 'Economy Grade', 'Healthcare Grade', 'Other'];

const ProcurementReviewWizard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toasts, dismissToast, success: showSuccess, error: showError } = useToast();
  const [activeStep, setActiveStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [request, setRequest] = useState<any>(null);

  // Editable fields
  const [gsm, setGsm] = useState('');
  const [uom, setUom] = useState('EA');
  const [upq, setUpq] = useState('1');
  const [material, setMaterial] = useState('');
  const [grade, setGrade] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    supabase.from('item_requests').select('*').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) { showError('Request not found'); navigate(-1); return; }
        setRequest(data);
        // Pre-populate from existing data
        setGsm(data.spec_gsm ? String(data.spec_gsm) : '');
        setUom(data.spec_uom || 'EA');
        setUpq(data.spec_upq ? String(data.spec_upq) : '1');
        setMaterial(data.spec_material || '');
        setGrade(data.spec_grade || '');
        setWidthCm(data.spec_width_cm ? String(data.spec_width_cm) : '');
        setHeightCm(data.spec_height_cm ? String(data.spec_height_cm) : '');
        setNotes(data.spec_notes || '');
        setIsLoading(false);
      });
  }, [id]);

  const handleContinue = async () => {
    if (activeStep < 2) { setActiveStep(s => s + 1); return; }
    // Final step: save updates and transition status
    setIsSaving(true);
    try {
      await supabase.from('item_requests').update({
        spec_gsm: gsm ? parseInt(gsm) : null,
        spec_uom: uom,
        spec_upq: upq ? parseInt(upq) : 1,
        spec_material: material,
        spec_grade: grade,
        spec_width_cm: widthCm ? parseFloat(widthCm) : null,
        spec_height_cm: heightCm ? parseFloat(heightCm) : null,
        spec_notes: notes,
        procurement_reviewed_at: new Date().toISOString(),
      }).eq('id', id!);
      await transitionRequest(id!, 'DATA_REVIEW', { notes: 'Procurement review completed — forwarded to Master Data' });
      showSuccess('Request forwarded to Master Data');
      navigate('/items/master-data-queue');
    } catch (e: any) {
      showError(e.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const validate = () => {
    if (activeStep === 1 && !material) return true; // block if material not selected
    return false;
  };

  // Step 1: Request Summary (read-only)
  const step1 = request ? (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-gray-900 dark:text-white">Request Summary</h2>
        <p className="text-sm text-gray-500 mt-1">Review what was submitted before filling in technical details.</p>
      </div>
      <div className="bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
        {[
          { label: 'Proposed Code', value: request.proposed_code || request.item_code || '—' },
          { label: 'Description', value: request.description || request.item_description || '—' },
          { label: 'Transaction Type', value: request.request_type || '—' },
          { label: 'Business Reason', value: request.business_reason || '—' },
          { label: 'Material', value: request.spec_material || 'Not provided' },
          { label: 'GSM', value: request.spec_gsm ? `${request.spec_gsm} g/m²` : 'Not provided' },
          { label: 'UOM', value: request.spec_uom || 'Not provided' },
          { label: 'UPQ', value: request.spec_upq ? String(request.spec_upq) : 'Not provided' },
        ].map(row => (
          <div key={row.label} className="flex items-start gap-4 px-5 py-3.5">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest w-32 shrink-0 pt-0.5">{row.label}</span>
            <span className={`text-sm ${row.value === 'Not provided' ? 'text-amber-500 italic' : 'text-gray-900 dark:text-white font-medium'}`}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  // Step 2: Complete Details
  const step2 = (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-gray-900 dark:text-white">Complete Technical Details</h2>
        <p className="text-sm text-gray-500 mt-1">Fill in any missing information so Master Data can do a final QA check.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Material */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Material <span className="text-red-500">*</span></label>
          <div className="flex flex-wrap gap-2">
            {MATERIALS.map(m => (
              <button key={m} type="button" onClick={() => setMaterial(m)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${material === m ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 text-[var(--color-brand)] font-bold' : 'border-gray-200 dark:border-gray-700 text-gray-600 hover:border-gray-300'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
        {/* GSM */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Weight / GSM <span className="font-normal normal-case text-gray-400">— optional</span></label>
          <div className="flex items-center gap-2">
            <input type="text" inputMode="numeric" value={gsm} onChange={e => setGsm(e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 500"
              className="flex-1 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]" />
            <span className="text-xs text-gray-400 shrink-0">g/m²</span>
          </div>
        </div>
        {/* UOM */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Unit of Measure (UOM)</label>
          <div className="flex flex-wrap gap-2">
            {UOM_OPTIONS.map(u => (
              <button key={u} type="button" onClick={() => setUom(u)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${uom === u ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 text-[var(--color-brand)]' : 'border-gray-200 dark:border-gray-700 text-gray-600 hover:border-gray-300'}`}>
                {u}
              </button>
            ))}
          </div>
        </div>
        {/* UPQ */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Units Per Qty (UPQ)</label>
          <input type="text" inputMode="numeric" value={upq} onChange={e => setUpq(e.target.value.replace(/[^0-9]/g, '') || '1')} placeholder="1"
            className="w-28 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]" />
        </div>
        {/* Dimensions */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Dimensions <span className="font-normal normal-case text-gray-400">— optional</span></label>
          <div className="flex items-center gap-2">
            <input type="text" value={widthCm} onChange={e => setWidthCm(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Width"
              className="flex-1 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]" />
            <span className="text-gray-400">x</span>
            <input type="text" value={heightCm} onChange={e => setHeightCm(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Length"
              className="flex-1 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]" />
            <span className="text-xs text-gray-400 shrink-0">cm</span>
          </div>
        </div>
        {/* Grade */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Grade / Standard</label>
          <div className="flex flex-wrap gap-2">
            {GRADES.map(g => (
              <button key={g} type="button" onClick={() => setGrade(g)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${grade === g ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 text-[var(--color-brand)] font-bold' : 'border-gray-200 dark:border-gray-700 text-gray-600 hover:border-gray-300'}`}>
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Additional notes */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Additional Notes <span className="font-normal normal-case text-gray-400">(optional)</span></label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any additional procurement notes…"
          className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] resize-none" />
      </div>
    </div>
  );

  // Step 3: Confirm & Forward
  const step3 = (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-gray-900 dark:text-white">Confirm & Forward to Master Data</h2>
        <p className="text-sm text-gray-500 mt-1">Once forwarded, Master Data will do a final QA review. You won't be able to edit after this point.</p>
      </div>
      <div className="bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
        {[
          { label: 'Material', value: material || '—' },
          { label: 'GSM', value: gsm ? `${gsm} g/m²` : 'Not provided' },
          { label: 'UOM', value: uom },
          { label: 'UPQ', value: upq },
          { label: 'Dimensions', value: widthCm && heightCm ? `${widthCm} x ${heightCm} cm` : '—' },
          { label: 'Grade', value: grade || '—' },
        ].map(row => (
          <div key={row.label} className="flex items-start gap-4 px-5 py-3.5">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest w-28 shrink-0 pt-0.5">{row.label}</span>
            <span className="text-sm text-gray-900 dark:text-white font-medium">{row.value}</span>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-3 p-4 rounded-xl border-2 border-[var(--color-brand)]/20 bg-[var(--color-brand)]/5">
        <Check size={16} className="text-[var(--color-brand)] shrink-0 mt-0.5" />
        <p className="text-sm text-gray-700 dark:text-gray-300">
          By forwarding, you confirm the technical details are complete and accurate. Master Data will do a final review before the item is activated.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <ItemRequestWizardShell
        title="Procurement Review"
        subtitle="Complete technical details for Master Data handover"
        steps={STEPS}
        activeStepIndex={activeStep}
        onContinue={handleContinue}
        onPrevious={activeStep > 0 ? () => setActiveStep(s => s - 1) : undefined}
        onCancel={() => navigate('/items/master-data-queue')}
        continueDisabled={validate()}
        isSaving={isSaving}
        isLoading={isLoading}
        continueLabel={activeStep === 2 ? 'Forward to Master Data' : undefined}
      >
        {activeStep === 0 && step1}
        {activeStep === 1 && step2}
        {activeStep === 2 && step3}
      </ItemRequestWizardShell>
    </>
  );
};

export default ProcurementReviewWizard;
