import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'procureflow-pack-tests-'));
const pg = new PGlite();
let passed = 0;
const check = async (name, run) => { await run(); passed++; console.log(`PASS ${name}`); };
try {
  for (const file of ['suppliers', 'stockOffers', 'taxCalculations', 'orderPacks']) {
    const source = fs.readFileSync(`utils/${file}.ts`, 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext
    } }).outputText.replaceAll(/\.\/([A-Za-z]+)\.ts/g, './$1.mjs');
    fs.writeFileSync(path.join(temp, `${file}.mjs`), compiled);
  }
  const { getOrderPackRule, roundOrderQuantity, isPackQuantity, withPackQuantity, assertOrderPackQuantities } =
    await import(pathToFileURL(path.join(temp, 'orderPacks.mjs')));
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
  console.log(`${passed} supplier pack checks passed; no live database writes.`);
} finally { await pg.close(); fs.rmSync(temp, { recursive: true, force: true }); }
