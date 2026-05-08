import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Check, Database, Flag, Hash, Package, RefreshCw, Ruler, SendHorizonal, SlidersHorizontal } from 'lucide-react';
import ItemRequestWizardShell, { WizardStep } from '../ItemRequestWizardShell';
import { ToastContainer, useToast } from '../ToastNotification';
import { getItemRequest } from '../../services/itemRequestService';
import {
  checkSapCode,
  getClassificationOptions,
  ItemDefinitionPayload,
  saveItemDefinition,
  SapCodeCheckResult,
} from '../../services/itemDefinitionService';
import { supabase } from '../../lib/supabaseClient';
import { generateShortName, generateItemCode, parseDescription } from '../../utils/itemNameGenerator';
import { ItemRequest } from '../../types';

const STEPS: WizardStep[] = [
  { id: 'classification', label: 'Classification' },
  { id: 'identity', label: 'Identity' },
  { id: 'physical', label: 'Physical Attributes' },
  { id: 'flags', label: 'System Flags' },
  { id: 'stock', label: 'Stock Levels' },
  { id: 'review', label: 'Review & Confirm' },
];

const EMPTY_FORM: ItemDefinitionPayload = {
  item_pool: '',
  item_catalog: '',
  item_type: '',
  category: '',
  sub_category: '',
  sap_item_code_raw: '',
  sap_item_code_norm: '',
  name: '',
  short_name: '',
  description: '',
  division: '',
  uom: 'EA',
  upq: 1,
  item_weight: null,
  item_size: '',
  item_colour: '',
  item_material: '',
  gsm: null,
  purchase_enabled: true,
  sale_enabled: true,
  target_bundle: false,
  target_linenhub: false,
  target_salesforce: false,
  rfid_flag: false,
  cog_flag: false,
  cog_customer: '',
  min_level: null,
  max_level: null,
  initial_stock_qty: null,
};

function RequestContext({ request, proposedCode }: { request: ItemRequest; proposedCode: string }) {
  return (
    <aside className="bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 space-y-4">
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Item Code</p>
        <p className="font-mono text-sm font-bold text-[var(--color-brand)]">{proposedCode || generateItemCode(request.item_description)}</p>
      </div>
      <div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Description</p>
        <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{request.item_description}</p>
      </div>
      <div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Reason</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{request.business_reason}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="rounded-lg bg-gray-100 dark:bg-gray-800 px-2 py-1 font-bold text-gray-500">{request.request_type.replaceAll('_', ' ')}</span>
        <span className="rounded-lg bg-gray-100 dark:bg-gray-800 px-2 py-1 font-bold text-gray-500">{request.is_urgent ? 'Urgent' : 'Standard'}</span>
      </div>
    </aside>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 block">
      <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{label}</span>
      {hint && <span className="block text-[10px] text-gray-400 -mt-1">{hint}</span>}
      {children}
    </label>
  );
}

const inputClass = 'w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]';

function NumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))}
      className={inputClass}
      placeholder={placeholder}
    />
  );
}

