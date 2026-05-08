/**
 * ProcureFlow Item Lifecycle Integration Test
 * Run: npx ts-node scripts/test_item_lifecycle.ts
 * 
 * Tests: Full item lifecycle from request to active publication.
 * Cleans up after itself (all test data is rolled back or deleted).
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEST_PREFIX = '__TEST__';
let testRequestId: string | null = null;
let testItemId: string | null = null;
let testPurchasePriceId: string | null = null;
let testSellPriceId: string | null = null;

async function log(step: string, result: 'PASS' | 'FAIL' | 'INFO', detail?: string) {
  const icon = result === 'PASS' ? '✓' : result === 'FAIL' ? '✗' : 'ℹ';
  console.log(`${icon} [${result}] ${step}${detail ? ': ' + detail : ''}`);
  if (result === 'FAIL') process.exitCode = 1;
}

async function cleanup() {
  console.log('\n--- CLEANUP ---');
  try {
    if (testSellPriceId) await supabase.from('item_sell_prices').delete().eq('id', testSellPriceId);
    if (testPurchasePriceId) await supabase.from('item_purchase_prices').delete().eq('id', testPurchasePriceId);
    if (testItemId) {
      await supabase.from('item_sell_prices').delete().eq('item_id', testItemId);
      await supabase.from('item_purchase_prices').delete().eq('item_id', testItemId);
      await supabase.from('items').delete().eq('id', testItemId);
    }
    if (testRequestId) {
      await supabase.from('item_approval_instances').delete().eq('request_id', testRequestId);
      await supabase.from('item_duplicate_checks').delete().eq('request_id', testRequestId);
      await supabase.from('item_requests').delete().eq('id', testRequestId);
    }
    console.log('✓ Cleanup complete');
  } catch (err) {
    console.error('✗ Cleanup failed:', err);
  }
}

async function runTests() {
  console.log('=== ProcureFlow Item Lifecycle Integration Tests ===\n');

  try {
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const testUserId = users?.[0]?.id || '00000000-0000-0000-0000-000000000000';

    // T01: Create item_request
    const { data: req, error: reqError } = await supabase.from('item_requests').insert({
      request_type: 'PURCHASE_AND_SALE',
      requestor_id: testUserId,
      item_description: `${TEST_PREFIX} Integration test item`,
      business_reason: `Automated integration test`,
      target_bundle: true,
      target_sap: true,
      status: 'DRAFT',
    }).select().single();
    testRequestId = req?.id || null;
    await log('T01: Create item_request', reqError ? 'FAIL' : 'PASS', reqError?.message || `Request # ${req?.request_number}`);

    // T02: Request number format
    const validFormat = /^IR-\d{4}-\d{4}$/.test(req?.request_number || '');
    await log('T02: Request number format (IR-YYYY-NNNN)', validFormat ? 'PASS' : 'FAIL', req?.request_number);

    // T03: Advance to SUBMITTED
    const { error: submitError } = await supabase.from('item_requests').update({ status: 'SUBMITTED' }).eq('id', testRequestId!);
    await log('T03: Advance to SUBMITTED', submitError ? 'FAIL' : 'PASS', submitError?.message);

    // T04: Duplicate check auto-created
    const { data: dupCheck } = await supabase.from('item_duplicate_checks').select('*').eq('request_id', testRequestId!).single();
    await log('T04: item_duplicate_checks record auto-created', dupCheck ? 'PASS' : 'FAIL');

    // T05: Set duplicate check outcome
    const { error: dupError } = await supabase.from('item_duplicate_checks').update({ outcome: 'NO_DUPLICATE', performed_by: testUserId }).eq('request_id', testRequestId!);
    await log('T05: Set duplicate check outcome', dupError ? 'FAIL' : 'PASS', dupError?.message);

    // T06: Duplicate check auto-locked
    const { data: lockedCheck } = await supabase.from('item_duplicate_checks').select('is_locked').eq('request_id', testRequestId!).single();
    await log('T06: Duplicate check auto-locked', lockedCheck?.is_locked ? 'PASS' : 'FAIL');

    // T07: Attempt to modify locked check (must fail)
    const { error: lockViolation } = await supabase.from('item_duplicate_checks').update({ outcome: 'USE_EXISTING' }).eq('request_id', testRequestId!);
    await log('T07: Locked check rejects modification', lockViolation ? 'PASS' : 'FAIL', lockViolation ? 'Correctly blocked' : 'ERROR: modification allowed');

    // T08: Create item (Stage 3)
    const { data: newItem, error: itemError } = await supabase.from('items').insert({
      sku: `${TEST_PREFIX}-SKU-001`,
      name: `${TEST_PREFIX} Integration Test Item`,
      category: 'TEST',
      unit_price: 0,
      uom: 'EA',
      active_flag: true,
      workflow_status: 'DATA_REVIEW',
      current_request_id: testRequestId!,
    }).select().single();
    testItemId = newItem?.id || null;
    await log('T08: Create item (Stage 3)', itemError ? 'FAIL' : 'PASS', itemError?.message || `Item ID: ${newItem?.id}`);

    // T09: Create purchase price
    const suppliers = await supabase.from('suppliers').select('id').limit(1);
    const supplierId = suppliers.data?.[0]?.id;
    const { data: pp, error: ppError } = await supabase.from('item_purchase_prices').insert({
      item_id: testItemId!,
      supplier_id: supplierId,
      purchase_price_ex_gst: 8.50,
      purchase_uom: 'EA',
      is_preferred_supplier: true,
      effective_from: '2026-01-01',
      status: 'ACTIVE',
    }).select().single();
    testPurchasePriceId = pp?.id || null;
    await log('T09: Create purchase price', ppError ? 'FAIL' : 'PASS', ppError?.message || `Landed cost: $${pp?.landed_cost}`);

    // T10: Create sell price
    const { data: sp, error: spError } = await supabase.from('item_sell_prices').insert({
      item_id: testItemId!,
      price_type: 'STANDARD',
      sale_uom: 'EA',
      sell_price_ex_gst: 12.00,
      tax_code: 'GST',
      cost_basis: 8.50,
      effective_from: '2026-01-01',
      status: 'ACTIVE',
      publish_to_bundle: true,
    }).select().single();
    testSellPriceId = sp?.id || null;
    await log('T10: Create sell price', spError ? 'FAIL' : 'PASS', spError?.message || `Price: $${sp?.sell_price_ex_gst}`);

    // T11: Margin calculation
    const expectedMargin = ((12.00 - 8.50) / 12.00 * 100).toFixed(4);
    const actualMargin = parseFloat(sp?.margin_percent || '0').toFixed(4);
    await log('T11: Margin calculation', expectedMargin === actualMargin ? 'PASS' : 'FAIL', `Expected ${expectedMargin}%, got ${actualMargin}%`);

    // T12: resolve_item_price function
    const { data: resolvedPrice } = await supabase.rpc('resolve_item_price', { p_item_id: testItemId!, p_customer_id: null, p_as_of_date: '2026-06-01' });
    await log('T12: resolve_item_price returns active sell price', (resolvedPrice?.length ?? 0) > 0 ? 'PASS' : 'FAIL', resolvedPrice?.[0]?.sell_price_ex_gst);

    // T13: check_item_completeness
    const { data: completeness } = await supabase.rpc('check_item_completeness', { p_item_id: testItemId! });
    await log('T13: check_item_completeness executes', completeness ? 'PASS' : 'FAIL', completeness ? `${completeness.passed_checks}/${completeness.total_checks}` : 'Failed');

    // T14: Date overlap constraint
    const { error: overlapError } = await supabase.from('item_sell_prices').insert({
      item_id: testItemId!,
      price_type: 'STANDARD',
      sale_uom: 'EA',
      sell_price_ex_gst: 15.00,
      tax_code: 'GST',
      cost_basis: 8.50,
      effective_from: '2026-03-01',
      status: 'ACTIVE',
    });
    await log('T14: Date overlap constraint blocks duplicate ACTIVE price', overlapError ? 'PASS' : 'FAIL', overlapError ? 'Blocked' : 'Allowed');

    // T15: Approval engine evaluation
    const { data: approvalRules } = await supabase.rpc('evaluate_item_approval_rules', { p_request_id: testRequestId! });
    await log('T15: evaluate_item_approval_rules returns rules', (approvalRules?.length ?? 0) > 0 ? 'PASS' : 'FAIL', `${approvalRules?.length} rules`);

    // T16: items.unit_price sync trigger
    const { data: itemAfter } = await supabase.from('items').select('unit_price').eq('id', testItemId!).single();
    await log('T16: items.unit_price synced from STANDARD sell price', itemAfter?.unit_price === 12.00 ? 'PASS' : 'FAIL', `$${itemAfter?.unit_price}`);

    // T17: Immutability (SUPERSEDED sell price)
    await supabase.from('item_sell_prices').update({ status: 'SUPERSEDED' }).eq('id', testSellPriceId!);
    const { error: immutableError } = await supabase.from('item_sell_prices').update({ sell_price_ex_gst: 99.99 }).eq('id', testSellPriceId!);
    await log('T17: SUPERSEDED sell price is immutable', immutableError ? 'PASS' : 'FAIL', immutableError ? 'Blocked' : 'Allowed');

    console.log('\n=== TEST SUMMARY ===');
  } catch (err: any) {
    console.error('Test execution error:', err.message);
  } finally {
    await cleanup();
  }
}

runTests().catch(async (err) => {
  console.error('Test runner error:', err);
  await cleanup();
  process.exit(1);
});
