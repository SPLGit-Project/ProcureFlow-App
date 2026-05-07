import React, { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Circle, XCircle } from 'lucide-react';
import { ItemRequestStatus } from '../types';
import { useNavigate } from 'react-router-dom';

// ── Stage and sub-step definitions ────────────────────────────────────────────

interface SubStep {
  label: string;
}

interface Stage {
  status: ItemRequestStatus | null; // null = terminal positive
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
    description: 'Your request is received by the Master Data team.',
    subSteps: [
      { label: 'Request context reviewed' },
      { label: 'Assigned to Master Data queue' },
    ],
  },
  {
    status: 'DUPLICATE_REVIEW',
    label: 'Duplicate Check',
    description: 'Master Data verifies no existing item matches.',
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
    description: 'Master Data completes SAP code and catalogue setup.',
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
    description: 'Pricing team sets buy and sell prices.',
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
    description: 'Approver sign-off based on item type and margin rules.',
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
    description: 'Item published to all target downstream systems.',
    subSteps: [
      { label: 'Publication Gate Check' },
      { label: 'Publish to Systems' },
      { label: 'Acknowledgement' },
    ],
  },
  {
    status: 'ACTIVE',
    label: 'Active',
    description: 'Item is live and available across all selected systems.',
  },
];

// Map statuses to their stage index
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

// ── Helper: "what do YOU need to do next" ────────────────────────────────────

function getActionPrompt(status: ItemRequestStatus, userRole?: string): string | null {
  const isMasterData = userRole === 'ADMIN' || userRole === 'MASTER_DATA';
  const isPricing = userRole === 'ADMIN' || userRole === 'PRICING';
  const isApprover = userRole === 'ADMIN' || userRole === 'APPROVER';

  switch (status) {
    case 'SUBMITTED':
      return isMasterData ? 'Open the Duplicate Check wizard to begin processing this request.' : 'Waiting for Master Data team to begin the duplicate check.';
    case 'DUPLICATE_REVIEW':
      return isMasterData ? 'Complete the Duplicate Check wizard to proceed.' : 'Master Data is performing the catalogue duplicate check.';
    case 'DATA_REVIEW':
      return isMasterData ? 'Complete the Item Definition wizard to define all master data attributes.' : 'Master Data is defining the item record.';
    case 'PRICING_REVIEW':
      return isPricing ? 'Set purchase and sell pricing in the Pricing Setup wizard.' : 'Waiting for Pricing team to complete pricing setup.';
    case 'APPROVAL_PENDING':
      return isApprover ? 'Review this request and record your approval decision.' : 'Waiting for approver sign-off.';
    case 'REVISION_REQUIRED':
      return 'Review the feedback below, update your request, and re-submit.';
    case 'APPROVED':
      return isMasterData ? 'Trigger publication to push this item to downstream systems.' : 'Item approved — publication in progress.';
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
    const terminalConfig = {
      REJECTED: { label: 'Request Rejected', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/5', border: 'border-red-100 dark:border-red-500/20' },
      REPLACED: { label: 'Item Replaced', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700' },
      RETIRED: { label: 'Item Retired', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700' },
    }[status as 'REJECTED' | 'REPLACED' | 'RETIRED'];

    return (
      <div className={`rounded-2xl border p-6 flex items-center gap-4 ${terminalConfig.bg} ${terminalConfig.border}`}>
        <XCircle size={28} className={terminalConfig.color} />
        <div>
          <p className={`font-bold text-lg ${terminalConfig.color}`}>{terminalConfig.label}</p>
          <p className="text-sm text-gray-500 mt-0.5">This request has reached a terminal state.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action Prompt */}
      {actionPrompt && (
        <div className="p-4 rounded-2xl bg-[var(--color-brand)]/5 border border-[var(--color-brand)]/20 text-sm text-gray-700 dark:text-gray-300">
          <span className="font-bold text-[var(--color-brand)] text-xs uppercase tracking-widest block mb-1">Your Next Step</span>
          {actionPrompt}
        </div>
      )}

      {/* Stage list */}
      <div className="bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        {LIFECYCLE_STAGES.map((stage, idx) => {
          const isDone = idx < activeIdx;
          const isActive = idx === activeIdx;
          const isPending = idx > activeIdx;
          const isExpanded = expandedIdx === idx;
          const hasSubSteps = stage.subSteps && stage.subSteps.length > 0;
          const hasAction = isActive && stage.actionLabel && stage.actionPath;

          return (
            <div
              key={stage.label}
              className={`border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${isActive ? 'bg-[var(--color-brand)]/3' : ''}`}
            >
              <button
                className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-white/3 transition-colors"
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                disabled={!hasSubSteps && !hasAction}
              >
                {/* Status indicator */}
                <div className="shrink-0 mt-0.5">
                  {isDone ? (
                    <div className="w-7 h-7 rounded-full bg-[var(--color-brand)] flex items-center justify-center">
                      <Check size={12} strokeWidth={3} className="text-white" />
                    </div>
                  ) : isActive ? (
                    <div className="w-7 h-7 rounded-full border-2 border-[var(--color-brand)] bg-white dark:bg-[#1e2029] flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-brand)]" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center">
                      <span className="text-[10px] font-black text-gray-300 dark:text-gray-600">{idx + 1}</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-bold ${
                      isDone ? 'text-[var(--color-brand)]'
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
                  <p className={`text-xs mt-0.5 leading-relaxed ${
                    isActive ? 'text-gray-500 dark:text-gray-400' : 'text-gray-300 dark:text-gray-700'
                  }`}>
                    {stage.description}
                  </p>
                </div>

                {/* Expand chevron */}
                {hasSubSteps && (
                  <div className={`shrink-0 mt-0.5 ${isActive ? 'text-[var(--color-brand)]' : isDone ? 'text-[var(--color-brand)]/60' : 'text-gray-300'}`}>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                )}
              </button>

              {/* Sub-steps */}
              {isExpanded && hasSubSteps && (
                <div className="px-5 pb-4 pl-16 space-y-2">
                  {stage.subSteps!.map((sub, subIdx) => (
                    <div key={subIdx} className="flex items-center gap-2.5">
                      <Circle
                        size={6}
                        className={`shrink-0 ${isDone ? 'fill-[var(--color-brand)] text-[var(--color-brand)]' : isActive ? 'fill-gray-300 text-gray-300 dark:fill-gray-600 dark:text-gray-600' : 'fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700'}`}
                      />
                      <span className={`text-xs ${isDone ? 'text-[var(--color-brand)]/80' : isActive ? 'text-gray-600 dark:text-gray-400' : 'text-gray-300 dark:text-gray-600'}`}>
                        {sub.label}
                      </span>
                    </div>
                  ))}

                  {/* Action button */}
                  {hasAction && (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(stage.actionPath!(requestId)); }}
                      className="mt-3 px-4 py-2 rounded-xl bg-[var(--color-brand)] text-white text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
                    >
                      {stage.actionLabel}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
