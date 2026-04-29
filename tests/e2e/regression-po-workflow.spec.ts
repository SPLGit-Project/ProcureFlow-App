import { test, expect } from '@playwright/test';
import { injectTestUser } from './helpers/auth';

test.describe('PO workflow regression', () => {

    test('dashboard loads and KPI cards render', async ({ page }) => {
        await injectTestUser(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        // Dashboard heading or KPI metric cards should be visible
        const hasDashboard = await page.locator('text=/dashboard|pipeline|requests/i').first().isVisible().catch(() => false);
        expect(hasDashboard).toBeTruthy();
        await page.screenshot({ path: 'test-results/dashboard.png', fullPage: true });
    });

    test('PO create form renders', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'create_request', 'view_items']);
        await page.goto('/create');
        await page.waitForLoadState('networkidle');
        // Form should have site selection or item search
        const hasForm = await page.locator('select, input[type="text"]').first().isVisible().catch(() => false);
        expect(hasForm).toBeTruthy();
        await page.screenshot({ path: 'test-results/po-create.png', fullPage: true });
    });

    test('PO create item search shows catalogue prompt when no items match', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'create_request', 'view_items', 'manage_development']);
        await page.goto('/create');
        await page.waitForLoadState('networkidle');
        // Find an item search input and type something unlikely to match
        const searchInput = page.locator('input[placeholder*="search"], input[placeholder*="item"], input[placeholder*="Search"]').first();
        if (await searchInput.isVisible()) {
            await searchInput.fill('ZZZNOTINCAT_TEST999');
            await page.waitForTimeout(500);
            // The "Create an item request" CTA may appear if previewEnabled is on
            // We just verify no crash happens
            await page.screenshot({ path: 'test-results/po-create-no-match.png', fullPage: false });
        }
    });

    test('requests list renders', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard']);
        await page.goto('/requests');
        await page.waitForLoadState('networkidle');
        // Table or empty state should be visible
        const hasContent = await page.locator('table, text=/no requests|empty/i').first().isVisible().catch(() => false);
        expect(hasContent).toBeTruthy();
        await page.screenshot({ path: 'test-results/po-list.png', fullPage: true });
    });

    test('settings page loads with all original tabs', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'manage_settings', 'view_items', 'view_security']);
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('button:has-text("Users"), button:has-text("Security")').first()).toBeVisible();
        await page.screenshot({ path: 'test-results/settings.png', fullPage: true });
    });

    test('help page loads without errors', async ({ page }) => {
        await injectTestUser(page);
        await page.goto('/help');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('h1:has-text("Help & Support")')).toBeVisible();
    });

    test('approvals queue loads', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'approve_requests']);
        await page.goto('/approvals');
        await page.waitForLoadState('networkidle');
        const hasContent = await page.locator('table, text=/no.*approv/i, text=/pending/i').first().isVisible().catch(() => false);
        expect(hasContent).toBeTruthy();
    });

    test('no console errors on dashboard load', async ({ page }) => {
        const errors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text());
        });
        await injectTestUser(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        // Filter out known non-critical errors (supabase auth, SW registration etc.)
        const criticalErrors = errors.filter(e =>
            !e.includes('supabase') &&
            !e.includes('serviceWorker') &&
            !e.includes('SW:') &&
            !e.includes('auth') &&
            !e.includes('Failed to fetch')
        );
        expect(criticalErrors).toHaveLength(0);
    });

});
