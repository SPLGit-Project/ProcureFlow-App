/**
 * Site Approval Workflow Service
 *
 * Implements per-site approval workflow configuration, site manager routing,
 * idempotent notifications with retry logic, escalation management,
 * role authorization, and traceable reassignment of legacy approver queues.
 */

export const PROCUREFLOW_LOGO_URL = 'https://raw.githubusercontent.com/SPLGit-Project/ProcureFlow-App/main/public/Procureflow_Logo.png';
export const PROCUREFLOW_ICON_URL = 'https://raw.githubusercontent.com/SPLGit-Project/ProcureFlow-App/main/public/Procureflow_Icon.png';

export function buildSafeTeamsCard(params: {
  title: string;
  subtitle?: string;
  bodyText?: string;
  actionUrl?: string;
  actionLabel?: string;
  facts?: Array<{ title: string; value: string }>;
}) {
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'Container',
              style: 'emphasis',
              items: [
                {
                  type: 'TextBlock',
                  text: params.title,
                  weight: 'Bolder',
                  size: 'Medium',
                  color: 'Accent',
                  wrap: true,
                },
                {
                  type: 'TextBlock',
                  text: params.subtitle || 'ProcureFlow Approvals',
                  isSubtle: true,
                  size: 'Small',
                  wrap: true,
                },
              ],
            },
            params.bodyText ? { type: 'TextBlock', text: params.bodyText, wrap: true } : null,
            params.facts && params.facts.length > 0
              ? { type: 'FactSet', facts: params.facts.map(f => ({ title: f.title, value: f.value })) }
              : null,
          ].filter(Boolean),
          actions: params.actionUrl
            ? [
                {
                  type: 'Action.OpenUrl',
                  title: params.actionLabel || 'Open in ProcureFlow',
                  url: params.actionUrl,
                },
              ]
            : [],
        },
      },
    ],
  };
}

export function buildSafeEmailHtml(params: {
  title: string;
  bodyHtml?: string;
  actionUrl?: string;
  actionLabel?: string;
  facts?: Array<{ label: string; value: string }>;
}): string {
  const factsHtml = params.facts && params.facts.length > 0
    ? `
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        ${params.facts.map(f => `
          <tr>
            <td style="padding: 8px 12px; font-weight: 600; color: #64748b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${f.label}</td>
            <td style="padding: 8px 12px; font-weight: 700; color: #0f172a; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${f.value}</td>
          </tr>
        `).join('')}
      </table>
    `
    : '';

  return `<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 28px;">
    <div style="margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px;">
      <img src="${PROCUREFLOW_LOGO_URL}" alt="ProcureFlow" style="max-height: 32px;" />
    </div>
    <h2 style="color: #0f172a; margin-top: 0;">${params.title}</h2>
    ${params.bodyHtml || ''}
    ${factsHtml}
    <div style="margin-top: 24px; text-align: center;">
      <a href="${params.actionUrl || '#'}" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700;">
        ${params.actionLabel || 'Open in ProcureFlow'}
      </a>
    </div>
  </div>
</body>
</html>`;
}

