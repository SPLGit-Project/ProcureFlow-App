import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Tag, Package, RefreshCw, User, Check, CheckCircle2,
  AlertTriangle, Clock, FileText, Zap, Users, Search, AlertCircle,
  Wifi, WifiOff, ChevronRight, Layers, ArrowLeft,
} from 'lucide-react';
import ItemRequestWizardShell, { WizardStep } from '../ItemRequestWizardShell';
import { createItemRequest, searchExistingItems } from '../../services/itemRequestService';
import { useApp } from '../../context/AppContext';
import { transitionRequest } from '../../services/itemWorkflowService';
import { ItemRequestType } from '../../types';
import { ToastContainer, useToast } from '../ToastNotification';
import { buildItemCode, SkuSegments } from '../../utils/itemNameGenerator';
import { supabase } from '../../lib/supabaseClient';
import { ColourOption, colourSwatchStyle, getActiveColours } from '../../services/colourService';

// ── Steps ─────────────────────────────────────────────────────────────────────

const STEPS: WizardStep[] = [
  { id: 'type',    label: 'Transaction Type',  description: 'What kind of transaction is this?' },
  { id: 'code',    label: 'Build Item Code',   description: 'Define attributes and build the code' },
  { id: 'context', label: 'Business Context',  description: 'Why is this item needed?' },
  { id: 'review',  label: 'Review & Submit',   description: 'Confirm and send for review' },
];

const URGENCY_SLA_HOURS: Record<ItemRequestType, number> = {
  PURCHASE_AND_SALE: 48, PURCHASE_ONLY: 48, SALE_ONLY: 48,
  COG: 72, BUNDLE_LINENHUB_ONLY: 72, REPLACEMENT: 24,
  CUSTOMER_SPECIFIC: 72, SHARED_CATALOGUE: 48,
};

// ── Product type definitions ───────────────────────────────────────────────────

interface ProductTypeDef {
  label: string;
  code: string;
  group: string;
  bedSizes: boolean;
  bodySizes: boolean;
  hasColour: boolean;
  hasGSM: boolean;
  hasDimensions: boolean;
}

const PRODUCT_TYPE_DEFS: ProductTypeDef[] = [
  // Towelling
  { label: 'Bath Towel',    code: 'BT', group: 'Towelling', bedSizes: false, bodySizes: true,  hasColour: true,  hasGSM: true,  hasDimensions: true  },
  { label: 'Hand Towel',    code: 'HT', group: 'Towelling', bedSizes: false, bodySizes: false, hasColour: true,  hasGSM: true,  hasDimensions: true  },
  { label: 'Face Washer',   code: 'FW', group: 'Towelling', bedSizes: false, bodySizes: false, hasColour: true,  hasGSM: true,  hasDimensions: true  },
  { label: 'Bath Sheet',    code: 'BS', group: 'Towelling', bedSizes: false, bodySizes: false, hasColour: true,  hasGSM: true,  hasDimensions: true  },
  { label: 'Bath Mat',      code: 'BM', group: 'Towelling', bedSizes: false, bodySizes: false, hasColour: true,  hasGSM: true,  hasDimensions: true  },
  { label: 'Bath Robe',     code: 'RB', group: 'Towelling', bedSizes: false, bodySizes: true,  hasColour: true,  hasGSM: false, hasDimensions: false },
  { label: 'Pool Towel',    code: 'PT', group: 'Towelling', bedSizes: false, bodySizes: false, hasColour: true,  hasGSM: true,  hasDimensions: true  },
  { label: 'Gym Towel',     code: 'GT', group: 'Towelling', bedSizes: false, bodySizes: false, hasColour: true,  hasGSM: true,  hasDimensions: true  },
  // Bedding
  { label: 'Flat Sheet',    code: 'FS', group: 'Bedding',   bedSizes: true,  bodySizes: false, hasColour: true,  hasGSM: true,  hasDimensions: true  },
  { label: 'Fitted Sheet',  code: 'FT', group: 'Bedding',   bedSizes: true,  bodySizes: false, hasColour: true,  hasGSM: true,  hasDimensions: false },
  { label: 'Pillowcase',    code: 'PC', group: 'Bedding',   bedSizes: true,  bodySizes: false, hasColour: true,  hasGSM: true,  hasDimensions: true  },
  { label: 'Duvet Cover',   code: 'DC', group: 'Bedding',   bedSizes: true,  bodySizes: false, hasColour: true,  hasGSM: false, hasDimensions: false },
  { label: 'Duvet Insert',  code: 'DI', group: 'Bedding',   bedSizes: true,  bodySizes: false, hasColour: false, hasGSM: false, hasDimensions: false },
  { label: 'Pillow',        code: 'PL', group: 'Bedding',   bedSizes: true,  bodySizes: false, hasColour: false, hasGSM: false, hasDimensions: false },
  { label: 'Mattress Protector', code: 'MP', group: 'Bedding', bedSizes: true, bodySizes: false, hasColour: false, hasGSM: false, hasDimensions: false },
  { label: 'Mattress Topper', code: 'MT', group: 'Bedding', bedSizes: true,  bodySizes: false, hasColour: false, hasGSM: false, hasDimensions: false },
  { label: 'Blanket',       code: 'BL', group: 'Bedding',   bedSizes: true,  bodySizes: false, hasColour: true,  hasGSM: false, hasDimensions: false },
  { label: 'Quilt Cover',   code: 'QC', group: 'Bedding',   bedSizes: true,  bodySizes: false, hasColour: true,  hasGSM: false, hasDimensions: false },
  // Table Linen
  { label: 'Tablecloth',    code: 'TC', group: 'Table Linen', bedSizes: false, bodySizes: false, hasColour: true, hasGSM: true,  hasDimensions: true  },
  { label: 'Table Napkin',  code: 'TN', group: 'Table Linen', bedSizes: false, bodySizes: false, hasColour: true, hasGSM: true,  hasDimensions: true  },
  // Clothing
  { label: 'Uniform',       code: 'UN', group: 'Clothing',  bedSizes: false, bodySizes: true,  hasColour: true,  hasGSM: false, hasDimensions: false },
  { label: 'Scrub',         code: 'SC', group: 'Clothing',  bedSizes: false, bodySizes: true,  hasColour: true,  hasGSM: false, hasDimensions: false },
  { label: 'Shirt',         code: 'SR', group: 'Clothing',  bedSizes: false, bodySizes: true,  hasColour: true,  hasGSM: false, hasDimensions: false },
  // Equipment
  { label: 'Laundry Bag',   code: 'BG', group: 'Equipment', bedSizes: false, bodySizes: false, hasColour: false, hasGSM: false, hasDimensions: false },
  { label: 'Trolley',       code: 'TL', group: 'Equipment', bedSizes: false, bodySizes: false, hasColour: false, hasGSM: false, hasDimensions: false },
  { label: 'Container',     code: 'CN', group: 'Equipment', bedSizes: false, bodySizes: false, hasColour: false, hasGSM: false, hasDimensions: false },
  { label: 'Cart',          code: 'CT', group: 'Equipment', bedSizes: false, bodySizes: false, hasColour: false, hasGSM: false, hasDimensions: false },
  { label: 'Other',         code: 'IT', group: 'Other',     bedSizes: false, bodySizes: false, hasColour: false, hasGSM: false, hasDimensions: false },
];

const PRODUCT_GROUPS = [...new Set(PRODUCT_TYPE_DEFS.map(p => p.group))];

// ── Categories ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: 'Accommodation',      code: 'A',  description: 'Hotels, resorts, and accommodation providers' },
  { label: 'Healthcare',         code: 'H',  description: 'Hospitals, clinics, and medical facilities' },
  { label: 'Linen Hub',          code: 'LH', description: 'LinenHub managed service programmes' },
  { label: 'COG',                code: 'CG', description: 'Customer-owned goods, managed on their behalf' },
  { label: 'Daily Hire',         code: 'DH', description: 'Short-term hire and rental items' },
  { label: 'Mining',             code: 'MN', description: 'Mining camps and resource industry' },
  { label: 'Transport',          code: 'TR', description: 'Transport and logistics industry' },
  { label: 'Food & Beverages',   code: 'FB', description: 'Hospitality and food service operations' },
];

// ── Size options ──────────────────────────────────────────────────────────────

const BED_SIZES = [
  { label: 'Single',       code: 'S'  },
  { label: 'Double',       code: 'D'  },
  { label: 'Queen',        code: 'Q'  },
  { label: 'King',         code: 'K'  },
  { label: 'King Single',  code: 'KS' },
  { label: 'Twin',         code: 'T'  },
  { label: 'Super King',   code: 'SK' },
  { label: 'Standard',     code: 'ST' },
];

const BODY_SIZES = [
  { label: 'Small',       code: '01' },
  { label: 'Medium',      code: '02' },
  { label: 'Large',       code: '03' },
  { label: 'Extra Large', code: '04' },
  { label: 'XXL',         code: '05' },
];

// Colour options are loaded dynamically from the DB (see ColourOption in colourService)

// ── Materials & grades ────────────────────────────────────────────────────────

const MATERIALS = [
  '100% Cotton', 'Polyester / Cotton Blend', '100% Polyester',
  'Bamboo Blend', 'Microfibre', 'Terry', 'Fleece', 'Other',
];

const GRADES = [
  'Hotel Grade', 'Premium Hotel Grade', 'Commercial Grade',
  'Economy Grade', 'Healthcare Grade', 'Other',
];

// ── Business reason options ───────────────────────────────────────────────────

