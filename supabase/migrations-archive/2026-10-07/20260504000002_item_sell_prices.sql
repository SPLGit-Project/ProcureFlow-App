-- Migration: item_sell_prices
-- Date-effective sell price versioning per item, per price type
-- Governed by Sales/Finance team only

-- Sell price type enum
DO $$ BEGIN
  CREATE TYPE sell_price_type AS ENUM (
    'STANDARD',
    'GROUP',
    'CUSTOMER_SPECIFIC',
    'CONTRACT',
    'PROMOTIONAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Sell price status (reuse same lifecycle as purchase prices)
DO $$ BEGIN
  CREATE TYPE sell_price_status AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED_FUTURE',
    'ACTIVE',
    'SUPERSEDED',
    'EXPIRED',
    'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS item_sell_prices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id               UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  price_type            sell_price_type NOT NULL DEFAULT 'STANDARD',

  -- Customer scoping — NULL for STANDARD and GROUP types
  customer_id           UUID,  -- FK to customers table when it exists
  customer_group_id     UUID,  -- FK to customer_groups table when it exists
  contract_id           UUID,  -- FK to contracts table when it exists

  sale_uom              TEXT NOT NULL,
  sell_price_ex_gst     NUMERIC(12,4) NOT NULL CHECK (sell_price_ex_gst >= 0),
  tax_code              TEXT NOT NULL DEFAULT 'GST',

  -- Cost basis locked at time of price creation (from preferred supplier landed_cost)
  -- Used for margin calculation; does NOT update if purchase price changes later
  cost_basis            NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (cost_basis >= 0),

  -- Margin — computed and stored (not a generated column so it survives cost_basis lock)
  margin_percent        NUMERIC(7,4) GENERATED ALWAYS AS (
    CASE WHEN sell_price_ex_gst = 0 THEN 0
    ELSE ROUND(((sell_price_ex_gst - cost_basis) / sell_price_ex_gst) * 100, 4)
    END
  ) STORED,

  margin_amount         NUMERIC(12,4) GENERATED ALWAYS AS (
    sell_price_ex_gst - cost_basis
  ) STORED,

  -- Approval flag — set true when margin_percent < configured threshold
  requires_margin_approval  BOOLEAN NOT NULL DEFAULT false,

  -- Publication flags
  publish_to_salesforce BOOLEAN NOT NULL DEFAULT false,
  publish_to_bundle     BOOLEAN NOT NULL DEFAULT false,
  publish_to_linenhub   BOOLEAN NOT NULL DEFAULT false,

  -- Date effectivity
  effective_from        DATE NOT NULL,
  effective_to          DATE,

  -- Lifecycle
  status                sell_price_status NOT NULL DEFAULT 'DRAFT',
  superseded_by         UUID REFERENCES item_sell_prices(id),
  approval_id           UUID,  -- FK to item_approval_decisions when table exists

  notes                 TEXT,
  created_by            UUID REFERENCES auth.users(id),
  updated_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT isp_dates_valid CHECK (effective_to IS NULL OR effective_to > effective_from),

  -- STANDARD prices don't need customer/contract refs
  CONSTRAINT isp_standard_no_customer CHECK (
    price_type != 'STANDARD' OR (customer_id IS NULL AND customer_group_id IS NULL AND contract_id IS NULL)
  ),
  -- CONTRACT prices must have contract_id
  CONSTRAINT isp_contract_needs_contract CHECK (
    price_type != 'CONTRACT' OR contract_id IS NOT NULL
  ),
  -- CUSTOMER_SPECIFIC prices must have customer_id
  CONSTRAINT isp_customer_specific_needs_customer CHECK (
    price_type != 'CUSTOMER_SPECIFIC' OR customer_id IS NOT NULL
  )
);

