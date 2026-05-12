import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { gotoAndWait, injectTestUser } from './helpers/auth';

const REPORT_PERMISSIONS = [
    'view_dashboard',
    'view_finance',
    'manage_finance',
    'view_all_requests',
    'approve_requests',
    'link_concur',
    'receive_goods',
];

test.describe('Delivery reports', () => {
    test('outstanding deliveries shows action dashboard and exports filtered CSV', async ({ page }) => {
        await injectTestUser(page, REPORT_PERMISSIONS, ['site-1', 'site-2', 'site-7']);
        await gotoAndWait(page, '/reports');

        await page.getByRole('button', { name: /Run Report/i }).click();

        const outstandingVisual = page.getByTestId('outstanding-report-visual');
        await expect(outstandingVisual).toBeVisible();
        await expect(outstandingVisual.getByText('Outstanding Value', { exact: true })).toBeVisible();
        await expect(outstandingVisual.getByText('Highest Priority Lines')).toBeVisible();

        await page.getByPlaceholder('Search reports').fill('Bath');

        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: /Export CSV/i }).click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toMatch(/^outstanding-deliveries-\d{4}-\d{2}-\d{2}\.csv$/);
        const filePath = await download.path();
        expect(filePath).toBeTruthy();

        const csv = await readFile(filePath!, 'utf8');
        expect(csv).toContain('"Remaining Value"');
        expect(csv).toContain('Bath Towel - White');
        expect(csv).not.toContain('Premium Cotton Sheet');
    });

    test('delivery variance shows exception-only dashboard and exports CSV', async ({ page }) => {
        await injectTestUser(page, REPORT_PERMISSIONS, ['site-1', 'site-2', 'site-7']);
        await gotoAndWait(page, '/reports');

        await page.getByRole('button', { name: /Delivery Variance/i }).click();
        await page.getByRole('button', { name: /Run Report/i }).click();

        const varianceVisual = page.getByTestId('variance-report-visual');
        await expect(varianceVisual).toBeVisible();
        await expect(varianceVisual.getByText('Variance Exceptions')).toBeVisible();
        await expect(varianceVisual.getByText('Pending', { exact: true }).first()).toBeVisible();

        await page.getByRole('button', { name: /Raw Data/i }).click();
        await expect(page.getByRole('columnheader', { name: 'Exception' })).toBeVisible();
        await expect(page.getByText('Over delivered')).not.toBeVisible();

        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: /Export CSV/i }).click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toMatch(/^delivery-variance-\d{4}-\d{2}-\d{2}\.csv$/);
        const filePath = await download.path();
        expect(filePath).toBeTruthy();

        const csv = await readFile(filePath!, 'utf8');
        expect(csv).toContain('"Exception Type"');
        expect(csv).toContain('"Pending"');
    });

    test('delivery report visuals fit a mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await injectTestUser(page, REPORT_PERMISSIONS, ['site-1', 'site-2', 'site-7']);
        await gotoAndWait(page, '/reports');

        await page.getByRole('button', { name: /Run Report/i }).click();
        await expect(page.getByTestId('outstanding-report-visual')).toBeVisible();
        await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();

        await page.getByRole('button', { name: /Delivery Variance/i }).click();
        await page.getByRole('button', { name: /Run Report/i }).click();
        await expect(page.getByTestId('variance-report-visual')).toBeVisible();
        await expect(page.getByPlaceholder('Search reports')).toBeVisible();
    });
});
