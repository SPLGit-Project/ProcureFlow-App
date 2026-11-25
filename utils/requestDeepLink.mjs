const requestPathPattern = /^\/requests\/[A-Za-z0-9_-]{1,100}$/;
const retainedRequestKey = 'pf_request_after_sign_in';
const maxAgeMs = 15 * 60 * 1000;

export const SYDNEY_APPROVAL_SITE_ID = '77777777-7777-4777-8777-777777777777';

export function validRequestPath(value) {
  return typeof value === 'string' && requestPathPattern.test(value) ? value : null;
}

export function validLinkedRequestId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}


export function rememberRequestForSignIn(value, storage = undefined, now = Date.now()) {
  try {
    const target = storage ?? globalThis.sessionStorage;
    const path = validRequestPath(value);
    if (path) target.setItem(retainedRequestKey, JSON.stringify({ path, at: now }));
    else target.removeItem(retainedRequestKey);
  } catch {
    // Storage may be disabled in a Teams embedded browser. Keep normal sign-in available.
  }
}

export function takeRequestAfterSignIn(storage = undefined, now = Date.now()) {
  try {
    const target = storage ?? globalThis.sessionStorage;
    const raw = target.getItem(retainedRequestKey);
    target.removeItem(retainedRequestKey);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!Number.isFinite(saved?.at) || now < saved.at || now - saved.at > maxAgeMs) return null;
    return validRequestPath(saved.path);
  } catch {
    return null;
  }
}
