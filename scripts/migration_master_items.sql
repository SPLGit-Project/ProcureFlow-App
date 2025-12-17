-- Migration: Master Item Data & Config
-- Adds new columns for categorization and creates configuration table for import rules

-- 1. Add new columns to `items` table
ALTER TABLE items ADD COLUMN IF NOT EXISTS range_name TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS stock_type TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS active_flag BOOLEAN DEFAULT true;
ALTER TABLE items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Create Indexes for new filterable columns
CREATE INDEX IF NOT EXISTS idx_items_range ON items(range_name);
CREATE INDEX IF NOT EXISTS idx_items_stock_type ON items(stock_type);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_sub_category ON items(sub_category); 
-- Note: sub_category already exists in schema but check index

-- 3. Create App Config table (Store overwrite policies here)
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- 4. Insert Default Import Config if not exists
INSERT INTO app_config (key, value)
VALUES (
    'item_import_config',
    '{
        "overwrite_fields": {
            "name": true,
            "description": true,
            "unit_price": true,
            "uom": true,
            "category": true,
            "sub_category": true,
            "range_name": true,
            "stock_type": true,
            "active_flag": true
        }
    }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- 5. Trigger for updated_at (Generic)
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_items ON items;
CREATE TRIGGER set_timestamp_items
BEFORE UPDATE ON items
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();
