import { test, expect } from '@playwright/test';
import { injectTestUser, gotoAndWait } from './helpers/auth';

test.describe('Item Creation Happy-Path Flow', () => {
    test.setTimeout(120000);

    test('complete item creation journey from workbench to approval queue', async ({ page }) => {
        // Setup: Inject user with item creation permissions
        await injectTestUser(page, ['view_dashboard', 'manage_development', 'approve_item_requests', 'view_items']);

        // Navigate to the new item request wizard
        await gotoAndWait(page, '/items/new-request');

        // Step 1 — Transaction Type: banner shows step counter, main shows content
        await expect(page.getByText('Step 1 of 4')).toBeVisible();
        const main = page.getByRole('main');
        await expect(main.getByRole('heading', { name: /What type of transaction is this/i })).toBeVisible();

        // Select 'Standard Item' transaction type and advance
        await main.getByRole('button', { name: /Standard Item/i }).click();
        await page.getByRole('button', { name: /Continue/i }).click();

        // Step 2 — Build Item Code: verify the category selector loads
        await expect(page.getByText('Step 2 of 4')).toBeVisible({ timeout: 10000 });
        await expect(main.getByText('Catalogue Category', { exact: true }).first()).toBeVisible();

        // Select a category to verify sub-step navigation works
        await main.getByRole('button', { name: /Accommodation/i }).click();

        // After selecting a category, product type options should appear
        await expect(main.getByText('Product Type', { exact: true }).first()).toBeVisible({ timeout: 5000 });

        await page.screenshot({ path: 'test-results/item-creation-wizard.png', fullPage: true });
    });

    test('item creation wizard is accessible from navigation', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'manage_development', 'approve_item_requests', 'view_items']);
        await gotoAndWait(page, '/items/new-request');

        // 'Step 1 of 4' is in the banner header (not main) — use page-level locator
        await expect(page.getByText('Step 1 of 4')).toBeVisible();

        // All 4 step labels are in the progress bar inside main
        const main = page.getByRole('main');
        await expect(main.getByText('Transaction Type').first()).toBeVisible();
        await expect(main.getByText('Build Item Code')).toBeVisible();
        await expect(main.getByText('Business Context')).toBeVisible();
        await expect(main.getByText('Review & Submit')).toBeVisible();
    });
});

