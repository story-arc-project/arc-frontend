import { expect, test } from "@playwright/test";

/**
 * 파이프라인 검증용 더미 스모크 테스트 (FRT-23).
 *
 * `/landing`은 백엔드·로그인 없이 정적으로 렌더되는 공개 페이지다.
 * (`/`는 `/landing`으로 redirect, 로컬 미들웨어는 게이팅하지 않음.)
 * E2E 러너가 dev 서버를 기동하고 페이지를 렌더한다는 것만 확인한다.
 */
test("랜딩 페이지가 200으로 응답하고 핵심 텍스트를 렌더한다", async ({ page }) => {
  const response = await page.goto("/landing");

  expect(response?.ok()).toBe(true);

  // 히어로 h1과 주요 CTA — 백엔드 없이도 항상 렌더되는 정적 텍스트
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "경험을 기록하면",
  );
  await expect(
    page.getByRole("link", { name: "무료로 시작하기", exact: true }).first(),
  ).toBeVisible();
});
