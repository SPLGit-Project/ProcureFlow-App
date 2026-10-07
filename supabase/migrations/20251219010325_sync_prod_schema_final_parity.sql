-- 1. Add missing columns
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Trigger Functions (with search_path and fully qualified names)
CREATE OR REPLACE FUNCTION public.generate_po_display_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  current_ym TEXT;
  next_seq INTEGER;
BEGIN
  current_ym := to_char(COALESCE(NEW.request_date, NOW()), 'YYYYMM');
  INSERT INTO public.po_sequences (year_month, last_seq) VALUES (current_ym, 0) ON CONFLICT (year_month) DO NOTHING;
  UPDATE public.po_sequences SET last_seq = last_seq + 1 WHERE year_month = current_ym RETURNING last_seq INTO next_seq;
  NEW.display_id := 'POR-' || current_ym || '-' || lpad(next_seq::text, 6, '0');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3. Triggers
DROP TRIGGER IF EXISTS set_po_display_id ON public.po_requests;
CREATE TRIGGER set_po_display_id
    BEFORE INSERT ON public.po_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_po_display_id();

DROP TRIGGER IF EXISTS set_timestamp_items ON public.items;
CREATE TRIGGER set_timestamp_items
    BEFORE UPDATE ON public.items
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();

-- 4. Seed Data (avoiding OVERWRITE if already exists, but for these tables it's likely empty)
INSERT INTO public.app_config (key, value)
VALUES 
    ('item_import_config', '{"overwrite_fields": {"uom": true, "name": true, "category": true, "range_name": true, "stock_type": true, "unit_price": true, "active_flag": true, "description": true, "sub_category": true}}'::jsonb),
    ('teams_config', '{"webhookUrl": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;
;
