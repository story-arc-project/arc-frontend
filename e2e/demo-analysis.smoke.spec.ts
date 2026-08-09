import { expect, test } from "@playwright/test";

/**
 * 데모 분석 둘러보기 스모크 (FRT-232).
 *
 * `/demo` 는 공개 라우트(analysis 는 `USE_MOCK || isDemoMode()` 로 고정 mock)라
 * 인증·스텁이 필요 없다.
 *
 * 이 층이 맡는 것은 유닛이 증명하지 못하는 한 가지다 — **미러 라우트가 실제로 렌더되는가**.
 * re-export 경로 오타는 typecheck 가 잡지만, 이 페이지들이 (main) 쪽 레이아웃
 * (`app/(main)/analysis/layout.tsx` 의 AnalysisSNB)에 기대고 있어서 데모 트리에서 깨지는지는
 * 브라우저로 열어보기 전에는 알 수 없다. 링크의 basePath 접두는 유닛이 따로 지킨다.
 */

const LISTS = [
  { path: "/demo/analysis/individual", heading: "개별 경험 분석" },
  { path: "/demo/analysis/comprehensive", heading: "종합 분석" },
  { path: "/demo/analysis/keyword", heading: "키워드 분석" },
  { path: "/demo/analysis/history", heading: "전체 분석 결과" },
  { path: "/demo/analysis/bookmarks", heading: "즐겨찾기" },
];

for (const { path, heading } of LISTS) {
  test(`데모 분석 미러 라우트가 렌더된다: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  });
}

test("데모 분석 허브: 퀵액션 3장이 생성이 아니라 목록으로 간다", async ({ page }) => {
  await page.goto("/demo/analysis");

  // 예전에는 이 3칸이 통째로 숨겨져 데모에서 유형별 목록에 들어갈 길이 없었다.
  await expect(page.getByRole("link", { name: /종합 분석 보기/ })).toHaveAttribute(
    "href",
    "/demo/analysis/comprehensive",
  );

  await page.getByRole("link", { name: /종합 분석 보기/ }).click();
  await expect(page).toHaveURL(/\/demo\/analysis\/comprehensive$/);
  await expect(page.getByRole("heading", { name: "종합 분석" })).toBeVisible();
});

test("데모 분석 허브: 하단 링크로 전체 결과·즐겨찾기까지 이어진다", async ({ page }) => {
  await page.goto("/demo/analysis");

  await page.getByRole("link", { name: /전체 결과 보기/ }).click();
  await expect(page).toHaveURL(/\/demo\/analysis\/history$/);
  await expect(page.getByRole("heading", { name: "전체 분석 결과" })).toBeVisible();

  // 데모는 둘러보기만 한다 — 되돌아올 성공(이름 변경·삭제)과 목적지 없는 '다시 분석'은 없다.
  await expect(page.getByRole("button", { name: "삭제" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "다시 분석" })).toHaveCount(0);
});
