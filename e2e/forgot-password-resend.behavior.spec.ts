import { expect, test } from "@playwright/test";
import { stubApi } from "./fixtures/stub-api";

for (const width of [1440, 390]) {
  test(`재발송 결과 역할과 수명 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await stubApi(page);
    let responseStatus = 200;
    await page.route("**/auth/forgot-password", async (route) => {
      await route.fulfill({
        status: responseStatus,
        contentType: "application/json",
        body: JSON.stringify(responseStatus === 200
          ? { status: "success", data: null }
          : { status: "error", message: "stubbed failure" }),
      });
    });
    await page.goto("/forgot-password");
    await page.getByLabel("이메일").fill("user@example.com");
    await page.getByRole("button", { name: "재설정 코드 받기" }).click();
    const resend = page.getByRole("button", { name: "코드 재발송", exact: true });
    await resend.click();
    await expect(page.getByRole("status")).toHaveText("코드를 다시 보냈어요.");
    await expect(page.getByRole("status")).toHaveAttribute("aria-live", "polite");
    await expect(page.locator("p[role=alert]")).toHaveCount(0);
    if (process.env.FRT342_CAPTURE) await page.screenshot({ path: `e2e/preview/out/success-${width}.jpg`, fullPage: true, animations: "disabled", quality: 60 });

    for (responseStatus of [429, 500]) {
      await resend.click();
      const alert = page.locator("p[role=alert]");
      await expect(alert).toHaveText(responseStatus === 429 ? "5분 후 재발송 가능해요." : "재발송에 실패했어요. 잠시 후 다시 시도해주세요.");
      expect(await alert.getAttribute("aria-live")).not.toBe("polite");
      await expect(page.getByRole("status")).toHaveCount(0);
      if (process.env.FRT342_CAPTURE) await page.screenshot({ path: `e2e/preview/out/failure-${responseStatus}-${width}.jpg`, fullPage: true, animations: "disabled", quality: 60 });
    }
    responseStatus = 200;
    await resend.click();
    await expect(page.getByRole("status")).toHaveText("코드를 다시 보냈어요.");
    await expect(page.locator("p[role=alert]")).toHaveCount(0);
    await page.getByLabel("인증 코드").fill("123456");
    await page.getByRole("button", { name: "확인", exact: true }).click();
    await expect(page.getByLabel("새 비밀번호", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "← 이전" }).click();
    await expect(resend).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.locator("p[role=alert]")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
