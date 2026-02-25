-- Expand system audit to capture row-level data changes directly in the database.

create table if not exists public.system_audit_logs (
    id uuid default uuid_generate_v4() primary key,
    action_type text not null,
    performed_by uuid,
    summary jsonb not null default '{}'::jsonb,
    details jsonb not null default '{}'::jsonb,
    created_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.system_audit_logs
    add column if not exists action_type text,
    add column if not exists performed_by uuid,
    add column if not exists summary jsonb not null default '{}'::jsonb,
    add column if not exists details jsonb not null default '{}'::jsonb,
    add column if not exists created_at timestamp with time zone not null default timezone('utc'::text, now());

alter table public.system_audit_logs enable row level security;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'system_audit_logs'
          and policyname = 'Allow read access to authenticated users'
    ) then
        create policy "Allow read access to authenticated users"
            on public.system_audit_logs
            for select
            using (auth.role() = 'authenticated');
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'system_audit_logs'
          and policyname = 'Allow insert access to authenticated users'
    ) then
        create policy "Allow insert access to authenticated users"
            on public.system_audit_logs
            for insert
            with check (auth.role() = 'authenticated');
    end if;
end
$$;

create index if not exists idx_system_audit_logs_created_at
    on public.system_audit_logs (created_at desc);

create index if not exists idx_system_audit_logs_action_type
    on public.system_audit_logs (action_type);

create or replace function public.audit_changed_fields(old_row jsonb, new_row jsonb)
returns jsonb
language sql
immutable
as $$
    select coalesce(
        jsonb_object_agg(diff.key, jsonb_build_object('old', diff.old_value, 'new', diff.new_value)),
        '{}'::jsonb
    )
    from (
        select
            coalesce(old_data.key, new_data.key) as key,
            old_data.value as old_value,
            new_data.value as new_value
        from jsonb_each(old_row) old_data
        full outer join jsonb_each(new_row) new_data
            on old_data.key = new_data.key
        where old_data.value is distinct from new_data.value
    ) diff;
$$;

create or replace function public.capture_system_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    actor_id uuid;
    old_payload jsonb;
    new_payload jsonb;
    changed_fields jsonb := '{}'::jsonb;
    summary_payload jsonb := '{}'::jsonb;
    details_payload jsonb := '{}'::jsonb;
    row_id text := '';
    action_label text;
begin
    actor_id := auth.uid();

    if tg_op = 'INSERT' then
        new_payload := to_jsonb(new);
        row_id := coalesce(new_payload ->> 'id', '');
        summary_payload := jsonb_build_object(
            'table', tg_table_name,
            'operation', 'INSERT',
            'recordId', row_id
        );
        details_payload := jsonb_build_object('new', new_payload);
    elsif tg_op = 'UPDATE' then
        old_payload := to_jsonb(old);
        new_payload := to_jsonb(new);
        changed_fields := public.audit_changed_fields(old_payload, new_payload);

        if changed_fields = '{}'::jsonb then
            return new;
        end if;

        row_id := coalesce(new_payload ->> 'id', old_payload ->> 'id', '');
        summary_payload := jsonb_build_object(
            'table', tg_table_name,
            'operation', 'UPDATE',
            'recordId', row_id,
            'changedCount', (select count(*) from jsonb_each(changed_fields))
        );
        details_payload := jsonb_build_object(
            'changedFields', changed_fields,
            'old', old_payload,
            'new', new_payload
        );
    elsif tg_op = 'DELETE' then
        old_payload := to_jsonb(old);
        row_id := coalesce(old_payload ->> 'id', '');
        summary_payload := jsonb_build_object(
            'table', tg_table_name,
            'operation', 'DELETE',
            'recordId', row_id
        );
        details_payload := jsonb_build_object('old', old_payload);
    end if;

    action_label := upper(tg_table_name || '_' || tg_op);

    insert into public.system_audit_logs (
        action_type,
        performed_by,
        summary,
        details
    ) values (
        action_label,
        actor_id,
        summary_payload,
        details_payload
    );

    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
exception
    when others then
        raise warning 'capture_system_audit failed for %.%: %', tg_table_name, tg_op, sqlerrm;
        if tg_op = 'DELETE' then
            return old;
        end if;
        return new;
end;
$$;

do $$
begin
    if to_regclass('public.items') is not null then
        execute 'drop trigger if exists trg_audit_items on public.items';
        execute 'create trigger trg_audit_items after insert or update or delete on public.items for each row execute function public.capture_system_audit()';
    end if;

    if to_regclass('public.po_requests') is not null then
        execute 'drop trigger if exists trg_audit_po_requests on public.po_requests';
        execute 'create trigger trg_audit_po_requests after insert or update or delete on public.po_requests for each row execute function public.capture_system_audit()';
    end if;

    if to_regclass('public.po_lines') is not null then
        execute 'drop trigger if exists trg_audit_po_lines on public.po_lines';
        execute 'create trigger trg_audit_po_lines after insert or update or delete on public.po_lines for each row execute function public.capture_system_audit()';
    end if;

    if to_regclass('public.po_approvals') is not null then
        execute 'drop trigger if exists trg_audit_po_approvals on public.po_approvals';
        execute 'create trigger trg_audit_po_approvals after insert or update or delete on public.po_approvals for each row execute function public.capture_system_audit()';
    end if;

    if to_regclass('public.deliveries') is not null then
        execute 'drop trigger if exists trg_audit_deliveries on public.deliveries';
        execute 'create trigger trg_audit_deliveries after insert or update or delete on public.deliveries for each row execute function public.capture_system_audit()';
    end if;

    if to_regclass('public.delivery_lines') is not null then
        execute 'drop trigger if exists trg_audit_delivery_lines on public.delivery_lines';
        execute 'create trigger trg_audit_delivery_lines after insert or update or delete on public.delivery_lines for each row execute function public.capture_system_audit()';
    end if;
end
$$;
