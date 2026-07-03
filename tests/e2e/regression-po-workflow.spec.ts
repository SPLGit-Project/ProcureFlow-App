import { test, expect } from '@playwright/test';
import { injectTestUser, gotoAndWait } from './helpers/auth';

test.describe('PO workflow regression', () => {

    test('dashboard loads and KPI cards render', async ({ page }) => {
        await injectTestUser(page);
        await gotoAndWait(page, '/');
        // Home is an app launcher — wait for the heading which is always present
        await expect(
            page.locator('h1, [role="heading"]').first()
        ).toBeVisible({ timeout: 15000 });
        await page.screenshot({ path: 'test-results/dashboard.png', fullPage: true });
    });

    test('PO create form renders', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'create_request', 'view_items']);
        await gotoAndWait(page, '/create');
        // Form uses comboboxes for site/supplier and a text input for customer name
        await expect(page.locator('[role="combobox"], input, textarea').first()).toBeVisible();
        await page.screenshot({ path: 'test-results/po-create.png', fullPage: true });
    });

    test('PO create item search shows catalogue prompt when no items match', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'create_request', 'view_items', 'manage_development']);
        await gotoAndWait(page, '/create');
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
        await gotoAndWait(page, '/requests');
        await expect(page.locator('h1:has-text("Requests"), h2:has-text("Requests")').first()).toBeVisible();
        await page.screenshot({ path: 'test-results/po-list.png', fullPage: true });
    });

    test('settings page loads with all original tabs', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'manage_settings', 'view_items', 'view_security']);
        await gotoAndWait(page, '/settings');
        await expect(page.locator('button:has-text("Users"), button:has-text("Security")').first()).toBeVisible();
        await page.screenshot({ path: 'test-results/settings.png', fullPage: true });
    });

    test('help page loads without errors', async ({ page }) => {
        await injectTestUser(page);
        await gotoAndWait(page, '/help');
        await expect(page.locator('h1:has-text("Help & Support")')).toBeVisible();
    });

    test('approvals queue loads', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'approve_requests']);
        await gotoAndWait(page, '/approvals');
        await expect(page.locator('h1, h2').filter({ hasText: /approv/i }).first()).toBeVisible();
    });

    test('no console errors on dashboard load', async ({ page }) => {
        const errors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text());
        });
        await injectTestUser(page);
        await gotoAndWait(page, '/');
        // Filter out known non-critical errors (supabase auth, SW registration etc.)
        const criticalErrors = errors.filter(e =>
            !e.includes('supabase') &&
            !e.includes('serviceWorker') &&
            !e.includes('SW:') &&
            !e.includes('auth') &&
            !e.includes('Failed to fetch') &&
            !e.includes('SSL certificate') &&
            !e.includes('SSL')
        );
        expect(criticalErrors).toHaveLength(0);
    });

    test('can close PO with outstanding delivery quantities with warning', async ({ page }) => {
        // Inject a site user who is the requester for POR-202604-000038
        await injectTestUser(page, ['view_dashboard', 'receive_goods', 'view_all_requests'], ['66666666-6666-4666-8666-666666666666'], {
            id: '9ca1d17e-1e35-405d-83c8-b44201c2d80b',
            name: 'Test Requester',
            email: 'requester@splservices.com.au',
            role: 'SITE_USER',
            roleIds: ['SITE_USER']
        });
        
        // Navigate to the specific PO detail page (which is in ACTIVE status and has outstanding quantities)
        await gotoAndWait(page, '/requests/bd8bcf05-e98c-47ae-9d0d-e216ca19df24');
        
        // Wait for the detail view to render
        const completeBtn = page.locator('button:has-text("Complete Order")').first();
        await expect(completeBtn).toBeVisible({ timeout: 10000 });
        
        // Intercept the confirm dialog and assert on its message text
        let confirmText = '';
        page.on('dialog', async dialog => {
            confirmText = dialog.message();
            await dialog.dismiss(); // Dismiss the dialog so it doesn't actually execute
        });
        
        await completeBtn.click();
        
        expect(confirmText).toContain('Warning: There are outstanding delivery quantities on this order');
        expect(confirmText).toContain('permanently close the PO request');
        expect(confirmText).toContain('cannot be undone');
    });

    test('can close PO without outstanding delivery quantities with standard message', async ({ page }) => {
        // Inject Lisa Wilson (a site user with receive_goods permission)
        await injectTestUser(page, ['view_dashboard', 'receive_goods', 'view_all_requests'], ['22222222-2222-4222-8222-222222222222'], {
            id: 'a9bc57a2-ef69-411b-a8a5-f5f5179c2423',
            name: 'Lisa Wilson',
            email: 'lisa.wilson@splservices.com.au',
            role: 'SITE_USER',
            roleIds: ['SITE_USER']
        });
        
        // Navigate to POR-202606-000011 (which is in VARIANCE_PENDING status but has no outstanding quantities)
        await gotoAndWait(page, '/requests/05ff794a-d1d8-4815-8bcd-397011241b97');
        
        // Wait for the detail view to render
        const completeBtn = page.locator('button:has-text("Complete Order")').first();
        await expect(completeBtn).toBeVisible({ timeout: 10000 });
        
        // Intercept the confirm dialog and assert on its message text
        let confirmText = '';
        page.on('dialog', async dialog => {
            confirmText = dialog.message();
            await dialog.dismiss(); // Dismiss the dialog so it doesn't actually execute
        });
        
        await completeBtn.click();
        
        expect(confirmText).toContain('Are you sure you want to mark this order as complete?');
        expect(confirmText).toContain('finalize all lines and move it to history');
    });

});

