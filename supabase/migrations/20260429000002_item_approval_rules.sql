-- Phase 2d: Configurable item approval routing rules
-- Stores rule definitions that drive the approval engine for item creation requests.

CREATE TABLE IF NOT EXISTS item_approval_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name       TEXT NOT NULL,
    description     TEXT,
    condition_type  TEXT NOT NULL CHECK (condition_type IN (
                        'MARGIN_BELOW',
                        'PURCHASE_ONLY',
                        'SALE_ONLY',
                        'CUSTOMER_SPECIFIC',
                        'CONTRACT',
                        'COG',
                        'URGENT',
                        'REPLACEMENT',
                        'BUNDLE_ONLY',
                        'LINENHUB_ONLY',
                        'DEFAULT'
                    )),
    condition_value TEXT,                        -- e.g. "25" for MARGIN_BELOW threshold
    approver_type   TEXT NOT NULL CHECK (approver_type IN ('ROLE', 'USER', 'AUTO')),
    approver_id     TEXT,                        -- role name or user ID
    sequential_stage_order INT NOT NULL DEFAULT 1,
    sla_hours       INT NOT NULL DEFAULT 48,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default approval rules
INSERT INTO item_approval_rules
    (rule_name, description, condition_type, condition_value, approver_type, approver_id, sequential_stage_order, sla_hours)
VALUES
    ('Standard Margin Check',    'Route to Commercial Manager when sell margin < 25%', 'MARGIN_BELOW',    '25',  'ROLE', 'COMMERCIAL_MANAGER',    1, 48),
    ('Purchase-Only Item',       'Purchase-only items route to Procurement Manager',   'PURCHASE_ONLY',   NULL,  'ROLE', 'PROCUREMENT_MANAGER',   1, 48),
    ('Customer-Specific Price',  'Customer-specific pricing requires Sales approval',  'CUSTOMER_SPECIFIC',NULL, 'ROLE', 'SALES_MANAGER',          1, 24),
    ('Contract Price',           'Contract pricing requires Commercial approval',      'CONTRACT',         NULL, 'ROLE', 'COMMERCIAL_MANAGER',    1, 24),
    ('Customer Own Goods',       'COG items require Customer Care and Ops approval',   'COG',              NULL, 'ROLE', 'CUSTOMER_CARE_MANAGER',  1, 48),
    ('Urgent Request',           'Urgent items get expedited 4h SLA approval',         'URGENT',           NULL, 'ROLE', 'OPERATIONS_MANAGER',    1,  4),
    ('Replacement Item',         'Replacement items need Master Data validation',      'REPLACEMENT',      NULL, 'ROLE', 'MASTER_DATA_MANAGER',   1, 24),
    ('Default Route',            'All other items route to Master Data team',          'DEFAULT',          NULL, 'ROLE', 'MASTER_DATA_MANAGER',   1, 72)
ON CONFLICT DO NOTHING;

-- RLS: only admin and manage_development can modify rules
ALTER TABLE item_approval_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_approval_rules_read" ON item_approval_rules
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "item_approval_rules_write" ON item_approval_rules
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            JOIN role_permissions rp ON rp.role_id = r.id
            JOIN permissions p ON p.id = rp.permission_id
            WHERE ur.user_id = auth.uid()
              AND p.name IN ('manage_development', 'system_admin')
        )
    );

-- approve_item_requests permission (referenced in types.ts)
INSERT INTO permissions (id, name, description, category)
VALUES (
    gen_random_uuid(),
    'approve_item_requests',
    'Review and approve or reject item creation requests',
    'Item Creation'
)
ON CONFLICT (name) DO NOTHING;
