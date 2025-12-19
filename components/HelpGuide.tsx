import React, { useState, useEffect } from 'react';
import { 
    FileText, CheckCircle, Database, Truck, DollarSign, ArrowRight, 
    Search, HelpCircle, BookOpen, MessageSquare, PlayCircle, 
    Settings, Users, Shield, CreditCard, Box, Zap, ChevronDown, ChevronRight,
    MousePointer, Link as LinkIcon, X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

const HelpGuide = () => {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'overview' | 'manual' | 'faq'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  // Handle Deep Linking
  useEffect(() => {
      const section = searchParams.get('section');
      if (section) {
          if (section.includes('request')) setActiveTab('manual');
          if (section.includes('approval')) setActiveTab('manual');
          if (section.includes('finance')) setActiveTab('manual');
          
          // Scroll to element after render
          setTimeout(() => {
              const el = document.getElementById(section);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
      }
  }, [searchParams]);

  // Determine current role context
  const role = currentUser?.role || 'SITE_USER';
  const isAdmin = role === 'ADMIN';
  const isApprover = role.includes('APPROVER') || role === 'ADMIN';

  // --- Quick Actions ---
  const quickActions = [
      { 
          label: 'Create Request', 
          icon: FileText, 
          path: '/create', 
          color: 'bg-blue-500', 
          visible: true,
          desc: 'Start a new purchase order'
      },
      { 
          label: 'My Requests', 
          icon: Box, 
          path: '/requests', 
          color: 'bg-indigo-500', 
          visible: true,
          desc: 'Track your existing orders'
      },
      { 
          label: 'Pending Approvals', 
          icon: CheckCircle, 
          path: '/approvals', 
          color: 'bg-amber-500', 
          visible: isApprover,
          desc: 'Review and approve POs'
      },
      { 
          label: 'System Settings', 
          icon: Settings, 
          path: '/settings', 
          color: 'bg-slate-700', 
          visible: isAdmin,
          desc: 'Configure app preferences'
      },
      { 
          label: 'Reports', 
          icon: Database, 
          path: '/reports', 
          color: 'bg-emerald-600', 
          visible: isAdmin || isApprover,
          desc: 'View spending analytics'
      }
  ];

  // --- Workflow Steps for Visualizer ---
  const workflowSteps = [
      { 
          id: 'create', icon: FileText, label: '1. Create', color: 'bg-blue-500', 
          desc: 'Requester builds cart from catalog items.' 
      },
      { 
          id: 'approve', icon: CheckCircle, label: '2. Approve', color: 'bg-amber-500', 
          desc: 'Manager reviews based on total value.' 
      },
      { 
          id: 'concur', icon: LinkIcon, label: '3. Sync', color: 'bg-indigo-500', 
          desc: 'PO is created in Concur and linked back.' 
      },
      { 
          id: 'receive', icon: Truck, label: '4. Receive', color: 'bg-emerald-500', 
          desc: 'Goods arrive, delivery is recorded.' 
      },
      { 
          id: 'finance', icon: DollarSign, label: '5. Finance', color: 'bg-purple-500', 
          desc: 'Invoices matched and capitalised.' 
      }
  ];

  // --- Detailed Content ---
  const manualSections = [
      {
          id: 'create',
          title: 'Creating a Purchase Request',
          icon: FileText,
          content: (
              <div className="space-y-4">
                  <p>Starting a new order is simple. Navigate to the <strong>New Request</strong> page via the sidebar or Quick Actions.</p>
                  <ul className="list-disc pl-5 space-y-2 text-gray-600 dark:text-gray-300">
                      <li><strong>Select Site & Supplier:</strong> Choose where the items are going and who needs to be paid.</li>
                      <li><strong>Browse Catalog:</strong> Search for items by name or SKU. Stock levels are shown in real-time.</li>
                      <li><strong>Add to Cart:</strong> Click the "+" button, then adjust quantities in the cart summary.</li>
                      <li><strong>Special items?</strong> If you can't find an item but know the supplier has it, use the "Add Special Request" button (Admin feature) or contact Procurement.</li>
                      <li><strong>Submit:</strong> Once ready, click "Submit Request". Your notification will go to the relevant approver immediately.</li>
                  </ul>
              </div>
          )
      },
      {
          id: 'approve',
          title: 'Approval Workflow',
          icon: CheckCircle,
          content: (
              <div className="space-y-4">
                  <p>Requests follow a strict approval chain based on value thresholds configured in Settings.</p>
                  <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-100 dark:border-amber-800/30">
                      <h4 className="font-bold text-amber-800 dark:text-amber-400 text-sm mb-2 flex items-center gap-2"><Shield size={14}/> Important Rule</h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300">You cannot approve your own requests. If you are an approver and submit a request, it must be approved by another manager.</p>
                  </div>
                  <ul className="list-disc pl-5 space-y-2 text-gray-600 dark:text-gray-300">
                      <li><strong>Notification:</strong> Approvers receive an email and a dashboard alert.</li>
                      <li><strong>Action:</strong> Approvers can 'Approve' or 'Reject' (with comments).</li>
                      <li><strong>Outcome:</strong> Approved requests move to "Pending Concur". Rejected requests return to the user for editing.</li>
                  </ul>
              </div>
          )
      },
      {
          id: 'concur',
          title: 'Concur Synchronization',
          icon: LinkIcon,
          content: (
              <div className="space-y-4">
                  <p>Once approved, requests must be synchronized with SAP Concur to generate a formal PO.</p>
                  <ul className="list-disc pl-5 space-y-2 text-gray-600 dark:text-gray-300">
                      <li><strong>Data Export:</strong> Use the "Details for Concur" button to get the CSV/Excel data.</li>
                      <li><strong>PO Creation:</strong> Create the PO in Concur following your standard finance process.</li>
                      <li><strong>Linking:</strong> Use the "Link Concur PO" button to enter the Concur PO ID. This activates the order in ProcureFlow.</li>
                  </ul>
              </div>
          )
      },
      {
          id: 'receive',
          title: 'Receiving Goods',
          icon: Truck,
          content: (
              <div className="space-y-4">
                  <p>When items arrive at the site, accurate receiving is critical for finance matching.</p>
                  <ul className="list-disc pl-5 space-y-2 text-gray-600 dark:text-gray-300">
                      <li><strong>Record Delivery:</strong> Open the PO and click "Record Delivery".</li>
                      <li><strong>Matching:</strong> Enter the quantity received against each line item from the packing slip.</li>
                      <li><strong>Dockets:</strong> Upload or record the delivery docket/reference number.</li>
                      <li><strong>Partial Receipts:</strong> If a shipment is split, record only what arrived. The PO remains active for remaining items.</li>
                  </ul>
              </div>
          )
      },
      {
          id: 'finance',
          title: 'Finance & Capitalization',
          icon: DollarSign,
          content: (
              <div className="space-y-4">
                  <p>The Finance team reviews all received deliveries to determine asset capitalization.</p>
                  <ul className="list-disc pl-5 space-y-2 text-gray-600 dark:text-gray-300">
                      <li><strong>Invoice Matching:</strong> Enter the supplier invoice number against the delivery line.</li>
                      <li><strong>Capitalization Toggle:</strong> Mark items as "Assets" (Capitalised) or "Expense".</li>
                      <li><strong>Date:</strong> The system auto-records the capitalization date, which can be adjusted if needed.</li>
                  </ul>
              </div>
          )
      }
  ];

  // --- FAQs ---
  const faqs = [
      {
          q: 'How do I reset my password?',
          a: 'Since we use Azure AD for authentication, please use your company Microsoft 365 portal to reset your password.'
      },
      {
          q: 'Why can\'t I find an item in the catalog?',
          a: 'The catalog is managed by the Procurement team. If an item is missing, please contact support to have it added.'
      },
      {
          q: 'What happens if my order is rejected?',
          a: 'You will receive a notification with the rejection reason. You can then edit the request and resubmit it.'
      },
      {
          q: 'Can I approve my own requests?',
          a: 'No, for compliance reasons, a requestor cannot be the approver for their own purchase order.'
      }
  ];

  const filteredFaqs = faqs.filter(f => 
      f.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
      f.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-8 animate-fade-in">
        
        {/* Dynamic Hero Section */}
        <div className="bg-gradient-to-r from-[var(--color-brand)] to-indigo-900 rounded-3xl p-10 md:p-14 text-white text-center relative overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20">
                <div className="absolute top-[-50px] left-[-50px] w-64 h-64 bg-white rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-50px] right-[-50px] w-80 h-80 bg-blue-400 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
                <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
                    Hello, {currentUser?.name.split(' ')[0] || 'there'}. <br/>
                    <span className="text-white/80 text-2xl md:text-4xl">How can we help?</span>
                </h1>
                
                <div className="relative mt-8">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
                    <input 
                        type="text" 
                        placeholder="Search usage guides, troubleshooting..." 
                        className="w-full pl-12 pr-4 py-4 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-white/20 shadow-lg text-lg"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if(e.target.value) setActiveTab('faq');
                        }}
                    />
                </div>
            </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="overflow-x-auto pb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 px-1">
                <Zap className="text-[var(--color-brand)]" size={20}/> Quick Actions
            </h2>
            <div className="flex gap-4 min-w-max">
                {quickActions.filter(a => a.visible).map((action, idx) => (
                    <button 
                        key={idx}
                        onClick={() => navigate(action.path)}
                        className="bg-white dark:bg-[#1e2029] p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:shadow-lg hover:-translate-y-1 transition-all w-40 text-left group"
                    >
                        <div className={`w-10 h-10 rounded-lg ${action.color} text-white flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform`}>
                            <action.icon size={20}/>
                        </div>
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-[var(--color-brand)] transition-colors">{action.label}</h3>
                    </button>
                ))}
            </div>
        </div>

        {/* Main Content Tabs */}
        <div className="flex gap-6 border-b border-gray-200 dark:border-gray-800">
            {[
                { id: 'overview', label: 'Workflow Overview', icon: MousePointer },
                { id: 'manual', label: 'User Manual', icon: BookOpen },
                { id: 'faq', label: 'FAQs', icon: HelpCircle }
            ].map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`pb-4 px-2 text-sm font-bold flex items-center gap-2 transition-colors relative ${activeTab === tab.id ? 'text-[var(--color-brand)]' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                >
                    <tab.icon size={18}/> {tab.label}
                    {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--color-brand)] rounded-t-full"></div>}
                </button>
            ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
            
            {/* 1. Workflow Visualizer */}
            {activeTab === 'overview' && (
                <div className="animate-fade-in bg-white dark:bg-[#1e2029] p-8 md:p-12 rounded-3xl border border-gray-200 dark:border-gray-800 text-center">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Purchase Lifecycle</h3>
                    <p className="text-gray-500 mb-12 max-w-lg mx-auto">Click on any stage to see detailed instructions.</p>

                    <div className="relative flex flex-col md:flex-row justify-between items-center gap-8 max-w-4xl mx-auto">
                        {/* Connector Line */}
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 dark:bg-gray-800 -z-10 -translate-y-1/2 rounded-full hidden md:block"></div>
                        <div className="absolute left-1/2 top-0 w-1 h-full bg-gray-100 dark:bg-gray-800 -z-10 -translate-x-1/2 rounded-full block md:hidden"></div>

                        {workflowSteps.map((step, idx) => (
                            <div 
                                key={idx} 
                                className={`relative group cursor-pointer transition-all ${selectedStage === step.id ? 'scale-110 z-20' : ''}`} 
                                onClick={() => {
                                    setSelectedStage(step.id);
                                    setActiveTab('manual');
                                }}
                            >
                                <div className={`w-20 h-20 rounded-2xl ${step.color} text-white flex items-center justify-center shadow-lg transform transition-all group-hover:scale-110 group-hover:rotate-3 z-10 relative mx-auto ${selectedStage === step.id ? 'ring-4 ring-white ring-offset-4 ring-offset-[var(--color-brand)]' : ''}`}>
                                    <step.icon size={32} strokeWidth={2}/>
                                </div>
                                <div className="mt-4 bg-white dark:bg-[#2b2d3b] p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm w-48 absolute top-full left-1/2 -translate-x-1/2 md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all z-20 pointer-events-none md:pointer-events-auto">
                                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">{step.label}</h4>
                                    <p className="text-xs text-gray-500 mt-1">{step.desc}</p>
                                </div>
                                {/* Mobile Text (Visible) */}
                                <div className="md:hidden mt-2">
                                     <h4 className="font-bold text-gray-900 dark:text-white text-sm">{step.label}</h4>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 2. User Manual */}
            {activeTab === 'manual' && (
                <div className="animate-fade-in space-y-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                            {selectedStage ? `Guide: ${workflowSteps.find(s => s.id === selectedStage)?.label}` : 'Full User Manual'}
                        </h3>
                        {selectedStage && (
                            <button 
                                onClick={() => setSelectedStage(null)}
                                className="text-sm font-bold text-[var(--color-brand)] hover:underline flex items-center gap-1"
                            >
                                <X size={14}/> Clear Filter
                            </button>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {manualSections.filter(s => !selectedStage || s.id === selectedStage).map((section) => (
                            <div 
                                key={section.id} 
                                id={section.id} 
                                className={`bg-white dark:bg-[#1e2029] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 scroll-mt-24 transition-all ${selectedStage === section.id ? 'md:col-span-2 ring-2 ring-[var(--color-brand)] shadow-lg' : ''}`}
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2.5 bg-gray-100 dark:bg-white/5 rounded-xl text-gray-600 dark:text-gray-300">
                                        <section.icon size={22}/>
                                    </div>
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">{section.title}</h3>
                                </div>
                                <div className="text-sm leading-relaxed">
                                    {section.content}
                                </div>
                            </div>
                        ))}
                        
                        {!selectedStage && (
                            <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-800/30 flex flex-col justify-between">
                                 <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                                            <MessageSquare size={22}/>
                                        </div>
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Still stuck?</h3>
                                    </div>
                                    <p className="text-sm text-indigo-800 dark:text-indigo-200 mb-6">
                                        Our support team is available Mon-Fri, 9am - 5pm to help with any technical or purchasing questions.
                                    </p>
                                 </div>
                                 <button className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors">
                                     Contact Support
                                 </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 3. FAQs */}
            {activeTab === 'faq' && (
                <div className="animate-fade-in space-y-3 max-w-3xl mx-auto">
                    {filteredFaqs.map((faq, idx) => (
                        <div key={idx} className="bg-white dark:bg-[#1e2029] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                            <button 
                                onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                                className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <span className="font-bold text-gray-800 dark:text-gray-200">{faq.q}</span>
                                {openFaqIndex === idx ? <ChevronDown size={18} className="text-gray-400"/> : <ChevronRight size={18} className="text-gray-400"/>}
                            </button>
                            {openFaqIndex === idx && (
                                <div className="px-5 pb-5 pt-0 text-gray-600 dark:text-gray-400 animate-slide-down">
                                    <div className="h-px bg-gray-100 dark:bg-gray-800 mb-4"></div>
                                    {faq.a}
                                </div>
                            )}
                        </div>
                    ))}
                    {filteredFaqs.length === 0 && (
                        <div className="text-center py-12 text-gray-400">
                            No answers found for "{searchQuery}".
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};

export default HelpGuide;

