import { PermissionId, RoleDefinition } from '../types.ts';

export interface NotificationScenarioConfig {
    key: string;
    title: string;
    desc: string;
    badge: string;
    requiredPermissions: PermissionId[];
    allowedRoles: string[]; // Role IDs or names that grant this scenario
    roleExplanation: string; // Human-friendly explanation of required access
}

export const NOTIFICATION_SCENARIOS: NotificationScenarioConfig[] = [
    {
        key: 'APPROVAL',
        title: 'Requisition Approvals & Escalations',
        desc: 'Pending purchase requisitions requiring review, sign-off decisions, and overdue escalation alerts',
        badge: 'Approvals',
        requiredPermissions: ['approve_requests', 'approve_item_requests'],
        allowedRoles: ['ADMIN', 'APPROVER', 'REGIONAL_MANAGER', 'GENERAL_MANAGER', 'EXECUTIVE', 'FINANCE', 'beta_tester'],
        roleExplanation: 'Requires Approver, Executive, Finance, or Admin role'
    },
    {
        key: 'STATUS_CHANGE',
        title: 'PO & Order Status Confirmations',
        desc: 'PO status progressions, supplier acknowledgements, Need-By Date updates, and Ready to Close notices',
        badge: 'Orders',
        requiredPermissions: ['create_request', 'view_all_requests', 'view_active_requests', 'view_completed_requests'],
        allowedRoles: ['ADMIN', 'SITE_USER', 'REQUESTER', 'APPROVER', 'OPERATIONS', 'beta_tester'],
        roleExplanation: 'Granted to Requesters, Site Users, Approvers, and Admins'
    },
    {
        key: 'DELIVERY',
        title: 'Goods Receipts & Delivery Discrepancies',
        desc: 'Delivery docket receipts, quantity variance warnings (ordered vs received), and overdue shipments',
        badge: 'Deliveries',
        requiredPermissions: ['receive_goods', 'create_request'],
        allowedRoles: ['ADMIN', 'SITE_USER', 'RECEIVER', 'WAREHOUSE', 'OPERATIONS', 'beta_tester'],
        roleExplanation: 'Granted to Site Receivers, Requesters, Warehouse, and Admins'
    },
    {
        key: 'ITEM_LIFECYCLE',
        title: 'Catalog & Item Master Changes',
        desc: 'New item requests submitted, item specifications approved, pack size changes, and catalog releases',
        badge: 'Master Data',
        requiredPermissions: ['manage_items', 'publish_items', 'manage_item_definition', 'manage_item_requests', 'approve_item_requests', 'view_items'],
        allowedRoles: ['ADMIN', 'MASTER_DATA', 'PROCUREMENT', 'CATALOG_MANAGER', 'beta_tester'],
        roleExplanation: 'Granted to Master Data, Catalog Managers, and Admins'
    },
    {
        key: 'PRICING',
        title: 'Contract Pricing & Tariff Updates',
        desc: 'Supplier pricing schedule adjustments, future price activations, and pricing variance alerts',
        badge: 'Pricing',
        requiredPermissions: ['manage_pricing_schedules', 'manage_purchase_pricing', 'view_purchase_pricing', 'manage_sell_pricing', 'view_sell_pricing', 'override_margin_threshold', 'manage_finance', 'view_finance'],
        allowedRoles: ['ADMIN', 'COMMERCIAL', 'FINANCE', 'PRICING_MANAGER', 'beta_tester'],
        roleExplanation: 'Restricted to Commercial, Pricing, Finance, and Admins'
    },
    {
        key: 'ALERT',
        title: 'SLA Warnings & Critical Governance',
        desc: 'Overdue 14-day delivery breaches, unlinked Concur PO numbers, and budget consumption warnings',
        badge: 'Governance',
        requiredPermissions: ['approve_requests', 'manage_settings', 'manage_finance', 'manage_development', 'view_reports'],
        allowedRoles: ['ADMIN', 'APPROVER', 'EXECUTIVE', 'FINANCE', 'GENERAL_MANAGER', 'beta_tester'],
        roleExplanation: 'Granted to Approvers, Managers, Executives, and Admins'
    }
];

/**
 * Evaluates whether a given role set or permissions grant access to a specific scenario.
 */
export function isScenarioAllowedForRoles(
    scenario: NotificationScenarioConfig,
    userRoleIds: string[] = [],
    rolesList: RoleDefinition[] = [],
    hasPermissionFn?: (perm: PermissionId) => boolean
): boolean {
    const normalizedRoles = userRoleIds.map(r => (r || '').trim().toUpperCase());
    
    // Admins always have access to everything
    if (normalizedRoles.includes('ADMIN')) return true;

    // Direct role match
    const hasDirectRole = scenario.allowedRoles.some(allowed => 
        normalizedRoles.includes(allowed.toUpperCase())
    );
    if (hasDirectRole) return true;

    // Check hasPermissionFn if provided
    if (hasPermissionFn) {
        if (scenario.requiredPermissions.some(perm => hasPermissionFn(perm))) {
            return true;
        }
    }

    // Check permissions granted by the roles from rolesList
    const userRoleDefs = rolesList.filter(r => userRoleIds.includes(r.id));
    const grantedPermissions = new Set<string>();
    for (const r of userRoleDefs) {
        if (Array.isArray(r.permissions)) {
            r.permissions.forEach(p => grantedPermissions.add(p));
        }
    }

    const hasPermissionMatch = scenario.requiredPermissions.some(perm => 
        grantedPermissions.has(perm)
    );
    return hasPermissionMatch;
}

/**
 * Returns the list of scenarios eligible for a user given their roles, permissions, and app roles registry.
 */
export function getUserEligibleScenarios(
    user: { role?: string; roleIds?: string[] } | null | undefined,
    rolesList: RoleDefinition[] = [],
    hasPermissionFn?: (perm: PermissionId) => boolean
): NotificationScenarioConfig[] {
    if (!user) return [];

    const userRoleIds = Array.from(new Set([
        user.role,
        ...(user.roleIds || [])
    ].filter(Boolean) as string[]));

    return NOTIFICATION_SCENARIOS.filter(scen => 
        isScenarioAllowedForRoles(scen, userRoleIds, rolesList, hasPermissionFn)
    );
}
