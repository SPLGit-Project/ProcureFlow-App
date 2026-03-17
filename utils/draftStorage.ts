import React from 'react';

const DEFAULT_DRAFT_VERSION = 1;
const DEFAULT_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DEBOUNCE_MS = 350;

interface StoredDraftEnvelope<T> {
  version: number;
  savedAt: number;
  expiresAt: number;
  data: T;
}

interface DraftLoadOptions {
  version?: number;
  ttlMs?: number;
}

interface DraftPersistenceOptions<T> extends DraftLoadOptions {
  debounceMs?: number;
  enabled?: boolean;
  isEmpty?: (value: T) => boolean;
}

const canUseDraftStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const readDraft = <T>(key: string, options: DraftLoadOptions = {}): T | null => {
  if (!key || !canUseDraftStorage()) return null;

  const version = options.version ?? DEFAULT_DRAFT_VERSION;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredDraftEnvelope<T>>;
    if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) {
      window.localStorage.removeItem(key);
      return null;
    }

    if ((parsed.version ?? version) !== version) {
      window.localStorage.removeItem(key);
      return null;
    }

    if (typeof parsed.expiresAt === 'number' && parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed.data as T;
  } catch (error) {
    console.warn(`DraftStorage: Failed to read draft "${key}".`, error);
    window.localStorage.removeItem(key);
    return null;
  }
};

export const clearDraft = (key: string) => {
  if (!key || !canUseDraftStorage()) return;

  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn(`DraftStorage: Failed to clear draft "${key}".`, error);
  }
};

const writeDraft = <T>(key: string, value: T, options: DraftLoadOptions = {}) => {
  if (!key || !canUseDraftStorage()) return;

  const version = options.version ?? DEFAULT_DRAFT_VERSION;
  const ttlMs = options.ttlMs ?? DEFAULT_DRAFT_TTL_MS;
  const savedAt = Date.now();

  const payload: StoredDraftEnvelope<T> = {
    version,
    savedAt,
    expiresAt: savedAt + ttlMs,
    data: value
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.warn(`DraftStorage: Failed to persist draft "${key}".`, error);
  }
};

export const useDraftPersistence = <T>(
  key: string,
  value: T,
  options: DraftPersistenceOptions<T> = {}
) => {
  const {
    debounceMs = DEFAULT_DEBOUNCE_MS,
    enabled = true,
    isEmpty,
    ttlMs = DEFAULT_DRAFT_TTL_MS,
    version = DEFAULT_DRAFT_VERSION
  } = options;

  React.useEffect(() => {
    if (!enabled || !key) return;

    const timer = window.setTimeout(() => {
      if (isEmpty?.(value)) {
        clearDraft(key);
        return;
      }

      writeDraft(key, value, { ttlMs, version });
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [debounceMs, enabled, isEmpty, key, ttlMs, value, version]);
};
