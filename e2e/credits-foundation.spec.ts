import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

test("공통 잔액 기반은 소비자가 없는 화면에서는 조회하지 않고 설정 진입 시 한 번 조회한다", async ({ page }) => {
  const creditRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/credits") creditRequests.push(request.url());
  });
  await stubApi(page, { authed: true, scenario: "data" });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: /안녕하세요/ })).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(creditRequests).toEqual([]);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 1, name: "내 계정" })).toBeVisible();
  await expect.poll(() => creditRequests.length).toBe(1);
});
