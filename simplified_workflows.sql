-- Simplified Workflow System Schema
-- Replaces complex node-based workflow with simple template-based configuration

-- 1. Workflow Configurations Table
CREATE TABLE IF NOT EXISTS workflow_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_type TEXT NOT NULL CHECK (workflow_type IN ('APPROVAL', 'POST_APPROVAL', 'POST_DELIVERY', 'POST_CAPITALIZATION')),
    is_enabled BOOLEAN DEFAULT true,
    
    -- Email Configuration
    email_enabled BOOLEAN DEFAULT true,
    email_subject TEXT NOT NULL,
    email_body TEXT NOT NULL,
    
    -- In-App Notification
    inapp_enabled BOOLEAN DEFAULT true,
    inapp_title TEXT NOT NULL,
    inapp_message TEXT NOT NULL,
    
    -- Recipients
    recipient_type TEXT DEFAULT 'ROLE' CHECK (recipient_type IN ('ROLE', 'USER', 'REQUESTER', 'CUSTOM')),
    recipient_id TEXT,
    
    -- Additional Settings
    escalation_hours INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(workflow_type)
);

ALTER TABLE workflow_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON workflow_configurations FOR ALL USING (true) WITH CHECK (true);

-- 2. In-App Notifications Table
CREATE TABLE IF NOT EXISTS in_app_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('APPROVAL', 'POST_APPROVAL', 'POST_DELIVERY', 'POST_CAPITALIZATION')),
    related_po_id TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE in_app_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own notifications" ON in_app_notifications 
    FOR SELECT USING (user_id = current_setting('app.current_user_id', true));
CREATE POLICY "Users can update their own notifications" ON in_app_notifications 
    FOR UPDATE USING (user_id = current_setting('app.current_user_id', true));
CREATE POLICY "System can insert notifications" ON in_app_notifications 
    FOR INSERT WITH CHECK (true);

-- 3. Seed Default Workflow Configurations
INSERT INTO workflow_configurations (
    workflow_type, 
    email_subject, 
    email_body, 
    inapp_title, 
    inapp_message,
    recipient_type
) VALUES
(
    'APPROVAL',
    'Action Required: Approve Purchase Order {{po_number}}',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6; border-bottom: 3px solid #3b82f6; padding-bottom: 10px;">Approval Required</h2>
        <p>Hi <strong>{{approver_name}}</strong>,</p>
        <p>A new purchase order requires your approval:</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">PO Number:</td>
                    <td style="padding: 8px 0;">{{po_number}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Requester:</td>
                    <td style="padding: 8px 0;">{{requester_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Total Amount:</td>
                    <td style="padding: 8px 0; font-size: 18px; font-weight: bold; color: #3b82f6;">${{total_amount}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Supplier:</td>
                    <td style="padding: 8px 0;">{{supplier_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Site:</td>
                    <td style="padding: 8px 0;">{{site_name}}</td>
                </tr>
            </table>
        </div>
        <p style="color: #6b7280; font-style: italic;">{{reason_for_request}}</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{approval_link}}" style="background-color: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">Review and Approve</a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            This is an automated notification from {{app_name}}. Please do not reply to this email.
        </p>
    </div>',
    'Approval Required',
    'Purchase Order {{po_number}} requires your approval',
    'ROLE'
),
(
    'POST_APPROVAL',
    'Your Purchase Order {{po_number}} has been Approved',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981; border-bottom: 3px solid #10b981; padding-bottom: 10px;">✓ Purchase Order Approved</h2>
        <p>Hi <strong>{{requester_name}}</strong>,</p>
        <p>Great news! Your purchase order has been approved and is ready to proceed.</p>
        <div style="background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #065f46;">PO Number:</td>
                    <td style="padding: 8px 0; color: #065f46;">{{po_number}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #065f46;">Approved By:</td>
                    <td style="padding: 8px 0; color: #065f46;">{{approver_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #065f46;">Total Amount:</td>
                    <td style="padding: 8px 0; font-size: 18px; font-weight: bold; color: #059669;">${{total_amount}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #065f46;">Approval Date:</td>
                    <td style="padding: 8px 0; color: #065f46;">{{approval_date}}</td>
                </tr>
            </table>
        </div>
        <p><strong>Next Steps:</strong> Your order will now be processed. You can track its progress in the application.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{po_link}}" style="background-color: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">View Purchase Order</a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            This is an automated notification from {{app_name}}. Please do not reply to this email.
        </p>
    </div>',
    'PO Approved',
    'Your Purchase Order {{po_number}} has been approved',
    'REQUESTER'
),
(
    'POST_DELIVERY',
    'Order Delivered: PO {{po_number}}',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #8b5cf6; border-bottom: 3px solid #8b5cf6; padding-bottom: 10px;">📦 Order Delivered</h2>
        <p>Hi <strong>{{requester_name}}</strong>,</p>
        <p>Your order has been successfully delivered!</p>
        <div style="background: #ede9fe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #5b21b6;">PO Number:</td>
                    <td style="padding: 8px 0; color: #5b21b6;">{{po_number}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #5b21b6;">Supplier:</td>
                    <td style="padding: 8px 0; color: #5b21b6;">{{supplier_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #5b21b6;">Delivery Date:</td>
                    <td style="padding: 8px 0; color: #5b21b6;">{{delivery_date}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #5b21b6;">Site:</td>
                    <td style="padding: 8px 0; color: #5b21b6;">{{site_name}}</td>
                </tr>
            </table>
        </div>
        <p><strong>Action Required:</strong> Please verify the delivery and confirm receipt in the application.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{po_link}}" style="background-color: #8b5cf6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">Confirm Delivery</a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            This is an automated notification from {{app_name}}. Please do not reply to this email.
        </p>
    </div>',
    'Order Delivered',
    'Your order {{po_number}} has been delivered',
    'REQUESTER'
),
(
    'POST_CAPITALIZATION',
    'Order Finalized: PO {{po_number}}',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b; border-bottom: 3px solid #f59e0b; padding-bottom: 10px;">✓ Order Capitalized</h2>
        <p>Hi <strong>{{recipient_name}}</strong>,</p>
        <p>The following purchase order has been finalized and capitalized:</p>
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #92400e;">PO Number:</td>
                    <td style="padding: 8px 0; color: #92400e;">{{po_number}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #92400e;">Requester:</td>
                    <td style="padding: 8px 0; color: #92400e;">{{requester_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #92400e;">Final Amount:</td>
                    <td style="padding: 8px 0; font-size: 18px; font-weight: bold; color: #d97706;">${{total_amount}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #92400e;">Capitalization Date:</td>
                    <td style="padding: 8px 0; color: #92400e;">{{capitalization_date}}</td>
                </tr>
            </table>
        </div>
        <p>This order has been processed and is now complete. All financial records have been updated.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{po_link}}" style="background-color: #f59e0b; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">View Details</a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            This is an automated notification from {{app_name}}. Please do not reply to this email.
        </p>
    </div>',
    'Order Finalized',
    'Purchase Order {{po_number}} has been capitalized',
    'ROLE'
);

-- 4. Create indexes for performance
CREATE INDEX idx_notifications_user_id ON in_app_notifications(user_id);
CREATE INDEX idx_notifications_created_at ON in_app_notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON in_app_notifications(is_read);
CREATE INDEX idx_workflow_config_type ON workflow_configurations(workflow_type);
