import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const workerSource = await readFile(new URL('../../public/sw.js', import.meta.url), 'utf8');

async function requestAsset({ cached, network }) {
  const events = new Map();
  const saved = [];
  let fetchCount = 0;
  const context = vm.createContext({
    self: { addEventListener: (name, handler) => events.set(name, handler) },
    URL, Response, Headers, console: { log() {}, error() {} },
    caches: {
      match: async () => cached,
      open: async () => ({ put: (_request, response) => saved.push(response) }),
    },
    fetch: async () => { fetchCount++; if (network instanceof Error) throw network; return network; },
  });
  vm.runInContext(workerSource, context);
  let response;
  events.get('fetch')({
    request: new Request('https://procureflow.example/assets/index.older123.js'),
    respondWith: result => { response = result; },
  });
  return { response: await response, saved, fetchCount };
}

test('a previously cached HTML response cannot be reused as a JavaScript module', async () => {
  const result = await requestAsset({
    cached: new Response('<!DOCTYPE html>old shell', { headers: { 'Content-Type': 'text/html' } }),
    network: new Response('console.log("correct");', { headers: { 'Content-Type': 'application/javascript' } }),
  });
  assert.equal(result.fetchCount, 1);
  assert.equal(await result.response.text(), 'console.log("correct");');
  assert.equal(result.saved.length, 1);
});
test('HTML from a legacy asset fallback is rejected and never cached', async () => {
  const result = await requestAsset({ network: new Response('<!DOCTYPE html>', { headers: { 'Content-Type': 'text/html' } }) });
  assert.equal(result.response.status, 503);
  assert.equal(result.saved.length, 0);
  assert.match(result.response.headers.get('content-type'), /^text\/plain/);
});
test('an offline request cannot fall back to poisoned HTML in cache', async () => {
  const result = await requestAsset({
    cached: new Response('<!DOCTYPE html>', { headers: { 'Content-Type': 'text/html' } }),
    network: new TypeError('Offline'),
  });
  assert.equal(result.response.status, 503);
  assert.doesNotMatch(await result.response.text(), /DOCTYPE/);
});
test('valid cached JavaScript remains available offline', async () => {
  const result = await requestAsset({
    cached: new Response('console.log("cached");', { headers: { 'Content-Type': 'text/javascript' } }),
    network: new TypeError('Offline'),
  });
  assert.equal(result.fetchCount, 0);
  assert.equal(await result.response.text(), 'console.log("cached");');
});
