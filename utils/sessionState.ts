export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const SESSION_WARNING_WINDOW_MS = 5 * 60 * 1000;
export const SESSION_ACTIVITY_WRITE_THROTTLE_MS = 10 * 1000;
export const SESSION_NOTICE_MAX_AGE_MS = 15 * 60 * 1000;

const SESSION_LOGOUT_NOTICE_KEY = 'pf_session_logout_notice';

export type SessionLogoutReason = 'idle' | 'manual';

export interface SessionLogoutNotice {
  reason: SessionLogoutReason;
  createdAt: number;
}

export const getSessionActivityStorageKey = (userId: string) => `pf_session_activity:${userId}`;

export const writeSessionLogoutNotice = (notice: SessionLogoutNotice) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(SESSION_LOGOUT_NOTICE_KEY, JSON.stringify(notice));
  } catch (error) {
    console.warn('SessionState: Failed to persist logout notice.', error);
  }
};

export const consumeSessionLogoutNotice = (): SessionLogoutNotice | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(SESSION_LOGOUT_NOTICE_KEY);
    if (!raw) return null;

    window.localStorage.removeItem(SESSION_LOGOUT_NOTICE_KEY);

    const parsed = JSON.parse(raw) as Partial<SessionLogoutNotice>;
    if (!parsed || typeof parsed.createdAt !== 'number' || typeof parsed.reason !== 'string') {
      return null;
    }

    if (Date.now() - parsed.createdAt > SESSION_NOTICE_MAX_AGE_MS) {
      return null;
    }

    return parsed as SessionLogoutNotice;
  } catch (error) {
    console.warn('SessionState: Failed to read logout notice.', error);
    window.localStorage.removeItem(SESSION_LOGOUT_NOTICE_KEY);
    return null;
  }
};
