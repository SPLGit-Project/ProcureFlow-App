-- Migration: Final removal of 'PARTIALLY_RECEIVED' status
-- Created: 2026-04-30
-- Description: Corrects the admin_update_delivery_line_qty RPC to use 'ACTIVE' 
-- instead of the legacy 'PARTIALLY_RECEIVED' status, and sanitizes existing records.

-- 1. Sanitize existing data
UPDATE public.po_requests 
SET status = 'ACTIVE' 
WHERE status = 'PARTIALLY_RECEIVED';

-- 2. Update the RPC logic
CREATE OR REPLACE FUNCTION public.admin_update_delivery_line_qty(
    p_line_id uuid,
    p_new_qty numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_po_line_id uuid;
    v_po_request_id uuid;
    v_site_id uuid;
    v_total_received numeric;
    v_variance_triggered boolean := false;
    v_new_status text := 'ACTIVE';
    l_line record;
    v_is_admin boolean;
    v_has_receive_permission boolean;
    v_user_sites text[]; 
    v_can_edit boolean;
BEGIN
    -- 1. Permission Check
    SELECT 
        (r.id = 'ADMIN'),
        ('receive_goods' = ANY(r.permissions)),
        u.site_ids
    INTO v_is_admin, v_has_receive_permission, v_user_sites
    FROM public.users u 
    JOIN public.roles r ON u.role_id = r.id 
    WHERE u.auth_user_id = auth.uid();

    -- 2. Get References and Site Context
    SELECT dl.po_line_id, pl.po_request_id, pqr.site_id
    INTO v_po_line_id, v_po_request_id, v_site_id
    FROM public.delivery_lines dl
    JOIN public.po_lines pl ON dl.po_line_id = pl.id
    JOIN public.po_requests pqr ON pl.po_request_id = pqr.id
    WHERE dl.id = p_line_id;

    IF v_po_line_id IS NULL THEN
        RAISE EXCEPTION 'Delivery line not found';
    END IF;

    -- 3. Authorization logic
    v_can_edit := COALESCE(v_is_admin, false) OR (
        COALESCE(v_has_receive_permission, false) AND (v_site_id::text = ANY(v_user_sites))
    );

    IF NOT v_can_edit THEN
        RAISE EXCEPTION 'You do not have permission to edit this delivery record.';
    END IF;

    -- 4. Update delivery_lines
    UPDATE public.delivery_lines SET quantity = p_new_qty WHERE id = p_line_id;

    -- 5. Recalculate and update po_lines received_quantity
    SELECT COALESCE(SUM(quantity), 0) INTO v_total_received
    FROM public.delivery_lines WHERE po_line_id = v_po_line_id;

    UPDATE public.po_lines SET quantity_received = v_total_received WHERE id = v_po_line_id;

    -- 6. Re-evaluate PO Request status
    -- Logic: Default to 'RECEIVED'. If any line is short and not force-closed, set to 'ACTIVE'.
    v_new_status := 'RECEIVED';

    FOR l_line IN (SELECT quantity_ordered, quantity_received, is_force_closed FROM public.po_lines WHERE po_request_id = v_po_request_id) LOOP
        -- Check for Variance (Over-delivery)
        IF l_line.quantity_received > l_line.quantity_ordered THEN
            v_variance_triggered := true;
        END IF;
        
        -- Check for Variance (Short-close)
        IF COALESCE(l_line.is_force_closed, false) AND l_line.quantity_received < l_line.quantity_ordered THEN
            v_variance_triggered := true;
        END IF;

        -- If any line is still pending (not fully received and not force closed), PO is 'ACTIVE'
        IF l_line.quantity_received < l_line.quantity_ordered AND NOT COALESCE(l_line.is_force_closed, false) THEN
            v_new_status := 'ACTIVE';
        END IF;
    END LOOP;

    -- Variance takes precedence over ACTIVE/RECEIVED
    IF v_variance_triggered THEN
        v_new_status := 'VARIANCE_PENDING';
    END IF;

    -- 7. Update the PO status
    UPDATE public.po_requests SET status = v_new_status WHERE id = v_po_request_id;
END;
$$;
