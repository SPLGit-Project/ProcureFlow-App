import { test, expect } from '@playwright/test';
import { injectTestUser, gotoAndWait } from './helpers/auth';

test.describe('Brand assets and logo verification', () => {
    test('sign in screen renders ProcureFlow transition GIF', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('networkidle');
        
        const logoImg = page.getByAltText(/ProcureFlow logo/i);
        await expect(logoImg).toBeVisible();
        
        await page.screenshot({ path: 'test-results/login-screen-new-logo.png' });
    });

    test('side menu renders ProcureFlow logo in collapsed and expanded states', async ({ page }) => {
        await injectTestUser(page);
        await gotoAndWait(page, '/');

        // Collapsed floating rail
        const rail = page.locator('aside');
        await expect(rail).toBeVisible();
        const logoImg = rail.getByAltText(/logo/i).first();
        await expect(logoImg).toBeVisible();
        await page.screenshot({ path: 'test-results/side-menu-collapsed.png' });

        // Expanded floating rail
        const expandBtn = rail.locator('button[title*="Expand"]').or(rail.getByRole('button', { name: /Expand/i }));
        if (await expandBtn.isVisible()) {
            await expandBtn.click();
            await page.waitForTimeout(300);
            await expect(rail.getByAltText(/logo/i).first()).toBeVisible();
            await page.screenshot({ path: 'test-results/side-menu-expanded.png' });
        }
    });
});

