# CORE DATA CONTRACT

> **Purpose**: Provider-agnostic database schema and data structures. This document NEVER changes when swapping authentication, deployment, or CI/CD modules.

---

## 1. Database Requirements

### 1.1 Required Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

**Verification:**
```sql
SELECT extname FROM pg_extension WHERE extname='uuid-ossp';
-- Expected: 1 row
```

### 1.2 Table Count Invariant

[OBSERVED: schema.sql:1-326]

The schema defines **16 tables**. This count MUST be verified after schema application.

**Verification:**
```sql
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema='public' AND table_type='BASE TABLE';
-- Expected: 16+
```

---

## 2. Table Inventory

[OBSERVED: schema.sql:1-326]

| # | Table | Primary Key | Foreign Keys | Constraints |
|---|-------|-------------|--------------|-------------|
| 1 | `roles` | `id TEXT` | - | - |
| 2 | `users` | `id UUID` | `role_id → roles.id` | UNIQUE(email) |
| 3 | `sites` | `id UUID` | - | - |
| 4 | `suppliers` | `id UUID` | - | - |
| 5 | `items` | `id UUID` | `supplier_id → suppliers.id` | UNIQUE(sku) |
| 6 | `catalog_items` | `id UUID` | `item_id → items.id`, `supplier_id → suppliers.id` | - |
| 7 | `stock_snapshots` | `id UUID` | `supplier_id → suppliers.id` | - |
| 8 | `po_requests` | `id UUID` | `requester_id → users.id`, `site_id → sites.id`, `supplier_id → suppliers.id` | - |
| 9 | `po_lines` | `id UUID` | `po_request_id → po_requests.id` (CASCADE), `item_id → items.id` | - |
| 10 | `po_approvals` | `id UUID` | `po_request_id → po_requests.id` (CASCADE), `approver_id → users.id` | - |
| 11 | `deliveries` | `id UUID` | `po_request_id → po_requests.id` | - |
| 12 | `delivery_lines` | `id UUID` | `delivery_id → deliveries.id` (CASCADE), `po_line_id → po_lines.id` | - |
| 13 | `workflow_steps` | `id UUID` | `approver_role → roles.id` | - |
| 14 | `notification_settings` | `id UUID` | - | - |
| 15 | `supplier_product_map` | `id UUID` | `supplier_id → suppliers.id`, `product_id → items.id` | UNIQUE(supplier_id, product_id, supplier_sku) |
| 16 | `product_availability` | `id UUID` | `product_id → items.id`, `supplier_id → suppliers.id` | UNIQUE(product_id, supplier_id) |

---

## 3. Key Table Definitions

### 3.1 roles

```sql
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  permissions TEXT[] DEFAULT '{}',
  is_system BOOLEAN DEFAULT false
);
```

**Seed Data:**
```sql
('SITE_USER', 'Site User', ARRAY['view_dashboard', 'create_request', 'receive_goods'])
('APPROVER', 'Approver', ARRAY['view_dashboard', 'view_all_requests', 'approve_requests'])
('ADMIN', 'Administrator', ARRAY['view_dashboard', 'create_request', 'view_all_requests', 
  'approve_requests', 'link_concur', 'receive_goods', 'view_finance', 
  'manage_finance', 'manage_settings', 'manage_items', 'manage_suppliers'])
```

### 3.2 users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role_id TEXT REFERENCES roles(id),
  azure_oid TEXT,
  status TEXT,           -- 'pending', 'approved', 'disabled'
  site_ids TEXT[],       -- User site assignments (NOT a join table)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**CRITICAL CORRECTION**: [OBSERVED: fix_users_table.sql:5, services/db.ts:46]

The `user_site_assignments` table **DOES NOT EXIST**. Multi-site assignment uses the `users.site_ids` TEXT[] column.

**Verification:**
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name='users' AND column_name='site_ids';
-- Expected: 1 row
```

### 3.3 sites

```sql
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  suburb TEXT,
  state TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.4 items

```sql
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  unit_price NUMERIC,
  supplier_id UUID REFERENCES suppliers(id),
  default_order_multiple INTEGER,
  active_flag BOOLEAN DEFAULT true,
  sap_item_code_raw TEXT,
  sap_item_code_norm TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.5 po_requests

```sql
CREATE TABLE po_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_id TEXT,
  requester_id UUID REFERENCES users(id),
  site_id UUID REFERENCES sites(id),
  supplier_id UUID REFERENCES suppliers(id),
  status TEXT,           -- See PO Status Workflow in CORE_SYSTEM
  total_amount NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 4. Relationship Diagram

```
users.role_id → roles.id
users.site_ids → sites (NOT FK, app-level validation)
po_requests.requester_id → users.id
po_requests.site_id → sites.id
po_requests.supplier_id → suppliers.id
po_lines.po_request_id → po_requests.id
po_lines.item_id → items.id
po_approvals.po_request_id → po_requests.id
deliveries.po_request_id → po_requests.id
delivery_lines.delivery_id → deliveries.id
supplier_product_map.supplier_id → suppliers.id
supplier_product_map.product_id → items.id
```

