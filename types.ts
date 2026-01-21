
export type UserRole = string; // Was union, now string to support dynamic roles

export type PermissionId = 
  | 'view_dashboard'
  | 'view_items'
  | 'view_stock'
  | 'view_mapping'
  | 'view_suppliers'
  | 'view_sites'
  | 'view_workflow'
  | 'view_security'
  | 'view_notifications'
  | 'view_branding'
  | 'create_request'
  | 'view_all_requests'
  | 'approve_requests'
  | 'link_concur'
  | 'receive_goods'
  | 'view_finance'
  | 'manage_finance'
  | 'manage_settings'
  | 'manage_items'
  | 'manage_suppliers';

export interface Permission {
    id: PermissionId;
    label: string;
    description: string;
    category: 'General' | 'Admin';
}

export interface RoleDefinition {
    id: string;
    name: string;
    description: string;
    permissions: PermissionId[];
    isSystem: boolean; // System roles cannot be deleted
}

export interface User {
  id: string;
  name: string;
  role: UserRole; // Links to RoleDefinition.id
  realRole?: UserRole; // Stays as the DB role during session-based switching
  avatar: string;
  email: string;
  jobTitle?: string;
  status?: 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED' | 'ARCHIVED';
  createdAt?: string;
  siteIds: string[]; // List of site IDs this user has access to
  department?: string;
  approvalReason?: string;
  invitedAt?: string;
  invitationExpiresAt?: string;
}

export interface EmailTemplate {
  subject: string;
  body: string; // HTML supported
}

export interface AppBranding {
  appName: string;
  logoUrl: string;
  primaryColor: string; // Hex code
  secondaryColor: string; // Hex code
  fontFamily: 'sans' | 'serif' | 'mono';
  sidebarTheme?: 'dark' | 'light' | 'brand' | 'system';
  emailTemplate?: EmailTemplate;
}

export interface AuthConfig {
    enabled: boolean;
    provider: 'AZURE_AD';
    tenantId: string;
    clientId: string;
    allowedDomains: string[]; // e.g. ["procureflow.com"]
}

export interface Site {
    id: string;
    name: string;
    suburb: string;
    address: string;
    state: string;
    zip: string;
    contactPerson: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactEmail: string;
  keyContact: string;
  phone: string;
  address: string;
  categories: string[];
}

export interface Item {
  id: string;
  sku: string; // Internal SKU (Mapped from SAP_Item_Code)
  name: string;
  description: string;
  unitPrice: number; // Default/Internal Price
  uom: string; // Unit of Measure
  category: string;
  subCategory?: string; // New field for hierarchy
  stockLevel: number; // Deprecated
  supplierId: string; // Deprecated
  
  // Legacy Attributes
  specs?: {
    weight?: string;
    color?: string;
    size?: string;
    material?: string;
    measurements?: string;
  };
  isRfid?: boolean;
  isCog?: boolean; // Customer Owned Goods
  
  // Categorization & Metadata
  rangeName?: string;
  stockType?: string;
  activeFlag?: boolean;
  createdAt?: string;
  updatedAt?: string;
  
  // Normalization
  sapItemCodeRaw?: string;
  sapItemCodeNorm?: string;
  
  // Master Data Fields
  defaultOrderMultiple?: number;
  totalAvailableOrderQty?: number;

  // Extended Attributes
  itemWeight?: number;
  itemPool?: string;
  itemCatalog?: string;
  itemType?: string;
  rfidFlag?: boolean;
  itemColour?: string;
  itemPattern?: string;
  itemMaterial?: string;
  itemSize?: string;
  measurements?: string;
  cogFlag?: boolean;
  cogCustomer?: string;
}

export interface SupplierCatalogItem {
  id: string;
  itemId: string; // Link to internal Item
  supplierId: string;
  supplierSku: string;
  price: number;
}

export interface IncomingStock {
  month: string; // e.g., "Dec 2025"
  qty: number;
}

export interface SupplierStockSnapshot {
  id: string;
  supplierId: string;
  supplierSku: string;
  productName: string;
  
  // Categorization
  customerStockCode?: string;
  range?: string;
  category?: string;
  subCategory?: string;
  stockType?: string;

  // Normalization
  customerStockCodeRaw?: string;
  customerStockCodeNorm?: string;
  customerStockCodeAltNorm?: string;
  
  // Quantities
  cartonQty?: number;
  stockOnHand: number;
  committedQty: number;
  backOrderedQty: number;
  availableQty: number; // The "truth" base
  totalStockQty: number;
  
  // Financials
  unitPrice?: number; // Internal / Cost
  sellPrice?: number; // Sell $ (from report)
  sohValueAtSell?: number; // SOH $ @ Sell (from report)

  incomingStock?: IncomingStock[];
  snapshotDate: string; // ISO string
  sourceReportName: string;
}

