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
  -- CATALOG: Health Care
  SELECT id INTO v_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND value = 'Health Care';
  IF v_catalog_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATALOG', 'Health Care', ARRAY[v_pool_id]) RETURNING id INTO v_catalog_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_pool_id] WHERE id = v_catalog_id; END IF;
  -- TYPE: Hospital Wear
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Hospital Wear';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Hospital Wear', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Clothing-Top
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Clothing-Top';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Clothing-Top', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Jacket-Stud
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Jacket-Stud';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Jacket-Stud', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Jumper
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Jumper';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Jumper', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Pyjamas
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Pyjamas';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Pyjamas', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Curtain
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Curtain';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Curtain', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Recycle
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Recycle';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Recycle', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Gown
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Gown';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Gown', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Custom
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Custom';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Dressing
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Dressing';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Dressing', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Patient
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Patient';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Patient', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Theatre
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Theatre';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Theatre', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Utility
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Utility';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Utility', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Hand Wear
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Hand Wear';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Hand Wear', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Gloves
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Gloves';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Gloves', ARRAY[v_cat_id]);
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
  -- SUB: Bunny
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bunny';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bunny', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
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
  -- SUB: Top
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Top';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Top', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Uniform-Top
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Uniform-Top';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Uniform-Top', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Shirt
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Shirt';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Shirt', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- TYPE: Kitchen Linen
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Kitchen Linen';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Kitchen Linen', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Cloth
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Cloth';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Cloth', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bench
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bench';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bench', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Microfiber
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Microfiber';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Microfiber', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Table
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Table';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Table', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Towel
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Towel';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Towel', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Kitchen
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Kitchen';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Kitchen', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Tea
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Tea';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Tea', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- TYPE: Table Linen
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Table Linen';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Table Linen', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Napkin
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Napkin';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Napkin', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Serviette
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Serviette';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Serviette', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- TYPE: Theatre
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Theatre';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Theatre', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Clothing-Bottom
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Clothing-Bottom';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Clothing-Bottom', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Pants
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Pants';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Pants', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Surgeon
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Surgeon';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Surgeon', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Curtains & Drapes
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Curtains & Drapes';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Curtains & Drapes', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Loose
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Loose';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Loose', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Mini
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Mini';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Mini', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Jacket
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Jacket';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Jacket', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Warm Up
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Warm Up';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Warm Up', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Pack
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Pack';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Pack', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Major
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Major';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Major', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Minor
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Minor';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Minor', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Urology
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Urology';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Urology', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Packs
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Packs';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Packs', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Surgical
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Surgical';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Surgical', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Pop
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Pop';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Pop', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Up Green
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Up Green';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Up Green', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
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
  -- SUB: Surgeon
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Surgeon';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Surgeon', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Top
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Top';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Top', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Unisex
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Unisex';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Unisex', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Urology
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Urology';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Urology', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Theatre
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Theatre';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Theatre', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Squares
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Squares';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Squares', ARRAY[v_cat_id]);
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
  -- CATEGORY: Pillow
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Pillow';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Pillow', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Case Standard
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Case Standard';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Case Standard', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Sheet
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Sheet';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Sheet', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Standard
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Standard';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Top
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Top';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Top', ARRAY[v_cat_id]);
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
  -- TYPE: Kitchen Linen
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Kitchen Linen';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Kitchen Linen', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Napkin
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Napkin';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Napkin', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Serviette
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Serviette';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Serviette', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATALOG: Mining
  SELECT id INTO v_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND value = 'Mining';
  IF v_catalog_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATALOG', 'Mining', ARRAY[v_pool_id]) RETURNING id INTO v_catalog_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_pool_id] WHERE id = v_catalog_id; END IF;
  -- TYPE: Bath Linen
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Bath Linen';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Bath Linen', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
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
  -- TYPE: Bed Linen
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Bed Linen';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Bed Linen', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
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
  -- CATEGORY: Sheet
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Sheet';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Sheet', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Standard
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Standard';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATALOG: Theater
  SELECT id INTO v_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND value = 'Theater';
  IF v_catalog_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATALOG', 'Theater', ARRAY[v_pool_id]) RETURNING id INTO v_catalog_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_pool_id] WHERE id = v_catalog_id; END IF;
  -- TYPE: Packs
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Packs';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Packs', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Theater
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Theater';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Theater', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Pack
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Pack';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Pack', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
END $$;