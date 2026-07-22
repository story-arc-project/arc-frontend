import { defineConfig, devices } from "@playwright/test";

import { API_ORIGIN } from "./e2e/fixtures/api-origin";

/**
 * ui-preview 스킬 전용 러너 — 스크린샷 캡처만 수행한다 (CI 미사용).
 * 개발자의 dev 서버(3000)를 재사용하면 env(NEXT_PUBLIC_API_URL)가 달라
 * 스텁이 빗나갈 수 있으므로, 전용 포트에서 preview env 로 서버를 띄운다.
 */
const PREVIEW_PORT = 3100;
const BASE_URL = `http://localhost:${PREVIEW_PORT}`;

export default defineConfig({
  testDir: "./e2e/preview",
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: BASE_URL },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PREVIEW_PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_URL: API_ORIGIN,
      NEXT_PUBLIC_CONSENT_ENABLED: "true",
      NEXT_PUBLIC_PASSWORD_RESET_ENABLED: "true",
      // 배포 전 기능도 프리뷰에서는 켠 상태로 촬영한다(FRT-108 분석 재시도).
      NEXT_PUBLIC_ANALYSIS_RETRY_ENABLED: "true",
      // 봉인된 기능도 프리뷰에서는 켜서 실물을 확인한다(FRT-109 경험 선택).
      // PREVIEW_RESUME_EXPERIENCE_SELECTION=false 로 넘기면 off 상태(현행)를 찍을 수 있다.
      NEXT_PUBLIC_RESUME_EXPERIENCE_SELECTION:
        process.env.PREVIEW_RESUME_EXPERIENCE_SELECTION ?? "true",
      // 인앱 피드백(FRT-95)도 동일 — 프로덕션 기본값 off, BAC-34/35 라이브 후 켠다.
      NEXT_PUBLIC_FEEDBACK_ENABLED: "true",
    },
  },
});
