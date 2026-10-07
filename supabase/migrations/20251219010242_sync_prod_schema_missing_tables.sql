-- 1. Create app_config
CREATE TABLE IF NOT EXISTS public.app_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by TEXT
);

-- 2. Create item_field_registry
CREATE TABLE IF NOT EXISTS public.item_field_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_key TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    data_type TEXT NOT NULL,
    is_visible BOOLEAN DEFAULT true,
    is_filterable BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create po_sequences (for display ID generation)
CREATE TABLE IF NOT EXISTS public.po_sequences (
    year_month TEXT PRIMARY KEY,
    last_seq INTEGER DEFAULT 0
);

-- 4. Enable RLS (though TEST has them disabled by default for these system tables)
-- For now, let's keep it consistent with TEST to avoid breaking the frontend
ALTER TABLE public.app_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_field_registry DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_sequences DISABLE ROW LEVEL SECURITY;
;
