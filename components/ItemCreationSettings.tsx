import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { supabase } from '../lib/supabaseClient.ts';
import { db } from '../services/db.ts';
import { MarginThresholds } from '../types.ts';
import { Save, RefreshCw, AlertCircle, Plus, Trash2, Check, X, Edit2 } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type ConditionType = 'MARGIN_BELOW' | 'PURCHASE_ONLY' | 'CUSTOMER_SPECIFIC' | 'CONTRACT' | 'COG' | 'URGENT' | 'REPLACEMENT' | 'DEFAULT';
type ApproverType  = 'ROLE' | 'USER' | 'AUTO';

interface ApprovalRule {
    id: string;
    rule_name: string;
    condition_type: ConditionType;
    condition_value: string | null;
    approver_type: ApproverType;
    approver_id: string | null;
    sequential_stage_order: number;
    sla_hours: number;
    is_active: boolean;
}

interface SkuCodeMap {
    id: string;
    option_type: string;
    option_value: string;
    display_label: string;
    is_active: boolean;
}

const CONDITION_TYPES: ConditionType[] = ['MARGIN_BELOW', 'PURCHASE_ONLY', 'CUSTOMER_SPECIFIC', 'CONTRACT', 'COG', 'URGENT', 'REPLACEMENT', 'DEFAULT'];
const APPROVER_TYPES: ApproverType[]   = ['ROLE', 'USER', 'AUTO'];

const EMPTY_RULE: Omit<ApprovalRule, 'id'> = {
    rule_name: '', condition_type: 'DEFAULT', condition_value: null,
    approver_type: 'ROLE', approver_id: null, sequential_stage_order: 1, sla_hours: 48, is_active: true,
};

// ── Section: Margin Thresholds ────────────────────────────────────────────────

