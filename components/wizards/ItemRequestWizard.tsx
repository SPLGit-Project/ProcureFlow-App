import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Tag, Star, Package, Layers, RefreshCw,
  User, Globe, Check, CheckCircle2, ChevronRight, AlertTriangle,
  Clock, FileText, Zap, Calendar, Building2, Users
} from 'lucide-react';
import ItemRequestWizardShell, { WizardStep } from '../ItemRequestWizardShell';
import { createItemRequest } from '../../services/itemRequestService';
import { transitionRequest } from '../../services/itemWorkflowService';
import { ItemRequestType } from '../../types';
import { ToastContainer, useToast } from '../ToastNotification';

// ── Constants ──────────────────────────────────────────────────────────────────

const STEPS: WizardStep[] = [
  { id: 'type',    label: 'Item Type',       description: 'What kind of item is this?' },
  { id: 'details', label: 'What You Need',   description: 'Describe what you need' },
  { id: 'systems', label: 'Where It\'s Needed', description: 'Target systems and scope' },
  { id: 'review',  label: 'Review & Submit', description: 'Confirm and send for review' },
];

interface TypeCard {
  value: ItemRequestType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const TYPE_CARDS: TypeCard[] = [
  {
    value: 'PURCHASE_AND_SALE',
    label: 'Purchase & Sale',
    description: 'Item bought from a supplier and sold to customers.',
    icon: ShoppingCart,
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: 'PURCHASE_ONLY',
    label: 'Purchase Only',
    description: 'Item purchased internally — not listed for sale.',
    icon: Package,
    color: 'text-violet-600 dark:text-violet-400',
  },
  {
    value: 'SALE_ONLY',
    label: 'Sale Only',
    description: 'Item sold to customers but not purchased via standard PO.',
    icon: Tag,
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    value: 'COG',
    label: 'COG',
    description: 'Customer-owned goods managed and tracked on behalf of a client.',
    icon: Users,
    color: 'text-amber-600 dark:text-amber-400',
  },
  {
    value: 'BUNDLE_LINENHUB_ONLY',
    label: 'Bundle / LinenHub',
    description: 'A kit or bundle item, or an item exclusive to the LinenHub platform.',
    icon: Layers,
    color: 'text-sky-600 dark:text-sky-400',
  },
  {
    value: 'REPLACEMENT',
    label: 'Replacement',
    description: 'Replaces an existing item that is being retired or superseded.',
    icon: RefreshCw,
    color: 'text-rose-600 dark:text-rose-400',
  },
  {
    value: 'CUSTOMER_SPECIFIC',
    label: 'Customer-Specific',
    description: 'Item created exclusively for a single customer or contract.',
    icon: User,
    color: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    value: 'SHARED_CATALOGUE',
    label: 'Shared Catalogue',
    description: 'Item shared across multiple customers from a common catalogue.',
    icon: Globe,
    color: 'text-teal-600 dark:text-teal-400',
  },
];

const URGENCY_SLA_HOURS: Record<ItemRequestType, number> = {
  PURCHASE_AND_SALE: 48,
  PURCHASE_ONLY: 48,
  SALE_ONLY: 48,
  COG: 72,
  BUNDLE_LINENHUB_ONLY: 72,
  REPLACEMENT: 24,
  CUSTOMER_SPECIFIC: 72,
  SHARED_CATALOGUE: 48,
};

// ── Step state shapes ──────────────────────────────────────────────────────────

interface Step1Data {
  request_type: ItemRequestType | null;
}

interface Step2Data {
  item_description: string;
  business_reason: string;
  required_activation_date: string;
  is_urgent: boolean;
}

interface Step3Data {
  target_sap: boolean;
  target_bundle: boolean;
  target_linenhub: boolean;
  target_salesforce: boolean;
  department: string;
  business_unit: string;
  customer_reference: string;
  contract_reference: string;
  replacement_for_item_id: string;
}

// ── Step 1: Item Type ──────────────────────────────────────────────────────────

interface Step1Props {
  data: Step1Data;
  onChange: (v: Step1Data) => void;
}

function Step1TypeSelector({ data, onChange }: Step1Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-black text-gray-900 dark:text-white">What type of item is this?</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          The type determines which systems it flows through and what pricing is required.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TYPE_CARDS.map(card => {
          const Icon = card.icon;
          const isSelected = data.request_type === card.value;
          return (
            <button
              key={card.value}
              type="button"
              onClick={() => onChange({ request_type: card.value })}
              className={`text-left p-4 rounded-2xl border-2 transition-all flex items-start gap-4 ${
                isSelected
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 shadow-lg shadow-[var(--color-brand)]/10'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e2029] hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className={`mt-0.5 p-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 ${card.color} flex-shrink-0`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-bold text-sm ${isSelected ? 'text-[var(--color-brand)]' : 'text-gray-900 dark:text-white'}`}>
                    {card.label}
                  </span>
                  {isSelected && <Check size={14} className="text-[var(--color-brand)] flex-shrink-0" />}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                  {card.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 2: What You Need ──────────────────────────────────────────────────────

interface Step2Props {
  data: Step2Data;
  onChange: (v: Partial<Step2Data>) => void;
}

const DESC_MIN = 20;
const DESC_MAX = 500;
const REASON_MIN = 20;
const REASON_MAX = 1000;

function Step2Details({ data, onChange }: Step2Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-gray-900 dark:text-white">Describe what you need</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          The more detail you provide, the faster the Master Data team can process your request.
        </p>
      </div>

      {/* Item Description */}
      <div className="space-y-1.5">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          Item Description <span className="text-red-500">*</span>
        </label>
        <textarea
          value={data.item_description}
          onChange={e => onChange({ item_description: e.target.value })}
          placeholder="e.g. White 100% cotton bath towel, 70×140cm, 500gsm, hotel-grade"
          rows={4}
          maxLength={DESC_MAX}
          className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all resize-none"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span className={data.item_description.length < DESC_MIN && data.item_description.length > 0 ? 'text-amber-500' : ''}>
            {data.item_description.length < DESC_MIN
              ? `${DESC_MIN - data.item_description.length} more characters needed`
              : 'Looks good'}
          </span>
          <span>{data.item_description.length}/{DESC_MAX}</span>
        </div>
      </div>

      {/* Business Reason */}
      <div className="space-y-1.5">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          Business Reason <span className="text-red-500">*</span>
        </label>
        <textarea
          value={data.business_reason}
          onChange={e => onChange({ business_reason: e.target.value })}
          placeholder="Why is this item needed? Which customer, contract, or operational requirement is driving this request?"
          rows={4}
          maxLength={REASON_MAX}
          className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all resize-none"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span className={data.business_reason.length < REASON_MIN && data.business_reason.length > 0 ? 'text-amber-500' : ''}>
            {data.business_reason.length < REASON_MIN
              ? `${REASON_MIN - data.business_reason.length} more characters needed`
              : 'Looks good'}
          </span>
          <span>{data.business_reason.length}/{REASON_MAX}</span>
        </div>
      </div>

      {/* Required Activation Date */}
      <div className="space-y-1.5">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          Required Activation Date
        </label>
        <p className="text-xs text-gray-400 dark:text-gray-500">When do you need this item to be live in the system?</p>
        <div className="relative">
          <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="date"
            value={data.required_activation_date}
            min={new Date().toISOString().split('T')[0]}
            onChange={e => onChange({ required_activation_date: e.target.value })}
            className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
          />
        </div>
      </div>

      {/* Urgency Toggle */}
      <div className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
        data.is_urgent
          ? 'border-red-400 bg-red-50 dark:bg-red-500/5'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e2029]'
      }`}
        onClick={() => onChange({ is_urgent: !data.is_urgent })}
        role="checkbox"
        aria-checked={data.is_urgent}
        tabIndex={0}
        onKeyDown={e => e.key === ' ' && onChange({ is_urgent: !data.is_urgent })}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${data.is_urgent ? 'bg-red-100 dark:bg-red-500/20 text-red-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
            <Zap size={16} />
          </div>
          <div>
            <p className={`font-bold text-sm ${data.is_urgent ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
              Mark as urgent
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Urgent requests are prioritised in the review queue. Use for time-critical requirements only.
            </p>
          </div>
        </div>
        <div className={`w-10 h-6 rounded-full transition-all flex-shrink-0 relative ${data.is_urgent ? 'bg-red-500' : 'bg-gray-200 dark:bg-gray-700'}`}>
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${data.is_urgent ? 'left-5' : 'left-1'}`} />
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Where It's Needed ──────────────────────────────────────────────────

interface SystemToggleProps {
  label: string;
  description: string;
  active: boolean;
  onToggle: () => void;
  icon: React.ElementType;
}

function SystemToggle({ label, description, active, onToggle, icon: Icon }: SystemToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`text-left p-4 rounded-2xl border-2 transition-all flex items-start gap-3 ${
        active
          ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e2029] hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <div className={`p-2 rounded-xl flex-shrink-0 mt-0.5 ${active ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`font-bold text-sm ${active ? 'text-[var(--color-brand)]' : 'text-gray-700 dark:text-gray-300'}`}>{label}</span>
          {active && <Check size={13} className="text-[var(--color-brand)] flex-shrink-0" />}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
    </button>
  );
}

interface Step3Props {
  data: Step3Data;
  onChange: (v: Partial<Step3Data>) => void;
  requestType: ItemRequestType | null;
}

function Step3Systems({ data, onChange, requestType }: Step3Props) {
  const isCustomerSpecific = requestType === 'CUSTOMER_SPECIFIC';
  const isReplacement = requestType === 'REPLACEMENT';
  const showCOGNote = requestType === 'COG';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-gray-900 dark:text-white">Where does this item need to appear?</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Select every system this item must be active in. Each system adds setup steps during the Master Data review.
        </p>
      </div>

      {/* System toggle cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SystemToggle
          label="SAP"
          description="Core ERP — required for purchasing, stock, and financials"
          active={data.target_sap}
          onToggle={() => onChange({ target_sap: !data.target_sap })}
          icon={Package}
        />
        <SystemToggle
          label="Bundle"
          description="Included in kit or bundle configurations"
          active={data.target_bundle}
          onToggle={() => onChange({ target_bundle: !data.target_bundle })}
          icon={Layers}
        />
        <SystemToggle
          label="LinenHub"
          description="Available in the LinenHub customer portal"
          active={data.target_linenhub}
          onToggle={() => onChange({ target_linenhub: !data.target_linenhub })}
          icon={Globe}
        />
        <SystemToggle
          label="Salesforce"
          description="Visible to the sales team in Salesforce CRM"
          active={data.target_salesforce}
          onToggle={() => onChange({ target_salesforce: !data.target_salesforce })}
          icon={Star}
        />
      </div>

      {showCOGNote && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
          <p>COG items are managed on behalf of a specific customer and typically do not appear in the standard sales catalogue.</p>
        </div>
      )}

      {/* Department / BU */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Department</label>
          <div className="relative">
            <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={data.department}
              onChange={e => onChange({ department: e.target.value })}
              placeholder="e.g. Housekeeping, F&B, Laundry"
              className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Business Unit</label>
          <div className="relative">
            <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={data.business_unit}
              onChange={e => onChange({ business_unit: e.target.value })}
              placeholder="e.g. Hotels EMEA, Hospitality AU"
              className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
            />
          </div>
        </div>
      </div>

      {/* Conditional: Customer-Specific */}
      {isCustomerSpecific && (
        <div className="p-4 bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl space-y-4">
          <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Customer-Specific Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Customer Reference <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={data.customer_reference}
                onChange={e => onChange({ customer_reference: e.target.value })}
                placeholder="Customer name or ID"
                className="w-full bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Contract Reference</label>
              <input
                type="text"
                value={data.contract_reference}
                onChange={e => onChange({ contract_reference: e.target.value })}
                placeholder="Contract number or name"
                className="w-full bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
              />
            </div>
          </div>
        </div>
      )}

      {/* Conditional: Replacement */}
      {isReplacement && (
        <div className="p-4 bg-rose-50 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/20 rounded-2xl space-y-3">
          <p className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">Replacement Details</p>
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Item Being Replaced <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={data.replacement_for_item_id}
              onChange={e => onChange({ replacement_for_item_id: e.target.value })}
              placeholder="SAP item code or item name"
              className="w-full bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">Enter the SAP code or description of the item this request will replace.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 4: Review & Submit ────────────────────────────────────────────────────

interface ReviewRowProps {
  label: string;
  value: React.ReactNode;
}
function ReviewRow({ label, value }: ReviewRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-xs font-black text-gray-400 uppercase tracking-widest flex-shrink-0 w-40">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white text-right font-medium">{value || <span className="italic text-gray-400">Not provided</span>}</span>
    </div>
  );
}

interface Step4Props {
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
}

function Step4Review({ step1, step2, step3 }: Step4Props) {
  const typeCard = TYPE_CARDS.find(t => t.value === step1.request_type);
  const slaHours = step1.request_type ? URGENCY_SLA_HOURS[step1.request_type] : 48;
  const urgentSla = step2.is_urgent ? Math.floor(slaHours / 2) : slaHours;

  const activeSystems = [
    step3.target_sap && 'SAP',
    step3.target_bundle && 'Bundle',
    step3.target_linenhub && 'LinenHub',
    step3.target_salesforce && 'Salesforce',
  ].filter(Boolean) as string[];

  const WORKFLOW_STEPS = [
    { label: 'Submitted', detail: 'Your request is received', icon: FileText, active: true },
    { label: 'Duplicate Check', detail: 'Master Data verifies no existing item matches', icon: CheckCircle2, active: false },
    { label: 'Item Definition', detail: 'Master Data completes SAP and catalogue setup', icon: Package, active: false },
    { label: 'Pricing Review', detail: 'Pricing team sets buy and sell prices', icon: Tag, active: false },
    { label: 'Approval', detail: 'Approver sign-off based on item type', icon: Check, active: false },
    { label: 'Active', detail: 'Item live in selected systems', icon: CheckCircle2, active: false },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-gray-900 dark:text-white">Review your request</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Check everything below before submitting. You can go back to make changes.
        </p>
      </div>

      {/* Summary card */}
      <div className="bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 dark:bg-[#15171e]/50 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
          {typeCard && (
            <div className={`p-2 rounded-xl bg-gray-100 dark:bg-gray-800 ${typeCard.color}`}>
              <typeCard.icon size={16} />
            </div>
          )}
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Item Type</p>
            <p className="font-bold text-gray-900 dark:text-white text-sm">{typeCard?.label}</p>
          </div>
          {step2.is_urgent && (
            <span className="ml-auto bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-black px-2 py-0.5 rounded border border-red-200 dark:border-red-500/20">
              URGENT
            </span>
          )}
        </div>
        <div className="px-6">
          <ReviewRow label="Description" value={step2.item_description} />
          <ReviewRow label="Business Reason" value={step2.business_reason} />
          <ReviewRow
            label="Activation Date"
            value={step2.required_activation_date
              ? new Date(step2.required_activation_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : undefined}
          />
          <ReviewRow label="Target Systems" value={activeSystems.length > 0 ? activeSystems.join(', ') : 'None selected'} />
          {step3.department && <ReviewRow label="Department" value={step3.department} />}
          {step3.business_unit && <ReviewRow label="Business Unit" value={step3.business_unit} />}
          {step3.customer_reference && <ReviewRow label="Customer Ref" value={step3.customer_reference} />}
          {step3.contract_reference && <ReviewRow label="Contract Ref" value={step3.contract_reference} />}
          {step3.replacement_for_item_id && <ReviewRow label="Replacing" value={step3.replacement_for_item_id} />}
        </div>
      </div>

      {/* SLA estimate */}
      <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/20 rounded-2xl">
        <div className="p-2.5 bg-blue-100 dark:bg-blue-500/20 rounded-xl text-blue-600 dark:text-blue-400 flex-shrink-0">
          <Clock size={18} />
        </div>
        <div>
          <p className="font-bold text-blue-900 dark:text-blue-300 text-sm">Estimated review time</p>
          <p className="text-sm text-blue-700 dark:text-blue-400">
            {step2.is_urgent ? 'Urgent — ' : ''}{urgentSla} hours from submission ({Math.ceil(urgentSla / 8)} business days)
          </p>
        </div>
      </div>

      {/* What happens next */}
      <div className="space-y-2">
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">What happens next</p>
        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-[19px] top-5 bottom-5 w-px bg-gray-200 dark:bg-gray-700" />

          <div className="space-y-3">
            {WORKFLOW_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isDone = idx === 0;
              return (
                <div key={step.label} className="flex items-center gap-4 relative">
                  <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 ${
                    isDone
                      ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white'
                      : 'bg-white dark:bg-[#1e2029] border-gray-200 dark:border-gray-700 text-gray-400'
                  }`}>
                    <Icon size={14} />
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${isDone ? 'text-[var(--color-brand)]' : 'text-gray-700 dark:text-gray-300'}`}>{step.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{step.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Success screen ─────────────────────────────────────────────────────────────

interface SuccessScreenProps {
  requestNumber: string;
  isUrgent: boolean;
  requestType: ItemRequestType | null;
  onViewRequests: () => void;
  onNewRequest: () => void;
}

function SuccessScreen({ requestNumber, isUrgent, requestType, onViewRequests, onNewRequest }: SuccessScreenProps) {
  const slaHours = requestType ? URGENCY_SLA_HOURS[requestType] : 48;
  const urgentSla = isUrgent ? Math.floor(slaHours / 2) : slaHours;

  const TIMELINE = [
    { label: 'Submitted', sublabel: 'Just now', done: true, active: false },
    { label: 'Duplicate Check', sublabel: 'In queue', done: false, active: true },
    { label: 'Item Definition', sublabel: 'Pending', done: false, active: false },
    { label: 'Pricing Review', sublabel: 'Pending', done: false, active: false },
    { label: 'Approval', sublabel: 'Pending', done: false, active: false },
    { label: 'Active', sublabel: 'End goal', done: false, active: false },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-8 py-12 animate-page-entry text-center">

      {/* Success icon */}
      <div className="relative mb-8">
        <div className="w-20 h-20 bg-[var(--color-brand)]/10 rounded-full flex items-center justify-center">
          <div className="w-14 h-14 bg-[var(--color-brand)] rounded-full flex items-center justify-center shadow-xl shadow-[var(--color-brand)]/30">
            <Check size={28} className="text-white" strokeWidth={3} />
          </div>
        </div>
      </div>

      <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Request Submitted!</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-2">
        Your request has been received and is now in the Master Data queue.
      </p>
      <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl font-mono text-sm font-bold mb-2">
        <FileText size={14} />
        {requestNumber}
      </div>
      {isUrgent && (
        <span className="inline-flex items-center gap-1.5 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-black px-3 py-1 rounded-full border border-red-200 dark:border-red-500/20 mb-2">
          <Zap size={12} /> URGENT — Expected review within {urgentSla} hours
        </span>
      )}
      {!isUrgent && (
        <p className="text-xs text-gray-400 mb-2">Expected review within {urgentSla} hours</p>
      )}

      {/* Progress timeline */}
      <div className="w-full max-w-md mt-8 mb-10">
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Request Progress</p>
        <div className="relative">
          <div className="absolute left-[19px] top-5 bottom-5 w-px bg-gray-200 dark:bg-gray-700" />
          <div className="space-y-4 text-left">
            {TIMELINE.map((step, idx) => (
              <div key={step.label} className="flex items-center gap-4 relative">
                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 transition-all ${
                  step.done
                    ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white'
                    : step.active
                    ? 'bg-white dark:bg-[#1e2029] border-[var(--color-brand)] text-[var(--color-brand)]'
                    : 'bg-white dark:bg-[#1e2029] border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600'
                }`}>
                  {step.done ? <Check size={14} strokeWidth={3} /> : <span className="text-[11px] font-black">{idx + 1}</span>}
                </div>
                <div>
                  <p className={`text-sm font-bold ${step.done ? 'text-[var(--color-brand)]' : step.active ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-gray-400">{step.sublabel}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={onViewRequests}
          className="px-8 py-3 rounded-xl bg-[var(--color-brand)] text-white font-bold shadow-lg shadow-[var(--color-brand)]/20 hover:opacity-90 active:scale-95 transition-all"
        >
          View My Requests
        </button>
        <button
          onClick={onNewRequest}
          className="px-8 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
        >
          Submit Another Request
        </button>
      </div>
    </div>
  );
}

// ── Validation ─────────────────────────────────────────────────────────────────

function validateStep(step: number, s1: Step1Data, s2: Step2Data, s3: Step3Data): string | null {
  if (step === 0) {
    if (!s1.request_type) return 'Please select an item type to continue.';
  }
  if (step === 1) {
    if (s2.item_description.length < DESC_MIN) return `Item description needs at least ${DESC_MIN} characters.`;
    if (s2.business_reason.length < REASON_MIN) return `Business reason needs at least ${REASON_MIN} characters.`;
  }
  if (step === 2) {
    if (!s3.target_sap && !s3.target_bundle && !s3.target_linenhub && !s3.target_salesforce) {
      return 'Please select at least one target system.';
    }
    if (s1.request_type === 'CUSTOMER_SPECIFIC' && !s3.customer_reference.trim()) {
      return 'Customer reference is required for Customer-Specific items.';
    }
    if (s1.request_type === 'REPLACEMENT' && !s3.replacement_for_item_id.trim()) {
      return 'Please specify the item being replaced.';
    }
  }
  return null;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ItemRequestWizard() {
  const navigate = useNavigate();
  const { toasts, dismissToast, success, error: toastError } = useToast();

  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedRequestNumber, setSubmittedRequestNumber] = useState('');

  const [step1, setStep1] = useState<Step1Data>({ request_type: null });
  const [step2, setStep2] = useState<Step2Data>({
    item_description: '',
    business_reason: '',
    required_activation_date: '',
    is_urgent: false,
  });
  const [step3, setStep3] = useState<Step3Data>({
    target_sap: true,
    target_bundle: false,
    target_linenhub: false,
    target_salesforce: false,
    department: '',
    business_unit: '',
    customer_reference: '',
    contract_reference: '',
    replacement_for_item_id: '',
  });

  const handleContinue = useCallback(async () => {
    const validationError = validateStep(activeStep, step1, step2, step3);
    if (validationError) {
      toastError(validationError);
      return;
    }

    // Not the final step — just advance
    if (activeStep < STEPS.length - 1) {
      setActiveStep(prev => prev + 1);
      return;
    }

    // Final step — create + submit
    setIsSubmitting(true);
    try {
      const request = await createItemRequest({
        request_type: step1.request_type!,
        item_description: step2.item_description,
        business_reason: step2.business_reason,
        required_activation_date: step2.required_activation_date || undefined,
        target_sap: step3.target_sap,
        target_bundle: step3.target_bundle,
        target_linenhub: step3.target_linenhub,
        target_salesforce: step3.target_salesforce,
        department: step3.department || undefined,
        business_unit: step3.business_unit || undefined,
        customer_reference: step3.customer_reference || undefined,
        contract_reference: step3.contract_reference || undefined,
        replacement_for_item_id: step3.replacement_for_item_id || undefined,
      });

      await transitionRequest(request.id, 'SUBMITTED');

      setSubmittedRequestNumber(request.request_number);
      setSubmitted(true);
      success('Request submitted successfully!');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [activeStep, step1, step2, step3, toastError, success]);

  const handlePrevious = useCallback(() => {
    setActiveStep(prev => Math.max(0, prev - 1));
  }, []);

  const handleCancel = useCallback(() => {
    navigate('/items/my-requests');
  }, [navigate]);

  const handleNewRequest = useCallback(() => {
    setActiveStep(0);
    setSubmitted(false);
    setStep1({ request_type: null });
    setStep2({ item_description: '', business_reason: '', required_activation_date: '', is_urgent: false });
    setStep3({
      target_sap: true, target_bundle: false, target_linenhub: false, target_salesforce: false,
      department: '', business_unit: '', customer_reference: '', contract_reference: '', replacement_for_item_id: '',
    });
  }, []);

  // Success screen
  if (submitted) {
    return (
      <>
        <SuccessScreen
          requestNumber={submittedRequestNumber}
          isUrgent={step2.is_urgent}
          requestType={step1.request_type}
          onViewRequests={() => navigate('/items/my-requests')}
          onNewRequest={handleNewRequest}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const isLastStep = activeStep === STEPS.length - 1;

  const continueLabel = isLastStep
    ? isSubmitting ? 'Submitting…' : 'Submit Request'
    : 'Continue';

  return (
    <>
      <ItemRequestWizardShell
        title="New Item Request"
        subtitle="Request a new item for the catalogue"
        steps={STEPS}
        activeStepIndex={activeStep}
        onContinue={handleContinue}
        onPrevious={activeStep > 0 ? handlePrevious : undefined}
        onCancel={handleCancel}
        continueLabel={continueLabel}
        continueDisabled={isSubmitting}
        isSaving={isSubmitting && isLastStep}
      >
        {activeStep === 0 && (
          <Step1TypeSelector data={step1} onChange={setStep1} />
        )}
        {activeStep === 1 && (
          <Step2Details data={step2} onChange={partial => setStep2(prev => ({ ...prev, ...partial }))} />
        )}
        {activeStep === 2 && (
          <Step3Systems
            data={step3}
            onChange={partial => setStep3(prev => ({ ...prev, ...partial }))}
            requestType={step1.request_type}
          />
        )}
        {activeStep === 3 && (
          <Step4Review step1={step1} step2={step2} step3={step3} />
        )}
      </ItemRequestWizardShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
