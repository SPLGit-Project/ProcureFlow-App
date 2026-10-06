// Presentation markers contain only opaque identifiers, never access tokens.
const keyPrefix = 'pf-feature-updates-seen:v1:';
const seenInMemory = new Set<string>();

export function getFeatureUpdateSessionId(accessToken: string, fallback: string): string {
  try {
    const payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload));
    return typeof claims.session_id === 'string' && claims.session_id ? claims.session_id : fallback;
  } catch { return fallback; }
}

export function claimFeatureUpdatePresentation(userId: string, sessionId: string, hidden: boolean, storage?: Storage): boolean {
  if (hidden || !userId || !sessionId) return false;
  const key = `${keyPrefix}${userId}`;
  const marker = `${key}:${sessionId}`;
  if (seenInMemory.has(marker)) return false;
  try {
    if (storage?.getItem(key) === sessionId) {
      seenInMemory.add(marker);
      return false;
    }
    storage?.setItem(key, sessionId);
  } catch { /* Private browsing: keep the once-per-sign-in guard in memory. */ }
  seenInMemory.add(marker);
  return true;
}

export function clearFeatureUpdatePresentation(storage?: Storage): void {
  seenInMemory.clear();
  try {
    const keys = Array.from({ length: storage?.length ?? 0 }, (_, index) => storage!.key(index));
    for (const key of keys) if (key?.startsWith(keyPrefix)) storage?.removeItem(key);
  } catch { /* Storage availability must never prevent sign-out. */ }
}