-- Exclusion constraint: no overlapping ACTIVE/APPROVED_FUTURE prices
-- for the same item/price_type/customer/group/contract/uom combination
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE item_sell_prices
  ADD CONSTRAINT isp_no_date_overlap
  EXCLUDE USING gist (
    item_id WITH =,
    price_type WITH =,
    COALESCE(customer_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
    COALESCE(customer_group_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
    COALESCE(contract_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
    sale_uom WITH =,
    daterange(effective_from, COALESCE(effective_to, '9999-12-31'::date), '[]') WITH &&
  )
  WHERE (status IN ('ACTIVE', 'APPROVED_FUTURE'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_isp_item_id ON item_sell_prices(item_id);
CREATE INDEX IF NOT EXISTS idx_isp_price_type ON item_sell_prices(price_type);
CREATE INDEX IF NOT EXISTS idx_isp_status ON item_sell_prices(status);
CREATE INDEX IF NOT EXISTS idx_isp_effective_from ON item_sell_prices(effective_from);
CREATE INDEX IF NOT EXISTS idx_isp_customer_id ON item_sell_prices(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_isp_item_active
  ON item_sell_prices(item_id, price_type, effective_from)
  WHERE status = 'ACTIVE';

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_isp_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_isp_updated_at
  BEFORE UPDATE ON item_sell_prices
  FOR EACH ROW EXECUTE FUNCTION update_isp_updated_at();

-- Immutability: SUPERSEDED/EXPIRED records are frozen
CREATE OR REPLACE FUNCTION enforce_isp_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('SUPERSEDED', 'EXPIRED') THEN
    RAISE EXCEPTION 'Cannot modify a % sell price record. Create a new version instead.', OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_isp_immutability
  BEFORE UPDATE ON item_sell_prices
  FOR EACH ROW EXECUTE FUNCTION enforce_isp_immutability();

-- Trigger: auto-set requires_margin_approval when margin < 25%
CREATE OR REPLACE FUNCTION set_isp_margin_approval_flag()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  threshold NUMERIC;
BEGIN
  -- Read threshold from app_config if available
  SELECT (value::numeric) INTO threshold
  FROM app_config WHERE key = 'margin_approval_threshold' LIMIT 1;
  
  -- Fallback if no config row exists
  IF threshold IS NULL THEN
    threshold := 25.0;
  END IF;

  IF NEW.sell_price_ex_gst > 0 AND NEW.cost_basis > 0 THEN
    NEW.requires_margin_approval :=
      (((NEW.sell_price_ex_gst - NEW.cost_basis) / NEW.sell_price_ex_gst) * 100) < threshold;
  ELSE
    NEW.requires_margin_approval := false;
  END IF;
  
  -- Ensure it's never NULL to satisfy NOT NULL constraint
  IF NEW.requires_margin_approval IS NULL THEN
    NEW.requires_margin_approval := false;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_isp_margin_flag
  BEFORE INSERT OR UPDATE OF sell_price_ex_gst, cost_basis ON item_sell_prices
  FOR EACH ROW EXECUTE FUNCTION set_isp_margin_approval_flag();

-- Update items.unit_price projection when a STANDARD sell price becomes ACTIVE
CREATE OR REPLACE FUNCTION sync_item_unit_price_from_sell()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'ACTIVE' AND NEW.price_type = 'STANDARD' THEN
    UPDATE items
    SET unit_price = NEW.sell_price_ex_gst,
        updated_at = now()
    WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_isp_sync_unit_price
  AFTER INSERT OR UPDATE OF status ON item_sell_prices
  FOR EACH ROW EXECUTE FUNCTION sync_item_unit_price_from_sell();

-- RLS
ALTER TABLE item_sell_prices ENABLE ROW LEVEL SECURITY;

-- Sales/Finance and Admin can read sell prices
CREATE POLICY "isp_select_sales_admin"
  ON item_sell_prices FOR SELECT
  USING (
    has_permission('view_sell_pricing') OR is_admin()
  );

-- Only Sales/Finance can insert
CREATE POLICY "isp_insert_sales"
  ON item_sell_prices FOR INSERT
  WITH CHECK (
    has_permission('manage_sell_pricing') OR is_admin()
  );

-- Only Sales/Finance can update DRAFT/PENDING records
CREATE POLICY "isp_update_sales"
  ON item_sell_prices FOR UPDATE
  USING (
    (has_permission('manage_sell_pricing') OR is_admin())
    AND status IN ('DRAFT', 'PENDING_APPROVAL')
  );

-- No direct deletes
CREATE POLICY "isp_no_delete"
  ON item_sell_prices FOR DELETE
  USING (is_admin());

COMMENT ON TABLE item_sell_prices IS
  'Date-effective sell price versions per item per price type. '
  'Immutable once ACTIVE or SUPERSEDED. Governed by Sales/Finance team only. '
  'cost_basis is locked at creation time and does not update when purchase price changes.';

COMMENT ON COLUMN item_sell_prices.cost_basis IS
  'Preferred supplier landed cost at the time this sell price was created. '
  'Intentionally locked — margin history is preserved even when purchase prices change.';
