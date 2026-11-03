-- ============================================================================
-- ProcureFlow: Per-Site Approval Workflows & Durable Outbox (v2 Live Migration)
-- Scope: All 11 SPL Facilities across Australia
-- Pilot / Default Lead: Matthew Mancuso (Melbourne) & Ebrahim Mokhtari (COO)
-- Escalation Policy: Auto Escalation (72-hour SLA) with Manual Toggle & Role Guard
-- Reassignment: POR-202609-000029 reassigned from Ashish Chhabra to Eb (COO)
-- ============================================================================

-- 0. Compatibility & Extensions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
    END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() 
RETURNS uuid 
LANGUAGE sql 
STABLE 
AS $$ 
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid; 
$$;

-- Ensure po_requests columns exist if base table is present
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'po_requests') THEN
        ALTER TABLE public.po_requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
        ALTER TABLE public.po_requests ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ;
        ALTER TABLE public.po_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
        ALTER TABLE public.po_requests ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
        ALTER TABLE public.po_requests ADD COLUMN IF NOT EXISTS assigned_approver_id UUID;
        ALTER TABLE public.po_requests ADD COLUMN IF NOT EXISTS reassigned_from_id UUID;
        ALTER TABLE public.po_requests ADD COLUMN IF NOT EXISTS reassignment_reason TEXT;
        ALTER TABLE public.po_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
    END IF;
END $$;

-- 1. Per-Site Approval Workflow Configuration Table
CREATE TABLE IF NOT EXISTS public.site_approval_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL,
    site_name TEXT NOT NULL,
    approval_manager_id UUID,
    approval_manager_name TEXT NOT NULL,
    approval_manager_email TEXT NOT NULL,
    approval_manager_entra_id TEXT,
    escalation_manager_id UUID,
    escalation_manager_name TEXT NOT NULL,
    escalation_manager_email TEXT NOT NULL,
    escalation_manager_entra_id TEXT,
    escalation_mode TEXT NOT NULL DEFAULT 'AUTO' CHECK (escalation_mode IN ('AUTO', 'MANUAL')),
    escalation_sla_hours INTEGER NOT NULL DEFAULT 72,
    sla_status TEXT NOT NULL DEFAULT 'ACTIVE_AUTO' CHECK (sla_status IN ('ACTIVE_AUTO', 'ACTIVE_MANUAL', 'CONFIGURED', 'DECISION_PENDING')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_by TEXT,
    CONSTRAINT site_approval_workflows_site_id_unique UNIQUE (site_id)
);

CREATE INDEX IF NOT EXISTS idx_site_approval_workflows_site_id 
    ON public.site_approval_workflows(site_id);
CREATE INDEX IF NOT EXISTS idx_site_approval_workflows_active 
    ON public.site_approval_workflows(is_active) WHERE is_active = true;

-- 2. Durable Notification Outbox Table
CREATE TABLE IF NOT EXISTS public.site_workflow_notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL UNIQUE,
    po_id UUID,
    display_id TEXT,
    site_id UUID NOT NULL,
    recipient_id TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL', 'TEAMS')),
    status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'DELIVERED', 'FAILED', 'PREVIEW_DURABLE')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    html_payload TEXT,
    teams_card_payload JSONB,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_site_workflow_outbox_status 
    ON public.site_workflow_notification_outbox(status);
CREATE INDEX IF NOT EXISTS idx_site_workflow_outbox_po 
    ON public.site_workflow_notification_outbox(po_id);
CREATE INDEX IF NOT EXISTS idx_site_workflow_outbox_key 
    ON public.site_workflow_notification_outbox(idempotency_key);

-- 3. Workflow Decision Audit Log Table
CREATE TABLE IF NOT EXISTS public.site_workflow_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id TEXT NOT NULL,
    display_id TEXT NOT NULL,
    site_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_site_workflow_audit_po 
    ON public.site_workflow_audit_log(po_id);
CREATE INDEX IF NOT EXISTS idx_site_workflow_audit_timestamp 
    ON public.site_workflow_audit_log(created_at);

