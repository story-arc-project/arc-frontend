import { expect, test } from "@playwright/test";
import { stubApi } from "./fixtures/stub-api";

for (const width of [390, 640, 1440]) {
  test(`FRT-242 menu semantics and keyboard ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await stubApi(page, { authed: false });
    await page.goto("/demo/archive");
    await page.getByRole("button", { name: "가이드 닫기" }).click();
    const header = page.locator("header").first();
    const toggle = header.locator("button[aria-controls]");
    if (width >= 640) {
      await expect(toggle).toBeHidden();
      await expect(header.getByRole("link", { name: "아카이브", exact: true })).toBeVisible();
      await testInfo.attach("desktop", { body: await page.screenshot({ type: "jpeg", quality: 70 }), contentType: "image/jpeg" });
      return;
    }
    await expect(toggle).toHaveAccessibleName("메뉴 열기");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    const targetId = await toggle.getAttribute("aria-controls");
    expect(targetId).toBeTruthy();
    const panel = page.locator(`[id="${targetId}"]`);
    await expect(panel).toBeHidden();
    await testInfo.attach("mobile-closed", { body: await page.screenshot({ type: "jpeg", quality: 70 }), contentType: "image/jpeg" });
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAccessibleName("메뉴 닫기");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toBeFocused();
    await expect(panel).toBeVisible();
    await testInfo.attach("mobile-open", { body: await page.screenshot({ type: "jpeg", quality: 70 }), contentType: "image/jpeg" });
    await testInfo.attach("accessible-menu", { body: await header.ariaSnapshot(), contentType: "text/plain" });
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAccessibleName("메뉴 열기");
    await expect(panel).toBeHidden();
    await page.keyboard.press("Tab");
    expect(await panel.locator(":focus").count()).toBe(0);
    await toggle.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("Tab");
    await expect(panel.getByRole("link", { name: "아카이브", exact: true })).toBeFocused();
    await panel.getByRole("link", { name: "분석", exact: true }).click();
    await expect(page).toHaveURL(/\/demo\/analysis$/);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await panel.getByRole("button", { name: "가이드 다시 보기" }).click();
    await expect(page.getByRole("dialog", { name: "데모 가이드" })).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "가이드 닫기" }).click();
    await toggle.click();
    await expect(panel.getByRole("link", { name: "회원가입", exact: true })).toHaveAttribute("href", "/signup");
    await panel.getByRole("link", { name: "회원가입", exact: true }).click();
    await expect(page).toHaveURL(/\/signup$/);
  });
}
