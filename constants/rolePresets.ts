import { PermissionId } from '../types.ts';

export interface RolePreset {
    id: string;
    name: string;
    description: string;
    badge: string;
    maxApprovalLimit: number;
    maxOrderLimit: number;
    siteScopeMode: 'ALL' | 'ASSIGNED' | 'REGIONAL';
    enforceSod: boolean;
    permissions: PermissionId[];
}

export const ROLE_PRESETS: RolePreset[] = [
    {
        id: 'PRESET_SITE_REQUESTER',
        name: 'Site Requester',
        description: 'Standard ordering user for a single facility or plant. Can create PO requests up to $2,000 and view active delivery status.',
        badge: 'Operations',
        maxApprovalLimit: 0,
        maxOrderLimit: 2000,
        siteScopeMode: 'ASSIGNED',
        enforceSod: true,
        permissions: [
            'view_dashboard',
            'create_request',
            'view_items',
            'view_stock',
            'view_active_requests',
            'view_completed_requests',
            'manage_item_requests'
        ]
    },
    {
        id: 'PRESET_SITE_RECEIVER',
        name: 'Goods Receiver / Storeman',
        description: 'Responsible for inventory receiving, logging deliveries, and reporting shipment variances at assigned site locations.',
        badge: 'Logistics',
        maxApprovalLimit: 0,
        maxOrderLimit: 0,
        siteScopeMode: 'ASSIGNED',
        enforceSod: true,
        permissions: [
            'view_dashboard',
            'view_items',
            'view_stock',
            'view_active_requests',
            'view_completed_requests',
            'receive_goods'
        ]
    },
    {
        id: 'PRESET_SITE_MANAGER',
        name: 'Site Manager (Approver Tier 1)',
        description: 'Facility supervisor authorized to review and approve purchase orders up to $5,000 for their assigned site(s).',
        badge: 'Management',
        maxApprovalLimit: 5000,
        maxOrderLimit: 5000,
        siteScopeMode: 'ASSIGNED',
        enforceSod: true,
        permissions: [
            'view_dashboard',
            'create_request',
            'view_items',
            'view_stock',
            'view_active_requests',
            'view_completed_requests',
            'approve_requests',
            'receive_goods',
            'view_suppliers',
            'view_reports'
        ]
    },
    {
        id: 'PRESET_REGIONAL_GM',
        name: 'Regional Operations GM (Tier 2)',
        description: 'Senior operational leader with multi-site regional visibility and financial approval authority up to $50,000.',
        badge: 'Executive',
        maxApprovalLimit: 50000,
        maxOrderLimit: 25000,
        siteScopeMode: 'REGIONAL',
        enforceSod: true,
        permissions: [
            'view_dashboard',
            'view_all_requests',
            'approve_requests',
            'approve_item_requests',
            'view_items',
            'view_stock',
            'view_purchase_pricing',
            'view_sell_pricing',
            'view_suppliers',
            'view_sites',
            'view_reports',
            'export_reports',
            'export_orders'
        ]
    },
    {
        id: 'PRESET_COMMERCIAL_ANALYST',
        name: 'Commercial Pricing Analyst',
        description: 'Manages vendor buy prices, customer rate cards, margin thresholds, and automated pricing schedules.',
        badge: 'Commercial',
        maxApprovalLimit: 0,
        maxOrderLimit: 0,
        siteScopeMode: 'ALL',
        enforceSod: false,
        permissions: [
            'view_dashboard',
            'view_items',
            'view_purchase_pricing',
            'view_sell_pricing',
            'manage_purchase_pricing',
            'manage_sell_pricing',
            'manage_pricing_schedules',
            'override_margin_threshold',
            'view_reports',
            'export_catalog',
            'export_reports'
        ]
    },
    {
        id: 'PRESET_DATA_STEWARD',
        name: 'Master Data Steward',
        description: 'Oversees product taxonomy, duplicate elimination, SAP code mappings, and catalog publication gatekeeper.',
        badge: 'Data Governance',
        maxApprovalLimit: 0,
        maxOrderLimit: 0,
        siteScopeMode: 'ALL',
        enforceSod: true,
        permissions: [
            'view_dashboard',
            'view_items',
            'view_stock',
            'manage_items',
            'manage_item_definition',
            'publish_items',
            'view_mapping',
            'view_suppliers',
            'view_all_requests',
            'export_catalog'
        ]
    },
    {
        id: 'PRESET_FINANCE_OFFICER',
        name: 'Finance & AP Officer',
        description: 'Conducts 3-way invoice matching, Concur integration exports, GL code management, and month-end reconciliation.',
        badge: 'Finance',
        maxApprovalLimit: 10000,
        maxOrderLimit: 0,
        siteScopeMode: 'ALL',
        enforceSod: true,
        permissions: [
            'view_dashboard',
            'view_all_requests',
            'view_finance',
            'manage_finance',
            'manage_eom_reconciliation',
            'link_concur',
            'view_purchase_pricing',
            'view_sell_pricing',
            'view_reports',
            'export_orders',
            'export_reports'
        ]
    },
    {
        id: 'PRESET_INTERNAL_AUDITOR',
        name: 'Internal Auditor (Read-Only)',
        description: 'Strict read-only role across transactions, supplier records, audit logs, and analytics with full export capabilities.',
        badge: 'Compliance',
        maxApprovalLimit: 0,
        maxOrderLimit: 0,
        siteScopeMode: 'ALL',
        enforceSod: true,
        permissions: [
            'view_dashboard',
            'view_all_requests',
            'view_items',
            'view_stock',
            'view_purchase_pricing',
            'view_sell_pricing',
            'view_finance',
            'view_reports',
            'view_audit_logs',
            'view_suppliers',
            'view_sites',
            'view_workflow',
            'export_orders',
            'export_catalog',
            'export_reports',
            'export_audit_logs'
        ]
    }
];
