import { supabase } from '../lib/supabaseClient';
import { 
    UnifiedWorkflowDefinition, 
    WorkflowStageDefinition, 
    WorkflowCondition,
    PORequest,
    ItemRequest
} from '../types';
import { notificationEngineService } from './notificationEngineService';

class WorkflowEngineService {
    /**
     * Fetch all workflow definitions from database
     */
    async getWorkflows(): Promise<UnifiedWorkflowDefinition[]> {
        const { data, error } = await supabase
            .from('workflow_definitions')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching workflow definitions:', error);
            return [];
        }
        return (data || []) as UnifiedWorkflowDefinition[];
    }

    /**
     * Get a single workflow by key
     */
    async getWorkflowByKey(key: string): Promise<UnifiedWorkflowDefinition | null> {
        const { data, error } = await supabase
            .from('workflow_definitions')
            .select('*')
            .eq('workflow_key', key)
            .single();

        if (error || !data) return null;
        return data as UnifiedWorkflowDefinition;
    }

    /**
     * Upsert a workflow definition
     */
    async saveWorkflow(workflow: Partial<UnifiedWorkflowDefinition>): Promise<UnifiedWorkflowDefinition> {
        const payload = {
            workflow_key: workflow.workflow_key,
            name: workflow.name,
            description: workflow.description,
            category: workflow.category,
            trigger_event: workflow.trigger_event,
            is_enabled: workflow.is_enabled !== false,
            conditions: workflow.conditions || [],
            stages: workflow.stages || [],
            notification_rules: workflow.notification_rules || [],
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('workflow_definitions')
            .upsert(payload, { onConflict: 'workflow_key' })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as UnifiedWorkflowDefinition;
    }

    /**
     * Delete a workflow definition
     */
    async deleteWorkflow(id: string): Promise<void> {
        const { error } = await supabase
            .from('workflow_definitions')
            .delete()
            .eq('id', id);

        if (error) throw new Error(error.message);
    }

    /**
     * Evaluates a single condition against an entity record (e.g. PORequest or ItemRequest)
     */
    evaluateCondition(condition: WorkflowCondition, record: Record<string, unknown>): boolean {
        const rawValue = record[condition.field];
        const targetValue = condition.value;

        switch (condition.operator) {
            case 'EQUALS':
                return String(rawValue).toLowerCase() === String(targetValue).toLowerCase();
            case 'NOT_EQUALS':
                return String(rawValue).toLowerCase() !== String(targetValue).toLowerCase();
            case 'GREATER_THAN':
                return Number(rawValue) > Number(targetValue);
            case 'GREATER_THAN_OR_EQUAL':
                return Number(rawValue) >= Number(targetValue);
            case 'LESS_THAN':
                return Number(rawValue) < Number(targetValue);
            case 'LESS_THAN_OR_EQUAL':
                return Number(rawValue) <= Number(targetValue);
            case 'CONTAINS':
                return String(rawValue).toLowerCase().includes(String(targetValue).toLowerCase());
            case 'IN_LIST':
                if (Array.isArray(targetValue)) {
                    return targetValue.map(String).includes(String(rawValue));
                }
                return false;
            default:
                return true;
        }
    }

    /**
     * Finds active stages for an entity based on workflow stage conditions
     */
    resolveApplicableStages(
        workflow: UnifiedWorkflowDefinition, 
        record: Record<string, unknown>
    ): WorkflowStageDefinition[] {
        if (!workflow.is_enabled) return [];

        return workflow.stages.filter(stage => {
            if (!stage.condition) return true;
            return this.evaluateCondition(stage.condition, record);
        });
    }

    /**
     * Evaluates and triggers automated notifications attached to a workflow stage
     */
    async triggerStageNotifications(
        workflow: UnifiedWorkflowDefinition,
        trigger: 'ON_STAGE_ENTER' | 'ON_APPROVED' | 'ON_REJECTED' | 'ON_SLA_WARNING' | 'ON_SLA_BREACH',
        context: {
            variables: Record<string, string | number | undefined | null>;
            entityType: string;
            entityId: string;
            actionUrl?: string;
            approverRoleId?: string;
            approverUserId?: string;
        }
    ) {
        const matchingRules = workflow.notification_rules.filter(r => r.trigger === trigger);

        for (const rule of matchingRules) {
            const recipients: Array<{ type: 'ROLE' | 'USER' | 'REQUESTER' | 'CUSTOM_EMAIL'; id: string }> = [];

            if (rule.custom_recipients && rule.custom_recipients.length > 0) {
                recipients.push(...rule.custom_recipients);
            } else if (context.approverUserId || context.approverRoleId) {
                if (context.approverUserId) {
                    recipients.push({ type: 'USER', id: context.approverUserId });
                }
                if (context.approverRoleId) {
                    recipients.push({ type: 'ROLE', id: context.approverRoleId });
                }
            } else {
                recipients.push({ type: 'REQUESTER', id: String(context.variables.requester_id || '') });
            }

            await notificationEngineService.dispatchNotification({
                eventType: trigger,
                templateKey: rule.template_key,
                recipients,
                variables: context.variables,
                entityType: context.entityType,
                entityId: context.entityId,
                actionUrl: context.actionUrl
            });
        }
    }
}

export const workflowEngineService = new WorkflowEngineService();
