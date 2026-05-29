import { PermissionId } from '../types.ts';
import { 
    Layout, 
    ShoppingCart, 
    Package, 
    DollarSign, 
    Shield, 
    Database, 
    TrendingUp
} from 'lucide-react';

export interface PermissionDefinition {
    id: PermissionId;
    label: string;
    description: string;
    type: 'SCREEN' | 'ACTION';
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
            { id: 'view_dashboard', label: 'Dashboard Access', description: 'Access to procurement dashboards', type: 'SCREEN' },
            { id: 'view_active_requests', label: 'Active Requests', description: 'View in-progress purchase orders', type: 'SCREEN' },
            { id: 'view_completed_requests', label: 'Completed Requests', description: 'View history of fulfilled POs', type: 'SCREEN' },
            { id: 'create_request', label: 'Create PO', description: 'Allow creation of new purchase requests', type: 'ACTION' },
            { id: 'view_all_requests', label: 'View All POs', description: 'View POs across all sites/users', type: 'ACTION' },
            { id: 'approve_requests', label: 'Approve POs', description: 'Authority to approve PO requests', type: 'ACTION' },
            { id: 'link_concur', label: 'Concur Integration', description: 'Link and export POs to Concur', type: 'ACTION' },
            { id: 'receive_goods', label: 'Goods Receipt', description: 'Mark items as received in system', type: 'ACTION' },
        ]
    },
    {
        id: 'items',
        label: 'Inventory & Catalogue',
        icon: Package,
        permissions: [
            { id: 'view_items', label: 'Catalogue Browser', description: 'Browse and search the item catalogue', type: 'SCREEN' },
            { id: 'view_stock', label: 'Inventory Levels', description: 'View real-time stock and snapshots', type: 'SCREEN' },
            { id: 'manage_item_requests', label: 'Item Requests', description: 'Submit and manage item creation requests', type: 'ACTION' },
            { id: 'manage_items', label: 'Item Management', description: 'Create, edit, and archive items', type: 'ACTION' },
            { id: 'manage_item_definition', label: 'Definition Logic', description: 'Manage item master data queue', type: 'ACTION' },
            { id: 'approve_item_requests', label: 'Item Approvals', description: 'Approve new item creation requests', type: 'ACTION' },
            { id: 'publish_items', label: 'Publish to Catalogue', description: 'Push items from queue to catalogue', type: 'ACTION' },
        ]
    },
    {
        id: 'pricing',
        label: 'Pricing & Commercials',
        icon: TrendingUp,
        permissions: [
            { id: 'view_purchase_pricing', label: 'Purchase Pricing', description: 'View supplier buy pricing', type: 'SCREEN' },
            { id: 'view_sell_pricing', label: 'Sell Pricing', description: 'View customer sell pricing', type: 'SCREEN' },
            { id: 'manage_purchase_pricing', label: 'Manage Buy Price', description: 'Update and maintain buy price lists', type: 'ACTION' },
            { id: 'manage_sell_pricing', label: 'Manage Sell Price', description: 'Update and maintain sell price lists', type: 'ACTION' },
            { id: 'manage_pricing_schedules', label: 'Price Schedules', description: 'Configure automated price updates', type: 'ACTION' },
            { id: 'override_margin_threshold', label: 'Margin Override', description: 'Allow pricing outside defined thresholds', type: 'ACTION' },
        ]
    },
    {
        id: 'finance',
        label: 'Finance & Analytics',
        icon: DollarSign,
        permissions: [
            { id: 'view_finance', label: 'Finance Review', description: 'Access to financial reconciliation', type: 'SCREEN' },
            { id: 'view_reports', label: 'Reports', description: 'Access to system and financial reporting', type: 'SCREEN' },
            { id: 'manage_finance', label: 'Finance Config', description: 'Manage GL codes and cost centers', type: 'ACTION' },
        ]
    },
    {
        id: 'admin',
        label: 'System Administration',
        icon: Shield,
        permissions: [
            { id: 'view_security', label: 'Security Panel', description: 'Manage roles and user permissions', type: 'SCREEN' },
            { id: 'view_suppliers', label: 'Supplier Directory', description: 'View and search supplier records', type: 'SCREEN' },
            { id: 'view_sites', label: 'Site Directory', description: 'View and search company sites', type: 'SCREEN' },
            { id: 'view_workflow', label: 'Workflow Designer', description: 'View approval workflows', type: 'SCREEN' },
            { id: 'view_notifications', label: 'Notification Config', description: 'Configure system alerts', type: 'SCREEN' },
            { id: 'view_branding', label: 'Branding Panel', description: 'View branding and home experience settings', type: 'SCREEN' },
            { id: 'view_audit_logs', label: 'Audit Logs', description: 'View system-wide activity logs', type: 'SCREEN' },
            { id: 'manage_settings', label: 'System Settings', description: 'Manage global app configurations', type: 'ACTION' },
            { id: 'manage_suppliers', label: 'Supplier Admin', description: 'Manage supplier master records', type: 'ACTION' },
            { id: 'manage_sites', label: 'Site Admin', description: 'Create and edit site details', type: 'ACTION' },
            { id: 'manage_branding', label: 'Branding Admin', description: 'Manage app theme and logos', type: 'ACTION' },
        ]
    },
    {
        id: 'development',
        label: 'Development & Tools',
        icon: Database,
        permissions: [
            { id: 'view_mapping', label: 'AI Data Mapping', description: 'Access to AI-driven data mapping', type: 'SCREEN' },
            { id: 'manage_development', label: 'Dev Admin Tools', description: 'Access to ingestion and sync tools', type: 'ACTION' },
        ]
    }
];
