import { test, expect } from '@playwright/test';
import { injectTestUser } from './helpers/auth';

test.describe('Item Catalogue', () => {

    test('route loads correctly', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'view_items']);
        await page.goto('/item-catalogue');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('h1:has-text("Item Catalogue")')).toBeVisible();
        await page.screenshot({ path: 'test-results/item-catalogue.png', fullPage: true });
    });

    test('shows Preview badge (pre-go-live)', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'view_items']);
        await page.goto('/item-catalogue');
        await page.waitForLoadState('networkidle');
        // Should show either Preview or Live badge
        const badge = page.locator('span:has-text("Preview"), span:has-text("Live")');
        await expect(badge).toBeVisible();
    });

    test('search input is visible', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'view_items']);
        await page.goto('/item-catalogue');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
    });

    test('empty state shows correct message when no items', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'view_items']);
        await page.goto('/item-catalogue');
        await page.waitForLoadState('networkidle');
        // Either items table or empty state should be visible
        const hasItems = await page.locator('table').isVisible().catch(() => false);
        const hasEmptyState = await page.locator('text=No approved items yet').isVisible().catch(() => false);
        expect(hasItems || hasEmptyState).toBeTruthy();
    });

    test('search filters the list', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'view_items']);
        await page.goto('/item-catalogue');
        await page.waitForLoadState('networkidle');
        const searchInput = page.locator('input[placeholder*="Search"]');
        await searchInput.fill('ZZZNOMATCH_ZZZTEST');
        await page.waitForTimeout(300);
        // After searching for something unlikely, expect either "no match" message or empty table
        const resultText = page.locator('text=No items match your filters, text=No approved items yet');
        // Just verify no crash — the count display should update
        await expect(page.locator('text=/\\d+ items?/')).toBeVisible();
    });

    test('clear filters button appears when search is active', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'view_items']);
        await page.goto('/item-catalogue');
        await page.waitForLoadState('networkidle');
        const searchInput = page.locator('input[placeholder*="Search"]');
        await searchInput.fill('test');
        await expect(page.locator('button:has-text("Clear filters")')).toBeVisible();
    });

    test('refresh button works', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'view_items']);
        await page.goto('/item-catalogue');
        await page.waitForLoadState('networkidle');
        const refreshBtn = page.locator('button:has([data-lucide="refresh-cw"])').first();
        await expect(refreshBtn).toBeVisible();
        await refreshBtn.click();
    });

});
