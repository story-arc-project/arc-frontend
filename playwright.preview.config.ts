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
      // 자기소개서(FRT-140)도 봉인 상태다 — BAC-62(백엔드 파이프라인)가 없어 기본 off.
      // 프리뷰에서는 켜서 실물을 확인한다(데모 시드가 본문·근거 경고를 공급한다).
      NEXT_PUBLIC_COVER_LETTER_ENABLED: "true",
      // admin 화면(FRT-16/17)은 **서버사이드** 가드(requireAdmin)라 클라이언트 스텁만으로는
      // 뚫리지 않는다. E2E 인증 주입으로 seedDemoUser 를 서버에 태우고, 그 이메일을
      // allowlist 에 넣어야 렌더까지 간다.
      //
      // PREVIEW_ADMIN=true 일 때만 켠다 — NEXT_PUBLIC_E2E_AUTH 를 상시로 두면 공개 화면
      // (/landing 등)이 인증 상태로 렌더돼 깨진다(.claude/rules/testing.md).
      ...(process.env.PREVIEW_ADMIN === "true"
        ? {
            NEXT_PUBLIC_E2E_AUTH: "true",
            ADMIN_EMAILS: "demo@story-arc.org",
            NEXT_PUBLIC_ADMIN_CUSTOMERS_ENABLED: "true",
          }
        : {}),
    },
  },
});
