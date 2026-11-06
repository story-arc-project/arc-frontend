import { expect, test } from "@playwright/test";
import { stubApi } from "./fixtures/stub-api";

for (const width of [1440, 390]) {
  test(`dashboard tab keyboard navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/dashboard");
    const tabs = page.getByRole("tablist", { name: "분석 유형" });
    const individual = tabs.getByRole("tab", { name: "개별", exact: true });
    const comprehensive = tabs.getByRole("tab", { name: "종합", exact: true });
    const keyword = tabs.getByRole("tab", { name: "키워드", exact: true });
    await expect(page.getByRole("tabpanel")).toBeVisible();
    await expect(individual).toHaveAttribute("tabindex", "0");
    await expect(comprehensive).toHaveAttribute("tabindex", "-1");
    await individual.focus();
    await individual.press("ArrowRight");
    await expect(comprehensive).toBeFocused();
    await expect(comprehensive).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "dash-tab-comprehensive");
    await comprehensive.press("End");
    await expect(keyword).toBeFocused();
    await keyword.press("ArrowRight");
    await expect(individual).toBeFocused();
    await individual.press("ArrowLeft");
    await expect(keyword).toBeFocused();
    await keyword.press("Home");
    await expect(individual).toBeFocused();
    await keyword.click();
    await expect(keyword).toHaveAttribute("tabindex", "0");
    await expect(page.getByRole("tabpanel")).toHaveAttribute("id", "dash-panel-keyword");
    await keyword.press("Home");
    await individual.press("ArrowRight");
    const screenshot = await page.screenshot({ fullPage: true, type: "jpeg", quality: 70, animations: "disabled" });
    await test.info().attach(`dashboard-tabs-${width}`, { body: screenshot, contentType: "image/jpeg" });
    await comprehensive.press("Tab");
    await expect(tabs.getByRole("tab", { selected: true })).toHaveAttribute("id", "dash-tab-comprehensive");
    await expect(individual).not.toBeFocused();
    await expect(comprehensive).not.toBeFocused();
    await expect(keyword).not.toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(comprehensive).toBeFocused();
  });
}