-- 4. Initial Seed for All 11 SPL Facilities (72h Auto Escalation with Manual Option)
INSERT INTO public.site_approval_workflows (
    site_id, site_name,
    approval_manager_id, approval_manager_name, approval_manager_email, approval_manager_entra_id,
    escalation_manager_id, escalation_manager_name, escalation_manager_email, escalation_manager_entra_id,
    escalation_mode, escalation_sla_hours, sla_status, is_active, notes, updated_by
) VALUES
-- 1. Melbourne
(
    '44444444-4444-4444-8444-444444444444', 'SPL Melbourne',
    '460a44d0-5237-4e59-aad3-93619d6d50cd', 'Matthew Mancuso', 'matthew.mancuso@splservices.com.au', '460a44d0-5237-4e59-aad3-93619d6d50cd',
    '9e97d720-3bf0-4451-b739-9fd87d27686c', 'Ebrahim Mokhtari', 'ebrahim.mokhtari@splservices.com.au', '9e97d720-3bf0-4451-b739-9fd87d27686c',
    'AUTO', 72, 'ACTIVE_AUTO', true, 'Melbourne workflow configured with Matthew Mancuso & COO Eb.', 'System Initializer'
),
-- 2. Adelaide
(
    '11111111-1111-4111-8111-111111111111', 'SPL Adelaide',
    '83b2c907-f3eb-4e3a-989f-aebea981500c', 'Paul Phillips', 'paul.phillips@splservices.com.au', '83b2c907-f3eb-4e3a-989f-aebea981500c',
    '9e97d720-3bf0-4451-b739-9fd87d27686c', 'Ebrahim Mokhtari', 'ebrahim.mokhtari@splservices.com.au', '9e97d720-3bf0-4451-b739-9fd87d27686c',
    'AUTO', 72, 'ACTIVE_AUTO', true, 'Adelaide workflow configured with Paul Phillips & COO Eb.', 'System Initializer'
),
-- 3. Brisbane
(
    '22222222-2222-4222-8222-222222222222', 'SPL Brisbane',
    'a9bc57a2-ef69-411b-a8a5-f5f5179c2423', 'Lisa Wilson', 'lisa.wilson@splservices.com.au', 'a9bc57a2-ef69-411b-a8a5-f5f5179c2423',
    '9e97d720-3bf0-4451-b739-9fd87d27686c', 'Ebrahim Mokhtari', 'ebrahim.mokhtari@splservices.com.au', '9e97d720-3bf0-4451-b739-9fd87d27686c',
    'AUTO', 72, 'ACTIVE_AUTO', true, 'Brisbane workflow configured with Lisa Wilson & COO Eb.', 'System Initializer'
),
-- 4. Cairns
(
    '683e10e8-0609-44eb-a089-584d8c0e30c2', 'SPL Cairns',
    'e520848f-c4dd-4862-a7ad-335c65ede405', 'Jason Waight', 'jason.waight@splservices.com.au', 'e520848f-c4dd-4862-a7ad-335c65ede405',
    '9e97d720-3bf0-4451-b739-9fd87d27686c', 'Ebrahim Mokhtari', 'ebrahim.mokhtari@splservices.com.au', '9e97d720-3bf0-4451-b739-9fd87d27686c',
    'AUTO', 72, 'ACTIVE_AUTO', true, 'Cairns workflow configured with Jason Waight & COO Eb.', 'System Initializer'
),
-- 5. Classic Linen
(
    '88888888-8888-4888-8888-888888888888', 'SPL Classic Linen',
    'd593571a-c4bd-4627-8b03-33704226e826', 'David You', 'david.you@splservices.com.au', 'd593571a-c4bd-4627-8b03-33704226e826',
    '9e97d720-3bf0-4451-b739-9fd87d27686c', 'Ebrahim Mokhtari', 'ebrahim.mokhtari@splservices.com.au', '9e97d720-3bf0-4451-b739-9fd87d27686c',
    'AUTO', 72, 'ACTIVE_AUTO', true, 'Classic Linen workflow configured with David You & COO Eb.', 'System Initializer'
),
-- 6. Sydney
(
    '77777777-7777-4777-8777-777777777777', 'SPL Sydney',
    'd593571a-c4bd-4627-8b03-33704226e826', 'David You', 'david.you@splservices.com.au', 'd593571a-c4bd-4627-8b03-33704226e826',
    '9e97d720-3bf0-4451-b739-9fd87d27686c', 'Ebrahim Mokhtari', 'ebrahim.mokhtari@splservices.com.au', '9e97d720-3bf0-4451-b739-9fd87d27686c',
    'AUTO', 72, 'ACTIVE_AUTO', true, 'Sydney workflow configured with David You & COO Eb.', 'System Initializer'
),
-- 7. Holdings
(
    '5d0c236b-4311-4bbe-894e-d7a2621ed559', 'SPL Holdings',
    'be5428f4-8658-4c15-8b51-13119217311a', 'Hamoun Adelinik', 'hamoun.adelinik@splservices.com.au', 'be5428f4-8658-4c15-8b51-13119217311a',
    '9e97d720-3bf0-4451-b739-9fd87d27686c', 'Ebrahim Mokhtari', 'ebrahim.mokhtari@splservices.com.au', '9e97d720-3bf0-4451-b739-9fd87d27686c',
    'AUTO', 72, 'ACTIVE_AUTO', true, 'SPL Holdings workflow configured with Hamoun Adelinik & COO Eb.', 'System Initializer'
),
-- 8. Mackay
(
    '33333333-3333-4333-8333-333333333333', 'SPL Mackay',
    '5dbebdad-7944-442f-8544-e9b6ebba52d4', 'Bronwen Glover', 'bronwen.glover@splservices.com.au', '5dbebdad-7944-442f-8544-e9b6ebba52d4',
    '9e97d720-3bf0-4451-b739-9fd87d27686c', 'Ebrahim Mokhtari', 'ebrahim.mokhtari@splservices.com.au', '9e97d720-3bf0-4451-b739-9fd87d27686c',
    'AUTO', 72, 'ACTIVE_AUTO', true, 'Mackay workflow configured with Bronwen Glover & COO Eb.', 'System Initializer'
),
-- 9. Perth: Belmont
(
    '55555555-5555-4555-8555-555555555555', 'SPL Perth: Belmont',
    '8821acdf-3089-422f-843c-9919a9439640', 'Rob Callaghan', 'rob.callaghan@splservices.com.au', '8821acdf-3089-422f-843c-9919a9439640',
    '9e97d720-3bf0-4451-b739-9fd87d27686c', 'Ebrahim Mokhtari', 'ebrahim.mokhtari@splservices.com.au', '9e97d720-3bf0-4451-b739-9fd87d27686c',
    'AUTO', 72, 'ACTIVE_AUTO', true, 'Perth Belmont workflow configured with Rob Callaghan & COO Eb.', 'System Initializer'
),
-- 10. Perth: Maddington
(
    '66666666-6666-4666-8666-666666666666', 'SPL Perth: Maddington',
    '8821acdf-3089-422f-843c-9919a9439640', 'Rob Callaghan', 'rob.callaghan@splservices.com.au', '8821acdf-3089-422f-843c-9919a9439640',
    '9e97d720-3bf0-4451-b739-9fd87d27686c', 'Ebrahim Mokhtari', 'ebrahim.mokhtari@splservices.com.au', '9e97d720-3bf0-4451-b739-9fd87d27686c',
    'AUTO', 72, 'ACTIVE_AUTO', true, 'Perth Maddington workflow configured with Rob Callaghan & COO Eb.', 'System Initializer'
),
-- 11. Albury
(
    '99999999-9999-4999-8999-999999999999', 'SPL Albury',
    '805b9626-1779-43ae-bb8f-970bbb1503f7', 'Teegan Paterson', 'teegan.paterson@splservices.com.au', '805b9626-1779-43ae-bb8f-970bbb1503f7',
    '9e97d720-3bf0-4451-b739-9fd87d27686c', 'Ebrahim Mokhtari', 'ebrahim.mokhtari@splservices.com.au', '9e97d720-3bf0-4451-b739-9fd87d27686c',
    'AUTO', 72, 'ACTIVE_AUTO', true, 'Albury workflow configured with Teegan Paterson & COO Eb.', 'System Initializer'
)
ON CONFLICT (site_id) DO UPDATE SET
    approval_manager_name = EXCLUDED.approval_manager_name,
    approval_manager_email = EXCLUDED.approval_manager_email,
    escalation_manager_name = EXCLUDED.escalation_manager_name,
    escalation_manager_email = EXCLUDED.escalation_manager_email,
    escalation_mode = EXCLUDED.escalation_mode,
    escalation_sla_hours = EXCLUDED.escalation_sla_hours,
    sla_status = EXCLUDED.sla_status,
    updated_at = timezone('utc'::text, now());

