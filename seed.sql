
-- ROLES
INSERT INTO roles (id, name, description, is_system, permissions) VALUES
('SITE_USER', 'Site User', 'Standard requester.', true, ARRAY['view_dashboard', 'create_request', 'receive_goods']),
('APPROVER', 'Approver', 'Can authorize requests.', true, ARRAY['view_dashboard', 'view_all_requests', 'approve_requests']),
('ADMIN', 'Administrator', 'Full system access.', true, ARRAY['view_dashboard', 'create_request', 'view_all_requests', 'approve_requests', 'link_concur', 'receive_goods', 'view_finance', 'manage_finance', 'manage_settings', 'manage_items', 'manage_suppliers'])
ON CONFLICT (id) DO NOTHING;

-- USERS (Using specific UUIDs for mapping)
-- u1 -> a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
-- u2 -> b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22
-- u3 -> c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33
-- u4 -> d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44
-- u5 -> e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55

INSERT INTO users (id, name, email, role_id, avatar) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Alice Site-User', 'alice@company.com', 'SITE_USER', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Bob Approver', 'bob@company.com', 'APPROVER', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Charlie Admin', 'charlie@company.com', 'ADMIN', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Dave Admin', 'dave@company.com', 'ADMIN', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dave'),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'Sarah Admin', 'sarah@company.com', 'ADMIN', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah')
ON CONFLICT (id) DO NOTHING;

-- SITES
-- site-1 -> 11111111-1111-4111-8111-111111111111
-- site-2 -> 22222222-2222-4222-8222-222222222222
-- ...

INSERT INTO sites (id, name, suburb, address, state, zip, contact_person) VALUES
('11111111-1111-4111-8111-111111111111', 'SPL Adelaide', 'Torrensville', '123 Ashwin Parade', 'SA', '5031', 'Site Manager SA'),
('22222222-2222-4222-8222-222222222222', 'SPL Brisbane', 'Meadowbrook', '50 University Drive', 'QLD', '4131', 'Site Manager QLD'),
('33333333-3333-4333-8333-333333333333', 'SPL Mackay', 'Paget', '15 Gateway Drive', 'QLD', '4740', 'Site Manager Mackay'),
('44444444-4444-4444-8444-444444444444', 'SPL Melbourne', 'Broadmeadows', '1100 Pascoe Vale Rd', 'VIC', '3047', 'Site Manager VIC'),
('55555555-5555-4555-8555-555555555555', 'SPL Perth', 'Belmont', '200 Great Eastern Hwy', 'WA', '6104', 'Site Manager WA1'),
('66666666-6666-4666-8666-666666666666', 'SPL Perth', 'Maddington', '55 Kelvin Rd', 'WA', '6109', 'Site Manager WA2'),
('77777777-7777-4777-8777-777777777777', 'SPL Sydney', 'Bankstown', '350 Hume Hwy', 'NSW', '2200', 'Site Manager NSW'),
('88888888-8888-4888-8888-888888888888', 'SPL Sydney', 'Classic Linen', '350 Hume Hwy', 'NSW', '2200', 'Linen Manager')
ON CONFLICT (id) DO NOTHING;

-- SUPPLIERS
-- s1 -> aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
-- s2 -> bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
-- s3 -> cccccccc-cccc-4ccc-8ccc-cccccccccccc
-- s4 -> dddddddd-dddd-4ddd-8ddd-dddddddddddd

INSERT INTO suppliers (id, name, contact_email, key_contact, phone, address, categories) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Global Textile', 'bianca@globaltextiles.net.au', 'Bianca Moses', '02 97592323', '22-24 Minnie St', ARRAY['Textiles', 'Bedding']),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'HOST Supplies', 'anita@hostsupplies.com.au', 'Anita', '02 9516 4533', '104 Marrickville Road, Marrickville', ARRAY['Hospitality', 'Consumables']),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'NCC Apparel Pty Ltd', 'jsmith@nccapparel.com.au', 'Julie Smith', '+61 416 035 998', '64-66 Cyber Loop, Dandenong South', ARRAY['Apparel', 'Uniforms']),
('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Simba Global', 'jcronin@simba.global', 'Janet Cronin', '+61 (3) 9020 3695', '289-311 Bayswater Road, Bayswater', ARRAY['Textiles', 'Sourcing'])
ON CONFLICT (id) DO NOTHING;

-- ITEMS
-- i1 -> 10000000-0000-4000-8000-000000000001
-- i2 -> 20000000-0000-4000-8000-000000000002
-- i3 -> 30000000-0000-4000-8000-000000000003
-- i4 -> 40000000-0000-4000-8000-000000000004
-- i5 -> 50000000-0000-4000-8000-000000000005
-- i6 -> 60000000-0000-4000-8000-000000000006

