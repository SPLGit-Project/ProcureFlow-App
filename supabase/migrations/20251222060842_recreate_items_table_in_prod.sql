-- Drop existing table
DROP TABLE IF EXISTS public.items CASCADE;

-- Recreate table with full schema from TEST
CREATE TABLE public.items (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    sku text NOT NULL,
    name text NOT NULL,
    description text NULL,
    unit_price numeric NULL,
    uom text NULL,
    category text NULL,
    sub_category text NULL,
    stock_level integer NULL DEFAULT 0,
    supplier_id uuid NULL,
    is_rfid boolean NULL DEFAULT false,
    is_cog boolean NULL DEFAULT false,
    specs jsonb NULL,
    default_order_multiple integer NULL DEFAULT 1,
    active_flag boolean NULL DEFAULT true,
    sap_item_code_raw text NULL,
    sap_item_code_norm text NULL,
    range_name text NULL,
    stock_type text NULL,
    item_weight numeric NULL,
    item_pool text NULL,
    item_catalog text NULL,
    item_type text NULL,
    rfid_flag boolean NULL,
    item_colour text NULL,
    item_pattern text NULL,
    item_material text NULL,
    item_size text NULL,
    measurements text NULL,
    cog_flag boolean NULL,
    cog_customer text NULL,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT items_pkey PRIMARY KEY (id),
    CONSTRAINT items_sku_key UNIQUE (sku),
    CONSTRAINT items_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Recreate Indices
CREATE UNIQUE INDEX idx_items_sap_code_norm ON public.items USING btree (sap_item_code_norm);
CREATE INDEX idx_items_category ON public.items USING btree (category);
CREATE INDEX idx_items_range ON public.items USING btree (range_name);
CREATE INDEX idx_items_stock_type ON public.items USING btree (stock_type);
CREATE INDEX idx_items_sub_category ON public.items USING btree (sub_category);

-- Recreate RLS Policy
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all public access" ON public.items FOR ALL TO public USING (true) WITH CHECK (true);

-- Recreate Trigger (Assuming trigger_set_timestamp function exists in PROD)
CREATE TRIGGER set_timestamp_items BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
;
