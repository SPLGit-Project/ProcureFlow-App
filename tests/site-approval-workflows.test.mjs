import test from 'node:test';
import assert from 'node:assert/strict';
import {
  siteApprovalWorkflowService,
  SiteApprovalWorkflowService,
  VERIFIED_APPROVAL_IDENTITIES
} from '../services/siteApprovalWorkflowService.ts';
import { ROLE_PRESETS } from '../constants/rolePresets.ts';

test('1. Identity Verification: Maps Matthew Mancuso and Eb to verified Entra IDs', () => {
  const matthew = VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER;
  assert.equal(matthew.email, 'matthew.mancuso@splservices.com.au');
  assert.equal(matthew.entra_oid, '460a44d0-5237-4e59-aad3-93619d6d50cd');
  assert.equal(matthew.site_id, '44444444-4444-4444-8444-444444444444');

  const eb = VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO;
  assert.equal(eb.email, 'ebrahim.mokhtari@splservices.com.au');
  assert.equal(eb.entra_oid, '9e97d720-3bf0-4451-b739-9fd87d27686c');
  assert.equal(eb.name, 'Ebrahim Mokhtari');
});

test('2. Per-Site Assignment: Melbourne defaults to Matthew Mancuso and Eb', async () => {
  const melbSiteId = '44444444-4444-4444-8444-444444444444';
  const workflow = await siteApprovalWorkflowService.getWorkflowForSite(melbSiteId);

  assert.ok(workflow, 'Melbourne workflow should exist');
  assert.equal(workflow.site_name, 'SPL Melbourne');
  assert.equal(workflow.approval_manager_name, 'Matthew Mancuso');
  assert.equal(workflow.approval_manager_email, 'matthew.mancuso@splservices.com.au');
  assert.equal(workflow.escalation_manager_name, 'Ebrahim Mokhtari');
  assert.equal(workflow.escalation_manager_email, 'ebrahim.mokhtari@splservices.com.au');
  assert.equal(workflow.is_active, true);
});

test('3. Escalation SLA Check: 72-Hour Auto Escalation with Manual Toggle & Role Guard', async () => {
  const melbSiteId = '44444444-4444-4444-8444-444444444444';
  const workflow = await siteApprovalWorkflowService.getWorkflowForSite(melbSiteId);

  assert.ok(workflow);
  // Verified Auto 72-Hour SLA
  assert.equal(workflow.escalation_mode, 'AUTO');
  assert.equal(workflow.escalation_sla_hours, 72);
  assert.equal(workflow.sla_status, 'ACTIVE_AUTO');
  assert.ok(workflow.notes.includes('Auto escalation set to 72 hours') || workflow.notes.includes('Matthew Mancuso & COO Eb'));

  // Role checks for toggling escalation mode
  const canAdminToggle = siteApprovalWorkflowService.canActorToggleEscalationMode({ id: 'admin1', role: 'ADMIN' });
  assert.equal(canAdminToggle, true, 'Admin can toggle escalation mode');

  const canManagerWithPermToggle = siteApprovalWorkflowService.canActorToggleEscalationMode({
    id: 'user1',
    role: 'SITE_MANAGER',
    permissions: ['manage_workflows'],
  });
  assert.equal(canManagerWithPermToggle, true, 'User with manage_workflows can toggle mode');

  const canStandardUserToggle = siteApprovalWorkflowService.canActorToggleEscalationMode({
    id: 'user2',
    role: 'SITE_USER',
    permissions: ['create_request'],
  });
  assert.equal(canStandardUserToggle, false, 'Standard user cannot toggle escalation mode');
});

