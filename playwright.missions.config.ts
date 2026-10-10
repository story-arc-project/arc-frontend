import { defineConfig, devices } from "@playwright/test";
import { API_ORIGIN } from "./e2e/fixtures/api-origin";
export default defineConfig({
  testDir: "./e2e", testMatch: ["missions-preview.spec.ts", "missions.spec.ts"], workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report/missions", open: "never" }]],
  outputDir: "test-results/missions",
  use: { baseURL: "http://localhost:3138", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "ipad", use: { ...devices["iPad Mini"], browserName: "chromium" } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 320, height: 740 } } },
  ],
  webServer: { command: "npm run dev -- --webpack --port 3138", url: "http://localhost:3138/dev/missions", reuseExistingServer: false, timeout: 120_000,
    env: { FRT348_PREVIEW: "true", FRT138_PREVIEW: "true", NEXT_PUBLIC_API_URL: API_ORIGIN } },
});
