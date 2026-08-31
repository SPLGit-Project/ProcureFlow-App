import { supabase } from '../lib/supabaseClient';
import { 
    NotificationTemplate, 
    EnhancedAppNotification, 
    UserNotificationPreferences, 
    NotificationDeliveryLog,
    User,
    RoleDefinition
} from '../types';

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
 * Builds an actionable Microsoft Teams Adaptive Card (v1.4) payload
 */
export function buildTeamsAdaptiveCard(params: {
    title: string;
    subtitle?: string;
    colorHex?: string;
    facts?: Array<{ title: string; value: string }>;
    actionUrl?: string;
    actionLabel?: string;
    bodyText?: string;
}) {
    const accentColor = params.colorHex || '0284C7';
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
                                    type: 'TextBlock',
                                    text: params.title,
                                    weight: 'Bolder',
                                    size: 'Medium',
                                    color: accentColor === 'DC2626' ? 'Attention' : accentColor === '059669' ? 'Good' : 'Accent'
                                },
                                params.subtitle ? {
                                    type: 'TextBlock',
                                    text: params.subtitle,
                                    isSubtle: true,
                                    spacing: 'None',
                                    size: 'Small'
                                } : null
                            ].filter(Boolean)
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
     * Fetch in-app notifications for the current user
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
     * Core dispatch engine: Renders templates and delivers across In-App, Email, and MS Teams.
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
                const u = users.find(x => x.id === recipient.id);
                if (u) targetUsers.push({ id: u.id, email: u.email, name: u.name });
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
        const vars = {
            ...params.variables,
            app_url: window.location.origin,
            action_url: params.actionUrl || `${window.location.origin}`,
            current_year: new Date().getFullYear().toString()
        };

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

        // 5. Microsoft Teams Webhook Dispatch
        try {
            const { data: configData } = await supabase
                .from('app_config')
                .select('value')
                .eq('key', 'teams_webhook_url')
                .single();

            const teamsWebhookUrl = configData?.value as string;

            if (teamsWebhookUrl && (!template || template.channels.teams?.enabled !== false)) {
                const teamsTitle = template?.channels.teams?.title ? interpolateTemplate(template.channels.teams.title, vars) : `ProcureFlow Alert: ${params.eventType}`;
                const teamsSubtitle = template?.channels.teams?.subtitle ? interpolateTemplate(template.channels.teams.subtitle, vars) : undefined;
                const cardColor = template?.channels.teams?.color || '0284C7';

                const facts = Object.entries(params.variables)
                    .filter(([k, v]) => v !== undefined && v !== null && !['action_url', 'html_body'].includes(k))
                    .slice(0, 6)
                    .map(([k, v]) => ({
                        title: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                        value: String(v)
                    }));

                const cardPayload = buildTeamsAdaptiveCard({
                    title: teamsTitle,
                    subtitle: teamsSubtitle,
                    colorHex: cardColor,
                    facts,
                    actionUrl: params.actionUrl,
                    actionLabel: template?.channels.teams?.cta_label || 'Open in ProcureFlow'
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
                        payload: { status: resp.status, statusText: resp.statusText }
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
    private async logDelivery(log: Omit<NotificationDeliveryLog, 'id' | 'created_at'>) {
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
