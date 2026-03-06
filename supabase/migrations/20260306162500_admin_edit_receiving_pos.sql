-- Allow admins to edit POs in any state and perform Upsert on PO lines.

create or replace function public.update_pending_po_request(
    p_request_id uuid,
    p_header jsonb,
    p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_status text;
    v_requester_id uuid;
    l_line jsonb;
    v_is_admin boolean;
begin
    -- Check if user is an ADMIN
    select exists (
        select 1 from public.users u 
        join public.roles r on u.role_id = r.id 
        where u.auth_user_id = auth.uid() and r.id = 'ADMIN'
    ) into v_is_admin;

    -- Verify request exists and get details
    select status, requester_id into v_status, v_requester_id from public.po_requests where id = p_request_id;
    if v_status is null then
        raise exception 'Request % not found', p_request_id;
    end if;

    -- Enforce status and ownership rules for non-admins
    if not v_is_admin then
        if v_status != 'PENDING_APPROVAL' then
            raise exception 'Only PENDING_APPROVAL requests can be edited (current status: %)', v_status;
        end if;
        if auth.uid() not in (select auth_user_id from public.users where id = v_requester_id) then
            raise exception 'Only the requester can edit their pending requests.';
        end if;
    end if;

    -- Update Header (incorporating new fields if provided)
    update public.po_requests
    set
        total_amount = coalesce((p_header->>'total_amount')::numeric, total_amount),
        reason_for_request = coalesce(p_header->>'reason_for_request', reason_for_request),
        comments = coalesce(p_header->>'comments', comments),
        customer_name = coalesce(p_header->>'customer_name', customer_name),
        supplier_id = coalesce((p_header->>'supplier_id')::uuid, supplier_id),
        site_id = coalesce((p_header->>'site_id')::uuid, site_id),
        concur_request_number = coalesce(p_header->>'concur_request_number', concur_request_number),
        concur_po_number = coalesce(p_header->>'concur_po_number', concur_po_number)
    where id = p_request_id;

    -- Lines processing: UPSERT approach
    -- Only delete lines that are NOT in the provided payload
    delete from public.po_lines
    where po_request_id = p_request_id
    and id not in (
        select (value->>'id')::uuid
        from jsonb_array_elements(p_lines)
        where (value->>'id') is not null
    );

    -- Insert or Update lines
    for l_line in select * from jsonb_array_elements(p_lines) loop
        insert into public.po_lines (
            po_request_id,
            id,
            item_id,
            sku,
            item_name,
            quantity_ordered,
            unit_price,
            total_price,
            concur_po_number
        ) values (
            p_request_id,
            coalesce((l_line->>'id')::uuid, gen_random_uuid()),
            (l_line->>'item_id')::uuid,
            l_line->>'sku',
            l_line->>'item_name',
            (l_line->>'quantity_ordered')::numeric,
            (l_line->>'unit_price')::numeric,
            (l_line->>'total_price')::numeric,
            l_line->>'concur_po_number'
        )
        on conflict (id) do update set
            quantity_ordered = excluded.quantity_ordered,
            unit_price = excluded.unit_price,
            total_price = excluded.total_price,
            concur_po_number = coalesce(excluded.concur_po_number, po_lines.concur_po_number);
    end loop;
end;
$$;
