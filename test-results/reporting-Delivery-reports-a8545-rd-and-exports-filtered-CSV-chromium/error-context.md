# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: reporting.spec.ts >> Delivery reports >> outstanding deliveries shows action dashboard and exports filtered CSV
- Location: tests\e2e\reporting.spec.ts:24:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('outstanding-report-visual')
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByTestId('outstanding-report-visual')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - img "MercerFlow logo" [ref=e7]
    - generic [ref=e8]:
      - navigation [ref=e9]:
        - link "Home" [ref=e10] [cursor=pointer]:
          - /url: /
          - img [ref=e11]
        - link "Dashboard" [ref=e15] [cursor=pointer]:
          - /url: /procurement/dashboard
          - img [ref=e16]
        - link "Requests" [ref=e21] [cursor=pointer]:
          - /url: /requests
          - img [ref=e22]
        - link "Finance Review" [ref=e25] [cursor=pointer]:
          - /url: /finance
          - img [ref=e26]
        - link "My Item Requests" [ref=e29] [cursor=pointer]:
          - /url: /items/my-requests
          - img [ref=e30]
        - link "Reports" [ref=e34] [cursor=pointer]:
          - /url: /reports
          - img [ref=e35]
        - link "Help & Support" [ref=e39] [cursor=pointer]:
          - /url: /help
          - img [ref=e40]
        - link "About" [ref=e43] [cursor=pointer]:
          - /url: /about
          - img [ref=e44]
      - generic:
        - img
    - generic [ref=e46]:
      - button "Expand sidebar" [ref=e47] [cursor=pointer]:
        - img [ref=e48]
      - button "Light mode" [ref=e51] [cursor=pointer]:
        - img [ref=e52]
      - button "Test User" [ref=e58] [cursor=pointer]:
        - img "Test User" [ref=e59]
  - generic [ref=e60]:
    - banner [ref=e61]:
      - generic [ref=e62]:
        - img [ref=e64]
        - generic [ref=e66]:
          - heading "Reports" [level=1] [ref=e68]
          - generic [ref=e69]: Generate reports for delivery tracking and financial auditing.
      - generic [ref=e70]:
        - link "Home" [ref=e71] [cursor=pointer]:
          - /url: /
          - img [ref=e72]
        - button "Task Center" [ref=e75] [cursor=pointer]:
          - img [ref=e76]
        - button "Notifications" [ref=e80] [cursor=pointer]:
          - img [ref=e81]
    - main [ref=e84]:
      - generic [ref=e87]:
        - generic [ref=e88]:
          - generic [ref=e90]:
            - button "Outstanding Deliveries" [ref=e91] [cursor=pointer]:
              - img [ref=e92]
              - text: Outstanding Deliveries
            - button "All Deliveries" [ref=e94] [cursor=pointer]:
              - img [ref=e95]
              - text: All Deliveries
            - button "Delivery Variance" [ref=e99] [cursor=pointer]:
              - img [ref=e100]
              - text: Delivery Variance
            - button "Full Reconciliation" [ref=e103] [cursor=pointer]:
              - img [ref=e104]
              - text: Full Reconciliation
            - button "Item Request History" [ref=e108] [cursor=pointer]:
              - img [ref=e109]
              - text: Item Request History
            - button "Monthly PO & GR Summary" [ref=e113] [cursor=pointer]:
              - img [ref=e114]
              - text: Monthly PO & GR Summary
            - button "Finance Summary" [ref=e116] [cursor=pointer]:
              - img [ref=e117]
              - text: Finance Summary
            - button "PO Status Report" [ref=e120] [cursor=pointer]:
              - img [ref=e121]
              - text: PO Status Report
            - generic [ref=e124]: Supplier Insights
            - button "Supplier Available Inventory" [ref=e125] [cursor=pointer]:
              - img [ref=e126]
              - text: Supplier Available Inventory
            - button "Supplier Item Mapping" [ref=e130] [cursor=pointer]:
              - img [ref=e131]
              - text: Supplier Item Mapping
            - button "Supplier Price Variance" [ref=e134] [cursor=pointer]:
              - img [ref=e135]
              - text: Supplier Price Variance
          - generic [ref=e138]:
            - heading "Report Description" [level=4] [ref=e139]
            - paragraph [ref=e140]: Action-first view of PO lines still awaiting receipt, grouped by supplier and site to make follow-up work clear.
        - generic [ref=e142]:
          - generic [ref=e143]:
            - generic [ref=e144]:
              - heading "Outstanding Deliveries Report" [level=2] [ref=e145]
              - paragraph [ref=e146]:
                - img [ref=e147]
                - text: "Data updated at: 3:09:57 PM"
            - generic [ref=e150]:
              - button "Run Report" [ref=e151] [cursor=pointer]:
                - img [ref=e152]
                - text: Run Report
              - button "Export CSV" [disabled] [ref=e154]:
                - img [ref=e155]
                - text: Export CSV
          - generic [ref=e159]:
            - img [ref=e161]
            - generic [ref=e163]:
              - heading "No Data Generated" [level=3] [ref=e164]
              - paragraph [ref=e165]: Click "Run report" to generate the latest data.
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   | import { readFile } from 'node:fs/promises';
  3   | import { gotoAndWait, injectTestUser } from './helpers/auth';
  4   | 
  5   | const REPORT_PERMISSIONS = [
  6   |     'view_dashboard',
  7   |     'view_finance',
  8   |     'manage_finance',
  9   |     'view_all_requests',
  10  |     'approve_requests',
  11  |     'link_concur',
  12  |     'receive_goods',
  13  | ];
  14  | 
  15  | const injectReportingUser = async (page: Parameters<typeof injectTestUser>[0]) => {
  16  |     await injectTestUser(page, REPORT_PERMISSIONS, ['site-1', 'site-2', 'site-7']);
  17  |     await page.addInitScript(() => {
  18  |         localStorage.setItem('activeSiteIds', JSON.stringify(['site-1', 'site-2', 'site-7']));
  19  |         sessionStorage.removeItem('pf_active_report');
  20  |     });
  21  | };
  22  | 
  23  | test.describe('Delivery reports', () => {
  24  |     test('outstanding deliveries shows action dashboard and exports filtered CSV', async ({ page }) => {
  25  |         await injectReportingUser(page);
  26  |         await gotoAndWait(page, '/reports');
  27  | 
  28  |         await page.getByRole('button', { name: /Run Report/i }).click();
  29  | 
  30  |         const outstandingVisual = page.getByTestId('outstanding-report-visual');
> 31  |         await expect(outstandingVisual).toBeVisible();
      |                                         ^ Error: expect(locator).toBeVisible() failed
  32  |         await expect(outstandingVisual.getByText('Outstanding Value', { exact: true })).toBeVisible();
  33  |         await expect(outstandingVisual.getByText('Highest Priority Lines')).toBeVisible();
  34  | 
  35  |         await page.getByPlaceholder('Search reports').fill('Bath');
  36  | 
  37  |         const downloadPromise = page.waitForEvent('download');
  38  |         await page.getByRole('button', { name: /Export CSV/i }).click();
  39  |         const download = await downloadPromise;
  40  | 
  41  |         expect(download.suggestedFilename()).toMatch(/^outstanding-deliveries-\d{4}-\d{2}-\d{2}\.csv$/);
  42  |         const filePath = await download.path();
  43  |         expect(filePath).toBeTruthy();
  44  | 
  45  |         const csv = await readFile(filePath!, 'utf8');
  46  |         expect(csv).toContain('"Remaining Value"');
  47  |         expect(csv).toContain('"Latest Delivery Date"');
  48  |         expect(csv).toContain('"Delivery Dates"');
  49  |         expect(csv).toContain('Bath Towel - White');
  50  |         expect(csv).not.toContain('Premium Cotton Sheet');
  51  |     });
  52  | 
  53  |     test('delivery variance shows exception-only dashboard and exports CSV', async ({ page }) => {
  54  |         await injectReportingUser(page);
  55  |         await gotoAndWait(page, '/reports');
  56  | 
  57  |         await page.getByRole('button', { name: /Delivery Variance/i }).click();
  58  |         await page.getByRole('button', { name: /Run Report/i }).click();
  59  | 
  60  |         const varianceVisual = page.getByTestId('variance-report-visual');
  61  |         await expect(varianceVisual).toBeVisible();
  62  |         await expect(varianceVisual.getByText('Variance Exceptions')).toBeVisible();
  63  |         await expect(varianceVisual.getByText('Pending', { exact: true }).first()).toBeVisible();
  64  | 
  65  |         await page.getByRole('button', { name: /Raw Data/i }).click();
  66  |         await expect(page.getByRole('columnheader', { name: 'Exception' })).toBeVisible();
  67  |         await expect(page.getByRole('columnheader', { name: 'Request Raised' })).toBeVisible();
  68  |         await expect(page.getByRole('columnheader', { name: 'Latest Delivery' })).toBeVisible();
  69  |         await expect(page.getByText('Over delivered')).not.toBeVisible();
  70  | 
  71  |         const downloadPromise = page.waitForEvent('download');
  72  |         await page.getByRole('button', { name: /Export CSV/i }).click();
  73  |         const download = await downloadPromise;
  74  | 
  75  |         expect(download.suggestedFilename()).toMatch(/^delivery-variance-\d{4}-\d{2}-\d{2}\.csv$/);
  76  |         const filePath = await download.path();
  77  |         expect(filePath).toBeTruthy();
  78  | 
  79  |         const csv = await readFile(filePath!, 'utf8');
  80  |         expect(csv).toContain('"Exception Type"');
  81  |         expect(csv).toContain('"Request Raised Date"');
  82  |         expect(csv).toContain('"Latest Delivery Date"');
  83  |         expect(csv).toContain('"Pending"');
  84  |     });
  85  | 
  86  |     test('delivery report visuals fit a mobile viewport', async ({ page }) => {
  87  |         await page.setViewportSize({ width: 390, height: 844 });
  88  |         await injectReportingUser(page);
  89  |         await gotoAndWait(page, '/reports');
  90  | 
  91  |         await page.getByRole('button', { name: /Run Report/i }).click();
  92  |         await expect(page.getByTestId('outstanding-report-visual')).toBeVisible();
  93  |         await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();
  94  | 
  95  |         await page.getByRole('button', { name: /Delivery Variance/i }).click();
  96  |         await page.getByRole('button', { name: /Run Report/i }).click();
  97  |         await expect(page.getByTestId('variance-report-visual')).toBeVisible();
  98  |         await expect(page.getByPlaceholder('Search reports')).toBeVisible();
  99  |     });
  100 | });
  101 | 
```