import { supabase } from '../lib/supabaseClient';
import { ItemSellPrice, SellPriceType, ItemPurchasePrice } from '../types';


export async function getCostBasisForItem(itemId: string): Promise<number> {
  // Get preferred supplier landed_cost ONLY — not purchase price detail
  const { data } = await supabase
    .from('item_purchase_prices')
    .select('landed_cost')
    .eq('item_id', itemId)
    .eq('is_preferred_supplier', true)
    .eq('status', 'ACTIVE')
    .lte('effective_from', new Date().toISOString().split('T')[0])
    .single();
  return data?.landed_cost ?? 0;
}

export async function createSellPrice(input: {
  item_id: string;
  price_type: SellPriceType;
  customer_id?: string;
  customer_group_id?: string;
  contract_id?: string;
  // customer_reference removed — column was not included in item_sell_prices (P02)
  sale_uom: string;
  sell_price_ex_gst: number;
  tax_code: string;
  cost_basis: number;
  publish_to_salesforce: boolean;
  publish_to_bundle: boolean;
  publish_to_linenhub: boolean;
  effective_from: string;
  effective_to?: string;
  notes?: string;
}): Promise<ItemSellPrice> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('item_sell_prices')
    .insert({ ...input, status: 'PENDING_APPROVAL', created_by: user?.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ItemSellPrice;
}

export async function getSellPricesForItem(itemId: string): Promise<ItemSellPrice[]> {
  const { data, error } = await supabase
    .from('item_sell_prices')
    .select('*')
    .eq('item_id', itemId)
    .order('price_type', { ascending: true })
    .order('effective_from', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ItemSellPrice[];
}

export async function getMarginThreshold(): Promise<number> {
  const { data } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'margin_approval_threshold')
    .single();
  
  // value is jsonb in DB, so data?.value might be the number directly if it was stored as one,
  // or a string if it was "25". Based on the prompt, it uses parseFloat(data?.value ?? '25')
  if (typeof data?.value === 'number') return data.value;
  return parseFloat(data?.value ?? '25');
}

export async function getPriceVersionHistory(itemId: string): Promise<{
  purchasePrices: ItemPurchasePrice[];
  sellPrices: ItemSellPrice[];
}> {
  const [purchaseResult, sellResult] = await Promise.all([
    supabase.from('item_purchase_prices').select('*, suppliers(name)')
      .eq('item_id', itemId).order('effective_from', { ascending: false }),
    supabase.from('item_sell_prices').select('*')
      .eq('item_id', itemId).order('price_type').order('effective_from', { ascending: false })
  ]);
  return {
    purchasePrices: (purchaseResult.data ?? []) as unknown as ItemPurchasePrice[],
    sellPrices: (sellResult.data ?? []) as ItemSellPrice[]
  };
}

export async function getFuturePriceChanges(): Promise<Array<{
  price_record_id: string; item_id: string; sku: string; item_name: string;
  price_type: string; future_price: number; effective_from: string; days_until_effective: number; margin_percent: number;
}>> {
  if (import.meta.env.VITE_QA_MODE === '1') {
    return [
      {
        price_record_id: 'spr-future-1', item_id: 'i1', sku: 'GT-SHEET-K', item_name: 'Premium Cotton Sheet (King)',
        price_type: 'STANDARD', future_price: 62.00, effective_from: '2026-06-01', days_until_effective: 27, margin_percent: 33.5
      }
    ];
  }

  const { data, error } = await supabase.from('v_future_price_changes').select('*');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCurrentPricesTable(filters?: {
  category?: string;
  priceType?: string;
  searchSku?: string;
}): Promise<Array<{
  item_id: string; sku: string; name: string; category: string;
  price_type: string; sell_price_ex_gst: number; margin_percent: number;
  effective_from: string; effective_to: string | null;
  publish_to_bundle: boolean; publish_to_linenhub: boolean; publish_to_salesforce: boolean;
  sell_price_record_id: string;
}>> {
  if (import.meta.env.VITE_QA_MODE === '1') {
    return [
      {
        item_id: 'i1', sku: 'GT-SHEET-K', name: 'Premium Cotton Sheet (King)', category: 'Textiles',
        price_type: 'STANDARD', sell_price_ex_gst: 58.50, margin_percent: 30.0,
        effective_from: '2023-01-01', effective_to: null,
        publish_to_bundle: true, publish_to_linenhub: true, publish_to_salesforce: true,
        sell_price_record_id: 'spr-1'
      },
      {
        item_id: 'i2', sku: 'GT-TOWEL-W', name: 'Bath Towel - White', category: 'Textiles',
        price_type: 'STANDARD', sell_price_ex_gst: 18.20, margin_percent: 31.4,
        effective_from: '2023-01-01', effective_to: null,
        publish_to_bundle: true, publish_to_linenhub: true, publish_to_salesforce: true,
        sell_price_record_id: 'spr-2'
      },
      {
        item_id: 'i3', sku: 'HS-NAP-2PLY', name: 'Napkins 2-Ply (Pack 100)', category: 'Consumables',
        price_type: 'CONTRACT', sell_price_ex_gst: 10.50, margin_percent: 21.4,
        effective_from: '2023-05-01', effective_to: '2024-05-01',
        publish_to_bundle: false, publish_to_linenhub: true, publish_to_salesforce: false,
        sell_price_record_id: 'spr-3'
      }
    ].filter(p => {
      if (filters?.category && p.category !== filters.category) return false;
      if (filters?.priceType && p.price_type !== filters.priceType) return false;
      if (filters?.searchSku && !p.sku.toLowerCase().includes(filters.searchSku.toLowerCase()) && !p.name.toLowerCase().includes(filters.searchSku.toLowerCase())) return false;
      return true;
    });
  }

  let query = supabase
    .from('v_current_item_prices')
    .select('*');

  if (filters?.category) query = query.eq('category', filters.category);
  if (filters?.priceType) query = query.eq('price_type', filters.priceType);
  if (filters?.searchSku) query = query.or(`sku.ilike.%${filters.searchSku}%,item_name.ilike.%${filters.searchSku}%`);

  const { data, error } = await query.order('item_name');
  if (error) throw new Error(error.message);
  return (data ?? []) as any[];
}

export async function getDistinctCategories(): Promise<string[]> {
  const { data } = await supabase.from('items').select('category').eq('active_flag', true);
  return [...new Set((data ?? []).map((r: any) => r.category).filter(Boolean))].sort();
}

export async function updateSellPriceStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('item_sell_prices')
    .update({ status })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function resolveItemPriceForPO(itemId: string): Promise<{ price: number, recordId?: string }> {
    const { data, error } = await supabase.rpc('resolve_item_price', { 
        p_item_id: itemId 
    });

    if (!error && data && data.length > 0) {
        // RPC returns a single row or empty array
        // resolve_item_price returns sell_price_ex_gst (not unit_price)
        const record = data[0];
        return {
            price: Number(record.sell_price_ex_gst),
            recordId: record.price_record_id
        };
    }

    // Fallback logic: read from legacy items table
    const { data: item, error: itemError } = await supabase
        .from('items')
        .select('unit_price')
        .eq('id', itemId)
        .single();

    if (itemError || !item) {
        console.warn(`Price resolution fallback failed for item ${itemId}:`, itemError);
        return { price: 0, recordId: undefined };
    }

    return {
        price: Number(item.unit_price || 0),
        recordId: undefined
    };
}

export async function isItemPriceGoverned(itemId: string): Promise<boolean> {
  const [flagResult, priceResult] = await Promise.all([
    supabase.from('app_config').select('value').eq('key', 'legacy_item_editing_locked').single(),
    supabase.from('item_sell_prices').select('id').eq('item_id', itemId)
      .eq('status', 'ACTIVE').limit(1)
  ]);

  // value is jsonb, prompt suggests it might be string 'true'
  const flagEnabled = flagResult.data?.value === true || flagResult.data?.value === 'true';
  const hasActivePrice = (priceResult.data?.length ?? 0) > 0;
  return flagEnabled && hasActivePrice;
}
