import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import XLSX from 'xlsx';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'procureflow-pack-tests-'));
const pg = new PGlite();
let passed = 0;
const check = async (name, run) => { await run(); passed++; console.log(`PASS ${name}`); };
try {
  for (const file of ['suppliers', 'stockOffers', 'taxCalculations', 'orderPacks', 'reservationUtils', 'orderPackStock', 'orderPackSnapshot']) {
    const source = fs.readFileSync(`utils/${file}.ts`, 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext
    } }).outputText.replaceAll(/\.\/([A-Za-z]+)\.ts/g, './$1.mjs');
    fs.writeFileSync(path.join(temp, `${file}.mjs`), compiled);
  }
  const { getOrderPackRule, roundOrderQuantity, isPackQuantity, withPackQuantity, assertOrderPackQuantities } =
    await import(pathToFileURL(path.join(temp, 'orderPacks.mjs')));
  const { calculatePackOrderStock } = await import(pathToFileURL(path.join(temp, 'orderPackStock.mjs')));
  const { readOrderPackSnapshot, linePackLabel, orderPackReportFields, appendOrderPackColumns } =
    await import(pathToFileURL(path.join(temp, 'orderPackSnapshot.mjs')));
  const id = n => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
  const [itemId, supplierId, aliasId, alternateId, fallbackId, unknownId, requestId, legacyId] =
    [1, 2, 3, 4, 5, 6, 7, 8].map(id);
  const item = { id: itemId, sku: 'HSPG02', name: 'Scrub', upq: 1 };
  const suppliers = [{ id: supplierId, name: 'NCC Apparel Pty Ltd' },
    { id: aliasId, name: 'NCC Apparel' }, { id: alternateId, name: 'Simba Healthcare' }];
  const mappings = [{ id: id(10), productId: itemId, supplierId, supplierSku: 'SCRUB', mappingStatus: 'CONFIRMED', packConversionFactor: 1 },
    { id: id(11), productId: itemId, supplierId: alternateId, supplierSku: 'SIMBA', mappingStatus: 'CONFIRMED', packConversionFactor: 1 }];
  const snapshots = [{ id: id(12), supplierId, supplierSku: 'SCRUB', productName: 'Scrub', stockType: 'CUSTOM',
    cartonQty: 30, snapshotDate: '2026-10-06T00:00:00Z', availableQty: 2640, customerStockCodeRaw: 'HSPG02' },
    { id: id(13), supplierId: alternateId, supplierSku: 'SIMBA', productName: 'Scrub',
      cartonQty: 25, snapshotDate: '2026-10-06T00:00:00Z', availableQty: 2070 }];
  const rule = (supplier = supplierId, snaps = snapshots, it = item) => getOrderPackRule(it, supplier, suppliers, mappings, snaps);
  await check('Supplier carton overrides catalogue default 1', () => assert.deepEqual(rule(), { size: 30, source: 'supplier' }));
  await check('Switching suppliers changes 30-unit cartons to 25', () => assert.equal(rule(alternateId).size, 25));
  await check('Canonical supplier alias resolves the same carton', () => assert.equal(rule(aliasId).size, 30));
  await check('A stock conversion factor never changes the ordering pack', () => {
    assert.equal(getOrderPackRule(item, supplierId, suppliers, [{ ...mappings[0], packConversionFactor: 100 }], snapshots).size, 30);
  });
  await check('Typed 31 rounds up to 60; valid 30 and 60 stay unchanged', () => {
    assert.equal(roundOrderQuantity(31, 30), 60);
    for (const n of [30, 60]) assert.equal(roundOrderQuantity(n, 30), n);
    assert.equal(roundOrderQuantity(0, 30), 30);
    assert.equal(isPackQuantity(31, 30), false);
  });
  await check('Rounding recomputes net, GST and gross together', () => {
    const line = withPackQuantity({ quantityOrdered: 31, unitPrice: 5.56, taxAmount: 17.24 }, 31, 30);
    assert.equal(line.quantityOrdered, 60); assert.equal(line.totalPrice, 333.60);
    assert.equal(line.taxAmount, 33.36); assert.equal(line.totalPriceIncGst, 366.96);
  });
  await check('Latest supplier report wins over older pack size', () => {
    assert.equal(rule(supplierId, [...snapshots, { ...snapshots[0], id: id(14), snapshotDate: '2026-10-01T00:00:00Z', cartonQty: 20 }]).size, 30);
  });
  await check('Same-date conflicting packs fail closed', () => {
    assert.equal(rule(supplierId, [...snapshots, { ...snapshots[0], id: id(14), supplierId: aliasId, cartonQty: 20 }]).source, 'conflict');
  });
  await check('NCC contract range wins over PUBLIC range', () => {
    assert.equal(rule(supplierId, [...snapshots, { ...snapshots[0], id: id(14), stockType: 'PUBLIC', cartonQty: 20 }]).size, 30);
  });
  await check('Explicit supplier pack 1 permits loose units', () => assert.equal(rule(supplierId, [{ ...snapshots[0], cartonQty: 1 }]).size, 1));
  await check('Known catalogue pack is fallback; default 1 is unconfirmed', () => {
    assert.equal(rule(supplierId, [], { ...item, upq: 12 }).size, 12);
    assert.equal(rule(supplierId, []).size, null);
  });
  await check('Noninteger, zero and negative supplier packs are not trusted', () => {
    for (const n of [1.5, 0, -2]) assert.equal(rule(supplierId, [{ ...snapshots[0], cartonQty: n }]).size, null);
  });
  await check('Submission boundary rejects unknown or odd quantities', () => {
    const line = { itemId, itemName: 'Scrub', quantityOrdered: 31 };
    assert.throws(() => assertOrderPackQuantities([line], supplierId, [item], suppliers, mappings, snapshots), /multiple of 30/);
    assert.throws(() => assertOrderPackQuantities([line], supplierId, [item], suppliers, mappings, []), /Pack size unavailable/);
    assertOrderPackQuantities([{ ...line, quantityOrdered: 60 }], supplierId, [item], suppliers, mappings, snapshots);
  });

  await pg.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA private;
    CREATE TABLE items(id uuid PRIMARY KEY,sku text,name text,upq numeric);
    CREATE TABLE suppliers(id uuid PRIMARY KEY,name text);
    CREATE TABLE supplier_product_map(id uuid PRIMARY KEY,product_id uuid,supplier_id uuid,supplier_sku text,
      supplier_customer_stock_code text,mapping_status text,manual_override boolean,match_priority int,pack_conversion_factor numeric);
    CREATE TABLE stock_snapshots(id uuid PRIMARY KEY,supplier_id uuid,supplier_sku text,source_supplier_sku text,
      product_name text,customer_stock_code_raw text,customer_stock_code_norm text,
      snapshot_date timestamptz,available_qty numeric,stock_on_hand numeric,stock_type text,carton_qty int);
    CREATE TABLE po_requests(id uuid PRIMARY KEY,supplier_id uuid,status text);
    CREATE TABLE po_lines(id uuid PRIMARY KEY,po_request_id uuid,item_id uuid,quantity_ordered numeric,quantity_received numeric DEFAULT 0);
  `);
  const accuracy = fs.readFileSync('supabase/migrations/20261006033300_supplier_stock_accuracy.sql', 'utf8');
  for (const name of ['stock_supplier_key', 'stock_code', 'stock_pool']) {
    const match = accuracy.match(new RegExp(`CREATE OR REPLACE FUNCTION private\\.${name}\\([\\s\\S]*?\\$\\$;`));
    assert.ok(match, `Actual stock helper ${name} found`); await pg.exec(match[0]);
  }
  for (const s of suppliers) await pg.query('INSERT INTO suppliers VALUES($1,$2)', [s.id, s.name]);
  for (const i of [item, { id: fallbackId, sku: 'FALLBACK', name: 'Fallback', upq: 12 }, { id: unknownId, sku: 'UNKNOWN', name: 'Unknown', upq: 1 }])
    await pg.query('INSERT INTO items VALUES($1,$2,$3,$4)', [i.id, i.sku, i.name, i.upq]);
  for (const m of mappings) await pg.query('INSERT INTO supplier_product_map VALUES($1,$2,$3,$4,NULL,$5,false,0,1)',
    [m.id, m.productId, m.supplierId, m.supplierSku, m.mappingStatus]);
  for (const s of snapshots) await pg.query('INSERT INTO stock_snapshots VALUES($1,$2,$3,NULL,$4,$5,NULL,$6,$7,$7,$8,$9)',
    [s.id, s.supplierId, s.supplierSku, s.productName, s.customerStockCodeRaw || null, s.snapshotDate, s.availableQty, s.stockType || null, s.cartonQty]);
  await pg.query("INSERT INTO po_requests VALUES($1,$2,'DRAFT'),($3,$2,'ACTIVE')", [requestId, supplierId, legacyId]);
  await pg.query('INSERT INTO po_lines(id,po_request_id,item_id,quantity_ordered) VALUES($1,$2,$3,31),($4,$5,$3,31)',
    [id(20), requestId, itemId, id(21), legacyId]);
  const migration = fs.readdirSync('supabase/migrations').find(n => n.endsWith('_supplier_pack_quantities.sql'));
  await pg.exec(fs.readFileSync(path.join('supabase/migrations', migration), 'utf8'));
  const dbSize = async (it = itemId, supplier = supplierId) =>
    (await pg.query('SELECT private.order_pack_size($1,$2) AS size', [it, supplier])).rows[0].size;
  await check('Server and application agree on supplier and alias packs', async () => {
    for (const s of suppliers) assert.equal(await dbSize(itemId, s.id), rule(s.id).size);
    assert.equal(await dbSize(fallbackId), 12); assert.equal(await dbSize(unknownId), null);
  });
  await check('Server rejects odd, zero and fractional quantities', async () => {
    for (const qty of [31, 0, 30.5]) await assert.rejects(pg.query('INSERT INTO po_lines VALUES($1,$2,$3,$4,0)', [id(30), requestId, itemId, qty]), /PACK_MULTIPLE_REQUIRED/);
  });
  await check('Server rejects unconfirmed pack on insert', async () => {
    await assert.rejects(pg.query('INSERT INTO po_lines VALUES($1,$2,$3,1,0)', [id(30), requestId, unknownId]), /PACK_SIZE_UNCONFIRMED/);
  });
  await check('Existing odd draft cannot submit until corrected', async () => {
    await assert.rejects(pg.query("UPDATE po_requests SET status='PENDING_APPROVAL' WHERE id=$1", [requestId]), /PACK_MULTIPLE_REQUIRED/);
    assert.equal((await pg.query('SELECT status FROM po_requests WHERE id=$1', [requestId])).rows[0].status, 'DRAFT');
    await pg.query('UPDATE po_lines SET quantity_ordered=60 WHERE id=$1', [id(20)]);
    await pg.query("UPDATE po_requests SET status='PENDING_APPROVAL' WHERE id=$1", [requestId]);
  });
  await check('Changing a request supplier revalidates all lines', async () => {
    await assert.rejects(pg.query('UPDATE po_requests SET supplier_id=$1 WHERE id=$2', [alternateId, requestId]), /multiple of 25/);
  });
  await check('Receipt edits and unchanged historic upserts remain possible', async () => {
    await pg.query('UPDATE po_lines SET quantity_received=7 WHERE id=$1', [id(21)]);
    await pg.query('INSERT INTO po_lines VALUES($1,$2,$3,31,7) ON CONFLICT(id) DO UPDATE SET quantity_ordered=excluded.quantity_ordered', [id(21), legacyId, itemId]);
    assert.equal((await pg.query('SELECT quantity_ordered FROM po_lines WHERE id=$1', [id(21)])).rows[0].quantity_ordered, '31');
  });
  await check('Changing a historic quantity enforces packs', async () => {
    await assert.rejects(pg.query('UPDATE po_lines SET quantity_ordered=32 WHERE id=$1', [id(21)]), /PACK_MULTIPLE_REQUIRED/);
    await pg.query('UPDATE po_lines SET quantity_ordered=60 WHERE id=$1', [id(21)]);
  });
  await check('Failed line insert rolls back header and sibling lines', async () => {
    await pg.exec('BEGIN');
    try {
      await pg.query("INSERT INTO po_requests VALUES($1,$2,'PENDING_APPROVAL')", [id(40), supplierId]);
      await pg.query('INSERT INTO po_lines VALUES($1,$2,$3,30,0)', [id(41), id(40), itemId]);
      await assert.rejects(pg.query('INSERT INTO po_lines VALUES($1,$2,$3,31,0)', [id(42), id(40), itemId]), /PACK_MULTIPLE_REQUIRED/);
    } finally { await pg.exec('ROLLBACK'); }
    assert.equal((await pg.query('SELECT count(*)::int n FROM po_requests WHERE id=$1', [id(40)])).rows[0].n, 0);
  });
  await check('Pack validators are not callable by client roles', async () => {
    await pg.exec('SET ROLE authenticated');
    await assert.rejects(pg.query('SELECT private.order_pack_size($1,$2)', [itemId, supplierId]), /permission denied/);
    await pg.exec('RESET ROLE');
  });
  await check('SQL pack conflicts match client fail-closed behavior', async () => {
    await pg.query("INSERT INTO stock_snapshots SELECT $1,$2,supplier_sku,source_supplier_sku,product_name,customer_stock_code_raw,customer_stock_code_norm,snapshot_date,available_qty,stock_on_hand,stock_type,20 FROM stock_snapshots WHERE id=$3", [id(50), aliasId, id(12)]);
    assert.equal(await dbSize(), null);
  });
  await pg.query('DELETE FROM stock_snapshots WHERE id=$1', [id(50)]);
  await pg.exec(`
    ALTER TABLE items ADD COLUMN uom text DEFAULT 'Each';
    ALTER TABLE po_requests ADD COLUMN request_date timestamptz, ADD COLUMN requester_id uuid,
      ADD COLUMN site_id uuid, ADD COLUMN total_amount numeric, ADD COLUMN subtotal_amount numeric,
      ADD COLUMN tax_total_amount numeric, ADD COLUMN total_amount_inc_gst numeric, ADD COLUMN display_id text DEFAULT 'PACK-TEST',
      ADD COLUMN customer_name text, ADD COLUMN reason_for_request text, ADD COLUMN comments text,
      ADD COLUMN is_non_default_supplier boolean, ADD COLUMN non_default_supplier_reason text, ADD COLUMN concur_request_number text;
    ALTER TABLE po_lines ADD COLUMN sku text, ADD COLUMN item_name text, ADD COLUMN unit_price numeric,
      ADD COLUMN total_price numeric, ADD COLUMN tax_code text, ADD COLUMN tax_rate numeric,
      ADD COLUMN tax_amount numeric, ADD COLUMN total_price_inc_gst numeric, ADD COLUMN concur_po_number text, ADD COLUMN need_by_date date;
    CREATE SCHEMA extensions;
    CREATE FUNCTION extensions.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS 'SELECT gen_random_uuid()';
    CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql AS 'SELECT true';
  `);
  const snapshotMigration = fs.readdirSync('supabase/migrations').find(n => n.endsWith('_capture_order_pack_snapshot.sql'));
  await pg.exec(fs.readFileSync(path.join('supabase/migrations', snapshotMigration), 'utf8'));
  const createSql = fs.readFileSync('supabase/migrations/20260924050905_add_non_default_supplier_fields.sql', 'utf8');
  await pg.exec(createSql.slice(createSql.indexOf('CREATE OR REPLACE FUNCTION')));
  const editSql = fs.readFileSync('supabase/migrations/20260603041929_draft_po_support.sql', 'utf8');
  await pg.exec(editSql.slice(editSql.indexOf('CREATE OR REPLACE FUNCTION'), editSql.indexOf('$$;', editSql.indexOf('CREATE OR REPLACE FUNCTION')) + 3));
  const readLine = async (lineId) => (await pg.query('SELECT * FROM po_lines WHERE id=$1', [lineId])).rows[0];
  const header = { supplier_id: supplierId, status: 'DRAFT', request_date: '2026-10-07', subtotal_amount: 333.60 };
  const rpcLine = { id: id(61), item_id: itemId, item_name: 'Scrub', sku: 'HSPG02', quantity_ordered: 60,
    unit_price: 5.56, total_price: 333.60, tax_amount: 33.36, total_price_inc_gst: 366.96 };
  await check('Real create RPC stores pack/UOM/supplier and survives a database reload', async () => {
    await pg.query('SELECT create_po_atomic($1,$2,$3,NULL)', [id(60), header, [rpcLine]]);
    assert.deepEqual(readOrderPackSnapshot(await readLine(id(61))), { upq: 30, uom: 'Each', packSupplierId: supplierId });
  });
  await check('Supplier report changes and partial receipts preserve the ordered pack and UOM', async () => {
    await pg.query('UPDATE stock_snapshots SET carton_qty=60 WHERE id=$1', [id(12)]);
    await pg.query("UPDATE items SET uom='EA' WHERE id=$1", [itemId]);
    await pg.query('UPDATE po_lines SET quantity_received=17 WHERE id=$1', [id(61)]);
    const saved = readOrderPackSnapshot(await readLine(id(61)));
    assert.equal(saved.upq, 30); assert.equal(saved.uom, 'Each');
    assert.equal(Number((await readLine(id(61))).quantity_received), 17);
    assert.match(linePackLabel({ ...saved, quantityOrdered: 60 }), /2 full packs/);
  });
  await check('Real edit RPC preserves history on unchanged upsert and refreshes changed quantities', async () => {
    await pg.query('SELECT update_pending_po_request($1,$2,$3)', [id(60), { comments: 'Audit edit' }, [rpcLine]]);
    assert.equal((await readLine(id(61))).upq, 30);
    await pg.query('SELECT update_pending_po_request($1,$2,$3)', [id(60), {}, [{ ...rpcLine, quantity_ordered: 120 }]]);
    assert.equal((await readLine(id(61))).upq, 60);
    assert.equal((await readLine(id(61))).uom, 'EA');
  });
  await check('Unrecorded historical packs remain explicitly unknown on receipt and reload', async () => {
    await pg.query('UPDATE po_lines SET quantity_received=13 WHERE id=$1', [id(21)]);
    const saved = readOrderPackSnapshot(await readLine(id(21)));
    assert.equal(saved.upq, undefined); assert.match(linePackLabel({ ...saved, quantityOrdered: 60 }), /legacy order/);
  });
  await check('Submitting a saved draft snapshots the current valid pack', async () => {
    await pg.query('UPDATE stock_snapshots SET carton_qty=30 WHERE id=$1', [id(12)]);
    await pg.query("UPDATE po_requests SET status='PENDING_APPROVAL' WHERE id=$1", [id(60)]);
    assert.equal((await readLine(id(61))).upq, 30);
  });
  await check('Supplier change snapshots the new supplier without changing ordering units', async () => {
    await pg.query('UPDATE po_lines SET quantity_ordered=150 WHERE id=$1', [id(61)]);
    await pg.query('UPDATE po_requests SET supplier_id=$1 WHERE id=$2', [alternateId, id(60)]);
    const saved = await readLine(id(61));
    assert.equal(saved.upq, 25); assert.equal(saved.pack_supplier_id, alternateId);
    assert.equal(Number(saved.quantity_ordered), 150);
  });
  await check('Client supplied pack metadata cannot override the database supplier pack', async () => {
    await pg.query("UPDATE po_lines SET upq=999,uom='BALE',pack_supplier_id=$1 WHERE id=$2", [supplierId, id(61)]);
    const saved = await readLine(id(61));
    assert.equal(saved.upq, 25); assert.equal(saved.uom, 'EA'); assert.equal(saved.pack_supplier_id, alternateId);
  });
  await check('Shared request/directory/report projection rounds availability by order pack, not conversion', () => {
    const maps = [{ ...mappings[0], packConversionFactor: 2 }];
    const stock = calculatePackOrderStock(itemId, supplierId, suppliers, maps, [{ ...snapshots[0], availableQty: 31 }], [], item);
    assert.equal(stock.baseAvailableUnits, 62); assert.equal(stock.packConversionFactor, 2);
    assert.equal(stock.orderMultiple, 30); assert.equal(stock.availableOrderQty, 60);
    const unknown = calculatePackOrderStock(itemId, supplierId, suppliers, maps, [{ ...snapshots[0], cartonQty: undefined }], [], item);
    assert.equal(unknown.baseAvailableUnits, 5280); assert.equal(unknown.availableOrderQty, 0);
  });
  await check('Line exports retain saved pack/UOM/count while header and Concur totals keep their format', () => {
    const fields = orderPackReportFields({ upq: 30, uom: 'Each', quantityOrdered: 60 });
    assert.equal(fields.orderPackSize, 30); assert.equal(fields.orderedPacks, 2); assert.equal(fields.orderUom, 'Each');
    for (const report of ['OUTSTANDING_DELIVERIES', 'ALL_DELIVERIES', 'DELIVERY_VARIANCE', 'FINANCE_SUMMARY', 'DELIVERY_RECONCILIATION', 'ITEM_REQUEST_HISTORY', 'MONTHLY_SUMMARY', 'LINEN_INJECTION'])
      assert.equal(appendOrderPackColumns(report, [{ key: 'quantity', label: 'Units' }]).length, 4);
    for (const report of ['PO_STATUS', 'EOM_BUDGET_RECONCILIATION']) assert.equal(appendOrderPackColumns(report, []).length, 0);
    assert.equal(orderPackReportFields({ quantityOrdered: 31 }).orderedPacks, '');
  });
  await check('Snapshot trigger helpers remain inaccessible to application roles', async () => {
    const result = await pg.query("SELECT has_function_privilege('authenticated','private.capture_order_line_pack()','EXECUTE') can_capture, has_function_privilege('anon','private.refresh_request_pack_snapshot()','EXECUTE') can_refresh");
    assert.equal(result.rows[0].can_capture, false); assert.equal(result.rows[0].can_refresh, false);
  });
  fs.writeFileSync(path.join(temp, 'fileParser.mjs'), ts.transpileModule(fs.readFileSync('utils/fileParser.ts', 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
  }).outputText.replace("'xlsx'", JSON.stringify(pathToFileURL(path.resolve('node_modules/xlsx/xlsx.mjs')).href)));
  globalThis.FileReader = class { readAsArrayBuffer(file) { file.arrayBuffer().then(result => this.onload({ target: { result } })).catch(e => this.onerror(e)); } };
  const { parseStockFileEnhanced, parseDataRows } = await import(pathToFileURL(path.join(temp, 'fileParser.mjs')));
  await check('Supplier bale headers reuse the existing carton import field', async () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
      ['Supplier SKU', 'Product Name', 'Available Qty', 'Units per bale'], ['SCRUB', 'Scrub', 2640, 30]
    ]), 'Stock');
    const file = new Blob([XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })]); file.name = 'supplier-bale-stock.xlsx';
    const parsed = await parseStockFileEnhanced(file);
    assert.equal(parsed.data[0].cartonQty, 30);
  });
  await check('Import never truncates a fractional bale size into a trusted full-pack rule', () => {
    const rows = parseDataRows([{ sku: 'SCRUB', pack: '30.5 units' }], {
      supplierSku: { sourceColumn: 'sku' }, cartonQty: { sourceColumn: 'pack' }
    }, []);
    assert.equal(rows[0].cartonQty, undefined);
  });
  await check('Unplanned receiving records actual units without fabricating an order or pack', async () => {
    await pg.query("INSERT INTO po_requests(id,supplier_id,status) VALUES($1,$2,'VARIANCE_PENDING')", [id(70), supplierId]);
    await pg.query('INSERT INTO po_lines(id,po_request_id,item_id,quantity_ordered,quantity_received,total_price) VALUES($1,$2,$3,0,7,0)', [id(71), id(70), unknownId]);
    const saved = await readLine(id(71));
    assert.equal(saved.upq, null); assert.equal(Number(saved.quantity_received), 7);
    assert.match(linePackLabel({ ...readOrderPackSnapshot(saved), quantityOrdered: 0 }), /Unplanned receipt/);
    await pg.query('UPDATE po_lines SET quantity_received=8 WHERE id=$1', [id(71)]);
    assert.equal((await readLine(id(71))).upq, null);
  });
  await check('Receiving exception cannot erase an ordered quantity or submit a zero-quantity order', async () => {
    await pg.query("UPDATE po_requests SET status='VARIANCE_PENDING' WHERE id=$1", [id(60)]);
    await assert.rejects(pg.query('UPDATE po_lines SET quantity_ordered=0,quantity_received=7,total_price=0 WHERE id=$1', [id(61)]), /PACK_MULTIPLE_REQUIRED/);
    await assert.rejects(pg.query('SELECT create_po_atomic($1,$2,$3,NULL)', [id(72), header, [{ ...rpcLine, id: id(73), quantity_ordered: 0 }]]), /PACK_MULTIPLE_REQUIRED/);
  });
  console.log(`${passed} supplier pack checks passed; no live database writes.`);
} finally { await pg.close(); fs.rmSync(temp, { recursive: true, force: true }); }
