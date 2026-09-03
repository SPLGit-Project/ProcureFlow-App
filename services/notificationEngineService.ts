import { supabase } from '../lib/supabaseClient';
import { 
    NotificationTemplate, 
    EnhancedAppNotification, 
    UserNotificationPreferences, 
    NotificationDeliveryLog,
    User,
    RoleDefinition
} from '../types';

export const PROCUREFLOW_LOGO_URL = 'https://raw.githubusercontent.com/SPLGit-Project/ProcureFlow-App/main/public/Procureflow_Logo.png';
export const PROCUREFLOW_ICON_URL = 'https://raw.githubusercontent.com/SPLGit-Project/ProcureFlow-App/main/public/Procureflow_Icon.png';

export interface DispatchNotificationParams {
    eventType: string;
    templateKey?: string;
    recipients: Array<{
        type: 'USER' | 'ROLE' | 'REQUESTER' | 'CUSTOM_EMAIL';
        id: string; // user id, role name, or raw email
    }>;
    variables: Record<string, string | number | undefined | null>;
    entityType?: 'PO' | 'ITEM_REQUEST' | 'PRICING_SCHEDULE' | 'SYSTEM' | string;
    entityId?: string;
    actionUrl?: string;
    actionLabel?: string;
    customMessage?: string;
    customTitle?: string;
    severity?: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
}

/**
 * Replaces token placeholders {{key}} with values from the variables map.
 */
export function interpolateTemplate(text: string, variables: Record<string, string | number | undefined | null>): string {
    if (!text) return '';
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const val = variables[key];
        return val !== undefined && val !== null ? String(val) : match;
    });
}

/**
 * Builds an actionable, branded Microsoft Teams Adaptive Card (v1.4) payload
 */
