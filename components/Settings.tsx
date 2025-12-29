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
    Mail, Mail as MailIcon, Slack, Smartphone, ArrowDown, History, HelpCircle, Image, Tag, Save, Phone, Code, AlertCircle, Check, Info
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { SupplierStockSnapshot, Item, Supplier, Site, IncomingStock, UserRole, WorkflowStep, RoleDefinition, PermissionId, PORequest, POStatus } from '../types';
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

type AdminTab = 'PROFILE' | 'ITEMS' | 'CATALOG' | 'STOCK' | 'MAPPING' | 'SUPPLIERS' | 'SITES' | 'BRANDING' | 'SECURITY' | 'WORKFLOW' | 'NOTIFICATIONS' | 'MIGRATION';

const Settings = () => {
  const {
    currentUser, users, addUser, roles, hasPermission, createRole, updateRole, deleteRole, permissions, updateUserRole,
    teamsWebhookUrl, updateTeamsWebhook,
    theme, setTheme, branding, updateBranding,
    suppliers, addSupplier, updateSupplier, deleteSupplier,
    sites, addSite, updateSite, deleteSite,
    workflowSteps, updateWorkflowStep, addWorkflowStep, deleteWorkflowStep, notificationSettings, updateNotificationSetting, addNotificationSetting, deleteNotificationSetting,
    items, addItem, updateItem, deleteItem,
    catalog, updateCatalogItem, stockSnapshots,
    // Actions
    createPO, addSnapshot, importStockSnapshot, importMasterProducts, runDataBackfill, refreshAvailability,
    mappings, generateMappings, updateMapping,
    // New Admin Caps
    getItemFieldRegistry, runAutoMapping, getMappingQueue,  upsertProductMaster, reloadData, updateProfile, sendWelcomeEmail
  } = useApp();

  const location = useLocation();
  const [activeTab, setActiveTab] = useState<AdminTab>('PROFILE');

  useEffect(() => {
    const state = location.state as { activeTab?: AdminTab };
    if (state?.activeTab) {
      setActiveTab(state.activeTab);
    }
  }, [location.state]);

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
          jobTitle: u.jobTitle,
          role: activeRole ? activeRole.id : 'SITE_USER'
      });
      setInviteStep(2);
  };
  
  // --- Directory & Teams State ---
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState(false);
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryResults, setDirectoryResults] = useState<any[]>([]); // Mock User Objects
  
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
  const toggleNotificationChannel = (id: string, channel: 'email' | 'inApp' | 'teams') => { const setting = notificationSettings.find(n => n.id === id); if (setting) { updateNotificationSetting({ ...setting, channels: { ...setting.channels, [channel]: !setting.channels[channel] } }); } };
  const toggleNotificationRole = (settingId: string, roleId: UserRole) => { const setting = notificationSettings.find(n => n.id === settingId); if (!setting) return; const currentRoles = setting.recipientRoles; const newRoles = currentRoles.includes(roleId) ? currentRoles.filter(r => r !== roleId) : [...currentRoles, roleId]; updateNotificationSetting({ ...setting, recipientRoles: newRoles }); };

  // --- Directory Mock Logic ---
  const handleDirectorySearch = async () => {
    setDirectoryLoading(true);
    setDirectoryResults([]); 
    // Mock
    setTimeout(() => {
        const mockUsers = [
            { id: uuidv4(), name: 'Alice Smith', email: 'alice.smith@company.com', jobTitle: 'Procurement Specialist' },
            { id: uuidv4(), name: 'Bob Jones', email: 'bob.jones@company.com', jobTitle: 'Site Manager' },
            { id: uuidv4(), name: 'Carol White', email: 'carol.white@company.com', jobTitle: 'Finance Officer' },
            { id: uuidv4(), name: 'David Brown', email: 'david.brown@company.com', jobTitle: 'Operations' }
        ].filter(u => u.name.toLowerCase().includes(directorySearch.toLowerCase()) || u.email.includes(directorySearch));
        setDirectoryResults(mockUsers);
        setDirectoryLoading(false);
    }, 800);
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
             {currentUser?.role === 'ADMIN' && allTabs.map(tab => (
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
          <div className="animate-fade-in max-w-2xl mx-auto py-8">
               <div className="flex flex-col items-center">
                   {/* Start Node */}
                   <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full border border-gray-200 dark:border-gray-700 w-48 text-center relative z-10 shadow-sm">
                       <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Trigger</div>
                       <div className="font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2"><FileText size={16}/> PO Request Created</div>
                   </div>

                   {/* Connector */}
                   <div className="w-0.5 h-12 bg-gray-300 dark:bg-gray-700"></div>
                   
                   {/* Steps */}
                   {workflowSteps.sort((a,b) => a.order - b.order).map((step, idx) => (
                       <div key={step.id} className="flex flex-col items-center w-full group">
                           {/* Step Node */}
                           <div className={`bg-white dark:bg-[#1e2029] p-5 rounded-xl border ${step.isActive ? 'border-[var(--color-brand)]/30 ring-4 ring-[var(--color-brand)]/5' : 'border-gray-200 dark:border-gray-800 opacity-60'} w-full sm:w-[500px] shadow-lg shadow-gray-200/50 dark:shadow-none relative z-10 transition-all hover:scale-[1.02]`}>
                               <div className="absolute top-1/2 -right-12 translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => {
                                        if (idx > 0) {
                                            const prev = workflowSteps[idx - 1];
                                            updateWorkflowStep({ ...step, order: prev.order });
                                            updateWorkflowStep({ ...prev, order: step.order });
                                        }
                                    }} className="p-2 bg-white dark:bg-[#15171e] rounded-full border border-gray-200 dark:border-gray-700 hover:text-[var(--color-brand)] shadow-sm"><ArrowDown size={14} className="rotate-180"/></button>
                                    <button onClick={() => deleteWorkflowStep(step.id)} className="p-2 bg-white dark:bg-[#15171e] rounded-full border border-gray-200 dark:border-gray-700 hover:text-red-500 shadow-sm"><Trash2 size={14}/></button>
                               </div>

                               <div className="flex justify-between items-start mb-4">
                                   <div className="flex items-center gap-3">
                                       <div className="w-8 h-8 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center font-bold text-sm">
                                           {idx + 1}
                                       </div>
                                       <div>
                                           <h4 className="font-bold text-gray-900 dark:text-white">{step.stepName}</h4>
                                           <div className="text-xs text-gray-500">Approver: <span className="font-bold text-gray-700 dark:text-gray-300">{roles.find(r => r.id === step.approverRole)?.name || step.approverRole}</span></div>
                                       </div>
                                   </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={step.isActive} onChange={e => handleWorkflowUpdate(step.id, { isActive: e.target.checked })} />
                                        <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0px] after:left-[0px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-[var(--color-brand)]"></div>
                                    </label>
                               </div>
                               
                               {/* Inline Config */}
                               <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg flex gap-4 text-xs items-center">
                                    <div className="flex-1">
                                        <label className="block font-bold text-gray-400 uppercase text-[9px] mb-1">Condition</label>
                                        <select 
                                            value={step.conditionType} 
                                            onChange={e => handleWorkflowUpdate(step.id, { conditionType: e.target.value as any })}
                                            className="bg-transparent border-none p-0 text-gray-900 dark:text-gray-200 font-medium focus:ring-0 w-full cursor-pointer"
                                        >
                                            <option value="ALWAYS">Always Required</option>
                                            <option value="AMOUNT_GT">If Amount &gt;</option>
                                        </select>
                                    </div>
                                    {step.conditionType === 'AMOUNT_GT' && (
                                        <div className="w-24">
                                            <label className="block font-bold text-gray-400 uppercase text-[9px] mb-1">Value ($)</label>
                                            <input 
                                                type="number" 
                                                value={step.conditionValue || 0}
                                                onChange={e => handleWorkflowUpdate(step.id, { conditionValue: parseInt(e.target.value) })}
                                                className="bg-transparent border-b border-gray-300 dark:border-gray-600 p-0 text-gray-900 dark:text-gray-200 font-medium focus:ring-0 w-full text-right"
                                            />
                                        </div>
                                    )}
                               </div>
                           </div>
                           
                           {/* Connector + Add Button Overlay */}
                           <div className="w-0.5 h-16 bg-gray-300 dark:bg-gray-700 relative group/connector">
                                <button 
                                    onClick={() => {
                                        const newOrder = step.order + 0.5; // Will be normalized by backend or next sort
                                        // Actually order is integer usually. Let's just append for now to be safe, or use float if supported.
                                        // To simplfiy, just use "Add Next Step" button at bottom.
                                        // This insert button is nice but complex to manage order.
                                    }}
                                    className="hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-gray-800 rounded-full border border-gray-300 dark:border-gray-600 items-center justify-center hover:bg-[var(--color-brand)] hover:text-white hover:border-[var(--color-brand)] transition-all z-20"
                                    title="Insert Step"
                                >
                                    <Plus size={14}/>
                                </button>
                           </div>
                       </div>
                   ))}

                   {/* Add Step Button */}
                   <button onClick={() => {
                       const newOrder = workflowSteps.length > 0 ? Math.max(...workflowSteps.map(s => s.order)) + 1 : 1;
                       addWorkflowStep({
                           id: uuidv4(),
                           stepName: 'Approval Step',
                           approverRole: roles[0]?.id || 'ADMIN',
                           conditionType: 'ALWAYS',
                           order: newOrder,
                           isActive: true
                       });
                   }} className="w-10 h-10 rounded-full bg-white dark:bg-[#1e2029] border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-[var(--color-brand)] hover:border-[var(--color-brand)] hover:bg-[var(--color-brand)]/5 transition-all mb-4 shadow-sm z-10">
                       <Plus size={20}/>
                   </button>
                   
                   <div className="w-0.5 h-8 bg-gray-300 dark:bg-gray-700"></div>

                    {/* End Node */}
                   <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-full border border-green-200 dark:border-green-800 w-48 text-center relative z-10 shadow-sm">
                       <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-widest mb-1">Result</div>
                       <div className="font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2"><CheckCircle2 size={16} className="text-green-500"/> PO Approved</div>
                   </div>
               </div>
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
              {/* User Approval Requests */}
              <AdminAccessHub />

              <div className="flex flex-col md:flex-row gap-6 h-auto md:h-[calc(100vh-200px)] min-h-[600px]">

              {/* Sidebar: Roles List */}
              <div className="w-full md:w-64 flex-shrink-0 bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden max-h-[300px] md:max-h-none">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                      <h3 className="font-bold text-gray-900 dark:text-white">Roles</h3>
                      <button onClick={() => { setActiveRole(null); setIsRoleEditorOpen(true); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-[var(--color-brand)] transition-colors"><Plus size={18}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      <button
                          onClick={() => setActiveRole({ id: 'ALL', name: 'All Users', description: 'View all users across all roles', permissions: [], isSystem: true } as any)}
                          className={`w-full text-left px-3 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeRole?.id === 'ALL' ? 'bg-[var(--color-brand)] text-white shadow-md shadow-[var(--color-brand)]/20' : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300'}`}
                      >
                           <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeRole?.id === 'ALL' ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                  <User size={16}/>
                           </div>
                           <div className="flex-1 min-w-0">
                                  <div className="font-bold text-sm truncate">All Users</div>
                                  <div className={`text-[10px] truncate ${activeRole?.id === 'ALL' ? 'text-white/80' : 'text-gray-400'}`}>{users.length} Users</div>
                           </div>
                      </button> 
                      {roles.map(role => (
                          <button
                              key={role.id}
                              onClick={() => setActiveRole(role)}
                              className={`w-full text-left px-3 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeRole?.id === role.id ? 'bg-[var(--color-brand)] text-white shadow-md shadow-[var(--color-brand)]/20' : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300'}`}
                          >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeRole?.id === role.id ? 'bg-white/20 text-white' : role.id === 'ADMIN' ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-600' : 'bg-blue-100 dark:bg-blue-900/20 text-blue-600'}`}>
                                  <Shield size={16}/>
                              </div>
                              <div className="flex-1 min-w-0">
                                  <div className="font-bold text-sm truncate">{role.name}</div>
                                  <div className={`text-[10px] truncate ${activeRole?.id === role.id ? 'text-white/80' : 'text-gray-400'}`}>{role.permissions.length} Perms • {users.filter(u => u.role === role.id).length} Users</div>
                              </div>
                          </button>
                      ))}
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

                          {/* Tabs or Sections */}
                          <div className="flex-1 overflow-y-auto p-6">
                              <div className="mb-8">
                                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2"><Lock size={16}/> Permissions</h3>
                                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                                    {['Page Access', 'Functional Access', 'Admin Access'].map((category) => {
                                        const categoryPerms = AVAILABLE_PERMISSIONS.filter(p => p.category === category);
                                        return (
                                            <div key={category} className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                                                <div className="bg-gray-50 dark:bg-[#15171e] px-4 py-2 border-b border-gray-200 dark:border-gray-800 font-bold text-xs uppercase text-gray-500">
                                                    {category}
                                                </div>
                                                <div className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-[#1e2029]">
                                                    {categoryPerms.map(perm => {
                                                        const isEnabled = activeRole.permissions.includes(perm.id);
                                                        return (
                                                            <div key={perm.id} className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                                <div>
                                                                    <div className="font-medium text-sm text-gray-900 dark:text-white">{perm.label}</div>
                                                                    <div className="text-[11px] text-gray-400">{perm.description}</div>
                                                                </div>
                                                                <button 
                                                                    disabled={activeRole.id === 'ADMIN' && perm.id === 'manage_settings'} 
                                                                    onClick={() => {
                                                                        const newPerms = isEnabled 
                                                                            ? activeRole.permissions.filter(p => p !== perm.id)
                                                                            : [...activeRole.permissions, perm.id];
                                                                        
                                                                        // Update Role via context
                                                                        const updatedRole = { ...activeRole, permissions: newPerms };
                                                                        updateRole(updatedRole);
                                                                        setActiveRole(updatedRole);
                                                                    }}
                                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-2 ${isEnabled ? 'bg-[var(--color-brand)]' : 'bg-gray-200 dark:bg-gray-700'}`}
                                                                >
                                                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-4.5' : 'translate-x-1'}`} style={{ transform: isEnabled ? 'translateX(18px)' : 'translateX(2px)' }}/>
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

                              <div>
                                  <div className="flex justify-between items-center mb-4">
                                      <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2"><Users size={16}/> Assigned Users</h3>
                                      <button onClick={() => { setIsDirectoryModalOpen(true); setUserRoleFilter(activeRole.id); }} className="text-xs font-bold text-[var(--color-brand)] hover:underline flex items-center gap-1"><Plus size={12}/> Add Users</button>
                                  </div>
                                  <div className="bg-gray-50 dark:bg-[#15171e] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                                      <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                                          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                              {users.filter(u => u.role === activeRole.id).length > 0 ? (
                                                  users.filter(u => u.role === activeRole.id).map(user => (
                                                      <tr key={user.id} className="hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                                                          <td className="px-4 py-3 flex items-center gap-3">
                                                              <img src={user.avatar} className="w-8 h-8 rounded-full bg-white"/>
                                                              <div>
                                                                  <div className="font-bold text-gray-900 dark:text-white">{user.name}</div>
                                                                  <div className="text-xs">{user.email}</div>
                                                                  <div className="flex flex-wrap gap-1 mt-1">
                                                                    {user.siteIds && user.siteIds.map(sid => {
                                                                        const s = sites.find(x => x.id === sid);
                                                                        return s ? <span key={sid} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-[9px] rounded text-gray-500">{s.name}</span> : null;
                                                                    })}
                                                                  </div>
                                                              </div>
                                                          </td>
                                                          <td className="px-4 py-3 text-right">
                                                              <button onClick={() => updateUserRole(user.id, 'SITE_USER')} className="text-xs text-red-500 hover:underline">Remove</button>
                                                          </td>
                                                      </tr>
                                                  ))
                                              ) : (
                                                  <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-400 text-xs italic">No users assigned to this role.</td></tr>
                                              )}
                                          </tbody>
                                      </table>
                                  </div>
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
                                       Invite New User
                                   </h2>
                                   <p className="text-sm text-gray-500 mt-1">Add a new user to the organization and assign access.</p>
                               </div>
                               <button onClick={handleResetInviteWizard} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                   <X size={24}/>
                               </button>
                           </div>

                           {/* Wizard Steps Progress */}
                           <div className="flex border-b border-gray-100 dark:border-gray-800">
                               <div className={`flex-1 p-3 text-center text-sm font-bold border-b-2 transition-colors ${inviteStep >= 1 ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-gray-400'}`}>1. Identity</div>
                               <div className={`flex-1 p-3 text-center text-sm font-bold border-b-2 transition-colors ${inviteStep >= 2 ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-transparent text-gray-400'}`}>2. Access & Sites</div>
                           </div>

                           {/* Body */}
                           <div className="p-6 overflow-y-auto min-h-[300px]">
                               {inviteStep === 1 && (
                                   <div className="space-y-6">
                                       {/* Tab Switcher */}
                                       <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-full md:w-fit">
                                           <button onClick={() => setInviteTab('SEARCH')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-xs font-bold transition-all ${inviteTab === 'SEARCH' ? 'bg-white dark:bg-[#1e2029] shadow text-[var(--color-brand)]' : 'text-gray-500'}`}>Search Directory (Azure AD)</button>
                                           <button onClick={() => setInviteTab('MANUAL')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-xs font-bold transition-all ${inviteTab === 'MANUAL' ? 'bg-white dark:bg-[#1e2029] shadow text-[var(--color-brand)]' : 'text-gray-500'}`}>Manual Entry</button>
                                       </div>

                                       {inviteTab === 'SEARCH' ? (
                                           <div className="space-y-4">
                                               <div className="relative">
                                                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                   <input 
                                                       className="input-field pl-10 h-12 text-base" 
                                                       placeholder="Search name or email..." 
                                                       value={directorySearch} 
                                                       onChange={e => setDirectorySearch(e.target.value)}
                                                       onKeyDown={e => e.key === 'Enter' && handleDirectorySearch()}
                                                       autoFocus
                                                   />
                                                   <button onClick={handleDirectorySearch} className="absolute right-2 top-1/2 -translate-y-1/2 btn-secondary py-1 px-3 text-xs">Search</button>
                                               </div>
                                               
                                               <div className="space-y-2">
                                                    <h4 className="text-xs font-bold text-gray-500 uppercase">Search Results</h4>
                                                    {directoryLoading ? (
                                                       <div className="flex flex-col items-center justify-center py-8 text-gray-400 space-y-2 bg-gray-50 dark:bg-gray-800/10 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                                                            <div className="w-6 h-6 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin"></div>
                                                            <span className="text-xs">Searching Directory...</span>
                                                       </div>
                                                    ) : directoryResults.length > 0 ? (
                                                       <div className="grid grid-cols-1 gap-3">
                                                           {directoryResults.map(u => (
                                                               <div key={u.id} className="bg-white dark:bg-[#15171e] p-4 rounded-xl border border-gray-200 dark:border-gray-800 flex justify-between items-center group hover:border-[var(--color-brand)] hover:shadow-md transition-all cursor-pointer" onClick={() => handleSelectUserForInvite(u)}>
                                                                   <div className="flex items-center gap-3">
                                                                        <div className="w-10 h-10 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center font-bold">
                                                                            {u.name.charAt(0)}
                                                                        </div>
                                                                        <div>
                                                                           <div className="font-bold text-gray-900 dark:text-white">{u.name}</div>
                                                                           <div className="text-xs text-gray-500">{u.email}</div>
                                                                           <div className="text-[10px] text-gray-400 mt-0.5">{u.jobTitle}</div>
                                                                        </div>
                                                                   </div>
                                                                   <button className="btn-secondary text-xs">Select &rarr;</button>
                                                               </div>
                                                           ))}
                                                       </div>
                                                    ) : (
                                                        <div className="p-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                                                            No results found. Try a different search term or use Manual Entry.
                                                        </div>
                                                    )}
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
                                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-200 flex items-center justify-center font-bold text-lg">
                                                {inviteForm.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-white">{inviteForm.name}</div>
                                                <div className="text-xs text-gray-500">{inviteForm.email}</div>
                                            </div>
                                            <button onClick={() => setInviteStep(1)} className="ml-auto text-xs font-bold text-blue-600 hover:underline">Change User</button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Role Selection */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                                    <Shield size={14}/> Assigned Role
                                                </label>
                                                <div className="space-y-2">
                                                    {roles.map(r => (
                                                        <label key={r.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${inviteForm.role === r.id ? 'bg-[var(--color-brand)]/5 border-[var(--color-brand)] ring-1 ring-[var(--color-brand)]' : 'bg-white dark:bg-[#15171e] border-gray-200 dark:border-gray-800 hover:border-gray-300'}`}>
                                                            <input type="radio" name="role" className="mt-1" checked={inviteForm.role === r.id} onChange={() => setInviteForm({...inviteForm, role: r.id})} />
                                                            <div>
                                                                <div className="font-bold text-sm text-gray-900 dark:text-white">{r.name}</div>
                                                                <div className="text-xs text-gray-500 leading-snug mt-0.5">{r.description}</div>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Site Selection */}
                                            <div className="space-y-2">
                                                 <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                                    <MapPin size={14}/> Assigned Sites
                                                 </label>
                                                 <div className="bg-gray-50 dark:bg-[#15171e] rounded-xl border border-gray-200 dark:border-gray-800 p-3 max-h-[250px] overflow-y-auto">
                                                     {sites.length > 0 ? sites.map(s => (
                                                         <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-white/5 rounded-lg cursor-pointer">
                                                             <input 
                                                                type="checkbox" 
                                                                checked={inviteForm.siteIds.includes(s.id)} 
                                                                onChange={e => {
                                                                    const newSites = e.target.checked 
                                                                        ? [...inviteForm.siteIds, s.id]
                                                                        : inviteForm.siteIds.filter(id => id !== s.id);
                                                                    setInviteForm({...inviteForm, siteIds: newSites});
                                                                }}
                                                                className="rounded text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                                                             />
                                                             <span className="text-sm text-gray-700 dark:text-gray-300">{s.name}</span>
                                                         </label>
                                                     )) : <div className="text-xs text-gray-400 italic p-2">No sites available. Create sites first.</div>}
                                                 </div>
                                                 <p className="text-[10px] text-gray-400">User will only be able to view data for selected sites.</p>
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
                                            if (users.some(u => u.email === inviteForm.email)) { alert('User with this email already exists.'); return; }
                                            
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
                                            handleResetInviteWizard();
                                        }}
                                        className="btn-primary py-2 px-6 shadow-lg shadow-blue-500/20 flex items-center gap-2"
                                    >
                                        <Mail size={16}/> Send Invite & Add User
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
                          <h3 className="font-bold text-gray-900 dark:text-white">Notification Center</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Manage how users are notified of important events.</p>
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
                              <th className="px-6 py-4 w-1/3">Event Type</th>
                              <th className="px-6 py-4 text-center">Channels</th>
                              <th className="px-6 py-4">Recipients (Roles)</th>
                              <th className="px-6 py-4">Additional Recipients</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                          {notificationSettings.map(setting => (
                              <tr key={setting.id} className="table-row">
                                  <td className="px-6 py-4">
                                      <div className="font-bold text-gray-900 dark:text-white">{setting.label}</div>
                                      <div className="text-xs text-gray-400 font-mono mt-0.5">{setting.eventType}</div>
                                  </td>
                                  <td className="px-6 py-4">
                                      <div className="flex justify-center gap-4">
                                          <label className="flex flex-col items-center gap-1 cursor-pointer group">
                                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${setting.channels.email ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                                                  <MailIcon size={16}/>
                                              </div>
                                              <input type="checkbox" className="sr-only" checked={setting.channels.email} onChange={() => toggleNotificationChannel(setting.id, 'email')}/>
                                              <span className="text-[9px] font-bold uppercase text-gray-400 group-hover:text-blue-500">Email</span>
                                          </label>
                                          
                                          <label className="flex flex-col items-center gap-1 cursor-pointer group">
                                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${setting.channels.inApp ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                                                  <Bell size={16}/>
                                              </div>
                                              <input type="checkbox" className="sr-only" checked={setting.channels.inApp} onChange={() => toggleNotificationChannel(setting.id, 'inApp')}/>
                                              <span className="text-[9px] font-bold uppercase text-gray-400 group-hover:text-amber-500">In-App</span>
                                          </label>

                                          <label className="flex flex-col items-center gap-1 cursor-pointer group">
                                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${setting.channels.teams ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                                                  <ArrowDown size={16} className={setting.channels.teams ? 'text-[#6264A7]' : ''}/> 
                                              </div>
                                              <input type="checkbox" className="sr-only" checked={setting.channels.teams || false} onChange={() => toggleNotificationChannel(setting.id, 'teams')}/>
                                              <span className="text-[9px] font-bold uppercase text-gray-400 group-hover:text-indigo-500">Teams</span>
                                          </label>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4">
                                      <div className="flex flex-wrap gap-1">
                                          {setting.recipientRoles.map(roleId => {
                                              const r = roles.find(r => r.id === roleId);
                                              return r ? (
                                                  <button key={roleId} onClick={() => toggleNotificationRole(setting.id, roleId)} className="badge badge-blue hover:bg-red-100 hover:text-red-600 transition-colors flex items-center gap-1">
                                                      {r.name} <X size={10}/>
                                                  </button>
                                              ) : null;
                                          })}
                                          <div className="relative group">
                                              <button className="badge bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"><Plus size={12}/></button>
                                              <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-[#15171e] rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 p-2 hidden group-hover:block z-20">
                                                  <div className="text-xs font-bold text-gray-400 px-2 py-1 uppercase">Add Role</div>
                                                  {roles.filter(r => !setting.recipientRoles.includes(r.id)).map(r => (
                                                      <button key={r.id} onClick={() => toggleNotificationRole(setting.id, r.id)} className="w-full text-left px-2 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg">
                                                          {r.name}
                                                      </button>
                                                  ))}
                                              </div>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4">
                                      <input 
                                          type="text" 
                                          placeholder="finance@example.com"
                                          className="input-field py-1 text-xs w-full"
                                          value={(setting.customEmails || []).join(', ')}
                                          onChange={e => {
                                              const emails = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                              updateNotificationSetting({ ...setting, customEmails: emails });
                                          }}
                                      />
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>

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

    </div>
  );
};

export default Settings;