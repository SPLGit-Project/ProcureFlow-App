create table if not exists public.email_ingestion_queue (
    id                   uuid primary key default gen_random_uuid(),
    message_id           text not null,
    attachment_id        text,
    attachment_name      text not null,
    storage_path         text not null,
    from_address         text,
    subject              text,
    received_at          timestamptz,
    detected_supplier_id uuid references public.suppliers(id) on delete set null,
    detected_supplier_name text,
    report_date          date,
    rows_imported        integer,
    status               text not null default 'PENDING'
                         check (status in ('PENDING','PROCESSED','REJECTED_STALE','NEEDS_SUPPLIER','FAILED','SKIPPED')),
    error                text,
    created_at           timestamptz not null default now(),
    processed_at         timestamptz
);

create unique index if not exists email_ingestion_queue_msg_attach_uidx
    on public.email_ingestion_queue (message_id, attachment_name);

create index if not exists email_ingestion_queue_status_idx
    on public.email_ingestion_queue (status, received_at desc);

alter table public.email_ingestion_queue enable row level security;

drop policy if exists email_ingestion_queue_read on public.email_ingestion_queue;
create policy email_ingestion_queue_read on public.email_ingestion_queue
    for select using (
        exists (
            select 1 from public.users u
            join public.roles r on u.role_id = r.id
            where u.auth_user_id = auth.uid()
            and (r.id = 'ADMIN' or 'manage_items' = any(r.permissions))
        )
    );

drop policy if exists email_ingestion_queue_update on public.email_ingestion_queue;
create policy email_ingestion_queue_update on public.email_ingestion_queue
    for update using (
        exists (
            select 1 from public.users u
            join public.roles r on u.role_id = r.id
            where u.auth_user_id = auth.uid()
            and (r.id = 'ADMIN' or 'manage_items' = any(r.permissions))
        )
    );

insert into storage.buckets (id, name, public)
values ('supplier-inbox', 'supplier-inbox', false)
on conflict (id) do nothing;

drop policy if exists supplier_inbox_read on storage.objects;
create policy supplier_inbox_read on storage.objects
    for select using (
        bucket_id = 'supplier-inbox'
        and exists (
            select 1 from public.users u
            join public.roles r on u.role_id = r.id
            where u.auth_user_id = auth.uid()
            and (r.id = 'ADMIN' or 'manage_items' = any(r.permissions))
        )
    );;
