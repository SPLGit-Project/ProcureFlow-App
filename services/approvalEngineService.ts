import { supabase } from '../lib/supabaseClient';
import { transitionRequest } from './itemWorkflowService';

export interface ApprovalInstance {
  id: string;
  request_id: string;
  rule_id: string;
  rule_name: string;
  approver_type: string;
  approver_role?: string;
  approver_user_id?: string;
  stage_order: number;
  sla_hours: number;
  sla_deadline: string;
  sla_breached: boolean;
  status: 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'SUPERSEDED';
  decision_id?: string;
  created_at: string;
}

export interface ApprovalDecision {
  id: string;
  instance_id: string;
  request_id: string;
  decision: 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'DELEGATED';
  decided_by: string;
  decided_at: string;
  comments: string;
  request_status_at_decision: string;
}

// Step 1: Trigger the approval engine for a request
// Called when a request transitions to APPROVAL_PENDING
export async function triggerApprovalEngine(requestId: string): Promise<ApprovalInstance[]> {
  // Call the DB function to evaluate rules
  const { data: rules, error: rulesError } = await supabase
    .rpc('evaluate_item_approval_rules', { p_request_id: requestId });

  if (rulesError) throw new Error(rulesError.message);
  if (!rules || rules.length === 0) {
    throw new Error('No approval rules matched for this request. Check item_approval_rules configuration.');
  }

  // Create approval instances for each triggered rule
  const instances = rules.map((rule: any) => ({
    request_id: requestId,
    rule_id: rule.rule_id,
    rule_name: rule.rule_name,
    approver_type: rule.approver_type,
    approver_role: rule.approver_type === 'ROLE' ? rule.approver_id : null,
    approver_user_id: rule.approver_type === 'USER' ? rule.approver_id : null,
    stage_order: rule.stage_order,
    sla_hours: rule.sla_hours,
    status: 'PENDING' as const,
  }));

  const { data: createdInstances, error: insertError } = await supabase
    .from('item_approval_instances')
    .insert(instances)
    .select();

  if (insertError) throw new Error(insertError.message);
  return (createdInstances ?? []) as ApprovalInstance[];
}

// Get all approval instances for a request, ordered by stage
export async function getApprovalInstancesForRequest(requestId: string): Promise<ApprovalInstance[]> {
  const { data, error } = await supabase
    .from('item_approval_instances')
    .select('*')
    .eq('request_id', requestId)
    .neq('status', 'SUPERSEDED')
    .order('stage_order', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ApprovalInstance[];
}

// Get all pending approvals for the current user's role
export async function getPendingApprovalsForCurrentUser(userRole: string): Promise<ApprovalInstance[]> {
  const { data, error } = await supabase
    .from('item_approval_instances')
    .select('*, item_requests!inner(*)')
    .eq('status', 'PENDING')
    .eq('approver_role', userRole.toUpperCase())
    .order('sla_deadline', { ascending: true });  // Most urgent first

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ApprovalInstance[];
}

// Get the current active stage (lowest stage_order with PENDING instances)
export async function getCurrentApprovalStage(requestId: string): Promise<number | null> {
  const { data } = await supabase
    .from('item_approval_instances')
    .select('stage_order')
    .eq('request_id', requestId)
    .eq('status', 'PENDING')
    .order('stage_order', { ascending: true })
    .limit(1);

  return data?.[0]?.stage_order ?? null;
}

// Record an approval decision
// Sequential enforcement: stage N cannot be approved until stage N-1 is fully approved
export async function recordApprovalDecision(input: {
  instanceId: string;
  decision: 'APPROVED' | 'REJECTED' | 'ESCALATED';
  comments: string;
  actorId?: string;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const effectiveUserId = user?.id ?? input.actorId ?? '00000000-0000-0000-0000-000000000000';
  if (!user && !input.actorId) {
    throw new Error('Not authenticated');
  }

  if (input.comments.trim().length < 10) {
    throw new Error('Comments must be at least 10 characters.');
  }

  // Load the instance to get request_id
  const { data: instance } = await supabase
    .from('item_approval_instances')
    .select('*, item_requests(status)')
    .eq('id', input.instanceId)
    .single();

  if (!instance) throw new Error('Approval instance not found');

  // Check sequential stage constraint:
  // All instances with stage_order < this instance's stage_order must be APPROVED
  const { data: priorStages } = await supabase
    .from('item_approval_instances')
    .select('id, status, stage_order')
    .eq('request_id', instance.request_id)
    .lt('stage_order', instance.stage_order)
    .neq('status', 'SUPERSEDED');

  const blockedStages = (priorStages ?? []).filter(s => s.status !== 'APPROVED');
  if (blockedStages.length > 0) {
    throw new Error(`Stage ${blockedStages[0].stage_order} approval must be completed before this stage.`);
  }

  // Insert decision record (trigger on item_approval_decisions updates the instance)
  const { error } = await supabase
    .from('item_approval_decisions')
    .insert({
      instance_id: input.instanceId,
      request_id: instance.request_id,
      decision: input.decision,
      decided_by: effectiveUserId,
      comments: input.comments,
      request_status_at_decision: (instance.item_requests as any)?.status ?? 'UNKNOWN',
    });

  if (error) throw new Error(error.message);

  // If ESCALATED: request a revision from the requestor.
  if (input.decision === 'ESCALATED') {
    await supabase.from('item_requests')
      .update({
        revision_reason: input.comments,
        revision_requested_by: effectiveUserId,
      })
      .eq('id', instance.request_id);

    await transitionRequest(instance.request_id, 'REVISION_REQUIRED', {
      notes: input.comments,
      metadata: { action: 'APPROVAL_REVISION_REQUEST', approval_instance_id: input.instanceId },
    });

    await supabase.from('item_approval_instances')
      .update({ status: 'SUPERSEDED' })
      .eq('request_id', instance.request_id)
      .eq('status', 'PENDING')
      .neq('id', input.instanceId);
    return;
  }

  // If REJECTED: permanently reject the request.
  if (input.decision === 'REJECTED') {
    await transitionRequest(instance.request_id, 'REJECTED', {
      notes: input.comments,
      metadata: { action: 'APPROVAL_REJECTED', approval_instance_id: input.instanceId },
    });

    // Supersede all other pending instances for this request
    await supabase.from('item_approval_instances')
      .update({ status: 'SUPERSEDED' })
      .eq('request_id', instance.request_id)
      .eq('status', 'PENDING')
      .neq('id', input.instanceId);
    return;
  }

  // If APPROVED: check if all instances are now approved
  if (input.decision === 'APPROVED') {
    const { data: remainingPending } = await supabase
      .from('item_approval_instances')
      .select('id')
      .eq('request_id', instance.request_id)
      .eq('status', 'PENDING')
      .neq('id', input.instanceId);

    if (!remainingPending || remainingPending.length === 0) {
      // All approved — transition request to APPROVED
      await transitionRequest(instance.request_id, 'APPROVED', {
        notes: input.comments,
        metadata: { action: 'APPROVAL_APPROVED', approval_instance_id: input.instanceId },
      });
    }
  }
}

// SLA breach check — called by a scheduled job or on queue load
export async function checkAndMarkSlaBreaches(): Promise<number> {
  const { data, error } = await supabase
    .from('item_approval_instances')
    .update({ sla_breached: true })
    .lt('sla_deadline', new Date().toISOString())
    .eq('status', 'PENDING')
    .eq('sla_breached', false)
    .select('id');

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}
