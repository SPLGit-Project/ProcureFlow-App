DO $$
DECLARE
  l_pool_id uuid;
  l_catalog_id uuid;
  l_type_id uuid;
  l_cat_id uuid;
  l_sub_id uuid;
BEGIN
  -- POOL: Administrative
  SELECT id INTO l_pool_id FROM attribute_options WHERE type = 'POOL' AND lower(value) = 'administrative';
  IF l_pool_id IS NULL THEN
    INSERT INTO attribute_options (type, value, label) VALUES ('POOL', 'Administrative', 'Administrative') RETURNING id INTO l_pool_id;
  END IF;
    -- CATALOG: Accommodation
    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = 'accommodation';
    IF l_catalog_id IS NULL THEN
      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', 'Accommodation', 'Accommodation', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;
    ELSE
      -- Append parent if not present
      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);
    END IF;
      -- TYPE: Charges & Fees
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'charges & fees';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Charges & Fees', 'Charges & Fees', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Surcharge
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'surcharge';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Surcharge', 'Surcharge', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Delivery
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'delivery';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Delivery', 'Delivery', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Late
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'late';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Late', 'Late', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Packing
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'packing';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Packing', 'Packing', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Pickup
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pickup';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pickup', 'Pickup', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Service
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'service';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Service', 'Service', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
    -- CATALOG: Health Care
    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = 'health care';
    IF l_catalog_id IS NULL THEN
      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', 'Health Care', 'Health Care', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;
    ELSE
      -- Append parent if not present
      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);
    END IF;
      -- TYPE: Charges & Fees
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'charges & fees';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Charges & Fees', 'Charges & Fees', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Surcharge
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'surcharge';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Surcharge', 'Surcharge', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Delivery
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'delivery';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Delivery', 'Delivery', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Rental
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'rental';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Rental', 'Rental', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Supply
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'supply';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Supply', 'Supply', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
    -- CATALOG: Linen Hub
    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = 'linen hub';
    IF l_catalog_id IS NULL THEN
      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', 'Linen Hub', 'Linen Hub', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;
    ELSE
      -- Append parent if not present
      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);
    END IF;
      -- TYPE: Charges & Fees
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'charges & fees';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Charges & Fees', 'Charges & Fees', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Mat
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'mat';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Mat', 'Mat', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Towel
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'towel';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Towel', 'Towel', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Face Washer
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'face washer';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Face Washer', 'Face Washer', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Hand
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'hand';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Hand', 'Hand', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
    -- CATALOG: Mining
    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = 'mining';
    IF l_catalog_id IS NULL THEN
      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', 'Mining', 'Mining', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;
    ELSE
      -- Append parent if not present
      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);
    END IF;
      -- TYPE: Charges & Fees
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'charges & fees';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Charges & Fees', 'Charges & Fees', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Surcharge
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'surcharge';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Surcharge', 'Surcharge', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Delivery
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'delivery';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Delivery', 'Delivery', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Handling
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'handling';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Handling', 'Handling', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
  -- POOL: COG
  SELECT id INTO l_pool_id FROM attribute_options WHERE type = 'POOL' AND lower(value) = 'cog';
  IF l_pool_id IS NULL THEN
    INSERT INTO attribute_options (type, value, label) VALUES ('POOL', 'COG', 'COG') RETURNING id INTO l_pool_id;
  END IF;
    -- CATALOG: Accommodation
    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = 'accommodation';
    IF l_catalog_id IS NULL THEN
      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', 'Accommodation', 'Accommodation', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;
    ELSE
      -- Append parent if not present
      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);
    END IF;
      -- TYPE: Bath Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bath linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bath Linen', 'Bath Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Cloth
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'cloth';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Cloth', 'Cloth', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Face Washer
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'face washer';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Face Washer', 'Face Washer', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Curtains & Drapes
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'curtains & drapes';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Curtains & Drapes', 'Curtains & Drapes', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Shower
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'shower';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Shower', 'Shower', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Mat
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'mat';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Mat', 'Mat', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Robe
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'robe';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Robe', 'Robe', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Rug
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'rug';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Rug', 'Rug', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Sheet
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'sheet';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Sheet', 'Sheet', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Towel
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'towel';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Towel', 'Towel', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Face
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'face';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Face', 'Face', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Face Washer
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'face washer';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Face Washer', 'Face Washer', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Hand
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'hand';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Hand', 'Hand', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Pool
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pool';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pool', 'Pool', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Bed Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bed linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bed Linen', 'Bed Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Bedspread
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'bedspread';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Bedspread', 'Bedspread', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Custom
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'custom';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', 'Custom', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Blanket
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'blanket';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Blanket', 'Blanket', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: COG
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cog';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'COG', 'COG', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Custom
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'custom';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', 'Custom', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Cover
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'cover';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Cover', 'Cover', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Cushion
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cushion';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Cushion', 'Cushion', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Ironing Board
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'ironing board';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Ironing Board', 'Ironing Board', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Doonas & Quilts
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'doonas & quilts';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Doonas & Quilts', 'Doonas & Quilts', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Cover
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cover';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Cover', 'Cover', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Insert
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'insert';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Insert', 'Insert', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Pillow Case
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'pillow case';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Pillow Case', 'Pillow Case', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Custom
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'custom';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', 'Custom', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Standard
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'standard';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', 'Standard', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Protector
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'protector';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Protector', 'Protector', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Doona / Quilt
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'doona / quilt';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Doona / Quilt', 'Doona / Quilt', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Mattress
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'mattress';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Mattress', 'Mattress', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Pillow
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pillow';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pillow', 'Pillow', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Pillow Case
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pillow case';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pillow Case', 'Pillow Case', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Rags
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'rags';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Rags', 'Rags', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: COG
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cog';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'COG', 'COG', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Rug
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'rug';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Rug', 'Rug', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Knee
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'knee';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Knee', 'Knee', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Runner
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'runner';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Runner', 'Runner', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bed
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bed';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bed', 'Bed', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Sheet
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'sheet';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Sheet', 'Sheet', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Custom
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'custom';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', 'Custom', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Double
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'double';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Double', 'Double', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Flat
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'flat';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Flat', 'Flat', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Single
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'single';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Single', 'Single', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Standard
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'standard';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', 'Standard', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Top
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'top';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Top', 'Top', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Topper
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'topper';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Topper', 'Topper', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Mattress
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'mattress';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Mattress', 'Mattress', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Hospital Wear
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'hospital wear';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Hospital Wear', 'Hospital Wear', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Robe
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'robe';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Robe', 'Robe', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Mats
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'mats';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Mats', 'Mats', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Mats
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'mats';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Mats', 'Mats', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Table Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'table linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Table Linen', 'Table Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Napkin
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'napkin';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Napkin', 'Napkin', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Serviette
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'serviette';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Serviette', 'Serviette', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Work Wear
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'work wear';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Work Wear', 'Work Wear', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Clothing-Top
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'clothing-top';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Clothing-Top', 'Clothing-Top', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Shirt
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'shirt';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Shirt', 'Shirt', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
    -- CATALOG: Food & Beverages
    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = 'food & beverages';
    IF l_catalog_id IS NULL THEN
      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', 'Food & Beverages', 'Food & Beverages', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;
    ELSE
      -- Append parent if not present
      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);
    END IF;
      -- TYPE: Cleaning
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'cleaning';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Cleaning', 'Cleaning', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Mop
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'mop';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Mop', 'Mop', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Head
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'head';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Head', 'Head', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Kitchen Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'kitchen linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Kitchen Linen', 'Kitchen Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Cover
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'cover';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Cover', 'Cover', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Chair
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'chair';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Chair', 'Chair', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Kitchen Wear
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'kitchen wear';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Kitchen Wear', 'Kitchen Wear', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Apron
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'apron';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Apron', 'Apron', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Custom
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'custom';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', 'Custom', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Table Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'table linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Table Linen', 'Table Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Napkin
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'napkin';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Napkin', 'Napkin', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Serviette
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'serviette';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Serviette', 'Serviette', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Table Linen
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'table linen';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Table Linen', 'Table Linen', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Custom
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'custom';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', 'Custom', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Trestle
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'trestle';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Trestle', 'Trestle', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
    -- CATALOG: Health Care
    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = 'health care';
    IF l_catalog_id IS NULL THEN
      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', 'Health Care', 'Health Care', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;
    ELSE
      -- Append parent if not present
      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);
    END IF;
      -- TYPE: Bath Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bath linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bath Linen', 'Bath Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Curtains & Drapes
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'curtains & drapes';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Curtains & Drapes', 'Curtains & Drapes', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Custom
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'custom';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', 'Custom', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Fensitrated
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'fensitrated';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Fensitrated', 'Fensitrated', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Shower
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'shower';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Shower', 'Shower', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Mat
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'mat';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Mat', 'Mat', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Floor
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'floor';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Floor', 'Floor', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Towel
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'towel';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Towel', 'Towel', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Face Washer
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'face washer';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Face Washer', 'Face Washer', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Hand
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'hand';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Hand', 'Hand', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Bed Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bed linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bed Linen', 'Bed Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Bedspread
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'bedspread';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Bedspread', 'Bedspread', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Custom
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'custom';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', 'Custom', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Blanket
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'blanket';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Blanket', 'Blanket', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: COG
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cog';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'COG', 'COG', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Doonas & Quilts
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'doonas & quilts';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Doonas & Quilts', 'Doonas & Quilts', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Cover
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cover';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Cover', 'Cover', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Insert
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'insert';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Insert', 'Insert', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Pillow Case
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'pillow case';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Pillow Case', 'Pillow Case', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Custom
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'custom';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', 'Custom', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Protector
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'protector';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Protector', 'Protector', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Kylie
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'kylie';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Kylie', 'Kylie', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Mattress
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'mattress';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Mattress', 'Mattress', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Sheet
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'sheet';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Sheet', 'Sheet', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Cot
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cot';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Cot', 'Cot', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Custom
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'custom';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', 'Custom', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Fitted
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'fitted';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Fitted', 'Fitted', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Slide
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'slide';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Slide', 'Slide', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Standard
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'standard';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', 'Standard', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Sling
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'sling';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Sling', 'Sling', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Custom
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'custom';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', 'Custom', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Patient
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'patient';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Patient', 'Patient', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Cleaning
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'cleaning';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Cleaning', 'Cleaning', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Duster
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'duster';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Duster', 'Duster', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: High
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'high';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'High', 'High', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Microfibre
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'microfibre';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Microfibre', 'Microfibre', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Mop
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'mop';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Mop', 'Mop', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Head
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'head';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Head', 'Head', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: String
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'string';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'String', 'String', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Hospital Wear
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'hospital wear';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Hospital Wear', 'Hospital Wear', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Apparel
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'apparel';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Apparel', 'Apparel', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: T-Shirt
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 't-shirt';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'T-Shirt', 'T-Shirt', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Baby
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'baby';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Baby', 'Baby', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Feeder
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'feeder';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Feeder', 'Feeder', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Gown
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'gown';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Gown', 'Gown', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Wrap
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'wrap';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Wrap', 'Wrap', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Clothing-Baby
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'clothing-baby';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Clothing-Baby', 'Clothing-Baby', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bodysuit
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bodysuit';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bodysuit', 'Bodysuit', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Clothing-Top
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'clothing-top';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Clothing-Top', 'Clothing-Top', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Adults
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'adults';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Adults', 'Adults', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Gown
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'gown';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Gown', 'Gown', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Patient
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'patient';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Patient', 'Patient', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Hand Wear
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'hand wear';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Hand Wear', 'Hand Wear', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Gloves-Heat Resistant
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'gloves-heat resistant';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Gloves-Heat Resistant', 'Gloves-Heat Resistant', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Hood
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'hood';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Hood', 'Hood', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Counter
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'counter';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Counter', 'Counter', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Robe
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'robe';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Robe', 'Robe', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Scrubs-Bottom
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'scrubs-bottom';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Scrubs-Bottom', 'Scrubs-Bottom', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Pants
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pants';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pants', 'Pants', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Scrubs-Top
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'scrubs-top';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Scrubs-Top', 'Scrubs-Top', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Top
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'top';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Top', 'Top', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Sling
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'sling';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Sling', 'Sling', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Loop
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'loop';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Loop', 'Loop', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Kitchen Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'kitchen linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Kitchen Linen', 'Kitchen Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Towel
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'towel';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Towel', 'Towel', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Tea
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'tea';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Tea', 'Tea', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Kitchen Wear
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'kitchen wear';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Kitchen Wear', 'Kitchen Wear', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Hand Wear
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'hand wear';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Hand Wear', 'Hand Wear', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Oven Mitt
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'oven mitt';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Oven Mitt', 'Oven Mitt', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
    -- CATALOG: Linen Hub
    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = 'linen hub';
    IF l_catalog_id IS NULL THEN
      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', 'Linen Hub', 'Linen Hub', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;
    ELSE
      -- Append parent if not present
      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);
    END IF;
      -- TYPE: Bed Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bed linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bed Linen', 'Bed Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Sheet
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'sheet';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Sheet', 'Sheet', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Custom
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'custom';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', 'Custom', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
    -- CATALOG: Mining
    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = 'mining';
    IF l_catalog_id IS NULL THEN
      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', 'Mining', 'Mining', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;
    ELSE
      -- Append parent if not present
      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);
    END IF;
      -- TYPE: Bath Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bath linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bath Linen', 'Bath Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Curtains & Drapes
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'curtains & drapes';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Curtains & Drapes', 'Curtains & Drapes', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Custom
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'custom';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', 'Custom', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Shower
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'shower';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Shower', 'Shower', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Mat
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'mat';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Mat', 'Mat', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Sheet
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'sheet';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Sheet', 'Sheet', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Towel
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'towel';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Towel', 'Towel', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Face Washer
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'face washer';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Face Washer', 'Face Washer', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Gym
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'gym';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Gym', 'Gym', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Hand
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'hand';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Hand', 'Hand', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Bed Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bed linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bed Linen', 'Bed Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Blanket
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'blanket';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Blanket', 'Blanket', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: COG
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cog';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'COG', 'COG', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Doonas & Quilts
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'doonas & quilts';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Doonas & Quilts', 'Doonas & Quilts', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Comforter
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'comforter';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Comforter', 'Comforter', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Cover
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cover';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Cover', 'Cover', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Insert
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'insert';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Insert', 'Insert', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Pillow Case
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'pillow case';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Pillow Case', 'Pillow Case', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Custom
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'custom';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', 'Custom', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Protector
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'protector';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Protector', 'Protector', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Mattress
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'mattress';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Mattress', 'Mattress', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Pillow Case
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pillow case';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pillow Case', 'Pillow Case', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Sheet
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'sheet';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Sheet', 'Sheet', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Custom
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'custom';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', 'Custom', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Fitted
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'fitted';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Fitted', 'Fitted', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Flat
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'flat';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Flat', 'Flat', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Work Wear
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'work wear';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Work Wear', 'Work Wear', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Clothing-Top
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'clothing-top';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Clothing-Top', 'Clothing-Top', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Overalls
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'overalls';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Overalls', 'Overalls', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
    -- CATALOG: Theater
    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = 'theater';
    IF l_catalog_id IS NULL THEN
      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', 'Theater', 'Theater', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;
    ELSE
      -- Append parent if not present
      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);
    END IF;
      -- TYPE: Surgeon Items
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'surgeon items';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Surgeon Items', 'Surgeon Items', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Gown
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'gown';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Gown', 'Gown', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Surgeon
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'surgeon';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Surgeon', 'Surgeon', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
  -- POOL: General Pool
  SELECT id INTO l_pool_id FROM attribute_options WHERE type = 'POOL' AND lower(value) = 'general pool';
  IF l_pool_id IS NULL THEN
    INSERT INTO attribute_options (type, value, label) VALUES ('POOL', 'General Pool', 'General Pool') RETURNING id INTO l_pool_id;
  END IF;
    -- CATALOG: Accommodation
    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = 'accommodation';
    IF l_catalog_id IS NULL THEN
      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', 'Accommodation', 'Accommodation', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;
    ELSE
      -- Append parent if not present
      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);
    END IF;
      -- TYPE: Bath Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bath linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bath Linen', 'Bath Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Curtains & Drapes
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'curtains & drapes';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Curtains & Drapes', 'Curtains & Drapes', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Shower
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'shower';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Shower', 'Shower', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Mat
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'mat';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Mat', 'Mat', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Rug
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'rug';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Rug', 'Rug', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Sheet
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'sheet';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Sheet', 'Sheet', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Towel
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'towel';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Towel', 'Towel', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Bath Mat
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath mat';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath Mat', 'Bath Mat', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Face Washer
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'face washer';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Face Washer', 'Face Washer', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Hand
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'hand';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Hand', 'Hand', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Pool
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pool';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pool', 'Pool', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Bathroom
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bathroom';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bathroom', 'Bathroom', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Towel
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'towel';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Towel', 'Towel', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Bed Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bed linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bed Linen', 'Bed Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Blanket
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'blanket';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Blanket', 'Blanket', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Cellular
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cellular';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Cellular', 'Cellular', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Cover
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'cover';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Cover', 'Cover', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Couch
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'couch';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Couch', 'Couch', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Doonas & Quilts
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'doonas & quilts';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Doonas & Quilts', 'Doonas & Quilts', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Cover
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cover';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Cover', 'Cover', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Insert
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'insert';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Insert', 'Insert', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Pillow
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'pillow';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Pillow', 'Pillow', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Case
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'case';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Case', 'Case', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Pillow Case
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'pillow case';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Pillow Case', 'Pillow Case', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Circle
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'circle';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Circle', 'Circle', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Euro
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'euro';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Euro', 'Euro', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Firm
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'firm';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Firm', 'Firm', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Soft
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'soft';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Soft', 'Soft', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Standard
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'standard';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', 'Standard', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Protector
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'protector';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Protector', 'Protector', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Mattress
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'mattress';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Mattress', 'Mattress', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Pinkies/Kylie
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pinkies/kylie';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pinkies/Kylie', 'Pinkies/Kylie', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Sheet
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'sheet';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Sheet', 'Sheet', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Cot
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cot';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Cot', 'Cot', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Fitted
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'fitted';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Fitted', 'Fitted', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Flat
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'flat';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Flat', 'Flat', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Slide
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'slide';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Slide', 'Slide', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Standard
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'standard';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', 'Standard', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Top
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'top';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Top', 'Top', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Charges & Fees
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'charges & fees';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Charges & Fees', 'Charges & Fees', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Surcharge
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'surcharge';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Surcharge', 'Surcharge', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Delivery
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'delivery';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Delivery', 'Delivery', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Ex-Items
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'ex-items';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Ex-Items', 'Ex-Items', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Bag
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'bag';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Bag', 'Bag', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Laundry
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'laundry';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Laundry', 'Laundry', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Rags
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'rags';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Rags', 'Rags', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bag
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bag';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bag', 'Bag', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Towels
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'towels';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Towels', 'Towels', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Hospital Wear
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'hospital wear';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Hospital Wear', 'Hospital Wear', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Gown
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'gown';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Gown', 'Gown', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Short Sleeve
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'short sleeve';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Short Sleeve', 'Short Sleeve', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Robe
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'robe';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Robe', 'Robe', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Shirt
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'shirt';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Shirt', 'Shirt', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Uniform
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'uniform';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Uniform', 'Uniform', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Kitchen Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'kitchen linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Kitchen Linen', 'Kitchen Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Cloth
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'cloth';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Cloth', 'Cloth', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Dorset
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'dorset';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Dorset', 'Dorset', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Glass
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'glass';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Glass', 'Glass', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Microfiber
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'microfiber';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Microfiber', 'Microfiber', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Polish
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'polish';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Polish', 'Polish', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Mat
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'mat';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Mat', 'Mat', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Dust
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'dust';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Dust', 'Dust', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Napkin
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'napkin';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Napkin', 'Napkin', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Serviette
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'serviette';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Serviette', 'Serviette', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Towel
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'towel';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Towel', 'Towel', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Tea
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'tea';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Tea', 'Tea', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Kitchen Wear
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'kitchen wear';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Kitchen Wear', 'Kitchen Wear', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Apron
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'apron';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Apron', 'Apron', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Butcher
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'butcher';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Butcher', 'Butcher', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Mats
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'mats';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Mats', 'Mats', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Mats
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'mats';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Mats', 'Mats', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Table Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'table linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Table Linen', 'Table Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Mat
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'mat';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Mat', 'Mat', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Place
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'place';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Place', 'Place', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Napkin
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'napkin';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Napkin', 'Napkin', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Cocktail
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cocktail';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Cocktail', 'Cocktail', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Serviette
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'serviette';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Serviette', 'Serviette', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Theatre
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'theatre';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Theatre', 'Theatre', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Scrubs-Top
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'scrubs-top';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Scrubs-Top', 'Scrubs-Top', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Surgeon
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'surgeon';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Surgeon', 'Surgeon', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
    -- CATALOG: Food & Beverages
    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = 'food & beverages';
    IF l_catalog_id IS NULL THEN
      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', 'Food & Beverages', 'Food & Beverages', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;
    ELSE
      -- Append parent if not present
      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);
    END IF;
      -- TYPE: Apparel
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'apparel';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Apparel', 'Apparel', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Cap
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'cap';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Cap', 'Cap', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Rubber
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'rubber';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Rubber', 'Rubber', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Bath Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bath linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bath Linen', 'Bath Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Towel
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'towel';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Towel', 'Towel', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Salon
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'salon';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Salon', 'Salon', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Cleaning
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'cleaning';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Cleaning', 'Cleaning', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Mop
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'mop';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Mop', 'Mop', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Head
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'head';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Head', 'Head', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Ex-Items
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'ex-items';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Ex-Items', 'Ex-Items', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Rags
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'rags';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Rags', 'Rags', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Tea Towels
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'tea towels';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Tea Towels', 'Tea Towels', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Kitchen Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'kitchen linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Kitchen Linen', 'Kitchen Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Cloth
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'cloth';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Cloth', 'Cloth', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Glass
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'glass';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Glass', 'Glass', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Huck
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'huck';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Huck', 'Huck', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Table
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'table';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Table', 'Table', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Tray
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'tray';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Tray', 'Tray', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Mat
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'mat';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Mat', 'Mat', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Dust
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'dust';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Dust', 'Dust', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Table Linen
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'table linen';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Table Linen', 'Table Linen', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Overlay
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'overlay';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Overlay', 'Overlay', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Standard
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'standard';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', 'Standard', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Towel
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'towel';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Towel', 'Towel', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Tea
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'tea';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Tea', 'Tea', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Kitchen Wear
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'kitchen wear';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Kitchen Wear', 'Kitchen Wear', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Apron
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'apron';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Apron', 'Apron', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bib
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bib';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bib', 'Bib', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Butcher
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'butcher';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Butcher', 'Butcher', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Waist
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'waist';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Waist', 'Waist', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Table Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'table linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Table Linen', 'Table Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Napkin
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'napkin';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Napkin', 'Napkin', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Serviette
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'serviette';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Serviette', 'Serviette', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Table Linen
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'table linen';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Table Linen', 'Table Linen', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Crease-Resistant
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'crease-resistant';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Crease-Resistant', 'Crease-Resistant', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Momie
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'momie';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Momie', 'Momie', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Standard
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'standard';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', 'Standard', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Trestle
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'trestle';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Trestle', 'Trestle', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Visa
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'visa';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Visa', 'Visa', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Work Wear
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'work wear';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Work Wear', 'Work Wear', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Clothing-Bottom
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'clothing-bottom';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Clothing-Bottom', 'Clothing-Bottom', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Pants-Freezer
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pants-freezer';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pants-Freezer', 'Pants-Freezer', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Clothing-Top
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'clothing-top';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Clothing-Top', 'Clothing-Top', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Jacket-Freezer
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'jacket-freezer';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Jacket-Freezer', 'Jacket-Freezer', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Uniform-Top
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'uniform-top';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Uniform-Top', 'Uniform-Top', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Shirt
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'shirt';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Shirt', 'Shirt', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
    -- CATALOG: Health Care
    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = 'health care';
    IF l_catalog_id IS NULL THEN
      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', 'Health Care', 'Health Care', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;
    ELSE
      -- Append parent if not present
      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);
    END IF;
      -- TYPE: Bath Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bath linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bath Linen', 'Bath Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Curtains & Drapes
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'curtains & drapes';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Curtains & Drapes', 'Curtains & Drapes', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Draw
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'draw';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Draw', 'Draw', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Screen
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'screen';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Screen', 'Screen', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Shower
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'shower';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Shower', 'Shower', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Mat
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'mat';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Mat', 'Mat', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Towel
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'towel';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Towel', 'Towel', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Face Washer
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'face washer';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Face Washer', 'Face Washer', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Hand
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'hand';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Hand', 'Hand', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Huck
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'huck';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Huck', 'Huck', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Bed Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bed linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bed Linen', 'Bed Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Baby
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'baby';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Baby', 'Baby', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Blanket
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'blanket';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Blanket', 'Blanket', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Cot
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cot';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Cot', 'Cot', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Bedspread
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'bedspread';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Bedspread', 'Bedspread', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Standard
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'standard';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', 'Standard', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Blanket
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'blanket';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Blanket', 'Blanket', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bassinette
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bassinette';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bassinette', 'Bassinette', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Cellolite
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cellolite';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Cellolite', 'Cellolite', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Cellular
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cellular';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Cellular', 'Cellular', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Cot
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cot';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Cot', 'Cot', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Sperry
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'sperry';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Sperry', 'Sperry', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Doonas & Quilts
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'doonas & quilts';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Doonas & Quilts', 'Doonas & Quilts', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Cover
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cover';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Cover', 'Cover', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Insert
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'insert';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Insert', 'Insert', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Pillow Case
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'pillow case';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Pillow Case', 'Pillow Case', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Child
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'child';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Child', 'Child', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Standard
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'standard';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', 'Standard', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Protector
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'protector';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Protector', 'Protector', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bedpad
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bedpad';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bedpad', 'Bedpad', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Kylie/Comfort
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'kylie/comfort';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Kylie/Comfort', 'Kylie/Comfort', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Mattress
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'mattress';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Mattress', 'Mattress', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Pinkie
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pinkie';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pinkie', 'Pinkie', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Pinkies
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pinkies';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pinkies', 'Pinkies', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Runner
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'runner';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Runner', 'Runner', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bed
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bed';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bed', 'Bed', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Sheet
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'sheet';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Sheet', 'Sheet', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bassinette
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bassinette';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bassinette', 'Bassinette', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Brake
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'brake';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Brake', 'Brake', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Cot
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cot';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Cot', 'Cot', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Double
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'double';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Double', 'Double', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Draw
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'draw';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Draw', 'Draw', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Envelope
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'envelope';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Envelope', 'Envelope', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Fitted
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'fitted';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Fitted', 'Fitted', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Single
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'single';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Single', 'Single', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Slide
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'slide';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Slide', 'Slide', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Slip
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'slip';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Slip', 'Slip', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Split
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'split';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Split', 'Split', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Standard
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'standard';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', 'Standard', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Top
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'top';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Top', 'Top', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Cleaning
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'cleaning';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Cleaning', 'Cleaning', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Mop
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'mop';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Mop', 'Mop', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Head
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'head';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Head', 'Head', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Pad
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pad';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pad', 'Pad', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Screw
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'screw';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Screw', 'Screw', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Feeding
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'feeding';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Feeding', 'Feeding', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Bib
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'bib';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Bib', 'Bib', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Adult
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'adult';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Adult', 'Adult', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Hospital Wear
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'hospital wear';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Hospital Wear', 'Hospital Wear', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Apparel
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'apparel';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Apparel', 'Apparel', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Pyjamas
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pyjamas';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pyjamas', 'Pyjamas', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Scrub
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'scrub';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Scrub', 'Scrub', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Apron
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'apron';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Apron', 'Apron', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bib
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bib';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bib', 'Bib', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Caress
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'caress';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Caress', 'Caress', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Standard
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'standard';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', 'Standard', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Swab
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'swab';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Swab', 'Swab', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Baby
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'baby';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Baby', 'Baby', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bib
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bib';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bib', 'Bib', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Feeder
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'feeder';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Feeder', 'Feeder', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Gown
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'gown';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Gown', 'Gown', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Nappy
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'nappy';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Nappy', 'Nappy', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Wrap
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'wrap';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Wrap', 'Wrap', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Clothing-Baby
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'clothing-baby';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Clothing-Baby', 'Clothing-Baby', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Vest
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'vest';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Vest', 'Vest', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Clothing-Bottom
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'clothing-bottom';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Clothing-Bottom', 'Clothing-Bottom', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Pants
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pants';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pants', 'Pants', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Pyjamas
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pyjamas';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pyjamas', 'Pyjamas', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Shorts
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'shorts';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Shorts', 'Shorts', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Clothing-Top
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'clothing-top';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Clothing-Top', 'Clothing-Top', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Adults
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'adults';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Adults', 'Adults', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Jacket-Stud
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'jacket-stud';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Jacket-Stud', 'Jacket-Stud', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Jumper
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'jumper';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Jumper', 'Jumper', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Pyjamas
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pyjamas';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pyjamas', 'Pyjamas', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Curtain
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'curtain';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Curtain', 'Curtain', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Recycle
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'recycle';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Recycle', 'Recycle', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Gown
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'gown';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Gown', 'Gown', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Custom
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'custom';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Custom', 'Custom', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Dressing
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'dressing';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Dressing', 'Dressing', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Patient
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'patient';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Patient', 'Patient', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Theatre
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'theatre';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Theatre', 'Theatre', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Utility
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'utility';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Utility', 'Utility', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Hand Wear
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'hand wear';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Hand Wear', 'Hand Wear', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Gloves
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'gloves';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Gloves', 'Gloves', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Robe
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'robe';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Robe', 'Robe', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Rug
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'rug';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Rug', 'Rug', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bunny
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bunny';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bunny', 'Bunny', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Scrubs-Bottom
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'scrubs-bottom';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Scrubs-Bottom', 'Scrubs-Bottom', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Pants
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pants';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pants', 'Pants', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Scrubs-Top
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'scrubs-top';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Scrubs-Top', 'Scrubs-Top', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Top
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'top';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Top', 'Top', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Uniform-Top
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'uniform-top';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Uniform-Top', 'Uniform-Top', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Shirt
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'shirt';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Shirt', 'Shirt', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Kitchen Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'kitchen linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Kitchen Linen', 'Kitchen Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Cloth
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'cloth';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Cloth', 'Cloth', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bench
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bench';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bench', 'Bench', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Microfiber
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'microfiber';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Microfiber', 'Microfiber', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Table
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'table';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Table', 'Table', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Towel
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'towel';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Towel', 'Towel', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Kitchen
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'kitchen';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Kitchen', 'Kitchen', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Tea
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'tea';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Tea', 'Tea', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Table Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'table linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Table Linen', 'Table Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Napkin
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'napkin';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Napkin', 'Napkin', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Serviette
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'serviette';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Serviette', 'Serviette', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Theatre
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'theatre';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Theatre', 'Theatre', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Clothing-Bottom
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'clothing-bottom';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Clothing-Bottom', 'Clothing-Bottom', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Pants
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pants';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pants', 'Pants', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Surgeon
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'surgeon';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Surgeon', 'Surgeon', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Curtains & Drapes
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'curtains & drapes';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Curtains & Drapes', 'Curtains & Drapes', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Loose
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'loose';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Loose', 'Loose', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Mini
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'mini';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Mini', 'Mini', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Jacket
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'jacket';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Jacket', 'Jacket', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Warm Up
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'warm up';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Warm Up', 'Warm Up', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Pack
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'pack';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Pack', 'Pack', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Major
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'major';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Major', 'Major', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Minor
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'minor';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Minor', 'Minor', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Urology
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'urology';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Urology', 'Urology', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Packs
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'packs';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Packs', 'Packs', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Surgical
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'surgical';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Surgical', 'Surgical', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Pop Up
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'pop up';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Pop Up', 'Pop Up', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Green
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'green';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Green', 'Green', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Scrubs-Bottom
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'scrubs-bottom';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Scrubs-Bottom', 'Scrubs-Bottom', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Pants
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pants';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pants', 'Pants', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Scrubs-Top
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'scrubs-top';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Scrubs-Top', 'Scrubs-Top', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Jacket
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'jacket';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Jacket', 'Jacket', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Surgeon
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'surgeon';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Surgeon', 'Surgeon', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Top
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'top';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Top', 'Top', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Unisex
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'unisex';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Unisex', 'Unisex', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Urology
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'urology';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Urology', 'Urology', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Theatre
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'theatre';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Theatre', 'Theatre', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Squares
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'squares';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Squares', 'Squares', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
    -- CATALOG: Linen Hub
    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = 'linen hub';
    IF l_catalog_id IS NULL THEN
      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', 'Linen Hub', 'Linen Hub', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;
    ELSE
      -- Append parent if not present
      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);
    END IF;
      -- TYPE: Bath Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bath linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bath Linen', 'Bath Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Towel
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'towel';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Towel', 'Towel', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Bed Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bed linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bed Linen', 'Bed Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Pillow Case
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'pillow case';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Pillow Case', 'Pillow Case', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Standard
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'standard';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', 'Standard', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Sheet
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'sheet';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Sheet', 'Sheet', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Standard
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'standard';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', 'Standard', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Top
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'top';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Top', 'Top', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Cleaning
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'cleaning';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Cleaning', 'Cleaning', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Mop
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'mop';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Mop', 'Mop', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Head
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'head';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Head', 'Head', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Kitchen Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'kitchen linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Kitchen Linen', 'Kitchen Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Napkin
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'napkin';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Napkin', 'Napkin', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Serviette
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'serviette';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Serviette', 'Serviette', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
    -- CATALOG: Mining
    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = 'mining';
    IF l_catalog_id IS NULL THEN
      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', 'Mining', 'Mining', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;
    ELSE
      -- Append parent if not present
      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);
    END IF;
      -- TYPE: Bath Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bath linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bath Linen', 'Bath Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Mat
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'mat';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Mat', 'Mat', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Towel
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'towel';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Towel', 'Towel', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Bed Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bed linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bed Linen', 'Bed Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Doonas & Quilts
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'doonas & quilts';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Doonas & Quilts', 'Doonas & Quilts', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Cover
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cover';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Cover', 'Cover', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Insert
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'insert';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Insert', 'Insert', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Sheet
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'sheet';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Sheet', 'Sheet', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Standard
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'standard';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', 'Standard', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
    -- CATALOG: Theater
    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = 'theater';
    IF l_catalog_id IS NULL THEN
      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', 'Theater', 'Theater', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;
    ELSE
      -- Append parent if not present
      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);
    END IF;
      -- TYPE: Packs
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'packs';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Packs', 'Packs', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Theater Pack
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'theater pack';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Theater Pack', 'Theater Pack', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: 
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = '';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', '', '', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Surgeon Items
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'surgeon items';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Surgeon Items', 'Surgeon Items', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Gown
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'gown';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Gown', 'Gown', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Surgeon
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'surgeon';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Surgeon', 'Surgeon', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
  -- POOL: Logistics
  SELECT id INTO l_pool_id FROM attribute_options WHERE type = 'POOL' AND lower(value) = 'logistics';
  IF l_pool_id IS NULL THEN
    INSERT INTO attribute_options (type, value, label) VALUES ('POOL', 'Logistics', 'Logistics') RETURNING id INTO l_pool_id;
  END IF;
    -- CATALOG: Transport
    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = 'transport';
    IF l_catalog_id IS NULL THEN
      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', 'Transport', 'Transport', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;
    ELSE
      -- Append parent if not present
      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);
    END IF;
      -- TYPE: Delivery
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'delivery';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Delivery', 'Delivery', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Inserts & Liners
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'inserts & liners';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Inserts & Liners', 'Inserts & Liners', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bin Liner
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bin liner';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bin Liner', 'Bin Liner', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Sheet
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'sheet';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Sheet', 'Sheet', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Linen Bags
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'linen bags';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Linen Bags', 'Linen Bags', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bag
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bag';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bag', 'Bag', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Reject
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'reject';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Reject', 'Reject', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Safety
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'safety';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Safety', 'Safety', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Soiled
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'soiled';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Soiled', 'Soiled', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Standard
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'standard';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', 'Standard', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Zip
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'zip';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Zip', 'Zip', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Trolleys & Tubs
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'trolleys & tubs';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Trolleys & Tubs', 'Trolleys & Tubs', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Cage
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cage';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Cage', 'Cage', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Full
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'full';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Full', 'Full', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Reject
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'reject';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Reject', 'Reject', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Rental
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'rental';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Rental', 'Rental', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Soiled
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'soiled';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Soiled', 'Soiled', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
  -- POOL: Rental
  SELECT id INTO l_pool_id FROM attribute_options WHERE type = 'POOL' AND lower(value) = 'rental';
  IF l_pool_id IS NULL THEN
    INSERT INTO attribute_options (type, value, label) VALUES ('POOL', 'Rental', 'Rental') RETURNING id INTO l_pool_id;
  END IF;
    -- CATALOG: Accommodation
    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = 'accommodation';
    IF l_catalog_id IS NULL THEN
      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', 'Accommodation', 'Accommodation', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;
    ELSE
      -- Append parent if not present
      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);
    END IF;
      -- TYPE: Bed Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bed linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bed Linen', 'Bed Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Sheet
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'sheet';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Sheet', 'Sheet', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Flat
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'flat';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Flat', 'Flat', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
    -- CATALOG: Linen Hub
    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = 'linen hub';
    IF l_catalog_id IS NULL THEN
      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', 'Linen Hub', 'Linen Hub', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;
    ELSE
      -- Append parent if not present
      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);
    END IF;
      -- TYPE: Bath Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bath linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bath Linen', 'Bath Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Towel
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'towel';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Towel', 'Towel', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Bath
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'bath';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Bath', 'Bath', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Bed Linen
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'bed linen';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Bed Linen', 'Bed Linen', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Blanket
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'blanket';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Blanket', 'Blanket', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Cellular
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cellular';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Cellular', 'Cellular', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Fibresmart
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'fibresmart';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Fibresmart', 'Fibresmart', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Charges & Fees
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'charges & fees';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Charges & Fees', 'Charges & Fees', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Doonas & Quilts
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'doonas & quilts';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Doonas & Quilts', 'Doonas & Quilts', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Cover
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'cover';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Cover', 'Cover', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Cleaning
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'cleaning';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Cleaning', 'Cleaning', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Mop
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'mop';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Mop', 'Mop', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Head
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'head';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Head', 'Head', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
      -- TYPE: Theatre
      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = 'theatre';
      IF l_type_id IS NULL THEN
        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', 'Theatre', 'Theatre', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;
      ELSE
        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);
      END IF;
        -- CATEGORY: Scrubs-Bottom
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'scrubs-bottom';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Scrubs-Bottom', 'Scrubs-Bottom', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Pants
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'pants';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Pants', 'Pants', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
        -- CATEGORY: Scrubs-Top
        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = 'scrubs-top';
        IF l_cat_id IS NULL THEN
          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', 'Scrubs-Top', 'Scrubs-Top', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;
        ELSE
          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);
        END IF;
          -- SUB_CATEGORY: Jacket
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'jacket';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Jacket', 'Jacket', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
          -- SUB_CATEGORY: Top
          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = 'top';
          IF l_sub_id IS NULL THEN
            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', 'Top', 'Top', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;
          ELSE
            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);
          END IF;
END $$;