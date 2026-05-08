import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight } from 'lucide-react';
import { useSetPageMeta } from '../context/PageMetaContext';

// ── Step definitions ───────────────────────────────────────────────────────────

export interface WizardStep {
  id: string;
  label: string;
  description?: string;
}

export type StepStatus = 'completed' | 'active' | 'pending';

// ── Props ──────────────────────────────────────────────────────────────────────

export interface ItemRequestWizardShellProps {
  /** Page title shown in the floating top-bar (revamp) or as the document title */
  title: string;
  /** Optional subtitle for the top-bar */
  subtitle?: string;
  /** Ordered step list */
  steps: WizardStep[];
  /** Zero-based index of the currently active step */
  activeStepIndex: number;
  /** Main form / content for the current step */
  children: React.ReactNode;
  /** Optional sticky context panel content (right column, 1/3 width on lg+) */
  contextPanel?: React.ReactNode;
  /** Label for the forward action button. Defaults to "Continue" or "Submit" on last step */
  continueLabel?: string;
  /** Called when the user clicks Continue / Submit */
  onContinue: () => void | Promise<void>;
  /** Called when the user clicks Previous (not shown on step 0) */
  onPrevious?: () => void;
  /** Called when the user clicks the back arrow / cancel */
  onCancel?: () => void;
  /** Disables the continue button (e.g. while validation is in progress) */
  continueDisabled?: boolean;
  /** Shows a saving indicator in the footer */
  isSaving?: boolean;
  /** "Saved X ago" label shown when isSaving is false and a save has occurred */
  lastSavedAt?: Date | null;
  /** If true, renders a loading skeleton instead of children */
  isLoading?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function stepStatus(index: number, activeIndex: number): StepStatus {
  if (index < activeIndex) return 'completed';
  if (index === activeIndex) return 'active';
  return 'pending';
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface StepperProps {
  steps: WizardStep[];
  activeStepIndex: number;
}

function HorizontalStepper({ steps, activeStepIndex }: StepperProps) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1 scrollbar-none">
      {steps.map((step, idx) => {
        const status = stepStatus(idx, activeStepIndex);
        const isLast = idx === steps.length - 1;

        return (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-2 shrink-0">
              {/* Step bubble */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all border-2 ${
                  status === 'completed'
                    ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white'
                    : status === 'active'
                    ? 'bg-white dark:bg-[#1e2029] border-[var(--color-brand)] text-[var(--color-brand)]'
                    : 'bg-white dark:bg-[#1e2029] border-gray-200 dark:border-gray-700 text-gray-400'
                }`}
              >
                {status === 'completed' ? (
                  <Check size={12} strokeWidth={3} />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              {/* Step label */}
              <span
                className={`text-xs font-bold whitespace-nowrap transition-colors ${
                  status === 'active'
                    ? 'text-gray-900 dark:text-white'
                    : status === 'completed'
                    ? 'text-[var(--color-brand)]'
                    : 'text-gray-400 dark:text-gray-600'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {!isLast && (
              <div className="mx-3 flex-shrink-0">
                <ChevronRight
                  size={14}
                  className={
                    idx < activeStepIndex
                      ? 'text-[var(--color-brand)]'
                      : 'text-gray-300 dark:text-gray-700'
                  }
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-6 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg" />
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800/60 rounded-2xl" />
        ))}
      </div>
      <div className="h-24 bg-gray-100 dark:bg-gray-800/60 rounded-2xl" />
    </div>
  );
}

// ── Main shell ─────────────────────────────────────────────────────────────────

const ItemRequestWizardShell: React.FC<ItemRequestWizardShellProps> = ({
  title,
  subtitle,
  steps,
  activeStepIndex,
  children,
  contextPanel,
  continueLabel,
  onContinue,
  onPrevious,
  onCancel,
  continueDisabled = false,
  isSaving = false,
  lastSavedAt = null,
  isLoading = false,
}) => {
  const navigate = useNavigate();
  const isFirstStep = activeStepIndex === 0;
  const isLastStep = activeStepIndex === steps.length - 1;
  const activeStep = steps[activeStepIndex];
  const forwardLabel = continueLabel ?? (isLastStep ? 'Submit' : 'Continue');

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  };

  // Broadcast step info + subtitle + wizard actions to the Layout header
  useSetPageMeta({
    subtitle,
    stepInfo: activeStep
      ? { current: activeStepIndex + 1, total: steps.length, label: activeStep.label }
      : undefined,
    wizardActions: {
      onCancel: handleCancel,
      onPrevious: !isFirstStep && onPrevious ? onPrevious : undefined,
      onContinue,
      continueLabel: forwardLabel,
      continueDisabled: continueDisabled || isSaving,
      isSaving,
      lastSavedAt,
      showPrevious: !isFirstStep && !!onPrevious,
    },
  });

  return (
    <div className="flex flex-col min-h-full animate-page-entry">

      {/* ── Horizontal stepper ─────────────────────────────────────────────── */}
      <div className="px-8 py-4 border-b border-gray-100 dark:border-gray-800">
        <HorizontalStepper steps={steps} activeStepIndex={activeStepIndex} />
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 px-8 py-8">
        <div className={`max-w-6xl mx-auto ${contextPanel ? 'grid grid-cols-1 lg:grid-cols-3 gap-8' : ''}`}>

          {/* Main content — 2/3 width when context panel present */}
          <div className={contextPanel ? 'lg:col-span-2' : ''}>
            {isLoading ? <LoadingSkeleton /> : children}
          </div>

          {/* Context / guidance panel — sticky on scroll */}
          {contextPanel && (
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-8 space-y-4">
                {contextPanel}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default ItemRequestWizardShell;
