-- Migration: Dynamic Stock Reservation and 48-Hour Expiry Engine
-- Date: 2026-09-25
-- Description:
-- 1. Adds reservation and expiry tracking columns to po_requests.
-- 2. Backfills existing pending concur records with approved_at and reservation_expires_at.
-- 3. Creates indexes for high-speed reservation scanning and stock reconciliation.
-- 4. Creates atomic expire_stale_reservations() stored procedure.
-- 5. Seeds notification template for expired reservation cancellations.
-- 6. Registers pg_cron job for automated 15-minute execution (if pg_cron is enabled).

-- 1. Add Tracking Columns to po_requests
ALTER TABLE public.po_requests 
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS concur_linked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS concur_po_number TEXT,
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
    ADD COLUMN IF NOT EXISTS auto_cancelled_at TIMESTAMPTZ;

-- 2. Backfill existing records
UPDATE public.po_requests p
SET 
    approved_at = COALESCE(
        (SELECT MAX(a.date) FROM public.po_approvals a WHERE a.po_request_id = p.id AND a.action = 'APPROVED'),
        p.request_date,
        p.created_at
    ),
    reservation_expires_at = COALESCE(
        (SELECT MAX(a.date) FROM public.po_approvals a WHERE a.po_request_id = p.id AND a.action = 'APPROVED'),
        p.request_date,
        p.created_at
    ) + INTERVAL '48 hours'
WHERE p.status IN ('APPROVED_PENDING_CONCUR', 'APPROVED_PENDING_CONCUR_REQUEST')
  AND p.approved_at IS NULL;

-- 3. High-Performance Indices
CREATE INDEX IF NOT EXISTS idx_po_requests_reservation_expiry 
    ON public.po_requests (status, reservation_expires_at)
    WHERE status IN ('APPROVED_PENDING_CONCUR', 'APPROVED_PENDING_CONCUR_REQUEST');

CREATE INDEX IF NOT EXISTS idx_po_requests_supplier_status 
    ON public.po_requests (supplier_id, status);

CREATE INDEX IF NOT EXISTS idx_po_requests_concur_linked_at
    ON public.po_requests (concur_linked_at)
    WHERE status = 'ACTIVE';

-- 4. Atomic Stored Procedure: expire_stale_reservations
CREATE OR REPLACE FUNCTION public.expire_stale_reservations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_po RECORD;
    v_cancelled_count INTEGER := 0;
    v_cancelled_items jsonb := '[]'::jsonb;