const BUSINESS_REASONS = [
  { value: 'NEW_CUSTOMER_CONTRACT',   label: 'New customer contract or onboarding' },
  { value: 'CONTRACT_RENEWAL',        label: 'Contract renewal or scope expansion' },
  { value: 'ITEM_PHASEOUT',           label: 'Replaces an existing item being phased out' },
  { value: 'RANGE_EXPANSION',         label: 'Product range expansion' },
  { value: 'OPERATIONAL_REQUIREMENT', label: 'Internal operational requirement' },
  { value: 'CUSTOMER_REQUIREMENT',    label: 'Specific customer or site requirement' },
  { value: 'OTHER',                   label: 'Other reason not listed' },
];

// ── Data interfaces ───────────────────────────────────────────────────────────

interface Step1Data {
  request_type: ItemRequestType | null;
}

interface Step2Data {
  categoryLabel: string;
  categoryCode: string;
  customerName: string;   // full customer name entered by user
  customerCode: string;   // auto-generated 2-letter code
  productTypeLabel: string;
  productTypeCode: string;
  rfid: boolean | null;
  sizeLabel: string;
  sizeCode: string;
  colourLabel: string;
  colourCode: string;
  colourCustom: string;
  gsm: string;
  gsmSkipped: boolean;
  material: string;
  materialCustom: string;
  width_cm: string;
  height_cm: string;
  grade: string;
  uom: string;
  upq: string;
  additional_notes: string;
}

interface Step3Data {
  business_reason_type: string;
  business_reason_other: string;
  is_urgent: boolean;
  urgent_reason: string;
  target_sap: boolean;
  target_bundle: boolean;
  target_linenhub: boolean;
  target_salesforce: boolean;
  customer_reference: string;
  contract_reference: string;
  replacement_for_item_id: string;
}

// ── Custom materials localStorage helpers ─────────────────────────────────────

