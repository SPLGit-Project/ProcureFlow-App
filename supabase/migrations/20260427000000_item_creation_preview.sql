-- Item Creation Preview / Research Module
-- This migration creates isolated preview tables only. It must not mutate live
-- item, catalogue, PO, supplier mapping, or pricing records.

INSERT INTO public.app_config (key, value, updated_at)
VALUES
    ('item_creation_preview_enabled', 'true'::jsonb, now()),
    ('item_creation_preview_write_block', 'true'::jsonb, now()),
    ('item_creation_go_live_enabled', 'false'::jsonb, now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

CREATE TABLE IF NOT EXISTS public.preview_item_reference_overlays (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    reference_type text NOT NULL,
    reference_value text NOT NULL,
    code text NOT NULL,
    notes text,
    active_flag boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(reference_type, reference_value)
);

CREATE TABLE IF NOT EXISTS public.preview_item_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    request_number text NOT NULL UNIQUE,
    request_type text NOT NULL,
    lifecycle_status text NOT NULL DEFAULT 'Draft',
    requestor_user_id uuid,
    requestor_name text,
    department text,
    business_unit text,
    branch_site_id uuid,
    branch_site_name text,
    required_activation_date date,
    business_reason text,
    business_reason_detail text,
    new_or_replacement text NOT NULL DEFAULT 'New Item',
    existing_item_id uuid,
    customer_reference text,
    proposed_description text NOT NULL,
    item_group text,
    division text,
    purchase_enabled boolean DEFAULT false NOT NULL,
    sale_enabled boolean DEFAULT false NOT NULL,
    bundle_enabled boolean DEFAULT false NOT NULL,
    linenhub_enabled boolean DEFAULT false NOT NULL,
    salesforce_visible boolean DEFAULT false NOT NULL,
    preview_active boolean DEFAULT true NOT NULL,
    duplicate_check_id uuid,
    current_margin_percent numeric(8,2),
    current_margin_amount numeric(12,2),
    validation_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    draft_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.preview_item_master_drafts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id uuid NOT NULL REFERENCES public.preview_item_requests(id),
    proposed_sku text NOT NULL,
    sku_validation jsonb DEFAULT '{}'::jsonb NOT NULL,
    sku_override_reason text,
    confirmed_description text,
    item_category text,
    product_type text,
    size_code text,
    variety_code text,
    colour_code text,
    gsm_code text,
    rfid_flag boolean DEFAULT false NOT NULL,
    cog_flag boolean DEFAULT false NOT NULL,
    cog_customer text,
    item_weight numeric(12,3),
    purchase_uom text,
    sale_uom text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    locked_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(request_id)
);

CREATE TABLE IF NOT EXISTS public.preview_purchase_price_drafts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id uuid NOT NULL REFERENCES public.preview_item_requests(id),
    supplier_id uuid,
    supplier_name text,
    supplier_item_code text,
    purchase_uom text,
    purchase_price_ex_gst numeric(12,2),
    purchase_currency text DEFAULT 'AUD',
    minimum_order_quantity numeric(12,2),
    lead_time_days integer,
    freight_handling_cost numeric(12,2) DEFAULT 0,
    landed_cost numeric(12,2),
    effective_from date,
    effective_to date,
    validation_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    locked_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(request_id)
);

CREATE TABLE IF NOT EXISTS public.preview_sell_price_drafts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id uuid NOT NULL REFERENCES public.preview_item_requests(id),
    price_type text NOT NULL DEFAULT 'Standard',
    customer_reference text,
    customer_group_reference text,
    sale_uom text,
    sell_price_ex_gst numeric(12,2),
    tax_code text,
    effective_from date,
    effective_to date,
    margin_percent numeric(8,2),
    margin_amount numeric(12,2),
    approval_required boolean DEFAULT false NOT NULL,
    publish_to_salesforce boolean DEFAULT false NOT NULL,
    publish_to_bundle boolean DEFAULT false NOT NULL,
    publish_to_linenhub boolean DEFAULT false NOT NULL,
    validation_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    locked_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(request_id)
);

