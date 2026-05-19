
import { PermissionId } from '../types';

export interface NavItemConfig {
    id: string;
    path: string;
    label: string;
    iconName: string; // We store string, map to icon component in Layout
    permission?: PermissionId;
    anyPermissions?: PermissionId[];
    isSystem?: boolean; // If true, cannot be deleted (though we only hide for now)
    category?: string; // Used for sidebar grouping in revamp mode
    parentId?: string; // If set, renders as a sub-item beneath the parent nav entry
}

export const SETTINGS_ACCESS_PERMISSIONS: PermissionId[] = [
    'view_items',
    'view_stock',
    'view_mapping',
    'view_suppliers',
    'view_sites',
    'view_workflow',
    'view_security',
    'view_notifications',
    'view_branding',
    'view_audit_logs',
    'manage_settings',
    'manage_items',
];

export const DEFAULT_NAV_ITEMS: NavItemConfig[] = [
    // ── Workspace ──
    { id: 'home', path: '/', label: 'Home', iconName: 'House', permission: 'view_dashboard', isSystem: true, category: 'Workspace' },

    // ── Procurement ──
    { id: 'dashboard', path: '/procurement/dashboard', label: 'Dashboard', iconName: 'LayoutDashboard', permission: 'view_dashboard', isSystem: true, category: 'Procurement' },
    { id: 'create', path: '/create', label: 'Create Request', iconName: 'PlusCircle', permission: 'create_request', category: 'Procurement' },
    { id: 'requests', path: '/requests', label: 'Requests', iconName: 'FileText', permission: 'view_dashboard', category: 'Procurement' },
    { id: 'smart-buying', path: '/smart-buying', label: 'Smart Buying', iconName: 'BarChart3', permission: 'manage_development', category: 'Procurement' },
    { id: 'approvals',       path: '/approvals',       label: 'Approvals',        iconName: 'CheckCircle', permission: 'approve_item_requests',  category: 'Procurement', parentId: 'requests' },
    { id: 'active-requests', path: '/active-requests', label: 'Active Requests',  iconName: 'Activity',    permission: 'view_active_requests',  category: 'Procurement', parentId: 'requests' },
    { id: 'completed',       path: '/completed',       label: 'Completed',        iconName: 'Clock',       permission: 'view_completed_requests', category: 'Procurement', parentId: 'requests' },
    { id: 'finance',         path: '/finance',         label: 'Finance Review',   iconName: 'DollarSign', permission: 'view_finance',           category: 'Procurement' },

    // ── Items ──
    { id: 'my-item-requests', path: '/items/my-requests', label: 'My Item Requests', iconName: 'ClipboardList', permission: 'view_dashboard', category: 'Items' },
    { id: 'master-data-queue', path: '/items/master-data-queue', label: 'Master Data Queue', iconName: 'ListTodo', permission: 'manage_item_definition', category: 'Items' },
    { id: 'procurement-queue', path: '/items/procurement-queue', label: 'Procurement Queue', iconName: 'ClipboardCheck', permission: 'manage_item_definition', category: 'Items' },
    { id: 'item-catalogue', path: '/item-catalogue', label: 'Item Catalogue', iconName: 'BookOpen', permission: 'view_items', category: 'Items' },
    { id: 'data-ingest', path: '/data-ingest', label: 'Data Ingestion', iconName: 'FileText', permission: 'manage_development', category: 'Procurement' },

    // ── Pricing ──
    { id: 'pricing-queue', path: '/items/pricing-queue', label: 'Pricing Queue', iconName: 'ListChecks', permission: 'manage_sell_pricing', category: 'Pricing' },
    { id: 'pricing-dashboard', path: '/pricing/dashboard', label: 'Price Management', iconName: 'DollarSign', permission: 'manage_sell_pricing', category: 'Pricing' },
    { id: 'pricing-schedules', path: '/pricing/schedules', label: 'Pricing Schedules', iconName: 'TrendingUp', permission: 'manage_pricing_schedules', category: 'Pricing' },

    // ── Reports & Analytics ──
    { id: 'reports', path: '/reports', label: 'Reports', iconName: 'BarChart3', permission: 'view_finance', category: 'Reports & Analytics' },

    // ── Admin ──
    { id: 'approval-rules', path: '/admin/approval-rules', label: 'Approval Rules', iconName: 'ShieldCheck', permission: 'manage_settings', category: 'Admin' },
    { id: 'admin-tools', path: '/admin/tools', label: 'Admin Tools', iconName: 'Activity', permission: 'manage_settings', category: 'Admin' },
    { id: 'admin-cutover', path: '/admin/cutover', label: 'Cutover Readiness', iconName: 'ShieldCheck', permission: 'manage_settings', category: 'Admin' },
    { id: 'admin-colours', path: '/admin/colours', label: 'Colour Palette', iconName: 'Activity', permission: 'manage_settings', category: 'Admin' },
    { id: 'settings', path: '/settings', label: 'Admin Panel', iconName: 'Settings', anyPermissions: SETTINGS_ACCESS_PERMISSIONS, isSystem: true, category: 'Admin' },

    // ── System ──
    { id: 'help',  path: '/help',  label: 'Help & Support', iconName: 'HelpCircle', isSystem: true, category: 'System' },
    { id: 'about', path: '/about', label: 'About',          iconName: 'Info',        isSystem: true, category: 'System' },
];

