import { test, expect } from '@playwright/test';
import { injectTestUser, gotoAndWait } from './helpers/auth';

test.describe('Navigation and feature flag gating', () => {

    test('home loads as the authenticated landing page', async ({ page }) => {
        await injectTestUser(page, [
            'view_dashboard', 'create_request', 'manage_development',
            'approve_item_requests', 'manage_settings', 'view_items',
            'approve_requests', 'view_finance', 'manage_finance',
            'manage_item_definition', 'manage_sell_pricing',
            'manage_pricing_schedules', 'view_active_requests',
            'view_completed_requests', 'link_concur', 'receive_goods',
        ]);
        await gotoAndWait(page, '/');
        await expect(page.getByText('App drawer')).toBeVisible();
        await expect(page.getByText('MercerFlow Apps')).toBeVisible();
        await expect(page.getByRole('heading', { level: 1, name: /QA|Welcome back|Good day|MercerFlow/i })).toBeVisible();
        await expect(page.getByText("Today's focus")).toBeVisible();
        await expect(page.getByText('MercerFlow Command')).not.toBeVisible();
        await expect(page.getByText('Recommended next')).not.toBeVisible();
        await expect(page.getByText(/Adelaide|All Sites/i).first()).toBeVisible();
        await expect(page.getByRole('link', { name: /Item Management/i })).not.toBeVisible();
        await expect(page.getByRole('link', { name: 'Procurement', exact: true })).not.toBeVisible();
        await expect(page.getByRole('button', { name: /Show details for CatalogFlow/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Show details for ProcureFlow/i })).toBeVisible();
        await expect(page.getByText('Action Center')).not.toBeVisible();
        await page.screenshot({ path: 'test-results/nav-admin.png', fullPage: true });
    });

    test('procurement dashboard moved under procurement route', async ({ page }) => {
        await injectTestUser(page, [
            'view_dashboard', 'view_items', 'manage_item_definition',
            'manage_sell_pricing', 'manage_pricing_schedules',
            'view_finance', 'manage_finance',
        ]);
        await gotoAndWait(page, '/procurement/dashboard');
        await expect(page.locator('header').getByText('Dashboard', { exact: true })).toBeVisible();
        await expect(page.locator('header a[title="Home"]')).toBeVisible();
        await expect(page.locator('#admin-tab-slot').getByRole('link')).toHaveCount(0);
    });

    test('legacy dashboard routes redirect to procurement dashboard', async ({ page }) => {
        await injectTestUser(page);
        await gotoAndWait(page, '/dashboard');
        await expect(page).toHaveURL(/\/procurement\/dashboard$/);
        await expect(page.locator('header').getByText('Dashboard', { exact: true })).toBeVisible();

        await gotoAndWait(page, '/procurement');
        await expect(page).toHaveURL(/\/procurement\/dashboard$/);
    });

    test('expanded side menu shows Home and Dashboard destinations', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('pf-revamp-sidebar-expanded', 'true');
        });
        await injectTestUser(page);
        await gotoAndWait(page, '/');
        const sideNav = page.locator('aside nav');
        await expect(sideNav.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
        await expect(sideNav.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
    });

    test('approvals nav item visible with approve_item_requests permission', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('pf-revamp-sidebar-expanded', 'true');
        });
        await injectTestUser(page, ['view_dashboard', 'approve_item_requests']);
        await gotoAndWait(page, '/');
        await expect(page.getByRole('link', { name: /Approvals/i })).toBeVisible();
    });

    test('approvals nav item hidden without approve_item_requests permission', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('pf-revamp-sidebar-expanded', 'true');
        });
        await injectTestUser(page, ['view_dashboard']);
        await gotoAndWait(page, '/');
        await expect(page.getByRole('link', { name: /Approvals/i })).not.toBeVisible();
    });

    test('item-catalogue nav item visible with view_items permission', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('pf-revamp-sidebar-expanded', 'true');
        });
        await injectTestUser(page, ['view_dashboard', 'view_items']);
        await gotoAndWait(page, '/');
        await expect(page.getByRole('link', { name: /Item Catalogue/i })).toBeVisible();
    });

    test('settings nav item visible with a settings screen permission', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('pf-revamp-sidebar-expanded', 'true');
        });
        await injectTestUser(page, ['view_security']);
        await gotoAndWait(page, '/');
        await expect(page.getByRole('link', { name: /Admin Panel/i })).toBeVisible();

        await gotoAndWait(page, '/settings');
        await expect(page.getByRole('button', { name: /Security Roles/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Menu Config/i })).not.toBeVisible();
    });

    test('admin switch view keeps selected role across navigation', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('pf-revamp-sidebar-expanded', 'true');
            localStorage.removeItem('activeSiteIds');
            localStorage.removeItem('activeSiteId');
        });
        
        await injectTestUser(
            page,
            [
                'view_dashboard', 'create_request', 'view_all_requests', 
                'approve_requests', 'link_concur', 'receive_goods', 
                'view_finance', 'manage_finance', 'manage_settings', 
                'manage_items', 'manage_suppliers', 'view_reports'
            ],
            ['11111111-1111-4111-8111-111111111111'],
            {
                id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
                name: 'Charlie Admin',
                email: 'charlie@company.com',
                role: 'ADMIN',
                roleIds: ['ADMIN'],
                avatar: 'QA'
            }
        );

        await gotoAndWait(page, '/');
        await page.getByRole('button', { name: /Charlie Admin/i }).click();
        await page.getByRole('button', { name: /Switch View/i }).click();
        await page.getByText('Site User View').click();

        await expect(page.getByRole('link', { name: /Admin Tools/i })).not.toBeVisible();
        await expect(page.getByRole('link', { name: /Approval Rules/i })).not.toBeVisible();
        await expect(page.getByRole('link', { name: /Create Request/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /Dashboard/i })).toBeVisible();

        await page.mouse.click(20, 20);
        await page.getByRole('link', { name: /Requests/i }).first().click();
        await expect(page).toHaveURL(/\/requests$/);
        await expect(page.locator('text=Access Restricted')).not.toBeVisible();

        await page.getByRole('link', { name: 'Home', exact: true }).first().click();
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByRole('link', { name: /Admin Tools/i })).not.toBeVisible();
        await expect(page.getByRole('link', { name: /Create Request/i })).toBeVisible();
    });

    test('home header site selector is only shown on home', async ({ page }) => {
        await injectTestUser(page);
        await gotoAndWait(page, '/');
        await expect(page.getByText(/Adelaide|All Sites/i).first()).toBeVisible();
        await gotoAndWait(page, '/procurement/dashboard');
        await expect(page.getByText(/Adelaide|All Sites/i)).not.toBeVisible();
    });

    test('home site selector only lists accessible sites and filters app data', async ({ page }) => {
        await injectTestUser(page, [
            'view_dashboard', 'create_request', 'manage_development',
            'approve_item_requests', 'view_items', 'approve_requests',
            'view_active_requests', 'view_completed_requests',
            'view_all_requests',
        ], ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']);
        await gotoAndWait(page, '/');

        const siteSelector = page.getByRole('button', { name: 'All Sites' }).first();
        await expect(siteSelector).toBeVisible();
        await siteSelector.click();
        await expect(page.getByText('SPL Adelaide')).toBeVisible();
        await expect(page.getByText('SPL Brisbane')).toBeVisible();
        await expect(page.getByText('SPL Sydney')).not.toBeVisible();

        await page.getByRole('button', { name: 'None' }).click();
        await expect(page.getByRole('button', { name: 'No Site Selected' }).first()).toBeVisible();
        await page.getByText('SPL Brisbane').click();
        await expect(page.getByRole('button', { name: 'SPL Brisbane' }).first()).toBeVisible();
        await expect.poll(async () => page.evaluate(() => localStorage.getItem('activeSiteIds'))).toBe(JSON.stringify(['22222222-2222-4222-8222-222222222222']));

        await gotoAndWait(page, '/requests');
        const requestsTable = page.getByRole('table');
        await expect(requestsTable.getByText('SPL Brisbane').first()).toBeVisible();
        await expect(requestsTable.getByText('SPL Adelaide').first()).not.toBeVisible();
        await expect(requestsTable.getByText('SPL Sydney').first()).not.toBeVisible();
    });

    test('admin can configure home greeting and announcement messaging', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'manage_settings', 'view_branding']);
        await gotoAndWait(page, '/settings');
        await page.getByRole('button', { name: /Branding/i }).click();
        await expect(page.getByText('Home Experience')).toBeVisible();
        await expect(page.getByText('Greeting source')).toBeVisible();
        await expect(page.getByText('Message type')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Quote', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Announcement', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Announcement', exact: true }).click();
        await expect(page.getByText('Announcement source')).toBeVisible();
    });

    test('navigate to /item-approval-queue route', async ({ page }) => {
        await injectTestUser(page);
        await gotoAndWait(page, '/item-approval-queue');
        // Either queue content or the access-denied gate should render
        await expect(page.locator('text=Work Queue').or(page.locator('text=Access Restricted'))).toBeVisible();
    });

    test('navigate to /item-catalogue route', async ({ page }) => {
        await injectTestUser(page);
        await gotoAndWait(page, '/item-catalogue');
        await expect(page.locator('text=Item Catalogue').first()).toBeVisible();
    });

    test('screenshot: nav rail with manage_development user', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'manage_development', 'approve_item_requests', 'view_items', 'manage_settings']);
        await gotoAndWait(page, '/');
        await page.screenshot({ path: 'test-results/nav-full.png', fullPage: true });
    });

    test('permission-limited home hides unavailable modules', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard']);
        await gotoAndWait(page, '/');
        await expect(page.getByAltText('ProcureFlow logo')).toBeVisible();
        await expect(page.getByAltText('CatalogFlow logo')).toBeVisible();
        await expect(page.getByAltText('PriceFlow logo')).not.toBeVisible();
        await expect(page.getByText('Quick create')).not.toBeVisible();
        await expect(page.getByText('Recent destinations')).not.toBeVisible();
    });

    test('home supports the light mode app launcher treatment', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('app-theme', 'light');
        });
        await injectTestUser(page, [
            'view_dashboard', 'view_items', 'manage_item_definition',
            'manage_sell_pricing', 'manage_pricing_schedules',
            'view_finance', 'manage_finance',
        ]);
        await gotoAndWait(page, '/');
        await expect(page.getByText('App drawer')).toBeVisible();
        await expect(page.getByRole('button', { name: /Show details for CatalogFlow/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Show details for ProcureFlow/i })).toBeVisible();
        await page.screenshot({ path: 'test-results/home-light.png', fullPage: true });
    });

    test('home module app expands and reveals module action', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'view_items']);
        await gotoAndWait(page, '/');
        await page.getByRole('button', { name: /Show details for CatalogFlow/i }).click();
        await expect(page.getByText('Govern requests, queues, and catalogue visibility.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Open app' })).toBeVisible();
    });

    test('home works on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await injectTestUser(page);
        await gotoAndWait(page, '/');
        await expect(page.getByText('App drawer')).toBeVisible();
        await expect(page.getByRole('heading', { level: 1, name: /QA|Welcome back|Good day|MercerFlow/i })).toBeVisible();
        await expect(page.locator('header a[title="Home"]')).toBeVisible();
        await expect(page.locator('header button[title="Light mode"], header button[title="Dark mode"]')).toBeVisible();
        await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
    });

    test('mobile drawer keeps grouped section dividers', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await injectTestUser(page, [
            'view_dashboard', 'create_request', 'manage_development',
            'approve_item_requests', 'manage_settings', 'view_items',
            'approve_requests', 'view_finance', 'manage_finance',
            'manage_item_definition', 'manage_sell_pricing',
            'manage_pricing_schedules', 'view_active_requests',
            'view_completed_requests',
        ]);
        await gotoAndWait(page, '/');
        await page.getByRole('button', { name: 'More' }).click();
        await expect(page.getByTestId('mobile-nav-group-workspace')).toBeVisible();
        await expect(page.getByTestId('mobile-nav-group-procurement')).toBeVisible();
        await expect(page.getByTestId('mobile-nav-group-items')).toBeVisible();
        await expect(page.getByTestId('mobile-nav-group-pricing')).toBeVisible();
        await expect(page.getByLabel('All navigation').getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
    });

});
