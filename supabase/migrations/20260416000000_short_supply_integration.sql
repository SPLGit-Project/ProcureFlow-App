-- 1. Operational Metrics (per site)
CREATE TABLE public.item_operational_metrics (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    master_item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    depreciation_months integer DEFAULT 36,
    shrinkage_percent numeric(5,2) DEFAULT 5.00,
    star_days integer,
    revenue_per_cycle numeric(10,2),
    weight_kg numeric(10,2),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(master_item_id, site_id)
);

CREATE TRIGGER handle_item_operational_metrics_updated_at
    BEFORE UPDATE ON public.item_operational_metrics
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

ALTER TABLE public.item_operational_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view operational metrics for their sites"
    ON public.item_operational_metrics FOR SELECT
    USING ( public.is_admin() OR site_id IN (SELECT unnest(site_ids) FROM public.users WHERE auth_user_id = auth.uid()) );

CREATE POLICY "Admins can manage operational metrics"
    ON public.item_operational_metrics FOR ALL
    USING ( public.is_admin() );

-- 2. Short Supply Facts (Fact table for manual uploads)
CREATE TABLE public.short_supply_facts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    master_item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    period_month integer NOT NULL,
    period_year integer NOT NULL,
    ordered_qty integer NOT NULL DEFAULT 0,
    short_qty integer NOT NULL DEFAULT 0,
    fill_percentage numeric(5,2),
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(site_id, master_item_id, period_month, period_year)
);

ALTER TABLE public.short_supply_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view short supply facts for their sites"
    ON public.short_supply_facts FOR SELECT
    USING ( public.is_admin() OR site_id IN (SELECT unnest(site_ids) FROM public.users WHERE auth_user_id = auth.uid()) );

CREATE POLICY "Admins can manage short supply facts"
    ON public.short_supply_facts FOR ALL
    USING ( public.is_admin() );

-- 3. Buying Plans
CREATE TABLE public.buying_plans (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    created_by uuid NOT NULL REFERENCES public.users(id),
    name text NOT NULL,
    budget_constraint numeric(15,2) NOT NULL,
    ss_percentage_setting numeric(5,2) NOT NULL,
    status text NOT NULL DEFAULT 'DRAFT', -- DRAFT, CONVERTED_TO_PO
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TRIGGER handle_buying_plans_updated_at
    BEFORE UPDATE ON public.buying_plans
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

ALTER TABLE public.buying_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their site plans"
    ON public.buying_plans FOR ALL
    USING ( public.is_admin() OR site_id IN (SELECT unnest(site_ids) FROM public.users WHERE auth_user_id = auth.uid()) );

-- 4. Buying Plan Items
CREATE TABLE public.buying_plan_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    plan_id uuid NOT NULL REFERENCES public.buying_plans(id) ON DELETE CASCADE,
    master_item_id uuid NOT NULL REFERENCES public.items(id),
    allocated_qty integer NOT NULL,
    estimated_spend numeric(15,2) NOT NULL,
    annual_uplift numeric(15,2),
    locked_purchase_price numeric(10,2),
    supplier_id uuid REFERENCES public.suppliers(id),
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.buying_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their plan items"
    ON public.buying_plan_items FOR ALL
    USING ( public.is_admin() OR EXISTS (
        SELECT 1 FROM public.buying_plans bp 
        WHERE bp.id = plan_id 
        AND bp.site_id IN (SELECT unnest(site_ids) FROM public.users WHERE auth_user_id = auth.uid())
    ) );
