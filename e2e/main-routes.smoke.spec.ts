import { expect, test, type Page } from "@playwright/test";

import { type StubScenario, stubApi } from "./fixtures/stub-api";

/**
 * FRT-30 — (main) route smoke E2E.
 *
 * 인증 주입 + API 스텁만으로, `(main)` 핵심 진입 5화면이 깨지지 않고 렌더되는지
 * 검증한다. 백엔드 의존 없이(스텁만으로) 결정론적으로 통과한다.
 *
 * 각 화면 검증:
 *  1. /login 리다이렉트 없음 — 화면 고유 랜드마크가 보이고 URL 이 유지된다.
 *     GNB 는 AuthGate 의 형제라 리다이렉트 중에도 보이므로 '리다이렉트 없음'의
 *     1차 근거로 쓰지 않는다. 화면 고유 랜드마크(+URL)가 1차 근거다.
 *  2. (main) layout/GNB 렌더 — 상단 GNB 로고("ARC")가 보인다(2차 확인).
 *  3. loading → data/empty 기본 상태가 깨지지 않는다.
 *
 * 인증 주입 방식: 빌드타임 플래그(NEXT_PUBLIC_E2E_AUTH) 대신 `/auth/me` 스텁(런타임).
 *  플래그는 빌드타임 정적이라 단일 dev 서버에서 전역으로 켜지고, /landing 의
 *  useRedirectIfAuthenticated 가 인증 사용자를 /dashboard 로 튕겨 공개 화면 스펙을
 *  깨뜨린다. 런타임 스텁은 단일 서버로 인증/비인증 스펙을 공존시키고 실제 auth 경로
 *  (AuthContext → fetchCurrentUser → /auth/me → 봉투 언랩)를 그대로 탄다.
 *  (결정론은 Acceptance Criterion, FRT-24 플래그는 전제(의존)라 충돌 시 AC 우선.)
 */

interface RouteCase {
  name: string;
  path: string;
  url: RegExp;
  /** data 시나리오에서 화면이 렌더됐다는 1차 근거. */
  assertData: (page: Page) => Promise<void>;
  /** empty 시나리오에서 화면이 렌더됐다는 1차 근거. */
  assertEmpty: (page: Page) => Promise<void>;
}

// 데이터-독립 제목(h1)이 있어 data/empty 모두 같은 랜드마크로 검증되는 화면 헬퍼.
const h1Visible = (name: RegExp | string) => async (page: Page) => {
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
};

const ROUTES: RouteCase[] = [
  {
    name: "dashboard",
    path: "/dashboard",
    url: /\/dashboard$/,
    // 이름은 사용자별로 달라지므로(안녕하세요, {name} 님) 부분 일치로 매칭한다.
    assertData: h1Visible(/안녕하세요/),
    assertEmpty: h1Visible(/안녕하세요/),
  },
  {
    name: "analysis (hub)",
    path: "/analysis",
    url: /\/analysis$/,
    assertData: h1Visible("분석 홈"),
    assertEmpty: h1Visible("분석 홈"),
  },
  {
    name: "export",
    path: "/export",
    url: /\/export$/,
    assertData: h1Visible("익스포트"),
    assertEmpty: h1Visible("익스포트"),
  },
  {
    name: "settings",
    path: "/settings",
    url: /\/settings$/,
    assertData: h1Visible("내 계정"),
    assertEmpty: h1Visible("내 계정"),
  },
  {
    name: "archive",
    path: "/archive",
    url: /\/archive$/,
    // archive 는 h1 이 없고, 리스트 패널을 desktop/mobile 두 컨테이너에 렌더한다.
    // getByText 는 숨김(display:none) 사본까지 잡아 strict 위반이 나므로, a11y 트리
    // 기준(숨김 제외)인 getByRole 로 보이는 사본만 매칭한다.
    //
    // data 근거는 실제 경험 카드(제목 h3)다. 카드는 AuthGate 통과(=children) + 데이터
    // 로드 완료 후에만 렌더되므로 '리다이렉트 없음 + data 상태 렌더'를 동시에 증명한다.
    // (패널 접기/빈-상태 CTA 부재는 로딩 중에도 참이라 data 렌더의 근거가 못 된다 — Codex P2.)
    assertData: async (page) => {
      await expect(
        page.getByRole("heading", { level: 3, name: "교내 개발 동아리 운영진" }),
      ).toBeVisible();
    },
    assertEmpty: async (page) => {
      await expect(page.getByRole("button", { name: "새 경험 추가하기" })).toBeVisible();
    },
  },
];

const SCENARIOS: ReadonlyArray<{
  scenario: StubScenario;
  assert: "assertData" | "assertEmpty";
}> = [
  { scenario: "data", assert: "assertData" },
  { scenario: "empty", assert: "assertEmpty" },
];

test.describe("FRT-30 (main) route smoke", () => {
  for (const route of ROUTES) {
    for (const { scenario, assert } of SCENARIOS) {
      test(`${route.name}: ${scenario} 시나리오에서 진입 화면이 렌더된다`, async ({ page }) => {
        // 스텁은 반드시 goto 이전에 등록한다(on-load fetch 가 스텁을 거치도록).
        await stubApi(page, { authed: true, scenario });
        await page.goto(route.path);

        // 1차 근거: /login 리다이렉트 없이 화면 고유 랜드마크가 보이고 URL 이 유지된다.
        await route[assert](page);
        await expect(page).toHaveURL(route.url);

        // 2차 확인: (main) layout/GNB 가 마운트됐다.
        await expect(page.getByRole("link", { name: "ARC" })).toBeVisible();
      });
    }
  }
});