CREATE TABLE IF NOT EXISTS public.preview_item_duplicate_checks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id uuid NOT NULL REFERENCES public.preview_item_requests(id),
    search_timestamp timestamptz DEFAULT now() NOT NULL,
    search_terms jsonb DEFAULT '{}'::jsonb NOT NULL,
    candidates jsonb DEFAULT '[]'::jsonb NOT NULL,
    match_count integer DEFAULT 0 NOT NULL,
    highest_match_score numeric(5,4) DEFAULT 0 NOT NULL,
    selected_outcome text NOT NULL DEFAULT 'NoDuplicate',
    justification text,
    performed_by uuid,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.preview_item_approval_instances (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id uuid NOT NULL REFERENCES public.preview_item_requests(id),
    status text NOT NULL DEFAULT 'Pending',
    matched_rule text,
    current_stage integer DEFAULT 1 NOT NULL,
    started_at timestamptz DEFAULT now() NOT NULL,
    completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.preview_item_approval_decisions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    approval_instance_id uuid NOT NULL REFERENCES public.preview_item_approval_instances(id),
    request_id uuid NOT NULL REFERENCES public.preview_item_requests(id),
    approver_user_id uuid,
    approver_name text,
    stage integer DEFAULT 1 NOT NULL,
    decision text NOT NULL,
    comments text,
    matched_rule text,
    decided_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.preview_publication_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id uuid NOT NULL REFERENCES public.preview_item_requests(id),
    event_type text NOT NULL,
    event_version text DEFAULT '1.0' NOT NULL,
    correlation_id uuid NOT NULL,
    source_system text DEFAULT 'ProcureFlow Preview' NOT NULL,
    target_system text NOT NULL,
    payload_hash text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text NOT NULL DEFAULT 'Pending',
    retry_count integer DEFAULT 0 NOT NULL,
    last_error text,
    external_item_id text,
    external_price_id text,
    published_at timestamptz,
    acknowledged_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(request_id, target_system, payload_hash)
);

CREATE TABLE IF NOT EXISTS public.preview_item_audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id uuid,
    action_type text NOT NULL,
    performed_by uuid,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    mode text DEFAULT 'PREVIEW' NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_preview_item_requests_status
    ON public.preview_item_requests (lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_preview_item_requests_created_at
    ON public.preview_item_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_preview_item_duplicate_checks_request
    ON public.preview_item_duplicate_checks (request_id);
CREATE INDEX IF NOT EXISTS idx_preview_publication_events_request
    ON public.preview_publication_events (request_id);

ALTER TABLE public.preview_item_reference_overlays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preview_item_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preview_item_master_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preview_purchase_price_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preview_sell_price_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preview_item_duplicate_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preview_item_approval_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preview_item_approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preview_publication_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preview_item_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'preview_item_reference_overlays',
        'preview_item_requests',
        'preview_item_master_drafts',
        'preview_purchase_price_drafts',
        'preview_sell_price_drafts',
        'preview_item_duplicate_checks',
        'preview_item_approval_instances',
        'preview_item_approval_decisions',
        'preview_publication_events',
        'preview_item_audit_logs'
    ]
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Preview users can read %I" ON public.%I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Preview users can manage %I" ON public.%I', t, t);
        EXECUTE format(
            'CREATE POLICY "Preview users can read %I" ON public.%I FOR SELECT USING (public.is_admin() OR public.has_permission(''manage_development''))',
            t,
            t
        );
        EXECUTE format(
            'CREATE POLICY "Preview users can manage %I" ON public.%I FOR ALL USING (public.is_admin() OR public.has_permission(''manage_development'')) WITH CHECK (public.is_admin() OR public.has_permission(''manage_development''))',
            t,
            t
        );
    END LOOP;
END $$;

