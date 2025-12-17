-- Run this in Supabase SQL Editor to apply schema changes for Normalization

-- Stock Snapshots (Supplier Data)
ALTER TABLE stock_snapshots ADD COLUMN IF NOT EXISTS customer_stock_code_raw TEXT;
ALTER TABLE stock_snapshots ADD COLUMN IF NOT EXISTS customer_stock_code_norm TEXT;
ALTER TABLE stock_snapshots ADD COLUMN IF NOT EXISTS customer_stock_code_alt_norm TEXT;

CREATE INDEX IF NOT EXISTS idx_stock_snapshots_norm ON stock_snapshots(customer_stock_code_norm);
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_alt_norm ON stock_snapshots(customer_stock_code_alt_norm);

-- Items (Master Data)
ALTER TABLE items ADD COLUMN IF NOT EXISTS sap_item_code_raw TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS sap_item_code_norm TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_items_sap_norm ON items(sap_item_code_norm);