test('3b. Other Facility Approver Assignments: All 11 SPL Facilities Seeded Across Australia', async () => {
  const allWorkflows = await siteApprovalWorkflowService.getSiteWorkflows();
  assert.equal(allWorkflows.length, 11, 'All 11 SPL facilities must be configured');

  const sites = [
    { name: 'SPL Melbourne', mgr: 'Matthew Mancuso' },
    { name: 'SPL Adelaide', mgr: 'Paul Phillips' },
    { name: 'SPL Brisbane', mgr: 'Lisa Wilson' },
    { name: 'SPL Cairns', mgr: 'Jason Waight' },
    { name: 'SPL Classic Linen', mgr: 'David You' },
    { name: 'SPL Sydney', mgr: 'David You' },
    { name: 'SPL Holdings', mgr: 'Hamoun Adelinik' },
    { name: 'SPL Mackay', mgr: 'Bronwen Glover' },
    { name: 'SPL Perth: Belmont', mgr: 'Rob Callaghan' },
    { name: 'SPL Perth: Maddington', mgr: 'Rob Callaghan' },
    { name: 'SPL Albury', mgr: 'Teegan Paterson' },
  ];

  for (const s of sites) {
    const found = allWorkflows.find(w => w.site_name === s.name);
    assert.ok(found, `Facility ${s.name} must exist`);
    assert.equal(found.approval_manager_name, s.mgr, `Facility ${s.name} manager must match ${s.mgr}`);
    assert.equal(found.escalation_manager_name, 'Ebrahim Mokhtari', `Facility ${s.name} escalation must be Eb`);
    assert.equal(found.escalation_mode, 'AUTO');
    assert.equal(found.escalation_sla_hours, 72);
  }
});

test('4. Idempotent Notifications & Safe Preview Deduplication', async () => {
  const params = {
    eventType: 'SITE_MANAGER_APPROVAL_REQUIRED',
    poId: 'test-po-melb-001',
    displayId: 'POR-MELB-001',
    siteId: '44444444-4444-4444-8444-444444444444',
    siteName: 'SPL Melbourne',
    recipientId: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.id,
    recipientName: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.name,
    recipientEmail: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.email,
    requesterName: 'Julie Nguyen',
    totalAmount: 4500,
  };

  // First dispatch: should create 3 channels (IN_APP, EMAIL, TEAMS)
  const result1 = await siteApprovalWorkflowService.dispatchSafeNotification(params);
  assert.equal(result1.isDuplicate, false);
  assert.equal(result1.records.length, 3);
  assert.ok(result1.records.some(r => r.channel === 'IN_APP'));
  assert.ok(result1.records.some(r => r.channel === 'EMAIL' && r.html_preview?.includes('ProcureFlow')));
  assert.ok(result1.records.some(r => r.channel === 'TEAMS' && r.teams_card_payload));

  // Second immediate dispatch with identical key: should be detected as duplicate
  const result2 = await siteApprovalWorkflowService.dispatchSafeNotification(params);
  assert.equal(result2.isDuplicate, true);
  assert.equal(result2.records.length, 3);
});

test('5. Approval Workflow State Transitions: Approve, Notify Requester & Stock Reservation Hold', async () => {
  const poId = 'test-po-melb-002';
  const displayId = 'POR-MELB-002';

  // 1. Site Manager Approves
  const audit = siteApprovalWorkflowService.logAudit({
    po_id: poId,
    display_id: displayId,
    site_id: '44444444-4444-4444-8444-444444444444',
    action: 'APPROVED_BY_SITE_MANAGER',
    actor_id: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.id,
    actor_name: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.name,
    actor_role: 'SITE_MANAGER',
    details: {
      decision: 'APPROVED',
      comments: 'Approved for Melbourne laundry production requirements.',
      reservationExpiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    },
    timestamp: new Date().toISOString(),
  });

  assert.equal(audit.action, 'APPROVED_BY_SITE_MANAGER');
  assert.equal(audit.actor_name, 'Matthew Mancuso');

  // 2. Requester receives notification
  const reqNotif = await siteApprovalWorkflowService.dispatchSafeNotification({
    eventType: 'REQUESTER_PO_APPROVED',
    poId,
    displayId,
    siteId: '44444444-4444-4444-8444-444444444444',
    siteName: 'SPL Melbourne',
    recipientId: 'requester-julie-01',
    recipientName: 'Julie Nguyen',
    recipientEmail: 'julie.nguyen@splservices.com.au',
    totalAmount: 3200,
  });

  assert.equal(reqNotif.isDuplicate, false);
  const emailRecord = reqNotif.records.find(r => r.channel === 'EMAIL');
  assert.ok(emailRecord?.html_preview?.includes('SAP Concur'));
  assert.ok(emailRecord?.html_preview?.includes('48-hour stock hold'));
});

