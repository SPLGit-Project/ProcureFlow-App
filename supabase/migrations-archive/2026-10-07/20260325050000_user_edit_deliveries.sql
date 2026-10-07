-- Migration: 20260325050000_user_edit_deliveries.sql

-- 1. Add received_by_id to deliveries table to track who entered the record
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'received_by_id') THEN
        ALTER TABLE public.deliveries ADD COLUMN received_by_id uuid REFERENCES public.users(id);
    END IF;
END $$;

-- 2. Update the RPC logic to allow non-admin users with 'receive_goods' permission to edit deliveries at their sites
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
    v_new_status text := 'PARTIALLY_RECEIVED';
    l_line record;
    v_is_admin boolean;
    v_has_receive_permission boolean;
    v_user_sites text[]; -- site_ids are stored as text array in public.users
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
    -- Check if user is ADMIN or (has permission AND PO site is in their site list)
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
    v_new_status := 'RECEIVED';

    FOR l_line IN (SELECT quantity_ordered, quantity_received, is_force_closed FROM public.po_lines WHERE po_request_id = v_po_request_id) LOOP
        IF l_line.quantity_received > l_line.quantity_ordered THEN
            v_variance_triggered := true;
        END IF;
        IF COALESCE(l_line.is_force_closed, false) AND l_line.quantity_received < l_line.quantity_ordered THEN
            v_variance_triggered := true;
        END IF;

        IF l_line.quantity_received < l_line.quantity_ordered AND NOT COALESCE(l_line.is_force_closed, false) THEN
            v_new_status := 'PARTIALLY_RECEIVED';
        END IF;
    END LOOP;

    IF v_variance_triggered THEN
        v_new_status := 'VARIANCE_PENDING';
    END IF;

    UPDATE public.po_requests SET status = v_new_status WHERE id = v_po_request_id;
END;
$$;

-- 3. Update RLS policies
DROP POLICY IF EXISTS "Admin and Receivers mutate deliveries" ON public.deliveries;
CREATE POLICY "Admin and Receivers mutate deliveries" ON public.deliveries
FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        JOIN public.roles r ON u.role_id = r.id
        JOIN public.po_requests pqr ON public.deliveries.po_request_id = pqr.id
        WHERE u.auth_user_id = auth.uid()
        AND (
            r.id = 'ADMIN' OR 
            ('receive_goods' = ANY(r.permissions) AND pqr.site_id::text = ANY(u.site_ids))
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users u
        JOIN public.roles r ON u.role_id = r.id
        JOIN public.po_requests pqr ON public.deliveries.po_request_id = pqr.id
        WHERE u.auth_user_id = auth.uid()
        AND (
            r.id = 'ADMIN' OR 
            ('receive_goods' = ANY(r.permissions) AND pqr.site_id::text = ANY(u.site_ids))
        )
    )
);

DROP POLICY IF EXISTS "Admin and Receivers mutate delivery_lines" ON public.delivery_lines;
CREATE POLICY "Admin and Receivers mutate delivery_lines" ON public.delivery_lines
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        JOIN public.roles r ON u.role_id = r.id
        JOIN public.deliveries d ON public.delivery_lines.delivery_id = d.id
        JOIN public.po_requests pqr ON d.po_request_id = pqr.id
        WHERE u.auth_user_id = auth.uid()
        AND (
            r.id = 'ADMIN' OR 
            ('receive_goods' = ANY(r.permissions) AND pqr.site_id::text = ANY(u.site_ids))
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users u
        JOIN public.roles r ON u.role_id = r.id
        JOIN public.deliveries d ON public.delivery_lines.delivery_id = d.id
        JOIN public.po_requests pqr ON d.po_request_id = pqr.id
        WHERE u.auth_user_id = auth.uid()
        AND (
            r.id = 'ADMIN' OR 
            ('receive_goods' = ANY(r.permissions) AND pqr.site_id::text = ANY(u.site_ids))
        )
    )
);
