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
const simbaFiles = [
  path.join(reportDir, 'SPL Accommodation SOH and Stock on order Report 11.5.2026.xlsx'),
  path.join(reportDir, 'extracted_28052026', 'SPL Accommodation SOH and Stock on order Report 25.5.2026.xlsx'),
  path.join(reportDir, 'extracted_28052026', 'SPL Healthcare SOH and Stock on Order Report 25.5.2026.xlsx'),
  path.join(reportDir, 'SPL SOH and Stock On Order Reports (SIMBA) -- Accommodation and Healthcare - 02_06_2026', 'SPL Accommodation SOH and Stock on Order Report 1.6.2026.xlsx'),
  path.join(reportDir, 'SPL SOH and Stock On Order Reports (SIMBA) -- Accommodation and Healthcare - 02_06_2026', 'SPL Healthcare SOH and Stock on Order Report1.6.2026.xlsx')
].filter((file) => fs.existsSync(file));

function extractSimbaRows(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const rows = [];

  workbook.SheetNames.forEach((sheetName) => {
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
    const headerIndex = matrix.findIndex((row, index) => {
      const normalized = row.map(normalizeText);
      const lowerRows = matrix.slice(index + 1, index + 4).flat().map(normalizeText);
      return normalized.includes('sku') && normalized.includes('product') && (normalized.includes('spl item code') || lowerRows.includes('spl item code'));
    });

    if (headerIndex < 0) return;
    const header = matrix[headerIndex].map((value) => normalizeText(value));
    let dataStartIndex = headerIndex + 1;
    for (let i = headerIndex + 1; i < Math.min(matrix.length, headerIndex + 4); i++) {
      let mergedAny = false;
      matrix[i].forEach((value, colIndex) => {
        const normalized = normalizeText(value);
        if (!normalized) return;
        if (header[colIndex]) return;
        if (['spl item code', 'spl product description', 'spl catergory', 'category', 'sub category'].includes(normalized)) {
          header[colIndex] = normalized;
          mergedAny = true;
        }
      });
      if (mergedAny) dataStartIndex = i + 1;
    }

    const skuIndex = header.indexOf('sku');
    const productIndex = header.indexOf('product');
    const splCodeIndex = header.indexOf('spl item code');
    const splDescriptionIndex = header.indexOf('spl product description');
    if (skuIndex < 0 || productIndex < 0 || splCodeIndex < 0) return;

    for (let i = dataStartIndex; i < matrix.length; i++) {
      const row = matrix[i];
      const supplierSku = String(row[skuIndex] || '').trim();
      const productName = String(row[productIndex] || '').trim();
      const splItemCode = String(row[splCodeIndex] || '').trim();
      const splProductDescription = splDescriptionIndex >= 0 ? String(row[splDescriptionIndex] || '').trim() : '';

      if (!supplierSku || !productName || !splItemCode) continue;
      if (/^(sku|total|division\/location)$/i.test(supplierSku)) continue;

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

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Simba files found: ${simbaFiles.length}`);

  const supplierRows = await fetchAll('suppliers', 'id,name');
  const simbaSuppliers = supplierRows.filter((supplier) => /simba/i.test(supplier.name || ''));
  if (!simbaSuppliers.length) throw new Error('No supplier containing "Simba" was found.');
  console.log(`Simba suppliers: ${simbaSuppliers.map((supplier) => `${supplier.name} (${supplier.id})`).join(', ')}`);

  const simbaSupplierIds = new Set(simbaSuppliers.map((supplier) => supplier.id));
  const [items, poRequests, poLines, existingMappings] = await Promise.all([
    fetchAll('items', 'id,sku,name,description,category,sub_category,sap_item_code_norm,active_flag'),
    fetchAll('po_requests', 'id,display_id,supplier_id,request_date,status', (query) => query.in('supplier_id', Array.from(simbaSupplierIds))),
    fetchAll('po_lines', 'id,po_request_id,item_id,sku,item_name,quantity_ordered'),
    fetchAll('supplier_product_map', 'id,supplier_id,supplier_sku,supplier_customer_stock_code,product_id,mapping_status,manual_override,mapping_method')
  ]);

  const simbaPoIds = new Set(poRequests.map((po) => po.id));
  const simbaPoLines = poLines.filter((line) => simbaPoIds.has(line.po_request_id));
  const simbaItemIds = new Set(simbaPoLines.map((line) => line.item_id).filter(Boolean));
  const simbaHistoricalSkuCodes = new Set(simbaPoLines.flatMap((line) => [normalizeCode(line.sku), normalizeCode(line.item_name)]).filter(Boolean));
  console.log(`Historical Simba POs: ${poRequests.length}`);
  console.log(`Historical Simba PO lines: ${simbaPoLines.length}`);
  console.log(`Historical Simba unique item ids: ${simbaItemIds.size}`);

  const itemsByCode = new Map();
  items.forEach((item) => {
    const codes = new Set([normalizeCode(item.sku), normalizeCode(item.sap_item_code_norm)].filter(Boolean));
    codes.forEach((code) => {
      if (!itemsByCode.has(code)) itemsByCode.set(code, []);
      itemsByCode.get(code).push(item);
    });
  });

  const rows = simbaFiles.flatMap(extractSimbaRows);
  const rowsBySupplierSku = new Map();
  rows.forEach((row) => {
    const key = row.supplierSku;
    if (!rowsBySupplierSku.has(key)) rowsBySupplierSku.set(key, row);
  });
  const uniqueRows = Array.from(rowsBySupplierSku.values());
  console.log(`Simba supplier rows parsed: ${rows.length} (${uniqueRows.length} unique supplier SKUs)`);

  const existingBySupplierSku = new Map();
  existingMappings
    .filter((mapping) => simbaSupplierIds.has(mapping.supplier_id))
    .forEach((mapping) => existingBySupplierSku.set(`${mapping.supplier_id}:${mapping.supplier_sku}`, mapping));

  const candidates = [];
  const rejected = [];

  uniqueRows.forEach((row) => {
    const matchedItems = itemsByCode.get(row.normalizedSplItemCode) || [];
    const uniqueMatchedIds = new Set(matchedItems.map((item) => item.id));
    if (uniqueMatchedIds.size !== 1) {
      rejected.push({ ...row, reason: uniqueMatchedIds.size === 0 ? 'No internal item code match' : 'Multiple internal item code matches' });
      return;
    }

    const item = matchedItems[0];
    const seenInHistory = simbaItemIds.has(item.id) || simbaHistoricalSkuCodes.has(row.normalizedSplItemCode);
    if (!seenInHistory) {
      rejected.push({ ...row, itemSku: item.sku, itemName: item.name, reason: 'Code match found, but item was not seen in Simba historical PO lines' });
      return;
    }

    const descriptionScore = Math.max(
      tokenOverlap(row.productName, item.name),
      tokenOverlap(row.splProductDescription, item.name),
      tokenOverlap(row.productName, `${item.name} ${item.description || ''}`)
    );

    const supplier = simbaSuppliers[0];
    const existing = existingBySupplierSku.get(`${supplier.id}:${row.supplierSku}`);
    if (existing?.manual_override || existing?.mapping_status === 'REJECTED') {
      rejected.push({ ...row, itemSku: item.sku, itemName: item.name, reason: 'Existing manual override/not-mapped decision' });
      return;
    }
    if (existing?.mapping_status === 'CONFIRMED' && existing.product_id !== item.id) {
      rejected.push({ ...row, itemSku: item.sku, itemName: item.name, reason: 'Existing confirmed mapping points to a different item' });
      return;
    }

    candidates.push({
      supplier_id: supplier.id,
      product_id: item.id,
      supplier_sku: row.supplierSku,
      supplier_customer_stock_code: row.splItemCode,
      mapping_status: 'CONFIRMED',
      mapping_method: 'HISTORICAL_PO_SPL_CODE',
      confidence_score: 1,
      manual_override: false,
      mapping_justification: {
        components: [
          { type: 'SPL_ITEM_CODE_MATCH', score: 1, detail: `SPL item code ${row.splItemCode} matched internal item code ${item.sku}` },
          { type: 'HISTORICAL_SIMBA_PO', score: 1, detail: 'Internal item was ordered historically from Simba' },
          { type: 'SUPPLIER_FILE_EVIDENCE', score: Number(descriptionScore.toFixed(2)), detail: `${row.sourceFile}: ${row.productName}` }
        ]
      },
      updated_at: new Date().toISOString(),
      audit: {
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
  const upserts = Array.from(deduped.values());

  console.log(`Confirmed mapping candidates: ${upserts.length}`);
  console.log(`Rejected/exception rows: ${rejected.length}`);
  console.log('Top candidates:');
  upserts.slice(0, 25).forEach((candidate) => {
    console.log(`  ${candidate.supplier_sku} -> ${candidate.audit.itemSku} | ${candidate.audit.itemName} | SPL ${candidate.supplier_customer_stock_code}`);
  });

  const report = {
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
    generatedAt: new Date().toISOString(),
    simbaSuppliers,
    counts: {
      files: simbaFiles.length,
      historicalPos: poRequests.length,
      historicalPoLines: simbaPoLines.length,
      parsedRows: rows.length,
      uniqueSupplierSkus: uniqueRows.length,
      confirmedCandidates: upserts.length,
      rejectedRows: rejected.length
    },
    candidates: upserts,
    rejected: rejected.slice(0, 500)
  };

  const outputDir = path.join(process.cwd(), 'tmp');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'simba_mapping_seed_report.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`Report written: ${outputPath}`);

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
  console.log(`Upserted ${payload.length} confirmed Simba mappings.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
