
ALTER TABLE items ADD COLUMN IF NOT EXISTS short_name text;

-- Backfill: use existing name as short_name for current items
UPDATE items SET short_name = name WHERE short_name IS NULL;

-- Create an index for fast short_name search
CREATE INDEX IF NOT EXISTS idx_items_short_name ON items USING gin(to_tsvector('english', coalesce(short_name, '')));
;
