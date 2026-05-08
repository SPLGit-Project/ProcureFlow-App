import { supabase } from '../lib/supabaseClient';

export interface CompletenessResult {
  results: Array<{ field: string; required_for: string; passed: boolean }>;
  total_checks: number;
  passed_checks: number;
  failed_checks: number;
  is_complete: boolean;
}

export async function runCompletenessCheck(itemId: string): Promise<CompletenessResult> {
  const { data, error } = await supabase.rpc('check_item_completeness', { p_item_id: itemId });
  if (error) throw new Error(error.message);

  // Store the result in item_completeness_checks
  const result = data as CompletenessResult;
  const { data: { user } } = await supabase.auth.getUser();

  await supabase.from('item_completeness_checks').insert({
    item_id: itemId,
    check_results: result.results,
    total_checks: result.total_checks,
    passed_checks: result.passed_checks,
    failed_checks: result.failed_checks,
    failing_fields: result.results.filter(r => !r.passed).map(r => r.field),
    checked_by: user?.id,
  });

  return result;
}

export async function triggerPublication(requestId: string, itemId: string): Promise<void> {
  // Get item to determine which systems are targeted
  const { data: item } = await supabase.from('items').select('*').eq('id', itemId).single();
  const { data: request } = await supabase.from('item_requests').select('*').eq('id', requestId).single();
  if (!item || !request) throw new Error('Item or request not found');

  // Get the current active sell prices for this item
  const { data: sellPrices } = await supabase
    .from('item_sell_prices')
    .select('*')
    .eq('item_id', itemId)
    .eq('status', 'ACTIVE');

  const targets: Array<'BUNDLE' | 'LINENHUB' | 'SALESFORCE' | 'SAP'> = [];
  if (request.target_bundle) targets.push('BUNDLE');
  if (request.target_linenhub) targets.push('LINENHUB');
  if (request.target_salesforce) targets.push('SALESFORCE');
  if (request.target_sap) targets.push('SAP');

  // Create publication event for each target
  const events = targets.map(target => ({
    correlation_id: requestId,
    item_id: itemId,
    target_system: target,
    event_type: 'ItemPublished',
    payload: {
      item_id: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category,
      uom: item.uom,
      weight: item.item_weight,
      rfid_flag: item.rfid_flag,
      sell_prices: (sellPrices ?? []).map(p => ({
        price_type: p.price_type,
        sell_price_ex_gst: p.sell_price_ex_gst,
        effective_from: p.effective_from,
        effective_to: p.effective_to,
        tax_code: p.tax_code,
      })),
      published_at: new Date().toISOString(),
    },
    status: 'QUEUED',
  }));

  if (events.length > 0) {
    const { error } = await supabase.from('item_publication_events').insert(events);
    if (error) throw new Error(error.message);
  }

  // Transition item and request to ACTIVE
  await supabase.from('items')
    .update({ workflow_status: 'ACTIVE', last_published_at: new Date().toISOString() })
    .eq('id', itemId);

  await supabase.from('item_requests')
    .update({ status: 'ACTIVE' })
    .eq('id', requestId);
}

export async function getPublicationStatus(itemId: string) {
  const { data } = await supabase
    .from('item_publication_events')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function retryFailedEvent(eventId: string) {
  const { error } = await supabase
    .from('item_publication_events')
    .update({ status: 'QUEUED', error_message: null, dispatched_at: null })
    .eq('id', eventId);
  if (error) throw new Error(error.message);
}
