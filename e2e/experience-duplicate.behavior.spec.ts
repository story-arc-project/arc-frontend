import { expect, test } from "@playwright/test";

import { STUB_API_URL, stubApi } from "./fixtures/stub-api";

for (const hydrationFails of [false, true]) {
  test(`FRT-241 복제 ${hydrationFails ? "상세 GET 실패 후 목록 복구" : "성공"}: 목록·개수·선택 유지`, async ({ page }) => {
    const stub = await stubApi(page, { authed: true, scenario: "data" });
    if (hydrationFails) {
      await page.route(`${STUB_API_URL}/experiences/**`, async (route) => {
        const request = route.request();
        if (request.method() === "GET" && /\/experiences\/e2e-exp-new-/.test(new URL(request.url()).pathname)) {
          await route.abort("failed");
        } else {
          await route.fallback();
        }
      });
    }
    await page.goto("/archive");
    const title = "교내 개발 동아리 운영진";
    await page.getByRole("heading", { level: 3, name: title, exact: true }).click();
    await page.getByRole("button", { name: "복제", exact: true }).click();
    await expect(page).toHaveURL(/\/archive\?id=e2e-exp-new-/);
    await expect(page.getByRole("heading", { level: 2, name: title, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: title, exact: true })).toHaveCount(2);
    expect(stub.mutations.filter((m) => m.path.endsWith("/duplicate"))).toHaveLength(1);
    await page.getByRole("button", { name: "미리보기 닫기", exact: true }).click();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(3);
    await expect(page.getByRole("heading", { level: 3, name: title, exact: true })).toHaveCount(2);
  });
}
