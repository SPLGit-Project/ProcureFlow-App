DO $$
DECLARE
  v_pool_id uuid;
  v_catalog_id uuid;
  v_type_id uuid;
  v_cat_id uuid;
  v_child_id uuid;
BEGIN
  -- POOL: General Pool
  SELECT id INTO v_pool_id FROM attribute_options WHERE type = 'POOL' AND value = 'General Pool';
  IF v_pool_id IS NULL THEN INSERT INTO attribute_options (type, value) VALUES ('POOL', 'General Pool') RETURNING id INTO v_pool_id; END IF;
  -- CATALOG: Theater
  SELECT id INTO v_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND value = 'Theater';
  IF v_catalog_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATALOG', 'Theater', ARRAY[v_pool_id]) RETURNING id INTO v_catalog_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_pool_id] WHERE id = v_catalog_id; END IF;
  -- TYPE: Surgeon Items
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Surgeon Items';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Surgeon Items', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Gown
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Gown';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Gown', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Surgeon
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Surgeon';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Surgeon', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- POOL: Logistics
  SELECT id INTO v_pool_id FROM attribute_options WHERE type = 'POOL' AND value = 'Logistics';
  IF v_pool_id IS NULL THEN INSERT INTO attribute_options (type, value) VALUES ('POOL', 'Logistics') RETURNING id INTO v_pool_id; END IF;
  -- CATALOG: Transport
  SELECT id INTO v_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND value = 'Transport';
  IF v_catalog_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATALOG', 'Transport', ARRAY[v_pool_id]) RETURNING id INTO v_catalog_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_pool_id] WHERE id = v_catalog_id; END IF;
  -- TYPE: Delivery
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Delivery';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Delivery', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Inserts & Liners
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Inserts & Liners';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Inserts & Liners', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bin Liner
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bin Liner';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bin Liner', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Sheet
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Sheet';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Sheet', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Linen Bags
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Linen Bags';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Linen Bags', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bag
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bag';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bag', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Reject
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Reject';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Reject', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Safety
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Safety';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Safety', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Soiled
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Soiled';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Soiled', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Standard
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Standard';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Zip
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Zip';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Zip', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Trolleys & Tubs
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Trolleys & Tubs';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Trolleys & Tubs', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Cage
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Cage';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Cage', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Full
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Full';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Full', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Reject
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Reject';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Reject', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Rental
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Rental';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Rental', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Soiled
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Soiled';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Soiled', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- POOL: Rental
  SELECT id INTO v_pool_id FROM attribute_options WHERE type = 'POOL' AND value = 'Rental';
  IF v_pool_id IS NULL THEN INSERT INTO attribute_options (type, value) VALUES ('POOL', 'Rental') RETURNING id INTO v_pool_id; END IF;
  -- CATALOG: Accommodation
  SELECT id INTO v_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND value = 'Accommodation';
  IF v_catalog_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATALOG', 'Accommodation', ARRAY[v_pool_id]) RETURNING id INTO v_catalog_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_pool_id] WHERE id = v_catalog_id; END IF;
  -- TYPE: Bed Linen
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Bed Linen';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Bed Linen', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Sheet
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Sheet';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Sheet', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Flat
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Flat';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Flat', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATALOG: Linen Hub
  SELECT id INTO v_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND value = 'Linen Hub';
  IF v_catalog_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATALOG', 'Linen Hub', ARRAY[v_pool_id]) RETURNING id INTO v_catalog_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_pool_id] WHERE id = v_catalog_id; END IF;
  -- TYPE: Bath Linen
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Bath Linen';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Bath Linen', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Towel
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Towel';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Towel', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bath
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bath';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- TYPE: Bed Linen
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Bed Linen';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Bed Linen', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Blanket
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Blanket';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Blanket', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Cellular
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Cellular';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Cellular', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Fibresmart
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Fibresmart';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Fibresmart', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- TYPE: Charges & Fees
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Charges & Fees';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Charges & Fees', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Doonas & Quilts
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Doonas & Quilts';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Doonas & Quilts', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Cover
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Cover';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Cover', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- TYPE: Cleaning
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Cleaning';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Cleaning', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Mop
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Mop';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Mop', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Head
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Head';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Head', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- TYPE: Theatre
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Theatre';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Theatre', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Scrubs-Bottom
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Scrubs-Bottom';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Scrubs-Bottom', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Pants
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Pants';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Pants', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Scrubs-Top
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Scrubs-Top';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Scrubs-Top', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Jacket
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Jacket';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Jacket', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Top
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Top';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Top', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
END $$;