import React, { useState, useEffect } from 'react';
import {
  FileText, CheckCircle, Database, ArrowRight,
  Search, HelpCircle, BookOpen, PlayCircle,
  Settings, Zap, ChevronDown, ChevronRight,
  Package, ClipboardCheck, BarChart3,
  AlertTriangle, Info, Lightbulb, ChevronUp, Tag, RefreshCw,
  UserCheck, Boxes, CheckCircle2, ShoppingCart, ShoppingBag,
  ListChecks, Clock, DollarSign, ThumbsUp, Globe,
  ClipboardList, AlertCircle, Layers, Server,
  Star, Shield, ArrowRightCircle, Award
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import PageHeader from './PageHeader';
import { useSearchParams } from 'react-router-dom';

// ── Item Creation — Rich Interactive Component ─────────────────────────────

type GuideId =
  | 'new-item-process-overview'
  | 'item-types-explained'
  | 'item-master-check'
  | 'item-specification-fields'
  | 'urgency-and-business-reasons'
  | 'approval-routing';

interface GuideTab { id: GuideId; title: string; icon: React.ElementType; }

const GUIDE_TABS: GuideTab[] = [
  { id: 'new-item-process-overview', title: 'End-to-End Process', icon: ListChecks },
  { id: 'item-types-explained',      title: 'Item Types',          icon: Boxes },
  { id: 'item-master-check',         title: 'Master Check',        icon: Search },
  { id: 'item-specification-fields', title: 'Fields Guide',        icon: FileText },
  { id: 'urgency-and-business-reasons', title: 'Urgency & Reasons', icon: AlertTriangle },
  { id: 'approval-routing',          title: 'After You Submit',    icon: ArrowRight },
];

// ── End-to-End Process ─────────────────────────────────────────────────────

const STAGES = [
  {
    id: 'type',
    num: 1,
    label: 'Select Item Type',
    icon: Tag,
    accent: '#9333ea',
    bg: 'bg-purple-50 dark:bg-purple-900/10',
    border: 'border-purple-200 dark:border-purple-800',
    badge: 'bg-purple-500',
    description: 'The first decision shapes the entire request. Choose the type that best describes how this item will be sourced and sold.',
    points: [
      { icon: ShoppingCart, text: 'Purchase & Sale — sourced from a supplier and sold to customers. Most common type.' },
      { icon: ShoppingBag,  text: 'Purchase Only — bought for internal use, not listed in the customer catalogue.' },
      { icon: Tag,          text: 'Sale Only — sold to customers but not purchased through standard procurement.' },
      { icon: Boxes,        text: 'COG (Customer-Owned Goods) — managed on behalf of a customer, not standard stock.' },
      { icon: RefreshCw,    text: 'Replacement — supersedes a retiring item. Links the old SKU to the new one in SAP.' },
      { icon: UserCheck,    text: 'Customer-Specific — created exclusively for one customer or contract.' },
    ],
    tip: 'Not sure which type to select? Purchase & Sale is correct for the vast majority of linen and laundry items.',
  },
  {
    id: 'specify',
    num: 2,
    label: 'Specify the Item',
    icon: FileText,
    accent: '#2563eb',
    bg: 'bg-blue-50 dark:bg-blue-900/10',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-500',
    description: 'Four sub-sections complete this stage. Work through each one before the system lets you continue.',
    points: [
      { icon: Search,        text: 'Item Master Check — the system searches for existing matches automatically. You must review and confirm this is genuinely new before the form unlocks.' },
      { icon: FileText,      text: 'Item Details — structured fields (Product Type, Colour, Material, Dimensions, GSM, Grade, Catalogue). No free-text descriptions.' },
      { icon: ClipboardList, text: 'Business Reason — choose the best-fit reason from the list. Select "Other" only if none apply, then explain in the text box.' },
      { icon: AlertTriangle, text: 'Urgency — toggle on only for genuine time-critical needs (e.g. customer launch within 48 hours). Explain why in the required field.' },
    ],
    tip: 'Complete the Master Check first — it\'s a gate that blocks the rest of the form until you\'ve reviewed results and confirmed.',
    warning: 'You cannot skip the Item Master Check. If a match exists in the catalogue, cancel your request and use the existing item instead.',
  },
  {
    id: 'systems',
    num: 3,
    label: 'Target Systems',
    icon: Globe,
    accent: '#0d9488',
    bg: 'bg-teal-50 dark:bg-teal-900/10',
    border: 'border-teal-200 dark:border-teal-800',
    badge: 'bg-teal-500',
    description: 'Select every system this item needs to be active in. Each selection adds specific setup tasks for the Master Data team.',
    points: [
      { icon: Server,       text: 'SAP — creates the item in the ERP system with a SAP item code. Required for purchase orders and stock management.' },
      { icon: Layers,       text: 'Bundle — adds the item to the BundleConnect laundry catalogue so it can be included in customer bundles.' },
      { icon: Globe,        text: 'LinenHub — publishes the item to the customer-facing LinenHub portal for self-service visibility.' },
    ],
    tip: 'When in doubt, select SAP. Most items require at minimum an SAP code. Ask the Master Data team if you\'re unsure which other systems apply.',
  },
  {
    id: 'review',
    num: 4,
    label: 'Review & Submit',
    icon: CheckCircle,
    accent: '#16a34a',
    bg: 'bg-green-50 dark:bg-green-900/10',
    border: 'border-green-200 dark:border-green-800',
    badge: 'bg-green-500',
    description: 'A full summary of your inputs is shown. Read every field carefully before submitting.',
    points: [
      { icon: CheckCircle2,    text: 'All inputs from Stages 1–3 are shown in a single summary panel for your review.' },
      { icon: ArrowRightCircle,text: 'Clicking Submit sends the request to the Master Data queue immediately. There is no draft state.' },
      { icon: AlertCircle,     text: 'You cannot edit after submission. Use the Back button if anything needs correcting.' },
    ],
    warning: 'Once submitted, your request can only be changed if an approver sends it back to you with a Revision Required status.',
    tip: 'Double-check the item description and selected type — these are the fields most often flagged for revision.',
  },
];

const EndToEndGuide: React.FC = () => {
  const [activeStage, setActiveStage] = useState(0);
  const stage = STAGES[activeStage];
  const StageIcon = stage.icon;

  return (
    <div className="space-y-6">
      {/* Stage stepper */}
      <div className="flex items-center gap-0">
        {STAGES.map((s, i) => {
          const SIcon = s.icon;
          const isActive = i === activeStage;
          const isDone   = i < activeStage;
          return (
            <React.Fragment key={s.id}>
              <button
                onClick={() => setActiveStage(i)}
                className={`flex flex-col items-center gap-2 px-4 py-3 rounded-2xl transition-all flex-1 ${
                  isActive
                    ? 'bg-white dark:bg-[#2b2d3b] shadow-lg border border-gray-100 dark:border-gray-800'
                    : 'hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isActive
                      ? 'text-white shadow-md'
                      : isDone
                      ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600'
                      : 'bg-gray-100 dark:bg-white/5 text-gray-400'
                  }`}
                  style={isActive ? { backgroundColor: s.accent } : {}}
                >
                  {isDone ? <CheckCircle2 size={20} /> : <SIcon size={20} />}
                </div>
                <div className="text-center">
                  <div className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${isActive ? 'text-[var(--color-brand)]' : 'text-gray-400'}`}>
                    Stage {s.num}
                  </div>
                  <div className={`text-xs font-bold leading-tight hidden sm:block ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                    {s.label}
                  </div>
                </div>
              </button>
              {i < STAGES.length - 1 && (
                <div className="flex-shrink-0 w-6 flex items-center justify-center">
                  <ChevronRight size={16} className="text-gray-300 dark:text-gray-700" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Stage content */}
      <div className={`rounded-2xl border p-6 ${stage.bg} ${stage.border}`}>
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white shadow-lg"
            style={{ backgroundColor: stage.accent }}>
            <StageIcon size={22} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Stage {stage.num} of 4</div>
            <h4 className="text-xl font-bold text-gray-900 dark:text-white">{stage.label}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{stage.description}</p>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          {stage.points.map((point, i) => {
            const PIcon = point.icon;
            return (
              <div key={i} className="flex items-start gap-3 bg-white/70 dark:bg-white/5 rounded-xl p-3 border border-white/50 dark:border-white/10">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: `${stage.accent}20`, color: stage.accent }}>
                  <PIcon size={14} />
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{point.text}</p>
              </div>
            );
          })}
        </div>

        {stage.warning && (
          <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/50 rounded-xl p-4 mb-3">
            <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400 font-medium">{stage.warning}</p>
          </div>
        )}

        {stage.tip && (
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/50 rounded-xl p-4">
            <Lightbulb size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-400"><span className="font-bold">Tip: </span>{stage.tip}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setActiveStage(s => Math.max(0, s - 1))}
          disabled={activeStage === 0}
          className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} className="rotate-180" /> Previous
        </button>
        <div className="flex gap-1.5">
          {STAGES.map((_, i) => (
            <button key={i} onClick={() => setActiveStage(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === activeStage ? 'w-6 bg-purple-500' : 'bg-gray-300 dark:bg-gray-700 hover:bg-gray-400'}`} />
          ))}
        </div>
        {activeStage < STAGES.length - 1 ? (
          <button
            onClick={() => setActiveStage(s => Math.min(STAGES.length - 1, s + 1))}
            className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-purple-600 hover:text-purple-700 transition-colors"
          >
            Next Stage <ChevronRight size={14} />
          </button>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-600">
            <CheckCircle2 size={14} /> Complete
          </div>
        )}
      </div>
    </div>
  );
};

// ── Item Types Guide ───────────────────────────────────────────────────────

const ITEM_TYPES = [
  {
    id: 'purchase-sale',
    label: 'Purchase & Sale',
    badge: 'Most Common',
    Icon: ShoppingCart,
    accent: 'emerald',
    accentHex: '#059669',
    description: 'Sourced from a supplier and sold to customers. Both buy price and sell price are set during Pricing Review.',
    examples: ['Hotel towels', 'Bed linen', 'Uniform garments', 'Table cloths'],
    pricing: 'Buy price + Sell price required',
  },
  {
    id: 'purchase-only',
    label: 'Purchase Only',
    badge: null,
    Icon: ShoppingBag,
    accent: 'blue',
    accentHex: '#2563eb',
    description: 'Bought for internal use and not listed in the customer-facing catalogue.',
    examples: ['Cleaning consumables', 'Equipment', 'Staff amenities'],
    pricing: 'Buy price only',
  },
  {
    id: 'sale-only',
    label: 'Sale Only',
    badge: null,
    Icon: Tag,
    accent: 'amber',
    accentHex: '#d97706',
    description: 'Sold to customers but not purchased through standard procurement (e.g. customer-supplied goods you invoice for).',
    examples: ['Customer-supplied goods invoiced for', 'Service-based catalogue items'],
    pricing: 'Sell price only',
  },
  {
    id: 'cog',
    label: 'COG',
    badge: 'Customer-Owned',
    Icon: Boxes,
    accent: 'purple',
    accentHex: '#9333ea',
    description: 'Customer-Owned Goods managed and tracked on behalf of the customer. Not standard stock.',
    examples: ['Customer linen stored at your facility', 'Assets tracked under a service contract'],
    pricing: 'No pricing — management fee may apply separately',
  },
  {
    id: 'replacement',
    label: 'Replacement',
    badge: 'Links to Old SKU',
    Icon: RefreshCw,
    accent: 'orange',
    accentHex: '#ea580c',
    description: 'Supersedes a retiring item. The system links the new item to the one being replaced for clean deactivation in SAP.',
    examples: ['Upgrading from 300gsm to 500gsm bath towel', 'Rebranded uniform replacing the old version'],
    pricing: 'Same as underlying type (P&S, PO, or SO)',
  },
  {
    id: 'customer-specific',
    label: 'Customer-Specific',
    badge: 'Restricted',
    Icon: UserCheck,
    accent: 'teal',
    accentHex: '#0d9488',
    description: 'Created exclusively for a single customer or contract. Not available to other customers.',
    examples: ['Branded items for a hotel chain', 'Custom-spec product for a single contract'],
    pricing: 'Buy price + Sell price, scoped to that customer',
  },
];

const ItemTypesGuide: React.FC = () => {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedType = ITEM_TYPES.find(t => t.id === selected);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Select the type that best describes how this item is sourced and sold. The type determines which pricing fields and system setup steps are required.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {ITEM_TYPES.map(type => {
          const TIcon = type.Icon;
          const isSelected = selected === type.id;
          return (
            <button
              key={type.id}
              onClick={() => setSelected(isSelected ? null : type.id)}
              className={`relative text-left p-4 rounded-2xl border-2 transition-all ${
                isSelected
                  ? 'border-current shadow-lg scale-[1.02]'
                  : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-md'
              }`}
              style={isSelected ? { borderColor: type.accentHex, backgroundColor: `${type.accentHex}08` } : {}}
            >
              {type.badge && (
                <span className="absolute top-2 right-2 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${type.accentHex}15`, color: type.accentHex }}>
                  {type.badge}
                </span>
              )}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 text-white"
                style={{ backgroundColor: type.accentHex }}>
                <TIcon size={18} />
              </div>
              <div className="font-bold text-sm text-gray-900 dark:text-white mb-1">{type.label}</div>
              <div className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{type.description}</div>
              <div className="flex items-center gap-1 mt-2 text-[10px] font-bold" style={{ color: type.accentHex }}>
                {isSelected ? <ChevronUp size={12} /> : <ChevronRight size={12} />}
                {isSelected ? 'Hide details' : 'Show details'}
              </div>
            </button>
          );
        })}
      </div>

      {selectedType && (
        <div className="rounded-2xl border p-5 mt-2"
          style={{ borderColor: `${selectedType.accentHex}40`, backgroundColor: `${selectedType.accentHex}06` }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
              style={{ backgroundColor: selectedType.accentHex }}>
              <selectedType.Icon size={16} />
            </div>
            <div>
              <div className="font-bold text-gray-900 dark:text-white">{selectedType.label}</div>
              <div className="text-xs text-gray-500">{selectedType.description}</div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Common Examples</div>
              <div className="space-y-1.5">
                {selectedType.examples.map((ex, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedType.accentHex }} />
                    {ex}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Pricing Requirement</div>
              <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-white/5 rounded-xl border border-white/50 dark:border-white/10">
                <DollarSign size={16} style={{ color: selectedType.accentHex }} className="mt-0.5 shrink-0" />
                <p className="text-sm text-gray-700 dark:text-gray-300">{selectedType.pricing}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!selected && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 rounded-xl">
          <Info size={16} className="text-blue-500 shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-400">Tap any type card above to see full details, common examples, and pricing requirements.</p>
        </div>
      )}
    </div>
  );
};

// ── Item Master Check Guide ────────────────────────────────────────────────

const MASTER_CHECK_STEPS = [
  {
    id: 'auto-search',
    label: 'Auto-Search Fires',
    icon: Search,
    description: 'As soon as you select a Product Type and enter a Colour, the system automatically queries the live item catalogue for similar items.',
    note: null,
  },
  {
    id: 'review-results',
    label: 'Review Results',
    icon: ClipboardList,
    description: 'A results panel appears showing matching items with their SKU, name, and category. An amber warning icon indicates a strong candidate match.',
    note: 'Strong match = same product type + same or similar colour. Review these carefully before proceeding.',
  },
  {
    id: 'decision',
    label: 'Make a Decision',
    icon: ThumbsUp,
    description: 'If a genuine match exists: cancel your request and use the existing item. If no match, or the match is clearly different: click the confirmation checkbox.',
    note: null,
  },
  {
    id: 'gate',
    label: 'Confirmation Gate',
    icon: Shield,
    isGate: true,
    description: 'You must click "I\'ve reviewed these results — this is a new item" before the rest of the form unlocks. This cannot be skipped.',
    note: 'This is deliberate. The confirmation creates an audit record showing the check was performed.',
  },
  {
    id: 'reruns',
    label: 'Search Reruns on Change',
    icon: RefreshCw,
    description: 'If you change the Product Type or Colour, the search reruns and the confirmation resets. You must confirm again.',
    note: null,
  },
];

const ItemMasterCheckGuide: React.FC = () => {
  const [activeStep, setActiveStep] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 rounded-2xl">
        <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-red-700 dark:text-red-400 text-sm mb-1">This step is mandatory — it cannot be skipped</div>
          <p className="text-sm text-red-600 dark:text-red-500">Raising a duplicate request adds unnecessary work for the Master Data team and delays your item being approved. The check exists to prevent this.</p>
        </div>
      </div>

      <div className="space-y-2">
        {MASTER_CHECK_STEPS.map((step, i) => {
          const SIcon = step.icon;
          const isOpen = activeStep === step.id;
          return (
            <div key={step.id}>
              <button
                onClick={() => setActiveStep(isOpen ? null : step.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                  (step as any).isGate
                    ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/20'
                    : 'bg-white dark:bg-nocturne border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  (step as any).isGate
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-white/10 text-gray-500'
                }`}>
                  <SIcon size={16} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">Step {i + 1}</span>
                    {(step as any).isGate && <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-purple-500 text-white rounded">Required Gate</span>}
                  </div>
                  <div className={`font-bold text-sm ${(step as any).isGate ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-white'}`}>
                    {step.label}
                  </div>
                </div>
                <div className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                  <ChevronDown size={18} />
                </div>
              </button>
              {isOpen && (
                <div className="mx-4 px-4 py-4 bg-gray-50 dark:bg-white/5 rounded-b-2xl border-x border-b border-gray-100 dark:border-gray-800 -mt-1">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">{step.description}</p>
                  {step.note && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/50">
                      <Lightbulb size={14} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">{step.note}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 rounded-xl">
        <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700 dark:text-blue-400">Not sure if a result matches your item? Contact the Master Data team before submitting. Their contact details are in the Help & Support contact section.</p>
      </div>
    </div>
  );
};

// ── Specification Fields Guide ─────────────────────────────────────────────

const SPEC_FIELDS = [
  {
    id: 'product-type',
    label: 'Product Type',
    required: true,
    icon: Tag,
    description: 'Select the closest match from the dropdown (e.g. Bath Towel, Pillowcase, Table Cloth).',
    tip: 'If your product type is not listed, select "Other" and add detail in the Additional Notes field. Frequently-used "Other" entries get promoted to standard options.',
    example: 'Bath Towel, Pillow Case, Flat Sheet, Duvet Cover',
  },
  {
    id: 'colour',
    label: 'Colour',
    required: true,
    icon: Star,
    description: 'Enter the primary colour exactly as it should appear in the catalogue.',
    tip: 'Consistency prevents near-duplicate items that differ only in colour naming. Use the standard name: "White" not "Off-white" or "Cream" unless they are genuinely distinct.',
    example: 'White, Ivory, Charcoal, Navy Blue',
  },
  {
    id: 'material',
    label: 'Material',
    required: false,
    icon: Layers,
    description: 'Select the primary composition from the dropdown. Blends not listed should use "Other" with exact composition in Additional Notes.',
    tip: 'For blended fabrics, note the exact percentage split (e.g. "60% cotton, 40% polyester") in Additional Notes.',
    example: '100% Cotton, Polyester-Cotton, Terry Cloth, Microfibre',
  },
  {
    id: 'dimensions',
    label: 'Dimensions',
    required: false,
    icon: FileText,
    description: 'Enter width and height in centimetres. For non-rectangular items enter the diameter as width and leave height blank.',
    tip: 'Note "round" or "irregular shape" in Additional Notes if the standard W×H format doesn\'t apply.',
    example: '70×140cm (Bath Towel), 250×260cm (King Duvet Cover)',
  },
  {
    id: 'gsm',
    label: 'GSM',
    required: false,
    icon: ClipboardList,
    description: 'Grams per Square Metre — the fabric weight. Enter as a whole number.',
    tip: 'GSM is critical for hotel-grade linen. If unknown, leave blank — but the Master Data team will likely request it during review for linen items.',
    example: '300 (light), 450 (mid-weight), 600 (heavy hotel-grade)',
  },
  {
    id: 'grade',
    label: 'Grade / Standard',
    required: false,
    icon: Award,
    description: 'Select the quality tier. This routes the item to the correct pricing tier during Pricing Review.',
    tip: 'When in doubt, select Commercial Grade. Hotel Grade typically implies higher GSM and specific finish standards.',
    example: 'Hotel Grade, Commercial Grade, Economy',
  },
  {
    id: 'catalogue',
    label: 'Catalogue / Department',
    required: true,
    icon: BookOpen,
    description: 'Select where this item will primarily be used. This determines which catalogue section it appears in for sales and procurement.',
    tip: 'This field also affects which sites and contracts the item is visible to. Check with the Master Data team if you\'re unsure.',
    example: 'Accommodation, F&B, Housekeeping, Healthcare',
  },
];

// Need to import Award and BookOpen — they're already included
const SpecificationFieldsGuide: React.FC = () => {
  const [openField, setOpenField] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 dark:text-gray-400 pb-1">
        These fields replace free-text descriptions. Completing them accurately ensures the item is searchable, correctly priced, and consistent with existing catalogue items.
      </p>
      {SPEC_FIELDS.map(field => {
        const FIcon = field.icon;
        const isOpen = openField === field.id;
        return (
          <div key={field.id} className="bg-white dark:bg-nocturne border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
            <button
              onClick={() => setOpenField(isOpen ? null : field.id)}
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/10 flex items-center justify-center shrink-0 text-purple-600 dark:text-purple-400">
                <FIcon size={16} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-gray-900 dark:text-white">{field.label}</span>
                  <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    field.required
                      ? 'bg-red-50 dark:bg-red-900/10 text-red-500 border border-red-100 dark:border-red-800/50'
                      : 'bg-gray-100 dark:bg-white/5 text-gray-400'
                  }`}>
                    {field.required ? 'Required' : 'Optional'}
                  </span>
                </div>
                {!isOpen && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{field.description}</p>}
              </div>
              <div className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                <ChevronDown size={18} />
              </div>
            </button>
            {isOpen && (
              <div className="px-5 pb-5 pt-1 border-t border-gray-100 dark:border-gray-800 space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{field.description}</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/50">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Lightbulb size={13} className="text-amber-500" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Tip</span>
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">{field.tip}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Info size={13} className="text-gray-400" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Examples</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{field.example}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Urgency & Business Reasons Guide ──────────────────────────────────────

const BUSINESS_REASONS = [
  { id: 'new-contract',  label: 'New customer contract',             description: 'A new contract has been signed and the item is required to fulfil it.' },
  { id: 'renewal',       label: 'Contract renewal or expansion',     description: 'An existing contract has been renewed or expanded to cover new items.' },
  { id: 'phaseout',      label: 'Existing item phase-out / replacement', description: 'An existing item is retiring and this is its successor.' },
  { id: 'range',         label: 'Product range expansion',           description: 'Adding a new product to the standard catalogue for general availability.' },
  { id: 'operational',   label: 'Operational requirement',           description: 'An internal operational need not covered by other categories.' },
  { id: 'customer-spec', label: 'Customer-specific requirement',     description: 'A specific customer has requested an item not currently in the catalogue.' },
  { id: 'other',         label: 'Other',                             description: 'None of the above apply — explain in the text field (minimum 20 characters).' },
];

const UrgencyGuide: React.FC = () => {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [showUrgency, setShowUrgency] = useState(false);
  return (
    <div className="space-y-6">
      {/* Business Reason */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList size={18} className="text-purple-500" />
          <h4 className="font-bold text-gray-900 dark:text-white">Business Reason</h4>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Select the reason that most closely matches why this item is needed. Be accurate — reasons feed into reporting and procurement strategy.
        </p>
        <div className="space-y-2">
          {BUSINESS_REASONS.map(reason => {
            const isSelected = selectedReason === reason.id;
            const isOther = reason.id === 'other';
            return (
              <button
                key={reason.id}
                onClick={() => setSelectedReason(isSelected ? null : reason.id)}
                className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/10'
                    : isOther
                    ? 'border-dashed border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 bg-white dark:bg-nocturne'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                  isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <div className={`font-bold text-sm ${isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-gray-800 dark:text-gray-200'}`}>
                    {reason.label}
                  </div>
                  {isSelected && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{reason.description}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {selectedReason === 'other' && (
          <div className="mt-3 flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/50 rounded-xl">
            <Lightbulb size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700 dark:text-amber-400">
              <span className="font-bold">Selecting "Other": </span>A text field will appear. Be specific — vague entries like "special item" or "customer request" are not acceptable. The admin team reviews recurring "Other" entries and frequently-used reasons get added to the standard list.
            </div>
          </div>
        )}
      </div>

      <div className="h-px bg-gray-100 dark:bg-gray-800" />

      {/* Urgency */}
      <div>
        <button
          onClick={() => setShowUrgency(v => !v)}
          className="w-full flex items-center justify-between gap-2 mb-3 text-left group"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            <h4 className="font-bold text-gray-900 dark:text-white">Urgency</h4>
          </div>
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${showUrgency ? 'rotate-180' : ''}`} />
        </button>

        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-2xl">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-700 dark:text-amber-400 text-sm mb-1">Reserve for genuine time-critical situations only</div>
            <p className="text-sm text-amber-600 dark:text-amber-500">Misuse of the urgent flag delays genuinely critical items for other teams and reduces the flag's effectiveness across the system.</p>
          </div>
        </div>

        {showUrgency && (
          <div className="mt-3 space-y-3">
            <div className="bg-white dark:bg-nocturne border border-gray-100 dark:border-gray-800 rounded-2xl p-4 space-y-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">When to Use</div>
                <div className="space-y-2">
                  {['Customer launch date within 48 hours', 'Contract penalty clause triggered by delay', 'Critical supply failure with no substitute'].map((ex, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> {ex}
                    </div>
                  ))}
                </div>
              </div>
              <div className="h-px bg-gray-100 dark:bg-gray-800" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">What Happens</div>
                <div className="space-y-2">
                  {[
                    'A required explanation field appears — your words are included verbatim in the notification to the review team.',
                    'Request moves to the top of the Master Data queue.',
                    'Accelerated SLA applies — typically half the standard review time.',
                  ].map((point, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <ArrowRight size={14} className="text-purple-400 mt-0.5 shrink-0" /> {point}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── After You Submit — Pipeline Guide ─────────────────────────────────────

const PIPELINE_STAGES = [
  {
    id: 'duplicate-check',
    label: 'Duplicate Check',
    shortLabel: 'Duplicate\nCheck',
    icon: Search,
    color: '#f59e0b',
    description: 'The Master Data team reviews your request and verifies there is no existing item in SAP or the catalogue that matches your submission.',
    youReceive: 'You\'ll be contacted if clarification is needed. No action required from you at this stage.',
    typical: '1–2 business days',
    canReturn: false,
  },
  {
    id: 'item-definition',
    label: 'Item Definition',
    shortLabel: 'Item\nDefinition',
    icon: Database,
    color: '#8b5cf6',
    description: 'If no duplicate is found, the team creates the full item record in SAP and sets up catalogue details — SKU, category, product class, and system mappings.',
    youReceive: 'Notification when item definition is complete.',
    typical: '2–3 business days',
    canReturn: false,
  },
  {
    id: 'pricing-review',
    label: 'Pricing Review',
    shortLabel: 'Pricing\nReview',
    icon: DollarSign,
    color: '#2563eb',
    description: 'The pricing team sets the buy price (from supplier) and sell price (to customer) and calculates the margin. Purchase Only items require only a buy price.',
    youReceive: 'Notification when pricing is confirmed.',
    typical: '1–2 business days',
    canReturn: false,
  },
  {
    id: 'approval',
    label: 'Approval',
    shortLabel: 'Approval',
    icon: ThumbsUp,
    color: '#0d9488',
    description: 'An approver reviews the complete request including item definition and pricing. They can Approve, Request Revision, or Reject.',
    youReceive: 'Notification of the decision. If Revision Required, the request returns to you with comments.',
    typical: '1–3 business days',
    canReturn: true,
  },
  {
    id: 'active',
    label: 'Active',
    shortLabel: 'Active',
    icon: CheckCircle2,
    color: '#16a34a',
    description: 'The item is published to the target systems you selected during submission (SAP, Bundle, LinenHub). It becomes available for purchasing and catalogue listing.',
    youReceive: 'Final notification confirming the item is live. Check "My Item Requests" to see the completed record.',
    typical: 'Same day as approval',
    canReturn: false,
  },
];

const AfterSubmitGuide: React.FC = () => {
  const [activeStage, setActiveStage] = useState(0);
  const stage = PIPELINE_STAGES[activeStage];
  const SIcon = stage.icon;

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Once submitted, your request moves through these five stages automatically. You don't need to take any action unless a stage returns the request to you.
      </p>

      {/* Pipeline visual */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {PIPELINE_STAGES.map((s, i) => {
          const PIcon = s.icon;
          const isActive = i === activeStage;
          const isDone = i < activeStage;
          return (
            <React.Fragment key={s.id}>
              <button
                onClick={() => setActiveStage(i)}
                className={`flex flex-col items-center gap-2 px-3 py-3 rounded-2xl transition-all min-w-[80px] ${
                  isActive
                    ? 'bg-white dark:bg-[#2b2d3b] shadow-lg border border-gray-100 dark:border-gray-800'
                    : 'hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  isDone ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600' : 'text-white'
                }`}
                style={!isDone ? { backgroundColor: isActive ? s.color : `${s.color}60` } : {}}>
                  {isDone ? <CheckCircle2 size={18} /> : <PIcon size={18} />}
                </div>
                <div
                  className={`text-[10px] font-bold text-center leading-tight whitespace-pre-line ${!isActive ? 'text-gray-400' : ''}`}
                  style={{ color: isActive ? s.color : undefined }}>
                  {s.shortLabel}
                </div>
              </button>
              {i < PIPELINE_STAGES.length - 1 && (
                <div className="shrink-0">
                  <ArrowRight size={14} className="text-gray-300 dark:text-gray-700" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Stage detail */}
      <div className="rounded-2xl border p-5 bg-white dark:bg-nocturne"
        style={{ borderColor: `${stage.color}40` }}>
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white shadow-md"
            style={{ backgroundColor: stage.color }}>
            <SIcon size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">Stage {activeStage + 1} of {PIPELINE_STAGES.length}</div>
              <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded"
                style={{ backgroundColor: `${stage.color}15`, color: stage.color }}>
                <Clock size={10} /> {stage.typical}
              </div>
            </div>
            <h4 className="text-lg font-bold text-gray-900 dark:text-white">{stage.label}</h4>
          </div>
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4">{stage.description}</p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border flex items-start gap-2"
            style={{ backgroundColor: `${stage.color}08`, borderColor: `${stage.color}30` }}>
            <CheckCircle size={14} className="mt-0.5 shrink-0" style={{ color: stage.color }} />
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: stage.color }}>What You Receive</div>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{stage.youReceive}</p>
            </div>
          </div>
          {stage.canReturn && (
            <div className="p-3 rounded-xl border border-amber-100 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-600 mb-1">May Return to You</div>
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">If the approver selects "Request Revision", the request returns to you with their comments. Update and resubmit to continue.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/50">
        <Info size={14} className="text-blue-500 shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-400">Track your request at any time via <span className="font-bold">My Item Requests</span> in the sidebar.</p>
      </div>
    </div>
  );
};

// ── Item Creation Content Container ───────────────────────────────────────

const ItemCreationContent: React.FC = () => {
  const [activeGuide, setActiveGuide] = useState<GuideId>('new-item-process-overview');

  const renderGuide = () => {
    switch (activeGuide) {
      case 'new-item-process-overview':   return <EndToEndGuide />;
      case 'item-types-explained':        return <ItemTypesGuide />;
      case 'item-master-check':           return <ItemMasterCheckGuide />;
      case 'item-specification-fields':   return <SpecificationFieldsGuide />;
      case 'urgency-and-business-reasons':return <UrgencyGuide />;
      case 'approval-routing':            return <AfterSubmitGuide />;
      default:                            return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Guide header */}
      <div className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/10 dark:to-transparent rounded-3xl border border-purple-100 dark:border-purple-900/30 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center text-white shadow-md">
            <Package size={20} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Item Creation</h3>
            <p className="text-sm text-gray-500">Six interactive guides to master the full request process.</p>
          </div>
        </div>
      </div>

      {/* Guide selector tabs */}
      <div className="flex gap-2 flex-wrap">
        {GUIDE_TABS.map(tab => {
          const TabIcon = tab.icon;
          const isActive = activeGuide === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveGuide(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
                isActive
                  ? 'bg-purple-500 text-white border-purple-500 shadow-md shadow-purple-500/20'
                  : 'bg-white dark:bg-nocturne text-gray-500 border-gray-200 dark:border-gray-800 hover:border-purple-200 dark:hover:border-purple-800 hover:text-purple-600'
              }`}
            >
              <TabIcon size={13} />
              <span className="hidden sm:inline">{tab.title}</span>
            </button>
          );
        })}
      </div>

      {/* Guide content */}
      <div className="bg-white dark:bg-nocturne rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 min-h-[400px]">
        <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          {(() => {
            const currentTab = GUIDE_TABS.find(t => t.id === activeGuide);
            if (!currentTab) return null;
            const CIcon = currentTab.icon;
            return (
              <>
                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/10 flex items-center justify-center text-purple-600">
                  <CIcon size={16} />
                </div>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">{currentTab.title}</h4>
              </>
            );
          })()}
        </div>
        {renderGuide()}
      </div>
    </div>
  );
};

// ── Main HelpGuide ─────────────────────────────────────────────────────────

const HelpGuide = () => {
  const { currentUser, branding } = useApp();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'guides' | 'faq'>('guides');
  const [selectedCategory, setSelectedCategory] = useState<string>('getting-started');
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) {
      setActiveTab('guides');
      setSelectedCategory(cat);
    }
  }, [searchParams]);

  const categories = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: PlayCircle,
      color: 'blue',
      guides: [
        {
          id: 'dashboard-overview',
          title: 'Dashboard Overview',
          steps: [
            'Click on "Dashboard" in the sidebar to see your metrics.',
            'Use the Site Filter at the top right to view data for specific locations.',
            'The "Request Pipeline" shows the status of all current orders at a glance.',
            'Check "My Tasks" for pending approvals or deliveries requiring your attention.'
          ]
        },
        {
          id: 'mobile-install',
          title: 'Installing as an App (PWA)',
          steps: [
            'On Desktop: Use the "Install App" button in the bottom right corner.',
            'On iOS: Tap "Share" and select "Add to Home Screen".',
            'On Android: Follow the browser prompt or go to settings -> Install App.',
            'MercerFlow works offline and provides a faster, fullscreen experience when installed.'
          ]
        }
      ]
    },
    {
      id: 'core-workflow',
      title: 'Core Workflow',
      icon: Zap,
      color: 'amber',
      guides: [
        {
          id: 'create-request',
          title: 'Creating a New Request',
          steps: [
            'Navigate to "New Request" using the sidebar button.',
            'Select the destination Site and the specific Supplier.',
            'Add items from the catalog or manually enter item details.',
            'Review your cart and click "Submit Request" to start the approval flow.'
          ]
        },
        {
          id: 'tracking-status',
          title: 'Tracking Your Orders',
          steps: [
            'Go to "My Requests" to see your full history.',
            'Use the "Quick Filters" to find orders that are Pending, Active, or Completed.',
            'Click any row to open the full request detail page.',
            'Check the "Approval History" tab to see who needs to sign off next.'
          ]
        },
        {
          id: 'receiving-goods',
          title: 'Recording Deliveries',
          steps: [
            'When goods arrive at the site, find the order in "My Requests".',
            'Click "Record Delivery" (only available for Active orders).',
            'Enter the quantities received and the delivery reference number.',
            'Upload a photo of the delivery docket for finance records.'
          ]
        }
      ]
    },
    {
      id: 'admin-hub',
      title: 'Admin Functions',
      icon: Settings,
      color: 'slate',
      guides: [
        {
          id: 'user-management',
          title: 'Managing Users',
          steps: [
            'Navigate to Settings -> Security.',
            'Use the "Add User" button to invite colleagues.',
            'Assign specific Roles (e.g., SITE_USER, APPROVER, ADMIN).',
            'Select which Sites the user can access and filter data for.'
          ]
        },
        {
          id: 'impersonation',
          title: 'Viewing as Another User',
          steps: [
            'In Settings -> Security, find a user and click the "Eye" icon.',
            'This allows you to verify exactly what that user sees and can do.',
            'A banner at the top will indicate you are in Impersonation mode.',
            'Click "Exit View" to return to your admin account.'
          ]
        },
        {
          id: 'branding',
          title: 'App Personalization',
          steps: [
            'Go to Settings -> Branding.',
            'Update the App Name, upload a new Logo, and choose a Primary Color.',
            'These changes reflect instantly across the web app and PWA icon.',
            'Set your Primary Font to ensure brand consistency.'
          ]
        }
      ]
    },
    {
      id: 'advanced-tools',
      title: 'Configuration Tools',
      icon: Database,
      color: 'indigo',
      guides: [
        {
          id: 'workflow-engine',
          title: 'Visual Workflow Editor',
          steps: [
            'Go to Settings -> Workflows.',
            'Drag and drop stages to customize the approval path.',
            'Set "Value Gateways" to route high-value orders to major stakeholders.',
            'Click "Publish" to set the new workflow live for all future requests.'
          ]
        },
        {
          id: 'notifications',
          title: 'Triggered Notifications',
          steps: [
            'Go to Settings -> Notifications.',
            'Create rules (e.g., "When PO is approved, notify Requester via Email").',
            'Customize message templates with dynamic tags like {app_name} or {po_id}.',
            'Enable or disable channels (Email, Dashboard, Push) for each rule.'
          ]
        }
      ]
    },
    {
      id: 'item-creation',
      title: 'Item Creation',
      icon: Package,
      color: 'purple',
      guides: []
    },
    {
      id: 'item-approvals',
      title: 'Item Approvals',
      icon: ClipboardCheck,
      color: 'amber',
      guides: [
        {
          id: 'reviewing-request',
          title: 'Reviewing an Item Request',
          steps: [
            'Navigate to "Item Approvals" in the sidebar (requires approve_item_requests permission).',
            'The left panel shows all requests pending your review, sorted oldest-first with SLA indicators.',
            'Click a request to open the review panel on the right — it shows item details, duplicate outcome, pricing, and history.',
            'The Pricing section shows purchase cost, sell price, and calculated margin % with colour-coding (green > 25%, amber 20–25%, red < 20%).',
            'The Audit Trail at the bottom shows every change made to the request since submission.'
          ]
        },
        {
          id: 'making-decision',
          title: 'Making an Approval Decision',
          steps: [
            'After reviewing, scroll to the Decision section at the bottom of the review panel.',
            'Add comments to explain your decision (required for Reject and Request Revision).',
            'Approve: moves the request to the next approval stage or to Approved status if it is the final stage.',
            'Request Revision: returns the request to the requestor with your comments — status becomes Revision Required.',
            'Reject: permanently closes the request — status becomes Rejected.'
          ]
        },
        {
          id: 'publication-targets',
          title: 'Publication Targets',
          steps: [
            'Approved items can be published to external catalogues based on the publication targets set during pricing.',
            'Salesforce: item and pricing data is made available for CRM quoting and contract pricing.',
            'Bundle: item is added to the BundleConnect laundry catalogue for order fulfilment.',
            'LinenHub: item is published to the LinenHub portal for customer-facing visibility.',
            'Publication status badges (Salesforce / Bundle / LinenHub) appear in the Item Catalogue view.'
          ]
        }
      ]
    },
    {
      id: 'smart-buying-v2',
      title: 'Smart Buying',
      icon: BarChart3,
      color: 'teal',
      guides: [
        {
          id: 'live-vs-manual',
          title: 'Live vs Manual Data Mode',
          steps: [
            'Smart Buying has two data modes: Live (from BundleConnect Azure database) and Manual (from uploaded Excel files).',
            'Live mode is enabled when the smartBuyingV2Enabled feature flag is on — the Live Data toggle will appear at the top of the dashboard.',
            'In Live mode, select one or more sites and click "Refresh" to pull current stock, orders, and STAR metrics from the Azure database.',
            'Manual mode uses data uploaded via the Data Ingestion screen — use this as a fallback when the Azure proxy is unavailable.',
            'The Azure DB proxy must be deployed and reachable for live mode to function — contact your administrator if the toggle is greyed out.'
          ]
        },
        {
          id: 'star-days',
          title: 'STAR Days Explained',
          steps: [
            'STAR (Stock Turn And Replenishment) days measure how quickly a linen item cycles through the laundry workflow.',
            'It is calculated from the rfidtrans table: average days between a "soiled" scan (type 1) and the next "clean" scan (type 2) per item.',
            'High STAR days = slow cycle = items spend longer in the laundry, meaning you need more stock on hand.',
            'Low STAR days = fast cycle = items turn quickly, so a smaller par level is sufficient.',
            'The buy quantity calculation uses STAR days to adjust the recommended order — high STAR items get a higher multiplier.'
          ]
        },
        {
          id: 'saving-plans',
          title: 'Saving and Tracking Plans',
          steps: [
            'After adjusting budget sliders and reviewing the allocation table, click "Save Plan" to store the current plan.',
            'Saved plans appear in the History tab with their date, total budget, and item count.',
            'Click any history entry to reload that plan\'s parameters for comparison or resubmission.',
            'The planned vs actual columns in the allocation table update as purchase orders are created against the plan.'
          ]
        }
      ]
    },
    {
      id: 'data-sync',
      title: 'Data Sync',
      icon: Database,
      color: 'slate',
      guides: [
        {
          id: 'reading-sync-panel',
          title: 'Reading the Data Sync Panel',
          steps: [
            'Navigate to Settings → Data Sync to view the current sync health for all active sites.',
            'Each site card shows: last synced timestamp, lag hours (time since the latest record was written), and current job status.',
            'Status legend: Active (sync running), Idle (no pending jobs), Error (last job failed), Pending (job queued but not yet started).',
            'Lag hours above the configured threshold are highlighted in amber — this means the Azure database may be behind the source.'
          ]
        },
        {
          id: 'forcing-resync',
          title: 'Forcing a Resync',
          steps: [
            'In Settings → Data Sync, locate the site card you want to resync.',
            'Click "Force Sync" — this inserts a new sync job row for that site into the job queue.',
            'The status will change to Pending, then Active as the sync worker picks it up.',
            'Monitor completion by watching the last synced timestamp update — a successful sync will reset the lag counter.',
            'Use Force Sync sparingly: it is intended for recovering from errors, not for routine refresh (the sync runs automatically on a schedule).'
          ]
        },
        {
          id: 'site-exclusions',
          title: 'Site Exclusions Explained',
          steps: [
            'SYD (Sydney) is currently excluded from the active sync sites.',
            'The exclusion is due to the BundleConnect MySQL replication from port 3306 (master) to port 3307 (replica) not being restored at the Sydney site.',
            'Querying the Sydney replica while replication is stopped would return stale or incomplete data.',
            'Once the 3306→3307 replication is confirmed restored at SYD, re-enable the site by adding it to BC_ACTIVE_SITES in bundleConnectSyncService.ts and removing the exclusion in the Data Sync panel config.'
          ]
        }
      ]
    }
  ];

  const faqs = [
    {
      q: 'How do I reset my password?',
      a: 'MercerFlow integrates with your company single sign-on. Please reset your password via your corporate security portal (e.g., Azure AD/Office 365).'
    },
    {
      q: 'What determines the approval threshold?',
      a: 'Workflows are configured by Admins. Usually, orders under $1,000 are auto-approved locally, while larger amounts require multi-stage sign-off.'
    },
    {
      q: 'Can I delete a wrongly submitted PO?',
      a: 'Once submitted, a PO cannot be deleted for audit reasons. However, you can "Withdraw" or "Reject" it, which archives the record.'
    }
  ];

  const filteredFaqs = faqs.filter(f =>
    f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-fade-in px-4">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
        <div>
          <PageHeader title="Help & Support" subtitle={`Master every feature of ${branding.appName || 'MercerFlow'}.`} />
        </div>
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[var(--color-brand)] transition-colors" size={20} />
          <input
            type="text"
            placeholder="Search guides or FAQs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-2xl py-4 pl-12 pr-4 shadow-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar */}
        <div className="lg:w-72 space-y-2">
          {[
            { id: 'guides', label: 'Feature Guides', icon: BookOpen },
            { id: 'faq',    label: 'Common Questions', icon: HelpCircle }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === tab.id ? 'bg-[var(--color-brand)] text-white shadow-lg' : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400'}`}
            >
              <tab.icon size={20} /> {tab.label}
            </button>
          ))}

          <div className="h-px bg-gray-200 dark:bg-gray-800 my-6" />

          {activeTab === 'guides' && (
            <div className="space-y-1">
              <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Categories</p>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${selectedCategory === cat.id ? 'bg-white dark:bg-[#2b2d3b] text-[var(--color-brand)] shadow-sm border border-gray-100 dark:border-gray-800' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                  <cat.icon size={18} /> {cat.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1">
          {activeTab === 'guides' ? (
            selectedCategory === 'item-creation' ? (
              <ItemCreationContent />
            ) : (
              <div className="space-y-8 animate-fade-in-up">
                {categories.find(c => c.id === selectedCategory)?.guides.map((guide) => (
                  <div key={guide.id} className="bg-white dark:bg-nocturne rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden hover:border-[var(--color-brand)]/30 transition-all">
                    <div className={`p-8 bg-gradient-to-br from-${categories.find(c => c.id === selectedCategory)?.color}-50 to-white dark:from-white/5 dark:to-transparent`}>
                      <div className="flex items-center gap-3 mb-6">
                        <div className={`w-12 h-12 rounded-2xl bg-${categories.find(c => c.id === selectedCategory)?.color}-100 dark:bg-${categories.find(c => c.id === selectedCategory)?.color}-500/10 flex items-center justify-center text-${categories.find(c => c.id === selectedCategory)?.color}-600 dark:text-${categories.find(c => c.id === selectedCategory)?.color}-400 shadow-sm`}>
                          <BookOpen size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{guide.title}</h3>
                      </div>
                      <div className="space-y-4">
                        {guide.steps.map((step, sIdx) => (
                          <div key={sIdx} className="flex gap-4 group/step">
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full border-2 border-${categories.find(c => c.id === selectedCategory)?.color}-200 dark:border-gray-800 flex items-center justify-center text-xs font-bold text-gray-400 group-hover/step:bg-[var(--color-brand)] group-hover/step:border-[var(--color-brand)] group-hover/step:text-white transition-all`}>
                                {sIdx + 1}
                              </div>
                              {sIdx < guide.steps.length - 1 && <div className="w-0.5 h-full bg-gray-100 dark:bg-gray-800 my-1" />}
                            </div>
                            <div className="pb-6">
                              <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium">{step}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-4 animate-fade-in-up max-w-3xl">
              {filteredFaqs.map((faq, idx) => (
                <div key={idx} className="bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                    className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="font-bold text-lg text-gray-800 dark:text-gray-200">{faq.q}</span>
                    <div className={`w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center transition-transform duration-300 ${openFaqIndex === idx ? 'rotate-180 bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'text-gray-400'}`}>
                      <ChevronDown size={20} />
                    </div>
                  </button>
                  {openFaqIndex === idx && (
                    <div className="px-6 pb-6 pt-0 animate-slide-down">
                      <div className="h-px bg-gray-100 dark:bg-gray-800 mb-6" />
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg italic">"{faq.a}"</p>
                    </div>
                  )}
                </div>
              ))}
              {filteredFaqs.length === 0 && (
                <div className="text-center py-20 bg-gray-50 dark:bg-white/5 rounded-3xl border border-dashed border-gray-300 dark:border-gray-800">
                  <HelpCircle className="mx-auto mb-4 text-gray-300" size={48} />
                  <p className="text-gray-500 font-medium">No common questions found for "{searchQuery}".</p>
                  <button onClick={() => setSearchQuery('')} className="mt-4 text-[var(--color-brand)] font-bold hover:underline">Clear Search</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HelpGuide;
