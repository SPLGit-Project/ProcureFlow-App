// deno-lint-ignore-file no-unused-vars no-explicit-any
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../context/AppContext.tsx';
import { useSetPageMeta } from '../context/PageMetaContext.tsx';
import AvatarPicker from './AvatarPicker.tsx';

import {
    Users, Shield, Globe, ShoppingBag, Truck, Layout, Bell, Database,
    FileText, Plus, Search, Edit2, Trash2, CheckCircle2,
    Upload, Download, RefreshCw, Filter, ChevronDown, ChevronRight, X,
    MapPin, Link as LinkIcon, Lock, Box, User, Settings as SettingsIcon, Inbox, MailOpen,
    GitMerge, Fingerprint, Palette, Package, Layers, Type,
    Eye, Calendar as CalendarIcon, Wand2, XCircle, DollarSign, CheckSquare, Activity,
    Mail, Mail as MailIcon, Slack, Smartphone, ArrowDown, History, HelpCircle, Image, Tag, Save, Phone, Code, AlertCircle, Check, Info, ArrowRight, MessageSquare, GripVertical, PlayCircle, StopCircle, Network, ListFilter, Clock, CheckCircle, MinusCircle, Archive, UserPlus, Loader2, BookOpen, Zap, BarChart3, Sparkles
} from 'lucide-react';
import { useToast, ToastContainer } from './ToastNotification.tsx';
import { getTimeUntilExpiry, formatInviteDate } from '../utils/inviteHelpers.ts';
import { supabase } from '../lib/supabaseClient.ts';
import { SupplierStockSnapshot, SupplierProductMap, Item, Supplier, SupplierContact, Site, IncomingStock, UserRole, WorkflowStep, RoleDefinition, PermissionId, PORequest, POStatus, NotificationRule, NotificationRecipient, SystemAuditLog, AppBranding, WorkflowConfiguration, WorkflowType } from '../types.ts';
import { normalizeItemCode } from '../utils/normalization.ts';
import { canonicalSupplierName, dedupeSuppliersForDisplay, mergeSupplierRecords, normalizeSupplierContacts } from '../utils/suppliers.ts';
import { useLocation } from 'react-router-dom';
import { BrandLogo } from './BrandLogo.tsx';
// AdminAccessHub removed — access approvals no longer used
import AdminMigration from './AdminMigration.tsx';

import StockMappingConfirmation from './StockMappingConfirmation.tsx';
import { EnhancedParseResult, ColumnMapping, DateColumn } from '../utils/fileParser.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { AuditLogViewer } from './AuditLogViewer.tsx';
import DataSyncPanel from './DataSyncPanel.tsx';
import SmartBuyingSettings from './SmartBuyingSettings.tsx';
import ItemCreationSettings from './ItemCreationSettings.tsx';
import PageHeader from './PageHeader.tsx';
import * as XLSX from 'xlsx';
import ItemSetupManagement from './ItemSetupManagement.tsx';
import MenuEditor from './MenuEditor.tsx';
import { ItemWizard } from './ItemWizard.tsx';
import { EntityAuditPanel } from './EntityAuditPanel.tsx';
import { HierarchyManager } from '../utils/hierarchyManager.ts';
import { seedCatalogData } from '../utils/catalogSeeder.ts';
import SimpleWorkflowConfig from './SimpleWorkflowConfig.tsx';


import RoleTreeManager from './RoleTreeManager.tsx';


const AVAILABLE_PERMISSIONS: { id: PermissionId, label: string, description: string, icon: React.ElementType, category: 'Sidebar Navigation' | 'Admin Portal' | 'Operational Actions' | 'Development' }[] = [
    // Sidebar Navigation
    { id: 'view_dashboard', label: 'Dashboard', description: 'Access dashboard overview', icon: Layout, category: 'Sidebar Navigation' },
    { id: 'view_items', label: 'Items', description: 'View master item list', icon: Box, category: 'Sidebar Navigation' },
    { id: 'view_stock', label: 'Stock', description: 'View stock levels', icon: Database, category: 'Sidebar Navigation' },
    { id: 'view_suppliers', label: 'Suppliers', description: 'View supplier list', icon: Truck, category: 'Sidebar Navigation' },
    { id: 'view_sites', label: 'Sites', description: 'View site list', icon: MapPin, category: 'Sidebar Navigation' },
    { id: 'view_finance', label: 'Finance Review', description: 'Access finance review and cost coding', icon: DollarSign, category: 'Sidebar Navigation' },
    { id: 'view_reports', label: 'Reports', description: 'Access to financial and operational reports', icon: BarChart3, category: 'Sidebar Navigation' },
    { id: 'view_active_requests', label: 'Active Requests', description: 'Access active/pending concur requests', icon: Activity, category: 'Sidebar Navigation' },
    { id: 'view_completed_requests', label: 'Completed Requests', description: 'Access history of completed requests', icon: Clock, category: 'Sidebar Navigation' },

    // Admin Portal
    { id: 'view_mapping', label: 'Product Mapping', description: 'View and manage mappings', icon: GitMerge, category: 'Admin Portal' },
    { id: 'view_workflow', label: 'Workflow Designer', description: 'View approval workflows', icon: Wand2, category: 'Admin Portal' },
    { id: 'view_security', label: 'Security & Roles', description: 'View users and roles', icon: Shield, category: 'Admin Portal' },
    { id: 'view_notifications', label: 'Notifications', description: 'View notification settings', icon: Bell, category: 'Admin Portal' },
    { id: 'view_branding', label: 'Branding', description: 'View branding settings', icon: Palette, category: 'Admin Portal' },
    { id: 'manage_settings', label: 'Menu Config', description: 'Manage system settings', icon: ListFilter, category: 'Admin Portal' },

    // Operational Actions
    { id: 'create_request', label: 'Create Request', description: 'Create new purchase orders', icon: Plus, category: 'Operational Actions' },
    { id: 'approve_requests', label: 'Approve POs', description: 'Approve purchase orders', icon: CheckSquare, category: 'Operational Actions' },
    { id: 'view_all_requests', label: 'View All POs', description: 'View POs from all sites/users', icon: Eye, category: 'Operational Actions' },
    { id: 'link_concur', label: 'Link Concur', description: 'Link POs to Concur', icon: LinkIcon, category: 'Operational Actions' },
    { id: 'receive_goods', label: 'Receive Goods', description: 'Mark items as received', icon: Package, category: 'Operational Actions' },
    { id: 'manage_finance', label: 'Finance Management', description: 'Edit finance codes', icon: DollarSign, category: 'Operational Actions' },
    { id: 'manage_items', label: 'Manage Items', description: 'Create/Edit/Delete Items', icon: Layers, category: 'Operational Actions' },
    { id: 'manage_suppliers', label: 'Manage Suppliers', description: 'Create/Edit/Delete Suppliers', icon: Truck, category: 'Operational Actions' },
    
    // Development
    { id: 'manage_development', label: 'Development Admin', description: 'Access to Smart Buying and Data Ingest tools', icon: Code, category: 'Development' }
];

type AdminTab = 'PROFILE' | 'CATALOG' | 'STOCK' | 'MAPPING' | 'SUPPLIERS' | 'SITES' | 'BRANDING' | 'MENU' | 'USERS' | 'SECURITY' | 'WORKFLOW' | 'NOTIFICATIONS' | 'MIGRATION' | 'EMAIL' | 'AUDIT' | 'DATA_SYNC' | 'SMART_BUYING' | 'ITEM_CREATION';

const MASTER_ITEM_COLUMNS = [
    { key: 'sku', label: 'SKU' },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'category', label: 'Category' },
    { key: 'subCategory', label: 'Sub Category' },
    { key: 'unitPrice', label: 'Unit Price' },
    { key: 'uom', label: 'UOM' },
    { key: 'upq', label: 'UPQ' },
    { key: 'itemCatalog', label: 'Catalog' },
    { key: 'itemType', label: 'Type' },
    { key: 'itemPool', label: 'Pool' },
    { key: 'stockLevel', label: 'Stock Level' },
    { key: 'supplierId', label: 'Supplier ID' },
    { key: 'rangeName', label: 'Range' },
    { key: 'stockType', label: 'Stock Type' },
    { key: 'itemWeight', label: 'Weight' },
    { key: 'itemColour', label: 'Color' },
    { key: 'itemPattern', label: 'Pattern' },
    { key: 'itemMaterial', label: 'Material' },
    { key: 'itemSize', label: 'Size' },
    { key: 'measurements', label: 'Measurements' },
    { key: 'rfidFlag', label: 'RFID' },
    { key: 'cogFlag', label: 'COG' },
    { key: 'cogCustomer', label: 'COG Customer' },
    { key: 'minLevel', label: 'Min Level' },
    { key: 'maxLevel', label: 'Max Level' },
    { key: 'activeFlag', label: 'Status' }
];

const AUTO_DETECT_SUPPLIER_VALUE = '__AUTO_DETECT__';
const EXCLUDED_SUPPLIER_NAMES = ['spl accommodation', 'spl accomendation', 'spl healthcare'];

const normalizeSupplierName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const isExcludedSupplierName = (name?: string) => {
  if (!name) return false;
  const normalized = normalizeSupplierName(name);
  return EXCLUDED_SUPPLIER_NAMES.some(excluded => normalized === excluded || normalized.includes(excluded));
};

type SupplierContactFormRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isPrimary: boolean;
};

type SupplierFormState = {
  name: string;
  keyContact: string;
  contactEmail: string;
  phone: string;
  address: string;
  categories: string;
  contacts: SupplierContactFormRow[];
};

type MappingCandidate = {
  item: Item;
  score: number;
  reasons: string[];
  isCurrent: boolean;
};

const createEmptySupplierContactRow = (isPrimary = false): SupplierContactFormRow => ({
  id: uuidv4(),
  name: '',
  email: '',
  phone: '',
  role: isPrimary ? 'Primary contact' : 'Inventory reports',
  isPrimary
});

const supplierContactToFormRow = (contact: SupplierContact): SupplierContactFormRow => ({
  id: contact.id || uuidv4(),
  name: contact.name || '',
  email: contact.email || '',
  phone: contact.phone || '',
  role: contact.role || (contact.isPrimary ? 'Primary contact' : 'Inventory reports'),
  isPrimary: Boolean(contact.isPrimary)
});

const getSupplierContactRows = (supplier?: Supplier): SupplierContactFormRow[] => {
  if (!supplier) return [createEmptySupplierContactRow(true)];
  const rows = normalizeSupplierContacts(supplier).map(supplierContactToFormRow);
  return rows.length ? rows : [createEmptySupplierContactRow(true)];
};

const createSupplierFormState = (supplier?: Supplier): SupplierFormState => ({
  name: supplier?.name || '',
  keyContact: supplier?.keyContact || '',
  contactEmail: supplier?.contactEmail || '',
  phone: supplier?.phone || '',
  address: supplier?.address || '',
  categories: supplier?.categories?.join(', ') || '',
  contacts: getSupplierContactRows(supplier)
});

