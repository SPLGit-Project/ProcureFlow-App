/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env.production.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://yasosgkznoxamysutxfc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const APPLY = process.env.APPLY === '1';

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const normalizeCode = (input) => String(input || '').trim().toUpperCase().replace(/[\s\-_]/g, '');
const normalizeText = (input) => String(input || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (input) => normalizeText(input).split(' ').filter((token) => token.length > 2);
const tokenOverlap = (left, right) => {
  const a = new Set(tokens(left));
  const b = tokens(right);
  if (!a.size || !b.length) return 0;
  return b.filter((token) => a.has(token)).length / Math.max(a.size, b.length);
};

const reportDir = path.join(process.cwd(), 'docs', 'Supplier Reports');
const supplierConfigs = [
  {
    key: 'HOST',
    supplierPattern: /host/i,
    method: 'HISTORICAL_PO_HOST_SPL_CODE',
    codeLabel: 'SPL Part ID',
    files: [
      path.join(reportDir, 'HOST SOH REPORT - 01.06.2026.xlsx'),
      path.join(reportDir, 'extracted_28052026', 'HOST STOCKLIST - 25-05-2026.xlsx')
    ],
    parse(filePath) {
      return extractHostRows(filePath);
    }
  },
  {
    key: 'Frenkel',
    supplierPattern: /frenkel/i,
    method: 'HISTORICAL_PO_FRENKEL_SPL_CODE',
    codeLabel: 'SPL Code',
    files: [
      path.join(reportDir, 'SPL Weekly Inventory 01.06.2026.xlsx'),
      path.join(reportDir, 'extracted_28052026', 'Weekly Inventory SOH 25.05.2026.xlsx')
    ],
    parse(filePath) {
      return extractRowsByHeader(filePath, {
        supplierSkuHeaders: ['item code'],
        productHeaders: ['product description'],
        splCodeHeaders: ['spl code'],
        splDescriptionHeaders: ['spl product description'],
        minRequired: ['supplierSku', 'productName', 'splItemCode']
      });
    }
  }
].map((config) => ({ ...config, files: config.files.filter((file) => fs.existsSync(file)) }));

function headerMatches(header, candidates) {
  const normalized = normalizeText(header);
  return candidates.some((candidate) => normalized === candidate);
}

function extractRowsByHeader(filePath, config) {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const rows = [];

  workbook.SheetNames.forEach((sheetName) => {
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
    const headerIndex = matrix.findIndex((row) => {
      const normalized = row.map(normalizeText);
      return normalized.some((header) => headerMatches(header, config.supplierSkuHeaders))
        && normalized.some((header) => headerMatches(header, config.splCodeHeaders));
    });
    if (headerIndex < 0) return;

    const header = matrix[headerIndex].map(normalizeText);
    const indexFor = (headers) => header.findIndex((entry) => headerMatches(entry, headers));
    const supplierSkuIndex = indexFor(config.supplierSkuHeaders);
    const productIndex = indexFor(config.productHeaders);
    const splCodeIndex = indexFor(config.splCodeHeaders);
    const splDescriptionIndex = config.splDescriptionHeaders ? indexFor(config.splDescriptionHeaders) : -1;
    if (supplierSkuIndex < 0 || productIndex < 0 || splCodeIndex < 0) return;

    for (let i = headerIndex + 1; i < matrix.length; i++) {
      const row = matrix[i];
      const supplierSku = String(row[supplierSkuIndex] || '').trim();
      const productName = String(row[productIndex] || '').trim();
      const splItemCode = String(row[splCodeIndex] || '').trim();
      const splProductDescription = splDescriptionIndex >= 0 ? String(row[splDescriptionIndex] || '').trim() : '';

      if (!supplierSku || !productName || !splItemCode) continue;
      if (/^(sku|item code|total)$/i.test(supplierSku)) continue;

      rows.push({
        sourceFile: path.basename(filePath),
        sheetName,
        supplierSku,
        productName,
        splItemCode,
        splProductDescription,
        normalizedSplItemCode: normalizeCode(splItemCode)
      });
    }
  });

  return rows;
}

function extractHostRows(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const rows = [];

  workbook.SheetNames.forEach((sheetName) => {
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
    const headerIndex = matrix.findIndex((row) => {
      const normalized = row.map(normalizeText);
      return normalized.includes('spl part id') && normalized.includes('supplier part id');
    });
    if (headerIndex < 0) return;

    const header = matrix[headerIndex].map(normalizeText);
    const splCodeIndex = header.indexOf('spl part id');
    const supplierSkuIndex = header.indexOf('supplier part id');
    const productIndex = splCodeIndex >= 0 && supplierSkuIndex > splCodeIndex ? splCodeIndex + 1 : 1;
    if (supplierSkuIndex < 0 || splCodeIndex < 0) return;

    for (let i = headerIndex + 1; i < matrix.length; i++) {
      const row = matrix[i];
      const supplierSku = String(row[supplierSkuIndex] || '').trim();
      const productName = String(row[productIndex] || '').trim();
      const splItemCode = String(row[splCodeIndex] || '').trim();

      if (!supplierSku || !productName || !splItemCode) continue;
      if (/^(supplier part id|total)$/i.test(supplierSku)) continue;

      rows.push({
        sourceFile: path.basename(filePath),
        sheetName,
        supplierSku,
        productName,
        splItemCode,
        splProductDescription: '',
        normalizedSplItemCode: normalizeCode(splItemCode)
      });
    }
  });

  return rows;
}

async function fetchAll(table, select, modify = (query) => query) {
  const pageSize = 1000;
  let from = 0;
  const out = [];
  while (true) {
    const query = modify(supabase.from(table).select(select).range(from, from + pageSize - 1));
    const { data, error } = await query;
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

function mappingId(supplierId, supplierSku) {
  return crypto.createHash('sha1').update(`${supplierId}:${supplierSku}`).digest('hex').slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*/, '$1-$2-$3-$4-$5');
}

function chooseCanonicalSupplier(suppliers, poRequests) {
  const counts = new Map();
  poRequests.forEach((po) => counts.set(po.supplier_id, (counts.get(po.supplier_id) || 0) + 1));
  return [...suppliers].sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0))[0];
}

