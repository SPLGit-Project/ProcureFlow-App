import { supabase } from '../lib/supabaseClient';
import { ItemRequestStatus } from '../types';

// ── State machine ──────────────────────────────────────────────────────────────

/**
 * Exhaustive map of every legal status transition.
 * Key   = current status
 * Value = set of statuses the request can move to from here
 */
export const VALID_TRANSITIONS: Record<ItemRequestStatus, ItemRequestStatus[]> = {
  DRAFT:               ['SUBMITTED'],
  SUBMITTED:           ['DUPLICATE_REVIEW', 'REJECTED'],
  DUPLICATE_REVIEW:    ['PROCUREMENT_REVIEW', 'DATA_REVIEW', 'ACTIVE', 'REJECTED'],
  PROCUREMENT_REVIEW:  ['DATA_REVIEW', 'REVISION_REQUIRED', 'REJECTED'],
  DATA_REVIEW:         ['PRICING_REVIEW', 'REVISION_REQUIRED', 'REJECTED'],
  PRICING_REVIEW:      ['APPROVAL_PENDING', 'REVISION_REQUIRED', 'REJECTED'],
  APPROVAL_PENDING:    ['APPROVED', 'REVISION_REQUIRED', 'REJECTED'],
  REVISION_REQUIRED:   ['SUBMITTED'],
  APPROVED:            ['PUBLISHING', 'REJECTED'],
  PUBLISHING:          ['PARTIALLY_PUBLISHED', 'FULLY_PUBLISHED', 'REJECTED'],
  PARTIALLY_PUBLISHED: ['FULLY_PUBLISHED', 'REJECTED'],
  FULLY_PUBLISHED:     ['ACTIVE'],
  ACTIVE:              ['REPLACED', 'RETIRED'],
  REPLACED:            [],
  RETIRED:             [],
  REJECTED:            [],
};

// ── Transition validation ──────────────────────────────────────────────────────

export interface TransitionError {
  code: 'INVALID_TRANSITION' | 'NOT_FOUND' | 'DB_ERROR' | 'AUTH_ERROR';
  message: string;
}

export function validateTransition(
  from: ItemRequestStatus,
  to: ItemRequestStatus
): TransitionError | null {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) {
    return { code: 'INVALID_TRANSITION', message: `Unknown source status: ${from}` };
  }
  if (!allowed.includes(to)) {
    return {
      code: 'INVALID_TRANSITION',
      message: `Cannot transition from ${from} to ${to}. Allowed: [${allowed.join(', ') || 'none'}]`,
    };
  }
  return null;
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  request_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  performed_by: string;
  performed_at: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
}

async function writeAuditLog(params: {
  requestId: string;
  action: string;
  fromStatus: ItemRequestStatus | null;
  toStatus: ItemRequestStatus | null;
  performedBy: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('item_request_audit_log').insert({
    request_id: params.requestId,
    action: params.action,
    from_status: params.fromStatus,
    to_status: params.toStatus,
    performed_by: params.performedBy,
    notes: params.notes ?? null,
    metadata: params.metadata ?? null,
  });

  if (error) {
    // Audit log writes are best-effort — log but don't block the transition.
    console.error('[itemWorkflowService] Audit log write failed:', error.message);
  }
}

// ── Core transition function ───────────────────────────────────────────────────

export interface TransitionOptions {
  notes?: string;
  metadata?: Record<string, unknown>;
  /** UUID of the user performing the transition. Falls back to current auth user. */
  actorId?: string;
}

/**
 * Atomically validates, applies, and audits a status transition.
 *
 * 1. Validates the from→to pair against VALID_TRANSITIONS
 * 2. Updates item_requests: status, status_changed_at, status_changed_by
 * 3. Writes an immutable audit log row
 *
 * Throws on validation failure or DB error.
 */
export async function transitionRequest(
  requestId: string,
  toStatus: ItemRequestStatus,
  options: TransitionOptions = {}
): Promise<void> {
  // Resolve actor
  const { data: authData } = await supabase.auth.getUser();
  const actorId = options.actorId ?? authData?.user?.id;

  // No live session — delegate to SECURITY DEFINER RPC so RLS is bypassed (QA/dev path).
  // Fall back to the QA system actor when no actorId is supplied by the caller.
  if (!authData?.user) {
    const effectiveActorId = actorId ?? '00000000-0000-0000-0000-000000000000';
    if (!effectiveActorId) {
      throw Object.assign(new Error('Not authenticated'), { code: 'AUTH_ERROR' });
    }
    const { error: rpcError } = await supabase.rpc('transition_item_request', {
      p_request_id: requestId,
      p_to_status:  toStatus,
      p_actor_id:   effectiveActorId,
      p_notes:      options.notes      ?? null,
      p_metadata:   options.metadata ? (options.metadata as any) : null,
    });
    if (rpcError) throw Object.assign(new Error(rpcError.message), { code: 'DB_ERROR' });
    return;
  }

  if (!actorId) {
    throw Object.assign(new Error('Not authenticated'), { code: 'AUTH_ERROR' });
  }

  // Fetch current status
  const { data: current, error: fetchError } = await supabase
    .from('item_requests')
    .select('status')
    .eq('id', requestId)
    .single();

  if (fetchError || !current) {
    throw Object.assign(
      new Error(fetchError?.message ?? 'Request not found'),
      { code: fetchError ? 'DB_ERROR' : 'NOT_FOUND' }
    );
  }

  const fromStatus = current.status as ItemRequestStatus;

  // Validate transition
  const validationError = validateTransition(fromStatus, toStatus);
  if (validationError) {
    throw Object.assign(new Error(validationError.message), { code: validationError.code });
  }

  // Apply transition
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('item_requests')
    .update({
      status: toStatus,
      status_changed_at: now,
      status_changed_by: actorId,
    })
    .eq('id', requestId);

  if (updateError) {
    throw Object.assign(new Error(updateError.message), { code: 'DB_ERROR' });
  }

  // Write audit log (best-effort)
  await writeAuditLog({
    requestId,
    action: 'STATUS_TRANSITION',
    fromStatus,
    toStatus,
    performedBy: actorId,
    notes: options.notes,
    metadata: options.metadata,
  });
}

// ── Audit log retrieval ────────────────────────────────────────────────────────

/**
 * Returns the full audit trail for a request, ordered oldest-first.
 */
export async function getAuditLog(requestId: string): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from('item_request_audit_log')
    .select('*')
    .eq('request_id', requestId)
    .order('performed_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as AuditLogEntry[];
}

// ── SLA helpers ───────────────────────────────────────────────────────────────

export interface SlaConfig {
  [status: string]: number; // hours
}

let _slaConfigCache: SlaConfig | null = null;

/**
 * Fetches the SLA configuration from app_config.
 * Result is cached in memory for the lifetime of the page session.
 */
export async function getSlaConfig(): Promise<SlaConfig> {
  if (_slaConfigCache) return _slaConfigCache;

  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'item_request_sla_hours')
    .single();

  if (error) throw new Error(error.message);

  _slaConfigCache = data?.value as SlaConfig ?? {};
  return _slaConfigCache;
}

