import React, { useState } from 'react';
import {
  Check, FileText, Search, Package, Tag, ThumbsUp, Zap, Circle as CircleIcon,
  XCircle, ArrowRight,
} from 'lucide-react';
import { ItemRequestStatus } from '../types';
import { useNavigate } from 'react-router-dom';

// ── Stage icons ────────────────────────────────────────────────────────────────

const STAGE_ICONS = [FileText, Search, Package, Tag, ThumbsUp, Zap, CircleIcon];

// ── Stage definitions ─────────────────────────────────────────────────────────

interface SubStep {
  label: string;
}

interface Stage {
  status: ItemRequestStatus | null;
  label: string;
  description: string;
  subSteps?: SubStep[];
  actionLabel?: string;
  actionPath?: (requestId: string) => string;
}

const LIFECYCLE_STAGES: Stage[] = [
  {
    status: 'SUBMITTED',
    label: 'Submitted',
    description: 'Your request is received',
    subSteps: [
      { label: 'Request context reviewed' },
      { label: 'Assigned to Master Data queue' },
    ],
  },
  {
    status: 'DUPLICATE_REVIEW',
    label: 'Duplicate Check',
    description: 'Master Data verifies no existing item matches',
    subSteps: [
      { label: 'Request Summary' },
      { label: 'Catalogue Search' },
      { label: 'Outcome Decision' },
      { label: 'Confirm & Record' },
    ],
    actionLabel: 'Open Duplicate Check',
    actionPath: (id) => `/items/requests/${id}/duplicate-check`,
  },
  {
    status: 'DATA_REVIEW',
    label: 'Item Definition',
    description: 'Master Data completes SAP and catalogue setup',
    subSteps: [
      { label: 'Classification' },
      { label: 'Identity & Naming' },
      { label: 'Physical Attributes' },
      { label: 'System Flags' },
      { label: 'Stock Levels' },
      { label: 'Review & Confirm' },
    ],
    actionLabel: 'Open Item Definition',
    actionPath: (id) => `/items/requests/${id}/define`,
  },
  {
    status: 'PRICING_REVIEW',
    label: 'Pricing Review',
    description: 'Pricing team sets buy and sell prices',
    subSteps: [
      { label: 'Purchase Pricing' },
      { label: 'Sell Pricing' },
      { label: 'Margin Review' },
    ],
    actionLabel: 'Open Pricing Setup',
    actionPath: (id) => `/items/requests/${id}/pricing`,
  },
  {
    status: 'APPROVAL_PENDING',
    label: 'Approval',
    description: 'Approver sign-off based on item type',
    subSteps: [
      { label: 'Review Request Details' },
      { label: 'Review Pricing & Margin' },
      { label: 'Record Decision' },
    ],
    actionLabel: 'Open Approval Review',
    actionPath: (id) => `/items/requests/${id}/approve`,
  },
  {
    status: 'APPROVED',
    label: 'Publication',
    description: 'Item published to all target downstream systems',
    subSteps: [
      { label: 'Publication Gate Check' },
      { label: 'Publish to Systems' },
      { label: 'Acknowledgement' },
    ],
  },
  {
    status: 'ACTIVE',
    label: 'Active',
    description: 'Item live in selected systems',
  },
];

const STATUS_STAGE_INDEX: Partial<Record<ItemRequestStatus, number>> = {
  SUBMITTED: 0,
  DUPLICATE_REVIEW: 1,
  DATA_REVIEW: 2,
  PRICING_REVIEW: 3,
  APPROVAL_PENDING: 4,
  REVISION_REQUIRED: 4,
  APPROVED: 5,
  PUBLISHING: 5,
  PARTIALLY_PUBLISHED: 5,
  FULLY_PUBLISHED: 5,
  ACTIVE: 6,
};

// ── Role-aware next-step prompt ───────────────────────────────────────────────

