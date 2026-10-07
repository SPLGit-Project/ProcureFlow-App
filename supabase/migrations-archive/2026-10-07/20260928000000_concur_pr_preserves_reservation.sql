-- ==============================================================================
-- Migration: 20260928000000_concur_pr_preserves_reservation.sql
-- Description:
-- 1. Updates expire_stale_reservations() so requests with an active Concur Request #
--    (concur_request_number) are NEVER auto-cancelled, preserving the reservation
--    while awaiting Concur PO issuance.
-- 2. Updates link_concur_request_number() and link_concur_po_number() to allow linking
--    from CANCELLED state, automatically clearing the cancelled status and reinstating
--    the request.
-- 3. Restores historical requests that were erroneously cancelled despite having a Concur PR #.
-- ==============================================================================

-- 1. Update expire_stale_reservations to NEVER cancel orders with an active Concur Request #
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
          AND (p.concur_request_number IS NULL OR TRIM(p.concur_request_number) = '')
          AND (p.concur_po_number IS NULL OR TRIM(p.concur_po_number) = '')
        FOR UPDATE OF p SKIP LOCKED
    LOOP
        -- 1. Update status to CANCELLED with updated "Stock Reservation Cancelled" reason
        UPDATE public.po_requests
        SET 
            status = 'CANCELLED',
            cancellation_reason = 'Stock reservation cancelled: Concur Request # was not entered within 48 hours of approval. Reserved supplier stock has been released. Stock can be re-reserved when ready, or link Concur Request # to reinstate.',
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
            '48-Hour stock reservation expired without Concur Request # linking. Stock reservation cancelled.'
        );

        -- 3. Insert in-app user notification
        BEGIN
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
                    'Stock Reservation Cancelled: 48-Hour Window Expired',
                    format('Stock reservation for %s (%s) was cancelled because a Concur Request # was not linked within 48 hours. Request approval remains valid and stock can be re-reserved or linked in ProcureFlow.', 
                           COALESCE(v_po.display_id, v_po.id::text), COALESCE(v_po.supplier_name, 'Supplier')),
                    format('/requests/%s', v_po.id),
                    false,
                    NOW()
                );
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;

        -- 4. Record in system audit logs
        BEGIN
            INSERT INTO public.system_audit_logs (
                action_type,
                performed_by,
                summary,
                details
            ) VALUES (
                'PO_STOCK_RESERVATION_CANCELLED_EXPIRED',
                auth.uid(),
                jsonb_build_object('po_id', v_po.id, 'display_id', v_po.display_id, 'reason', '48h reservation expired without Concur Request #'),
                jsonb_build_object(
                    'requester_id', v_po.requester_id, 
                    'total_amount', v_po.total_amount,
                    'supplier_name', v_po.supplier_name
                )
            );
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;

        -- Accumulate telemetry
        v_cancelled_count := v_cancelled_count + 1;
        v_cancelled_items := v_cancelled_items || jsonb_build_object(
            'id', v_po.id,
            'display_id', v_po.display_id,
            'requester_id', v_po.requester_id,
            'requester_name', v_po.requester_name,
            'requester_email', v_po.requester_email,
            'supplier_name', v_po.supplier_name,
            'total_amount', v_po.total_amount
        );
    END LOOP;

    RETURN jsonb_build_object(
        'cancelled_count', v_cancelled_count,
        'cancelled_items', v_cancelled_items,
        'executed_at', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_reservations() TO authenticated, service_role;

-- 2. Update link_concur_request_number to support un-cancelling a cancelled reservation
CREATE OR REPLACE FUNCTION public.link_concur_request_number(
    p_po_id uuid,
    p_concur_request_number text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_requester_id uuid;
    v_status text;
    v_trimmed_request_number text;
    v_can_link boolean;
    v_has_po_number boolean;
    v_user_name text;
BEGIN
    v_trimmed_request_number := btrim(coalesce(p_concur_request_number, ''));

    IF v_trimmed_request_number = '' THEN
        RAISE EXCEPTION 'A valid Concur Request number is required.';
    END IF;

    SELECT requester_id, status
    INTO v_requester_id, v_status
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
        RAISE EXCEPTION 'You do not have permission to link this Concur Request.';
    END IF;

    IF v_status NOT IN ('APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR', 'ACTIVE', 'CANCELLED') THEN
        RAISE EXCEPTION 'Concur Request numbers can only be linked during active entry steps or cancelled reservations (current status: %).', v_status;
    END IF;

    -- Check if PO numbers are already populated
    SELECT EXISTS (
        SELECT 1 FROM public.po_lines
        WHERE po_request_id = p_po_id
        AND concur_po_number IS NOT NULL AND btrim(concur_po_number) <> ''
    ) INTO v_has_po_number;

    -- Get linking user name
    SELECT COALESCE(name, 'User') INTO v_user_name
    FROM public.users
    WHERE auth_user_id = auth.uid()
    LIMIT 1;

    UPDATE public.po_requests
    SET
        concur_request_number = v_trimmed_request_number,
        status = CASE 
            WHEN v_has_po_number THEN 'ACTIVE'
            ELSE 'APPROVED_PENDING_CONCUR'
        END,
        cancellation_reason = CASE WHEN v_status = 'CANCELLED' THEN NULL ELSE cancellation_reason END,
        auto_cancelled_at = CASE WHEN v_status = 'CANCELLED' THEN NULL ELSE auto_cancelled_at END
    WHERE id = p_po_id;

    -- Audit history
    INSERT INTO public.po_approvals (
        id,
        po_request_id,
        approver_name,
        action,
        date,
        comments
    ) VALUES (
        gen_random_uuid(),
        p_po_id,
        COALESCE(v_user_name, 'User'),
        'CONCUR_REQUEST_LINKED',
        NOW(),
        CASE 
            WHEN v_status = 'CANCELLED' THEN 'Concur Request #' || v_trimmed_request_number || ' linked. Stock reservation reinstated (Cancelled state removed).'
            ELSE 'Concur Request #' || v_trimmed_request_number || ' linked. Awaiting Concur PO #.'
        END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_concur_request_number(uuid, text) TO authenticated, service_role;

-- 3. Update link_concur_po_number to support linking from cancelled reservation
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
    v_user_name text;
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

    IF v_status NOT IN ('APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR', 'ACTIVE', 'CANCELLED') THEN
        RAISE EXCEPTION 'Concur PO numbers can only be linked during active entry steps or cancelled reservations (current status: %).', v_status;
    END IF;

    -- Get linking user name
    SELECT COALESCE(name, 'User') INTO v_user_name
    FROM public.users
    WHERE auth_user_id = auth.uid()
    LIMIT 1;

    UPDATE public.po_lines
    SET concur_po_number = v_trimmed_po_number
    WHERE po_request_id = p_po_id;

    UPDATE public.po_requests
    SET 
        concur_po_number = v_trimmed_po_number,
        concur_linked_at = NOW(),
        reservation_expires_at = NULL,
        cancellation_reason = CASE WHEN v_status = 'CANCELLED' THEN NULL ELSE cancellation_reason END,
        auto_cancelled_at = CASE WHEN v_status = 'CANCELLED' THEN NULL ELSE auto_cancelled_at END,
        status = 'ACTIVE'
    WHERE id = p_po_id;

    INSERT INTO public.po_approvals (
        id,
        po_request_id,
        approver_name,
        action,
        date,
        comments
    ) VALUES (
        gen_random_uuid(),
        p_po_id,
        COALESCE(v_user_name, 'User'),
        'CONCUR_PO_LINKED',
        NOW(),
        'Concur PO #' || v_trimmed_po_number || ' linked. Order is now Active.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_concur_po_number(uuid, text) TO authenticated, service_role;

-- 4. Restore the 7 requests that were falsely marked CANCELLED despite having Concur Request #
UPDATE public.po_requests
SET
    status = 'APPROVED_PENDING_CONCUR',
    cancellation_reason = NULL,
    auto_cancelled_at = NULL
WHERE status = 'CANCELLED'
  AND concur_request_number IS NOT NULL
  AND TRIM(concur_request_number) != '';

-- Insert approval history event for each restored request
INSERT INTO public.po_approvals (
    id,
    po_request_id,
    approver_name,
    action,
    date,
    comments
)
SELECT
    gen_random_uuid(),
    p.id,
    'System Automation',
    'STOCK_RESERVATION_RESTORED',
    NOW(),
    format('Stock reservation restored: Concur PR #%s is lodged. Order status updated to Pending Concur PO.', p.concur_request_number)
FROM public.po_requests p
WHERE p.status = 'APPROVED_PENDING_CONCUR'
  AND p.concur_request_number IS NOT NULL
  AND TRIM(p.concur_request_number) != ''
  AND NOT EXISTS (
      SELECT 1 FROM public.po_approvals a
      WHERE a.po_request_id = p.id AND a.action = 'STOCK_RESERVATION_RESTORED'
  );
