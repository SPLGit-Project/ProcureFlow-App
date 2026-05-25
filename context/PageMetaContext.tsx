import React from 'react';

export interface StepInfo {
  current: number;
  total: number;
  label: string;
}

export interface WizardActions {
  onCancel?: () => void;
  onPrevious?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  isSaving?: boolean;
  lastSavedAt?: Date | null;
  showPrevious?: boolean;
}

export interface PageMeta {
  subtitle?: string;
  helpTitle?: string;
  helpDescription?: string;
  helpLinkTarget?: string;
  /** When set, the Layout header renders a live "Step X of Y · Label" pill */
  stepInfo?: StepInfo;
  /** When set, the Layout header renders wizard action buttons */
  wizardActions?: WizardActions;
  /** When true, disables body scroll on desktop to allow child scroll containers */
  disableBodyScroll?: boolean;
}

export interface PageMetaContextType {
  registerMeta: (id: string, meta: PageMeta) => void;
  unregisterMeta: (id: string) => void;
}

const PageMetaContext = React.createContext<PageMetaContextType>({
  registerMeta: () => {},
  unregisterMeta: () => {},
});

export default PageMetaContext;

// Kept for import compatibility — no longer used for wizard buttons.
export const WizardActionsContext = React.createContext<WizardActions | null>(null);

export const useSetPageMeta = (meta: PageMeta) => {
  const { registerMeta, unregisterMeta } = React.useContext(PageMetaContext);
  const idRef = React.useRef<string | null>(null);
  if (idRef.current === null) {
    idRef.current = Math.random().toString(36).substring(2, 9);
  }
  const id = idRef.current;

  // Key tracks every value that should trigger a header re-render.
  // Callback functions are NOT included — they are stable ref-wrappers
  // (see ItemRequestWizardShell) so the key never goes stale for them.
  const key = [
    meta.subtitle ?? '',
    meta.helpTitle ?? '',
    meta.helpLinkTarget ?? '',
    meta.stepInfo ? `${meta.stepInfo.current}/${meta.stepInfo.total}/${meta.stepInfo.label}` : '',
    String(meta.disableBodyScroll ?? false),
    meta.wizardActions
      ? [
          meta.wizardActions.continueLabel ?? '',
          String(meta.wizardActions.continueDisabled ?? false),
          String(meta.wizardActions.isSaving ?? false),
          String(meta.wizardActions.showPrevious ?? false),
          meta.wizardActions.lastSavedAt
            ? meta.wizardActions.lastSavedAt.toISOString().slice(0, 16)
            : '',
        ].join(':')
      : '',
  ].join('|');

  React.useEffect(() => {
    registerMeta(id, meta);
    return () => {
      unregisterMeta(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, id]);
};

