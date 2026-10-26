import { expect, test } from "@playwright/test";
import { stubApi } from "./fixtures/stub-api";
import { API_ORIGIN } from "./fixtures/api-origin";

for (const screen of ["bookmarks", "individual", "history"] as const) {
  test(`${screen}: real route recovers a failed request and changes selection`, async ({ page }) => {
    await stubApi(page, { authed: true });
    let fail = true;
    const endpoints = screen === "history" ? ["individual", "comprehensive", "keyword"] : [screen];
    for (const endpoint of endpoints) {
      await page.route(`${API_ORIGIN}/analysis/${endpoint}`, (route) => fail
        ? route.fulfill({ status: 500, json: { message: "FRT-297 request failure" } })
        : route.fallback());
    }
    await page.goto(`/analysis/${screen}`);
    await expect(page.locator("main").getByRole("alert")).toContainText("데이터를 불러오지 못했습니다.");
    fail = false;
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(page.getByRole("tabpanel")).toBeVisible();
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
    const tab = screen === "individual" ? "분석 완료" : "키워드";
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await expect(page.getByRole("tab", { name: tab, exact: true })).toHaveAttribute("aria-selected", "true");
    if (screen === "bookmarks") {
      await expect(page.getByText("아직 즐겨찾기한 분석이 없습니다.", { exact: true })).toBeVisible();
      await page.getByRole("tab", { name: "전체", exact: true }).click();
    }
    await expect(page.getByRole("tabpanel")).toBeVisible();
    if (screen === "history") {
      await expect(page.getByRole("tabpanel")).toContainText("리더십 키워드 분석");
      await expect(page.getByRole("tabpanel")).not.toContainText("전체 경험 종합 분석");
      await page.getByLabel("정렬 기준").selectOption("oldest");
      await expect(page.getByLabel("정렬 기준")).toHaveValue("oldest");
      await expect(page.getByRole("tabpanel")).toContainText("리더십 키워드 분석");
    }
  });
}
