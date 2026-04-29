
import { PermissionId } from '../types';

export interface NavItemConfig {
    id: string;
    path: string;
    label: string;
    iconName: string; // We store string, map to icon component in Layout
    permission?: PermissionId;
    isSystem?: boolean; // If true, cannot be deleted (though we only hide for now)
}

export const DEFAULT_NAV_ITEMS: NavItemConfig[] = [
    { id: 'dashboard', path: '/', label: 'Dashboard', iconName: 'LayoutDashboard', permission: 'view_dashboard', isSystem: true },
    { id: 'create', path: '/create', label: 'Create Request', iconName: 'PlusCircle', permission: 'create_request' },
    { id: 'requests', path: '/requests', label: 'Requests', iconName: 'FileText', permission: 'view_dashboard' },
    { id: 'smart-buying', path: '/smart-buying', label: 'Smart Buying', iconName: 'BarChart3', permission: 'manage_development' },
    { id: 'approvals', path: '/approvals', label: 'Approvals', iconName: 'CheckCircle', permission: 'approve_requests' },
    { id: 'active-requests', path: '/active-requests', label: 'Active Requests', iconName: 'Activity', permission: 'view_active_requests' },
    { id: 'finance', path: '/finance', label: 'Finance Review', iconName: 'DollarSign', permission: 'view_finance' },
    { id: 'reports', path: '/reports', label: 'Reports', iconName: 'BarChart3', permission: 'view_finance' },
    { id: 'completed', path: '/completed', label: 'Completed', iconName: 'Clock', permission: 'view_completed_requests' },
    { id: 'item-creation-preview', path: '/item-creation-preview', label: 'Item Preview', iconName: 'FlaskConical', permission: 'manage_development' },
    { id: 'item-approval-queue', path: '/item-approval-queue', label: 'Item Approvals', iconName: 'ClipboardCheck', permission: 'approve_item_requests' },
    { id: 'item-catalogue', path: '/item-catalogue', label: 'Item Catalogue', iconName: 'BookOpen', permission: 'view_items' },
    { id: 'data-ingest', path: '/data-ingest', label: 'Data Ingestion', iconName: 'FileText', permission: 'manage_development' },
    { id: 'settings', path: '/settings', label: 'Admin Panel', iconName: 'Settings', permission: 'manage_settings', isSystem: true },
    { id: 'help', path: '/help', label: 'Help & Support', iconName: 'HelpCircle', isSystem: true },
];