INSERT INTO items (id, sku, name, description, unit_price, uom, category, stock_level, supplier_id) VALUES
('10000000-0000-4000-8000-000000000001', 'GT-SHEET-K', 'Premium Cotton Sheet (King)', '500TC White Cotton', 45.00, 'Each', 'Textiles', 0, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('20000000-0000-4000-8000-000000000002', 'GT-TOWEL-W', 'Bath Towel - White', 'Standard Hotel Grade', 12.50, 'Each', 'Textiles', 0, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('30000000-0000-4000-8000-000000000003', 'HS-NAP-2PLY', 'Napkins 2-Ply (Pack 100)', 'White Dinner Napkins', 8.50, 'Pack', 'Consumables', 0, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
('40000000-0000-4000-8000-000000000004', 'HS-CUT-SET', 'Stainless Cutlery Set', 'Fork, Knife, Spoon', 4.20, 'Set', 'Hospitality', 0, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
('50000000-0000-4000-8000-000000000005', 'NCC-VEST-L', 'Hi-Vis Safety Vest (L)', 'Orange with Reflective Strip', 15.00, 'Each', 'Apparel', 0, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
('60000000-0000-4000-8000-000000000006', 'SG-MAT-B', 'Bath Mat - Blue', 'Heavy weight cotton', 9.00, 'Each', 'Textiles', 0, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')
ON CONFLICT (id) DO NOTHING;

-- APPROVAL WORKFLOW
INSERT INTO workflow_steps (id, step_name, approver_role, condition_type, condition_value, "order", is_active) VALUES
(uuid_generate_v4(), 'Site Approval', 'APPROVER', 'ALWAYS', NULL, 1, true),
(uuid_generate_v4(), 'Regional Approval', 'ADMIN', 'AMOUNT_GT', 1000, 2, true),
(uuid_generate_v4(), 'Final Approval', 'ADMIN', 'AMOUNT_GT', 5000, 3, true)
ON CONFLICT (id) DO NOTHING;

-- PO REQUESTS (Sample)
-- REQ-2023-001 -> po1
-- Requester Maps to Alice (a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11)
-- Supplier Maps to Global Textile (aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa)
-- Site Maps to Brisbane (22222222-2222-4222-8222-222222222222) - Assumption based on "SPL Brisbane-Meadowbrook"
-- Request Date: 2023-10-01

INSERT INTO po_requests (id, display_id, request_date, requester_id, site_id, supplier_id, status, total_amount, created_at) VALUES
('aa000000-0000-4000-8000-000000000001', 'REQ-2023-001', '2023-10-01T00:00:00Z', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ACTIVE', 1425, '2023-10-01T00:00:00Z'),
('aa000000-0000-4000-8000-000000000002', 'REQ-2023-002', '2023-10-05T00:00:00Z', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '77777777-7777-4777-8777-777777777777', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'APPROVED_PENDING_CONCUR', 412.50, '2023-10-05T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- PO LINES
-- REQ-1 lines
INSERT INTO po_lines (id, po_request_id, item_id, sku, item_name, quantity_ordered, quantity_received, unit_price, total_price, concur_po_number) VALUES
(uuid_generate_v4(), 'aa000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'GT-500TC-K', 'Premium Cotton Sheet (King)', 20, 0, 45.00, 900, 'PO-9901'),
(uuid_generate_v4(), 'aa000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'GT-BTW-001', 'Bath Towel - White', 42, 0, 12.50, 525, 'PO-9901')
ON CONFLICT (id) DO NOTHING;

-- REQ-2 lines
INSERT INTO po_lines (id, po_request_id, item_id, sku, item_name, quantity_ordered, quantity_received, unit_price, total_price) VALUES
(uuid_generate_v4(), 'aa000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'HOST-NAP-W', 'Napkins 2-Ply (Pack 100)', 50, 0, 8.25, 412.50)
ON CONFLICT (id) DO NOTHING;

-- APPROVAL HISTORY
-- REQ-1
INSERT INTO po_approvals (id, po_request_id, approver_id, approver_name, action, date, comments) VALUES
(uuid_generate_v4(), 'aa000000-0000-4000-8000-000000000001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Alice Site-User', 'SUBMITTED', '2023-10-01T00:00:00Z', NULL),
(uuid_generate_v4(), 'aa000000-0000-4000-8000-000000000001', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Bob Approver', 'APPROVED', '2023-10-02T00:00:00Z', 'Approved.')
ON CONFLICT (id) DO NOTHING;

-- REQ-2
INSERT INTO po_approvals (id, po_request_id, approver_id, approver_name, action, date) VALUES
(uuid_generate_v4(), 'aa000000-0000-4000-8000-000000000002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Alice Site-User', 'SUBMITTED', '2023-10-05T00:00:00Z'),
(uuid_generate_v4(), 'aa000000-0000-4000-8000-000000000002', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Bob Approver', 'APPROVED', '2023-10-06T00:00:00Z')
ON CONFLICT (id) DO NOTHING;
