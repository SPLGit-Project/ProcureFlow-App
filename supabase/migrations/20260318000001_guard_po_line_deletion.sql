-- Migration: 20260318000001_guard_po_line_deletion.sql
-- Fix F4: Prevent the update_pending_po_request RPC from silently deleting
-- po_lines that already have delivery_lines referencing them.
--
-- Two-part fix:
-- 1. Add ON DELETE RESTRICT FK on delivery_lines.po_line_id (database constraint)
-- 2. Update the RPC to raise a friendly error before the delete attempt

-- =============================================================================
-- PART 1: Pre-flight safety check + FK RESTRICT constraint
-- =============================================================================

-- Safety check: ensure no orphaned delivery_lines exist before adding constraint
do $$
declare
    v_orphan_count integer;
begin
    select count(*) into v_orphan_count
    from public.delivery_lines dl
    left join public.po_lines pl on dl.po_line_id = pl.id
    where pl.id is null;

    if v_orphan_count > 0 then
        raise exception
            'Cannot add FK RESTRICT: % orphaned delivery_lines rows exist with missing po_line_id. '
            'Clean these up before proceeding.',
            v_orphan_count;
    end if;
end $$;

-- Replace existing FK (if any) with RESTRICT version
alter table public.delivery_lines
    drop constraint if exists delivery_lines_po_line_id_fkey;

alter table public.delivery_lines
    add constraint delivery_lines_po_line_id_fkey
    foreign key (po_line_id)
    references public.po_lines(id)
    on delete restrict;

-- =============================================================================
-- PART 2: Update the RPC to raise a friendly guard error first
-- =============================================================================

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
    v_received_line_count integer;
begin
    -- Check if user is an ADMIN
    select exists (
        select 1 from public.users u
        join public.roles r on u.role_id = r.id
        where u.auth_user_id = auth.uid() and r.id = 'ADMIN'
    ) into v_is_admin;

    -- Verify request exists and get details
    select status, requester_id
    into v_status, v_requester_id
    from public.po_requests
    where id = p_request_id;

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

    -- GUARD (F4 fix): Check if any lines being REMOVED already have delivery records.
    -- This prevents silently destroying received quantities.
    select count(*) into v_received_line_count
    from public.delivery_lines dl
    join public.po_lines pl on dl.po_line_id = pl.id
    where pl.po_request_id = p_request_id
    and pl.id not in (
        select (value->>'id')::uuid
        from jsonb_array_elements(p_lines)
        where (value->>'id') is not null
    );

    if v_received_line_count > 0 then
        raise exception
            'Cannot remove % PO line(s) that already have delivery records. '
            'To correct received quantities, edit or delete the relevant delivery first.',
            v_received_line_count;
    end if;

    -- Update Header
    update public.po_requests
    set
        total_amount            = coalesce((p_header->>'total_amount')::numeric,    total_amount),
        reason_for_request      = coalesce(p_header->>'reason_for_request',         reason_for_request),
        comments                = coalesce(p_header->>'comments',                   comments),
        customer_name           = coalesce(p_header->>'customer_name',              customer_name),
        supplier_id             = coalesce((p_header->>'supplier_id')::uuid,        supplier_id),
        site_id                 = coalesce((p_header->>'site_id')::uuid,            site_id),
        concur_request_number   = coalesce(p_header->>'concur_request_number',      concur_request_number)
    where id = p_request_id;

    -- Lines processing: UPSERT approach
    -- Only delete lines that are NOT in the provided payload (and have no deliveries — guarded above)
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
            quantity_ordered    = excluded.quantity_ordered,
            unit_price          = excluded.unit_price,
            total_price         = excluded.total_price,
            concur_po_number    = coalesce(excluded.concur_po_number, po_lines.concur_po_number);
    end loop;

    -- Audit log for admin edits on non-pending POs (F8 fix)
    if v_is_admin and v_status not in ('DRAFT', 'PENDING_APPROVAL') then
        begin
            insert into public.system_audit_logs (action_type, performed_by, summary, details)
            values (
                'ADMIN_PO_EDIT',
                auth.uid()::text,
                jsonb_build_object(
                    'po_id', p_request_id,
                    'po_status_at_edit', v_status
                ),
                p_header
            );
        exception when others then
            null; -- Non-fatal
        end;
    end if;
end;
$$;
