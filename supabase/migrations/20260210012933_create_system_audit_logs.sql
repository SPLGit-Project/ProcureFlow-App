
create table if not exists system_audit_logs (
    id uuid default uuid_generate_v4() primary key,
    action_type text not null,
    performed_by uuid references auth.users(id),
    summary jsonb not null default '{}'::jsonb,
    details jsonb default '{}'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table system_audit_logs enable row level security;

create policy "Allow read access to authenticated users"
    on system_audit_logs for select
    using (auth.role() = 'authenticated');

create policy "Allow insert access to authenticated users"
    on system_audit_logs for insert
    with check (auth.role() = 'authenticated');
;
