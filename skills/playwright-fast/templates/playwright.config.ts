import { defineConfig, devices } from '@playwright/test';

// Copy only if your project doesn't already have a Playwright config.
const workers = process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : (process.env.CI ? 2 : 4);
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // safe default: files parallel, tests in each file ordered
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers,
  timeout: 20_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : [['line'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 8_000,
    navigationTimeout: 12_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  // If app server needs management, add webServer here with reuseExistingServer: !process.env.CI.
});
