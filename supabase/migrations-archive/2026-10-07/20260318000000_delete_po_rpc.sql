-- Migration: 20260318000000_delete_po_rpc.sql
-- Fix F1: Replace non-atomic client-side deletePO with a transactional server-side RPC.
-- All five delete steps run inside a single implicit PL/pgSQL transaction.
-- Includes: auth check, status guard, cascade delete, and audit log.

create or replace function public.delete_po_and_cascade(p_po_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_status text;
    v_requester_id uuid;
    v_is_admin boolean;
    v_auth_uid uuid := auth.uid();
begin
    -- Initialize admin check and capture PO details
    v_is_admin := public.is_admin();

    select status, requester_id
    into v_status, v_requester_id
    from public.po_requests
    where id = p_po_id;

    if v_status is null then
        raise exception 'PO not found: %', p_po_id;
    end if;

    -- Authentication/Authorization Guard
    -- Admins can delete any PO regardless of status.
    -- Non-admins can only delete DRAFT or PENDING_APPROVAL POs they own.
    if not v_is_admin then
        if v_status not in ('DRAFT', 'PENDING_APPROVAL') then
            raise exception 'Cannot delete a PO with status %. Only DRAFT or PENDING_APPROVAL POs can be deleted.', v_status;
        end if;

        -- Ownership check for non-admins
        if not exists (
            select 1 from public.users u 
            where u.id = v_requester_id 
            and u.auth_user_id = v_auth_uid
        ) then
            raise exception 'You can only delete your own requests.';
        end if;
    end if;

    -- Atomic cascade: delete child records first, then parent.
    -- This ensures integrity even without DB-level cascade FKs.
    delete from public.delivery_lines
    where delivery_id in (
        select id from public.deliveries where po_request_id = p_po_id
    );

    delete from public.deliveries
    where po_request_id = p_po_id;

    delete from public.po_lines
    where po_request_id = p_po_id;

    delete from public.po_approvals
    where po_request_id = p_po_id;

    delete from public.po_requests
    where id = p_po_id;

    -- Write audit record (non-fatal: wrapped in exception handler)
    begin
        insert into public.system_audit_logs (action_type, performed_by, summary, details)
        values (
            'PO_DELETED',
            v_auth_uid,
            jsonb_build_object(
                'po_id', p_po_id,
                'status_at_delete', v_status,
                'deleted_by_admin', v_is_admin
            ),
            '{}'::jsonb
        );
    exception when others then
        -- Audit failure should not roll back the deletion
        null;
    end;
end;
$$;

-- Grant execute to authenticated users
grant execute on function public.delete_po_and_cascade(uuid) to authenticated;

