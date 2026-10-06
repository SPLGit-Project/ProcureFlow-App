import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { createProductionServer } from '../../scripts/serve-production.mjs';

async function importTypeScript(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { FEATURE_UPDATES } = await importTypeScript('../../constants/featureUpdates.ts');
const { claimFeatureUpdatePresentation: claim, clearFeatureUpdatePresentation: clear, getFeatureUpdateSessionId } = await importTypeScript('../../utils/featureUpdateSession.ts');
const values = new Map();
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), key: index => [...values.keys()][index], get length() { return values.size; } };

test('ordinary close stays closed for reloads and route changes, then returns for the next sign-in', () => {
  clear(storage);
  assert.equal(claim('user-a', 'session-1', false, storage), true);
  assert.equal(claim('user-a', 'session-1', false, storage), false);
  assert.equal(claim('user-a', 'session-2', false, storage), true);
  assert.equal(claim('user-a', 'session-2', false, storage), false);
});
test('profile opt-out suppresses all sessions without suppressing other users', () => {
  clear(storage);
  assert.equal(claim('user-a', 'session-1', true, storage), false);
  assert.equal(claim('user-a', 'session-2', true, storage), false);
  assert.equal(claim('user-b', 'session-2', false, storage), true);
  assert.equal(claim('', 'session-1', false, storage), false);
  assert.equal(claim('user-a', '', false, storage), false);
});
test('sign-out resets presentation guards without clearing unrelated browser data', () => {
  clear(storage);
  storage.setItem('other-preference', 'keep');
  assert.equal(claim('user-a', 'session-1', false, storage), true);
  clear(storage);
  assert.equal(storage.getItem('other-preference'), 'keep');
  assert.equal(claim('user-a', 'session-1', false, storage), true);
});
test('blocked browser storage still presents once per sign-in and permits sign-out', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, get length() { throw new Error('blocked'); } };
  clear(blocked);
  assert.equal(claim('user-c', 'session-1', false, blocked), true);
  assert.equal(claim('user-c', 'session-1', false, blocked), false);
  assert.equal(claim('user-c', 'session-2', false, blocked), true);
});
test('token refresh preserves the session marker and does not retain access tokens', () => {
  const token = payload => `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
  assert.equal(getFeatureUpdateSessionId(token({ session_id: 'same-session', iat: 1 }), 'fallback'), 'same-session');
  assert.equal(getFeatureUpdateSessionId(token({ session_id: 'same-session', iat: 2 }), 'fallback'), 'same-session');
  assert.equal(getFeatureUpdateSessionId('malformed', 'last-sign-in'), 'last-sign-in');
});
test('all six guides use exact verified media stored outside the public app root', async () => {
  const root = new URL('../../Resources/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('feature-updates/2026-10-06/media-manifest.json', root), 'utf8'));
  assert.equal(FEATURE_UPDATES.length, 6);
  assert.equal(new Set(FEATURE_UPDATES.map(item => item.id)).size, 6);
  await assert.rejects(stat(new URL('../../public/feature-updates/2026-10-06', import.meta.url)), { code: 'ENOENT' });
  const server = createProductionServer({ root: root.pathname.replace(/^\/(?=[A-Z]:)/i, '') });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const feature of FEATURE_UPDATES) {
      for (const kind of ['pdf', 'video', 'poster']) {
        const path = feature[kind];
        const asset = manifest.files.find(file => path.endsWith('/' + file.file));
        assert.ok(asset, path);
        const data = await readFile(new URL('.' + path, root));
        assert.equal(data.length, asset.bytes, path);
        assert.equal(createHash('sha256').update(data).digest('hex'), asset.sha256, path);
        const response = await fetch(origin + path, { method: 'HEAD' });
        assert.equal(response.status, 200, path);
        assert.equal(response.headers.get('content-length'), String(asset.bytes), path);
        assert.ok(response.headers.get('content-type').startsWith({ pdf: 'application/pdf', video: 'video/mp4', poster: 'image/jpeg' }[kind]));
        if (kind !== 'poster') {
          const part = await fetch(origin + path, { headers: { range: 'bytes=0-31' } });
          assert.equal(part.status, 206);
          assert.equal(part.headers.get('content-range'), `bytes 0-31/${asset.bytes}`);
          assert.deepEqual(Buffer.from(await part.arrayBuffer()), data.subarray(0, 32));
        }
      }
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
