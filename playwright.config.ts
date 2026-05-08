import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    retries: 1,
    timeout: 60000,
    expect: { timeout: 15000 },
    use: {
        baseURL: 'https://localhost:3000',
        screenshot: 'on',
        video: 'retain-on-failure',
        trace: 'retain-on-failure',
        actionTimeout: 15000,
        navigationTimeout: 30000,
        ignoreHTTPSErrors: true,
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'npm run dev',
        url: 'https://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
        ignoreHTTPSErrors: true,
    },
});
