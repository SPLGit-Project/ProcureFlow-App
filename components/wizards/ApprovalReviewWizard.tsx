import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock, DollarSign, FileText, Package, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import ItemRequestWizardShell, { WizardStep } from '../ItemRequestWizardShell';
import { ToastContainer, useToast } from '../ToastNotification';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabaseClient';
import { getItemRequest } from '../../services/itemRequestService';
import { ApprovalDecision, ApprovalInstance, getApprovalInstancesForRequest, recordApprovalDecision } from '../../services/approvalEngineService';
import { ItemPurchasePrice, ItemRequest, ItemSellPrice } from '../../types';

interface ApprovalItem {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  sub_category?: string;
  uom: string;
  sap_item_code_raw?: string;
  item_pool?: string;
  item_catalog?: string;
  item_type?: string;
  item_weight?: number;
  item_size?: string;
  item_colour?: string;
  item_material?: string;
  rfid_flag?: boolean;
  cog_flag?: boolean;
  cog_customer?: string;
  specs?: Record<string, unknown>;
}

type DecisionType = 'APPROVED' | 'ESCALATED' | 'REJECTED' | '';

const STEPS: WizardStep[] = [
  { id: 'overview', label: 'Request Overview' },
  { id: 'definition', label: 'Item Definition' },
  { id: 'pricing', label: 'Pricing Summary' },
  { id: 'decision', label: 'Decision' },
];

function FieldRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-xs font-black text-gray-400 uppercase tracking-widest shrink-0">{label}</span>
      <span className="text-sm font-bold text-gray-900 dark:text-white text-right">{value || <span className="text-gray-400 italic">Not provided</span>}</span>
    </div>
  );
}

