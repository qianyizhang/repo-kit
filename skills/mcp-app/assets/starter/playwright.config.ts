import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  workers: 1,
  retries: 0,
  globalSetup: "./tests/browser-startup.ts",
  outputDir: "test-results",
  use: {
    channel: "chrome",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node dist/web.mjs",
      url: "http://127.0.0.1:4397",
      env: { MCP_APP_LOG_ROOT: ".artifacts/logs" },
      reuseExistingServer: false,
    },
    {
      command: "node tests/host-server.ts",
      url: "http://127.0.0.1:4398",
      reuseExistingServer: false,
    },
  ],
});
