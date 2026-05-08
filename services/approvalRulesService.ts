import { supabase } from '../lib/supabaseClient';

export interface ApprovalRule {
  id: string;
  rule_name: string;
  description?: string;
  condition_type: string;
  condition_value?: string;
  // DB columns: approver_type (ROLE|USER|AUTO) + approver_id (role name or user UUID)
  approver_type: 'ROLE' | 'USER' | 'AUTO';
  approver_id: string;
  // DB column name is sequential_stage_order
  sequential_stage_order: number;
  sla_hours: number;
  is_active: boolean;
  created_at?: string;
}

export const approvalRulesService = {
  async getRules(): Promise<ApprovalRule[]> {
    const { data, error } = await supabase
      .from('item_approval_rules')
      .select('*')
      .order('stage_order', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async upsertRule(rule: Partial<ApprovalRule>): Promise<ApprovalRule> {
    const { data, error } = await supabase
      .from('item_approval_rules')
      .upsert(rule)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async toggleRuleActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('item_approval_rules')
      .update({ is_active: isActive })
      .eq('id', id);
    if (error) throw error;
  },
};

export default approvalRulesService;