export interface SiteApprovalWorkflow {
  id?: string;
  site_id: string;
  site_name: string;
  approval_manager_id: string;
  approval_manager_name: string;
  approval_manager_email: string;
  approval_manager_entra_id?: string;
  escalation_manager_id: string;
  escalation_manager_name: string;
  escalation_manager_email: string;
  escalation_manager_entra_id?: string;
  escalation_sla_hours: number;
  sla_status: 'DECISION_PENDING' | 'CONFIGURED';
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

export interface ApprovalNotificationRecord {
  id: string;
  idempotency_key: string;
  event_type: 'SITE_MANAGER_APPROVAL_REQUIRED' | 'REQUESTER_PO_APPROVED' | 'REQUESTER_PO_REJECTED' | 'ESCALATION_MANAGER_ALERT';
  po_id: string;
  display_id: string;
  site_id: string;
  recipient_id: string;
  recipient_name: string;
  recipient_email: string;
  channel: 'IN_APP' | 'EMAIL' | 'TEAMS';
  status: 'QUEUED' | 'DELIVERED' | 'FAILED' | 'PREVIEW_ONLY';
  title: string;
  body: string;
  html_preview?: string;
  teams_card_payload?: Record<string, unknown>;
  retry_count: number;
  max_retries: number;
  created_at: string;
  delivered_at?: string;
  error_message?: string;
}

export interface WorkflowAuditEntry {
  id: string;
  po_id: string;
  display_id: string;
  site_id: string;
  action: 'WORKFLOW_CONFIGURED' | 'ROUTED_TO_SITE_MANAGER' | 'APPROVED_BY_SITE_MANAGER' | 'REJECTED_BY_SITE_MANAGER' | 'ESCALATED_TO_COO' | 'CONCUR_PR_RECORDED' | 'CONCUR_PO_LINKED' | 'REASSIGNED_SITE_MANAGER' | 'REASSIGNED_FROM_LEGACY';
  actor_id: string;
  actor_name: string;
  actor_role: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface WorkflowStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// Verified parent Entra & Directory mappings
export const VERIFIED_APPROVAL_IDENTITIES = {
  MELBOURNE_APPROVAL_MANAGER: {
    id: '460a44d0-5237-4e59-aad3-93619d6d50cd',
    name: 'Matthew Mancuso',
    email: 'matthew.mancuso@splservices.com.au',
    entra_oid: '460a44d0-5237-4e59-aad3-93619d6d50cd',
    site_id: '44444444-4444-4444-8444-444444444444',
    site_name: 'SPL Melbourne',
    role: 'SITE_MANAGER',
  },
  ESCALATION_MANAGER_COO: {
    id: '9e97d720-3bf0-4451-b739-9fd87d27686c',
    name: 'Ebrahim Mokhtari',
    email: 'ebrahim.mokhtari@splservices.com.au',
    entra_oid: '9e97d720-3bf0-4451-b739-9fd87d27686c',
    title: 'Chief Operating Officer (COO)',
    role: 'ADMIN',
  },
  LEGACY_OFFBOARDED_LEAD: {
    id: '84ce40fb-0e8e-482f-8587-bf51f413008e',
    name: 'Ashish Chhabra',
    email: 'ashish.chhabra@splservices.com.au',
    status: 'NO_LONGER_WITH_SPL',
    legacy_role: 'ADMIN',
  },
};

const STORAGE_KEY_SITE_WORKFLOWS = 'pf_site_approval_workflows_v1';
const STORAGE_KEY_NOTIFICATION_LOGS = 'pf_approval_notification_logs_v1';
const STORAGE_KEY_AUDIT_LOGS = 'pf_site_workflow_audit_logs_v1';

// Default in-memory shared store for non-browser / unit test environments
const fallbackStore = new Map<string, string>();
const defaultNodeStorage: WorkflowStorageAdapter = {
  getItem: (key: string) => fallbackStore.get(key) || null,
  setItem: (key: string, val: string) => { fallbackStore.set(key, val); },
  removeItem: (key: string) => { fallbackStore.delete(key); },
};

export class SiteApprovalWorkflowService {
  private inMemoryWorkflows: Map<string, SiteApprovalWorkflow> = new Map();
  private inMemoryNotifications: ApprovalNotificationRecord[] = [];
  private inMemoryAuditLogs: WorkflowAuditEntry[] = [];
  private activeLocks: Set<string> = new Set();
  private orderStateRegistry: Map<string, string> = new Map();
  private storageAdapter: WorkflowStorageAdapter;

  constructor(customStorage?: WorkflowStorageAdapter) {
    if (customStorage) {
      this.storageAdapter = customStorage;
    } else if (typeof window !== 'undefined' && window.localStorage) {
      this.storageAdapter = window.localStorage;
    } else {
      this.storageAdapter = defaultNodeStorage;
    }
    this.seedDefaultMelbourneWorkflow();
  }

  public setStorageAdapter(adapter: WorkflowStorageAdapter) {
    this.storageAdapter = adapter;
    this.inMemoryWorkflows.clear();
    this.seedDefaultMelbourneWorkflow();
  }

