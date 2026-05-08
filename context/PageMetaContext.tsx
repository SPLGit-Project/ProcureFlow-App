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
}

const PageMetaContext = React.createContext<{
  setMeta: (meta: PageMeta) => void;
}>({ setMeta: () => {} });

export default PageMetaContext;

/**
 * Separate context for wizard action callbacks.
 * Uses a plain React context (not the key-debounced PageMeta system) so that
 * callbacks always reflect the latest closure — no stale-capture problem.
 */
export const WizardActionsContext = React.createContext<WizardActions | null>(null);

export const useSetPageMeta = (meta: PageMeta) => {
  const { setMeta } = React.useContext(PageMetaContext);
  const key = [
    meta.subtitle ?? '',
    meta.helpTitle ?? '',
    meta.helpLinkTarget ?? '',
    meta.stepInfo ? `${meta.stepInfo.current}/${meta.stepInfo.total}/${meta.stepInfo.label}` : '',
  ].join('|');
  React.useEffect(() => {
    setMeta(meta);
    return () => setMeta({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
};
