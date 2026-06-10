import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

/**
 * FRT-21 — 마이페이지 프로필 수정(저장) 동작 E2E.
 * seedDemoUser(profile.name="데모 사용자", affiliation="student") 를 PATCH /auth/profile 로
 * 수정 → 성공 토스트 + 저장 후 dirty 해제 + /auth/me 재조회 반영을 검증한다.
 */
test("프로필 이름 수정 → PATCH /auth/profile + 성공 토스트 + dirty 해제", async ({ page }) => {
  const stub = await stubApi(page, { authed: true });
  await page.goto("/settings");

  await expect(page.getByRole("heading", { level: 1, name: "내 계정" })).toBeVisible();

  const saveButton = page.getByRole("button", { name: "저장" });
  // 변경 전에는 저장 버튼이 비활성(dirty 아님).
  await expect(saveButton).toBeDisabled();

  const nameInput = page.getByLabel("이름");
  await expect(nameInput).toHaveValue("데모 사용자");
  await nameInput.fill("수정한 이름");
  await expect(saveButton).toBeEnabled();

  await saveButton.click();

  // 성공 토스트 노출(루트 레이아웃 ToastContainer).
  await expect(page.getByText("프로필을 저장했어요.")).toBeVisible();

  // PATCH /auth/profile 가 바뀐 name 만 담아 나갔다(dirty diff).
  expect(stub.mutations).toContainEqual(
    expect.objectContaining({
      method: "PATCH",
      path: "/auth/profile",
      body: { name: "수정한 이름" },
    }),
  );

  // 저장 후 refetch 로 baseline 이 갱신되어 dirty 가 해제된다(버튼 재비활성).
  await expect(saveButton).toBeDisabled();
  await expect(nameInput).toHaveValue("수정한 이름");
});
