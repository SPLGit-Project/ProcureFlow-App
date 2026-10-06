import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const script = html.match(/<script id="startup-recovery">([\s\S]*?)<\/script>/)[1];

function browser({ started = false, retried = false, storageDenied = false } = {}) {
  const listeners = new Map();
  const redirects = [];
  const saved = new Map([
    ['auth-token', 'existing-session'], ['draft', 'unsaved-work'],
    ...(retried ? [['procureflow-startup-retry', String(Date.now())]] : []),
  ]);
  const root = { children: [], hasChildNodes: () => started || root.children.length > 0, append: element => root.children.push(element) };
  class HTMLScriptElement { type = 'module'; src = 'https://procureflow.example/assets/index.older123.js'; }
  const location = {
    href: 'https://procureflow.example/requests/123?filter=active#existing-fragment',
    origin: 'https://procureflow.example',
    replace: url => redirects.push(url), reload() {},
  };
  const context = vm.createContext({
    window: { location, addEventListener: (name, listener) => listeners.set(name, listener) },
    document: {
      getElementById: () => root,
      createElement: tag => ({ tag, style: {}, children: [], append(...children) { this.children.push(...children); } }),
    },
    sessionStorage: {
      getItem: key => { if (storageDenied) throw new Error('Storage disabled'); return saved.get(key) || null; },
      setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key),
    },
    URL, Date, HTMLScriptElement,
    MutationObserver: class { observe() {} disconnect() {} },
    setTimeout() {},
  });
  vm.runInContext(script, context);
  return { fail: () => listeners.get('error')({ target: new HTMLScriptElement() }), redirects, saved, root };
}

test('a failed startup module reloads once with a fresh URL and preserves user state', () => {
  const page = browser();
  page.fail();
  assert.equal(page.redirects.length, 1);
  const target = new URL(page.redirects[0]);
  assert.equal(target.pathname, '/requests/123');
  assert.equal(target.searchParams.get('filter'), 'active');
  assert.equal(target.hash, '#existing-fragment');
  assert.ok(target.searchParams.has('_pf_reload'));
  assert.equal(page.saved.get('auth-token'), 'existing-session');
  assert.equal(page.saved.get('draft'), 'unsaved-work');
});
test('repeat startup failure shows an actionable message without a reload loop', () => {
  const page = browser({ retried: true });
  page.fail();
  assert.equal(page.redirects.length, 0);
  assert.equal(page.root.children.length, 1);
  assert.equal(page.root.children[0].children[0].textContent, 'ProcureFlow could not finish loading');
  assert.equal(page.root.children[0].children[2].textContent, 'Reload ProcureFlow');
});
test('disabled browser storage falls back to a visible recovery action', () => {
  const page = browser({ storageDenied: true });
  page.fail();
  assert.equal(page.redirects.length, 0);
  assert.equal(page.root.children.length, 1);
});
test('a running app is not reloaded by the startup guard', () => {
  const page = browser({ started: true });
  page.fail();
  assert.equal(page.redirects.length, 0);
  assert.equal(page.root.children.length, 0);
});
