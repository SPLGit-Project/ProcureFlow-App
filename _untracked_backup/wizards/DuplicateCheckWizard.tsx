import WizardScaffold from './WizardScaffold';

export default function DuplicateCheckWizard() {
  return (
    <WizardScaffold
      title="Duplicate Check"
      subtitle="Master Data wizard"
      contextTitle="Master Data handoff"
      contextLines={['Record exact duplicate, similar-new-required, or no-duplicate outcome.']}
      steps={[
        { id: 'summary', label: 'Request Summary' },
        { id: 'search', label: 'Catalogue Search' },
        { id: 'outcome', label: 'Outcome Decision' },
        { id: 'confirm', label: 'Confirm & Record' },
      ]}
    />
  );
}
