import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import XLSX from 'xlsx';
process.on('uncaughtException', error => { console.error(error.message, error.where || '', error.position || ''); process.exit(1); });

const checks = [];
const check = async (name, fn) => { await fn(); checks.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); };
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'procureflow-stock-tests-'));
for (const file of ['suppliers', 'stockOffers', 'reservationUtils']) {
  const source = fs.readFileSync(`utils/${file}.ts`, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    .replaceAll('./suppliers.ts', './suppliers.mjs').replaceAll('./stockOffers.ts', './stockOffers.mjs');
  fs.writeFileSync(path.join(temp, `${file}.mjs`), code);
}
const { calculateItemRunningStock, isPOReservingStock } = await import(pathToFileURL(path.join(temp, 'reservationUtils.mjs')));
const { getSupplierOfferPrice } = await import(pathToFileURL(path.join(temp, 'stockOffers.mjs')));
fs.writeFileSync(path.join(temp, 'fileParser.mjs'), ts.transpileModule(fs.readFileSync('utils/fileParser.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText.replace("'xlsx'", JSON.stringify(pathToFileURL(path.resolve('node_modules/xlsx/xlsx.mjs')).href)));
globalThis.FileReader = class { readAsArrayBuffer(file) { file.arrayBuffer().then(result => this.onload({ target: { result } })).catch(e => this.onerror(e)); } };
const { parseStockFileEnhanced } = await import(pathToFileURL(path.join(temp, 'fileParser.mjs')));
const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
  ['', 'MTO STYLES 28/09/2026'], ['', '', '', '', '', '', '', '', '', 'STOCK ON ORDER'],
  ['NCC SKU #', 'NCC Product Description', '$Price / Unit (Excl. GST)', 'SPL Item Code', 'SPL Product Description', 'SPL Product Category', 'Carton Qty', 'SOH @ NCC', 'SOH @ NCC', 46296],
  ['MSPL002', 'Custom scrub pants RFID - M', 5.56, 'HSPG02', 'THT SCRUB PANT - M GREEN', 'Theatre', '30 pcs', '', 2640, 13360]
]), 'NCC SOH & SOO - MTO STOCK');
XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
  ['', 'STANDARD NCC STYLES'], ['', '', '', '', '', '', '', '', 'STOCK ON ORDER'],
  ['NCC SKU #', 'NCC Product Description', '$Price / Unit (Excl. GST)', 'SPL Item Code', 'SPL Product Description', 'SPL Product Category', 'Carton Qty', 'SOH @ NCC', 46296],
  ['M88012', 'Standard scrub pants - M', 7.21, 'HSPG02', 'THT SCRUB PANT - M GREEN', 'Theatre', '30 pcs', 10806, 2750]
]), 'STANDARD STOCK');
const bytes = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
const parsed = await parseStockFileEnhanced({ name: 'NCC MEDICAL SOH SOO 28.09.2026.xlsx', arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
await check('NCC import reads physical SOH, not future-order quantities', () => assert.deepEqual(parsed.data.map(r => r.stockOnHand), [2640, 10806]));
await check('NCC import retains supplier identifiers and separates contract ranges', () => assert.deepEqual(parsed.data.map(r => [r.sourceSupplierSku, r.stockType]), [['MSPL002', 'CUSTOM'], ['M88012', 'STANDARD']]));
await check('Stock and price stay in the same NCC range', () => { const r = parsed.data.find(r => r.stockType === 'CUSTOM'); assert.equal(r.stockOnHand, 2640); assert.equal(r.sellPrice, 5.56); });
await check('Excel date headers remain incoming-supply fields', () => assert.equal(parsed.data[0].incomingStock[0].qty, 13360));
const suppliers = [{ id: 'supplier', name: 'HOST Supplies' }, { id: 'alias', name: 'HOST Supplies Pty Ltd' }, { id: 'other', name: 'Other' }];
const maps = ['a', 'b'].map((id, i) => ({ id, productId: id, supplierId: i ? 'alias' : 'supplier', supplierSku: 'POOL', mappingStatus: 'CONFIRMED', packConversionFactor: 1 }));
const snapshot = { id: 'snap', supplierId: 'supplier', supplierSku: 'POOL', snapshotDate: '2026-10-05T00:00:00Z', availableQty: 100, stockOnHand: 500, sellPrice: 7.21 };
const po = { id: 'po', supplierId: 'alias', status: 'APPROVED_PENDING_CONCUR_REQUEST', reservationExpiresAt: '2099-01-01T00:00:00Z', lines: [{ itemId: 'b', quantityOrdered: 30, quantityReceived: 0 }] };
const calc = (snap = snapshot, pos = [po], item = 'a') => calculateItemRunningStock(item, 'supplier', suppliers, maps, [snap], pos);
await check('Explicit zero available never falls back to positive SOH', () => assert.equal(calc({ ...snapshot, availableQty: 0 }).baseAvailableUnits, 0));
await check('Supplier aliases and shared item mappings draw from the same pool', () => assert.equal(calc().effectiveStockUnits, 70));
await check('Both catalogue aliases see identical stock', () => assert.equal(calc().effectiveStockUnits, calc(snapshot, [po], 'b').effectiveStockUnits));
await check('Missing approval and expiry cannot create an indefinite hold', () => assert.equal(isPOReservingStock({ ...po, reservationExpiresAt: undefined }), false));
await check('PR-linked hold survives the 48-hour deadline', () => assert.equal(isPOReservingStock({ ...po, reservationExpiresAt: '2020-01-01', concurRequestNumber: 'PR' }), true));
await check('Expiry releases a hold without a PR', () => assert.equal(calc(snapshot, [{ ...po, reservationExpiresAt: '2020-01-01' }]).reservedUnits, 0));
const issued = { ...po, status: 'ACTIVE', concurPoNumber: 'PO', concurLinkedAt: '2026-10-01', lines: [{ itemId: 'a', quantityOrdered: 30, quantityReceived: 50 }, { itemId: 'a', quantityOrdered: 30, quantityReceived: 0 }] };
await check('Over-delivery on one line cannot hide another line outstanding', () => assert.equal(calc(snapshot, [issued]).onOrderUnits, 30));
await check('Pre-snapshot issued units remain On Order without a second deduction', () => { const r = calc(snapshot, [issued]); assert.equal(r.onOrderUnits, 30); assert.equal(r.committedUnits, 0); assert.equal(r.effectiveStockUnits, 100); });
await check('Pending state with an issued PO still counts as On Order', () => assert.equal(calc(snapshot, [{ ...issued, status: 'APPROVED_PENDING_CONCUR' }]).onOrderUnits, 30));
await check('Force-closed lines have no outstanding commitment', () => assert.equal(calc(snapshot, [{ ...issued, lines: issued.lines.map(l => ({ ...l, isForceClosed: true })) }]).onOrderUnits, 0));
await check('Another supplier never reduces this supplier stock', () => assert.equal(calc(snapshot, [{ ...po, supplierId: 'other' }]).effectiveStockUnits, 100));
await check('Offer price uses the selected supplier snapshot', () => assert.equal(getSupplierOfferPrice({ id: 'a', supplierId: 'supplier', unitPrice: 5.56 }, 'alias', suppliers, maps, [snapshot]), 7.21));
await check('Unknown alternate price cannot borrow the default catalogue price', () => assert.equal(getSupplierOfferPrice({ id: 'a', supplierId: 'supplier', unitPrice: 5.56 }, 'other', suppliers, maps, [snapshot]), 0));
await check('Latest supplier price wins', () => assert.equal(getSupplierOfferPrice({ id: 'a' }, 'supplier', suppliers, maps, [snapshot, { ...snapshot, id: 'new', snapshotDate: '2026-10-06', sellPrice: 8 }]), 8));

const pg = new PGlite();
const uuid = n => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
const [user, auth, supplier, alias, item, otherItem, request, otherRequest] = [1, 2, 3, 4, 5, 6, 7, 8].map(uuid);
await pg.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('fixture.uid',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated,anon; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
 CREATE TABLE items(id uuid PRIMARY KEY,sku text,name text);
 CREATE TABLE suppliers(id uuid PRIMARY KEY,name text);
 CREATE TABLE users(id uuid PRIMARY KEY,auth_user_id uuid,name text,status text,role_id text,site_ids text[]);
 CREATE TABLE roles(id text PRIMARY KEY,permissions text[],site_scope_mode text);
 CREATE TABLE user_roles(user_id uuid,role_id text);
 CREATE TABLE supplier_product_map(id uuid PRIMARY KEY,product_id uuid,supplier_id uuid,supplier_sku text,supplier_customer_stock_code text,mapping_status text,manual_override boolean,match_priority int,pack_conversion_factor numeric);
 CREATE TABLE stock_snapshots(id uuid PRIMARY KEY,supplier_id uuid,supplier_sku text,customer_stock_code_raw text,customer_stock_code_norm text,snapshot_date timestamptz,available_qty numeric,stock_on_hand numeric,stock_type text,product_name text);
 CREATE TABLE po_requests(id uuid PRIMARY KEY,display_id text,status text,requester_id uuid,site_id uuid,supplier_id uuid,concur_po_number text,concur_request_number text,reservation_expires_at timestamptz,auto_cancelled_at timestamptz,cancellation_reason text,approved_at timestamptz,updated_at timestamptz,request_date timestamptz,concur_linked_at timestamptz);
 CREATE TABLE po_lines(id uuid PRIMARY KEY,po_request_id uuid,item_id uuid,sku text,quantity_ordered int,quantity_received int,is_force_closed boolean,concur_po_number text);
 CREATE TABLE po_approvals(id uuid PRIMARY KEY,po_request_id uuid,approver_name text,action text,date timestamptz,comments text);
`);
await pg.exec(fs.readFileSync('supabase/migrations/20261006033300_supplier_stock_accuracy.sql', 'utf8'));
await pg.exec(fs.readFileSync('supabase/migrations/20261006033848_stock_handover_expiry_guard.sql', 'utf8'));
await pg.exec(fs.readFileSync('supabase/migrations/20261006034116_stock_schema_compatibility.sql', 'utf8'));
await pg.exec('ALTER TABLE po_requests DROP updated_at; ALTER TABLE roles DROP site_scope_mode');
await pg.query('INSERT INTO users VALUES ($1,$2,\'Fixture Requester\',\'APPROVED\',\'REQUESTER\',\'{}\')', [user, auth]);
await pg.query('INSERT INTO roles VALUES (\'REQUESTER\',\'{}\')');
await pg.query('INSERT INTO suppliers VALUES ($1,\'HOST Supplies\'),($2,\'HOST Supplies Pty Ltd\')', [supplier, alias]);
await pg.query(`INSERT INTO supplier_product_map VALUES ($1,$2,$3,'POOL',NULL,'CONFIRMED',false,1,1),($4,$5,$6,'POOL',NULL,'CONFIRMED',false,1,1)`, [uuid(9), item, supplier, uuid(10), otherItem, alias]);
await pg.query(`INSERT INTO stock_snapshots VALUES ($1,$2,'POOL',NULL,NULL,now()-interval '1 day',100,500,NULL,NULL,NULL)`, [uuid(11), supplier]);
await pg.query(`INSERT INTO po_requests(id,display_id,status,requester_id,supplier_id,approved_at,reservation_expires_at,auto_cancelled_at) VALUES ($1,'FIXTURE','CANCELLED',$2,$3,now()-interval '4 days',now()-interval '2 days',now()-interval '2 days')`, [request, user, supplier]);
await pg.query(`INSERT INTO po_lines VALUES($1,$2,$3,'A',60,0,false,NULL),($4,$2,$5,'B',60,0,false,NULL)`, [uuid(12), request, item, uuid(13), otherItem]);
await pg.query(`INSERT INTO po_approvals VALUES($1,$2,'Approver','APPROVED',now()-interval '4 days','Original')`, [uuid(14), request]);
await pg.query("SELECT set_config('fixture.uid',$1,false)", [auth]);
const rejects = async (sql, params, pattern) => { await assert.rejects(pg.query(sql, params), pattern); };
await check('Database rejects insufficient stock across shared lines', () => rejects('SELECT public.re_reserve_po_stock($1)', [request], /Insufficient supplier stock/));
await check('Rejected re-reservation leaves request and approval unchanged', async () => { assert.equal((await pg.query('SELECT status FROM po_requests WHERE id=$1', [request])).rows[0].status, 'CANCELLED'); assert.equal((await pg.query('SELECT count(*)::int AS n FROM po_approvals')).rows[0].n, 1); });
await pg.query('UPDATE po_lines SET quantity_ordered=20');
await check('Database rejects unauthenticated re-reservation', async () => { await pg.query("SELECT set_config('fixture.uid','',false)"); await rejects('SELECT public.re_reserve_po_stock($1)', [request], /permission/); await pg.query("SELECT set_config('fixture.uid',$1,false)", [auth]); });
await check('Anonymous role cannot execute stock or reinstatement RPCs', async () => { await pg.exec('SET ROLE anon'); await rejects('SELECT public.get_supplier_stock_allocations()', [], /permission denied/); await rejects('SELECT public.re_reserve_po_stock($1)', [request], /permission denied/); await pg.exec('RESET ROLE'); });
await check('Authenticated request owner can reinstate sufficient stock', async () => { await pg.exec('SET ROLE authenticated'); const r = await pg.query('SELECT public.re_reserve_po_stock($1,\'Spoofed name\') AS result', [request]); assert.equal(r.rows[0].result.status, 'APPROVED_PENDING_CONCUR_REQUEST'); await pg.exec('RESET ROLE'); });
await check('Renewal preserves original approval and creates exactly 48 hours', async () => { const r = (await pg.query(`SELECT extract(epoch FROM (reservation_expires_at-now()))/3600 AS window, extract(epoch FROM (now()-approved_at))/3600 AS age FROM po_requests WHERE id=$1`, [request])).rows[0]; assert.ok(Math.abs(Number(r.window) - 48) < 0.001); assert.ok(Number(r.age) >= 96); });
await check('Audit actor uses authenticated identity, not supplied name', async () => assert.equal((await pg.query("SELECT approver_name FROM po_approvals WHERE action='STOCK_RE_RESERVED'")).rows[0].approver_name, 'Fixture Requester'));
await check('Duplicate re-reservation is rejected', () => rejects('SELECT public.re_reserve_po_stock($1)', [request], /Only an expired/));
await check('Supplier-wide RPC omits request IDs, sites, identities, prices and actual Concur numbers', async () => { await pg.exec('SET ROLE authenticated'); const r = (await pg.query('SELECT public.get_supplier_stock_allocations() AS rows')).rows[0].rows; assert.equal(r.length, 1); for (const field of ['id', 'displayId', 'requesterId', 'siteId', 'totalAmount']) assert.equal(field in r[0], false); assert.equal('unitPrice' in r[0].lines[0], false); await pg.exec('RESET ROLE'); });
await pg.exec(`UPDATE po_requests SET status='CANCELLED',auto_cancelled_at=now(); UPDATE po_lines SET quantity_ordered=60`);
await check('Linking a PR cannot bypass an expired-stock shortage', () => rejects('SELECT public.link_concur_request_number($1,\'PR-TEST\')', [request], /Insufficient supplier stock/));
await check('Linking a PO cannot bypass an expired-stock shortage', () => rejects('SELECT public.link_concur_po_number($1,\'PO-TEST\')', [request], /Insufficient supplier stock/));
await check('Legacy expiry without an explicit deadline cannot bypass a shortage',async()=>{await pg.exec("UPDATE po_requests SET status='APPROVED_PENDING_CONCUR_REQUEST',reservation_expires_at=NULL,auto_cancelled_at=NULL");await rejects('SELECT public.link_concur_request_number($1,\'PR-TEST\')',[request],/Insufficient supplier stock/);});
await pg.query('UPDATE po_lines SET quantity_ordered=20');
await check('Linking PR with sufficient stock preserves the hold while awaiting PO', async () => { await pg.query('SELECT public.link_concur_request_number($1,\'PR-TEST\')', [request]); assert.equal((await pg.query('SELECT status,concur_request_number FROM po_requests')).rows[0].status, 'APPROVED_PENDING_CONCUR'); });
await check('Manual cancellation cannot be reinstated via Concur linking', async () => { await pg.query("UPDATE po_requests SET status='CANCELLED',auto_cancelled_at=NULL"); await rejects('SELECT public.link_concur_request_number($1,\'PR-TEST\')', [request], /manually cancelled/); });
await pg.exec(`ALTER TABLE stock_snapshots ADD source_report_name text, ADD range_name text, ADD carton_qty int, ADD category text, ADD sub_category text, ADD committed_qty int, ADD back_ordered_qty int, ADD soh_value_at_sell numeric, ADD sell_price numeric, ADD total_stock_qty int, ADD customer_stock_code_alt_norm text, ADD incoming_stock jsonb;`);
await pg.exec("INSERT INTO roles VALUES ('ADMIN','{manage_items}'); UPDATE users SET role_id='ADMIN'");
const imported = [{ id: uuid(30), supplier_sku: 'CUSTOM-A', source_supplier_sku: 'NATIVE-A', available_qty: 2640, stock_on_hand: 2640, snapshot_date: '2099-01-01', sell_price: 5.56, stock_type: 'CUSTOM', incoming_stock: [{ date: '2099-02-01', qty: 13360 }] }];
await check('Atomic stock import preserves native SKU, range, price and future supply separately', async () => {
 await pg.query('SELECT public.replace_stock_snapshot($1,$2,$3)',[supplier,'2099-01-01',JSON.stringify(imported)]);
 const r=(await pg.query('SELECT * FROM stock_snapshots')).rows[0];assert.equal(r.source_supplier_sku,'NATIVE-A');assert.equal(Number(r.stock_on_hand),2640);assert.equal(Number(r.sell_price),5.56);assert.equal(r.incoming_stock[0].qty,13360);
});
await check('An older import cannot overwrite a newer supplier snapshot',()=>rejects('SELECT public.replace_stock_snapshot($1,$2,$3)',[supplier,'2098-01-01',JSON.stringify(imported)],/STALE_REPORT/));
await check('A malformed replacement rolls back the whole supplier import',async()=>{
 await rejects('SELECT public.replace_stock_snapshot($1,$2,$3)',[supplier,'2099-01-01',JSON.stringify([...imported,{supplier_sku:'INVALID',stock_on_hand:'bad'}])],/invalid input syntax/);
 assert.equal((await pg.query('SELECT count(*)::int AS n FROM stock_snapshots')).rows[0].n,1);
 assert.equal((await pg.query('SELECT source_supplier_sku FROM stock_snapshots')).rows[0].source_supplier_sku,'NATIVE-A');
});
await pg.close();
console.log(`${checks.length} stock accuracy checks passed.`);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ checkedAt: new Date().toISOString(), checks, runtime: 'Isolated PostgreSQL (PGlite 0.5.8) and actual application utilities; no live business writes.' }, null, 2));
fs.rmSync(temp, { recursive: true, force: true });
