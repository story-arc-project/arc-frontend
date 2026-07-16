import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

/**
 * FRT-15 — admin 영역 접근 가드 스모크.
 *
 * admin 판별은 **서버사이드**(app/(admin)/admin/layout.tsx 의 requireAdmin,
 * app/api/admin/status 의 getAdminUserOrNull)에서 서버가 백엔드로 직접 fetch 해 이뤄진다.
 * 브라우저 레벨 스텁(page.route)은 이 서버 fetch 를 가로채지 못하므로, 테스트 환경에서 서버는
 * 항상 admin 을 판정하지 못한다(백엔드 부재/쿠키 없는 401 → null → notFound()).
 *
 * 따라서 이 스모크가 결정론적으로 보장하는 것은 다음 두 가지다:
 *  1. admin 이 아닌(=일반 로그인·비로그인) 사용자에게 /admin 은 404 이고 admin 콘텐츠가 새지 않는다.
 *  2. 일반 로그인 사용자의 GNB 계정 메뉴에 관리자 진입점이 노출되지 않는다.
 *
 * "admin 정상 렌더"는 서버 fetch 스텁 인프라가 없어(FRT-33 통합 E2E 이후 과제) 여기서 검증하지
 * 않는다 — 서버 판정 로직은 lib/auth/admin.test.ts, 진입점 표시 로직은 useIsAdmin.test.ts
 * 와 AdminEntryLink 스토리로 커버한다.
 */
test.describe("FRT-15 admin 접근 가드", () => {
  test("비로그인 사용자는 /admin 에서 404 — admin 콘텐츠가 노출되지 않는다", async ({ page }) => {
    await stubApi(page, { authed: false });
    await page.goto("/admin");

    // 404 본문(루트 not-found)이 뜨고, admin 셸/개요는 어디에도 없다.
    await expect(page.getByText("페이지를 찾을 수 없어요")).toBeVisible();
    await expect(page.getByRole("heading", { name: "관리자 개요" })).toHaveCount(0);
    await expect(page.getByText("ARC", { exact: true })).toHaveCount(0);
  });

  test("일반 로그인 사용자도 /admin 에서 404 (서버가 admin 을 판정하지 않음)", async ({ page }) => {
    await stubApi(page, { authed: true });
    await page.goto("/admin");

    await expect(page.getByText("페이지를 찾을 수 없어요")).toBeVisible();
    await expect(page.getByRole("heading", { name: "관리자 개요" })).toHaveCount(0);
  });

  test("일반 로그인 사용자의 계정 메뉴에는 관리자 진입점이 없다", async ({ page }) => {
    await stubApi(page, { authed: true });
    await page.goto("/dashboard");

    // 계정 메뉴를 연다(데스크톱 UserMenu).
    await page.getByRole("button", { name: "계정 메뉴" }).click();

    // 마이페이지는 있고, 관리자 항목은 없다.
    await expect(page.getByRole("menuitem", { name: "마이페이지" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "관리자" })).toHaveCount(0);
  });
});