test('6. Rejection Workflow State Transitions: Reject & Notify Requester with Reason', async () => {
  const poId = 'test-po-melb-003';
  const displayId = 'POR-MELB-003';

  const audit = siteApprovalWorkflowService.logAudit({
    po_id: poId,
    display_id: displayId,
    site_id: '44444444-4444-4444-8444-444444444444',
    action: 'REJECTED_BY_SITE_MANAGER',
    actor_id: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.id,
    actor_name: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.name,
    actor_role: 'SITE_MANAGER',
    details: {
      decision: 'REJECTED',
      comments: 'Incorrect carton count. Please re-check SOH and resubmit.',
    },
    timestamp: new Date().toISOString(),
  });

  assert.equal(audit.action, 'REJECTED_BY_SITE_MANAGER');

  const rejNotif = await siteApprovalWorkflowService.dispatchSafeNotification({
    eventType: 'REQUESTER_PO_REJECTED',
    poId,
    displayId,
    siteId: '44444444-4444-4444-8444-444444444444',
    siteName: 'SPL Melbourne',
    recipientId: 'requester-julie-01',
    recipientName: 'Julie Nguyen',
    recipientEmail: 'julie.nguyen@splservices.com.au',
    decisionComments: 'Incorrect carton count. Please re-check SOH and resubmit.',
  });

  assert.equal(rejNotif.isDuplicate, false);
  const emailRecord = rejNotif.records.find(r => r.channel === 'EMAIL');
  assert.ok(emailRecord?.html_preview?.includes('Incorrect carton count'));
});

test('7. Escalation Workflow: Escalates to Eb with audit entry', async () => {
  const poId = 'test-po-melb-004';
  const displayId = 'POR-MELB-004';

  const audit = siteApprovalWorkflowService.logAudit({
    po_id: poId,
    display_id: displayId,
    site_id: '44444444-4444-4444-8444-444444444444',
    action: 'ESCALATED_TO_COO',
    actor_id: 'SYSTEM_SCHEDULER',
    actor_name: 'Workflow Engine',
    actor_role: 'SYSTEM',
    details: {
      reason: 'SLA response deadline elapsed without Site Manager sign-off.',
      escalated_to: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.name,
      escalated_to_email: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.email,
    },
    timestamp: new Date().toISOString(),
  });

  assert.equal(audit.action, 'ESCALATED_TO_COO');
  assert.equal(audit.details.escalated_to, 'Ebrahim Mokhtari');

  const escNotif = await siteApprovalWorkflowService.dispatchSafeNotification({
    eventType: 'ESCALATION_MANAGER_ALERT',
    poId,
    displayId,
    siteId: '44444444-4444-4444-8444-444444444444',
    siteName: 'SPL Melbourne',
    recipientId: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.id,
    recipientName: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.name,
    recipientEmail: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.email,
    totalAmount: 12500,
  });

  assert.equal(escNotif.isDuplicate, false);
  assert.ok(escNotif.records.some(r => r.recipient_email === 'ebrahim.mokhtari@splservices.com.au'));
});

test('8. Normal Continuation Flow: Concur PR Linked -> Concur PO Linked -> Deliveries Unlocked', () => {
  const poId = 'test-po-melb-005';
  const displayId = 'POR-MELB-005';

  // Step 1: Requester records Concur PR
  const auditPR = siteApprovalWorkflowService.logAudit({
    po_id: poId,
    display_id: displayId,
    site_id: '44444444-4444-4444-8444-444444444444',
    action: 'CONCUR_PR_RECORDED',
    actor_id: 'requester-julie-01',
    actor_name: 'Julie Nguyen',
    actor_role: 'SITE_USER',
    details: {
      concur_request_number: 'PR-9848',
      reservationProtected: true,
      newStatus: 'APPROVED_PENDING_CONCUR',
    },
    timestamp: new Date().toISOString(),
  });
  assert.equal(auditPR.action, 'CONCUR_PR_RECORDED');
  assert.equal(auditPR.details.concur_request_number, 'PR-9848');

  // Step 2: Concur PO issued and linked -> Unlocks deliveries
  const auditPO = siteApprovalWorkflowService.logAudit({
    po_id: poId,
    display_id: displayId,
    site_id: '44444444-4444-4444-8444-444444444444',
    action: 'CONCUR_PO_LINKED',
    actor_id: 'requester-julie-01',
    actor_name: 'Julie Nguyen',
    actor_role: 'SITE_USER',
    details: {
      concur_po_number: 'PO-2026-9848',
      deliveriesUnlocked: true,
      newStatus: 'ACTIVE',
    },
    timestamp: new Date().toISOString(),
  });
  assert.equal(auditPO.action, 'CONCUR_PO_LINKED');
  assert.equal(auditPO.details.deliveriesUnlocked, true);
});

