import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, DollarSign, Package, ReceiptText, ShieldAlert, ShoppingCart, Truck } from 'lucide-react';
import ItemRequestWizardShell, { WizardStep } from '../ItemRequestWizardShell';
import { ToastContainer, useToast } from '../ToastNotification';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabaseClient';
import { getItemRequest } from '../../services/itemRequestService';
import { checkDateOverlap, createPurchasePrice } from '../../services/purchasePricingService';
import { createSellPrice, getMarginThreshold } from '../../services/sellPricingService';
import { transitionRequest } from '../../services/itemWorkflowService';
import { triggerApprovalEngine } from '../../services/approvalEngineService';
import { ItemRequest, SellPriceType } from '../../types';

interface PricingItem {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  uom: string;
  specs?: {
    purchase_enabled?: boolean;
    sale_enabled?: boolean;
    target_bundle?: boolean;
    target_linenhub?: boolean;
    target_salesforce?: boolean;
    [key: string]: unknown;
  };
}

interface PurchasePricingData {
  supplier_id: string;
  supplier_item_code: string;
  purchase_uom: string;
  purchase_price_ex_gst: number;
  currency: string;
  moq: number;
  lead_time_days: number;
  freight_handling_cost: number;
  effective_from: string;
  effective_to: string;
}

interface SalePricingData {
  price_type: SellPriceType;
  sale_uom: string;
  sell_price_ex_gst: number;
  tax_code: string;
  publish_to_salesforce: boolean;
  publish_to_bundle: boolean;
  publish_to_linenhub: boolean;
  effective_from: string;
  effective_to: string;
  notes: string;
}

const today = () => new Date().toISOString().split('T')[0];

function buildSteps(purchaseEnabled: boolean, saleEnabled: boolean): WizardStep[] {
  return [
    { id: 'context', label: 'Context' },
    ...(purchaseEnabled ? [{ id: 'purchase', label: 'Purchase Pricing' }] : []),
    ...(saleEnabled ? [{ id: 'sale', label: 'Sale Pricing' }] : []),
    ...(purchaseEnabled && saleEnabled ? [{ id: 'margin', label: 'Margin Review' }] : []),
    { id: 'confirm', label: 'Confirm & Submit' },
  ];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 block">
      <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{label}</span>
      {children}
    </label>
  );
}

const inputClass = 'w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]';

function NumberInput({
  value,
  onChange,
  min = 0,
  step = '0.01',
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: string;
}) {
  return (
    <input
      type="number"
      value={value || ''}
      min={min}
      step={step}
      onChange={event => onChange(Number(event.target.value) || 0)}
      className={inputClass}
    />
  );
}

function ContextPanel({ request, item }: { request: ItemRequest; item: PricingItem }) {
  return (
    <aside className="bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-2xl p-5 space-y-4">
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pricing Request</p>
        <p className="font-mono text-sm font-bold text-[var(--color-brand)]">{request.request_number}</p>
      </div>
      <div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Item</p>
        <p className="text-sm font-bold text-gray-900 dark:text-white">{item.sku} - {item.name}</p>
        <p className="text-xs text-gray-500 mt-1">{item.category || 'Uncategorised'} / {item.uom || 'EA'}</p>
      </div>
      <div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Request Type</p>
        <p className="text-sm text-gray-500">{request.request_type.replaceAll('_', ' ')}</p>
      </div>
    </aside>
  );
}

