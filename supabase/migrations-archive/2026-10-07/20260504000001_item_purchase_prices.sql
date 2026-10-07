-- Migration: item_purchase_prices
-- Creates date-effective purchase price versioning per item per supplier
-- Part of the governed item lifecycle system (Phase 1)

-- Enable btree_gist if not already enabled (required for exclusion constraints)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Status enum for price records
DO $$ BEGIN
  CREATE TYPE purchase_price_status AS ENUM (
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

CREATE TABLE IF NOT EXISTS item_purchase_prices (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id                 UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  supplier_id             UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  supplier_item_code      TEXT,
  purchase_price_ex_gst   NUMERIC(12,4) NOT NULL CHECK (purchase_price_ex_gst >= 0),
  currency                CHAR(3) NOT NULL DEFAULT 'AUD',
  purchase_uom            TEXT NOT NULL,
  pack_conversion_factor  NUMERIC(8,4) NOT NULL DEFAULT 1.0 CHECK (pack_conversion_factor > 0),
  moq                     INTEGER DEFAULT 1 CHECK (moq > 0),
  lead_time_days          INTEGER DEFAULT 0 CHECK (lead_time_days >= 0),
  freight_handling_cost   NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (freight_handling_cost >= 0),
  landed_cost             NUMERIC(12,4) GENERATED ALWAYS AS (purchase_price_ex_gst + freight_handling_cost) STORED,
  is_preferred_supplier   BOOLEAN NOT NULL DEFAULT false,
  effective_from          DATE NOT NULL,
  effective_to            DATE,
  status                  purchase_price_status NOT NULL DEFAULT 'DRAFT',
  superseded_by           UUID REFERENCES item_purchase_prices(id),
  notes                   TEXT,
  created_by              UUID REFERENCES auth.users(id),
  updated_by              UUID REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Effective dates must be valid range
  CONSTRAINT ipp_dates_valid CHECK (effective_to IS NULL OR effective_to > effective_from)
);

-- Exclusion constraint: no two ACTIVE or APPROVED_FUTURE records for the same
-- item/supplier/uom combination can overlap in date range
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE item_purchase_prices
  ADD CONSTRAINT ipp_no_date_overlap
  EXCLUDE USING gist (
    item_id WITH =,
    supplier_id WITH =,
    purchase_uom WITH =,
    daterange(effective_from, COALESCE(effective_to, '9999-12-31'::date), '[]') WITH &&
  )
  WHERE (status IN ('ACTIVE', 'APPROVED_FUTURE'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ipp_item_id ON item_purchase_prices(item_id);
CREATE INDEX IF NOT EXISTS idx_ipp_supplier_id ON item_purchase_prices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ipp_status ON item_purchase_prices(status);
CREATE INDEX IF NOT EXISTS idx_ipp_effective_from ON item_purchase_prices(effective_from);
CREATE INDEX IF NOT EXISTS idx_ipp_item_supplier_active
  ON item_purchase_prices(item_id, supplier_id)
  WHERE status = 'ACTIVE';

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_ipp_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_ipp_updated_at
  BEFORE UPDATE ON item_purchase_prices
  FOR EACH ROW EXECUTE FUNCTION update_ipp_updated_at();

-- Immutability trigger: SUPERSEDED and EXPIRED records cannot be modified
CREATE OR REPLACE FUNCTION enforce_ipp_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('SUPERSEDED', 'EXPIRED') THEN
    RAISE EXCEPTION 'Cannot modify a % purchase price record. Create a new version instead.', OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ipp_immutability
  BEFORE UPDATE ON item_purchase_prices
  FOR EACH ROW EXECUTE FUNCTION enforce_ipp_immutability();

-- RLS
ALTER TABLE item_purchase_prices ENABLE ROW LEVEL SECURITY;

-- Procurement team and Admins can read all purchase prices
CREATE POLICY "ipp_select_procurement_admin"
  ON item_purchase_prices FOR SELECT
  USING (
    has_permission('view_purchase_pricing') OR is_admin()
  );

-- Only Procurement can insert new purchase price records
CREATE POLICY "ipp_insert_procurement"
  ON item_purchase_prices FOR INSERT
  WITH CHECK (
    has_permission('manage_purchase_pricing') OR is_admin()
  );

-- Only Procurement can update DRAFT and PENDING_APPROVAL records
CREATE POLICY "ipp_update_procurement"
  ON item_purchase_prices FOR UPDATE
  USING (
    (has_permission('manage_purchase_pricing') OR is_admin())
    AND status IN ('DRAFT', 'PENDING_APPROVAL')
  );

-- No direct deletes (use status transitions)
CREATE POLICY "ipp_no_delete"
  ON item_purchase_prices FOR DELETE
  USING (is_admin());

COMMENT ON TABLE item_purchase_prices IS
  'Date-effective purchase price versions per item per supplier. '
  'Each record is immutable once ACTIVE or SUPERSEDED. '
  'Governed by Procurement team only.';
