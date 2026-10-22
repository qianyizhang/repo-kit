import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.ts',
  outputDir: 'test-results',
  workers: 1,
  retries: 0,
  timeout: 45000,
  globalSetup: './tests/browser-startup.ts',
  use: {
    baseURL: 'http://127.0.0.1:4391',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 1100 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tests/host-server.ts',
    env: { PORT: '4391' },
    url: 'http://127.0.0.1:4391',
    reuseExistingServer: false,
  },
});