BEGIN
    -- Advisory lock to prevent concurrent sweeps
    PERFORM pg_advisory_xact_lock(hashtext('expire_stale_reservations'));

    FOR v_po IN
        SELECT 
            p.id, 
            p.display_id, 
            p.requester_id, 
            p.total_amount,
            p.supplier_id,
            s.name AS supplier_name,
            u.name AS requester_name,
            u.email AS requester_email
        FROM public.po_requests p
        LEFT JOIN public.suppliers s ON p.supplier_id = s.id
        LEFT JOIN public.users u ON p.requester_id = u.id
        WHERE p.status IN ('APPROVED_PENDING_CONCUR', 'APPROVED_PENDING_CONCUR_REQUEST')
          AND p.reservation_expires_at IS NOT NULL
          AND p.reservation_expires_at <= NOW()
          AND (p.concur_po_number IS NULL OR TRIM(p.concur_po_number) = '')
        FOR UPDATE OF p SKIP LOCKED
    LOOP
        -- 1. Update status to CANCELLED
        UPDATE public.po_requests
        SET 
            status = 'CANCELLED',
            cancellation_reason = 'Automatically cancelled: Concur PO # was not entered within 48 hours of approval. Reserved supplier stock has been released.',
            auto_cancelled_at = NOW()
        WHERE id = v_po.id;

        -- 2. Insert approval audit history event
        INSERT INTO public.po_approvals (
            id,
            po_request_id,
            approver_name,
            action,
            date,
            comments
        ) VALUES (
            gen_random_uuid(),
            v_po.id,
            'System Automation',
            'SYSTEM_CANCELLED',
            NOW(),
            '48-Hour stock reservation expired without Concur PO # linking.'
        );

        -- 3. Insert in-app user notification
        IF v_po.requester_id IS NOT NULL THEN
            INSERT INTO public.user_notifications (
                id,
                user_id,
                title,
                message,
                link,
                is_read,
                created_at
            ) VALUES (
                gen_random_uuid(),
                v_po.requester_id,
                'Request Auto-Cancelled: Stock Reservation Expired',
                format('Request %s (%s) has been automatically cancelled because a Concur PO # was not linked within 48 hours. Reserved stock has been returned to the available pool.', 
                       COALESCE(v_po.display_id, v_po.id::text), COALESCE(v_po.supplier_name, 'Supplier')),
                format('/requests/%s', v_po.id),
                false,
                NOW()
            );
        END IF;

        -- 4. Record in system audit logs
        INSERT INTO public.system_audit_logs (
            action_type,
            performed_by,
            summary,
            details
        ) VALUES (
            'PO_AUTO_CANCELLED_RESERVATION_EXPIRED',
            '00000000-0000-0000-0000-000000000000'::uuid,
            jsonb_build_object('po_id', v_po.id, 'display_id', v_po.display_id, 'reason', '48h reservation expired'),
            jsonb_build_object(
                'requester_id', v_po.requester_id, 
                'requester_name', v_po.requester_name,
                'total_amount', v_po.total_amount,
                'supplier_id', v_po.supplier_id,
                'supplier_name', v_po.supplier_name
            )
        );

        v_cancelled_count := v_cancelled_count + 1;
        v_cancelled_items := v_cancelled_items || jsonb_build_object(
            'id', v_po.id,
            'display_id', COALESCE(v_po.display_id, v_po.id::text),
            'requester_id', v_po.requester_id,
            'requester_name', v_po.requester_name,
            'requester_email', v_po.requester_email,
            'supplier_name', v_po.supplier_name,
            'total_amount', v_po.total_amount
        );
    END LOOP;

    RETURN jsonb_build_object(
        'cancelled_count', v_cancelled_count,
        'cancelled_items', v_cancelled_items
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_reservations() TO authenticated, service_role;

-- 5. Seed Notification Template
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_templates') THEN
        INSERT INTO public.notification_templates (
            template_key,
            name,
            description,
            event_type,
            category,
            channels,
            variables,
            is_system
        ) VALUES (
            'PO_CANCELLED_RESERVATION_EXPIRED',
            'PO Reservation Expired Auto-Cancellation',
            'Dispatched to requester when a purchase order is automatically cancelled due to 48-hour Concur PO expiry',
            'PO_CANCELLED_RESERVATION_EXPIRED',
            'REQUEST_UPDATE',
            jsonb_build_object(
                'email', jsonb_build_object(
                    'enabled', true,
                    'subject', 'Request {{display_id}} Cancelled — Stock Reservation Expired',
                    'cta_label', 'View Request Details',
                    'html_body', '<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;"><h2 style="color: #ef4444;">Request Auto-Cancelled: Stock Reservation Expired</h2><p style="color: #4b5563;">Hello {{requester_name}},</p><p style="color: #4b5563;">Your purchase request <strong>{{display_id}}</strong> for <strong>{{supplier_name}}</strong> has been automatically cancelled because a Concur PO # was not entered within 48 hours of approval.</p><p style="color: #4b5563;">The reserved supplier stock has been returned to the available inventory pool for other users to request against.</p><p style="color: #4b5563;">If you still require these items, please submit a new request through ProcureFlow.</p></div>'
                ),
                'in_app', jsonb_build_object(
                    'enabled', true,
                    'title', 'Request Auto-Cancelled: Stock Reservation Expired',
                    'body', 'Request {{display_id}} for {{supplier_name}} was cancelled after 48h without Concur PO. Reserved stock released.',
                    'severity', 'ERROR',
                    'action_label', 'View Request'
                )
            ),
            '["display_id", "requester_name", "supplier_name", "total_amount", "action_url"]'::jsonb,
            true
        )
        ON CONFLICT (template_key) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            channels = EXCLUDED.channels,
            variables = EXCLUDED.variables,
            updated_at = NOW();
    END IF;
END $$;

-- 6. Enhance link_concur_po_number to track concur_linked_at and clear reservation expiry
CREATE OR REPLACE FUNCTION public.link_concur_po_number(
    p_po_id uuid,
    p_concur_po_number text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_requester_id uuid;
    v_status text;
    v_concur_req_num text;
    v_trimmed_po_number text;
    v_can_link boolean;
BEGIN
    v_trimmed_po_number := btrim(coalesce(p_concur_po_number, ''));

    IF v_trimmed_po_number = '' THEN
        RAISE EXCEPTION 'A valid Concur PO number is required.';
    END IF;

    SELECT requester_id, status, concur_request_number
    INTO v_requester_id, v_status, v_concur_req_num
    FROM public.po_requests
    WHERE id = p_po_id;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Request % not found.', p_po_id;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.roles r ON r.id = u.role_id
        WHERE u.auth_user_id = auth.uid()
        AND (
            r.id = 'ADMIN'
            OR 'link_concur' = ANY(COALESCE(r.permissions, '{}'::text[]))
            OR u.id = v_requester_id
        )
    ) INTO v_can_link;

    IF NOT v_can_link THEN
        RAISE EXCEPTION 'You do not have permission to link this Concur PO.';
    END IF;

    IF v_status NOT IN ('APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR', 'ACTIVE') THEN
        RAISE EXCEPTION 'Concur PO numbers can only be linked during active entry steps (current status: %).', v_status;
    END IF;

    UPDATE public.po_lines
    SET concur_po_number = v_trimmed_po_number
    WHERE po_request_id = p_po_id;

    UPDATE public.po_requests
    SET 
        concur_po_number = v_trimmed_po_number,
        concur_linked_at = NOW(),
        reservation_expires_at = NULL,
        status = CASE 
            WHEN v_status = 'APPROVED_PENDING_CONCUR' THEN 'ACTIVE'
            WHEN v_status = 'APPROVED_PENDING_CONCUR_REQUEST' AND v_concur_req_num IS NOT NULL THEN 'ACTIVE'
            ELSE status
        END
    WHERE id = p_po_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_concur_po_number(uuid, text) TO authenticated;

-- 7. Register pg_cron Job (if available)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Remove existing job if present
        PERFORM cron.unschedule('expire-stale-reservations-15m');
        -- Schedule to run every 15 minutes
        PERFORM cron.schedule(
            'expire-stale-reservations-15m',
            '*/15 * * * *',
            'SELECT public.expire_stale_reservations();'
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