const CUSTOM_MATERIALS_KEY = 'pf-custom-materials';
function getCustomMaterials(): string[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_MATERIALS_KEY) ?? '[]'); }
  catch { return []; }
}
function saveCustomMaterial(name: string) {
  const existing = getCustomMaterials();
  if (!existing.includes(name) && name.trim()) {
    localStorage.setItem(CUSTOM_MATERIALS_KEY, JSON.stringify([name, ...existing].slice(0, 10)));
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateCustomerCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) {
    const w = words[0];
    return (w[0] + w[w.length - 1]).toUpperCase();
  }
  if (words.length === 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  // 3+ words: first letter of first word + last letter of last word
  const first = words[0];
  const last = words[words.length - 1];
  return (first[0] + last[last.length - 1]).toUpperCase();
}

const ITEM_TYPE_CODE: Record<ItemRequestType, 'P' | 'S'> = {
  PURCHASE_AND_SALE: 'P', PURCHASE_ONLY: 'P', SALE_ONLY: 'S',
  COG: 'P', REPLACEMENT: 'P', CUSTOMER_SPECIFIC: 'P',
  BUNDLE_LINENHUB_ONLY: 'S', SHARED_CATALOGUE: 'P',
};

const ITEM_TYPE_LABEL: Record<'P'|'S', string> = {
  P: 'Purchase', S: 'Sale',
};

function getSkuSegments(s1: Step1Data, s2: Step2Data): SkuSegments {
  const hasVariants = !!(s2.sizeCode || s2.colourCode);
  return {
    itemType: s1.request_type ? ITEM_TYPE_CODE[s1.request_type] : undefined,
    rfid: s2.rfid ?? false,
    categoryCode: s2.categoryCode || undefined,
    customerCode: s2.customerCode || undefined,
    productTypeCode: s2.productTypeCode || undefined,
    sizeCode: s2.sizeCode || undefined,
    varietyCode: hasVariants ? '01' : undefined,
    colourCode: s2.colourCode || undefined,
  };
}

function buildItemDescription(s2: Step2Data): string {
  const parts: string[] = [];
  const effectiveColour = s2.colourCode ? s2.colourLabel : (s2.colourCustom || '');
  // Product type leads for human readability, then attributes in natural order
  if (s2.productTypeLabel && s2.productTypeLabel !== 'Other') parts.push(s2.productTypeLabel);
  if (s2.sizeLabel) parts.push(s2.sizeLabel);
  if (effectiveColour && effectiveColour !== 'Other') parts.push(effectiveColour);
  if (s2.material && s2.material !== 'Other') parts.push(s2.material);
  if (s2.gsm) parts.push(`${s2.gsm}gsm`);
  if (s2.grade && s2.grade !== 'Other') parts.push(s2.grade);
  if (s2.width_cm && s2.height_cm) parts.push(`${s2.width_cm}×${s2.height_cm}cm`);
  if (s2.categoryLabel) parts.push(`${s2.categoryLabel} catalogue`);
  if (s2.additional_notes) parts.push(s2.additional_notes);
  return parts.join(', ');
}

function getProductDef(code: string): ProductTypeDef | null {
  return PRODUCT_TYPE_DEFS.find(p => p.code === code) ?? null;
}

function buildBusinessReason(s3: Step3Data): string {
  if (s3.business_reason_type === 'OTHER') return s3.business_reason_other;
  return BUSINESS_REASONS.find(r => r.value === s3.business_reason_type)?.label ?? '';
}

// ── Code preview panel ────────────────────────────────────────────────────────

interface CodePreviewPanelProps {
  s1: Step1Data;
  s2: Step2Data;
  dupeStatus: 'idle' | 'searching' | 'found' | 'clear';
  dupeCount: number;
}

function CodePreviewPanel({ s1, s2, dupeStatus, dupeCount }: CodePreviewPanelProps) {
  const def = getProductDef(s2.productTypeCode);
  const typeCode = s1.request_type ? ITEM_TYPE_CODE[s1.request_type] : null;
  const rfidCode = s2.rfid !== null ? (s2.rfid ? 'R' : 'L') : null;
  const hasVariants = !!(s2.sizeCode || s2.colourCode);
  const segments = getSkuSegments(s1, s2);
  const code = buildItemCode(segments);
  const codeReady = !!(typeCode && rfidCode && s2.categoryCode && s2.productTypeCode);

  const noSize   = def !== null && !def.bedSizes && !def.bodySizes;
  const noColour = def !== null && !def.hasColour;

  const showCustomerRow = s1.request_type === 'COG' || s1.request_type === 'CUSTOMER_SPECIFIC';

  type SegRow = { code: string|null; label: string; hint: string; na?: boolean };
  const rows: SegRow[] = [
    { code: typeCode,           label: typeCode ? ITEM_TYPE_LABEL[typeCode] : '',    hint: 'Transaction type' },
    { code: rfidCode,           label: rfidCode ? (s2.rfid ? 'RFID tracked' : 'Non-RFID') : '', hint: 'RFID tracking' },
    { code: s2.categoryCode,    label: s2.categoryLabel,  hint: 'Catalogue category' },
    ...(showCustomerRow ? [{ code: s2.customerCode || null, label: s2.customerName ? `Customer: ${s2.customerName}` : '', hint: 'Customer code' }] : []),
    { code: s2.productTypeCode, label: s2.productTypeLabel, hint: 'Product type' },
    noSize
      ? { code: '—', label: 'No size', hint: 'Size', na: true }
      : { code: s2.sizeCode, label: s2.sizeLabel, hint: 'Size' },
    { code: hasVariants ? '01' : null, label: 'Variant 1', hint: 'Variant' },
    noColour
      ? { code: '—', label: 'No colour', hint: 'Colour', na: true }
      : { code: s2.colourCode, label: s2.colourLabel === 'Other' ? `Other (${s2.colourCustom || 'TBD'})` : s2.colourLabel, hint: 'Colour' },
  ];

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Proposed Item Code</p>

        <div className="bg-gray-50 dark:bg-[#12141b] rounded-xl px-4 py-3 mb-4 min-h-[52px] flex items-center">
          {codeReady ? (
            <p className="font-mono font-black text-lg text-gray-900 dark:text-white tracking-widest break-all">
              {code}
            </p>
          ) : (
            <p className="font-mono text-sm text-gray-300 dark:text-gray-700 tracking-widest">
              Make selections to build your code
            </p>
          )}
        </div>

        <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <span className={`font-mono text-[11px] font-black w-9 text-right shrink-0 ${
                row.na   ? 'text-gray-300 dark:text-gray-700' :
                row.code ? 'text-[var(--color-brand)]'       :
                           'text-gray-200 dark:text-gray-800'
              }`}>
                {row.na ? '—' : (row.code ?? '?')}
              </span>
              <span className={`text-xs truncate ${
                row.na   ? 'text-gray-400 dark:text-gray-600 italic' :
                row.code ? 'text-gray-700 dark:text-gray-300'        :
                           'text-gray-300 dark:text-gray-700'
              }`}>
                {row.code || row.na ? (row.label || row.hint) : row.hint}
              </span>
            </div>
          ))}
        </div>
      </div>

      {dupeStatus !== 'idle' && (
        <div className={`rounded-xl p-3 flex items-center gap-2 text-xs font-medium ${
          dupeStatus === 'searching' ? 'bg-gray-50 dark:bg-gray-800/60 text-gray-500' :
          dupeStatus === 'found'     ? 'bg-amber-50 dark:bg-amber-500/8 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-500/15' :
                                       'bg-green-50 dark:bg-green-500/8 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-500/15'
        }`}>
          {dupeStatus === 'searching' && <Search size={12} className="shrink-0 animate-pulse" />}
          {dupeStatus === 'found'     && <AlertCircle size={12} className="shrink-0" />}
          {dupeStatus === 'clear'     && <Check size={12} className="shrink-0" />}
          <span>
            {dupeStatus === 'searching' ? 'Checking master catalogue…' :
             dupeStatus === 'found'     ? `${dupeCount} similar item${dupeCount !== 1 ? 's' : ''} found — review required` :
                                          'No matching items found in catalogue'}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Step 1: Transaction Type ──────────────────────────────────────────────────

const TYPE_CARDS = [
  { value: 'PURCHASE_AND_SALE' as ItemRequestType, code: 'P', label: 'Standard Item',      desc: 'Purchased from supplier — sell pricing will be set during the pricing review stage.',     icon: ShoppingCart, color: 'text-blue-500'   },
  { value: 'PURCHASE_ONLY'     as ItemRequestType, code: 'P', label: 'Purchase Only',       desc: 'Purchased internally with no sell variant (e.g. RFID chips, consumables, PPE).',         icon: Package,      color: 'text-violet-500' },
  { value: 'SALE_ONLY'         as ItemRequestType, code: 'S', label: 'Sale Only',            desc: 'Rare — sold without a purchase record (e.g. consolidated off-cuts sold as rags).',      icon: Tag,          color: 'text-emerald-500'},
  { value: 'COG'               as ItemRequestType, code: 'P', label: 'COG',                  desc: 'Customer-owned goods processed and managed on their behalf.',                            icon: Users,        color: 'text-amber-500'  },
  { value: 'REPLACEMENT'       as ItemRequestType, code: 'P', label: 'Replacement',          desc: 'Replaces an existing item being retired or superseded.',                                 icon: RefreshCw,    color: 'text-rose-500'   },
  { value: 'CUSTOMER_SPECIFIC' as ItemRequestType, code: 'P', label: 'Customer-Specific',    desc: 'Created exclusively for a single customer or contract.',                                 icon: User,         color: 'text-indigo-500' },
];

interface Step1Props { data: Step1Data; onChange: (v: Step1Data) => void; }

function Step1TypeSelector({ data, onChange }: Step1Props) {
  const [showSelector, setShowSelector] = useState(!data.request_type);
  const selected = TYPE_CARDS.find(c => c.value === data.request_type);

  const header = (
    <div>
      <h2 className="text-xl font-black text-gray-900 dark:text-white">What type of transaction is this?</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        This becomes the first character of your item code — <span className="font-bold">P</span> (Purchase) or <span className="font-bold">S</span> (Sale only — rare).
      </p>
    </div>
  );

  if (!showSelector && selected) {
    const Icon = selected.icon;
    return (
      <div className="space-y-5">
        {header}
        <div className="flex items-center gap-3 px-4 py-3 bg-[var(--color-brand)]/5 border-2 border-[var(--color-brand)]/20 rounded-xl">
          <div className={`p-1.5 rounded-lg bg-white dark:bg-nocturne ${selected.color} shrink-0`}>
            <Icon size={16} />
          </div>
          <Check size={14} className="text-[var(--color-brand)] shrink-0" />
          <span className="text-sm font-bold text-gray-900 dark:text-white flex-1">{selected.label}</span>
          <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-[var(--color-brand)] text-white shrink-0">
            {selected.code}
          </span>
          <button
            type="button"
            onClick={() => setShowSelector(true)}
            className="text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-[var(--color-brand)] transition-colors px-2.5 py-1 rounded-lg hover:bg-[var(--color-brand)]/10 shrink-0"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TYPE_CARDS.map(card => {
          const Icon = card.icon;
          const sel = data.request_type === card.value;
          return (
            <button key={card.value} type="button"
              onClick={() => { onChange({ request_type: card.value }); setShowSelector(false); }}
              className={`text-left p-4 rounded-2xl border-2 transition-all flex items-start gap-4 ${
                sel ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 shadow-lg shadow-[var(--color-brand)]/10'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-nocturne hover:border-gray-300 dark:hover:border-gray-600'
              }`}>
              <div className={`mt-0.5 p-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 ${card.color} shrink-0`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-bold text-sm ${sel ? 'text-[var(--color-brand)]' : 'text-gray-900 dark:text-white'}`}>
                    {card.label}
                  </span>
                  <span className={`font-mono text-xs font-black px-1.5 py-0.5 rounded ${
                    sel ? 'bg-[var(--color-brand)] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  }`}>{card.code}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{card.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── UOM options ───────────────────────────────────────────────────────────────

const UOM_OPTIONS = [
  { value: 'EA',  label: 'Each'     },
  { value: 'DZ',  label: 'Dozen'    },
  { value: 'PAR', label: 'Pair'     },
  { value: 'SET', label: 'Set'      },
  { value: 'PKT', label: 'Packet'   },
  { value: 'KG',  label: 'Kilogram' },
  { value: 'M',   label: 'Metre'    },
];

// ── Step 2: Code builder ──────────────────────────────────────────────────────

interface Step2Props {
  data: Step2Data;
  onChange: (v: Partial<Step2Data>) => void;
  requestType: ItemRequestType | null;
  colours: ColourOption[];
  onDupeStatusChange: (status: 'idle'|'searching'|'found'|'clear', count: number) => void;
  onPerfectMatchChange: (has: boolean) => void;
  onExit: () => void;
}

function Step2CodeBuilder({ data, onChange, requestType, colours, onDupeStatusChange, onPerfectMatchChange, onExit }: Step2Props) {
  const def = getProductDef(data.productTypeCode);
  const hasSize   = def ? (def.bedSizes || def.bodySizes) : false;
  const hasColour = def ? def.hasColour  : false;
  const hasGSM    = def ? def.hasGSM     : false;

  // Custom materials saved in localStorage
  const [customMaterials, setCustomMaterials] = useState<string[]>(() => getCustomMaterials());

  // Local dupe status for inline display
  const [localDupeStatus, setLocalDupeStatus] = useState<'idle'|'searching'|'found'|'clear'>('idle');
  const [localDupeCount, setLocalDupeCount] = useState(0);

  // Auto-set COG category on mount
  useEffect(() => {
    if (requestType === 'COG' && !data.categoryCode) {
      onChange({ categoryLabel: 'COG', categoryCode: 'CG' });
    }
  }, [requestType]);

  // Progressive reveal state
  const isCOG              = requestType === 'COG';
  const isCustomerSpecific = requestType === 'CUSTOMER_SPECIFIC';
  const showProductType = !!data.categoryCode;
  const showRfid        = !!data.productTypeCode;
  const showSize        = showRfid && data.rfid !== null;
  const showColour      = showSize && (hasSize ? !!data.sizeCode : true);
  const showSpec        = showColour && (hasColour ? (!!data.colourCode || data.colourLabel === 'Other') : true);

  // Collapse state: sections user has explicitly expanded (clicking "Change")
  // By default, sections with values show as chips; no value → full selector
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const expandSection  = (s: string) => setExpandedSections(prev => new Set([...prev, s]));
  const collapseSection = (s: string) => setExpandedSections(prev => { const n = new Set(prev); n.delete(s); return n; });
  const showingSelector = (section: string, hasValue: boolean) => !hasValue || expandedSections.has(section);

  // Duplicate search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!data.productTypeCode || !data.categoryCode) {
      onDupeStatusChange('idle', 0);
      setLocalDupeStatus('idle');
      setLocalDupeCount(0);
      setSearchResults([]);
      onPerfectMatchChange(false);
      return;
    }
    const term = [data.colourLabel, data.productTypeLabel, data.sizeLabel].filter(Boolean).join(' ');
    onDupeStatusChange('searching', 0);
    setLocalDupeStatus('searching');
    setLocalDupeCount(0);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchExistingItems(term);
        const top = results.slice(0, 5);
        setSearchResults(top);
        const hasPerfect = top.some(item => calculateSimilarity(item, data) >= 95);
        onPerfectMatchChange(hasPerfect);
        const status = results.length > 0 ? 'found' : 'clear';
        onDupeStatusChange(status, results.length);
        setLocalDupeStatus(status);
        setLocalDupeCount(results.length);
      } catch {
        onDupeStatusChange('idle', 0);
        setLocalDupeStatus('idle');
        setLocalDupeCount(0);
        onPerfectMatchChange(false);
      }
    }, 700);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [data.productTypeCode, data.categoryCode, data.colourLabel, data.sizeLabel]);

  // When product type changes, auto-reset dependent fields + set N/A flags
  const handleProductTypeChange = (pt: ProductTypeDef) => {
    onChange({
      productTypeLabel: pt.label,
      productTypeCode: pt.code,
      sizeLabel: '',
      sizeCode: '',
      colourLabel: '',
      colourCode: '',
      colourCustom: '',
      gsm: '',
      gsmSkipped: !pt.hasGSM,
      rfid: null,
    });
    collapseSection('productType');
  };

  const groupedProducts = PRODUCT_GROUPS.map(g => ({
    group: g,
    items: PRODUCT_TYPE_DEFS.filter(p => p.group === g),
  }));

  // Scored results for similarity display
  const scoredResults = searchResults
    .map(item => ({ ...item, similarity: calculateSimilarity(item, data) }))
    .sort((a, b) => b.similarity - a.similarity);
  const hasPerfectMatch = scoredResults.some(r => r.similarity >= 95);

  const similarityColor = (pct: number) =>
    pct >= 95 ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' :
    pct >= 70 ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' :
                'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20';

  let sectionN = isCustomerSpecific ? 2 : 1;

  return (
    <div className="space-y-8">

      {/* ── COG: auto-category + Customer Name ── */}
      {isCOG && (
        <section className="space-y-3">
          <SectionLabel n={1} done={!!data.customerCode} title="Customer Name" sub="Generates 2-letter customer code (Segment 4)" />
          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={data.customerName}
                onChange={e => {
                  const name = e.target.value;
                  const code = generateCustomerCode(name);
                  onChange({ customerName: name, customerCode: code, categoryCode: 'CG', categoryLabel: 'COG' });
                }}
                placeholder="e.g. Hilton Hotel, Marriott, Healthcare NSW"
                className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
              />
            </div>
            {data.customerCode && (
              <div className="flex items-center gap-3 px-4 py-3 bg-[var(--color-brand)]/5 border border-[var(--color-brand)]/20 rounded-xl">
                <span className="font-mono text-lg font-black text-[var(--color-brand)]">{data.customerCode}</span>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Customer code generated</p>
                  <p className="text-xs text-gray-500">This 2-letter code will appear in the item code after CG (COG category)</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <span className="font-mono text-xs font-black text-gray-400">CG</span>
              <span className="text-xs text-gray-500">Catalogue category auto-set to COG</span>
              <span className="ml-auto font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-[var(--color-brand)] text-white">LOCKED</span>
            </div>
          </div>
        </section>
      )}

      {/* ── CUSTOMER_SPECIFIC: Customer Name (before category) ── */}
      {isCustomerSpecific && (
        <section className="space-y-3">
          <SectionLabel n={1} done={!!data.customerCode} title="Customer Name" sub="Generates 2-letter customer code for item code" />
          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={data.customerName}
                onChange={e => {
                  const name = e.target.value;
                  const code = generateCustomerCode(name);
                  onChange({ customerName: name, customerCode: code });
                }}
                placeholder="e.g. Hilton Hotel, Marriott, Healthcare NSW"
                className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
              />
            </div>
            {data.customerCode && (
              <div className="flex items-center gap-3 px-4 py-3 bg-[var(--color-brand)]/5 border border-[var(--color-brand)]/20 rounded-xl">
                <span className="font-mono text-lg font-black text-[var(--color-brand)]">{data.customerCode}</span>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Customer code generated</p>
                  <p className="text-xs text-gray-500">This 2-letter code will appear in the item code after the catalogue category</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Section: Category (hidden for COG — auto-set) ── */}
      {!isCOG && (
      <section className="space-y-3">
        <SectionLabel n={isCustomerSpecific ? sectionN : 1} done={!!data.categoryCode} title="Catalogue Category" sub="Segment 3 of your code" />
        {!showingSelector('category', !!data.categoryCode) ? (
          <SelectedChip
            label={`${data.categoryLabel} — ${data.categoryCode}`}
            onClear={() => expandSection('category')}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CATEGORIES.map(cat => {
              const sel = data.categoryCode === cat.code;
              return (
                <button key={cat.code} type="button"
                  onClick={() => { onChange({ categoryLabel: cat.label, categoryCode: cat.code }); collapseSection('category'); }}
                  className={`text-left p-3.5 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    sel ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-nocturne hover:border-gray-300 dark:hover:border-gray-600'
                  }`}>
                  <span className={`font-mono text-sm font-black w-8 text-center shrink-0 px-1 py-0.5 rounded ${
                    sel ? 'bg-[var(--color-brand)] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                  }`}>{cat.code}</span>
                  <div className="min-w-0">
                    <p className={`text-sm font-bold ${sel ? 'text-[var(--color-brand)]' : 'text-gray-900 dark:text-white'}`}>{cat.label}</p>
                    <p className="text-[11px] text-gray-400 truncate">{cat.description}</p>
                  </div>
                  {sel && <Check size={14} className="text-[var(--color-brand)] shrink-0 ml-auto" />}
                </button>
              );
            })}
          </div>
        )}
      </section>
      )}

      {/* ── Section: Product Type ── */}
      {showProductType && (() => { sectionN++; return (
        <section className="space-y-3 animate-slide-up">
          <SectionLabel n={sectionN} done={!!data.productTypeCode} title="Product Type" sub="Segment 4 of your code" />
          {!showingSelector('productType', !!data.productTypeCode) ? (
            <SelectedChip
              label={data.productTypeLabel}
              code={data.productTypeCode}
              onClear={() => expandSection('productType')}
            />
          ) : (
            <div className="space-y-4">
              {groupedProducts.map(({ group, items }) => (
                <div key={group}>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {items.map(pt => {
                      const sel = data.productTypeCode === pt.code;
                      return (
                        <button key={pt.code} type="button" onClick={() => handleProductTypeChange(pt)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm transition-all ${
                            sel ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 text-[var(--color-brand)]'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-nocturne text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}>
                          <span className={`font-mono text-[10px] font-black ${sel ? 'text-[var(--color-brand)]' : 'text-gray-400'}`}>{pt.code}</span>
                          <span className="font-medium">{pt.label}</span>
                          {sel && <Check size={12} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ); })()}

      {/* ── Section: RFID ── */}
      {showRfid && (() => { sectionN++; return (
        <section className="space-y-3 animate-slide-up">
          <SectionLabel n={sectionN} done={data.rfid !== null} title="RFID Tracking" sub="Segment 2 of your code" />
          {!showingSelector('rfid', data.rfid !== null) ? (
            <SelectedChip
              label={data.rfid ? 'RFID Tracked' : 'Non-RFID'}
              code={data.rfid ? 'R' : 'L'}
              onClear={() => expandSection('rfid')}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { val: true,  code: 'R', label: 'RFID Tracked',  desc: 'Item carries an RFID chip for automated tracking.', Icon: Wifi },
                { val: false, code: 'L', label: 'Non-RFID',      desc: 'Standard item — no chip or automated tracking.',   Icon: WifiOff },
              ].map(opt => {
                const sel = data.rfid === opt.val;
                const Icon = opt.Icon;
                return (
                  <button key={String(opt.val)} type="button"
                    onClick={() => { onChange({ rfid: opt.val }); collapseSection('rfid'); }}
                    className={`text-left p-4 rounded-xl border-2 transition-all flex items-start gap-3 ${
                      sel ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-nocturne hover:border-gray-300 dark:hover:border-gray-600'
                    }`}>
                    <Icon size={18} className={sel ? 'text-[var(--color-brand)] mt-0.5' : 'text-gray-400 mt-0.5'} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${sel ? 'text-[var(--color-brand)]' : 'text-gray-900 dark:text-white'}`}>{opt.label}</span>
                        <span className={`font-mono text-[10px] font-black px-1.5 py-0.5 rounded ${sel ? 'bg-[var(--color-brand)] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>{opt.code}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ); })()}

      {/* ── Section: Size ── */}
      {showSize && hasSize && (() => { sectionN++; return (
        <section className="space-y-3 animate-slide-up">
          <SectionLabel n={sectionN} done={!!data.sizeCode} title="Size" sub="Segment 5 of your code" />
          {!showingSelector('size', !!data.sizeCode) ? (
            <SelectedChip
              label={data.sizeLabel}
              code={data.sizeCode}
              onClear={() => expandSection('size')}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(def!.bedSizes ? BED_SIZES : BODY_SIZES).map(sz => {
                const sel = data.sizeCode === sz.code;
                return (
                  <button key={sz.code} type="button"
                    onClick={() => { onChange({ sizeLabel: sz.label, sizeCode: sz.code }); collapseSection('size'); }}
                    className={`flex flex-col items-center px-4 py-2.5 rounded-xl border-2 transition-all min-w-[64px] ${
                      sel ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-nocturne hover:border-gray-300 dark:hover:border-gray-600'
                    }`}>
                    <span className={`font-mono text-sm font-black ${sel ? 'text-[var(--color-brand)]' : 'text-gray-400'}`}>{sz.code}</span>
                    <span className={`text-xs mt-0.5 ${sel ? 'font-bold text-[var(--color-brand)]' : 'text-gray-600 dark:text-gray-400'}`}>{sz.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ); })()}

      {/* ── Section: Colour ── */}
      {showColour && hasColour && (() => { sectionN++; return (
        <section className="space-y-3 animate-slide-up">
          <SectionLabel n={sectionN} done={!!data.colourCode || data.colourLabel === 'Other'} title="Colour" sub="Segment 7 of your code" />
          {!showingSelector('colour', !!(data.colourCode || (data.colourLabel === 'Other' && data.colourCustom))) ? (
            <SelectedChip
              label={data.colourLabel === 'Other' ? `Other — ${data.colourCustom || 'Custom'}` : data.colourLabel}
              code={data.colourCode || undefined}
              onClear={() => expandSection('colour')}
            />
          ) : (
            <>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {colours.map(col => {
                  const sel = data.colourLabel === col.label;
                  return (
                    <button key={col.id} type="button"
                      onClick={() => {
                        onChange({ colourLabel: col.label, colourCode: col.code, colourCustom: '' });
                        if (col.label !== 'Other') collapseSection('colour');
                      }}
                      className={`flex flex-col items-center p-2 rounded-xl border-2 transition-all gap-1.5 ${
                        sel ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-nocturne hover:border-gray-300 dark:hover:border-gray-600'
                      }`}>
                      <div className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 shrink-0"
                        style={colourSwatchStyle(col)} />
                      <span className={`font-mono text-[9px] font-black leading-none ${sel ? 'text-[var(--color-brand)]' : 'text-gray-400'}`}>
                        {col.code || '?'}
                      </span>
                      <span className={`text-[10px] text-center leading-tight ${sel ? 'font-bold text-[var(--color-brand)]' : 'text-gray-600 dark:text-gray-400'}`}>
                        {col.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {data.colourLabel === 'Other' && (
                <div className="space-y-1">
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Non-standard colours don't generate a colour code segment. Master Data will assign one during item definition.
                  </p>
                  <input type="text" value={data.colourCustom}
                    onChange={e => onChange({ colourCustom: e.target.value })}
                    onBlur={() => { if (data.colourCustom.trim()) collapseSection('colour'); }}
                    placeholder="Describe the colour (e.g. Dusty Rose, Sage Green)…"
                    className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all" />
                </div>
              )}
            </>
          )}
        </section>
      ); })()}

      {/* ── Section: Specification Details ── */}
      {showSpec && (() => { sectionN++; return (
        <section className="space-y-4 animate-slide-up">
          <SectionLabel n={sectionN} done={!!data.material} title="Specification Details" sub="Non-code attributes for Master Data" />
          <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-blue-50 dark:bg-blue-500/8 border border-blue-100 dark:border-blue-500/20 text-xs text-blue-700 dark:text-blue-400">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>Fill in what you know. The <strong>Procurement team</strong> will review this request and complete any missing technical details before it reaches Master Data.</span>
          </div>

          <div className="space-y-5">
            {/* Material — full width */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Material <span className="text-red-500">*</span></label>
              <div className="flex flex-wrap gap-2">
                {MATERIALS.filter(m => m !== 'Other').map(m => (
                  <button key={m} type="button" onClick={() => onChange({ material: m, materialCustom: '' })}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      data.material === m ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 text-[var(--color-brand)] font-bold'
                                         : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}>{m}</button>
                ))}
                {customMaterials.map(m => (
                  <button key={m} type="button" onClick={() => onChange({ material: m, materialCustom: '' })}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      data.material === m ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 text-[var(--color-brand)] font-bold'
                                         : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}>{m}</button>
                ))}
                <button type="button" onClick={() => onChange({ material: 'Other' })}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    data.material === 'Other' ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 text-[var(--color-brand)] font-bold'
                                             : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}>Other</button>
              </div>
              {data.material === 'Other' && (
                <input
                  type="text"
                  value={data.materialCustom}
                  onChange={e => onChange({ materialCustom: e.target.value })}
                  onBlur={() => {
                    const trimmed = data.materialCustom.trim();
                    if (trimmed) {
                      saveCustomMaterial(trimmed);
                      setCustomMaterials(getCustomMaterials());
                      onChange({ material: trimmed, materialCustom: '' });
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const trimmed = data.materialCustom.trim();
                      if (trimmed) {
                        saveCustomMaterial(trimmed);
                        setCustomMaterials(getCustomMaterials());
                        onChange({ material: trimmed, materialCustom: '' });
                      }
                    }
                  }}
                  placeholder="Describe the material (e.g. Linen Blend, Viscose)…"
                  className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
                />
              )}
            </div>

            <hr className="border-gray-100 dark:border-gray-800" />

            {/* Measurements row — 3 columns */}
            <div className="grid grid-cols-3 gap-4">
              {/* GSM */}
              {hasGSM ? (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    GSM
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input type="text" inputMode="numeric" value={data.gsm}
                        onChange={e => onChange({ gsm: e.target.value.replace(/[^0-9]/g, ''), gsmSkipped: false })}
                        placeholder="e.g. 500"
                        disabled={data.gsmSkipped}
                        className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 pr-10 text-sm font-mono outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all disabled:opacity-40" />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-semibold pointer-events-none">g/m²</span>
                    </div>
                    <button type="button" onClick={() => onChange({ gsm: '', gsmSkipped: !data.gsmSkipped })}
                      className={`flex items-center gap-1 px-2 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                        data.gsmSkipped ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 text-[var(--color-brand)]'
                                        : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}>
                      {data.gsmSkipped && <Check size={11} />}
                      N/A
                    </button>
                  </div>
                  {!data.gsm && !data.gsmSkipped && (
                    <p className="text-[11px] text-gray-400">Optional</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">GSM</label>
                  <p className="text-xs text-gray-400 italic">N/A for this type</p>
                </div>
              )}

              {/* UOM */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">UOM</label>
                <div className="flex flex-wrap gap-1.5">
                  {UOM_OPTIONS.map(u => (
                    <button key={u.value} type="button" onClick={() => onChange({ uom: u.value })}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                        data.uom === u.value ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 text-[var(--color-brand)] font-bold'
                                             : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                      }`}>
                      <span className="font-mono font-black">{u.value}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400">Optional</p>
              </div>

              {/* UPQ */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">UPQ</label>
                <input type="text" inputMode="numeric" value={data.upq}
                  onChange={e => onChange({ upq: e.target.value.replace(/[^0-9]/g, '') || '1' })}
                  placeholder="1"
                  className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all" />
                <p className="text-[11px] text-gray-400">Optional</p>
              </div>
            </div>

            {/* Dimensions (if applicable) */}
            {def?.hasDimensions && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Dimensions</label>
                <div className="flex items-center gap-2">
                  <input type="text" value={data.width_cm} onChange={e => onChange({ width_cm: e.target.value.replace(/[^0-9.]/g,'') })}
                    placeholder="Width" className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all" />
                  <span className="text-gray-400 shrink-0">×</span>
                  <input type="text" value={data.height_cm} onChange={e => onChange({ height_cm: e.target.value.replace(/[^0-9.]/g,'') })}
                    placeholder="Length" className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all" />
                  <span className="text-xs text-gray-400 shrink-0">cm</span>
                </div>
              </div>
            )}

            <hr className="border-gray-100 dark:border-gray-800" />

            {/* Grade / Standard — full width */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Grade / Standard</label>
              <div className="flex flex-wrap gap-2">
                {GRADES.map(g => (
                  <button key={g} type="button" onClick={() => onChange({ grade: g })}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      data.grade === g ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 text-[var(--color-brand)] font-bold'
                                       : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}>{g}</button>
                ))}
              </div>
            </div>

            {/* Additional Notes — full width */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Additional Notes <span className="font-normal text-gray-400 normal-case">(optional)</span></label>
              <textarea value={data.additional_notes} onChange={e => onChange({ additional_notes: e.target.value })}
                placeholder="Packaging requirements, special finish, branding specs, compliance notes…"
                rows={2} className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all resize-none" />
            </div>
          </div>
        </section>
      ); })()}

      {/* ── Similarity check results ── */}
      {showSpec && scoredResults.length > 0 && (
        <section className="space-y-3 animate-slide-up">
          <div className={`rounded-xl overflow-hidden border ${hasPerfectMatch ? 'border-red-200 dark:border-red-500/25' : 'border-amber-200 dark:border-amber-500/20'}`}>
            <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${hasPerfectMatch ? 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20' : 'bg-amber-50 dark:bg-amber-500/8 border-amber-100 dark:border-amber-500/15'}`}>
              <AlertCircle size={13} className={hasPerfectMatch ? 'text-red-500 shrink-0' : 'text-amber-500 shrink-0'} />
              <span className={`text-xs font-bold uppercase tracking-wide ${hasPerfectMatch ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {hasPerfectMatch ? 'Exact Match Detected — Cannot Submit' : 'Similar Items Found — Review Before Continuing'}
              </span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-nocturne">
              {scoredResults.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <Package size={13} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.sku}{item.category ? ` · ${item.category}` : ''}</p>
                  </div>
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded border shrink-0 ${similarityColor(item.similarity)}`}>
                    {item.similarity}% match
                  </span>
                </div>
              ))}
            </div>
            <div className={`flex items-center justify-between px-4 py-3 border-t ${hasPerfectMatch ? 'bg-red-50/50 dark:bg-red-500/5 border-red-100 dark:border-red-500/10' : 'bg-amber-50/50 dark:bg-amber-500/5 border-amber-100 dark:border-amber-500/10'}`}>
              <p className={`text-xs ${hasPerfectMatch ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {hasPerfectMatch
                  ? 'A 95–100% match means this item already exists. You cannot create a duplicate.'
                  : 'If any match is what you need, use the existing item instead.'}
              </p>
              <button
                type="button"
                onClick={onExit}
                className="ml-4 shrink-0 text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap"
              >
                Exit to My Requests
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Inline catalogue check status ── */}
      {showSpec && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-medium ${
          localDupeStatus === 'searching' ? 'bg-gray-50 dark:bg-gray-800/50 text-gray-500 border border-gray-200 dark:border-gray-700' :
          localDupeStatus === 'found'     ? 'bg-amber-50 dark:bg-amber-500/8 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20' :
          localDupeStatus === 'clear'     ? 'bg-green-50 dark:bg-green-500/8 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-500/15' :
                                            'bg-gray-50 dark:bg-gray-800/50 text-gray-400 border border-gray-200 dark:border-gray-700'
        }`}>
          {localDupeStatus === 'searching' && <Search size={13} className="shrink-0 animate-pulse" />}
          {localDupeStatus === 'found'     && <AlertCircle size={13} className="shrink-0" />}
          {localDupeStatus === 'clear'     && <Check size={13} className="shrink-0" />}
          {localDupeStatus === 'idle'      && <Search size={13} className="shrink-0 opacity-40" />}
          <span>
            {localDupeStatus === 'searching' ? 'Checking master catalogue for similar items…' :
             localDupeStatus === 'found'     ? `${localDupeCount} similar item${localDupeCount !== 1 ? 's' : ''} found in catalogue — review the list above before confirming` :
             localDupeStatus === 'clear'     ? 'No matching items found in the master catalogue' :
                                              'Catalogue check will run once product type and category are selected'}
          </span>
        </div>
      )}

    </div>
  );
}

// ── Step 3: Business Context & Systems ────────────────────────────────────────

interface Step3Props {
  data: Step3Data;
  onChange: (v: Partial<Step3Data>) => void;
  requestType: ItemRequestType | null;
}

function Step3Context({ data, onChange, requestType }: Step3Props) {
  const isCustomerSpecific = requestType === 'CUSTOMER_SPECIFIC';
  const isReplacement      = requestType === 'REPLACEMENT';
  const isCOG              = requestType === 'COG';

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-black text-gray-900 dark:text-white">Business context</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Why is this item needed, and where should it appear?</p>
      </div>

      {/* Business Reason */}
      <section className="space-y-3">
        <SectionLabel n={1} done={!!data.business_reason_type && (data.business_reason_type !== 'OTHER' || data.business_reason_other.length >= 20)} title="Business Reason" sub="Required for all requests" />
        <div className="space-y-2">
          {BUSINESS_REASONS.map(opt => {
            const sel = data.business_reason_type === opt.value;
            return (
              <button key={opt.value} type="button"
                onClick={() => onChange({ business_reason_type: opt.value, business_reason_other: opt.value !== 'OTHER' ? '' : data.business_reason_other })}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  sel ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-nocturne hover:border-gray-300 dark:hover:border-gray-600'
                }`}>
                <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${sel ? 'border-[var(--color-brand)] bg-[var(--color-brand)]' : 'border-gray-300 dark:border-gray-600'}`}>
                  {sel && <Check size={9} strokeWidth={3} className="text-white" />}
                </div>
                <span className={`text-sm ${sel ? 'font-bold text-[var(--color-brand)]' : 'font-medium text-gray-700 dark:text-gray-300'}`}>{opt.label}</span>
              </button>
            );
          })}
          {data.business_reason_type === 'OTHER' && (
            <div className="space-y-1">
              <textarea value={data.business_reason_other} onChange={e => onChange({ business_reason_other: e.target.value })}
                placeholder="Describe the business reason in detail (minimum 20 characters)…"
                rows={3} maxLength={500}
                className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all resize-none" />
              <div className="flex justify-between text-xs text-gray-400">
                <span className={data.business_reason_other.length > 0 && data.business_reason_other.length < 20 ? 'text-amber-500' : ''}>
                  {data.business_reason_other.length < 20 && data.business_reason_other.length > 0 ? `${20 - data.business_reason_other.length} more characters needed` : ''}
                </span>
                <span>{data.business_reason_other.length}/500</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Target Systems */}
      <section className="space-y-3">
        <SectionLabel n={2} done={true} title="Target Systems" sub="SAP is always included" />
        <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#15171e]/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3">
          SAP is required for all items. Select additional systems where this item must be active.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { key: 'target_bundle',    label: 'Bundle',     desc: 'Kit and bundle configurations', Icon: Package },
            { key: 'target_linenhub',  label: 'LinenHub',   desc: 'LinenHub customer portal',       Icon: Layers  },
            { key: 'target_salesforce',label: 'Salesforce', desc: 'Sales team CRM visibility',      Icon: Users   },
          ].map(sys => {
            const active = data[sys.key as keyof Step3Data] as boolean;
            const Icon = sys.Icon;
            return (
              <button key={sys.key} type="button" onClick={() => onChange({ [sys.key]: !active } as any)}
                className={`text-left p-4 rounded-2xl border-2 transition-all flex items-start gap-3 ${
                  active ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-nocturne hover:border-gray-300 dark:hover:border-gray-600'
                }`}>
                <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${active ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`font-bold text-sm ${active ? 'text-[var(--color-brand)]' : 'text-gray-700 dark:text-gray-300'}`}>{sys.label}</span>
                    {active && <Check size={13} className="text-[var(--color-brand)]" />}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sys.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
        {isCOG && <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/8 border border-amber-200 dark:border-amber-500/20 rounded-xl px-4 py-3">COG items are customer-managed and typically do not appear in the standard sales catalogue.</p>}
      </section>

      {/* Urgency */}
      <section className="space-y-3">
        <div className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${data.is_urgent ? 'border-red-400 bg-red-50 dark:bg-red-500/5' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-nocturne'}`}
          onClick={() => onChange({ is_urgent: !data.is_urgent, urgent_reason: '' })} role="checkbox" aria-checked={data.is_urgent} tabIndex={0}
          onKeyDown={e => e.key === ' ' && onChange({ is_urgent: !data.is_urgent, urgent_reason: '' })}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${data.is_urgent ? 'bg-red-100 dark:bg-red-500/20 text-red-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}><Zap size={16} /></div>
            <div>
              <p className={`font-bold text-sm ${data.is_urgent ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>Mark as urgent</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Prioritised in the review queue — for time-critical requirements only.</p>
            </div>
          </div>
          <div className={`w-10 h-6 rounded-full transition-all shrink-0 relative ${data.is_urgent ? 'bg-red-500' : 'bg-gray-200 dark:bg-gray-700'}`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${data.is_urgent ? 'left-5' : 'left-1'}`} />
          </div>
        </div>
        {data.is_urgent && (
          <textarea value={data.urgent_reason} onChange={e => onChange({ urgent_reason: e.target.value })}
            placeholder="Explain the time-critical nature and any hard deadlines…"
            rows={2} maxLength={500}
            className="w-full bg-gray-50 dark:bg-[#15171e] border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-all resize-none" />
        )}
      </section>

      {/* Conditional: Customer / Replacement references */}
      {(isCustomerSpecific || isReplacement) && (
        <section className={`p-4 rounded-2xl border space-y-4 ${isReplacement ? 'border-rose-100 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/5' : 'border-indigo-100 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/5'}`}>
          <p className={`text-xs font-black uppercase tracking-widest ${isReplacement ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
            {isReplacement ? 'Replacement Details' : 'Customer-Specific Details'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isCustomerSpecific && (
              <>
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Customer Reference <span className="text-red-500">*</span></label>
                  <input type="text" value={data.customer_reference} onChange={e => onChange({ customer_reference: e.target.value })} placeholder="Customer name or ID"
                    className="w-full bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Contract Reference</label>
                  <input type="text" value={data.contract_reference} onChange={e => onChange({ contract_reference: e.target.value })} placeholder="Contract number"
                    className="w-full bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all" />
                </div>
              </>
            )}
            {isReplacement && (
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Item Being Replaced <span className="text-red-500">*</span></label>
                <input type="text" value={data.replacement_for_item_id} onChange={e => onChange({ replacement_for_item_id: e.target.value })} placeholder="SAP code or item description"
                  className="w-full bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all" />
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Step 4: Review ────────────────────────────────────────────────────────────

interface Step4Props { step1: Step1Data; step2: Step2Data; step3: Step3Data; onPrevious: () => void; }

function Step4Review({ step1, step2, step3, onPrevious }: Step4Props) {
  const segs  = getSkuSegments(step1, step2);
  const code  = buildItemCode(segs);
  const typeCard = TYPE_CARDS.find(t => t.value === step1.request_type);
  const slaHours = step1.request_type ? URGENCY_SLA_HOURS[step1.request_type] : 48;
  const urgentSla = step3.is_urgent ? Math.floor(slaHours / 2) : slaHours;
  const activeSystems = ['SAP', step3.target_bundle && 'Bundle', step3.target_linenhub && 'LinenHub', step3.target_salesforce && 'Salesforce'].filter(Boolean) as string[];
  const reasonLabel = buildBusinessReason(step3);

  const WORKFLOW = [
    { label: 'Submitted',       detail: 'Your request is received', done: true,  active: false },
    { label: 'Duplicate Check', detail: 'Master Data verifies no existing item matches', done: false, active: true  },
    { label: 'Item Definition', detail: 'Master Data completes SAP and catalogue setup', done: false, active: false },
    { label: 'Pricing Review',  detail: 'Pricing team sets buy and sell prices',         done: false, active: false },
    { label: 'Approval',        detail: 'Approver sign-off based on item type',          done: false, active: false },
    { label: 'Active',          detail: 'Item live in selected systems',                 done: false, active: false },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-gray-900 dark:text-white">Review your request</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Check everything below before submitting. Use Previous to make changes.</p>
      </div>

      {/* Code summary */}
      <div className="bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Generated Item Code</p>
        <p className="font-mono font-black text-2xl text-gray-900 dark:text-white tracking-widest">{code}</p>
        <p className="text-sm text-gray-500">{buildItemDescription(step2)}</p>
      </div>

      {/* Summary table */}
      <div className="bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 bg-gray-50 dark:bg-[#15171e]/50 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
          {typeCard && <div className={`p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 ${typeCard.color}`}><typeCard.icon size={14} /></div>}
          <span className="font-bold text-sm text-gray-900 dark:text-white">{typeCard?.label}</span>
          {step3.is_urgent && <span className="ml-auto bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-black px-2 py-0.5 rounded border border-red-200 dark:border-red-500/20">URGENT</span>}
        </div>
        <div className="px-5 divide-y divide-gray-50 dark:divide-gray-800/60">
          {[
            // Product type leads (human anchor), then code-read order: [Type][RFID][Category][ProductType][Size][Colour]
            { label: 'Product Type',  value: `${step2.productTypeLabel} (${step2.productTypeCode})` },
            { label: 'Transaction',   value: `${typeCard?.label ?? ''} (${step1.request_type ? ITEM_TYPE_CODE[step1.request_type] : ''})` },
            { label: 'RFID',          value: step2.rfid ? 'RFID Tracked (R)' : 'Non-RFID (L)' },
            { label: 'Category',      value: `${step2.categoryLabel} (${step2.categoryCode})` },
            step2.sizeLabel ? { label: 'Size',   value: `${step2.sizeLabel} (${step2.sizeCode})` } : null,
            step2.colourLabel && step2.colourLabel !== 'Other' ? { label: 'Colour', value: `${step2.colourLabel} (${step2.colourCode})` } : null,
            // Non-code attributes
            step2.gsm ? { label: 'Weight / GSM', value: `${step2.gsm} g/m²` } : null,
            step2.material ? { label: 'Material', value: step2.material } : null,
            { label: 'Business Reason', value: reasonLabel },
            { label: 'Target Systems',  value: activeSystems.join(', ') },
            step3.customer_reference ? { label: 'Customer Ref',   value: step3.customer_reference } : null,
            step3.contract_reference ? { label: 'Contract Ref',   value: step3.contract_reference } : null,
            step3.replacement_for_item_id ? { label: 'Replacing', value: step3.replacement_for_item_id } : null,
          ].filter(Boolean).map((row: any) => (
            <div key={row.label} className="flex items-start justify-between gap-4 py-3">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest shrink-0 w-36">{row.label}</span>
              <span className="text-sm text-gray-900 dark:text-white text-right font-medium">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Missing optional attributes ── */}
      {(() => {
        const def = getProductDef(step2.productTypeCode);
        const missing: { field: string; hint: string }[] = [];
        if (def?.hasGSM && !step2.gsm && !step2.gsmSkipped) missing.push({ field: 'Weight / GSM', hint: 'grams per m² — helps classify the item' });
        if (!step2.material) missing.push({ field: 'Material', hint: 'e.g. 100% Cotton, Polyester Blend' });
        if (!step2.grade) missing.push({ field: 'Grade / Standard', hint: 'e.g. Hotel Grade, Healthcare Grade' });
        if (def?.hasDimensions && (!step2.width_cm || !step2.height_cm)) missing.push({ field: 'Dimensions', hint: 'width × length in cm' });
        if (!step2.uom || step2.uom === 'EA') { /* EA is fine default, skip */ }
        const procurementDelay = missing.length > 0 ? 24 : 0;
        const totalHours = urgentSla + procurementDelay;

        return (
          <>
            {missing.length > 0 && (
              <div className="rounded-2xl border border-amber-200 dark:border-amber-500/25 overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-100 dark:border-amber-500/15">
                  <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                  <p className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                    {missing.length} optional {missing.length === 1 ? 'attribute' : 'attributes'} not provided
                  </p>
                </div>
                <div className="bg-white dark:bg-nocturne divide-y divide-amber-50 dark:divide-amber-500/10">
                  {missing.map(m => (
                    <div key={m.field} className="flex items-start gap-3 px-4 py-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{m.field}</span>
                        <span className="text-xs text-gray-400 ml-1.5">— {m.hint}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 bg-amber-50/60 dark:bg-amber-500/5 border-t border-amber-100 dark:border-amber-500/10 space-y-2">
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    <strong>That's OK</strong> — the Procurement team will complete any missing details during their review. However, providing this information now can <strong>reduce review time by up to 24 hours</strong> by removing the need for a separate Procurement review step.
                  </p>
                  <button
                    type="button"
                    onClick={onPrevious}
                    className="flex items-center gap-1.5 text-xs font-black text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition-colors underline underline-offset-2"
                  >
                    <ArrowLeft size={12} />
                    Go back to Build Item Code to add these details
                  </button>
                </div>
              </div>
            )}

            <div className={`flex items-start gap-4 p-4 rounded-2xl border ${missing.length > 0 ? 'bg-amber-50/40 dark:bg-amber-500/5 border-amber-100 dark:border-amber-500/15' : 'bg-blue-50 dark:bg-blue-500/5 border-blue-100 dark:border-blue-500/20'}`}>
              <div className={`p-2.5 rounded-xl shrink-0 ${missing.length > 0 ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'}`}>
                <Clock size={18} />
              </div>
              <div className="min-w-0">
                <p className={`font-bold text-sm ${missing.length > 0 ? 'text-amber-900 dark:text-amber-300' : 'text-blue-900 dark:text-blue-300'}`}>
                  Estimated review time
                </p>
                <p className={`text-sm mt-0.5 ${missing.length > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'}`}>
                  {step3.is_urgent ? 'Urgent — ' : ''}
                  <strong>{totalHours} hours</strong> ({Math.ceil(totalHours / 8)} business days)
                </p>
                {missing.length > 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-1.5 leading-relaxed">
                    Includes ~{procurementDelay}h for Procurement review of missing details.
                    Fill them in above to reduce this to <strong>{urgentSla} hours</strong>.
                  </p>
                )}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

// ── Review context panel (what happens next) ──────────────────────────────────

function ReviewContextPanel({ step1, step2 }: { step1: Step1Data; step2: Step2Data }) {
  const segs = getSkuSegments(step1, step2);
  const code = buildItemCode(segs);
  const STAGES = [
    { label: 'Submitted',          done: true,  active: false },
    { label: 'Duplicate Check',    done: false, active: true  },
    { label: 'Procurement Review', done: false, active: false },
    { label: 'Master Data QA',     done: false, active: false },
    { label: 'Pricing Review',     done: false, active: false },
    { label: 'Approval',           done: false, active: false },
    { label: 'Active',             done: false, active: false },
  ];
  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Your Item Code</p>
        <p className="font-mono font-black text-xl text-gray-900 dark:text-white tracking-widest">{code}</p>
      </div>
      <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">What Happens Next</p>
        <div className="relative">
          {STAGES.map((s, i) => {
            const isLast = i === STAGES.length - 1;
            return (
              <div key={s.label} className="relative flex gap-3">
                <div className="flex flex-col items-center" style={{ width: 28, flexShrink: 0 }}>
                  <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center z-10 shrink-0 ${s.done ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white' : s.active ? 'border-[var(--color-brand)] bg-white dark:bg-nocturne text-[var(--color-brand)]' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-nocturne text-gray-300 dark:text-gray-700'}`}>
                    {s.done ? <Check size={12} strokeWidth={3} /> : <span className="text-[9px] font-black">{i + 1}</span>}
                  </div>
                  {!isLast && <div className={`w-px flex-1 my-1 ${s.done ? 'bg-[var(--color-brand)]/40' : 'bg-gray-200 dark:bg-gray-700'}`} style={{ minHeight: 16 }} />}
                </div>
                <div className={`pb-3 ${isLast ? 'pb-0' : ''}`} style={{ paddingTop: 3 }}>
                  <p className={`text-xs font-bold ${s.done ? 'text-[var(--color-brand)]' : s.active ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────

interface SuccessScreenProps {
  itemCode: string;
  isUrgent: boolean;
  requestType: ItemRequestType | null;
  onViewRequests: () => void;
  onNewRequest: () => void;
}

function SuccessScreen({ itemCode, isUrgent, requestType, onViewRequests, onNewRequest }: SuccessScreenProps) {
  const slaHours = requestType ? URGENCY_SLA_HOURS[requestType] : 48;
  const urgentSla = isUrgent ? Math.floor(slaHours / 2) : slaHours;
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-8 py-12 animate-page-entry text-center">
      <div className="w-20 h-20 bg-[var(--color-brand)]/10 rounded-full flex items-center justify-center mb-8">
        <div className="w-14 h-14 bg-[var(--color-brand)] rounded-full flex items-center justify-center shadow-xl shadow-[var(--color-brand)]/30">
          <Check size={28} className="text-white" strokeWidth={3} />
        </div>
      </div>
      <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Request Submitted</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-4">Your request is now in the Master Data review queue.</p>
      <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white px-5 py-2.5 rounded-xl font-mono font-black text-lg tracking-widest mb-2">
        {itemCode}
      </div>
      {isUrgent
        ? <span className="inline-flex items-center gap-1.5 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-black px-3 py-1 rounded-full border border-red-200 dark:border-red-500/20 mt-2"><Zap size={12} /> URGENT — Expected review within {urgentSla} hours</span>
        : <p className="text-xs text-gray-400 mt-1">Expected review within {urgentSla} hours</p>}
      <div className="flex flex-col sm:flex-row items-center gap-3 mt-10">
        <button onClick={onViewRequests} className="px-8 py-2.5 rounded-xl bg-[var(--color-brand)] text-white font-bold shadow-lg shadow-[var(--color-brand)]/20 hover:opacity-90 active:scale-95 transition-all text-sm">View My Requests</button>
        <button onClick={onNewRequest} className="px-8 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-sm">Submit Another Request</button>
      </div>
    </div>
  );
}

// ── Shared section label ──────────────────────────────────────────────────────

function SectionLabel({ n, done, title, sub }: { n: number; done: boolean; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-black ${done ? 'bg-[var(--color-brand)] text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
        {done ? <Check size={11} strokeWidth={3} /> : n}
      </div>
      <div>
        <p className="text-sm font-bold text-gray-900 dark:text-white leading-none">{title}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ── Collapsed selection chip ──────────────────────────────────────────────────

function SelectedChip({ label, code, onClear }: { label: string; code?: string; onClear: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[var(--color-brand)]/5 border-2 border-[var(--color-brand)]/20 rounded-xl">
      <Check size={14} className="text-[var(--color-brand)] shrink-0" />
      <span className="text-sm font-bold text-gray-900 dark:text-white flex-1 truncate">{label}</span>
      {code && (
        <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-[var(--color-brand)] text-white shrink-0">
          {code}
        </span>
      )}
      <button
        type="button"
        onClick={onClear}
        className="text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-[var(--color-brand)] transition-colors px-2.5 py-1 rounded-lg hover:bg-[var(--color-brand)]/10 shrink-0"
      >
        Change
      </button>
    </div>
  );
}

// ── Similarity scorer ─────────────────────────────────────────────────────────

function calculateSimilarity(item: { name: string; sku?: string; category?: string }, s2: Step2Data): number {
  let score = 0, maxScore = 0;
  const name = (item.name ?? '').toLowerCase();
  const category = (item.category ?? '').toLowerCase();

  if (s2.productTypeLabel && s2.productTypeLabel !== 'Other') {
    maxScore += 35;
    if (name.includes(s2.productTypeLabel.toLowerCase())) score += 35;
    else if (s2.productTypeCode && (item.sku ?? '').toUpperCase().includes(s2.productTypeCode)) score += 20;
  }
  if (s2.categoryLabel) {
    maxScore += 20;
    if (category.includes(s2.categoryLabel.toLowerCase()) || name.includes(s2.categoryCode.toLowerCase())) score += 20;
  }
  if (s2.colourLabel && s2.colourLabel !== 'Other') {
    maxScore += 15;
    if (name.includes(s2.colourLabel.toLowerCase())) score += 15;
  }
  if (s2.sizeLabel) {
    maxScore += 10;
    if (name.includes(s2.sizeLabel.toLowerCase())) score += 10;
  }
  if (s2.material && s2.material !== 'Other') {
    maxScore += 10;
    const mat = s2.material.replace('100% ', '').toLowerCase().split(' ')[0];
    if (name.includes(mat)) score += 10;
  }
  if (s2.gsm && !s2.gsmSkipped) {
    maxScore += 10;
    if (name.includes(`${s2.gsm}gsm`) || name.includes(`${s2.gsm} gsm`)) score += 10;
  }
  return maxScore > 0 ? Math.min(100, Math.round((score / maxScore) * 100)) : 0;
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateStep(step: number, s1: Step1Data, s2: Step2Data, s3: Step3Data): string | null {
  if (step === 0) {
    if (!s1.request_type) return 'Please select a transaction type to continue.';
  }
  if (step === 1) {
    if (!s2.categoryCode)    return 'Please select a catalogue category.';
    if (!s2.productTypeCode) return 'Please select a product type.';
    if (s2.rfid === null)    return 'Please indicate whether this item will be RFID tracked.';
    const def = getProductDef(s2.productTypeCode);
    if (def?.bedSizes || def?.bodySizes) {
      if (!s2.sizeCode) return 'Please select a size.';
    }
    if (def?.hasColour) {
      if (!s2.colourLabel) return 'Please select a colour.';
      if (s2.colourLabel === 'Other' && !s2.colourCustom.trim()) return 'Please describe the custom colour.';
    }
    if (!s2.material) return 'Please select the item material.';
    // Note: GSM, UOM, UPQ are optional — Procurement team will complete if unknown
  }
  if (step === 2) {
    if (!s3.business_reason_type) return 'Please select a business reason.';
    if (s3.business_reason_type === 'OTHER' && s3.business_reason_other.length < 20) return 'Please describe the business reason (at least 20 characters).';
    if (s3.is_urgent && s3.urgent_reason.length < 10) return 'Please explain why this request is urgent.';
    if (s1.request_type === 'CUSTOMER_SPECIFIC' && !s3.customer_reference.trim()) return 'Customer reference is required for Customer-Specific items.';
    if (s1.request_type === 'REPLACEMENT' && !s3.replacement_for_item_id.trim()) return 'Please specify the item being replaced.';
  }
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

const STEP2_INITIAL: Step2Data = {
  categoryLabel: '', categoryCode: '', customerName: '', customerCode: '',
  productTypeLabel: '', productTypeCode: '',
  rfid: null, sizeLabel: '', sizeCode: '', colourLabel: '', colourCode: '', colourCustom: '',
  gsm: '', gsmSkipped: false, material: '', materialCustom: '', width_cm: '', height_cm: '', grade: '',
  uom: 'EA', upq: '1', additional_notes: '',
};
const STEP3_INITIAL: Step3Data = {
  business_reason_type: '', business_reason_other: '', is_urgent: false, urgent_reason: '',
  target_sap: true, target_bundle: false, target_linenhub: false, target_salesforce: false,
  customer_reference: '', contract_reference: '', replacement_for_item_id: '',
};

export default function ItemRequestWizard() {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const { toasts, dismissToast, success, error: toastError } = useToast();

  const [activeStep, setActiveStep]   = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [submittedCode, setSubmittedCode] = useState('');
  const [step1, setStep1] = useState<Step1Data>({ request_type: null });
  const [step2, setStep2] = useState<Step2Data>(STEP2_INITIAL);
  const [step3, setStep3] = useState<Step3Data>(STEP3_INITIAL);
  const [dupeStatus, setDupeStatus] = useState<'idle'|'searching'|'found'|'clear'>('idle');
  const [dupeCount,  setDupeCount]  = useState(0);
  const [hasPerfectMatch, setHasPerfectMatch] = useState(false);
  const [colours, setColours] = useState<ColourOption[]>([]);

  useEffect(() => {
    getActiveColours().then(setColours).catch(console.error);
  }, []);

  const handleContinue = useCallback(async () => {
    if (activeStep === 1 && hasPerfectMatch) {
      toastError('A matching item already exists in the catalogue. You cannot create a duplicate — please exit and use the existing item.');
      return;
    }
    const err = validateStep(activeStep, step1, step2, step3);
    if (err) { toastError(err); return; }
    if (activeStep < STEPS.length - 1) { setActiveStep(p => p + 1); return; }

    setIsSubmitting(true);
    try {
      const segs = getSkuSegments(step1, step2);
      const itemDescription  = buildItemDescription(step2);
      const fullReason = step3.is_urgent && step3.urgent_reason
        ? `${buildBusinessReason(step3)}\n\nUrgency: ${step3.urgent_reason}`
        : buildBusinessReason(step3);
      const request = await createItemRequest({
        request_type:            step1.request_type!,
        item_description:        itemDescription,
        business_reason:         fullReason,
        target_sap:              true,
        target_bundle:           step3.target_bundle,
        target_linenhub:         step3.target_linenhub,
        target_salesforce:       step3.target_salesforce,
        department:              step2.categoryLabel || undefined,
        customer_reference:      step3.customer_reference      || undefined,
        contract_reference:      step3.contract_reference      || undefined,
        replacement_for_item_id: step3.replacement_for_item_id || undefined,
      }, currentUser?.id);
      // Store wizard-derived metadata for downstream pre-population
      if (currentUser?.id) {
        await supabase.from('item_requests').update({
          metadata: {
            categoryCode:    step2.categoryCode,
            productTypeCode: step2.productTypeCode,
            rfid:            step2.rfid,
            sizeCode:        step2.sizeCode,
            colourCode:      step2.colourCode,
            colourCustom:    step2.colourCustom || undefined,
            gsm:             step2.gsm || undefined,
            material:        step2.material || undefined,
            grade:           step2.grade || undefined,
            uom:             step2.uom,
            upq:             step2.upq,
            width_cm:        step2.width_cm || undefined,
            height_cm:       step2.height_cm || undefined,
          },
        }).eq('id', request.id);
      }
      await transitionRequest(request.id, 'SUBMITTED', { actorId: currentUser?.id });
      setSubmittedCode(buildItemCode(segs));
      setSubmitted(true);
      success('Request submitted successfully!');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [activeStep, step1, step2, step3, currentUser, toastError, success]);

  const handlePrevious  = useCallback(() => setActiveStep(p => Math.max(0, p - 1)), []);
  const handleCancel    = useCallback(() => navigate('/items/my-requests'), [navigate]);
  const handleNewRequest = useCallback(() => {
    setActiveStep(0); setSubmitted(false);
    setStep1({ request_type: null }); setStep2(STEP2_INITIAL); setStep3(STEP3_INITIAL);
  }, []);

  if (submitted) {
    return (
      <>
        <SuccessScreen itemCode={submittedCode} isUrgent={step3.is_urgent} requestType={step1.request_type}
          onViewRequests={() => navigate('/items/my-requests')} onNewRequest={handleNewRequest} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // Context panel for each step
  const contextPanel = activeStep === 1 ? (
    <CodePreviewPanel s1={step1} s2={step2} dupeStatus={dupeStatus} dupeCount={dupeCount} />
  ) : activeStep >= 2 ? (
    <ReviewContextPanel step1={step1} step2={step2} />
  ) : undefined;

  return (
    <>
      <ItemRequestWizardShell
        title="New Item Request" subtitle="Request a new item for the catalogue"
        steps={STEPS} activeStepIndex={activeStep} contextPanel={contextPanel}
        onContinue={handleContinue} onPrevious={activeStep > 0 ? handlePrevious : undefined}
        onCancel={handleCancel}
        continueLabel={activeStep === STEPS.length - 1 ? (isSubmitting ? 'Submitting…' : 'Submit Request') : 'Continue'}
        continueDisabled={isSubmitting || (activeStep === 1 && hasPerfectMatch)}
        isSaving={isSubmitting && activeStep === STEPS.length - 1}
      >
        {activeStep === 0 && <Step1TypeSelector data={step1} onChange={setStep1} />}
        {activeStep === 1 && (
          <Step2CodeBuilder data={step2} onChange={p => setStep2(prev => ({ ...prev, ...p }))}
            requestType={step1.request_type}
            colours={colours}
            onDupeStatusChange={(s, c) => { setDupeStatus(s); setDupeCount(c); }}
            onPerfectMatchChange={setHasPerfectMatch}
            onExit={handleCancel} />
        )}
        {activeStep === 2 && (
          <Step3Context data={step3} onChange={p => setStep3(prev => ({ ...prev, ...p }))} requestType={step1.request_type} />
        )}
        {activeStep === 3 && <Step4Review step1={step1} step2={step2} step3={step3} onPrevious={handlePrevious} />}
      </ItemRequestWizardShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
