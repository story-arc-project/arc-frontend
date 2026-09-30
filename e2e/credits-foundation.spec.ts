import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

test("공통 잔액 기반은 소비자가 없는 기존 화면에서 미제공 API를 호출하지 않는다", async ({ page }) => {
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
  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 1, name: "내 계정" })).toBeVisible();
  expect(creditRequests).toEqual([]);
});
