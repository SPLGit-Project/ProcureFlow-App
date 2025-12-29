
import { Item, PORequest, Supplier, User, SupplierCatalogItem, SupplierStockSnapshot, Site, WorkflowStep, NotificationRule, Permission, RoleDefinition } from '../types';

export const ALL_PERMISSIONS: Permission[] = [
    { id: 'view_dashboard', label: 'View Dashboard', description: 'Access the main dashboard.', category: 'General' },
    { id: 'create_request', label: 'Create Requests', description: 'Create and submit new purchase orders.', category: 'General' },
    { id: 'view_all_requests', label: 'View All Requests', description: 'See requests from other users.', category: 'General' },
    { id: 'receive_goods', label: 'Receive Goods', description: 'Record deliveries against POs.', category: 'General' },
    
    { id: 'approve_requests', label: 'Approve Requests', description: 'Authorize pending POs.', category: 'Admin' },
    { id: 'link_concur', label: 'Link Concur', description: 'Enter SAP Concur PO numbers.', category: 'Admin' },
    { id: 'view_finance', label: 'View Finance', description: 'Access finance dashboard.', category: 'Admin' },
    { id: 'manage_finance', label: 'Manage Finance', description: 'Edit capitalization and invoices.', category: 'Admin' },
    { id: 'manage_settings', label: 'Manage Settings', description: 'Access admin panel.', category: 'Admin' },
    { id: 'manage_items', label: 'Manage Items', description: 'Create/Edit items and catalog.', category: 'Admin' },
    { id: 'manage_suppliers', label: 'Manage Suppliers', description: 'Create/Edit suppliers.', category: 'Admin' },
];

