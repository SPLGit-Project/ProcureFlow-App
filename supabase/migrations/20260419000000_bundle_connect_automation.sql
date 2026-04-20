-- Migration: BundleConnect Automation Schema
-- Created: 2026-04-19
-- Goal: Add reference and configuration tables for automated Short Supply sync.

-- 1. Site configuration for BundleConnect Replicas
CREATE TABLE IF NOT EXISTS public.bundle_connect_site_config (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    host text NOT NULL,
    port integer DEFAULT 3307,
    db_name text NOT NULL,
    is_active boolean DEFAULT true,
    last_sync_at timestamp with time zone,
    last_record_number bigint DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(site_id)
);

ALTER TABLE public.bundle_connect_site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage site config"
    ON public.bundle_connect_site_config FOR ALL
    USING ( public.is_admin() );

CREATE POLICY "Users can view site config"
    ON public.bundle_connect_site_config FOR SELECT
    USING ( site_id IN (SELECT unnest(site_ids) FROM public.users WHERE auth_user_id = auth.uid()) );

-- 2. Item Property References (Centralized defaults)
CREATE TABLE IF NOT EXISTS public.ref_item_properties (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    master_item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    uom text DEFAULT 'Units',
    depreciation_months integer DEFAULT 36,
    shrinkage_percent numeric(5,2) DEFAULT 5.00,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(master_item_id)
);

ALTER TABLE public.ref_item_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage item properties"
    ON public.ref_item_properties FOR ALL
    USING ( public.is_admin() );

CREATE POLICY "Users can view item properties"
    ON public.ref_item_properties FOR SELECT
    USING ( true );

-- 3. Item Pricing References (Site-specific purchase prices)
CREATE TABLE IF NOT EXISTS public.ref_item_pricing (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    master_item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    purchase_price numeric(10,2) NOT NULL,
    effective_date date DEFAULT CURRENT_DATE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(master_item_id, site_id)
);

ALTER TABLE public.ref_item_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage item pricing"
    ON public.ref_item_pricing FOR ALL
    USING ( public.is_admin() );

CREATE POLICY "Users can view item pricing"
    ON public.ref_item_pricing FOR SELECT
    USING ( site_id IN (SELECT unnest(site_ids) FROM public.users WHERE auth_user_id = auth.uid()) );

-- 4. DB mapping for BundleConnect (stk_key/deb_key mappings)
CREATE TABLE IF NOT EXISTS public.bundle_connect_item_map (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    bc_stk_key integer NOT NULL,
    master_item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(site_id, bc_stk_key)
);

ALTER TABLE public.bundle_connect_item_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage item maps"
    ON public.bundle_connect_item_map FOR ALL
    USING ( public.is_admin() );

-- Add triggers for updated_at
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_bundle_connect_site_config_updated_at') THEN
        CREATE TRIGGER handle_bundle_connect_site_config_updated_at
            BEFORE UPDATE ON public.bundle_connect_site_config
            FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_ref_item_properties_updated_at') THEN
        CREATE TRIGGER handle_ref_item_properties_updated_at
            BEFORE UPDATE ON public.ref_item_properties
            FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_ref_item_pricing_updated_at') THEN
        CREATE TRIGGER handle_ref_item_pricing_updated_at
            BEFORE UPDATE ON public.ref_item_pricing
            FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
    END IF;
END $$;
