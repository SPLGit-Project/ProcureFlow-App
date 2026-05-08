import { supabase } from '../lib/supabaseClient';
import { ItemPurchasePrice } from '../types';

export interface CreatePurchasePriceInput {
  item_id: string;
  supplier_id: string;
  supplier_item_code?: string;
  purchase_price_ex_gst: number;
  currency?: string;
  purchase_uom: string;
  pack_conversion_factor?: number;
  moq?: number;
  lead_time_days?: number;
  freight_handling_cost?: number;
  is_preferred_supplier: boolean;
  effective_from: string;
  effective_to?: string;
  notes?: string;
}

export async function createPurchasePrice(input: CreatePurchasePriceInput): Promise<ItemPurchasePrice> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('item_purchase_prices')
    .insert({ ...input, status: 'PENDING_APPROVAL', created_by: user?.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ItemPurchasePrice;
}

export async function getPurchasePricesForItem(itemId: string): Promise<ItemPurchasePrice[]> {
  const { data, error } = await supabase
    .from('item_purchase_prices')
    .select('*, suppliers(name)')
    .eq('item_id', itemId)
    .order('effective_from', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ItemPurchasePrice[];
}

export async function setPreferredSupplier(priceId: string, itemId: string): Promise<void> {
  // Clear existing preferred on this item first
  await supabase.from('item_purchase_prices')
    .update({ is_preferred_supplier: false })
    .eq('item_id', itemId);
  // Set new preferred
  const { error } = await supabase.from('item_purchase_prices')
    .update({ is_preferred_supplier: true })
    .eq('id', priceId);
  if (error) throw new Error(error.message);
}

export async function checkDateOverlap(
  itemId: string, supplierId: string, uom: string,
  effectiveFrom: string, effectiveTo: string | null, excludeId?: string
): Promise<boolean> {
  let query = supabase
    .from('item_purchase_prices')
    .select('id')
    .eq('item_id', itemId)
    .eq('supplier_id', supplierId)
    .eq('purchase_uom', uom)
    .in('status', ['ACTIVE', 'APPROVED_FUTURE'])
    .lte('effective_from', effectiveTo ?? '9999-12-31');

  if (excludeId) query = query.neq('id', excludeId);
  
  // Note: This is a simplified check. The database has a GIST exclusion constraint 
  // which is more robust, but this provides immediate UI feedback.
  const { data } = await query;
  
  // We need to check if ANY existing record overlaps with the NEW record
  // New record: [new_from, new_to]
  // Existing record: [ext_from, ext_to]
  // Overlap if: new_from <= ext_to AND ext_from <= new_to
  
  if (!data) return false;
  
  // Actually, the above query already filtered by some conditions.
  // Let's just fetch all potential candidates and check overlaps in JS for simplicity or refine query.
  const { data: candidates } = await supabase
    .from('item_purchase_prices')
    .select('id, effective_from, effective_to')
    .eq('item_id', itemId)
    .eq('supplier_id', supplierId)
    .eq('purchase_uom', uom)
    .in('status', ['ACTIVE', 'APPROVED_FUTURE']);

  if (!candidates) return false;

  const newFrom = new Date(effectiveFrom).getTime();
  const newTo = effectiveTo ? new Date(effectiveTo).getTime() : new Date('9999-12-31').getTime();

  for (const cand of candidates) {
    if (excludeId && cand.id === excludeId) continue;
    
    const extFrom = new Date(cand.effective_from).getTime();
    const extTo = cand.effective_to ? new Date(cand.effective_to).getTime() : new Date('9999-12-31').getTime();
    
    if (newFrom <= extTo && extFrom <= newTo) {
      return true;
    }
  }

  return false;
}
