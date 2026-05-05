import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

interface UseItemWizardDraftOptions {
  requestId: string | null | undefined;
  stepKey: string;
}

interface DraftState<T> {
  data: T | null;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  error: string | null;
}

/**
 * Auto-saving draft hook for multi-step item request wizards.
 *
 * Loads the wizard_draft[stepKey] from the item_requests row on mount.
 * Any call to updateDraft merges data and schedules a DB write after 800 ms of
 * inactivity. Flushes immediately on unmount so no changes are lost on navigation.
 *
 * Usage:
 *   const { draft, updateDraft, flush } = useItemWizardDraft<MyStepData>({
 *     requestId: request.id,
 *     stepKey: 'item_details',
 *   });
 */
export function useItemWizardDraft<T extends Record<string, unknown>>({
  requestId,
  stepKey,
}: UseItemWizardDraftOptions) {
  const [state, setState] = useState<DraftState<T>>({
    data: null,
    isDirty: false,
    isSaving: false,
    lastSavedAt: null,
    error: null,
  });

  // Keep a ref to the latest pending data so flush() can always access it.
  const pendingRef = useRef<T | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  // ── Load draft from DB on mount / when requestId changes ──────────────────

  useEffect(() => {
    if (!requestId) return;

    let cancelled = false;

    async function loadDraft() {
      const { data, error } = await supabase
        .from('item_requests')
        .select('wizard_draft')
        .eq('id', requestId!)
        .single();

      if (cancelled) return;

      if (error) {
        setState(prev => ({ ...prev, error: error.message }));
        return;
      }

      const stepData = (data?.wizard_draft as Record<string, unknown> | null)?.[stepKey] as T | undefined;
      setState(prev => ({
        ...prev,
        data: stepData ?? null,
        isDirty: false,
        error: null,
      }));
    }

    loadDraft();
    return () => { cancelled = true; };
  }, [requestId, stepKey]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      // Flush any pending save before the component unmounts.
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      if (pendingRef.current && requestId) {
        // Fire-and-forget flush — component is unmounting so we can't await.
        void saveDraftToDb(requestId, stepKey, pendingRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, stepKey]);

  // ── DB write ───────────────────────────────────────────────────────────────

  async function saveDraftToDb(id: string, key: string, payload: T) {
    // Read the current wizard_draft, merge the step, then write back.
    const { data: current } = await supabase
      .from('item_requests')
      .select('wizard_draft')
      .eq('id', id)
      .single();

    const existingDraft = (current?.wizard_draft as Record<string, unknown>) ?? {};
    const merged = { ...existingDraft, [key]: payload };

    const { error } = await supabase
      .from('item_requests')
      .update({ wizard_draft: merged })
      .eq('id', id);

    return error;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Merge partial data into the draft and schedule a debounced save. */
  const updateDraft = useCallback((partial: Partial<T>) => {
    setState(prev => {
      const next = { ...(prev.data ?? {} as T), ...partial } as T;
      pendingRef.current = next;
      return { ...prev, data: next, isDirty: true };
    });

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      if (!requestId || !pendingRef.current) return;
      const payload = pendingRef.current;

      if (isMounted.current) setState(prev => ({ ...prev, isSaving: true }));

      const error = await saveDraftToDb(requestId, stepKey, payload);

      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          isSaving: false,
          isDirty: false,
          lastSavedAt: error ? prev.lastSavedAt : new Date(),
          error: error ? error.message : null,
        }));
        if (!error) pendingRef.current = null;
      }
    }, 800);
  }, [requestId, stepKey]);

  /** Immediately write any pending changes to the DB (e.g. before navigating). */
  const flush = useCallback(async (): Promise<void> => {
    if (!requestId || !pendingRef.current) return;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    const payload = pendingRef.current;
    if (isMounted.current) setState(prev => ({ ...prev, isSaving: true }));

    const error = await saveDraftToDb(requestId, stepKey, payload);

    if (isMounted.current) {
      setState(prev => ({
        ...prev,
        isSaving: false,
        isDirty: false,
        lastSavedAt: error ? prev.lastSavedAt : new Date(),
        error: error ? error.message : null,
      }));
      if (!error) pendingRef.current = null;
    }
  }, [requestId, stepKey]);

  return {
    draft: state.data,
    isDirty: state.isDirty,
    isSaving: state.isSaving,
    lastSavedAt: state.lastSavedAt,
    draftError: state.error,
    updateDraft,
    flush,
  };
}
