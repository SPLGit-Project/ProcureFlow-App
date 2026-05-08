import { test, expect } from '@playwright/test';
import { injectTestUser, gotoAndWait } from './helpers/auth';

test.describe('Navigation and feature flag gating', () => {

    test('all core nav items visible for admin user', async ({ page }) => {
        await injectTestUser(page);
        await gotoAndWait(page, '/');
        await expect(page.locator('text=Dashboard').first()).toBeVisible();
        await page.screenshot({ path: 'test-results/nav-admin.png', fullPage: true });
    });

    test('item-approval-queue nav item visible with approve_item_requests permission', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'approve_item_requests']);
        await gotoAndWait(page, '/');
        await expect(page.locator('text=Item Approvals')).toBeVisible();
    });

    test('item-approval-queue nav item hidden without approve_item_requests permission', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard']);
        await gotoAndWait(page, '/');
        await expect(page.locator('text=Item Approvals')).not.toBeVisible();
    });

    test('item-catalogue nav item visible with view_items permission', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'view_items']);
        await gotoAndWait(page, '/');
        await expect(page.locator('text=Item Catalogue').first()).toBeVisible();
    });

    test('navigate to /item-approval-queue route', async ({ page }) => {
        await injectTestUser(page);
        await gotoAndWait(page, '/item-approval-queue');
        // Either queue content or the access-denied gate should render
        await expect(page.locator('text=Item Approval Queue').or(page.locator('text=Access Restricted'))).toBeVisible();
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

});
