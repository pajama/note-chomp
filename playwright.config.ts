import { defineConfig, devices } from '@playwright/test';

const PORT = 5179;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'on-first-retry' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\// },
    // Phone and tablet emulation on Chromium (WebKit isn't installed here): isMobile, hasTouch,
    // a coarse pointer and no hover, which is what the mobile CSS keys off.
    {
      name: 'iphone',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
      testMatch: /mobile\/.*\.spec\.ts/,
    },
    {
      name: 'ipad',
      use: { ...devices['iPad (gen 7)'], defaultBrowserType: 'chromium' },
      testMatch: /mobile\/.*\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
