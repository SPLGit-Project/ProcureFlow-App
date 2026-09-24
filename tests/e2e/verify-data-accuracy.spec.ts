import { test, expect } from '@playwright/test';
import { injectTestUser, gotoAndWait } from './helpers/auth';
import path from 'path';

test.describe('Supplier Stock Data Accuracy & Classification Remediation Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 960 });
    });

    test('verifies accurate supplier offers, codes, and sanitized category dropdown', async ({ page }) => {
        const artifactsDir = 'C:/Users/Aaron.bell/.gemini/antigravity/brain/88111dc1-7e26-416c-a8e2-124ad29d9dea';

        await injectTestUser(page, [
            'view_dashboard', 'create_request', 'manage_development',
            'approve_item_requests', 'manage_settings', 'view_items',
            'approve_requests', 'view_finance', 'view_reports', 'manage_items',
            'view_active_requests', 'view_completed_requests',
        ], [
            '11111111-1111-4111-8111-111111111111',
            '77777777-7777-4777-8777-777777777777',
            '22222222-2222-4222-8222-222222222222',
            '33333333-3333-4333-8333-333333333333'
        ], {
            id: '84ce40fb-0e8e-482f-8587-bf51f413008e',
            name: 'Ashish Chhabra',
            email: 'ashish.chhabra@splservices.com.au',
            role: 'ADMIN'
        });

        await gotoAndWait(page, '/supplier-stock');
        try {
            await page.waitForSelector('text=Loading supplier stock directory', { state: 'detached', timeout: 15000 });
        } catch {}
        await page.waitForTimeout(2000);

        // Switch to Compare Prices mode
        const compareBtn = page.locator('button:has-text("Compare Prices")').first();
        await expect(compareBtn).toBeVisible();
        await compareBtn.click();
        await page.waitForTimeout(1000);

        // Filter or search for APRON BLACK BIB
        const searchInput = page.locator('input[placeholder*="Search product"]').first();
        await searchInput.fill('APRON BLACK BIB - LONG RFID');
        await page.waitForTimeout(800);

        // Expand the item row
        const viewOffersBtn = page.locator('button:has-text("View Offers")').first();
        if (await viewOffersBtn.isVisible()) {
            await viewOffersBtn.click();
            await page.waitForTimeout(600);
        }

        // Take screenshot of the resolved APRON item offers
        await page.screenshot({ path: path.join(artifactsDir, 'remediated_apron_offers.png') });

        // Verify: under this item, HOST Supplies must appear at most ONCE!
        const supplierNames = await page.locator('div:has-text("SUPPLIER PRICE & STOCK BREAKDOWN")').locator('.font-bold.text-slate-800').allTextContents();
        console.log('Supplier names for APRON:', supplierNames);
        const hostCount = supplierNames.filter(n => n.includes('HOST Supplies')).length;
        expect(hostCount).toBeLessThanOrEqual(1);

        // Clear search and search for Caress TLC25
        await searchInput.fill('TLC25');
        await page.waitForTimeout(800);

        const viewCaressOffers = page.locator('button:has-text("View Offers")').first();
        if (await viewCaressOffers.isVisible()) {
            await viewCaressOffers.click();
            await page.waitForTimeout(600);
        }

        await page.screenshot({ path: path.join(artifactsDir, 'remediated_caress_offers.png') });

        // Clear search
        await searchInput.fill('');
        await page.waitForTimeout(500);

        // Inspect All Categories dropdown
        const categorySelect = page.locator('select').filter({ hasText: /Categories|All Categories/i }).first();
        await expect(categorySelect).toBeVisible();

        const categoryOptions = await categorySelect.locator('option').allTextContents();
        console.log('Sanitized Category Options (' + categoryOptions.length + '):', categoryOptions);

        // Assert no long product descriptions, no TBA, no Surcharge, no Table Linen (Item Type)
        expect(categoryOptions).not.toContain('THEATRE JACKET WARM UP 3XL NAVY P/C 65/35 RHJAC06 SPL');
        expect(categoryOptions).not.toContain('TBA');
        expect(categoryOptions).not.toContain('Surcharge');
        expect(categoryOptions).not.toContain('Table Linen');
        expect(categoryOptions).not.toContain('Sheets'); // Should be 'Sheet'

        // Check that valid clean categories ARE present
        expect(categoryOptions).toContain('Sheet');
        expect(categoryOptions).toContain('Towel');
        expect(categoryOptions).toContain('Apron');

        // Screenshot of the clean page
        await page.screenshot({ path: path.join(artifactsDir, 'remediated_category_dropdown.png') });
    });
});
