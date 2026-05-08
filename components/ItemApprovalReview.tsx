import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  MessageSquare,
  RotateCcw,
  XCircle
} from 'lucide-react';
import { PreviewItemRequestBundle } from '../types';

interface ItemApprovalReviewProps {
  bundle: PreviewItemRequestBundle;
  onApprove: (requestId: string, comments: string) => Promise<void>;
  onReject: (requestId: string, comments: string) => Promise<void>;
  onRequestRevision: (requestId: string, comments: string) => Promise<void>;
  isSaving?: boolean;
}

const FieldRow = ({ label, value }: { label: string; value?: string | number | boolean | null }) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-xs font-bold text-gray-500 uppercase shrink-0 w-40">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white text-right">{String(value)}</span>
    </div>
  );
};

const SectionToggle = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-white/5"
      >
        <span className="text-sm font-bold text-gray-900 dark:text-white">{title}</span>
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
};

const ItemApprovalReview: React.FC<ItemApprovalReviewProps> = ({
  bundle,
  onApprove,
  onReject,
  onRequestRevision,
  isSaving
}) => {
  const [comments, setComments] = useState('');
  const [showActions, setShowActions] = useState(false);
  const { request, masterDraft, purchaseDraft, sellDraft, duplicateChecks } = bundle;

  const marginPercent = sellDraft?.marginPercent ?? 0;
  const marginBelowThreshold = marginPercent < 25 && sellDraft !== undefined;
  const latestDuplicate = duplicateChecks[0];

  const handleAction = async (action: 'approve' | 'reject' | 'revision') => {
    if (!comments.trim() && action !== 'approve') return;
    if (action === 'approve') await onApprove(request.id, comments);
    else if (action === 'reject') await onReject(request.id, comments);
    else await onRequestRevision(request.id, comments);
    setComments('');
    setShowActions(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {request.proposedDescription || 'Untitled Request'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-0.5">{request.requestNumber}</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold rounded-full border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300 px-3 py-1">
              {request.lifecycleStatus}
            </span>
            <span className="text-xs font-bold rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1">
              {request.requestType}
            </span>
          </div>
        </div>
      </div>

      {marginBelowThreshold && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-bold text-amber-800 dark:text-amber-300">Below-margin approval required</div>
            <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Sell margin is {marginPercent.toFixed(2)}% — below the 25% threshold. Approval is required before publication.
            </div>
          </div>
        </div>
      )}

      <SectionToggle title="Request Context">
        <FieldRow label="Request Type" value={request.requestType} />
        <FieldRow label="Department" value={request.department} />
        <FieldRow label="Business Unit" value={request.businessUnit} />
        <FieldRow label="New / Replacement" value={request.newOrReplacement} />
        {request.existingItemId && <FieldRow label="Existing Item" value={request.existingItemId} />}
        <FieldRow label="Business Reason" value={request.businessReason} />
        {request.businessReasonDetail && <FieldRow label="Detail" value={request.businessReasonDetail} />}
        {request.customerReference && <FieldRow label="Customer Reference" value={request.customerReference} />}
        <FieldRow label="Required Activation" value={request.requiredActivationDate} />
        {request.branchSiteId && <FieldRow label="Branch / Site" value={request.branchSiteId} />}
        <FieldRow label="Requestor" value={request.requestorName} />
      </SectionToggle>

      <SectionToggle title="Item Definition">
        <FieldRow label="SKU" value={masterDraft?.proposedSku} />
        <FieldRow label="Description" value={request.proposedDescription} />
        <FieldRow label="Category" value={request.itemGroup} />
        <FieldRow label="Product Type" value={masterDraft?.productType} />
        <FieldRow label="Size" value={masterDraft?.sizeCode} />
        <FieldRow label="Colour" value={masterDraft?.colourCode} />
        <FieldRow label="GSM / Weight Class" value={masterDraft?.gsmCode} />
        <FieldRow label="RFID" value={masterDraft?.rfidFlag ? 'Yes' : 'No'} />
        <FieldRow label="COG" value={masterDraft?.cogFlag ? 'Yes' : 'No'} />
        {masterDraft?.cogCustomer && <FieldRow label="COG Customer" value={masterDraft.cogCustomer} />}
        {masterDraft?.itemWeight && <FieldRow label="Weight (kg)" value={String(masterDraft.itemWeight)} />}
        {request.draftPayload?.sapMapping && <FieldRow label="SAP Mapping" value={String(request.draftPayload.sapMapping)} />}
        {masterDraft?.skuValidation && !masterDraft.skuValidation.isValid && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10 p-3">
            <div className="text-xs font-bold text-red-700 dark:text-red-300 uppercase mb-1">SKU Validation Issues</div>
            {masterDraft.skuValidation.errors.map(err => (
              <div key={err} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {err}
              </div>
            ))}
          </div>
        )}
      </SectionToggle>

      {purchaseDraft && (
        <SectionToggle title="Purchase Pricing">
          <FieldRow label="Supplier" value={purchaseDraft.supplierName} />
          <FieldRow label="Supplier Code" value={purchaseDraft.supplierItemCode} />
          <FieldRow label="UOM" value={purchaseDraft.purchaseUom} />
          <FieldRow label="Price Ex GST" value={purchaseDraft.purchasePriceExGst !== undefined ? `$${Number(purchaseDraft.purchasePriceExGst).toFixed(2)}` : undefined} />
          <FieldRow label="Freight / Handling" value={purchaseDraft.freightHandlingCost !== undefined ? `$${Number(purchaseDraft.freightHandlingCost).toFixed(2)}` : undefined} />
          <FieldRow label="Landed Cost" value={purchaseDraft.landedCost !== undefined ? `$${Number(purchaseDraft.landedCost).toFixed(2)}` : undefined} />
          <FieldRow label="Currency" value={purchaseDraft.purchaseCurrency} />
          <FieldRow label="MOQ" value={purchaseDraft.minimumOrderQuantity} />
          <FieldRow label="Lead Time (days)" value={purchaseDraft.leadTimeDays} />
          <FieldRow label="Effective From" value={purchaseDraft.effectiveFrom} />
          <FieldRow label="Effective To" value={purchaseDraft.effectiveTo} />
        </SectionToggle>
      )}

      {sellDraft && (
        <SectionToggle title="Sell Pricing">
          <FieldRow label="Price Type" value={sellDraft.priceType} />
          {sellDraft.customerGroupReference && <FieldRow label="Customer Group" value={sellDraft.customerGroupReference} />}
          {sellDraft.customerReference && <FieldRow label="Customer Reference" value={sellDraft.customerReference} />}
          <FieldRow label="UOM" value={sellDraft.saleUom} />
          <FieldRow label="Sell Price Ex GST" value={sellDraft.sellPriceExGst !== undefined ? `$${Number(sellDraft.sellPriceExGst).toFixed(2)}` : undefined} />
          <FieldRow label="Tax Code" value={sellDraft.taxCode} />
          <FieldRow
            label="Margin"
            value={sellDraft.marginPercent !== undefined ? `${sellDraft.marginPercent.toFixed(2)}% / $${(sellDraft.marginAmount ?? 0).toFixed(2)}` : undefined}
          />
          <FieldRow label="Approval Required" value={sellDraft.approvalRequired ? 'Yes' : 'No'} />
          <FieldRow label="Effective From" value={sellDraft.effectiveFrom} />
          <FieldRow label="Effective To" value={sellDraft.effectiveTo} />
          <div className="mt-3">
            <div className="text-xs font-bold text-gray-500 uppercase mb-1">Publication Targets</div>
            <div className="flex gap-2 flex-wrap">
              {sellDraft.publishToBundle && <span className="rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 px-2 py-0.5 text-xs font-bold">Bundle</span>}
              {sellDraft.publishToLinenHub && <span className="rounded-full bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300 px-2 py-0.5 text-xs font-bold">LinenHub</span>}
              {sellDraft.publishToSalesforce && <span className="rounded-full bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300 px-2 py-0.5 text-xs font-bold">Salesforce</span>}
            </div>
          </div>
        </SectionToggle>
      )}

      {latestDuplicate && (
        <SectionToggle title="Duplicate Check">
          <FieldRow label="Candidates Found" value={latestDuplicate.matchCount} />
          <FieldRow label="Highest Score" value={`${(latestDuplicate.highestMatchScore * 100).toFixed(0)}%`} />
          <FieldRow label="Outcome" value={latestDuplicate.selectedOutcome} />
          {latestDuplicate.justification && <FieldRow label="Justification" value={latestDuplicate.justification} />}
          {latestDuplicate.candidates.slice(0, 3).map(c => (
            <div key={`${c.source}-${c.sourceId}`} className="py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900 dark:text-white">{c.name}</span>
                <span className="text-xs font-black text-blue-600">{(c.score * 100).toFixed(0)}%</span>
              </div>
              <div className="text-xs text-gray-500">{c.matchType} · {c.source}</div>
            </div>
          ))}
        </SectionToggle>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquare size={16} /> Decision
          </h3>
          {!showActions && (
            <button
              type="button"
              onClick={() => setShowActions(true)}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              Record decision
            </button>
          )}
        </div>

        {showActions ? (
          <div className="space-y-3">
            <textarea
              className="input-field w-full min-h-20"
              placeholder="Comments (required for rejection or revision request)..."
              value={comments}
              onChange={e => setComments(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleAction('approve')}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
              >
                <Check size={15} /> Approve
              </button>
              <button
                type="button"
                disabled={isSaving || !comments.trim()}
                onClick={() => handleAction('revision')}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30 px-4 py-2 text-sm font-bold hover:bg-amber-100 disabled:opacity-50"
              >
                <RotateCcw size={15} /> Request Revision
              </button>
              <button
                type="button"
                disabled={isSaving || !comments.trim()}
                onClick={() => handleAction('reject')}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-bold hover:bg-red-700 disabled:opacity-50"
              >
                <XCircle size={15} /> Reject
              </button>
              <button
                type="button"
                onClick={() => { setShowActions(false); setComments(''); }}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-600 dark:text-gray-300"
              >
                Cancel
              </button>
            </div>
            {!comments.trim() && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Clock size={12} /> Comments are required for rejection or revision requests.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Review all sections above before recording a decision.
          </p>
        )}
      </div>
    </div>
  );
};

export default ItemApprovalReview;
