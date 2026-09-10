import { PermissionId } from '../types.ts';
import { 
    Layout, 
    ShoppingCart, 
    Package, 
    DollarSign, 
    Shield, 
    Database, 
    TrendingUp,
    Download,
    BarChart3
} from 'lucide-react';

export interface PermissionDefinition {
    id: PermissionId;
    label: string;
    description: string;
    type: 'SCREEN' | 'ACTION' | 'EXPORT';
}

export interface PermissionGroup {
    id: string;
    label: string;
    icon: React.ElementType; // Lucide icon component
    permissions: PermissionDefinition[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
    {
        id: 'procurement',
        label: 'Procurement & Orders',
        icon: ShoppingCart,
        permissions: [
            { id: 'view_dashboard', label: 'Dashboard Access', description: 'Access to procurement dashboards and home metric tiles', type: 'SCREEN' },
            { id: 'view_active_requests', label: 'Active Requests', description: 'View in-progress purchase orders and tracking', type: 'SCREEN' },
            { id: 'view_completed_requests', label: 'Completed Requests', description: 'View history of fulfilled POs and completed ledger', type: 'SCREEN' },
            { id: 'create_request', label: 'Create PO', description: 'Allow creation of new purchase requests and orders', type: 'ACTION' },
            { id: 'view_all_requests', label: 'View All POs', description: 'View POs across all sites and users (bypasses own-site filter)', type: 'ACTION' },
            { id: 'approve_requests', label: 'Approve POs', description: 'Authority to approve PO requests up to configured limit', type: 'ACTION' },
            { id: 'link_concur', label: 'Concur Integration', description: 'Link and export POs to Concur', type: 'ACTION' },
            { id: 'receive_goods', label: 'Goods Receipt', description: 'Mark items as received and record deliveries', type: 'ACTION' },
            { id: 'edit_po_lines', label: 'Edit Order Lines', description: 'Modify PO lines, quantities, or prices prior to approval', type: 'ACTION' },
            { id: 'cancel_po', label: 'Cancel Orders', description: 'Cancel active or pending purchase orders', type: 'ACTION' },
            { id: 'delete_requests', label: 'Delete POs', description: 'Permanently remove draft or rejected purchase orders', type: 'ACTION' },
            { id: 'override_sod', label: 'Bypass Segregation of Duties', description: 'Allow approving or receiving own orders in emergencies', type: 'ACTION' },
        ]
    },
    {
        id: 'items',
        label: 'Inventory & Catalogue',
        icon: Package,
        permissions: [
            { id: 'view_items', label: 'Catalogue Browser', description: 'Browse and search the master item catalogue', type: 'SCREEN' },
            { id: 'view_stock', label: 'Inventory Levels', description: 'View real-time stock snapshots and site availability', type: 'SCREEN' },
            { id: 'manage_item_requests', label: 'Item Requests', description: 'Submit and manage item creation requests', type: 'ACTION' },
            { id: 'manage_items', label: 'Item Management', description: 'Create, edit, and archive master items', type: 'ACTION' },
            { id: 'manage_item_definition', label: 'Definition Logic', description: 'Manage item master data queue and taxonomies', type: 'ACTION' },
            { id: 'approve_item_requests', label: 'Item Approvals', description: 'Commercial sign-off on new item creation requests', type: 'ACTION' },
            { id: 'publish_items', label: 'Publish to Catalogue', description: 'Push approved items to live live SAP catalogue', type: 'ACTION' },
        ]
    },
    {
        id: 'pricing',
        label: 'Pricing & Commercials',
        icon: TrendingUp,
        permissions: [
            { id: 'view_purchase_pricing', label: 'Purchase Buy Pricing', description: 'View supplier buy pricing and vendor cost rates', type: 'SCREEN' },
            { id: 'view_sell_pricing', label: 'Customer Sell Pricing', description: 'View customer sell pricing and markup rates', type: 'SCREEN' },
            { id: 'manage_purchase_pricing', label: 'Manage Buy Price', description: 'Update and maintain buy price lists', type: 'ACTION' },
            { id: 'manage_sell_pricing', label: 'Manage Sell Price', description: 'Update and maintain customer sell price matrices', type: 'ACTION' },
            { id: 'manage_pricing_schedules', label: 'Price Schedules', description: 'Configure automated and future-dated price updates', type: 'ACTION' },
            { id: 'override_margin_threshold', label: 'Margin Override', description: 'Allow pricing outside defined gross margin thresholds', type: 'ACTION' },
        ]
    },
    {
        id: 'finance',
        label: 'Finance & Analytics',
        icon: DollarSign,
        permissions: [
            { id: 'view_finance', label: 'Finance Review', description: 'Access to financial reconciliation and 3-way matching', type: 'SCREEN' },
            { id: 'view_reports', label: 'Reports & Analytics', description: 'Access to operational and financial reporting', type: 'SCREEN' },
            { id: 'manage_finance', label: 'Finance Config', description: 'Manage GL codes, cost centers, and tax categories', type: 'ACTION' },
            { id: 'manage_eom_reconciliation', label: 'EOM Reconciliation', description: 'Manage month-end P&L reconciliation and period locks', type: 'ACTION' },
        ]
    },
    {
        id: 'admin',
        label: 'System Administration',
        icon: Shield,
        permissions: [
            { id: 'view_security', label: 'Security & Roles Panel', description: 'View role definitions, permissions, and directory', type: 'SCREEN' },
            { id: 'manage_roles', label: 'Manage Roles', description: 'Create, edit, duplicate, and delete custom security roles', type: 'ACTION' },
            { id: 'manage_users', label: 'Manage Users', description: 'Invite users, assign roles, edit site access, and archive', type: 'ACTION' },
            { id: 'view_suppliers', label: 'Supplier Directory', description: 'View and search supplier master records', type: 'SCREEN' },
            { id: 'manage_suppliers', label: 'Supplier Admin', description: 'Create, update, and manage supplier master records', type: 'ACTION' },
            { id: 'view_sites', label: 'Site Directory', description: 'View and search company sites and delivery locations', type: 'SCREEN' },
            { id: 'manage_sites', label: 'Site Admin', description: 'Create and edit site details and manager contacts', type: 'ACTION' },
            { id: 'view_workflow', label: 'Workflow Designer', description: 'View approval workflow maps and trigger rules', type: 'SCREEN' },
            { id: 'manage_workflows', label: 'Workflow Configuration', description: 'Create and edit workflow stages, SLAs, and approval logic', type: 'ACTION' },
            { id: 'view_notifications', label: 'Notification Config', description: 'Configure notification rules and channel delivery', type: 'SCREEN' },
            { id: 'manage_email_templates', label: 'Email Templates', description: 'Customize email subjects and notification copy', type: 'ACTION' },
            { id: 'view_branding', label: 'Branding Panel', description: 'View application branding and color themes', type: 'SCREEN' },
            { id: 'manage_branding', label: 'Branding Admin', description: 'Update logos, app title, and brand theme colors', type: 'ACTION' },
            { id: 'manage_lifecycle_triggers', label: 'Lifecycle Triggers & SLAs', description: 'Configure SLA escalation timers and lifecycle triggers', type: 'ACTION' },
            { id: 'manage_data_migration', label: 'Data Migration Tool', description: 'Run bulk CSV imports for master items, stock, and users', type: 'ACTION' },
            { id: 'manage_data_sync', label: 'Data Sync Engine', description: 'Trigger and configure Azure / BundleConnect ERP syncs', type: 'ACTION' },
            { id: 'manage_settings', label: 'Global App Settings', description: 'Access system health, menu ordering, and core config', type: 'ACTION' },
            { id: 'view_audit_logs', label: 'Audit Logs', description: 'View system-wide activity, change history, and login logs', type: 'SCREEN' },
        ]
    },
    {
        id: 'export',
        label: 'Data Export Governance',
        icon: Download,
        permissions: [
            { id: 'export_orders', label: 'Export Purchase Orders', description: 'Download PO lists and detail lines to CSV or Excel', type: 'EXPORT' },
            { id: 'export_catalog', label: 'Export Master Catalogue', description: 'Download master item inventory lists with pricing', type: 'EXPORT' },
            { id: 'export_reports', label: 'Export Financial Reports', description: 'Export spend, savings, and EOM reports to Excel/PDF', type: 'EXPORT' },
            { id: 'export_audit_logs', label: 'Export Audit Logs', description: 'Export raw compliance and audit logs for external review', type: 'EXPORT' },
        ]
    },
    {
        id: 'development',
        label: 'Development & Tools',
        icon: Database,
        permissions: [
            { id: 'view_mapping', label: 'AI Data Mapping', description: 'Access to AI-driven supplier-to-internal SKU mapping', type: 'SCREEN' },
            { id: 'manage_development', label: 'Dev Admin Cockpit', description: 'Access to Smart Buying, raw ingest, and diagnostic tools', type: 'ACTION' },
        ]
    }
];
