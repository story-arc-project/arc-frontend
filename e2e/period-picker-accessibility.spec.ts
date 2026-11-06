import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

for (const width of [1440, 390]) {
  test(`FRT-186 기간 입력의 이름과 상태가 유지된다 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive/new");
    await page.getByRole("button", { name: "대외활동", exact: true }).click();

    const period = page.getByRole("group", { name: "활동 기간", exact: true });
    const start = period.locator("input").nth(0);
    const end = period.locator("input").nth(1);
    await expect(start).toBeVisible();
    await expect(end).toBeVisible();
    await expect(start).toHaveAccessibleName("활동 기간 시작일");
    await expect(end).toHaveAccessibleName("활동 기간 종료일");
    await expect(start).toHaveAttribute("type", "month");
    await start.fill("2023-03");
    await end.fill("2024-01");
    await period.getByRole("radio", { name: "일 단위" }).click();
    await expect(start).toHaveAttribute("type", "date");
    await expect(start).toHaveValue("2023-03-01");
    await expect(end).toHaveValue("2024-01-01");
    await period.getByRole("checkbox", { name: "현재" }).check();
    await expect(end).toBeDisabled();
    await expect(end).toHaveAccessibleName("활동 기간 종료일");
    await period.getByRole("checkbox", { name: "현재" }).uncheck();
    await expect(end).toBeEnabled();
    await expect(end).toHaveValue("2024-01-01");
    await period.getByRole("radio", { name: "월 단위" }).click();
    await expect(start).toHaveValue("2023-03");
    await expect(end).toHaveValue("2024-01");
    if (process.env.FRT186_CAPTURE) {
      await start.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `/private/tmp/frt186-preview/archive-new-${width}.jpg`, type: "jpeg", quality: 40, fullPage: false, animations: "disabled" });
    }
  });
}
