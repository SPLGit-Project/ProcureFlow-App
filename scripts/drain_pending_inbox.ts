import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { normalizeItemCode } from '../utils/normalization.ts';

// Setup FileReader shim for Node
if (!globalThis.FileReader) {
  (globalThis as any).FileReader = class {
    onload: any = null;
    onerror: any = null;
    readAsArrayBuffer(file: any) {
      file.arrayBuffer().then((buf: ArrayBuffer) => {
        if (this.onload) this.onload({ target: { result: buf } });
      }).catch((err: any) => {
        if (this.onerror) this.onerror(err);
      });
    }
  };
}

const env: Record<string, string> = {};
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = match[2] || '';
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      env[match[1]] = val.trim();
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const SUPPLIER_IDS: Record<string, string> = {
  'HOST Supplies': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Frenkel Textiles': '4260a7a3-8eae-4c58-b135-2365e945d081',
  'Cy Linen Supply': '06a1818b-2651-4db4-a12d-6d05579f5b97',
  'NCC Apparel Pty Ltd': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'Simba Accommodation': 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'Simba Global - Accommodation': 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'Simba Healthcare': 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
  'Simba Global - Healthcare': 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2'
};

async function syncItemsFromSnapshots(supplierId: string) {
  const { data: mappings, error: mErr } = await supabase
    .from('supplier_product_map')
    .select('product_id, supplier_sku')
    .eq('supplier_id', supplierId)
    .eq('mapping_status', 'CONFIRMED');
  if (mErr) throw mErr;
  if (!mappings || mappings.length === 0) return { updated: 0 };

  const { data: snapshots, error: sErr } = await supabase
    .from('stock_snapshots')
    .select('supplier_sku, sell_price, total_stock_qty, snapshot_date')
    .eq('supplier_id', supplierId)
    .order('snapshot_date', { ascending: false });
  if (sErr) throw sErr;
  if (!snapshots || snapshots.length === 0) return { updated: 0 };

  const latestSnaps: Record<string, any> = {};
  for (const curr of snapshots) {
    if (!latestSnaps[curr.supplier_sku]) latestSnaps[curr.supplier_sku] = curr;
  }

  let updatedCount = 0;
  for (const m of mappings) {
    const snap = latestSnaps[m.supplier_sku];
    if (snap && snap.sell_price !== undefined && snap.sell_price !== null) {
      const { error: uErr } = await supabase
        .from('items')
        .update({
          price: snap.sell_price,
          unit_price: snap.sell_price,
          updated_at: new Date().toISOString()
        })
        .eq('id', m.product_id);
      if (!uErr) updatedCount++;
    }
  }
  return { updated: updatedCount };
}

