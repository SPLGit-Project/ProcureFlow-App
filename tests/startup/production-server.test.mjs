import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProductionServer } from '../../scripts/serve-production.mjs';

let root, server, origin;
before(async () => {
  root = await mkdtemp(join(tmpdir(), 'procureflow-http-'));
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'index.html'), '<!DOCTYPE html><div id="root"></div>');
  await writeFile(join(root, 'assets/index.ABC12345.js'), 'console.log("current");');
  await writeFile(join(root, 'assets/index.ABC12345.css'), 'body { color: white; }');
  await writeFile(join(root, 'sw.js'), '// worker');
  await writeFile(join(root, 'version.json'), '{"version":"current"}');
  await writeFile(join(root, 'clip.mp4'), '0123456789');
  server = createProductionServer({ root });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  // This is the exact temporary fixture directory created above.
  await rm(root, { recursive: true, force: true });
});

test('old hashed JavaScript returns 404 text, even with a navigation Accept header', async () => {
  for (const accept of ['*/*', 'text/html']) {
    const response = await fetch(`${origin}/assets/index.CJlnkEEg.js`, { headers: { accept } });
    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type'), /^text\/plain/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(await response.text(), 'Not found');
  }
});
test('missing static files and API paths never fall back to the app document', async () => {
  for (const path of ['/missing.css', '/version-missing.json', '/icons/missing', '/assets/missing', '/api/missing']) {
    const response = await fetch(origin + path, { headers: { accept: 'text/html' } });
    assert.equal(response.status, 404, path);
    assert.doesNotMatch(await response.text(), /<!DOCTYPE html>/);
  }
});
test('root and browser navigation routes still serve the SPA with no-store', async () => {
  for (const path of ['/', '/login', '/requests/123', '/supplier-stock', '/invite?token=example']) {
    const response = await fetch(origin + path, { headers: { accept: 'text/html' } });
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type'), /^text\/html/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(await response.text(), /id="root"/);
  }
});
test('current JavaScript and CSS have correct MIME types and immutable caching', async () => {
  for (const [path, type] of [['index.ABC12345.js', 'application/javascript'], ['index.ABC12345.css', 'text/css']]) {
    const response = await fetch(`${origin}/assets/${path}`);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type').startsWith(type));
    assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  }
});
test('service worker and version are never stored in the HTTP cache', async () => {
  for (const path of ['/sw.js', '/version.json?cache-bust=1']) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});
test('HEAD has the same headers and status without a body', async () => {
  const response = await fetch(`${origin}/assets/index.ABC12345.js`, { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert.ok(Number(response.headers.get('content-length')) > 0);
  assert.equal(await response.text(), '');
  assert.equal((await fetch(`${origin}/assets/old.js`, { method: 'HEAD' })).status, 404);
});
test('video byte ranges remain supported', async () => {
  const response = await fetch(`${origin}/clip.mp4`, { headers: { range: 'bytes=2-5' } });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), 'bytes 2-5/10');
  assert.equal(await response.text(), '2345');
  const suffix = await fetch(`${origin}/clip.mp4`, { headers: { range: 'bytes=-3' } });
  assert.equal(await suffix.text(), '789');
  assert.equal((await fetch(`${origin}/clip.mp4`, { headers: { range: 'bytes=15-' } })).status, 416);
});
test('encoded traversal, hidden files, and malformed paths are rejected', async () => {
  for (const path of ['/%2eenv', '/%2e%2e%2fpackage.json', '/%5c..%5cpackage.json']) {
    assert.equal((await fetch(origin + path)).status, 404, path);
  }
  assert.equal((await fetch(`${origin}/%invalid`)).status, 400);
});
test('non-navigation and non-read requests never receive the SPA shell', async () => {
  assert.equal((await fetch(`${origin}/missing`, { headers: { accept: 'application/json' } })).status, 404);
  const response = await fetch(`${origin}/login`, { method: 'POST' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
});
