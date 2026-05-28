import { useCallback, useEffect, useState } from 'react';

export function useItemWizardDraft<T>(key: string, initialValue: T) {
  const [draft, setDraft] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) as T : initialValue;
    } catch {
      return initialValue;
    }
  });
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(draft));
    setLastSavedAt(new Date());
  }, [draft, key]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(key);
    setDraft(initialValue);
    setLastSavedAt(null);
  }, [initialValue, key]);

  return { draft, setDraft, lastSavedAt, clearDraft, isSaving: false };
}
