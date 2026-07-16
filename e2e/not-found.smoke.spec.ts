import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

/**
 * FRT-7 — 루트 not-found.tsx 스모크.
 *
 * 존재하지 않는 URL 진입 시 Next 기본 404 대신 브랜드 404 화면(친절한 메시지 + 홈
 * 링크)이 렌더되는지 검증한다. 루트 레이아웃만 적용되는 공개 화면이라 인증 불필요.
 */
test("존재하지 않는 경로는 브랜드 404 화면을 렌더한다", async ({ page }) => {
  await stubApi(page); // 루트 레이아웃 AuthProvider 의 /auth/me 를 가로챈다(미인증)
  await page.goto("/__this_route_does_not_exist__");

  await expect(
    page.getByRole("heading", { level: 1, name: "페이지를 찾을 수 없어요" }),
  ).toBeVisible();

  const home = page.getByRole("link", { name: "홈으로 가기" });
  await expect(home).toBeVisible();
  await expect(home).toHaveAttribute("href", "/dashboard");
});
