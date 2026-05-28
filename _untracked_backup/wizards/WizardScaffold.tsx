import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ItemRequestWizardShell, { WizardStep } from '../ItemRequestWizardShell';

interface WizardScaffoldProps {
  title: string;
  subtitle: string;
  steps: WizardStep[];
  contextTitle: string;
  contextLines: string[];
}

export default function WizardScaffold({ title, subtitle, steps, contextTitle, contextLines }: WizardScaffoldProps) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [step, setStep] = useState(0);
  const lastSavedAt = useMemo(() => new Date(), [step]);

  const isLast = step === steps.length - 1;

  return (
    <ItemRequestWizardShell
      title={title}
      subtitle={subtitle}
      steps={steps}
      activeStepIndex={step}
      onPrevious={() => setStep(value => Math.max(0, value - 1))}
      onContinue={() => {
        if (isLast) navigate(id ? `/items/requests/${id}` : '/items/my-requests');
        else setStep(value => Math.min(steps.length - 1, value + 1));
      }}
      onCancel={() => navigate('/')}
      continueLabel={isLast ? 'Finish local test' : 'Continue'}
      lastSavedAt={lastSavedAt}
      contextPanel={
        <aside className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-5">
          <p className="text-xs font-black uppercase tracking-widest text-[var(--color-brand)] mb-2">{contextTitle}</p>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            {id && <p><span className="font-bold">Request:</span> {id}</p>}
            {contextLines.map(line => <p key={line}>{line}</p>)}
          </div>
        </aside>
      }
    >
      <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-6">
        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
          {steps[step]?.id}
        </p>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3">
          {steps[step]?.label}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">
          {steps[step]?.description ?? 'This local smoke-test screen confirms the production wizard route, shell, progress tracker, and navigation controls are wired.'}
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm" placeholder="Local test field" />
          <input className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm" placeholder="Validation placeholder" />
        </div>
      </section>
    </ItemRequestWizardShell>
  );
}
