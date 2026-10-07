
-- Promote the unique index on sap_item_code_norm to a proper unique constraint
-- This is required for PostgreSQL's ON CONFLICT clause to work correctly
DROP INDEX IF EXISTS idx_items_sap_code_norm;
ALTER TABLE items ADD CONSTRAINT items_sap_item_code_norm_key UNIQUE (sap_item_code_norm);
;
