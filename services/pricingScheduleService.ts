import { supabase } from '../lib/supabaseClient';
import { PricingSchedule } from '../types';

export async function createPricingSchedule(input: {
  schedule_name: string;
  basis: 'CPI' | 'MWA' | 'BUSINESS_DECISION';
  basis_reference?: string;
  justification?: string;
  uplift_method: string;
  uplift_value: number;
  price_type_filter?: string[];
  item_category_filter?: string[];
  new_effective_from: string;
  rounding_rule?: string;
  minimum_margin_floor?: number;
}): Promise<PricingSchedule> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('pricing_schedules')
    .insert({ ...input, status: 'DRAFT', created_by: user?.id })
    .select().single();
  if (error) throw new Error(error.message);
  return data as PricingSchedule;
}

export async function previewPricingSchedule(scheduleId: string): Promise<{
  item_count: number;
  prices_to_create: number;
  flagged_count: number;
  sample: Array<{ sku: string; name: string; price_type: string; old_price: number; new_price: number; old_margin: number; new_margin: number }>;
}> {
  // Dry-run: fetch affected items and calculate new prices without writing
  const { data: schedule } = await supabase
    .from('pricing_schedules').select('*').eq('id', scheduleId).single();
  if (!schedule) throw new Error('Schedule not found');

  let query = supabase
    .from('item_sell_prices')
    .select('*, items!inner(sku, name, category)')
    .eq('status', 'ACTIVE');

  if (schedule.price_type_filter?.length) {
    query = query.in('price_type', schedule.price_type_filter);
  }
  if (schedule.item_category_filter?.length) {
    query = query.in('items.category', schedule.item_category_filter);
  }

  const { data: prices } = await query.limit(200);
  const affectedPrices = prices ?? [];

  const upliftFactor = schedule.uplift_method === 'PERCENTAGE_INCREASE'
    ? 1 + schedule.uplift_value / 100
    : schedule.uplift_method === 'PERCENTAGE_DECREASE'
      ? 1 - schedule.uplift_value / 100 : 1;

  const sample = affectedPrices.slice(0, 10).map((p: any) => {
    let newPrice = p.sell_price_ex_gst;
    if (schedule.uplift_method === 'PERCENTAGE_INCREASE' || schedule.uplift_method === 'PERCENTAGE_DECREASE') {
      newPrice = p.sell_price_ex_gst * upliftFactor;
    } else if (schedule.uplift_method === 'FIXED_AMOUNT_INCREASE') {
      newPrice = p.sell_price_ex_gst + schedule.uplift_value;
    } else if (schedule.uplift_method === 'FIXED_AMOUNT_DECREASE') {
      newPrice = Math.max(0, p.sell_price_ex_gst - schedule.uplift_value);
    } else if (schedule.uplift_method === 'REPLACE_WITH_NEW_PRICE') {
      newPrice = schedule.uplift_value;
    }

    // Apply rounding
    if (schedule.rounding_rule === 'ROUND_UP') {
      newPrice = Math.ceil(newPrice * 100) / 100;
    } else if (schedule.rounding_rule === 'NO_ROUNDING') {
      // Keep as is
    } else {
      newPrice = Math.round(newPrice * 100) / 100; // ROUND_TO_CENT
    }

    const newMargin = p.cost_basis > 0 ? ((newPrice - p.cost_basis) / newPrice * 100) : 100;
    return {
      sku: p.items?.sku,
      name: p.items?.name,
      price_type: p.price_type,
      old_price: p.sell_price_ex_gst,
      new_price: newPrice,
      old_margin: p.margin_percent,
      new_margin: Math.round(newMargin * 100) / 100,
    };
  });

  const flaggedCount = affectedPrices.filter((p: any) => {
    let newPrice = p.sell_price_ex_gst;
    if (schedule.uplift_method === 'PERCENTAGE_INCREASE' || schedule.uplift_method === 'PERCENTAGE_DECREASE') {
      newPrice = p.sell_price_ex_gst * upliftFactor;
    } else if (schedule.uplift_method === 'FIXED_AMOUNT_INCREASE') {
      newPrice = p.sell_price_ex_gst + schedule.uplift_value;
    } else if (schedule.uplift_method === 'FIXED_AMOUNT_DECREASE') {
      newPrice = Math.max(0, p.sell_price_ex_gst - schedule.uplift_value);
    } else if (schedule.uplift_method === 'REPLACE_WITH_NEW_PRICE') {
      newPrice = schedule.uplift_value;
    }

    // Apply rounding
    if (schedule.rounding_rule === 'ROUND_UP') {
      newPrice = Math.ceil(newPrice * 100) / 100;
    } else if (schedule.rounding_rule === 'NO_ROUNDING') {
      // Keep as is
    } else {
      newPrice = Math.round(newPrice * 100) / 100; // ROUND_TO_CENT
    }

    const newMargin = p.cost_basis > 0 ? ((newPrice - p.cost_basis) / newPrice * 100) : 100;
    return newMargin < (schedule.minimum_margin_floor ?? 25);
  }).length;

  // Update schedule with preview data
  await supabase.from('pricing_schedules').update({
    preview_item_count: affectedPrices.length,
    preview_prices_to_create: affectedPrices.length,
    preview_flagged_count: flaggedCount,
    preview_sample: sample,
  }).eq('id', scheduleId);

  return {
    item_count: affectedPrices.length,
    prices_to_create: affectedPrices.length,
    flagged_count: flaggedCount,
    sample,
  };
}

