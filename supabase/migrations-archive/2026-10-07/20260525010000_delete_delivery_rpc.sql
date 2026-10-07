-- Add transactional delivery deletion for the request delivery edit screen.

CREATE OR REPLACE FUNCTION public.delete_delivery(
    p_delivery_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_po_request_id uuid;
    v_site_id uuid;
    v_is_admin boolean := false;
    v_has_receive_permission boolean := false;
    v_user_sites text[] := ARRAY[]::text[];
    v_can_edit boolean := false;
    v_affected_po_line_ids uuid[];
    v_variance_triggered boolean := false;
    v_new_status text := 'ACTIVE';
    l_line record;
BEGIN
    SELECT d.po_request_id, pqr.site_id
    INTO v_po_request_id, v_site_id
    FROM public.deliveries d
    JOIN public.po_requests pqr ON pqr.id = d.po_request_id
    WHERE d.id = p_delivery_id;

    IF v_po_request_id IS NULL THEN
        RAISE EXCEPTION 'Delivery not found';
    END IF;

    SELECT COALESCE(u.site_ids, ARRAY[]::text[])
    INTO v_user_sites
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    LIMIT 1;

    SELECT EXISTS (
        SELECT 1
        FROM public.users u
        LEFT JOIN public.user_roles ur ON ur.user_id = u.id
        JOIN public.roles r ON r.id = u.role_id OR r.id = ur.role_id
        WHERE u.auth_user_id = auth.uid()
        AND r.id = 'ADMIN'
    ) INTO v_is_admin;

    SELECT EXISTS (
        SELECT 1
        FROM public.users u
        LEFT JOIN public.user_roles ur ON ur.user_id = u.id
        JOIN public.roles r ON r.id = u.role_id OR r.id = ur.role_id
        WHERE u.auth_user_id = auth.uid()
        AND 'receive_goods' = ANY(r.permissions)
    ) INTO v_has_receive_permission;

    v_can_edit := COALESCE(v_is_admin, false) OR (
        COALESCE(v_has_receive_permission, false) AND (v_site_id::text = ANY(v_user_sites))
    );

    IF NOT v_can_edit THEN
        RAISE EXCEPTION 'You do not have permission to delete this delivery record.';
    END IF;

    SELECT COALESCE(ARRAY_AGG(DISTINCT po_line_id), ARRAY[]::uuid[])
    INTO v_affected_po_line_ids
    FROM public.delivery_lines
    WHERE delivery_id = p_delivery_id;

    DELETE FROM public.deliveries
    WHERE id = p_delivery_id;

    UPDATE public.po_lines pl
    SET quantity_received = COALESCE(received.total_received, 0)
    FROM (
        SELECT affected.po_line_id, COALESCE(SUM(dl.quantity), 0) AS total_received
        FROM UNNEST(v_affected_po_line_ids) AS affected(po_line_id)
        LEFT JOIN public.delivery_lines dl ON dl.po_line_id = affected.po_line_id
        GROUP BY affected.po_line_id
    ) received
    WHERE pl.id = received.po_line_id;

    v_new_status := 'RECEIVED';

    FOR l_line IN (
        SELECT quantity_ordered, quantity_received, is_force_closed
        FROM public.po_lines
        WHERE po_request_id = v_po_request_id
    ) LOOP
        IF l_line.quantity_received > l_line.quantity_ordered THEN
            v_variance_triggered := true;
        END IF;

        IF COALESCE(l_line.is_force_closed, false) AND l_line.quantity_received < l_line.quantity_ordered THEN
            v_variance_triggered := true;
        END IF;

        IF l_line.quantity_received < l_line.quantity_ordered AND NOT COALESCE(l_line.is_force_closed, false) THEN
            v_new_status := 'ACTIVE';
        END IF;
    END LOOP;

    IF v_variance_triggered THEN
        v_new_status := 'VARIANCE_PENDING';
    END IF;

    UPDATE public.po_requests
    SET status = v_new_status
    WHERE id = v_po_request_id;
END;
$$;