---

## 5. Indexes

[OBSERVED: schema.sql:305-306, 324]

| Index | Table | Columns | Type |
|-------|-------|---------|------|
| `idx_stock_snapshots_norm` | stock_snapshots | customer_stock_code_norm | BTREE |
| `idx_stock_snapshots_alt_norm` | stock_snapshots | customer_stock_code_alt_norm | BTREE |
| `idx_items_sap_norm` | items | sap_item_code_norm | UNIQUE |

**Verification:**
```sql
SELECT indexname FROM pg_indexes WHERE indexname='idx_items_sap_norm';
-- Expected: 1 row
```

---

## 6. Column Additions via Migration Scripts

[OBSERVED: schema.sql:243-324, fix_users_table.sql:4-7]

| Table | Column | Type | Added By |
|-------|--------|------|----------|
| users | site_ids | TEXT[] | fix_users_table.sql |
| users | status | TEXT | fix_users_table.sql |
| items | default_order_multiple | INTEGER | schema.sql:244 |
| items | active_flag | BOOLEAN | schema.sql:245 |
| items | sap_item_code_raw | TEXT | schema.sql:319 |
| items | sap_item_code_norm | TEXT | schema.sql:320 |
| stock_snapshots | customer_stock_code_raw | TEXT | schema.sql:301 |
| stock_snapshots | customer_stock_code_norm | TEXT | schema.sql:302 |
| stock_snapshots | customer_stock_code_alt_norm | TEXT | schema.sql:303 |
| stock_snapshots | sell_price | NUMERIC | schema.sql:314 |

---

## 7. RLS Policy Matrix

[OBSERVED: schema.sql:176-289]

| Table | RLS Status | Policy Name | Behavior | Risk |
|-------|------------|-------------|----------|------|
| `roles` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `users` | ENABLED | Users can view their own profile | `USING (auth.uid() = id)` SELECT only | RESTRICTIVE |
| `users` | ENABLED | Admins can view and edit all users | `USING (role_id = 'ADMIN')` ALL | CONDITIONAL |
| `sites` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `suppliers` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `items` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `catalog_items` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `stock_snapshots` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `po_requests` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `po_lines` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `po_approvals` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `deliveries` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `delivery_lines` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `workflow_steps` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `notification_settings` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `supplier_product_map` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |
| `product_availability` | ENABLED | Allow all public access | `USING (true)` | PERMISSIVE |

**Verification:**
```sql
SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=false;
-- Expected: 0 rows (all tables have RLS enabled)
```

**SECURITY NOTE**: Data isolation is APPLICATION-LEVEL ONLY via `activeSiteIds` filtering. RLS policies are permissive by design. See POST-REPLICATION IMPROVEMENT PLAN in CORE_SYSTEM for RLS hardening recommendations.

---

## 8. Schema Apply Order (Canonical)

### Step 1: Run schema.sql

```bash
psql $DATABASE_URL -f schema.sql
```

**Verification:**
```sql
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema='public' AND table_type='BASE TABLE';
-- Expected: 16
```

### Step 2: Run migration

[OBSERVED: supabase/migrations/20240130_add_unique_constraint_supplier_product_map.sql]

```bash
psql $DATABASE_URL -f supabase/migrations/20240130_add_unique_constraint_supplier_product_map.sql
```

**Verification:**
```sql
SELECT conname FROM pg_constraint WHERE conname LIKE '%supplier_product_map%';
-- Expected: supplier_product_map_supplier_id_supplier_sku_key
```

### Step 3: Run fix_users_table.sql

[OBSERVED: fix_users_table.sql:1-8]

```bash
psql $DATABASE_URL -f fix_users_table.sql
```

**Verification:**
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name='users' AND column_name='site_ids';
-- Expected: 1 row
```

### Step 4 (Development only): Seed data

```bash
psql $DATABASE_URL -f seed.sql
```

---

## 9. Data Contract Invariants

These MUST remain true regardless of provider swaps:

| # | Invariant | Verification |
|---|-----------|--------------|
| 1 | 16 tables exist | Count query returns 16+ |
| 2 | uuid-ossp extension exists | Extension query returns 1 row |
| 3 | users.site_ids column exists | Column query returns 1 row |
| 4 | idx_items_sap_norm index exists | Index query returns 1 row |
| 5 | All tables have RLS enabled | rowsecurity=false returns 0 rows |
| 6 | No user_site_assignments table | Table does not exist |

---

## Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Created | 2026-02-08 |
| Source | `SYSTEM_ARCHITECTURE_COMPLETION_v3.md` Sections C.1-C.5 |
| Canonical Truth | `SYSTEM_ARCHITECTURE_COMPLETION_v3.md` |
