DO $$
DECLARE
  v_pool_id uuid;
  v_catalog_id uuid;
  v_type_id uuid;
  v_cat_id uuid;
  v_sub_id uuid;
BEGIN
  -- 1. POOL: Administrative
  SELECT id INTO v_pool_id FROM attribute_options WHERE type = 'POOL' AND value = 'Administrative';
  IF v_pool_id IS NULL THEN
    INSERT INTO attribute_options (type, value) VALUES ('POOL', 'Administrative') RETURNING id INTO v_pool_id;
  END IF;

  -- 2. CATALOG: Accommodation
  SELECT id INTO v_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND value = 'Accommodation';
  -- Update parent
  UPDATE attribute_options SET parent_ids = ARRAY[v_pool_id] WHERE id = v_catalog_id;

  -- 3. TYPE: Bath Linen
  -- Check existence first
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Bath Linen';
  IF v_type_id IS NULL THEN
    INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Bath Linen', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE
    UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id;
  END IF;

  -- 4. CATEGORY: Mat
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Mat';
  IF v_cat_id IS NOT NULL THEN
    UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id;
  END IF;

  -- 5. SUB: Bath
  SELECT id INTO v_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bath';
  IF v_sub_id IS NOT NULL THEN
    UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_sub_id;
  END IF;

END $$;
