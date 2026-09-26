-- ==============================================================================
-- Migration: 20260927000000_re_reserve_stock.sql
-- Description: Supports re-reserving supplier stock on auto-cancelled requests
--              and updates expiration wording to "Stock Reservation Cancelled".
-- ==============================================================================

-- 1. Atomic Stored Procedure: re_reserve_po_stock
CREATE OR REPLACE FUNCTION public.re_reserve_po_stock(
    p_po_id UUID,
    p_user_name TEXT DEFAULT 'User'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_po RECORD;
    v_new_expiry TIMESTAMPTZ;
BEGIN
    -- Advisory lock to prevent race conditions on this specific PO
    PERFORM pg_advisory_xact_lock(hashtext(concat('re_reserve_po_stock_', p_po_id::text)));

    SELECT * INTO v_po FROM public.po_requests WHERE id = p_po_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PO request % not found.', p_po_id;
    END IF;

    -- Only allow re-reserving if status is CANCELLED (or reservation expired)
    IF v_po.status != 'CANCELLED' AND v_po.auto_cancelled_at IS NULL THEN
        RAISE EXCEPTION 'This request is not in a cancelled reservation state.';
    END IF;

    -- Fresh 48-hour reservation window from now
    v_new_expiry := NOW() + INTERVAL '48 hours';

    -- 1. Restore PO status and reset 48-hour reservation window
    UPDATE public.po_requests
    SET
        status = 'APPROVED_PENDING_CONCUR',
        reservation_expires_at = v_new_expiry,
        auto_cancelled_at = NULL,
        cancellation_reason = NULL
    WHERE id = p_po_id;

    -- 2. Insert audit event into po_approvals
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
        COALESCE(NULLIF(TRIM(p_user_name), ''), 'User'),
        'STOCK_RE_RESERVED',
        NOW(),
        'Supplier stock re-reserved for 48 hours. Awaiting Concur PO #.'
    );

    -- 3. Notify requester
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
                'Stock Reservation Reinstated (48 Hours)',
                format('Stock reservation for %s has been reinstated for 48 hours by %s. Please link the Concur PO #.', 
                       COALESCE(v_po.display_id, v_po.id::text), COALESCE(NULLIF(TRIM(p_user_name), ''), 'User')),
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
            'PO_STOCK_RE_RESERVED',
            auth.uid(),
            jsonb_build_object('po_id', v_po.id, 'display_id', v_po.display_id, 'action', 'Stock Re-Reserved for 48h'),
            jsonb_build_object('user', p_user_name, 'new_expires_at', v_new_expiry)
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'po_id', p_po_id,
        'display_id', v_po.display_id,
        'status', 'APPROVED_PENDING_CONCUR',
        'reservation_expires_at', v_new_expiry
    );
END;
$$;

-- 2. Update expire_stale_reservations with clearer "Stock Reservation Cancelled" wording
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
        -- 1. Update status to CANCELLED with updated "Stock Reservation Cancelled" reason
        UPDATE public.po_requests
        SET 
            status = 'CANCELLED',
            cancellation_reason = 'Stock reservation cancelled: Concur PO # was not entered within 48 hours of approval. Reserved supplier stock has been released. Stock can be re-reserved when ready.',
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
            '48-Hour stock reservation expired without Concur PO # linking. Stock reservation cancelled.'
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
                    format('Stock reservation for %s (%s) was cancelled because a Concur PO # was not linked within 48 hours. Request approval remains valid and stock can be re-reserved in ProcureFlow.', 
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
                jsonb_build_object('po_id', v_po.id, 'display_id', v_po.display_id, 'reason', '48h reservation expired'),
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
