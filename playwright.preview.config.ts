import { defineConfig, devices } from "@playwright/test";

import { API_ORIGIN } from "./e2e/fixtures/api-origin";

/**
 * ui-preview 스킬 전용 러너 — 스크린샷 캡처만 수행한다 (CI 미사용).
 * 본 e2e 설정(playwright.config.ts)과 동일한 dev 서버·env를 쓰되,
 * testDir 를 e2e/preview 로 좁혀 임시 프리뷰 스펙만 실행한다.
 */
const BASE_URL = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e/preview",
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: BASE_URL },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_URL: API_ORIGIN,
      NEXT_PUBLIC_CONSENT_ENABLED: "true",
      NEXT_PUBLIC_PASSWORD_RESET_ENABLED: "true",
    },
  },
});
