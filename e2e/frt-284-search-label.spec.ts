import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`FRT-284 ${viewport.name}: 검색 이름·키보드·검색과 초기화 유지`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");
    const search = page.getByRole("textbox", { name: "경험 검색", exact: true });
    const project = page.getByRole("heading", { level: 3, name: "캡스톤 팀 프로젝트", exact: true });
    const club = page.getByRole("heading", { level: 3, name: "교내 개발 동아리 운영진", exact: true });
    await expect(search).toHaveCount(1);
    await expect(search).toBeVisible();
    await expect(search).toHaveValue("");
    await expect(project).toBeVisible();
    await expect(club).toBeVisible();
    await search.focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("combobox")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(search).toBeFocused();
    await page.keyboard.type("캡스톤");
    await expect(search).toHaveValue("캡스톤");
    await expect(search).toHaveAccessibleName("경험 검색");
    await expect(project).toBeVisible();
    await expect(club).toHaveCount(0);
    await page.screenshot({ path: `e2e/preview/out/frt-284-search-filled--${viewport.name}.jpg`, type: "jpeg", quality: 70, fullPage: true, animations: "disabled" });
    await search.press("ControlOrMeta+A");
    await search.press("Backspace");
    await expect(search).toHaveValue("");
    await expect(search).toHaveAccessibleName("경험 검색");
    await expect(search).toBeFocused();
    await expect(club).toBeVisible();
    await search.fill("캡스톤");
    await page.getByRole("button", { name: "필터", exact: true }).click();
    await page.getByRole("button", { name: "필터 초기화", exact: true }).click();
    await expect(search).toHaveValue("");
    await expect(search).toHaveAccessibleName("경험 검색");
    await expect(project).toBeVisible();
    await expect(club).toBeVisible();
    await page.screenshot({ path: `e2e/preview/out/frt-284-search-reset--${viewport.name}.jpg`, type: "jpeg", quality: 70, fullPage: true, animations: "disabled" });
  });
}
