// ─────────────────────────────────────────────────────────────
// E2E API stub helper (FRT-28)
//
// `NEXT_PUBLIC_API_URL` origin 으로 나가는 **데이터 엔드포인트** 요청을 `page.route`
// 로 가로채 `api-data.ts` 의 고정 응답으로 fulfill 한다. 백엔드 없이도 `(main)`
// 화면을 결정론적으로 검증하기 위한 토대다 (소비처: FRT-30 스모크).
//
// 사용:
//   import { stubApi } from "./fixtures/stub-api";
//   await stubApi(page);                 // 기본 "data" 시나리오
//   await stubApi(page, { scenario: "empty" });
//   await page.goto("/dashboard");       // ← 반드시 stubApi 이후에 호출
//
// ⚠️ 반드시 `page.goto` **이전**에 등록한다. 그렇지 않으면 화면 로드 시점의
//    on-load fetch 가 스텁을 거치지 않고 실제 네트워크로 샌다.
//
// CORS: 앱은 localhost:3000 → :8000 으로 credentialed cross-origin fetch 를 한다.
//       fulfill 응답에 `access-control-allow-origin`(정확한 origin) +
//       `access-control-allow-credentials: true` 를 실어야 브라우저가 응답을 읽는다.
//       (Playwright 가 preflight 를 단락시키지만, 일부 환경/비-GET 대비로 OPTIONS
//        분기도 둔다.)
//
// 인증(`/auth/me` 등)은 FRT-24(`NEXT_PUBLIC_E2E_AUTH`) 소관이라 여기서 다루지 않는다.
// ─────────────────────────────────────────────────────────────

import type { Page, Route } from "@playwright/test";

import { API_ORIGIN } from "./api-origin";
import {
  type StubScenario,
  analysisStatus,
  bookmarkList,
  comprehensiveDetail,
  comprehensiveList,
  experienceDetail,
  experienceList,
  individualDetail,
  individualList,
  keywordDetail,
  keywordList,
  libraryExperiences,
  libraryList,
  presetList,
  resumeDetail,
  resumeList,
} from "./api-data";

export type { StubScenario };

/**
 * 테스트가 가로채는 백엔드 origin. `playwright.config.ts` 가 dev 서버에 주입하는
 * `NEXT_PUBLIC_API_URL` 과 **동일 상수**(api-origin)를 공유한다.
 *
 * 러너 프로세스의 `process.env.NEXT_PUBLIC_API_URL` 을 읽지 않는 이유: 그 값이
 * config 가 dev 서버에 주입한 값과 다르면, 앱은 :8000 으로 fetch 하는데 스텁은
 * 다른 origin 을 가로채 실제 백엔드로 새고(계약 스펙만 거짓 통과) 만다. (Codex P2)
 */
export const STUB_API_URL = API_ORIGIN;

const DEFAULT_PAGE_ORIGIN = "http://localhost:3000";

interface RouteDef {
  /** pathname 정규식 (앵커링되어 상호 배타적). */
  match: RegExp;
  /** scenario 에 맞는 응답 본문(이미 봉투/형태가 맞춰진 값)을 반환. */
  build: (scenario: StubScenario) => unknown;
}

// GET 라우트 테이블. 각 정규식은 `^…$` 앵커링되어 목록/상세가 겹치지 않는다.
const GET_ROUTES: RouteDef[] = [
  { match: /^\/experiences\/$/, build: experienceList },
  { match: /^\/experiences\/[^/]+$/, build: experienceDetail },

  { match: /^\/libraries\/$/, build: libraryList },
  { match: /^\/libraries\/[^/]+\/experiences$/, build: libraryExperiences },

  { match: /^\/presets\/$/, build: presetList },

  { match: /^\/analysis\/individual$/, build: individualList },
  { match: /^\/analysis\/individual\/[^/]+$/, build: individualDetail },
  { match: /^\/analysis\/comprehensive$/, build: comprehensiveList },
  { match: /^\/analysis\/comprehensive\/[^/]+$/, build: comprehensiveDetail },
  { match: /^\/analysis\/keyword$/, build: keywordList },
  { match: /^\/analysis\/keyword\/[^/]+$/, build: keywordDetail },
  { match: /^\/analysis\/status\/[^/]+$/, build: analysisStatus },
  { match: /^\/analysis\/bookmarks$/, build: bookmarkList },

  { match: /^\/export\/resume$/, build: resumeList },
  { match: /^\/export\/resume\/[^/]+$/, build: resumeDetail },
];

function corsHeaders(origin: string): Record<string, string> {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
  };
}

export interface StubApiOptions {
  /** "data"(기본): 채워진 응답 · "empty": 빈 목록으로 빈 상태 검증. */
  scenario?: StubScenario;
}

/**
 * 데이터 엔드포인트 스텁을 페이지에 등록한다. `page.goto` 이전에 호출할 것.
 */
export async function stubApi(page: Page, options: StubApiOptions = {}): Promise<void> {
  const scenario: StubScenario = options.scenario ?? "data";

  await page.route(
    (url) => url.href.startsWith(STUB_API_URL),
    async (route: Route) => {
      const req = route.request();
      const method = req.method();
      const origin = req.headers()["origin"] ?? DEFAULT_PAGE_ORIGIN;

      // CORS preflight: 데이터 응답과 동일 origin 정책으로 통과시킨다.
      if (method === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: {
            ...corsHeaders(origin),
            "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
            "access-control-allow-headers": "content-type",
          },
        });
        return;
      }

      const pathname = new URL(req.url()).pathname;

      if (method === "GET") {
        const def = GET_ROUTES.find((r) => r.match.test(pathname));
        if (def) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: corsHeaders(origin),
            body: JSON.stringify(def.build(scenario)),
          });
          return;
        }
      }

      // 미정의 엔드포인트 / 비-GET: 실제 네트워크로 새지 않도록 명시적 404.
      // CORS 헤더를 실어, 불투명 에러가 아니라 읽을 수 있는 404 로 노출한다.
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        headers: corsHeaders(origin),
        body: JSON.stringify({
          status: "error",
          message: `E2E stub: unstubbed ${method} ${pathname}`,
          code: "E2E_STUB_NOT_FOUND",
        }),
      });
    },
  );
}
