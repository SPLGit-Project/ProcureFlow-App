import { test, expect } from '@playwright/test';
import { injectTestUser, gotoAndWait } from './helpers/auth';

test.describe('Excel-like Column Filtering on Requests Screen', () => {
    test('renders requests table with Excel column filters and no old filter buttons', async ({ page }) => {
        await injectTestUser(page, [
            'view_dashboard', 'create_request', 'view_all_requests', 'approve_requests'
        ], [], {
            role: 'ADMIN',
            roleIds: ['ADMIN']
        });

        await gotoAndWait(page, '/requests');

        // Wait for table and data to load
        await expect(page.locator('table')).toBeVisible({ timeout: 20000 });
        await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 1, { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1500);

        // Ensure old filter buttons are NOT present
        await expect(page.locator('button:has-text("All Requests")')).toHaveCount(0);
        await expect(page.locator('select#requests-site-filter')).toHaveCount(0);

        // Verify column filter buttons exist on table headers
        await expect(page.locator('button[aria-label="Filter Site"]')).toBeVisible();
        await expect(page.locator('button[aria-label="Filter Customer"]')).toBeVisible();
        await expect(page.locator('button[aria-label="Filter Date"]')).toBeVisible();
        await expect(page.locator('button[aria-label="Filter Need By"]')).toBeVisible();
        await expect(page.locator('button[aria-label="Filter Supplier"]')).toBeVisible();
        await expect(page.locator('button[aria-label="Filter Status"]')).toBeVisible();

        // Capture screenshot of table header
        await page.screenshot({ path: 'test-results/excel-filter-initial.png', fullPage: true });

        // Click on "Status" filter button
        const statusFilterBtn = page.locator('button[aria-label="Filter Status"]');
        await statusFilterBtn.click();

        // Wait for popover menu to appear
        const popover = page.locator('div:has-text("Filter & Sort: Status")');
        await expect(popover.first()).toBeVisible();

        // Verify popover elements
        await expect(page.locator('button:has-text("Sort A to Z")')).toBeVisible();
        await expect(page.locator('input[placeholder="Search values..."]')).toBeVisible();
        await expect(page.locator('button:has-text("Apply")')).toBeVisible();
        await expect(page.locator('button:has-text("Clear Filter")')).toBeVisible();

        // Capture screenshot with popover open showing statuses with badges
        await page.screenshot({ path: 'test-results/excel-filter-status-popover.png', fullPage: false });

        // Test in-filter search
        const searchValuesInput = page.locator('input[placeholder="Search values..."]');
        await searchValuesInput.fill('Active');
        await page.waitForTimeout(400);

        // Capture screenshot with in-filter search applied
        await page.screenshot({ path: 'test-results/excel-filter-search.png', fullPage: false });
    });

    test('applies column filter and shows active filter chips', async ({ page }) => {
        await injectTestUser(page, [
            'view_dashboard', 'create_request', 'view_all_requests', 'approve_requests'
        ], [], {
            role: 'ADMIN',
            roleIds: ['ADMIN']
        });

        await gotoAndWait(page, '/requests');
        await expect(page.locator('table')).toBeVisible({ timeout: 20000 });
        await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 1, { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1500);

        // Open Status filter
        const statusFilterBtn = page.locator('button[aria-label="Filter Status"]');
        await statusFilterBtn.click();

        // Click "None" to unselect all statuses
        const noneBtn = page.locator('button:has-text("None")');
        await expect(noneBtn).toBeVisible();
        await noneBtn.click();

        // Select the first status in the list by clicking its label
        const firstStatusLabel = page.locator('div:has-text("Filter & Sort: Status") label').nth(1);
        if (await firstStatusLabel.isVisible()) {
            await firstStatusLabel.click();
        }

        // Click Apply
        const applyBtn = page.locator('button:has-text("Apply")');
        await applyBtn.click();

        // Verify Active Filter chip appears
        await expect(page.locator('span').filter({ hasText: /Active Filters/i }).first()).toBeVisible({ timeout: 5000 });
        await expect(page.locator('button:has-text("Clear all")')).toBeVisible();

        // Capture screenshot with active filter chip
        await page.screenshot({ path: 'test-results/excel-filter-applied-chip.png', fullPage: true });

        // Click "Clear all"
        await page.locator('button:has-text("Clear all")').click();

        // Active filters should disappear
        await expect(page.locator('span').filter({ hasText: /Active Filters/i })).toHaveCount(0);
    });
});
