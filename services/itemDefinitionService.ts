import { supabase } from '../lib/supabaseClient';
import { normalizeItemCode } from '../utils/normalization';
import { transitionRequest } from './itemWorkflowService';
import { ItemRequestType } from '../types';

// ── Classification hierarchy ───────────────────────────────────────────────────

export interface ClassificationOptions {
  itemPools: string[];
  itemCatalogs: Record<string, string[]>;      // pool → catalogs
  itemTypes: Record<string, string[]>;         // catalog → types
  categories: Record<string, string[]>;        // type → categories
  subCategories: Record<string, string[]>;     // category → sub-categories
}

/**
 * Loads distinct classification values from the items table to drive the
 * cascading dropdowns in Step 1 of the Item Definition Wizard.
 * Results are cached for the page session.
 */
let _classificationCache: ClassificationOptions | null = null;

export async function getClassificationOptions(): Promise<ClassificationOptions> {
  if (_classificationCache) return _classificationCache;

  const { data, error } = await supabase
    .from('items')
    .select('item_pool, item_catalog, item_type, category, sub_category')
    .eq('active_flag', true)
    .not('item_pool', 'is', null);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    item_pool: string | null;
    item_catalog: string | null;
    item_type: string | null;
    category: string | null;
    sub_category: string | null;
  }>;

  const pools = new Set<string>();
  const catalogs: Record<string, Set<string>> = {};
  const types: Record<string, Set<string>> = {};
  const categories: Record<string, Set<string>> = {};
  const subCategories: Record<string, Set<string>> = {};

  for (const row of rows) {
    const pool = row.item_pool;
    const catalog = row.item_catalog;
    const type = row.item_type;
    const cat = row.category;
    const sub = row.sub_category;

    if (!pool) continue;
    pools.add(pool);

    if (catalog) {
      if (!catalogs[pool]) catalogs[pool] = new Set();
      catalogs[pool].add(catalog);
    }
    if (type && catalog) {
      if (!types[catalog]) types[catalog] = new Set();
      types[catalog].add(type);
    }
    if (cat && type) {
      if (!categories[type]) categories[type] = new Set();
      categories[type].add(cat);
    }
    if (sub && cat) {
      if (!subCategories[cat]) subCategories[cat] = new Set();
      subCategories[cat].add(sub);
    }
  }

  _classificationCache = {
    itemPools: [...pools].sort(),
    itemCatalogs: Object.fromEntries(Object.entries(catalogs).map(([k, v]) => [k, [...v].sort()])),
    itemTypes: Object.fromEntries(Object.entries(types).map(([k, v]) => [k, [...v].sort()])),
    categories: Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, [...v].sort()])),
    subCategories: Object.fromEntries(Object.entries(subCategories).map(([k, v]) => [k, [...v].sort()])),
  };

  return _classificationCache;
}

// ── SAP code helpers ───────────────────────────────────────────────────────────

export interface SapCodeCheckResult {
  normalized: string;
  alternate: string | null;
  isDuplicate: boolean;
  existingItemName?: string;
}

/**
 * Normalizes the SAP code and checks if it already exists in items.
 */
export async function checkSapCode(rawCode: string): Promise<SapCodeCheckResult> {
  const { normalized, alternate } = normalizeItemCode(rawCode);

  if (!normalized) {
    return { normalized: '', alternate: null, isDuplicate: false };
  }

  const { data } = await supabase
    .from('items')
    .select('id, name')
    .or(`sap_item_code_norm.eq.${normalized}${alternate ? `,sap_item_code_norm.eq.${alternate}` : ''}`)
    .limit(1)
    .maybeSingle();

  return {
    normalized,
    alternate,
    isDuplicate: !!data,
    existingItemName: data?.name,
  };
}

// ── Item definition payload ────────────────────────────────────────────────────

