import { defineConfig, devices } from "@playwright/test";
import { API_ORIGIN } from "./e2e/fixtures/api-origin";

// Keep feature gates local to this server so every required-header flow runs
// without changing the public feature defaults or the other E2E suites.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "idempotency-key.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report/idempotency", open: "never" }]],
  outputDir: "test-results/idempotency",
  use: {
    baseURL: "http://localhost:3138",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 3138",
    url: "http://localhost:3138",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_URL: API_ORIGIN,
      NEXT_PUBLIC_COVER_LETTER_ENABLED: "true",
      NEXT_PUBLIC_ANALYSIS_RETRY_ENABLED: "true",
    },
  },
});
