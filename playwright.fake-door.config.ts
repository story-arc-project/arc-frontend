import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "fake-door.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report/fake-door", open: "never" }]],
  outputDir: "test-results/fake-door",
  use: { baseURL: "http://localhost:3128", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev -- --port 3128",
    url: "http://localhost:3128/dev/credit-fake-door",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { FRT138_PREVIEW: "true" },
  },
});
