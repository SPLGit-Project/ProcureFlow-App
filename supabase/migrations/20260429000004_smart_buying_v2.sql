-- Smart Buying v2: persistent plan storage and reference data tables
-- These tables back the live-data toggle, plan saving, and per-item property overrides.

-- ── Saved buying plans ─────────────────────────────────────────────────────────

create table if not exists short_supply_plans (
    id           uuid primary key default gen_random_uuid(),
    created_by   uuid references auth.users(id),
    created_at   timestamptz not null default now(),
    sites        text[]       not null,
    budget       numeric(12,2) not null,
    ss_percent   numeric(5,2)  not null default 100,
    data_mode    text          not null default 'manual'
                     check (data_mode in ('live', 'manual')),
    total_spend  numeric(12,2),
    total_uplift numeric(12,2),
    total_units  integer,
    plan_items   jsonb         not null default '[]'::jsonb,
    notes        text
);

create index if not exists short_supply_plans_created_at_idx
    on short_supply_plans (created_at desc);

create index if not exists short_supply_plans_created_by_idx
    on short_supply_plans (created_by);

-- ── Per-item property overrides ───────────────────────────────────────────────
-- Supplements BundleConnect data: depreciation, shrinkage, STAR override when
-- scan data is sparse, item group classification.

create table if not exists ref_short_supply_item_properties (
    id                   uuid primary key default gen_random_uuid(),
    stk_key              text    not null,
    site_code            text,           -- null = applies to all sites
    depreciation_months  integer not null default 36,
    shrinkage_percent    numeric(5,2) not null default 5,
    star_override        numeric(8,2),   -- manual STAR when scan data is sparse
    item_group           text,
    is_active            boolean not null default true,
    updated_at           timestamptz not null default now(),
    updated_by           uuid references auth.users(id),
    unique (stk_key, coalesce(site_code, ''))
);

create index if not exists ref_ss_props_stk_key_idx
    on ref_short_supply_item_properties (stk_key);

-- ── Purchase price overrides ──────────────────────────────────────────────────
-- Fills gaps where BundleConnect stock table lacks purchase pricing.

create table if not exists ref_short_supply_pricing (
    id             uuid primary key default gen_random_uuid(),
    stk_key        text         not null,
    site_code      text,                 -- null = applies to all sites
    purchase_price numeric(10,2) not null,
    effective_from date not null default current_date,
    effective_to   date,
    is_active      boolean not null default true,
    updated_at     timestamptz not null default now(),
    updated_by     uuid references auth.users(id)
);

create index if not exists ref_ss_pricing_stk_key_idx
    on ref_short_supply_pricing (stk_key);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table short_supply_plans enable row level security;
alter table ref_short_supply_item_properties enable row level security;
alter table ref_short_supply_pricing enable row level security;

-- Helper: check manage_development or system_admin permission
create or replace function has_smart_buying_access()
returns boolean language sql security definer stable as $$
    select exists (
        select 1
        from user_roles ur
        join roles r on ur.role_id = r.id
        join role_permissions rp on r.id = rp.role_id
        join permissions p on rp.permission_id = p.id
        where ur.user_id = auth.uid()
          and p.name in ('manage_development', 'system_admin')
    )
$$;

create policy "sb_plans_select" on short_supply_plans
    for select to authenticated using (has_smart_buying_access());

create policy "sb_plans_insert" on short_supply_plans
    for insert to authenticated with check (has_smart_buying_access());

-- ref tables: read for all authenticated; write requires manage_development
create policy "ref_ss_props_select" on ref_short_supply_item_properties
    for select to authenticated using (true);

create policy "ref_ss_props_write" on ref_short_supply_item_properties
    for all to authenticated using (has_smart_buying_access())
    with check (has_smart_buying_access());

create policy "ref_ss_pricing_select" on ref_short_supply_pricing
    for select to authenticated using (true);

create policy "ref_ss_pricing_write" on ref_short_supply_pricing
    for all to authenticated using (has_smart_buying_access())
    with check (has_smart_buying_access());