export interface ItemDefinitionPayload {
  // Classification
  item_pool: string;
  item_catalog: string;
  item_type: string;
  category: string;
  sub_category: string;
  // Identity
  sap_item_code_raw: string;
  sap_item_code_norm: string;
  name: string;          // display name (≤40 chars)
  short_name: string;    // human-readable search name (≤60 chars)
  description: string;   // full description
  division: string;
  // Physical
  uom: string;
  upq: number | null;
  item_weight: number | null;
  item_size: string;
  item_colour: string;
  item_material: string;
  gsm: number | null;
  // Flags
  purchase_enabled: boolean;
  sale_enabled: boolean;
  target_bundle: boolean;
  target_linenhub: boolean;
  target_salesforce: boolean;
  rfid_flag: boolean;
  cog_flag: boolean;
  cog_customer: string;
  // Stock
  min_level: number | null;
  max_level: number | null;
  initial_stock_qty: number | null;
}

/**
 * Determines which next status to transition to based on the request type and
 * whether pricing is required (purchase or sale enabled).
 */
function nextStatusAfterDefinition(
  requestType: ItemRequestType,
  purchaseEnabled: boolean,
  saleEnabled: boolean
): 'PRICING_REVIEW' | 'APPROVAL_PENDING' {
  // Types that never need pricing review
  const noPrice: ItemRequestType[] = ['COG', 'BUNDLE_LINENHUB_ONLY'];
  if (noPrice.includes(requestType)) return 'APPROVAL_PENDING';
  if (purchaseEnabled || saleEnabled) return 'PRICING_REVIEW';
  return 'APPROVAL_PENDING';
}

/**
 * Inserts the defined item into the items table, links it to the request, and
 * advances the request to PRICING_REVIEW or APPROVAL_PENDING.
 */
export async function saveItemDefinition(
  payload: ItemDefinitionPayload,
  requestId: string,
  requestType: ItemRequestType
): Promise<{ itemId: string; nextStatus: 'PRICING_REVIEW' | 'APPROVAL_PENDING' }> {
  const itemId = crypto.randomUUID();
  const now = new Date().toISOString();

  const { error: insertError } = await supabase.from('items').insert({
    id: itemId,
    sku: payload.sap_item_code_raw,
    name: payload.name,
    short_name: payload.short_name || payload.name,
    description: payload.description,
    uom: payload.uom,
    upq: payload.upq ?? 1,
    category: payload.category,
    sub_category: payload.sub_category,
    sap_item_code_raw: payload.sap_item_code_raw,
    sap_item_code_norm: payload.sap_item_code_norm,
    item_pool: payload.item_pool,
    item_catalog: payload.item_catalog,
    item_type: payload.item_type,
    item_weight: payload.item_weight,
    item_size: payload.item_size,
    item_colour: payload.item_colour,
    item_material: payload.item_material,
    rfid_flag: payload.rfid_flag,
    cog_flag: payload.cog_flag,
    cog_customer: payload.cog_customer || null,
    min_level: payload.min_level,
    max_level: payload.max_level,
    unit_price: 0, // Set by pricing wizard
    stock_level: payload.initial_stock_qty ?? 0,
    active_flag: false, // Not active until approved
    created_at: now,
    updated_at: now,
    specs: {
      gsm: payload.gsm,
      division: payload.division,
      purchase_enabled: payload.purchase_enabled,
      sale_enabled: payload.sale_enabled,
      target_bundle: payload.target_bundle,
      target_linenhub: payload.target_linenhub,
      target_salesforce: payload.target_salesforce,
    },
  });

  if (insertError) throw new Error(insertError.message);

  // Link item to request
  const { error: linkError } = await supabase
    .from('item_requests')
    .update({ resulting_item_id: itemId })
    .eq('id', requestId);

  if (linkError) throw new Error(linkError.message);

  // Advance workflow
  const nextStatus = nextStatusAfterDefinition(
    requestType,
    payload.purchase_enabled,
    payload.sale_enabled
  );

  await transitionRequest(requestId, nextStatus, {
    metadata: { item_id: itemId, action: 'ITEM_DEFINED' },
  });

  return { itemId, nextStatus };
}
