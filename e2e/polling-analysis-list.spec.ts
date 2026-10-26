import { expect, test } from "@playwright/test";
import { stubApi } from "./fixtures/stub-api";
import { API_ORIGIN } from "./fixtures/api-origin";

for (const type of ["comprehensive", "keyword"] as const) {
  test(`${type}: list route recovers, bookmarks and cancels deletion`, async ({ page }) => {
    const stub = await stubApi(page, { authed: true });
    let fail = true;
    await page.route(`${API_ORIGIN}/analysis/${type}`, (route) => fail
      ? route.fulfill({ status: 500, json: { message: "FRT-197 list error" } })
      : route.fallback());
    await page.goto(`/analysis/${type}`);
    await expect(page.locator("main").getByRole("alert")).toContainText("데이터를 불러오지 못했습니다.");
    fail = false;
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: type === "keyword" ? "키워드 분석" : "종합 분석" })).toBeVisible();
    await expect(page.getByRole("link", { name: "ARC", exact: true })).toBeVisible();
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
    await page.getByRole("button", { name: "즐겨찾기", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "즐겨찾기 해제", exact: true }).first()).toBeVisible();
    expect(stub.mutations.some((mutation) => mutation.method === "POST" && mutation.path.startsWith("/analysis/bookmarks/"))).toBe(true);
    await page.getByRole("button", { name: "삭제", exact: true }).first().click();
    await expect(page.getByRole("dialog", { name: "분석 삭제 확인" })).toBeVisible();
    await page.getByRole("button", { name: "취소", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/analysis/${type}$`));
  });
}