async function analyzeSupplier(config, common) {
  const matchingSuppliers = common.suppliers.filter((supplier) => config.supplierPattern.test(supplier.name || ''));
  if (!matchingSuppliers.length) {
    return { key: config.key, error: 'No matching supplier found', candidates: [], rejected: [] };
  }

  const matchingSupplierIds = new Set(matchingSuppliers.map((supplier) => supplier.id));
  const supplierPoRequests = common.poRequests.filter((po) => matchingSupplierIds.has(po.supplier_id));
  const canonicalSupplier = chooseCanonicalSupplier(matchingSuppliers, supplierPoRequests);
  const canonicalPoRequests = supplierPoRequests.filter((po) => po.supplier_id === canonicalSupplier.id);
  const canonicalPoIds = new Set(canonicalPoRequests.map((po) => po.id));
  const historicalLines = common.poLines.filter((line) => canonicalPoIds.has(line.po_request_id));
  const historicalItemIds = new Set(historicalLines.map((line) => line.item_id).filter(Boolean));
  const historicalCodes = new Set(historicalLines.flatMap((line) => [normalizeCode(line.sku), normalizeCode(line.item_name)]).filter(Boolean));

  const rows = config.files.flatMap(config.parse);
  const rowsBySupplierSku = new Map();
  rows.forEach((row) => {
    if (!rowsBySupplierSku.has(row.supplierSku)) rowsBySupplierSku.set(row.supplierSku, row);
  });
  const uniqueRows = Array.from(rowsBySupplierSku.values());
  const existingBySupplierSku = new Map();
  common.existingMappings
    .filter((mapping) => mapping.supplier_id === canonicalSupplier.id)
    .forEach((mapping) => existingBySupplierSku.set(mapping.supplier_sku, mapping));

  const candidates = [];
  const rejected = [];

  uniqueRows.forEach((row) => {
    const matchedItems = common.itemsByCode.get(row.normalizedSplItemCode) || [];
    const uniqueMatchedIds = new Set(matchedItems.map((item) => item.id));
    if (uniqueMatchedIds.size !== 1) {
      rejected.push({ ...row, reason: uniqueMatchedIds.size === 0 ? 'No internal item code match' : 'Multiple internal item code matches' });
      return;
    }

    const item = matchedItems[0];
    const seenInHistory = historicalItemIds.has(item.id) || historicalCodes.has(row.normalizedSplItemCode);
    if (!seenInHistory) {
      rejected.push({ ...row, itemSku: item.sku, itemName: item.name, reason: 'Code match found, but item was not seen in historical PO lines for this supplier' });
      return;
    }

    const existing = existingBySupplierSku.get(row.supplierSku);
    if (existing?.manual_override || existing?.mapping_status === 'REJECTED') {
      rejected.push({ ...row, itemSku: item.sku, itemName: item.name, reason: 'Existing manual override/not-mapped decision' });
      return;
    }
    if (existing?.mapping_status === 'CONFIRMED' && existing.product_id !== item.id) {
      rejected.push({ ...row, itemSku: item.sku, itemName: item.name, reason: 'Existing confirmed mapping points to a different item' });
      return;
    }

    const descriptionScore = Math.max(
      tokenOverlap(row.productName, item.name),
      tokenOverlap(row.splProductDescription, item.name),
      tokenOverlap(row.productName, `${item.name} ${item.description || ''}`)
    );

    candidates.push({
      supplier_id: canonicalSupplier.id,
      product_id: item.id,
      supplier_sku: row.supplierSku,
      supplier_customer_stock_code: row.splItemCode,
      mapping_status: 'CONFIRMED',
      mapping_method: config.method,
      confidence_score: 1,
      manual_override: false,
      mapping_justification: {
        components: [
          { type: 'SUPPLIER_SPL_CODE_MATCH', score: 1, detail: `${config.codeLabel} ${row.splItemCode} matched internal item code ${item.sku}` },
          { type: 'HISTORICAL_SUPPLIER_PO', score: 1, detail: `Internal item was ordered historically from ${canonicalSupplier.name}` },
          { type: 'SUPPLIER_FILE_EVIDENCE', score: Number(descriptionScore.toFixed(2)), detail: `${row.sourceFile}: ${row.productName}` }
        ]
      },
      updated_at: new Date().toISOString(),
      audit: {
        supplierName: canonicalSupplier.name,
        itemSku: item.sku,
        itemName: item.name,
        supplierProduct: row.productName,
        splProductDescription: row.splProductDescription,
        descriptionScore: Number(descriptionScore.toFixed(2)),
        sourceFile: row.sourceFile
      }
    });
  });

  const deduped = new Map();
  candidates.forEach((candidate) => deduped.set(candidate.supplier_sku, candidate));

  return {
    key: config.key,
    supplier: canonicalSupplier,
    duplicateSuppliers: matchingSuppliers,
    files: config.files,
    counts: {
      historicalPos: canonicalPoRequests.length,
      historicalPoLines: historicalLines.length,
      parsedRows: rows.length,
      uniqueSupplierSkus: uniqueRows.length,
      confirmedCandidates: deduped.size,
      rejectedRows: rejected.length
    },
    candidates: Array.from(deduped.values()),
    rejected
  };
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  const [suppliers, items, poRequests, poLines, existingMappings] = await Promise.all([
    fetchAll('suppliers', 'id,name'),
    fetchAll('items', 'id,sku,name,description,category,sub_category,sap_item_code_norm,active_flag'),
    fetchAll('po_requests', 'id,display_id,supplier_id,request_date,status'),
    fetchAll('po_lines', 'id,po_request_id,item_id,sku,item_name,quantity_ordered'),
    fetchAll('supplier_product_map', 'id,supplier_id,supplier_sku,supplier_customer_stock_code,product_id,mapping_status,manual_override,mapping_method')
  ]);

  const itemsByCode = new Map();
  items.forEach((item) => {
    const codes = new Set([normalizeCode(item.sku), normalizeCode(item.sap_item_code_norm)].filter(Boolean));
    codes.forEach((code) => {
      if (!itemsByCode.has(code)) itemsByCode.set(code, []);
      itemsByCode.get(code).push(item);
    });
  });

  const common = { suppliers, items, itemsByCode, poRequests, poLines, existingMappings };
  const results = [];

  for (const config of supplierConfigs) {
    const result = await analyzeSupplier(config, common);
    results.push(result);
    console.log(`\n${config.key}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
      continue;
    }
    console.log(`  Supplier: ${result.supplier.name} (${result.supplier.id})`);
    console.log(`  Files: ${result.files.length}`);
    console.log(`  Historical POs: ${result.counts.historicalPos}`);
    console.log(`  Historical PO lines: ${result.counts.historicalPoLines}`);
    console.log(`  Parsed rows: ${result.counts.parsedRows} (${result.counts.uniqueSupplierSkus} unique SKUs)`);
    console.log(`  Confirmed candidates: ${result.counts.confirmedCandidates}`);
    console.log(`  Exceptions: ${result.counts.rejectedRows}`);
    result.candidates.slice(0, 20).forEach((candidate) => {
      console.log(`    ${candidate.supplier_sku} -> ${candidate.audit.itemSku} | ${candidate.audit.itemName} | code ${candidate.supplier_customer_stock_code}`);
    });
  }

  const outputDir = path.join(process.cwd(), 'tmp');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'supplier_mapping_seed_report.json');
  fs.writeFileSync(outputPath, JSON.stringify({ mode: APPLY ? 'APPLY' : 'DRY_RUN', generatedAt: new Date().toISOString(), results }, null, 2));
  console.log(`\nReport written: ${outputPath}`);

  const upserts = results.flatMap((result) => result.candidates || []);
  if (!APPLY) {
    console.log('Dry run only. Re-run with APPLY=1 to upsert confirmed mappings.');
    return;
  }

  if (!upserts.length) {
    console.log('No mappings to upsert.');
    return;
  }

  const payload = upserts.map(({ audit, ...mapping }) => ({
    id: mappingId(mapping.supplier_id, mapping.supplier_sku),
    ...mapping
  }));

  const { error } = await supabase
    .from('supplier_product_map')
    .upsert(payload, { onConflict: 'supplier_id,supplier_sku' });

  if (error) throw error;
  console.log(`Upserted ${payload.length} confirmed mappings.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
