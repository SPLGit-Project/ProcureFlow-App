-- Fix requester/admin Concur linking so the UI permissions align with DB permissions.
-- The app allows either:
-- 1. admins / users with link_concur permission, or
-- 2. the original requester
-- to record Concur Request / PO numbers.
--
-- Direct table updates are blocked by RLS for non-admins, so we expose tightly scoped
-- SECURITY DEFINER RPCs that enforce those same business rules server-side.

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

    if v_status <> 'APPROVED_PENDING_CONCUR_REQUEST' then
        raise exception 'Concur Request numbers can only be linked from APPROVED_PENDING_CONCUR_REQUEST (current status: %).', v_status;
    end if;

    update public.po_requests
    set
        concur_request_number = v_trimmed_request_number,
        status = 'APPROVED_PENDING_CONCUR'
    where id = p_po_id;
end;
$$;

grant execute on function public.link_concur_request_number(uuid, text) to authenticated;

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
    v_trimmed_po_number text;
    v_can_link boolean;
begin
    v_trimmed_po_number := btrim(coalesce(p_concur_po_number, ''));

    if v_trimmed_po_number = '' then
        raise exception 'A valid Concur PO number is required.';
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
        raise exception 'You do not have permission to link this Concur PO.';
    end if;

    if v_status <> 'APPROVED_PENDING_CONCUR' then
        raise exception 'Concur PO numbers can only be linked from APPROVED_PENDING_CONCUR (current status: %).', v_status;
    end if;

    update public.po_lines
    set concur_po_number = v_trimmed_po_number
    where po_request_id = p_po_id;

    update public.po_requests
    set status = 'ACTIVE'
    where id = p_po_id;
end;
$$;

grant execute on function public.link_concur_po_number(uuid, text) to authenticated;
