// Safe dynamic Supabase client loader (prevents Node.js ESM evaluation crashes on window/import.meta)
let cachedSupabase: any = null;
async function getSupabaseClient(): Promise<any> {
  if (cachedSupabase) return cachedSupabase;
  if (typeof window !== 'undefined') {
    try {
      const clientMod = await import('../lib/supabaseClient.ts');
      cachedSupabase = clientMod.supabase;
    } catch {
      cachedSupabase = null;
    }
  }
  return cachedSupabase;
}
import { 
  siteApprovalWorkflowService, 
  VERIFIED_APPROVAL_IDENTITIES,
  buildSafeEmailHtml,
  buildSafeTeamsCard
} from './siteApprovalWorkflowService.ts';
import type { 
  SiteApprovalWorkflow, 
  WorkflowAuditEntry,
  ApprovalNotificationRecord 
} from './siteApprovalWorkflowService.ts';
import type { PORequest, User, RoleDefinition } from '../types.ts';

/**
 * Outbox notification record conforming to the durable outbox table schema:
 * public.site_workflow_notification_outbox
 */
export interface DurableOutboxRecord {
  id: string;
  idempotency_key: string;
  po_id: string;
  display_id: string;
  site_id: string;
  recipient_id: string;
  recipient_name: string;
  recipient_email: string;
  channel: 'IN_APP' | 'EMAIL' | 'TEAMS';
  status: 'QUEUED' | 'DELIVERED' | 'FAILED' | 'PREVIEW_DURABLE';
  title: string;
  body: string;
  html_payload?: string;
  teams_card_payload?: Record<string, unknown>;
  retry_count: number;
  max_retries: number;
  last_error?: string;
  created_at: string;
  delivered_at?: string;
}

/**
 * Durable Storage Adapter that integrates with Supabase PostgreSQL (public.site_approval_workflows)
 * with graceful fallback to persistent client cache when database schema is not yet applied.
 */
export class SupabaseWorkflowStorageAdapter {
  private fallbackStore: Map<string, string> = new Map();
  private hasCheckedTable = false;
  private isTableAvailable = false;
  private storageAdapter: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void };

  constructor(storageAdapter: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }) {
    this.storageAdapter = storageAdapter;
  }

  async checkTableAvailability(): Promise<boolean> {
    if (this.hasCheckedTable) return this.isTableAvailable;
    try {
      const sb = await getSupabaseClient();
      if (!sb) {
        this.isTableAvailable = false;
        this.hasCheckedTable = true;
        return false;
      }
      const { data, error } = await sb.from('site_approval_workflows').select('id').limit(1);
      this.isTableAvailable = !error;
    } catch {
      this.isTableAvailable = false;
    }
    this.hasCheckedTable = true;
    return this.isTableAvailable;
  }

  async getWorkflows(): Promise<SiteApprovalWorkflow[]> {
    const isDbReady = await this.checkTableAvailability();
    const sb = await getSupabaseClient();
    if (isDbReady && sb) {
      try {
        const { data, error } = await sb
          .from('site_approval_workflows')
          .select('*')
          .order('site_name', { ascending: true });

        if (!error && data && data.length > 0) {
          return data as SiteApprovalWorkflow[];
        }
      } catch (err) {
        console.warn('[WorkflowStorageAdapter] Database read failed, using cached storage:', err);
      }
    }

    // Local cached storage fallback
    const cached = this.storageAdapter.getItem('procureflow_site_approval_workflows_v1');
    if (cached) {
      try {
        return JSON.parse(cached) as SiteApprovalWorkflow[];
      } catch {
        // Parse error fallback
      }
    }

    return [];
  }

  async saveWorkflow(workflow: SiteApprovalWorkflow, actorName = 'Admin'): Promise<SiteApprovalWorkflow> {
    const isDbReady = await this.checkTableAvailability();
    const sb = await getSupabaseClient();
    if (isDbReady && sb) {
      try {
        const payload = {
          ...workflow,
          updated_at: new Date().toISOString(),
          updated_by: actorName,
        };
        const { data, error } = await sb
          .from('site_approval_workflows')
          .upsert(payload, { onConflict: 'site_id' })
          .select()
          .single();

        if (!error && data) {
          return data as SiteApprovalWorkflow;
        }
      } catch (err) {
        console.warn('[WorkflowStorageAdapter] Database write failed, falling back to local storage:', err);
      }
    }

    // Local cache fallback
    const current = await this.getWorkflows();
    const existingIndex = current.findIndex(w => w.site_id === workflow.site_id);
    const updated = {
      ...workflow,
      updated_at: new Date().toISOString(),
      updated_by: actorName,
    };
    if (existingIndex >= 0) {
      current[existingIndex] = updated;
    } else {
      current.push(updated);
    }
    this.storageAdapter.setItem('procureflow_site_approval_workflows_v1', JSON.stringify(current));
    return updated;
  }
}