export type MappingStatus = 'PROPOSED' | 'CONFIRMED' | 'REJECTED';
export type MappingMethod = 'MANUAL' | 'IMPORT' | 'AUTO' | 'LEGACY' | 'AUTO_NORM' | 'AUTO_ALT' | 'AUTO_LEGACY' | 'AUTO_FUZZY';

export interface SupplierProductMap {
  id: string;
  supplierId: string;
  productId: string; // Internal Item ID
  supplierSku: string;
  supplierCustomerStockCode?: string;
  matchPriority: number;
  packConversionFactor: number;
  mappingStatus: MappingStatus;
  mappingMethod: MappingMethod;
  confidenceScore: number;
  updatedAt: string;
  
  // Joins (optional for UI)
  supplierName?: string;
  productName?: string;
  internalSku?: string;
}

export interface ProductAvailability {
  id: string;
  productId: string;
  supplierId: string;
  availableUnits: number;
  availableOrderQty: number; // The calculated ordering number
  updatedAt: string;
}



export type POStatus = 
  | 'DRAFT' 
  | 'PENDING_APPROVAL' 
  | 'REJECTED' 
  | 'APPROVED_PENDING_CONCUR' // Approved internally, waiting for user to create in Concur
  | 'ACTIVE' // Created in Concur, ready for delivery
  | 'PARTIALLY_RECEIVED' 
  | 'RECEIVED' 
  | 'VARIANCE_PENDING'
  | 'CLOSED';

export interface PORequest {
  id: string;
  displayId?: string; // For user-facing formatted ID
  requestDate: string;
  requesterId: string;
  requesterName: string;
  siteId?: string; // ID reference for DB
  site: string; // Name reference
  supplierId: string;
  supplierName: string;
  status: POStatus;
  totalAmount: number;
  approvalHistory: ApprovalEvent[];
  lines: POLineItem[];
  deliveries: DeliveryHeader[];
  
  // New Fields
  customerName?: string;
  reasonForRequest?: 'Depletion' | 'New Customer' | 'Other';
  comments?: string;
}

export interface POLineItem {
  id: string;
  itemId: string;
  itemName: string;
  sku: string; // Supplier SKU
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
  totalPrice: number;
  // Concur Linkage
  concurPoNumber?: string; // The external PO number from Concur
  isForceClosed?: boolean; // If true, line is considered complete even if qty < ordered
}

export interface ApprovalEvent {
  id: string;
  approverName: string;
  date: string;
  action: 'APPROVED' | 'REJECTED' | 'SUBMITTED';
  comments?: string;
}

export interface DeliveryHeader {
  id: string;
  date: string;
  docketNumber: string;
  receivedBy: string;
  lines: DeliveryLineItem[];
}

export interface DeliveryLineItem {
  id: string; // Unique ID for this specific delivery event line
  poLineId: string;
  quantity: number;
  // Finance Fields
  invoiceNumber?: string;
  isCapitalised: boolean;
  capitalisedDate?: string; // Changed from capitalisedMonth to full date
}

// --- Workflow & Admin Types ---

export interface StepNotificationRule {
    id: string;
    trigger: 'ON_START' | 'ON_APPROVE' | 'ON_REJECT' | 'ON_OVERDUE';
    recipientType: 'USER' | 'ROLE' | 'REQUESTER' | 'EMAIL';
    recipientId: string;
    channels: { email: boolean; inApp: boolean; teams: boolean; };
    customMessage?: string;
}

export interface WorkflowSLA {
    warnAfterHours?: number;
    escalateAfterHours?: number;
    escalateToRoleId?: string;
}

export interface WorkflowStep {
    id: string;
    stepName: string;
    approverRole?: UserRole; // Deprecated in favor of approverId + approverType
    approverType: 'ROLE' | 'USER';
    approverId: string; // Role ID or User ID
    conditionType: 'ALWAYS' | 'AMOUNT_GT';
    conditionValue?: number;
    order: number;
    isActive: boolean;
    notifications?: StepNotificationRule[]; // Embedded rules
    sla?: WorkflowSLA; // Service Level Agreement
}


export type NotificationEventType = 'PO_CREATED' | 'PO_APPROVED' | 'PO_REJECTED' | 'DELIVERY_RECEIVED' | 'STOCK_LOW' | 'PO_CAPITALIZED';

export interface NotificationRecipient {
    id: string; // Role ID, User ID, "requester", or email address
    type: 'ROLE' | 'USER' | 'EMAIL' | 'REQUESTER';
    label: string; // Display name
    channels: {
        email: boolean;
        inApp: boolean;
        teams: boolean;
    };
}

export interface NotificationRule {
    id: string;
    eventType: NotificationEventType;
    label: string;
    isActive: boolean;
    recipients: NotificationRecipient[];
}

export interface AppNotification {
    id: string;
    userId: string;
    title: string;
    message: string;
    isRead: boolean;
    link?: string;
    createdAt: string;
}
