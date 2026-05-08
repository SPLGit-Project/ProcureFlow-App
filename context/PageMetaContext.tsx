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
}

const PageMetaContext = React.createContext<{
  setMeta: (meta: PageMeta) => void;
}>({ setMeta: () => {} });

export default PageMetaContext;

// Kept for import compatibility — no longer used for wizard buttons.
export const WizardActionsContext = React.createContext<WizardActions | null>(null);

export const useSetPageMeta = (meta: PageMeta) => {
  const { setMeta } = React.useContext(PageMetaContext);
  // Key tracks every value that should trigger a header re-render.
  // Callback functions are NOT included — they are stable ref-wrappers
  // (see ItemRequestWizardShell) so the key never goes stale for them.
  const key = [
    meta.subtitle ?? '',
    meta.helpTitle ?? '',
    meta.helpLinkTarget ?? '',
    meta.stepInfo ? `${meta.stepInfo.current}/${meta.stepInfo.total}/${meta.stepInfo.label}` : '',
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
    setMeta(meta);
    return () => setMeta({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
};