export function buildTeamsAdaptiveCard(params: {
    title: string;
    subtitle?: string;
    colorHex?: string;
    facts?: Array<{ title: string; value: string }>;
    actionUrl?: string;
    actionLabel?: string;
    bodyText?: string;
    iconUrl?: string;
}) {
    const accentColor = params.colorHex || '0284C7';
    const iconUrl = params.iconUrl || PROCUREFLOW_ICON_URL;

    return {
        type: 'message',
        attachments: [
            {
                contentType: 'application/vnd.microsoft.card.adaptive',
                contentUrl: null,
                content: {
                    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                    type: 'AdaptiveCard',
                    version: '1.4',
                    body: [
                        {
                            type: 'Container',
                            style: 'emphasis',
                            bleed: true,
                            items: [
                                {
                                    type: 'ColumnSet',
                                    columns: [
                                        {
                                            type: 'Column',
                                            width: 'auto',
                                            items: [
                                                {
                                                    type: 'Image',
                                                    url: iconUrl,
                                                    size: 'Small',
                                                    width: '36px',
                                                    height: '36px',
                                                    altText: 'ProcureFlow'
                                                }
                                            ]
                                        },
                                        {
                                            type: 'Column',
                                            width: 'stretch',
                                            items: [
                                                {
                                                    type: 'TextBlock',
                                                    text: params.title,
                                                    weight: 'Bolder',
                                                    size: 'Medium',
                                                    color: accentColor === 'DC2626' ? 'Attention' : accentColor === '059669' ? 'Good' : 'Accent',
                                                    wrap: true
                                                },
                                                {
                                                    type: 'TextBlock',
                                                    text: params.subtitle || 'ProcureFlow Enterprise System',
                                                    isSubtle: true,
                                                    spacing: 'None',
                                                    size: 'Small',
                                                    wrap: true
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        },
                        params.bodyText ? {
                            type: 'TextBlock',
                            text: params.bodyText,
                            wrap: true,
                            spacing: 'Medium'
                        } : null,
                        params.facts && params.facts.length > 0 ? {
                            type: 'FactSet',
                            facts: params.facts.map(f => ({ title: f.title, value: f.value })),
                            spacing: 'Medium'
                        } : null
                    ].filter(Boolean),
                    actions: params.actionUrl ? [
                        {
                            type: 'Action.OpenUrl',
                            title: params.actionLabel || 'Open in ProcureFlow',
                            url: params.actionUrl,
                            style: 'positive'
                        }
                    ] : []
                }
            }
        ]
    };
}

/**
 * Builds standard branded responsive HTML email template incorporating Procureflow logo in the body
 */
export function buildEmailHtml(params: {
    title: string;
    bodyHtml?: string;
    facts?: Array<{ label: string; value: string }>;
    actionUrl?: string;
    actionLabel?: string;
    logoUrl?: string;
}): string {
    const logo = params.logoUrl || PROCUREFLOW_LOGO_URL;
    const actionUrl = params.actionUrl || '#';
    const actionLabel = params.actionLabel || 'Open in ProcureFlow';

    const factsHtml = params.facts && params.facts.length > 0 ? `
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
            ${params.facts.map(f => `
                <tr>
                    <td style="padding: 10px 14px; font-weight: 600; color: #64748b; font-size: 13px; border-bottom: 1px solid #e2e8f0; width: 38%;">${f.label}</td>
                    <td style="padding: 10px 14px; font-weight: 700; color: #0f172a; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${f.value}</td>
                </tr>
            `).join('')}
        </table>
    ` : '';

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${params.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f1f5f9; padding: 30px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                    <!-- Main Body Content with In-Body Logo at the Top -->
                    <tr>
                        <td style="padding: 36px 36px 28px 36px;">
                            <!-- ProcureFlow Logo at top of body -->
                            <div style="margin-bottom: 24px; padding-bottom: 18px; border-bottom: 1px solid #f1f5f9;">
                                <img src="${logo}" alt="ProcureFlow" style="max-height: 34px; width: auto; max-width: 200px; display: block;" />
                            </div>
                            <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                                ${params.title}
                            </h1>
                            <div style="font-size: 14px; line-height: 1.6; color: #334155;">
                                ${params.bodyHtml || ''}
                            </div>
                            ${factsHtml}
                            <!-- Action Button -->
                            <div style="margin-top: 28px; text-align: center;">
                                <a href="${actionUrl}" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 6px rgba(2,132,199,0.35);">
                                    ${actionLabel} &rarr;
                                </a>
                            </div>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0 0 6px 0; font-weight: 600; color: #64748b;">ProcureFlow Enterprise Procurement & Item Management</p>
                            <p style="margin: 0;">This is an automated notification from SPL ProcureFlow. Do not reply directly to this email.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

class NotificationEngineService {
    /**
     * Fetch all notification templates from database
     */
    async getTemplates(): Promise<NotificationTemplate[]> {
        const { data, error } = await supabase
            .from('notification_templates')
            .select('*')
            .order('name');

        if (error) {
            console.error('Error fetching notification templates:', error);
            return [];
        }
        return (data || []) as NotificationTemplate[];
    }

    /**
     * Upsert a notification template
     */
    async saveTemplate(template: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
        const payload = {
            template_key: template.template_key,
            name: template.name,
            description: template.description,
            event_type: template.event_type,
            category: template.category || 'GENERAL',
            channels: template.channels || {},
            variables: template.variables || [],
            is_system: template.is_system || false,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('notification_templates')
            .upsert(payload, { onConflict: 'template_key' })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as NotificationTemplate;
    }

    /**
     * Fetch user notification preferences
     */
    async getUserPreferences(userId: string): Promise<UserNotificationPreferences | null> {
        const { data, error } = await supabase
            .from('user_notification_preferences')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error || !data) return null;
        return data as UserNotificationPreferences;
    }

    /**
     * Save user notification preferences
     */
    async saveUserPreferences(prefs: UserNotificationPreferences): Promise<void> {
        const { error } = await supabase
            .from('user_notification_preferences')
            .upsert({
                ...prefs,
                updated_at: new Date().toISOString()
            });

        if (error) throw new Error(error.message);
    }

    /**
     * Fetch all user notification preferences map keyed by user_id
     */
    async getAllUserPreferences(): Promise<Record<string, UserNotificationPreferences>> {
        const { data, error } = await supabase
            .from('user_notification_preferences')
            .select('*');

        if (error || !data) {
            console.warn('[NotificationEngine] Failed to fetch all user preferences:', error?.message);
            return {};
        }

        const map: Record<string, UserNotificationPreferences> = {};
        for (const row of data) {
            map[row.user_id] = row as UserNotificationPreferences;
        }
        return map;
    }

    /**
     * Helper to toggle or update a single channel preference for a user
     */
    async setUserChannelPreference(
        userId: string, 
        channel: 'email' | 'teams' | 'in_app', 
        enabled: boolean
    ): Promise<UserNotificationPreferences> {
        const existing = await this.getUserPreferences(userId);
        const updated: UserNotificationPreferences = existing ? {
            ...existing,
            [`${channel}_enabled`]: enabled,
            updated_at: new Date().toISOString()
        } : {
            user_id: userId,
            email_enabled: channel === 'email' ? enabled : true,
            teams_enabled: channel === 'teams' ? enabled : true,
            in_app_enabled: channel === 'in_app' ? enabled : true,
            sound_enabled: true,
            digest_frequency: 'INSTANT',
            quiet_hours_enabled: false,
            category_overrides: {
                APPROVAL: { in_app: true, email: true, teams: true },
                STATUS_CHANGE: { in_app: true, email: true, teams: true },
                DELIVERY: { in_app: true, email: true, teams: true },
                ITEM_LIFECYCLE: { in_app: true, email: true, teams: false },
                PRICING: { in_app: true, email: true, teams: false },
                ALERT: { in_app: true, email: true, teams: true }
            },
            updated_at: new Date().toISOString()
        };

        await this.saveUserPreferences(updated);
        return updated;
    }

    /**
     * Fetch in-app notifications for the current user (by ID or related user ID)
     */
    async getUserNotifications(userId: string, limit = 50): Promise<EnhancedAppNotification[]> {
        const { data, error } = await supabase
            .from('user_notifications')
            .select('*')
            .eq('user_id', userId)
            .eq('is_archived', false)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching user notifications:', error);
            return [];
        }
        return (data || []) as EnhancedAppNotification[];
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId: string): Promise<void> {
        const { error } = await supabase
            .from('user_notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', notificationId);

        if (error) console.warn('markAsRead error:', error);
    }

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId: string): Promise<void> {
        const { error } = await supabase
            .from('user_notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('is_read', false);

        if (error) console.warn('markAllAsRead error:', error);
    }

    /**
     * Archive/delete notification
     */
    async archiveNotification(notificationId: string): Promise<void> {
        const { error } = await supabase
            .from('user_notifications')
            .update({ is_archived: true })
            .eq('id', notificationId);

        if (error) console.warn('archiveNotification error:', error);
    }

    /**
     * Fetch delivery logs for telemetry & audit
     */
    async getDeliveryLogs(limit = 100): Promise<NotificationDeliveryLog[]> {
        const { data, error } = await supabase
            .from('notification_delivery_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching delivery logs:', error);
            return [];
        }
        return (data || []) as NotificationDeliveryLog[];
    }

    /**
     * Fetch configured Microsoft Teams webhook URL from database
     */
    async getTeamsWebhookUrl(): Promise<string> {
        try {
            const { data } = await supabase
                .from('app_config')
                .select('key, value')
                .in('key', ['teams_webhook_url', 'teams_config']);

            let url = '';
            data?.forEach(c => {
                if (c.key === 'teams_webhook_url' && typeof c.value === 'string' && c.value) {
                    url = c.value;
                } else if (c.key === 'teams_config' && c.value && (c.value as any).webhookUrl) {
                    url = (c.value as any).webhookUrl;
                }
            });
            return url;
        } catch {
            return '';
        }
    }

    /**
     * Save Microsoft Teams webhook URL to database
     */
    async saveTeamsWebhookUrl(url: string): Promise<void> {
        await Promise.all([
            supabase.from('app_config').upsert({
                key: 'teams_webhook_url',
                value: url,
                updated_at: new Date().toISOString()
            }),
            supabase.from('app_config').upsert({
                key: 'teams_config',
                value: { webhookUrl: url },
                updated_at: new Date().toISOString()
            })
        ]);
    }

    /**
     * Core dispatch engine: Renders templates and delivers across In-App, Email (via MS Graph), and MS Teams.
     */
    async dispatchNotification(params: DispatchNotificationParams): Promise<{
        inAppSent: number;
        emailsSent: number;
        teamsSent: number;
    }> {
        let inAppSent = 0;
        let emailsSent = 0;
        let teamsSent = 0;

        // 1. Resolve template if key provided
        let template: NotificationTemplate | null = null;
        if (params.templateKey) {
            const { data } = await supabase
                .from('notification_templates')
                .select('*')
                .eq('template_key', params.templateKey)
                .single();
            template = data as NotificationTemplate;
        }

        // 2. Fetch users and roles for recipient resolution
        const { data: usersData } = await supabase.from('users').select('*');
        const users: User[] = (usersData || []) as User[];

        // 3. Resolve target user IDs & emails
        const targetUsers: Array<{ id?: string; email?: string; name?: string }> = [];

        for (const recipient of params.recipients) {
            if (recipient.type === 'USER') {
                const u = users.find(x => x.id === recipient.id || (x as any).auth_user_id === recipient.id);
                if (u) {
                    targetUsers.push({ id: u.id, email: u.email, name: u.name });
                } else if (recipient.id.includes('@')) {
                    targetUsers.push({ email: recipient.id, name: recipient.id });
                } else {
                    targetUsers.push({ id: recipient.id });
                }
            } else if (recipient.type === 'ROLE') {
                const matching = users.filter(u => 
                    u.role === recipient.id || 
                    u.roleIds?.includes(recipient.id) ||
                    (recipient.id === 'ADMIN' && (u.role === 'ADMIN' || u.roleIds?.includes('ADMIN')))
                );
                matching.forEach(u => targetUsers.push({ id: u.id, email: u.email, name: u.name }));
            } else if (recipient.type === 'REQUESTER' && params.variables.requester_id) {
                const u = users.find(x => x.id === params.variables.requester_id);
                if (u) targetUsers.push({ id: u.id, email: u.email, name: u.name });
            } else if (recipient.type === 'CUSTOM_EMAIL') {
                targetUsers.push({ email: recipient.id, name: recipient.id });
            }
        }

        // Deduplicate recipients
        const uniqueRecipients = Array.from(new Map(targetUsers.map(u => [u.id || u.email, u])).values());

        // Context variables for interpolation
        const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://procureflow.splservices.com.au';
        const vars = {
            ...params.variables,
            app_url: appUrl,
            action_url: params.actionUrl || appUrl,
            current_year: new Date().getFullYear().toString()
        };

        // Extract key facts for display in cards / email
        const factsList = Object.entries(params.variables)
            .filter(([k, v]) => v !== undefined && v !== null && !['action_url', 'html_body', 'requester_id'].includes(k))
            .slice(0, 6)
            .map(([k, v]) => ({
                label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                value: String(v)
            }));

        // 4. In-App Notifications Dispatch
        if (!template || template.channels.in_app?.enabled !== false) {
            const inAppTitle = params.customTitle || (template?.channels.in_app?.title ? interpolateTemplate(template.channels.in_app.title, vars) : `Notification: ${params.eventType}`);
            const inAppBody = params.customMessage || (template?.channels.in_app?.body ? interpolateTemplate(template.channels.in_app.body, vars) : `Event occurred: ${params.eventType}`);
            const inAppSeverity = params.severity || template?.channels.in_app?.severity || 'INFO';
            const inAppLabel = params.actionLabel || template?.channels.in_app?.action_label || 'View Details';

            for (const target of uniqueRecipients) {
                if (!target.id) continue;

                // Check user preferences
                const prefs = await this.getUserPreferences(target.id);
                if (prefs && !prefs.in_app_enabled) continue;

                const { error: insertError } = await supabase.from('user_notifications').insert({
                    user_id: target.id,
                    title: inAppTitle,
                    message: inAppBody,
                    type: params.eventType,
                    category: template?.category || 'GENERAL',
                    severity: inAppSeverity,
                    action_url: params.actionUrl,
                    action_label: inAppLabel,
                    entity_type: params.entityType,
                    entity_id: params.entityId,
                    is_read: false,
                    metadata: params.variables
                });

                if (!insertError) {
                    inAppSent++;
                    await this.logDelivery({
                        event_type: params.eventType,
                        channel: 'IN_APP',
                        recipient: target.id,
                        status: 'DELIVERED',
                        title: inAppTitle,
                        payload: { title: inAppTitle, body: inAppBody, url: params.actionUrl }
                    });
                } else {
                    await this.logDelivery({
                        event_type: params.eventType,
                        channel: 'IN_APP',
                        recipient: target.id,
                        status: 'FAILED',
                        title: inAppTitle,
                        payload: { error: insertError.message }
                    });
                }
            }
        }

        // 5. Real Email Notification Dispatch via Supabase Edge Function (Microsoft Graph)
        if (!template || template.channels.email?.enabled !== false) {
            const emailSubject = template?.channels.email?.subject 
                ? interpolateTemplate(template.channels.email.subject, vars) 
                : `ProcureFlow Notification: ${params.eventType}`;

            const rawBody = template?.channels.email?.html_body 
                ? interpolateTemplate(template.channels.email.html_body, vars)
                : `<p>${params.customMessage || `An event of type ${params.eventType} was triggered in ProcureFlow.`}</p>`;

            const emailHtml = buildEmailHtml({
                title: emailSubject,
                bodyHtml: rawBody,
                facts: factsList,
                actionUrl: params.actionUrl,
                actionLabel: params.actionLabel || 'Open in ProcureFlow'
            });

            for (const target of uniqueRecipients) {
                const targetEmail = target.email;
                if (!targetEmail) continue;

                if (target.id) {
                    const prefs = await this.getUserPreferences(target.id);
                    if (prefs && !prefs.email_enabled) continue;
                }

                try {
                    const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('send-notification-email', {
                        body: {
                            to: targetEmail,
                            subject: emailSubject,
                            html: emailHtml
                        }
                    });

                    if (edgeErr) {
                        console.warn(`[NotificationEngine] Edge function email dispatch to ${targetEmail} failed:`, edgeErr);
                        await this.logDelivery({
                            event_type: params.eventType,
                            channel: 'EMAIL',
                            recipient: targetEmail,
                            status: 'FAILED',
                            title: emailSubject,
                            payload: { error: edgeErr.message }
                        });
                    } else {
                        emailsSent++;
                        await this.logDelivery({
                            event_type: params.eventType,
                            channel: 'EMAIL',
                            recipient: targetEmail,
                            status: 'DELIVERED',
                            title: emailSubject,
                            payload: {
                                to: targetEmail,
                                subject: emailSubject,
                                response: edgeData,
                                logo_url: PROCUREFLOW_LOGO_URL
                            }
                        });
                    }
                } catch (sendErr: any) {
                    console.error(`[NotificationEngine] Exception dispatching email:`, sendErr);
                    await this.logDelivery({
                        event_type: params.eventType,
                        channel: 'EMAIL',
                        recipient: targetEmail,
                        status: 'FAILED',
                        title: emailSubject,
                        payload: { error: sendErr.message }
                    });
                }
            }
        }

        // 6. Microsoft Teams Webhook Dispatch
        try {
            const teamsWebhookUrl = await this.getTeamsWebhookUrl();

            if (teamsWebhookUrl && (!template || template.channels.teams?.enabled !== false)) {
                const teamsTitle = template?.channels.teams?.title ? interpolateTemplate(template.channels.teams.title, vars) : `ProcureFlow Alert: ${params.eventType}`;
                const teamsSubtitle = template?.channels.teams?.subtitle ? interpolateTemplate(template.channels.teams.subtitle, vars) : undefined;
                const cardColor = template?.channels.teams?.color || '0284C7';

                const cardPayload = buildTeamsAdaptiveCard({
                    title: teamsTitle,
                    subtitle: teamsSubtitle,
                    colorHex: cardColor,
                    facts: factsList.map(f => ({ title: f.label, value: f.value })),
                    actionUrl: params.actionUrl,
                    actionLabel: template?.channels.teams?.cta_label || 'Open in ProcureFlow',
                    iconUrl: PROCUREFLOW_ICON_URL
                });

                const resp = await fetch(teamsWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(cardPayload)
                });

                if (resp.ok) {
                    teamsSent++;
                    await this.logDelivery({
                        event_type: params.eventType,
                        channel: 'TEAMS',
                        recipient: teamsWebhookUrl,
                        status: 'DELIVERED',
                        title: teamsTitle,
                        payload: cardPayload
                    });
                } else {
                    await this.logDelivery({
                        event_type: params.eventType,
                        channel: 'TEAMS',
                        recipient: teamsWebhookUrl,
                        status: 'FAILED',
                        title: teamsTitle,
                        payload: { status: resp.status, statusText: resp.statusText, card: cardPayload }
                    });
                }
            }
        } catch (teamsError) {
            console.warn('Teams dispatch skipped or failed:', teamsError);
        }

        return { inAppSent, emailsSent, teamsSent };
    }

    /**
     * Internal delivery telemetry logger
     */
    async logDelivery(log: Omit<NotificationDeliveryLog, 'id' | 'created_at'>) {
        try {
            await supabase.from('notification_delivery_logs').insert({
                ...log,
                created_at: new Date().toISOString()
            });
        } catch (e) {
            console.warn('Telemetry log write failed:', e);
        }
    }
}

export const notificationEngineService = new NotificationEngineService();
