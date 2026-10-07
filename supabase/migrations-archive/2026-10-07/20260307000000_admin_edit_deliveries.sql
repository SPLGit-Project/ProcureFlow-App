-- Allow admins to edit delivery quantities and maintaining PO status integrity

create or replace function public.admin_update_delivery_line_qty(
    p_line_id uuid,
    p_new_qty numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_po_line_id uuid;
    v_po_request_id uuid;
    v_total_received numeric;
    v_variance_triggered boolean := false;
    v_new_status text := 'PARTIALLY_RECEIVED';
    l_line record;
    v_is_admin boolean;
begin
    -- Check if user is an ADMIN
    select exists (
        select 1 from public.users u 
        join public.roles r on u.role_id = r.id 
        where u.auth_user_id = auth.uid() and r.id = 'ADMIN'
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
    v_new_status := 'RECEIVED'; -- assume received unless proven otherwise

    for l_line in (select quantity_ordered, quantity_received, is_force_closed from public.po_lines where po_request_id = v_po_request_id) loop
        if l_line.quantity_received > l_line.quantity_ordered then
            v_variance_triggered := true;
        end if;
        if coalesce(l_line.is_force_closed, false) and l_line.quantity_received < l_line.quantity_ordered then
            v_variance_triggered := true;
        end if;

        if l_line.quantity_received < l_line.quantity_ordered and not coalesce(l_line.is_force_closed, false) then
            v_new_status := 'PARTIALLY_RECEIVED';
        end if;
    end loop;

    if v_variance_triggered then
        v_new_status := 'VARIANCE_PENDING';
    end if;

    update public.po_requests set status = v_new_status where id = v_po_request_id;
end;
$$;
