-- Remediation: unknown requesters and RLS hardening
begin;

-- 1. Create a Legacy/System user as a cleanup sink if it doesn't exist
insert into public.users (id, email, name, role_id, status)
values ('00000000-0000-0000-0000-000000000000', 'system@procureflow.local', 'Legacy System User', 'ADMIN', 'APPROVED')
on conflict (id) do nothing;

-- 2. Attempt to recover requesters from po_approvals (Initial 'Requested' action)
with recovery as (
    select distinct on (po_request_id) 
        po_request_id, 
        approver_id
    from public.po_approvals
    where action = 'Requested' and approver_id is not null
    order by po_request_id, date asc
)
update public.po_requests pr
set requester_id = r.approver_id
from recovery r
where pr.id = r.po_request_id and pr.requester_id is null;

-- 3. Assign remaining orphaned records to Legacy System User
update public.po_requests
set requester_id = '00000000-0000-0000-0000-000000000000'
where requester_id is null;

-- 4. Enforce NOT NULL on requester_id
alter table public.po_requests
    alter column requester_id set not null;

-- 5. Hardening RLS Policies: Replace brittle join patterns with standardized is_admin()
-- Polcy: "Requesters can update pending requests"
drop policy if exists "Requesters can update pending requests" on public.po_requests;
create policy "Requesters can update pending requests"
    on public.po_requests
    for update
    using (
        (auth.uid() in (select auth_user_id from public.users where id = requester_id) and status = 'PENDING_APPROVAL')
        or (public.is_admin())
    );

-- Policy: "Admins and requesters can delete requests"
drop policy if exists "Admins and requesters can delete requests" on public.po_requests;
create policy "Admins and requesters can delete requests"
    on public.po_requests
    for delete
    using (
        (auth.uid() in (select auth_user_id from public.users where id = requester_id) and status = 'PENDING_APPROVAL')
        or (public.is_admin())
    );

commit;