export default function ItemDefinitionWizard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toasts, dismissToast, success, error: toastError } = useToast();

  const [request, setRequest] = useState<ItemRequest | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState<ItemDefinitionPayload>(EMPTY_FORM);
  const [options, setOptions] = useState({
    itemPools: [] as string[],
    itemCatalogs: {} as Record<string, string[]>,
    itemTypes: {} as Record<string, string[]>,
    categories: {} as Record<string, string[]>,
    subCategories: {} as Record<string, string[]>,
  });
  const [sapCheck, setSapCheck] = useState<SapCodeCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [procurementReviewSent, setProcurementReviewSent] = useState(false);
  // Track which system flags came from the original request so we can show context
  const [requestFlags, setRequestFlags] = useState({ bundle: false, linenhub: false, salesforce: false });

  const update = (partial: Partial<ItemDefinitionPayload>) => {
    setForm(prev => ({ ...prev, ...partial }));
  };

  const regenerateShortName = () => {
    if (!form.description) return;
    const sn = generateShortName(form.description);
    update({ short_name: sn, name: sn.slice(0, 40) });
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      setIsLoading(true);
      try {
        const [loadedRequest, loadedOptions] = await Promise.all([
          getItemRequest(id),
          getClassificationOptions(),
        ]);
        if (!loadedRequest) throw new Error('Request not found.');
        if (cancelled) return;

        // Parse physical attributes from description
        const parsed = parseDescription(loadedRequest.item_description);
        const shortName = generateShortName(loadedRequest.item_description);

        setRequest(loadedRequest);
        setOptions(loadedOptions);
        setRequestFlags({
          bundle: loadedRequest.target_bundle,
          linenhub: loadedRequest.target_linenhub,
          salesforce: loadedRequest.target_salesforce,
        });

        // ── Classification pre-population ──────────────────────────────────────
        // Match department label (e.g. "Accommodation") to a catalog entry
        const dept = (loadedRequest.department ?? '').toLowerCase();
        let matchPool = '';
        let matchCatalog = '';
        if (dept) {
          outer: for (const [pool, catalogs] of Object.entries(loadedOptions.itemCatalogs)) {
            for (const cat of catalogs) {
              if (cat.toLowerCase().includes(dept) || dept.includes(cat.toLowerCase())) {
                matchPool    = pool;
                matchCatalog = cat;
                break outer;
              }
            }
          }
        }

        // SAP code = proposed item code from description + wizard metadata
        const meta = (loadedRequest.metadata ?? {}) as Record<string, unknown>;
        const proposedCode = generateItemCode(loadedRequest.item_description);

        // UOM / UPQ from wizard metadata (overrides defaults if available)
        const metaUom = typeof meta.uom === 'string' ? meta.uom : 'EA';
        const metaUpq = typeof meta.upq === 'string' || typeof meta.upq === 'number' ? Number(meta.upq) : 1;

        setForm(prev => ({
          ...prev,
          // Classification
          item_pool:    matchPool,
          item_catalog: matchCatalog,
          // Identity
          description: loadedRequest.item_description,
          sap_item_code_raw: proposedCode,
          short_name: shortName,
          name: shortName.slice(0, 40),
          division: matchCatalog || loadedRequest.department || '',
          // Physical attributes: prefer wizard metadata, fall back to description parsing
          item_colour:   (typeof meta.colourCode === 'string' && meta.colourCode ? meta.colourCode : parsed.colour) ?? '',
          item_material: (typeof meta.material   === 'string' && meta.material   ? meta.material   : parsed.material) ?? '',
          item_size:     parsed.dimensions ?? (meta.width_cm && meta.height_cm ? `${meta.width_cm}x${meta.height_cm}cm` : ''),
          gsm:           (typeof meta.gsm === 'number' && meta.gsm > 0) ? meta.gsm : parsed.gsm,
          uom:           metaUom,
          upq:           metaUpq,
          rfid_flag:     typeof meta.rfid === 'boolean' ? meta.rfid : false,
          // System flags from request
          target_bundle: loadedRequest.target_bundle,
          target_linenhub: loadedRequest.target_linenhub,
          target_salesforce: loadedRequest.target_salesforce,
          cog_flag: loadedRequest.request_type === 'COG',
          cog_customer: loadedRequest.customer_reference ?? '',
          purchase_enabled: ['PURCHASE_AND_SALE', 'PURCHASE_ONLY', 'REPLACEMENT', 'CUSTOMER_SPECIFIC', 'SHARED_CATALOGUE'].includes(loadedRequest.request_type),
          sale_enabled: ['PURCHASE_AND_SALE', 'SALE_ONLY', 'REPLACEMENT', 'CUSTOMER_SPECIFIC', 'SHARED_CATALOGUE'].includes(loadedRequest.request_type),
        }));
      } catch (err) {
        toastError(err instanceof Error ? err.message : 'Failed to load item definition.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id, toastError]);

  const proposedItemCode = useMemo(
    () => form.sap_item_code_raw || (form.description ? generateItemCode(form.description) : ''),
    [form.sap_item_code_raw, form.description]
  );

  const catalogOptions = options.itemCatalogs[form.item_pool] ?? [];
  const typeOptions = options.itemTypes[form.item_catalog] ?? [];
  const categoryOptions = options.categories[form.item_type] ?? [];
  const subCategoryOptions = options.subCategories[form.category] ?? [];

  const validationError = useMemo(() => {
    if (activeStep === 0) {
      if (!form.item_pool || !form.item_catalog || !form.item_type || !form.category || !form.sub_category) {
        return 'Complete the classification cascade.';
      }
    }
    if (activeStep === 1) {
      if (!form.sap_item_code_raw || !form.name || !form.description) {
        return 'Complete the SAP item code, description, and display name.';
      }
      if (sapCheck?.isDuplicate) return 'SAP item code already exists.';
    }
    if (activeStep === 3 && form.cog_flag && !form.cog_customer.trim()) {
      return 'COG customer is required when the COG flag is enabled.';
    }
    if (activeStep === 4 && form.max_level !== null && form.min_level !== null && form.max_level < form.min_level) {
      return 'Max level cannot be lower than min/par level.';
    }
    return null;
  }, [activeStep, form, sapCheck]);

  const handleSapBlur = async () => {
    if (!form.sap_item_code_raw.trim()) return;
    try {
      const result = await checkSapCode(form.sap_item_code_raw);
      setSapCheck(result);
      update({ sap_item_code_norm: result.normalized });
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'SAP duplicate check failed.');
    }
  };

  const handleContinue = async () => {
    if (validationError) {
      toastError(validationError);
      return;
    }
    if (activeStep < STEPS.length - 1) {
      setActiveStep(prev => prev + 1);
      return;
    }

    if (!request) return;
    setIsSaving(true);
    try {
      const result = await saveItemDefinition(form, request.id, request.request_type);
      success(`Item definition saved. Request moved to ${result.nextStatus.replaceAll('_', ' ')}.`);
      navigate('/items/master-data-queue');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to save item definition.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <ItemRequestWizardShell
        title="Item Definition"
        subtitle="Complete master data attributes for the requested item"
        steps={STEPS}
        activeStepIndex={activeStep}
        onContinue={handleContinue}
        onPrevious={activeStep > 0 ? () => setActiveStep(prev => prev - 1) : undefined}
        onCancel={() => navigate('/items/master-data-queue')}
        continueLabel={activeStep === STEPS.length - 1 ? 'Save Definition' : 'Continue'}
        continueDisabled={isSaving || isLoading}
        isSaving={isSaving}
        isLoading={isLoading}
        contextPanel={request ? <RequestContext request={request} proposedCode={proposedItemCode} /> : undefined}
      >
        {/* Step 0 — Classification */}
        {activeStep === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Classification</h2>
              <p className="text-sm text-gray-500 mt-1">Each selection narrows the next dropdown.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Item Pool">
                <select className={inputClass} value={form.item_pool} onChange={event => update({ item_pool: event.target.value, item_catalog: '', item_type: '', category: '', sub_category: '' })}>
                  <option value="">Select pool</option>
                  {options.itemPools.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </Field>
              <Field label="Catalogue">
                <select className={inputClass} value={form.item_catalog} onChange={event => update({ item_catalog: event.target.value, item_type: '', category: '', sub_category: '' })}>
                  <option value="">Select catalogue</option>
                  {catalogOptions.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </Field>
              <Field label="Type">
                <select className={inputClass} value={form.item_type} onChange={event => update({ item_type: event.target.value, category: '', sub_category: '' })}>
                  <option value="">Select type</option>
                  {typeOptions.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </Field>
              <Field label="Category">
                <select className={inputClass} value={form.category} onChange={event => update({ category: event.target.value, sub_category: '' })}>
                  <option value="">Select category</option>
                  {categoryOptions.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </Field>
              <Field label="Sub-Category">
                <select className={inputClass} value={form.sub_category} onChange={event => update({ sub_category: event.target.value })}>
                  <option value="">Select sub-category</option>
                  {subCategoryOptions.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </Field>
            </div>
          </div>
        )}

        {/* Step 1 — Identity */}
        {activeStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Identity</h2>
              <p className="text-sm text-gray-500 mt-1">The SAP code has been generated from the item's attributes — verify and confirm the naming.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="SAP Item Code" hint="Pre-generated from item attributes — edit only if SAP requires a different code">
                <input className={inputClass} value={form.sap_item_code_raw} onChange={event => update({ sap_item_code_raw: event.target.value, sap_item_code_norm: '' })} onBlur={handleSapBlur} placeholder="e.g. BLASHQ01W500" />
              </Field>
              <Field label="Division" hint="Pre-set from the item's catalogue — edit if needed">
                <input className={inputClass} value={form.division} onChange={event => update({ division: event.target.value })} placeholder="e.g. Accommodation" />
              </Field>
              <Field label="Full Description" hint="Pre-populated from request — edit only if needed">
                <textarea className={`${inputClass} min-h-28`} value={form.description} onChange={event => update({ description: event.target.value })} />
              </Field>
              <div className="space-y-4">
                <Field label="Short Name" hint="Auto-generated search name (≤60 chars) — used for catalogue search">
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      maxLength={60}
                      value={form.short_name}
                      onChange={event => update({ short_name: event.target.value, name: event.target.value.slice(0, 40) })}
                      placeholder="e.g. Cotton Terry Towel 500gsm White"
                    />
                    <button
                      type="button"
                      onClick={regenerateShortName}
                      title="Regenerate from description"
                      className="shrink-0 w-10 h-10 mt-0.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#15171e] flex items-center justify-center text-gray-400 hover:text-[var(--color-brand)] hover:border-[var(--color-brand)] transition-all"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </Field>
                <Field label="Display Name" hint="Auto-set from short name (≤40 chars) — shown in lists and tiles">
                  <input className={inputClass} maxLength={40} value={form.name} onChange={event => update({ name: event.target.value })} />
                </Field>
              </div>
            </div>
            {sapCheck && (
              <div className={`flex items-start gap-3 p-4 rounded-2xl border ${sapCheck.isDuplicate ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                {sapCheck.isDuplicate ? <AlertCircle size={18} /> : <Check size={18} />}
                <p className="text-sm font-medium">
                  {sapCheck.isDuplicate ? `Duplicate found: ${sapCheck.existingItemName}` : 'Code verified — available for use.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 2 — Physical Attributes */}
        {activeStep === 2 && (() => {
          const missingFields: string[] = [];
          if (!form.item_weight) missingFields.push('Weight (kg)');
          if (!form.gsm) missingFields.push('GSM');
          if (!form.item_size) missingFields.push('Dimensions');
          if (!form.uom || form.uom === 'EA') {} // EA is a valid default
          const hasMissing = missingFields.length > 0;

          const handleRequestFromProcurement = async () => {
            if (!request) return;
            try {
              const existingMeta = (request.metadata ?? {}) as Record<string, unknown>;
              await supabase.from('item_requests').update({
                metadata: {
                  ...existingMeta,
                  procurement_review_pending: true,
                  procurement_missing_fields: missingFields,
                },
              }).eq('id', request.id);
              setProcurementReviewSent(true);
              success('Procurement team notified. Proceeding to next step.');
              setActiveStep(prev => prev + 1);
            } catch {
              toastError('Failed to flag for procurement review. Please try again.');
            }
          };

          return (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white">Physical Attributes</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Pre-populated from the item creation wizard — verify and adjust as needed.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="UOM"><input className={inputClass} value={form.uom} onChange={event => update({ uom: event.target.value })} /></Field>
                <Field label="UPQ"><NumberInput value={form.upq} onChange={value => update({ upq: value })} /></Field>
                <Field label="Weight (kg)"><NumberInput value={form.item_weight} onChange={value => update({ item_weight: value })} placeholder="e.g. 0.5" /></Field>
                <Field label="Size / Dimensions" hint="e.g. 70x140cm"><input className={inputClass} value={form.item_size} onChange={event => update({ item_size: event.target.value })} placeholder="e.g. 70x140cm" /></Field>
                <Field label="Colour"><input className={inputClass} value={form.item_colour} onChange={event => update({ item_colour: event.target.value })} placeholder="e.g. White" /></Field>
                <Field label="Material"><input className={inputClass} value={form.item_material} onChange={event => update({ item_material: event.target.value })} placeholder="e.g. Cotton" /></Field>
                <Field label="GSM"><NumberInput value={form.gsm} onChange={value => update({ gsm: value })} placeholder="e.g. 500" /></Field>
              </div>

              {hasMissing && !procurementReviewSent && (
                <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Missing physical attributes</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                        The following attributes were not provided during item creation and may be needed:
                        <span className="font-bold ml-1">{missingFields.join(', ')}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRequestFromProcurement}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-md shadow-amber-500/20"
                  >
                    <SendHorizonal size={13} />
                    Request from Procurement & Continue
                  </button>
                  <p className="text-[11px] text-amber-600 dark:text-amber-500">
                    This will notify the procurement team to supply the missing details, flag the request under the Procurement Review tab, and advance you to the next step.
                  </p>
                </div>
              )}
              {procurementReviewSent && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/8 border border-emerald-200 dark:border-emerald-500/20">
                  <Check size={16} className="text-emerald-500 shrink-0" />
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Procurement team notified — the request is flagged for review.</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* Step 3 — System Flags */}
        {activeStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">System Flags</h2>
              <p className="text-sm text-gray-500 mt-1">
                Target systems and transaction types are pre-set from the original request. Confirm or adjust if needed.
              </p>
            </div>

            {/* Transaction flags — derived from request type */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Transaction Type <span className="normal-case font-normal text-gray-400">(from request type)</span></p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {([
                  ['purchase_enabled', 'Purchase Enabled'],
                  ['sale_enabled', 'Sale Enabled'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => update({ [key]: !form[key] } as Partial<ItemDefinitionPayload>)}
                    className={`p-4 rounded-2xl border text-left font-bold transition-all ${form[key] ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 text-[var(--color-brand)]' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] text-gray-700 dark:text-gray-300'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target systems — pre-populated from request */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Target Systems <span className="normal-case font-normal text-gray-400">(pre-set from request — adjust if classification changes scope)</span></p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {([
                  ['target_bundle', 'Bundle', requestFlags.bundle],
                  ['target_linenhub', 'LinenHub', requestFlags.linenhub],
                  ['target_salesforce', 'Salesforce', requestFlags.salesforce],
                ] as const).map(([key, label, fromRequest]) => (
                  <button
                    key={key}
                    onClick={() => update({ [key]: !form[key as keyof ItemDefinitionPayload] } as Partial<ItemDefinitionPayload>)}
                    className={`p-4 rounded-2xl border text-left transition-all ${form[key as keyof ItemDefinitionPayload] ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 text-[var(--color-brand)]' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] text-gray-700 dark:text-gray-300'}`}
                  >
                    <p className="font-bold">{label}</p>
                    {fromRequest && <p className="text-[10px] opacity-60 mt-0.5">Requested by originator</p>}
                  </button>
                ))}
              </div>
            </div>

            {/* Special flags */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Special Flags</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {([
                  ['rfid_flag', 'RFID Tracked'],
                  ['cog_flag', 'Customer-Owned Goods (COG)'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => update({ [key]: !form[key] } as Partial<ItemDefinitionPayload>)}
                    className={`p-4 rounded-2xl border text-left font-bold transition-all ${form[key] ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 text-[var(--color-brand)]' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] text-gray-700 dark:text-gray-300'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {form.cog_flag && (
              <Field label="COG Customer">
                <input className={inputClass} value={form.cog_customer} onChange={event => update({ cog_customer: event.target.value })} />
              </Field>
            )}
          </div>
        )}

        {/* Step 4 — Stock Levels */}
        {activeStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Stock Levels</h2>
              <p className="text-sm text-gray-500 mt-1">Set initial stock controls where applicable. Leave blank if not managed.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Min/Par Level"><NumberInput value={form.min_level} onChange={value => update({ min_level: value })} /></Field>
              <Field label="Max Level"><NumberInput value={form.max_level} onChange={value => update({ max_level: value })} /></Field>
              <Field label="Initial Quantity"><NumberInput value={form.initial_stock_qty} onChange={value => update({ initial_stock_qty: value })} /></Field>
            </div>
          </div>
        )}

        {/* Step 5 — Review */}
        {activeStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Review and confirm</h2>
              <p className="text-sm text-gray-500 mt-1">Saving will create the inactive item record and advance the request.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                [Database, 'Classification', `${form.item_pool} / ${form.item_catalog} / ${form.item_type} / ${form.category} / ${form.sub_category}`],
                [Hash, 'Identity', `${form.sap_item_code_norm} — ${form.short_name || form.name}`],
                [Ruler, 'Physical', `${form.uom}, UPQ ${form.upq ?? 0}, ${form.item_colour || 'no colour'}, ${form.item_material || 'no material'}${form.gsm ? `, ${form.gsm}gsm` : ''}`],
                [Flag, 'Flags', `${form.purchase_enabled ? 'Purchase' : ''} ${form.sale_enabled ? 'Sale' : ''} ${form.cog_flag ? 'COG' : ''}`.trim() || 'No transaction flags'],
                [SlidersHorizontal, 'Stock', `Min ${form.min_level ?? 0}, Max ${form.max_level ?? 0}, Initial ${form.initial_stock_qty ?? 0}`],
                [Package, 'Next Stage', form.purchase_enabled || form.sale_enabled ? 'Pricing Review' : 'Approval Pending'],
              ].map(([Icon, label, value]) => {
                const DisplayIcon = Icon as typeof Package;
                return (
                  <div key={label as string} className="p-5 bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-800 rounded-2xl">
                    <DisplayIcon size={18} className="text-[var(--color-brand)] mb-3" />
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{label as string}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">{value as string}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </ItemRequestWizardShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