/**
 * Durable Notification Outbox Adapter.
 * Prepares exact payloads for existing providers without live network dispatch:
 * - In-App: formatted for public.user_notifications
 * - Email: formatted for Supabase Edge Function 'send-notification-email' (Microsoft Graph)
 * - Teams: formatted as Microsoft Teams Adaptive Card v1.4
 * - Telemetry: formatted for public.notification_delivery_logs
 */
export class DurableNotificationOutboxAdapter {
  private outboxQueue: DurableOutboxRecord[] = [];
  private outboxStorageKey = 'procureflow_notification_outbox_v2';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.outboxStorageKey);
        if (raw) this.outboxQueue = JSON.parse(raw);
      }
    } catch {
      this.outboxQueue = [];
    }
  }

  private persistToStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.outboxStorageKey, JSON.stringify(this.outboxQueue));
      }
    } catch {
      // Storage full or unavailable
    }
  }

  /**
   * Enqueues a notification into the durable outbox without sending live network messages.
   * Deduplicates using deterministic idempotency keys.
   */
  async enqueue(params: {
    eventType: string;
    poId: string;
    displayId: string;
    siteId: string;
    recipientId: string;
    recipientName: string;
    recipientEmail: string;
    channel: 'IN_APP' | 'EMAIL' | 'TEAMS';
    title: string;
    body: string;
    htmlPayload?: string;
    teamsCardPayload?: Record<string, unknown>;
  }): Promise<{ queued: boolean; record: DurableOutboxRecord; duplicate: boolean }> {
    const idempotencyKey = siteApprovalWorkflowService.generateIdempotencyKey(
      params.poId,
      params.eventType + '_' + params.channel,
      params.recipientId
    );

    // Check existing in outbox queue
    const existing = this.outboxQueue.find(r => r.idempotency_key === idempotencyKey);
    if (existing) {
      return { queued: false, record: existing, duplicate: true };
    }

    const record: DurableOutboxRecord = {
      id: 'outbox_' + Math.random().toString(36).slice(2, 10),
      idempotency_key: idempotencyKey,
      po_id: params.poId,
      display_id: params.displayId,
      site_id: params.siteId,
      recipient_id: params.recipientId,
      recipient_name: params.recipientName,
      recipient_email: params.recipientEmail,
      channel: params.channel,
      status: 'PREVIEW_DURABLE', // Safe non-sending status
      title: params.title,
      body: params.body,
      html_payload: params.htmlPayload,
      teams_card_payload: params.teamsCardPayload,
      retry_count: 0,
      max_retries: 3,
      created_at: new Date().toISOString(),
    };

    this.outboxQueue.unshift(record);
    this.persistToStorage();

    // Optionally write to public.site_workflow_notification_outbox if table is available
    const sb = await getSupabaseClient();
    if (sb) {
      try {
        await sb.from('site_workflow_notification_outbox').insert({
          idempotency_key: record.idempotency_key,
          po_id: record.po_id,
          display_id: record.display_id,
          site_id: record.site_id,
          recipient_id: record.recipient_id,
          recipient_name: record.recipient_name,
          recipient_email: record.recipient_email,
          channel: record.channel,
          status: record.status,
          title: record.title,
          body: record.body,
          html_payload: record.html_payload,
          teams_card_payload: record.teams_card_payload,
          retry_count: record.retry_count,
          max_retries: record.max_retries,
          created_at: record.created_at,
        });
      } catch {
        // Non-blocking schema fallback
      }
    }

    return { queued: true, record, duplicate: false };
  }

  getOutbox(): DurableOutboxRecord[] {
    return [...this.outboxQueue];
  }

  clearOutbox() {
    this.outboxQueue = [];
    this.persistToStorage();
  }
}

