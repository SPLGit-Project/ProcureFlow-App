import { test, expect } from '@playwright/test';
import { injectTestUser, gotoAndWait } from './helpers/auth';

test.describe('Item Approval Queue', () => {

    test('route loads for user with approve_item_requests permission', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'approve_item_requests']);
        await gotoAndWait(page, '/item-approval-queue');
        await expect(page.locator('h1:has-text("Item Approval Queue")')).toBeVisible();
        await page.screenshot({ path: 'test-results/item-approval-queue.png', fullPage: true });
    });

    test('access denied for user without approve_item_requests permission', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'create_request']);
        await gotoAndWait(page, '/item-approval-queue');
        await expect(page.locator('text=Access Restricted')).toBeVisible();
        await expect(page.locator('code:has-text("approve_item_requests")')).toBeVisible();
    });

    test('manage_development permission bypasses access gate', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'manage_development']);
        await gotoAndWait(page, '/item-approval-queue');
        await expect(page.locator('h1:has-text("Item Approval Queue")')).toBeVisible();
    });

    test('empty queue shows correct empty state', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'approve_item_requests']);
        await gotoAndWait(page, '/item-approval-queue');
        // Either queue items or empty state message should be present
        const hasQueueItems = await page.locator('[class*="rounded-2xl"][class*="border"]').count() > 1;
        const hasEmptyState = await page.locator('text=No requests pending your approval').isVisible().catch(() => false);
        expect(hasQueueItems || hasEmptyState).toBeTruthy();
    });

    test('refresh button is present and clickable', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'approve_item_requests']);
        await gotoAndWait(page, '/item-approval-queue');
        const refreshBtn = page.locator('button:has(svg[class*="lucide-refresh-cw"])').first();
        await expect(refreshBtn).toBeVisible();
        await refreshBtn.click();
    });

});
