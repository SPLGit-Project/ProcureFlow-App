-- Migration: Remove 'PARTIALLY_RECEIVED' status
-- Created: 2026-04-20

-- 1. Update existing records
UPDATE public.po_requests 
SET status = 'ACTIVE' 
WHERE status = 'PARTIALLY_RECEIVED';

-- 2. Update the admin function to use 'ACTIVE' instead of 'PARTIALLY_RECEIVED'
CREATE OR REPLACE FUNCTION "public"."admin_update_delivery_line_qty"("p_line_id" "uuid", "p_new_qty" numeric) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
    v_po_line_id uuid;
    v_po_request_id uuid;
    v_total_received numeric;
    v_new_status public.po_status_type; -- Using the custom type if it exists, or just let it be handled as string
    v_is_admin boolean;
    v_variance_triggered boolean := false;
begin
    -- Check admin
    select (
        select r.id = 'ADMIN'
        from public.users u
        join public.roles r on u.role_id = r.id 
        where u.auth_user_id = auth.uid()
    ) into v_is_admin;

    if not v_is_admin then
        raise exception 'Only administrators can perform this action.';
    end if;

    -- 1. Get references
    select po_line_id into v_po_line_id from public.delivery_lines where id = p_line_id;
    if v_po_line_id is null then
        raise exception 'Delivery line not found';
    end if;

    select po_request_id into v_po_request_id from public.po_lines where id = v_po_line_id;

    -- 2. Update delivery_lines
    update public.delivery_lines set quantity = p_new_qty where id = p_line_id;

    -- 3. Recalculate and update po_lines received_quantity
    select coalesce(sum(quantity), 0) into v_total_received
    from public.delivery_lines where po_line_id = v_po_line_id;

    update public.po_lines set quantity_received = v_total_received where id = v_po_line_id;

    -- 4. Re-evaluate PO Request status
    -- Logic: If everything is received or force closed, set to 'RECEIVED'
    -- Otherwise, it stays 'ACTIVE' (we no longer use 'PARTIALLY_RECEIVED')
    v_new_status := 'RECEIVED'; 

    for v_po_line_id in (select id from public.po_lines where po_request_id = v_po_request_id) loop
        declare
            l_line record;
        begin
            select quantity_ordered, quantity_received, is_force_closed into l_line 
            from public.po_lines where id = v_po_line_id;

            if l_line.quantity_received > l_line.quantity_ordered then
                v_variance_triggered := true;
            end if;
            if coalesce(l_line.is_force_closed, false) and l_line.quantity_received < l_line.quantity_ordered then
                v_variance_triggered := true;
            end if;

            if l_line.quantity_received < l_line.quantity_ordered and not coalesce(l_line.is_force_closed, false) then
                v_new_status := 'ACTIVE'; -- Changed from 'PARTIALLY_RECEIVED'
            end if;
        end;
    end loop;

    if v_variance_triggered then
        v_new_status := 'VARIANCE_PENDING';
    end if;

    update public.po_requests set status = v_new_status where id = v_po_request_id;
end;
$$;