const tokenizeForMatching = (value?: string): string[] => (
  (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(token => token.length > 2)
);

const overlapScore = (left?: string, right?: string): number => {
  const leftTokens = new Set(tokenizeForMatching(left));
  const rightTokens = tokenizeForMatching(right);
  if (!leftTokens.size || !rightTokens.length) return 0;
  const matches = rightTokens.filter(token => leftTokens.has(token)).length;
  return matches / Math.max(leftTokens.size, rightTokens.length);
};

const getConfidenceTone = (score: number) => {
  if (score >= 0.9) return { label: 'High confidence', bar: 'bg-green-500', text: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/20', border: 'border-green-200 dark:border-green-900/40' };
  if (score >= 0.7) return { label: 'Review recommended', bar: 'bg-yellow-500', text: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950/20', border: 'border-yellow-200 dark:border-yellow-900/40' };
  return { label: 'Manual decision needed', bar: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-200 dark:border-red-900/40' };
};

const toTitleCase = (value: string) => value.split(' ').map(part => part ? `${part[0].toUpperCase()}${part.slice(1)}` : '').join(' ');

const extractDescriptorTags = (value?: string): Array<{ label: string; type: string }> => {
  const text = (value || '').toLowerCase();
  const tags: Array<{ label: string; type: string }> = [];
  const add = (label: string, type: string) => {
    if (!tags.some(tag => tag.label.toLowerCase() === label.toLowerCase() && tag.type === type)) {
      tags.push({ label, type });
    }
  };

  const measurementMatches: string[] = value?.match(/\b\d+(?:\.\d+)?\s*(?:x|X|by)\s*\d+(?:\.\d+)?(?:\s*(?:x|X|by)\s*\d+(?:\.\d+)?)?\s*(?:cm|mm|m|inch|in)?\b|\b\d+(?:\.\d+)?\s*(?:cm|mm|m|gsm)\b/g) || [];
  measurementMatches.forEach(match => add(match.replace(/\s+/g, ' ').trim(), 'Measurement'));

  const colours = ['white', 'blue', 'navy', 'green', 'orange', 'red', 'beige', 'charcoal', 'black', 'grey', 'gray', 'pink', 'yellow', 'brown', 'purple', 'crystalbrook'];
  colours.forEach(colour => {
    if (new RegExp(`\\b${colour}\\b`, 'i').test(value || '')) add(toTitleCase(colour), 'Colour');
  });

  const materials = ['cotton', 'polyester', 'rayon', 'linen', 'terry', 'p/c', 'microfibre', 'microfiber'];
  materials.forEach(material => {
    if (text.includes(material)) add(material.toUpperCase(), 'Material');
  });

  const productTypes = ['face washer', 'face towel', 'pool towel', 'bath robe', 'queen sheet', 'pillowcase', 'napkin', 'laundry bag', 'quilt cover', 'serviette', 'towel', 'sheet'];
  productTypes.forEach(type => {
    if (text.includes(type)) add(toTitleCase(type), 'Type');
  });

  if (/\brfid\b/i.test(value || '')) add('RFID', 'Flag');
  if (/\bspl\b/i.test(value || '')) add('SPL', 'Flag');
  return tags.slice(0, 12);
};

const getItemDescriptorText = (item?: Item): string => {
  if (!item) return '';
  return [
    item.name,
    item.description,
    item.category,
    item.subCategory,
    item.itemColour,
    item.itemMaterial,
    item.itemSize,
    item.measurements,
    item.itemType
  ].filter(Boolean).join(' ');
};

const Settings = () => {
  const {
    currentUser, users, addUser, roles, hasPermission, createRole, updateRole, deleteRole, permissions, updateUserRole, updateUserAccess,
    teamsWebhookUrl, updateTeamsWebhook,
    inboundEmailAddress, updateInboundEmailAddress,
    theme, setTheme, branding, updateBranding,
    suppliers, addSupplier, updateSupplier, deleteSupplier,
    sites, addSite, updateSite, deleteSite,
    workflowSteps, updateWorkflowStep, addWorkflowStep, deleteWorkflowStep, notificationRules, upsertNotificationRule, deleteNotificationRule,
    items, addItem, updateItem, deleteItem,
    catalog, updateCatalogItem, stockSnapshots, pos,
    // Actions
    createPO, addSnapshot, importStockSnapshot, importMasterProducts, runDataBackfill, refreshAvailability,
    mappings, generateMappings, updateMapping, deleteMapping, syncItemsFromSnapshots,
    // New Admin Caps
    getItemFieldRegistry, runAutoMapping, getMappingQueue,  upsertProductMaster, reloadData, updateProfile, sendWelcomeEmail, resendWelcomeEmail, archiveUser, reinstateUser, searchDirectory,
    archiveItem, getAuditLogs,
    // Catalog Management
    attributeOptions, upsertAttributeOption, deleteAttributeOption,
    activeSiteIds,
    featureFlags
  } = useApp();
  useSetPageMeta({ disableBodyScroll: true });

  const uiRevamp = featureFlags?.uiRevampEnabled ?? false;
  const visibleSuppliers = React.useMemo(
    () => dedupeSuppliersForDisplay(suppliers.filter(supplier => !isExcludedSupplierName(supplier.name))),
    [suppliers]
  );


    const handleWizardSave = async (itemData: Partial<Item>) => {
        try {
            if (editingItem) {
                await updateItem({ ...editingItem, ...itemData });
                success('Item updated successfully');
            } else {
                // Ensure new items have a UUID
                await addItem({ 
                    ...itemData, 
                    id: uuidv4() 
                } as Item);
                success('Item created successfully');
            }
            setIsItemFormOpen(false);
            setEditingItem(null);
            reloadData(true, true);
        } catch (e) {
            console.error(e);
            error('Failed to save item');
        }
    };


  // Data Loading
  const { toasts, dismissToast, success, error, warning } = useToast();
  const [resendingUserId, setResendingUserId] = useState<string | null>(null);
  const [showArchivedPanel, setShowArchivedPanel] = useState(false);
  const [managingAccessUserId, setManagingAccessUserId] = useState<string | null>(null);
  const [pendingGrantRole, setPendingGrantRole] = useState<string>('');
  const [pendingGrantSiteIds, setPendingGrantSiteIds] = useState<string[]>([]);
  const [isGrantingAccess, setIsGrantingAccess] = useState(false);

  const location = useLocation();
  const [activeTab, setActiveTab] = useState<AdminTab>('PROFILE');
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [activeStepTab, setActiveStepTab] = useState<'GENERAL' | 'NOTIFICATIONS' | 'SLA'>('GENERAL');
  const [showWorkflowVisuals, setShowWorkflowVisuals] = useState(true);
  const [showMonitor, setShowMonitor] = useState(false);

  useEffect(() => {
    const state = location.state as { activeTab?: AdminTab };
    const queryTab = new URLSearchParams(location.search).get('tab') as AdminTab | null;
    if (state?.activeTab) {
      setActiveTab(state.activeTab);
    } else if (queryTab) {
      setActiveTab(queryTab);
    }
  }, [location.state, location.search]);

  // --- Smart Sticky Header Logic ---
  const [isStuck, setIsStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     const observer = new IntersectionObserver(
         ([entry]) => {
             setIsStuck(!entry.isIntersecting);
         },
         { threshold: [0] }
     );
     
     const current = sentinelRef.current;
     if (current) observer.observe(current);
     
     return () => {
         if (current) observer.unobserve(current);
     };
  }, []);
  
  // Find Layout's header slot for the admin tab bar portal (revamp mode only)
  const [adminTabSlot, setAdminTabSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const slot = document.getElementById('admin-tab-slot');
    if (slot) setAdminTabSlot(slot);
  }, []);

  // --- Security: Permission-based Guard ---
  useEffect(() => {
      if (activeTab === 'PROFILE') return;
      if (activeTab === 'STOCK') {
          setActiveTab('MAPPING');
          setMappingSubTab('SUPPLIER_ITEMS');
          return;
      }
      
      const tabConfig = allTabs.find(t => t.id === activeTab);
      if (tabConfig?.permission && !hasPermission(tabConfig.permission)) {
          setActiveTab('PROFILE');
      }
  }, [currentUser, activeTab, hasPermission]);

  // --- Email Templates State ---
   const [senderEmail, setSenderEmail] = useState(branding.emailTemplate?.fromEmail || '');
   const [emailSubject, setEmailSubject] = useState(branding.emailTemplate?.subject || `Welcome to ${branding.appName}`);
  const [emailBody, setEmailBody] = useState(branding.emailTemplate?.body || `
<p>Hi {name},</p>
<p>You have been invited to join <strong>{app_name}</strong>.</p>
<p>Please click the link below to get started:</p>
<p>{link}</p>
<p>Best regards,<br/>The Admin Team</p>
`);

   // Auto-fill form when branding loads
   useEffect(() => {
       if (branding.emailTemplate) {
           if (branding.emailTemplate.fromEmail) setSenderEmail(branding.emailTemplate.fromEmail);
           if (branding.emailTemplate.subject) setEmailSubject(branding.emailTemplate.subject);
           if (branding.emailTemplate.body) setEmailBody(branding.emailTemplate.body);
       }
   }, [branding]);

   const handleSaveEmailTemplate = async () => {
        const newBranding = {
            ...branding,
            emailTemplate: {
                subject: emailSubject,
                body: emailBody,
                fromEmail: senderEmail
            }
        };
        await updateBranding(newBranding);
        alert("Email template saved!");
   };

    const handleTestEmail = async () => {
       const email = prompt("Enter email to send test to:", currentUser?.email);
       if (email) {
          success(`Initiating test email to ${email}...`);
          try {
              const success_sent = await sendWelcomeEmail(email, "Test User");
              if (success_sent) {
                  success(`Test email sent successfully to ${email}. Please check your inbox (and spam folder).`);
              } else {
                  error("The email function failed to deliver. This is usually due to Azure App Registration permissions or an invalid Sender Email.");
              }
          } catch (e: any) {
              console.error("Test email failed:", e);
              error(`Test failed: ${e.message || 'Unknown error'}`);
          }
       }
   };

  const [selectedAuditItem, setSelectedAuditItem] = useState<Item | null>(null);
  
  // --- Workflow Configurations State ---
  const [workflowConfigs, setWorkflowConfigs] = useState<WorkflowConfiguration[]>([
      {
          id: '1',
          workflowType: 'APPROVAL',
          isEnabled: true,
          emailEnabled: true,
          emailSubject: 'Action Required: Approve Purchase Order {{po_number}}',
          emailBody: '<p>Approval required for PO {{po_number}}</p>',
          inappEnabled: true,
          inappTitle: 'Approval Required',
          inappMessage: 'Purchase Order {{po_number}} requires your approval',
          recipientType: 'ROLE',
          recipientIds: [],
          includeRequester: false,
          appUrl: globalThis.location.origin
      },
      {
          id: '2',
          workflowType: 'POST_APPROVAL',
          isEnabled: true,
          emailEnabled: true,
          emailSubject: 'Your Purchase Order {{po_number}} has been Approved',
          emailBody: '<p>Your PO {{po_number}} has been approved</p>',
          inappEnabled: true,
          inappTitle: 'PO Approved',
          inappMessage: 'Your Purchase Order {{po_number}} has been approved',
          recipientType: 'REQUESTER',
          recipientIds: [],
          includeRequester: false,
          appUrl: globalThis.location.origin
      },
      {
          id: '3',
          workflowType: 'POST_DELIVERY',
          isEnabled: true,
          emailEnabled: true,
          emailSubject: 'Order Delivered: PO {{po_number}}',
          emailBody: '<p>Order {{po_number}} has been delivered</p>',
          inappEnabled: true,
          inappTitle: 'Order Delivered',
          inappMessage: 'Your order {{po_number}} has been delivered',
          recipientType: 'REQUESTER',
          recipientIds: [],
          includeRequester: false,
          appUrl: globalThis.location.origin
      },
      {
          id: '4',
          workflowType: 'POST_CAPITALIZATION',
          isEnabled: true,
          emailEnabled: true,
          emailSubject: 'Order Finalized: PO {{po_number}}',
          emailBody: '<p>PO {{po_number}} has been capitalized</p>',
          inappEnabled: true,
          inappTitle: 'Order Finalized',
          inappMessage: 'PO {{po_number}} has been capitalized',
          recipientType: 'ROLE',
          recipientIds: [],
          includeRequester: false,
          appUrl: globalThis.location.origin
      }
  ]);

  // Load workflow configurations from database
  useEffect(() => {
      const loadWorkflowConfigs = async () => {
          try {
              const { data, error } = await supabase
                  .from('workflow_configurations')
                  .select('*');
              
              if (error) throw error;
              
              if(data && data.length > 0) {
                  setWorkflowConfigs(data.map((wf: {
                      id: string;
                      workflow_type: WorkflowType;
                      is_enabled: boolean;
                      email_enabled: boolean;
                      email_subject: string;
                      email_body: string;
                      inapp_enabled: boolean;
                      inapp_title: string;
                      inapp_message: string;
                      recipient_type: 'ROLE' | 'USER' | 'REQUESTER' | 'CUSTOM';
                      recipient_id: string;
                      escalation_hours: number;
                  }) => ({
                      id: wf.id,
                      workflowType: wf.workflow_type,
                      isEnabled: wf.is_enabled,
                      emailEnabled: wf.email_enabled,
                      emailSubject: wf.email_subject,
                      emailBody: wf.email_body,
                      inappEnabled: wf.inapp_enabled,
                      inappTitle: wf.inapp_title,
                      inappMessage: wf.inapp_message,
                      recipientType: wf.recipient_type,
                      recipientId: wf.recipient_id,
                      escalationHours: wf.escalation_hours
                  })));
              }
          } catch (err) {
              console.error('Error loading workflow configurations:', err);
          }
      };

      if (activeTab === 'WORKFLOW') {
          loadWorkflowConfigs();
      }
  }, [activeTab]);

  const handleSaveWorkflows = async (workflows: any[]) => {
      try {
          const updates = workflows.map(wf => ({
              id: wf.id,
              workflow_type: wf.workflowType,
              is_enabled: wf.isEnabled,
              email_enabled: wf.emailEnabled,
              email_subject: wf.emailSubject,
              email_body: wf.emailBody,
              inapp_enabled: wf.inappEnabled,
              inapp_title: wf.inappTitle,
              inapp_message: wf.inappMessage,
              recipient_type: wf.recipientType,
              recipient_id: wf.recipientId,
              escalation_hours: wf.escalationHours,
              updated_at: new Date().toISOString()
          }));

          const { error } = await supabase
              .from('workflow_configurations')
              .upsert(updates);

          if (error) throw error;

          setWorkflowConfigs(workflows);
          success('Workflow configurations saved successfully');
      } catch (err) {
          console.error('Error saving workflows:', err);
          error('Failed to save workflow configurations');
      }
  };

  // deno-lint-ignore require-await
  const handleTestNotification = async (workflow: any) => {
      try {
          // Here you would send a test notification
          // For now, just log it
          console.log('Sending test notification for:', workflow);
          success(`Test notification sent for ${workflow.workflowType}`);
      } catch (err) {
          console.error('Error sending test notification:', err);
          error('Failed to send test notification');
      }
  };

  const [fieldRegistry, setFieldRegistry] = useState<unknown[]>([]);
  
  useEffect(() => {
     getItemFieldRegistry().then(setFieldRegistry).catch(console.error);
  }, [getItemFieldRegistry]);

   // --- Item Management Improvements ---
   const [showArchived, setShowArchived] = useState(false);
   const [isImportingItems, setIsImportingItems] = useState(false);
   const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void }>({ 
       isOpen: false, title: '', message: '', onConfirm: () => {} 
   });
   const itemImportInputRef = useRef<HTMLInputElement>(null);

   const handleExportItems = () => {
       const data = items.map(i => {
           const row: any = {};
           MASTER_ITEM_COLUMNS.forEach(col => {
               let val = i[col.key as keyof Item];
               if (col.key === 'rfidFlag' || col.key === 'cogFlag') val = val ? 'Yes' : 'No';
               if (col.key === 'activeFlag') val = val !== false ? 'Active' : 'Archived';
               row[col.label] = val;
           });
           return row;
       });

       const ws = XLSX.utils.json_to_sheet(data);
       const wb = XLSX.utils.book_new();
       XLSX.utils.book_append_sheet(wb, ws, "Master Items");
       XLSX.writeFile(wb, `Master_Items_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
       success('Item list exported successfully');
   };
    const handleImportItems = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImportingItems(true);
        try {
            const data: any[] = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    try {
                        const bstr = evt.target?.result;
                        const wb = XLSX.read(bstr, { type: 'binary' });
                        const wsname = wb.SheetNames[0];
                        const ws = wb.Sheets[wsname];
                        resolve(XLSX.utils.sheet_to_json(ws));
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = (err) => reject(err);
                reader.readAsBinaryString(file);
            });

            // Comprehensive mapping
            const mappedItems: Partial<Item>[] = data.map(row => ({
                sku: row['SKU'] || row['sku'],
                name: row['Name'] || row['name'],
                description: row['Description'] || row['description'],
                category: row['Category'] || row['category'],
                subCategory: row['Sub Category'] || row['sub_category'],
                unitPrice: parseFloat(row['Unit Price'] || row['unit_price'] || '0'),
                uom: row['UOM'] || row['uom'],
                upq: parseInt(row['UPQ'] || row['upq'] || '1'),
                itemCatalog: row['Catalog'] || row['item_catalog'],
                itemType: row['Type'] || row['item_type'],
                itemPool: row['Pool'] || row['item_pool'],
                stockLevel: parseInt(row['Stock Level'] || row['stock_level'] || '0'),
                supplierId: row['Supplier ID'] || row['supplier_id'],
                
                // Extended Attributes
                rangeName: row['Range'] || row['range_name'],
                stockType: row['Stock Type'] || row['stock_type'],
                itemWeight: parseFloat(row['Weight'] || row['item_weight'] || '0'),
                itemColour: row['Color'] || row['item_colour'] || row['color'],
                itemPattern: row['Pattern'] || row['item_pattern'],
                itemMaterial: row['Material'] || row['item_material'],
                itemSize: row['Size'] || row['item_size'],
                measurements: row['Measurements'] || row['measurements'],
                rfidFlag: (row['RFID'] || row['rfid_flag'])?.toString().toLowerCase() === 'yes' || (row['RFID'] || row['rfid_flag']) === true,
                cogFlag: (row['COG'] || row['cog_flag'])?.toString().toLowerCase() === 'yes' || (row['COG'] || row['cog_flag']) === true,
                cogCustomer: row['COG Customer'] || row['cog_customer'],
                minLevel: parseInt(row['Min Level'] || row['min_level'] || '0'),
                maxLevel: parseInt(row['Max Level'] || row['max_level'] || '0'),
                activeFlag: row['Status'] ? row['Status'].toString().toLowerCase() === 'active' : true,
            })).filter(i => i.sku); // Ensure SKU exists

            if (mappedItems.length === 0) {
                alert("No valid items found in file. Ensure 'SKU' column exists.");
                return;
            }

            const shouldArchiveMissing = globalThis.confirm(
                `Found ${mappedItems.length} items to import.\n\nDo you want to ARCHIVE items that are NOT in this list?\n\nClick OK to Archive missing items (Replica Mode).\nClick Cancel to Update/Add only (Merge Mode).`
            );

            const result = await upsertProductMaster(mappedItems, shouldArchiveMissing);
            
            // Success Notification
            success(
                `Import complete: ${result.created || 0} created, ${result.updated || 0} updated, ${result.skipped || 0} skipped.`
            );

            if (shouldArchiveMissing && result.deactivated) {
                warning(`${result.deactivated} items have been archived.`);
            }
            
            // Explicitly reload data to refresh UI
            await reloadData(true);
            
        } catch (error: any) {
            console.error("Import failed:", error);
            alert('Failed to process import file: ' + (error.message || 'Unknown error'));
        } finally {
            setIsImportingItems(false);
            if (itemImportInputRef.current) itemImportInputRef.current.value = '';
        }
    };

   const requestDelete = (item: Item) => {
       setConfirmDialog({
           isOpen: true,
           title: 'Delete Item?',
           message: `Are you sure you want to delete "${item.name}" (${item.sku})? This will archive the item and hiding it from standard lists.`,
           onConfirm: async () => {
               await archiveItem(item.id);
               setConfirmDialog(prev => ({ ...prev, isOpen: false }));
               success('Item archived successfully');
           }
       });
   };

   // --- Item Tab Improvements ---
  // Removed isEditMode state as per user request
  
  // Unique Values for Dropdowns (Memoized)
  const uniqueValues = React.useMemo(() => {
      const map: Record<string, Set<string>> = {};
      items.forEach(i => {
          Object.keys(i).forEach(k => {
              if (typeof i[k as keyof Item] === 'string') {
                  if (!map[k]) map[k] = new Set();
                  if (i[k as keyof Item]) map[k].add(String(i[k as keyof Item]));
              }
          });
      });
      return map;
  }, [items]);

  const handleCellUpdate = async (id: string, field: string, value: any) => {
      const item = items.find(i => i.id === id);
      if (!item) return;
      
      const updated = { ...item, [field]: value };
      await updateItem(updated);
  };

  // --- Snapshot Form State ---
  const [isSnapshotFormOpen, setIsSnapshotFormOpen] = useState(false);
  const [snapSupplierId, setSnapSupplierId] = useState('');
  const [snapSku, setSnapSku] = useState('');
  const [snapProductName, setSnapProductName] = useState('');
  const [snapAvailable, setSnapAvailable] = useState(0);
  const [snapTotal, setSnapTotal] = useState(0);
  
  // --- Bulk Import State ---
  // --- Bulk Import State ---
  // --- Bulk Import State ---
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [importPreview, setImportPreview] = useState<SupplierStockSnapshot[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // New Paste Import State
  // --- Unified Stock Tab State ---
  const [stockSupplierId, setStockSupplierId] = useState('');
  const [stockDateFrom, setStockDateFrom] = useState(new Date().toISOString().split('T')[0]); // Renamed from stockFilterDateFrom to generic
  const [stockFilterDateTo, setStockFilterDateTo] = useState('');
  const [stockFilterStatus, setStockFilterStatus] = useState<'ALL' | 'MAPPED' | 'UNMAPPED' | 'PROPOSED' | 'ADDRESSED'>('UNMAPPED');
  
  // Import State (Derived)
  // importSupplierId removed -> use stockSupplierId
  const [importDate, setImportDate] = useState(new Date().toISOString().split('T')[0]);
  const [showMappingConfirmation, setShowMappingConfirmation] = useState(false);
  const [parseResult, setParseResult] = useState<EnhancedParseResult | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedSnapshot, setSelectedSnapshot] = useState<SupplierStockSnapshot | null>(null);

  // --- Catalog Edit State ---
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState(0);
  const [editSku, setEditSku] = useState('');

  // --- Mapping Workbench State ---
  const [mappingSubTab, setMappingSubTab] = useState<'EMAIL_INGEST' | 'SUPPLIER_ITEMS' | 'PROPOSED' | 'CONFIRMED' | 'REJECTED' | 'MEMORY'>('EMAIL_INGEST');
  const [mappingSupplierId, setMappingSupplierId] = useState('');
  const [notMappedTarget, setNotMappedTarget] = useState<SupplierProductMap | null>(null);
  const [notMappedReason, setNotMappedReason] = useState('No longer required');
  const [isManualMapOpen, setIsManualMapOpen] = useState(false);
  const [mappingSource, setMappingSource] = useState<SupplierStockSnapshot | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [guidedMappingIndex, setGuidedMappingIndex] = useState(0);
  const [selectedCandidateItemId, setSelectedCandidateItemId] = useState<string | null>(null);
  const [candidateSearch, setCandidateSearch] = useState('');

  // --- Email Ingestion Hub State ---
  const [isAutoIngestEnabled, setIsAutoIngestEnabled] = useState(true);
  const [manualIngestSupplierId, setManualIngestSupplierId] = useState(AUTO_DETECT_SUPPLIER_VALUE);
  const [manualIngestFile, setManualIngestFile] = useState<File | null>(null);
  const [ingestEmailAddress, setIngestEmailAddress] = useState(inboundEmailAddress);
  const [ingestInterval, setIngestInterval] = useState('Hourly');
  const [ingestionStats, setIngestionStats] = useState<{
      open: boolean;
      supplierName: string;
      recordsImported: number;
      confirmedMatches: number;
      proposedMatches: number;
  } | null>(null);

  // --- Verified Inbound Email Search State & Effect ---
  const [emailSearchQuery, setEmailSearchQuery] = useState(inboundEmailAddress);
  const [isSearchingEmail, setIsSearchingEmail] = useState(false);
  const [emailSearchResults, setEmailSearchResults] = useState<any[]>([]);

  const supplierInventoryUploads = React.useMemo(() => {
      return visibleSuppliers.map((supplier) => {
          const latestSnapshot = stockSnapshots
              .filter(snapshot => snapshot.supplierId === supplier.id)
              .sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime())[0];

          return {
              supplier,
              uploadedAt: latestSnapshot?.snapshotDate,
              sourceReportName: latestSnapshot?.sourceReportName,
              recordCount: stockSnapshots.filter(snapshot => snapshot.supplierId === supplier.id && snapshot.snapshotDate === latestSnapshot?.snapshotDate).length
          };
      }).sort((a, b) => a.supplier.name.localeCompare(b.supplier.name));
  }, [stockSnapshots, visibleSuppliers]);

  useEffect(() => {
      setIngestEmailAddress(inboundEmailAddress);
      setEmailSearchQuery(inboundEmailAddress);
  }, [inboundEmailAddress]);

  useEffect(() => {
      if (emailSearchQuery.trim().length < 2) {
          setEmailSearchResults([]);
          return;
      }
      
      const searchContextSiteId = activeSiteIds[0] || sites[0]?.id;
      const debouncedSearch = setTimeout(async () => {
          try {
              const results = await searchDirectory(emailSearchQuery, searchContextSiteId);
              const verifiedUsers = (results || []).map((du: any) => ({
                  id: du.id,
                  name: du.name || du.display_name || du.email.split('@')[0],
                  email: du.email,
              })).filter((du: any) => du.email && du.email.toLowerCase().includes(emailSearchQuery.toLowerCase()));
              
              setEmailSearchResults(verifiedUsers);
          } catch (err) {
              console.error('Failed to search email directory', err);
          }
      }, 300);

      return () => clearTimeout(debouncedSearch);
  }, [emailSearchQuery, activeSiteIds, sites]);

  // --- Security State ---
  const [activeRole, setActiveRole] = useState<RoleDefinition | null>(null);
  const [isRoleEditorOpen, setIsRoleEditorOpen] = useState(false);
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormDesc, setRoleFormDesc] = useState('');
  const [roleFormPerms, setRoleFormPerms] = useState<PermissionId[]>([]);

  // --- Item Master Form State ---
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemForm, setItemForm] = useState<Partial<Item>>({ 
      sku: '', name: '', description: '', unitPrice: 0, uom: 'Each', upq: 1, category: '', subCategory: '',
      supplierId: '', itemCatalog: '', itemPool: '', itemType: '', itemColour: '', itemPattern: '', itemMaterial: '', itemSize: '', measurements: ''
  });
  const [itemSearch, setItemSearch] = useState('');

  // --- Profile State ---
  const [profileForm, setProfileForm] = useState({ 
      name: currentUser?.name || '', 
      jobTitle: currentUser?.jobTitle || '', 
      avatar: currentUser?.avatar || '',
      pwaInstallPromptHidden: currentUser?.pwaInstallPromptHidden ?? false
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleSaveProfile = async () => {
      setIsSavingProfile(true);
      try {
          await updateProfile(profileForm);
          alert('Profile updated successfully!');
      } catch (e) {
          alert('Failed to update profile.');
      } finally {
          setIsSavingProfile(false);
      }
  };

  // --- Supplier Form State ---
  const [isSupplierFormOpen, setIsSupplierFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState<SupplierFormState>(createSupplierFormState());

  // --- Site Form State ---
  const [isSiteFormOpen, setIsSiteFormOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [siteForm, setSiteForm] = useState({ name: '', suburb: '', address: '', state: '', zip: '', contactPerson: '' });

  // --- Branding Form State ---
  const [brandingForm, setBrandingForm] = useState<AppBranding>({
      appName: branding.appName,
      logoUrl: branding.logoUrl,
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      fontFamily: branding.fontFamily,
      sidebarTheme: branding.sidebarTheme || 'system',
      menuConfig: branding.menuConfig,
      emailTemplate: branding.emailTemplate,
      homeExperience: {
          greetingMode: branding.homeExperience?.greetingMode || 'random',
          greetingText: branding.homeExperience?.greetingText || '',
          quoteMode: branding.homeExperience?.quoteMode || 'random',
          quoteText: branding.homeExperience?.quoteText || '',
          messageType: branding.homeExperience?.messageType || 'quote',
      },
  });

  useEffect(() => {
      setBrandingForm({
          appName: branding.appName,
          logoUrl: branding.logoUrl,
          primaryColor: branding.primaryColor,
          secondaryColor: branding.secondaryColor,
          fontFamily: branding.fontFamily,
          sidebarTheme: branding.sidebarTheme || 'system',
          menuConfig: branding.menuConfig,
          emailTemplate: branding.emailTemplate,
          homeExperience: {
              greetingMode: branding.homeExperience?.greetingMode || 'random',
              greetingText: branding.homeExperience?.greetingText || '',
              quoteMode: branding.homeExperience?.quoteMode || 'random',
              quoteText: branding.homeExperience?.quoteText || '',
              messageType: branding.homeExperience?.messageType || 'quote',
          },
      });
  }, [branding]);

  // --- Invite Wizard State ---
  const [inviteStep, setInviteStep] = useState<1 | 2>(1);
  const [inviteTab, setInviteTab] = useState<'SEARCH' | 'MANUAL' | 'MEMBERS'>('SEARCH');
  const [inviteForm, setInviteForm] = useState({
      id: '', name: '', email: '', jobTitle: '', role: 'SITE_USER', roleIds: ['SITE_USER'] as UserRole[], siteIds: [] as string[]
  });
  
  const handleResetInviteWizard = () => {
      setInviteStep(1);
      setInviteTab('SEARCH');
      setInviteForm({ 
        id: '', name: '', email: '', jobTitle: '', role: 'SITE_USER', roleIds: ['SITE_USER'],
        siteIds: activeSiteIds.length > 0 ? activeSiteIds : (sites.length > 0 ? [sites[0].id] : [])
      });
      setDirectorySearch('');
      setDirectoryResults([]);
      setIsDirectoryModalOpen(false);
  };
  
  const handleSelectUserForInvite = (u: any) => {
      setInviteForm({
          ...inviteForm,
          id: u.id,
          name: u.name,
          email: u.email,
          jobTitle: u.jobTitle || '',
          role: u.isExisting ? u.currentRole : (activeRole && activeRole.id !== 'ALL' ? activeRole.id : 'SITE_USER'),
          roleIds: u.isExisting ? (u.currentRoleIds || [u.currentRole]) : [activeRole && activeRole.id !== 'ALL' ? activeRole.id : 'SITE_USER'],
          siteIds: u.isExisting ? u.currentSiteIds : []
      });
      setInviteStep(2);
  };
  
  // --- Directory & Teams State ---
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState(false);
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryResults, setDirectoryResults] = useState<any[]>([]); // Mock User Objects
  
  // Dynamic search handling: Immediate local, Debounced directory
  useEffect(() => {
    // 1. Immediate Local Search
    const query = directorySearch.trim().toLowerCase();
    if (query.length > 0) {
      const localMatches = users.filter(u => 
          u.status !== 'ARCHIVED' && (
          (u.name || '').toLowerCase().includes(query) || 
          (u.email || '').toLowerCase().includes(query)
      )).map(u => ({
          id: u.id,
          name: u.name || 'Unknown User',
          email: u.email || '',
          jobTitle: u.jobTitle,
          isExisting: true,
          currentRole: u.role,
          currentRoleIds: u.roleIds || [u.role],
          currentSiteIds: u.siteIds || []
      }));
      
      // Update results with local matches immediately
      setDirectoryResults(localMatches);
    } else {
      setDirectoryResults([]);
    }

    // 2. Debounced Directory Search (for 3+ chars)
    const timer = setTimeout(() => {
      if (directorySearch.trim().length >= 3) {
        handleDirectorySearch();
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [directorySearch]);
  
  const [isTeamsConfigOpen, setIsTeamsConfigOpen] = useState(false);
  const [teamsUrlForm, setTeamsUrlForm] = useState(teamsWebhookUrl);
  
  // --- User Management State ---
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [roleSaveStatus, setRoleSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => { setTeamsUrlForm(teamsWebhookUrl); }, [teamsWebhookUrl]);

  const [itemFilters, setItemFilters] = useState<Record<string, string>>({});
  
  // --- Hierarchy Filters ---
  const [filterPool, setFilterPool] = useState('');
  const [filterCatalog, setFilterCatalog] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubCategory, setFilterSubCategory] = useState('');

  // Auto-reset down-stream filters
  useEffect(() => { setFilterCatalog(''); setFilterType(''); setFilterCategory(''); setFilterSubCategory(''); }, [filterPool]);
  useEffect(() => { setFilterType(''); setFilterCategory(''); setFilterSubCategory(''); }, [filterCatalog]);
  useEffect(() => { setFilterCategory(''); setFilterSubCategory(''); }, [filterType]);
  useEffect(() => { setFilterSubCategory(''); }, [filterCategory]);

  useEffect(() => { setFilterSubCategory(''); }, [filterCategory]);

  type SupplierInventoryIngestSource = 'Manual Upload' | 'Email Ingestion Hub' | 'Auto-Ingestion Daemon';

  const processSupplierInventoryFile = async (
      supplier: Supplier,
      file: File,
      source: SupplierInventoryIngestSource,
      parsedResult?: EnhancedParseResult
  ) => {
      const { parseStockFileEnhanced } = await import('../utils/fileParser.ts');
      const parsed = parsedResult || await parseStockFileEnhanced(file);
      if (!parsed.success) {
          throw new Error(parsed.errors.join('\n'));
      }

      const importDateValue = new Date().toISOString().split('T')[0];
      const fullSnapshots: SupplierStockSnapshot[] = (parsed.data || []).map((partial: any) => ({
          id: uuidv4(),
          supplierId: supplier.id,
          supplierSku: partial.supplierSku || '',
          productName: partial.productName || 'Unknown Product',
          customerStockCode: partial.customerStockCode,
          range: partial.range,
          category: partial.category,
          subCategory: partial.subCategory,
          stockType: partial.stockType,
          cartonQty: partial.cartonQty,
          stockOnHand: partial.stockOnHand !== undefined ? partial.stockOnHand : (partial.availableQty || 0),
          committedQty: partial.committedQty || 0,
          backOrderedQty: partial.backOrderedQty || 0,
          availableQty: partial.availableQty !== undefined ? partial.availableQty : (partial.stockOnHand || 0),
          totalStockQty: partial.stockOnHand !== undefined ? partial.stockOnHand : (partial.availableQty || 0),
          sellPrice: partial.sellPrice,
          sohValueAtSell: partial.sohValueAtSell !== undefined ? partial.sohValueAtSell : ((partial.stockOnHand || partial.availableQty || 0) * (partial.sellPrice || 0)),
          snapshotDate: importDateValue,
          sourceReportName: `${source}: ${file.name}${parsed.detectedSupplier ? ` (Detected: ${parsed.detectedSupplier.name})` : ''}`,
          incomingStock: partial.incomingStock || []
      }));

      await importStockSnapshot(supplier.id, importDateValue, fullSnapshots);
      const mappingResults = await runAutoMapping(supplier.id);
      await refreshAvailability();
      await reloadData();

      setIngestionStats({
          open: true,
          supplierName: supplier.name,
          recordsImported: fullSnapshots.length,
          confirmedMatches: mappingResults.confirmed,
          proposedMatches: mappingResults.proposed
      });

      return { recordsImported: fullSnapshots.length, mappingResults };
  };

  const findVisibleSupplierByName = (name?: string) => {
      if (!name) return undefined;
      const normalized = normalizeSupplierName(name);
      return visibleSuppliers.find(supplier => normalizeSupplierName(supplier.name) === normalized);
  };

  const createSupplierFromDetection = async (name: string) => {
      const newSupplier: Supplier = {
          id: uuidv4(),
          name,
          contactEmail: '',
          keyContact: 'Inventory Contact',
          phone: '',
          address: '',
          categories: ['Inventory', 'SOH']
      };
      await addSupplier(newSupplier);
      return newSupplier;
  };

  const resolveSupplierForInventoryImport = async (
      parsed: EnhancedParseResult,
      selectedSupplier?: Supplier
  ): Promise<Supplier> => {
      const detected = parsed.detectedSupplier;

      if (detected?.isExcluded || isExcludedSupplierName(detected?.name)) {
          throw new Error(`${detected.name} is an SPL internal stock group, not a supplier. It has been excluded from supplier selection.`);
      }

      const detectedSupplier = findVisibleSupplierByName(detected?.name);

      if (detectedSupplier && selectedSupplier && detectedSupplier.id !== selectedSupplier.id) {
          const useDetected = globalThis.confirm(
              `This file appears to be from ${detectedSupplier.name}, but ${selectedSupplier.name} was selected.\n\nImport under ${detectedSupplier.name} instead?`
          );
          if (!useDetected) {
              throw new Error('Upload cancelled so the supplier selection can be corrected.');
          }
          return detectedSupplier;
      }

      if (detectedSupplier) {
          return detectedSupplier;
      }

      if (detected?.name && !selectedSupplier) {
          const shouldCreate = globalThis.confirm(
              `This file appears to be from ${detected.name}, but that supplier is not in the supplier list.\n\nCreate ${detected.name} and import this inventory?`
          );
          if (!shouldCreate) {
              throw new Error('Upload cancelled so the supplier can be reviewed before import.');
          }
          return createSupplierFromDetection(detected.name);
      }

      if (detected?.name && selectedSupplier && normalizeSupplierName(detected.name) !== normalizeSupplierName(selectedSupplier.name)) {
          const shouldCreate = globalThis.confirm(
              `This file appears to be from ${detected.name}, but ${selectedSupplier.name} was selected.\n\nCreate ${detected.name} and import under the detected supplier instead?`
          );
          if (shouldCreate) {
              return createSupplierFromDetection(detected.name);
          }
      }

      if (selectedSupplier) {
          return selectedSupplier;
      }

      throw new Error('The supplier could not be identified from the file contents. Select an existing supplier or add the supplier before uploading.');
  };

  const handleManualSupplierUpload = async () => {
      if (!manualIngestFile) {
          error('Upload an inventory file first.');
          return;
      }

      const selectedSupplier = manualIngestSupplierId === AUTO_DETECT_SUPPLIER_VALUE
          ? undefined
          : visibleSuppliers.find(s => s.id === manualIngestSupplierId);

      setIsImporting(true);
      try {
          const { parseStockFileEnhanced } = await import('../utils/fileParser.ts');
          const parsed = await parseStockFileEnhanced(manualIngestFile);
          if (!parsed.success) {
              throw new Error(parsed.errors.join('\n'));
          }

          const supplier = await resolveSupplierForInventoryImport(parsed, selectedSupplier);
          const result = await processSupplierInventoryFile(supplier, manualIngestFile, 'Manual Upload', parsed);
          setManualIngestFile(null);
          setManualIngestSupplierId(supplier.id);
          setMappingSupplierId(supplier.id);
          setStockSupplierId(supplier.id);
          success(`${supplier.name} inventory replaced from manual upload (${result.recordsImported} records).`);
      } catch (e: any) {
          console.error('Manual supplier upload failed:', e);
          error(`Manual upload failed: ${e.message}`);
      } finally {
          setIsImporting(false);
      }
  };

  const supplierScopedMappings = React.useMemo(() => {
      return mappings.filter(mapping => !mappingSupplierId || mapping.supplierId === mappingSupplierId);
  }, [mappingSupplierId, mappings]);

  const supplierScopedSnapshots = React.useMemo(() => {
      return stockSnapshots.filter(snapshot => !mappingSupplierId || snapshot.supplierId === mappingSupplierId);
  }, [mappingSupplierId, stockSnapshots]);

  const mappingReviewStats = React.useMemo(() => {
      const proposed = supplierScopedMappings.filter(mapping => mapping.mappingStatus === 'PROPOSED');
      const confirmed = supplierScopedMappings.filter(mapping => mapping.mappingStatus === 'CONFIRMED');
      const notMapped = supplierScopedMappings.filter(mapping => mapping.mappingStatus === 'REJECTED');
      const unmapped = supplierScopedSnapshots.filter(snapshot => !supplierScopedMappings.some(mapping => mapping.supplierId === snapshot.supplierId && mapping.supplierSku === snapshot.supplierSku));
      const highConfidence = proposed.filter(mapping => mapping.confidenceScore >= 0.9);
      const needsReview = proposed.filter(mapping => mapping.confidenceScore < 0.9);

      return {
          proposed,
          confirmed,
          notMapped,
          unmapped,
          highConfidence,
          needsReview,
          totalSnapshotRows: supplierScopedSnapshots.length,
          completionPct: supplierScopedSnapshots.length > 0 ? Math.round((confirmed.length / supplierScopedSnapshots.length) * 100) : 0
      };
  }, [supplierScopedMappings, supplierScopedSnapshots]);

  const selectedMappingSupplier = visibleSuppliers.find(supplier => supplier.id === mappingSupplierId);

  const systemMemoryRows = React.useMemo(() => {
      return mappingReviewStats.confirmed.map(mapping => {
          const item = items.find(i => i.id === mapping.productId);
          const supplier = suppliers.find(s => s.id === mapping.supplierId);

          return {
              ...mapping,
              productName: mapping.productName || item?.name || 'Item missing',
              internalSku: mapping.internalSku || item?.sku || '',
              supplierName: mapping.supplierName || supplier?.name || '-'
          };
      });
  }, [items, mappingReviewStats.confirmed, suppliers]);

  const guidedReviewQueue = React.useMemo(() => {
      return [...mappingReviewStats.proposed].sort((a, b) => {
          const aPriority = a.confidenceScore >= 0.9 ? 1 : 0;
          const bPriority = b.confidenceScore >= 0.9 ? 1 : 0;
          if (aPriority !== bPriority) return aPriority - bPriority;
          return a.confidenceScore - b.confidenceScore;
      });
  }, [mappingReviewStats.proposed]);

  useEffect(() => {
      setGuidedMappingIndex(0);
      setSelectedCandidateItemId(null);
      setCandidateSearch('');
  }, [mappingSupplierId, mappingReviewStats.proposed.length]);

  const currentGuidedMapping = guidedReviewQueue[Math.min(guidedMappingIndex, Math.max(guidedReviewQueue.length - 1, 0))];
  const currentGuidedSnapshot = currentGuidedMapping
      ? stockSnapshots.find(snapshot => snapshot.supplierId === currentGuidedMapping.supplierId && snapshot.supplierSku === currentGuidedMapping.supplierSku)
      : undefined;
  const currentGuidedSupplier = currentGuidedMapping ? suppliers.find(supplier => supplier.id === currentGuidedMapping.supplierId) : undefined;
  const currentGuidedItem = currentGuidedMapping ? items.find(item => item.id === currentGuidedMapping.productId) : undefined;

  const guidedCandidates = React.useMemo<MappingCandidate[]>(() => {
      if (!currentGuidedMapping) return [];
      const snapshot = currentGuidedSnapshot;
      const supplierText = [
          snapshot?.productName,
          snapshot?.supplierSku,
          snapshot?.customerStockCode,
          snapshot?.category,
          snapshot?.subCategory,
          snapshot?.stockType,
          currentGuidedMapping.supplierSku,
          currentGuidedMapping.supplierCustomerStockCode
      ].filter(Boolean).join(' ');
      const supplierNorms = [
          snapshot?.customerStockCodeNorm,
          snapshot?.customerStockCodeAltNorm,
          snapshot?.customerStockCode ? normalizeItemCode(snapshot.customerStockCode).normalized : '',
          currentGuidedMapping.supplierCustomerStockCode ? normalizeItemCode(currentGuidedMapping.supplierCustomerStockCode).normalized : '',
          currentGuidedMapping.supplierSku ? normalizeItemCode(currentGuidedMapping.supplierSku).normalized : ''
      ].filter(Boolean);
      const search = candidateSearch.trim().toLowerCase();

      return items
          .filter(item => !search || `${item.name} ${item.sku} ${item.description || ''} ${item.category || ''}`.toLowerCase().includes(search))
          .map(item => {
              const itemNorm = item.sapItemCodeNorm || normalizeItemCode(item.sku || '').normalized;
              const itemAltText = [item.name, item.description, item.sku, item.category, item.subCategory, item.itemType, item.measurements].filter(Boolean).join(' ');
              const reasons: string[] = [];
              let score = item.id === currentGuidedMapping.productId ? currentGuidedMapping.confidenceScore : 0;

              if (supplierNorms.some(norm => norm && norm === itemNorm)) {
                  score += 1;
                  reasons.push('SPL item code matches internal SKU');
              } else if (supplierNorms.some(norm => norm && (norm.includes(itemNorm) || itemNorm.includes(norm)))) {
                  score += 0.45;
                  reasons.push('Close code relationship');
              }

              const textScore = overlapScore(supplierText, itemAltText);
              if (textScore >= 0.45) {
                  score += 0.24;
                  reasons.push('Strong product wording overlap');
              } else if (textScore >= 0.2) {
                  score += 0.12;
                  reasons.push('Some product wording overlap');
              }

              if (snapshot?.category && item.category && normalizeSupplierName(snapshot.category) === normalizeSupplierName(item.category)) {
                  score += 0.12;
                  reasons.push('Category aligns');
              }

              if (item.id === currentGuidedMapping.productId) {
                  reasons.unshift('Current proposed match');
              }

              return {
                  item,
                  score: Math.min(1, score),
                  reasons: reasons.length ? reasons : ['Low signal alternative'],
                  isCurrent: item.id === currentGuidedMapping.productId
              };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, search ? 12 : 6);
  }, [candidateSearch, currentGuidedItem?.id, currentGuidedMapping, currentGuidedSnapshot, items]);

  useEffect(() => {
      setSelectedCandidateItemId(currentGuidedMapping?.productId || null);
      setCandidateSearch('');
  }, [currentGuidedMapping?.id]);

  const selectedGuidedCandidate = guidedCandidates.find(candidate => candidate.item.id === selectedCandidateItemId) || guidedCandidates[0];

  const moveToNextGuidedMapping = () => {
      setGuidedMappingIndex(prev => guidedReviewQueue.length === 0 ? 0 : Math.min(prev + 1, guidedReviewQueue.length - 1));
  };

  const confirmGuidedCandidate = async (candidate?: MappingCandidate) => {
      if (!currentGuidedMapping || !candidate) return;
      const changedItem = candidate.item.id !== currentGuidedMapping.productId;
      await updateMapping({
          ...currentGuidedMapping,
          productId: candidate.item.id,
          mappingStatus: 'CONFIRMED',
          mappingMethod: changedItem ? 'MANUAL' : currentGuidedMapping.mappingMethod,
          confidenceScore: changedItem ? Math.max(candidate.score, 0.95) : currentGuidedMapping.confidenceScore,
          manualOverride: changedItem || currentGuidedMapping.manualOverride,
          mappingJustification: changedItem ? {
              components: [
                  { type: 'ADMIN_CONFIRMED', score: 1, detail: 'Admin selected this candidate in guided mapping review' },
                  ...candidate.reasons.slice(0, 3).map(reason => ({ type: 'MATCH_SIGNAL', score: candidate.score, detail: reason }))
              ]
          } : currentGuidedMapping.mappingJustification
      } as SupplierProductMap);
      success(`Mapped ${currentGuidedMapping.supplierSku} to ${candidate.item.name}.`);
      moveToNextGuidedMapping();
  };

  const markMappingNotMapped = async () => {
      if (!notMappedTarget) return;

      await updateMapping({
          ...notMappedTarget,
          mappingStatus: 'REJECTED',
          manualOverride: true,
          mappingMethod: 'MANUAL',
          mappingJustification: {
              components: [{
                  type: 'NOT_MAPPED',
                  score: 0,
                  detail: notMappedReason || 'Admin marked this supplier row as not mapped'
              }]
          }
      } as SupplierProductMap);

      setNotMappedTarget(null);
      setNotMappedReason('No longer required');
      success('Supplier item marked as not mapped.');
  };

  const renderGuidedMappingReview = () => {
      if (guidedReviewQueue.length === 0) {
          return (
              <div className="p-10 text-center">
                  <div className="inline-flex p-3 rounded-full bg-green-50 dark:bg-green-950/20 text-green-600 mb-3">
                      <CheckCircle2 size={28}/>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">All auto-matches confirmed</h3>
                  <p className="text-sm text-secondary dark:text-gray-400 mt-1">Nothing left to confirm here. Run Auto-Match after the next supplier upload, or head to System Memory to review your locked decisions.</p>
              </div>
          );
      }

      const mapping = currentGuidedMapping;
      if (!mapping) return null;
      const confidenceTone = getConfidenceTone(mapping.confidenceScore);
      const selectedTone = getConfidenceTone(selectedGuidedCandidate?.score || 0);
      const progressPct = Math.round(((Math.min(guidedMappingIndex + 1, guidedReviewQueue.length)) / guidedReviewQueue.length) * 100);
      const supplierDescriptorTags = extractDescriptorTags(currentGuidedSnapshot?.productName);
      const selectedDescriptorTags = extractDescriptorTags(getItemDescriptorText(selectedGuidedCandidate?.item || currentGuidedItem));

      return (
          <div className="p-5 space-y-5">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
                  <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <Sparkles size={20} className="text-[var(--color-brand)]"/>
                          Confirm Auto-Matches
                      </h3>
                      <p className="text-xs text-secondary dark:text-gray-400 mt-1">
                          The system found these potential matches automatically — but needs your confirmation before locking them in. Review each one, adjust if needed, and confirm or reject. Confirmed mappings are saved to System Memory and applied automatically on future uploads.
                      </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                      {selectedGuidedCandidate && !selectedGuidedCandidate.isCurrent && (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Manual override</span>
                      )}
                      <button type="button" onClick={moveToNextGuidedMapping} className="btn-secondary text-xs">Skip</button>
                      <button
                          type="button"
                          onClick={() => { setNotMappedTarget(mapping); setNotMappedReason('No longer required'); }}
                          className="btn-secondary flex items-center gap-2 text-xs text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/20"
                      >
                          <MinusCircle size={14}/> Not Mapped
                      </button>
                      <button
                          type="button"
                          onClick={() => confirmGuidedCandidate(selectedGuidedCandidate)}
                          className="btn-primary flex items-center gap-2 text-xs font-bold"
                          disabled={!selectedGuidedCandidate}
                      >
                          <CheckCircle2 size={15}/>
                          {selectedGuidedCandidate?.isCurrent === false ? 'Confirm Selected Match' : 'Confirm This Match'}
                          <ArrowRight size={14}/>
                      </button>
                  </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-5">
                  <aside className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-gray-50/60 dark:bg-white/5">
                      <div className="p-3 border-b border-gray-200 dark:border-gray-800">
                          <div className="text-[10px] uppercase font-bold text-secondary dark:text-gray-500">Smart queue</div>
                          <div className="text-xs text-gray-500 mt-0.5">Lower confidence items are surfaced first.</div>
                      </div>
                      <div className="max-h-[520px] overflow-y-auto">
                          {guidedReviewQueue.map((queueMap, index) => {
                              const queueSnapshot = stockSnapshots.find(snapshot => snapshot.supplierId === queueMap.supplierId && snapshot.supplierSku === queueMap.supplierSku);
                              const tone = getConfidenceTone(queueMap.confidenceScore);
                              return (
                                  <button
                                      type="button"
                                      key={queueMap.id}
                                      onClick={() => setGuidedMappingIndex(index)}
                                      className={`w-full text-left p-3 border-b border-gray-200 dark:border-gray-800 transition-colors ${index === guidedMappingIndex ? 'bg-white dark:bg-nocturne' : 'hover:bg-white/80 dark:hover:bg-white/10'}`}
                                  >
                                      <div className="flex items-center justify-between gap-2">
                                          <div className="font-bold text-sm text-gray-900 dark:text-white truncate">{queueMap.supplierSku}</div>
                                          <span className={`text-[10px] font-bold ${tone.text}`}>{Math.round(queueMap.confidenceScore * 100)}%</span>
                                      </div>
                                      <div className="text-xs text-secondary dark:text-gray-400 truncate mt-0.5">{queueSnapshot?.productName || queueMap.supplierCustomerStockCode || 'Supplier row'}</div>
                                  </button>
                              );
                          })}
                      </div>
                  </aside>

                  <div className="space-y-5">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <section className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-nocturne">
                              <div className="flex items-center justify-between gap-3 mb-4">
                                  <div>
                                      <div className="text-[10px] uppercase font-bold text-secondary dark:text-gray-500">Supplier item</div>
                                      <h4 className="text-lg font-bold text-gray-900 dark:text-white">{mapping.supplierSku}</h4>
                                  </div>
                                  <span className="badge-gray">{currentGuidedSupplier?.name || 'Supplier'}</span>
                              </div>
                              <div className="space-y-3 text-sm">
                                  <div>
                                      <div className="text-[10px] uppercase font-bold text-secondary dark:text-gray-500">Description from report</div>
                                      <div className="font-semibold text-gray-900 dark:text-white">{currentGuidedSnapshot?.productName || 'No supplier description captured'}</div>
                                      {supplierDescriptorTags.length > 0 && (
                                          <div className="flex flex-wrap gap-2 mt-2">
                                              {supplierDescriptorTags.map(tag => (
                                                  <span key={`${tag.type}-${tag.label}`} className="text-[10px] font-bold px-2 py-1 rounded-full bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300">
                                                      {tag.type}: {tag.label}
                                                  </span>
                                              ))}
                                          </div>
                                      )}
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                      <div className="p-3 rounded-lg bg-gray-50 dark:bg-white/5">
                                          <div className="text-[10px] uppercase font-bold text-secondary dark:text-gray-500">SPL item code</div>
                                          <div className="font-mono text-xs">{currentGuidedSnapshot?.customerStockCode || mapping.supplierCustomerStockCode || '-'}</div>
                                      </div>
                                      <div className="p-3 rounded-lg bg-gray-50 dark:bg-white/5">
                                          <div className="text-[10px] uppercase font-bold text-secondary dark:text-gray-500">Category</div>
                                          <div className="font-semibold">{currentGuidedSnapshot?.category || '-'}</div>
                                      </div>
                                      <div className="p-3 rounded-lg bg-gray-50 dark:bg-white/5">
                                          <div className="text-[10px] uppercase font-bold text-secondary dark:text-gray-500">SOH / available</div>
                                          <div className="font-semibold">{currentGuidedSnapshot ? `${currentGuidedSnapshot.stockOnHand} / ${currentGuidedSnapshot.availableQty}` : '-'}</div>
                                      </div>
                                      <div className="p-3 rounded-lg bg-gray-50 dark:bg-white/5">
                                          <div className="text-[10px] uppercase font-bold text-secondary dark:text-gray-500">UPQ / type</div>
                                          <div className="font-semibold">{currentGuidedSnapshot?.cartonQty || '-'} / {currentGuidedSnapshot?.stockType || '-'}</div>
                                      </div>
                                  </div>
                              </div>
                          </section>

                          <section className={`rounded-xl border p-4 ${selectedTone.bg} ${selectedTone.border}`}>
                              <div className="flex items-center justify-between gap-3 mb-4">
                                  <div>
                                      <div className="text-[10px] uppercase font-bold text-secondary dark:text-gray-500">Will be confirmed as</div>
                                      <h4 className="text-lg font-bold text-gray-900 dark:text-white">{selectedGuidedCandidate?.item.name || currentGuidedItem?.name || 'Select a candidate'}</h4>
                                  </div>
                                  <div className="text-right">
                                      <div className={`text-lg font-black ${selectedTone.text}`}>{Math.round((selectedGuidedCandidate?.score || mapping.confidenceScore) * 100)}%</div>
                                      <div className="text-[10px] uppercase font-bold text-secondary dark:text-gray-500">{selectedTone.label}</div>
                                  </div>
                              </div>
                              {selectedGuidedCandidate ? (
                                  <div className="space-y-3 text-sm">
                                      <div className="grid grid-cols-2 gap-3">
                                          <div className="p-3 rounded-lg bg-white/70 dark:bg-black/10">
                                              <div className="text-[10px] uppercase font-bold text-secondary dark:text-gray-500">Internal SKU</div>
                                              <div className="font-mono text-xs">{selectedGuidedCandidate.item.sku}</div>
                                          </div>
                                          <div className="p-3 rounded-lg bg-white/70 dark:bg-black/10">
                                              <div className="text-[10px] uppercase font-bold text-secondary dark:text-gray-500">Category</div>
                                              <div className="font-semibold">{selectedGuidedCandidate.item.category || '-'}</div>
                                          </div>
                                      </div>
                                      <div>
                                          <div className="text-[10px] uppercase font-bold text-secondary dark:text-gray-500 mb-1">Why this is suggested</div>
                                          <div className="flex flex-wrap gap-2">
                                              {selectedGuidedCandidate.reasons.map(reason => <span key={reason} className="badge-gray">{reason}</span>)}
                                          </div>
                                      </div>
                                      {selectedDescriptorTags.length > 0 && (
                                          <div>
                                              <div className="text-[10px] uppercase font-bold text-secondary dark:text-gray-500 mb-1">System item descriptors</div>
                                              <div className="flex flex-wrap gap-2">
                                                  {selectedDescriptorTags.map(tag => (
                                                      <span key={`${tag.type}-${tag.label}`} className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/80 dark:bg-black/10 text-gray-700 dark:text-gray-300 border border-white/70 dark:border-white/10">
                                                          {tag.type}: {tag.label}
                                                      </span>
                                                  ))}
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              ) : (
                                  <div className="text-sm text-secondary">Choose an option below to see item details.</div>
                              )}
                          </section>
                      </div>

                      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-nocturne">
                          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                              <div>
                                  <h4 className="font-bold text-gray-900 dark:text-white">Likely options</h4>
                                  <p className="text-xs text-secondary dark:text-gray-500">The system's proposal is pre-selected. Click a row to switch — the panel above updates live.</p>
                              </div>
                              <div className="relative min-w-[260px]">
                                  <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                                  <input
                                      className="input-field pl-9"
                                      placeholder="Search item master..."
                                      value={candidateSearch}
                                      onChange={e => setCandidateSearch(e.target.value)}
                                  />
                              </div>
                          </div>
                          <div className="divide-y divide-gray-100 dark:divide-gray-800">
                              {guidedCandidates.map(candidate => {
                                  const tone = getConfidenceTone(candidate.score);
                                  const isSelected = candidate.item.id === selectedGuidedCandidate?.item.id;
                                  return (
                                      <button
                                          type="button"
                                          key={candidate.item.id}
                                          onClick={() => setSelectedCandidateItemId(candidate.item.id)}
                                          className={`w-full text-left p-4 transition-colors ${isSelected ? 'bg-blue-50/70 dark:bg-blue-950/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                      >
                                          <div className="grid grid-cols-1 lg:grid-cols-[28px_1fr_150px_120px] gap-3 lg:items-center">
                                              <div className="flex items-center justify-center pt-0.5">
                                                  {isSelected
                                                      ? <CheckCircle2 size={18} className="text-blue-600 dark:text-blue-400 shrink-0"/>
                                                      : <div className="w-[18px] h-[18px] rounded-full border-2 border-gray-300 dark:border-gray-600"/>
                                                  }
                                              </div>
                                              <div>
                                                  <div className="flex items-center gap-2">
                                                      <span className="font-bold text-gray-900 dark:text-white">{candidate.item.name}</span>
                                                      {candidate.isCurrent && <span className="text-[10px] font-bold text-blue-700 bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 px-2 py-0.5 rounded-full">System proposal</span>}
                                                  </div>
                                                  <div className="text-xs font-mono text-secondary dark:text-gray-500 mt-0.5">{candidate.item.sku}</div>
                                                  <div className="text-[11px] text-secondary dark:text-gray-500 mt-1">{candidate.reasons.slice(0, 3).join(' | ')}</div>
                                              </div>
                                              <div className="text-xs">
                                                  <div className="font-bold text-gray-700 dark:text-gray-300">{candidate.item.category || '-'}</div>
                                                  <div className="text-secondary dark:text-gray-500">{candidate.item.subCategory || candidate.item.itemType || ''}</div>
                                              </div>
                                              <div>
                                                  <div className="flex items-center gap-2">
                                                      <div className="h-2 flex-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                          <div className={`h-full ${tone.bar}`} style={{ width: `${Math.round(candidate.score * 100)}%` }}/>
                                                      </div>
                                                      <span className={`text-xs font-black ${tone.text}`}>{Math.round(candidate.score * 100)}%</span>
                                                  </div>
                                              </div>
                                          </div>
                                      </button>
                                  );
                              })}
                          </div>
                      </section>
                  </div>
              </div>
          </div>
      );
  };

  // --- Email Ingestion Configuration ---

  const renderEmailIngestionHub = () => {
      const isManualMode = !isAutoIngestEnabled;
      const selectedManualSupplier = visibleSuppliers.find(supplier => supplier.id === manualIngestSupplierId);
      const selectedInventoryUpload = manualIngestSupplierId && manualIngestSupplierId !== AUTO_DETECT_SUPPLIER_VALUE
          ? supplierInventoryUploads.find(({ supplier }) => supplier.id === manualIngestSupplierId)
          : null;
      return (
          <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
                  <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <MailOpen className="text-blue-500" size={20} />
                          Supplier Inventory Ingestion Hub
                      </h3>
                      <p className="text-xs text-secondary dark:text-gray-400 mt-1">
                          Update supplier inventory from either a manual upload or the automated inbound email pipeline. Both modes replace the supplier inventory and then run the same mapping and availability refresh process.
                      </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                      <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-800">
                          <button
                              type="button"
                              onClick={() => {
                                  setIsAutoIngestEnabled(false);
                                  success('Manual supplier upload mode enabled.');
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isManualMode ? 'bg-white dark:bg-nocturne text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                          >
                              Manual Upload
                          </button>
                          <button
                              type="button"
                              onClick={() => {
                                  setIsAutoIngestEnabled(true);
                                  success('Automated email ingestion mode enabled.');
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isAutoIngestEnabled ? 'bg-white dark:bg-nocturne text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                          >
                              Automated Email
                          </button>
                      </div>
                  </div>
              </div>

              {/* Grid Layout: Config on Left, Status/Inbox on Right */}
              <div className={`grid grid-cols-1 gap-6 ${isManualMode ? 'lg:grid-cols-[minmax(360px,460px)_minmax(0,1fr)]' : 'lg:grid-cols-3'}`}>
                  {/* Left Column: Configuration Card */}
                  <div className="lg:col-span-1 space-y-5 bg-white dark:bg-nocturne p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm animate-fade-in">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <SettingsIcon size={16} className="text-gray-400" />
                          {isManualMode ? 'Manual Upload' : 'Daemon Configuration'}
                      </h4>
                      
                      <div className="space-y-4 text-xs">
                          {isManualMode ? (
                              <div className="space-y-4">
                                  <div className="space-y-1.5">
                                      <label className="font-bold text-secondary dark:text-gray-400 uppercase tracking-wider text-[10px]">
                                          Supplier
                                      </label>
                                      <select
                                          value={manualIngestSupplierId}
                                          onChange={(e) => {
                                              setManualIngestSupplierId(e.target.value);
                                              setMappingSupplierId(e.target.value);
                                          }}
                                          className="w-full bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-850 px-3 py-2 rounded-xl text-primary font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                      >
                                          <option value={AUTO_DETECT_SUPPLIER_VALUE}>Auto-detect from file</option>
                                          {visibleSuppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                                      </select>
                                  </div>

                                  <label className="block p-5 bg-blue-50/40 dark:bg-blue-950/10 border border-dashed border-blue-300 dark:border-blue-800 rounded-xl cursor-pointer hover:border-blue-500 transition-colors">
                                      <input
                                          type="file"
                                          accept=".xlsx,.xls,.csv"
                                          className="hidden"
                                          onChange={(e) => setManualIngestFile(e.target.files?.[0] || null)}
                                      />
                                      <div className="flex items-center gap-3">
                                          <div className="p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 rounded-lg">
                                              <Upload size={18} />
                                          </div>
                                          <div className="min-w-0">
                                              <p className="font-bold text-gray-900 dark:text-white truncate">{manualIngestFile ? manualIngestFile.name : 'Upload latest supplier file'}</p>
                                              <p className="text-[10px] text-tertiary dark:text-gray-500">Excel or CSV inventory report</p>
                                          </div>
                                      </div>
                                  </label>

                                  <button
                                      type="button"
                                      onClick={handleManualSupplierUpload}
                                      disabled={isImporting || !manualIngestFile}
                                      className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                                  >
                                      {isImporting ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                      Replace Supplier Inventory
                                  </button>

                                  <div className="p-3 bg-blue-50 dark:bg-blue-900/10 text-blue-800 dark:text-blue-300 rounded-xl border border-blue-100 dark:border-blue-900/20 text-[11px] leading-relaxed">
                                      The uploaded file replaces the selected supplier inventory, then automatically runs item mapping and availability refresh.
                                  </div>
                              </div>
                          ) : (
                              <>
                          <div className="flex items-center justify-between p-3 bg-white dark:bg-nocturne rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
                              <div>
                                  <p className="font-bold text-gray-900 dark:text-white">Dedicated Mailbox Pipeline</p>
                                  <p className="text-[10px] text-tertiary">Ready for Microsoft Graph mailbox ingestion</p>
                              </div>
                              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full text-[10px] font-bold border border-blue-100 dark:border-blue-900/30">
                                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                                  Awaiting mailbox
                              </span>
                          </div>
                          <div className="space-y-1.5 relative">
                              <label className="font-bold text-secondary dark:text-gray-400 uppercase tracking-wider text-[10px]">
                                  Ingestion Inbound Address (Entra ID)
                              </label>
                              <div className="relative">
                                  <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                                  <input
                                      type="text"
                                      value={emailSearchQuery}
                                      onChange={(e) => {
                                          setEmailSearchQuery(e.target.value);
                                          setIsSearchingEmail(true);
                                      }}
                                      className="w-full bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-850 pl-8 pr-8 py-2 rounded-xl text-primary font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-xs"
                                      placeholder="Search directory for active email..."
                                  />
                                  {emailSearchQuery === ingestEmailAddress && ingestEmailAddress && (
                                      <div className="absolute right-3 top-2.5 text-green-500" title="Verified Entra ID Active Address">
                                          <CheckCircle2 size={14} />
                                      </div>
                                  )}
                              </div>
                              
                              {/* Verified Active Badge */}
                              {ingestEmailAddress && emailSearchQuery === ingestEmailAddress && (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-[9px] font-bold border border-emerald-100 dark:border-emerald-900/30">
                                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                      Active Entra ID Account: {ingestEmailAddress}
                                  </div>
                              )}

                              {/* Search results dropdown */}
                              {isSearchingEmail && emailSearchQuery.trim().length >= 2 && (
                                  <div className="absolute z-50 mt-1 w-full bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl max-h-48 overflow-y-auto pr-1">
                                      {emailSearchResults.length === 0 ? (
                                          <div className="p-3 text-center text-[10px] text-gray-400 italic">
                                              No active accounts found
                                          </div>
                                      ) : (
                                          emailSearchResults.map((user: any) => (
                                              <button
                                                  type="button"
                                                  key={user.id || user.email}
                                                  onClick={() => {
                                                      updateInboundEmailAddress(user.email);
                                                      setEmailSearchQuery(user.email);
                                                      setIsSearchingEmail(false);
                                                      success(`Inbound email set to verified Entra ID address: ${user.email}`);
                                                  }}
                                                  className="w-full text-left p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-gray-100 dark:border-gray-800 last:border-0 flex justify-between items-center"
                                              >
                                                  <div className="min-w-0 flex-1">
                                                      <div className="font-bold text-[10px] text-gray-900 dark:text-gray-100 truncate">{user.name}</div>
                                                      <div className="text-[9px] text-gray-400 font-mono truncate">{user.email}</div>
                                                  </div>
                                                  <span className="flex-shrink-0 text-[8px] bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-1 py-0.5 rounded font-black uppercase">Active</span>
                                              </button>
                                          ))
                                      )}
                                  </div>
                              )}
                          </div>

                          {/* Polling Interval Config */}
                          <div className="space-y-1.5">
                              <label className="font-bold text-secondary dark:text-gray-400 uppercase tracking-wider text-[10px]">
                                  Polling Frequency
                              </label>
                              <select
                                  value={ingestInterval}
                                  onChange={(e) => setIngestInterval(e.target.value)}
                                  className="w-full bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-850 px-3 py-2 rounded-xl text-primary font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                              >
                                  <option value="Hourly">Hourly</option>
                                  <option value="Daily">Daily</option>
                              </select>
                          </div>

                          {/* Info panel */}
                          <div className="p-3 bg-blue-50 dark:bg-blue-900/10 text-blue-800 dark:text-blue-300 rounded-xl border border-blue-100 dark:border-blue-900/20 text-[11px] leading-relaxed">
                              <p className="font-bold mb-1">Shared inventory parser</p>
                              Automated attachments will use the same supplier detection, format normalization, inventory replacement, auto-mapping, and availability refresh path as manual uploads.
                          </div>
                              </>
                          )}
                      </div>
                  </div>

                  {/* Right Column: Inbound Inbox */}
                  <div className={`${isManualMode ? 'space-y-4' : 'lg:col-span-2 space-y-4'}`}>
                      {isManualMode ? (
                          selectedInventoryUpload ? (
                              <div className="h-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-nocturne p-6 flex flex-col justify-center">
                                  <div className="max-w-2xl">
                                      <div className="flex items-start justify-between gap-4">
                                          <div>
                                              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Selected Supplier</p>
                                              <h4 className="text-xl font-bold text-gray-900 dark:text-white mt-1">{selectedManualSupplier?.name}</h4>
                                              <p className="text-sm text-secondary dark:text-gray-400 mt-2" title={selectedInventoryUpload.sourceReportName || undefined}>
                                                  {selectedInventoryUpload.sourceReportName || 'No inventory document uploaded yet.'}
                                              </p>
                                          </div>
                                          {selectedInventoryUpload.uploadedAt ? (
                                              <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
                                          ) : (
                                              <AlertCircle size={22} className="text-gray-300 shrink-0" />
                                          )}
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                                          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/5 p-4">
                                              <p className="text-[10px] font-bold uppercase tracking-wider text-tertiary dark:text-gray-500">Upload Status</p>
                                              <p className={`mt-2 text-sm font-bold ${selectedInventoryUpload.uploadedAt ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                                  {selectedInventoryUpload.uploadedAt ? 'Uploaded' : 'Awaiting File'}
                                              </p>
                                          </div>
                                          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/5 p-4">
                                              <p className="text-[10px] font-bold uppercase tracking-wider text-tertiary dark:text-gray-500">Last Uploaded</p>
                                              <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white">
                                                  {selectedInventoryUpload.uploadedAt ? new Date(selectedInventoryUpload.uploadedAt).toLocaleDateString() : '-'}
                                              </p>
                                          </div>
                                          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/5 p-4">
                                              <p className="text-[10px] font-bold uppercase tracking-wider text-tertiary dark:text-gray-500">Rows Loaded</p>
                                              <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white">{selectedInventoryUpload.recordCount || 0}</p>
                                          </div>
                                      </div>

                                      <p className="text-xs text-secondary dark:text-gray-400 mt-5 leading-relaxed">
                                          Uploading a new file replaces only this supplier's inventory, then continues through the same mapping, memory, and availability refresh process used by automated email ingestion.
                                      </p>
                                  </div>
                              </div>
                          ) : (
                              <div className="h-full rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/20 p-6 flex flex-col justify-center">
                                  <div className="max-w-xl">
                                      <h4 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                          <Upload size={18} className="text-blue-500" />
                                          Select a supplier to begin
                                      </h4>
                                      <p className="text-sm text-secondary dark:text-gray-400 mt-2 leading-relaxed">
                                          Once a supplier is selected, this area shows the current uploaded document, upload date, and row count for that supplier.
                                      </p>
                                  </div>
                              </div>
                          )
                      ) : (
                          <div className="h-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-nocturne p-6">
                              <div className="flex items-start gap-3">
                                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-600">
                                      <Inbox size={20} />
                                  </div>
                                  <div>
                                      <h4 className="text-base font-bold text-gray-900 dark:text-white">Automated email ingestion is ready for mailbox setup</h4>
                                      <p className="text-sm text-secondary dark:text-gray-400 mt-2 leading-relaxed">
                                          Configure a dedicated inbound address now. When Microsoft Graph polling is connected, attachments received at this mailbox will flow through the same supplier detection, file normalization, replacement, auto-mapping, and availability refresh process as manual uploads.
                                      </p>
                                  </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
                                  <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/5 p-4">
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-tertiary dark:text-gray-500">Mailbox</p>
                                      <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white truncate">{ingestEmailAddress || 'Not configured'}</p>
                                  </div>
                                  <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/5 p-4">
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-tertiary dark:text-gray-500">Polling</p>
                                      <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white">{ingestInterval}</p>
                                  </div>
                                  <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/5 p-4">
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-tertiary dark:text-gray-500">Parser</p>
                                      <p className="mt-2 text-sm font-bold text-emerald-600 dark:text-emerald-400">Shared with manual</p>
                                  </div>
                              </div>

                              <div className="mt-6 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-950/10 p-4 text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                                  Supplier identity will be cross-checked from email sender metadata and workbook contents. If the attachment identifies a supplier that is missing from the supplier master, the ingest workflow will pause for supplier creation rather than importing against the wrong record.
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      );
  };

  const renderSupplierInventoryItems = () => {
      const rows = stockSnapshots
          .filter(snapshot => {
              if (mappingSupplierId && snapshot.supplierId !== mappingSupplierId) return false;
              if (stockFilterStatus === 'ALL') return true;

              const mapping = mappings.find(m => m.supplierId === snapshot.supplierId && m.supplierSku === snapshot.supplierSku);
              const hasInternalItem = !!mapping && !!items.find(i => i.id === mapping.productId);
              const isConfirmed = mapping?.mappingStatus === 'CONFIRMED' && hasInternalItem;
              const isProposed = mapping?.mappingStatus === 'PROPOSED' && hasInternalItem;
              const isAddressed = mapping?.mappingStatus === 'REJECTED';
              const isUnmapped = !mapping || (!hasInternalItem && !isAddressed);

              if (stockFilterStatus === 'MAPPED') return isConfirmed;
              if (stockFilterStatus === 'PROPOSED') return isProposed;
              if (stockFilterStatus === 'ADDRESSED') return isAddressed;
              return isUnmapped;
          })
          .sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime());

      return (
          <div className="p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <Package size={20} className="text-[var(--color-brand)]" />
                          Supplier Items & Availability
                      </h3>
                      <p className="text-sm text-secondary dark:text-gray-400 mt-1">
                          Current supplier inventory rows. Unmapped rows need a manual link; proposed rows move to Confirm Matches; confirmed and addressed rows stay out of the to-do list.
                      </p>
                  </div>
                  <div className="flex items-center gap-2">
                      <select className="input-field w-40" value={stockFilterStatus} onChange={e => setStockFilterStatus(e.target.value as any)}>
                          <option value="UNMAPPED">Unmapped</option>
                          <option value="PROPOSED">Proposed</option>
                          <option value="MAPPED">Confirmed</option>
                          <option value="ADDRESSED">Addressed</option>
                          <option value="ALL">All Items</option>
                      </select>
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400 px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800">
                          {rows.length} rows
                      </span>
                  </div>
              </div>

              <div className="table-shell">
                  <table className="dense-admin-table text-secondary dark:text-gray-400 w-full">
                      <thead className="table-header">
                          <tr>
                              <th className="px-3 py-3 table-sticky-left whitespace-nowrap">Supplier Product</th>
                              <th className="px-3 py-3 whitespace-nowrap">Internal Item</th>
                              <th className="px-3 py-3 whitespace-nowrap">Status</th>
                              <th className="px-3 py-3 whitespace-nowrap">Supplier</th>
                              <th className="px-3 py-3 whitespace-nowrap">Details</th>
                              <th className="px-3 py-3 text-right whitespace-nowrap">Sell $</th>
                              <th className="px-3 py-3 text-right whitespace-nowrap">SOH</th>
                              <th className="px-3 py-3 text-right whitespace-nowrap">Commit</th>
                              <th className="px-3 py-3 text-right whitespace-nowrap">B/O</th>
                              <th className="px-3 py-3 text-right whitespace-nowrap">Avail</th>
                              <th className="px-3 py-3 whitespace-nowrap">Incoming</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                          {rows.map(snapshot => {
                              const mapping = mappings.find(m => m.supplierId === snapshot.supplierId && m.supplierSku === snapshot.supplierSku);
                              const mappedItem = mapping?.mappingStatus !== 'REJECTED' ? items.find(i => i.id === mapping?.productId) : null;
                              const supplier = suppliers.find(s => s.id === snapshot.supplierId);

                              return (
                                  <tr key={snapshot.id} className="table-row group">
                                      <td className="px-3 py-3 table-sticky-left">
                                          <div className="font-bold text-gray-900 dark:text-white truncate max-w-[200px]" title={snapshot.productName}>{snapshot.productName}</div>
                                          <div className="text-xs font-mono opacity-60">{snapshot.supplierSku}</div>
                                          {snapshot.customerStockCode && (
                                              <div className="mt-1 font-mono text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded w-fit">
                                                  Ref: {snapshot.customerStockCode}
                                              </div>
                                          )}
                                      </td>
                                      <td className="px-3 py-3">
                                          {mapping?.mappingStatus === 'REJECTED' ? (
                                              <div>
                                                  <div className="font-bold text-gray-900 dark:text-white">Not mapped</div>
                                                  <div className="text-xs text-gray-400">Addressed as excluded</div>
                                              </div>
                                          ) : mappedItem ? (
                                              <div>
                                                  <div className="font-bold text-gray-900 dark:text-white truncate max-w-[180px]" title={mappedItem.name}>{mappedItem.name}</div>
                                                  <div className="text-xs font-mono text-secondary dark:text-gray-500">{mappedItem.sku}</div>
                                              </div>
                                          ) : (
                                              <div className="text-xs text-gray-400 italic">Not yet mapped</div>
                                          )}
                                      </td>
                                      <td className="px-3 py-3">
                                          {mapping?.mappingStatus === 'CONFIRMED' && mappedItem ? (
                                              <span className="badge bg-green-100 text-green-800 border-green-200 w-fit">Confirmed</span>
                                          ) : mapping?.mappingStatus === 'PROPOSED' && mappedItem ? (
                                              <button
                                                  type="button"
                                                  onClick={() => setMappingSubTab('PROPOSED')}
                                                  className="badge bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200 w-fit whitespace-nowrap"
                                              >
                                                  Review
                                              </button>
                                          ) : mapping?.mappingStatus === 'REJECTED' ? (
                                              <span className="badge bg-gray-100 text-gray-700 border-gray-200 w-fit">Addressed</span>
                                          ) : (
                                              <button
                                                  type="button"
                                                  onClick={() => { setMappingSource(snapshot); setItemSearch(''); setIsManualMapOpen(true); }}
                                                  className="badge bg-red-100 text-red-800 border-red-200 hover:bg-red-200 w-fit whitespace-nowrap"
                                              >
                                                  Map Now
                                              </button>
                                          )}
                                      </td>
                                      <td className="px-3 py-3 font-bold text-gray-900 dark:text-white text-xs truncate max-w-[100px]">{supplier?.name || '-'}</td>
                                      <td className="px-3 py-3">
                                          <div className="text-[10px] space-y-0.5 text-gray-400">
                                              {snapshot.category && <div><span className="font-bold">Cat:</span> {snapshot.category}</div>}
                                              {snapshot.subCategory && <div><span className="font-bold">Sub:</span> {snapshot.subCategory}</div>}
                                              {snapshot.stockType && <div><span className="font-bold">Type:</span> {snapshot.stockType}</div>}
                                              <div className="opacity-60">{snapshot.snapshotDate ? new Date(snapshot.snapshotDate).toLocaleDateString() : '-'}</div>
                                          </div>
                                      </td>
                                      <td className="px-3 py-3 text-right font-mono text-gray-600 dark:text-gray-400">{snapshot.sellPrice ? `$${snapshot.sellPrice.toFixed(2)}` : '-'}</td>
                                      <td className="px-3 py-3 text-right font-mono">{snapshot.stockOnHand}</td>
                                      <td className="px-3 py-3 text-right font-mono text-orange-500">{snapshot.committedQty}</td>
                                      <td className="px-3 py-3 text-right font-mono text-red-500">{snapshot.backOrderedQty}</td>
                                      <td className="px-3 py-3 text-right font-bold text-green-600 dark:text-green-500 font-mono">{snapshot.availableQty}</td>
                                      <td className="px-3 py-3 text-xs">{snapshot.incomingStock && snapshot.incomingStock.length > 0 ? snapshot.incomingStock.map((inc, i) => <span key={i} className="inline-block bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded mr-1 mb-0.5">{inc.month}: {inc.qty}</span>) : <span className="text-gray-300">-</span>}</td>
                                  </tr>
                              );
                          })}
                          {rows.length === 0 && (
                              <tr><td colSpan={11} className="text-center p-8 text-gray-400">No supplier inventory rows found for the selected scope.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  // --- Derived Data ---
  const filteredSnapshots = stockSnapshots.filter(s => {
      const sDate = new Date(s.snapshotDate);
      // Use stockSupplierId for filtering
      const matchesSupplier = stockSupplierId ? s.supplierId === stockSupplierId : true;
      let matchesFrom = true;
      // Use stockDateFrom
      if (stockDateFrom) matchesFrom = sDate >= new Date(stockDateFrom);
      let matchesTo = true;
      if (stockFilterDateTo) {
          const toDate = new Date(stockFilterDateTo);
          toDate.setHours(23, 59, 59, 999);
          matchesTo = sDate <= toDate;
      }
      
      // Determine mapping status for filter
      let matchesStatus = true;
      if (stockFilterStatus !== 'ALL') {
          const mapping = mappings.find(m => m.supplierId === s.supplierId && m.supplierSku === s.supplierSku);
          const hasInternalItem = !!mapping && !!items.find(i => i.id === mapping.productId);
          const isConfirmed = mapping?.mappingStatus === 'CONFIRMED' && hasInternalItem;
          const isProposed = mapping?.mappingStatus === 'PROPOSED' && hasInternalItem;
          const isAddressed = mapping?.mappingStatus === 'REJECTED';
          const isUnmapped = !mapping || (!hasInternalItem && !isAddressed);
          if (stockFilterStatus === 'MAPPED') matchesStatus = isConfirmed;
          if (stockFilterStatus === 'PROPOSED') matchesStatus = isProposed;
          if (stockFilterStatus === 'ADDRESSED') matchesStatus = isAddressed;
          if (stockFilterStatus === 'UNMAPPED') matchesStatus = isUnmapped;
      }

      return matchesSupplier && matchesFrom && matchesTo && matchesStatus;
  }).sort((a,b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime());

  const allTabs: { id: AdminTab, icon: React.ElementType, label: string, permission?: PermissionId }[] = [
      { id: 'CATALOG', icon: BookOpen, label: 'Item Setup', permission: 'view_items' },
      { id: 'MAPPING', label: 'Mapping', icon: GitMerge, permission: 'view_mapping' },
      { id: 'SUPPLIERS', label: 'Suppliers', icon: Truck, permission: 'view_suppliers' },
      { id: 'SITES', label: 'Sites', icon: MapPin, permission: 'view_sites' },
      { id: 'WORKFLOW', label: 'Workflow', icon: GitMerge, permission: 'view_workflow' },
      { id: 'USERS', label: 'User Directory', icon: User, permission: 'view_security' },
      { id: 'SECURITY', label: 'Security Roles', icon: Shield, permission: 'view_security' },
      { id: 'NOTIFICATIONS', label: 'Notifications', icon: Bell, permission: 'view_notifications' },
      { id: 'BRANDING', label: 'Branding', icon: Palette, permission: 'view_branding' },
      { id: 'MENU', label: 'Menu Config', icon: ListFilter, permission: 'manage_settings' },
      { id: 'MIGRATION', label: 'Data Migration', icon: Upload, permission: 'manage_settings' },
      { id: 'EMAIL', label: 'Email Templates', icon: Mail, permission: 'manage_settings' },
      { id: 'AUDIT', label: 'System Audit', icon: History, permission: 'view_audit_logs' },
      { id: 'DATA_SYNC', label: 'Data Sync', icon: Database, permission: 'manage_settings' },
      { id: 'SMART_BUYING',    label: 'Smart Buying',   icon: BarChart3, permission: 'manage_settings' },
      { id: 'ITEM_CREATION',   label: 'Item Creation',  icon: Package,   permission: 'manage_items' }
  ];

  const visibleTabs: { id: AdminTab, icon: React.ElementType, label: string }[] = [
      { id: 'PROFILE', icon: User, label: 'My Profile' },
      ...allTabs.filter(tab => !tab.permission || hasPermission(tab.permission))
  ];

  // --- Helper Functions ---
  const handleSaveCatalog = (catId: string) => {
      const original = catalog.find(c => c.id === catId);
      if (original) {
          updateCatalogItem({ ...original, price: editPrice, supplierSku: editSku });
          setEditingCatalogId(null);
      }
  };

  const startEditCatalog = (catId: string, currentPrice: number, currentSku: string) => {
      setEditingCatalogId(catId);
      setEditPrice(currentPrice);
      setEditSku(currentSku);
  };

  const handleAddSnapshot = (e: React.FormEvent) => {
      e.preventDefault();
      addSnapshot({
          id: uuidv4(),
          supplierId: snapSupplierId || suppliers[0]?.id,
          supplierSku: snapSku,
          productName: snapProductName,
          availableQty: snapAvailable,
          stockOnHand: snapTotal,
          totalStockQty: snapTotal,
          committedQty: 0,
          backOrderedQty: 0,
          snapshotDate: new Date().toISOString(),
          sourceReportName: 'Manual_Entry_Web'
      });
      setSnapAvailable(0);
      setSnapTotal(0);
      setSnapSku('');
      setSnapProductName('');
      setIsSnapshotFormOpen(false);
  };

  // --- Security Handlers ---
  const openRoleEditor = (role?: RoleDefinition) => {
      if (role) {
          setActiveRole(role);
          setRoleFormName(role.name);
          setRoleFormDesc(role.description);
          setRoleFormPerms(role.permissions);
      } else {
          setActiveRole(null);
          setRoleFormName('');
          setRoleFormDesc('');
          setRoleFormPerms([]);
      }
      setIsRoleEditorOpen(true);
  };

  const togglePermission = (permId: PermissionId) => {
      setRoleFormPerms(prev => 
        prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
      );
  };

  const handleSaveRole = () => {
      if (!roleFormName) return;
      const newRole: RoleDefinition = {
          id: activeRole ? activeRole.id : `role-${Date.now()}`,
          name: roleFormName,
          description: roleFormDesc,
          permissions: roleFormPerms,
          isSystem: activeRole ? activeRole.isSystem : false
      };
      
      activeRole ? updateRole(newRole) : createRole(newRole);
      setIsRoleEditorOpen(false);
  };

  const toggleInviteRole = (roleId: UserRole) => {
      setInviteForm(prev => {
          const selected = prev.roleIds.includes(roleId);
          const nextRoleIds = selected
              ? prev.roleIds.filter(id => id !== roleId)
              : [...prev.roleIds, roleId];

          if (nextRoleIds.length === 0) {
              return prev;
          }

          const nextPrimaryRole = nextRoleIds.includes(prev.role)
              ? prev.role
              : nextRoleIds[0];

          return {
              ...prev,
              role: nextPrimaryRole,
              roleIds: nextRoleIds
          };
      });
  };

  const setInvitePrimaryRole = (roleId: UserRole) => {
      setInviteForm(prev => {
          const roleIds = prev.roleIds.includes(roleId) ? prev.roleIds : [...prev.roleIds, roleId];
          return { ...prev, role: roleId, roleIds };
      });
  };

  const handleItemFormSubmit = (e: React.FormEvent) => { 
      e.preventDefault(); 
      // Basic validation
      if (!itemForm.sku || !itemForm.name) { alert('SAP Code and Name are required'); return; }

      const newItem: Item = { 
          id: editingItem ? editingItem.id : uuidv4(), 
          sku: itemForm.sku || '', 
          name: itemForm.name || '', 
          description: itemForm.description || '', 
          unitPrice: Number(itemForm.unitPrice) || 0, 
          uom: itemForm.uom || 'Each', 
          upq: Number(itemForm.upq) || 1,
          category: itemForm.category || '', 
          subCategory: itemForm.subCategory,
          stockLevel: itemForm.stockLevel || 0,
          rangeName: itemForm.rangeName,
          stockType: itemForm.stockType,
          itemWeight: itemForm.itemWeight,
          itemPool: itemForm.itemPool,
          itemCatalog: itemForm.itemCatalog,
          itemType: itemForm.itemType,
          rfidFlag: itemForm.rfidFlag,
          cogFlag: itemForm.cogFlag,
          itemColour: itemForm.itemColour,
          itemPattern: itemForm.itemPattern,
          itemMaterial: itemForm.itemMaterial,
          itemSize: itemForm.itemSize,
          measurements: itemForm.measurements,
          cogCustomer: itemForm.cogCustomer,
          supplierId: itemForm.supplierId || '',
          activeFlag: true
      }; 
      editingItem ? updateItem(newItem) : addItem(newItem); 
      setIsItemFormOpen(false); 
  };

  const suggestShortName = () => {
      if (!itemForm.description) return;
      // Simple suggestion: Uppercase, remove special chars, truncate
      const suggestion = itemForm.description
        .slice(0, 30)
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, '')
        .trim();
      setItemForm(prev => ({ ...prev, name: suggestion }));
  };

  // Deprecated manual stock upload handlers removed

  // --- Branding Handlers ---
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
          const base64 = evt.target?.result as string;
          if (base64) {
              setBrandingForm(prev => ({ ...prev, logoUrl: base64 }));
          }
      };
      reader.readAsDataURL(file);
  };
  
  const handleSaveBranding = async () => {
      await updateBranding(brandingForm);
      alert('Branding updated successfully! Refreshing view...');
  };

  // --- Downloads ---
  const downloadTemplate = () => {
      const headers = ['SKU', 'Product', 'Customer Stock Code', 'Range', 'Category', 'Sub Category', 'StockType', 'Carton Qty', 'SOH $ @ Sell', 'Sell $', 'SOH', 'Committed', 'Back Ordered', 'Available'];
      const row1 = ['SAMPLE-001', 'Cotton Sheet Set', 'CSC-01', 'Luxury Range', 'Bedding', 'Sheets', 'Finished Goods', '10', '450.00', '45.00', '100', '20', '0', '80'];
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), row1.join(',')].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "supplier_stock_template.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const downloadPythonScript = () => {
      const scriptContent = `
import pandas as pd
import json
import sys
import re
from datetime import datetime

def process_supplier_report(file_path):
    try:
        df = pd.read_csv(file_path)
    except Exception as e:
        return json.dumps({"error": str(e)})

    # Normalize headers
    df.columns = df.columns.str.strip().str.lower()
    
    # Identify dynamic date columns
    date_pattern = re.compile(r'^[a-z]{3}\\s\\d{4}$')
    date_cols = [col for col in df.columns if date_pattern.match(col)]
    
    # Map required columns
    col_map = {
        'sku': next((c for c in df.columns if 'sku' in c), None),
        'product': next((c for c in df.columns if 'product' in c or 'description' in c), None),
        'category': next((c for c in df.columns if 'category' in c or 'range' in c), None),
        'soh': next((c for c in df.columns if 'soh' in c or 'hand' in c), None),
        'committed': next((c for c in df.columns if 'committed' in c), None),
        'available': next((c for c in df.columns if 'available' in c or 'free' in c), None),
    }

    if not col_map['sku']:
        return json.dumps({"error": "SKU column not found"})

    df = df.dropna(subset=[col_map['sku']])
    df = df[df[col_map['sku']].str.strip() != '']

    results = []
    
    for _, row in df.iterrows():
        incoming = []
        for d_col in date_cols:
            val = pd.to_numeric(str(row[d_col]).replace(',', ''), errors='coerce')
            if val > 0:
                incoming.append({"month": d_col.title(), "qty": int(val)})

        item = {
            "sku": str(row[col_map['sku']]),
            "product_name": str(row[col_map['product']]) if col_map['product'] else "",
            "category": str(row[col_map['category']]) if col_map['category'] else "",
            "stock_on_hand": int(pd.to_numeric(str(row[col_map['soh']]).replace(',', ''), errors='coerce') or 0),
            "committed": int(pd.to_numeric(str(row[col_map['committed']]).replace(',', ''), errors='coerce') or 0),
            "available": int(pd.to_numeric(str(row[col_map['available']]).replace(',', ''), errors='coerce') or 0),
            "incoming_stock": incoming,
            "last_updated": datetime.now().isoformat()
        }
        results.append(item)

    return json.dumps(results, indent=2)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(process_supplier_report(sys.argv[1]))
    else:
        print("Usage: python script.py <path_to_csv>")
`; 
      const blob = new Blob([scriptContent], { type: 'text/x-python' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "supplier_parser.py";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const updateSupplierContactRow = (id: string, updates: Partial<SupplierContactFormRow>) => {
      setSupplierForm(prev => ({
          ...prev,
          contacts: prev.contacts.map(contact => {
              if (updates.isPrimary) {
                  return contact.id === id ? { ...contact, ...updates, isPrimary: true } : { ...contact, isPrimary: false };
              }
              return contact.id === id ? { ...contact, ...updates } : contact;
          })
      }));
  };

  const addSupplierContactRow = () => {
      setSupplierForm(prev => ({
          ...prev,
          contacts: [...prev.contacts, createEmptySupplierContactRow(false)]
      }));
  };

  const removeSupplierContactRow = (id: string) => {
      setSupplierForm(prev => {
          const nextContacts = prev.contacts.filter(contact => contact.id !== id);
          return { ...prev, contacts: nextContacts.length ? nextContacts : [createEmptySupplierContactRow(true)] };
      });
  };

  const handleSupplierFormSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      const contactRows = supplierForm.contacts
          .map(contact => ({
              id: contact.id,
              name: contact.name.trim(),
              email: contact.email.trim().toLowerCase(),
              phone: contact.phone.trim(),
              role: contact.role.trim(),
              isPrimary: contact.isPrimary
          }))
          .filter(contact => contact.name || contact.email || contact.phone);

      const selectedPrimaryRow = contactRows.find(contact => contact.isPrimary);
      const primaryContact: SupplierContact = selectedPrimaryRow || {
          id: 'primary-contact',
          name: supplierForm.keyContact.trim(),
          email: supplierForm.contactEmail.trim().toLowerCase(),
          phone: supplierForm.phone.trim(),
          role: 'Primary contact',
          isPrimary: true
      };
      const normalizedContactRows = contactRows.map(contact => ({
          ...contact,
          isPrimary: contact.id === primaryContact.id
      }));

      const supplierToSave: Supplier = {
          id: editingSupplier ? editingSupplier.id : uuidv4(),
          name: supplierForm.name.trim(),
          keyContact: primaryContact.name,
          contactEmail: primaryContact.email,
          phone: primaryContact.phone || '',
          address: supplierForm.address.trim(),
          categories: supplierForm.categories.split(',').map(s => s.trim()).filter(Boolean),
          contacts: normalizeSupplierContacts({
              keyContact: primaryContact.name,
              contactEmail: primaryContact.email,
              phone: primaryContact.phone || '',
              contacts: [primaryContact, ...normalizedContactRows]
          })
      };

      const duplicateSupplier = !editingSupplier
          ? visibleSuppliers.find(supplier => canonicalSupplierName(supplier.name) === canonicalSupplierName(supplierToSave.name))
          : undefined;

      if (duplicateSupplier) {
          await updateSupplier(mergeSupplierRecords(duplicateSupplier, supplierToSave));
          warning(`Merged contact details into existing supplier: ${duplicateSupplier.name}`);
      } else if (editingSupplier) {
          await updateSupplier(supplierToSave);
      } else {
          await addSupplier(supplierToSave);
      }

      setIsSupplierFormOpen(false);
  };
  const openSupplierForm = (s?: Supplier) => { if(s) { setEditingSupplier(s); setSupplierForm(createSupplierFormState(s)); } else { setEditingSupplier(null); setSupplierForm(createSupplierFormState()); } setIsSupplierFormOpen(true); };
  const handleSiteFormSubmit = (e: React.FormEvent) => { e.preventDefault(); const newSite: Site = { id: editingSite ? editingSite.id : uuidv4(), name: siteForm.name, suburb: siteForm.suburb, address: siteForm.address, state: siteForm.state, zip: siteForm.zip, contactPerson: siteForm.contactPerson }; editingSite ? updateSite(newSite) : addSite(newSite); setIsSiteFormOpen(false); };
  const openSiteForm = (s?: Site) => { if(s) { setEditingSite(s); setSiteForm({ name: s.name, suburb: s.suburb, address: s.address, state: s.state, zip: s.zip, contactPerson: s.contactPerson }); } else { setEditingSite(null); setSiteForm({ name: '', suburb: '', address: '', state: '', zip: '', contactPerson: '' }); } setIsSiteFormOpen(true); };
  const handleWorkflowUpdate = (id: string, updates: Partial<WorkflowStep>) => { const step = workflowSteps.find(s => s.id === id); if (step) updateWorkflowStep({ ...step, ...updates }); };

  // --- Notification Logic ---
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);

  const openRuleConfig = (rule: NotificationRule) => {
      setEditingRule(JSON.parse(JSON.stringify(rule))); // Deep copy
      setIsRuleModalOpen(true);
  };

  const handleSaveRule = async () => {
      if (editingRule) {
          await upsertNotificationRule(editingRule);
          setIsRuleModalOpen(false);
          setEditingRule(null);
      }
  };

  const handleToggleActive = async (rule: NotificationRule) => {
      await upsertNotificationRule({ ...rule, isActive: !rule.isActive });
  };

  // --- Directory & User Search Unified ---
  const handleDirectorySearch = async () => {
    if (directorySearch.trim().length < 3) return;
    
    setDirectoryLoading(true);
    
    try {
        // Use first selected site, or active site, or first available site to context the search
        const searchContextSiteId = inviteForm.siteIds[0] || activeSiteIds[0] || sites[0]?.id;
        const results = await searchDirectory(directorySearch, searchContextSiteId);
        
        // Deduplicate: remove if already in local matches (by email or id)
        // Map directory results to match frontend expectations (name, jobTitle)
        // RPC returns display_name, email, job_title, department
        const directoryMatches = (results || []).map((du: any) => ({
            id: du.id,
            name: du.name || du.display_name || du.email.split('@')[0], // Fallback to email prefix
            email: du.email,
            jobTitle: du.jobTitle || du.job_title,
            department: du.department || du.office_location,
            isExisting: false
        })).filter((du: any) => 
            !users.some(u => u.id === du.id || (u.email && du.email && u.email.toLowerCase() === du.email.toLowerCase()))
        );

        setDirectoryResults(prev => {
            // Re-run local search to ensure we have the latest set
            const query = directorySearch.trim().toLowerCase();
            const localMatches = users.filter(u => 
                u.status !== 'ARCHIVED' && (
                (u.name || '').toLowerCase().includes(query) || 
                (u.email || '').toLowerCase().includes(query)
            )).map(u => ({
                id: u.id,
                name: u.name || 'Unknown User',
                email: u.email || '',
                jobTitle: u.jobTitle,
                isExisting: true,
                currentRole: u.role,
                currentRoleIds: u.roleIds || [u.role],
                currentSiteIds: u.siteIds || []
            }));

            // Combine and preserve order (Local first, then directory)
            return [...localMatches, ...directoryMatches];
        });
    } catch (err) {
        console.error("Directory search failed", err);
    } finally {
        setDirectoryLoading(false);
    }
  };

  const handleAddFromDirectory = (mockUser: any) => {
      // Check if exists
      if(users.some(u => u.email === mockUser.email)) { alert('User already exists'); return; }
      
      const newUser: any = {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          role: 'SITE_USER', // Default
          roleIds: ['SITE_USER'],
          avatar: '',
          jobTitle: mockUser.jobTitle,
          createdAt: new Date().toISOString()
      };
      
      addUser(newUser);
      setIsDirectoryModalOpen(false);
      alert(`${newUser.name} added successfully.`);
  };

  const PRESET_COLORS = [
      { name: 'Blue', hex: '#2563eb' },
      { name: 'Purple', hex: '#9333ea' },
      { name: 'Emerald', hex: '#059669' },
      { name: 'Rose', hex: '#e11d48' },
      { name: 'Amber', hex: '#d97706' },
      { name: 'Slate', hex: '#475569' },
      { name: 'Dark', hex: '#1e2029' },
      { name: 'Black', hex: '#0f172a' }
  ];

  const ColorPicker = ({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) => (
    <div className="space-y-4">
        <label className="text-xs font-bold text-secondary dark:text-gray-500 uppercase block">{label}</label>
        <div className="flex flex-wrap gap-3">
            {PRESET_COLORS.slice(0, 6).map(color => (
                <button type="button"
                    key={color.hex}
                    onClick={() => onChange(color.hex)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${value.toLowerCase() === color.hex ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white dark:ring-offset-[#1e2029]' : ''}`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                >
                    {value.toLowerCase() === color.hex && <CheckCircle2 size={18} className="text-white drop-shadow-md"/>}
                </button>
            ))}
            <div className="w-px h-10 bg-gray-200 dark:bg-gray-700 mx-2"></div>
            <div className="relative">
                <input 
                  type="color" 
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 overflow-hidden" 
                /> 
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 font-mono">Custom</span>
            </div>
        </div>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden max-w-7xl mx-auto pb-12 px-4 md:px-8">
      {/* Page header — only shown in classic mode; revamp header handles title */}
      {!uiRevamp && (
        <div className="py-6 md:py-8">
          <PageHeader title="Admin Portal" subtitle="System Configuration" />
        </div>
      )}
      {uiRevamp && <PageHeader title="Admin Portal" subtitle="System Configuration" />}

      {/* Sticky tab bar — only in classic mode; revamp portals it to the floating header */}
      {!uiRevamp && (
        <>
          <div ref={sentinelRef} className="h-px w-full pointer-events-none absolute" />
          <div className={`sticky top-[-1px] z-30 transition-all duration-300 ${isStuck ? '-mx-4 sm:-mx-4 md:-mx-8 px-4 sm:px-4 md:px-8 bg-white/95 dark:bg-[#15171e]/95 border-b border-gray-200 dark:border-gray-800 shadow-md py-3' : '-mx-4 px-4 md:mx-0 md:px-0 pt-2 pb-2'}`}>
            <div className={`transition-all duration-300 ${isStuck ? 'rounded-none border-0 bg-transparent p-0 shadow-none backdrop-blur-none max-w-7xl mx-auto' : 'rounded-2xl border border-gray-200/80 bg-white/75 p-2 shadow-sm backdrop-blur-md dark:border-gray-800 dark:bg-[#15171e]/90'}`}>
              <div className="flex items-center gap-2 overflow-x-auto">
                {visibleTabs.map(tab => {
                  const isActive = activeTab === tab.id;
                  const TabIcon = tab.icon;
                  return (
                    <button type="button"
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={tab.label}
                      title={tab.label}
                      className={`group flex h-10 shrink-0 items-center rounded-full border transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40 ${
                        isActive
                          ? 'bg-[var(--color-brand)]/10 border-[var(--color-brand)]/30 text-[var(--color-brand)] pl-3 pr-4 shadow-sm'
                          : 'border-transparent pl-3 pr-3 text-secondary hover:bg-gray-100 hover:text-primary dark:text-gray-500 dark:hover:bg-white/5 dark:hover:text-gray-200'
                      }`}
                    >
                      <TabIcon size={16} className={`transition-transform duration-300 ${isActive ? 'scale-100' : 'group-hover:scale-110'}`} />
                      <span className={`overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-300 ${
                        isActive ? 'ml-2 max-w-[11rem] opacity-100' : 'ml-0 max-w-0 opacity-0 group-hover:ml-2 group-hover:max-w-[11rem] group-hover:opacity-100'
                      }`}>
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Revamp mode: portal the tab bar into the floating header's center slot */}
      {uiRevamp && adminTabSlot && createPortal(
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-0.5">
          {visibleTabs.map(tab => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={`flex items-center rounded-xl transition-all duration-150 h-9 shrink-0 ${
                  isActive
                    ? 'bg-tranquil text-white shadow-md shadow-tranquil/30 px-3 gap-2'
                    : 'text-secondary dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-primary dark:hover:text-white p-2.5'
                }`}
              >
                <TabIcon size={16} className="shrink-0" />
                <span className={isActive ? 'text-xs font-semibold whitespace-nowrap' : 'sr-only'}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>,
        adminTabSlot
      )}

      <div className="mt-6 flex-1 overflow-y-auto min-h-0 pb-12">

      {activeTab === 'PROFILE' && (
          <div className="animate-fade-in max-w-2xl">
              <div className="bg-white dark:bg-nocturne rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">User Profile</h2>
                  
                  <div className="flex flex-col md:flex-row gap-8 items-start">
                      <AvatarPicker
                          currentAvatar={profileForm.avatar}
                          userName={profileForm.name}
                          onSelect={(url) => setProfileForm({...profileForm, avatar: url})}
                      />

                      <div className="flex-1 space-y-5 w-full">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Full name</label>
                                  <input 
                                    className="input-field" 
                                    value={profileForm.name} 
                                    onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                                  />
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email address</label>
                                  <input 
                                    className="input-field opacity-60 cursor-not-allowed" 
                                    value={currentUser?.email} 
                                    readOnly
                                  />
                              </div>
                          </div>

                          <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Job title</label>
                              <input 
                                className="input-field" 
                                placeholder="e.g. Site Manager"
                                value={profileForm.jobTitle} 
                                onChange={e => setProfileForm({...profileForm, jobTitle: e.target.value})}
                              />
                          </div>

                           {/* PWA Install Prompt Preference */}
                          <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">App Preferences</h4>
                              <label className="flex items-start gap-3 cursor-pointer group">
                                  <input 
                                    type="checkbox"
                                    className="mt-1 w-4 h-4 text-[var(--color-brand)] bg-gray-100 border-gray-300 rounded focus:ring-[var(--color-brand)] dark:focus:ring-[var(--color-brand)] dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                    checked={currentUser?.pwaInstallPromptHidden ?? false}
                                    onChange={(e) => setProfileForm({...profileForm, pwaInstallPromptHidden: e.target.checked})}
                                  />
                                  <div className="flex-1">
                                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                                          Hide PWA install prompt
                                      </span>
                                      <p className="text-xs text-tertiary dark:text-gray-400 mt-0.5">
                                          When enabled, the app install prompt and floating install button will be hidden. Uncheck to show them again.
                                      </p>
                                  </div>
                              </label>
                          </div>

                          <div className="pt-4 flex justify-end">
                              <button type="button" 
                                onClick={handleSaveProfile} 
                                disabled={isSavingProfile}
                                className="btn-primary flex items-center gap-2"
                              >
                                  {isSavingProfile ? <RefreshCw size={18} className="animate-spin"/> : <Save size={18}/>}
                                  Save Changes
                              </button>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="mt-8 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 p-6 rounded-2xl flex items-start gap-4">
                  <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400">
                      <Lock size={24}/>
                  </div>
                  <div>
                      <h3 className="font-bold text-amber-900 dark:text-amber-400">Security Note</h3>
                      <p className="text-sm text-amber-800/80 dark:text-amber-300/60 mt-1">
                       Role assignments and site access are managed by the Procurement team. To request a change to your system level permissions, please contact support.
                      </p>
                  </div>
              </div>
          </div>
      )}




            {activeTab === 'CATALOG' && (
        <div className="animate-fade-in space-y-6">
            <div className="bg-white dark:bg-nocturne rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                <div className="mb-6 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <BookOpen className="text-blue-600" size={24} />
                            Item Taxonomy & Preview Dropdowns
                        </h2>
                        <p className="text-secondary dark:text-gray-400 mt-1">Manage item categorisation and the selectable values used by the item creation preview workflow.</p>
                    </div>
                </div>
                
                <div className="space-y-8">
                    <ItemSetupManagement
                        options={attributeOptions}
                        items={items}
                        upsertOption={upsertAttributeOption}
                        deleteOption={deleteAttributeOption}
                    />
                </div>
            </div>
        </div>
      )}
      



      {activeTab === 'STOCK' && (
          <div className="space-y-6 animate-fade-in">
             <div className="bg-white dark:bg-nocturne rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
                  
                  {/* Supplier Selector Header */}
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                      <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                              <Package size={20} className="text-[var(--color-brand)]" />
                              Stock Management
                          </h3>
                          <p className="text-sm text-secondary dark:text-gray-400 mt-1">Select a supplier to manage their stock levels and history.</p>
                      </div>
                      <div className="flex items-center gap-3 w-full md:w-auto">
                          <span className="text-xs font-bold text-secondary dark:text-gray-500 uppercase whitespace-nowrap hidden md:inline-block">Active Supplier:</span>
                          <div className="relative flex-1 md:flex-none">
                              <select 
                                  className="w-full md:w-64 bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg py-2.5 pl-3 pr-10 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all appearance-none"
                                  value={stockSupplierId}
                                  onChange={(e) => setStockSupplierId(e.target.value)}
                              >
                                  <option value="">-- Select Supplier --</option>
                                  {visibleSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                          </div>
                      </div>
                  </div>

                  {/* Supplier Inventory Ingestion Hub */}
                  <div className="bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-xl border border-blue-100 dark:border-blue-900/20 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                          <h4 className="font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2 text-sm">
                              <Info size={16} className="text-blue-500"/>
                              Supplier Inventory Ingestion Hub
                          </h4>
                          <p className="text-xs text-secondary dark:text-gray-400 mt-1 max-w-xl">
                              Upload a supplier file manually or switch to automated inbound email ingestion. Both paths replace the supplier inventory, auto-map products, and refresh available stock.
                          </p>
                      </div>
                      <button 
                          type="button" 
                          onClick={() => {
                              setMappingSubTab('EMAIL_INGEST');
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow transition-all flex items-center gap-1.5 shrink-0"
                      >
                          <MailOpen size={14}/>
                          Open Ingestion Hub
                      </button>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4 mb-4 items-center">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">Stock History ({filteredSnapshots.length})</h3>
                     <div className="ml-auto flex gap-2">
                          <select className="input-field w-32" value={stockFilterStatus} onChange={e => setStockFilterStatus(e.target.value as any)}>
                              <option value="ALL">All Status</option>
                              <option value="MAPPED">Confirmed</option>
                              <option value="PROPOSED">Proposed</option>
                              <option value="ADDRESSED">Addressed</option>
                              <option value="UNMAPPED">Unmapped</option>
                          </select>
                     </div>
                  </div>

                 <div className="table-shell">
                     <table className="dense-admin-table text-secondary dark:text-gray-400 min-w-[1200px]">
                         <thead className="table-header">
                              <tr>
                                  <th className="px-4 py-4 table-sticky-left">Status</th>
                                  <th className="px-4 py-4">Cust Code</th>
                                  <th className="px-4 py-4">Product</th>
                                  <th className="px-4 py-4">Details</th>
                                  <th className="px-4 py-4 text-right">Sell $</th>
                                  <th className="px-4 py-4 text-right">SOH</th>
                                  <th className="px-4 py-4 text-right">Cmtd</th>
                                  <th className="px-4 py-4 text-right">B/O</th>
                                  <th className="px-4 py-4 text-right">Avail</th>
                                  <th className="px-4 py-4 text-right">Total</th>
                                  <th className="px-4 py-4 text-right">Val @ Sell</th>
                                  <th className="px-4 py-4">Incoming</th>
                              </tr>
                          </thead>
                         <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                             {filteredSnapshots.map(snap => {
                                 const mapping = mappings.find(m => m.supplierId === snap.supplierId && m.supplierSku === snap.supplierSku);
                                  const mappedItem = mapping?.mappingStatus !== 'REJECTED' ? items.find(i => i.id === mapping?.productId) : null;
                                  const isConfirmed = mapping?.mappingStatus === 'CONFIRMED' && !!mappedItem;
                                  const isProposed = mapping?.mappingStatus === 'PROPOSED' && !!mappedItem;
                                  const isAddressed = mapping?.mappingStatus === 'REJECTED';

                                 return (
                                 <tr key={snap.id} className="table-row group">
                                     <td className="px-4 py-4 table-sticky-left">
                                          {isConfirmed ? (
                                              <div className="flex flex-col">
                                                  <span className="badge bg-green-100 text-green-800 border-green-200 w-fit">Confirmed</span>
                                                  <span className="text-[10px] text-tertiary dark:text-gray-500 font-mono mt-0.5 max-w-[100px] truncate" title={mappedItem?.name}>{mappedItem?.sku}</span>
                                              </div>
                                          ) : isProposed ? (
                                              <button type="button" onClick={() => setMappingSubTab('PROPOSED')} className="badge bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200 w-fit">Review</button>
                                          ) : isAddressed ? (
                                              <span className="badge bg-gray-100 text-gray-700 border-gray-200 w-fit">Addressed</span>
                                          ) : (
                                             <button type="button" onClick={() => { setMappingSource(snap); setIsManualMapOpen(true); }} className="badge bg-red-100 text-red-800 border-red-200 hover:bg-red-200 w-fit">Unmapped</button>
                                         )}
                                     </td>
                                     <td className="px-4 py-4">
                                         <div className="flex flex-col gap-1">
                                            <div className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/10 px-2 py-1 rounded w-fit" title="Customer Stock Code">{snap.customerStockCode || '-'}</div>
                                            {snap.customerStockCodeAltNorm && (
                                                <span className="text-[10px] font-mono bg-orange-50 text-orange-700 px-1 rounded w-fit" title="Alt Normalized">{snap.customerStockCodeAltNorm}</span>
                                            )}
                                         </div>
                                     </td>
                                     <td className="px-4 py-4">
                                        <div className="font-bold text-gray-900 dark:text-white truncate max-w-[200px]" title={snap.productName}>{snap.productName}</div>
                                        <div className="text-xs font-mono opacity-50">{snap.supplierSku}</div>
                                     </td>
                                     <td className="px-4 py-4">
                                          <div className="text-[10px] space-y-0.5 text-gray-400">
                                              <div><span className="font-bold">Cat:</span> {snap.category || '-'}</div>
                                              <div><span className="font-bold">Sub:</span> {snap.subCategory || '-'}</div>
                                              <div><span className="font-bold">Rng:</span> {snap.range || '-'}</div>
                                              <div><span className="font-bold">Type:</span> {snap.stockType || '-'}</div>
                                              <div><span className="font-bold">Ctn:</span> {snap.cartonQty || '-'}</div>
                                          </div>
                                     </td>
                                     <td className="px-4 py-4 text-right font-mono text-gray-600 dark:text-gray-400">{snap.sellPrice ? `$${snap.sellPrice.toFixed(2)}` : '-'}</td>
                                     <td className="px-4 py-4 text-right font-mono">{snap.stockOnHand}</td>
                                     <td className="px-4 py-4 text-right font-mono text-orange-500">{snap.committedQty}</td>
                                     <td className="px-4 py-4 text-right font-mono text-red-500">{snap.backOrderedQty}</td>
                                     <td className="px-4 py-4 text-right font-bold text-green-600 dark:text-green-500 font-mono text-base">{snap.availableQty}</td>
                                     <td className="px-4 py-4 text-right font-mono">{snap.totalStockQty ?? '-'}</td>
                                     <td className="px-4 py-4 text-right font-mono text-gray-400">{snap.sohValueAtSell ? `$${snap.sohValueAtSell.toLocaleString()}` : '-'}</td>
                                     <td className="px-4 py-4 text-xs">{snap.incomingStock && snap.incomingStock.length > 0 ? snap.incomingStock.map((inc, i) => <span key={i} className="inline-block bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded mr-1 mb-1">{inc.month}: {inc.qty}</span>) : <span className="text-gray-300">-</span>}</td>
                                 </tr>
                                 );
                             })}
                         </tbody>
                     </table>
                 </div>
             </div>
             {isSnapshotFormOpen && (
                 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-nocturne rounded-2xl shadow-xl w-[95%] max-w-lg p-6 animate-slide-up">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Add Stock Snapshot</h2>
                        <form onSubmit={handleAddSnapshot} className="space-y-4">
                            <div><label className="text-xs font-bold text-secondary dark:text-gray-500 uppercase">Supplier</label><select className="input-field mt-1" value={snapSupplierId} onChange={e => setSnapSupplierId(e.target.value)}>{visibleSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-secondary dark:text-gray-500 uppercase">Supplier SKU</label><input required className="input-field mt-1" value={snapSku} onChange={e => setSnapSku(e.target.value)}/></div>
                                <div><label className="text-xs font-bold text-secondary dark:text-gray-500 uppercase">Product Name</label><input required className="input-field mt-1" value={snapProductName} onChange={e => setSnapProductName(e.target.value)}/></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-secondary dark:text-gray-500 uppercase">Total SOH</label><input required type="number" className="input-field mt-1" value={snapTotal} onChange={e => setSnapTotal(parseInt(e.target.value))}/></div>
                                <div><label className="text-xs font-bold text-secondary dark:text-gray-500 uppercase">Available</label><input required type="number" className="input-field mt-1" value={snapAvailable} onChange={e => setSnapAvailable(parseInt(e.target.value))}/></div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsSnapshotFormOpen(false)} className="px-4 py-2 text-secondary dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Cancel</button>
                                <button type="submit" className="btn-primary">Add Snapshot</button>
                            </div>
                        </form>
                    </div>
                 </div>
             )}
          </div>
      )}

      {activeTab === 'MAPPING' && (
          <div className="space-y-6 animate-fade-in">
              <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mapping Workbench</h2>
                  <p className="text-sm text-secondary dark:text-gray-400 mt-1">
                      Ingest supplier inventory, review supplier items, and save confirmed mappings as memory for future uploads.
                  </p>
              </div>

              {/* Sub Tabs */}
              <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 overflow-x-auto scrollbar-hide">
                  <button type="button" onClick={() => setMappingSubTab('EMAIL_INGEST')} className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 shrink-0 ${mappingSubTab === 'EMAIL_INGEST' ? 'border-blue-500 text-blue-500' : 'border-transparent text-secondary hover:text-primary dark:hover:text-gray-300'}`}>
                      1. Ingest
                  </button>
                  <button type="button" onClick={() => setMappingSubTab('SUPPLIER_ITEMS')} className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${mappingSubTab === 'SUPPLIER_ITEMS' ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-secondary hover:text-primary dark:hover:text-gray-300'}`}>
                      2. Supplier Items
                      {mappingReviewStats.unmapped.length > 0 && (
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${mappingSubTab === 'SUPPLIER_ITEMS' ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)]' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                              {mappingReviewStats.unmapped.length} left
                          </span>
                      )}
                  </button>
                  <button type="button" onClick={() => setMappingSubTab('PROPOSED')} className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${mappingSubTab === 'PROPOSED' ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-secondary hover:text-primary dark:hover:text-gray-300'}`}>
                      3. Confirm Matches
                      {mappingReviewStats.proposed.length > 0 && (
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${mappingSubTab === 'PROPOSED' ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)]' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                              {mappingReviewStats.proposed.length}
                          </span>
                      )}
                  </button>
                  <button type="button" onClick={() => setMappingSubTab('CONFIRMED')} className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${mappingSubTab === 'CONFIRMED' ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-secondary hover:text-primary dark:hover:text-gray-300'}`}>
                      4. Confirmed
                      {mappingReviewStats.confirmed.length > 0 && (
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${mappingSubTab === 'CONFIRMED' ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)]' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                              {mappingReviewStats.confirmed.length}
                          </span>
                      )}
                  </button>
                  <button type="button" onClick={() => setMappingSubTab('REJECTED')} className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${mappingSubTab === 'REJECTED' ? 'border-gray-500 text-gray-700 dark:text-gray-300' : 'border-transparent text-secondary hover:text-primary dark:hover:text-gray-300'}`}>
                      5. Addressed
                      {mappingReviewStats.notMapped.length > 0 && (
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${mappingSubTab === 'REJECTED' ? 'bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-gray-300' : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400'}`}>
                              {mappingReviewStats.notMapped.length}
                          </span>
                      )}
                  </button>
                  <button type="button"
                    onClick={() => {
                        setMappingSubTab('MEMORY');
                    }}
                    className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${mappingSubTab === 'MEMORY' ? 'border-purple-500 text-purple-600 dark:text-purple-400' : 'border-transparent text-secondary hover:text-primary dark:hover:text-gray-300'}`}
                  >
                      6. System Memory
                      {mappingReviewStats.confirmed.length > 0 && (
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${mappingSubTab === 'MEMORY' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400'}`}>
                              {mappingReviewStats.confirmed.length}
                          </span>
                      )}
                  </button>
              </div>

              {mappingSubTab !== 'EMAIL_INGEST' && (
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-nocturne p-4 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <label className="text-[10px] font-bold text-secondary dark:text-gray-400 uppercase tracking-wider">Supplier Scope</label>
                          <select
                              value={mappingSupplierId}
                              onChange={(e) => setMappingSupplierId(e.target.value)}
                              className="min-w-[240px] bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20"
                          >
                              <option value="">All suppliers</option>
                              {visibleSuppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                          </select>
                          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800">
                              {mappingReviewStats.totalSnapshotRows} stock rows
                          </span>
                      </div>
                      <div className="flex flex-wrap gap-3 items-center">
                          {['SUPPLIER_ITEMS', 'CONFIRMED', 'MEMORY'].includes(mappingSubTab) && (
                              <button
                                  type="button"
                                  title="Recalculate product availability from confirmed mappings and the latest supplier stock rows"
                                  onClick={() => refreshAvailability().then(() => alert('Availability recalculated from confirmed mappings.'))}
                                  className="text-secondary hover:text-[var(--color-brand)] text-xs font-bold flex items-center gap-1 transition-colors"
                              >
                                  <RefreshCw size={14}/> Refresh Availability
                              </button>
                          )}
                          {['SUPPLIER_ITEMS', 'PROPOSED'].includes(mappingSubTab) && (
                              <button type="button" onClick={async () => {
                                  const targetSuppliers = mappingSupplierId ? visibleSuppliers.filter(s => s.id === mappingSupplierId) : visibleSuppliers;
                                  if (!globalThis.confirm(`Run Auto-Match for ${mappingSupplierId ? selectedMappingSupplier?.name : 'all suppliers'}? This uses confirmed memory first, then code matching, text similarity, and ambiguity checks.`)) return;
                                  const results = [];
                                  for (const s of targetSuppliers) {
                                      const res = await runAutoMapping(s.id);
                                      results.push(`${s.name}: +${res.confirmed} Confirmed, +${res.proposed} Proposed`);
                                  }
                                  alert(results.join('\n'));
                              }} className="bg-[var(--color-brand)] text-white px-4 py-2 rounded-lg font-bold text-xs shadow-sm hover:opacity-90 flex items-center gap-2 transition-all">
                                  <Wand2 size={14}/> Run Auto-Match
                              </button>
                          )}
                          {mappingSubTab === 'PROPOSED' && mappingReviewStats.highConfidence.length > 0 && (
                               <button type="button"
                                   onClick={async () => {
                                       const highConf = mappingReviewStats.highConfidence;
                                       if (!globalThis.confirm(`Confirm all ${highConf.length} high-confidence (>=90%) mappings?`)) return;
                                       for (const m of highConf) {
                                           await updateMapping({ ...m, mappingStatus: 'CONFIRMED' });
                                       }
                                       alert(`Successfully confirmed ${highConf.length} mappings.`);
                                   }}
                                   className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-sm hover:bg-green-700 flex items-center gap-2 transition-all"
                               >
                                   <CheckCircle size={14}/> Confirm High Confidence
                               </button>
                          )}
                      </div>
                  </div>
              )}

              <div className="table-shell bg-white dark:bg-nocturne rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800">
                  {mappingSubTab === 'EMAIL_INGEST' ? (
                      renderEmailIngestionHub()
                  ) : mappingSubTab === 'SUPPLIER_ITEMS' ? (
                      renderSupplierInventoryItems()
                  ) : mappingSubTab === 'PROPOSED' ? (
                      renderGuidedMappingReview()
                  ) : mappingSubTab === 'MEMORY' ? (
                      <div className="p-0">
                          {/* Commitment stage header */}
                          <div className="p-5 bg-purple-50 dark:bg-purple-900/10 border-b border-purple-100 dark:border-purple-900/30">
                              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                  <div className="flex items-start gap-3">
                                      <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 shrink-0">
                                          <Database size={18}/>
                                      </div>
                                      <div>
                                          <h4 className="font-bold text-purple-900 dark:text-purple-100 text-base flex items-center gap-2">
                                              System Memory - Confirmed Mapping Decisions
                                          </h4>
                                          <p className="text-xs text-purple-700 dark:text-purple-300 mt-1 max-w-2xl leading-relaxed">
                                              Confirmed matches appear here automatically. There is no extra step to move them into memory.
                                              When new supplier files arrive, these mappings are applied <strong>automatically</strong> — no manual work needed.
                                              The price sync button only updates Item Master prices from the latest confirmed supplier sell prices.
                                          </p>
                                          <div className="mt-3 flex items-center gap-3">
                                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-3 py-1.5 rounded-full">
                                                  <CheckCircle2 size={13}/> {systemMemoryRows.length} decision{systemMemoryRows.length !== 1 ? 's' : ''} in memory
                                              </span>
                                              <span className="text-xs text-purple-500 dark:text-purple-400">
                                                  Removing a decision means that supplier SKU will need review on the next upload
                                              </span>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="shrink-0 flex flex-col items-start lg:items-end gap-1">
                                      <button type="button"
                                        title="Copy latest confirmed supplier sell prices onto the linked internal item prices. This does not create or save memory."
                                        onClick={async () => {
                                            const scopeLabel = mappingSupplierId ? (selectedMappingSupplier?.name || 'the selected supplier') : 'all suppliers';
                                            if (!globalThis.confirm(`Sync confirmed supplier sell prices to Item Master prices for ${scopeLabel}?\n\nThis does not create System Memory. Confirmed mappings are already saved as memory; this only updates item prices from the latest supplier stock rows.`)) return;
                                            setIsSyncing(true);
                                            try {
                                                await syncItemsFromSnapshots(mappingSupplierId || undefined);
                                                alert(`Confirmed supplier prices synchronized to Item Master for ${scopeLabel}.`);
                                            } catch (e: any) {
                                                alert('Sync failed: ' + e.message);
                                            } finally {
                                                setIsSyncing(false);
                                            }
                                        }}
                                        disabled={isSyncing || systemMemoryRows.length === 0}
                                        className="bg-purple-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-purple-600/20"
                                      >
                                          {isSyncing ? <RefreshCw size={14} className="animate-spin"/> : <Zap size={14}/>}
                                          Sync Confirmed Prices
                                      </button>
                                      <span className="text-[10px] text-purple-500 dark:text-purple-400 max-w-[220px] text-left lg:text-right">
                                          {systemMemoryRows.length === 0 ? 'Confirm matches first; there are no prices to sync yet.' : 'Optional: updates Item Master prices only.'}
                                      </span>
                                  </div>
                              </div>
                          </div>
                          <table className="dense-admin-table text-secondary dark:text-gray-400 w-full">
                              <thead className="table-header"><tr>
                                  <th className="px-4 py-3 table-sticky-left whitespace-nowrap">Supplier Product</th>
                                  <th className="px-4 py-3 whitespace-nowrap">Internal Master Item</th>
                                  <th className="px-4 py-3 whitespace-nowrap">Method</th>
                                  <th className="px-4 py-3 whitespace-nowrap">Supplier</th>
                                  <th className="px-4 py-3 whitespace-nowrap">Locked</th>
                                  <th className="px-4 py-3 text-center table-sticky-right whitespace-nowrap">Action</th>
                              </tr></thead>
                              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                  {systemMemoryRows.map(mem => (
                                      <tr key={mem.id} className="table-row">
                                          <td className="px-4 py-3 table-sticky-left">
                                              <div className="font-mono text-xs">{mem.supplierSku}</div>
                                              <div className="text-[10px] text-gray-400">Ref: {mem.supplierCustomerStockCode || '-'}</div>
                                          </td>
                                          <td className="px-4 py-3">
                                              <div className="font-bold text-gray-900 dark:text-white truncate max-w-[200px]">{mem.productName}</div>
                                              <div className="text-xs font-mono text-secondary dark:text-gray-500">{mem.internalSku}</div>
                                          </td>
                                          <td className="px-4 py-3">
                                              <span className="badge-gray text-[10px]">{mem.mappingMethod}</span>
                                          </td>
                                          <td className="px-4 py-3">
                                              <div className="font-semibold text-gray-800 dark:text-gray-200 text-xs">{mem.supplierName}</div>
                                          </td>
                                          <td className="px-4 py-3 text-xs font-mono text-gray-500">
                                              {mem.updatedAt ? new Date(mem.updatedAt).toLocaleDateString() : '-'}
                                          </td>
                                          <td className="px-4 py-3 text-center table-sticky-right">
                                              <button type="button"
                                                title="Remove from system memory — future uploads will need this re-mapped"
                                                onClick={async () => {
                                                    if (!globalThis.confirm('Remove this from system memory?\n\nFuture supplier uploads will need this item to be re-mapped manually.')) return;
                                                    await deleteMapping(mem.id);
                                                }}
                                                className="icon-btn-red"
                                              >
                                                  <Trash2 size={16}/>
                                              </button>
                                          </td>
                                      </tr>
                                  ))}
                                  {systemMemoryRows.length === 0 && (
                                      <tr><td colSpan={6} className="text-center p-8 text-gray-400">No confirmed mappings in persistent memory yet.</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                  ) : (
                      <table className="dense-admin-table text-secondary dark:text-gray-400 w-full">
                          <thead className="table-header"><tr>
                              <th className="px-4 py-3 table-sticky-left whitespace-nowrap">Supplier Product</th>
                              <th className="px-4 py-3 whitespace-nowrap">Internal Item</th>
                              <th className="px-4 py-3 whitespace-nowrap">Status</th>
                              <th className="px-4 py-3 whitespace-nowrap">Details</th>
                              <th className="px-4 py-3 text-right whitespace-nowrap">Sell $</th>
                              <th className="px-4 py-3 text-right whitespace-nowrap">SOH</th>
                              <th className="px-4 py-3 text-center whitespace-nowrap">Confidence</th>
                              <th className="px-4 py-3 text-center table-sticky-right whitespace-nowrap">Action</th>
                          </tr></thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                              {supplierScopedMappings.filter(m => m.mappingStatus === mappingSubTab).map(map => {
                                  const internalItem = items.find(i => i.id === map.productId);
                                  const supplier = suppliers.find(s => s.id === map.supplierId);
                                  const supNorm = map.supplierCustomerStockCode ? normalizeItemCode(map.supplierCustomerStockCode) : null;
                                  const mappingStatusLabel = map.mappingStatus === 'REJECTED' ? 'NOT MAPPED' : map.mappingStatus;

                                  return (
                                      <tr key={map.id} className="table-row">
                                          <td className="px-6 py-4 table-sticky-left">
                                              <div className="font-medium text-gray-900 dark:text-white">{map.supplierSku}</div>
                                              <div className="text-xs text-[var(--color-brand)]">{supplier?.name}</div>
                                              {map.supplierCustomerStockCode && (
                                                  <div className="mt-1">
                                                      <div className="text-[10px] bg-gray-100 dark:bg-white/10 px-1 rounded inline-block">Ref: {map.supplierCustomerStockCode}</div>
                                                  </div>
                                              )}
                                              {(function() {
                                                  const snapshot = stockSnapshots.find(s => s.supplierId === map.supplierId && s.supplierSku === map.supplierSku);
                                                  if (snapshot?.productName) {
                                                      return <div className="text-xs text-secondary mt-1 italic line-clamp-2" title={snapshot.productName}>{snapshot.productName}</div>
                                                  }
                                                  return null;
                                              })()}
                                          </td>
                                          <td className="px-6 py-4">
                                              {map.mappingStatus === 'REJECTED' ? (
                                                  <div>
                                                      <div className="font-bold text-gray-900 dark:text-white">No internal item mapped</div>
                                                      <div className="text-xs text-gray-400">Supplier row intentionally excluded</div>
                                                  </div>
                                              ) : internalItem ? (
                                                  <div title={`Raw: ${internalItem.sku}\nNorm: ${internalItem.sapItemCodeNorm || normalizeItemCode(internalItem.sku).normalized}`}>
                                                      <div className="font-bold text-gray-900 dark:text-white">{internalItem.name}</div>
                                                      <div className="text-xs font-mono">{internalItem.sku}</div>
                                                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">Norm: {internalItem.sapItemCodeNorm || normalizeItemCode(internalItem.sku).normalized}</div>
                                                  </div>
                                              ) : <span className="text-red-500">Item Missing ({map.productId})</span>}
                                          </td>
                                          <td className="px-6 py-4">
                                              <span className={`badge ${map.mappingStatus === 'PROPOSED' ? 'bg-yellow-100 text-yellow-800' : map.mappingStatus === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{mappingStatusLabel}</span>
                                              <div className="flex items-center gap-1.5 mt-1">
                                                  <div className="text-[10px] uppercase font-bold text-gray-400">{map.mappingMethod}</div>
                                                  {map.manualOverride && (
                                                      <span className="text-[9px] bg-purple-100 text-purple-700 px-1 rounded font-bold uppercase" title="Manually decided by user">Manual</span>
                                                  )}
                                              </div>
                                          </td>
                                          <td className="px-6 py-4">
                                              {(function() {
                                                  const snapshot = stockSnapshots.find(s => s.supplierId === map.supplierId && s.supplierSku === map.supplierSku);
                                                  if (!snapshot) return <span className="text-gray-300 text-xs">-</span>;
                                                  
                                                  return (
                                                      <div className="space-y-1">
                                                          {(snapshot.customerStockCode || map.supplierCustomerStockCode) ? (
                                                              <div className="text-xs">
                                                                  <span className="text-gray-400 font-bold text-[10px] uppercase">Cust:</span> <span className="font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-1 rounded">{snapshot.customerStockCode || map.supplierCustomerStockCode}</span>
                                                              </div>
                                                          ) : null}
                                                          {snapshot.cartonQty ? (
                                                              <div className="text-xs">
                                                                  <span className="text-gray-400 font-bold text-[10px] uppercase">UPQ:</span> <span className="font-medium">{snapshot.cartonQty}</span>
                                                              </div>
                                                          ) : null}
                                                          {snapshot.category ? (
                                                               <div className="text-xs">
                                                                  <span className="text-gray-400 font-bold text-[10px] uppercase">Cat:</span> <span className="badge-gray">{snapshot.category}</span>
                                                               </div>
                                                          ) : null}
                                                          {snapshot.stockType ? (
                                                              <div className="text-xs">
                                                                  <span className="text-gray-400 font-bold text-[10px] uppercase">Type:</span> <span className="font-medium">{snapshot.stockType}</span>
                                                              </div>
                                                          ): null}
                                                      </div>
                                                  )
                                              })()}
                                          </td>
                                          <td className="px-6 py-4 text-right">
                                               {(function() {
                                                  const snapshot = stockSnapshots.find(s => s.supplierId === map.supplierId && s.supplierSku === map.supplierSku);
                                                  if (!snapshot || !snapshot.sellPrice) return <span className="text-gray-300 text-xs">-</span>;
                                                  return (
                                                      <div className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300">
                                                          ${Number(snapshot.sellPrice).toFixed(2)}
                                                      </div>
                                                  );
                                              })()}
                                          </td>
                                          <td className="px-6 py-4 text-right">
                                             {(() => {
                                                 const snapshot = stockSnapshots.find(s => s.supplierId === map.supplierId && s.supplierSku === map.supplierSku);
                                                 if (!snapshot) return <span className="text-gray-300">-</span>;
                                                 return (
                                                     <div className="flex flex-col items-end">
                                                         <span className="font-bold text-gray-900 dark:text-white">{snapshot.stockOnHand}</span>
                                                         <span className="text-[10px] text-tertiary">Avail: {snapshot.availableQty}</span>
                                                     </div>
                                                 );
                                             })()}
                                          </td>
                                          <td className="px-6 py-4 text-center">
                                              <div className="flex flex-col items-center group/conf relative">
                                                  <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-1">
                                                      <div 
                                                          className={`h-full transition-all duration-500 ${map.confidenceScore >= 0.9 ? 'bg-green-500' : map.confidenceScore >= 0.7 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                          style={{ width: `${Math.min(1, map.confidenceScore) * 100}%` }}
                                                      />
                                                  </div>
                                                <span className={`font-mono text-[11px] font-bold ${map.confidenceScore >= 0.9 ? 'text-green-500' : map.confidenceScore >= 0.7 ? 'text-yellow-600' : 'text-red-500'}`}>
                                                    {(map.confidenceScore * 100).toFixed(0)}%
                                                </span>
                                                
                                                {map.mappingJustification?.components && (
                                                    <div className="absolute bottom-full mb-2 hidden group-hover/conf:block z-[100] w-64 p-3 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 animate-fade-in text-left">
                                                        <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-700 pb-1">Match Reason</h5>
                                                        <div className="space-y-2">
                                                            {(map.mappingJustification.components || []).map((c: any, i: number) => (
                                                                <div key={i} className="flex justify-between items-start gap-2">
                                                                    <div>
                                                                        <div className="text-[11px] font-bold leading-none">{String(c.type || 'Match').replace(/_/g, ' ')}</div>
                                                                        <div className="text-[9px] text-gray-400 mt-0.5">{c.detail}</div>
                                                                    </div>
                                                                    <div className="text-[10px] font-mono font-bold text-green-400">+{Number(c.score || 0).toFixed(1)}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                              </div>
                                          </td>
                                          <td className="px-6 py-4 text-center table-sticky-right">
                                              <div className="flex justify-center gap-2">
                                                  {map.mappingStatus === 'PROPOSED' && (
                                                      <>
                                                          <button type="button" onClick={() => updateMapping({ ...map, mappingStatus: 'CONFIRMED' }).then(() => alert('Confirmed'))} className="icon-btn-green" title="Confirm"><CheckCircle2 size={18}/></button>
                                                          <button type="button" onClick={() => { setNotMappedTarget(map); setNotMappedReason('No longer required'); }} className="icon-btn-red" title="Mark as not mapped"><MinusCircle size={18}/></button>
                                                          <button type="button" onClick={() => {
                                                              const snapshot = stockSnapshots.find(s => s.supplierId === map.supplierId && s.supplierSku === map.supplierSku);
                                                              if (!snapshot) return alert('Source stock row is not available for correction.');
                                                              setMappingSource(snapshot);
                                                              setItemSearch('');
                                                              setIsManualMapOpen(true);
                                                          }} className="text-xs text-blue-500 hover:underline font-bold px-2" title="Choose a different item">Correct</button>
                                                      </>
                                                  )}
                                                  {map.mappingStatus === 'CONFIRMED' && (
                                                      <>
                                                       <button type="button" onClick={() => updateMapping({ ...map, mappingStatus: 'PROPOSED' })} className="text-xs text-gray-400 hover:text-[var(--color-brand)] underline">Un-confirm</button>
                                                       <button type="button" onClick={() => {
                                                              const snapshot = stockSnapshots.find(s => s.supplierId === map.supplierId && s.supplierSku === map.supplierSku);
                                                              if (!snapshot) return alert('Source stock row is not available for correction.');
                                                              setMappingSource(snapshot);
                                                              setItemSearch('');
                                                              setIsManualMapOpen(true);
                                                          }} className="text-xs text-blue-500 hover:underline font-bold px-2">Revise</button>
                                                      </>
                                                  )}
                                                  {map.mappingStatus === 'REJECTED' && (
                                                      <button type="button" onClick={() => {
                                                          const snapshot = stockSnapshots.find(s => s.supplierId === map.supplierId && s.supplierSku === map.supplierSku);
                                                          if (!snapshot) return alert('Source stock row is not available for correction.');
                                                          setMappingSource(snapshot);
                                                          setItemSearch('');
                                                          setIsManualMapOpen(true);
                                                      }} className="text-xs text-blue-500 hover:underline font-bold px-2">Map Manually</button>
                                                  )}
                                              </div>
                                          </td>
                                      </tr>
                                  );
                              })}
                              {supplierScopedMappings.filter(m => m.mappingStatus === mappingSubTab).length === 0 && (
                                  <tr><td colSpan={8} className="text-center p-8 text-gray-400">No mappings found in this tab.</td></tr>
                              )}
                          </tbody>
                      </table>
                  )}
              </div>
          </div>
      )}

      {activeTab === 'SUPPLIERS' && (
        <div className="space-y-6 animate-fade-in">
             <div className="bg-white dark:bg-nocturne rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
                 <div className="flex justify-end mb-4"><button type="button" onClick={() => openSupplierForm()} className="btn-primary flex items-center gap-2"><Plus size={16}/> Add Supplier</button></div>
                 <div className="table-shell">
                    <table className="dense-admin-table text-secondary dark:text-gray-400 min-w-[700px]">
                        <thead className="table-header"><tr><th className="px-6 py-4 table-sticky-left">Supplier</th><th className="px-6 py-4">Key Contact</th><th className="px-6 py-4">Categories</th><th className="px-6 py-4 text-center table-sticky-right">Action</th></tr></thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                            {visibleSuppliers.map(s => {
                                const contacts = normalizeSupplierContacts(s);
                                const primaryContact = contacts.find(contact => contact.isPrimary) || contacts[0];
                                return (
                                <tr key={s.id} className="table-row">
                                    <td className="px-6 py-4 table-sticky-left"><div className="font-bold text-gray-900 dark:text-white">{s.name}</div><div className="text-xs">{s.address}</div></td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900 dark:text-white">{primaryContact?.name || s.keyContact || 'Inventory contact'}</div>
                                        <div className="text-xs text-[var(--color-brand)]">{primaryContact?.email || s.contactEmail || 'No email recorded'}</div>
                                        <div className="text-xs">{primaryContact?.phone || s.phone}</div>
                                        {contacts.length > 1 && <div className="text-[11px] font-bold text-secondary mt-1">{contacts.length - 1} additional contact{contacts.length > 2 ? 's' : ''}</div>}
                                    </td>
                                    <td className="px-6 py-4">{s.categories.map(c => <span key={c} className="badge mr-1">{c}</span>)}</td>
                                    <td className="px-6 py-4 text-center table-sticky-right"><div className="flex justify-center gap-2"><button type="button" onClick={() => openSupplierForm(s)} className="icon-btn-blue"><Edit2 size={16}/></button><button type="button" onClick={() => deleteSupplier(s.id)} className="icon-btn-red"><Trash2 size={16}/></button></div></td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                 </div>
             </div>
             {isSupplierFormOpen && (
                 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-nocturne rounded-2xl shadow-xl w-[95%] max-w-3xl max-h-[90vh] overflow-y-auto p-6 animate-slide-up">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{editingSupplier ? 'Edit Supplier' : 'New Supplier'}</h2>
                        <form onSubmit={handleSupplierFormSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company name</label>
                                <input required className="input-field" value={supplierForm.name} onChange={e => setSupplierForm({...supplierForm, name: e.target.value})}/>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Key contact</label>
                                    <input required className="input-field" value={supplierForm.keyContact} onChange={e => setSupplierForm({...supplierForm, keyContact: e.target.value})}/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone</label>
                                    <input required className="input-field" value={supplierForm.phone} onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})}/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                                <input required type="email" className="input-field" value={supplierForm.contactEmail} onChange={e => setSupplierForm({...supplierForm, contactEmail: e.target.value})}/>
                            </div>
                            <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Supplier contacts</h3>
                                        <p className="text-xs text-secondary dark:text-gray-500">Add every sender who may provide stock reports for this supplier.</p>
                                    </div>
                                    <button type="button" onClick={addSupplierContactRow} className="btn-secondary text-xs flex items-center gap-2"><UserPlus size={14}/> Add Contact</button>
                                </div>
                                <div className="space-y-3">
                                    {supplierForm.contacts.map((contact, index) => (
                                        <div key={contact.id} className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_0.8fr_0.8fr_auto] gap-3 items-end bg-gray-50 dark:bg-white/5 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase text-secondary dark:text-gray-500 mb-1">Name</label>
                                                <input className="input-field" value={contact.name} onChange={e => updateSupplierContactRow(contact.id, { name: e.target.value })}/>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase text-secondary dark:text-gray-500 mb-1">Email</label>
                                                <input type="email" className="input-field" value={contact.email} onChange={e => updateSupplierContactRow(contact.id, { email: e.target.value })}/>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase text-secondary dark:text-gray-500 mb-1">Phone</label>
                                                <input className="input-field" value={contact.phone} onChange={e => updateSupplierContactRow(contact.id, { phone: e.target.value })}/>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase text-secondary dark:text-gray-500 mb-1">Role</label>
                                                <input className="input-field" value={contact.role} onChange={e => updateSupplierContactRow(contact.id, { role: e.target.value })}/>
                                            </div>
                                            <div className="flex items-center justify-end gap-2">
                                                <button type="button" onClick={() => updateSupplierContactRow(contact.id, { isPrimary: true })} className={`px-3 py-2 rounded-lg text-xs font-bold border ${contact.isPrimary ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white dark:bg-nocturne text-secondary border-gray-200 dark:border-gray-700'}`}>Primary</button>
                                                {index > 0 && <button type="button" onClick={() => removeSupplierContactRow(contact.id)} className="icon-btn-red"><Trash2 size={14}/></button>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Address</label>
                                <input required className="input-field" value={supplierForm.address} onChange={e => setSupplierForm({...supplierForm, address: e.target.value})}/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Categories (comma separated)</label>
                                <input className="input-field" value={supplierForm.categories} onChange={e => setSupplierForm({...supplierForm, categories: e.target.value})}/>
                            </div>
                            <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setIsSupplierFormOpen(false)} className="px-4 py-2 text-secondary font-medium hover:bg-gray-100 rounded-lg">Cancel</button><button type="submit" className="btn-primary">Save Supplier</button></div>
                        </form>
                    </div>
                 </div>
             )}
        </div>
      )}

      {activeTab === 'SITES' && (
        <div className="space-y-6 animate-fade-in">
             <div className="bg-white dark:bg-nocturne rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
                 <div className="flex justify-end mb-4"><button type="button" onClick={() => openSiteForm()} className="btn-primary flex items-center gap-2"><Plus size={16}/> Add Site</button></div>
                 <div className="table-shell">
                    <table className="dense-admin-table text-secondary dark:text-gray-400 min-w-[700px]">
                        <thead className="table-header"><tr><th className="px-6 py-4 table-sticky-left">Site Name</th><th className="px-6 py-4">Suburb</th><th className="px-6 py-4">Address</th><th className="px-6 py-4">State</th><th className="px-6 py-4">Contact</th><th className="px-6 py-4 text-center table-sticky-right">Action</th></tr></thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                            {sites.map(s => (
                                <tr key={s.id} className="table-row">
                                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white table-sticky-left">{s.name}</td>
                                    <td className="px-6 py-4">{s.suburb}</td>
                                    <td className="px-6 py-4">{s.address}</td>
                                    <td className="px-6 py-4"><span className="badge">{s.state}</span> <span className="text-xs text-gray-400">{s.zip}</span></td>
                                    <td className="px-6 py-4">{s.contactPerson}</td>
                                    <td className="px-6 py-4 text-center table-sticky-right"><div className="flex justify-center gap-2"><button type="button" onClick={() => openSiteForm(s)} className="icon-btn-blue"><Edit2 size={16}/></button><button type="button" onClick={() => deleteSite(s.id)} className="icon-btn-red"><Trash2 size={16}/></button></div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
             </div>
             {isSiteFormOpen && (
                 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-nocturne rounded-2xl shadow-xl w-[95%] max-w-lg p-6 animate-slide-up">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{editingSite ? 'Edit Site' : 'New Site'}</h2>
                        <form onSubmit={handleSiteFormSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Site name</label>
                                <input required className="input-field" value={siteForm.name} onChange={e => setSiteForm({...siteForm, name: e.target.value})}/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Suburb</label>
                                <input required className="input-field" value={siteForm.suburb} onChange={e => setSiteForm({...siteForm, suburb: e.target.value})}/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Address</label>
                                <input required className="input-field" value={siteForm.address} onChange={e => setSiteForm({...siteForm, address: e.target.value})}/>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">State</label>
                                    <input required className="input-field" value={siteForm.state} onChange={e => setSiteForm({...siteForm, state: e.target.value})}/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Postcode</label>
                                    <input required className="input-field" value={siteForm.zip} onChange={e => setSiteForm({...siteForm, zip: e.target.value})}/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contact person</label>
                                <input required className="input-field" value={siteForm.contactPerson} onChange={e => setSiteForm({...siteForm, contactPerson: e.target.value})}/>
                            </div>
                            <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setIsSiteFormOpen(false)} className="px-4 py-2 text-secondary font-medium hover:bg-gray-100 rounded-lg">Cancel</button><button type="submit" className="btn-primary">Save Site</button></div>
                        </form>
                    </div>
                 </div>
             )}
        </div>
      )}

      {activeTab === 'WORKFLOW' && (
          <SimpleWorkflowConfig
              workflows={workflowConfigs}
              roles={roles}
              users={users}
              appName={branding.appName}
              onSave={handleSaveWorkflows}
              onTest={handleTestNotification}
          />
      )}

      {activeTab === 'BRANDING' && (
          <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Branding Code Restored */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-nocturne p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Visual Identity</h3>
                        
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Application name</label>
                                <input 
                                    className="input-field" 
                                    value={brandingForm.appName}
                                    onChange={e => setBrandingForm({...brandingForm, appName: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Logo</label>
                                <div className="flex items-center gap-4">
                                    <div className="relative group">
                                        {brandingForm.logoUrl ? (
                                            <BrandLogo
                                                appName={brandingForm.appName}
                                                logoUrl={brandingForm.logoUrl}
                                                size="lg"
                                            />
                                        ) : (
                                            <div className="w-16 h-16 rounded-xl bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden shadow-sm">
                                                <Image size={24} className="text-gray-300"/>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer" onClick={() => logoInputRef.current?.click()}>
                                            <Edit2 size={16} className="text-white"/>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload}/>
                                        <button type="button" onClick={() => logoInputRef.current?.click()} className="text-xs font-bold text-[var(--color-brand)] border border-[var(--color-brand)] px-3 py-1.5 rounded-lg hover:bg-[var(--color-brand)] hover:text-white transition-colors">
                                            Upload Logo
                                        </button>
                                        <p className="text-[10px] text-gray-400 mt-1">Recommended: 200x200px PNG</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Font family</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: 'sans', name: 'Clean Sans', font: 'font-sans' },
                                        { id: 'arial', name: 'Arial', font: 'font-[Arial]' }, // Added Arial
                                        { id: 'serif', name: 'Elegant Serif', font: 'font-serif' },
                                        { id: 'mono', name: 'Technical Mono', font: 'font-mono' }
                                    ].map(font => (
                                        <button type="button"
                                            key={font.id}
                                            onClick={() => setBrandingForm({...brandingForm, fontFamily: font.id as any})}
                                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${brandingForm.fontFamily === font.id ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 ring-1 ring-[var(--color-brand)]' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                                        >
                                            <span className={`text-xl ${font.font}`}>Ag</span>
                                            <span className="text-[10px] font-bold text-gray-500 uppercase">{font.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white dark:bg-nocturne p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Theme Colors</h3>
                        <div className="space-y-8">
                             <ColorPicker label="Primary Brand Color" value={brandingForm.primaryColor} onChange={c => setBrandingForm({...brandingForm, primaryColor: c})} />
                             <ColorPicker label="Secondary Color" value={brandingForm.secondaryColor} onChange={c => setBrandingForm({...brandingForm, secondaryColor: c})} />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-nocturne p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800">
                        <div className="flex items-start justify-between gap-4 mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Home Experience</h3>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-5">
                                    Control the greeting and daily message shown on the MercerFlow home screen.
                                </p>
                            </div>
                            <Sparkles size={20} className="text-[var(--color-brand)]" />
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Greeting source</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'random', label: 'Randomised' },
                                        { id: 'custom', label: 'Admin set' },
                                    ].map(option => (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => setBrandingForm(prev => ({
                                                ...prev,
                                                homeExperience: {
                                                    ...(prev.homeExperience || { greetingMode: 'random', quoteMode: 'random', messageType: 'quote' }),
                                                    greetingMode: option.id as 'custom' | 'random',
                                                },
                                            }))}
                                            className={`rounded-xl border px-3 py-2 text-xs font-black transition-all ${
                                                brandingForm.homeExperience?.greetingMode === option.id
                                                    ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
                                                    : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                                <textarea
                                    className="input-field mt-3 min-h-[82px]"
                                    disabled={brandingForm.homeExperience?.greetingMode !== 'custom'}
                                    placeholder="Good day, {first_name}. Your workspace is focused."
                                    value={brandingForm.homeExperience?.greetingText || ''}
                                    onChange={e => setBrandingForm(prev => ({
                                        ...prev,
                                        homeExperience: {
                                            ...(prev.homeExperience || { greetingMode: 'custom', quoteMode: 'random', messageType: 'quote' }),
                                            greetingText: e.target.value,
                                        },
                                    }))}
                                />
                                <p className="mt-2 text-[10px] font-medium text-gray-400">Available tokens: {'{first_name}'}, {'{name}'}, {'{site_label}'}, {'{app_name}'}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Message type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'quote', label: 'Quote' },
                                        { id: 'announcement', label: 'Announcement' },
                                    ].map(option => (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => setBrandingForm(prev => ({
                                                ...prev,
                                                homeExperience: {
                                                    ...(prev.homeExperience || { greetingMode: 'random', quoteMode: 'random', messageType: 'quote' }),
                                                    messageType: option.id as 'quote' | 'announcement',
                                                    quoteMode: option.id === 'announcement' ? 'custom' : (prev.homeExperience?.quoteMode || 'random'),
                                                },
                                            }))}
                                            className={`rounded-xl border px-3 py-2 text-xs font-black transition-all ${
                                                (brandingForm.homeExperience?.messageType || 'quote') === option.id
                                                    ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
                                                    : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-2 text-[10px] font-medium text-gray-400">
                                    Use Quote for the rotating daily focus, or Announcement for a fixed admin message to all users.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {(brandingForm.homeExperience?.messageType || 'quote') === 'announcement' ? 'Announcement source' : 'Daily quote source'}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'random', label: 'Quote of today' },
                                        { id: 'custom', label: 'Admin set' },
                                    ].map(option => (
                                        <button
                                            key={option.id}
                                            type="button"
                                            disabled={(brandingForm.homeExperience?.messageType || 'quote') === 'announcement' && option.id === 'random'}
                                            onClick={() => setBrandingForm(prev => ({
                                                ...prev,
                                                homeExperience: {
                                                    ...(prev.homeExperience || { greetingMode: 'random', quoteMode: 'random', messageType: 'quote' }),
                                                    quoteMode: option.id as 'custom' | 'random',
                                                },
                                            }))}
                                            className={`rounded-xl border px-3 py-2 text-xs font-black transition-all ${
                                                brandingForm.homeExperience?.quoteMode === option.id
                                                    ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
                                                    : 'border-gray-200 text-gray-500 hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                                <textarea
                                    className="input-field mt-3 min-h-[82px]"
                                    disabled={brandingForm.homeExperience?.quoteMode !== 'custom'}
                                    placeholder={(brandingForm.homeExperience?.messageType || 'quote') === 'announcement'
                                        ? 'System maintenance is scheduled for Friday at 4:00 PM.'
                                        : 'Progress improves when the next best action is obvious.'}
                                    value={brandingForm.homeExperience?.quoteText || ''}
                                    onChange={e => setBrandingForm(prev => ({
                                        ...prev,
                                        homeExperience: {
                                            ...(prev.homeExperience || { greetingMode: 'random', quoteMode: 'custom', messageType: 'quote' }),
                                            quoteText: e.target.value,
                                        },
                                    }))}
                                />
                                <p className="mt-2 text-[10px] font-medium text-gray-400">
                                    {(brandingForm.homeExperience?.messageType || 'quote') === 'announcement'
                                        ? 'Announcements are fixed until an admin changes or switches them back to Quote.'
                                        : 'Random mode rotates leadership and continuous-improvement messages daily.'}
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex justify-end pt-4">
                        <button type="button" onClick={handleSaveBranding} className="btn-primary w-full md:w-auto py-3 px-8 text-base">Save Branding Changes</button>
                    </div>
                </div>
          </div>
      )}
      
      {activeTab === 'MENU' && (
          <div className="animate-fade-in max-w-4xl">
              <MenuEditor />
          </div>
      )}



      {activeTab === 'USERS' && (
          <div className="animate-fade-in space-y-6">
              {/* User Dashboard Header */}
               {/* User Stats Dashboard */}
               {(() => {
                   const nonArchived = users.filter(u => u.status !== 'ARCHIVED');
                   const activeUsers = users.filter(u => u.status === 'APPROVED');
                   const pendingUsers = users.filter(u => u.status === 'PENDING_APPROVAL');
                   const invitedPendingCount = pendingUsers.filter(u => u.invitedAt).length;
                   const neverInvitedCount = pendingUsers.filter(u => !u.invitedAt).length;
                   const archivedUsers = users.filter(u => u.status === 'ARCHIVED');

                   return (
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                           {/* Total */}
                           <div className="bg-white dark:bg-nocturne p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-4 group hover:border-[var(--color-brand)] transition-all">
                               <div className="w-12 h-12 rounded-xl bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center group-hover:scale-110 transition-transform">
                                   <Users size={24}/>
                               </div>
                               <div>
                                   <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Members</div>
                                   <div className="text-2xl font-black text-gray-900 dark:text-white">{nonArchived.length}</div>
                               </div>
                           </div>
                           {/* Active */}
                           <div className="bg-white dark:bg-nocturne p-5 rounded-2xl shadow-sm border border-green-200 dark:border-green-800/50 flex items-center gap-4 group hover:border-green-400 transition-all">
                               <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                   <CheckCircle size={24}/>
                               </div>
                               <div>
                                   <div className="text-[11px] font-bold text-green-500 uppercase tracking-wider">Active</div>
                                   <div className="text-2xl font-black text-gray-900 dark:text-white">{activeUsers.length}</div>
                               </div>
                           </div>
                           {/* Pending — clickable to scroll to pending panel */}
                            <div
                                className="bg-white dark:bg-nocturne p-5 rounded-2xl shadow-sm border border-amber-200 dark:border-amber-800/50 flex items-center gap-4 group hover:border-amber-400 transition-all cursor-pointer"
                                onClick={() => { document.getElementById('pending-access-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                                title="View pending access requests"
                            >
                                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Clock size={24}/>
                                </div>
                                <div>
                                    <div className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">Pending</div>
                                    <div className="text-2xl font-black text-gray-900 dark:text-white">{pendingUsers.length}</div>
                                    {pendingUsers.length > 0 && (
                                        <div className="flex items-center gap-2 mt-1">
                                            {invitedPendingCount > 0 && <span className="text-[9px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">{invitedPendingCount} invited</span>}
                                            {neverInvitedCount > 0 && <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded">{neverInvitedCount} not invited</span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Archived — clickable to toggle archived panel */}
                            <div
                                className={`bg-white dark:bg-nocturne p-5 rounded-2xl shadow-sm border transition-all cursor-pointer select-none ${
                                    showArchivedPanel
                                        ? 'border-gray-500 ring-2 ring-gray-400/30'
                                        : 'border-gray-200 dark:border-gray-800 hover:border-gray-400'
                                } flex items-center gap-4 group`}
                                onClick={() => setShowArchivedPanel(v => !v)}
                                title={showArchivedPanel ? 'Hide archived users' : 'Show archived users'}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${
                                    showArchivedPanel ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                                }`}>
                                    <Archive size={24}/>
                                </div>
                                <div>
                                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Archived</div>
                                    <div className="text-2xl font-black text-gray-900 dark:text-white">{archivedUsers.length}</div>
                                    <div className="text-[9px] text-gray-400 mt-0.5">{showArchivedPanel ? 'Click to hide' : 'Click to view'}</div>
                                </div>
                            </div>
                       </div>
                   );
               })()}

              {/* Archived Users Panel — shown when showArchivedPanel is true */}
              {showArchivedPanel && (() => {
                  const archivedUsers = users.filter(u => u.status === 'ARCHIVED');
                  return (
                      <div className="bg-white dark:bg-nocturne rounded-2xl shadow-sm border border-gray-300 dark:border-gray-700 overflow-hidden animate-fade-in">
                          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/40">
                              <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center">
                                      <Archive size={18} />
                                  </div>
                                  <div>
                                      <h3 className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Archived Users</h3>
                                      <p className="text-[11px] text-gray-400 mt-0.5">{archivedUsers.length} user{archivedUsers.length !== 1 ? 's' : ''} archived · Reinstate to make them pending again</p>
                                  </div>
                              </div>
                              <button
                                  type="button"
                                  onClick={() => setShowArchivedPanel(false)}
                                  className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                                  title="Close archived panel"
                              >
                                  <X size={16} />
                              </button>
                          </div>
                          {archivedUsers.length === 0 ? (
                              <div className="px-6 py-10 text-center text-gray-400 text-sm">No archived users.</div>
                          ) : (
                              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                  {archivedUsers.map(user => (
                                      <div key={user.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-all">
                                          <div className="relative shrink-0">
                                              <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-sm opacity-60">
                                                  <img src={user.avatar} className="w-full h-full object-cover bg-gray-100 dark:bg-gray-800" alt={user.name} />
                                              </div>
                                          </div>
                                          <div className="flex-1 min-w-0">
                                              <div className="font-black text-sm text-gray-700 dark:text-gray-300 uppercase tracking-tight leading-none">
                                                  {user.name || user.email?.split('@')[0] || 'Unknown'}
                                              </div>
                                              <div className="text-xs text-gray-400 font-medium mt-0.5">{user.email}</div>
                                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight border bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400">
                                                      <Archive size={9} /> Archived
                                                  </span>
                                                  {(user.roleIds || (user.role ? [user.role] : [])).map(roleId => (
                                                      <span key={roleId} className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-gray-100 dark:bg-gray-800 text-gray-400 opacity-60">
                                                          {roles.find(r => r.id === roleId)?.name || roleId}
                                                      </span>
                                                  ))}
                                                  {user.siteIds?.map(sid => {
                                                      const s = sites.find(x => x.id === sid);
                                                      return s ? (
                                                          <span key={sid} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-[9px] font-bold rounded text-gray-400 uppercase">{s.name}</span>
                                                      ) : null;
                                                  })}
                                              </div>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                              <button
                                                  type="button"
                                                  onClick={async () => {
                                                      if (!globalThis.confirm(`Reinstate ${user.name || user.email}?\n\nThis will move them back to pending so you can grant them access.`)) return;
                                                      await reinstateUser(user.id);
                                                      success(`${user.name || user.email} has been reinstated to pending.`, 4000);
                                                      document.getElementById('pending-access-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                  }}
                                                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-800/40 border-emerald-200 dark:border-emerald-700/50"
                                                  title="Reinstate this user"
                                              >
                                                  <CheckCircle size={13} /> Reinstate
                                              </button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  );
              })()}

              {/* Pending Invitations Panel — only shown when there are non-active users */}
              {(() => {
                  // Users who are in the system but haven't become active members yet
                  const notActiveUsers = users.filter(u => u.status === 'PENDING_APPROVAL');
                  if (notActiveUsers.length === 0) return null;

                  // Split into two groups:
                  // 1. Invited — invite email was sent, awaiting acceptance
                  const invitedPending = notActiveUsers.filter(u => !!u.invitedAt);
                  // 2. Not invited — added to system but no invite ever sent
                  const neverInvited = notActiveUsers.filter(u => !u.invitedAt);

                  const totalCount = notActiveUsers.length;

                  const renderUserRow = (user: typeof users[0], isNeverInvited: boolean) => {
                      const expiryInfo = user.invitationExpiresAt ? getTimeUntilExpiry(user.invitationExpiresAt) : null;
                      const isResending = resendingUserId === user.id;
                      const accentColor = isNeverInvited ? 'indigo' : 'amber';

                      return (
                          <div key={user.id}>
                              <div className={`flex items-center gap-4 px-6 py-4 hover:bg-${accentColor}-50/30 dark:hover:bg-${accentColor}-900/10 transition-all`}>
                              {/* Avatar */}
                              <div className="relative shrink-0">
                                  <div className={`w-10 h-10 rounded-xl overflow-hidden border-2 ${isNeverInvited ? 'border-indigo-200 dark:border-indigo-800/50' : 'border-amber-200 dark:border-amber-800/50'} shadow-sm`}>
                                      <img src={user.avatar} className="w-full h-full object-cover bg-gray-100 dark:bg-gray-800" alt={user.name} />
                                  </div>
                                  <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#1e2029] ${isNeverInvited ? 'bg-indigo-400 shadow-[0_0_6px_rgba(99,102,241,0.6)]' : 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]'}`} />
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                  <div className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-tight leading-none">
                                      {user.name || user.email?.split('@')[0] || 'Unknown'}
                                  </div>
                                  <div className="text-xs text-gray-500 font-medium mt-0.5">{user.email}</div>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                      {/* Status badge */}
                                      {isNeverInvited ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight border bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400">
                                              <MinusCircle size={9} /> Not Invited
                                          </span>
                                      ) : (
                                          expiryInfo ? (
                                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight border ${
                                                  expiryInfo.isExpired
                                                      ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50 text-red-600'
                                                      : expiryInfo.isExpiringSoon
                                                      ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50 text-amber-600 animate-pulse'
                                                      : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50 text-amber-600'
                                              }`}>
                                                  <Clock size={9} />
                                                  {expiryInfo.displayText}
                                              </span>
                                          ) : (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight border bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50 text-amber-600">
                                                  <Clock size={9} /> Awaiting Acceptance
                                              </span>
                                          )
                                      )}
                                      {/* Roles */}
                                      {(user.roleIds || [user.role]).map(roleId => (
                                          <span key={roleId} className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${roleId === 'ADMIN' ? 'bg-purple-100 text-purple-600' : 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]'}`}>
                                              {roles.find(r => r.id === roleId)?.name || roleId}
                                          </span>
                                      ))}
                                      {/* Sites */}
                                      {user.siteIds?.map(sid => {
                                          const s = sites.find(x => x.id === sid);
                                          return s ? (
                                              <span key={sid} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-[9px] font-bold rounded text-gray-500 uppercase">
                                                  {s.name}
                                              </span>
                                          ) : null;
                                      })}
                                  </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2 shrink-0">
                                  {/* Manage Access */}
                                  <button type="button"
                                      onClick={() => {
                                          const newId = managingAccessUserId === user.id ? null : user.id;
                                          setManagingAccessUserId(newId);
                                          if (newId) {
                                              setPendingGrantRole(user.roleIds?.[0] || user.role || roles[0]?.id || '');
                                              setPendingGrantSiteIds(user.siteIds || []);
                                          }
                                      }}
                                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm ${
                                          managingAccessUserId === user.id
                                              ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)] hover:opacity-90'
                                              : 'bg-[var(--color-brand)]/10 text-[var(--color-brand)] hover:bg-[var(--color-brand)]/20 border-[var(--color-brand)]/20'
                                      }`}
                                      title="Manage access for this user"
                                  >
                                      <Shield size={13} /> {managingAccessUserId === user.id ? 'Cancel' : 'Manage Access'}
                                  </button>
                                  <button type="button"
                                      onClick={async () => {
                                          const action = isNeverInvited ? 'Send invitation' : 'Resend invitation';
                                          if (!confirm(`${action} to ${user.name || user.email}?\n\nThis will generate an invitation link valid for 48 hours.`)) return;
                                          setResendingUserId(user.id);
                                          try {
                                              const result = await resendWelcomeEmail(user.email, user.name, user.siteIds?.[0]);
                                              if (result) {
                                                  success(`Invitation sent to ${user.name || user.email}`, 4000);
                                                  await reloadData();
                                              } else {
                                                  error('Failed to send invitation. Please try again.', 5000);
                                              }
                                          } catch (err) {
                                              error('An error occurred while sending the invitation.', 5000);
                                              console.error('Invite error:', err);
                                          } finally {
                                              setResendingUserId(null);
                                          }
                                      }}
                                      disabled={isResending}
                                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${
                                          isNeverInvited
                                              ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800/40 border-indigo-200 dark:border-indigo-700/50'
                                              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/40 border-amber-200 dark:border-amber-700/50'
                                      }`}
                                      title={isNeverInvited ? 'Send invitation email' : 'Resend invitation email'}
                                  >
                                      {isResending ? (
                                          <><Loader2 size={13} className="animate-spin" /> Sending...</>
                                      ) : isNeverInvited ? (
                                          <><Mail size={13} /> Send Invite</>
                                      ) : (
                                          <><Mail size={13} /> Resend Invite</>
                                      )}
                                  </button>
                                  <button type="button"
                                      onClick={() => {
                                          if (globalThis.confirm(`Archive ${user.name || user.email}? This will remove them from the pending list.`)) {
                                              archiveUser(user.id);
                                          }
                                      }}
                                      className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all border border-transparent hover:border-red-200 dark:hover:border-red-800"
                                      title="Archive"
                                  >
                                      <Archive size={15} />
                                  </button>
                              </div>
                          </div>
                          {/* Inline Grant Access Panel */}
                          {managingAccessUserId === user.id && (
                              <div className="mx-6 mb-4 p-4 rounded-xl bg-[var(--color-brand)]/5 border border-[var(--color-brand)]/20 animate-fade-in">
                                  <div className="text-[10px] font-black text-[var(--color-brand)] uppercase tracking-widest mb-3 flex items-center gap-2">
                                      <Shield size={12} /> Grant Access — Assign Role &amp; Sites
                                  </div>
                                  <div className="flex flex-wrap gap-4 items-end">
                                      <div className="flex-1 min-w-[160px]">
                                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Role</label>
                                          <select
                                              value={pendingGrantRole}
                                              onChange={e => setPendingGrantRole(e.target.value)}
                                              className="w-full px-3 py-2 bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
                                          >
                                              {roles.map(r => (
                                                  <option key={r.id} value={r.id}>{r.name}</option>
                                              ))}
                                          </select>
                                      </div>
                                      <div className="flex-1 min-w-[200px]">
                                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Sites</label>
                                          <div className="flex flex-wrap gap-1.5 p-2 bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg min-h-[34px]">
                                              {sites.map(s => {
                                                  const checked = pendingGrantSiteIds.includes(s.id);
                                                  return (
                                                      <button
                                                          key={s.id}
                                                          type="button"
                                                          onClick={() => setPendingGrantSiteIds(prev =>
                                                              prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                                                          )}
                                                          className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border transition-all ${
                                                              checked
                                                                  ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                                                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-[var(--color-brand)]/40'
                                                          }`}
                                                      >
                                                          {s.name}
                                                      </button>
                                                  );
                                              })}
                                          </div>
                                      </div>
                                      <button
                                          type="button"
                                          disabled={isGrantingAccess || !pendingGrantRole || pendingGrantSiteIds.length === 0}
                                          onClick={async () => {
                                              setIsGrantingAccess(true);
                                              try {
                                                  await updateUserAccess(user.id, pendingGrantRole, [pendingGrantRole], pendingGrantSiteIds);
                                                  success(`Access granted to ${user.name || user.email}`, 4000);
                                                  setManagingAccessUserId(null);
                                                  await reloadData();
                                              } catch (e) {
                                                  error('Failed to grant access. Please try again.', 5000);
                                              } finally {
                                                  setIsGrantingAccess(false);
                                              }
                                          }}
                                          className="flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[var(--color-brand)] text-white hover:opacity-90 border border-[var(--color-brand)] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                      >
                                          {isGrantingAccess ? <><Loader2 size={13} className="animate-spin" /> Granting...</> : <><CheckCircle size={13} /> Grant Access</>}
                                      </button>
                                  </div>
                              </div>
                          )}
                      </div>
                  );
                  };

                  return (
                      <div id="pending-access-panel" className="bg-white dark:bg-nocturne rounded-2xl shadow-sm border border-amber-200 dark:border-amber-800/50 overflow-hidden">
                          {/* Panel Header */}
                          <div className="px-6 py-4 border-b border-amber-100 dark:border-amber-800/40 flex items-center justify-between bg-amber-50/60 dark:bg-amber-900/10">
                              <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center">
                                      <Clock size={18} />
                                  </div>
                                  <div>
                                      <h3 className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Pending Access</h3>
                                      <p className="text-[11px] text-amber-600/70 dark:text-amber-500/70 mt-0.5">
                                          {totalCount} user{totalCount !== 1 ? 's' : ''} not yet active
                                          {neverInvited.length > 0 && ` · ${neverInvited.length} never invited`}
                                      </p>
                                  </div>
                              </div>
                              <div className="flex items-center gap-2">
                                  {neverInvited.length > 0 && (
                                      <span className="px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 text-xs font-black">
                                          {neverInvited.length} not invited
                                      </span>
                                  )}
                                  {invitedPending.length > 0 && (
                                      <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-black">
                                          {invitedPending.length} awaiting
                                      </span>
                                  )}
                              </div>
                          </div>

                          {/* Not Invited section */}
                          {neverInvited.length > 0 && (
                              <>
                                  <div className="px-6 py-2 bg-indigo-50/50 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-800/30">
                                      <span className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">
                                          Added to system — invite not yet sent
                                      </span>
                                  </div>
                                  <div className="divide-y divide-indigo-50 dark:divide-indigo-900/20">
                                      {neverInvited.map(u => renderUserRow(u, true))}
                                  </div>
                              </>
                          )}

                          {/* Invited but pending section */}
                          {invitedPending.length > 0 && (
                              <>
                                  <div className={`px-6 py-2 bg-amber-50/50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-800/30 ${neverInvited.length > 0 ? 'border-t border-amber-100 dark:border-amber-800/30' : ''}`}>
                                      <span className="text-[10px] font-black text-amber-500 dark:text-amber-400 uppercase tracking-widest">
                                          Invited — awaiting acceptance
                                      </span>
                                  </div>
                                  <div className="divide-y divide-amber-50 dark:divide-amber-900/20">
                                      {invitedPending.map(u => renderUserRow(u, false))}
                                  </div>
                              </>
                          )}
                      </div>
                  );
              })()}


              {/* Global Directory */}
              <div className="bg-white dark:bg-nocturne rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
                      <div>
                          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Global User Directory</h3>
                          <p className="text-sm text-gray-500">View and manage all active members across the organization.</p>
                      </div>
                      <div className="flex items-center gap-3 w-full md:w-auto">
                           <div className="relative flex-1 md:w-64 group">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[var(--color-brand)] transition-colors" size={14} />
                              <input 
                                  type="text" 
                                  placeholder="Search users..." 
                                  value={userSearch}
                                  onChange={e => setUserSearch(e.target.value)}
                                  className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#15171e] border border-gray-100 dark:border-gray-800 rounded-xl text-xs outline-none focus:ring-4 focus:ring-[var(--color-brand)]/10 focus:bg-white dark:focus:bg-[#1e2029] transition-all"
                              />
                          </div>
                          
                          <div className="relative w-40">
                              <select 
                                  value={userRoleFilter} 
                                  onChange={e => setUserRoleFilter(e.target.value)}
                                  className="w-full pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#15171e] border border-gray-100 dark:border-gray-800 rounded-xl text-xs outline-none focus:ring-4 focus:ring-[var(--color-brand)]/10 appearance-none cursor-pointer text-gray-600 dark:text-gray-300 font-medium"
                              >
                                  <option value="">All Roles</option>
                                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                              </select>
                              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                          </div>

                          <div className="relative w-44">
                              <select value={userStatusFilter} onChange={e => setUserStatusFilter(e.target.value)} className="w-full pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#15171e] border border-gray-100 dark:border-gray-800 rounded-xl text-xs outline-none focus:ring-4 focus:ring-[var(--color-brand)]/10 appearance-none cursor-pointer text-gray-600 dark:text-gray-300 font-medium">
                                  <option value="">All Statuses</option>
                                  <option value="APPROVED">✅ Active</option>
                                  <option value="PENDING_INVITED">🟡 Pending (Invited)</option>
                                  <option value="PENDING_NOT_INVITED">🟣 Pending (Not Invited)</option>
                                  <option value="ARCHIVED">📦 Archived</option>
                              </select>
                              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                          </div>

                          <button type="button" onClick={() => { 
                              setInviteForm({ 
                                id: '', name: '', email: '', jobTitle: '', role: 'SITE_USER', roleIds: ['SITE_USER'],
                                siteIds: activeSiteIds.length > 0 ? activeSiteIds : (sites.length > 0 ? [sites[0].id] : []) 
                              });
                              setInviteStep(1);
                              setIsDirectoryModalOpen(true); 
                              setUserRoleFilter(''); 
                          }} className="btn-primary py-2 px-5 text-xs flex items-center gap-2 rounded-xl shadow-lg shadow-[var(--color-brand)]/20">
                              <UserPlus size={16}/> Add User
                          </button>
                      </div>
                  </div>

                  <div className="table-shell">
                      <table className="dense-admin-table text-left min-w-[760px]">
                          <thead>
                              <tr className="bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-gray-800">
                                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest table-sticky-left">User Profile</th>
                                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right table-sticky-right">Actions</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                              {(() => {
                                  // 1. Initial filter for Search, Role, and Archive status
                                  const filtered = users.filter(u => {
                                      const matchesSearch = !userSearch || 
                                          (u.name || '').toLowerCase().includes(userSearch.toLowerCase()) || 
                                          (u.email || '').toLowerCase().includes(userSearch.toLowerCase());
                                      const matchesRole = !userRoleFilter || (u.roleIds || [u.role]).includes(userRoleFilter);
                                      const matchesStatus = !userStatusFilter || (userStatusFilter === 'APPROVED' ? u.status === 'APPROVED' : userStatusFilter === 'PENDING_INVITED' ? (u.status === 'PENDING_APPROVAL' && u.invitedAt) : userStatusFilter === 'PENDING_NOT_INVITED' ? (u.status === 'PENDING_APPROVAL' && !u.invitedAt) : userStatusFilter === 'ARCHIVED' ? u.status === 'ARCHIVED' : true);
                                      const notArchived = userStatusFilter === 'ARCHIVED' ? true : u.status !== 'ARCHIVED';
                                      return matchesSearch && matchesRole && matchesStatus && notArchived;
                                  });

                                  // 2. Safety Deduplication by email (case-insensitive)
                                  // This handles any temporary client-side duplicates before reloadData() completes
                                  const uniqueByEmail = new Map<string, typeof users[0]>();
                                  filtered.forEach(u => {
                                      const emailKey = (u.email || '').toLowerCase();
                                      // If duplicate, keep the one with higher privilege or approved status
                                      const existing = uniqueByEmail.get(emailKey);
                                      if (!existing || (u.status === 'APPROVED' && existing.status !== 'APPROVED')) {
                                          uniqueByEmail.set(emailKey, u);
                                      }
                                  });

                                  const displayUsers = Array.from(uniqueByEmail.values());

                                  if (displayUsers.length === 0) return null;

                                  return displayUsers.map(user => (
                                      <tr key={user.id} className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
                                          <td className="px-6 py-4 table-sticky-left">
                                               <div className="flex items-center gap-4">
                                                  <div className="relative shrink-0">
                                                      <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white dark:border-[#1e2029] shadow-md group-hover:scale-105 transition-transform">
                                                        <img src={user.avatar} className="w-full h-full object-cover bg-gray-100 dark:bg-gray-800" alt={user.name}/>
                                                      </div>
                                                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-white dark:border-[#1e2029] ${user.status === 'APPROVED' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : user.status === 'PENDING_APPROVAL' && user.invitedAt ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]'}`}></div>
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                     <div className="font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none mb-1">{user.name || (user.email ? user.email.split('@')[0] : 'Unknown User')}</div>
                                                     <div className="text-xs text-gray-500 font-medium">{user.email || 'No Email'}</div>
                                                      <div className="flex flex-wrap gap-1 mt-2">
                                                        {(user.roleIds || [user.role]).map(roleId => (
                                                            <span key={roleId} className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${roleId === 'ADMIN' ? 'bg-purple-100 text-purple-600' : 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]'}`}>
                                                                {roles.find(r => r.id === roleId)?.name || roleId}
                                                            </span>
                                                        ))}
                                                        {user.siteIds && user.siteIds.map(sid => {
                                                            const s = sites.find(x => x.id === sid);
                                                            return s ? <span key={sid} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-[9px] font-bold rounded text-gray-500 uppercase">{s.name}</span> : null;
                                                        })}
                                                        {user.status === 'PENDING_APPROVAL' && user.invitationExpiresAt && (() => {
                                                            const expiryInfo = getTimeUntilExpiry(user.invitationExpiresAt);
                                                            return (
                                                                <div className={`inline-flex items-center gap-1.5 border rounded-lg px-2 py-0.5 ${
                                                                    expiryInfo.isExpired
                                                                        ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/50 text-red-600'
                                                                        : expiryInfo.isExpiringSoon
                                                                        ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/50 text-amber-600 animate-pulse'
                                                                        : 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/50 text-blue-600'
                                                                }`}>
                                                                    <Clock size={10} />
                                                                    <p className="text-[9px] font-black uppercase tracking-tight">
                                                                        {expiryInfo.displayText}
                                                                    </p>
                                                                </div>
                                                            );
                                                        })()}
                                                      </div>
                                                  </div>
                                               </div>
                                          </td>
                                          <td className="px-6 py-4 text-right table-sticky-right">
                                              <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                  <button type="button" 
                                                    onClick={() => {
                                                        setInviteForm({
                                                            id: user.id,
                                                            name: user.name,
                                                            email: user.email,
                                                            jobTitle: user.jobTitle || '',
                                                            role: user.role,
                                                            roleIds: user.roleIds || [user.role],
                                                            siteIds: user.siteIds || []
                                                        });
                                                        setInviteStep(2);
                                                        setIsDirectoryModalOpen(true);
                                                    }}
                                                    className="h-9 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-[var(--color-brand)] hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-2"
                                                  >
                                                    <Shield size={14}/> Manage
                                                  </button>

                                                  {currentUser?.id !== user.id && (
                                                      <div className="flex items-center gap-1">
                                                        {user.status === 'PENDING_APPROVAL' && (
                                                            <button 
                                                                type="button"
                                                                onClick={async () => {
                                                                    if (!confirm(`Resend invitation to ${user.name} (${user.email})?\\n\\nThis will generate a new invitation link valid for 48 hours.`)) {
                                                                        return;
                                                                    }
                                                                    
                                                                    setResendingUserId(user.id);
                                                                    try {
                                                                         const result = await resendWelcomeEmail(user.email, user.name, user.siteIds?.[0]);
                                                                        if (result) {
                                                                            success(`Invitation sent to ${user.name}`, 4000);
                                                                            await reloadData();
                                                                        } else {
                                                                            error('Failed to send invitation. Please try again.', 5000);
                                                                        }
                                                                    } catch (err) {
                                                                        error('An error occurred while sending the invitation.', 5000);
                                                                        console.error('Resend error:', err);
                                                                    } finally {
                                                                        setResendingUserId(null);
                                                                    }
                                                                }}
                                                                disabled={resendingUserId === user.id}
                                                                className="w-9 h-9 flex items-center justify-center text-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all border border-transparent hover:border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                title="Resend Welcome Email"
                                                            >
                                                                {resendingUserId === user.id ? (
                                                                    <Loader2 size={16} className="animate-spin" />
                                                                ) : (
                                                                    <Mail size={16}/>
                                                                )}
                                                            </button>
                                                        )}

                                                      </div>
                                                  )}
                                                  <button type="button" 
                                                    onClick={() => {
                                                      if (globalThis.confirm(`Are you sure you want to archive ${user.name}?`)) {
                                                        archiveUser(user.id);
                                                      }
                                                    }} 
                                                    className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all border border-transparent hover:border-red-200 dark:hover:border-red-800"
                                                    title="Archive"
                                                  >
                                                    <Archive size={16}/>
                                                  </button>
                                              </div>
                                          </td>
                                      </tr>
                                  ));
                              })() || (
                                  <tr><td colSpan={2} className="px-6 py-20 text-center text-gray-400">
                                      <div className="flex flex-col items-center gap-3">
                                          <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center">
                                              <Search size={32} className="opacity-10"/>
                                          </div>
                                          <p className="font-bold text-sm tracking-tight text-gray-300">No users matched your search.</p>
                                      </div>
                                  </td></tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}
      {activeTab === 'SECURITY' && (
          <div className="animate-fade-in space-y-6">
              {/* Security Dashboard Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-nocturne p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-4 group hover:border-purple-400 transition-all">
                      <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/20 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Shield size={24}/>
                      </div>
                      <div>
                          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Security Roles</div>
                          <div className="text-2xl font-black text-gray-900 dark:text-white line-height-1">
                              {roles.length}
                          </div>
                      </div>
                  </div>

                  <div className="bg-white dark:bg-nocturne p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-4 group hover:border-blue-400 transition-all">
                      <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Globe size={24}/>
                      </div>
                      <div>
                          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Sites Protected</div>
                          <div className="text-2xl font-black text-gray-900 dark:text-white line-height-1">
                              {sites.length}
                          </div>
                      </div>
                  </div>
              </div>


              <div className="flex flex-col md:flex-row gap-6 h-auto md:h-[calc(100vh-200px)] min-h-[600px]">

              {/* Sidebar: Roles List */}
              <div className="w-full md:w-80 flex-shrink-0 bg-white dark:bg-nocturne rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden max-h-[400px] md:max-h-none">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Security Roles</h3>
                      <button type="button" onClick={() => { setActiveRole(null); setIsRoleEditorOpen(true); }} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-[var(--color-brand)] transition-all active:scale-95 shadow-sm bg-white dark:bg-[#15171e] border border-gray-100 dark:border-gray-800"><Plus size={18}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
                      
                      <div className="pt-4 px-4 pb-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Security Roles</div>
                      
                      <div className="space-y-1">
                          {roles.map(role => (
                              <button type="button"
                                  key={role.id}
                                  onClick={() => { setActiveRole(role); setUserSearch(''); }}
                                  className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3 transition-all ${activeRole?.id === role.id ? 'bg-[var(--color-brand)] text-white shadow-lg shadow-[var(--color-brand)]/20 scale-[1.02]' : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 group'}`}
                              >
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${activeRole?.id === role.id ? 'bg-white/20 text-white' : role.id === 'ADMIN' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 group-hover:bg-purple-100' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 group-hover:bg-blue-100'}`}>
                                      <Shield size={18}/>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                  <div className="font-bold text-sm truncate tracking-tight">{role.name}</div>
                                      <div className={`text-[10px] font-bold ${activeRole?.id === role.id ? 'text-white/80' : 'text-gray-400'}`}>{users.filter(u => (u.roleIds || [u.role]).includes(role.id) && u.status !== 'ARCHIVED').length} members</div>
                                  </div>
                                  {activeRole?.id !== role.id && <ChevronRight size={14} className="text-gray-300 dark:text-gray-700 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"/>}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>

              {/* Main Content: Role Details */}
              <div className="flex-1 bg-white dark:bg-nocturne rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
                  {activeRole && activeRole.id !== 'ALL' && activeRole.id !== 'PENDING_TAB' ? (
                      <>
                          {/* Header */}
                          <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start">
                              <div>
                                  <div className="flex items-center gap-3 mb-1">
                                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{activeRole.name}</h2>
                                      {activeRole.isSystem && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 dark:bg-gray-800 text-gray-500">System Role</span>}
                                  </div>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">{activeRole.description}</p>
                              </div>
                              {!activeRole.isSystem && (
                                  <button type="button" onClick={() => deleteRole(activeRole.id)} className="btn-secondary text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 text-xs flex items-center gap-2">
                                      <Trash2 size={14}/> Delete Role
                                  </button>
                              )}
                          </div>

                          {/* Main Content Body */}
                          <div className="flex-1 overflow-y-auto custom-scrollbar">
                                  <div className="p-6 space-y-8">
                                      {activeRole.id !== 'ALL' && (
                                          <RoleTreeManager 
                                              activeRole={activeRole}
                                              saveStatus={roleSaveStatus}
                                              onUpdatePermissions={async (newPerms) => {
                                                  const updatedRole = { ...activeRole, permissions: newPerms };
                                                  setRoleSaveStatus('saving');
                                                  try {
                                                      await updateRole(updatedRole);
                                                      setRoleSaveStatus('saved');
                                                      setActiveRole(updatedRole);
                                                      setTimeout(() => setRoleSaveStatus('idle'), 3000);
                                                  } catch (e) {
                                                      console.error("Failed to save role", e);
                                                      setRoleSaveStatus('idle');
                                                  }
                                              }}
                                          />
                                      )}

                                  </div>
                              </div>
                          </>
                      ) : (
                          <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
                              <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center">
                                  <Shield size={40} className="opacity-20"/>
                              </div>
                              <div>
                                  <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center">Select a Role</h3>
                                  <p className="text-sm">Select a role from the sidebar to configure permissions and view users.</p>
                              </div>
                              <button type="button" onClick={() => { setActiveRole(null); setIsRoleEditorOpen(true); }} className="btn-primary">Create New Role</button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
      {activeTab === 'NOTIFICATIONS' && (
          <div className="animate-fade-in space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600 dark:text-blue-400"><Bell size={20}/></div>
                      <div>
                          <h3 className="font-bold text-gray-900 dark:text-white">Notification Rules</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Configure automated alerts and recipients.</p>
                      </div>
                  </div>
                   <button type="button" onClick={() => setIsTeamsConfigOpen(true)} className="btn-secondary flex items-center gap-2 text-xs">
                        {teamsWebhookUrl ? <CheckCircle2 size={12} className="text-green-500"/> : <AlertCircle size={12} className="text-orange-500"/>}
                        Configure Teams
                   </button>
              </div>

              <div className="table-shell bg-white dark:bg-nocturne rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800">
                  <table className="dense-admin-table text-gray-500 dark:text-gray-400 min-w-[900px]">
                      <thead className="table-header">
                          <tr>
                              <th className="px-6 py-4 w-1/4 table-sticky-left">Event</th>
                              <th className="px-6 py-4">Recipients</th>
                              <th className="px-6 py-4 text-center">Status</th>
                              <th className="px-6 py-4 text-right table-sticky-right">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                          {notificationRules.map(rule => (
                              <tr key={rule.id} className="table-row">
                                  <td className="px-6 py-4 table-sticky-left">
                                      <div className="flex items-center gap-3">
                                          <div className={`p-2 rounded-lg ${rule.isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-gray-100 text-gray-400 dark:bg-white/5'}`}>
                                              <Bell size={18}/>
                                          </div>
                                          <div>
                                              <div className="font-bold text-gray-900 dark:text-white">{rule.label}</div>
                                              <code className="text-[10px] text-gray-400 px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">{rule.eventType}</code>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4">
                                      <div className="flex flex-wrap gap-1.5 is-truncated max-w-md">
                                          {rule.recipients.length > 0 ? rule.recipients.map((r, idx) => (
                                              <span key={idx} className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded text-xs border border-gray-200 dark:border-gray-700">
                                                  {r.type === 'ROLE' && <Shield size={10} className="text-purple-500"/>}
                                                  {r.type === 'USER' && <User size={10} className="text-blue-500"/>}
                                                  {r.type === 'EMAIL' && <Mail size={10} className="text-green-500"/>}
                                                  {r.type === 'REQUESTER' && <User size={10} className="text-orange-500"/>}
                                                  
                                                  <span className="font-medium">
                                                      {r.type === 'ROLE' ? (roles.find(x => x.id === r.id)?.name || r.id) : 
                                                       r.type === 'USER' ? (users.find(x => x.id === r.id)?.name || 'Unknown User') :
                                                       r.type === 'REQUESTER' ? 'Requester' : r.id}
                                                  </span>

                                                  <div className="flex gap-0.5 pl-1 border-l border-gray-300 dark:border-gray-600 ml-1">
                                                      {r.channels.email && <MailIcon size={10} className="text-blue-400"/>}
                                                      {r.channels.inApp && <Bell size={10} className="text-amber-400"/>}
                                                      {r.channels.teams && <ArrowDown size={10} className="text-indigo-400"/>}
                                                  </div>
                                              </span>
                                          )) : <span className="text-gray-400 text-xs italic">No recipients configured</span>}
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      <button type="button" 
                                          onClick={() => handleToggleActive(rule)}
                                          className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase transition-colors ${rule.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}
                                      >
                                          {rule.isActive ? 'Active' : 'Disabled'}
                                      </button>
                                  </td>
                                  <td className="px-6 py-4 text-right table-sticky-right">
                                      <button type="button" onClick={() => openRuleConfig(rule)} className="text-sm font-bold text-[var(--color-brand)] hover:underline">Configure</button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>

              {/* Rule Configuration Modal */}
              {isRuleModalOpen && editingRule && (
                 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-nocturne rounded-2xl shadow-xl w-[95%] max-w-4xl p-0 overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-white/5">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <SettingsIcon size={20} className="text-[var(--color-brand)]"/>
                                    Configure Notification
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">Rule: <span className="font-bold text-gray-700 dark:text-gray-300">{editingRule.label}</span></p>
                            </div>
                            <button type="button" onClick={() => setIsRuleModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                        </div>
                        
                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            
                            {/* Recipients List */}
                            <div>
                                <div className="flex justify-between items-end mb-3">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Recipients</h3>
                                    
                                    {/* Add Recipient Dropdown */}
                                    <div className="relative group">
                                        <button type="button" className="btn-secondary text-xs flex items-center gap-1 py-1.5"><Plus size={14}/> Add Recipient</button>
                                        <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#15171e] rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 p-2 hidden group-hover:block z-50">
                                            <div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase">Dynamic</div>
                                            <button type="button" 
                                                onClick={() => setEditingRule({ ...editingRule, recipients: [...editingRule.recipients, { type: 'REQUESTER', id: 'requester', channels: { email: true, inApp: true, teams: false } }] })}
                                                className="w-full text-left px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                            >
                                                <User size={12} className="text-orange-500"/> Requester
                                            </button>

                                            <div className="border-t border-gray-100 dark:border-gray-800 my-1"></div>
                                            <div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase">Roles</div>
                                            {roles.map(r => (
                                                <button type="button" 
                                                    key={r.id}
                                                    onClick={() => setEditingRule({ ...editingRule, recipients: [...editingRule.recipients, { type: 'ROLE', id: r.id, channels: { email: true, inApp: true, teams: false } }] })}
                                                    className="w-full text-left px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                                >
                                                    <Shield size={12} className="text-purple-500"/> {r.name}
                                                </button>
                                            ))}
                                            
                                            <div className="border-t border-gray-100 dark:border-gray-800 my-1"></div>
                                            <button type="button" 
                                                 onClick={() => {
                                                     const email = prompt("Enter email address:");
                                                     if (email) {
                                                         setEditingRule({ ...editingRule, recipients: [...editingRule.recipients, { type: 'EMAIL', id: email, channels: { email: true, inApp: false, teams: false } }] });
                                                     }
                                                 }}
                                                 className="w-full text-left px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                            >
                                                <Mail size={12} className="text-green-500"/> Custom Email
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {editingRule.recipients.length === 0 ? (
                                        <div className="text-center py-8 bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400 text-sm">
                                            No recipients added. No notifications will be sent.
                                        </div>
                                    ) : (
                                        editingRule.recipients.map((r, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-gray-500 shadow-sm">
                                                        {r.type === 'ROLE' && <Shield size={18} className="text-purple-500"/>}
                                                        {r.type === 'USER' && <User size={18} className="text-blue-500"/>}
                                                        {r.type === 'EMAIL' && <Mail size={18} className="text-green-500"/>}
                                                        {r.type === 'REQUESTER' && <User size={18} className="text-orange-500"/>}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-900 dark:text-white">
                                                            {r.type === 'ROLE' ? (roles.find(x => x.id === r.id)?.name || r.id) : 
                                                             r.type === 'USER' ? (users.find(x => x.id === r.id)?.name || 'Unknown User') :
                                                             r.type === 'REQUESTER' ? 'Event Requester' : r.id}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {r.type === 'ROLE' ? 'All users with this role' : 
                                                             r.type === 'REQUESTER' ? 'User who initiated action' : 
                                                             'Specific Recipient'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-6">
                                                    <div className="flex gap-2">
                                                        <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-colors border ${r.channels.email ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-gray-700 text-gray-400'}`}>
                                                            <input 
                                                                type="checkbox" 
                                                                className="sr-only" 
                                                                checked={r.channels.email} 
                                                                onChange={() => {
                                                                    const newRecipients = [...editingRule.recipients];
                                                                    newRecipients[idx].channels.email = !newRecipients[idx].channels.email;
                                                                    setEditingRule({ ...editingRule, recipients: newRecipients });
                                                                }}
                                                            />
                                                            <Mail size={14}/> <span className="text-xs font-bold">Email</span>
                                                        </label>

                                                        <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-colors border ${r.channels.inApp ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-300' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-gray-700 text-gray-400'}`}>
                                                            <input 
                                                                type="checkbox" 
                                                                className="sr-only" 
                                                                checked={r.channels.inApp} 
                                                                onChange={() => {
                                                                    const newRecipients = [...editingRule.recipients];
                                                                    newRecipients[idx].channels.inApp = !newRecipients[idx].channels.inApp;
                                                                    setEditingRule({ ...editingRule, recipients: newRecipients });
                                                                }}
                                                            />
                                                            <Bell size={14}/> <span className="text-xs font-bold">In-App</span>
                                                        </label>

                                                        <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-colors border ${r.channels.teams ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-gray-700 text-gray-400'}`}>
                                                            <input 
                                                                type="checkbox" 
                                                                className="sr-only" 
                                                                checked={r.channels.teams} 
                                                                onChange={() => {
                                                                    const newRecipients = [...editingRule.recipients];
                                                                    newRecipients[idx].channels.teams = !newRecipients[idx].channels.teams;
                                                                    setEditingRule({ ...editingRule, recipients: newRecipients });
                                                                }}
                                                            />
                                                            <ArrowDown size={14}/> <span className="text-xs font-bold">Teams</span>
                                                        </label>
                                                    </div>

                                                    <button type="button" 
                                                        onClick={() => {
                                                            const newRecipients = editingRule.recipients.filter((_, i) => i !== idx);
                                                            setEditingRule({ ...editingRule, recipients: newRecipients });
                                                        }}
                                                        className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg"
                                                    >
                                                        <Trash2 size={16}/>
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-white/5 flex justify-end gap-3">
                            <button type="button" onClick={() => setIsRuleModalOpen(false)} className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-colors">Cancel</button>
                            <button type="button" onClick={handleSaveRule} className="btn-primary px-8 flex items-center gap-2">
                                <Save size={18}/> Save Changes
                            </button>
                        </div>
                    </div>
                 </div>
              )}

              {isTeamsConfigOpen && (
                 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-nocturne rounded-2xl shadow-xl w-[95%] max-w-md p-6 animate-slide-up">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">Microsoft Teams Configuration</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Incoming Webhook URL</label>
                                <input 
                                    className="input-field mt-1" 
                                    placeholder="https://outlook.office.com/webhook/..."
                                    value={teamsUrlForm}
                                    onChange={e => setTeamsUrlForm(e.target.value)}
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Paste the URL from your Teams Channel Connectors.</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-6">
                            <button type="button" onClick={() => setIsTeamsConfigOpen(false)} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button type="button" onClick={() => { updateTeamsWebhook(teamsUrlForm); setIsTeamsConfigOpen(false); }} className="btn-primary">Save Configuration</button>
                        </div>
                    </div>
                 </div>
              )}
          </div>
      )}
      {activeTab === 'MIGRATION' && (
          <div className="animate-fade-in max-w-4xl mx-auto">
              <AdminMigration />

          </div>
      )}
      

      

      

      <style>{`
        .input-field { @apply w-full bg-white dark:bg-[#15171e] border border-gray-300 dark:border-gray-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)] outline-none transition-all; }
        .btn-primary { @apply bg-[var(--color-brand)] text-white px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity font-bold shadow-lg shadow-[var(--color-brand)]/20 active:scale-95; }
        .btn-secondary { @apply px-4 py-2.5 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors; }
        .table-shell { @apply overflow-x-auto relative; }
        .dense-admin-table { @apply w-full text-left text-xs md:text-sm; }
        .table-header { @apply bg-gray-50 dark:bg-[#15171e] text-xs uppercase text-gray-500 font-bold border-b border-gray-200 dark:border-gray-800; }
        .table-row { @apply hover:bg-gray-50 dark:hover:bg-[#2b2d3b] transition-colors border-b border-100 dark:border-gray-800 last:border-0; }
        .badge { @apply inline-block bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-xs px-2.5 py-1 rounded-full font-medium border border-gray-200 dark:border-gray-700; }
        .icon-btn-blue { @apply p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors; }
        .icon-btn-red { @apply p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors; }
        .table-sticky-right { position: sticky; right: 0; z-index: 15; background: #ffffff; box-shadow: -12px 0 12px -12px rgba(15, 23, 42, 0.35); }
        .table-sticky-left { position: sticky; left: 0; z-index: 15; background: #ffffff; box-shadow: 12px 0 12px -12px rgba(15, 23, 42, 0.3); }
        .dark .table-sticky-right, .dark .table-sticky-left { background: #1e2029; }
        thead .table-sticky-right, thead .table-sticky-left { background: #f9fafb; }
        .dark thead .table-sticky-right, .dark thead .table-sticky-left { background: #15171e; }
      `}</style>
             {notMappedTarget && (
                 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-nocturne rounded-2xl shadow-xl w-[95%] max-w-md p-6 animate-slide-up">
                        <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Mark Supplier Item as Not Mapped</h2>
                        <p className="text-sm text-secondary dark:text-gray-400">
                            Use this when the supplier row should not be connected to an internal item, such as discontinued stock or items not required for ordering.
                        </p>
                        <div className="mt-5 space-y-4">
                            <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-gray-800">
                                <div className="text-xs text-gray-500 uppercase font-bold">Supplier SKU</div>
                                <div className="font-mono font-bold text-gray-900 dark:text-white">{notMappedTarget.supplierSku}</div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Reason</label>
                                <select
                                    className="input-field mt-1"
                                    value={notMappedReason}
                                    onChange={(event) => setNotMappedReason(event.target.value)}
                                >
                                    <option value="No longer required">No longer required</option>
                                    <option value="Out of stock / unavailable">Out of stock / unavailable</option>
                                    <option value="Discontinued by supplier">Discontinued by supplier</option>
                                    <option value="Supplier-only reference row">Supplier-only reference row</option>
                                    <option value="Duplicate supplier row">Duplicate supplier row</option>
                                    <option value="Not used by this business">Not used by this business</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setNotMappedTarget(null)} className="btn-secondary">Cancel</button>
                                <button type="button" onClick={markMappingNotMapped} className="btn-primary">Save as Not Mapped</button>
                            </div>
                        </div>
                    </div>
                 </div>
             )}
                 {/* Manual Mapping Modal */}
             {isManualMapOpen && mappingSource && (
                 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-nocturne rounded-2xl shadow-xl w-[95%] max-w-lg p-6 animate-slide-up">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Map Item Manually</h2>
                        <div className="space-y-4">
                            <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-gray-800">
                                <div className="text-xs text-gray-500 uppercase font-bold">Supplier Item</div>
                                <div className="font-bold text-gray-900 dark:text-white">{mappingSource.productName}</div>
                                <div className="text-sm font-mono text-gray-400">{mappingSource.supplierSku} (Ref: {mappingSource.customerStockCode})</div>
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Search Internal Master Item</label>
                                <div className="relative mt-1">
                                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                                    <input 
                                        className="input-field pl-9" 
                                        placeholder="Search by name or SKU..." 
                                        value={itemSearch}
                                        onChange={e => setItemSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                                      {items.filter(i => (i.name || '').toLowerCase().includes(itemSearch.toLowerCase()) || (i.sku || '').toLowerCase().includes(itemSearch.toLowerCase())).slice(0, 10).map(i => (
                                          <button type="button"
                                              key={i.id}
                                              onClick={() => {
                                                const existingMapping = mappings.find(m => m.supplierId === mappingSource.supplierId && m.supplierSku === mappingSource.supplierSku);
                                                updateMapping({
                                                    id: existingMapping?.id || uuidv4(),
                                                    supplierId: mappingSource.supplierId,
                                                    supplierSku: mappingSource.supplierSku,
                                                    productId: i.id,
                                                    matchPriority: existingMapping?.matchPriority || 100,
                                                    packConversionFactor: existingMapping?.packConversionFactor || 1,
                                                    mappingStatus: 'CONFIRMED',
                                                    mappingMethod: 'MANUAL',
                                                    confidenceScore: 1.0,
                                                    manualOverride: true,
                                                    supplierCustomerStockCode: mappingSource.customerStockCode,
                                                    mappingJustification: {
                                                        components: [{ type: 'ADMIN_CONFIRMED', score: 1, detail: 'Manually selected and saved to supplier mapping memory' }]
                                                    },
                                                } as any).then(() => {
                                                    setIsManualMapOpen(false);
                                                    setMappingSource(null);
                                                    setItemSearch('');
                                                });
                                            }}
                                            className="w-full text-left p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-gray-100 dark:border-gray-800 last:border-0 flex justify-between items-center group"
                                        >
                                            <div>
                                                <div className="font-bold text-sm text-gray-900 dark:text-gray-100">{i.name}</div>
                                                <div className="text-xs text-gray-400 font-mono">{i.sku}</div>
                                                <div className="text-[10px] text-gray-400">{i.category}</div>
                                            </div>
                                            <div className="opacity-0 group-hover:opacity-100 text-blue-600 text-xs font-bold">Select</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button type="button" onClick={() => { setIsManualMapOpen(false); setMappingSource(null); }} className="text-gray-500 hover:text-gray-700 font-bold text-sm">Cancel</button>
                            </div>
                        </div>
                    </div>
                 </div>
             )}
    
             {/* Ingestion Success Stats Modal */}
             {ingestionStats && ingestionStats.open && (
                 <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                     <div className="bg-white dark:bg-nocturne rounded-2xl shadow-2xl w-[95%] max-w-md p-6 border border-gray-150 dark:border-gray-800 animate-slide-up">
                         <div className="text-center">
                             <div className="inline-flex p-3 bg-green-50 dark:bg-green-950/20 text-green-600 rounded-full mb-4">
                                 <CheckCircle2 size={36} />
                             </div>
                             <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                 Ingestion & Auto-Mapping Successful!
                             </h3>
                             <p className="text-xs text-secondary dark:text-gray-400 mt-1">
                                 Supplier records have been successfully mapped and registered.
                             </p>
                         </div>

                         <div className="mt-5 space-y-3 bg-gray-50 dark:bg-gray-905/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 text-xs">
                             <div className="flex justify-between font-medium">
                                 <span className="text-secondary dark:text-gray-400">Supplier Name:</span>
                                 <span className="font-bold text-primary dark:text-white">{ingestionStats.supplierName}</span>
                             </div>
                             <div className="flex justify-between">
                                 <span className="text-secondary dark:text-gray-400">Records Imported:</span>
                                 <span className="font-mono font-bold text-primary dark:text-white">{ingestionStats.recordsImported}</span>
                             </div>
                             <div className="flex justify-between">
                                 <span className="text-secondary dark:text-gray-400">Auto-Confirmed Matches:</span>
                                 <span className="font-mono font-bold text-green-600 dark:text-green-400">+{ingestionStats.confirmedMatches}</span>
                             </div>
                             <div className="flex justify-between">
                                 <span className="text-secondary dark:text-gray-400">Proposed Matches (Needs Review):</span>
                                 <span className="font-mono font-bold text-yellow-600 dark:text-yellow-400 font-bold">+{ingestionStats.proposedMatches}</span>
                             </div>
                             <div className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-2.5">
                                 <span className="text-secondary dark:text-gray-400">Item Prices Synchronized:</span>
                                 <span className="font-bold text-purple-600 dark:text-purple-400">Yes (Auto-Sync)</span>
                             </div>
                         </div>

                         <div className="mt-6 flex justify-end">
                             <button
                                 type="button"
                                 onClick={() => {
                                     setIngestionStats(null);
                                     setMappingSubTab('PROPOSED');
                                 }}
                                 className="w-full bg-[var(--color-brand)] text-white py-2.5 rounded-xl font-bold text-xs hover:opacity-90 transition-all"
                             >
                                 Close & Review Proposed Mappings
                             </button>
                         </div>
                     </div>
                 </div>
             )}
    
             {/* Email Templates Tab */}
             {activeTab === 'EMAIL' && (
                 <div className="space-y-6 animate-fade-in">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Email Templates</h2>
                              <p className="text-sm text-gray-500">Customize the welcome email sent to new users.</p>
                          </div>
                           <div className="flex gap-3">
                               <button type="button" onClick={handleTestEmail} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-colors">
                                   Send Test Email
                               </button>
                              <button type="button" onClick={handleSaveEmailTemplate} className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg hover:opacity-90 font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2">
                                  <Save size={18} /> Save Changes
                              </button>
                          </div>
                      </div>

                      <div className="bg-white dark:bg-nocturne rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 space-y-6">


                           <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                    <Mail size={16} className="text-gray-400"/> System Sender (From)
                                </label>
                                <input 
                                   className="input-field w-full font-medium"
                                   value={senderEmail}
                                   onChange={(e) => setSenderEmail(e.target.value)}
                                   placeholder="aaron.bell@splservices.com.au"
                                />
                                <p className="text-xs text-gray-500 mt-2 flex items-start gap-1">
                                    <AlertCircle size={12} className="mt-0.5 shrink-0"/>
                                    <span>This email must be a valid mailbox in your Azure tenant with <code>Mail.Send</code> permissions.</span>
                                </p>
                            </div>
                           <div>
                               <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Email Subject</label>
                               <input 
                                  className="input-field w-full font-medium"
                                  value={emailSubject}
                                  onChange={(e) => setEmailSubject(e.target.value)}
                                  placeholder="Welcome to MercerFlow"
                               />
                           </div>

                           <div>
                               <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Email Body (HTML)</label>
                                <div className="text-xs text-gray-500 mb-2">
                                    Supported Placeholders: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{name}'}</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{app_name}'}</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{link}'}</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{invited_by_name}'}</code>
                                </div>
                               <textarea 
                                  className="input-field w-full font-mono text-sm min-h-[300px]"
                                  value={emailBody}
                                  onChange={(e) => setEmailBody(e.target.value)}
                                  placeholder="<html>...</html>"
                               />
                           </div>
                           
                           <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-lg p-4">
                               <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2 text-sm">Preview</h4>
                                <div className="bg-white p-4 rounded border border-gray-200 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ 
                                    __html: emailBody
                                     .replace(/{name}/g, 'John Doe')
                                     .replace(/{app_name}/g, branding.appName)
                                     .replace(/{link}/g, '<a href="#">http://example.com</a>')
                                     .replace(/{invited_by_name}/g, currentUser?.name || 'Admin')
                                 }}></div>
                            </div>
                       </div>
                  </div>
              )}
             {/* System Audit Tab */}
             {activeTab === 'AUDIT' && (
                 <div className="animate-fade-in">
                     <AuditLogViewer />
                 </div>
             )}
             {activeTab === 'DATA_SYNC' && (
                 <div className="animate-fade-in">
                     <DataSyncPanel />
                 </div>
             )}
             {activeTab === 'SMART_BUYING' && (
                 <div className="animate-fade-in">
                     <SmartBuyingSettings />
                 </div>
             )}
             {activeTab === 'ITEM_CREATION' && (
                 <div className="animate-fade-in">
                     <ItemCreationSettings />
                 </div>
             )}
             {/* WORKFLOW STEP MODAL */}
             {editingStepId && (() => {
                 const step = workflowSteps.find(s => s.id === editingStepId);
                 if (!step) return null;
                 return (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white dark:bg-nocturne rounded-2xl shadow-xl w-[95%] max-w-2xl p-0 overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
                            
                            {/* Header */}
                            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-white/5">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center font-bold text-sm">
                                           {step.order < 1 ? '1' : Math.floor(step.order)}
                                        </div>
                                        Edit Workflow Step
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1">Configure logic, notifications, and SLAs.</p>
                                </div>
                                <button type="button" onClick={() => setEditingStepId(null)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-gray-100 dark:border-gray-800 px-6 gap-6">
                                <button type="button" onClick={() => setActiveStepTab('GENERAL')} className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeStepTab === 'GENERAL' ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>General</button>
                                <button type="button" onClick={() => setActiveStepTab('NOTIFICATIONS')} className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeStepTab === 'NOTIFICATIONS' ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Notifications {(step.notifications?.length || 0) > 0 && <span className="ml-1 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full text-[10px]">{step.notifications?.length}</span>}</button>
                                <button type="button" onClick={() => setActiveStepTab('SLA')} className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeStepTab === 'SLA' ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>SLA {step.sla?.warnAfterHours && <span className="ml-1 text-[var(--color-brand)]">•</span>}</button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {activeStepTab === 'GENERAL' && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase">Step Name</label>
                                            <input 
                                                className="input-field mt-1" 
                                                value={step.stepName}
                                                onChange={e => updateWorkflowStep({ ...step, stepName: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase">Approver Assignment {/* Select User or Role */}</label>
                                            <div className="flex bg-gray-100 dark:bg-[#15171e] p-1 rounded-lg mt-1 mb-2">
                                                <button type="button" 
                                                    onClick={() => updateWorkflowStep({ ...step, approverType: 'ROLE', approverId: roles[0]?.id || '' })}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded-md transition-all ${step.approverType !== 'USER' ? 'bg-white dark:bg-[#2b2d3b] text-[var(--color-brand)] shadow-sm' : 'text-gray-500'}`}
                                                >
                                                    <Shield size={12}/> Role
                                                </button>
                                                <button type="button" 
                                                    onClick={() => updateWorkflowStep({ ...step, approverType: 'USER', approverId: users.filter(u => u.status === 'APPROVED')[0]?.id || '' })}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded-md transition-all ${step.approverType === 'USER' ? 'bg-white dark:bg-[#2b2d3b] text-[var(--color-brand)] shadow-sm' : 'text-gray-500'}`}
                                                >
                                                    <User size={12}/> Specific User
                                                </button>
                                            </div>
                                            
                                            {step.approverType === 'USER' ? (
                                                <select 
                                                    className="input-field"
                                                    value={step.approverId}
                                                    onChange={e => updateWorkflowStep({ ...step, approverId: e.target.value })}
                                                >
                                                    {users.filter(u => u.status === 'APPROVED').map(u => (
                                                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <select 
                                                    className="input-field"
                                                    value={step.approverId || step.approverRole}
                                                    onChange={e => updateWorkflowStep({ ...step, approverId: e.target.value, approverRole: e.target.value })}
                                                >
                                                    {roles.map(r => (
                                                        <option key={r.id} value={r.id}>{r.name}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">Condition</label>
                                                <select 
                                                    className="input-field mt-1"
                                                    value={step.conditionType}
                                                    onChange={e => updateWorkflowStep({ ...step, conditionType: e.target.value as any })}
                                                >
                                                    <option value="ALWAYS">Always Required</option>
                                                    <option value="AMOUNT_GT">If Amount &gt;</option>
                                                </select>
                                            </div>
                                            {step.conditionType === 'AMOUNT_GT' && (
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Threshold ($)</label>
                                                    <input 
                                                        type="number"
                                                        className="input-field mt-1"
                                                        value={step.conditionValue || 0}
                                                        onChange={e => updateWorkflowStep({ ...step, conditionValue: parseInt(e.target.value) })}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={step.isActive}
                                                    onChange={e => updateWorkflowStep({ ...step, isActive: e.target.checked })}
                                                    className="rounded text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                                                />
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Step is Active</span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {activeStepTab === 'NOTIFICATIONS' && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Embedded Notification Rules</h3>
                                            <button type="button" 
                                                onClick={() => {
                                                    const newRule = {
                                                        trigger: 'ON_ENTRY',
                                                        recipientType: 'APPROVER',
                                                        channels: { email: true, inApp: true, teams: false }
                                                    };
                                                    updateWorkflowStep({ 
                                                        ...step, 
                                                        notifications: [...(step.notifications || []), newRule as any] 
                                                    });
                                                }}
                                                className="btn-secondary text-xs py-1.5 flex items-center gap-1"
                                            >
                                                <Plus size={14}/> Add Rule
                                            </button>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            {(step.notifications || []).length === 0 && (
                                                <div className="text-center py-8 bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400 text-sm">
                                                    No notifications configured for this step.
                                                </div>
                                            )}
                                            {(step.notifications || []).map((rule, idx) => (
                                                <div key={idx} className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-gray-800 relative group">
                                                    <button type="button" 
                                                        onClick={() => {
                                                            const newRules = step.notifications!.filter((_, i) => i !== idx);
                                                            updateWorkflowStep({ ...step, notifications: newRules });
                                                        }}
                                                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Trash2 size={14}/>
                                                    </button>
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                        <div>
                                                            <label className="text-[10px] font-bold text-gray-400 uppercase">Trigger</label>
                                                            <select 
                                                                className="input-field mt-1 py-1.5 text-xs"
                                                                value={rule.trigger}
                                                                onChange={e => {
                                                                    const newRules = [...(step.notifications || [])];
                                                                    newRules[idx] = { ...newRules[idx], trigger: e.target.value as any };
                                                                    updateWorkflowStep({ ...step, notifications: newRules });
                                                                }}
                                                            >
                                                                <option value="ON_ENTRY">When Step Starts</option>
                                                                <option value="ON_APPROVED">When Approved</option>
                                                                <option value="ON_REJECTED">When Rejected</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-gray-400 uppercase">Recipient</label>
                                                            <select 
                                                                className="input-field mt-1 py-1.5 text-xs"
                                                                value={rule.recipientType}
                                                                onChange={e => {
                                                                    const newRules = [...(step.notifications || [])];
                                                                    newRules[idx] = { ...newRules[idx], recipientType: e.target.value as any };
                                                                    updateWorkflowStep({ ...step, notifications: newRules });
                                                                }}
                                                            >
                                                                <option value="APPROVER">Assigned Approver</option>
                                                                <option value="REQUESTER">Requester</option>
                                                                <option value="ADMIN">Admins</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex gap-4 border-t border-gray-200 dark:border-gray-700 pt-3">
                                                         <label className="flex items-center gap-2 cursor-pointer">
                                                             <input type="checkbox" checked={rule.channels.email} onChange={e => {
                                                                 const newRules = [...(step.notifications || [])];
                                                                 newRules[idx].channels.email = e.target.checked;
                                                                 updateWorkflowStep({ ...step, notifications: newRules });
                                                             }} className="rounded text-xs text-[var(--color-brand)]"/>
                                                             <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1"><Mail size={12}/> Email</span>
                                                         </label>
                                                         <label className="flex items-center gap-2 cursor-pointer">
                                                             <input type="checkbox" checked={rule.channels.inApp} onChange={e => {
                                                                 const newRules = [...(step.notifications || [])];
                                                                 newRules[idx].channels.inApp = e.target.checked;
                                                                 updateWorkflowStep({ ...step, notifications: newRules });
                                                             }} className="rounded text-xs text-[var(--color-brand)]"/>
                                                             <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1"><Bell size={12}/> In-App</span>
                                                         </label>
                                                         <label className="flex items-center gap-2 cursor-pointer">
                                                             <input type="checkbox" checked={rule.channels.teams} onChange={e => {
                                                                 const newRules = [...(step.notifications || [])];
                                                                 newRules[idx].channels.teams = e.target.checked;
                                                                 updateWorkflowStep({ ...step, notifications: newRules });
                                                             }} className="rounded text-xs text-[var(--color-brand)]"/>
                                                             <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1"><MessageSquare size={12}/> Teams</span>
                                                         </label>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activeStepTab === 'SLA' && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 rounded-xl">
                                             <div className="flex items-center gap-2 mb-2">
                                                 <Clock size={16} className="text-amber-500"/>
                                                 <h3 className="font-bold text-gray-900 dark:text-white text-sm">SLA Configuration</h3>
                                             </div>
                                             <p className="text-xs text-gray-500">Service Level Agreements help keep approvals moving by warning or escalating stalled items.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Warning threshold</label>
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="number"
                                                        className="input-field text-right"
                                                        value={step.sla?.warnAfterHours || ''}
                                                        placeholder="e.g. 24"
                                                        onChange={e => updateWorkflowStep({ ...step, sla: { ...step.sla, warnAfterHours: parseInt(e.target.value) || undefined } })}
                                                    />
                                                    <span className="text-sm text-gray-500 font-medium">Hours</span>
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-1">Send a reminder notification after this time.</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Escalation threshold</label>
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="number"
                                                        className="input-field text-right"
                                                        value={step.sla?.escalateAfterHours || ''}
                                                        placeholder="e.g. 48"
                                                        onChange={e => updateWorkflowStep({ ...step, sla: { ...step.sla, escalateAfterHours: parseInt(e.target.value) || undefined } })}
                                                    />
                                                    <span className="text-sm text-gray-500 font-medium">Hours</span>
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-1">Escalate to manager or admin after this time.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-white/5 flex justify-end gap-3">
                                <button type="button" onClick={() => setEditingStepId(null)} className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-colors">Close</button>
                            </div>
                        </div>
                    </div>
                 );
             })()}

              {/* Role Creator Modal (Only for creating new roles now) */}
              {isRoleEditorOpen && !activeRole && (
                 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-nocturne rounded-2xl shadow-xl w-[95%] max-w-lg p-6 animate-slide-up">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Create New Role</h2>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role name</label>
                                <input className="input-field" value={roleFormName} onChange={e => setRoleFormName(e.target.value)}/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                                <input className="input-field" value={roleFormDesc} onChange={e => setRoleFormDesc(e.target.value)}/>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsRoleEditorOpen(false)} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="button" onClick={() => {
                                    // Handle Create
                                    const newRole: RoleDefinition = {
                                        id: roleFormName.toUpperCase().replace(/\s+/g, '_'),
                                        name: roleFormName,
                                        description: roleFormDesc,
                                        permissions: [], // Start empty
                                        isSystem: false
                                    };
                                    createRole(newRole);
                                    setActiveRole(newRole); // Switch to it
                                    setIsRoleEditorOpen(false);
                                    // Reset form
                                    setRoleFormName('');
                                    setRoleFormDesc('');
                                }} className="btn-primary">Create Role</button>
                            </div>
                        </div>
                    </div>
                 </div>
              )}
               {/* Invite User Wizard (Replaces Directory Modal) */}
               {isDirectoryModalOpen && (
                   <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                       <div className="bg-white dark:bg-nocturne rounded-2xl shadow-xl w-[95%] max-w-2xl p-0 overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
                           
                            {/* Header */}
                            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-white/5">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <User size={24} className="text-[var(--color-brand)]"/> 
                                        {inviteForm.id && users.some(u => u.id === inviteForm.id) ? 'Manage User Access' : 'Invite New User'}
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {inviteForm.id && users.some(u => u.id === inviteForm.id) 
                                            ? 'Update permissions for an existing member.' 
                                            : 'Add a new user to the organization and assign access.'}
                                    </p>
                                </div>
                                <button type="button" onClick={handleResetInviteWizard} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                    <X size={24}/>
                                </button>
                            </div>

                           {/* Wizard Steps Progress */}
                            {/* Enhanced Progress Header */}
                            <div className="flex bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-gray-800">
                                <div className={`flex-1 py-4 px-6 text-center transition-all duration-300 relative ${inviteStep === 1 ? 'text-[var(--color-brand)] font-black' : 'text-gray-400 font-bold'}`}>
                                    <div className="flex items-center justify-center gap-2">
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] ${inviteStep === 1 ? 'bg-[var(--color-brand)] text-white shadow-lg shadow-[var(--color-brand)]/20' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>1</div>
                                        <span className="text-xs tracking-tight">Identify User</span>
                                    </div>
                                    {inviteStep === 1 && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--color-brand)] rounded-t-full" />}
                                </div>
                                <div className={`flex-1 py-4 px-6 text-center transition-all duration-300 relative ${inviteStep === 2 ? 'text-[var(--color-brand)] font-black' : 'text-gray-400 font-bold'}`}>
                                    <div className="flex items-center justify-center gap-2">
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] ${inviteStep === 2 ? 'bg-[var(--color-brand)] text-white shadow-lg shadow-[var(--color-brand)]/20' : (inviteStep > 2 ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500')}`}>2</div>
                                        <span className="text-xs tracking-tight">Access & Sites</span>
                                    </div>
                                    {inviteStep === 2 && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--color-brand)] rounded-t-full" />}
                                </div>
                            </div>

                           {/* Body */}
                           <div className="p-6 overflow-y-auto min-h-[300px]">
                               {inviteStep === 1 && (
                                   <div className="space-y-6">
                                       {/* Tab Switcher */}
                                       <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-full md:w-fit">
                                           <button type="button" onClick={() => setInviteTab('SEARCH')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-xs font-bold transition-all ${inviteTab === 'SEARCH' ? 'bg-white dark:bg-nocturne shadow text-[var(--color-brand)]' : 'text-gray-500'}`}>Search Users & Directory</button>
                                           <button type="button" onClick={() => setInviteTab('MEMBERS')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-xs font-bold transition-all ${inviteTab === 'MEMBERS' ? 'bg-white dark:bg-nocturne shadow text-[var(--color-brand)]' : 'text-gray-500'}`}>Active Members</button>
                                           <button type="button" onClick={() => setInviteTab('MANUAL')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-xs font-bold transition-all ${inviteTab === 'MANUAL' ? 'bg-white dark:bg-nocturne shadow text-[var(--color-brand)]' : 'text-gray-500'}`}>Manual Entry</button>
                                       </div>

                                       {inviteTab === 'SEARCH' ? (
                                           <div className="space-y-4">
                                               <div className="relative">
                                                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                   <input 
                                                       className="input-field pl-10 h-14 text-lg" 
                                                       placeholder="Type name or email..." 
                                                       value={directorySearch} 
                                                       onChange={e => setDirectorySearch(e.target.value)}
                                                       autoFocus
                                                   />
                                                   {directoryLoading && (
                                                       <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                            <div className="w-5 h-5 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin"></div>
                                                       </div>
                                                   )}
                                               </div>
                                                                                               <div className="space-y-3">
                                                     <div className="flex items-center justify-between">
                                                         <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Search Results</h4>
                                                         {directorySearch.length > 0 && !directoryLoading && (
                                                             <span className="text-[10px] text-gray-400 font-medium">{directoryResults.length} found</span>
                                                         )}
                                                     </div>

                                                     {directoryLoading && directoryResults.length === 0 ? (
                                                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-4 bg-gray-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                                                             <div className="relative">
                                                                 <div className="w-8 h-8 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin"></div>
                                                                 <div className="absolute inset-0 flex items-center justify-center">
                                                                     <div className="w-2 h-2 bg-[var(--color-brand)] rounded-full animate-pulse"></div>
                                                                 </div>
                                                             </div>
                                                             <span className="text-xs font-medium animate-pulse">Scanning directory...</span>
                                                        </div>
                                                     ) : !directorySearch ? (
                                                        <div className="flex flex-col items-center justify-center py-16 text-gray-400 space-y-3 bg-gray-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                                                             <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-300">
                                                                 <Search size={24} />
                                                             </div>
                                                             <div className="text-center">
                                                                 <p className="text-sm font-bold text-gray-500">Find someone...</p>
                                                                 <p className="text-xs text-gray-400 mt-1">Start typing a name or email to see suggestions</p>
                                                             </div>
                                                        </div>
                                                     ) : directoryResults.length > 0 ? (
                                                        <div className="grid grid-cols-1 gap-2 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                                                            {directoryResults.map(u => (
                                                                <div 
                                                                    key={u.id} 
                                                                    className="group relative bg-white dark:bg-[#15171e] p-3 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center gap-4 hover:border-[var(--color-brand)] hover:shadow-xl hover:shadow-[var(--color-brand)]/5 transition-all duration-300 cursor-pointer overflow-hidden" 
                                                                    onClick={() => handleSelectUserForInvite(u)}
                                                                >
                                                                    {/* Hover background effect */}
                                                                    <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-brand)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    
                                                                    <div className="relative flex-shrink-0">
                                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm group-hover:scale-105 transition-transform ${u.isExisting ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                                                                            {(u.name || '?').charAt(0)}
                                                                        </div>
                                                                        {u.isExisting && (
                                                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 border-2 border-white dark:border-[#15171e] rounded-full flex items-center justify-center shadow-sm">
                                                                                <Check size={8} className="text-white" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    <div className="relative flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2 mb-0.5">
                                                                            <h3 className="font-bold text-gray-900 dark:text-white truncate group-hover:text-[var(--color-brand)] transition-colors">{u.name}</h3>
                                                                            {u.isExisting && (
                                                                                <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[8px] font-black uppercase tracking-tighter">Member</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium">
                                                                            <span className="truncate">{u.email}</span>
                                                                            {u.jobTitle && (
                                                                                <>
                                                                                    <span className="w-1 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
                                                                                    <span className="truncate italic font-normal">{u.jobTitle}</span>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="relative flex-shrink-0 flex items-center gap-3">
                                                                        <div className="opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all font-bold text-[10px] text-[var(--color-brand)] flex items-center gap-1">
                                                                            {u.isExisting ? 'Update Access' : 'Select'} <ArrowRight size={10} />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                     ) : (
                                                        <div className="flex flex-col items-center justify-center py-16 text-gray-400 space-y-4 bg-gray-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                                                            <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-900/10 flex items-center justify-center text-amber-500">
                                                                <AlertCircle size={32} />
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="text-sm font-bold text-gray-600 dark:text-gray-300">No matches found</p>
                                                                <p className="text-xs text-gray-400 mt-1 max-w-[200px] mx-auto">We couldn't find anyone matching "{directorySearch}" in your organization.</p>
                                                            </div>
                                                            <button type="button"
                                                                onClick={() => setInviteTab('MANUAL')}
                                                                className="text-xs font-bold text-[var(--color-brand)] hover:underline flex items-center gap-1"
                                                            >
                                                                Add manually instead <ArrowRight size={12} />
                                                            </button>
                                                        </div>
                                                     )}
                                                </div>
                                           </div>
                                       ) : inviteTab === 'MEMBERS' ? (
                                           <div className="space-y-4">
                                               <h4 className="text-xs font-bold text-gray-500 uppercase">Active Members</h4>
                                               <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                   {users.filter(u => u.status !== 'ARCHIVED' && (userRoleFilter ? !((u.roleIds || [u.role]).includes(userRoleFilter)) : true)).map(u => (
                                                       <div key={u.id} onClick={() => handleSelectUserForInvite({ id: u.id, name: u.name, email: u.email, jobTitle: u.jobTitle, isExisting: true, currentRole: u.role, currentRoleIds: u.roleIds || [u.role], currentSiteIds: u.siteIds || [] })} className="bg-white dark:bg-[#15171e] p-3 rounded-xl border border-gray-200 dark:border-gray-800 flex justify-between items-center group hover:border-[var(--color-brand)] hover:shadow-md transition-all cursor-pointer">
                                                           <div className="flex items-center gap-3">
                                                               <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                                   {u.name.charAt(0)}
                                                               </div>
                                                               <div>
                                                                   <div className="font-bold text-sm text-gray-900 dark:text-white">{u.name}</div>
                                                                   <div className="text-[11px] text-gray-500">{u.email}</div>
                                                               </div>
                                                           </div>
                                                           <div className="flex flex-col items-end gap-1">
                                                               <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded uppercase">
                                                                   {(u.roleIds?.length || 0) > 1 ? `${u.roleIds?.length} roles` : u.role}
                                                               </span>
                                                               <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                   <button type="button" 
                                                                       onClick={(e) => {
                                                                           e.stopPropagation();
                                                                           if(confirm(`Resend invitation to ${u.name}?`)) {
                                                                                resendWelcomeEmail(u.email, u.name, u.siteIds?.[0])?.then(ok => ok && alert('Invitation sent successfully!'));
                                                                           }
                                                                       }}
                                                                       className="text-[10px] font-bold text-gray-400 hover:text-[var(--color-brand)] flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-white/5 py-1 px-1.5 rounded"
                                                                       title="Resend Magic Link"
                                                                   >
                                                                       <Mail size={10} /> Resend
                                                                   </button>
                                                                   <span className="text-[10px] font-bold text-[var(--color-brand)]">Select &rarr;</span>
                                                               </div>
                                                           </div>
                                                       </div>
                                                   ))}
                                               </div>
                                           </div>
                                       ) : (
                                           <div className="space-y-4 max-w-md mx-auto py-4">
                                               <div><label className="text-xs font-bold text-gray-500 uppercase">Full Name</label><input required className="input-field mt-1" value={inviteForm.name} onChange={e => setInviteForm({...inviteForm, name: e.target.value})}/></div>
                                               <div><label className="text-xs font-bold text-gray-500 uppercase">Email Address</label><input required type="email" className="input-field mt-1" value={inviteForm.email} onChange={e => setInviteForm({...inviteForm, email: e.target.value})}/></div>
                                               <div><label className="text-xs font-bold text-gray-500 uppercase">Job Title</label><input className="input-field mt-1" value={inviteForm.jobTitle} onChange={e => setInviteForm({...inviteForm, jobTitle: e.target.value})}/></div>
                                               <div className="flex justify-end pt-4">
                                                   <button type="button" 
                                                        disabled={!inviteForm.name || !inviteForm.email}
                                                        onClick={() => {
                                                            setInviteForm({ ...inviteForm, id: uuidv4() });
                                                            setInviteStep(2);
                                                        }} 
                                                        className="btn-primary w-full"
                                                    >
                                                        Next: Assign Access &rarr;
                                                    </button>
                                               </div>
                                           </div>
                                       )}
                                   </div>
                               )}

                               {inviteStep === 2 && (
                                    <div className="space-y-6 animate-fade-in">
                                         {/* Selected User Badge */}
                                         <div className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 p-4 rounded-2xl flex items-center gap-4 shadow-sm">
                                             <div className="relative flex-shrink-0">
                                                 <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-secondary,var(--color-brand))] flex items-center justify-center text-white font-black text-xl shadow-lg">
                                                     {inviteForm.name.charAt(0)}
                                                 </div>
                                                 <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white dark:bg-nocturne rounded-xl shadow-md flex items-center justify-center">
                                                     <User size={14} className="text-[var(--color-brand)]" />
                                                 </div>
                                             </div>
                                             <div className="min-w-0">
                                                 <div className="flex items-center gap-2">
                                                     <h3 className="font-black text-gray-900 dark:text-white text-lg truncate leading-tight">{inviteForm.name}</h3>
                                                     {users.some(u => u.id === inviteForm.id) && (
                                                         <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase tracking-tighter">Existing</span>
                                                     )}
                                                 </div>
                                                 <div className="text-xs text-gray-400 font-medium truncate">{inviteForm.email}</div>
                                             </div>
                                             <button type="button" 
                                                onClick={() => setInviteStep(1)} 
                                                className="ml-auto p-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-gray-400 hover:text-[var(--color-brand)] hover:border-[var(--color-brand)] transition-all shadow-sm"
                                                title="Change User"
                                             >
                                                 <RefreshCw size={16}/>
                                             </button>
                                         </div>

                                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                             {/* Role Selection */}
                                             <div className="space-y-4">
                                                 <div className="flex items-center justify-between">
                                                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                         <Shield size={14} className="text-[var(--color-brand)]"/> Assigned Roles
                                                     </label>
                                                     <span className="text-[10px] font-bold text-gray-400">{inviteForm.roleIds.length} selected</span>
                                                 </div>
                                                 <div className="grid grid-cols-1 gap-2">
                                                     {roles.map(r => {
                                                         const isSelected = inviteForm.roleIds.includes(r.id);
                                                         const isPrimary = inviteForm.role === r.id;
                                                         return (
                                                         <div
                                                            key={r.id}
                                                            role="checkbox"
                                                            aria-checked={isSelected}
                                                            tabIndex={0}
                                                            onClick={() => toggleInviteRole(r.id)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                    e.preventDefault();
                                                                    toggleInviteRole(r.id);
                                                                }
                                                            }}
                                                            className={`group relative flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${isSelected ? 'bg-[var(--color-brand)]/5 border-[var(--color-brand)] shadow-lg shadow-[var(--color-brand)]/5' : 'bg-white dark:bg-[#15171e] border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}`}
                                                         >
                                                             <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'border-[var(--color-brand)] bg-[var(--color-brand)]' : 'border-gray-300 dark:border-gray-700'}`}>
                                                                 {isSelected && <Check size={12} className="text-white" />}
                                                             </div>
                                                             <input type="checkbox" className="hidden" checked={isSelected} onChange={() => toggleInviteRole(r.id)} />
                                                             <div className="relative min-w-0 flex-1">
                                                                 <div className={`font-black text-sm mb-0.5 transition-colors ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300'}`}>{r.name}</div>
                                                                 <div className="text-[11px] text-gray-400 leading-relaxed font-medium line-clamp-2">{r.description}</div>
                                                                 {isSelected && (
                                                                     <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setInvitePrimaryRole(r.id);
                                                                        }}
                                                                        className={`mt-2 text-[9px] font-black uppercase tracking-widest rounded-lg px-2 py-1 border transition-all ${isPrimary ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]' : 'text-gray-400 border-gray-200 dark:border-gray-700 hover:text-[var(--color-brand)] hover:border-[var(--color-brand)]'}`}
                                                                     >
                                                                        {isPrimary ? 'Default role' : 'Make default'}
                                                                     </button>
                                                                 )}
                                                             </div>
                                                             {isPrimary && (
                                                                 <div className="absolute right-0 top-0 bottom-0 w-1 bg-[var(--color-brand)]" />
                                                             )}
                                                         </div>
                                                     );
                                                     })}
                                                 </div>
                                             </div>

                                             {/* Site Selection */}
                                             <div className="flex flex-col h-full">
                                                  <div className="flex items-center justify-between mb-4">
                                                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                          <MapPin size={14} className="text-emerald-500"/> Authorized Sites
                                                      </label>
                                                      {sites.length > 0 && (
                                                          <button type="button" 
                                                            onClick={() => {
                                                                const allIds = sites.map(s => s.id);
                                                                const isAllSelected = inviteForm.siteIds.length === allIds.length;
                                                                setInviteForm({ ...inviteForm, siteIds: isAllSelected ? [] : allIds });
                                                            }}
                                                            className="text-[10px] font-bold text-[var(--color-brand)] hover:underline"
                                                          >
                                                              {inviteForm.siteIds.length === sites.length ? 'Deselect All' : 'Select All'}
                                                          </button>
                                                      )}
                                                  </div>
                                                  <div className="flex-1 bg-gray-50/50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-gray-800 p-2 overflow-y-auto max-h-[360px] custom-scrollbar">
                                                      <div className="grid grid-cols-1 gap-1">
                                                          {sites.length > 0 ? sites.map(s => (
                                                              <label 
                                                                key={s.id} 
                                                                className={`group flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer ${inviteForm.siteIds.includes(s.id) ? 'bg-white dark:bg-white/10 shadow-sm' : 'hover:bg-white dark:hover:bg-white/5 opacity-70 hover:opacity-100'}`}
                                                              >
                                                                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${inviteForm.siteIds.includes(s.id) ? 'bg-emerald-500 border-emerald-500 shadow-sm' : 'border-gray-300 dark:border-gray-700'}`}>
                                                                      {inviteForm.siteIds.includes(s.id) && <Check size={12} className="text-white" />}
                                                                  </div>
                                                                  <input 
                                                                     type="checkbox" 
                                                                     className="hidden"
                                                                     checked={inviteForm.siteIds.includes(s.id)} 
                                                                     onChange={e => {
                                                                         const newSites = e.target.checked 
                                                                             ? [...inviteForm.siteIds, s.id]
                                                                             : inviteForm.siteIds.filter(id => id !== s.id);
                                                                         setInviteForm({...inviteForm, siteIds: newSites});
                                                                     }}
                                                                  />
                                                                  <div className="min-w-0">
                                                                     <div className={`text-sm font-bold transition-colors ${inviteForm.siteIds.includes(s.id) ? 'text-gray-900 dark:text-white' : 'text-gray-500 group-hover:text-gray-700'}`}>{s.name}</div>
                                                                     {s.suburb && <div className="text-[10px] text-gray-400 font-medium truncate">{s.suburb}, {s.state}</div>}
                                                                  </div>
                                                              </label>
                                                          )) : (
                                                              <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-3">
                                                                  <MapPin size={24} className="opacity-20" />
                                                                  <div className="text-center">
                                                                      <p className="text-xs font-bold">No sites available</p>
                                                                      <p className="text-[10px] opacity-60">Create sites in the Sites tab first.</p>
                                                                  </div>
                                                              </div>
                                                          )}
                                                      </div>
                                                  </div>
                                                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/20 flex items-start gap-3">
                                                      <Info size={14} className="text-amber-500 mt-0.5 shrink-0" />
                                                      <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                                                          {inviteForm.roleIds.includes('ADMIN')
                                                              ? 'Admin users can access all sites and existing data. Site selections only affect their default site context.'
                                                              : 'Users will only have access to data and notifications related to the sites selected above.'}
                                                      </p>
                                                  </div>
                                             </div>
                                         </div>
                                    </div>
                               )}
                           </div>

                           {/* Footer */}
                           <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-white/5 flex justify-between items-center">
                               {inviteStep === 2 ? (
                                   <button type="button" onClick={() => setInviteStep(1)} className="text-gray-500 font-bold text-sm hover:underline">Back</button>
                               ) : <div></div>}
                               
                               {inviteStep === 2 && (
                                   <button type="button" 
                                        onClick={async () => {
                                            // Handle Final Submit
                                            // Case-insensitive check for existing user
                                            const normalizedEmail = inviteForm.email?.toLowerCase();
                                            const existingUser = users.find(u => 
                                                u.id === inviteForm.id || 
                                                (u.email && u.email.toLowerCase() === normalizedEmail)
                                            );
                                             
                                             if (existingUser) {
                                                 const targetId = existingUser.id;
                                                 if (targetId) {
                                                     await updateUserAccess(targetId, inviteForm.role as UserRole, inviteForm.roleIds as UserRole[], inviteForm.siteIds);
                                                     alert(`Access updated for ${inviteForm.name}`);
                                                 }
                                             } else {
                                            
                                            // 1. Add to DB and Send Invite
                                            try {
                                                await addUser({
                                                    id: inviteForm.id || uuidv4(),
                                                    name: inviteForm.name,
                                                    email: inviteForm.email,
                                                    role: inviteForm.role,
                                                    roleIds: inviteForm.roleIds,
                                                    jobTitle: inviteForm.jobTitle,
                                                    siteIds: inviteForm.siteIds,
                                                    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(inviteForm.name)}&background=random`,
                                                    status: 'APPROVED', // Invited users are pre-approved
                                                    createdAt: new Date().toISOString()
                                                } as any, true); // Pass true to trigger custom welcome email

                                                alert(`User created and welcome email sent to ${inviteForm.email}`);
                                            } catch (err: any) {
                                                console.error("User creation failed:", err);
                                                if (err.message && err.message.includes('unique constraint')) {
                                                    // This shouldn't happen anymore with our smart upsert, but just in case
                                                    alert("This email is already registered. The system has updated the existing user's access instead. Please refresh the page to see the changes.");
                                                    handleResetInviteWizard();
                                                    return;
                                                } else {
                                                    alert(`Failed to create user record: ${err.message || 'Unknown error'}`);
                                                }
                                                // Don't reset wizard so they can fix it
                                                return; 
                                            }
                                            }
                                             handleResetInviteWizard();
                                        }}
                                        className="btn-primary py-2 px-6 shadow-lg shadow-blue-500/20 flex items-center gap-2"
                                    >
                                        <Shield size={16}/> {users.some(u => u.id === inviteForm.id) ? 'Update Access' : 'Send Invite & Grant Access'}
                                    </button>
                               )}
                           </div>
                       </div>
                   </div>
               )}


    </div>
    </div>
  );
};

export default Settings;
