import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

// /terms·/privacy 는 docs/legal/*.draft.md 를 빌드 타임에 읽어 렌더하는 공개 정적 페이지.
test("이용약관 페이지(/terms)가 렌더된다", async ({ page }) => {
  await stubApi(page); // 루트 레이아웃 AuthProvider 의 /auth/me 를 깔끔히 가로챈다(미인증)
  await page.goto("/terms");

  await expect(page.getByRole("heading", { name: /ARC 서비스 이용약관/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /준거법 및 분쟁 해결/ })).toBeVisible();
});

test("개인정보 처리방침 페이지(/privacy)가 렌더된다", async ({ page }) => {
  await stubApi(page);
  await page.goto("/privacy");

  await expect(page.getByRole("heading", { name: /ARC 개인정보 처리방침/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /처리 목적/ })).toBeVisible();
});
