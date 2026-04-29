-- Phase 2a: Item Creation Reference Data
-- Seeds initial values for new attribute_option types used by the item creation workflow.

-- Customer Pricing Groups (used by Group sell price type)
INSERT INTO attribute_options (id, type, value, active_flag, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'PREVIEW_CUSTOMER_PRICING_GROUP', 'Standard',         true, NOW(), NOW()),
  (gen_random_uuid(), 'PREVIEW_CUSTOMER_PRICING_GROUP', 'Healthcare',        true, NOW(), NOW()),
  (gen_random_uuid(), 'PREVIEW_CUSTOMER_PRICING_GROUP', 'Accommodation',     true, NOW(), NOW()),
  (gen_random_uuid(), 'PREVIEW_CUSTOMER_PRICING_GROUP', 'Key Account',       true, NOW(), NOW()),
  (gen_random_uuid(), 'PREVIEW_CUSTOMER_PRICING_GROUP', 'Government',        true, NOW(), NOW()),
  (gen_random_uuid(), 'PREVIEW_CUSTOMER_PRICING_GROUP', 'Not for Profit',    true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- SAP Financial Mapping codes
INSERT INTO attribute_options (id, type, value, active_flag, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'PREVIEW_SAP_MAPPING', 'LAUNDRY_REV',   true, NOW(), NOW()),
  (gen_random_uuid(), 'PREVIEW_SAP_MAPPING', 'HIRE_REV',       true, NOW(), NOW()),
  (gen_random_uuid(), 'PREVIEW_SAP_MAPPING', 'COG_REV',        true, NOW(), NOW()),
  (gen_random_uuid(), 'PREVIEW_SAP_MAPPING', 'LINEN_HUB_REV',  true, NOW(), NOW()),
  (gen_random_uuid(), 'PREVIEW_SAP_MAPPING', 'ACCOM_REV',      true, NOW(), NOW()),
  (gen_random_uuid(), 'PREVIEW_SAP_MAPPING', 'HEALTH_REV',     true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Supplier extended categories
INSERT INTO attribute_options (id, type, value, active_flag, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'PREVIEW_SUPPLIER_EXT', 'Tier 1 – Core',      true, NOW(), NOW()),
  (gen_random_uuid(), 'PREVIEW_SUPPLIER_EXT', 'Tier 2 – Preferred', true, NOW(), NOW()),
  (gen_random_uuid(), 'PREVIEW_SUPPLIER_EXT', 'Tier 3 – Approved',  true, NOW(), NOW()),
  (gen_random_uuid(), 'PREVIEW_SUPPLIER_EXT', 'Direct Import',      true, NOW(), NOW()),
  (gen_random_uuid(), 'PREVIEW_SUPPLIER_EXT', 'Local',              true, NOW(), NOW()),
  (gen_random_uuid(), 'PREVIEW_SUPPLIER_EXT', 'International',      true, NOW(), NOW())
ON CONFLICT DO NOTHING;
