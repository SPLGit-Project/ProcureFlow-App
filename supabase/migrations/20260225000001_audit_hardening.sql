-- Hardening for system audit and PO requests

-- 1. RPC for Transactional Pending Request Edits
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
    l_line jsonb;
    v_status text;
begin
    -- Verify status is PENDING
    select status into v_status from public.po_requests where id = p_request_id;
    if v_status is null then
        raise exception 'Request % not found', p_request_id;
    end if;
    if v_status != 'PENDING' then
        raise exception 'Only PENDING requests can be edited (current status: %)', v_status;
    end if;

    -- Update Header (only provided fields)
    update public.po_requests
    set
        total_amount = coalesce((p_header->>'total_amount')::numeric, total_amount),
        reason_for_request = coalesce(p_header->>'reason_for_request', reason_for_request),
        comments = coalesce(p_header->>'comments', comments),
        supplier_id = coalesce((p_header->>'supplier_id')::uuid, supplier_id),
        site_id = coalesce((p_header->>'site_id')::uuid, site_id)
    where id = p_request_id;

    -- Update Lines: This implementation assumes the p_lines array represents the NEW state of lines.
    -- It deletes lines not in the new set and updates/inserts others.
    
    -- delete from public.po_lines 
    -- where po_request_id = p_request_id 
    -- and id not in (select (jsonb_array_elements(p_lines)->>'id')::uuid where (jsonb_array_elements(p_lines)->>'id') is not null);

    -- Simpler approach: delete all and re-insert if the UI doesn't manage line IDs strictly.
    -- However, for audit tracking, keeping IDs is better.
    -- Let's stick to delete-reinsert for now as it's the safest 'transactional edit' pattern for a generic RPC unless specified otherwise.
    delete from public.po_lines where po_request_id = p_request_id;
    
    for l_line in select * from jsonb_array_elements(p_lines) loop
        insert into public.po_lines (
            po_request_id,
            id,
            item_id,
            sku,
            item_name,
            quantity_ordered,
            unit_price,
            total_price
        ) values (
            p_request_id,
            coalesce((l_line->>'id')::uuid, uuid_generate_v4()),
            (l_line->>'item_id')::uuid,
            l_line->>'sku',
            l_line->>'item_name',
            (l_line->>'quantity_ordered')::int,
            (l_line->>'unit_price')::numeric,
            (l_line->>'total_price')::numeric
        );
    end loop;
end;
$$;

-- 2. Audit Log Retention Policy
create or replace function public.purge_system_audit_logs(days_to_keep int default 90)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    delete from public.system_audit_logs
    where created_at < now() - (days_to_keep || ' days')::interval;
end;
$$;

-- Schedule purge every day at midnight (requires pg_cron)
do $$
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        -- Check if job already exists to avoid duplicates
        if not exists (select 1 from cron.job where command like '%purge_system_audit_logs%') then
            perform cron.schedule('audit-purge', '0 0 * * *', 'select public.purge_system_audit_logs(90)');
        end if;
    end if;
end
$$;

-- 3. RLS Hardening for po_requests
-- Ensure only requesters can edit their PENDING requests, and ADMINS can edit any.
do $$
begin
    -- Drop the permissive policy if it exists
    if exists (select 1 from pg_policies where tablename = 'po_requests' and policyname = 'Allow all public access') then
        drop policy "Allow all public access" on public.po_requests;
    end if;

    -- Create restrictive policies
    if not exists (select 1 from pg_policies where tablename = 'po_requests' and policyname = 'Authenticated users can view requests') then
        create policy "Authenticated users can view requests"
            on public.po_requests
            for select
            using (auth.role() = 'authenticated');
    end if;

    if not exists (select 1 from pg_policies where tablename = 'po_requests' and policyname = 'Requesters can update pending requests') then
        create policy "Requesters can update pending requests"
            on public.po_requests
            for update
            using (
                (
                    auth.uid() in (select auth_user_id from public.users where id = requester_id)
                    and status = 'PENDING_APPROVAL'
                )
                or 
                (
                    exists (
                        select 1 from public.users u 
                        join public.roles r on u.role_id = r.id 
                        where u.auth_user_id = auth.uid() and r.id = 'ADMIN'
                    )
                )
            );
    end if;

    if not exists (select 1 from pg_policies where tablename = 'po_requests' and policyname = 'Admins and requesters can delete requests') then
        create policy "Admins and requesters can delete requests"
            on public.po_requests
            for delete
            using (
                (
                    auth.uid() in (select auth_user_id from public.users where id = requester_id)
                    and status = 'PENDING_APPROVAL'
                )
                or 
                (
                    exists (
                        select 1 from public.users u 
                        join public.roles r on u.role_id = r.id 
                        where u.auth_user_id = auth.uid() and r.id = 'ADMIN'
                    )
                )
            );
    end if;
    
    -- Basic insert policy
    if not exists (select 1 from pg_policies where tablename = 'po_requests' and policyname = 'Authenticated users can insert requests') then
        create policy "Authenticated users can insert requests"
            on public.po_requests
            for insert
            with check (auth.role() = 'authenticated');
    end if;
end
$$;
