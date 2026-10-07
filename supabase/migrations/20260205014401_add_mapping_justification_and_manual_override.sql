ALTER TABLE supplier_product_map 
ADD COLUMN IF NOT EXISTS mapping_justification JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS manual_override BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN supplier_product_map.mapping_justification IS 'Explanation of the auto-mapping score breakdown';
COMMENT ON COLUMN supplier_product_map.manual_override IS 'If TRUE, the auto-mapping engine will not touch this mapping';
;
