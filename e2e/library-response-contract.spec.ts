import { expect, test } from "@playwright/test";

import { success } from "./fixtures/api-data";
import { corsHeaders, STUB_API_URL, stubApi } from "./fixtures/stub-api";

for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
  test(`FRT-244 ${viewport.name}: malformed library list retries into a valid empty list`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await stubApi(page, { authed: true });
    let valid = false;
    let requests = 0;
    await page.route(`${STUB_API_URL}/libraries/`, async (route) => {
      requests += 1;
      await route.fulfill({
        json: success({ count: 0, contents: { system: [], custom: valid ? [] : "" } }),
        headers: corsHeaders(new URL(page.url()).origin),
      });
    });
    await page.goto("/archive");
    const error = page.getByText("라이브러리 목록을 불러오지 못했어요", { exact: true }).filter({ visible: true });
    await expect(error).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-error.jpg`), fullPage: true, animations: "disabled", type: "jpeg", quality: 70 });
    const beforeRetry = requests;
    valid = true;
    await page.getByRole("button", { name: "다시 시도", exact: true }).filter({ visible: true }).click();
    await expect.poll(() => requests).toBeGreaterThan(beforeRetry);
    await expect(error).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "캡스톤 팀 프로젝트", exact: true }).filter({ visible: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-recovered.jpg`), fullPage: true, animations: "disabled", type: "jpeg", quality: 70 });
    for (const state of ["error", "recovered"]) {
      await testInfo.attach(`${viewport.name} ${state}`, { path: testInfo.outputPath(`${viewport.name}-${state}.jpg`), contentType: "image/jpeg" });
    }
  });
}
