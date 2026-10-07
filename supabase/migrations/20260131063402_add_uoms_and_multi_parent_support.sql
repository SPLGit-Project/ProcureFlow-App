-- Add parent_ids for multi-parent support
ALTER TABLE attribute_options ADD COLUMN IF NOT EXISTS parent_ids UUID[] DEFAULT '{}';

-- Migration: Copy existng parent_id to parent_ids array for backward compatibility (optional but good)
UPDATE attribute_options SET parent_ids = ARRAY[parent_id] WHERE parent_id IS NOT NULL AND (parent_ids IS NULL OR cardinality(parent_ids) = 0);

-- Seed UOMs
INSERT INTO attribute_options (type, value, active_flag) VALUES 
('UOM', 'EACH', true),
('UOM', 'PACK', true),
('UOM', 'CASE', true),
('UOM', 'BOX', true),
('UOM', 'ROLL', true),
('UOM', 'KILOGRAM', true),
('UOM', 'METER', true),
('UOM', 'BUNDLE', true),
('UOM', 'CARTON', true),
('UOM', 'SLING', true),
('UOM', 'DOZEN', true),
('UOM', 'PAIR', true),
('UOM', 'PIECE', true)
ON CONFLICT (type, value) DO NOTHING;
;
