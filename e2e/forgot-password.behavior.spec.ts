import { expect, test } from "@playwright/test";
import { stubApi } from "./fixtures/stub-api";

// 시각 검토용 스크린샷 출력(.gitignore 된 test-results/). 단언과 무관.
const SHOT = "test-results/forgot-password";

test("재설정 전체 흐름: 로그인 링크 → 이메일 → 코드 → 새 비밀번호 → /login?reset=1", async ({
  page,
}) => {
  const stub = await stubApi(page); // 비인증(로그아웃) 상태로 진입

  await page.goto("/login");

  // 진입점 링크(PASSWORD_RESET_ENABLED ON)
  const forgotLink = page.getByRole("link", { name: "비밀번호를 잊으셨나요?" });
  await expect(forgotLink).toBeVisible();
  await page.screenshot({ path: `${SHOT}/0-login.png`, fullPage: true, animations: "disabled" });
  await forgotLink.click();

  // email 단계
  await expect(page.getByRole("heading", { name: "비밀번호를 잊으셨나요?" })).toBeVisible();
  await page.getByPlaceholder("name@example.com").fill("user@example.com");
  await page.screenshot({ path: `${SHOT}/1-email.png`, fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "재설정 코드 받기" }).click();

  // code 단계
  await expect(page.getByRole("heading", { name: "인증 코드를 입력해주세요" })).toBeVisible();
  await page.getByPlaceholder("코드 6자리 입력").fill("123456");
  await page.screenshot({ path: `${SHOT}/2-code.png`, fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "확인" }).click();

  // password 단계
  await expect(page.getByRole("heading", { name: "새 비밀번호를 설정해주세요" })).toBeVisible();
  await page.getByPlaceholder("영문+숫자 8자 이상").fill("newpass123");
  await page.getByPlaceholder("비밀번호를 다시 입력해주세요").fill("newpass123");
  await page.screenshot({ path: `${SHOT}/3-password.png`, fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "비밀번호 변경하기" }).click();

  // 성공 → 로그인 화면 + ?reset=1 배너
  await expect(page).toHaveURL(/\/login\?reset=1/);
  await expect(
    page.getByText("비밀번호가 변경되었어요. 새 비밀번호로 로그인해주세요."),
  ).toBeVisible();
  await page.screenshot({ path: `${SHOT}/4-success.png`, fullPage: true, animations: "disabled" });

  // 3개 엔드포인트가 올바른 바디로 호출됐는지 단언
  expect(stub.mutations).toContainEqual(
    expect.objectContaining({
      method: "POST",
      path: "/auth/forgot-password",
      body: { email: "user@example.com" },
    }),
  );
  expect(stub.mutations).toContainEqual(
    expect.objectContaining({
      method: "POST",
      path: "/auth/reset-password/verify",
      body: { email: "user@example.com", code: "123456" },
    }),
  );
  expect(stub.mutations).toContainEqual(
    expect.objectContaining({
      method: "POST",
      path: "/auth/reset-password",
      body: { email: "user@example.com", code: "123456", newPassword: "newpass123" },
    }),
  );
});

test("잘못된 코드: 즉시 오류 안내, 비밀번호 단계로 진행하지 않는다", async ({ page }) => {
  await stubApi(page);
  await page.goto("/forgot-password");

  await page.getByPlaceholder("name@example.com").fill("user@example.com");
  await page.getByRole("button", { name: "재설정 코드 받기" }).click();

  // "000000" 은 스텁이 INVALID_CODE(400) 로 응답한다.
  await page.getByPlaceholder("코드 6자리 입력").fill("000000");
  await page.getByRole("button", { name: "확인" }).click();

  await expect(page.getByText("인증 코드가 올바르지 않아요")).toBeVisible();
  await expect(page.getByRole("heading", { name: "새 비밀번호를 설정해주세요" })).toHaveCount(0);
});

test("모바일 뷰포트: 재설정 화면이 깨지지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12/13 기준
  await stubApi(page);
  await page.goto("/forgot-password");

  await expect(page.getByRole("heading", { name: "비밀번호를 잊으셨나요?" })).toBeVisible();
  await page.getByPlaceholder("name@example.com").fill("user@example.com");
  await page.screenshot({ path: `${SHOT}/mobile-email.png`, fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "재설정 코드 받기" }).click();

  await expect(page.getByRole("heading", { name: "인증 코드를 입력해주세요" })).toBeVisible();
  await page.screenshot({ path: `${SHOT}/mobile-code.png`, fullPage: true, animations: "disabled" });

  // 가로 오버플로 가드(DoD 모바일 레이아웃): 본문이 뷰포트 폭을 넘기지 않는다.
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});
