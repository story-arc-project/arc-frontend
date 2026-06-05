import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E 설정 (FRT-23)
 *
 * 제품 플로우를 실제 `(main)` 화면에서 자동 검증하기 위한 E2E 러너의 기반.
 * 이후 API 스텁·스모크·CI Playwright가 이 설정을 전제로 확장된다.
 *
 * 결과 보기:
 * - HTML 리포트: `npm run test:e2e:report` (영상·trace·스크린샷 임베드)
 * - Trace: `npx playwright show-trace <trace.zip>` (타임라인 + DOM time-travel)
 * - UI 모드: `npm run test:e2e:ui`
 */

const BASE_URL = "http://localhost:3000";

// 테스트 환경의 백엔드 origin을 고정값으로 주입한다.
// 이후 스텁(downstream)이 이 origin을 가로챈다.
const API_URL = "http://localhost:8000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // open: 'never' — 의도적 실패(승인 기준 검증) 시 리포트 서버가 떠서
  // 프로세스가 매달리는 것을 방지한다. 리포트는 test:e2e:report로 본다.
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry", // 재시도 시 trace.zip 생성 (타임라인·DOM 타임트래블)
    video: "retain-on-failure", // 실패 테스트만 .webm 영상 보존
    screenshot: "only-on-failure",
  },
  // 1차는 chromium 단일 프로젝트로 시작한다.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000, // dev 콜드 컴파일 여유
    env: {
      NEXT_PUBLIC_API_URL: API_URL,
    },
  },
});
