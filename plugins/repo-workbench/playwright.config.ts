import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: ['tests/browser/*.spec.ts', 'packages/repo-canvas/src/ui/*.spec.ts'],
  outputDir: 'test-results/browser',
  globalSetup: './tests/browser/startup.ts',
  workers: 1,
  retries: 0,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:4385',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'review', testMatch: 'tests/browser/*.spec.ts' },
    {
      name: 'canvas',
      testMatch: 'packages/repo-canvas/src/ui/*.spec.ts',
      use: { baseURL: 'http://127.0.0.1:4318' },
    },
  ],
  webServer: [
    {
      command: 'node tests/browser/server.ts',
      url: 'http://127.0.0.1:4385',
      reuseExistingServer: false,
    },
    {
      command: 'node packages/repo-canvas/src/server/browser-fixture.ts',
      url: 'http://127.0.0.1:4318',
      reuseExistingServer: false,
    },
  ],
});
