-- Enhanced Workflow Designer Schema Updates
-- Adds support for visual workflow nodes, email templates, and flexible action configuration

-- 1. Email Templates Table
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('APPROVAL', 'NOTIFICATION', 'REMINDER', 'REJECTION')),
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb, -- Array of available template variables
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON email_templates FOR ALL USING (true) WITH CHECK (true);

-- 2. Workflow Nodes Table (replacing/extending workflow_steps)
CREATE TABLE IF NOT EXISTS workflow_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('START', 'APPROVAL', 'NOTIFICATION', 'CONDITIONAL', 'DELAY', 'SEND_EMAIL', 'END')),
    label TEXT NOT NULL,
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    config JSONB DEFAULT '{}'::jsonb,
    connections TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array of connected node IDs
    is_active BOOLEAN DEFAULT true,
    order_index INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workflow_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON workflow_nodes FOR ALL USING (true) WITH CHECK (true);

-- 3. Workflow Connections Table (for visual representation)
CREATE TABLE IF NOT EXISTS workflow_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_node_id UUID REFERENCES workflow_nodes(id) ON DELETE CASCADE,
    to_node_id UUID REFERENCES workflow_nodes(id) ON DELETE CASCADE,
    label TEXT, -- For conditional branches
    condition TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workflow_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON workflow_connections FOR ALL USING (true) WITH CHECK (true);

-- 4. Seed Default Email Templates
INSERT INTO email_templates (id, name, type, subject, body, variables, is_system) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'Approval Request',
    'APPROVAL',
    'Action Required: Approve Purchase Order {{po_number}}',
    '<h2>Purchase Order Approval Required</h2>
    <p>Hi {{approver_name}},</p>
    <p>A new purchase order requires your approval:</p>
    <ul>
        <li><strong>PO Number:</strong> {{po_number}}</li>
        <li><strong>Requester:</strong> {{requester_name}}</li>
        <li><strong>Total Amount:</strong> ${{total_amount}}</li>
        <li><strong>Supplier:</strong> {{supplier_name}}</li>
        <li><strong>Site:</strong> {{site_name}}</li>
    </ul>
    <p>{{reason_for_request}}</p>
    <p><a href="{{approval_link}}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin-top: 16px;">Review and Approve</a></p>
    <p>Best regards,<br/>{{app_name}} System</p>',
    '["approver_name", "po_number", "requester_name", "total_amount", "supplier_name", "site_name", "reason_for_request", "approval_link", "app_name"]'::jsonb,
    true
),
(
    '00000000-0000-0000-0000-000000000002',
    'Approval Granted Notification',
    'NOTIFICATION',
    'Purchase Order {{po_number}} Approved',
    '<h2>Purchase Order Approved</h2>
    <p>Hi {{requester_name}},</p>
    <p>Good news! Your purchase order has been approved.</p>
    <ul>
        <li><strong>PO Number:</strong> {{po_number}}</li>
        <li><strong>Approved by:</strong> {{approver_name}}</li>
        <li><strong>Total Amount:</strong> ${{total_amount}}</li>
        <li><strong>Date:</strong> {{approval_date}}</li>
    </ul>
    <p><a href="{{po_link}}">View Purchase Order</a></p>
    <p>Best regards,<br/>{{app_name}} System</p>',
    '["requester_name", "po_number", "approver_name", "total_amount", "approval_date", "po_link", "app_name"]'::jsonb,
    true
),
(
    '00000000-0000-0000-0000-000000000003',
    'Approval Rejected Notification',
    'REJECTION',
    'Purchase Order {{po_number}} Rejected',
    '<h2>Purchase Order Rejected</h2>
    <p>Hi {{requester_name}},</p>
    <p>Your purchase order has been rejected.</p>
    <ul>
        <li><strong>PO Number:</strong> {{po_number}}</li>
        <li><strong>Rejected by:</strong> {{approver_name}}</li>
        <li><strong>Reason:</strong> {{rejection_reason}}</li>
        <li><strong>Date:</strong> {{rejection_date}}</li>
    </ul>
    <p>{{rejection_comments}}</p>
    <p><a href="{{po_link}}">View Purchase Order</a></p>
    <p>Best regards,<br/>{{app_name}} System</p>',
    '["requester_name", "po_number", "approver_name", "rejection_reason", "rejection_date", "rejection_comments", "po_link", "app_name"]'::jsonb,
    true
);
