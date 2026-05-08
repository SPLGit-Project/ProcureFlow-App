import { supabase } from '../lib/supabaseClient';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ColourOption {
  id: string;
  label: string;
  code: string;
  pattern_type: 'solid' | 'stripe';
  primary_hex: string;
  secondary_hex?: string | null;
  stripe_angle: number;
  stripe_width: number;
  is_active: boolean;
  sort_order: number;
}

export type ColourOptionInsert = Omit<ColourOption, 'id'>;

// Sentinel "Other" entry — not stored in DB, appended in-memory at load time
export const COLOUR_OTHER: ColourOption = {
  id: '__other__',
  label: 'Other',
  code: '',
  pattern_type: 'solid',
  primary_hex: '#E0E0E0',
  secondary_hex: null,
  stripe_angle: 45,
  stripe_width: 50,
  is_active: true,
  sort_order: 9999,
};

// ── CSS helper ─────────────────────────────────────────────────────────────────

/**
 * Returns an inline style object that renders the correct pattern for a colour
 * (solid fill or repeating diagonal stripe).
 */
export function colourSwatchStyle(c: ColourOption): React.CSSProperties {
  if (c.pattern_type === 'stripe' && c.secondary_hex) {
    const bandPx = 20;
    const pxA = Math.max(1, Math.round((c.stripe_width / 100) * bandPx));
    const pxB = Math.max(1, bandPx - pxA);
    return {
      background: `repeating-linear-gradient(
        ${c.stripe_angle}deg,
        ${c.primary_hex} 0px,
        ${c.primary_hex} ${pxA}px,
        ${c.secondary_hex} ${pxA}px,
        ${c.secondary_hex} ${pxA + pxB}px
      )`,
    };
  }
  return { backgroundColor: c.primary_hex };
}

// ── Data access ────────────────────────────────────────────────────────────────

/** Fetch all active colours sorted by sort_order, with "Other" appended */
export async function getActiveColours(): Promise<ColourOption[]> {
  const { data, error } = await supabase
    .from('colour_options')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return [...(data as ColourOption[]), COLOUR_OTHER];
}

/** Fetch all colours (including inactive) for admin management */
export async function getAllColours(): Promise<ColourOption[]> {
  const { data, error } = await supabase
    .from('colour_options')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data as ColourOption[];
}

export async function createColour(payload: ColourOptionInsert): Promise<ColourOption> {
  const { data, error } = await supabase
    .from('colour_options')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data as ColourOption;
}

export async function updateColour(id: string, patch: Partial<ColourOptionInsert>): Promise<ColourOption> {
  const { data, error } = await supabase
    .from('colour_options')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ColourOption;
}

export async function deleteColour(id: string): Promise<void> {
  const { error } = await supabase
    .from('colour_options')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
