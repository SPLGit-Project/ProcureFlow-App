import WizardScaffold from './WizardScaffold';

export default function ItemRequestWizard() {
  return (
    <WizardScaffold
      title="New Item Request"
      subtitle="Requestor wizard"
      contextTitle="Request progress"
      contextLines={['Submitted -> Duplicate Check -> Definition -> Pricing -> Approval -> Active']}
      steps={[
        { id: 'type', label: 'Item Type', description: 'Select the request type and confirm the business scenario.' },
        { id: 'need', label: 'What You Need', description: 'Capture the item description, business reason, urgency, and activation date.' },
        { id: 'systems', label: "Where It's Needed", description: 'Choose target systems and conditional customer or replacement context.' },
        { id: 'review', label: 'Review & Submit', description: 'Review the request summary before sending it to Master Data.' },
      ]}
    />
  );
}
