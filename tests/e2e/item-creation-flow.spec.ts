import { test, expect } from '@playwright/test';
import { injectTestUser, injectTestUserWithFlags, gotoAndWait } from './helpers/auth';

test.describe('Item Creation Happy-Path Flow', () => {
    test.setTimeout(120000); // DB operations and calculations can be slow

    test('complete item creation journey from workbench to approval queue', async ({ page }) => {
        const timestamp = Date.now();
        const testDescription = `Test Linen Item ${timestamp}`;
        
        // 1. Setup: Inject admin user with all permissions and necessary feature flags
        await injectTestUserWithFlags(page, ['view_dashboard', 'manage_development', 'approve_item_requests'], {
            previewEnabled: true,
            uiRevamp: true
        });

        // 2. Navigation: Land on the Item Creation Preview page
        await gotoAndWait(page, '/item-creation-preview');
        await expect(page.getByText('Item Creation Preview')).toBeVisible();
        await expect(page.getByText('Isolated research workflow')).toBeVisible();

        // 3. Fill Item Definition: Workbench Form
        // We use descriptive placeholders or labels where possible
        await page.locator('textarea[placeholder="Controlled item description..."]').fill(testDescription);
        
        // Set some attributes to trigger SKU generation
        await page.locator('input[list="preview-category-options"]').fill('Linen');
        await page.locator('input[list="preview-type-options"]').fill('Sheets');
        await page.locator('input[placeholder="Queen, King, 02, etc."]').fill('Queen');
        
        // 4. Fill Pricing and Availability (Mandatory for successful save/duplicate check)
        // Select a supplier (Global Textile is index 1 in mock data)
        await page.getByRole('combobox', { name: 'Supplier', exact: true }).selectOption({ index: 1 });
        
        // Purchase Price
        // Scoping to the specific container that HAS the "Purchase pricing" text
        const purchaseSection = page.locator('div.space-y-4').filter({ has: page.getByText('Purchase pricing', { exact: true }) });
        await purchaseSection.getByRole('spinbutton', { name: 'Price Ex GST', exact: true }).fill('10.00');
        
        // Sell Price - Start with a low margin to trigger warning
        const sellSection = page.locator('div.space-y-4').filter({ has: page.getByText('Sell pricing', { exact: true }) });
        const sellPriceInput = sellSection.getByRole('spinbutton', { name: 'Sell Price Ex GST' });
        await sellPriceInput.fill('11.00');
        
        // 5. Margin Warning Verification
        // Margin would be approx 10% (below 25% threshold)
        await expect(page.getByText('Approval required — margin below threshold')).toBeVisible();
        
        // Now set a healthy margin
        await sellPriceInput.fill('20.00');
        await expect(page.getByText('Approval required — margin below threshold')).not.toBeVisible();

        // 6. SKU Generation Verification
        // The SKU should no longer be "PENDING" before we run the check
        const skuValue = page.locator('div.font-mono.text-2xl.font-black');
        await expect(skuValue).not.toHaveText('PENDING', { timeout: 10000 });
        const generatedSku = await skuValue.innerText();
        console.log(`Generated SKU: ${generatedSku}`);

        // 7. Duplicate Check
        const duplicateBtn = page.getByRole('button', { name: 'Duplicate Check' });
        await duplicateBtn.click();
        
        // Wait for the duplicate result section to appear and show some results
        // We look for the "Duplicate Result" heading first to ensure the container is there
        await expect(page.getByRole('heading', { name: 'Duplicate Result' })).toBeVisible({ timeout: 30000 });
        // Then check for "Found ... matches" or candidate items
        // Since we are using mock data, we might find 0 or more, but the "Found" text should appear
        await expect(page.getByText('Matches')).toBeVisible({ timeout: 10000 });

        // 8. Submit Preview
        const submitBtn = page.getByRole('button', { name: 'Submit Preview' });
        await submitBtn.click();
        
        // Wait for success toast
        await expect(page.getByText('Preview request saved.')).toBeVisible();
        
        // 9. Verification in REQUESTS tab
        await page.getByRole('button', { name: 'Requests', exact: true }).click();
        await expect(page.getByText(testDescription).first()).toBeVisible();
        
        // 10. Verification in Approval Queue
        // We use the sidebar link instead of a hard goto to preserve in-memory QA state
        await page.getByRole('link', { name: 'Item Approvals' }).click();
        await expect(page.getByText('Item Approval Queue').first()).toBeVisible();
        
        // The new request should be visible in the queue
        await expect(page.getByText(testDescription).first()).toBeVisible();
    });
});
