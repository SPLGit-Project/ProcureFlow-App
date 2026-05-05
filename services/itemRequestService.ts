import { supabase } from '../lib/supabaseClient';
import { ItemRequest, ItemRequestType, ItemRequestStatus } from '../types';
import { transitionRequest } from './itemWorkflowService';

export interface DuplicateCheckInput {
  request_id: string;
  search_terms: string[];
  candidate_items: Array<{ item_id: string; sku: string; name: string; similarity_score: number }>;
  outcome: 'NO_DUPLICATE' | 'USE_EXISTING' | 'SIMILAR_NEW_REQUIRED';
  existing_item_id?: string;
  justification?: string;
}

export interface ItemRequestWithUser extends ItemRequest {
  requestor_name?: string;
  requestor_email?: string;
}

export interface CreateItemRequestInput {
  request_type: ItemRequestType;
  item_description: string;
  business_reason: string;
  required_activation_date?: string;
  replacement_for_item_id?: string;
  customer_reference?: string;
  contract_reference?: string;
  target_bundle: boolean;
  target_linenhub: boolean;
  target_salesforce: boolean;
  target_sap: boolean;
  department?: string;
  business_unit?: string;
}

export async function createItemRequest(input: CreateItemRequestInput): Promise<ItemRequest> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('item_requests')
    .insert({
      ...input,
      requestor_id: user.id,
      status: 'DRAFT',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ItemRequest;
}

export async function submitItemRequest(requestId: string): Promise<ItemRequest> {
  const { data, error } = await supabase
    .from('item_requests')
    .update({ status: 'SUBMITTED' })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ItemRequest;
}

export async function getMyItemRequests(): Promise<ItemRequest[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('item_requests')
    .select('*')
    .eq('requestor_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ItemRequest[];
}

export async function getItemRequest(id: string): Promise<ItemRequest | null> {
  const { data, error } = await supabase
    .from('item_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as ItemRequest;
}

export async function getAllItemRequests(): Promise<ItemRequest[]> {
  const { data, error } = await supabase
    .from('item_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ItemRequest[];
}

export async function getRequestsForMasterData(): Promise<ItemRequest[]> {
  const { data, error } = await supabase
    .from('item_requests')
    .select('*')
    .in('status', ['SUBMITTED', 'DUPLICATE_REVIEW', 'DATA_REVIEW', 'PRICING_REVIEW', 'APPROVAL_PENDING', 'APPROVED', 'REVISION_REQUIRED'])
    .order('is_urgent', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ItemRequest[];
}

export async function getRequestsForPricing(): Promise<ItemRequest[]> {
  const { data, error } = await supabase
    .from('item_requests')
    .select('*')
    .eq('status', 'PRICING_REVIEW')
    .order('is_urgent', { ascending: false })
    .order('status_changed_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ItemRequest[];
}

export async function updateRequestStatus(
  requestId: string,
  newStatus: ItemRequestStatus,
  revisionReason?: string
): Promise<void> {
  const updates: any = { status: newStatus };
  if (revisionReason) {
    updates.revision_reason = revisionReason;
  }

  const { error } = await supabase
    .from('item_requests')
    .update(updates)
    .eq('id', requestId);

  if (error) throw new Error(error.message);
}

export async function saveDuplicateCheckOutcome(input: DuplicateCheckInput): Promise<void> {
  // First, ensure a record exists (created automatically by trigger on SUBMITTED, but may need manual insert)
  const { error: upsertError } = await supabase
    .from('item_duplicate_checks')
    .upsert({
      request_id: input.request_id,
      search_terms: input.search_terms,
      candidate_items: input.candidate_items,
      candidate_count: input.candidate_items.length,
      outcome: input.outcome,
      existing_item_id: input.existing_item_id ?? null,
      justification: input.justification ?? null,
      performed_by: (await supabase.auth.getUser()).data.user?.id,
    }, { onConflict: 'request_id' });

  if (upsertError) throw new Error(upsertError.message);

  // Advance request status through the workflow guard so the outcome is audited.
  const nextStatus = input.outcome === 'USE_EXISTING' ? 'ACTIVE' : 'DATA_REVIEW';
  await transitionRequest(input.request_id, nextStatus as ItemRequestStatus, {
    notes: input.outcome === 'USE_EXISTING'
      ? 'Duplicate check completed: use existing item.'
      : 'Duplicate check completed: new item definition required.',
    metadata: {
      action: 'DUPLICATE_CHECK_OUTCOME',
      outcome: input.outcome,
      existing_item_id: input.existing_item_id ?? null,
      candidate_count: input.candidate_items.length,
    },
  });
}

export async function searchExistingItems(searchTerm: string): Promise<Array<{ id: string; sku: string; name: string; category: string }>> {
  const { data, error } = await supabase
    .from('items')
    .select('id, sku, name, category')
    .or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
    .eq('active_flag', true)
    .limit(50);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getRequestWithApprovals(id: string) {
  const [request, instances] = await Promise.all([
    getItemRequest(id),
    import('../services/approvalEngineService')
      .then(m => m.getApprovalInstancesForRequest(id))
  ]);
  return { request, instances };
}

export async function deleteItemRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_item_request_and_cascade', { p_request_id: requestId });
  if (error) throw new Error(error.message);
}
