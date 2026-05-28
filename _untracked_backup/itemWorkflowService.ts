import { supabase } from '../lib/supabaseClient';
import { ItemRequestStatus } from '../types';

const allowedTransitions: Record<ItemRequestStatus, ItemRequestStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['DUPLICATE_REVIEW'],
  DUPLICATE_REVIEW: ['DATA_REVIEW', 'ACTIVE', 'REVISION_REQUIRED'],
  DATA_REVIEW: ['PRICING_REVIEW', 'APPROVAL_PENDING'],
  PRICING_REVIEW: ['APPROVAL_PENDING', 'REVISION_REQUIRED'],
  APPROVAL_PENDING: ['APPROVED', 'REVISION_REQUIRED', 'REJECTED'],
  APPROVED: ['PUBLISHING', 'ACTIVE'],
  PUBLISHING: ['PARTIALLY_PUBLISHED', 'FULLY_PUBLISHED'],
  PARTIALLY_PUBLISHED: ['ACTIVE'],
  FULLY_PUBLISHED: ['ACTIVE'],
  ACTIVE: ['REPLACED', 'RETIRED'],
  REVISION_REQUIRED: ['SUBMITTED', 'DUPLICATE_REVIEW', 'DATA_REVIEW', 'PRICING_REVIEW', 'APPROVAL_PENDING'],
  REJECTED: [],
  REPLACED: [],
  RETIRED: [],
};

export function validateStatusTransition(from: ItemRequestStatus, to: ItemRequestStatus): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}

export async function transitionRequest(
  requestId: string,
  toStatus: ItemRequestStatus,
  options: { notes?: string; metadata?: Record<string, unknown> } = {}
) {
  const { data: current, error: loadError } = await supabase
    .from('item_requests')
    .select('status,lifecycle_status')
    .eq('id', requestId)
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);

  const fromStatus = ((current?.status ?? current?.lifecycle_status ?? 'DRAFT') as ItemRequestStatus);
  if (!validateStatusTransition(fromStatus, toStatus) && fromStatus !== toStatus) {
    throw new Error(`Illegal item request transition: ${fromStatus} -> ${toStatus}`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('item_requests')
    .update({
      status: toStatus,
      lifecycle_status: toStatus,
      status_changed_at: now,
      status_changed_by: user?.id ?? null,
    })
    .eq('id', requestId);

  if (updateError) throw new Error(updateError.message);

  await supabase.from('item_request_audit_log').insert({
    request_id: requestId,
    action_type: 'STATUS_CHANGE',
    performed_by: user?.id ?? null,
    from_status: fromStatus,
    to_status: toStatus,
    summary: options.notes ?? `Status changed from ${fromStatus} to ${toStatus}`,
    metadata: options.metadata ?? {},
  });
}