export default function PricingSetupWizard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission, suppliers } = useApp();
  const { toasts, dismissToast, success, error: toastError } = useToast();

  const [request, setRequest] = useState<ItemRequest | null>(null);
  const [item, setItem] = useState<PricingItem | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [marginThreshold, setMarginThreshold] = useState(25);

  const [purchase, setPurchase] = useState<PurchasePricingData>({
    supplier_id: '',
    supplier_item_code: '',
    purchase_uom: 'EA',
    purchase_price_ex_gst: 0,
    currency: 'AUD',
    moq: 1,
    lead_time_days: 0,
    freight_handling_cost: 0,
    effective_from: today(),
    effective_to: '',
  });

  const [sale, setSale] = useState<SalePricingData>({
    price_type: 'STANDARD',
    sale_uom: 'EA',
    sell_price_ex_gst: 0,
    tax_code: 'GST',
    publish_to_salesforce: false,
    publish_to_bundle: false,
    publish_to_linenhub: false,
    effective_from: today(),
    effective_to: '',
    notes: '',
  });

  const canManagePricing = hasPermission('manage_sell_pricing') || hasPermission('manage_purchase_pricing');
  const purchaseEnabled = item?.specs?.purchase_enabled !== false;
  const saleEnabled = item?.specs?.sale_enabled !== false;
  const steps = useMemo(() => buildSteps(purchaseEnabled, saleEnabled), [purchaseEnabled, saleEnabled]);
  const stepId = steps[activeStep]?.id ?? 'context';
  const landedCost = purchase.purchase_price_ex_gst + purchase.freight_handling_cost;
  const costBasis = purchaseEnabled ? landedCost : 0;
  const marginPercent = sale.sell_price_ex_gst > 0 ? ((sale.sell_price_ex_gst - costBasis) / sale.sell_price_ex_gst) * 100 : 0;
  const isBelowThreshold = saleEnabled && sale.sell_price_ex_gst > 0 && marginPercent < marginThreshold;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      setIsLoading(true);
      try {
        const loadedRequest = await getItemRequest(id);
        if (!loadedRequest) throw new Error('Request not found.');
        if (!loadedRequest.resulting_item_id) throw new Error('Request does not have a defined item yet.');

        const [{ data: loadedItem, error: itemError }, threshold] = await Promise.all([
          supabase.from('items').select('*').eq('id', loadedRequest.resulting_item_id).single(),
          getMarginThreshold(),
        ]);
        if (itemError || !loadedItem) throw new Error(itemError?.message ?? 'Item not found.');
        if (cancelled) return;

        const pricingItem = loadedItem as PricingItem;
        setRequest(loadedRequest);
        setItem(pricingItem);
        setMarginThreshold(threshold);
        setPurchase(prev => ({ ...prev, purchase_uom: pricingItem.uom || 'EA' }));
        setSale(prev => ({
          ...prev,
          sale_uom: pricingItem.uom || 'EA',
          publish_to_salesforce: Boolean(pricingItem.specs?.target_salesforce),
          publish_to_bundle: Boolean(pricingItem.specs?.target_bundle),
          publish_to_linenhub: Boolean(pricingItem.specs?.target_linenhub),
        }));
      } catch (err) {
        toastError(err instanceof Error ? err.message : 'Failed to load pricing wizard.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id, toastError]);

  const validateCurrentStep = async () => {
    if (stepId === 'purchase') {
      if (!purchase.supplier_id || purchase.purchase_price_ex_gst <= 0 || !purchase.purchase_uom || !purchase.effective_from) {
        return 'Complete supplier, purchase UOM, unit price, and effective date.';
      }
      if (item) {
        const overlap = await checkDateOverlap(
          item.id,
          purchase.supplier_id,
          purchase.purchase_uom,
          purchase.effective_from,
          purchase.effective_to || null
        );
        if (overlap) return 'A purchase price already overlaps this supplier, UOM, and date range.';
      }
    }
    if (stepId === 'sale') {
      if (!sale.price_type || sale.sell_price_ex_gst <= 0 || !sale.sale_uom || !sale.effective_from) {
        return 'Complete sale type, sale UOM, sell price, and effective date.';
      }
    }
    return null;
  };

  const saveAndSubmit = async () => {
    if (!request || !item) return;
    setIsSaving(true);
    try {
      if (purchaseEnabled) {
        await createPurchasePrice({
          item_id: item.id,
          supplier_id: purchase.supplier_id,
          supplier_item_code: purchase.supplier_item_code || undefined,
          purchase_price_ex_gst: purchase.purchase_price_ex_gst,
          currency: purchase.currency,
          purchase_uom: purchase.purchase_uom,
          pack_conversion_factor: 1,
          moq: purchase.moq || undefined,
          lead_time_days: purchase.lead_time_days || undefined,
          freight_handling_cost: purchase.freight_handling_cost,
          is_preferred_supplier: true,
          effective_from: purchase.effective_from,
          effective_to: purchase.effective_to || undefined,
          notes: 'Created from item pricing setup wizard.',
        });
      }

      if (saleEnabled) {
        await createSellPrice({
          item_id: item.id,
          price_type: sale.price_type,
          sale_uom: sale.sale_uom,
          sell_price_ex_gst: sale.sell_price_ex_gst,
          tax_code: sale.tax_code,
          cost_basis: costBasis,
          publish_to_salesforce: sale.publish_to_salesforce,
          publish_to_bundle: sale.publish_to_bundle,
          publish_to_linenhub: sale.publish_to_linenhub,
          effective_from: sale.effective_from,
          effective_to: sale.effective_to || undefined,
          notes: sale.notes || undefined,
        });
      }

      await transitionRequest(request.id, 'APPROVAL_PENDING', {
        notes: isBelowThreshold
          ? `Pricing submitted with margin ${marginPercent.toFixed(1)}%, below threshold ${marginThreshold}%.`
          : 'Pricing setup submitted.',
        metadata: {
          action: 'PRICING_SUBMITTED',
          item_id: item.id,
          purchase_enabled: purchaseEnabled,
          sale_enabled: saleEnabled,
          margin_percent: saleEnabled ? Number(marginPercent.toFixed(2)) : null,
          margin_threshold: marginThreshold,
          below_threshold: isBelowThreshold,
        },
      });
      await triggerApprovalEngine(request.id);
      success('Pricing submitted for approval.');
      navigate('/items/pricing-queue');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to submit pricing.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinue = async () => {
    const validation = await validateCurrentStep();
    if (validation) {
      toastError(validation);
      return;
    }
    if (activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1);
      return;
    }
    await saveAndSubmit();
  };

  if (!canManagePricing) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-20 text-center">
        <ShieldAlert size={48} className="mb-4 text-amber-500" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Access Restricted</h2>
        <p className="text-gray-500 mt-2">You need pricing permissions to complete this stage.</p>
      </div>
    );
  }

  return (
    <>
      <ItemRequestWizardShell
        title="Pricing Setup"
        subtitle="Set purchase and sale pricing before approval"
        steps={steps}
        activeStepIndex={activeStep}
        onContinue={handleContinue}
        onPrevious={activeStep > 0 ? () => setActiveStep(prev => prev - 1) : undefined}
        onCancel={() => navigate('/items/pricing-queue')}
        continueLabel={activeStep === steps.length - 1 ? 'Submit Pricing' : 'Continue'}
        continueDisabled={isSaving || isLoading}
        isSaving={isSaving}
        isLoading={isLoading}
        contextPanel={request && item ? <ContextPanel request={request} item={item} /> : undefined}
      >
        {item && stepId === 'context' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Pricing context</h2>
              <p className="text-sm text-gray-500 mt-1">Review the defined item before pricing is configured.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                [Package, 'Item', `${item.sku} - ${item.name}`],
                [ShoppingCart, 'Purchase Pricing', purchaseEnabled ? 'Required' : 'Not required'],
                [DollarSign, 'Sale Pricing', saleEnabled ? 'Required' : 'Not required'],
              ].map(([Icon, label, value]) => {
                const DisplayIcon = Icon as typeof Package;
                return (
                  <div key={label as string} className="p-5 bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-2xl">
                    <DisplayIcon size={18} className="text-[var(--color-brand)] mb-3" />
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{label as string}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">{value as string}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {stepId === 'purchase' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Purchase pricing</h2>
              <p className="text-sm text-gray-500 mt-1">Capture supplier cost, logistics, and effective dates.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Supplier">
                <select className={inputClass} value={purchase.supplier_id} onChange={event => setPurchase(prev => ({ ...prev, supplier_id: event.target.value }))}>
                  <option value="">Select supplier</option>
                  {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </Field>
              <Field label="Supplier Item Code">
                <input className={inputClass} value={purchase.supplier_item_code} onChange={event => setPurchase(prev => ({ ...prev, supplier_item_code: event.target.value }))} />
              </Field>
              <Field label="Purchase UOM">
                <input className={inputClass} value={purchase.purchase_uom} onChange={event => setPurchase(prev => ({ ...prev, purchase_uom: event.target.value }))} />
              </Field>
              <Field label="Currency">
                <select className={inputClass} value={purchase.currency} onChange={event => setPurchase(prev => ({ ...prev, currency: event.target.value }))}>
                  <option value="AUD">AUD</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </Field>
              <Field label="Unit Price ex-GST"><NumberInput value={purchase.purchase_price_ex_gst} onChange={value => setPurchase(prev => ({ ...prev, purchase_price_ex_gst: value }))} min={0.01} /></Field>
              <Field label="Freight / Handling"><NumberInput value={purchase.freight_handling_cost} onChange={value => setPurchase(prev => ({ ...prev, freight_handling_cost: value }))} /></Field>
              <Field label="MOQ"><NumberInput value={purchase.moq} onChange={value => setPurchase(prev => ({ ...prev, moq: value }))} step="1" /></Field>
              <Field label="Lead Time Days"><NumberInput value={purchase.lead_time_days} onChange={value => setPurchase(prev => ({ ...prev, lead_time_days: value }))} step="1" /></Field>
              <Field label="Effective From">
                <input type="date" className={inputClass} value={purchase.effective_from} onChange={event => setPurchase(prev => ({ ...prev, effective_from: event.target.value }))} />
              </Field>
              <Field label="Effective To">
                <input type="date" className={inputClass} value={purchase.effective_to} onChange={event => setPurchase(prev => ({ ...prev, effective_to: event.target.value }))} />
              </Field>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-3">
              <Truck size={18} className="text-emerald-600" />
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Landed cost preview: {purchase.currency} {landedCost.toFixed(2)}</p>
            </div>
          </div>
        )}

        {stepId === 'sale' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Sale pricing</h2>
              <p className="text-sm text-gray-500 mt-1">Set the sell price, tax treatment, publication targets, and dates.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Price Type">
                <select className={inputClass} value={sale.price_type} onChange={event => setSale(prev => ({ ...prev, price_type: event.target.value as SellPriceType }))}>
                  <option value="STANDARD">Standard</option>
                  <option value="GROUP">Group</option>
                  <option value="CUSTOMER_SPECIFIC">Customer-Specific</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="PROMOTIONAL">Promotional</option>
                </select>
              </Field>
              <Field label="Sale UOM">
                <input className={inputClass} value={sale.sale_uom} onChange={event => setSale(prev => ({ ...prev, sale_uom: event.target.value }))} />
              </Field>
              <Field label="Sell Price ex-GST"><NumberInput value={sale.sell_price_ex_gst} onChange={value => setSale(prev => ({ ...prev, sell_price_ex_gst: value }))} min={0.01} /></Field>
              <Field label="Tax Code">
                <select className={inputClass} value={sale.tax_code} onChange={event => setSale(prev => ({ ...prev, tax_code: event.target.value }))}>
                  <option value="GST">GST</option>
                  <option value="GST-FREE">GST-FREE</option>
                  <option value="EXEMPT">EXEMPT</option>
                </select>
              </Field>
              <Field label="Effective From">
                <input type="date" className={inputClass} value={sale.effective_from} onChange={event => setSale(prev => ({ ...prev, effective_from: event.target.value }))} />
              </Field>
              <Field label="Effective To">
                <input type="date" className={inputClass} value={sale.effective_to} onChange={event => setSale(prev => ({ ...prev, effective_to: event.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                ['publish_to_salesforce', 'Salesforce'],
                ['publish_to_bundle', 'Bundle'],
                ['publish_to_linenhub', 'LinenHub'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSale(prev => ({ ...prev, [key]: !prev[key as keyof SalePricingData] } as SalePricingData))}
                  className={`p-4 rounded-2xl border text-left font-bold transition-all ${sale[key as keyof SalePricingData] ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 text-[var(--color-brand)]' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-nocturne text-gray-700 dark:text-gray-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Field label="Notes">
              <textarea className={`${inputClass} min-h-24`} value={sale.notes} onChange={event => setSale(prev => ({ ...prev, notes: event.target.value }))} />
            </Field>
          </div>
        )}

        {stepId === 'margin' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Margin review</h2>
              <p className="text-sm text-gray-500 mt-1">Review calculated margin before the request moves to approval.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-6 rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800">
                <ReceiptText size={18} className="text-[var(--color-brand)] mb-3" />
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Cost Basis</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">${costBasis.toFixed(2)}</p>
              </div>
              <div className="p-6 rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800">
                <DollarSign size={18} className="text-[var(--color-brand)] mb-3" />
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Sell Price</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">${sale.sell_price_ex_gst.toFixed(2)}</p>
              </div>
              <div className={`p-6 rounded-2xl border ${isBelowThreshold ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                <AlertTriangle size={18} className="mb-3" />
                <p className="text-xs font-black uppercase tracking-widest">Margin</p>
                <p className="text-2xl font-black">{marginPercent.toFixed(1)}%</p>
                <p className="text-xs mt-1">Threshold {marginThreshold}%</p>
              </div>
            </div>
            {isBelowThreshold && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 flex gap-3">
                <AlertTriangle size={18} className="mt-0.5" />
                <p className="text-sm font-medium">This margin is below threshold. The approval stage will receive the pricing flag in the audit metadata.</p>
              </div>
            )}
          </div>
        )}

        {stepId === 'confirm' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Confirm and submit</h2>
              <p className="text-sm text-gray-500 mt-1">Pricing records will be created and the request will advance to approval.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {purchaseEnabled && (
                <div className="p-5 rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800">
                  <Truck size={18} className="text-[var(--color-brand)] mb-3" />
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Purchase</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{purchase.currency} {purchase.purchase_price_ex_gst.toFixed(2)} + {purchase.freight_handling_cost.toFixed(2)} freight</p>
                </div>
              )}
              {saleEnabled && (
                <div className="p-5 rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800">
                  <DollarSign size={18} className="text-[var(--color-brand)] mb-3" />
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Sale</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{sale.price_type} / ${sale.sell_price_ex_gst.toFixed(2)} / {sale.sale_uom}</p>
                </div>
              )}
              <div className="p-5 rounded-2xl bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800">
                <CheckCircle2 size={18} className="text-[var(--color-brand)] mb-3" />
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Next Stage</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">Approval Pending</p>
              </div>
            </div>
          </div>
        )}
      </ItemRequestWizardShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
