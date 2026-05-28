import WizardScaffold from './WizardScaffold';

export default function PricingSetupWizard() {
  return (
    <WizardScaffold
      title="Pricing Setup"
      subtitle="Pricing team wizard"
      contextTitle="Pricing context"
      contextLines={['Capture purchase pricing, sale pricing, margin review, and publish targets.']}
      steps={[
        { id: 'context', label: 'Context' },
        { id: 'purchase', label: 'Purchase Pricing' },
        { id: 'sale', label: 'Sale Pricing' },
        { id: 'margin', label: 'Margin Review' },
        { id: 'submit', label: 'Confirm & Submit' },
      ]}
    />
  );
}
