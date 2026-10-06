-- Apply the same elapsed-time fallback to legacy requests during Concur handover.
CREATE OR REPLACE FUNCTION private.link_concur_request_number(
    p_po_id uuid,
    p_concur_request_number text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_requester_id uuid;
    v_status text;
    v_trimmed_request_number text;
    v_can_link boolean;
    v_has_po_number boolean;
    v_user_name text;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('re_reserve_po_stock_'||p_po_id::text));
    v_trimmed_request_number := btrim(coalesce(p_concur_request_number, ''));

    IF v_trimmed_request_number = '' THEN
        RAISE EXCEPTION 'A valid Concur Request number is required.';
    END IF;

    SELECT requester_id, status
    INTO v_requester_id, v_status
    FROM public.po_requests
    WHERE id = p_po_id FOR UPDATE;

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

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE auth_user_id=auth.uid() AND status IN ('APPROVED','ACTIVE')) THEN
        RAISE EXCEPTION 'An approved user is required.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.po_requests WHERE id=p_po_id AND
        (status='CANCELLED' OR (status IN ('APPROVED_PENDING_CONCUR','APPROVED_PENDING_CONCUR_REQUEST')
          AND nullif(btrim(coalesce(concur_request_number,'')),'') IS NULL AND coalesce(reservation_expires_at,coalesce(approved_at,updated_at,request_date)+interval '48 hours','-infinity'::timestamptz)<=now()))) THEN
        IF v_status='CANCELLED' AND NOT EXISTS(SELECT 1 FROM public.po_requests WHERE id=p_po_id AND auto_cancelled_at IS NOT NULL) THEN
            RAISE EXCEPTION 'A manually cancelled request cannot be reinstated by linking Concur.';
        END IF;
        PERFORM private.assert_reservation_capacity(p_po_id);
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
CREATE OR REPLACE FUNCTION private.link_concur_po_number(
    p_po_id uuid,
    p_concur_po_number text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_requester_id uuid;
    v_status text;
    v_concur_req_num text;
    v_trimmed_po_number text;
    v_can_link boolean;
    v_user_name text;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('re_reserve_po_stock_'||p_po_id::text));
    v_trimmed_po_number := btrim(coalesce(p_concur_po_number, ''));

    IF v_trimmed_po_number = '' THEN
        RAISE EXCEPTION 'A valid Concur PO number is required.';
    END IF;

    SELECT requester_id, status, concur_request_number
    INTO v_requester_id, v_status, v_concur_req_num
    FROM public.po_requests
    WHERE id = p_po_id FOR UPDATE;

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

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE auth_user_id=auth.uid() AND status IN ('APPROVED','ACTIVE')) THEN
        RAISE EXCEPTION 'An approved user is required.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.po_requests WHERE id=p_po_id AND
        (status='CANCELLED' OR (status IN ('APPROVED_PENDING_CONCUR','APPROVED_PENDING_CONCUR_REQUEST')
          AND nullif(btrim(coalesce(concur_request_number,'')),'') IS NULL AND coalesce(reservation_expires_at,coalesce(approved_at,updated_at,request_date)+interval '48 hours','-infinity'::timestamptz)<=now()))) THEN
        IF v_status='CANCELLED' AND NOT EXISTS(SELECT 1 FROM public.po_requests WHERE id=p_po_id AND auto_cancelled_at IS NOT NULL) THEN
            RAISE EXCEPTION 'A manually cancelled request cannot be reinstated by linking Concur.';
        END IF;
        PERFORM private.assert_reservation_capacity(p_po_id);
    END IF;

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
