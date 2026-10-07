-- Concurrency safety for automated ingestion.
--
-- 1. Per-supplier advisory lock in replace_stock_snapshot so two concurrent
--    imports for the same supplier (e.g. auto-drain firing in two admin
--    browser tabs at once) can never interleave their DELETE/INSERT and
--    produce duplicate or lost snapshot rows. Protects manual uploads too.
-- 2. A PROCESSING status so the app can atomically "claim" a queue row before
--    working it, guaranteeing each emailed file is processed exactly once.

create or replace function public.replace_stock_snapshot(
    p_supplier_id uuid,
    p_date        text,
    p_rows        jsonb,
    p_force       boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    r jsonb;
    v_existing_max timestamptz;
    v_incoming     timestamptz;
begin
    if not exists (
        select 1 from public.users u
        join public.roles r on u.role_id = r.id
        where u.auth_user_id = auth.uid()
        and (r.id = 'ADMIN' or 'manage_items' = any(r.permissions))
    ) then
        raise exception 'Permission denied: manage_items or ADMIN role required to import stock snapshots.';
    end if;

    -- Serialise concurrent replaces for the same supplier (released at commit).
    perform pg_advisory_xact_lock(hashtext('replace_stock_snapshot:' || p_supplier_id::text));

    v_incoming := p_date::timestamptz;

    select max(snapshot_date) into v_existing_max
    from public.stock_snapshots
    where supplier_id = p_supplier_id;

    if not p_force
       and v_existing_max is not null
       and v_incoming is not null
       and v_incoming < date_trunc('day', v_existing_max) then
        raise exception 'STALE_REPORT|%|%',
            to_char(v_existing_max, 'YYYY-MM-DD'),
            to_char(v_incoming, 'YYYY-MM-DD')
            using errcode = 'P0001';
    end if;

    delete from public.stock_snapshots
    where supplier_id = p_supplier_id;

    for r in select * from jsonb_array_elements(p_rows) loop
        insert into public.stock_snapshots (
            id, supplier_id, supplier_sku, product_name, available_qty, stock_on_hand,
            snapshot_date, source_report_name, range_name, stock_type, carton_qty,
            category, sub_category, committed_qty, back_ordered_qty, soh_value_at_sell,
            sell_price, total_stock_qty, customer_stock_code_raw, customer_stock_code_norm,
            customer_stock_code_alt_norm
        ) values (
            coalesce((r->>'id')::uuid, gen_random_uuid()),
            p_supplier_id,
            r->>'supplier_sku',
            r->>'product_name',
            (r->>'available_qty')::integer,
            (r->>'stock_on_hand')::integer,
            (r->>'snapshot_date')::timestamptz,
            r->>'source_report_name',
            r->>'range_name',
            r->>'stock_type',
            (r->>'carton_qty')::integer,
            r->>'category',
            r->>'sub_category',
            (r->>'committed_qty')::integer,
            (r->>'back_ordered_qty')::integer,
            (r->>'soh_value_at_sell')::numeric,
            (r->>'sell_price')::numeric,
            (r->>'total_stock_qty')::integer,
            r->>'customer_stock_code_raw',
            r->>'customer_stock_code_norm',
            r->>'customer_stock_code_alt_norm'
        );
    end loop;
end;
$$;

grant execute on function public.replace_stock_snapshot(uuid, text, jsonb, boolean) to authenticated;

-- Allow the PROCESSING (claimed) state on the queue.
alter table public.email_ingestion_queue drop constraint if exists email_ingestion_queue_status_check;
alter table public.email_ingestion_queue add constraint email_ingestion_queue_status_check
    check (status in ('PENDING','PROCESSING','PROCESSED','REJECTED_STALE','NEEDS_SUPPLIER','FAILED','SKIPPED'));
