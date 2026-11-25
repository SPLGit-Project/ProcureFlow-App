import test from 'node:test';
import assert from 'node:assert/strict';
import { rememberRequestForSignIn, validLinkedRequestId, takeRequestAfterSignIn, validRequestPath } from '../../utils/requestDeepLink.mjs';

const sampleId = '00000000-0000-4000-8000-000000000042';
const path = `/requests/${sampleId}`;
const clock = 1_000_000;

function makeStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('a focused request query accepts only a single UUID', () => {
  assert.equal(validLinkedRequestId(sampleId), sampleId);
  for (const id of [null, 'site-01', '../approvals', `${sampleId}?x=1`, `${sampleId}\n`]) {
    assert.equal(validLinkedRequestId(id), null, String(id));
  }
});

test('sign-in target resumes one time across the same-tab OAuth round trip', () => {
  const storage = makeStorage();
  rememberRequestForSignIn(path, storage, clock);
  assert.equal(takeRequestAfterSignIn(storage, clock + 1_000), path);
  assert.equal(takeRequestAfterSignIn(storage, clock + 1_001), null);
});

test('sign-in target is time-boxed and not carried into ordinary logins', () => {
  const storage = makeStorage();
  rememberRequestForSignIn(path, storage, clock);
  assert.equal(takeRequestAfterSignIn(storage, clock + 901_000), null);
  rememberRequestForSignIn(path, storage, clock);
  rememberRequestForSignIn(null, storage, clock + 1);
  assert.equal(takeRequestAfterSignIn(storage, clock + 2), null);
});

test('only one clean internal requisition segment is allowed after sign-in', () => {
  for (const target of [null, '/approvals', '//example.com/requests/1', 'https://example.com', '/requests/%2e%2e', '/requests/..', '/requests/x?extra=1', '/requests/x#fragment', '/requests/a/b', '/requests/\\evil', '/requests/abc\n']) {
    assert.equal(validRequestPath(target), null, String(target));
  }
  assert.equal(validRequestPath(path), path);
});

test('absent or denied storage does not break sign-in', () => {
  const blocked = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
  };
  assert.doesNotThrow(() => rememberRequestForSignIn(path, blocked, clock));
  assert.equal(takeRequestAfterSignIn(blocked, clock), null);
});
