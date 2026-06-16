import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

/**
 * FRT-49 — 설정 페이지 보안 카드 → 비밀번호 재설정 진입점.
 * playwright.config 의 NEXT_PUBLIC_PASSWORD_RESET_ENABLED=true 환경에서:
 *  1) 버튼이 활성화되고 /forgot-password 로 이동한다
 *  2) 로그인 상태여도 가드(authed→/dashboard)에 튕기지 않는다(?from=settings opt-in)
 *  3) 재설정 완료 후 세션이 무효화되어 /login?reset=1 재로그인 화면에 도달한다
 *     (reset 이 세션을 무효화 → 뒤이은 logout 이 401 이어도 "이미 로그아웃"으로 간주해 진행)
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

  // 이메일은 현재 계정으로 고정(prefill+lock) — 임의 이메일로 다른 계정을 재설정하는 오인 방지
  const emailInput = page.getByPlaceholder("name@example.com");
  await expect(emailInput).toHaveValue("demo@story-arc.org");
  await expect(emailInput).toBeDisabled();

  // 재설정 흐름: 코드 → 새 비밀번호 (이메일은 고정값으로 전송)
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

  // 변경 대상 이메일이 로그인 계정으로 고정되었는지 단언
  expect(stub.mutations).toContainEqual(
    expect.objectContaining({
      method: "POST",
      path: "/auth/reset-password",
      body: { email: "demo@story-arc.org", code: "123456", newPassword: "newpass123" },
    }),
  );
});

// 설정發 진입은 인증 세션을 신뢰원으로 삼는다. 유효한 비번 계정 세션이 아니면 공개 폼으로
// 떨어지지 않고 돌려보낸다(임의 이메일 오인 재설정·스트랜딩 방지, Codex P2).
test("세션 없는 ?from=settings 진입: /login 으로 리다이렉트(공개 폼 폴백 안 함)", async ({ page }) => {
  await stubApi(page); // 비인증(/auth/me 미인증)
  await page.goto("/forgot-password?from=settings");
  await expect(page).toHaveURL(/\/login$/);
});

test("소셜 전용 계정 ?from=settings 진입: /settings 으로 리다이렉트(미지원)", async ({ page }) => {
  await stubApi(page, { authed: true, hasPassword: false });
  await page.goto("/forgot-password?from=settings");
  await expect(page).toHaveURL(/\/settings$/);
});
