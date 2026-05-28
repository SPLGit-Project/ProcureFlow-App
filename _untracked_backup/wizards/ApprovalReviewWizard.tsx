import WizardScaffold from './WizardScaffold';

export default function ApprovalReviewWizard() {
  return (
    <WizardScaffold
      title="Approval Review"
      subtitle="Approver wizard"
      contextTitle="Approval controls"
      contextLines={['Review the full request, item definition, pricing summary, and decision comments.']}
      steps={[
        { id: 'overview', label: 'Request Overview' },
        { id: 'definition', label: 'Item Definition' },
        { id: 'pricing', label: 'Pricing Summary' },
        { id: 'decision', label: 'Decision' },
      ]}
    />
  );
}
