import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../context/AppContext';

import {
    Users, Shield, Globe, ShoppingBag, Truck, Layout, Bell, Database,
    FileText, Plus, Search, Edit2, Trash2, CheckCircle2, AlertTriangle,
    Upload, Download, RefreshCw, Filter, ChevronDown, ChevronRight, X,
    MapPin, Link as LinkIcon, Lock, Box, User, Settings as SettingsIcon,
    GitMerge, Fingerprint, Palette, FileSpreadsheet, Package, Layers, Type,
    Eye, Calendar as CalendarIcon, Wand2, XCircle, DollarSign, CheckSquare,
    Mail, Mail as MailIcon, Slack, Smartphone, ArrowDown, History, HelpCircle, Image, Tag, Save, Phone, Code, AlertCircle, Check, Info, ArrowRight, MessageSquare, GripVertical, PlayCircle, StopCircle, Network, ListFilter, Clock, CheckCircle, MinusCircle, Archive, UserPlus
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { SupplierStockSnapshot, Item, Supplier, Site, IncomingStock, UserRole, WorkflowStep, RoleDefinition, PermissionId, PORequest, POStatus, NotificationRule, NotificationRecipient } from '../types';
import { normalizeItemCode } from '../utils/normalization';
import { useLocation } from 'react-router-dom';
import AdminAccessHub from './AdminAccessHub';
import AdminMigration from './AdminMigration';


const AVAILABLE_PERMISSIONS: { id: PermissionId, label: string, description: string, category: 'Page Access' | 'Functional Access' | 'Admin Access' }[] = [
    // Page Access
    { id: 'view_dashboard', label: 'Dashboard', description: 'Access dashboard overview', category: 'Page Access' },
    { id: 'view_items', label: 'Items Tab', description: 'View master item list', category: 'Page Access' },
    { id: 'view_stock', label: 'Stock Tab', description: 'View stock levels', category: 'Page Access' },
    { id: 'view_mapping', label: 'Mapping Tab', description: 'View product mappings', category: 'Page Access' },
    { id: 'view_suppliers', label: 'Suppliers Tab', description: 'View supplier list', category: 'Page Access' },
    { id: 'view_sites', label: 'Sites Tab', description: 'View site list', category: 'Page Access' },
    { id: 'view_workflow', label: 'Workflow Tab', description: 'View approval workflows', category: 'Page Access' },
    { id: 'view_security', label: 'Security Tab', description: 'View users and roles', category: 'Page Access' },
    { id: 'view_notifications', label: 'Notifications Tab', description: 'View notification settings', category: 'Page Access' },
    { id: 'view_branding', label: 'Branding Tab', description: 'View branding settings', category: 'Page Access' },

    // Functional Access
    { id: 'create_request', label: 'Create POs', description: 'Create new purchase orders', category: 'Functional Access' },
    { id: 'view_all_requests', label: 'View All POs', description: 'View POs from all sites/users', category: 'Functional Access' },
    { id: 'approve_requests', label: 'Approve POs', description: 'Approve purchase orders', category: 'Functional Access' },
    { id: 'link_concur', label: 'Link Concur', description: 'Link POs to Concur', category: 'Functional Access' },
    { id: 'receive_goods', label: 'Receive Goods', description: 'Mark items as received', category: 'Functional Access' },
    
    // Admin Access
    { id: 'manage_finance', label: 'Finance Management', description: 'Edit finance codes', category: 'Admin Access' },
    { id: 'manage_settings', label: 'System Settings', description: 'Manage system config', category: 'Admin Access' },
    { id: 'manage_items', label: 'Manage Items', description: 'Create/Edit/Delete Items', category: 'Admin Access' },
    { id: 'manage_suppliers', label: 'Manage Suppliers', description: 'Create/Edit/Delete Suppliers', category: 'Admin Access' }
];

type AdminTab = 'PROFILE' | 'ITEMS' | 'CATALOG' | 'STOCK' | 'MAPPING' | 'SUPPLIERS' | 'SITES' | 'BRANDING' | 'SECURITY' | 'WORKFLOW' | 'NOTIFICATIONS' | 'MIGRATION' | 'EMAIL';

const Settings = () => {
  const {
    currentUser, users, addUser, roles, hasPermission, createRole, updateRole, deleteRole, permissions, updateUserRole, updateUserAccess,
    teamsWebhookUrl, updateTeamsWebhook,
    theme, setTheme, branding, updateBranding,
    suppliers, addSupplier, updateSupplier, deleteSupplier,
    sites, addSite, updateSite, deleteSite,
    workflowSteps, updateWorkflowStep, addWorkflowStep, deleteWorkflowStep, notificationRules, upsertNotificationRule, deleteNotificationRule,
    items, addItem, updateItem, deleteItem,
    catalog, updateCatalogItem, stockSnapshots, pos,
    // Actions
    createPO, addSnapshot, importStockSnapshot, importMasterProducts, runDataBackfill, refreshAvailability,
    mappings, generateMappings, updateMapping,
    // New Admin Caps
    getItemFieldRegistry, runAutoMapping, getMappingQueue,  upsertProductMaster, reloadData, updateProfile, sendWelcomeEmail, impersonateUser, archiveUser, searchDirectory
  } = useApp();

  const location = useLocation();
  const [activeTab, setActiveTab] = useState<AdminTab>('PROFILE');
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [activeStepTab, setActiveStepTab] = useState<'GENERAL' | 'NOTIFICATIONS' | 'SLA'>('GENERAL');
  const [showWorkflowVisuals, setShowWorkflowVisuals] = useState(true);
  const [showMonitor, setShowMonitor] = useState(false);

  useEffect(() => {
    const state = location.state as { activeTab?: AdminTab };
    if (state?.activeTab) {
      setActiveTab(state.activeTab);
    }
  }, [location.state]);
  
  // --- Security: Strict Role Checks ---
  useEffect(() => {
      const restrictedTabs: AdminTab[] = ['SECURITY', 'WORKFLOW', 'BRANDING', 'NOTIFICATIONS', 'MIGRATION', 'EMAIL'];
      if (currentUser?.role !== 'ADMIN' && restrictedTabs.includes(activeTab)) {
          setActiveTab('PROFILE');
      }
  }, [currentUser, activeTab]);

  // --- Email Templates State ---
  const [emailSubject, setEmailSubject] = useState(branding.emailTemplate?.subject || `Welcome to ${branding.appName}`);
  const [emailBody, setEmailBody] = useState(branding.emailTemplate?.body || `
<p>Hi {name},</p>
<p>You have been invited to join <strong>{app_name}</strong>.</p>
<p>Please click the link below to get started:</p>
<p>{link}</p>
<p>Best regards,<br/>The Admin Team</p>
`);

  const handleSaveEmailTemplate = async () => {
       const newBranding = {
           ...branding,
           emailTemplate: {
               subject: emailSubject,
               body: emailBody
           }
       };
       await updateBranding(newBranding);
       alert("Email template saved!");
  };

  const handleTestEmail = async () => {
      const email = prompt("Enter email to send test to:", currentUser?.email);
      if (email) {
         if (await sendWelcomeEmail(email, "Test User")) {
             alert(`Test email sent to ${email}`);
         } else {
             alert("Failed to send test email. Check console/network.");
         }
      }
  };

  const [fieldRegistry, setFieldRegistry] = useState<any[]>([]);
  
  useEffect(() => {
     if (activeTab === 'ITEMS') {
         getItemFieldRegistry().then(setFieldRegistry).catch(console.error);
     }
  }, [activeTab, getItemFieldRegistry]);

  // --- Item Tab Improvements ---
  const [isEditMode, setIsEditMode] = useState(false);
  
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
  const [stockFilterStatus, setStockFilterStatus] = useState<'ALL' | 'MAPPED' | 'UNMAPPED'>('ALL');
  
  // Import State (Derived)
  // importSupplierId removed -> use stockSupplierId
  const [pasteData, setPasteData] = useState('');
  const [importDate, setImportDate] = useState(new Date().toISOString().split('T')[0]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedSnapshot, setSelectedSnapshot] = useState<SupplierStockSnapshot | null>(null);

  // --- Catalog Edit State ---
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState(0);
  const [editSku, setEditSku] = useState('');

  // --- Mapping Workbench State ---
  const [mappingSubTab, setMappingSubTab] = useState<'PROPOSED' | 'CONFIRMED' | 'REJECTED'>('PROPOSED');
  const [isManualMapOpen, setIsManualMapOpen] = useState(false);
  const [mappingSource, setMappingSource] = useState<SupplierStockSnapshot | null>(null);

  // --- Security State ---
  const [activeRole, setActiveRole] = useState<RoleDefinition | null>(null);
  const [isRoleEditorOpen, setIsRoleEditorOpen] = useState(false);
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormDesc, setRoleFormDesc] = useState('');
  const [roleFormPerms, setRoleFormPerms] = useState<PermissionId[]>([]);

  // --- Item Master Form State ---
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemForm, setItemForm] = useState<Partial<Item>>({ sku: '', name: '', description: '', unitPrice: 0, uom: 'Each', category: '' });
  const [itemSearch, setItemSearch] = useState('');

  // --- Profile State ---
  const [profileForm, setProfileForm] = useState({ 
      name: currentUser?.name || '', 
      jobTitle: currentUser?.jobTitle || '', 
      avatar: currentUser?.avatar || '' 
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
  const [supplierForm, setSupplierForm] = useState({ name: '', keyContact: '', contactEmail: '', phone: '', address: '', categories: '' });

  // --- Site Form State ---
  const [isSiteFormOpen, setIsSiteFormOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [siteForm, setSiteForm] = useState({ name: '', suburb: '', address: '', state: '', zip: '', contactPerson: '' });

  // --- Branding Form State ---
  const [brandingForm, setBrandingForm] = useState({
      appName: branding.appName,
      logoUrl: branding.logoUrl,
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      fontFamily: branding.fontFamily,
  });

  // --- Invite Wizard State ---
  const [inviteStep, setInviteStep] = useState<1 | 2>(1);
  const [inviteTab, setInviteTab] = useState<'SEARCH' | 'MANUAL'>('SEARCH');
  const [inviteForm, setInviteForm] = useState({
      id: '', name: '', email: '', jobTitle: '', role: 'SITE_USER', siteIds: [] as string[]
  });
  
  const handleResetInviteWizard = () => {
      setInviteStep(1);
      setInviteTab('SEARCH');
      setInviteForm({ id: '', name: '', email: '', jobTitle: '', role: 'SITE_USER', siteIds: [] });
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
          u.name.toLowerCase().includes(query) || 
          u.email.toLowerCase().includes(query)
      )).map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          jobTitle: u.jobTitle,
          isExisting: true,
          currentRole: u.role,
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

  useEffect(() => { setTeamsUrlForm(teamsWebhookUrl); }, [teamsWebhookUrl]);

  const [itemFilters, setItemFilters] = useState<Record<string, string>>({});

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
          const isMapped = !!mapping && !!items.find(i => i.id === mapping.productId);
          if (stockFilterStatus === 'MAPPED') matchesStatus = isMapped;
          if (stockFilterStatus === 'UNMAPPED') matchesStatus = !isMapped;
      }

      return matchesSupplier && matchesFrom && matchesTo && matchesStatus;
  }).sort((a,b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime());

  const allTabs = [
      { id: 'ITEMS', icon: Box, label: 'Items' },
      { id: 'STOCK', icon: Database, label: 'Stock' },
        { id: 'MAPPING', label: 'Mapping', icon: GitMerge },
        { id: 'SUPPLIERS', label: 'Suppliers', icon: Truck },
        { id: 'SITES', label: 'Sites', icon: MapPin },
        { id: 'WORKFLOW', label: 'Workflow', icon: GitMerge },
        { id: 'SECURITY', label: 'Security & Users', icon: Shield },
        { id: 'NOTIFICATIONS', label: 'Notifications', icon: Bell },
        { id: 'BRANDING', label: 'Branding', icon: Palette },
        { id: 'MIGRATION', label: 'Data Migration', icon: Upload },
        { id: 'EMAIL', label: 'Email Templates', icon: Mail }
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

  const handleItemFormSubmit = (e: React.FormEvent) => { 
      e.preventDefault(); 
      // Basic validation
      if (!itemForm.sku || !itemForm.name) { alert('SKU and Name are required'); return; }

      const newItem: Item = { 
          id: editingItem ? editingItem.id : uuidv4(), 
          sku: itemForm.sku || '', 
          name: itemForm.name || '', 
          description: itemForm.description || '', 
          unitPrice: Number(itemForm.unitPrice) || 0, 
          uom: itemForm.uom || 'Each', 
          category: itemForm.category || '', 
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
          supplierId: '',
          activeFlag: true
      }; 
      editingItem ? updateItem(newItem) : addItem(newItem); 
      setIsItemFormOpen(false); 
  };

  const handlePasteParse = () => {
    if (!pasteData.trim()) { alert('Please paste data first'); return; }
    if (!stockSupplierId) { alert('Please select a supplier from the top of the tab'); return; }

    const lines = pasteData.split(/\r\n|\n/); // Don't trim immediately to preserve tab structure check if needed? No, split is fine.
    // However, user might paste with trailing newlines. split trims? No.
    // Let's filter empty lines.
    const validLines = lines.filter(l => l.trim().length > 0);
    if (validLines.length < 2) { alert('Not enough data rows found (Need Header + Data)'); return; }

    // Parse Headers
    const headers = validLines[0].split('\t').map(h => h.trim());
    
    // Mapping keys to indices
    const keys = {
        sku: 'SKU',
        product: 'Product',
        custCode: 'Customer Stock Code',
        range: 'Range',
        category: 'Category',
        subCategory: 'Sub Category', 
        stockType: 'StockType',
        carton: 'Carton Qty',
        sohVal: 'SOH $ @ Sell',
        sell: 'Sell $',
        soh: 'SOH',
        committed: 'Committed',
        backOrder: 'Back Ordered',
        avail: 'Available'
    };

    const map: Record<string, number> = {};
    Object.entries(keys).forEach(([key, label]) => {
        map[key] = headers.findIndex(h => h.equalsIgnoreCase ? h.toLowerCase() === label.toLowerCase() : h === label);
        // Fallback: Try strict case insensitive match if exact fails
        if (map[key] === -1) {
            map[key] = headers.findIndex(h => h.toLowerCase() === label.toLowerCase());
        }
    });

    if (map.sku === -1) { alert('Missing "SKU" column. Please check headers.'); return; }
    
    const parsed: SupplierStockSnapshot[] = [];

    try {
        for (let i = 1; i < validLines.length; i++) {
            const line = validLines[i];
            const cols = line.split('\t');

            // Helper to clean string
            const str = (idx: number) => (idx >= 0 && cols[idx]) ? cols[idx].trim() : ''; 
            
            // Helper to clean Int
            const intParams = (idx: number, label: string): number => {
                if (idx === -1) return 0;
                let val = cols[idx]?.trim().replace(/,/g, '');
                if (!val) return 0;
                const n = parseInt(val, 10);
                if (isNaN(n)) return 0; // Invalid number treated as 0? Or fail? Spec says "Fail validation" for negative. Invalid format usually fail or 0.
                if (n < 0) throw new Error(`Row ${i+1}: Negative value in column "${label}"`);
                return n;
            };

            // Helper to clean Decimal
            const decParams = (idx: number, label: string): number | undefined => {
                if (idx === -1) return undefined;
                let val = cols[idx]?.trim().replace(/[$,]/g, ''); // Remove $ and ,
                if (!val) return undefined;
                const n = parseFloat(val);
                if (isNaN(n)) return undefined; // Fail? 
                if (n < 0) throw new Error(`Row ${i+1}: Negative value in column "${label}"`);
                return n;
            };

            const sku = str(map.sku);
            if (!sku) continue; // Skip empty SKU

            parsed.push({
                id: uuidv4(),
                supplierId: stockSupplierId,
                supplierSku: sku,
                productName: str(map.product) || 'Unknown Product',
                
                customerStockCode: str(map.custCode) || undefined,
                range: str(map.range) || undefined,
                category: str(map.category) || undefined,
                subCategory: str(map.subCategory) || undefined,
                stockType: str(map.stockType) || undefined,
                
                cartonQty: intParams(map.carton, keys.carton),
                sohValueAtSell: decParams(map.sohVal, keys.sohVal),
                sellPrice: decParams(map.sell, keys.sell),
                
                stockOnHand: intParams(map.soh, keys.soh),
                committedQty: intParams(map.committed, keys.committed),
                backOrderedQty: intParams(map.backOrder, keys.backOrder),
                availableQty: intParams(map.avail, keys.avail),
                totalStockQty: intParams(map.soh, keys.soh), // Default total to SOH

                snapshotDate: importDate,
                sourceReportName: 'Paste Import',
                incomingStock: [] 
            });
        }
    } catch (e: any) {
        alert(e.message);
        return;
    }

    setImportPreview(parsed);
    setIsImporting(true);
  };

  const confirmImport = async () => {
    try {
        if (!stockSupplierId) return;
        
        // 1. Import Stock to DB (Safe Overwrite)
        await importStockSnapshot(stockSupplierId, importDate, importPreview);
        
        // 2. Auto-Focus Mapping Logic (User Request)
        // Immediately run auto-mapping on the fresh data
        const mappingResults = await runAutoMapping(stockSupplierId);
        
        // 3. Update Availability based on new stock + new mappings
        await refreshAvailability();

        // 4. Refresh UI State (Ensure other screens aware)
        await reloadData();
        // Trigger generic app refresh if needed? 
        // For now, local state refresh covers the visible tabs.

        setImportPreview([]);
        setIsImporting(false);
        setPasteData('');
        
        alert(`Successfully imported ${importPreview.length} records.\n\nAuto-Mapping Results:\nConfirms: ${mappingResults.confirmed}\nProposed: ${mappingResults.proposed}\n\nStock availability has been refreshed.`);
    } catch (e: any) {
        console.error('Import Error:', e);
        alert(`Import failed: ${e.message || 'Unknown error'}`);
    }
  };

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

  const handleSupplierFormSubmit = (e: React.FormEvent) => { e.preventDefault(); const newSupplier: Supplier = { id: editingSupplier ? editingSupplier.id : uuidv4(), name: supplierForm.name, keyContact: supplierForm.keyContact, contactEmail: supplierForm.contactEmail, phone: supplierForm.phone, address: supplierForm.address, categories: supplierForm.categories.split(',').map(s => s.trim()) }; editingSupplier ? updateSupplier(newSupplier) : addSupplier(newSupplier); setIsSupplierFormOpen(false); };
  const openSupplierForm = (s?: Supplier) => { if(s) { setEditingSupplier(s); setSupplierForm({ name: s.name, keyContact: s.keyContact, contactEmail: s.contactEmail, phone: s.phone, address: s.address, categories: s.categories.join(', ') }); } else { setEditingSupplier(null); setSupplierForm({ name: '', keyContact: '', contactEmail: '', phone: '', address: '', categories: '' }); } setIsSupplierFormOpen(true); };
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
        const results = await searchDirectory(directorySearch);
        
        // Deduplicate: remove if already in local matches (by email or id)
        const directoryMatches = results.filter(du => 
            !users.some(u => u.id === du.id || u.email === du.email)
        );

        setDirectoryResults(prev => {
            // Re-run local search to ensure we have the latest set
            const query = directorySearch.trim().toLowerCase();
            const localMatches = users.filter(u => 
                u.status !== 'ARCHIVED' && (
                u.name.toLowerCase().includes(query) || 
                u.email.toLowerCase().includes(query)
            )).map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
                jobTitle: u.jobTitle,
                isExisting: true,
                currentRole: u.role,
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
        <label className="text-xs font-bold text-gray-500 uppercase block">{label}</label>
        <div className="flex flex-wrap gap-3">
            {PRESET_COLORS.slice(0, 6).map(color => (
                <button
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
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto pb-12 px-4 md:px-8">
      <div className="flex items-center gap-3 py-6 md:py-8">
         <SettingsIcon className="text-gray-900 dark:text-white" size={32} />
         <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Admin Portal</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">System Configuration</p>
         </div>
      </div>

      <div className="sticky top-0 z-30 bg-gray-50 dark:bg-[#15171e] -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex border-b border-gray-200 dark:border-gray-800 overflow-x-auto gap-6 pb-2">
             <button
                onClick={() => setActiveTab('PROFILE')}
                className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                    activeTab === 'PROFILE'
                        ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
                <User size={16} />
                My Profile
            </button>
             {allTabs.filter(tab => currentUser?.role === 'ADMIN' || !['SECURITY', 'WORKFLOW', 'BRANDING', 'NOTIFICATIONS', 'MIGRATION', 'EMAIL'].includes(tab.id as any)).map(tab => (
                 <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                        activeTab === tab.id
                            ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <tab.icon size={16} />
                    {tab.label}
                </button>
             ))}
          </div>
      </div>

      <div className="mt-6">

      {activeTab === 'PROFILE' && (
          <div className="animate-fade-in max-w-2xl">
              <div className="bg-white dark:bg-[#1e2029] rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">User Profile</h2>
                  
                  <div className="flex flex-col md:flex-row gap-8 items-start">
                      <div className="relative group">
                          <img 
                            src={profileForm.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileForm.name || 'U')}&background=random`} 
                            className="w-32 h-32 rounded-3xl object-cover bg-gray-100 dark:bg-white/5 border-2 border-gray-200 dark:border-gray-800 shadow-lg"
                          />
                          <button className="absolute bottom-2 right-2 p-2 bg-white dark:bg-[#15171e] rounded-xl shadow-md border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-[var(--color-brand)] transition-colors">
                              <Image size={16}/>
                          </button>
                      </div>

                      <div className="flex-1 space-y-4 w-full">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-3">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Full Name</label>
                                  <input 
                                    className="input-field" 
                                    value={profileForm.name} 
                                    onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                                  />
                              </div>
                              <div className="space-y-3">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Email Address</label>
                                  <input 
                                    className="input-field opacity-60 cursor-not-allowed" 
                                    value={currentUser?.email} 
                                    readOnly
                                  />
                              </div>
                          </div>

                          <div className="space-y-3">
                              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Job Title</label>
                              <input 
                                className="input-field" 
                                placeholder="e.g. Site Manager"
                                value={profileForm.jobTitle} 
                                onChange={e => setProfileForm({...profileForm, jobTitle: e.target.value})}
                              />
                          </div>

                          <div className="space-y-3">
                              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Avatar URL</label>
                              <input 
                                className="input-field font-mono text-xs" 
                                placeholder="https://example.com/photo.jpg"
                                value={profileForm.avatar} 
                                onChange={e => setProfileForm({...profileForm, avatar: e.target.value})}
                              />
                          </div>

                          <div className="pt-4 flex justify-end">
                              <button 
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


      
      {activeTab === 'ITEMS' && (
        <>
        <div className="space-y-6 animate-fade-in h-[calc(100vh-140px)] flex flex-col"> 
            
            {/* Header / Controls */}
            <div className="bg-white dark:bg-[#1e2029] p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 shrink-0">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        Master Item List 
                        <span className="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">{items.length} Items</span>
                    </h3>
                    <div className="flex gap-3">
                         <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700 mr-2">
                            <button 
                                onClick={() => setIsEditMode(false)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${!isEditMode ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
                            >
                                View
                            </button>
                            <button 
                                onClick={() => setIsEditMode(true)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${isEditMode ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
                            >
                                Edit Mode
                            </button>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search items..." 
                                className="w-64 pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                value={itemSearch}
                                onChange={e => setItemSearch(e.target.value)}
                            />
                        </div>
                        <button onClick={() => { setEditingItem(null); setItemForm({ sku: '', name: '', description: '', unitPrice: 0, uom: 'Each', category: '' }); setIsItemFormOpen(true); }} className="btn-primary flex items-center gap-2 text-sm">
                            <Plus size={16} /> Add 
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Area - Scrollable */}
            <div className="bg-white dark:bg-[#1e2029] rounded-xl shadow border border-gray-200 dark:border-gray-800 flex-1 overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse relative">
                        <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#1e2029] shadow-sm">
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                {fieldRegistry.length > 0 ? (
                                    fieldRegistry.filter(f => f.is_visible).map(f => {
                                        // Check if this field should have a filter
                                        const isFilterable = ['category', 'subCategory', 'itemPool', 'itemCatalog', 'itemType', 'stockType'].includes(f.field_key) || f.field_key.includes('Category');
                                        const uniqueOptions = isFilterable ? Array.from(uniqueValues[f.field_key] || []).sort() : [];

                                        return (
                                            <th key={f.field_key} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                                                <div className="flex flex-col gap-1">
                                                    <span>{f.label}</span>
                                                    {isFilterable && (
                                                        <select 
                                                            className="text-[10px] font-normal border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-[#15171e] focus:ring-1 focus:ring-blue-500 max-w-[120px]"
                                                            value={itemFilters[f.field_key] || ''}
                                                            onChange={(e) => setItemFilters(prev => ({ ...prev, [f.field_key]: e.target.value }))}
                                                        >
                                                            <option value="">All</option>
                                                            {uniqueOptions.map(opt => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    })
                                ) : (
                                    // Fallback Static Header
                                    <>
                                    <th className="px-6 py-4">Item</th>
                                    <th className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span>Category</span>
                                            <select 
                                                className="text-[10px] font-normal border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-[#15171e] focus:ring-1 focus:ring-blue-500 max-w-[120px]"
                                                value={itemFilters['category'] || ''}
                                                onChange={(e) => setItemFilters(prev => ({ ...prev, ['category']: e.target.value }))}
                                            >
                                                <option value="">All</option>
                                                {Array.from(uniqueValues['category'] || []).sort().map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>
                                    </th>
                                    <th className="px-6 py-4">Price</th>
                                    <th className="px-6 py-4">SKU / Code</th>
                                    <th className="px-6 py-4">Mapping</th>
                                    <th className="px-6 py-4">Attributes</th>
                                    </>
                                )}
                                <th className="px-4 py-3 text-right bg-gray-50 dark:bg-[#1e2029] sticky right-0 z-20">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {items.filter(i => {
                                    // 1. Search Filter
                                    const searchMatch = (i.name || '').toLowerCase().includes(itemSearch.toLowerCase()) || (i.sku || '').toLowerCase().includes(itemSearch.toLowerCase());
                                    if (!searchMatch) return false;
                                    
                                    // 2. Column Filters
                                    for (const [key, filterVal] of Object.entries(itemFilters)) {
                                        if (filterVal) {
                                            const itemVal = String(i[key as keyof Item] || '');
                                            if (itemVal !== filterVal) return false;
                                        }
                                    }
                                    return true;
                                }).map(item => (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                                    {fieldRegistry.length > 0 ? (
                                        <>
                                        {fieldRegistry.filter(f => f.is_visible).map(f => {
                                             const val = item[f.field_key as keyof Item];
                                             
                                             // 1. Boolean Toggle
                                             if (f.data_type === 'boolean') {
                                                 return (
                                                     <td key={f.field_key} className="px-4 py-3 text-sm whitespace-nowrap">
                                                         <button 
                                                            onClick={() => handleCellUpdate(item.id, f.field_key, !val)}
                                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${val ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                                         >
                                                             <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${val ? 'translate-x-5' : 'translate-x-1'}`} />
                                                         </button>
                                                     </td>
                                                 );
                                             }

                                             // 2. Edit Mode Inputs
                                             if (isEditMode) {
                                                  // Dropdowns for specific fields
                                                  const isDropdown = ['category', 'subCategory', 'itemPool', 'itemCatalog', 'itemType'].includes(f.field_key) || f.field_key.includes('Category');
                                                  
                                                  if (isDropdown) {
                                                      const options = Array.from(uniqueValues[f.field_key] || []);
                                                      return (
                                                         <td key={f.field_key} className="px-2 py-2 text-sm">
                                                             <select 
                                                                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500"
                                                                value={String(val || '')}
                                                                onChange={(e) => handleCellUpdate(item.id, f.field_key, e.target.value)}
                                                             >
                                                                 <option value="">-</option>
                                                                 {options.sort().map(opt => (
                                                                     <option key={opt} value={opt}>{opt}</option>
                                                                 ))}
                                                             </select>
                                                         </td>
                                                      );
                                                  }
                                                  
                                                  // Text/Number Inputs
                                                  return (
                                                     <td key={f.field_key} className="px-2 py-2 text-sm">
                                                         <input 
                                                            className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-0.5 text-xs text-gray-900 dark:text-gray-200"
                                                            value={val === undefined || val === null ? '' : String(val)}
                                                            onChange={(e) => handleCellUpdate(item.id, f.field_key, f.data_type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                                                         />
                                                     </td>
                                                  );
                                             }

                                             // 3. Read Mode Display
                                             return (
                                                <td key={f.field_key} className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                    {f.data_type === 'number' && (f.field_key.includes('price') || f.field_key.includes('Price')) 
                                                        ? `$${Number(val || 0).toFixed(2)}`
                                                        : String(val === undefined || val === null ? '' : val)
                                                    }
                                                </td>
                                             );

                                        })
                                    }
                                    <td className="px-4 py-3 text-right sticky right-0 z-20 bg-white dark:bg-[#1e2029] shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => { setEditingItem(item); setItemForm({ sku: item.sku, name: item.name, description: item.description || '', unitPrice: Number(item.unitPrice), uom: item.uom, category: item.category, stockLevel: item.stockLevel || 0, stockType: item.stockType || '', rangeName: item.rangeName || '', itemWeight: item.itemWeight || 0, itemPool: item.itemPool || '', itemCatalog: item.itemCatalog || '', itemType: item.itemType || '', rfidFlag: item.rfidFlag || false, cogFlag: item.cogFlag || false, itemColour: item.itemColour || '', itemPattern: item.itemPattern || '', itemMaterial: item.itemMaterial || '', itemSize: item.itemSize || '', measurements: item.measurements || '', cogCustomer: item.cogCustomer || '' }); setIsItemFormOpen(true); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => deleteItem(item.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-500">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                    </>
                                ) : (
                                    // Fallback Static Cells
                                            <>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center">
                                                        <div className="h-8 w-8 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 mr-3 hidden md:flex">
                                                            <Box size={16} />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-gray-900 dark:text-white line-clamp-1" title={item.name}>{item.name}</div>
                                                            <div className="text-xs text-gray-500 line-clamp-1">{item.description}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{item.category}</td>
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">${(item.unitPrice || 0).toFixed(2)}</td>
                                                <td className="px-6 py-4 text-sm font-mono text-gray-500">{item.sapItemCodeRaw || item.sku}</td>
                                                <td className="px-6 py-4 text-sm font-mono text-blue-600 dark:text-blue-400">
                                                    {item.sapItemCodeNorm ? <span className="bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded w-fit block">{item.sapItemCodeNorm}</span> : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-xs text-gray-500 space-y-1">
                                                    <div>{item.itemWeight ? `${item.itemWeight}kg` : ''} {item.itemPool}</div>
                                                    <div className="flex gap-1">
                                                        {item.rfidFlag && <span className="bg-purple-100 text-purple-700 px-1 rounded">RFID</span>}
                                                        {item.cogFlag && <span className="bg-orange-100 text-orange-700 px-1 rounded">COG</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => { setEditingItem(item); setItemForm({ sku: item.sku, name: item.name, description: item.description || '', unitPrice: Number(item.unitPrice), uom: item.uom, category: item.category, stockLevel: item.stockLevel || 0, stockType: item.stockType || '', rangeName: item.rangeName || '', itemWeight: item.itemWeight || 0, itemPool: item.itemPool || '', itemCatalog: item.itemCatalog || '', itemType: item.itemType || '', rfidFlag: item.rfidFlag || false, cogFlag: item.cogFlag || false, itemColour: item.itemColour || '', itemPattern: item.itemPattern || '', itemMaterial: item.itemMaterial || '', itemSize: item.itemSize || '', measurements: item.measurements || '', cogCustomer: item.cogCustomer || '' }); setIsItemFormOpen(true); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500">
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button onClick={() => deleteItem(item.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-500">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                                {items.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                            No items found. Import items or add manually.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* --- Modals and Forms --- */}
            {isItemFormOpen && (
                 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl w-[95%] max-w-lg p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{editingItem ? 'Edit Item' : 'New Item'}</h2>
                        <form onSubmit={handleItemFormSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-gray-500 uppercase">SKU</label><input required className="input-field mt-1" value={itemForm.sku} onChange={e => setItemForm({...itemForm, sku: e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-gray-500 uppercase">Category</label><input required className="input-field mt-1" value={itemForm.category} onChange={e => setItemForm({...itemForm, category: e.target.value})}/></div>
                            </div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Name</label><input required className="input-field mt-1" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})}/></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Description</label><input className="input-field mt-1" value={itemForm.description} onChange={e => setItemForm({...itemForm, description: e.target.value})}/></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-gray-500 uppercase">Unit Price</label><input required type="number" step="0.01" className="input-field mt-1" value={itemForm.unitPrice} onChange={e => setItemForm({...itemForm, unitPrice: parseFloat(e.target.value)})}/></div>
                                <div><label className="text-xs font-bold text-gray-500 uppercase">UOM</label><input required className="input-field mt-1" value={itemForm.uom} onChange={e => setItemForm({...itemForm, uom: e.target.value})}/></div>
                            </div>
                            
                             <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100 dark:border-gray-800">
                                <div><label className="text-xs font-bold text-gray-500 uppercase">Weight</label><input type="number" step="0.01" className="input-field mt-1" value={itemForm.itemWeight || ''} onChange={e => setItemForm({...itemForm, itemWeight: parseFloat(e.target.value)})}/></div>
                                <div><label className="text-xs font-bold text-gray-500 uppercase">Pool</label><input className="input-field mt-1" value={itemForm.itemPool || ''} onChange={e => setItemForm({...itemForm, itemPool: e.target.value})}/></div>
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-gray-500 uppercase">Range</label><input className="input-field mt-1" value={itemForm.rangeName || ''} onChange={e => setItemForm({...itemForm, rangeName: e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-gray-500 uppercase">Stock Type</label><input className="input-field mt-1" value={itemForm.stockType || ''} onChange={e => setItemForm({...itemForm, stockType: e.target.value})}/></div>
                            </div>
                            <div className="flex gap-6 py-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                                    <input type="checkbox" checked={itemForm.rfidFlag || false} onChange={e => setItemForm({...itemForm, rfidFlag: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500"/>
                                    RFID Enabled
                                </label>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                                    <input type="checkbox" checked={itemForm.cogFlag || false} onChange={e => setItemForm({...itemForm, cogFlag: e.target.checked})} className="rounded text-amber-600 focus:ring-amber-500"/>
                                    COG Item
                                </label>
                            </div>
                            {itemForm.cogFlag && (
                                <div><label className="text-xs font-bold text-gray-500 uppercase">COG Customer</label><input className="input-field mt-1" value={itemForm.cogCustomer || ''} onChange={e => setItemForm({...itemForm, cogCustomer: e.target.value})}/></div>
                            )}
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsItemFormOpen(false)} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="submit" className="btn-primary">Save Item</button>
                            </div>
                        </form>
                    </div>
                 </div>
             )}
        </>
      )}
      



      {activeTab === 'STOCK' && (
          <div className="space-y-6 animate-fade-in">
             <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
                  
                  {/* Supplier Selector Header */}
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                      <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                              <Package size={20} className="text-[var(--color-brand)]" />
                              Stock Management
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">Select a supplier to manage their stock levels and history.</p>
                      </div>
                      <div className="flex items-center gap-3 w-full md:w-auto">
                          <span className="text-xs font-bold text-gray-500 uppercase whitespace-nowrap hidden md:inline-block">Active Supplier:</span>
                          <div className="relative flex-1 md:flex-none">
                              <select 
                                  className="w-full md:w-64 bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg py-2.5 pl-3 pr-10 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all appearance-none"
                                  value={stockSupplierId}
                                  onChange={(e) => setStockSupplierId(e.target.value)}
                              >
                                  <option value="">-- Select Supplier --</option>
                                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                          </div>
                      </div>
                  </div>
                  
                  {/* NEW PASTE IMPORT AREA */}
                  {/* NEW PASTE IMPORT AREA - Only visible if supplier selected */}
                  {stockSupplierId ? (
                      <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-gray-800 mb-6 relative overflow-hidden">
                         {/* Watermark/Label */}
                         <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <Upload size={120}/>
                         </div>

                         <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Upload size={18}/> Update Stock for {suppliers.find(s => s.id === stockSupplierId)?.name}</h3>
                         <div className="flex flex-col md:flex-row gap-4 mb-4">
                            <div className="w-full md:w-1/3 space-y-4">
                               <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Snapshot Date</label>
                                    <input type="date" className="input-field mt-1" value={importDate} onChange={e => setImportDate(e.target.value)} />
                               </div>
                               <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded text-xs text-blue-800 dark:text-blue-200 border border-blue-100 dark:border-blue-800">
                                    <b>Note:</b> Uploading will add new snapshot records for this date. It is recommended to use the current date for fresh stock.
                               </div>
                               <button onClick={handlePasteParse} className="btn-primary w-full flex items-center justify-center gap-2 mt-4">
                                    <FileText size={16}/> Preview Data
                               </button>
                            </div>
                            <div className="w-full md:w-2/3">
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Paste from Excel (Header + Data)</label>
                                <textarea 
                                    className="w-full h-40 input-field font-mono text-xs whitespace-pre" 
                                    placeholder={`SKU\tProduct\tCustomer Stock Code\tRange\t...\n...`}
                                    value={pasteData}
                                    onChange={e => setPasteData(e.target.value)}
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Accepts TAB delimited content. Ensure headers match exactly: SKU, Product, Customer Stock Code...</p>
                            </div>
                         </div>
                      </div>
                  ) : (
                      <div className="p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl text-gray-400">
                          Select a Supplier above to view History or Upload Stock.
                      </div>
                  )}

                  {isImporting && importPreview.length > 0 && (
                      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl">
                          <div className="flex justify-between items-center mb-2">
                              <h4 className="font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2"><CheckCircle2 size={18}/> Ready to Import {importPreview.length} Records</h4>
                              <div className="flex gap-2">
                                  <button onClick={() => { setIsImporting(false); setImportPreview([]); }} className="text-red-500 text-sm font-bold hover:underline">Cancel</button>
                                  <button onClick={confirmImport} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md">Confirm Overwrite</button>
                              </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto text-xs border border-blue-100 dark:border-blue-800 rounded bg-white dark:bg-[#15171e]">
                              <table className="w-full text-left relative">
                                  <thead className="bg-gray-50 dark:bg-white/5 font-bold sticky top-0 z-10">
                                      <tr>
                                          <th className="p-2">SKU</th>
                                          <th className="p-2">Name</th>
                                          <th className="p-2">Category</th>
                                          <th className="p-2">Sub Cat</th>
                                          <th className="p-2">Range</th>
                                          <th className="p-2">Type</th>
                                          <th className="p-2 text-right">Ctn</th>
                                          <th className="p-2 text-right">SOH</th>
                                          <th className="p-2 text-right">Cmtd</th>
                                          <th className="p-2 text-right">B/O</th>
                                          <th className="p-2 text-right">Avail</th>
                                          <th className="p-2 text-right">Sell $</th>
                                          <th className="p-2 text-right">Value</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                    {importPreview.map((r, i) => (
                                        <tr key={i} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5">
                                            <td className="p-2 font-mono whitespace-nowrap">{r.supplierSku}</td>
                                            <td className="p-2 truncate max-w-[150px]" title={r.productName}>{r.productName}</td>
                                            <td className="p-2 text-xs">{r.category || '-'}</td>
                                            <td className="p-2 text-xs">{r.subCategory || '-'}</td>
                                            <td className="p-2 text-xs">{r.range || '-'}</td>
                                            <td className="p-2 text-xs">{r.stockType || '-'}</td>
                                            <td className="p-2 text-right font-mono">{r.cartonQty || '-'}</td>
                                            <td className="p-2 text-right font-mono">{r.stockOnHand}</td>
                                            <td className="p-2 text-right font-mono text-orange-500">{r.committedQty}</td>
                                            <td className="p-2 text-right font-mono text-red-500">{r.backOrderedQty}</td>
                                            <td className={`p-2 text-right font-bold font-mono ${r.availableQty < 0 ? 'text-red-500' : 'text-green-600'}`}>{r.availableQty}</td>
                                            <td className="p-2 text-right font-mono">{r.sellPrice ? `$${r.sellPrice.toFixed(2)}` : '-'}</td>
                                            <td className="p-2 text-right font-mono">{r.sohValueAtSell ? `$${r.sohValueAtSell.toLocaleString()}` : '-'}</td>
                                        </tr>
                                    ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  )}

                  <div className="flex flex-col md:flex-row gap-4 mb-4 items-center">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">Stock History ({filteredSnapshots.length})</h3>
                     <div className="ml-auto flex gap-2">
                          <select className="input-field w-32" value={stockFilterStatus} onChange={e => setStockFilterStatus(e.target.value as any)}>
                              <option value="ALL">All Status</option>
                              <option value="MAPPED">Mapped</option>
                              <option value="UNMAPPED">Unmapped</option>
                          </select>
                     </div>
                  </div>

                 <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400 min-w-[1200px]">
                         <thead className="table-header">
                              <tr>
                                  <th className="px-4 py-4">Status</th>
                                  <th className="px-4 py-4">Cust Code</th>
                                  <th className="px-4 py-4">Product</th>
                                  <th className="px-4 py-4">Details</th>
                                  <th className="px-4 py-4 text-right">Sell $</th>
                                  <th className="px-4 py-4 text-right">SOH</th>
                                  <th className="px-4 py-4 text-right">Cmtd</th>
                                  <th className="px-4 py-4 text-right">B/O</th>
                                  <th className="px-4 py-4 text-right">Avail</th>
                                  <th className="px-4 py-4 text-right">Val @ Sell</th>
                                  <th className="px-4 py-4">Incoming</th>
                              </tr>
                          </thead>
                         <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                             {filteredSnapshots.map(snap => {
                                 const mapping = mappings.find(m => m.supplierId === snap.supplierId && m.supplierSku === snap.supplierSku);
                                 const mappedItem = mapping ? items.find(i => i.id === mapping.productId) : null;
                                 const isMapped = !!mappedItem;

                                 return (
                                 <tr key={snap.id} className="table-row group">
                                     <td className="px-4 py-4">
                                         {isMapped ? (
                                             <div className="flex flex-col">
                                                 <span className="badge bg-green-100 text-green-800 border-green-200 w-fit">Mapped</span>
                                                 <span className="text-[10px] text-gray-500 font-mono mt-0.5 max-w-[100px] truncate" title={mappedItem?.name}>{mappedItem?.sku}</span>
                                             </div>
                                         ) : (
                                             <button onClick={() => { setMappingSource(snap); setIsManualMapOpen(true); }} className="badge bg-red-100 text-red-800 border-red-200 hover:bg-red-200 w-fit">Unmapped</button>
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
                    <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl w-[95%] max-w-lg p-6 animate-slide-up">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Add Stock Snapshot</h2>
                        <form onSubmit={handleAddSnapshot} className="space-y-4">
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Supplier</label><select className="input-field mt-1" value={snapSupplierId} onChange={e => setSnapSupplierId(e.target.value)}>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-gray-500 uppercase">Supplier SKU</label><input required className="input-field mt-1" value={snapSku} onChange={e => setSnapSku(e.target.value)}/></div>
                                <div><label className="text-xs font-bold text-gray-500 uppercase">Product Name</label><input required className="input-field mt-1" value={snapProductName} onChange={e => setSnapProductName(e.target.value)}/></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-gray-500 uppercase">Total SOH</label><input required type="number" className="input-field mt-1" value={snapTotal} onChange={e => setSnapTotal(parseInt(e.target.value))}/></div>
                                <div><label className="text-xs font-bold text-gray-500 uppercase">Available</label><input required type="number" className="input-field mt-1" value={snapAvailable} onChange={e => setSnapAvailable(parseInt(e.target.value))}/></div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsSnapshotFormOpen(false)} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
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
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Mapping Workbench</h2>
                      
                      {/* Mapping Health Dashboard */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                          {/* Card 1: Confirmed (Good) */}
                          <div className="bg-white dark:bg-[#1e2029] p-4 rounded-xl border-l-4 border-green-500 shadow-sm flex items-center justify-between">
                              <div>
                                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Ready for POs</p>
                                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{mappings.filter(m => m.mappingStatus === 'CONFIRMED').length}</p>
                                  <p className="text-[10px] text-green-600 font-medium">Stock Visible in App</p>
                              </div>
                              <div className="p-3 bg-green-50 dark:bg-green-500/10 rounded-full text-green-600">
                                  <Check size={24} />
                              </div>
                          </div>

                          {/* Card 2: Proposed (Action) */}
                          <div className="bg-white dark:bg-[#1e2029] p-4 rounded-xl border-l-4 border-yellow-400 shadow-sm flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer" onClick={() => setMappingSubTab('PROPOSED')}>
                              <div className="relative z-10">
                                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Needs Review</p>
                                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{mappings.filter(m => m.mappingStatus === 'PROPOSED').length}</p>
                                  <p className="text-[10px] text-yellow-600 font-medium font-bold underline">Review Proposals &rarr;</p>
                              </div>
                              <div className="p-3 bg-yellow-50 dark:bg-yellow-500/10 rounded-full text-yellow-500 relative z-10">
                                  <AlertCircle size={24} />
                              </div>
                              <div className="absolute inset-0 bg-yellow-50 dark:bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          </div>

                          {/* Card 3: Unmapped (Critical) */}
                          <div className="bg-white dark:bg-[#1e2029] p-4 rounded-xl border-l-4 border-red-500 shadow-sm flex items-center justify-between">
                              <div>
                                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Unmapped Stock</p>
                                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                      {stockSnapshots.filter(s => !mappings.some(m => m.supplierId === s.supplierId && m.supplierSku === s.supplierSku)).length}
                                  </p>
                                  <p className="text-[10px] text-red-500 font-medium">Stock Invisible in App</p>
                              </div>
                              <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-full text-red-500">
                                  <X size={24} />
                              </div>
                          </div>
                      </div>

                      {/* Workflow Guide */}
                      <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-xl border border-blue-100 dark:border-blue-800/50 mb-6">
                          <h4 className="font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2 mb-3">
                              <Info size={18} className="text-blue-500"/> 
                              Mapping Workflow
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div className="flex gap-3">
                                  <div className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 flex items-center justify-center font-bold text-xs shrink-0">1</div>
                                  <div>
                                      <p className="font-bold text-gray-900 dark:text-white">Run Auto-Matching</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">System attempts to match Unmapped items using fuzzy logic. Use the button on the right.</p>
                                  </div>
                              </div>
                              <div className="flex gap-3">
                                  <div className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 flex items-center justify-center font-bold text-xs shrink-0">2</div>
                                  <div>
                                      <p className="font-bold text-gray-900 dark:text-white">Review Proposals</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Check the "Proposed" tab. Confirm correct matches. This moves them to "Ready".</p>
                                  </div>
                              </div>
                              <div className="flex gap-3">
                                  <div className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 flex items-center justify-center font-bold text-xs shrink-0">3</div>
                                  <div>
                                      <p className="font-bold text-gray-900 dark:text-white">Manual Mapping</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">For any remaining Red items, go to the <b>Stock History</b> tab and click the red "Unmapped" badge to map manually.</p>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="flex gap-3 items-center mt-2 md:mt-0">
                       <button onClick={() => refreshAvailability().then(() => alert('Availability Recalculated'))} className="text-gray-500 hover:text-[var(--color-brand)] text-xs font-bold flex items-center gap-1 transition-colors">
                           <RefreshCw size={14}/> Update Mapping
                       </button>
                       <button onClick={async () => {
                           if (!window.confirm('Run Auto-Match Algorithm? This uses Master SKU matching and fuzzy logic.')) return;
                           const results = [];
                           for (const s of suppliers) {
                               const res = await runAutoMapping(s.id);
                               results.push(`${s.name}: +${res.confirmed} Confirmed, +${res.proposed} Proposed`);
                           }
                           alert(results.join('\n'));
                       }} className="bg-[var(--color-brand)] text-white px-4 py-2 rounded-lg font-bold text-xs shadow-sm hover:opacity-90 flex items-center gap-2 transition-all">
                           <Wand2 size={14}/> Run Auto-Match
                       </button>
                  </div>
              </div>

              {/* Sub Tabs */}
              <div className="flex gap-6 border-b border-gray-200 dark:border-gray-800">
                  <button onClick={() => setMappingSubTab('PROPOSED')} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${mappingSubTab === 'PROPOSED' ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                      Proposed Mappings ({mappings.filter(m => m.mappingStatus === 'PROPOSED').length})
                  </button>
                  <button onClick={() => setMappingSubTab('CONFIRMED')} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${mappingSubTab === 'CONFIRMED' ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                      Confirmed ({mappings.filter(m => m.mappingStatus === 'CONFIRMED').length})
                  </button>
                  <button onClick={() => setMappingSubTab('REJECTED')} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${mappingSubTab === 'REJECTED' ? 'border-red-500 text-red-500' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                      Rejected ({mappings.filter(m => m.mappingStatus === 'REJECTED').length})
                  </button>
              </div>

              {/* Mapping Table */}
              <div className="overflow-x-auto bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800">
                  <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400 min-w-[900px]">
                      <thead className="table-header"><tr>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Internal Master Item</th>
                          <th className="px-6 py-4">Supplier Product</th>
                          <th className="px-6 py-4 text-right">Stock (SOH)</th>
                          <th className="px-6 py-4 text-center">Confidence</th>
                          <th className="px-6 py-4 text-center">Action</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                          {mappings.filter(m => m.mappingStatus === mappingSubTab).map(map => {
                              const internalItem = items.find(i => i.id === map.productId);
                              const supplier = suppliers.find(s => s.id === map.supplierId);
                              const supNorm = map.supplierCustomerStockCode ? normalizeItemCode(map.supplierCustomerStockCode) : null;

                              return (
                                  <tr key={map.id} className="table-row">
                                      <td className="px-6 py-4">
                                          <span className={`badge ${map.mappingStatus === 'PROPOSED' ? 'bg-yellow-100 text-yellow-800' : map.mappingStatus === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{map.mappingStatus}</span>
                                          <div className="text-[10px] uppercase font-bold text-gray-400 mt-1">{map.mappingMethod}</div>
                                      </td>
                                      <td className="px-6 py-4">
                                          {internalItem ? (
                                              <div title={`Raw: ${internalItem.sku}\nNorm: ${internalItem.sapItemCodeNorm || normalizeItemCode(internalItem.sku).normalized}`}>
                                                  <div className="font-bold text-gray-900 dark:text-white">{internalItem.name}</div>
                                                  <div className="text-xs font-mono">{internalItem.sku}</div>
                                                  <div className="text-[10px] text-gray-400 font-mono mt-0.5">Norm: {internalItem.sapItemCodeNorm || normalizeItemCode(internalItem.sku).normalized}</div>
                                              </div>
                                          ) : <span className="text-red-500">Item Missing ({map.productId})</span>}
                                      </td>
                                      <td className="px-6 py-4">
                                          <div className="font-medium text-gray-900 dark:text-white">{map.supplierSku}</div>
                                          <div className="text-xs text-[var(--color-brand)]">{supplier?.name}</div>
                                          {map.supplierCustomerStockCode && (
                                              <div className="mt-1">
                                                  <div className="text-[10px] bg-gray-100 dark:bg-white/10 px-1 rounded inline-block">Ref: {map.supplierCustomerStockCode}</div>
                                                  {supNorm && (
                                                      <div className="text-[10px] text-gray-400 font-mono">Norm: {supNorm.normalized}</div>
                                                  )}
                                              </div>
                                          )}
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                         {(() => {
                                             const snapshot = stockSnapshots.find(s => s.supplierId === map.supplierId && s.supplierSku === map.supplierSku);
                                             if (!snapshot) return <span className="text-gray-300">-</span>;
                                             return (
                                                 <div className="flex flex-col items-end">
                                                     <span className="font-bold text-gray-900 dark:text-white">{snapshot.stockOnHand}</span>
                                                     <span className="text-[10px] text-gray-500">Avail: {snapshot.availableQty}</span>
                                                 </div>
                                             );
                                         })()}
                                      </td>
                                      <td className="px-6 py-4 text-center">
                                          <div className="flex flex-col items-center">
                                            <span className={`font-bold ${map.confidenceScore > 0.9 ? 'text-green-500' : map.confidenceScore > 0.7 ? 'text-yellow-500' : 'text-red-500'}`}>
                                                {(map.confidenceScore * 100).toFixed(0)}%
                                            </span>
                                          </div>
                                      </td>
                                      <td className="px-6 py-4 text-center">
                                          <div className="flex justify-center gap-2">
                                              {map.mappingStatus === 'PROPOSED' && (
                                                  <>
                                                      <button onClick={() => updateMapping({ ...map, mappingStatus: 'CONFIRMED' }).then(() => alert('Confirmed'))} className="icon-btn-green" title="Confirm"><CheckCircle2 size={18}/></button>
                                                      <button onClick={() => updateMapping({ ...map, mappingStatus: 'REJECTED' })} className="icon-btn-red" title="Reject"><XCircle size={18}/></button>
                                                  </>
                                              )}
                                              {map.mappingStatus === 'CONFIRMED' && (
                                                   <button onClick={() => updateMapping({ ...map, mappingStatus: 'PROPOSED' })} className="text-xs text-gray-400 hover:text-[var(--color-brand)] underline">Un-confirm</button>
                                              )}
                                          </div>
                                      </td>
                                  </tr>
                              );
                          })}
                          {mappings.filter(m => m.mappingStatus === mappingSubTab).length === 0 && (
                              <tr><td colSpan={5} className="text-center p-8 text-gray-400">No mappings found in this tab.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {activeTab === 'SUPPLIERS' && (
        <div className="space-y-6 animate-fade-in">
             <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
                 <div className="flex justify-end mb-4"><button onClick={() => openSupplierForm()} className="btn-primary flex items-center gap-2"><Plus size={16}/> Add Supplier</button></div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400 min-w-[700px]">
                        <thead className="table-header"><tr><th className="px-6 py-4">Supplier</th><th className="px-6 py-4">Key Contact</th><th className="px-6 py-4">Categories</th><th className="px-6 py-4 text-center">Action</th></tr></thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                            {suppliers.map(s => (
                                <tr key={s.id} className="table-row">
                                    <td className="px-6 py-4"><div className="font-bold text-gray-900 dark:text-white">{s.name}</div><div className="text-xs">{s.address}</div></td>
                                    <td className="px-6 py-4"><div className="font-medium text-gray-900 dark:text-white">{s.keyContact}</div><div className="text-xs text-[var(--color-brand)]">{s.contactEmail}</div><div className="text-xs">{s.phone}</div></td>
                                    <td className="px-6 py-4">{s.categories.map(c => <span key={c} className="badge mr-1">{c}</span>)}</td>
                                    <td className="px-6 py-4 text-center flex justify-center gap-2"><button onClick={() => openSupplierForm(s)} className="icon-btn-blue"><Edit2 size={16}/></button><button onClick={() => deleteSupplier(s.id)} className="icon-btn-red"><Trash2 size={16}/></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
             </div>
             {isSupplierFormOpen && (
                 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl w-[95%] max-w-lg p-6 animate-slide-up">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{editingSupplier ? 'Edit Supplier' : 'New Supplier'}</h2>
                        <form onSubmit={handleSupplierFormSubmit} className="space-y-4">
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Company Name</label><input required className="input-field mt-1" value={supplierForm.name} onChange={e => setSupplierForm({...supplierForm, name: e.target.value})}/></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-gray-500 uppercase">Key Contact</label><input required className="input-field mt-1" value={supplierForm.keyContact} onChange={e => setSupplierForm({...supplierForm, keyContact: e.target.value})}/></div><div><label className="text-xs font-bold text-gray-500 uppercase">Phone</label><input required className="input-field mt-1" value={supplierForm.phone} onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})}/></div></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Email</label><input required type="email" className="input-field mt-1" value={supplierForm.contactEmail} onChange={e => setSupplierForm({...supplierForm, contactEmail: e.target.value})}/></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Address</label><input required className="input-field mt-1" value={supplierForm.address} onChange={e => setSupplierForm({...supplierForm, address: e.target.value})}/></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Categories (comma sep)</label><input className="input-field mt-1" value={supplierForm.categories} onChange={e => setSupplierForm({...supplierForm, categories: e.target.value})}/></div>
                            <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setIsSupplierFormOpen(false)} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-lg">Cancel</button><button type="submit" className="btn-primary">Save Supplier</button></div>
                        </form>
                    </div>
                 </div>
             )}
        </div>
      )}

      {activeTab === 'SITES' && (
        <div className="space-y-6 animate-fade-in">
             <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
                 <div className="flex justify-end mb-4"><button onClick={() => openSiteForm()} className="btn-primary flex items-center gap-2"><Plus size={16}/> Add Site</button></div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400 min-w-[700px]">
                        <thead className="table-header"><tr><th className="px-6 py-4">Site Name</th><th className="px-6 py-4">Suburb</th><th className="px-6 py-4">Address</th><th className="px-6 py-4">State</th><th className="px-6 py-4">Contact</th><th className="px-6 py-4 text-center">Action</th></tr></thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                            {sites.map(s => (
                                <tr key={s.id} className="table-row">
                                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{s.name}</td>
                                    <td className="px-6 py-4">{s.suburb}</td>
                                    <td className="px-6 py-4">{s.address}</td>
                                    <td className="px-6 py-4"><span className="badge">{s.state}</span> <span className="text-xs text-gray-400">{s.zip}</span></td>
                                    <td className="px-6 py-4">{s.contactPerson}</td>
                                    <td className="px-6 py-4 text-center flex justify-center gap-2"><button onClick={() => openSiteForm(s)} className="icon-btn-blue"><Edit2 size={16}/></button><button onClick={() => deleteSite(s.id)} className="icon-btn-red"><Trash2 size={16}/></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
             </div>
             {isSiteFormOpen && (
                 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl w-[95%] max-w-lg p-6 animate-slide-up">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{editingSite ? 'Edit Site' : 'New Site'}</h2>
                        <form onSubmit={handleSiteFormSubmit} className="space-y-4">
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Site Name</label><input required className="input-field mt-1" value={siteForm.name} onChange={e => setSiteForm({...siteForm, name: e.target.value})}/></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Suburb</label><input required className="input-field mt-1" value={siteForm.suburb} onChange={e => setSiteForm({...siteForm, suburb: e.target.value})}/></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Address</label><input required className="input-field mt-1" value={siteForm.address} onChange={e => setSiteForm({...siteForm, address: e.target.value})}/></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-gray-500 uppercase">State</label><input required className="input-field mt-1" value={siteForm.state} onChange={e => setSiteForm({...siteForm, state: e.target.value})}/></div><div><label className="text-xs font-bold text-gray-500 uppercase">Postcode</label><input required className="input-field mt-1" value={siteForm.zip} onChange={e => setSiteForm({...siteForm, zip: e.target.value})}/></div></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Contact Person</label><input required className="input-field mt-1" value={siteForm.contactPerson} onChange={e => setSiteForm({...siteForm, contactPerson: e.target.value})}/></div>
                            <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setIsSiteFormOpen(false)} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-lg">Cancel</button><button type="submit" className="btn-primary">Save Site</button></div>
                        </form>
                    </div>
                 </div>
             )}
        </div>
      )}

      {activeTab === 'WORKFLOW' && (
          <div className="animate-fade-in max-w-5xl mx-auto py-8">
               {/* Toolbar */}
               <div className="flex justify-between items-center mb-8 bg-white dark:bg-[#1e2029] p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                   <div>
                       <h2 className="text-xl font-bold text-gray-900 dark:text-white">Workflow Designer</h2>
                       <p className="text-sm text-gray-500">Design the approval flow, configure notifications, and set SLAs.</p>
                   </div>
                   <div className="flex items-center gap-3">
                        <div className="flex bg-gray-100 dark:bg-[#15171e] p-1 rounded-lg">
                            <button 
                                onClick={() => setShowWorkflowVisuals(true)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${showWorkflowVisuals ? 'bg-white dark:bg-[#2b2d3b] text-[var(--color-brand)] shadow-sm' : 'text-gray-500'}`}
                            >
                                <Network size={14}/> Visual
                            </button>
                            <button 
                                onClick={() => setShowWorkflowVisuals(false)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${!showWorkflowVisuals ? 'bg-white dark:bg-[#2b2d3b] text-[var(--color-brand)] shadow-sm' : 'text-gray-500'}`}
                            >
                                <ListFilter size={14}/> List
                            </button>
                        </div>
                        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-2"></div>
                       <div className="flex items-center gap-2">
                           <span className="text-xs font-bold text-gray-500 uppercase">Live Monitor</span>
                           <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={showMonitor} onChange={e => setShowMonitor(e.target.checked)} />
                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                            </label>
                       </div>
                   </div>
               </div>

               {/* Canvas */}

               {/* VISUAL GRAPH */}
               {showWorkflowVisuals && (
                   <div className="bg-[#f8fafc] dark:bg-[#1e2029] rounded-2xl border border-gray-200 dark:border-gray-800 p-10 min-h-[600px] relative overflow-hidden flex flex-col items-center shadow-inner" style={{backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px'}}>
                       
                        {/* START NODE */}
                        <div className="flex flex-col items-center mb-0 relative group">
                            <div className="bg-white dark:bg-[#1e2029] p-1 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-700 shadow-sm z-10 transition-transform hover:scale-105 cursor-default">
                                 <div className="bg-gray-100 dark:bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center text-gray-400">
                                     <PlayCircle size={32} />
                                 </div>
                            </div>
                            <div className="mt-3 bg-white dark:bg-[#1e2029] px-4 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm text-xs font-bold text-gray-500 uppercase tracking-widest z-10">Start</div>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-16 bg-gray-300 dark:bg-gray-700 -z-0"></div>
                        </div>

                        <div className="h-16"></div>

                        {/* STEPS */}
                       {workflowSteps.sort((a,b) => a.order - b.order).map((step, idx) => {
                           const approverName = step.approverType === 'USER'
                               ? (users.find(u => u.id === step.approverId)?.name || 'Unknown User')
                               : (roles.find(r => r.id === step.approverId || r.id === step.approverRole)?.name || step.approverRole || step.approverId);

                           const notificationCount = step.notifications?.length || 0;
                           
                           // Simplified Monitor Logic: If step is active and PO is pending approval, assume it's here (approximated for demo)
                           const pendingCount = idx === 0 ? pos.filter(p => p.status === 'PENDING_APPROVAL').length : 0;
                           
                           return (
                               <div key={step.id} className="flex flex-col items-center w-full relative group">
                                   {/* Card */}
                                   <div 
                                        onClick={() => setEditingStepId(step.id)}
                                        className={`relative w-80 bg-white dark:bg-[#1e2029] rounded-xl border-2 transition-all cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-1 group/card
                                        ${step.isActive ? 'border-[var(--color-brand)] shadow-blue-500/10' : 'border-gray-200 dark:border-gray-700 opacity-70 grayscale'}
                                   `}
                                   >    
                                        {showMonitor && pendingCount > 0 && (
                                            <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-xs shadow-lg animate-bounce z-30 ring-2 ring-white dark:ring-[#1e2029]">
                                                {pendingCount}
                                            </div>
                                        )}
                                        {/* Connector Dot Top */}
                                        <div className="absolute -top-[9px] left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-[#1e2029] border-2 border-gray-300 dark:border-gray-600 rounded-full z-20 flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                                        </div>

                                        <div className="p-5">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="bg-[var(--color-brand)]/10 text-[var(--color-brand)] px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">Step {idx + 1}</div>
                                                <div className="flex gap-1">
                                                     {step.sla?.warnAfterHours && <div className="text-amber-500" title="SLA Configured"><Clock size={14}/></div>}
                                                     {notificationCount > 0 && <div className="text-blue-500" title={`${notificationCount} Notifications`}><Bell size={14}/></div>}
                                                </div>
                                            </div>
                                            
                                            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1 group-hover/card:text-[var(--color-brand)] transition-colors">{step.stepName}</h3>
                                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 bg-gray-50 dark:bg-[#15171e] p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                                                {step.approverType === 'USER' ? <User size={14} className="text-blue-500"/> : <Shield size={14} className="text-purple-500"/>}
                                                <span className="font-medium text-gray-700 dark:text-gray-300">{approverName}</span>
                                            </div>

                                            <div className="flex items-center justify-between text-xs border-t border-gray-100 dark:border-gray-800 pt-3 text-gray-400">
                                                <div className="flex items-center gap-1.5">
                                                    <GitMerge size={14}/>
                                                    <span>{step.conditionType === 'ALWAYS' ? 'Always runs' : `If > $${step.conditionValue}`}</span>
                                                </div>
                                                <div className="opacity-0 group-hover/card:opacity-100 transition-opacity text-[var(--color-brand)] font-bold flex items-center gap-1">
                                                    Edit <ArrowRight size={12}/>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Connector Dot Bottom */}
                                        <div className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-[#1e2029] border-2 border-gray-300 dark:border-gray-600 rounded-full z-20 flex items-center justify-center group-hover/card:border-[var(--color-brand)] transition-colors">
                                            <div className="w-1.5 h-1.5 bg-gray-400 group-hover/card:bg-[var(--color-brand)] rounded-full transition-colors"></div>
                                        </div>
                                        
                                        {/* Delete Action (Hover) */}
                                        <div className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); deleteWorkflowStep(step.id); }} className="p-1.5 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-lg"><Trash2 size={14}/></button>
                                        </div>
                                   </div>

                                   {/* Link Line */}
                                   <div className="h-16 w-0.5 bg-gray-300 dark:bg-gray-700 relative group/link">
                                        {/* Add Button on Link Hover */}
                                        <button 
                                            onClick={() => {
                                                 // Insert Logic
                                                 const newOrder = step.order + 0.5; // Simplified
                                                 addWorkflowStep({
                                                    id: uuidv4(),
                                                    stepName: 'New Step',
                                                    approverRole: roles[0]?.id || 'ADMIN',
                                                    conditionType: 'ALWAYS',
                                                    order: newOrder,
                                                    isActive: true,
                                                    notifications: [],
                                                    sla: {}
                                                 });
                                            }}
                                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white dark:bg-[#1e2029] rounded-full border-2 border-gray-300 dark:border-gray-600 shadow-sm flex items-center justify-center text-gray-400 opacity-0 group-hover/link:opacity-100 hover:text-green-600 hover:border-green-500 hover:scale-110 transition-all z-30"
                                            title="Insert Step Here"
                                        >
                                            <Plus size={16} />
                                        </button>
                                   </div>
                               </div>
                           );
                       })}

                        {/* ADD STEP END */}
                        <button 
                            onClick={() => {
                                const newOrder = workflowSteps.length > 0 ? Math.max(...workflowSteps.map(s => s.order)) + 1 : 1;
                                addWorkflowStep({
                                    id: uuidv4(),
                                    stepName: 'Approval Step',
                                    approverRole: roles[0]?.id || 'ADMIN',
                                    conditionType: 'ALWAYS',
                                    order: newOrder,
                                    isActive: true,
                                    notifications: [],
                                    sla: {}
                                });
                            }}
                            className="mb-12 flex flex-col items-center gap-2 group opacity-50 hover:opacity-100 transition-opacity"
                        >
                            <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-400 dark:border-gray-600 flex items-center justify-center text-gray-400 group-hover:border-[var(--color-brand)] group-hover:text-[var(--color-brand)] transition-colors">
                                <Plus size={24}/>
                            </div>
                            <span className="text-xs font-bold text-gray-500 uppercase">Add Step</span>
                        </button>

                        {/* END NODE */}
                        <div className="flex flex-col items-center relative">
                            <div className="bg-white dark:bg-[#1e2029] p-1 rounded-full border-2 border-dashed border-green-300 dark:border-green-800 shadow-sm z-10">
                                 <div className="bg-green-50 dark:bg-green-900/20 w-16 h-16 rounded-full flex items-center justify-center text-green-500">
                                     <CheckCircle size={32} />
                                 </div>
                            </div>
                            <div className="mt-3 bg-white dark:bg-[#1e2029] px-4 py-1.5 rounded-full border border-green-200 dark:border-green-800 shadow-sm text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-widest z-10">PO Approved</div>
                        </div>
                   </div>
               )}

               {/* LIST VIEW */}
               {!showWorkflowVisuals && (
                   <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden animate-fade-in">
                       <table className="w-full text-sm text-left">
                           <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-gray-800">
                               <tr>
                                   <th className="px-6 py-4 font-bold">Step Name</th>
                                   <th className="px-6 py-4 font-bold">Approver Role</th>
                                   <th className="px-6 py-4 font-bold">Condition</th>
                                   <th className="px-6 py-4 font-bold">Notifications</th>
                                   <th className="px-6 py-4 font-bold">Status</th>
                                   <th className="px-6 py-4 font-bold text-right">Actions</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                               {workflowSteps.sort((a,b) => a.order - b.order).map((step) => {
                                   const approverName = step.approverType === 'USER'
                                       ? (users.find(u => u.id === step.approverId)?.name || 'Unknown User')
                                       : (roles.find(r => r.id === step.approverId || r.id === step.approverRole)?.name || step.approverRole || step.approverId);
                                   return (
                                       <tr key={step.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                           <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{step.stepName}</td>
                                           <td className="px-6 py-4">
                                               <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${step.approverType === 'USER' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'}`}>
                                                   {step.approverType === 'USER' ? <User size={12}/> : <Shield size={12}/>}
                                                   {approverName}
                                               </span>
                                           </td>
                                           <td className="px-6 py-4 text-gray-500">
                                               {step.conditionType === 'ALWAYS' ? 'Always' : `> $${step.conditionValue}`}
                                           </td>
                                           <td className="px-6 py-4">
                                               {(step.notifications || []).length > 0 ? (
                                                   <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                                       <Bell size={14}/> {step.notifications?.length}
                                                   </span>
                                               ) : (
                                                   <span className="text-gray-400 text-xs italic">Default</span>
                                               )}
                                           </td>
                                           <td className="px-6 py-4">
                                               {step.isActive ? (
                                                   <span className="text-green-600 flex items-center gap-1 font-bold text-xs"><CheckCircle size={12}/> Active</span>
                                               ) : (
                                                   <span className="text-gray-400 flex items-center gap-1 font-bold text-xs"><MinusCircle size={12}/> Disabled</span>
                                               )}
                                           </td>
                                           <td className="px-6 py-4 text-right">
                                               <div className="flex justify-end gap-2">
                                                   <button onClick={() => setEditingStepId(step.id)} className="icon-btn-blue"><Edit2 size={16}/></button>
                                                   <button onClick={() => deleteWorkflowStep(step.id)} className="icon-btn-red"><Trash2 size={16}/></button>
                                               </div>
                                           </td>
                                       </tr>
                                   );
                               })}
                               {workflowSteps.length === 0 && (
                                   <tr>
                                       <td colSpan={6} className="px-6 py-8 text-center text-gray-500 italic">No workflow steps defined.</td>
                                   </tr>
                               )}
                           </tbody>
                       </table>
                       <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-white/5 flex justify-center">
                            <button 
                                onClick={() => {
                                    const newOrder = workflowSteps.length > 0 ? Math.max(...workflowSteps.map(s => s.order)) + 1 : 1;
                                    addWorkflowStep({
                                        id: uuidv4(),
                                        stepName: 'Approval Step',
                                        approverRole: roles[0]?.id || 'ADMIN',
                                        conditionType: 'ALWAYS',
                                        order: newOrder,
                                        isActive: true,
                                        notifications: [],
                                        sla: {}
                                    });
                                }}
                                className="btn-secondary text-sm flex items-center gap-2"
                            >
                                <Plus size={16}/> Add New Step
                            </button>
                       </div>
                   </div>
               )}
          </div>
      )}

      {activeTab === 'BRANDING' && (
          <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Branding Code Restored */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-[#1e2029] p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Visual Identity</h3>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Application Name</label>
                                <input 
                                    className="input-field" 
                                    value={brandingForm.appName}
                                    onChange={e => setBrandingForm({...brandingForm, appName: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Logo</label>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-xl bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden relative group">
                                        {brandingForm.logoUrl ? (
                                            <img src={brandingForm.logoUrl} className="w-full h-full object-contain" />
                                        ) : (
                                            <Image size={24} className="text-gray-300"/>
                                        )}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer" onClick={() => logoInputRef.current?.click()}>
                                            <Edit2 size={16} className="text-white"/>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload}/>
                                        <button onClick={() => logoInputRef.current?.click()} className="text-xs font-bold text-[var(--color-brand)] border border-[var(--color-brand)] px-3 py-1.5 rounded-lg hover:bg-[var(--color-brand)] hover:text-white transition-colors">
                                            Upload Logo
                                        </button>
                                        <p className="text-[10px] text-gray-400 mt-1">Recommended: 200x200px PNG</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-3">Font Family</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: 'sans', name: 'Clean Sans', font: 'font-sans' },
                                        { id: 'arial', name: 'Arial', font: 'font-[Arial]' }, // Added Arial
                                        { id: 'serif', name: 'Elegant Serif', font: 'font-serif' },
                                        { id: 'mono', name: 'Technical Mono', font: 'font-mono' }
                                    ].map(font => (
                                        <button
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
                    <div className="bg-white dark:bg-[#1e2029] p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Theme Colors</h3>
                        <div className="space-y-8">
                             <ColorPicker label="Primary Brand Color" value={brandingForm.primaryColor} onChange={c => setBrandingForm({...brandingForm, primaryColor: c})} />
                             <ColorPicker label="Secondary Color" value={brandingForm.secondaryColor} onChange={c => setBrandingForm({...brandingForm, secondaryColor: c})} />
                        </div>
                    </div>
                    
                    <div className="flex justify-end pt-4">
                        <button onClick={handleSaveBranding} className="btn-primary w-full md:w-auto py-3 px-8 text-base">Save Branding Changes</button>
                    </div>
                </div>
          </div>
      )}
      {activeTab === 'SECURITY' && (
          <div className="animate-fade-in space-y-6">
              {/* Security Dashboard Header */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-[#1e2029] p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-4 group hover:border-[var(--color-brand)] transition-all">
                      <div className="w-12 h-12 rounded-xl bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Users size={24}/>
                      </div>
                      <div>
                          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Members</div>
                          <div className="text-2xl font-black text-gray-900 dark:text-white line-height-1">
                              {users.filter(u => u.status !== 'ARCHIVED').length}
                          </div>
                      </div>
                  </div>

                  <div className="bg-white dark:bg-[#1e2029] p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-4 group hover:border-amber-400 transition-all cursor-pointer">
                      <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Clock size={24}/>
                      </div>
                      <div>
                          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Pending Access</div>
                          <div className="text-2xl font-black text-gray-900 dark:text-white line-height-1">
                              {users.filter(u => u.status === 'PENDING').length}
                          </div>
                      </div>
                  </div>

                  <div className="bg-white dark:bg-[#1e2029] p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-4 group hover:border-purple-400 transition-all">
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

                  <div className="bg-white dark:bg-[#1e2029] p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-4 group hover:border-blue-400 transition-all">
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

              {/* User Approval Requests (Integrated) */}
              {users.some(u => u.status === 'PENDING') && (
                  <div className="border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/10 p-4 rounded-r-2xl flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <AlertCircle className="text-amber-500" size={20}/>
                          <div>
                              <div className="font-bold text-amber-900 dark:text-amber-200">Pending User Requests</div>
                              <div className="text-xs text-amber-700 dark:text-amber-400">There are {users.filter(u => u.status === 'PENDING').length} users waiting for access approval.</div>
                          </div>
                      </div>
                      <button onClick={() => { setActiveRole({ id: 'PENDING_TAB', name: 'Pending Approvals' } as any); }} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-colors">Review Requests</button>
                  </div>
              )}

              <div className="flex flex-col md:flex-row gap-6 h-auto md:h-[calc(100vh-200px)] min-h-[600px]">

              {/* Sidebar: Roles List */}
              <div className="w-full md:w-80 flex-shrink-0 bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden max-h-[400px] md:max-h-none">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Security Roles</h3>
                      <button onClick={() => { setActiveRole(null); setIsRoleEditorOpen(true); }} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-[var(--color-brand)] transition-all active:scale-95 shadow-sm bg-white dark:bg-[#15171e] border border-gray-100 dark:border-gray-800"><Plus size={18}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
                      {/* Search Filter (Now more compact in sidebar) */}
                      <div className="relative mb-3 group">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[var(--color-brand)] transition-colors" size={14} />
                          <input 
                              type="text" 
                              placeholder="Quick find..." 
                              value={userSearch}
                              onChange={e => {
                                  setUserSearch(e.target.value);
                                  if (activeRole?.id !== 'ALL' && activeRole?.id !== 'PENDING_TAB') {
                                      setActiveRole({ id: 'ALL', name: 'Search Results', description: 'Searching across all users', permissions: [], isSystem: true } as any);
                                  }
                              }}
                              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#15171e] border border-gray-100 dark:border-gray-800 rounded-xl text-xs outline-none focus:ring-4 focus:ring-[var(--color-brand)]/10 focus:bg-white dark:focus:bg-[#1e2029] transition-all"
                          />
                      </div>

                      <button
                          onClick={() => { setActiveRole({ id: 'ALL', name: 'All Users', description: 'View all users across all roles', permissions: [], isSystem: true } as any); setUserSearch(''); }}
                          className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3 transition-all ${activeRole?.id === 'ALL' && !userSearch ? 'bg-[var(--color-brand)] text-white shadow-lg shadow-[var(--color-brand)]/20 scale-[1.02]' : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300'}`}
                      >
                           <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${activeRole?.id === 'ALL' && !userSearch ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-[#15171e] text-gray-500'}`}>
                                  <Users size={18}/>
                           </div>
                           <div className="flex-1 min-w-0">
                                  <div className="font-bold text-sm truncate uppercase tracking-tight">Main Directory</div>
                                  <div className={`text-[10px] font-bold ${activeRole?.id === 'ALL' && !userSearch ? 'text-white/80' : 'text-gray-400'}`}>{users.filter(u => u.status !== 'ARCHIVED').length} Active</div>
                           </div>
                      </button> 

                      {users.some(u => u.status === 'PENDING') && (
                          <button
                              onClick={() => { setActiveRole({ id: 'PENDING_TAB', name: 'Pending Approvals', description: 'Review and approve access requests', permissions: [], isSystem: true } as any); setUserSearch(''); }}
                              className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3 transition-all ${activeRole?.id === 'PENDING_TAB' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 scale-[1.02]' : 'hover:bg-amber-50 dark:hover:bg-amber-900/10 text-amber-600'}`}
                          >
                               <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${activeRole?.id === 'PENDING_TAB' ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'}`}>
                                      <Clock size={18}/>
                               </div>
                               <div className="flex-1 min-w-0">
                                      <div className="font-bold text-sm truncate uppercase tracking-tight">Approvals</div>
                                      <div className={`text-[10px] font-bold ${activeRole?.id === 'PENDING_TAB' ? 'text-white/80' : 'text-amber-500'}`}>{users.filter(u => u.status === 'PENDING').length} Required</div>
                               </div>
                          </button> 
                      )}
                      
                      <div className="pt-4 px-4 pb-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Security Roles</div>
                      
                      <div className="space-y-1">
                          {roles.map(role => (
                              <button
                                  key={role.id}
                                  onClick={() => { setActiveRole(role); setUserSearch(''); }}
                                  className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3 transition-all ${activeRole?.id === role.id ? 'bg-[var(--color-brand)] text-white shadow-lg shadow-[var(--color-brand)]/20 scale-[1.02]' : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 group'}`}
                              >
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${activeRole?.id === role.id ? 'bg-white/20 text-white' : role.id === 'ADMIN' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 group-hover:bg-purple-100' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 group-hover:bg-blue-100'}`}>
                                      <Shield size={18}/>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                  <div className="font-bold text-sm truncate tracking-tight">{role.name}</div>
                                      <div className={`text-[10px] font-bold ${activeRole?.id === role.id ? 'text-white/80' : 'text-gray-400'}`}>{users.filter(u => u.role === role.id && u.status !== 'ARCHIVED').length} members</div>
                                  </div>
                                  {activeRole?.id !== role.id && <ChevronRight size={14} className="text-gray-300 dark:text-gray-700 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"/>}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>

              {/* Main Content: Role Details */}
              <div className="flex-1 bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
                  {activeRole ? (
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
                                  <button onClick={() => deleteRole(activeRole.id)} className="btn-secondary text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 text-xs flex items-center gap-2">
                                      <Trash2 size={14}/> Delete Role
                                  </button>
                              )}
                          </div>

                          {/* Main Content Body */}
                          <div className="flex-1 overflow-y-auto custom-scrollbar">
                              {/* Integrated Pending Approvals View */}
                              {activeRole.id === 'PENDING_TAB' ? (
                                  <div className="p-6">
                                      <AdminAccessHub />
                                  </div>
                              ) : (
                                  <div className="p-6 space-y-8">
                                      {activeRole.id !== 'ALL' && (
                                          <div className="bg-gray-50/50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                                              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-[#1e2029]">
                                                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Lock size={14}/> Role Permissions</h3>
                                                  <span className="px-2 py-1 rounded bg-[var(--color-brand)]/10 text-[var(--color-brand)] text-[10px] font-bold">{activeRole.permissions.length} Active Rules</span>
                                              </div>
                                              <div className="p-6">
                                                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                                      {['Page Access', 'Functional Access', 'Admin Access'].map((category) => {
                                                          const categoryPerms = AVAILABLE_PERMISSIONS.filter(p => p.category === category);
                                                          return (
                                                              <div key={category} className="space-y-3">
                                                                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">{category}</div>
                                                                  <div className="bg-white dark:bg-[#15171e] border border-gray-100 dark:border-gray-800 rounded-xl divide-y divide-gray-50 dark:divide-gray-800/50">
                                                                      {categoryPerms.map(perm => {
                                                                          const isEnabled = activeRole.permissions.includes(perm.id);
                                                                          return (
                                                                              <div key={perm.id} className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                                                  <div className="flex-1">
                                                                                      <div className="font-bold text-xs text-gray-900 dark:text-white leading-tight">{perm.label}</div>
                                                                                      <div className="text-[10px] text-gray-400 mt-0.5">{perm.description}</div>
                                                                                  </div>
                                                                                  <button 
                                                                                      disabled={activeRole.id === 'ADMIN' && perm.id === 'manage_settings'} 
                                                                                      onClick={() => {
                                                                                          const newPerms = isEnabled 
                                                                                              ? activeRole.permissions.filter(p => p !== perm.id)
                                                                                              : [...activeRole.permissions, perm.id];
                                                                                          const updatedRole = { ...activeRole, permissions: newPerms };
                                                                                          updateRole(updatedRole);
                                                                                          setActiveRole(updatedRole);
                                                                                      }}
                                                                                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 ${isEnabled ? 'bg-[var(--color-brand)]' : 'bg-gray-200 dark:bg-gray-700'}`}
                                                                                  >
                                                                                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-[1.25rem]' : 'translate-x-[0.25rem]'}`} />
                                                                                  </button>
                                                                              </div>
                                                                          );
                                                                      })}
                                                                  </div>
                                                              </div>
                                                          );
                                                      })}
                                                  </div>
                                              </div>
                                          </div>
                                      )}

                                      <div>
                                          <div className="flex justify-between items-end mb-6">
                                              <div>
                                                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">User Management</h3>
                                                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                                                      {activeRole.id === 'ALL' ? 'Global Directory' : `${activeRole.name} Members`}
                                                  </div>
                                              </div>
                                              <button onClick={() => { setIsDirectoryModalOpen(true); setUserRoleFilter(activeRole.id === 'ALL' ? '' : activeRole.id); }} className="btn-primary py-2 px-5 text-xs flex items-center gap-2 rounded-xl shadow-lg shadow-[var(--color-brand)]/20">
                                                  <UserPlus size={16}/> Add {activeRole.id === 'ALL' ? 'User' : 'to Role'}
                                              </button>
                                          </div>

                                          <div className="bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                                              <table className="w-full text-left">
                                                  <thead>
                                                      <tr className="bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-gray-800">
                                                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">User Profile</th>
                                                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                                                      </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                                                      {users.filter(u => {
                                                          const matchesRole = activeRole.id === 'ALL' || u.role === activeRole.id;
                                                          const matchesSearch = !userSearch || 
                                                              u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
                                                              u.email.toLowerCase().includes(userSearch.toLowerCase());
                                                          const notArchived = u.status !== 'ARCHIVED';
                                                          return matchesRole && matchesSearch && notArchived;
                                                      }).length > 0 ? (
                                                          users.filter(u => {
                                                              const matchesRole = activeRole.id === 'ALL' || u.role === activeRole.id;
                                                              const matchesSearch = !userSearch || 
                                                                  u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
                                                                  u.email.toLowerCase().includes(userSearch.toLowerCase());
                                                              const notArchived = u.status !== 'ARCHIVED';
                                                              return matchesRole && matchesSearch && notArchived;
                                                          }).map(user => (
                                                              <tr key={user.id} className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
                                                                  <td className="px-6 py-4">
                                                                       <div className="flex items-center gap-4">
                                                                          <div className="relative shrink-0">
                                                                              <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white dark:border-[#1e2029] shadow-md group-hover:scale-105 transition-transform">
                                                                                <img src={user.avatar} className="w-full h-full object-cover bg-gray-100 dark:bg-gray-800" alt={user.name}/>
                                                                              </div>
                                                                              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-white dark:border-[#1e2029] ${user.status === 'APPROVED' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`}></div>
                                                                          </div>
                                                                          <div className="flex-1 min-w-0">
                                                                             <div className="font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none mb-1">{user.name}</div>
                                                                             <div className="text-xs text-gray-500 font-medium">{user.email}</div>
                                                                             <div className="flex flex-wrap gap-1 mt-2">
                                                                               <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-600' : 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]'}`}>{user.role}</span>
                                                                               {user.siteIds && user.siteIds.map(sid => {
                                                                                   const s = sites.find(x => x.id === sid);
                                                                                   return s ? <span key={sid} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-[9px] font-bold rounded text-gray-500 uppercase">{s.name}</span> : null;
                                                                               })}
                                                                             </div>
                                                                          </div>
                                                                       </div>
                                                                  </td>
                                                                  <td className="px-6 py-4 text-right">
                                                                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                          <button 
                                                                            onClick={() => {
                                                                                setInviteForm({
                                                                                    id: user.id,
                                                                                    name: user.name,
                                                                                    email: user.email,
                                                                                    jobTitle: user.jobTitle || '',
                                                                                    role: user.role,
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
                                                                              <button 
                                                                                  onClick={() => impersonateUser(user.id)}
                                                                                  className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                                                                                  title="View As"
                                                                              >
                                                                                  <Eye size={16}/>
                                                                              </button>
                                                                          )}
                                                                          <button 
                                                                            onClick={() => {
                                                                              if (window.confirm(`Are you sure you want to archive ${user.name}?`)) {
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
                                                          ))
                                                      ) : (
                                                          <tr><td colSpan={2} className="px-6 py-20 text-center text-gray-400">
                                                              <div className="flex flex-col items-center gap-3">
                                                                  <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center">
                                                                      <Search size={32} className="opacity-10"/>
                                                                  </div>
                                                                  <p className="font-bold text-sm tracking-tight text-gray-300">No users matched your request.</p>
                                                              </div>
                                                          </td></tr>
                                                      )}
                                                  </tbody>
                                              </table>
                                          </div>
                                      </div>
                                  </div>
                              )}
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
                          <button onClick={() => { setActiveRole(null); setIsRoleEditorOpen(true); }} className="btn-primary">Create New Role</button>
                      </div>
                  )}
              </div>

              {/* Role Creator Modal (Only for creating new roles now) */}
              {isRoleEditorOpen && !activeRole && (
                 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl w-[95%] max-w-lg p-6 animate-slide-up">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Create New Role</h2>
                        <div className="space-y-4">
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Role Name</label><input className="input-field mt-1" value={roleFormName} onChange={e => setRoleFormName(e.target.value)}/></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Description</label><input className="input-field mt-1" value={roleFormDesc} onChange={e => setRoleFormDesc(e.target.value)}/></div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button onClick={() => setIsRoleEditorOpen(false)} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button onClick={() => {
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
                       <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl w-[95%] max-w-2xl p-0 overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
                           
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
                                <button onClick={handleResetInviteWizard} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
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
                                           <button onClick={() => setInviteTab('SEARCH')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-xs font-bold transition-all ${inviteTab === 'SEARCH' ? 'bg-white dark:bg-[#1e2029] shadow text-[var(--color-brand)]' : 'text-gray-500'}`}>Search Users & Directory</button>
                                           <button onClick={() => setInviteTab('MEMBERS')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-xs font-bold transition-all ${inviteTab === 'MEMBERS' ? 'bg-white dark:bg-[#1e2029] shadow text-[var(--color-brand)]' : 'text-gray-500'}`}>Active Members</button>
                                           <button onClick={() => setInviteTab('MANUAL')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-xs font-bold transition-all ${inviteTab === 'MANUAL' ? 'bg-white dark:bg-[#1e2029] shadow text-[var(--color-brand)]' : 'text-gray-500'}`}>Manual Entry</button>
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
                                                                            {u.name.charAt(0)}
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
                                                            <button 
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
                                                   {users.filter(u => u.status !== 'ARCHIVED' && (userRoleFilter ? u.role !== userRoleFilter : true)).map(u => (
                                                       <div key={u.id} onClick={() => handleSelectUserForInvite({ id: u.id, name: u.name, email: u.email, jobTitle: u.jobTitle, isExisting: true, currentRole: u.role, currentSiteIds: u.siteIds || [] })} className="bg-white dark:bg-[#15171e] p-3 rounded-xl border border-gray-200 dark:border-gray-800 flex justify-between items-center group hover:border-[var(--color-brand)] hover:shadow-md transition-all cursor-pointer">
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
                                                               <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded uppercase">{u.role}</span>
                                                               <button className="text-[10px] font-bold text-[var(--color-brand)] opacity-0 group-hover:opacity-100 transition-opacity">Select &rarr;</button>
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
                                                   <button 
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
                                                 <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white dark:bg-[#1e2029] rounded-xl shadow-md flex items-center justify-center">
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
                                             <button 
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
                                                         <Shield size={14} className="text-[var(--color-brand)]"/> Assigned Role
                                                     </label>
                                                 </div>
                                                 <div className="grid grid-cols-1 gap-2">
                                                     {roles.map(r => (
                                                         <label 
                                                            key={r.id} 
                                                            className={`group relative flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${inviteForm.role === r.id ? 'bg-[var(--color-brand)]/5 border-[var(--color-brand)] shadow-lg shadow-[var(--color-brand)]/5' : 'bg-white dark:bg-[#15171e] border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}`}
                                                         >
                                                             <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${inviteForm.role === r.id ? 'border-[var(--color-brand)] bg-[var(--color-brand)]' : 'border-gray-300 dark:border-gray-700'}`}>
                                                                 {inviteForm.role === r.id && <Check size={12} className="text-white" />}
                                                             </div>
                                                             <input type="radio" name="role" className="hidden" checked={inviteForm.role === r.id} onChange={() => setInviteForm({...inviteForm, role: r.id})} />
                                                             <div className="relative min-w-0">
                                                                 <div className={`font-black text-sm mb-0.5 transition-colors ${inviteForm.role === r.id ? 'text-gray-900 dark:text-white' : 'text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300'}`}>{r.name}</div>
                                                                 <div className="text-[11px] text-gray-400 leading-relaxed font-medium line-clamp-2">{r.description}</div>
                                                             </div>
                                                             {inviteForm.role === r.id && (
                                                                 <div className="absolute right-0 top-0 bottom-0 w-1 bg-[var(--color-brand)]" />
                                                             )}
                                                         </label>
                                                     ))}
                                                 </div>
                                             </div>

                                             {/* Site Selection */}
                                             <div className="flex flex-col h-full">
                                                  <div className="flex items-center justify-between mb-4">
                                                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                          <MapPin size={14} className="text-emerald-500"/> Authorized Sites
                                                      </label>
                                                      {sites.length > 0 && (
                                                          <button 
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
                                                          Users will only have access to data and notifications related to the sites selected above.
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
                                   <button onClick={() => setInviteStep(1)} className="text-gray-500 font-bold text-sm hover:underline">Back</button>
                               ) : <div></div>}
                               
                               {inviteStep === 2 && (
                                   <button 
                                        onClick={async () => {
                                            // Handle Final Submit
                                            const isExisting = users.some(u => u.id === inviteForm.id || u.email === inviteForm.email);
                                             
                                             if (isExisting) {
                                                 const targetId = users.find(u => u.id === inviteForm.id || u.email === inviteForm.email)?.id;
                                                 if (targetId) {
                                                     await updateUserAccess(targetId, inviteForm.role as UserRole, inviteForm.siteIds);
                                                     alert(`Access updated for ${inviteForm.name}`);
                                                 }
                                             } else {
                                            
                                            // 1. Send Invite Logic
                                            let inviteSent = false;
                                            if (inviteForm.email && inviteForm.email.includes('@')) {
                                                const { error } = await supabase.auth.signInWithOtp({
                                                    email: inviteForm.email,
                                                    options: {
                                                        emailRedirectTo: window.location.origin,
                                                        data: {
                                                            full_name: inviteForm.name,
                                                            avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(inviteForm.name)}&background=random`
                                                        }
                                                    }
                                                });
                                                if (error) {
                                                    alert(`Could not send invite: ${error.message}`);
                                                    return;
                                                }
                                                inviteSent = true;
                                            }

                                            // 2. Add to DB
                                            await addUser({
                                                id: inviteForm.id || uuidv4(),
                                                name: inviteForm.name,
                                                email: inviteForm.email,
                                                role: inviteForm.role,
                                                jobTitle: inviteForm.jobTitle,
                                                siteIds: inviteForm.siteIds,
                                                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(inviteForm.name)}&background=random`,
                                                status: 'APPROVED', // Invited users are pre-approved
                                                createdAt: new Date().toISOString()
                                            } as any);

                                            if (inviteSent) alert(`Passcode login link sent to ${inviteForm.email}`);
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
                   <button onClick={() => setIsTeamsConfigOpen(true)} className="btn-secondary flex items-center gap-2 text-xs">
                        {teamsWebhookUrl ? <CheckCircle2 size={12} className="text-green-500"/> : <AlertCircle size={12} className="text-orange-500"/>}
                        Configure Teams
                   </button>
              </div>

              <div className="overflow-x-auto bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800">
                  <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400 min-w-[900px]">
                      <thead className="table-header">
                          <tr>
                              <th className="px-6 py-4 w-1/4">Event</th>
                              <th className="px-6 py-4">Recipients</th>
                              <th className="px-6 py-4 text-center">Status</th>
                              <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                          {notificationRules.map(rule => (
                              <tr key={rule.id} className="table-row">
                                  <td className="px-6 py-4">
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
                                      <button 
                                          onClick={() => handleToggleActive(rule)}
                                          className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase transition-colors ${rule.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}
                                      >
                                          {rule.isActive ? 'Active' : 'Disabled'}
                                      </button>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                      <button onClick={() => openRuleConfig(rule)} className="text-sm font-bold text-[var(--color-brand)] hover:underline">Configure</button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>

              {/* Rule Configuration Modal */}
              {isRuleModalOpen && editingRule && (
                 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl w-[95%] max-w-4xl p-0 overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-white/5">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <SettingsIcon size={20} className="text-[var(--color-brand)]"/>
                                    Configure Notification
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">Rule: <span className="font-bold text-gray-700 dark:text-gray-300">{editingRule.label}</span></p>
                            </div>
                            <button onClick={() => setIsRuleModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                        </div>
                        
                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            
                            {/* Recipients List */}
                            <div>
                                <div className="flex justify-between items-end mb-3">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Recipients</h3>
                                    
                                    {/* Add Recipient Dropdown */}
                                    <div className="relative group">
                                        <button className="btn-secondary text-xs flex items-center gap-1 py-1.5"><Plus size={14}/> Add Recipient</button>
                                        <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#15171e] rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 p-2 hidden group-hover:block z-50">
                                            <div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase">Dynamic</div>
                                            <button 
                                                onClick={() => setEditingRule({ ...editingRule, recipients: [...editingRule.recipients, { type: 'REQUESTER', id: 'requester', channels: { email: true, inApp: true, teams: false } }] })}
                                                className="w-full text-left px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                            >
                                                <User size={12} className="text-orange-500"/> Requester
                                            </button>

                                            <div className="border-t border-gray-100 dark:border-gray-800 my-1"></div>
                                            <div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase">Roles</div>
                                            {roles.map(r => (
                                                <button 
                                                    key={r.id}
                                                    onClick={() => setEditingRule({ ...editingRule, recipients: [...editingRule.recipients, { type: 'ROLE', id: r.id, channels: { email: true, inApp: true, teams: false } }] })}
                                                    className="w-full text-left px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                                >
                                                    <Shield size={12} className="text-purple-500"/> {r.name}
                                                </button>
                                            ))}
                                            
                                            <div className="border-t border-gray-100 dark:border-gray-800 my-1"></div>
                                            <button 
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

                                                    <button 
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
                            <button onClick={() => setIsRuleModalOpen(false)} className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-colors">Cancel</button>
                            <button onClick={handleSaveRule} className="btn-primary px-8 flex items-center gap-2">
                                <Save size={18}/> Save Changes
                            </button>
                        </div>
                    </div>
                 </div>
              )}

              {isTeamsConfigOpen && (
                 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl w-[95%] max-w-md p-6 animate-slide-up">
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
                            <button onClick={() => setIsTeamsConfigOpen(false)} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button onClick={() => { updateTeamsWebhook(teamsUrlForm); setIsTeamsConfigOpen(false); }} className="btn-primary">Save Configuration</button>
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
      </div>
      

      

      

      <style>{`
        .input-field { @apply w-full bg-white dark:bg-[#15171e] border border-gray-300 dark:border-gray-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)] outline-none transition-all; }
        .btn-primary { @apply bg-[var(--color-brand)] text-white px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity font-bold shadow-lg shadow-[var(--color-brand)]/20 active:scale-95; }
        .btn-secondary { @apply px-4 py-2.5 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors; }
        .table-header { @apply bg-gray-50 dark:bg-[#15171e] text-xs uppercase text-gray-500 font-bold border-b border-gray-200 dark:border-gray-800; }
        .table-row { @apply hover:bg-gray-50 dark:hover:bg-[#2b2d3b] transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0; }
        .badge { @apply inline-block bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-xs px-2.5 py-1 rounded-full font-medium border border-gray-200 dark:border-gray-700; }
        .icon-btn-blue { @apply p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors; }
        .icon-btn-red { @apply p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors; }
      `}</style>
                 {/* Manual Mapping Modal */}
             {isManualMapOpen && mappingSource && (
                 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl w-[95%] max-w-lg p-6 animate-slide-up">
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
                                        placeholder="Search by name on SKU..." 
                                        value={itemSearch}
                                        onChange={e => setItemSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                                    {items.filter(i => (i.name || '').toLowerCase().includes(itemSearch.toLowerCase()) || (i.sku || '').toLowerCase().includes(itemSearch.toLowerCase())).slice(0, 10).map(i => (
                                        <button 
                                            key={i.id}
                                            onClick={() => {
                                                // Confirm Map
                                                // Using updateMapping which is aliased to upsertMapping
                                                updateMapping({
                                                    id: uuidv4(), // Generate new ID
                                                    supplierId: mappingSource.supplierId,
                                                    supplierSku: mappingSource.supplierSku,
                                                    productId: i.id,
                                                    mappingStatus: 'CONFIRMED',
                                                    mappingMethod: 'MANUAL',
                                                    confidenceScore: 1.0,
                                                    supplierCustomerStockCode: mappingSource.customerStockCode,
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
                                <button onClick={() => { setIsManualMapOpen(false); setMappingSource(null); }} className="text-gray-500 hover:text-gray-700 font-bold text-sm">Cancel</button>
                            </div>
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
                              <button onClick={handleTestEmail} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-colors">
                                  Send Test Email
                              </button>
                              <button onClick={handleSaveEmailTemplate} className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg hover:opacity-90 font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2">
                                  <Save size={18} /> Save Changes
                              </button>
                          </div>
                      </div>

                      <div className="bg-white dark:bg-[#1e2029] rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 space-y-6">
                           <div>
                               <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Email Subject</label>
                               <input 
                                  className="input-field w-full font-medium"
                                  value={emailSubject}
                                  onChange={(e) => setEmailSubject(e.target.value)}
                                  placeholder="Welcome to ProcureFlow"
                               />
                           </div>

                           <div>
                               <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Email Body (HTML)</label>
                               <div className="text-xs text-gray-500 mb-2">
                                   Supported Placeholders: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{name}'}</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{app_name}'}</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{link}'}</code>
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
                                }}></div>
                           </div>
                      </div>
                 </div>
             )}
             {/* WORKFLOW STEP MODAL */}
             {editingStepId && (() => {
                 const step = workflowSteps.find(s => s.id === editingStepId);
                 if (!step) return null;
                 return (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl w-[95%] max-w-2xl p-0 overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
                            
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
                                <button onClick={() => setEditingStepId(null)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-gray-100 dark:border-gray-800 px-6 gap-6">
                                <button onClick={() => setActiveStepTab('GENERAL')} className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeStepTab === 'GENERAL' ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>General</button>
                                <button onClick={() => setActiveStepTab('NOTIFICATIONS')} className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeStepTab === 'NOTIFICATIONS' ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Notifications {(step.notifications?.length || 0) > 0 && <span className="ml-1 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full text-[10px]">{step.notifications?.length}</span>}</button>
                                <button onClick={() => setActiveStepTab('SLA')} className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeStepTab === 'SLA' ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>SLA {step.sla?.warnAfterHours && <span className="ml-1 text-[var(--color-brand)]">•</span>}</button>
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
                                            <label className="text-xs font-bold text-gray-500 uppercase">Approver Assignment</label>
                                            <div className="flex bg-gray-100 dark:bg-[#15171e] p-1 rounded-lg mt-1 mb-2">
                                                <button 
                                                    onClick={() => updateWorkflowStep({ ...step, approverType: 'ROLE', approverId: roles[0]?.id || '' })}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded-md transition-all ${step.approverType !== 'USER' ? 'bg-white dark:bg-[#2b2d3b] text-[var(--color-brand)] shadow-sm' : 'text-gray-500'}`}
                                                >
                                                    <Shield size={12}/> Role
                                                </button>
                                                <button 
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
                                            <button 
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
                                                    <button 
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

                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">Warning Threshold</label>
                                                <div className="flex items-center gap-2 mt-1">
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
                                                <label className="text-xs font-bold text-gray-500 uppercase">Escalation Threshold</label>
                                                <div className="flex items-center gap-2 mt-1">
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
                                <button onClick={() => setEditingStepId(null)} className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-colors">Close</button>
                            </div>
                        </div>
                    </div>
                 );
             })()}
    </div>
  );
};

export default Settings;