/**
 * Server-Side Authorization Evaluator.
 * Mirrors the SQL function check_site_approval_authority for code-tier verification.
 */
export function evaluateServerSideAuthorization(params: {
  po: PORequest;
  actor: {
    id: string;
    name?: string;
    email?: string;
    role: string;
    site_id?: string;
    siteIds?: string[];
  };
  workflow?: SiteApprovalWorkflow | null;
  roles?: RoleDefinition[];
}): {
  authorized: boolean;
  reason?: string;
  errorCode?: string;
  roleApplied?: string;
} {
  const { po, actor, workflow, roles } = params;

  // 1. Segregation of Duties (SoD)
  if (actor.id && po.requesterId && actor.id === po.requesterId && actor.role !== 'ADMIN') {
    return {
      authorized: false,
      reason: 'Segregation of duties: Requesters cannot approve their own purchase requests.',
      errorCode: 'SOD_VIOLATION',
    };
  }

  // 2. System Administrator Override
  if (actor.role === 'ADMIN' || actor.role === 'SYSTEM_ADMIN') {
    return {
      authorized: true,
      roleApplied: 'ADMIN',
      reason: 'Authorized as System Administrator.',
    };
  }

  // 3. Workflow-configured site manager evaluation
  if (workflow && workflow.is_active) {
    const isApprovalManager =
      (workflow.approval_manager_id && workflow.approval_manager_id === actor.id) ||
      (workflow.approval_manager_email && workflow.approval_manager_email.toLowerCase() === (actor.email || '').toLowerCase());

    if (isApprovalManager) {
      return {
        authorized: true,
        roleApplied: 'SITE_APPROVAL_MANAGER',
        reason: `Authorized as designated Site Approval Manager for ${workflow.site_name}.`,
      };
    }

    const isEscalationAuthority =
      (workflow.escalation_manager_id && workflow.escalation_manager_id === actor.id) ||
      (workflow.escalation_manager_email && workflow.escalation_manager_email.toLowerCase() === (actor.email || '').toLowerCase());

    if (isEscalationAuthority) {
      return {
        authorized: true,
        roleApplied: 'ESCALATION_AUTHORITY',
        reason: `Authorized as designated Escalation Authority for ${workflow.site_name}.`,
      };
    }

    return {
      authorized: false,
      reason: `Actor is not designated Site Approval Manager (${workflow.approval_manager_name}) or Escalation Authority for this facility.`,
      errorCode: 'UNAUTHORIZED_ACTOR',
    };
  }

  // 4. Fallback for unconfigured facility: Check site matching
  const actorSites = actor.siteIds || (actor.site_id ? [actor.site_id] : []);
  if (po.siteId && actorSites.length > 0 && !actorSites.includes(po.siteId)) {
    return {
      authorized: false,
      reason: `Actor site assignment does not cover facility ${po.siteId}.`,
      errorCode: 'CROSS_SITE_UNAUTHORIZED',
    };
  }

  return {
    authorized: true,
    roleApplied: 'SITE_USER_MATCH',
    reason: 'Authorized under standard facility matching.',
  };
}

/**
 * Main Integration Service: Bridges real AppContext / UI entrypoints to
 * site approval workflows and the durable outbox without sending live staff notifications.
 */
export class SiteApprovalIntegrationService {
  private outbox = new DurableNotificationOutboxAdapter();

  getOutbox(): DurableOutboxRecord[] {
    return this.outbox.getOutbox();
  }

  clearOutbox() {
    this.outbox.clearOutbox();
  }

  /**
   * Synchronous authorization check for AppContext.canApproveOrder
   */
  canApproveOrderWithSiteWorkflowSync(
    po: PORequest,
    currentUser: User | null,
    roles?: RoleDefinition[]
  ): boolean {
    if (!currentUser || !po) return false;

    const workflow = po.siteId ? siteApprovalWorkflowService.getWorkflowForSiteSync(po.siteId) : null;
    const auth = evaluateServerSideAuthorization({
      po,
      actor: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        site_id: currentUser.siteIds?.[0],
        siteIds: currentUser.siteIds,
      },
      workflow,
      roles,
    });

