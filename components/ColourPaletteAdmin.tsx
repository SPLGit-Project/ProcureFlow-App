import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Loader2, Palette, PencilLine, Plus, Trash2, X } from 'lucide-react';
import { useToast, ToastContainer } from './ToastNotification';
import PageHeader from './PageHeader';
import {
  ColourOption,
  ColourOptionInsert,
  colourSwatchStyle,
  createColour,
  deleteColour,
  getAllColours,
  updateColour,
} from '../services/colourService';

// ── Empty form state ──────────────────────────────────────────────────────────

const EMPTY_FORM: ColourOptionInsert = {
  label: '',
  code: '',
  pattern_type: 'solid',
  primary_hex: '#CCCCCC',
  secondary_hex: null,
  stripe_angle: 45,
  stripe_width: 50,
  is_active: true,
  sort_order: 0,
};

// ── Swatch preview component ──────────────────────────────────────────────────

function Swatch({
  colour,
  size = 'md',
}: {
  colour: Pick<ColourOption, 'pattern_type' | 'primary_hex' | 'secondary_hex' | 'stripe_angle' | 'stripe_width'>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dim = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-16 h-16' : 'w-8 h-8';
  const round = size === 'lg' ? 'rounded-xl' : 'rounded-full';
  return (
    <div
      className={`${dim} ${round} border border-gray-200 dark:border-gray-700 shrink-0`}
      style={colourSwatchStyle(colour as ColourOption)}
    />
  );
}

// ── Colour form (add / edit panel) ───────────────────────────────────────────

interface ColourFormProps {
  initial: ColourOptionInsert;
  onSave: (form: ColourOptionInsert) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  isNew: boolean;
}

function ColourForm({ initial, onSave, onCancel, isSaving, isNew }: ColourFormProps) {
  const [form, setForm] = useState<ColourOptionInsert>(initial);
  const set = (patch: Partial<ColourOptionInsert>) => setForm(f => ({ ...f, ...patch }));

  const isStripe = form.pattern_type === 'stripe';
  const preview: ColourOption = { id: '__preview__', ...form, secondary_hex: form.secondary_hex ?? null };

  return (
    <div className="bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-2xl p-6 space-y-5">
      <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">
        {isNew ? 'Add New Colour' : 'Edit Colour'}
      </h3>

      {/* Live preview */}
      <div className="flex items-center gap-4 p-4 bg-white dark:bg-nocturne border border-gray-100 dark:border-gray-800 rounded-xl">
        <Swatch colour={preview} size="lg" />
        <div>
          <p className="font-bold text-gray-900 dark:text-white">{form.label || 'Preview'}</p>
          <p className="font-mono text-xs text-gray-400">{form.code || '—'}</p>
          <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-widest">{form.pattern_type}</p>
        </div>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Label */}
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            Colour Name <span className="text-red-500">*</span>
          </label>
          <input
            value={form.label}
            onChange={e => set({ label: e.target.value })}
            placeholder="e.g. Dusty Rose"
            className="w-full bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
          />
        </div>

        {/* Code */}
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            SKU Code (2–4 chars) <span className="text-red-500">*</span>
          </label>
          <input
            value={form.code}
            onChange={e => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) })}
            placeholder="e.g. DR"
            className="w-full bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
          />
        </div>

        {/* Sort order */}
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Sort Order</label>
          <input
            type="number"
            value={form.sort_order}
            onChange={e => set({ sort_order: Number(e.target.value) })}
            className="w-full bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
          />
        </div>

        {/* Active */}
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Status</label>
          <button
            type="button"
            onClick={() => set({ is_active: !form.is_active })}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${
              form.is_active
                ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-gray-50 dark:bg-nocturne border-gray-200 dark:border-gray-700 text-gray-400'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.is_active ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'}`}>
              {form.is_active && <Check size={10} className="text-white" strokeWidth={3} />}
            </div>
            {form.is_active ? 'Active' : 'Inactive'}
          </button>
        </div>
      </div>

      {/* Pattern type */}
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Pattern</label>
        <div className="flex gap-3">
          {(['solid', 'stripe'] as const).map(pt => (
            <button
              key={pt}
              type="button"
              onClick={() => set({ pattern_type: pt })}
              className={`flex-1 py-2.5 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${
                form.pattern_type === pt
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 text-[var(--color-brand)]'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 bg-white dark:bg-nocturne'
              }`}
            >
              {pt}
            </button>
          ))}
        </div>
      </div>

      {/* Colour pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            {isStripe ? 'Primary Colour' : 'Colour'}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.primary_hex}
              onChange={e => set({ primary_hex: e.target.value })}
              className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer p-0.5 bg-white dark:bg-nocturne"
            />
            <input
              value={form.primary_hex}
              onChange={e => set({ primary_hex: e.target.value })}
              placeholder="#RRGGBB"
              className="flex-1 bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
            />
          </div>
        </div>

        {isStripe && (
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Secondary Colour</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.secondary_hex ?? '#FFFFFF'}
                onChange={e => set({ secondary_hex: e.target.value })}
                className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer p-0.5 bg-white dark:bg-nocturne"
              />
              <input
                value={form.secondary_hex ?? ''}
                onChange={e => set({ secondary_hex: e.target.value || null })}
                placeholder="#RRGGBB"
                className="flex-1 bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Stripe controls */}
      {isStripe && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              Stripe Angle — {form.stripe_angle}°
            </label>
            <input
              type="range" min={0} max={180} step={5}
              value={form.stripe_angle}
              onChange={e => set({ stripe_angle: Number(e.target.value) })}
              className="w-full accent-[var(--color-brand)]"
            />
            <div className="flex justify-between text-[9px] text-gray-400">
              <span>0° (→)</span><span>45° (↗)</span><span>90° (↑)</span><span>135° (↖)</span><span>180° (←)</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              Primary Band Width — {form.stripe_width}%
            </label>
            <input
              type="range" min={10} max={90} step={5}
              value={form.stripe_width}
              onChange={e => set({ stripe_width: Number(e.target.value) })}
              className="w-full accent-[var(--color-brand)]"
            />
            <div className="flex justify-between text-[9px] text-gray-400">
              <span>Thin</span><span>Even</span><span>Wide</span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={isSaving || !form.label.trim() || !form.code.trim()}
          className="flex-[2] py-3 rounded-xl bg-[var(--color-brand)] text-white text-xs font-black uppercase tracking-widest shadow-md shadow-[var(--color-brand)]/20 hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSaving ? <><Loader2 size={13} className="animate-spin" />Saving…</> : <><Check size={13} />{isNew ? 'Add Colour' : 'Save Changes'}</>}
        </button>
      </div>
    </div>
  );
}

// ── Main admin panel ──────────────────────────────────────────────────────────

type EditTarget = { mode: 'new' } | { mode: 'edit'; colour: ColourOption } | null;

const ColourPaletteAdmin: React.FC = () => {
  const { toasts, dismissToast, success, error } = useToast();
  const [colours, setColours] = useState<ColourOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await getAllColours();
      setColours(data);
    } catch (err) {
      error('Failed to load colour palette.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (form: ColourOptionInsert) => {
    setIsSaving(true);
    try {
      if (editTarget?.mode === 'edit') {
        await updateColour(editTarget.colour.id, form);
        success(`"${form.label}" updated.`);
      } else {
        await createColour(form);
        success(`"${form.label}" added to palette.`);
      }
      setEditTarget(null);
      await load();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to save colour.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (colour: ColourOption) => {
    if (!confirm(`Delete "${colour.label}" from the palette? This cannot be undone.`)) return;
    try {
      await deleteColour(colour.id);
      success(`"${colour.label}" deleted.`);
      await load();
    } catch (err) {
      error('Failed to delete colour.');
    }
  };

  const handleToggleActive = async (colour: ColourOption) => {
    try {
      await updateColour(colour.id, { is_active: !colour.is_active });
      await load();
    } catch {
      error('Failed to update status.');
    }
  };

  return (
    <>
      <div className="space-y-8 animate-page-entry max-w-4xl mx-auto">
        <PageHeader
          title="Colour Palette"
          subtitle="Manage the master list of item colours, including custom stripe patterns."
        />

        {/* Add button */}
        <div className="flex justify-end">
          <button
            onClick={() => setEditTarget({ mode: 'new' })}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-brand)] text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-md shadow-[var(--color-brand)]/20 hover:opacity-90 transition-all"
          >
            <Plus size={15} /> Add Colour
          </button>
        </div>

        {/* Add form */}
        {editTarget?.mode === 'new' && (
          <ColourForm
            initial={{ ...EMPTY_FORM, sort_order: colours.length + 1 }}
            onSave={handleSave}
            onCancel={() => setEditTarget(null)}
            isSaving={isSaving}
            isNew
          />
        )}

        {/* Colour list */}
        <div className="bg-white dark:bg-nocturne border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5 grid grid-cols-[2rem_1fr_5rem_6rem_6rem_5rem] gap-4 items-center">
            {['', 'Colour', 'Code', 'Pattern', 'Status', ''].map((h, i) => (
              <span key={i} className="text-[10px] font-black uppercase tracking-widest text-gray-400">{h}</span>
            ))}
          </div>

          {isLoading ? (
            <div className="p-8 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-50 dark:bg-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : colours.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <Palette size={40} className="mb-4 opacity-20" />
              <p className="text-sm font-bold">No colours configured yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {colours.map(colour => (
                <React.Fragment key={colour.id}>
                  <div
                    className={`px-6 py-4 grid grid-cols-[2rem_1fr_5rem_6rem_6rem_5rem] gap-4 items-center hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors ${!colour.is_active ? 'opacity-50' : ''}`}
                  >
                    <Swatch colour={colour} size="sm" />

                    <div>
                      <p className="font-bold text-sm text-gray-900 dark:text-white">{colour.label}</p>
                      <p className="text-[10px] text-gray-400">{colour.primary_hex}{colour.secondary_hex ? ` + ${colour.secondary_hex}` : ''}</p>
                    </div>

                    <span className="font-mono text-xs font-bold text-gray-500">{colour.code || '—'}</span>

                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg w-fit ${
                      colour.pattern_type === 'stripe'
                        ? 'bg-purple-50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400'
                        : 'bg-gray-100 dark:bg-white/10 text-gray-500'
                    }`}>
                      {colour.pattern_type}
                    </span>

                    <button
                      onClick={() => handleToggleActive(colour)}
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg w-fit transition-all ${
                        colour.is_active
                          ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 hover:bg-emerald-100'
                          : 'bg-gray-100 dark:bg-white/10 text-gray-400 hover:bg-gray-200'
                      }`}
                      title={colour.is_active ? 'Click to deactivate' : 'Click to activate'}
                    >
                      {colour.is_active ? 'Active' : 'Inactive'}
                    </button>

                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => setEditTarget({ mode: 'edit', colour })}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 transition-all"
                        title="Edit"
                      >
                        <PencilLine size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(colour)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Inline edit form */}
                  {editTarget?.mode === 'edit' && editTarget.colour.id === colour.id && (
                    <div className="px-6 py-4 bg-gray-50/50 dark:bg-white/5">
                      <ColourForm
                        initial={{
                          label: colour.label,
                          code: colour.code,
                          pattern_type: colour.pattern_type,
                          primary_hex: colour.primary_hex,
                          secondary_hex: colour.secondary_hex ?? null,
                          stripe_angle: colour.stripe_angle,
                          stripe_width: colour.stripe_width,
                          is_active: colour.is_active,
                          sort_order: colour.sort_order,
                        }}
                        onSave={handleSave}
                        onCancel={() => setEditTarget(null)}
                        isSaving={isSaving}
                        isNew={false}
                      />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Info note */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
          <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Changes to the palette take effect immediately for all new item requests.
            Deactivated colours remain visible on existing requests but are hidden from the selection grid.
          </p>
        </div>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
};

export default ColourPaletteAdmin;
