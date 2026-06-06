import { expect, test, type Page } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

/**
 * FRT-30 후속 — (main) analysis/export **하위 라우트** 스모크.
 *
 * FRT-30 1차는 진입 5화면(hub 포함)만 커버했고, 이슈는 analysis/export 하위 라우트
 * (목록·상세·new 등)를 "필요 시 후속 확장"으로 미뤘다. 본 스펙이 그 확장이다.
 * 인증 주입 + API 스텁(data 시나리오)만으로 각 하위 라우트가 `/login` 리다이렉트
 * 없이 렌더되는지 결정론적으로 검증한다.
 *
 * 근거 레이어는 main-routes.smoke 와 동일:
 *  - 1차(load-bearing): 화면 고유 랜드마크. 목록/ new 페이지는 데이터-독립 h1(진입+가드
 *    통과 증명), 상세/레쥬메 페이지는 성공 상태에서만 뜨는 요소(로딩=스켈레톤·에러=alert엔
 *    없음 → 데이터 렌더까지 증명).
 *  - 2차: URL 유지 + GNB 로고("ARC").
 * 상세 라우트는 픽스처 ID(ind-1/comp-1/kw-1/resume-e2e-1)로 진입한다. 스텁은 id 무관
 * 고정 응답이지만, 실제 ID 를 써 현실 경로를 재현한다.
 */

interface SubRouteCase {
  name: string;
  path: string;
  url: RegExp;
  /** 진입 화면이 렌더됐다는 1차(load-bearing) 근거. */
  landmark: (page: Page) => Promise<void>;
}

const heading1 = (name: string) => async (page: Page) => {
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
};

const SUBROUTES: SubRouteCase[] = [
  // ── analysis 목록 (데이터-독립 h1) ──────────────────────────
  {
    name: "analysis/individual (list)",
    path: "/analysis/individual",
    url: /\/analysis\/individual$/,
    landmark: heading1("개별 경험 분석"),
  },
  {
    name: "analysis/comprehensive (list)",
    path: "/analysis/comprehensive",
    url: /\/analysis\/comprehensive$/,
    landmark: heading1("종합 분석"),
  },
  {
    name: "analysis/keyword (list)",
    path: "/analysis/keyword",
    url: /\/analysis\/keyword$/,
    landmark: heading1("키워드 분석"),
  },
  // ── analysis 상세 (성공 상태에서만 뜨는 h1 → 데이터 렌더 증명) ──
  {
    name: "analysis/individual detail",
    path: "/analysis/individual/ind-1",
    url: /\/analysis\/individual\/ind-1$/,
    landmark: heading1("교내 개발 동아리 운영진"), // 픽스처 result.itemName
  },
  {
    name: "analysis/comprehensive detail",
    path: "/analysis/comprehensive/comp-1",
    url: /\/analysis\/comprehensive\/comp-1$/,
    landmark: heading1("종합 분석 결과"), // 하드코딩 h1
  },
  {
    name: "analysis/keyword detail",
    path: "/analysis/keyword/kw-1",
    url: /\/analysis\/keyword\/kw-1$/,
    // 픽스처 keywords=["리더십"] → h1 "'리더십' 키워드 분석"; 부분 일치로 매칭.
    landmark: heading1("키워드 분석"),
  },
  // ── analysis 신규 생성 폼 (select 단계 데이터-독립 h1) ─────────
  {
    name: "analysis/comprehensive/new",
    path: "/analysis/comprehensive/new",
    url: /\/analysis\/comprehensive\/new$/,
    landmark: heading1("새 종합 분석"),
  },
  {
    name: "analysis/keyword/new",
    path: "/analysis/keyword/new",
    url: /\/analysis\/keyword\/new$/,
    landmark: heading1("새 키워드 분석"),
  },
  // ── analysis 기타 ───────────────────────────────────────────
  {
    name: "analysis/bookmarks",
    path: "/analysis/bookmarks",
    url: /\/analysis\/bookmarks$/,
    landmark: heading1("즐겨찾기"),
  },
  {
    name: "analysis/history",
    path: "/analysis/history",
    url: /\/analysis\/history$/,
    landmark: heading1("전체 분석 결과"),
  },
  // ── export 상세 ─────────────────────────────────────────────
  {
    name: "export/resume detail",
    path: "/export/resume/resume-e2e-1",
    url: /\/export\/resume\/resume-e2e-1$/,
    // 레쥬메 상세는 h1 이 없다. 비어있지 않은 섹션이 로드되면 편집기 상단바 버튼이 뜬다
    // (전부 빈 섹션이면 EmptyResumeState 가 가로채므로, 픽스처는 비어있지 않게 유지).
    landmark: async (page) => {
      await expect(page.getByRole("button", { name: "PDF 다운로드" })).toBeVisible();
    },
  },
];

test.describe("FRT-30 후속: (main) analysis/export 하위 라우트 스모크", () => {
  for (const route of SUBROUTES) {
    test(`${route.name}: 진입 화면이 렌더된다`, async ({ page }) => {
      // 스텁은 반드시 goto 이전에 등록한다(on-load fetch 가 스텁을 거치도록).
      await stubApi(page, { authed: true, scenario: "data" });
      await page.goto(route.path);

      // 1차 근거: 리다이렉트 없이 화면 고유 랜드마크가 보이고 URL 이 유지된다.
      await route.landmark(page);
      await expect(page).toHaveURL(route.url);

      // 2차 확인: (main) layout/GNB 가 마운트됐다.
      await expect(page.getByRole("link", { name: "ARC" })).toBeVisible();
    });
  }
});
