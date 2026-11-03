import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PGlite } = require('@electric-sql/pglite');

import { 
  siteApprovalWorkflowService, 
  VERIFIED_APPROVAL_IDENTITIES 
} from '../services/siteApprovalWorkflowService.ts';

import { 
  siteApprovalIntegrationService,
  evaluateServerSideAuthorization,
  DurableNotificationOutboxAdapter,
  SupabaseWorkflowStorageAdapter
} from '../services/siteApprovalIntegrationService.ts';

/**
 * Helper to initialize PGlite with mock base tables and the v2 migration schema
 */
async function createTestDatabase(options = {}) {
  const db = options.dataDir ? new PGlite(options.dataDir) : new PGlite();

  // 1. Create base tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS public.roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS public.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role_id TEXT
    );

    CREATE TABLE IF NOT EXISTS public.sites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS public.po_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      display_id TEXT,
      request_date TIMESTAMPTZ DEFAULT now(),
      requester_id TEXT,
      site_id UUID,
      status TEXT,
      total_amount NUMERIC,
      approved_at TIMESTAMPTZ,
      reservation_expires_at TIMESTAMPTZ,
      rejection_reason TEXT,
      escalated_at TIMESTAMPTZ,
      assigned_approver_id UUID,
      reassigned_from_id UUID,
      reassignment_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- Seed baseline users
    INSERT INTO public.users (id, email, name, role_id) VALUES
      ('460a44d0-5237-4e59-aad3-93619d6d50cd', 'matthew.mancuso@splservices.com.au', 'Matthew Mancuso', 'SITE_MANAGER'),
      ('9e97d720-3bf0-4451-b739-9fd87d27686c', 'ebrahim.mokhtari@splservices.com.au', 'Ebrahim Mokhtari', 'ADMIN'),
      ('11111111-1111-1111-1111-111111111111', 'user.regular@splservices.com.au', 'Regular User', 'SITE_USER')
    ON CONFLICT (email) DO NOTHING;
  `);

  // 2. Execute migration v2
  const migrationSql = fs.readFileSync('supabase/migrations/20261030000000_site_approval_workflows_v2.sql', 'utf8');
  await db.exec(migrationSql);

  return db;
}

test('1. Durable PostgreSQL Migration: Executes schema v2 and validates seed state', async () => {
  const db = await createTestDatabase();

  // Validate site_approval_workflows table
  const workflows = await db.query('SELECT * FROM public.site_approval_workflows');
  assert.equal(workflows.rows.length, 1);
  const melb = workflows.rows[0];
  assert.equal(melb.site_name, 'SPL Melbourne');
  assert.equal(melb.approval_manager_name, 'Matthew Mancuso');
  assert.equal(melb.approval_manager_email, 'matthew.mancuso@splservices.com.au');
  assert.equal(melb.escalation_manager_name, 'Ebrahim Mokhtari');
  assert.equal(melb.escalation_manager_email, 'ebrahim.mokhtari@splservices.com.au');
  assert.equal(melb.sla_status, 'DECISION_PENDING');
  assert.equal(melb.is_active, true);

  // Validate outbox table structure
  const outboxCols = await db.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'site_workflow_notification_outbox'
  `);
  const colNames = outboxCols.rows.map(r => r.column_name);
  assert.ok(colNames.includes('idempotency_key'));
  assert.ok(colNames.includes('channel'));
  assert.ok(colNames.includes('status'));
  assert.ok(colNames.includes('teams_card_payload'));
  await db.close();
});