export const MOCK_ROLES: RoleDefinition[] = [
    { 
        id: 'SITE_USER', name: 'Site User', description: 'Standard requester.', isSystem: true,
        permissions: ['view_dashboard', 'create_request', 'receive_goods'] 
    },
    { 
        id: 'APPROVER', name: 'Approver', description: 'Can authorize requests.', isSystem: true,
        permissions: ['view_dashboard', 'view_all_requests', 'approve_requests'] 
    },
    { 
        id: 'ADMIN', name: 'Administrator', description: 'Full system access.', isSystem: true,
        permissions: ['view_dashboard', 'create_request', 'view_all_requests', 'approve_requests', 'link_concur', 'receive_goods', 'view_finance', 'manage_finance', 'manage_settings', 'manage_items', 'manage_suppliers'] 
    }
];

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Alice Site-User', email: 'alice@company.com', role: 'SITE_USER', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice', siteIds: ['site-1', 'site-2'] },
  { id: 'u2', name: 'Bob Approver', email: 'bob@company.com', role: 'APPROVER', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob', siteIds: ['site-1'] },
  { id: 'u3', name: 'Charlie Admin', email: 'charlie@company.com', role: 'ADMIN', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie', siteIds: [] },
  { id: 'u4', name: 'Dave Admin', email: 'dave@company.com', role: 'ADMIN', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dave', siteIds: [] },
  { id: 'u5', name: 'Sarah Admin', email: 'sarah@company.com', role: 'ADMIN', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah', siteIds: [] },
];

export const MOCK_SITES: Site[] = [
    { id: 'site-1', name: 'SPL Adelaide', suburb: 'Torrensville', address: '123 Ashwin Parade', state: 'SA', zip: '5031', contactPerson: 'Site Manager SA' },
    { id: 'site-2', name: 'SPL Brisbane', suburb: 'Meadowbrook', address: '50 University Drive', state: 'QLD', zip: '4131', contactPerson: 'Site Manager QLD' },
    { id: 'site-3', name: 'SPL Mackay', suburb: 'Paget', address: '15 Gateway Drive', state: 'QLD', zip: '4740', contactPerson: 'Site Manager Mackay' },
    { id: 'site-4', name: 'SPL Melbourne', suburb: 'Broadmeadows', address: '1100 Pascoe Vale Rd', state: 'VIC', zip: '3047', contactPerson: 'Site Manager VIC' },
    { id: 'site-5', name: 'SPL Perth', suburb: 'Belmont', address: '200 Great Eastern Hwy', state: 'WA', zip: '6104', contactPerson: 'Site Manager WA1' },
    { id: 'site-6', name: 'SPL Perth', suburb: 'Maddington', address: '55 Kelvin Rd', state: 'WA', zip: '6109', contactPerson: 'Site Manager WA2' },
    { id: 'site-7', name: 'SPL Sydney', suburb: 'Bankstown', address: '350 Hume Hwy', state: 'NSW', zip: '2200', contactPerson: 'Site Manager NSW' },
    { id: 'site-8', name: 'SPL Sydney', suburb: 'Classic Linen', address: '350 Hume Hwy', state: 'NSW', zip: '2200', contactPerson: 'Linen Manager' }, 
];

export const MOCK_SUPPLIERS: Supplier[] = [
  { 
    id: 's1', 
    name: 'Global Textile', 
    contactEmail: 'bianca@globaltextiles.net.au', 
    keyContact: 'Bianca Moses', 
    phone: '02 97592323',
    address: '22-24 Minnie St',
    categories: ['Textiles', 'Bedding'] 
  },
  { 
    id: 's2', 
    name: 'HOST Supplies', 
    contactEmail: 'anita@hostsupplies.com.au', 
    keyContact: 'Anita',
    phone: '02 9516 4533',
    address: '104 Marrickville Road, Marrickville',
    categories: ['Hospitality', 'Consumables'] 
  },
  { 
    id: 's3', 
    name: 'NCC Apparel Pty Ltd', 
    contactEmail: 'jsmith@nccapparel.com.au', 
    keyContact: 'Julie Smith',
    phone: '+61 416 035 998',
    address: '64-66 Cyber Loop, Dandenong South',
    categories: ['Apparel', 'Uniforms'] 
  },
  { 
    id: 's4', 
    name: 'Simba Global', 
    contactEmail: 'jcronin@simba.global', 
    keyContact: 'Janet Cronin',
    phone: '+61 (3) 9020 3695',
    address: '289-311 Bayswater Road, Bayswater',
    categories: ['Textiles', 'Sourcing'] 
  },
];

export const MOCK_ITEMS: Item[] = [
  { id: 'i1', sku: 'GT-SHEET-K', name: 'Premium Cotton Sheet (King)', description: '500TC White Cotton', unitPrice: 45.00, uom: 'Each', category: 'Textiles', stockLevel: 0, supplierId: 's1' },
  { id: 'i2', sku: 'GT-TOWEL-W', name: 'Bath Towel - White', description: 'Standard Hotel Grade', unitPrice: 12.50, uom: 'Each', category: 'Textiles', stockLevel: 0, supplierId: 's1' },
  { id: 'i3', sku: 'HS-NAP-2PLY', name: 'Napkins 2-Ply (Pack 100)', description: 'White Dinner Napkins', unitPrice: 8.50, uom: 'Pack', category: 'Consumables', stockLevel: 0, supplierId: 's2' },
  { id: 'i4', sku: 'HS-CUT-SET', name: 'Stainless Cutlery Set', description: 'Fork, Knife, Spoon', unitPrice: 4.20, uom: 'Set', category: 'Hospitality', stockLevel: 0, supplierId: 's2' },
  { id: 'i5', sku: 'NCC-VEST-L', name: 'Hi-Vis Safety Vest (L)', description: 'Orange with Reflective Strip', unitPrice: 15.00, uom: 'Each', category: 'Apparel', stockLevel: 0, supplierId: 's3' },
  { id: 'i6', sku: 'SG-MAT-B', name: 'Bath Mat - Blue', description: 'Heavy weight cotton', unitPrice: 9.00, uom: 'Each', category: 'Textiles', stockLevel: 0, supplierId: 's4' },
];

export const MOCK_CATALOG: SupplierCatalogItem[] = [
  { id: 'c1', itemId: 'i1', supplierId: 's1', supplierSku: 'GT-500TC-K', price: 45.00 },
  { id: 'c2', itemId: 'i2', supplierId: 's1', supplierSku: 'GT-BTW-001', price: 12.50 },
  { id: 'c3', itemId: 'i3', supplierId: 's2', supplierSku: 'HOST-NAP-W', price: 8.25 },
  { id: 'c4', itemId: 'i4', supplierId: 's2', supplierSku: 'HOST-CS-01', price: 4.20 },
  { id: 'c5', itemId: 'i5', supplierId: 's3', supplierSku: 'NCC-HV-OR-L', price: 14.50 },
  { id: 'c6', itemId: 'i6', supplierId: 's4', supplierSku: 'SIM-BM-BL', price: 9.00 },
];

export const MOCK_SNAPSHOTS: SupplierStockSnapshot[] = [
  { 
    id: 'snap-1', 
    supplierId: 's1', 
    supplierSku: 'GT-500TC-K', 
    productName: 'Premium Cotton Sheet (King)', 
    availableQty: 120, 
    stockOnHand: 150,
    committedQty: 30,
    backOrderedQty: 0,
    totalStockQty: 150,
    snapshotDate: new Date(Date.now() - 86400000).toISOString(),
    sourceReportName: 'GT_Daily_Stock.csv' 
  },
  { 
    id: 'snap-2', 
    supplierId: 's2', 
    supplierSku: 'HOST-NAP-W', 
    productName: 'Napkins 2-Ply', 
    availableQty: 500, 
    stockOnHand: 500,
    committedQty: 0,
    backOrderedQty: 0,
    totalStockQty: 500,
    snapshotDate: new Date(Date.now() - 43200000).toISOString(),
    sourceReportName: 'Host_Inv_Update.csv' 
  },
];

export const MOCK_POS: PORequest[] = [
  {
    id: 'REQ-2023-001',
    requestDate: '2023-10-01',
    requesterId: 'u1',
    requesterName: 'Alice Site-User',
    site: 'SPL Brisbane-Meadowbrook',
    supplierId: 's1',
    supplierName: 'Global Textile',
    status: 'ACTIVE', 
    totalAmount: 1425,
    approvalHistory: [
      { id: 'ev1', action: 'SUBMITTED', approverName: 'Alice Site-User', date: '2023-10-01' },
      { id: 'ev2', action: 'APPROVED', approverName: 'Bob Approver', date: '2023-10-02', comments: 'Approved.' }
    ],
    lines: [
      { id: 'l1', itemId: 'i1', itemName: 'Premium Cotton Sheet (King)', sku: 'GT-500TC-K', unitPrice: 45.00, quantityOrdered: 20, quantityReceived: 0, totalPrice: 900, concurPoNumber: 'PO-9901' },
      { id: 'l2', itemId: 'i2', itemName: 'Bath Towel - White', sku: 'GT-BTW-001', unitPrice: 12.50, quantityOrdered: 42, quantityReceived: 0, totalPrice: 525, concurPoNumber: 'PO-9901' },
    ],
    deliveries: []
  },
  {
    id: 'REQ-2023-002',
    requestDate: '2023-10-05',
    requesterId: 'u1',
    requesterName: 'Alice Site-User',
    site: 'SPL Sydney-Bankstown',
    supplierId: 's2',
    supplierName: 'HOST Supplies',
    status: 'APPROVED_PENDING_CONCUR',
    totalAmount: 412.50,
    approvalHistory: [
        { id: 'ev3', action: 'SUBMITTED', approverName: 'Alice Site-User', date: '2023-10-05' },
        { id: 'ev3b', action: 'APPROVED', approverName: 'Bob Approver', date: '2023-10-06' }
    ],
    lines: [
      { id: 'l3', itemId: 'i3', itemName: 'Napkins 2-Ply (Pack 100)', sku: 'HOST-NAP-W', unitPrice: 8.25, quantityOrdered: 50, quantityReceived: 0, totalPrice: 412.50 },
    ],
    deliveries: []
  },
];

export const MOCK_WORKFLOW_STEPS: WorkflowStep[] = [
    { id: 'wf-1', stepName: 'Site Approval', approverRole: 'APPROVER', conditionType: 'ALWAYS', order: 1, isActive: true },
    { id: 'wf-2', stepName: 'Regional Approval', approverRole: 'ADMIN', conditionType: 'AMOUNT_GT', conditionValue: 1000, order: 2, isActive: true },
    { id: 'wf-3', stepName: 'Final Approval', approverRole: 'ADMIN', conditionType: 'AMOUNT_GT', conditionValue: 5000, order: 3, isActive: true },
];

export const MOCK_NOTIFICATIONS: NotificationRule[] = [
    { 
        id: 'notif-1', 
        eventType: 'PO_CREATED', 
        label: 'New Purchase Order Created', 
        isActive: true,
        recipients: [
            { id: 'APPROVER', type: 'ROLE', label: 'Approver', channels: { email: true, inApp: true, teams: false } }
        ] 
    },
    { 
        id: 'notif-2', 
        eventType: 'PO_APPROVED', 
        label: 'Purchase Order Approved', 
        isActive: true,
        recipients: [
            { id: 'SITE_USER', type: 'ROLE', label: 'Site Users', channels: { email: true, inApp: true, teams: false } },
            { id: 'ADMIN', type: 'ROLE', label: 'Admins', channels: { email: true, inApp: true, teams: false } }
        ]
    },
    { 
        id: 'notif-3', 
        eventType: 'PO_REJECTED', 
        label: 'Purchase Order Rejected', 
        isActive: true,
        recipients: [
             { id: 'SITE_USER', type: 'ROLE', label: 'Site Users', channels: { email: true, inApp: true, teams: false } }
        ]
    },
    { 
        id: 'notif-4', 
        eventType: 'DELIVERY_RECEIVED', 
        label: 'Goods Received at Site', 
        isActive: true,
        recipients: [
            { id: 'ADMIN', type: 'ROLE', label: 'Admins', channels: { email: false, inApp: true, teams: false } }
        ]
    },
    { 
        id: 'notif-5', 
        eventType: 'STOCK_LOW', 
        label: 'Supplier Stock Low', 
        isActive: true,
        recipients: [
            { id: 'ADMIN', type: 'ROLE', label: 'Admins', channels: { email: true, inApp: false, teams: true } }
        ]
    },
    { 
        id: 'notif-6', 
        eventType: 'PO_CAPITALIZED', 
        label: 'Asset Capitalized', 
        isActive: true,
        recipients: [
            { id: 'finance@company.com', type: 'EMAIL', label: 'Finance Team', channels: { email: true, inApp: false, teams: false } }
        ] 
    }
];
