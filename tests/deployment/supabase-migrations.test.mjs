import test from 'node:test';
import assert from 'node:assert/strict';
import { migrationHash, verifyMigrationHistory, verifyRepository } from '../../scripts/verify_supabase_migrations.mjs';

const version = '20261006053009';
const file = `${version}_feature_update_media_access.sql`;
const sql = 'select 1;\n';
const history = { projectRef: 'yasosgkznoxamysutxfc', latestVersion: version,
  migrations: [{ version, file, sha256: migrationHash(sql) }] };
const files = () => new Map([[file, sql]]);

test('the repository contains the complete unchanged production history', async () => {
  const result = await verifyRepository();
  assert.equal(result.recorded, 99);
  assert.ok(result.pending >= 0);
});
test('new migrations may follow the reconciled history', () => {
  const input = files();
  input.set('20261007080000_next_change.sql', 'select 2;');
  assert.deepEqual(verifyMigrationHistory(history, input), { recorded: 1, pending: 1 });
});
test('line endings do not change migration content', () => {
  assert.equal(migrationHash('select 1;\r\n'), migrationHash(sql));
});
test('modified applied SQL cannot be silently redeployed', () => {
  assert.throws(() => verifyMigrationHistory(history, new Map([[file, 'select 2;']])), /Applied migration changed/);
});
test('a historical script absent from production cannot be replayed automatically', () => {
  const input = files();
  input.set('20261006052912_feature_update_media_access.sql', sql);
  assert.throws(() => verifyMigrationHistory(history, input), /Unrecorded historical migration/);
});
test('missing or renamed applied migrations are rejected', () => {
  assert.throws(() => verifyMigrationHistory(history, new Map()), /Recorded production migration missing/);
  assert.throws(() => verifyMigrationHistory(history, new Map([[`${version}_renamed.sql`, sql]])), /Applied migration changed/);
});
test('duplicate and malformed versions are rejected before the CLI can skip them', () => {
  const input = files();
  input.set(`${version}_duplicate.sql`, sql);
  assert.throws(() => verifyMigrationHistory(history, input), /Duplicate migration version/);
  assert.throws(() => verifyMigrationHistory(history, new Map([['20240130_old.sql', sql]])), /Invalid migration filename/);
});
