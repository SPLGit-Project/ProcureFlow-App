import { Page } from '@playwright/test';

export interface TestUser {
    id: string;
    name: string;
    email: string;
    role: string;
    roleIds?: string[];
    avatar: string;
    permissions: string[];
    siteIds: string[];
}

const DEFAULT_PERMISSIONS = [
    'view_dashboard', 'create_request', 'manage_development',
    'approve_item_requests', 'manage_settings', 'view_items',
    'approve_requests', 'view_finance', 'view_reports', 'manage_items',
    'view_active_requests', 'view_completed_requests',
];

export async function injectTestUser(
    page: Page,
    permissions: string[] = DEFAULT_PERMISSIONS,
    siteIds: string[] = ['site-1']
) {
    await page.addInitScript(({ perms, allowedSiteIds }) => {
        if (!localStorage.getItem('pf_test_user')) {
            localStorage.removeItem('activeSiteIds');
            localStorage.removeItem('activeSiteId');
        }
        localStorage.setItem('pf_test_user', JSON.stringify({
            id: 'test-user-id',
            name: 'Test User',
            email: 'test@splservices.com.au',
            role: 'beta_tester',
            roleIds: ['beta_tester'],
            avatar: 'QA',
            permissions: perms,
            siteIds: allowedSiteIds,
        }));
    }, { perms: permissions, allowedSiteIds: siteIds });
}

/** Navigate and wait for React to mount before assertions. */
export async function gotoAndWait(page: Page, path: string) {
    await page.goto(path);
    // Wait for React to mount and replace the empty root
    await page.waitForSelector('#root:not(:empty)', { timeout: 20000 });
}

export async function injectTestUserWithFlags(
    page: Page,
    permissions: string[] = DEFAULT_PERMISSIONS,
    flags: Record<string, boolean> = {}
) {
    await page.addInitScript(({ perms, featureFlags }) => {
        if (!localStorage.getItem('pf_test_user')) {
            localStorage.removeItem('activeSiteIds');
            localStorage.removeItem('activeSiteId');
        }
        localStorage.setItem('pf_test_user', JSON.stringify({
            id: 'test-user-id',
            name: 'Test User',
            email: 'test@splservices.com.au',
            role: 'beta_tester',
            roleIds: ['beta_tester'],
            avatar: 'QA',
            permissions: perms,
            siteIds: ['site-1'],
        }));
        // Store feature flag overrides so tests can inspect them
        if (Object.keys(featureFlags).length > 0) {
            localStorage.setItem('pf_test_feature_flags', JSON.stringify(featureFlags));
        }
    }, { perms: permissions, featureFlags: flags });
}