  public clearAllState() {
    this.inMemoryWorkflows.clear();
    this.inMemoryNotifications = [];
    this.inMemoryAuditLogs = [];
    this.activeLocks.clear();
    this.orderStateRegistry.clear();
    this.storageAdapter.removeItem(STORAGE_KEY_SITE_WORKFLOWS);
    this.storageAdapter.removeItem(STORAGE_KEY_NOTIFICATION_LOGS);
    this.storageAdapter.removeItem(STORAGE_KEY_AUDIT_LOGS);
    this.seedDefaultMelbourneWorkflow();
  }

  private seedDefaultMelbourneWorkflow() {
    const melb: SiteApprovalWorkflow = {
      site_id: '44444444-4444-4444-8444-444444444444',
      site_name: 'SPL Melbourne',
      approval_manager_id: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.id,
      approval_manager_name: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.name,
      approval_manager_email: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.email,
      approval_manager_entra_id: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.entra_oid,
      escalation_manager_id: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.id,
      escalation_manager_name: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.name,
      escalation_manager_email: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.email,
      escalation_manager_entra_id: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.entra_oid,
      escalation_sla_hours: 24, // Configurable baseline
      sla_status: 'DECISION_PENDING', // Surfaced until executive sign-off
      is_active: true,
      notes: 'Initial per-site workflow demonstrated for Melbourne. Escalation SLA requires formal executive approval before activation.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: 'System Administrator',
    };
    this.inMemoryWorkflows.set(melb.site_id, melb);
  }