function MarginThresholdsSection() {
    const { marginThresholds } = useApp();
    const [editing, setEditing]     = useState<MarginThresholds | null>(null);
    const [isSaving, setIsSaving]   = useState(false);
    const [saved, setSaved]         = useState(false);
    const [error, setError]         = useState<string | null>(null);

    useEffect(() => { if (marginThresholds) setEditing({ ...marginThresholds }); }, [marginThresholds]);

    const handleSave = async () => {
        if (!editing) return;
        setIsSaving(true); setError(null);
        try {
            await db.updateMarginThresholds(editing);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    if (!editing) return null;

    const fields: { key: keyof MarginThresholds; label: string }[] = [
        { key: 'defaultPercent',    label: 'Default' },
        { key: 'standard',          label: 'Standard' },
        { key: 'contract',          label: 'Contract' },
        { key: 'customerSpecific',  label: 'Customer-Specific' },
        { key: 'promotional',       label: 'Promotional' },
        { key: 'customerGroup',     label: 'Customer Group' },
    ];

    return (
        <div className="bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Margin Thresholds</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Approval warning triggers when sell margin % falls below these values.</p>

            {error && (
                <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
                    <AlertCircle size={12} className="shrink-0" />{error}
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {fields.map(({ key, label }) => (
                    <div key={key}>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
                        <div className="relative">
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                value={editing[key]}
                                onChange={e => setEditing(prev => prev ? { ...prev, [key]: parseFloat(e.target.value) || 0 } : prev)}
                                className="w-full pr-7 pl-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-tranquil,#129DC0)]/30"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--color-tranquil,#129DC0)] text-white text-sm font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                    {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    Save
                </button>
                {saved && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <Check size={12} /> Saved
                    </span>
                )}
                <p className="text-xs text-gray-400 ml-auto">Default approval warning: below {editing.defaultPercent}%</p>
            </div>
        </div>
    );
}

// ── Section: Approval Rules ───────────────────────────────────────────────────

function ApprovalRulesSection() {
    const [rules, setRules]         = useState<ApprovalRule[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError]         = useState<string | null>(null);
    const [adding, setAdding]       = useState(false);
    const [draft, setDraft]         = useState<Omit<ApprovalRule, 'id'>>(EMPTY_RULE);
    const [editId, setEditId]       = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<ApprovalRule | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true); setError(null);
        try {
            const { data, error } = await supabase
                .from('item_approval_rules')
                .select('*')
                .order('sequential_stage_order');
            if (error) throw error;
            setRules((data ?? []) as ApprovalRule[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async () => {
        try {
            const { error } = await supabase.from('item_approval_rules').insert([draft]);
            if (error) throw error;
            setAdding(false);
            setDraft(EMPTY_RULE);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const handleSaveEdit = async () => {
        if (!editDraft) return;
        try {
            const { error } = await supabase.from('item_approval_rules').update(editDraft).eq('id', editDraft.id);
            if (error) throw error;
            setEditId(null);
            setEditDraft(null);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const handleDeactivate = async (id: string) => {
        try {
            const { error } = await supabase.from('item_approval_rules').update({ is_active: false }).eq('id', id);
            if (error) throw error;
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    return (
        <div className="bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Approval Rules</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Configures which approval stages fire based on request conditions.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} disabled={isLoading} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <RefreshCw size={14} className={isLoading ? 'animate-spin text-gray-400' : 'text-gray-500'} />
                    </button>
                    <button
                        onClick={() => setAdding(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-tranquil,#129DC0)] text-white text-xs font-medium rounded-xl hover:opacity-90"
                    >
                        <Plus size={13} /> Add Rule
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
                    <AlertCircle size={12} className="shrink-0" />{error}
                    <button className="ml-auto underline" onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-[#15171e] text-gray-500 uppercase tracking-wider">
                        <tr>
                            {['Rule Name', 'Condition', 'Value', 'Approver Type', 'Stage', 'SLA (h)', 'Active', ''].map(h => (
                                <th key={h} className="px-3 py-2 font-medium border-b border-gray-200 dark:border-gray-700">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                        {adding && (
                            <tr className="bg-amber-50/30 dark:bg-amber-900/10">
                                <td className="px-2 py-1.5"><input value={draft.rule_name} onChange={e => setDraft(p => ({ ...p, rule_name: e.target.value }))} className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200" placeholder="Rule name" /></td>
                                <td className="px-2 py-1.5">
                                    <select value={draft.condition_type} onChange={e => setDraft(p => ({ ...p, condition_type: e.target.value as ConditionType }))} className="border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                                        {CONDITION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </td>
                                <td className="px-2 py-1.5"><input value={draft.condition_value ?? ''} onChange={e => setDraft(p => ({ ...p, condition_value: e.target.value || null }))} className="w-24 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200" placeholder="e.g. 20" /></td>
                                <td className="px-2 py-1.5">
                                    <select value={draft.approver_type} onChange={e => setDraft(p => ({ ...p, approver_type: e.target.value as ApproverType }))} className="border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                                        {APPROVER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </td>
                                <td className="px-2 py-1.5"><input type="number" value={draft.sequential_stage_order} onChange={e => setDraft(p => ({ ...p, sequential_stage_order: parseInt(e.target.value) || 1 }))} className="w-14 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200" /></td>
                                <td className="px-2 py-1.5"><input type="number" value={draft.sla_hours} onChange={e => setDraft(p => ({ ...p, sla_hours: parseInt(e.target.value) || 48 }))} className="w-14 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200" /></td>
                                <td className="px-2 py-1.5 text-center text-emerald-600">Yes</td>
                                <td className="px-2 py-1.5">
                                    <div className="flex items-center gap-1">
                                        <button onClick={handleAdd} className="p-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600"><Check size={13} /></button>
                                        <button onClick={() => { setAdding(false); setDraft(EMPTY_RULE); }} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><X size={13} /></button>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {rules.map(rule => (
                            editId === rule.id && editDraft ? (
                                <tr key={rule.id} className="bg-blue-50/30 dark:bg-blue-900/10">
                                    <td className="px-2 py-1.5"><input value={editDraft.rule_name} onChange={e => setEditDraft(p => p ? { ...p, rule_name: e.target.value } : p)} className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200" /></td>
                                    <td className="px-2 py-1.5">
                                        <select value={editDraft.condition_type} onChange={e => setEditDraft(p => p ? { ...p, condition_type: e.target.value as ConditionType } : p)} className="border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                                            {CONDITION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-2 py-1.5"><input value={editDraft.condition_value ?? ''} onChange={e => setEditDraft(p => p ? { ...p, condition_value: e.target.value || null } : p)} className="w-24 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200" /></td>
                                    <td className="px-2 py-1.5">
                                        <select value={editDraft.approver_type} onChange={e => setEditDraft(p => p ? { ...p, approver_type: e.target.value as ApproverType } : p)} className="border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                                            {APPROVER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-2 py-1.5"><input type="number" value={editDraft.sequential_stage_order} onChange={e => setEditDraft(p => p ? { ...p, sequential_stage_order: parseInt(e.target.value) || 1 } : p)} className="w-14 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200" /></td>
                                    <td className="px-2 py-1.5"><input type="number" value={editDraft.sla_hours} onChange={e => setEditDraft(p => p ? { ...p, sla_hours: parseInt(e.target.value) || 48 } : p)} className="w-14 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200" /></td>
                                    <td className="px-2 py-1.5 text-center">{editDraft.is_active ? <span className="text-emerald-600">Yes</span> : <span className="text-gray-400">No</span>}</td>
                                    <td className="px-2 py-1.5">
                                        <div className="flex items-center gap-1">
                                            <button onClick={handleSaveEdit} className="p-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600"><Check size={13} /></button>
                                            <button onClick={() => { setEditId(null); setEditDraft(null); }} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><X size={13} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                <tr key={rule.id} className={`hover:bg-gray-50/50 dark:hover:bg-white/5 ${!rule.is_active ? 'opacity-40' : ''}`}>
                                    <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">{rule.rule_name}</td>
                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 font-mono">{rule.condition_type}</td>
                                    <td className="px-3 py-2 text-gray-500 dark:text-gray-500">{rule.condition_value ?? '—'}</td>
                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{rule.approver_type}</td>
                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-center">{rule.sequential_stage_order}</td>
                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-center">{rule.sla_hours}</td>
                                    <td className="px-3 py-2 text-center">{rule.is_active ? <span className="text-emerald-600">Yes</span> : <span className="text-gray-400">No</span>}</td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => { setEditId(rule.id); setEditDraft({ ...rule }); }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"><Edit2 size={12} /></button>
                                            {rule.is_active && (
                                                <button onClick={() => handleDeactivate(rule.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400"><Trash2 size={12} /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        ))}
                        {rules.length === 0 && !adding && !isLoading && (
                            <tr>
                                <td colSpan={8} className="px-3 py-6 text-center text-gray-400 text-xs">No rules configured. Add a rule to define approval routing.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Section: SKU Code Maps ────────────────────────────────────────────────────

function SkuCodeMapsSection() {
    const [codes, setCodes]         = useState<SkuCodeMap[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError]         = useState<string | null>(null);
    const [adding, setAdding]       = useState(false);
    const [draft, setDraft]         = useState({ option_type: 'CATEGORY_CODE', option_value: '', display_label: '' });

    const load = useCallback(async () => {
        setIsLoading(true); setError(null);
        try {
            const { data, error } = await supabase
                .from('attribute_options')
                .select('id, option_type, option_value, display_label, is_active')
                .in('option_type', ['CATEGORY_CODE', 'PRODUCT_TYPE_CODE'])
                .order('option_type')
                .order('option_value');
            if (error) throw error;
            setCodes((data ?? []) as SkuCodeMap[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async () => {
        if (!draft.option_value || !draft.display_label) return;
        try {
            const { error } = await supabase.from('attribute_options').insert([{ ...draft, is_active: true }]);
            if (error) throw error;
            setAdding(false);
            setDraft({ option_type: 'CATEGORY_CODE', option_value: '', display_label: '' });
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const handleToggle = async (id: string, current: boolean) => {
        try {
            const { error } = await supabase.from('attribute_options').update({ is_active: !current }).eq('id', id);
            if (error) throw error;
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    return (
        <div className="bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">SKU Code Maps</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Category and product type codes used in automated SKU generation.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} disabled={isLoading} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <RefreshCw size={14} className={isLoading ? 'animate-spin text-gray-400' : 'text-gray-500'} />
                    </button>
                    <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-tranquil,#129DC0)] text-white text-xs font-medium rounded-xl hover:opacity-90">
                        <Plus size={13} /> Add Code
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
                    <AlertCircle size={12} className="shrink-0" />{error}
                    <button className="ml-auto underline" onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-[#15171e] text-gray-500 uppercase tracking-wider">
                        <tr>
                            {['Code Value', 'Display Label', 'Type', 'Active', ''].map(h => (
                                <th key={h} className="px-3 py-2 font-medium border-b border-gray-200 dark:border-gray-700">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                        {adding && (
                            <tr className="bg-amber-50/30 dark:bg-amber-900/10">
                                <td className="px-2 py-1.5"><input value={draft.option_value} onChange={e => setDraft(p => ({ ...p, option_value: e.target.value.toUpperCase() }))} placeholder="e.g. BED" className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-mono" /></td>
                                <td className="px-2 py-1.5"><input value={draft.display_label} onChange={e => setDraft(p => ({ ...p, display_label: e.target.value }))} placeholder="e.g. Bed Linen" className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200" /></td>
                                <td className="px-2 py-1.5">
                                    <select value={draft.option_type} onChange={e => setDraft(p => ({ ...p, option_type: e.target.value }))} className="border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                                        <option value="CATEGORY_CODE">CATEGORY_CODE</option>
                                        <option value="PRODUCT_TYPE_CODE">PRODUCT_TYPE_CODE</option>
                                    </select>
                                </td>
                                <td className="px-2 py-1.5 text-emerald-600 text-center">Yes</td>
                                <td className="px-2 py-1.5">
                                    <div className="flex items-center gap-1">
                                        <button onClick={handleAdd} className="p-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600"><Check size={13} /></button>
                                        <button onClick={() => { setAdding(false); setDraft({ option_type: 'CATEGORY_CODE', option_value: '', display_label: '' }); }} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><X size={13} /></button>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {codes.map(code => (
                            <tr key={code.id} className={`hover:bg-gray-50/50 dark:hover:bg-white/5 ${!code.is_active ? 'opacity-40' : ''}`}>
                                <td className="px-3 py-2 font-mono font-bold text-gray-800 dark:text-gray-200">{code.option_value}</td>
                                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{code.display_label}</td>
                                <td className="px-3 py-2 text-gray-500 dark:text-gray-500 text-xs">{code.option_type}</td>
                                <td className="px-3 py-2 text-center">
                                    <button
                                        onClick={() => handleToggle(code.id, code.is_active)}
                                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${code.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
                                    >
                                        {code.is_active ? 'Active' : 'Inactive'}
                                    </button>
                                </td>
                                <td className="px-3 py-2"></td>
                            </tr>
                        ))}
                        {codes.length === 0 && !adding && !isLoading && (
                            <tr>
                                <td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-xs">No SKU codes found. Add category or product type codes to enable SKU generation.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ItemCreationSettings() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Item Creation</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Configure margin thresholds, approval routing rules, and SKU code maps.</p>
            </div>
            <MarginThresholdsSection />
            <ApprovalRulesSection />
            <SkuCodeMapsSection />
        </div>
    );
}
