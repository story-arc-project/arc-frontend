import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

/**
 * FRT-49 — 설정 페이지 보안 카드 → 비밀번호 재설정 진입점.
 * playwright.config 의 NEXT_PUBLIC_PASSWORD_RESET_ENABLED=true 환경에서:
 *  1) 버튼이 활성화되고 /forgot-password 로 이동한다
 *  2) 로그인 상태여도 가드(authed→/dashboard)에 튕기지 않는다(?from=settings opt-in)
 *  3) 재설정 완료 후 세션이 무효화되어 /login?reset=1 재로그인 화면에 도달한다
 * seedDemoUser 는 has_password=true → 라벨 "비밀번호 변경".
 */
test("설정發 비밀번호 변경: 진입 → 재설정 → /login?reset=1 재로그인", async ({ page }) => {
  const stub = await stubApi(page, { authed: true });
  await page.goto("/settings");

  // 1) 버튼 활성 + 진입
  const changeBtn = page.getByRole("button", { name: "비밀번호 변경" });
  await expect(changeBtn).toBeEnabled();
  await changeBtn.click();

  // 2) 로그인 상태인데도 재설정 화면이 떠야 한다(가드에 안 튕김)
  await expect(page).toHaveURL(/\/forgot-password\?from=settings$/);
  await expect(page.getByRole("heading", { name: "비밀번호를 잊으셨나요?" })).toBeVisible();

  // 재설정 흐름: 이메일 → 코드 → 새 비밀번호
  await page.getByPlaceholder("name@example.com").fill("user@example.com");
  await page.getByRole("button", { name: "재설정 코드 받기" }).click();
  await page.getByPlaceholder("코드 6자리 입력").fill("123456");
  await page.getByRole("button", { name: "확인" }).click();
  await page.getByPlaceholder("영문+숫자 8자 이상").fill("newpass123");
  await page.getByPlaceholder("비밀번호를 다시 입력해주세요").fill("newpass123");
  await page.getByRole("button", { name: "비밀번호 변경하기" }).click();

  // 3) 세션 무효화 → 로그인 화면 + 재설정 배너(대시보드로 튕기지 않음)
  await expect(page).toHaveURL(/\/login\?reset=1$/);
  await expect(
    page.getByText("비밀번호가 변경되었어요. 새 비밀번호로 로그인해주세요."),
  ).toBeVisible();

  expect(stub.mutations).toContainEqual(
    expect.objectContaining({
      method: "POST",
      path: "/auth/reset-password",
      body: { email: "user@example.com", code: "123456", newPassword: "newpass123" },
    }),
  );
});
