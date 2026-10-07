-- Migration: 20260318000004_po_status_audit_trigger.sql
-- Fix M2: Add a PostgreSQL trigger that writes to system_audit_logs on every
-- PO status change. This ensures all status transitions are captured regardless
-- of whether the change originates from the app, RPC, direct SQL, or admin tools.

create or replace function public.audit_po_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Only fire when status actually changes
    if OLD.status is distinct from NEW.status then
        insert into public.system_audit_logs (action_type, performed_by, summary, details)
        values (
            'PO_STATUS_CHANGE',
            coalesce(auth.uid()::text, 'system'),
            jsonb_build_object(
                'po_id',          NEW.id,
                'display_id',     NEW.display_id,
                'from_status',    OLD.status,
                'to_status',      NEW.status,
                'site_id',        NEW.site_id,
                'supplier_id',    NEW.supplier_id,
                'requester_id',   NEW.requester_id
            ),
            '{}'::jsonb
        );
    end if;
    return NEW;
end;
$$;

-- Create trigger (idempotent)
drop trigger if exists trg_audit_po_status on public.po_requests;

create trigger trg_audit_po_status
after update on public.po_requests
for each row
execute function public.audit_po_status_change();
