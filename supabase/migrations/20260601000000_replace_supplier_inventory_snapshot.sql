-- Replace supplier inventory as a single current snapshot.
-- Both manual uploads and automated email ingestion call importStockSnapshot,
-- so this keeps the downstream replacement behavior identical for both modes.

create or replace function public.replace_stock_snapshot(
    p_supplier_id uuid,
    p_date        text,
    p_rows        jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    r jsonb;
begin
    if not exists (
        select 1 from public.users u
        join public.roles r on u.role_id = r.id
        where u.auth_user_id = auth.uid()
        and (r.id = 'ADMIN' or 'manage_items' = any(r.permissions))
    ) then
        raise exception 'Permission denied: manage_items or ADMIN role required to import stock snapshots.';
    end if;

    delete from public.stock_snapshots
    where supplier_id = p_supplier_id;

    for r in select * from jsonb_array_elements(p_rows) loop
        insert into public.stock_snapshots (
            id,
            supplier_id,
            supplier_sku,
            product_name,
            available_qty,
            stock_on_hand,
            snapshot_date,
            source_report_name,
            range_name,
            stock_type,
            carton_qty,
            category,
            sub_category,
            committed_qty,
            back_ordered_qty,
            soh_value_at_sell,
            sell_price,
            total_stock_qty,
            customer_stock_code_raw,
            customer_stock_code_norm,
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

grant execute on function public.replace_stock_snapshot(uuid, text, jsonb) to authenticated;
