import { PORequest, WorkflowType, WorkflowConfiguration, User } from '../types';
import { supabase } from '../lib/supabaseClient';

// Branding settings interface
interface BrandingSettings {
    appName: string;
    logoUrl?: string;
    organizationName?: string;
}

/**
 * Get action text for CTA button based on workflow type
 */
const getActionText = (workflowType: WorkflowType): string => {
    switch (workflowType) {
        case 'APPROVAL':
            return 'Approve Now';
        case 'POST_APPROVAL':
            return 'View Order Details';
        case 'POST_DELIVERY':
            return 'View Order Details';
        case 'POST_CAPITALIZATION':
            return 'View Financial Record';
        default:
            return 'View Details';
    }
};

/**
 * Replace template variables in string with actual values
 */
const replaceVariables = (template: string, data: Record<string, any>): string => {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data[key] !== undefined ? String(data[key]) : match;
    });
};

/**
 * Get users by role ID
 */
const getUsersByRole = async (roleId: string): Promise<User[]> => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('roleId', roleId)
        .eq('hasAppAccess', true);
    
    if (error) {
        console.error('Error fetching users by role:', error);
        return [];
    }
    
    return data || [];
};

/**
 * Get users by IDs
 */
const getUsersByIds = async (userIds: string[]): Promise<User[]> => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .in('id', userIds)
        .eq('hasAppAccess', true);
    
    if (error) {
        console.error('Error fetching users by IDs:', error);
        return [];
    }
    
    return data || [];
};

/**
 * Get user by ID
 */
const getUserById = async (userId: string): Promise<User | null> => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error('Error fetching user:', error);
        return null;
    }
    
    return data;
};

/**
 * Resolve recipients based on workflow configuration
 */
const resolveRecipients = async (
    config: WorkflowConfiguration,
    poRequest: PORequest
): Promise<User[]> => {
    let recipients: User[] = [];
    
    // Add role members
    if (config.recipientType === 'ROLE' && config.recipientIds && config.recipientIds.length > 0) {
        for (const roleId of config.recipientIds) {
            const roleMembers = await getUsersByRole(roleId);
            recipients.push(...roleMembers);
        }
    }
    
    // Add specific users
    if (config.recipientType === 'USER' && config.recipientIds && config.recipientIds.length > 0) {
        const users = await getUsersByIds(config.recipientIds);
        recipients.push(...users);
    }
    
    // Add requester (either as primary recipient or in addition)
    if (config.recipientType === 'REQUESTER' || config.includeRequester) {
        const requester = await getUserById(poRequest.requesterId);
        if (requester) recipients.push(requester);
    }
    
    // Remove duplicates based on user ID
    return Array.from(new Map(recipients.map(u => [u.id, u])).values());
};

/**
 * Get workflow configuration by type
 */
const getWorkflowConfig = async (workflowType: WorkflowType): Promise<WorkflowConfiguration | null> => {
    const { data, error } = await supabase
        .from('workflow_configurations')
        .select('*')
        .eq('workflow_type', workflowType)
        .single();
    
    if (error) {
        console.error('Error fetching workflow config:', error);
        return null;
    }
    
    // Transform database format to application format
    return {
        id: data.id,
        workflowType: data.workflow_type,
        isEnabled: data.is_enabled,
        emailEnabled: data.email_enabled,
        emailSubject: data.email_subject,
        emailBody: data.email_body,
        inappEnabled: data.inapp_enabled,
        inappTitle: data.inapp_title,
        inappMessage: data.inapp_message,
        recipientType: data.recipient_type,
        recipientIds: data.recipient_ids || [],
        includeRequester: data.include_requester,
        appUrl: data.app_url,
        escalationHours: data.escalation_hours
    };
};

/**
 * Send email notification
 */
const sendEmail = async (params: { to: string; subject: string; html: string }): Promise<boolean> => {
    try {
        // Call your email service here
        // This could be SendGrid, AWS SES, or a custom Edge Function
        const { error } = await supabase.functions.invoke('send-email', {
            body: {
                to: params.to,
                subject: params.subject,
                html: params.html
            }
        });
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

/**
 * Create in-app notification
 */
const createInAppNotification = async (params: {
    userId: string;
    title: string;
    message: string;
    type: WorkflowType;
    relatedPoId?: string;
}): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('in_app_notifications')
            .insert({
                user_id: params.userId,
                title: params.title,
                message: params.message,
                type: params.type,
                related_po_id: params.relatedPoId,
                is_read: false
            });
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error creating in-app notification:', error);
        return false;
    }
};

/**
 * Trigger workflow notification based on PO status/event
 */
