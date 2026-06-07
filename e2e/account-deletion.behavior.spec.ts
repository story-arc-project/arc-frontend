import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

/**
 * FRT-9 — 비밀번호 계정 회원 탈퇴 동작 E2E.
 * seedDemoUser 는 has_password=true·connected_oauth 없음 → 비밀번호 경로.
 * 소셜 경로는 실제 Google OAuth 의존이라 자동화 범위 밖(유닛으로 커버).
 */
test("비밀번호 계정: 탈퇴 → /login?deleted=1 이동 + 완료 안내", async ({ page }) => {
  const stub = await stubApi(page, { authed: true });
  await page.goto("/settings");

  await expect(page.getByRole("heading", { level: 1, name: "내 계정" })).toBeVisible();

  // 위험 구역 → 다이얼로그
  await page.getByRole("button", { name: "회원 탈퇴" }).click();
  await page.getByLabel("현재 비밀번호").fill("pw123");
  await page.getByRole("button", { name: "탈퇴하기" }).click();

  // 성공 → /login?deleted=1 + 완료 안내
  await expect(page).toHaveURL(/\/login\?deleted=1$/);
  await expect(page.getByText("회원 탈퇴가 완료되었어요.")).toBeVisible();

  // DELETE /auth/account/password 가 password 바디로 나갔다.
  expect(stub.mutations).toContainEqual(
    expect.objectContaining({
      method: "DELETE",
      path: "/auth/account/password",
      body: { password: "pw123" },
    }),
  );
});