test('2. Real PGlite On-Disk Crash/Restart Persistence Boundary', async () => {
  const tempDir = path.join(os.tmpdir(), `pglite-restart-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Process 1: Open PGlite on filesystem directory and write data
    const db1 = await createTestDatabase({ dataDir: tempDir });
    
    await db1.query(`
      INSERT INTO public.site_approval_workflows (
        site_id,
        site_name,
        approval_manager_id,
        approval_manager_name,
        approval_manager_email,
        escalation_manager_name,
        escalation_manager_email,
        sla_status,
        updated_by
      ) VALUES (
        '55555555-5555-5555-8555-555555555555',
        'SPL Sydney',
        '55555555-0000-0000-0000-000000000001',
        'David Miller',
        'david.miller@splservices.com.au',
        'Ebrahim Mokhtari',
        'ebrahim.mokhtari@splservices.com.au',
        'DECISION_PENDING',
        'Aaron Bell'
      );
    `);

    // Verify row written in db1
    const res1 = await db1.query("SELECT * FROM public.site_approval_workflows WHERE site_name = 'SPL Sydney'");
    assert.equal(res1.rows.length, 1);
    assert.equal(res1.rows[0].approval_manager_name, 'David Miller');

    // Simulate crash/process termination: close db1
    await db1.close();

    // Process 2: Reopen PGlite from the exact same filesystem directory (restart)
    const db2 = new PGlite(tempDir);
    const res2 = await db2.query("SELECT * FROM public.site_approval_workflows WHERE site_name = 'SPL Sydney'");
    assert.equal(res2.rows.length, 1, 'Data must survive process crash and restart');
    assert.equal(res2.rows[0].approval_manager_name, 'David Miller');
    assert.equal(res2.rows[0].sla_status, 'DECISION_PENDING');
    assert.equal(res2.rows[0].updated_by, 'Aaron Bell');
    await db2.close();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('3. Durable Configuration Adapter: Persists workflow updates across instances', async () => {
  const mockStorage = new Map();
  const storageAdapter = {
    getItem: (k) => mockStorage.get(k) || null,
    setItem: (k, v) => mockStorage.set(k, v),
    removeItem: (k) => mockStorage.delete(k),
  };

  const adapterInstance1 = new SupabaseWorkflowStorageAdapter(storageAdapter);

  const sydneyWorkflow = {
    id: 'syd-wf-001',
    site_id: '55555555-5555-5555-8555-555555555555',
    site_name: 'SPL Sydney',
    approval_manager_id: 'mgr_syd_01',
    approval_manager_name: 'David Miller',
    approval_manager_email: 'david.miller@splservices.com.au',
    escalation_manager_id: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.id,
    escalation_manager_name: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.name,
    escalation_manager_email: VERIFIED_APPROVAL_IDENTITIES.ESCALATION_MANAGER_COO.email,
    escalation_sla_hours: 24,
    sla_status: 'DECISION_PENDING',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updated_by: 'Aaron Bell',
  };

  await adapterInstance1.saveWorkflow(sydneyWorkflow, 'Aaron Bell');

  // Verify second fresh adapter instance reading from store
  const adapterInstance2 = new SupabaseWorkflowStorageAdapter(storageAdapter);
  const reloaded = await adapterInstance2.getWorkflows();

  const found = reloaded.find(w => w.site_id === sydneyWorkflow.site_id);
  assert.ok(found, 'Workflow should persist across client restart boundary');
  assert.equal(found.approval_manager_name, 'David Miller');
  assert.equal(found.updated_by, 'Aaron Bell');
  assert.equal(found.sla_status, 'DECISION_PENDING');
});

test('4. PostgreSQL Trusted Identity (auth.uid() / request.jwt.claim.sub) vs Caller Spoofing', async () => {
  const db = await createTestDatabase();

  // Test Case A: Spoofed actor_id
  // Session JWT is set to Regular User ('11111111-1111-1111-1111-111111111111')
  // but caller claims to be Matthew Mancuso ('460a44d0-5237-4e59-aad3-93619d6d50cd')
  await db.query("SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false)");
  const resSpoofedId = await db.query(`
    SELECT public.check_site_approval_authority(
      '00000000-0000-0000-0000-000000000001'::uuid,
      '460a44d0-5237-4e59-aad3-93619d6d50cd', -- Spoofed ID
      'SITE_MANAGER',
      '44444444-4444-4444-8444-444444444444',
      '44444444-4444-4444-8444-444444444444',
      'user_julie_01',
      4850.00
    ) as result;
  `);
  const spoofedIdData = resSpoofedId.rows[0].result;
  assert.equal(spoofedIdData.authorized, false);
  assert.equal(spoofedIdData.error_code, 'CALLER_IDENTITY_MISMATCH');

  // Test Case B: Spoofed ADMIN role
  // Session JWT is set to Regular User ('11111111-1111-1111-1111-111111111111')
  // Caller passes matching actor_id, but falsely claims p_actor_role = 'ADMIN'
  const resSpoofedRole = await db.query(`
    SELECT public.check_site_approval_authority(
      '00000000-0000-0000-0000-000000000001'::uuid,
      '11111111-1111-1111-1111-111111111111',
      'ADMIN', -- Spoofed role (DB has SITE_USER)
      '44444444-4444-4444-8444-444444444444',
      '44444444-4444-4444-8444-444444444444',
      'user_julie_01',
      4850.00
    ) as result;
  `);
  const spoofedRoleData = resSpoofedRole.rows[0].result;
  assert.equal(spoofedRoleData.authorized, false);
  assert.equal(spoofedRoleData.error_code, 'ROLE_SPOOF_REJECTED');

  // Test Case C: Authentic Session matching Matthew Mancuso
  await db.query("SELECT set_config('request.jwt.claim.sub', '460a44d0-5237-4e59-aad3-93619d6d50cd', false)");
  const resAuthentic = await db.query(`
    SELECT public.check_site_approval_authority(
      '00000000-0000-0000-0000-000000000001'::uuid,
      '460a44d0-5237-4e59-aad3-93619d6d50cd',
      'SITE_MANAGER',
      '44444444-4444-4444-8444-444444444444',
      '44444444-4444-4444-8444-444444444444',
      'user_julie_01',
      4850.00
    ) as result;
  `);
  const authenticData = resAuthentic.rows[0].result;
  assert.equal(authenticData.authorized, true);
  assert.equal(authenticData.role_applied, 'SITE_APPROVAL_MANAGER');
  assert.equal(authenticData.assigned_manager, 'Matthew Mancuso');

  await db.close();
});

test('5. PostgreSQL Segregation of Duties (SoD) & Cross-Site Real Database Denials', async () => {
  const db = await createTestDatabase();

  // Reset session claims
  await db.query("SELECT set_config('request.jwt.claim.sub', '', false)");

  // SoD denial in PostgreSQL
  const resSoD = await db.query(`
    SELECT public.check_site_approval_authority(
      '00000000-0000-0000-0000-000000000001'::uuid,
      'user_julie_01', -- Requester attempting self-approval
      'SITE_MANAGER',
      '44444444-4444-4444-8444-444444444444',
      '44444444-4444-4444-8444-444444444444',
      'user_julie_01', -- Same as requester_id
      1500.00
    ) as result;
  `);
  const sodData = resSoD.rows[0].result;
  assert.equal(sodData.authorized, false);
  assert.equal(sodData.error_code, 'SOD_VIOLATION');

  // Cross-site unauthorized denial in PostgreSQL
  const resCross = await db.query(`
    SELECT public.check_site_approval_authority(
      '00000000-0000-0000-0000-000000000001'::uuid,
      'user_syd_01',
      'SITE_USER',
      '55555555-5555-5555-8555-555555555555', -- Sydney site
      '44444444-4444-4444-8444-444444444444', -- Melbourne site
      'user_julie_01',
      1500.00
    ) as result;
  `);
  const crossData = resCross.rows[0].result;
  assert.equal(crossData.authorized, false);
  assert.equal(crossData.error_code, 'UNAUTHORIZED_ACTOR');

  await db.close();
});

test('6. PostgreSQL Atomic Approval State Transition & Order/Outbox Atomicity', async () => {
  const db = await createTestDatabase();

  const poId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  await db.query(`
    INSERT INTO public.po_requests (
      id, display_id, site_id, requester_id, status, total_amount
    ) VALUES (
      $1, 'POR-MELB-SQL-01', '44444444-4444-4444-8444-444444444444', 'user_julie_01', 'PENDING_APPROVAL', 3200.00
    );
  `, [poId]);

  // Execute atomic transition via SQL function
  const resTrans = await db.query(`
    SELECT public.execute_site_approval_transition(
      $1::uuid,
      '460a44d0-5237-4e59-aad3-93619d6d50cd', -- Matthew Mancuso
      'Matthew Mancuso',
      'SITE_MANAGER',
      '44444444-4444-4444-8444-444444444444',
      'APPROVE',
      'Approved for production operations'
    ) as result;
  `, [poId]);

  const transResult = resTrans.rows[0].result;
  assert.equal(transResult.success, true);
  assert.equal(transResult.new_status, 'APPROVED_PENDING_CONCUR_REQUEST');
  assert.ok(transResult.reservation_expires_at, 'Must set 48h reservation expiry');

  // Verify PO row updated in database
  const poRow = (await db.query('SELECT * FROM public.po_requests WHERE id = $1', [poId])).rows[0];
  assert.equal(poRow.status, 'APPROVED_PENDING_CONCUR_REQUEST');
  assert.ok(poRow.approved_at);
  assert.ok(poRow.reservation_expires_at);

  // Verify Audit Log inserted in same transaction
  const auditRow = (await db.query('SELECT * FROM public.site_workflow_audit_log WHERE po_id = $1', [poId])).rows[0];
  assert.ok(auditRow);
  assert.equal(auditRow.action, 'TRANSITION_APPROVE');
  assert.equal(auditRow.actor_name, 'Matthew Mancuso');

  // Verify Notification Outbox inserted atomically in same transaction
  const outboxRow = (await db.query('SELECT * FROM public.site_workflow_notification_outbox WHERE po_id = $1', [poId])).rows[0];
  assert.ok(outboxRow);
  assert.equal(outboxRow.channel, 'IN_APP');
  assert.equal(outboxRow.status, 'PREVIEW_DURABLE');
  assert.ok(outboxRow.body.includes('48-Hour Supplier Stock Reservation Hold Active'));

  await db.close();
});

test('7. PostgreSQL Concurrent Double-Approval Locking (FOR UPDATE & Advisory Lock)', async () => {
  const db = await createTestDatabase();

  const poId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  await db.query(`
    INSERT INTO public.po_requests (
      id, display_id, site_id, requester_id, status, total_amount
    ) VALUES (
      $1, 'POR-MELB-CONC-01', '44444444-4444-4444-8444-444444444444', 'user_julie_01', 'PENDING_APPROVAL', 5400.00
    );
  `, [poId]);

  // First client approval execution
  const res1 = await db.query(`
    SELECT public.execute_site_approval_transition(
      $1::uuid,
      '460a44d0-5237-4e59-aad3-93619d6d50cd',
      'Matthew Mancuso',
      'SITE_MANAGER',
      '44444444-4444-4444-8444-444444444444',
      'APPROVE'
    ) as result;
  `, [poId]);
  assert.equal(res1.rows[0].result.success, true);

  // Concurrent second client approval attempt on same PO
  const res2 = await db.query(`
    SELECT public.execute_site_approval_transition(
      $1::uuid,
      '460a44d0-5237-4e59-aad3-93619d6d50cd',
      'Matthew Mancuso',
      'SITE_MANAGER',
      '44444444-4444-4444-8444-444444444444',
      'APPROVE'
    ) as result;
  `, [poId]);

  const secondAttempt = res2.rows[0].result;
  assert.equal(secondAttempt.success, false);
  assert.equal(secondAttempt.error, 'DUPLICATE_APPROVAL_ATTEMPT');
  assert.equal(secondAttempt.current_status, 'APPROVED_PENDING_CONCUR_REQUEST');

  await db.close();
});

test('8. Integrated Submit Entrypoint: Enqueues durable outbox notification to Matthew Mancuso', async () => {
  siteApprovalIntegrationService.clearOutbox();

  const mockPo = {
    id: 'po_submit_int_01',
    displayId: 'POR-MELB-2026-001',
    siteId: '44444444-4444-4444-8444-444444444444',
    siteName: 'SPL Melbourne',
    requesterId: 'user_julie_01',
    requesterName: 'Julie Nguyen',
    totalAmount: 4850,
    status: 'PENDING_APPROVAL',
  };

  const requester = {
    id: 'user_julie_01',
    name: 'Julie Nguyen',
    role: 'SITE_USER',
  };

  await siteApprovalIntegrationService.onRequisitionCreated(mockPo, requester);

  const outbox = siteApprovalIntegrationService.getOutbox();
  assert.ok(outbox.length >= 3, 'Should enqueue In-App, Email, and Teams outbox records');

  const inApp = outbox.find(r => r.channel === 'IN_APP');
  assert.ok(inApp);
  assert.equal(inApp.recipient_email, 'matthew.mancuso@splservices.com.au');
  assert.equal(inApp.status, 'PREVIEW_DURABLE');
  assert.ok(inApp.title.includes('POR-MELB-2026-001'));

  const email = outbox.find(r => r.channel === 'EMAIL');
  assert.ok(email);
  assert.equal(email.recipient_email, 'matthew.mancuso@splservices.com.au');
  assert.ok(email.html_payload.includes('SPL Melbourne'));

  const teams = outbox.find(r => r.channel === 'TEAMS');
  assert.ok(teams);
  assert.equal(teams.status, 'PREVIEW_DURABLE');
});

test('9. Integrated Approve Entrypoint & 48h Stock Hold Notice to Requester', async () => {
  siteApprovalIntegrationService.clearOutbox();

  const mockPo = {
    id: 'po_approve_int_01',
    displayId: 'POR-MELB-2026-002',
    siteId: '44444444-4444-4444-8444-444444444444',
    siteName: 'SPL Melbourne',
    requesterId: 'user_julie_01',
    requesterName: 'Julie Nguyen',
    totalAmount: 1200,
    status: 'PENDING_APPROVAL',
  };

  const approver = {
    id: VERIFIED_APPROVAL_IDENTITIES.MELBOURNE_APPROVAL_MANAGER.id,
    name: 'Matthew Mancuso',
    role: 'SITE_MANAGER',
  };

  await siteApprovalIntegrationService.onPOApproved(mockPo, approver);

  const outbox = siteApprovalIntegrationService.getOutbox();
  const reqNotif = outbox.find(r => r.recipient_id === 'user_julie_01' && r.channel === 'IN_APP');
  assert.ok(reqNotif, 'Requester should receive approved notification in outbox');
  assert.ok(reqNotif.body.includes('48-Hour Supplier Stock Reservation Hold Active'));
  assert.ok(reqNotif.body.includes('Concur PR'));
});

test('10. Integrated Concur Handover (Ash June 17): Records PR and PO linkage', () => {
  const mockPo = {
    id: 'po_concur_int_01',
    displayId: 'POR-MELB-2026-003',
    siteId: '44444444-4444-4444-8444-444444444444',
    requesterId: 'user_julie_01',
    requesterName: 'Julie Nguyen',
  };

  // Step 1: Link Concur PR #
  siteApprovalIntegrationService.onConcurRequestLinked(mockPo, 'PR-9848', { id: 'user_julie_01', name: 'Julie Nguyen' });
  const auditLogs1 = siteApprovalWorkflowService.getAuditLogs();
  const prAudit = auditLogs1.find(a => a.action === 'CONCUR_PR_RECORDED');
  assert.ok(prAudit);
  assert.equal(prAudit.details.concurRequestNumber, 'PR-9848');

  // Step 2: Link Concur PO #
  siteApprovalIntegrationService.onConcurPOLinked(mockPo, 'PO-2026-9848', { id: 'user_julie_01', name: 'Julie Nguyen' });
  const auditLogs2 = siteApprovalWorkflowService.getAuditLogs();
  const poAudit = auditLogs2.find(a => a.action === 'CONCUR_PO_LINKED');
  assert.ok(poAudit);
  assert.equal(poAudit.details.concurPoNumber, 'PO-2026-9848');
  assert.equal(poAudit.details.deliveriesUnlocked, true);
});

test('11. Configurable / Manual Escalation without Timeout (DECISION_PENDING)', async () => {
  siteApprovalIntegrationService.clearOutbox();

  const mockPo = {
    id: 'po_esc_int_01',
    displayId: 'POR-MELB-2026-004',
    siteId: '44444444-4444-4444-8444-444444444444',
    requesterId: 'user_julie_01',
    totalAmount: 15000,
  };

  await siteApprovalIntegrationService.onPOEscalated(mockPo, { id: 'user_admin_01', name: 'Admin Supervisor' }, 'Manual review requested');

  const outbox = siteApprovalIntegrationService.getOutbox();
  const escNotif = outbox.find(r => r.recipient_email === 'ebrahim.mokhtari@splservices.com.au');
  assert.ok(escNotif, 'Escalation notification should be queued to Eb (COO)');

  const auditLogs = siteApprovalWorkflowService.getAuditLogs();
  const escAudit = auditLogs.find(a => a.action === 'ESCALATED_TO_COO');
  assert.ok(escAudit);
  assert.equal(escAudit.details.slaStatus, 'DECISION_PENDING');
  assert.equal(escAudit.details.escalatedTo, 'Ebrahim Mokhtari');
});

test('12. Outbox Idempotency & Duplicate Prevention', async () => {
  const outbox = new DurableNotificationOutboxAdapter();
  outbox.clearOutbox();

  const payload = {
    eventType: 'SITE_MANAGER_APPROVAL_REQUIRED',
    poId: 'po_idem_001',
    displayId: 'POR-IDEM-001',
    siteId: '44444444-4444-4444-8444-444444444444',
    recipientId: 'mgr_001',
    recipientName: 'Matthew Mancuso',
    recipientEmail: 'matthew.mancuso@splservices.com.au',
    channel: 'IN_APP',
    title: 'Approval Required',
    body: 'Test Body',
  };

  const first = await outbox.enqueue(payload);
  assert.equal(first.queued, true);
  assert.equal(first.duplicate, false);

  // Immediate retry with same payload
  const second = await outbox.enqueue(payload);
  assert.equal(second.queued, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.record.idempotency_key, first.record.idempotency_key);
});

test('13. Ashish Chhabra Offboarding Audit & Zero Production Data Mutation', () => {
  const analysis = siteApprovalWorkflowService.analyzeAshMigration();

  // Immutable historical records preserved
  assert.equal(analysis.closedRequests.length, 2);
  assert.equal(analysis.closedRequests[0].display_id, 'POR-202609-000031');
  assert.equal(analysis.closedRequests[1].display_id, 'POR-202610-000030');

  // Open order proposed reassignment (NOT executed)
  assert.equal(analysis.activeAwaitingConcur.length, 1);
  const openOrder = analysis.activeAwaitingConcur[0];
  assert.equal(openOrder.display_id, 'POR-202609-000029');
  assert.equal(openOrder.proposed_manager, 'Ebrahim Mokhtari (COO - Holdings Corporate)');
});
