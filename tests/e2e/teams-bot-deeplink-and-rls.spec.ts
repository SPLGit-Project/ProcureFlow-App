import { test, expect } from '@playwright/test';
import { injectTestUser } from './helpers/auth';

test.describe('1:1 Teams Bot Deep Links, OAuth Redirect Preservation & Strict Access', () => {
    test('preserves /requests/:id destination across unauthenticated redirect to /login and post-login return', async ({ page }) => {
        const syntheticId = '00000000-0000-4000-8000-000000000777';
        const targetPath = `/requests/${syntheticId}`;

        // 1. Visit deep link unauthenticated
        await page.goto(targetPath, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('#root:not(:empty)', { timeout: 20000 });

        // Should land on /login and store pf_post_login_redirect
        await expect(page).toHaveURL(/\/login/);
        const savedRedirect = await page.evaluate(() => sessionStorage.getItem('pf_post_login_redirect'));
        expect(savedRedirect).toBe(targetPath);

        // 2. Simulate Microsoft OAuth return to origin ('/') after signing in
        await injectTestUser(page, ['view_dashboard', 'approve_requests', 'view_active_requests'], ['22222222-2222-4222-8222-222222222222'], {
            id: 'd593571a-c4bd-4627-8b03-33704226e826',
            name: 'David You',
            email: 'david.you@splservices.com.au',
            role: 'SITE_MANAGER',
            roleIds: ['SITE_MANAGER'],
        });

        await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('#root:not(:empty)', { timeout: 20000 });

        // Must automatically redirect to the preserved /requests/:id destination
        await expect(page).toHaveURL(new RegExp(`/requests/${syntheticId}`));
        const clearedRedirect = await page.evaluate(() => sessionStorage.getItem('pf_post_login_redirect'));
        expect(clearedRedirect).toBeNull();
    });

    test('supports backward-compatible /approvals/:id route without bouncing to home', async ({ page }) => {
        const syntheticId = '00000000-0000-4000-8000-000000000888';
        await injectTestUser(page, ['view_dashboard', 'approve_requests'], ['77777777-7777-4777-8777-777777777777'], {
            id: 'd593571a-c4bd-4627-8b03-33704226e826',
            name: 'David You',
            email: 'david.you@splservices.com.au',
            role: 'SITE_MANAGER',
            roleIds: ['SITE_MANAGER'],
        });

        await page.goto(`/approvals/${syntheticId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('#root:not(:empty)', { timeout: 20000 });

        // Should stay on /approvals/:id (handled by PODetail, not wildcard redirect to /)
        await expect(page).toHaveURL(new RegExp(`/approvals/${syntheticId}`));
    });
});