-- 5. Server-Side Authorization Evaluation Function
CREATE OR REPLACE FUNCTION public.check_site_approval_authority(
    p_po_id UUID,
    p_actor_id TEXT,
    p_actor_role TEXT,
    p_actor_site_id TEXT,
    p_po_site_id TEXT,
    p_po_requester_id TEXT,
    p_total_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_workflow RECORD;
    v_result JSONB;
    v_jwt_sub TEXT;
    v_db_role TEXT;
BEGIN
    -- 0. Cryptographic / Trusted Session Identity Check:
    v_jwt_sub := current_setting('request.jwt.claim.sub', true);
    IF v_jwt_sub IS NOT NULL AND v_jwt_sub <> '' THEN
        IF v_jwt_sub <> p_actor_id THEN
            RETURN jsonb_build_object(
                'authorized', false,
                'reason', 'Cryptographic identity mismatch: session token does not match claimed actor ID.',
                'error_code', 'CALLER_IDENTITY_MISMATCH'
            );
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
            SELECT role_id INTO v_db_role FROM public.users WHERE id::TEXT = v_jwt_sub OR email = v_jwt_sub;
            IF FOUND AND v_db_role IS NOT NULL THEN
                IF p_actor_role = 'ADMIN' AND v_db_role <> 'ADMIN' AND v_db_role <> 'admin' THEN
                    RETURN jsonb_build_object(
                        'authorized', false,
                        'reason', 'Caller claimed ADMIN privileges but database role is ' || v_db_role,
                        'error_code', 'ROLE_SPOOF_REJECTED'
                    );
                END IF;
            END IF;
        END IF;
    END IF;

    -- 1. Segregation of Duties (SoD): Requester cannot approve their own order
    IF p_actor_id = p_po_requester_id AND p_actor_role <> 'ADMIN' THEN
        RETURN jsonb_build_object(
            'authorized', false,
            'reason', 'Segregation of duties: Requesters cannot approve their own purchase requests.',
            'error_code', 'SOD_VIOLATION'
        );
    END IF;

    -- 2. System Administrator Override
    IF p_actor_role = 'ADMIN' THEN
        RETURN jsonb_build_object(
            'authorized', true,
            'role_applied', 'ADMIN',
            'reason', 'Authorized as System Administrator.'
        );
    END IF;

    -- 3. Lookup site approval workflow configuration
    SELECT * INTO v_workflow
    FROM public.site_approval_workflows
    WHERE site_id = p_po_site_id::UUID AND is_active = true;

    IF FOUND THEN
        -- Check Site Approval Manager match
        IF v_workflow.approval_manager_id::TEXT = p_actor_id 
           OR v_workflow.approval_manager_email = p_actor_id
           OR (p_actor_site_id = p_po_site_id AND p_actor_role IN ('SITE_MANAGER', 'PROCUREMENT_MANAGER')) THEN
            RETURN jsonb_build_object(
                'authorized', true,
                'role_applied', 'SITE_APPROVAL_MANAGER',
                'site_name', v_workflow.site_name,
                'assigned_manager', v_workflow.approval_manager_name,
                'escalation_mode', v_workflow.escalation_mode,
                'escalation_sla_hours', v_workflow.escalation_sla_hours
            );
        END IF;

        -- Check Escalation Authority match
        IF v_workflow.escalation_manager_id::TEXT = p_actor_id
           OR v_workflow.escalation_manager_email = p_actor_id THEN
            RETURN jsonb_build_object(
                'authorized', true,
                'role_applied', 'ESCALATION_AUTHORITY',
                'site_name', v_workflow.site_name,
                'escalation_manager', v_workflow.escalation_manager_name,
                'escalation_mode', v_workflow.escalation_mode,
                'escalation_sla_hours', v_workflow.escalation_sla_hours
            );
        END IF;

        -- Explicit rejection if not matching assigned site workflow
        RETURN jsonb_build_object(
            'authorized', false,
            'reason', 'Actor is not the designated Site Approval Manager or Escalation Authority for this facility.',
            'error_code', 'UNAUTHORIZED_ACTOR',
            'required_approver', v_workflow.approval_manager_name
        );
    END IF;

    -- Fallback for unconfigured facility: Check site matching
    IF p_actor_site_id = p_po_site_id THEN
        RETURN jsonb_build_object(
            'authorized', true,
            'role_applied', 'SITE_USER_MATCH',
            'reason', 'Authorized under standard facility matching.'
        );
    END IF;

    RETURN jsonb_build_object(
        'authorized', false,
        'reason', 'Actor does not belong to facility ' || p_po_site_id,
        'error_code', 'CROSS_SITE_UNAUTHORIZED'
    );
END;
$$;

-- 6. Server-Side Atomic Approval State Transition with Advisory Lock & Transactional Outbox
CREATE OR REPLACE FUNCTION public.execute_site_approval_transition(
    p_po_id UUID,
    p_actor_id TEXT,
    p_actor_name TEXT,
    p_actor_role TEXT,
    p_actor_site_id TEXT,
    p_decision TEXT, -- 'APPROVE', 'REJECT', 'ESCALATE'
    p_feedback_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_po RECORD;
    v_auth JSONB;
    v_new_status TEXT;
    v_reservation_expires TIMESTAMPTZ;
    v_escalation_manager_email TEXT;
BEGIN
    -- 1. Acquire atomic transaction-level advisory lock on PO
    PERFORM pg_advisory_xact_lock(hashtext('site_po_approval_' || p_po_id::TEXT));

    -- 2. Fetch current PO state with row-level lock (FOR UPDATE)
    SELECT id, display_id, site_id, requester_id, status, total_amount
    INTO v_po
    FROM public.po_requests
    WHERE id = p_po_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'PO_NOT_FOUND');
    END IF;

    -- 3. Double-approval guard
    IF v_po.status <> 'PENDING_APPROVAL' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'DUPLICATE_APPROVAL_ATTEMPT',
            'current_status', v_po.status
        );
    END IF;

    -- 4. Evaluate server-side authority
    v_auth := public.check_site_approval_authority(
        p_po_id,
        p_actor_id,
        p_actor_role,
        p_actor_site_id,
        v_po.site_id::TEXT,
        v_po.requester_id::TEXT,
        COALESCE(v_po.total_amount, 0)
    );

    IF (v_auth->>'authorized')::BOOLEAN <> true THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', v_auth->>'error_code',
            'reason', v_auth->>'reason'
        );
    END IF;

    -- 5. Transition status and execute transactional outbox insertion
    IF p_decision = 'APPROVE' THEN
        v_new_status := 'APPROVED_PENDING_CONCUR_REQUEST';
        v_reservation_expires := timezone('utc'::text, now()) + interval '48 hours';

        UPDATE public.po_requests
        SET status = v_new_status,
            approved_at = timezone('utc'::text, now()),
            reservation_expires_at = v_reservation_expires,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_po_id;

        -- Enqueue outbox notification to requester in the SAME transaction (order/outbox atomicity)
        INSERT INTO public.site_workflow_notification_outbox (
            idempotency_key,
            po_id,
            display_id,
            site_id,
            recipient_id,
            recipient_name,
            recipient_email,
            channel,
            status,
            title,
            body,
            teams_card_payload
        ) VALUES (
            'notif_' || p_po_id::TEXT || '_APPROVED_' || extract(epoch from now())::BIGINT,
            p_po_id,
            v_po.display_id,
            v_po.site_id,
            v_po.requester_id::TEXT,
            'Requisition Requester',
            'requester@splservices.com.au',
            'IN_APP',
            'QUEUED',
            'Requisition ' || COALESCE(v_po.display_id, p_po_id::TEXT) || ' Approved',
            'Your purchase request has been approved by ' || p_actor_name || '. 48-Hour Supplier Stock Reservation Hold Active. Please raise Concur PR.',
            jsonb_build_object('event', 'PO_APPROVED', 'po_id', p_po_id, 'approver', p_actor_name)
        );

    ELSIF p_decision = 'REJECT' THEN
        v_new_status := 'REJECTED';

        UPDATE public.po_requests
        SET status = v_new_status,
            rejection_reason = p_feedback_reason,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_po_id;

        INSERT INTO public.site_workflow_notification_outbox (
            idempotency_key,
            po_id,
            display_id,
            site_id,
            recipient_id,
            recipient_name,
            recipient_email,
            channel,
            status,
            title,
            body,
            teams_card_payload
        ) VALUES (
            'notif_' || p_po_id::TEXT || '_REJECTED_' || extract(epoch from now())::BIGINT,
            p_po_id,
            v_po.display_id,
            v_po.site_id,
            v_po.requester_id::TEXT,
            'Requisition Requester',
            'requester@splservices.com.au',
            'IN_APP',
            'QUEUED',
            'Requisition ' || COALESCE(v_po.display_id, p_po_id::TEXT) || ' Rejected',
            'Your purchase request was rejected: ' || COALESCE(p_feedback_reason, 'No reason provided'),
            jsonb_build_object('event', 'PO_REJECTED', 'po_id', p_po_id, 'rejector', p_actor_name)
        );

    ELSIF p_decision = 'ESCALATE' THEN
        v_new_status := 'ESCALATED';

        UPDATE public.po_requests
        SET status = v_new_status,
            escalated_at = timezone('utc'::text, now()),
            updated_at = timezone('utc'::text, now())
        WHERE id = p_po_id;

        -- Get escalation manager email from workflow or default to Eb
        SELECT escalation_manager_email INTO v_escalation_manager_email
        FROM public.site_approval_workflows
        WHERE site_id = v_po.site_id::UUID;

        IF v_escalation_manager_email IS NULL THEN
            v_escalation_manager_email := 'ebrahim.mokhtari@splservices.com.au';
        END IF;

        INSERT INTO public.site_workflow_notification_outbox (
            idempotency_key,
            po_id,
            display_id,
            site_id,
            recipient_id,
            recipient_name,
            recipient_email,
            channel,
            status,
            title,
            body,
            teams_card_payload
        ) VALUES (
            'notif_' || p_po_id::TEXT || '_ESCALATED_' || extract(epoch from now())::BIGINT,
            p_po_id,
            v_po.display_id,
            v_po.site_id,
            '9e97d720-3bf0-4451-b739-9fd87d27686c',
            'Ebrahim Mokhtari',
            v_escalation_manager_email,
            'IN_APP',
            'QUEUED',
            'Requisition ' || COALESCE(v_po.display_id, p_po_id::TEXT) || ' Escalated',
            'Requisition escalated for executive review (72h SLA): ' || COALESCE(p_feedback_reason, 'Escalation triggered'),
            jsonb_build_object('event', 'PO_ESCALATED', 'po_id', p_po_id, 'escalated_by', p_actor_name)
        );
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_DECISION');
    END IF;

    -- 6. Record in audit log
    INSERT INTO public.site_workflow_audit_log (
        po_id,
        display_id,
        site_id,
        action,
        actor_id,
        actor_name,
        actor_role,
        details
    ) VALUES (
        p_po_id::TEXT,
        COALESCE(v_po.display_id, p_po_id::TEXT),
        v_po.site_id::TEXT,
        'TRANSITION_' || p_decision,
        p_actor_id,
        p_actor_name,
        p_actor_role,
        jsonb_build_object(
            'previous_status', v_po.status,
            'new_status', v_new_status,
            'feedback_reason', p_feedback_reason,
            'reservation_expires_at', v_reservation_expires
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'po_id', p_po_id,
        'new_status', v_new_status,
        'reservation_expires_at', v_reservation_expires
    );
END;
$$;

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.site_approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_workflow_notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_workflow_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read of site approval workflows' AND tablename = 'site_approval_workflows') THEN
        CREATE POLICY "Allow authenticated read of site approval workflows"
            ON public.site_approval_workflows FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow admin write to site approval workflows' AND tablename = 'site_approval_workflows') THEN
        CREATE POLICY "Allow admin write to site approval workflows"
            ON public.site_approval_workflows FOR ALL TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid() AND (u.role_id = 'ADMIN' OR u.role_id = 'admin')
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read of outbox' AND tablename = 'site_workflow_notification_outbox') THEN
        CREATE POLICY "Allow authenticated read of outbox"
            ON public.site_workflow_notification_outbox FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated insert to outbox' AND tablename = 'site_workflow_notification_outbox') THEN
        CREATE POLICY "Allow authenticated insert to outbox"
            ON public.site_workflow_notification_outbox FOR INSERT TO authenticated WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read of audit logs' AND tablename = 'site_workflow_audit_log') THEN
        CREATE POLICY "Allow authenticated read of audit logs"
            ON public.site_workflow_audit_log FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated insert to audit logs' AND tablename = 'site_workflow_audit_log') THEN
        CREATE POLICY "Allow authenticated insert to audit logs"
            ON public.site_workflow_audit_log FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
END $$;

-- 8. ASHISH CHHABRA OPEN ORDER REASSIGNMENT TO EB (COO)
-- Reassign active open request POR-202609-000029 ($3,700.00, SPL Holdings)
UPDATE public.po_requests
SET assigned_approver_id = '9e97d720-3bf0-4451-b739-9fd87d27686c', -- Ebrahim Mokhtari (COO)
    reassigned_from_id = '84ce40fb-0e8e-482f-8587-bf51f413008e',  -- Ashish Chhabra
    reassignment_reason = 'Ashish Chhabra offboarding - reassigned to COO Ebrahim Mokhtari',
    updated_at = timezone('utc'::text, now())
WHERE display_id = 'POR-202609-000029'
  AND status = 'APPROVED_PENDING_CONCUR';
