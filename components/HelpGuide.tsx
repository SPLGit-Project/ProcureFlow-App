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
  const { currentUser, branding } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'guides' | 'faq'>('guides');
  const [selectedCategory, setSelectedCategory] = useState<string>('getting-started');
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Categories & Guides Data
  const categories = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: PlayCircle,
      color: 'blue',
      guides: [
        {
          id: 'dashboard-overview',
          title: 'Dashboard Overview',
          steps: [
            'Click on "Dashboard" in the sidebar to see your metrics.',
            'Use the Site Filter at the top right to view data for specific locations.',
            'The "Request Pipeline" shows the status of all current orders at a glance.',
            'Check "My Tasks" for pending approvals or deliveries requiring your attention.'
          ]
        },
        {
          id: 'mobile-install',
          title: 'Installing as an App (PWA)',
          steps: [
            'On Desktop: Use the "Install App" button in the bottom right corner.',
            'On iOS: Tap "Share" and select "Add to Home Screen".',
            'On Android: Follow the browser prompt or go to settings -> Install App.',
            'ProcureFlow works offline and provides a faster, fullscreen experience when installed.'
          ]
        }
      ]
    },
    {
      id: 'core-workflow',
      title: 'Core Workflow',
      icon: Zap,
      color: 'amber',
      guides: [
        {
          id: 'create-request',
          title: 'Creating a New Request',
          steps: [
            'Navigate to "New Request" using the sidebar button.',
            'Select the destination Site and the specific Supplier.',
            'Add items from the catalog or manually enter item details.',
            'Review your cart and click "Submit Request" to start the approval flow.'
          ]
        },
        {
          id: 'tracking-status',
          title: 'Tracking Your Orders',
          steps: [
            'Go to "My Requests" to see your full history.',
            'Use the "Quick Filters" to find orders that are Pending, Active, or Completed.',
            'Click any row to open the full request detail page.',
            'Check the "Approval History" tab to see who needs to sign off next.'
          ]
        },
        {
          id: 'receiving-goods',
          title: 'Recording Deliveries',
          steps: [
            'When goods arrive at the site, find the order in "My Requests".',
            'Click "Record Delivery" (only available for Active orders).',
            'Enter the quantities received and the delivery reference number.',
            'Upload a photo of the delivery docket for finance records.'
          ]
        }
      ]
    },
    {
      id: 'admin-hub',
      title: 'Admin Functions',
      icon: Settings,
      color: 'slate',
      guides: [
        {
          id: 'user-management',
          title: 'Managing Users',
          steps: [
            'Navigate to Settings -> Security.',
            'Use the "Add User" button to invite colleagues.',
            'Assign specific Roles (e.g., SITE_USER, APPROVER, ADMIN).',
            'Select which Sites the user can access and filter data for.'
          ]
        },
        {
          id: 'impersonation',
          title: 'Viewing as Another User',
          steps: [
            'In Settings -> Security, find a user and click the "Eye" icon.',
            'This allows you to verify exactly what that user sees and can do.',
            'A banner at the top will indicate you are in Impersonation mode.',
            'Click "Exit View" to return to your admin account.'
          ]
        },
        {
          id: 'branding',
          title: 'App Personalization',
          steps: [
            'Go to Settings -> Branding.',
            'Update the App Name, upload a new Logo, and choose a Primary Color.',
            'These changes reflect instantly across the web app and PWA icon.',
            'Set your Primary Font to ensure brand consistency.'
          ]
        }
      ]
    },
    {
      id: 'advanced-tools',
      title: 'Configuration Tools',
      icon: Database,
      color: 'indigo',
      guides: [
        {
          id: 'workflow-engine',
          title: 'Visual Workflow Editor',
          steps: [
            'Go to Settings -> Workflows.',
            'Drag and drop stages to customize the approval path.',
            'Set "Value Gateways" to route high-value orders to major stakeholders.',
            'Click "Publish" to set the new workflow live for all future requests.'
          ]
        },
        {
          id: 'notifications',
          title: 'Triggered Notifications',
          steps: [
            'Go to Settings -> Notifications.',
            'Create rules (e.g., "When PO is approved, notify Requester via Email").',
            'Customize message templates with dynamic tags like {app_name} or {po_id}.',
            'Enable or disable channels (Email, Dashboard, Push) for each rule.'
          ]
        }
      ]
    }
  ];

  const faqs = [
    {
      q: 'How do I reset my password?',
      a: 'ProcureFlow integrates with your company single sign-on. Please reset your password via your corporate security portal (e.g., Azure AD/Office 365).'
    },
    {
      q: 'What determines the approval threshold?',
      a: 'Workflows are configured by Admins. Usually, orders under $1,000 are auto-approved locally, while larger amounts require multi-stage sign-off.'
    },
    {
      q: 'Can I delete a wrongly submitted PO?',
      a: 'Once submitted, a PO cannot be deleted for audit reasons. However, you can "Withdraw" or "Reject" it, which archives the record.'
    }
  ];

  const filteredFaqs = faqs.filter(f => 
    f.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-fade-in px-4">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-brand)] to-indigo-600">Help & Support</h1>
          <p className="text-gray-500 mt-1">Master every feature of {branding.appName || 'ProcureFlow'}.</p>
        </div>
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[var(--color-brand)] transition-colors" size={20}/>
          <input 
            type="text" 
            placeholder="Search guides or FAQs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-800 rounded-2xl py-4 pl-12 pr-4 shadow-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar */}
        <div className="lg:w-72 space-y-2">
          {[
            { id: 'guides', label: 'Feature Guides', icon: BookOpen },
            { id: 'faq', label: 'Common Questions', icon: HelpCircle }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === tab.id ? 'bg-[var(--color-brand)] text-white shadow-lg' : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400'}`}
            >
              <tab.icon size={20}/> {tab.label}
            </button>
          ))}

          <div className="h-px bg-gray-200 dark:bg-gray-800 my-6" />

          {activeTab === 'guides' && (
            <div className="space-y-1">
              <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Categories</p>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${selectedCategory === cat.id ? 'bg-white dark:bg-[#2b2d3b] text-[var(--color-brand)] shadow-sm border border-gray-100 dark:border-gray-800' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                  <cat.icon size={18}/> {cat.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1">
          {activeTab === 'guides' ? (
            <div className="space-y-8 animate-fade-in-up">
              {categories.find(c => c.id === selectedCategory)?.guides.map((guide, gIdx) => (
                <div key={guide.id} className="bg-white dark:bg-[#1e2029] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden group hover:border-[var(--color-brand)]/30 transition-all">
                  <div className={`p-8 bg-gradient-to-br from-${categories.find(c => c.id === selectedCategory)?.color}-50 to-white dark:from-white/5 dark:to-transparent`}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className={`w-12 h-12 rounded-2xl bg-${categories.find(c => c.id === selectedCategory)?.color}-100 dark:bg-${categories.find(c => c.id === selectedCategory)?.color}-500/10 flex items-center justify-center text-${categories.find(c => c.id === selectedCategory)?.color}-600 dark:text-${categories.find(c => c.id === selectedCategory)?.color}-400 shadow-sm`}>
                         <BookOpen size={24}/>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{guide.title}</h3>
                    </div>
                    
                    <div className="space-y-4">
                      {guide.steps.map((step, sIdx) => (
                        <div key={sIdx} className="flex gap-4 group/step">
                          <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full border-2 border-${categories.find(c => c.id === selectedCategory)?.color}-200 dark:border-gray-800 flex items-center justify-center text-xs font-bold text-gray-400 group-hover/step:bg-[var(--color-brand)] group-hover/step:border-[var(--color-brand)] group-hover/step:text-white transition-all`}>
                              {sIdx + 1}
                            </div>
                            {sIdx < guide.steps.length - 1 && <div className="w-0.5 h-full bg-gray-100 dark:bg-gray-800 my-1" />}
                          </div>
                          <div className="pb-6">
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium">{step}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in-up max-w-3xl">
              {filteredFaqs.map((faq, idx) => (
                <div key={idx} className="bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                  <button 
                    onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                    className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="font-bold text-lg text-gray-800 dark:text-gray-200">{faq.q}</span>
                    <div className={`w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center transition-transform duration-300 ${openFaqIndex === idx ? 'rotate-180 bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'text-gray-400'}`}>
                      <ChevronDown size={20}/>
                    </div>
                  </button>
                  {openFaqIndex === idx && (
                    <div className="px-6 pb-6 pt-0 animate-slide-down">
                      <div className="h-px bg-gray-100 dark:bg-gray-800 mb-6"></div>
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg italic">
                        "{faq.a}"
                      </p>
                    </div>
                  )}
                </div>
              ))}
              {filteredFaqs.length === 0 && (
                <div className="text-center py-20 bg-gray-50 dark:bg-white/5 rounded-3xl border border-dashed border-gray-300 dark:border-gray-800">
                  <HelpCircle className="mx-auto mb-4 text-gray-300" size={48}/>
                  <p className="text-gray-500 font-medium">No common questions found for "{searchQuery}".</p>
                  <button onClick={() => setSearchQuery('')} className="mt-4 text-[var(--color-brand)] font-bold hover:underline">Clear Search</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HelpGuide;

