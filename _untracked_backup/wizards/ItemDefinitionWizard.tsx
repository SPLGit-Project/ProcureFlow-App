import WizardScaffold from './WizardScaffold';

export default function ItemDefinitionWizard() {
  return (
    <WizardScaffold
      title="Item Definition"
      subtitle="Master Data wizard"
      contextTitle="Originating request"
      contextLines={['Define classification, identity, physical attributes, flags, and stock levels.']}
      steps={[
        { id: 'classification', label: 'Classification' },
        { id: 'identity', label: 'Identity' },
        { id: 'attributes', label: 'Physical Attributes' },
        { id: 'flags', label: 'System Flags' },
        { id: 'stock', label: 'Stock Levels' },
        { id: 'review', label: 'Review & Confirm' },
      ]}
    />
  );
}
