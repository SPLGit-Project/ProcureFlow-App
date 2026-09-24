import { test, expect } from '@playwright/test';
import { injectTestUser, gotoAndWait } from './helpers/auth';
import path from 'path';
import fs from 'fs';

test.describe('Supplier Stock Directory & Alternate Supplier Requisition Suite', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 960 });
    });

    test('1. captures supplier stock directory (hero, table, and modal)', async ({ page }) => {
        const artifactsDir = 'C:/Users/Aaron.bell/.gemini/antigravity/brain/88111dc1-7e26-416c-a8e2-124ad29d9dea';
        const briefAssetsDir = path.resolve('docs/brief_assets');
        fs.mkdirSync(briefAssetsDir, { recursive: true });

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

        await page.addInitScript(() => {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                    localStorage.removeItem(key);
                }
            }
        });

        await gotoAndWait(page, '/supplier-stock');
        try {
            await page.waitForSelector('text=Loading supplier stock directory', { state: 'detached', timeout: 15000 });
        } catch {}

        await page.waitForTimeout(2500);

        // Streamlined Directory Table View screenshot
        await page.screenshot({ path: path.join(briefAssetsDir, 'supplier_stock_directory_hero.png') });
        await page.screenshot({ path: path.join(artifactsDir, 'supplier_stock_directory_hero.png') });
        await page.screenshot({ path: path.join(briefAssetsDir, 'supplier_stock_directory_table.png') });
        await page.screenshot({ path: path.join(artifactsDir, 'supplier_stock_directory_table.png') });

        // Compare Prices screenshot
        const compareBtn = page.locator('button:has-text("Compare Prices")').first();
        if (await compareBtn.isVisible()) {
            await compareBtn.click();
            await page.waitForTimeout(800);
            await page.screenshot({ path: path.join(briefAssetsDir, 'supplier_stock_directory_compare.png') });
            await page.screenshot({ path: path.join(artifactsDir, 'supplier_stock_directory_compare.png') });
            
            // Switch back to Table View
            const tableBtn = page.locator('button:has-text("Table")').first();
            if (await tableBtn.isVisible()) await tableBtn.click();
            await page.waitForTimeout(500);
        }

        // Click Order button to test redirect and auto-add to cart
        const orderBtn = page.locator('button:has-text("Order")').first();
        if (await orderBtn.isVisible()) {
            await orderBtn.click();
            await page.waitForTimeout(2000);
            await page.screenshot({ path: path.join(briefAssetsDir, 'po_create_with_auto_added_item.png') });
            await page.screenshot({ path: path.join(artifactsDir, 'po_create_with_auto_added_item.png') });
        }
    });

    test('2. captures POCreate default preferred NCC and alternate warning callout', async ({ page }) => {
        const artifactsDir = 'C:/Users/Aaron.bell/.gemini/antigravity/brain/88111dc1-7e26-416c-a8e2-124ad29d9dea';
        const briefAssetsDir = path.resolve('docs/brief_assets');

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

        await page.addInitScript(() => {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                    localStorage.removeItem(key);
                }
            }
        });

        await gotoAndWait(page, '/create');
        await page.waitForTimeout(2500);

        const supplierSelect = page.locator('select:has(option:has-text("NCC Apparel"))').first();
        if (await supplierSelect.isVisible()) {
            await page.screenshot({ path: path.join(briefAssetsDir, 'po_create_ncc_default.png') });
            await page.screenshot({ path: path.join(artifactsDir, 'po_create_ncc_default.png') });

            const optionData = await supplierSelect.locator('option').evaluateAll(opts => 
                opts.map(o => ({ value: (o as HTMLOptionElement).value, text: o.textContent || '' }))
            );
            const nonNcc = optionData.find(o => !o.text.includes('NCC') && !o.text.includes('Select') && o.value);
            if (nonNcc) {
                await supplierSelect.selectOption(nonNcc.value);
                await page.waitForTimeout(600);
                const cautionIcon = page.locator('div[aria-label="Non-default supplier warning"]');
                if (await cautionIcon.isVisible()) {
                    await cautionIcon.hover();
                    await page.waitForTimeout(400);
                }
                await page.screenshot({ path: path.join(briefAssetsDir, 'po_create_alternate_supplier_alert.png') });
                await page.screenshot({ path: path.join(artifactsDir, 'po_create_alternate_supplier_alert.png') });
            }
        }
    });

    test('3. captures PODetail non-default supplier justification banner for approver', async ({ page }) => {
        const artifactsDir = 'C:/Users/Aaron.bell/.gemini/antigravity/brain/88111dc1-7e26-416c-a8e2-124ad29d9dea';
        const briefAssetsDir = path.resolve('docs/brief_assets');

        await injectTestUser(page, [
            'view_dashboard', 'create_request', 'manage_development',
            'approve_item_requests', 'manage_settings', 'view_items',
            'approve_requests', 'view_finance', 'view_reports', 'manage_items',
            'view_active_requests', 'view_completed_requests',
        ], [
            '33333333-3333-4333-8333-333333333333', // SPL Mackay
            '11111111-1111-4111-8111-111111111111',
            '77777777-7777-4777-8777-777777777777'
        ], {
            id: '84ce40fb-0e8e-482f-8587-bf51f413008e',
            name: 'Ashish Chhabra',
            email: 'ashish.chhabra@splservices.com.au',
            role: 'ADMIN'
        });

        await page.addInitScript(() => {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                    localStorage.removeItem(key);
                }
            }
        });

        // Navigate to active requests first
        await gotoAndWait(page, '/requests');
        await page.waitForTimeout(2500);

        // Click the request link for POR-202609-000014
        const poLink = page.locator('text=POR-202609-000014').first();
        if (await poLink.isVisible()) {
            await poLink.click();
            await page.waitForSelector('text=Non-Default Supplier Selected', { timeout: 15000 });
            await page.waitForTimeout(1000);
            await page.screenshot({ path: path.join(briefAssetsDir, 'po_detail_alternate_supplier_banner.png') });
            await page.screenshot({ path: path.join(artifactsDir, 'po_detail_alternate_supplier_banner.png') });
        }
    });
});
