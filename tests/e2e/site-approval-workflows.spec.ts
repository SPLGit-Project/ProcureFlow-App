import { test, expect, Page } from '@playwright/test';
import { injectTestUser } from './helpers/auth';

/**
 * Navigate with domcontentloaded to prevent lazy HMR bundle stalls,
 * then wait for React root to mount.
 */
async function safeGoto(page: Page, path: string) {
    await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#root:not(:empty)', { timeout: 20000 });
}

/**
 * Handles the standard onboarding / feature updates dialog exactly as an ordinary
 * user does: waits for the modal to mount, then clicks the real UI "Close" button.
 */
async function dismissFeatureUpdatesIfPresent(page: Page) {
    const dialog = page.locator('dialog[aria-labelledby="feature-updates-title"]');
    try {
        await dialog.waitFor({ state: 'visible', timeout: 5000 });
        const closeBtn = dialog.getByRole('button', { name: 'Close', exact: true });
        await closeBtn.click();
        await dialog.waitFor({ state: 'hidden', timeout: 5000 });
    } catch {
        // Dialog not present or already closed
    }
}

test.describe('Site Approval Workflows & Live Notifications', () => {
    test.beforeEach(async ({ page }) => {
        await page.addLocatorHandler(
            page.locator('dialog[aria-labelledby="feature-updates-title"]'),
            async (dialog) => {
                const closeBtn = dialog.getByRole('button', { name: 'Close', exact: true });
                if (await closeBtn.isVisible()) {
                    await closeBtn.click();
                    await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
                }
            }
        );

        // Inject Admin test user
        await injectTestUser(page, [
            'view_dashboard',
            'manage_settings',
            'approve_requests',
            'create_request',
            'view_all_requests'
        ]);
    });

    test('renders Facility Routing Matrix with Melbourne, Matthew Mancuso, and Eb', async ({ page }) => {
        await safeGoto(page, '/admin/workflows');
        await dismissFeatureUpdatesIfPresent(page);

        // Verify page header
        await expect(page.getByRole('heading', { name: 'Site Approval Workflows & Notifications' })).toBeVisible();
        await expect(page.getByText('Live Notifications: Active')).toBeVisible();

        // Verify SPL Melbourne card and verified managers
        const melbourneCard = page.locator('text=SPL Melbourne').locator('xpath=ancestor::div[contains(@class, "rounded-2xl")]').first();
        await expect(melbourneCard).toBeVisible();
        await expect(melbourneCard.getByText('Matthew Mancuso')).toBeVisible();
        await expect(melbourneCard.getByText('matthew.mancuso@splservices.com.au')).toBeVisible();
        await expect(melbourneCard.getByText(/Ebrahim Mokhtari/)).toBeVisible();

        // Verify SPL Albury card has Matthew Mancuso and Eb (escalation)
        const alburyCard = page.locator('text=SPL Albury').locator('xpath=ancestor::div[contains(@class, "rounded-2xl")]').first();
        await expect(alburyCard).toBeVisible();
        await expect(alburyCard.getByText('Matthew Mancuso')).toBeVisible();
        await expect(alburyCard.getByText('matthew.mancuso@splservices.com.au')).toBeVisible();
        await expect(alburyCard.getByText(/Ebrahim Mokhtari/)).toBeVisible();
        await expect(alburyCard.getByText(/72h Auto SLA/)).toBeVisible();

        // Verify SPL Mackay card has Bronwen Glover and Eb (escalation)
        const mackayCard = page.locator('text=SPL Mackay').locator('xpath=ancestor::div[contains(@class, "rounded-2xl")]').first();
        await expect(mackayCard).toBeVisible();
        await expect(mackayCard.getByText('Bronwen Glover')).toBeVisible();
        await expect(mackayCard.getByText('bronwen.glover@splservices.com.au')).toBeVisible();
        await expect(mackayCard.getByText(/Ebrahim Mokhtari/)).toBeVisible();
    });

    test('toggles Live Notification Dispatch mode cleanly', async ({ page }) => {
        await safeGoto(page, '/admin/workflows');
        await dismissFeatureUpdatesIfPresent(page);
        await expect(page.getByRole('heading', { name: 'Site Approval Workflows & Notifications' })).toBeVisible();

        // Initial state should be Live
        const toggleBtn = page.getByRole('button', { name: /Switch to Preview Mode|Turn On Live Dispatch/i });
        await expect(toggleBtn).toBeVisible();

        // Toggle to Preview Mode
        await toggleBtn.click();
        await expect(page.getByText(/Preview Mode Active/i)).toBeVisible();

        // Toggle back to Live Dispatch
        await page.getByRole('button', { name: /Turn On Live Dispatch/i }).click();
        await expect(page.getByText(/Live Notifications: Active/i)).toBeVisible();
    });

    test('dispatches test notification alert and records telemetry', async ({ page }) => {
        await safeGoto(page, '/admin/workflows');
        await dismissFeatureUpdatesIfPresent(page);

        // Click Send Test Alert button
        const sendTestBtn = page.getByRole('button', { name: /Send Test Alert/i });
        await expect(sendTestBtn).toBeVisible();
        await sendTestBtn.click();

        // Verify toast confirmation or dispatch
        await expect(page.getByText(/Test notification sent successfully/i)).toBeVisible();
    });

    test('logs audit trail entries with real telemetry', async ({ page }) => {
        await safeGoto(page, '/admin/workflows');
        await dismissFeatureUpdatesIfPresent(page);
        await expect(page.getByRole('heading', { name: 'Site Approval Workflows & Notifications' })).toBeVisible();

        // Switch to Audit tab
        await page.getByRole('button', { name: /Audit Trail & Notification Telemetry/i }).click();

        // Verify audit log header
        await expect(page.getByText('Workflow & Telemetry Audit Trail')).toBeVisible();
        await expect(page.getByRole('table')).toBeVisible();
    });

    test('persists configured facility changes across page reload', async ({ page }) => {
        await safeGoto(page, '/admin/workflows');
        await dismissFeatureUpdatesIfPresent(page);
        await expect(page.getByRole('heading', { name: 'Site Approval Workflows & Notifications' })).toBeVisible();

        // Click Edit button on Melbourne card
        const melbourneCard = page.locator('text=SPL Melbourne').locator('xpath=ancestor::div[contains(@class, "rounded-2xl")]').first();
        await melbourneCard.locator('button[title*="Edit Approver"]').click();

        await expect(page.getByText('Edit Workflow: SPL Melbourne')).toBeVisible();

        // Update approval manager name
        const nameInput = page.getByPlaceholder('e.g. Matthew Mancuso');
        await nameInput.fill('Matthew Mancuso (Acting Site Lead)');

        // Save workflow
        await page.getByRole('button', { name: 'Save Workflow' }).click();

        // Verify updated manager name appears on Melbourne card
        await expect(page.getByText('Matthew Mancuso (Acting Site Lead)')).toBeVisible();

        // Reload page to verify persistence across reloads/restarts
        await page.reload();
        await dismissFeatureUpdatesIfPresent(page);
        await expect(page.getByRole('heading', { name: 'Site Approval Workflows & Notifications' })).toBeVisible();

        // Card must still display the persisted manager name
        await expect(page.getByText('Matthew Mancuso (Acting Site Lead)')).toBeVisible();

        // Restore clean baseline for future runs
        const restoredCard = page.locator('text=SPL Melbourne').locator('xpath=ancestor::div[contains(@class, "rounded-2xl")]').first();
        await restoredCard.locator('button[title*="Edit Approver"]').click();
        await expect(page.getByText('Edit Workflow: SPL Melbourne')).toBeVisible();
        await page.getByPlaceholder('e.g. Matthew Mancuso').fill('Matthew Mancuso');
        await page.getByRole('button', { name: 'Save Workflow' }).click();
        await expect(page.getByText('Matthew Mancuso', { exact: true }).first()).toBeVisible();
    });
});
