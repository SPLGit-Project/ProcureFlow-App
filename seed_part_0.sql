DO $$
DECLARE
  v_pool_id uuid;
  v_catalog_id uuid;
  v_type_id uuid;
  v_cat_id uuid;
  v_child_id uuid;
BEGIN
  -- POOL: Administrative
  SELECT id INTO v_pool_id FROM attribute_options WHERE type = 'POOL' AND value = 'Administrative';
  IF v_pool_id IS NULL THEN INSERT INTO attribute_options (type, value) VALUES ('POOL', 'Administrative') RETURNING id INTO v_pool_id; END IF;
  -- CATALOG: Accommodation
  SELECT id INTO v_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND value = 'Accommodation';
  IF v_catalog_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATALOG', 'Accommodation', ARRAY[v_pool_id]) RETURNING id INTO v_catalog_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_pool_id] WHERE id = v_catalog_id; END IF;
  -- TYPE: Charges & Fees
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Charges & Fees';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Charges & Fees', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Surcharge
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Surcharge';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Surcharge', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Delivery
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Delivery';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Delivery', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Late
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Late';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Late', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Packing
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Packing';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Packing', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Pickup
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Pickup';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Pickup', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Service
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Service';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Service', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATALOG: Health Care
  SELECT id INTO v_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND value = 'Health Care';
  IF v_catalog_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATALOG', 'Health Care', ARRAY[v_pool_id]) RETURNING id INTO v_catalog_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_pool_id] WHERE id = v_catalog_id; END IF;
  -- SUB: Delivery
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Delivery';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Delivery', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Rental
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Rental';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Rental', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Supply
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Supply';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Supply', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATALOG: Linen Hub
  SELECT id INTO v_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND value = 'Linen Hub';
  IF v_catalog_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATALOG', 'Linen Hub', ARRAY[v_pool_id]) RETURNING id INTO v_catalog_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_pool_id] WHERE id = v_catalog_id; END IF;
  -- CATEGORY: Mat
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Mat';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Mat', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bath
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bath';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Towel
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Towel';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Towel', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bath
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bath';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Face Washer
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Face Washer';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Face Washer', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Hand
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Hand';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Hand', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATALOG: Mining
  SELECT id INTO v_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND value = 'Mining';
  IF v_catalog_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATALOG', 'Mining', ARRAY[v_pool_id]) RETURNING id INTO v_catalog_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_pool_id] WHERE id = v_catalog_id; END IF;
  -- CATEGORY: Surcharge
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Surcharge';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Surcharge', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Delivery
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Delivery';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Delivery', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Handling
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Handling';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Handling', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- POOL: COG
  SELECT id INTO v_pool_id FROM attribute_options WHERE type = 'POOL' AND value = 'COG';
  IF v_pool_id IS NULL THEN INSERT INTO attribute_options (type, value) VALUES ('POOL', 'COG') RETURNING id INTO v_pool_id; END IF;
  -- CATALOG: Accommodation
  SELECT id INTO v_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND value = 'Accommodation';
  IF v_catalog_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATALOG', 'Accommodation', ARRAY[v_pool_id]) RETURNING id INTO v_catalog_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_pool_id] WHERE id = v_catalog_id; END IF;
  -- TYPE: Bath Linen
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Bath Linen';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Bath Linen', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Cloth
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Cloth';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Cloth', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Face Washer
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Face Washer';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Face Washer', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Curtains & Drapes
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Curtains & Drapes';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Curtains & Drapes', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Shower
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Shower';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Shower', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Mat
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Mat';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Mat', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bath
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bath';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Robe
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Robe';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Robe', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bath
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bath';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Rug
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Rug';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Rug', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bath
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bath';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Sheet
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Sheet';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Sheet', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bath
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bath';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Towel
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Towel';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Towel', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bath
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bath';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Face
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Face';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Face', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Face Washer
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Face Washer';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Face Washer', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Hand
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Hand';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Hand', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Pool
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Pool';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Pool', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- TYPE: Bed Linen
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Bed Linen';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Bed Linen', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Bedspread
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Bedspread';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Bedspread', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Custom
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Custom';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Blanket
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Blanket';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Blanket', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: COG
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'COG';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'COG', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Custom
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Custom';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Cover
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Cover';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Cover', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Cushion
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Cushion';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Cushion', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Ironing Board
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Ironing Board';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Ironing Board', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Doonas & Quilts
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Doonas & Quilts';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Doonas & Quilts', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Cover
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Cover';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Cover', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Insert
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Insert';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Insert', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Pillow
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Pillow';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Pillow', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Case Custom
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Case Custom';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Case Custom', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Case Standard
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Case Standard';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Case Standard', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Protector
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Protector';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Protector', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Doona / Quilt
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Doona / Quilt';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Doona / Quilt', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Mattress
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Mattress';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Mattress', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Pillow
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Pillow';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Pillow', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Pillow Case
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Pillow Case';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Pillow Case', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Rags
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Rags';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Rags', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: COG
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'COG';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'COG', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Rug
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Rug';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Rug', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Knee
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Knee';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Knee', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Runner
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Runner';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Runner', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bed
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bed';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bed', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Sheet
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Sheet';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Sheet', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Custom
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Custom';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Double
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Double';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Double', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Flat
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Flat';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Flat', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Single
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Single';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Single', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Standard
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Standard';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Top
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Top';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Top', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Topper
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Topper';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Topper', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Mattress
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Mattress';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Mattress', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- TYPE: Hospital Wear
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Hospital Wear';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Hospital Wear', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Robe
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Robe';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Robe', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bath
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bath';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- TYPE: Mats
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Mats';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Mats', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Mats
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Mats';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Mats', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bath
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bath';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
END $$;