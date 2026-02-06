-- Create a table to store system audit logs
create table if not exists system_audit_logs (
    id uuid default uuid_generate_v4() primary key,
    action_type text not null, -- e.g., 'ITEM_IMPORT', 'ITEM_EXPORT'
    performed_by uuid references auth.users(id), -- User who performed the action
    summary jsonb not null default '{}'::jsonb, -- High-level stats (e.g., { created: 10, updated: 5 })
    details jsonb default '{}'::jsonb, -- Detailed breakdown or error logs
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table system_audit_logs enable row level security;

-- Allow read access to authenticated users (or restrict to admins if needed)
create policy "Allow read access to authenticated users"
    on system_audit_logs for select
    using (auth.role() = 'authenticated');

-- Allow insert access to authenticated users
create policy "Allow insert access to authenticated users"
    on system_audit_logs for insert
    with check (auth.role() = 'authenticated');