export const triggerWorkflowNotification = async (
    poRequest: PORequest,
    workflowType: WorkflowType,
    branding: BrandingSettings,
    additionalData?: Record<string, any>
): Promise<void> => {
    try {
        // Get workflow config
        const config = await getWorkflowConfig(workflowType);
        
        if (!config || !config.isEnabled) {
            console.log(`Workflow ${workflowType} is not enabled`);
            return;
        }
        
        // Determine recipients
        const recipients = await resolveRecipients(config, poRequest);
        
        if (recipients.length === 0) {
            console.warn(`No recipients found for workflow ${workflowType}`);
            return;
        }
        
        // Prepare template data
        const templateData = {
            // User information
            approver_name: additionalData?.approver_name || 'Approver',
            requester_name: poRequest.requesterName || 'User',
            recipient_name: '{Recipient}',
            
            // PO details
            po_number: poRequest.displayId || poRequest.id || 'N/A',
            total_amount: poRequest.totalAmount?.toFixed(2) || '0.00',
            supplier_name: poRequest.supplierName || 'N/A',
            site_name: poRequest.site || 'N/A',
            item_count: (poRequest.lines?.length || 0).toString(),
            status: poRequest.status || 'PENDING',
            
            // Dates
            request_date: new Date(poRequest.requestDate || Date.now()).toLocaleDateString(),
            approval_date: additionalData?.approval_date || new Date().toLocaleDateString(),
            delivery_date: additionalData?.delivery_date || new Date().toLocaleDateString(),
            capitalization_date: additionalData?.capitalization_date || new Date().toLocaleDateString(),
            
            // App branding
            app_name: branding.appName || 'ProcureFlow',
            app_logo: branding.logoUrl || '',
            organization_name: branding.organizationName || branding.appName || 'Your Organization',
            current_year: new Date().getFullYear().toString(),
            
            // Links and actions
            action_link: `${config.appUrl}/requests?id=${poRequest.id}`,
            action_text: getActionText(workflowType),
            approval_link: `${config.appUrl}/requests?id=${poRequest.id}`,
            po_link: `${config.appUrl}/requests?id=${poRequest.id}`,
            
            // Additional context
            reason_for_request: poRequest.comments || 'No reason provided'
        };
        
        // Send emails
        if (config.emailEnabled) {
            for (const recipient of recipients) {
                const personalizedData = {
                    ...templateData,
                    recipient_name: recipient.name || recipient.email
                };
                
                await sendEmail({
                    to: recipient.email,
                    subject: replaceVariables(config.emailSubject, personalizedData),
                    html: replaceVariables(config.emailBody, personalizedData)
                });
            }
        }
        
        // Create in-app notifications
        if (config.inappEnabled) {
            for (const recipient of recipients) {
                const personalizedData = {
                    ...templateData,
                    recipient_name: recipient.name || recipient.email
                };
                
                await createInAppNotification({
                    userId: recipient.id,
                    title: replaceVariables(config.inappTitle, personalizedData),
                    message: replaceVariables(config.inappMessage, personalizedData),
                    type: workflowType,
                    relatedPoId: poRequest.id
                });
            }
        }
        
        console.log(`Workflow notification ${workflowType} triggered for ${recipients.length} recipients`);
    } catch (error) {
        console.error('Error triggering workflow notification:', error);
    }
};

/**
 * Trigger notification when PO is submitted for approval
 */
export const notifyPOSubmitted = async (poRequest: PORequest, branding: BrandingSettings) => {
    await triggerWorkflowNotification(poRequest, 'APPROVAL', branding);
};

/**
 * Trigger notification when PO is approved
 */
export const notifyPOApproved = async (
    poRequest: PORequest,
    branding: BrandingSettings,
    approverName: string
) => {
    await triggerWorkflowNotification(poRequest, 'POST_APPROVAL', branding, {
        approver_name: approverName,
        approval_date: new Date().toLocaleDateString()
    });
};

/**
 * Trigger notification when PO is complete (all deliveries received)
 */
export const notifyPOComplete = async (poRequest: PORequest, branding: BrandingSettings) => {
    // Only trigger if status is COMPLETE
    // Trigger when all deliveries are confirmed (status would be from POStatus enum)
    if (poRequest.deliveries && poRequest.deliveries.length > 0) {
        await triggerWorkflowNotification(poRequest, 'POST_DELIVERY', branding, {
            delivery_date: new Date().toLocaleDateString()
        });
    }
};

/**
 * Trigger notification when PO is capitalized
 */
export const notifyPOCapitalized = async (poRequest: PORequest, branding: BrandingSettings) => {
    await triggerWorkflowNotification(poRequest, 'POST_CAPITALIZATION', branding, {
        capitalization_date: new Date().toLocaleDateString()
    });
};