test('9. Ashish Chhabra Offboarding & Traceable Migration Plan', () => {
  const analysis = siteApprovalWorkflowService.analyzeAshMigration();
  assert.equal(analysis.legacyLead.name, 'Ashish Chhabra');
  assert.equal(analysis.totalHistoricalRequests, 3);
  // Ensure closed requests are preserved and untouched
  assert.equal(analysis.closedRequests.length, 2);
  assert.ok(analysis.closedRequests.every(r => r.status === 'CLOSED'));

  // Ensure active requests have clear proposed reassignment
  assert.equal(analysis.activeAwaitingConcur.length, 1);
  assert.equal(analysis.activeAwaitingConcur[0].display_id, 'POR-202609-000029');
  assert.equal(analysis.reassignmentProposal.length, 1);
  assert.ok(analysis.reassignmentProposal[0].proposed_site_manager.includes('Ebrahim Mokhtari'));
});

test('10. Persistence Across Reload/Restart: Saved configuration reloads identically', async () => {
  const persistentStore = new Map();
  const mockStorageAdapter = {
    getItem: (k) => persistentStore.get(k) || null,
    setItem: (k, v) => persistentStore.set(k, v),
    removeItem: (k) => persistentStore.delete(k),
  };

  // Instance 1: Saves a new workflow for Sydney
  const serviceInstance1 = new SiteApprovalWorkflowService(mockStorageAdapter);
  const sydneySiteId = '11111111-1111-4111-8111-111111111111';
  await serviceInstance1.saveSiteWorkflow({
    site_id: sydneySiteId,
    site_name: 'SPL Sydney',
    approval_manager_id: 'mgr_syd_01',
    approval_manager_name: 'Robert Vance',
    approval_manager_email: 'robert.vance@splservices.com.au',
    escalation_manager_id: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.id,
    escalation_manager_name: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.name,
    escalation_manager_email: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.email,
    escalation_sla_hours: 24,
    sla_status: 'DECISION_PENDING',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, 'Test Admin');

  // Instance 2 (Simulating page reload / browser restart): Must load from same storage adapter
  const serviceInstance2 = new SiteApprovalWorkflowService(mockStorageAdapter);
  const reloadedSyd = await serviceInstance2.getWorkflowForSite(sydneySiteId);

  assert.ok(reloadedSyd, 'Sydney workflow must persist across reload/restart');
  assert.equal(reloadedSyd.approval_manager_name, 'Robert Vance');
  assert.equal(reloadedSyd.approval_manager_email, 'robert.vance@splservices.com.au');
  assert.equal(reloadedSyd.escalation_manager_name, 'Ebrahim Mokhtari');
});

test('11. Role Authorization Enforcement: Rejects unauthorized actors from site approval', async () => {
  const melbSiteId = '44444444-4444-4444-8444-444444444444';
  const poId = 'test-po-auth-01';

  // 1. Authorized Site Approval Manager (Matthew Mancuso)
  const isAuthorizedManager = siteApprovalWorkflowService.canActorApproveForSite(melbSiteId, {
    id: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.id,
    role: 'SITE_USER',
  });
  assert.equal(isAuthorizedManager, true, 'Designated site manager must have approval authority');

  // 2. Authorized Escalation Manager (Eb / COO)
  const isAuthorizedEscalation = siteApprovalWorkflowService.canActorApproveForSite(melbSiteId, {
    id: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.id,
    role: 'ADMIN',
  });
  assert.equal(isAuthorizedEscalation, true, 'COO must have escalation approval authority');

  // 3. Unauthorized Actor (User from different site / unauthorized role)
  const isUnauthorized = siteApprovalWorkflowService.canActorApproveForSite(melbSiteId, {
    id: 'unauthorized_stranger_user',
    role: 'SITE_USER',
  });
  assert.equal(isUnauthorized, false, 'Unauthorized actor must NOT have approval authority');

  // 4. Execution attempt by unauthorized actor throws UNAUTHORIZED_ACTOR error
  await assert.rejects(
    async () => {
      await siteApprovalWorkflowService.executeSiteApprovalTransition({
        siteId: melbSiteId,
        poId,
        displayId: 'POR-AUTH-01',
        decision: 'APPROVED',
        actor: {
          id: 'unauthorized_stranger_user',
          name: 'Intruder User',
          role: 'SITE_USER',
        },
      });
    },
    /UNAUTHORIZED_ACTOR/,
    'Unauthorized actor execution must be rejected with UNAUTHORIZED_ACTOR exception'
  );
});

test('12. Concurrent / Double-Approval Protection: Rejects duplicate approvals', async () => {
  const melbSiteId = '44444444-4444-4444-8444-444444444444';
  const poId = 'test-po-concurrent-01';

  // First approval: succeeds cleanly
  const firstApproval = await siteApprovalWorkflowService.executeSiteApprovalTransition({
    siteId: melbSiteId,
    poId,
    displayId: 'POR-CONC-01',
    decision: 'APPROVED',
    actor: {
      id: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.id,
      name: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.name,
      role: 'SITE_MANAGER',
    },
  });
  assert.equal(firstApproval.success, true);
  assert.equal(firstApproval.transitionStatus, 'APPROVED_PENDING_CONCUR_REQUEST');

  // Second rapid approval on the same PO: must be rejected with DUPLICATE_APPROVAL_ATTEMPT
  await assert.rejects(
    async () => {
      await siteApprovalWorkflowService.executeSiteApprovalTransition({
        siteId: melbSiteId,
        poId,
        displayId: 'POR-CONC-01',
        decision: 'APPROVED',
        actor: {
          id: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.id,
          name: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.name,
          role: 'SITE_MANAGER',
        },
      });
    },
    /DUPLICATE_APPROVAL_ATTEMPT/,
    'Subsequent approval attempt on already approved PO must be rejected'
  );
});

test('13. Traceable Facility Reassignment: Reassigns site authority with full audit trail', async () => {
  const mackaySiteId = '33333333-3333-4333-8333-333333333333';

  // Seed Mackay workflow
  await siteApprovalWorkflowService.saveSiteWorkflow({
    site_id: mackaySiteId,
    site_name: 'SPL Mackay',
    approval_manager_id: 'mgr_old_mackay',
    approval_manager_name: 'Old Mackay Lead',
    approval_manager_email: 'old.mackay@splservices.com.au',
    escalation_manager_id: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.id,
    escalation_manager_name: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.name,
    escalation_manager_email: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.email,
    escalation_sla_hours: 24,
    sla_status: 'DECISION_PENDING',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Reassign to new manager
  const updated = await siteApprovalWorkflowService.reassignSiteWorkflow({
    siteId: mackaySiteId,
    newManager: {
      id: 'mgr_new_sarah',
      name: 'Sarah Connor',
      email: 'sarah.connor@splservices.com.au',
    },
    actor: {
      id: 'admin_sys',
      name: 'Operations Director',
      role: 'ADMIN',
    },
    rationale: 'Personnel reallocation to new facility manager',
  });

  assert.equal(updated.approval_manager_name, 'Sarah Connor');
  assert.equal(updated.approval_manager_email, 'sarah.connor@splservices.com.au');

  // Verify audit log has complete record
  const auditLogs = siteApprovalWorkflowService.getAuditLogs();
  const reassignAudit = auditLogs.find(a => a.action === 'REASSIGNED_SITE_MANAGER' && a.site_id === mackaySiteId);
  assert.ok(reassignAudit, 'Reassignment audit entry must exist');
  assert.equal(reassignAudit.details.previous_manager.name, 'Old Mackay Lead');
  assert.equal(reassignAudit.details.new_manager.name, 'Sarah Connor');
  assert.equal(reassignAudit.details.rationale, 'Personnel reallocation to new facility manager');
});

test('14. Notification Retries & Failure Recovery: Tracks retries and exhausts at limit', async () => {
  const params = {
    eventType: 'SITE_MANAGER_APPROVAL_REQUIRED',
    poId: 'test-po-retry-01',
    displayId: 'POR-RETRY-01',
    siteId: '44444444-4444-4444-8444-444444444444',
    siteName: 'SPL Melbourne',
    recipientId: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.id,
    recipientName: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.name,
    recipientEmail: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.email,
  };

  const dispatch = await siteApprovalWorkflowService.dispatchSafeNotification(params);
  const targetRecord = dispatch.records[0];

  assert.equal(targetRecord.retry_count, 0);
  assert.equal(targetRecord.max_retries, 3);

  // Retry 1
  const r1 = await siteApprovalWorkflowService.retryNotification(targetRecord.id);
  assert.equal(r1.retry_count, 1);
  assert.equal(r1.status, 'PREVIEW_ONLY');

  // Retry 2
  const r2 = await siteApprovalWorkflowService.retryNotification(targetRecord.id);
  assert.equal(r2.retry_count, 2);

  // Retry 3
  const r3 = await siteApprovalWorkflowService.retryNotification(targetRecord.id);
  assert.equal(r3.retry_count, 3);

  // Retry 4 (Exceeds max_retries = 3): Must transition status to FAILED with error message
  const r4 = await siteApprovalWorkflowService.retryNotification(targetRecord.id);
  assert.equal(r4.status, 'FAILED');
  assert.ok(r4.error_message?.includes('Max retries (3) exhausted'));
});

test('15. Site Manager Role Definition & Scope Governance: Full access to manage, monitor and approve site requests', () => {
  const siteManagerPreset = ROLE_PRESETS.find(p => p.id === 'PRESET_SITE_MANAGER');
  assert.ok(siteManagerPreset, 'PRESET_SITE_MANAGER preset must exist');
  assert.equal(siteManagerPreset.name, 'Site Manager');
  assert.equal(siteManagerPreset.badge, 'Management');
  assert.equal(siteManagerPreset.siteScopeMode, 'ASSIGNED', 'Site Manager must be scoped to ASSIGNED sites only');
  assert.equal(siteManagerPreset.enforceSod, true, 'Segregation of duties must be enforced (no self-approval)');

  // Monitoring permissions
  const expectedMonitoring = [
    'view_dashboard',
    'view_active_requests',
    'view_completed_requests',
    'view_items',
    'view_stock',
    'view_purchase_pricing',
    'view_suppliers',
    'view_sites',
    'view_reports',
    'view_finance',
    'view_audit_logs',
    'view_workflow',
    'view_notifications',
    'export_orders',
    'export_reports',
  ];
  for (const perm of expectedMonitoring) {
    assert.ok(siteManagerPreset.permissions.includes(perm), `Site Manager must have monitoring permission: ${perm}`);
  }

  // Managing site requests permissions
  const expectedManaging = [
    'create_request',
    'receive_goods',
    'edit_po_lines',
    'cancel_po',
    'delete_requests',
    'link_concur',
    'manage_item_requests',
  ];
  for (const perm of expectedManaging) {
    assert.ok(siteManagerPreset.permissions.includes(perm), `Site Manager must have managing permission: ${perm}`);
  }

  // Approval authority
  assert.ok(siteManagerPreset.permissions.includes('approve_requests'), 'Site Manager must have approve_requests');

  // Governance boundaries: must NOT have admin bypass or settings permissions
  assert.equal(siteManagerPreset.permissions.includes('manage_settings'), false);
  assert.equal(siteManagerPreset.permissions.includes('manage_roles'), false);
  assert.equal(siteManagerPreset.permissions.includes('manage_users'), false);
  assert.equal(siteManagerPreset.permissions.includes('override_sod'), false, 'Site Manager must not have override_sod');
  assert.equal(siteManagerPreset.permissions.includes('view_all_requests'), false, 'Site Manager must not have view_all_requests (scoped to assigned site)');
});
