import { test, expect } from '@playwright/test';
import { injectTestUser, gotoAndWait } from './helpers/auth';

test.describe('Settings → Item Creation tab', () => {

    test('Item Creation tab is visible with manage_items permission', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'manage_settings', 'manage_items']);
        await gotoAndWait(page, '/settings');
        await expect(page.locator('button:has-text("Item Creation")')).toBeVisible();
        await page.screenshot({ path: 'test-results/settings-tabs.png', fullPage: false });
    });

    test('clicking Item Creation tab renders the settings content', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'manage_settings', 'manage_items']);
        await gotoAndWait(page, '/settings');
        await page.click('button:has-text("Item Creation")');
        await page.waitForTimeout(500);
        await expect(page.locator('h3:has-text("Margin Thresholds")')).toBeVisible();
        await page.screenshot({ path: 'test-results/settings-item-creation.png', fullPage: true });
    });

    test('margin thresholds section has 6 input fields', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'manage_settings', 'manage_items']);
        await gotoAndWait(page, '/settings');
        await page.click('button:has-text("Item Creation")');
        await page.waitForTimeout(500);
        // Should have inputs for: Default, Standard, Contract, Customer-Specific, Promotional, Customer Group
        const inputs = page.locator('text=Margin Thresholds').locator('..').locator('input[type="number"]');
        await expect(inputs).toHaveCount(6);
    });

    test('approval rules section is present', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'manage_settings', 'manage_items']);
        await gotoAndWait(page, '/settings');
        await page.click('button:has-text("Item Creation")');
        await page.waitForTimeout(500);
        await expect(page.locator('text=Approval Rules')).toBeVisible();
    });

    test('SKU code maps section is present', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'manage_settings', 'manage_items']);
        await gotoAndWait(page, '/settings');
        await page.click('button:has-text("Item Creation")');
        await page.waitForTimeout(500);
        await expect(page.locator('h3:has-text("SKU Code Maps")')).toBeVisible();
    });

    test('Smart Buying tab still renders correctly', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'manage_settings']);
        await gotoAndWait(page, '/settings');
        await page.click('button:has-text("Smart Buying")');
        await page.waitForTimeout(500);
        await expect(page.locator('text=Item Properties').first()).toBeVisible();
    });

});