function getActionPrompt(status: ItemRequestStatus, userRole?: string): string | null {
  const isMD = userRole === 'ADMIN' || userRole === 'MASTER_DATA';
  const isPricing = userRole === 'ADMIN' || userRole === 'PRICING';
  const isApprover = userRole === 'ADMIN' || userRole === 'APPROVER';

  switch (status) {
    case 'SUBMITTED':
      return isMD ? 'Open the Duplicate Check wizard to begin processing this request.' : 'Waiting for Master Data to begin the duplicate check.';
    case 'DUPLICATE_REVIEW':
      return isMD ? 'Complete the Duplicate Check wizard to proceed.' : 'Master Data is performing the catalogue duplicate check.';
    case 'DATA_REVIEW':
      return isMD ? 'Complete the Item Definition wizard to define all master data attributes.' : 'Master Data is defining the item record.';
    case 'PRICING_REVIEW':
      return isPricing ? 'Set purchase and sell pricing in the Pricing Setup wizard.' : 'Waiting for Pricing to complete pricing setup.';
    case 'APPROVAL_PENDING':
      return isApprover ? 'Review this request and record your approval decision.' : 'Waiting for approver sign-off.';
    case 'REVISION_REQUIRED':
      return 'Review the feedback, update your request, and re-submit.';
    case 'APPROVED':
      return isMD ? 'Trigger publication to push this item to downstream systems.' : 'Item approved — publication in progress.';
    default:
      return null;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface WorkflowLifecycleProps {
  status: ItemRequestStatus;
  requestId: string;
  userRole?: string;
}

export default function WorkflowLifecycle({ status, requestId, userRole }: WorkflowLifecycleProps) {
  const navigate = useNavigate();
  const activeIdx = STATUS_STAGE_INDEX[status] ?? -1;
  const isTerminal = status === 'REJECTED' || status === 'REPLACED' || status === 'RETIRED';
  const actionPrompt = getActionPrompt(status, userRole);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(activeIdx);

  if (isTerminal) {
    const cfg = {
      REJECTED: { label: 'Request Rejected', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/5', border: 'border-red-100 dark:border-red-500/20' },
      REPLACED: { label: 'Item Replaced', color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700' },
      RETIRED:  { label: 'Item Retired',  color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700' },
    }[status as 'REJECTED' | 'REPLACED' | 'RETIRED'];

    return (
      <div className={`rounded-2xl border p-5 flex items-center gap-4 ${cfg.bg} ${cfg.border}`}>
        <XCircle size={24} className={cfg.color} />
        <div>
          <p className={`font-bold ${cfg.color}`}>{cfg.label}</p>
          <p className="text-xs text-gray-400 mt-0.5">This request has reached a terminal state.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section heading */}
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">What Happens Next</p>

      {/* Action prompt */}
      {actionPrompt && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[var(--color-brand)]/6 border border-[var(--color-brand)]/15">
          <ArrowRight size={13} className="text-[var(--color-brand)] shrink-0 mt-0.5" />
          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{actionPrompt}</p>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {LIFECYCLE_STAGES.map((stage, idx) => {
          const isDone    = idx < activeIdx;
          const isActive  = idx === activeIdx;
          const isLast    = idx === LIFECYCLE_STAGES.length - 1;
          const isExpanded = expandedIdx === idx;
          const hasSubSteps = (stage.subSteps?.length ?? 0) > 0;
          const hasAction  = isActive && stage.actionLabel && stage.actionPath;
          const Icon = STAGE_ICONS[idx];

          // Connector line extends down unless this is the last stage
          // When expanded, the line must be taller to accommodate sub-steps
          const lineVisible = !isLast;

          return (
            <div key={stage.label} className="relative flex gap-0">
              {/* Left column: icon + vertical connector */}
              <div className="flex flex-col items-center" style={{ width: 40, flexShrink: 0 }}>
                {/* Stage icon circle */}
                <button
                  onClick={() => hasSubSteps ? setExpandedIdx(isExpanded ? null : idx) : undefined}
                  disabled={!hasSubSteps}
                  className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    isDone
                      ? 'bg-[var(--color-brand)] text-white'
                      : isActive
                      ? 'bg-[var(--color-brand)] text-white shadow-lg shadow-[var(--color-brand)]/30'
                      : 'bg-gray-100 dark:bg-nocturne border-2 border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600'
                  } ${hasSubSteps ? 'cursor-pointer hover:opacity-85' : 'cursor-default'}`}
                >
                  {isDone ? (
                    <Check size={14} strokeWidth={3} />
                  ) : (
                    <Icon size={15} strokeWidth={1.8} />
                  )}
                </button>

                {/* Connector line between stages (and sub-step section) */}
                {lineVisible && (
                  <div className={`w-px flex-1 min-h-[24px] ${
                    isDone ? 'bg-[var(--color-brand)]/40' : 'bg-gray-200 dark:bg-gray-800'
                  }`} />
                )}
              </div>

              {/* Right column: label, description, sub-steps */}
              <div className={`flex-1 min-w-0 pb-6 ${isLast ? 'pb-0' : ''}`} style={{ paddingLeft: 14 }}>
                {/* Stage header */}
                <div className="flex items-center gap-2 h-10">
                  <p className={`text-sm font-bold leading-tight ${
                    isDone   ? 'text-[var(--color-brand)]'
                    : isActive ? 'text-gray-900 dark:text-white'
                    : 'text-gray-400 dark:text-gray-600'
                  }`}>
                    {stage.label}
                  </p>
                  {isActive && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-[var(--color-brand)] text-white">
                      Current
                    </span>
                  )}
                </div>

                <p className={`text-xs leading-relaxed -mt-1 ${
                  isActive ? 'text-gray-500 dark:text-gray-400' : 'text-gray-300 dark:text-gray-600'
                }`}>
                  {stage.description}
                </p>

                {/* Sub-steps (expanded) */}
                {isExpanded && hasSubSteps && (
                  <div className="mt-3 space-y-0">
                    {stage.subSteps!.map((sub, subIdx) => {
                      const isLastSub = subIdx === stage.subSteps!.length - 1;
                      return (
                        <div key={subIdx} className="flex gap-0">
                          {/* Sub-step connector column */}
                          <div className="flex flex-col items-center" style={{ width: 20, flexShrink: 0 }}>
                            {/* Horizontal connector to main line */}
                            <div className="flex items-center" style={{ height: 22 }}>
                              <div className={`h-px w-5 ${isDone ? 'bg-[var(--color-brand)]/30' : 'bg-gray-200 dark:bg-gray-700'}`} />
                            </div>
                            {/* Vertical segment between sub-steps */}
                            {!isLastSub && (
                              <div className={`w-px flex-1 ${isDone ? 'bg-[var(--color-brand)]/20' : 'bg-gray-100 dark:bg-gray-800'}`} />
                            )}
                          </div>

                          {/* Sub-step dot + label */}
                          <div className="flex items-center gap-2.5 pb-1" style={{ paddingLeft: 8 }}>
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isDone ? 'bg-[var(--color-brand)]/60' : 'bg-gray-300 dark:bg-gray-600'
                            }`} />
                            <span className={`text-xs ${
                              isDone ? 'text-[var(--color-brand)]/70' : isActive ? 'text-gray-600 dark:text-gray-400' : 'text-gray-300 dark:text-gray-600'
                            }`}>
                              {sub.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Action button */}
                    {hasAction && (
                      <div className="pt-3">
                        <button
                          onClick={() => navigate(stage.actionPath!(requestId))}
                          className="px-4 py-2 rounded-xl bg-[var(--color-brand)] text-white text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
                        >
                          {stage.actionLabel}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
