-- Migration: Extend permissions, update items table, seed app_config,
--            and migrate existing item prices to item_sell_prices

-- ─── 1. Add workflow columns to items ────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE item_workflow_status AS ENUM (
    'LEGACY',           -- Pre-governance item (no request record)
    'DRAFT',
    'DATA_REVIEW',
    'PRICING_REVIEW',
    'APPROVAL_PENDING',
    'APPROVED',
    'ACTIVE',
    'REPLACED',
    'RETIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS workflow_status   item_workflow_status DEFAULT 'LEGACY',
  ADD COLUMN IF NOT EXISTS current_request_id UUID REFERENCES item_requests(id),
  ADD COLUMN IF NOT EXISTS last_published_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS publication_version INTEGER DEFAULT 0;

-- Set all existing items to LEGACY workflow status
UPDATE items SET workflow_status = 'LEGACY' WHERE workflow_status IS NULL;

-- ─── 2. Seed app_config values ────────────────────────────────────────────────
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS description TEXT;

INSERT INTO app_config (key, value, description)
VALUES
  ('margin_approval_threshold',    '25',    'Sell price margin % below which Commercial Manager approval is required'),
  ('item_request_form_enabled',    'false', 'Feature flag: show new item request form to all users'),
  ('approved_catalogue_enforced',  'false', 'Feature flag: PO creation must use items with active governed sell price'),
  ('legacy_item_editing_locked',   'false', 'Feature flag: block direct edit of unit_price via ItemWizard for governed items'),
  ('item_creation_preview_enabled','true',  'Feature flag: show item creation preview route to manage_development users')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;

-- ─── 3. Migrate existing item prices → item_sell_prices ──────────────────────
-- For every ACTIVE item that has a unit_price > 0 and NO existing sell price record,
-- create an ACTIVE STANDARD sell price record dated from item creation.
-- This ensures existing PO workflows continue resolving prices correctly.

INSERT INTO item_sell_prices (
  item_id,
  price_type,
  sale_uom,
  sell_price_ex_gst,
  tax_code,
  cost_basis,
  effective_from,
  effective_to,
  status,
  publish_to_salesforce,
  publish_to_bundle,
  publish_to_linenhub,
  notes,
  created_at
)
SELECT
  i.id,
  'STANDARD',
  COALESCE(i.uom, 'EA'),
  i.unit_price,
  'GST',
  0,  -- cost_basis unknown for legacy items; margin will show as 100%
  COALESCE(i.created_at::date, '2020-01-01'::date),
  NULL,  -- open-ended
  'ACTIVE',
  false,
  false,
  false,
  'Migrated from legacy items.unit_price — cost_basis unknown. Please update.',
  COALESCE(i.created_at, now())
FROM items i
WHERE i.unit_price IS NOT NULL
  AND i.unit_price > 0
  AND i.active_flag = true
  AND NOT EXISTS (
    SELECT 1 FROM item_sell_prices isp
    WHERE isp.item_id = i.id AND isp.status = 'ACTIVE'
  );

-- ─── 4. Seed new permissions into existing roles ──────────────────────────────
-- Add new permission IDs to role permissions arrays.
-- Only add to roles that logically need them; do not modify ADMIN (has all).

-- Master Data role (manage_item_definition, publish_items, view_all_requests)
UPDATE roles
SET permissions = array(
  SELECT DISTINCT unnest(permissions || ARRAY[
    'manage_item_definition',
    'publish_items',
    'view_all_requests',
    'approve_item_requests'
  ])
)
WHERE id = 'MASTER_DATA' OR name ILIKE '%master data%';

-- Procurement role
UPDATE roles
SET permissions = array(
  SELECT DISTINCT unnest(permissions || ARRAY[
    'manage_purchase_pricing',
    'view_purchase_pricing',
    'approve_item_requests'
  ])
)
WHERE id = 'PROCUREMENT' OR name ILIKE '%procurement%';

-- Sales / Finance role
UPDATE roles
SET permissions = array(
  SELECT DISTINCT unnest(permissions || ARRAY[
    'manage_sell_pricing',
    'view_sell_pricing',
    'manage_pricing_schedules',
    'approve_item_requests'
  ])
)
WHERE id IN ('SALES', 'FINANCE') OR name ILIKE '%sales%' OR name ILIKE '%finance%';

-- All authenticated users get manage_item_requests (anyone can submit a request)
UPDATE roles
SET permissions = array(
  SELECT DISTINCT unnest(permissions || ARRAY['manage_item_requests'])
)
WHERE id != 'ADMIN';

COMMENT ON COLUMN items.workflow_status IS
  'LEGACY = pre-governance item. ACTIVE = fully governed and published. '
  'Workflow status is driven by item_requests lifecycle; do not manually update.';

COMMENT ON COLUMN items.current_request_id IS
  'FK to the active item_request governing this item. NULL for LEGACY items.';
;
