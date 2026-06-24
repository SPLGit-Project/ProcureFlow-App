import { Page } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://yasosgkznoxamysutxfc.supabase.co';

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

function getProjectRef(url: string): string {
    try {
        const hostname = new URL(url).hostname;
        return hostname.split('.')[0];
    } catch {
        const match = url.match(/https?:\/\/([^.]+)/);
        return match ? match[1] : 'yasosgkznoxamysutxfc';
    }
}

export async function injectTestUser(
    page: Page,
    permissions: string[] = DEFAULT_PERMISSIONS,
    siteIds: string[] = ['11111111-1111-4111-8111-111111111111'],
    userOverrides: Partial<TestUser> = {}
) {
    const projectRef = getProjectRef(VITE_SUPABASE_URL);
    await page.addInitScript(({ perms, allowedSiteIds, overrides, serviceKey, ref }) => {
        if (!localStorage.getItem('pf_test_user')) {
            localStorage.removeItem('activeSiteIds');
            localStorage.removeItem('activeSiteId');
        }
        const userObj = {
            id: overrides.id || 'test-user-id',
            name: overrides.name || 'Test User',
            email: overrides.email || 'test@splservices.com.au',
            role: overrides.role || 'beta_tester',
            roleIds: overrides.roleIds || ['beta_tester'],
            avatar: overrides.avatar || 'QA',
            permissions: perms,
            siteIds: allowedSiteIds,
        };
        localStorage.setItem('pf_test_user', JSON.stringify(userObj));

        if (serviceKey && ref) {
            const tokenKey = `sb-${ref}-auth-token`;
            const session = {
                access_token: serviceKey,
                token_type: 'bearer',
                expires_in: 3600,
                refresh_token: 'dummy_refresh_token',
                user: {
                    id: userObj.id,
                    aud: 'authenticated',
                    role: 'service_role',
                    email: userObj.email,
                    email_confirmed_at: new Date().toISOString(),
                    phone: '',
                    confirmed_at: new Date().toISOString(),
                    last_sign_in_at: new Date().toISOString(),
                    app_metadata: {
                        provider: 'azure',
                        providers: ['azure']
                    },
                    user_metadata: {},
                    identities: [],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
                expires_at: Math.floor(Date.now() / 1000) + 3600
            };
            localStorage.setItem(tokenKey, JSON.stringify(session));
        }
    }, { perms: permissions, allowedSiteIds: siteIds, overrides: userOverrides, serviceKey: SUPABASE_SERVICE_ROLE_KEY, ref: projectRef });
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
    const projectRef = getProjectRef(VITE_SUPABASE_URL);
    await page.addInitScript(({ perms, featureFlags, serviceKey, ref }) => {
        if (!localStorage.getItem('pf_test_user')) {
            localStorage.removeItem('activeSiteIds');
            localStorage.removeItem('activeSiteId');
        }
        const userObj = {
            id: 'test-user-id',
            name: 'Test User',
            email: 'test@splservices.com.au',
            role: 'beta_tester',
            roleIds: ['beta_tester'],
            avatar: 'QA',
            permissions: perms,
            siteIds: ['11111111-1111-4111-8111-111111111111'],
        };
        localStorage.setItem('pf_test_user', JSON.stringify(userObj));
        // Store feature flag overrides so tests can inspect them
        if (Object.keys(featureFlags).length > 0) {
            localStorage.setItem('pf_test_feature_flags', JSON.stringify(featureFlags));
        }

        if (serviceKey && ref) {
            const tokenKey = `sb-${ref}-auth-token`;
            const session = {
                access_token: serviceKey,
                token_type: 'bearer',
                expires_in: 3600,
                refresh_token: 'dummy_refresh_token',
                user: {
                    id: userObj.id,
                    aud: 'authenticated',
                    role: 'service_role',
                    email: userObj.email,
                    email_confirmed_at: new Date().toISOString(),
                    phone: '',
                    confirmed_at: new Date().toISOString(),
                    last_sign_in_at: new Date().toISOString(),
                    app_metadata: {
                        provider: 'azure',
                        providers: ['azure']
                    },
                    user_metadata: {},
                    identities: [],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
                expires_at: Math.floor(Date.now() / 1000) + 3600
            };
            localStorage.setItem(tokenKey, JSON.stringify(session));
        }
    }, { perms: permissions, featureFlags: flags, serviceKey: SUPABASE_SERVICE_ROLE_KEY, ref: projectRef });
}
