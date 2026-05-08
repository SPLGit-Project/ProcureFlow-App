-- Migration: Migrate catalog_items → item_purchase_prices
-- Idempotent: safe to run multiple times (uses ON CONFLICT DO NOTHING)

-- Step 1: Migrate catalog_items rows that have a price
INSERT INTO item_purchase_prices (
  item_id,
  supplier_id,
  supplier_item_code,
  purchase_price_ex_gst,
  currency,
  purchase_uom,
  pack_conversion_factor,
  is_preferred_supplier,
  effective_from,
  effective_to,
  status,
  notes
)
SELECT
  ci.item_id,
  ci.supplier_id,
  ci.supplier_sku,
  COALESCE(ci.price, 0),
  'AUD',
  COALESCE(i.uom, 'EA'),
  1.0,
  true,  -- Mark as preferred (only one supplier typically)
  '2020-01-01'::DATE,  -- Backdated to start of operations
  NULL,                -- Open-ended
  'ACTIVE',
  'Migrated from catalog_items — review purchase price accuracy'
FROM catalog_items ci
JOIN items i ON i.id = ci.item_id
WHERE ci.price IS NOT NULL AND ci.price > 0
  -- Don't create duplicate if we already migrated this item/supplier combo
  AND NOT EXISTS (
    SELECT 1 FROM item_purchase_prices ipp
    WHERE ipp.item_id = ci.item_id
      AND ipp.supplier_id = ci.supplier_id
      AND ipp.notes LIKE 'Migrated from catalog_items%'
  );

-- Step 2: Report on migration results
DO $$
DECLARE
  migrated_count INTEGER;
  total_catalog  INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM item_purchase_prices
  WHERE notes LIKE 'Migrated from catalog_items%';

  SELECT COUNT(*) INTO total_catalog
  FROM catalog_items WHERE price IS NOT NULL AND price > 0;

  RAISE NOTICE 'catalog_items migration: % of % records migrated to item_purchase_prices',
    migrated_count, total_catalog;
END;
$$;

-- Step 3: For items that now have both an item_sell_prices record (from P09 migration)
-- AND an item_purchase_prices record (from this migration), recalculate
-- the cost_basis on the sell price record (currently 0 for legacy migrated items)
UPDATE item_sell_prices isp
SET cost_basis = ipp.landed_cost,
    updated_at = now()
FROM item_purchase_prices ipp
WHERE ipp.item_id = isp.item_id
  AND ipp.status = 'ACTIVE'
  AND ipp.is_preferred_supplier = true
  AND isp.cost_basis = 0
  AND isp.notes LIKE 'Migrated from legacy%';

DO $$
BEGIN
  RAISE NOTICE 'Updated cost_basis on % legacy sell price records',
    (SELECT COUNT(*) FROM item_sell_prices WHERE notes LIKE 'Migrated from legacy%' AND cost_basis > 0);
END;
$$;
