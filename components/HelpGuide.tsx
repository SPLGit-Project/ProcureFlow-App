import React, { useState, useEffect } from 'react';
import {
    FileText, CheckCircle, Database, Truck, DollarSign, ArrowRight,
    Search, HelpCircle, BookOpen, MessageSquare, PlayCircle,
    Settings, Users, Shield, CreditCard, Box, Zap, ChevronDown, ChevronRight,
    MousePointer, Link as LinkIcon, X, Package, ClipboardCheck, BarChart3
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
    },
    {
      id: 'item-creation',
      title: 'Item Creation',
      icon: Package,
      color: 'purple',
      guides: [
        {
          id: 'creating-item-request',
          title: 'Creating an Item Request',
          steps: [
            'Navigate to "Item Preview" in the sidebar to open the Item Creation Workbench.',
            'Select the request type (e.g., New Item, Replacement, Customer-Specific) — conditional fields will appear based on your selection.',
            'Fill in the item description, business unit, division, and any required reference fields.',
            'Attach a spec sheet via the attachment section if one is available.',
            'Click "Submit Request" to start the approval workflow.'
          ]
        },
        {
          id: 'duplicate-check',
          title: 'Duplicate Check',
          steps: [
            'After completing the item details, click "Check for Duplicates" to scan the existing catalogue.',
            'Results are shown as a scored candidate table — higher scores indicate stronger similarity.',
            'Review each candidate\'s match reasons (description similarity, SKU overlap, category match).',
            'Select an outcome: Use Existing, Similar New Required, or Proceed as New.',
            'If overriding a warning, a justification note is required before submitting.'
          ]
        },
        {
          id: 'sku-generation',
          title: 'SKU Generation',
          steps: [
            'SKUs are automatically generated from the category code + product type code + a sequential suffix.',
            'The generated SKU is shown as a live preview in the WORKBENCH form.',
            'Manual SKU override is available only to users with manage_development permission and requires a justification.',
            'SKU code maps (category and product type codes) are managed in Settings → Item Creation.'
          ]
        },
        {
          id: 'approval-routing',
          title: 'Understanding Approval Routing',
          steps: [
            'When a request is submitted, the system evaluates configured approval rules against the request details.',
            'Rules can fire based on conditions like margin threshold, request type (purchase-only, contract, COG), or urgency.',
            'Each matched rule creates an approval stage with an assigned approver and SLA countdown.',
            'SLA countdowns appear in the Item Approval Queue — amber means < 25% of SLA remaining, red means overdue.',
            'Decision outcomes: Approve advances the request, Reject closes it, Request Revision returns it to the requestor.'
          ]
        }
      ]
    },
    {
      id: 'item-approvals',
      title: 'Item Approvals',
      icon: ClipboardCheck,
      color: 'amber',
      guides: [
        {
          id: 'reviewing-request',
          title: 'Reviewing an Item Request',
          steps: [
            'Navigate to "Item Approvals" in the sidebar (requires approve_item_requests permission).',
            'The left panel shows all requests pending your review, sorted oldest-first with SLA indicators.',
            'Click a request to open the review panel on the right — it shows item details, duplicate outcome, pricing, and history.',
            'The Pricing section shows purchase cost, sell price, and calculated margin % with colour-coding (green > 25%, amber 20–25%, red < 20%).',
            'The Audit Trail at the bottom shows every change made to the request since submission.'
          ]
        },
        {
          id: 'making-decision',
          title: 'Making an Approval Decision',
          steps: [
            'After reviewing, scroll to the Decision section at the bottom of the review panel.',
            'Add comments to explain your decision (required for Reject and Request Revision).',
            'Approve: moves the request to the next approval stage or to Approved status if it is the final stage.',
            'Request Revision: returns the request to the requestor with your comments — status becomes Revision Required.',
            'Reject: permanently closes the request — status becomes Rejected.'
          ]
        },
        {
          id: 'publication-targets',
          title: 'Publication Targets',
          steps: [
            'Approved items can be published to external catalogues based on the publication targets set during pricing.',
            'Salesforce: item and pricing data is made available for CRM quoting and contract pricing.',
            'Bundle: item is added to the BundleConnect laundry catalogue for order fulfilment.',
            'LinenHub: item is published to the LinenHub portal for customer-facing visibility.',
            'Publication status badges (Salesforce / Bundle / LinenHub) appear in the Item Catalogue view.'
          ]
        }
      ]
    },
    {
      id: 'smart-buying-v2',
      title: 'Smart Buying',
      icon: BarChart3,
      color: 'teal',
      guides: [
        {
          id: 'live-vs-manual',
          title: 'Live vs Manual Data Mode',
          steps: [
            'Smart Buying has two data modes: Live (from BundleConnect Azure database) and Manual (from uploaded Excel files).',
            'Live mode is enabled when the smartBuyingV2Enabled feature flag is on — the Live Data toggle will appear at the top of the dashboard.',
            'In Live mode, select one or more sites and click "Refresh" to pull current stock, orders, and STAR metrics from the Azure database.',
            'Manual mode uses data uploaded via the Data Ingestion screen — use this as a fallback when the Azure proxy is unavailable.',
            'The Azure DB proxy must be deployed and reachable for live mode to function — contact your administrator if the toggle is greyed out.'
          ]
        },
        {
          id: 'star-days',
          title: 'STAR Days Explained',
          steps: [
            'STAR (Stock Turn And Replenishment) days measure how quickly a linen item cycles through the laundry workflow.',
            'It is calculated from the rfidtrans table: average days between a "soiled" scan (type 1) and the next "clean" scan (type 2) per item.',
            'High STAR days = slow cycle = items spend longer in the laundry, meaning you need more stock on hand.',
            'Low STAR days = fast cycle = items turn quickly, so a smaller par level is sufficient.',
            'The buy quantity calculation uses STAR days to adjust the recommended order — high STAR items get a higher multiplier.'
          ]
        },
        {
          id: 'saving-plans',
          title: 'Saving and Tracking Plans',
          steps: [
            'After adjusting budget sliders and reviewing the allocation table, click "Save Plan" to store the current plan.',
            'Saved plans appear in the History tab with their date, total budget, and item count.',
            'Click any history entry to reload that plan\'s parameters for comparison or resubmission.',
            'The planned vs actual columns in the allocation table update as purchase orders are created against the plan.'
          ]
        }
      ]
    },
    {
      id: 'data-sync',
      title: 'Data Sync',
      icon: Database,
      color: 'slate',
      guides: [
        {
          id: 'reading-sync-panel',
          title: 'Reading the Data Sync Panel',
          steps: [
            'Navigate to Settings → Data Sync to view the current sync health for all active sites.',
            'Each site card shows: last synced timestamp, lag hours (time since the latest record was written), and current job status.',
            'Status legend: Active (sync running), Idle (no pending jobs), Error (last job failed), Pending (job queued but not yet started).',
            'Lag hours above the configured threshold are highlighted in amber — this means the Azure database may be behind the source.'
          ]
        },
        {
          id: 'forcing-resync',
          title: 'Forcing a Resync',
          steps: [
            'In Settings → Data Sync, locate the site card you want to resync.',
            'Click "Force Sync" — this inserts a new sync job row for that site into the job queue.',
            'The status will change to Pending, then Active as the sync worker picks it up.',
            'Monitor completion by watching the last synced timestamp update — a successful sync will reset the lag counter.',
            'Use Force Sync sparingly: it is intended for recovering from errors, not for routine refresh (the sync runs automatically on a schedule).'
          ]
        },
        {
          id: 'site-exclusions',
          title: 'Site Exclusions Explained',
          steps: [
            'SYD (Sydney) is currently excluded from the active sync sites.',
            'The exclusion is due to the BundleConnect MySQL replication from port 3306 (master) to port 3307 (replica) not being restored at the Sydney site.',
            'Querying the Sydney replica while replication is stopped would return stale or incomplete data.',
            'Once the 3306→3307 replication is confirmed restored at SYD, re-enable the site by adding it to BC_ACTIVE_SITES in bundleConnectSyncService.ts and removing the exclusion in the Data Sync panel config.'
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