export async function submitScheduleForApproval(scheduleId: string): Promise<void> {
  const { error } = await supabase.from('pricing_schedules')
    .update({ status: 'PENDING_APPROVAL' }).eq('id', scheduleId);
  if (error) throw new Error(error.message);
}

export async function approvePricingSchedule(scheduleId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('pricing_schedules')
    .update({ status: 'APPROVED', approved_by: user?.id, approved_at: new Date().toISOString() })
    .eq('id', scheduleId);
  if (error) throw new Error(error.message);
}

export async function executePricingSchedule(scheduleId: string): Promise<{ prices_created: number; errors: number }> {
  // Populate schedule lines first, then execute
  const { data: schedule } = await supabase.from('pricing_schedules').select('*').eq('id', scheduleId).single();
  if (!schedule || schedule.status !== 'APPROVED') throw new Error('Schedule must be APPROVED to execute');

  // Build schedule lines
  let query = supabase.from('item_sell_prices').select('*').eq('status', 'ACTIVE');
  if (schedule.price_type_filter?.length) query = query.in('price_type', schedule.price_type_filter);

  const { data: prices } = await query;
  const lines = (prices ?? []).map((p: any) => {
    let newPrice = p.sell_price_ex_gst;
    if (schedule.uplift_method === 'PERCENTAGE_INCREASE') {
      newPrice = p.sell_price_ex_gst * (1 + schedule.uplift_value / 100);
    } else if (schedule.uplift_method === 'PERCENTAGE_DECREASE') {
      newPrice = p.sell_price_ex_gst * (1 - schedule.uplift_value / 100);
    } else if (schedule.uplift_method === 'FIXED_AMOUNT_INCREASE') {
      newPrice = p.sell_price_ex_gst + schedule.uplift_value;
    } else if (schedule.uplift_method === 'FIXED_AMOUNT_DECREASE') {
      newPrice = Math.max(0, p.sell_price_ex_gst - schedule.uplift_value);
    } else if (schedule.uplift_method === 'REPLACE_WITH_NEW_PRICE') {
      newPrice = schedule.uplift_value;
    }

    // Apply rounding
    if (schedule.rounding_rule === 'ROUND_UP') {
      newPrice = Math.ceil(newPrice * 100) / 100;
    } else if (schedule.rounding_rule === 'NO_ROUNDING') {
      // Keep as is
    } else {
      newPrice = Math.round(newPrice * 100) / 100; // ROUND_TO_CENT
    }

    return {
      schedule_id: scheduleId,
      item_id: p.item_id,
      sell_price_id: p.id,
      old_price: p.sell_price_ex_gst,
      calculated_new_price: newPrice,
      old_margin_percent: p.margin_percent,
    };
  });

  if (lines.length > 0) {
    const { error: insertError } = await supabase.from('pricing_schedule_lines').insert(lines);
    if (insertError) throw new Error(insertError.message);
  }

  // Execute via DB function
  const { data: result, error } = await supabase.rpc('execute_pricing_schedule', { p_schedule_id: scheduleId });
  if (error) throw new Error(error.message);

  return {
    prices_created: result?.[0]?.prices_created ?? 0,
    errors: result?.[0]?.errors_count ?? 0,
  };
}

export async function getPricingSchedules(): Promise<PricingSchedule[]> {
  if (import.meta.env.VITE_QA_MODE === '1') {
    return [
      {
        id: 'sch-1',
        schedule_name: 'FY26 Annual Uplift',
        status: 'DRAFT',
        basis: 'CPI',
        uplift_method: 'PERCENTAGE_INCREASE',
        uplift_value: 3.5,
        new_effective_from: '2026-07-01',
        created_at: new Date().toISOString(),
        created_by: 'qa-admin'
      },
      {
        id: 'sch-2',
        schedule_name: 'Mid-Year Contract Review',
        status: 'APPROVED',
        basis: 'BUSINESS_DECISION',
        uplift_method: 'PERCENTAGE_INCREASE',
        uplift_value: 2.0,
        new_effective_from: '2026-06-15',
        created_at: new Date().toISOString(),
        created_by: 'qa-admin',
        approved_at: new Date().toISOString(),
        approved_by: 'qa-admin'
      }
    ] as PricingSchedule[];
  }

  const { data, error } = await supabase.from('pricing_schedules')
    .select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PricingSchedule[];
}

export async function deletePricingSchedule(scheduleId: string): Promise<void> {
  const { error } = await supabase.from('pricing_schedules')
    .delete().eq('id', scheduleId).eq('status', 'DRAFT');
  if (error) throw new Error(error.message);
}
