
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ROLES
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  permissions TEXT[]
);

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role_id TEXT REFERENCES roles(id),
  avatar TEXT,
  job_title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SITES
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  suburb TEXT,
  address TEXT,
  state TEXT,
  zip TEXT,
  contact_person TEXT
);

-- SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_email TEXT,
  key_contact TEXT,
  phone TEXT,
  address TEXT,
  categories TEXT[]
);

-- ITEMS
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit_price NUMERIC,
  uom TEXT,
  category TEXT,
  sub_category TEXT,
  stock_level INTEGER DEFAULT 0,
  supplier_id UUID REFERENCES suppliers(id),
  is_rfid BOOLEAN DEFAULT false,
  is_cog BOOLEAN DEFAULT false,
  specs JSONB
);

-- CATALOG ITEMS
CREATE TABLE IF NOT EXISTS catalog_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES items(id),
  supplier_id UUID REFERENCES suppliers(id),
  supplier_sku TEXT,
  price NUMERIC
);

-- STOCK SNAPSHOTS
CREATE TABLE IF NOT EXISTS stock_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES suppliers(id),
  supplier_sku TEXT,
  product_name TEXT,
  available_qty INTEGER,
  stock_on_hand INTEGER,
  committed_qty INTEGER,
  back_ordered_qty INTEGER,
  total_stock_qty INTEGER,
  snapshot_date TIMESTAMPTZ,
  source_report_name TEXT,
  incoming_stock JSONB,
  unit_price NUMERIC
);

-- PO REQUESTS
CREATE TABLE IF NOT EXISTS po_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_id TEXT,
  request_date TIMESTAMPTZ,
  requester_id UUID REFERENCES users(id),
  site_id UUID REFERENCES sites(id),
  supplier_id UUID REFERENCES suppliers(id),
  status TEXT,
  total_amount NUMERIC,
  customer_name TEXT,
  reason_for_request TEXT,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PO LINES
CREATE TABLE IF NOT EXISTS po_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_request_id UUID REFERENCES po_requests(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  sku TEXT,
  item_name TEXT,
  quantity_ordered INTEGER,
  quantity_received INTEGER DEFAULT 0,
  unit_price NUMERIC,
  total_price NUMERIC,
  concur_po_number TEXT
);

-- APPROVAL HISTORY
CREATE TABLE IF NOT EXISTS po_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_request_id UUID REFERENCES po_requests(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES users(id),
  approver_name TEXT,
  action TEXT,
  date TIMESTAMPTZ DEFAULT NOW(),
  comments TEXT
);

-- DELIVERIES
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_request_id UUID REFERENCES po_requests(id),
  date TIMESTAMPTZ,
  docket_number TEXT,
  received_by TEXT
);

-- DELIVERY LINES
CREATE TABLE IF NOT EXISTS delivery_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
  po_line_id UUID REFERENCES po_lines(id),
  quantity INTEGER,
  invoice_number TEXT,
  is_capitalised BOOLEAN DEFAULT false,
  capitalised_date TIMESTAMPTZ
);

-- WORKFLOW STEPS
CREATE TABLE IF NOT EXISTS workflow_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  step_name TEXT,
  approver_role TEXT REFERENCES roles(id),
  condition_type TEXT,
  condition_value NUMERIC,
  "order" INTEGER,
  is_active BOOLEAN DEFAULT true
);

-- NOTIFICATION SETTINGS
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT,
  label TEXT,
  channels JSONB,
  recipient_roles TEXT[],
  custom_emails JSONB
);

-- Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Permissive Policies
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all public access' AND tablename = 'roles') THEN
        CREATE POLICY "Allow all public access" ON roles FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all public access' AND tablename = 'users') THEN
        CREATE POLICY "Allow all public access" ON users FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all public access' AND tablename = 'sites') THEN
        CREATE POLICY "Allow all public access" ON sites FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all public access' AND tablename = 'suppliers') THEN
        CREATE POLICY "Allow all public access" ON suppliers FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all public access' AND tablename = 'items') THEN
        CREATE POLICY "Allow all public access" ON items FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all public access' AND tablename = 'catalog_items') THEN
        CREATE POLICY "Allow all public access" ON catalog_items FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all public access' AND tablename = 'stock_snapshots') THEN
        CREATE POLICY "Allow all public access" ON stock_snapshots FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all public access' AND tablename = 'po_requests') THEN
        CREATE POLICY "Allow all public access" ON po_requests FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all public access' AND tablename = 'po_lines') THEN
        CREATE POLICY "Allow all public access" ON po_lines FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all public access' AND tablename = 'po_approvals') THEN
        CREATE POLICY "Allow all public access" ON po_approvals FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all public access' AND tablename = 'deliveries') THEN
        CREATE POLICY "Allow all public access" ON deliveries FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all public access' AND tablename = 'delivery_lines') THEN
        CREATE POLICY "Allow all public access" ON delivery_lines FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all public access' AND tablename = 'workflow_steps') THEN
        CREATE POLICY "Allow all public access" ON workflow_steps FOR ALL USING (true) WITH CHECK (true);
    END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all public access' AND tablename = 'notification_settings') THEN
        CREATE POLICY "Allow all public access" ON notification_settings FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 1. Extend items (Product Master)
ALTER TABLE items ADD COLUMN IF NOT EXISTS default_order_multiple INTEGER DEFAULT 1;
ALTER TABLE items ADD COLUMN IF NOT EXISTS active_flag BOOLEAN DEFAULT true;

-- 2. New Supplier Product Map
CREATE TABLE IF NOT EXISTS supplier_product_map (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES suppliers(id),
  product_id UUID REFERENCES items(id),
  supplier_sku TEXT,
  supplier_customer_stock_code TEXT,
  match_priority INTEGER DEFAULT 100,
  pack_conversion_factor NUMERIC DEFAULT 1.0,
  mapping_status TEXT, -- 'PROPOSED', 'CONFIRMED', 'REJECTED'
  mapping_method TEXT, -- 'MANUAL', 'IMPORT', 'AUTO'
  confidence_score NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, product_id, supplier_sku)
);

-- 3. Product Availability Cache
CREATE TABLE IF NOT EXISTS product_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES items(id),
  supplier_id UUID REFERENCES suppliers(id),
  available_units NUMERIC, -- Allow decimal for partial packs
  available_order_qty INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, supplier_id)
);

-- Enable RLS for new tables
ALTER TABLE supplier_product_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_availability ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies for new tables
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all public access' AND tablename = 'supplier_product_map') THEN
        CREATE POLICY "Allow all public access" ON supplier_product_map FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all public access' AND tablename = 'product_availability') THEN
        CREATE POLICY "Allow all public access" ON product_availability FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- 4. Unique Constraint for Items SKU (Required for UPSERT)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_sku_key') THEN
        ALTER TABLE items ADD CONSTRAINT items_sku_key UNIQUE (sku);
    END IF;
END $$;

-- 5. Normalization Columns & Indexes
-- Stock Snapshots (Supplier Data)
ALTER TABLE stock_snapshots ADD COLUMN IF NOT EXISTS customer_stock_code_raw TEXT;
ALTER TABLE stock_snapshots ADD COLUMN IF NOT EXISTS customer_stock_code_norm TEXT;
ALTER TABLE stock_snapshots ADD COLUMN IF NOT EXISTS customer_stock_code_alt_norm TEXT;

CREATE INDEX IF NOT EXISTS idx_stock_snapshots_norm ON stock_snapshots(customer_stock_code_norm);
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_alt_norm ON stock_snapshots(customer_stock_code_alt_norm);

-- Add missing columns to stock_snapshots
ALTER TABLE stock_snapshots ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE stock_snapshots ADD COLUMN IF NOT EXISTS sub_category TEXT;
ALTER TABLE stock_snapshots ADD COLUMN IF NOT EXISTS stock_type TEXT;
ALTER TABLE stock_snapshots ADD COLUMN IF NOT EXISTS carton_qty INTEGER;
ALTER TABLE stock_snapshots ADD COLUMN IF NOT EXISTS soh_value_at_sell NUMERIC;
ALTER TABLE stock_snapshots ADD COLUMN IF NOT EXISTS sell_price NUMERIC;
ALTER TABLE stock_snapshots ADD COLUMN IF NOT EXISTS range_name TEXT;


-- Items (Master Data)
ALTER TABLE items ADD COLUMN IF NOT EXISTS sap_item_code_raw TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS sap_item_code_norm TEXT;

-- Use a unique index for normalized SAP code to prevent dupes (if logic allows)
-- unique index for sap_item_code_norm (nullable allowed, but if set, must be unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_sap_norm ON items(sap_item_code_norm);