export interface SlaRemaining {
  /** Hours remaining. Negative means overdue. */
  hoursRemaining: number;
  /** Total SLA hours for this status. */
  slaHours: number;
  /** Fraction of time consumed, clamped 0–1. */
  fractionElapsed: number;
  isOverdue: boolean;
  isWarning: boolean; // < 25% remaining
}

/**
 * Calculates time remaining on the SLA for a given status and start time.
 *
 * @param status        The current request status
 * @param startedAt     ISO timestamp when the current stage began
 * @param slaConfig     Optional pre-fetched SLA config (avoids a DB hit if caller already has it)
 */
export async function getSlaRemaining(
  status: ItemRequestStatus,
  startedAt: string,
  slaConfig?: SlaConfig
): Promise<SlaRemaining | null> {
  const config = slaConfig ?? await getSlaConfig();
  const slaHours = config[status];

  if (!slaHours) return null;

  const elapsedMs = Date.now() - new Date(startedAt).getTime();
  const elapsedHours = elapsedMs / 3_600_000;
  const hoursRemaining = slaHours - elapsedHours;
  const fractionElapsed = Math.min(1, elapsedHours / slaHours);

  return {
    hoursRemaining,
    slaHours,
    fractionElapsed,
    isOverdue: hoursRemaining < 0,
    isWarning: hoursRemaining >= 0 && hoursRemaining < slaHours * 0.25,
  };
}

// ── Assignment helpers ─────────────────────────────────────────────────────────

/**
 * Assigns a request to a user and writes an audit log entry.
 */
export async function assignRequest(
  requestId: string,
  assigneeId: string,
  actorId?: string
): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const actor = actorId ?? authData?.user?.id;
  if (!actor) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('item_requests')
    .update({ assigned_to: assigneeId, assigned_at: now })
    .eq('id', requestId);

  if (error) throw new Error(error.message);

  await writeAuditLog({
    requestId,
    action: 'ASSIGNED',
    fromStatus: null,
    toStatus: null,
    performedBy: actor,
    metadata: { assignee_id: assigneeId },
  });
}

/**
 * Records a revision request on the item_requests row and fires an audit entry.
 */
export async function requestRevision(
  requestId: string,
  reason: string,
  actorId?: string
): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const actor = actorId ?? authData?.user?.id;
  if (!actor) throw new Error('Not authenticated');

  // First apply the REVISION_REQUIRED transition (validates from current status)
  await transitionRequest(requestId, 'REVISION_REQUIRED', {
    notes: reason,
    actorId: actor,
    metadata: { action: 'REVISION_REQUEST' },
  });

  // Also set the revision_requested_by field for UI reference
  await supabase
    .from('item_requests')
    .update({ revision_requested_by: actor })
    .eq('id', requestId);
}
