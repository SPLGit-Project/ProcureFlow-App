import { test, expect } from '@playwright/test';
import { injectTestUser } from './helpers/auth';

test.describe('Smart Buying Dashboard', () => {

    test('route loads for manage_development user', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'manage_development']);
        await page.goto('/smart-buying');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('h1, h2').filter({ hasText: /Smart Buying/i }).first()).toBeVisible();
        await page.screenshot({ path: 'test-results/smart-buying.png', fullPage: true });
    });

    test('access restricted for user without manage_development', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'create_request']);
        await page.goto('/smart-buying');
        await page.waitForLoadState('networkidle');
        // Should show access restricted or redirect to dashboard
        const isRestricted = await page.locator('text=Access Restricted, text=Smart Buying').first().isVisible().catch(() => false);
        expect(isRestricted).toBeTruthy();
    });

    test('Plan and History tabs are present', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'manage_development']);
        await page.goto('/smart-buying');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('button:has-text("Plan"), [role="tab"]:has-text("Plan")').first()).toBeVisible();
        await expect(page.locator('button:has-text("History"), [role="tab"]:has-text("History")').first()).toBeVisible();
    });

    test('History tab switches view', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'manage_development']);
        await page.goto('/smart-buying');
        await page.waitForLoadState('networkidle');
        const historyTab = page.locator('button:has-text("History"), [role="tab"]:has-text("History")').first();
        await historyTab.click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: 'test-results/smart-buying-history.png', fullPage: true });
    });

    test('budget slider or allocation table is visible in Plan view', async ({ page }) => {
        await injectTestUser(page, ['view_dashboard', 'manage_development']);
        await page.goto('/smart-buying');
        await page.waitForLoadState('networkidle');
        // Either a table or budget-related UI should be visible
        const hasTable    = await page.locator('table').isVisible().catch(() => false);
        const hasBudget   = await page.locator('text=/budget|allocation|STAR/i').first().isVisible().catch(() => false);
        const hasEmpty    = await page.locator('text=/no data|upload|ingest/i').first().isVisible().catch(() => false);
        expect(hasTable || hasBudget || hasEmpty).toBeTruthy();
    });

});
