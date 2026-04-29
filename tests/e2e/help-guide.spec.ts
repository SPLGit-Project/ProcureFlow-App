import { test, expect } from '@playwright/test';
import { injectTestUser } from './helpers/auth';

test.describe('Help Guide', () => {

    test('help page loads', async ({ page }) => {
        await injectTestUser(page);
        await page.goto('/help');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('h1:has-text("Help & Support")')).toBeVisible();
        await page.screenshot({ path: 'test-results/help-guide.png', fullPage: true });
    });

    test('all existing and new categories appear in sidebar', async ({ page }) => {
        await injectTestUser(page);
        await page.goto('/help');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('text=Getting Started')).toBeVisible();
        await expect(page.locator('text=Core Workflow')).toBeVisible();
        await expect(page.locator('text=Admin Functions')).toBeVisible();
        await expect(page.locator('text=Configuration Tools')).toBeVisible();
        await expect(page.locator('text=Item Creation')).toBeVisible();
        await expect(page.locator('text=Item Approvals')).toBeVisible();
        await expect(page.locator('text=Smart Buying')).toBeVisible();
        await expect(page.locator('text=Data Sync')).toBeVisible();
    });

    test('clicking Item Creation category shows its guides', async ({ page }) => {
        await injectTestUser(page);
        await page.goto('/help');
        await page.waitForLoadState('networkidle');
        await page.click('button:has-text("Item Creation")');
        await page.waitForTimeout(300);
        await expect(page.locator('text=Creating an Item Request')).toBeVisible();
        await expect(page.locator('text=Duplicate Check')).toBeVisible();
        await expect(page.locator('text=SKU Generation')).toBeVisible();
        await expect(page.locator('text=Understanding Approval Routing')).toBeVisible();
        await page.screenshot({ path: 'test-results/help-item-creation.png', fullPage: true });
    });

    test('clicking Item Approvals category shows its guides', async ({ page }) => {
        await injectTestUser(page);
        await page.goto('/help');
        await page.waitForLoadState('networkidle');
        await page.click('button:has-text("Item Approvals")');
        await page.waitForTimeout(300);
        await expect(page.locator('text=Reviewing an Item Request')).toBeVisible();
        await expect(page.locator('text=Making an Approval Decision')).toBeVisible();
        await expect(page.locator('text=Publication Targets')).toBeVisible();
    });

    test('clicking Smart Buying category shows its guides', async ({ page }) => {
        await injectTestUser(page);
        await page.goto('/help');
        await page.waitForLoadState('networkidle');
        await page.click('button:has-text("Smart Buying")');
        await page.waitForTimeout(300);
        await expect(page.locator('text=Live vs Manual Data Mode')).toBeVisible();
        await expect(page.locator('text=STAR Days Explained')).toBeVisible();
        await expect(page.locator('text=Saving and Tracking Plans')).toBeVisible();
    });

    test('clicking Data Sync category shows its guides', async ({ page }) => {
        await injectTestUser(page);
        await page.goto('/help');
        await page.waitForLoadState('networkidle');
        await page.click('button:has-text("Data Sync")');
        await page.waitForTimeout(300);
        await expect(page.locator('text=Reading the Data Sync Panel')).toBeVisible();
        await expect(page.locator('text=Forcing a Resync')).toBeVisible();
        await expect(page.locator('text=Site Exclusions Explained')).toBeVisible();
    });

    test('search filters guides', async ({ page }) => {
        await injectTestUser(page);
        await page.goto('/help');
        await page.waitForLoadState('networkidle');
        await page.fill('input[placeholder*="Search"]', 'SKU');
        await page.waitForTimeout(300);
        await page.screenshot({ path: 'test-results/help-search.png', fullPage: true });
    });

});
