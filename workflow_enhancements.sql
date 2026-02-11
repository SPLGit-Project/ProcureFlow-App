-- Enhanced Workflow System Schema Updates
-- Adds multi-recipient support and app URL configuration

-- 1. Update workflow_configurations table to support multiple recipients
ALTER TABLE workflow_configurations
    DROP COLUMN IF EXISTS recipient_id;

ALTER TABLE workflow_configurations
    ADD COLUMN recipient_ids JSONB DEFAULT '[]'::jsonb;

ALTER TABLE workflow_configurations
    ADD COLUMN include_requester BOOLEAN DEFAULT false;

ALTER TABLE workflow_configurations
    ADD COLUMN app_url TEXT DEFAULT 'https://procureflow.azurewebsites.net';

-- 2. Update existing data to use array format
UPDATE workflow_configurations
SET recipient_ids = '[]'::jsonb
WHERE recipient_ids IS NULL;

-- 3. Update email templates with enhanced branding and CTAs

-- APPROVAL WORKFLOW - Enhanced with branding and CTA
UPDATE workflow_configurations
SET 
    email_subject = 'Action Required: Approve Purchase Order {{po_number}}',
    email_body = '<div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff;">
    <!-- Branded Header -->
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">{{app_name}}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Purchase Order Management System</p>
    </div>
    
    <!-- Main Content -->
    <div style="padding: 40px 30px;">
        <h2 style="color: #1e293b; margin: 0 0 10px 0; font-size: 24px;">⚡ Approval Required</h2>
        <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            Hi <strong>{{approver_name}}</strong>, a new purchase order requires your immediate attention and approval.
        </p>
        
        <!-- PO Details Card -->
        <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
            <h3 style="color: #334155; margin: 0 0 20px 0; font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Purchase Order Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600; width: 40%;">PO Number:</td>
                    <td style="padding: 10px 0; color: #1e293b; font-weight: bold; font-size: 16px;">{{po_number}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Requested By:</td>
                    <td style="padding: 10px 0; color: #1e293b;">{{requester_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Total Amount:</td>
                    <td style="padding: 10px 0; color: #059669; font-size: 20px; font-weight: bold;">${{total_amount}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Supplier:</td>
                    <td style="padding: 10px 0; color: #1e293b;">{{supplier_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Site/Location:</td>
                    <td style="padding: 10px 0; color: #1e293b;">{{site_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Number of Items:</td>
                    <td style="padding: 10px 0; color: #1e293b;">{{item_count}} items</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Requested Date:</td>
                    <td style="padding: 10px 0; color: #1e293b;">{{request_date}}</td>
                </tr>
            </table>
        </div>
        
        <!-- Reason (if provided) -->
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; margin-bottom: 30px; border-radius: 4px;">
            <p style="margin: 0; color: #92400e; font-style: italic; line-height: 1.6;">
                <strong>Reason:</strong> {{reason_for_request}}
            </p>
        </div>
        
        <!-- Call to Action -->
        <div style="text-align: center; margin: 40px 0;">
            <a href="{{action_link}}" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 18px 48px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 18px; display: inline-block; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4); transition: all 0.3s;">
                ✓ Approve Now
            </a>
        </div>
        
        <p style="text-align: center; color: #94a3b8; font-size: 14px; margin: 20px 0 0 0;">
            Or copy this link: <a href="{{action_link}}" style="color: #3b82f6; text-decoration: none;">{{action_link}}</a>
        </p>
    </div>
    
    <!-- Professional Footer -->
    <div style="background: #f8fafc; border-top: 2px solid #e2e8f0; padding: 30px; text-align: center;">
        <p style="color: #64748b; font-size: 13px; margin: 0 0 8px 0;">
            This notification was sent from <strong>{{app_name}}</strong>
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            © {{current_year}} {{app_name}}. All rights reserved.
        </p>
    </div>
</div>'
WHERE workflow_type = 'APPROVAL';

-- POST-APPROVAL WORKFLOW - Enhanced with branding and CTA
UPDATE workflow_configurations
SET 
    email_subject = '✓ Your Purchase Order {{po_number}} has been Approved',
    email_body = '<div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff;">
    <!-- Branded Header -->
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">{{app_name}}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Purchase Order Management System</p>
    </div>
    
    <!-- Main Content -->
    <div style="padding: 40px 30px;">
        <h2 style="color: #1e293b; margin: 0 0 10px 0; font-size: 24px;">✓ Approval Granted!</h2>
        <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            Hi <strong>{{requester_name}}</strong>, great news! Your purchase order has been approved and is ready to proceed.
        </p>
        
        <!-- Success Banner -->
        <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border: 2px solid #6ee7b7; border-radius: 12px; padding: 25px; margin-bottom: 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">✓</div>
            <h3 style="color: #065f46; margin: 0 0 10px 0; font-size: 18px; font-weight: bold;">Purchase Order Approved</h3>
            <p style="color: #047857; margin: 0; font-size: 24px; font-weight: bold;">{{po_number}}</p>
        </div>
        
        <!-- PO Details Card -->
        <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
            <h3 style="color: #334155; margin: 0 0 20px 0; font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Order Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600; width: 40%;">Approved By:</td>
                    <td style="padding: 10px 0; color: #1e293b; font-weight: bold;">{{approver_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Total Amount:</td>
                    <td style="padding: 10px 0; color: #059669; font-size: 20px; font-weight: bold;">${{total_amount}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Supplier:</td>
                    <td style="padding: 10px 0; color: #1e293b;">{{supplier_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Site/Location:</td>
                    <td style="padding: 10px 0; color: #1e293b;">{{site_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Number of Items:</td>
                    <td style="padding: 10px 0; color: #1e293b;">{{item_count}} items</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Approval Date:</td>
                    <td style="padding: 10px 0; color: #1e293b;">{{approval_date}}</td>
                </tr>
            </table>
        </div>
        
        <!-- Next Steps -->
        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 30px; border-radius: 4px;">
            <h4 style="color: #1e40af; margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">📋 NEXT STEPS</h4>
            <p style="margin: 0; color: #1e40af; line-height: 1.6; font-size: 14px;">
                Your order will now be processed by the procurement team. You can track its progress and view details in the application.
            </p>
        </div>
        
        <!-- Call to Action -->
        <div style="text-align: center; margin: 40px 0;">
            <a href="{{action_link}}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 18px 48px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 18px; display: inline-block; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
                View Order Details
            </a>
        </div>
        
        <p style="text-align: center; color: #94a3b8; font-size: 14px; margin: 20px 0 0 0;">
            Or copy this link: <a href="{{action_link}}" style="color: #10b981; text-decoration: none;">{{action_link}}</a>
        </p>
    </div>
    
    <!-- Professional Footer -->
    <div style="background: #f8fafc; border-top: 2px solid #e2e8f0; padding: 30px; text-align: center;">
        <p style="color: #64748b; font-size: 13px; margin: 0 0 8px 0;">
            This notification was sent from <strong>{{app_name}}</strong>
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            © {{current_year}} {{app_name}}. All rights reserved.
        </p>
    </div>
</div>'
WHERE workflow_type = 'POST_APPROVAL';

-- POST-DELIVERY WORKFLOW - Enhanced (triggers on COMPLETE status)
UPDATE workflow_configurations
SET 
    email_subject = '📦 Order Complete: {{po_number}}',
    email_body = '<div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff;">
    <!-- Branded Header -->
    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">{{app_name}}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Purchase Order Management System</p>
    </div>
    
    <!-- Main Content -->
    <div style="padding: 40px 30px;">
        <h2 style="color: #1e293b; margin: 0 0 10px 0; font-size: 24px;">📦 Order Delivered & Complete</h2>
        <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            Hi <strong>{{requester_name}}</strong>, your order has been delivered and marked as complete!
        </p>
        
        <!-- Delivery Confirmation -->
        <div style="background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%); border: 2px solid #c084fc; border-radius: 12px; padding: 25px; margin-bottom: 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">📦</div>
            <h3 style="color: #6b21a8; margin: 0 0 10px 0; font-size: 18px; font-weight: bold;">All Items Received</h3>
            <p style="color: #7c3aed; margin: 0; font-size: 24px; font-weight: bold;">{{po_number}}</p>
        </div>
        
        <!-- Order Summary -->
        <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
            <h3 style="color: #334155; margin: 0 0 20px 0; font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Delivery Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600; width: 40%;">PO Number:</td>
                    <td style="padding: 10px 0; color: #1e293b; font-weight: bold;">{{po_number}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Supplier:</td>
                    <td style="padding: 10px 0; color: #1e293b;">{{supplier_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Total Amount:</td>
                    <td style="padding: 10px 0; color: #059669; font-size: 20px; font-weight: bold;">${{total_amount}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Site/Location:</td>
                    <td style="padding: 10px 0; color: #1e293b;">{{site_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Items Delivered:</td>
                    <td style="padding: 10px 0; color: #1e293b;">{{item_count}} items</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Completion Date:</td>
                    <td style="padding: 10px 0; color: #1e293b;">{{delivery_date}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Status:</td>
                    <td style="padding: 10px 0; color: #059669; font-weight: bold;">COMPLETE</td>
                </tr>
            </table>
        </div>
        
        <!-- Call to Action -->
        <div style="text-align: center; margin: 40px 0;">
            <a href="{{action_link}}" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 18px 48px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 18px; display: inline-block; box-shadow: 0 4px 14px rgba(139, 92, 246, 0.4);">
                View Order Details
            </a>
        </div>
        
        <p style="text-align: center; color: #94a3b8; font-size: 14px; margin: 20px 0 0 0;">
            Or copy this link: <a href="{{action_link}}" style="color: #8b5cf6; text-decoration: none;">{{action_link}}</a>
        </p>
    </div>
    
    <!-- Professional Footer -->
    <div style="background: #f8fafc; border-top: 2px solid #e2e8f0; padding: 30px; text-align: center;">
        <p style="color: #64748b; font-size: 13px; margin: 0 0 8px 0;">
            This notification was sent from <strong>{{app_name}}</strong>
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            © {{current_year}} {{app_name}}. All rights reserved.
        </p>
    </div>
</div>'
WHERE workflow_type = 'POST_DELIVERY';

-- POST-CAPITALIZATION WORKFLOW - Enhanced with branding and CTA
UPDATE workflow_configurations
SET 
    email_subject = '✓ Order Finalized: {{po_number}}',
    email_body = '<div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff;">
    <!-- Branded Header -->
    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">{{app_name}}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Purchase Order Management System</p>
    </div>
    
    <!-- Main Content -->
    <div style="padding: 40px 30px;">
        <h2 style="color: #1e293b; margin: 0 0 10px 0; font-size: 24px;">✓ Order Capitalized</h2>
        <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            The following purchase order has been finalized and capitalized in the financial system.
        </p>
        
        <!-- Capitalization Confirmation -->
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #fbbf24; border-radius: 12px; padding: 25px; margin-bottom: 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">✓</div>
            <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 18px; font-weight: bold;">Financial Processing Complete</h3>
            <p style="color: #b45309; margin: 0; font-size: 24px; font-weight: bold;">{{po_number}}</p>
        </div>
        
        <!-- Financial Summary -->
        <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
            <h3 style="color: #334155; margin: 0 0 20px 0; font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Financial Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600; width: 40%;">PO Number:</td>
                    <td style="padding: 10px 0; color: #1e293b; font-weight: bold;">{{po_number}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Requester:</td>
                    <td style="padding: 10px 0; color: #1e293b;">{{requester_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Final Amount:</td>
                    <td style="padding: 10px 0; color: #059669; font-size: 20px; font-weight: bold;">${{total_amount}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Supplier:</td>
                    <td style="padding: 10px 0; color: #1e293b;">{{supplier_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Site/Location:</td>
                    <td style="padding: 10px 0; color: #1e293b;">{{site_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Items:</td>
                    <td style="padding: 10px 0; color: #1e293b;">{{item_count}} items</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Capitalization Date:</td>
                    <td style="padding: 10px 0; color: #1e293b;">{{capitalization_date}}</td>
                </tr>
            </table>
        </div>
        
        <!-- Info Box -->
        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 30px; border-radius: 4px;">
            <p style="margin: 0; color: #1e40af; line-height: 1.6; font-size: 14px;">
                <strong>ℹ️ Note:</strong> This order has been processed and all financial records have been updated. The order lifecycle is now complete.
            </p>
        </div>
        
        <!-- Call to Action -->
        <div style="text-align: center; margin: 40px 0;">
            <a href="{{action_link}}" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 18px 48px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 18px; display: inline-block; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);">
                View Financial Record
            </a>
        </div>
        
        <p style="text-align: center; color: #94a3b8; font-size: 14px; margin: 20px 0 0 0;">
            Or copy this link: <a href="{{action_link}}" style="color: #f59e0b; text-decoration: none;">{{action_link}}</a>
        </p>
    </div>
    
    <!-- Professional Footer -->
    <div style="background: #f8fafc; border-top: 2px solid #e2e8f0; padding: 30px; text-align: center;">
        <p style="color: #64748b; font-size: 13px; margin: 0 0 8px 0;">
            This notification was sent from <strong>{{app_name}}</strong>
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            © {{current_year}} {{app_name}}. All rights reserved.
        </p>
    </div>
</div>'
WHERE workflow_type = 'POST_CAPITALIZATION';

-- Add comment
COMMENT ON COLUMN workflow_configurations.recipient_ids IS 'Array of user or role IDs who should receive this notification';
COMMENT ON COLUMN workflow_configurations.include_requester IS 'Whether to also notify the PO requester in addition to configured recipients';
COMMENT ON COLUMN workflow_configurations.app_url IS 'Base URL of the application for generating action links in emails';