function SlaPanel({ instance }: { instance: ApprovalInstance | null }) {
  if (!instance?.sla_deadline) {
    return <p className="text-sm text-gray-500">No active approval SLA found.</p>;
  }

  const diffMs = new Date(instance.sla_deadline).getTime() - Date.now();
  const isOverdue = diffMs < 0 || instance.sla_breached;
  const absHours = Math.floor(Math.abs(diffMs) / 3600000);
  const absMinutes = Math.floor((Math.abs(diffMs) % 3600000) / 60000);

  return (
    <div className={`p-4 rounded-2xl border flex items-start gap-3 ${isOverdue ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
      <Clock size={18} className="mt-0.5" />
      <div>
        <p className="font-bold text-sm">{isOverdue ? `Overdue by ${absHours}h ${absMinutes}m` : `${absHours}h ${absMinutes}m remaining`}</p>
        <p className="text-xs opacity-80">Rule: {instance.rule_name} / Stage {instance.stage_order}</p>
      </div>
    </div>
  );
}

function ContextPanel({ request, activeInstance }: { request: ItemRequest; activeInstance: ApprovalInstance | null }) {
  return (
    <aside className="bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 space-y-4">
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Approval Request</p>
        <p className="font-mono text-sm font-bold text-[var(--color-brand)]">{request.request_number}</p>
      </div>
      <div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
        <p className="text-sm font-bold text-gray-900 dark:text-white">{request.status.replaceAll('_', ' ')}</p>
      </div>
      <SlaPanel instance={activeInstance} />
    </aside>
  );
}

export default function ApprovalReviewWizard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission, currentUser } = useApp();
  const { toasts, dismissToast, success, error: toastError } = useToast();

  const [request, setRequest] = useState<ItemRequest | null>(null);
  const [item, setItem] = useState<ApprovalItem | null>(null);
  const [instances, setInstances] = useState<ApprovalInstance[]>([]);
  const [decisions, setDecisions] = useState<ApprovalDecision[]>([]);
  const [purchasePrices, setPurchasePrices] = useState<ItemPurchasePrice[]>([]);
  const [sellPrices, setSellPrices] = useState<ItemSellPrice[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [decision, setDecision] = useState<DecisionType>('');
  const [comments, setComments] = useState('');

  const activeInstance = useMemo(() => {
    const pending = instances.filter(instance => instance.status === 'PENDING').sort((a, b) => a.stage_order - b.stage_order);
    return pending[0] ?? null;
  }, [instances]);

  const canApprove = hasPermission('approve_item_requests');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      setIsLoading(true);
      try {
        const loadedRequest = await getItemRequest(id);
        if (!loadedRequest) throw new Error('Request not found.');

        const approvalInstances = await getApprovalInstancesForRequest(id);
        const itemId = loadedRequest.resulting_item_id;

        const [itemResult, purchaseResult, sellResult, decisionResult] = await Promise.all([
          itemId ? supabase.from('items').select('*').eq('id', itemId).single() : Promise.resolve({ data: null, error: null }),
          itemId ? supabase.from('item_purchase_prices').select('*, suppliers(name)').eq('item_id', itemId).order('effective_from', { ascending: false }) : Promise.resolve({ data: [], error: null }),
          itemId ? supabase.from('item_sell_prices').select('*').eq('item_id', itemId).order('effective_from', { ascending: false }) : Promise.resolve({ data: [], error: null }),
          supabase.from('item_approval_decisions').select('*').eq('request_id', id).order('decided_at', { ascending: true }),
        ]);

        if (itemResult.error) throw new Error(itemResult.error.message);
        if (purchaseResult.error) throw new Error(purchaseResult.error.message);
        if (sellResult.error) throw new Error(sellResult.error.message);
        if (decisionResult.error) throw new Error(decisionResult.error.message);
        if (cancelled) return;

        setRequest(loadedRequest);
        setInstances(approvalInstances);
        setItem(itemResult.data as ApprovalItem | null);
        setPurchasePrices((purchaseResult.data ?? []) as unknown as ItemPurchasePrice[]);
        setSellPrices((sellResult.data ?? []) as ItemSellPrice[]);
        setDecisions((decisionResult.data ?? []) as ApprovalDecision[]);
      } catch (err) {
        toastError(err instanceof Error ? err.message : 'Failed to load approval review.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id, toastError]);

  const validateDecision = () => {
    if (!activeInstance) return 'No active approval instance is available.';
    if (!decision) return 'Select an approval decision.';
    if (decision !== 'APPROVED' && comments.trim().length < 10) {
      return 'Comments are required for revision requests and rejections.';
    }
    return null;
  };

  const handleContinue = async () => {
    if (activeStep < STEPS.length - 1) {
      setActiveStep(prev => prev + 1);
      return;
    }

    const validation = validateDecision();
    if (validation) {
      toastError(validation);
      return;
    }

    setIsSaving(true);
    try {
      await recordApprovalDecision({
        instanceId: activeInstance!.id,
        decision: decision as Exclude<DecisionType, ''>,
        comments: decision === 'APPROVED' && comments.trim().length < 10
          ? 'Approved via approval review wizard.'
          : comments.trim(),
        actorId: currentUser?.id,
      });
      success('Approval decision recorded.');
      navigate('/approvals');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to record approval decision.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!canApprove) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-20 text-center">
        <ShieldCheck size={48} className="mb-4 text-gray-300" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Access Restricted</h2>
        <p className="text-gray-500 mt-2">You need approval permissions to review this request.</p>
      </div>
    );
  }

  return (
    <>
      <ItemRequestWizardShell
        title="Approval Review"
        subtitle="Review request, definition, pricing, and final decision"
        steps={STEPS}
        activeStepIndex={activeStep}
        onContinue={handleContinue}
        onPrevious={activeStep > 0 ? () => setActiveStep(prev => prev - 1) : undefined}
        onCancel={() => navigate('/approvals')}
        continueLabel={activeStep === STEPS.length - 1 ? 'Record Decision' : 'Continue'}
        continueDisabled={isLoading || isSaving}
        isSaving={isSaving}
        isLoading={isLoading}
        contextPanel={request ? <ContextPanel request={request} activeInstance={activeInstance} /> : undefined}
      >
        {request && activeStep === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Request overview</h2>
              <p className="text-sm text-gray-500 mt-1">Review the requestor context and SLA before approving.</p>
            </div>
            <div className="bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
              <FieldRow label="Request" value={request.request_number} />
              <FieldRow label="Type" value={request.request_type.replaceAll('_', ' ')} />
              <FieldRow label="Description" value={request.item_description} />
              <FieldRow label="Business Reason" value={request.business_reason} />
              <FieldRow label="Department" value={request.department} />
              <FieldRow label="Business Unit" value={request.business_unit} />
              <FieldRow label="Required Activation" value={request.required_activation_date} />
              <FieldRow label="Priority" value={request.is_urgent ? 'Urgent' : 'Standard'} />
            </div>
            {decisions.length > 0 && (
              <div className="bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Prior Decisions</p>
                <div className="space-y-3">
                  {decisions.map(prior => (
                    <div key={prior.id} className="p-3 rounded-xl bg-gray-50 dark:bg-[#15171e] text-sm">
                      <p className="font-bold text-gray-900 dark:text-white">{prior.decision} - {new Date(prior.decided_at).toLocaleString()}</p>
                      <p className="text-gray-500 mt-1">{prior.comments}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Item definition</h2>
              <p className="text-sm text-gray-500 mt-1">Validate the item master data created by the Master Data team.</p>
            </div>
            {item ? (
              <div className="bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
                <FieldRow label="SKU" value={item.sku} />
                <FieldRow label="Name" value={item.name} />
                <FieldRow label="Description" value={item.description} />
                <FieldRow label="Classification" value={`${item.item_pool || 'N/A'} / ${item.item_catalog || 'N/A'} / ${item.item_type || 'N/A'} / ${item.category || 'N/A'} / ${item.sub_category || 'N/A'}`} />
                <FieldRow label="SAP Code" value={item.sap_item_code_raw} />
                <FieldRow label="Physical" value={`${item.uom || 'EA'}, ${item.item_colour || 'no colour'}, ${item.item_material || 'no material'}, ${item.item_size || 'no size'}`} />
                <FieldRow label="Flags" value={`${item.rfid_flag ? 'RFID ' : ''}${item.cog_flag ? `COG (${item.cog_customer || 'customer not set'})` : ''}`.trim() || 'Standard'} />
              </div>
            ) : (
              <div className="p-8 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl text-center text-gray-400">No resulting item is linked to this request.</div>
            )}
          </div>
        )}

        {activeStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Pricing summary</h2>
              <p className="text-sm text-gray-500 mt-1">Review purchase and sell pricing before making a decision.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
                <TruckIconFallback />
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Purchase Pricing</p>
                {purchasePrices.length > 0 ? purchasePrices.map(price => (
                  <div key={price.id} className="py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <p className="font-bold text-gray-900 dark:text-white">{price.currency} {price.purchase_price_ex_gst.toFixed(2)} / {price.purchase_uom}</p>
                    <p className="text-xs text-gray-500">Landed {price.currency} {price.landed_cost.toFixed(2)} / Effective {price.effective_from}</p>
                  </div>
                )) : <p className="text-sm text-gray-400">No purchase prices recorded.</p>}
              </div>
              <div className="bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
                <DollarSign size={18} className="text-[var(--color-brand)] mb-3" />
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Sell Pricing</p>
                {sellPrices.length > 0 ? sellPrices.map(price => (
                  <div key={price.id} className="py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <p className="font-bold text-gray-900 dark:text-white">{price.price_type} - ${price.sell_price_ex_gst.toFixed(2)} / {price.sale_uom}</p>
                    <p className={`text-xs ${price.margin_percent < 25 ? 'text-amber-600' : 'text-emerald-600'}`}>Margin {price.margin_percent.toFixed(1)}% / Effective {price.effective_from}</p>
                  </div>
                )) : <p className="text-sm text-gray-400">No sell prices recorded.</p>}
              </div>
            </div>
          </div>
        )}

        {activeStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Decision</h2>
              <p className="text-sm text-gray-500 mt-1">Choose the final action for this approval stage.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                ['APPROVED', CheckCircle2, 'Approve', 'Move this approval stage forward.'],
                ['ESCALATED', RotateCcw, 'Request Revision', 'Send specific feedback back to the requestor.'],
                ['REJECTED', XCircle, 'Reject', 'Permanently reject this item request.'],
              ].map(([value, Icon, label, detail]) => {
                const DisplayIcon = Icon as typeof CheckCircle2;
                return (
                  <button
                    key={value as string}
                    onClick={() => setDecision(value as DecisionType)}
                    className={`p-4 rounded-2xl border text-left transition-all ${decision === value ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029]'}`}
                  >
                    <DisplayIcon size={18} className="text-[var(--color-brand)] mb-3" />
                    <p className="font-bold text-gray-900 dark:text-white">{label as string}</p>
                    <p className="text-xs text-gray-500 mt-1">{detail as string}</p>
                  </button>
                );
              })}
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                Comments {decision !== 'APPROVED' && <span className="text-red-500">*</span>}
              </span>
              <textarea
                className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm min-h-32"
                value={comments}
                onChange={event => setComments(event.target.value)}
                placeholder="Add approval context, revision notes, or rejection reason..."
              />
            </label>
            {!activeInstance && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex gap-3">
                <AlertCircle size={18} />
                <p className="text-sm font-medium">There is no active pending approval instance for this request.</p>
              </div>
            )}
          </div>
        )}
      </ItemRequestWizardShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

function TruckIconFallback() {
  return <Package size={18} className="text-[var(--color-brand)] mb-3" />;
}