async function main() {
  const { parseStockFileEnhanced } = await import('../utils/fileParser.ts');

  console.log('=== STARTING AUTOMATED SOH INBOX DRAIN & INGESTION ===\n');

  // Fetch pending or failed items from the recent batches
  const { data: pending, error } = await supabase
    .from('email_ingestion_queue')
    .select('*')
    .in('status', ['PENDING', 'FAILED'])
    .order('received_at', { ascending: true }); // Process chronologically

  if (error) throw error;
  console.log(`Found ${pending?.length || 0} candidate items to process in queue.`);

  let processedCount = 0;
  let skippedCount = 0;

  for (const item of pending || []) {
    const combined = `${item.attachment_name || ''} ${item.subject || ''}`.toLowerCase();
    const isReport = item.attachment_name?.endsWith('.xlsx') || item.attachment_name?.endsWith('.xls');

    // Skip non-spreadsheet files
    if (!isReport) {
      continue;
    }

    // Skip EOM / Concur reports
    if (combined.includes('concur') || combined.includes('purchase request') || combined.includes('eom') || combined.includes('tracking') || combined.includes('depletion')) {
      continue;
    }

    // Skip generic "Weekly Inventory.xlsx" duplicate attachment
    if (item.attachment_name === 'Weekly Inventory.xlsx') {
      console.log(`Marking secondary duplicate attachment as SKIPPED: ${item.attachment_name}`);
      await supabase.from('email_ingestion_queue').update({
        status: 'SKIPPED',
        error: 'Duplicate secondary attachment from Frenkel email (SPL Weekly Inventory is primary)',
        processed_at: new Date().toISOString()
      }).eq('id', item.id);
      skippedCount++;
      continue;
    }

    console.log(`\n------------------------------------------------------------`);
    console.log(`Processing report: ${item.attachment_name}`);
    console.log(`  Received: ${item.received_at}`);

    // Download blob
    const { data: blobData, error: dlErr } = await supabase.storage.from('supplier-inbox').download(item.storage_path);
    if (dlErr) {
      console.error(`  Download error: ${dlErr.message}`);
      await supabase.from('email_ingestion_queue').update({
        status: 'FAILED',
        error: `Storage download error: ${dlErr.message}`,
        processed_at: new Date().toISOString()
      }).eq('id', item.id);
      continue;
    }

    const file = new File([blobData], item.attachment_name, { type: blobData.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const parsed = await parseStockFileEnhanced(file);

    if (!parsed.success) {
      console.error(`  Parsing failed: ${parsed.errors.join('; ')}`);
      await supabase.from('email_ingestion_queue').update({
        status: 'FAILED',
        error: parsed.errors.join('; ').slice(0, 500),
        processed_at: new Date().toISOString()
      }).eq('id', item.id);
      continue;
    }

    const detectedName = parsed.detectedSupplier?.name || '';
    const supplierId = SUPPLIER_IDS[detectedName];

    if (!supplierId) {
      console.error(`  Supplier could not be resolved from detection: "${detectedName}"`);
      await supabase.from('email_ingestion_queue').update({
        status: 'NEEDS_SUPPLIER',
        detected_supplier_name: detectedName || null,
        report_date: parsed.reportDate,
        error: `Could not map detected supplier "${detectedName}" to a known supplier ID`,
        processed_at: new Date().toISOString()
      }).eq('id', item.id);
      continue;
    }

    const importDateValue = parsed.reportDate || new Date().toISOString().split('T')[0];
    const sourceReportName = `Email Ingestion Hub: ${file.name}${parsed.detectedSupplier ? ` (Detected: ${parsed.detectedSupplier.name})` : ''}`;

    const rows = (parsed.data || []).map((partial: any) => {
      const norm = normalizeItemCode(partial.customerStockCode || partial.supplierSku);
      const stockOnHand = partial.stockOnHand !== undefined ? partial.stockOnHand : (partial.availableQty || 0);
      const availableQty = partial.availableQty !== undefined ? partial.availableQty : stockOnHand;
      const totalStockQty = partial.totalStockQty !== undefined ? partial.totalStockQty : stockOnHand;
      const sellPrice = partial.sellPrice;
      const sohValueAtSell = partial.sohValueAtSell !== undefined ? partial.sohValueAtSell : (stockOnHand * (sellPrice || 0));

      return {
        id: uuidv4(),
        supplier_id: supplierId,
        supplier_sku: partial.supplierSku || '',
        source_supplier_sku: partial.sourceSupplierSku,
        product_name: partial.productName || 'Unknown Product',
        customer_stock_code_raw: partial.customerStockCode || partial.supplierSku,
        customer_stock_code_norm: norm.normalized,
        customer_stock_code_alt_norm: norm.alternate,
        range_name: partial.range,
        category: partial.category,
        sub_category: partial.subCategory,
        stock_type: partial.stockType,
        carton_qty: partial.cartonQty,
        stock_on_hand: stockOnHand,
        committed_qty: partial.committedQty || 0,
        back_ordered_qty: partial.backOrderedQty || 0,
        available_qty: availableQty,
        total_stock_qty: totalStockQty,
        sell_price: sellPrice,
        soh_value_at_sell: sohValueAtSell,
        snapshot_date: importDateValue,
        source_report_name: sourceReportName,
        incoming_stock: partial.incomingStock || []
      };
    });

    console.log(`  Target Supplier: ${detectedName} (${supplierId})`);
    console.log(`  Report Date: ${importDateValue}`);
    console.log(`  Parsed Rows: ${rows.length}`);

    // Replace stock_snapshots for this supplier:
    // 1. Delete previous rows
    const { error: delErr } = await supabase
      .from('stock_snapshots')
      .delete()
      .eq('supplier_id', supplierId);

    if (delErr) {
      console.error(`  Delete error on stock_snapshots: ${delErr.message}`);
      await supabase.from('email_ingestion_queue').update({
        status: 'FAILED',
        error: delErr.message,
        processed_at: new Date().toISOString()
      }).eq('id', item.id);
      continue;
    }

    // 2. Insert new rows in chunks of 500
    const chunkSize = 500;
    let insertErr = null;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error: insErr } = await supabase.from('stock_snapshots').insert(chunk);
      if (insErr) {
        insertErr = insErr;
        break;
      }
    }

    if (insertErr) {
      console.error(`  Insert error on stock_snapshots: ${insertErr.message}`);
      await supabase.from('email_ingestion_queue').update({
        status: 'FAILED',
        error: insertErr.message,
        processed_at: new Date().toISOString()
      }).eq('id', item.id);
      continue;
    }

    // 3. Sync item master
    try {
      const syncResult = await syncItemsFromSnapshots(supplierId);
      console.log(`  Synced items from snapshot: ${syncResult.updated} items updated.`);
    } catch (e: any) {
      console.warn(`  Item sync warning: ${e.message}`);
    }

    // 4. Update queue row to PROCESSED
    await supabase.from('email_ingestion_queue').update({
      status: 'PROCESSED',
      detected_supplier_id: supplierId,
      detected_supplier_name: detectedName,
      report_date: importDateValue,
      rows_imported: rows.length,
      processed_at: new Date().toISOString()
    }).eq('id', item.id);

    // 5. Log in system_audit_logs
    await supabase.from('system_audit_logs').insert({
      action_type: 'STOCK_SNAPSHOT_IMPORTED',
      performed_by: '00000000-0000-0000-0000-000000000000',
      details: {
        supplierId,
        supplierName: detectedName,
        date: importDateValue,
        count: rows.length,
        source: 'Automated Ingestion Pipeline',
        file: item.attachment_name
      }
    });

    console.log(`  SUCCESS: Imported ${rows.length} records for ${detectedName} (Date: ${importDateValue})`);
    processedCount++;
  }

  console.log(`\n============================================================`);
  console.log(`INBOX DRAIN COMPLETE: ${processedCount} files ingested, ${skippedCount} skipped.`);
}

main().catch(console.error);
