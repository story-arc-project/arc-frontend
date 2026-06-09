import { expect, test } from "@playwright/test";
import { stubApi } from "./fixtures/stub-api";

test("동의 스텝: 필수 미동의 시 다음 비활성 → 전체동의 후 진행 + /auth/consent 기록", async ({
  page,
}) => {
  const stub = await stubApi(page, { authed: true, onboarded: false }); // page.goto 전에 호출
  await page.goto("/signup?step=consent");

  const next = page.getByRole("button", { name: "다음" });
  await expect(next).toBeDisabled();

  await page.getByLabel("전체 동의").check();
  await expect(next).toBeEnabled();
  await next.click();

  // consent 제출 성공 → profile 스텝 진입
  await expect(page.getByRole("heading", { name: "기본 정보를 알려주세요" })).toBeVisible();

  expect(stub.mutations).toContainEqual(
    expect.objectContaining({ method: "POST", path: "/auth/consent" }),
  );
});

test("동의 스텝: 선택 미동의해도 필수만 충족하면 진행 가능", async ({ page }) => {
  await stubApi(page, { authed: true, onboarded: false });
  await page.goto("/signup?step=consent");

  await page.getByLabel("서비스 이용약관 동의").check();
  await page.getByLabel("개인정보 수집·이용 동의 (서비스 제공)").check();
  await page.getByLabel("만 14세 이상입니다").check();

  await expect(page.getByRole("button", { name: "다음" })).toBeEnabled();
});

test("동의 활성 시 profile 직접 진입(URL)은 consent로 되돌린다 (우회 차단)", async ({ page }) => {
  await stubApi(page, { authed: true, onboarded: false });
  await page.goto("/signup?step=profile");

  // 동의를 건너뛴 직접 URL → consent 스텝으로 강제, profile 헤딩은 보이지 않는다.
  await expect(page.getByRole("heading", { name: "약관에 동의해주세요" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "기본 정보를 알려주세요" })).toHaveCount(0);
});
