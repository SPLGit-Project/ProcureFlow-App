-- Relax strict status checks for Concur linking
-- Allows progressing to ACTIVE automatically if PO number is already populated when Request is entered
-- Allows linking POs even from earlier states

create or replace function public.link_concur_request_number(
    p_po_id uuid,
    p_concur_request_number text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_requester_id uuid;
    v_status text;
    v_trimmed_request_number text;
    v_can_link boolean;
    v_has_po_number boolean;
begin
    v_trimmed_request_number := btrim(coalesce(p_concur_request_number, ''));

    if v_trimmed_request_number = '' then
        raise exception 'A valid Concur Request number is required.';
    end if;

    select requester_id, status
    into v_requester_id, v_status
    from public.po_requests
    where id = p_po_id;

    if v_status is null then
        raise exception 'Request % not found.', p_po_id;
    end if;

    select exists (
        select 1
        from public.users u
        join public.roles r on r.id = u.role_id
        where u.auth_user_id = auth.uid()
        and (
            r.id = 'ADMIN'
            or 'link_concur' = any(coalesce(r.permissions, '{}'::text[]))
            or u.id = v_requester_id
        )
    ) into v_can_link;

    if not v_can_link then
        raise exception 'You do not have permission to link this Concur Request.';
    end if;

    if v_status not in ('APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR', 'ACTIVE') then
        raise exception 'Concur Request numbers can only be linked during active entry steps (current status: %).', v_status;
    end if;

    -- Check if PO numbers are already populated
    select exists (
        select 1 from public.po_lines
        where po_request_id = p_po_id
        and concur_po_number is not null and btrim(concur_po_number) <> ''
    ) into v_has_po_number;

    update public.po_requests
    set
        concur_request_number = v_trimmed_request_number,
        status = case 
            when v_status = 'APPROVED_PENDING_CONCUR_REQUEST' and v_has_po_number then 'ACTIVE'
            when v_status = 'APPROVED_PENDING_CONCUR_REQUEST' then 'APPROVED_PENDING_CONCUR'
            else status
        end
    where id = p_po_id;
end;
$$;

create or replace function public.link_concur_po_number(
    p_po_id uuid,
    p_concur_po_number text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_requester_id uuid;
    v_status text;
    v_concur_req_num text;
    v_trimmed_po_number text;
    v_can_link boolean;
begin
    v_trimmed_po_number := btrim(coalesce(p_concur_po_number, ''));

    if v_trimmed_po_number = '' then
        raise exception 'A valid Concur PO number is required.';
    end if;

    select requester_id, status, concur_request_number
    into v_requester_id, v_status, v_concur_req_num
    from public.po_requests
    where id = p_po_id;

    if v_status is null then
        raise exception 'Request % not found.', p_po_id;
    end if;

    select exists (
        select 1
        from public.users u
        join public.roles r on r.id = u.role_id
        where u.auth_user_id = auth.uid()
        and (
            r.id = 'ADMIN'
            or 'link_concur' = any(coalesce(r.permissions, '{}'::text[]))
            or u.id = v_requester_id
        )
    ) into v_can_link;

    if not v_can_link then
        raise exception 'You do not have permission to link this Concur PO.';
    end if;

    if v_status not in ('APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR', 'ACTIVE') then
        raise exception 'Concur PO numbers can only be linked during active entry steps (current status: %).', v_status;
    end if;

    update public.po_lines
    set concur_po_number = v_trimmed_po_number
    where po_request_id = p_po_id;

    -- Advance status only if we are in expected pre-active state and request number exists (if required)
    update public.po_requests
    set status = case 
        -- If it was explicitly pending PO, it goes to ACTIVE
        when v_status = 'APPROVED_PENDING_CONCUR' then 'ACTIVE'
        -- If it was pending Request, wait for request unless it already has it?
        -- For robust flow, maybe just advance if they somehow linked PO directly
        when v_status = 'APPROVED_PENDING_CONCUR_REQUEST' and v_concur_req_num is not null then 'ACTIVE'
        else status
    end
    where id = p_po_id;
end;
$$;
