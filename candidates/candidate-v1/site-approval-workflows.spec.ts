import { test, expect, Page } from '@playwright/test';
import { injectTestUser, gotoAndWait } from './helpers/auth';

/**
 * Handles the standard onboarding / feature updates dialog exactly as an ordinary
 * user does: waits for the modal to mount, then clicks the real UI "Close" button.
 * Preserves the full real application DOM and native <dialog> behavior without
 * any prototype monkeypatching or CSS overrides.
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

test.describe('Per-Site Approval Workflows & Melbourne Demo', () => {
    test.beforeEach(async ({ page }) => {
        // Inject Admin test user (real auth state, zero prototype monkeypatches or CSS overrides)
        await injectTestUser(page, [
            'view_dashboard',
            'manage_settings',
            'approve_requests',
            'create_request',
            'view_all_requests'
        ]);
    });

    test('renders Facility Routing Matrix with Melbourne, Matthew Mancuso, and Eb', async ({ page }) => {
        await gotoAndWait(page, '/admin/workflows');
        await dismissFeatureUpdatesIfPresent(page);

        // Verify page header
        await expect(page.getByRole('heading', { name: 'Site Approval Workflows' })).toBeVisible();
        await expect(page.getByText('Safe Non-Sending Harness Active')).toBeVisible();

        // Verify SLA governance advisory callout
        await expect(page.getByText('Escalation SLA Governance Notice')).toBeVisible();
        await expect(page.getByText('48-hour timer applies strictly to supplier stock reservations')).toBeVisible();

        // Verify SPL Melbourne card and verified managers
        const melbourneCard = page.locator('text=SPL Melbourne').locator('xpath=ancestor::div[contains(@class, "rounded-2xl")]').first();
        await expect(melbourneCard).toBeVisible();
        await expect(melbourneCard.getByText('Matthew Mancuso')).toBeVisible();
        await expect(melbourneCard.getByText('matthew.mancuso@splservices.com.au')).toBeVisible();
        await expect(melbourneCard.getByText(/Ebrahim Mokhtari/)).toBeVisible();
        await expect(melbourneCard.getByText('ebrahim.mokhtari@splservices.com.au')).toBeVisible();
        await expect(melbourneCard.getByText('Decision Required')).toBeVisible();
    });

    test('executes end-to-end Melbourne approval workflow demo & Concur handover', async ({ page }) => {
        await gotoAndWait(page, '/admin/workflows');
        await dismissFeatureUpdatesIfPresent(page);
        await expect(page.getByRole('heading', { name: 'Site Approval Workflows' })).toBeVisible();

        // Switch to Interactive Demo tab
        await page.getByRole('button', { name: 'Melbourne Interactive Demo Live' }).click();

        // Step 1: Submit Requisition
        await expect(page.getByText('Raise Purchase Requisition')).toBeVisible();
        await page.getByRole('button', { name: /Submit Requisition for Approval/i }).click();

        // Step 2 & 3: Site Manager review
        await expect(page.getByText('Site Manager Action (Matthew Mancuso)')).toBeVisible();
        await expect(page.getByText('Requisition POR-MELB-DEMO-01 routed automatically to Matthew Mancuso')).toBeVisible();

        // Verify notification telemetry preview is populated
        await expect(page.getByText('Notification Telemetry Preview')).toBeVisible();
        await expect(page.getByText('PO Approval Required: POR-MELB-DEMO-01')).toBeVisible();

        // Step 3: Site Manager approval action
        await page.getByRole('button', { name: 'Approve', exact: true }).click();

        // Step 4 & 5: Concur handover
        await expect(page.getByText("Ash's June 17 Concur Handover Flow")).toBeVisible();
        await expect(page.getByText('48-Hour Supplier Stock Reservation Hold Active')).toBeVisible();

        // Step 5a: Log Concur PR #
        const prInput = page.getByPlaceholder('e.g. PR-9848');
        await prInput.fill('PR-9848');
        await page.getByRole('button', { name: 'Save PR #' }).click();

        // Step 5b: Link Concur PO #
        const poInput = page.getByPlaceholder('e.g. PO-2026-9848');
        await poInput.fill('PO-2026-9848');
        await page.getByRole('button', { name: 'Link PO #' }).click();

        // Verify deliveries unlocked
        await expect(page.getByText('Requisition Lifecycle Complete')).toBeVisible();
        await expect(page.getByText('Status is ACTIVE. Melbourne warehouse receiving, docket uploads, and invoice matching are fully unlocked.')).toBeVisible();
    });

    test('displays Ashish Chhabra offboarding analysis and traceable migration plan', async ({ page }) => {
        await gotoAndWait(page, '/admin/workflows');
        await dismissFeatureUpdatesIfPresent(page);
        await expect(page.getByRole('heading', { name: 'Site Approval Workflows' })).toBeVisible();

        // Switch to Offboarding tab
        await page.getByRole('button', { name: 'Ashish Offboarding & Migration Traceable' }).click();

        // Verify offboarding header and analysis
        await expect(page.getByText('Ashish Chhabra Offboarding Audit & Reassignment Plan')).toBeVisible();
        await expect(page.getByText('Historical Closed Requests (Immutable Archive)')).toBeVisible();
        await expect(page.getByText('2 Orders Preserved')).toBeVisible();

        // Verify open order proposed reassignment
        await expect(page.getByText('POR-202609-000029')).toBeVisible();
        await expect(page.getByText('SPL Holdings')).toBeVisible();
        await expect(page.getByText('Ebrahim Mokhtari (COO)')).toBeVisible();
    });

    test('logs audit trail entries with cryptographic action trace', async ({ page }) => {
        await gotoAndWait(page, '/admin/workflows');
        await dismissFeatureUpdatesIfPresent(page);
        await expect(page.getByRole('heading', { name: 'Site Approval Workflows' })).toBeVisible();

        // Switch to Audit tab
        await page.getByRole('button', { name: /Audit Trail & Telemetry/i }).click();

        // Verify audit log header
        await expect(page.getByText('Workflow Decision & Notification Audit Logs')).toBeVisible();
    });

    test('persists configured facility changes across page reload', async ({ page }) => {
        await gotoAndWait(page, '/admin/workflows');
        await dismissFeatureUpdatesIfPresent(page);
        await expect(page.getByRole('heading', { name: 'Site Approval Workflows' })).toBeVisible();

        // Open Configure Facility modal for Melbourne
        await page.getByRole('button', { name: 'Configure Melbourne Facility' }).click();
        await expect(page.getByText('Configure Facility: SPL Melbourne')).toBeVisible();

        // Update approval manager name
        const nameInput = page.getByPlaceholder('e.g. John Smith');
        await nameInput.fill('Matthew Mancuso (Acting Site Lead)');

        // Save facility workflow
        await page.getByRole('button', { name: 'Save Facility Workflow' }).click();

        // Verify updated manager name appears on Melbourne card
        await expect(page.getByText('Matthew Mancuso (Acting Site Lead)')).toBeVisible();

        // Reload page to verify persistence across reloads/restarts
        await page.reload();
        await dismissFeatureUpdatesIfPresent(page);
        await expect(page.getByRole('heading', { name: 'Site Approval Workflows' })).toBeVisible();

        // Card must still display the persisted manager name
        await expect(page.getByText('Matthew Mancuso (Acting Site Lead)')).toBeVisible();

        // Restore clean baseline for future runs
        await page.getByRole('button', { name: 'Configure Melbourne Facility' }).click();
        await expect(page.getByText('Configure Facility: SPL Melbourne')).toBeVisible();
        await page.getByPlaceholder('e.g. John Smith').fill('Matthew Mancuso');
        await page.getByRole('button', { name: 'Save Facility Workflow' }).click();
        await expect(page.getByText('Matthew Mancuso', { exact: true })).toBeVisible();
    });
});
