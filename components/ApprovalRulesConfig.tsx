import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Plus, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ChevronRight,
  Info,
  Save,
  X,
  Clock,
  UserCheck,
  Settings
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { approvalRulesService, ApprovalRule } from '../services/approvalRulesService';
import { useToast } from './ToastNotification';
import PageHeader from './PageHeader';

const ApprovalRulesConfig: React.FC = () => {
  const { hasPermission, roles } = useApp();
  const { success, error, warning } = useToast();
  
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<ApprovalRule> | null>(null);

  // Permission check
  const canManage = hasPermission('manage_settings') || hasPermission('manage_development');

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const data = await approvalRulesService.getRules();
      setRules(data);
    } catch (err) {
      console.error('Failed to fetch rules:', err);
      error('Failed to load approval rules');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await approvalRulesService.toggleRuleActive(id, !currentStatus);
      setRules(rules.map(r => r.id === id ? { ...r, is_active: !currentStatus } : r));
      success(`Rule ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      console.error('Toggle failed:', err);
      error('Failed to update rule status');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;

    try {
      const saved = await approvalRulesService.upsertRule(editingRule);
      if (editingRule.id) {
        setRules(rules.map(r => r.id === saved.id ? saved : r));
        success('Rule updated successfully');
      } else {
        setRules([...rules, saved]);
        success('Rule created successfully');
      }
      setIsFormOpen(false);
      setEditingRule(null);
    } catch (err) {
      console.error('Save failed:', err);
      error('Failed to save rule');
    }
  };

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-20 text-center">
        <Shield size={48} className="text-gray-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Access Restricted</h2>
        <p className="text-gray-500 mt-2">You do not have permission to manage approval rules.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-page-entry">
      <PageHeader
        title="Approval Rules"
        subtitle="Configure conditional approval stages for item lifecycle requests."
      />
      {/* Warning Callout */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 flex gap-4">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-800/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">Important: Workflow Execution</h3>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-1 leading-relaxed">
            Approval rules are evaluated at the moment an item request is submitted. 
            Changes made here will <span className="font-bold underline">not</span> retroactively affect requests already in the approval process.
          </p>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            setEditingRule({
              rule_name: '',
              condition_type: 'ALWAYS',
              condition_value: '',
              approver_type: 'ROLE',
              approver_id: '',
              sequential_stage_order: rules.length + 1,
              sla_hours: 24,
              is_active: true
            });
            setIsFormOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-brand)] text-white rounded-xl shadow-lg shadow-[rgba(var(--color-brand-rgb),0.2)] hover:scale-[1.02] transition-all text-sm font-bold"
        >
          <Plus size={18} />
          Add New Rule
        </button>
      </div>

      {/* Rules Table */}
      <div className="bg-white/80 dark:bg-[#1a1d27]/80 backdrop-blur-xl border border-gray-200/60 dark:border-white/5 rounded-3xl overflow-hidden shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 dark:border-white/5">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Stage</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Rule Details</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Condition</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Approver Role</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">SLA</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
              <th className="px-6 py-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-white/5">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={7} className="px-6 py-4 h-16 bg-gray-50/50 dark:bg-white/5"></td>
                </tr>
              ))
            ) : rules.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500 italic">No approval rules configured.</td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center font-bold text-gray-900 dark:text-white text-xs">
                      {rule.sequential_stage_order}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-sm text-gray-900 dark:text-white">{rule.rule_name}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[200px]">{rule.description}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 rounded-md text-[10px] font-black uppercase">
                      {rule.condition_type} {rule.condition_value ? `(${rule.condition_value})` : ''}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <UserCheck size={14} className="text-gray-400" />
                      {rule.approver_id}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 font-medium">
                      <Clock size={14} />
                      {rule.sla_hours}h
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(rule.id, rule.is_active)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${rule.is_active ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${rule.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => {
                        setEditingRule(rule);
                        setIsFormOpen(true);
                      }}
                      className="p-2 text-gray-400 hover:text-[var(--color-brand)] hover:bg-[rgba(var(--color-brand-rgb),0.1)] rounded-lg transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-over Form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsFormOpen(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-[#1a1d27] shadow-2xl h-full flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[rgba(var(--color-brand-rgb),0.1)] text-[var(--color-brand)] flex items-center justify-center">
                  <Settings size={20} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editingRule?.id ? 'Edit Approval Rule' : 'New Approval Rule'}
                </h3>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Rule Name</label>
                  <input
                    required
                    type="text"
                    value={editingRule?.rule_name || ''}
                    onChange={(e) => setEditingRule({ ...editingRule!, rule_name: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-brand)] transition-all"
                    placeholder="e.g. Category Margin Audit"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Description</label>
                  <textarea
                    rows={2}
                    value={editingRule?.description || ''}
                    onChange={(e) => setEditingRule({ ...editingRule!, description: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-brand)] transition-all"
                    placeholder="Briefly describe the purpose of this rule..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Condition Type</label>
                    <select
                      value={editingRule?.condition_type || 'ALWAYS'}
                      onChange={(e) => setEditingRule({ ...editingRule!, condition_type: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-brand)] transition-all"
                    >
                      <option value="ALWAYS">ALWAYS</option>
                      <option value="MARGIN_BELOW">MARGIN_BELOW</option>
                      <option value="CATEGORY_MATCH">CATEGORY_MATCH</option>
                      <option value="REQUEST_TYPE">REQUEST_TYPE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Condition Value</label>
                    <input
                      type="text"
                      value={editingRule?.condition_value || ''}
                      onChange={(e) => setEditingRule({ ...editingRule!, condition_value: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-brand)] transition-all"
                      placeholder="e.g. 25 or Linen"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Approver Role</label>
                    <select
                      required
                      value={editingRule?.approver_id || ''}
                      onChange={(e) => setEditingRule({ ...editingRule!, approver_type: 'ROLE', approver_id: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-brand)] transition-all"
                    >
                      <option value="">Select Role...</option>
                      {roles.map(role => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Stage Order</label>
                    <input
                      required
                      type="number"
                      value={editingRule?.sequential_stage_order || ''}
                      onChange={(e) => setEditingRule({ ...editingRule!, sequential_stage_order: parseInt(e.target.value) })}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-brand)] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">SLA Deadline (Hours)</label>
                  <div className="flex items-center gap-3">
                    <input
                      required
                      type="number"
                      value={editingRule?.sla_hours || ''}
                      onChange={(e) => setEditingRule({ ...editingRule!, sla_hours: parseInt(e.target.value) })}
                      className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-brand)] transition-all"
                    />
                    <div className="text-xs text-gray-500 font-medium">hours</div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-2xl p-4 flex gap-3 mt-8">
                <Info size={18} className="text-blue-500 shrink-0" />
                <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                  Rules are processed sequentially by <span className="font-bold">Stage Order</span>. 
                  Multiple rules can exist for the same stage if they have different conditions.
                </p>
              </div>
            </form>

            <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 flex gap-3">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="flex-1 px-4 py-3 bg-white dark:bg-[#1a1d27] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white rounded-xl text-sm font-bold hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-3 bg-[var(--color-brand)] text-white rounded-xl text-sm font-bold shadow-lg shadow-[rgba(var(--color-brand-rgb),0.2)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Save size={18} />
                {editingRule?.id ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalRulesConfig;