    return auth.authorized;
  }

  /**
   * Evaluates if current user can approve an order, honoring per-site assigned approval managers.
   */
  async canApproveOrderWithSiteWorkflow(
    po: PORequest,
    currentUser: User | null,
    roles?: RoleDefinition[]
  ): Promise<boolean> {
    if (!currentUser || !po) return false;

    const workflow = po.siteId ? await siteApprovalWorkflowService.getWorkflowForSite(po.siteId) : null;
    const auth = evaluateServerSideAuthorization({
      po,
      actor: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        site_id: currentUser.siteIds?.[0],
        siteIds: currentUser.siteIds,
      },
      workflow,
      roles,
    });

    return auth.authorized;
  }

  /**
   * Called when a requisition is submitted (e.g. from POCreate or AppContext.createPO)
   */
  async onRequisitionCreated(po: PORequest, requester: User | null): Promise<void> {
    if (!po) return;

    const siteId = po.siteId || '44444444-4444-4444-8444-444444444444';
    const workflow = await siteApprovalWorkflowService.getWorkflowForSite(siteId);

    const siteDisplayName = (po as any).siteName || workflow?.site_name || 'SPL Facility';
    const siteManagerName = workflow?.approval_manager_name || 'Site Manager';
    const siteManagerEmail = workflow?.approval_manager_email || 'site.manager@splservices.com.au';
    const siteManagerId = workflow?.approval_manager_id || 'site_mgr_' + siteId.slice(0, 8);

    siteApprovalWorkflowService.logAudit({
      po_id: po.id,
      display_id: po.displayId || po.id,
      site_id: siteId,
      action: 'ROUTED_TO_SITE_MANAGER',
      actor_id: requester?.id || 'anonymous_requester',
      actor_name: requester?.name || 'Requester',
      actor_role: requester?.role || 'SITE_USER',
      details: {
        totalAmount: po.totalAmount,
        site: siteDisplayName,
        assignedSiteManager: siteManagerName,
        assignedSiteManagerEmail: siteManagerEmail,
      },
      timestamp: new Date().toISOString(),
    });

    const facts = [
      { label: 'Requisition ID', value: po.displayId || po.id },
      { label: 'Facility', value: siteDisplayName },
      { label: 'Requester', value: requester?.name || 'Staff Member' },
      { label: 'Total Value', value: `$${(po.totalAmount || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}` },
    ];

    const emailHtml = buildSafeEmailHtml({
      title: `PO Approval Required: ${po.displayId || po.id}`,
      bodyHtml: `<p>A new purchase requisition has been raised for <strong>${siteDisplayName}</strong> and requires your approval as designated Site Approval Manager.</p>`,
      facts,
      actionUrl: `https://procureflow.splservices.com.au/approvals/${po.id}`,
      actionLabel: 'Review Requisition in ProcureFlow',
    });

    const teamsCard = buildSafeTeamsCard({
      title: `PO Approval Required: ${po.displayId || po.id}`,
      bodyText: `Purchase requisition raised by ${requester?.name || 'Staff Member'} for ${siteDisplayName}. Total: $${(po.totalAmount || 0).toFixed(2)} AUD.`,
      facts: facts.map(f => ({ title: f.label, value: f.value })),
      actionUrl: `https://procureflow.splservices.com.au/approvals/${po.id}`,
      actionLabel: 'Review in ProcureFlow',
    });

    // Enqueue In-App
    await this.outbox.enqueue({
      eventType: 'SITE_MANAGER_APPROVAL_REQUIRED',
      poId: po.id,
      displayId: po.displayId || po.id,
      siteId,
      recipientId: siteManagerId,
      recipientName: siteManagerName,
      recipientEmail: siteManagerEmail,
      channel: 'IN_APP',
      title: `Approval Required: ${po.displayId || po.id}`,
      body: `Requisition ${po.displayId || po.id} ($${(po.totalAmount || 0).toFixed(2)}) requires your review for ${siteDisplayName}.`,
    });

    // Enqueue Email (Formatted for Edge Function send-notification-email)
    await this.outbox.enqueue({
      eventType: 'SITE_MANAGER_APPROVAL_REQUIRED',
      poId: po.id,
      displayId: po.displayId || po.id,
      siteId,
      recipientId: siteManagerId,
      recipientName: siteManagerName,
      recipientEmail: siteManagerEmail,
      channel: 'EMAIL',
      title: `PO Approval Required: ${po.displayId || po.id}`,
      body: `Requisition ${po.displayId || po.id} requires approval.`,
      htmlPayload: emailHtml,
    });

    // Enqueue Teams Adaptive Card v1.4
    await this.outbox.enqueue({
      eventType: 'SITE_MANAGER_APPROVAL_REQUIRED',
      poId: po.id,
      displayId: po.displayId || po.id,
      siteId,
      recipientId: siteManagerId,
      recipientName: siteManagerName,
      recipientEmail: siteManagerEmail,
      channel: 'TEAMS',
      title: `PO Approval Required: ${po.displayId || po.id}`,
      body: `Card dispatched to ${siteManagerName}`,
      teamsCardPayload: teamsCard,
    });
  }

  /**
   * Called when an approval decision is executed (e.g. from AppContext.updatePOStatus or PODetail)
   */
  async onPOApproved(po: PORequest, approver: { id?: string; name?: string; role?: string }): Promise<void> {
    if (!po) return;

    const siteId = po.siteId || '44444444-4444-4444-8444-444444444444';
    const requesterName = po.requesterName || 'Requester';
    const requesterEmail = (po as any).requesterEmail || 'requester@splservices.com.au';
    const requesterId = po.requesterId || 'requester_' + po.id.slice(0, 8);
    const siteDisplayName = (po as any).siteName || 'SPL Facility';

    siteApprovalWorkflowService.logAudit({
      po_id: po.id,
      display_id: po.displayId || po.id,
      site_id: siteId,
      action: 'APPROVED_BY_SITE_MANAGER',
      actor_id: approver.id || 'approver',
      actor_name: approver.name || 'Site Approval Manager',
      actor_role: approver.role || 'SITE_MANAGER',
      details: {
        totalAmount: po.totalAmount,
        reservationExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        instruction: "Ash's June 17 Process: Requester must now create Concur PR & log PR number.",
      },
      timestamp: new Date().toISOString(),
    });

    // Outbox notification to requester
    await this.outbox.enqueue({
      eventType: 'PO_APPROVED_PROCEED_TO_CONCUR',
      poId: po.id,
      displayId: po.displayId || po.id,
      siteId,
      recipientId: requesterId,
      recipientName: requesterName,
      recipientEmail: requesterEmail,
      channel: 'IN_APP',
      title: `Requisition Approved: ${po.displayId || po.id}`,
      body: `Approved by ${approver.name || 'Site Manager'}. 48-Hour Supplier Stock Reservation Hold Active. Please create Concur PR and record the PR number.`,
    });

    await this.outbox.enqueue({
      eventType: 'PO_APPROVED_PROCEED_TO_CONCUR',
      poId: po.id,
      displayId: po.displayId || po.id,
      siteId,
      recipientId: requesterId,
      recipientName: requesterName,
      recipientEmail: requesterEmail,
      channel: 'EMAIL',
      title: `PO Approved: ${po.displayId || po.id} — Proceed to Concur PR`,
      body: `Requisition ${po.displayId || po.id} has been approved.`,
      htmlPayload: buildSafeEmailHtml({
        title: `Requisition Approved: ${po.displayId || po.id}`,
        bodyHtml: `<p>Your purchase requisition for <strong>${siteDisplayName}</strong> has been approved by <strong>${approver.name || 'Site Manager'}</strong>.</p><p style="color: #0284c7; font-weight: bold;">48-Hour Supplier Stock Reservation Hold is now active.</p><p>Please raise the Concur Purchase Request and log the PR number in ProcureFlow.</p>`,
      }),
    });
  }

  /**
   * Called when a requisition is rejected
   */
  async onPORejected(po: PORequest, rejector: { id?: string; name?: string; role?: string }, reason?: string): Promise<void> {
    if (!po) return;

    const siteId = po.siteId || '44444444-4444-4444-8444-444444444444';
    const requesterName = po.requesterName || 'Requester';
    const requesterEmail = (po as any).requesterEmail || 'requester@splservices.com.au';
    const requesterId = po.requesterId || 'requester_' + po.id.slice(0, 8);
    const siteDisplayName = (po as any).siteName || 'SPL Facility';

    siteApprovalWorkflowService.logAudit({
      po_id: po.id,
      display_id: po.displayId || po.id,
      site_id: siteId,
      action: 'REJECTED_BY_SITE_MANAGER',
      actor_id: rejector.id || 'rejector',
      actor_name: rejector.name || 'Site Approval Manager',
      actor_role: rejector.role || 'SITE_MANAGER',
      details: { reason: reason || 'Not specified' },
      timestamp: new Date().toISOString(),
    });

    await this.outbox.enqueue({
      eventType: 'PO_REJECTED',
      poId: po.id,
      displayId: po.displayId || po.id,
      siteId,
      recipientId: requesterId,
      recipientName: requesterName,
      recipientEmail: requesterEmail,
      channel: 'IN_APP',
      title: `Requisition Rejected: ${po.displayId || po.id}`,
      body: `Requisition was rejected by ${rejector.name || 'Site Manager'}. Reason: ${reason || 'No reason provided'}.`,
    });
  }

  /**
   * Called when a requisition is escalated (Manual/Configurable escalation)
   */
  async onPOEscalated(po: PORequest, actor: { id?: string; name?: string; role?: string }, reason?: string): Promise<void> {
    if (!po) return;

    const siteId = po.siteId || '44444444-4444-4444-8444-444444444444';
    const workflow = await siteApprovalWorkflowService.getWorkflowForSite(siteId);

    const escalationName = workflow?.escalation_manager_name || 'Ebrahim Mokhtari (COO)';
    const escalationEmail = workflow?.escalation_manager_email || 'ebrahim.mokhtari@splservices.com.au';
    const escalationId = workflow?.escalation_manager_id || VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.id;

    siteApprovalWorkflowService.logAudit({
      po_id: po.id,
      display_id: po.displayId || po.id,
      site_id: siteId,
      action: 'ESCALATED_TO_COO',
      actor_id: actor.id || 'system',
      actor_name: actor.name || 'Escalation Supervisor',
      actor_role: actor.role || 'ADMIN',
      details: {
        escalatedTo: escalationName,
        escalatedToEmail: escalationEmail,
        slaStatus: 'DECISION_PENDING',
        reason: reason || 'Manual administrative escalation',
      },
      timestamp: new Date().toISOString(),
    });

    await this.outbox.enqueue({
      eventType: 'PO_ESCALATED_TO_COO',
      poId: po.id,
      displayId: po.displayId || po.id,
      siteId,
      recipientId: escalationId,
      recipientName: escalationName,
      recipientEmail: escalationEmail,
      channel: 'IN_APP',
      title: `Escalated PO Approval Required: ${po.displayId || po.id}`,
      body: `Requisition ${po.displayId || po.id} ($${(po.totalAmount || 0).toFixed(2)}) has been escalated to you for final approval.`,
    });
  }

  /**
   * Called when requester records Concur PR number
   */
  onConcurRequestLinked(po: PORequest, concurRequestNumber: string, actor?: { id?: string; name?: string; role?: string }): void {
    if (!po) return;

    siteApprovalWorkflowService.logAudit({
      po_id: po.id,
      display_id: po.displayId || po.id,
      site_id: po.siteId || '44444444-4444-4444-8444-444444444444',
      action: 'CONCUR_PR_RECORDED',
      actor_id: actor?.id || po.requesterId || 'requester',
      actor_name: actor?.name || po.requesterName || 'Requester',
      actor_role: actor?.role || 'SITE_USER',
      details: {
        concurRequestNumber,
        status: 'APPROVED_PENDING_CONCUR',
        nextStep: 'Awaiting Concur PO issuance',
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Called when requester links Concur PO number (unlocks deliveries)
   */
  onConcurPOLinked(po: PORequest, concurPoNumber: string, actor?: { id?: string; name?: string; role?: string }): void {
    if (!po) return;

    siteApprovalWorkflowService.logAudit({
      po_id: po.id,
      display_id: po.displayId || po.id,
      site_id: po.siteId || '44444444-4444-4444-8444-444444444444',
      action: 'CONCUR_PO_LINKED',
      actor_id: actor?.id || po.requesterId || 'requester',
      actor_name: actor?.name || po.requesterName || 'Requester',
      actor_role: actor?.role || 'SITE_USER',
      details: {
        concurPoNumber,
        status: 'ACTIVE',
        deliveriesUnlocked: true,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

export const siteApprovalIntegrationService = new SiteApprovalIntegrationService();