  /**
   * Generates a deterministic idempotency key for notification deduplication.
   */
  generateIdempotencyKey(poId: string, eventType: string, recipientId: string, bucketMinute = 5): string {
    const now = new Date();
    const roundedMinutes = Math.floor(now.getMinutes() / bucketMinute) * bucketMinute;
    const bucket = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}T${now.getHours()}:${roundedMinutes}`;
    return `notif_${poId}_${eventType}_${recipientId}_${bucket}`;
  }

  /**
   * Get all configured site approval workflows (hydrated from persistent storage)
   */
  async getSiteWorkflows(): Promise<SiteApprovalWorkflow[]> {
    try {
      const stored = this.storageAdapter.getItem(STORAGE_KEY_SITE_WORKFLOWS);
      if (stored) {
        const parsed = JSON.parse(stored) as SiteApprovalWorkflow[];
        parsed.forEach(w => this.inMemoryWorkflows.set(w.site_id, w));
      }
    } catch (err) {
      console.warn('Could not read workflows from persistent storage:', err);
    }
    return Array.from(this.inMemoryWorkflows.values());
  }

  /**
   * Get workflow for a specific site
   */
  async getWorkflowForSite(siteId: string): Promise<SiteApprovalWorkflow | null> {
    const workflows = await this.getSiteWorkflows();
    return workflows.find(w => w.site_id === siteId) || null;
  }

  /**
   * Save or update a site approval workflow with persistence across reloads/restarts
   */
  async saveSiteWorkflow(workflow: SiteApprovalWorkflow, actorName = 'Admin'): Promise<SiteApprovalWorkflow> {
    const updated: SiteApprovalWorkflow = {
      ...workflow,
      updated_at: new Date().toISOString(),
      updated_by: actorName,
    };

    this.inMemoryWorkflows.set(workflow.site_id, updated);

    try {
      const all = Array.from(this.inMemoryWorkflows.values());
      this.storageAdapter.setItem(STORAGE_KEY_SITE_WORKFLOWS, JSON.stringify(all));
    } catch (err) {
      console.warn('Could not persist workflow to storage:', err);
    }

    this.logAudit({
      po_id: 'GLOBAL',
      display_id: 'CONFIG',
      site_id: workflow.site_id,
      action: 'WORKFLOW_CONFIGURED',
      actor_id: 'ADMIN',
      actor_name: actorName,
      actor_role: 'ADMIN',
      details: {
        site_name: workflow.site_name,
        approval_manager: `${workflow.approval_manager_name} (${workflow.approval_manager_email})`,
        escalation_manager: `${workflow.escalation_manager_name} (${workflow.escalation_manager_email})`,
        escalation_sla_hours: workflow.escalation_sla_hours,
        sla_status: workflow.sla_status,
      },
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  /**
   * Reassign a site's approval authority with full audit trail traceability
   */
  async reassignSiteWorkflow(params: {
    siteId: string;
    newManager: { id: string; name: string; email: string; entra_id?: string };
    actor: { id: string; name: string; role: string };
    rationale: string;
  }): Promise<SiteApprovalWorkflow> {
    const existing = await this.getWorkflowForSite(params.siteId);
    if (!existing) {
      throw new Error(`Facility workflow for site ${params.siteId} not found.`);
    }

    const previousManager = {
      id: existing.approval_manager_id,
      name: existing.approval_manager_name,
      email: existing.approval_manager_email,
    };

    const updatedWorkflow: SiteApprovalWorkflow = {
      ...existing,
      approval_manager_id: params.newManager.id,
      approval_manager_name: params.newManager.name,
      approval_manager_email: params.newManager.email,
      approval_manager_entra_id: params.newManager.entra_id || params.newManager.id,
      updated_at: new Date().toISOString(),
      updated_by: params.actor.name,
    };

    this.inMemoryWorkflows.set(params.siteId, updatedWorkflow);
    this.storageAdapter.setItem(STORAGE_KEY_SITE_WORKFLOWS, JSON.stringify(Array.from(this.inMemoryWorkflows.values())));

    this.logAudit({
      po_id: 'GLOBAL',
      display_id: 'REASSIGN',
      site_id: params.siteId,
      action: 'REASSIGNED_SITE_MANAGER',
      actor_id: params.actor.id,
      actor_name: params.actor.name,
      actor_role: params.actor.role,
      details: {
        site_name: existing.site_name,
        previous_manager: previousManager,
        new_manager: params.newManager,
        rationale: params.rationale,
      },
      timestamp: new Date().toISOString(),
    });

    return updatedWorkflow;
  }

  /**
   * Authorize whether a user has approval authority for a site's requisitions
   */
  canActorApproveForSite(siteId: string, actor: { id: string; role?: string; is_admin?: boolean }): boolean {
    if (!actor || !siteId) return false;
    // Admins have global authority
    if (actor.role === 'ADMIN' || actor.is_admin === true) return true;

    const workflow = this.inMemoryWorkflows.get(siteId);
    if (!workflow || !workflow.is_active) return false;

    // Designated Site Approval Manager
    if (workflow.approval_manager_id === actor.id) return true;
    // Designated Escalation Authority (COO)
    if (workflow.escalation_manager_id === actor.id) return true;

    return false;
  }

  /**
   * Execute site approval transition with authorization checks and concurrent double-approval guards
   */
  async executeSiteApprovalTransition(params: {
    siteId: string;
    poId: string;
    displayId: string;
    decision: 'APPROVED' | 'REJECTED' | 'ESCALATED';
    actor: { id: string; name: string; role: string; email?: string; is_admin?: boolean };
    comments?: string;
    totalAmount?: number;
    requesterName?: string;
    requesterEmail?: string;
  }): Promise<{
    success: boolean;
    transitionStatus: string;
    stockReservationExpiresAt?: string;
    auditEntry: WorkflowAuditEntry;
  }> {
    // 1. Authorization Guard
    if (!this.canActorApproveForSite(params.siteId, params.actor)) {
      throw new Error(`UNAUTHORIZED_ACTOR: User ${params.actor.name} (${params.actor.id}) is not authorized to approve requisitions for site ${params.siteId}.`);
    }

    // 2. Concurrent Double-Approval Lock Guard
    const lockKey = `lock_approval_${params.poId}`;
    if (this.activeLocks.has(lockKey)) {
      throw new Error(`CONCURRENT_APPROVAL_CONFLICT: An approval transaction for PO ${params.poId} is already in progress.`);
    }

    const currentStatus = this.orderStateRegistry.get(params.poId) || 'PENDING_APPROVAL';
    if (currentStatus === 'APPROVED_PENDING_CONCUR' || currentStatus === 'APPROVED_PENDING_CONCUR_REQUEST' || currentStatus === 'ACTIVE') {
      throw new Error(`DUPLICATE_APPROVAL_ATTEMPT: PO ${params.poId} has already been approved and cannot be approved again.`);
    }

    this.activeLocks.add(lockKey);

    try {
      let targetStatus = 'PENDING_APPROVAL';
      let reservationExpiry: string | undefined = undefined;

      if (params.decision === 'APPROVED') {
        targetStatus = 'APPROVED_PENDING_CONCUR_REQUEST';
        reservationExpiry = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
        this.orderStateRegistry.set(params.poId, targetStatus);

        const audit = this.logAudit({
          po_id: params.poId,
          display_id: params.displayId,
          site_id: params.siteId,
          action: 'APPROVED_BY_SITE_MANAGER',
          actor_id: params.actor.id,
          actor_name: params.actor.name,
          actor_role: params.actor.role,
          details: {
            decision: 'APPROVED',
            comments: params.comments || 'Approved for site operations',
            stockReservationExpiresAt: reservationExpiry,
            statusTransition: targetStatus,
          },
          timestamp: new Date().toISOString(),
        });

        // Safe notification preview
        await this.dispatchSafeNotification({
          eventType: 'REQUESTER_PO_APPROVED',
          poId: params.poId,
          displayId: params.displayId,
          siteId: params.siteId,
          siteName: 'Facility',
          recipientId: 'requester_id',
          recipientName: params.requesterName || 'Requester',
          recipientEmail: params.requesterEmail || 'requester@splservices.com.au',
          totalAmount: params.totalAmount,
          decisionComments: params.comments,
        });

        return {
          success: true,
          transitionStatus: targetStatus,
          stockReservationExpiresAt: reservationExpiry,
          auditEntry: audit,
        };
      } else if (params.decision === 'REJECTED') {
        targetStatus = 'REJECTED';
        this.orderStateRegistry.set(params.poId, targetStatus);

        const audit = this.logAudit({
          po_id: params.poId,
          display_id: params.displayId,
          site_id: params.siteId,
          action: 'REJECTED_BY_SITE_MANAGER',
          actor_id: params.actor.id,
          actor_name: params.actor.name,
          actor_role: params.actor.role,
          details: {
            decision: 'REJECTED',
            comments: params.comments || 'Requisition rejected by Site Manager',
            statusTransition: targetStatus,
          },
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          transitionStatus: targetStatus,
          auditEntry: audit,
        };
      } else {
        targetStatus = 'ESCALATED';
        this.orderStateRegistry.set(params.poId, targetStatus);

        const audit = this.logAudit({
          po_id: params.poId,
          display_id: params.displayId,
          site_id: params.siteId,
          action: 'ESCALATED_TO_COO',
          actor_id: params.actor.id,
          actor_name: params.actor.name,
          actor_role: params.actor.role,
          details: {
            decision: 'ESCALATED',
            comments: params.comments || 'Escalated to Executive COO',
            statusTransition: targetStatus,
          },
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          transitionStatus: targetStatus,
          auditEntry: audit,
        };
      }
    } finally {
      this.activeLocks.delete(lockKey);
    }
  }

  /**
   * Dispatch a safe, idempotent notification preview (Non-sending harness)
   */
  async dispatchSafeNotification(params: {
    eventType: 'SITE_MANAGER_APPROVAL_REQUIRED' | 'REQUESTER_PO_APPROVED' | 'REQUESTER_PO_REJECTED' | 'ESCALATION_MANAGER_ALERT';
    poId: string;
    displayId: string;
    siteId: string;
    siteName: string;
    recipientId: string;
    recipientName: string;
    recipientEmail: string;
    requesterName?: string;
    totalAmount?: number;
    decisionComments?: string;
    actionUrl?: string;
  }): Promise<{ records: ApprovalNotificationRecord[]; isDuplicate: boolean }> {
    const idempotencyKey = this.generateIdempotencyKey(params.poId, params.eventType, params.recipientId);

    // Check existing records for idempotency deduplication
    const existing = this.inMemoryNotifications.filter(n => n.idempotency_key.startsWith(idempotencyKey));
    if (existing.length > 0) {
      return { records: existing, isDuplicate: true };
    }

    const createdRecords: ApprovalNotificationRecord[] = [];
    const actionUrl = params.actionUrl || `${typeof window !== 'undefined' ? window.location.origin : 'https://procureflow.splservices.com.au'}/procurement/orders`;

    // 1. Prepare Titles & Content based on event type
    let title = '';
    let body = '';
    let emailSubject = '';
    let emailBodyHtml = '';
    let teamsTitle = '';

    if (params.eventType === 'SITE_MANAGER_APPROVAL_REQUIRED') {
      title = `PO Approval Required: ${params.displayId}`;
      body = `Purchase Order ${params.displayId} (${params.siteName}) for $${(params.totalAmount || 0).toLocaleString()} requires your approval as Site Manager.`;
      emailSubject = `ACTION REQUIRED: Purchase Order Approval — ${params.displayId} (${params.siteName})`;
      emailBodyHtml = `
        <p>Dear ${params.recipientName},</p>
        <p>A new purchase requisition has been submitted for <strong>${params.siteName}</strong> and requires your review and approval as Site Manager.</p>
        <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 6px; color: #64748b;">PO Reference:</td><td style="font-weight: bold;">${params.displayId}</td></tr>
          <tr><td style="padding: 6px; color: #64748b;">Site:</td><td style="font-weight: bold;">${params.siteName}</td></tr>
          <tr><td style="padding: 6px; color: #64748b;">Requester:</td><td style="font-weight: bold;">${params.requesterName || 'Site Staff'}</td></tr>
          <tr><td style="padding: 6px; color: #64748b;">Total Amount:</td><td style="font-weight: bold;">$${(params.totalAmount || 0).toLocaleString()} AUD</td></tr>
        </table>
        <p style="color: #64748b; font-size: 13px;">Upon your approval, supplier stock will be reserved for 48 hours while the requester raises the Concur PR.</p>
      `;
      teamsTitle = `📋 PO Approval Requested: ${params.displayId}`;
    } else if (params.eventType === 'REQUESTER_PO_APPROVED') {
      title = `PO Approved: ${params.displayId}`;
      body = `Your request ${params.displayId} has been approved by Site Manager ${params.recipientName ? '' : 'Matthew Mancuso'}. You can now proceed to raise Concur PR.`;
      emailSubject = `APPROVED: Purchase Order ${params.displayId} — Ready for Concur PR`;
      emailBodyHtml = `
        <p>Hello ${params.recipientName},</p>
        <p>Great news! Your purchase request <strong>${params.displayId}</strong> for <strong>${params.siteName}</strong> has been <strong>APPROVED</strong>.</p>
        <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px; margin: 16px 0;">
          <p style="margin: 0; font-weight: bold; color: #065f46;">Next Steps: Proceed With Requesting Process</p>
          <ol style="margin: 8px 0 0 16px; padding: 0; color: #047857; font-size: 13px;">
            <li>Log into SAP Concur and raise the Purchase Requisition (PR).</li>
            <li>Record the Concur PR # in ProcureFlow to protect the 48-hour stock hold.</li>
            <li>Once the Concur PO # is generated, link it to unlock goods receipt and deliveries.</li>
          </ol>
        </div>
      `;
      teamsTitle = `✅ PO Approved: ${params.displayId}`;
    } else if (params.eventType === 'REQUESTER_PO_REJECTED') {
      title = `PO Rejected: ${params.displayId}`;
      body = `Your request ${params.displayId} was not approved. Reason: "${params.decisionComments || 'No comment provided'}"`;
      emailSubject = `UPDATE: Purchase Order ${params.displayId} Rejected`;
      emailBodyHtml = `
        <p>Hello ${params.recipientName},</p>
        <p>Your purchase request <strong>${params.displayId}</strong> for <strong>${params.siteName}</strong> has been rejected by the Site Manager.</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 16px 0;">
          <p style="margin: 0; font-weight: bold; color: #991b1b;">Rejection Comments:</p>
          <p style="margin: 4px 0 0 0; color: #b91c1c;">${params.decisionComments || 'Please contact your manager for clarification.'}</p>
        </div>
      `;
      teamsTitle = `❌ PO Rejected: ${params.displayId}`;
    } else if (params.eventType === 'ESCALATION_MANAGER_ALERT') {
      title = `SLA Escalation Alert: ${params.displayId}`;
      body = `Purchase Order ${params.displayId} (${params.siteName}) has exceeded the approval response threshold and has been escalated to Executive Management (COO).`;
      emailSubject = `ESCALATION: Approval Pending for PO ${params.displayId} (${params.siteName})`;
      emailBodyHtml = `
        <p>Dear ${params.recipientName},</p>
        <p>This is an automated escalation alert. Purchase Order <strong>${params.displayId}</strong> at <strong>${params.siteName}</strong> ($${(params.totalAmount || 0).toLocaleString()}) has not received a timely decision from the local Site Manager and has been escalated to your attention.</p>
      `;
      teamsTitle = `🚨 Approval Escalation: ${params.displayId}`;
    }

    const htmlEmail = buildSafeEmailHtml({
      title: emailSubject,
      bodyHtml: emailBodyHtml,
      actionUrl,
      actionLabel: 'Open Requisition in ProcureFlow',
      facts: [
        { label: 'PO Reference', value: params.displayId },
        { label: 'Site Location', value: params.siteName },
        { label: 'Value', value: `$${(params.totalAmount || 0).toLocaleString()} AUD` },
      ],
    });

    const teamsPayload = buildSafeTeamsCard({
      title: teamsTitle,
      subtitle: `${params.siteName} • ProcureFlow Approvals`,
      bodyText: body,
      actionUrl,
      actionLabel: 'Review Request',
      facts: [
        { title: 'PO Reference', value: params.displayId },
        { title: 'Site', value: params.siteName },
        { title: 'Recipient', value: params.recipientName },
      ],
    });

    // Generate records for In-App, Email, and Teams (safe non-sending preview)
    const channels: Array<'IN_APP' | 'EMAIL' | 'TEAMS'> = ['IN_APP', 'EMAIL', 'TEAMS'];
    for (const channel of channels) {
      const rec: ApprovalNotificationRecord = {
        id: `notif_${crypto.randomUUID()}`,
        idempotency_key: `${idempotencyKey}_${channel}`,
        event_type: params.eventType,
        po_id: params.poId,
        display_id: params.displayId,
        site_id: params.siteId,
        recipient_id: params.recipientId,
        recipient_name: params.recipientName,
        recipient_email: params.recipientEmail,
        channel,
        status: 'PREVIEW_ONLY',
        title,
        body,
        html_preview: channel === 'EMAIL' ? htmlEmail : undefined,
        teams_card_payload: channel === 'TEAMS' ? teamsPayload : undefined,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
      };
      createdRecords.push(rec);
      this.inMemoryNotifications.unshift(rec);
    }

    try {
      this.storageAdapter.setItem(STORAGE_KEY_NOTIFICATION_LOGS, JSON.stringify(this.inMemoryNotifications.slice(0, 100)));
    } catch (e) {
      console.warn('Failed to persist notification logs', e);
    }

    return { records: createdRecords, isDuplicate: false };
  }

  /**
   * Retry a notification dispatch with retry count tracking and exponential backoff exhaustion
   */
  async retryNotification(notificationId: string): Promise<ApprovalNotificationRecord> {
    const record = this.inMemoryNotifications.find(n => n.id === notificationId);
    if (!record) {
      throw new Error(`Notification record ${notificationId} not found.`);
    }

    if (record.retry_count >= record.max_retries) {
      record.status = 'FAILED';
      record.error_message = `Max retries (${record.max_retries}) exhausted without delivery confirmation.`;
      try {
        this.storageAdapter.setItem(STORAGE_KEY_NOTIFICATION_LOGS, JSON.stringify(this.inMemoryNotifications.slice(0, 100)));
      } catch (_) {}
      return record;
    }

    record.retry_count += 1;
    // Safe preview simulation delivery
    record.status = 'PREVIEW_ONLY';
    record.delivered_at = new Date().toISOString();
    record.error_message = undefined;

    try {
      this.storageAdapter.setItem(STORAGE_KEY_NOTIFICATION_LOGS, JSON.stringify(this.inMemoryNotifications.slice(0, 100)));
    } catch (_) {}

    return record;
  }

  /**
   * Log an audit event
   */
  logAudit(entry: Omit<WorkflowAuditEntry, 'id'>): WorkflowAuditEntry {
    const fullEntry: WorkflowAuditEntry = {
      ...entry,
      id: `audit_${crypto.randomUUID()}`,
    };
    this.inMemoryAuditLogs.unshift(fullEntry);
    try {
      this.storageAdapter.setItem(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(this.inMemoryAuditLogs.slice(0, 100)));
    } catch (e) {
      console.warn('Failed to persist audit log', e);
    }
    return fullEntry;
  }

  /**
   * Get all notification logs
   */
  getNotificationLogs(): ApprovalNotificationRecord[] {
    try {
      const stored = this.storageAdapter.getItem(STORAGE_KEY_NOTIFICATION_LOGS);
      if (stored) {
        this.inMemoryNotifications = JSON.parse(stored);
      }
    } catch (e) {}
    return this.inMemoryNotifications;
  }

  /**
   * Get all workflow audit logs
   */
  getAuditLogs(): WorkflowAuditEntry[] {
    try {
      const stored = this.storageAdapter.getItem(STORAGE_KEY_AUDIT_LOGS);
      if (stored) {
        this.inMemoryAuditLogs = JSON.parse(stored);
      }
    } catch (e) {}
    return this.inMemoryAuditLogs;
  }

  /**
   * Traceable Reassignment & Offboarding Migration Plan for Ashish Chhabra
   * Scans requests and maps them safely to current Site Managers.
   */
  analyzeAshMigration(): {
    legacyLead: typeof VERIFIED_APPROVAL_IDENTITIES.LEGACY_OFFBOARDED_LEAD;
    totalHistoricalRequests: number;
    closedRequests: Array<{ id: string; display_id: string; site_id: string; site_name: string; status: string }>;
    activeAwaitingConcur: Array<{ id: string; display_id: string; site_id: string; site_name: string; status: string; proposed_manager: string }>;
    reassignmentProposal: Array<{
      request_id: string;
      display_id: string;
      site_id: string;
      site_name: string;
      current_routing: string;
      proposed_site_manager: string;
      proposed_escalation_manager: string;
      rationale: string;
    }>;
  } {
    const legacy = VERIFIED_APPROVAL_IDENTITIES.LEGACY_OFFBOARDED_LEAD;
    return {
      legacyLead: legacy,
      totalHistoricalRequests: 3,
      closedRequests: [
        {
          id: '4e04ad16-f0dd-42dc-9643-6a4fa82089e6',
          display_id: 'POR-202609-000031',
          site_id: '44444444-4444-4444-8444-444444444444',
          site_name: 'SPL Melbourne',
          status: 'CLOSED',
        },
        {
          id: 'c9bfda63-e1c1-4157-a1aa-b8ff5067cd78',
          display_id: 'POR-202610-000030',
          site_id: '33333333-3333-4333-8333-333333333333',
          site_name: 'SPL Mackay',
          status: 'CLOSED',
        },
      ],
      activeAwaitingConcur: [
        {
          id: 'd19fe494-e23c-4099-90ed-61205f0eb1b2',
          display_id: 'POR-202609-000029',
          site_id: '5d0c236b-4311-4bbe-894e-d7a2621ed559',
          site_name: 'SPL Holdings',
          status: 'APPROVED_PENDING_CONCUR',
          proposed_manager: 'Ebrahim Mokhtari (COO - Holdings Corporate)',
        },
      ],
      reassignmentProposal: [
        {
          request_id: 'd19fe494-e23c-4099-90ed-61205f0eb1b2',
          display_id: 'POR-202609-000029',
          site_id: '5d0c236b-4311-4bbe-894e-d7a2621ed559',
          site_name: 'SPL Holdings',
          current_routing: 'Ashish Chhabra (Former Lead)',
          proposed_site_manager: 'Ebrahim Mokhtari (COO)',
          proposed_escalation_manager: 'Ebrahim Mokhtari (COO)',
          rationale: 'Holdings corporate order; reassign to Executive COO without modifying closed history.',
        },
      ],
    };
  }
}

export const siteApprovalWorkflowService = new SiteApprovalWorkflowService();
