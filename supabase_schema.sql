-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Sites
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    suburb TEXT,
    address TEXT,
    state TEXT,
    zip TEXT,
    contact_person TEXT
);

ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON sites FOR ALL USING (true) WITH CHECK (true);

-- 2. Role Definitions (Dynamic Roles)
CREATE TABLE role_definitions (
    id TEXT PRIMARY KEY, -- e.g. 'ADMIN', 'SITE_USER'
    name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    permissions TEXT[] -- Array of permission strings
);

ALTER TABLE role_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON role_definitions FOR ALL USING (true) WITH CHECK (true);

-- 3. Users (Linking to Supabase Auth is best practice, but here we store profile data)
-- Note: In a real app, 'id' often references auth.users(id).
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role_id TEXT REFERENCES role_definitions(id),
    avatar_url TEXT,
    job_title TEXT
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON user_profiles FOR ALL USING (true) WITH CHECK (true);

-- 4. Suppliers
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    contact_email TEXT,
    key_contact TEXT,
    phone TEXT,
    address TEXT,
    categories TEXT[]
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON suppliers FOR ALL USING (true) WITH CHECK (true);

-- 5. Items (Internal Catalog)
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    unit_price NUMERIC(10, 2) DEFAULT 0,
    uom TEXT,
    category TEXT,
    sub_category TEXT,
    is_rfid BOOLEAN DEFAULT false,
    is_cog BOOLEAN DEFAULT false
);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON items FOR ALL USING (true) WITH CHECK (true);

-- 6. Supplier Catalog (Link Items <-> Suppliers)
CREATE TABLE supplier_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    supplier_sku TEXT,
    price NUMERIC(10, 2),
    UNIQUE(item_id, supplier_id)
);

ALTER TABLE supplier_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON supplier_catalog FOR ALL USING (true) WITH CHECK (true);

-- 7. Supplier Stock Snapshots
CREATE TABLE supplier_stock_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID REFERENCES suppliers(id),
    supplier_sku TEXT,
    product_name TEXT,
    stock_on_hand INTEGER DEFAULT 0,
    committed_qty INTEGER DEFAULT 0,
    back_ordered_qty INTEGER DEFAULT 0,
    available_qty INTEGER DEFAULT 0,
    total_stock_qty INTEGER DEFAULT 0,
    snapshot_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source_report_name TEXT,
    incoming_stock JSONB -- For storing month/qty array
);

ALTER TABLE supplier_stock_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON supplier_stock_snapshots FOR ALL USING (true) WITH CHECK (true);

-- 8. Purchase Orders
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    requester_id UUID REFERENCES user_profiles(id),
    site_id UUID REFERENCES sites(id),
    supplier_id UUID REFERENCES suppliers(id),
    status TEXT NOT NULL, -- e.g. 'DRAFT', 'ACTIVE'
    total_amount NUMERIC(12, 2) DEFAULT 0,
    customer_name TEXT,
    reason_for_request TEXT,
    comments TEXT,
    concur_po_number TEXT -- If applicable to the whole PO
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON purchase_orders FOR ALL USING (true) WITH CHECK (true);

-- 9. Purchase Order Lines
CREATE TABLE purchase_order_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id),
    -- Snapshotted values at time of order
    sku TEXT, 
    item_name TEXT, 
    unit_price NUMERIC(10, 2),
    quantity_ordered INTEGER NOT NULL,
    quantity_received INTEGER DEFAULT 0,
    total_price NUMERIC(12, 2),
    concur_po_number TEXT
);

ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON purchase_order_lines FOR ALL USING (true) WITH CHECK (true);

-- 10. Approval History
CREATE TABLE approval_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    approver_id UUID REFERENCES user_profiles(id),
    action TEXT NOT NULL, -- 'APPROVED', 'REJECTED'
    action_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    comments TEXT
);

ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON approval_history FOR ALL USING (true) WITH CHECK (true);

-- 11. Workflow Steps
CREATE TABLE workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    step_name TEXT NOT NULL,
    approver_role_id TEXT REFERENCES role_definitions(id),
    condition_type TEXT NOT NULL, -- 'ALWAYS', 'AMOUNT_GT'
    condition_value NUMERIC(12, 2),
    order_index INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true
);

ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON workflow_steps FOR ALL USING (true) WITH CHECK (true);

-- 12. Notification Settings
CREATE TABLE notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL UNIQUE,
    label TEXT,
    channels JSONB NOT NULL, -- e.g. {"email": true, "sms": false}
    recipient_roles TEXT[] -- Array of role_ids
);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON notification_settings FOR ALL USING (true) WITH CHECK (true);

-- 13. Deliveries (Optional based on type definitions)
CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_id UUID REFERENCES purchase_orders(id),
    delivery_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    docket_number TEXT,
    received_by_user_id UUID REFERENCES user_profiles(id)
);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON deliveries FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE delivery_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
    po_line_id UUID REFERENCES purchase_order_lines(id),
    quantity INTEGER NOT NULL,
    invoice_number TEXT,
    is_capitalised BOOLEAN DEFAULT false,
    capitalised_date TIMESTAMP WITH TIME ZONE
);

ALTER TABLE delivery_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON delivery_lines FOR ALL USING (true) WITH CHECK (true);
