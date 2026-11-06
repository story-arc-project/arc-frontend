import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { stubApi } from "./fixtures/stub-api";
import { API_ORIGIN } from "./fixtures/api-origin";
import { experienceDetail, experienceList, success } from "./fixtures/api-data";

// FRT-173: real routes and API boundary; HTTP 200 malformed fixtures, not live backend output.
for (const width of [1440, 390]) {
  test.describe(`experience responses ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test("malformed list shows a recoverable error instead of empty state", async ({ page }) => {
      await stubApi(page, { authed: true });
      let malformed = true;
      await page.route(`${API_ORIGIN}/experiences/`, (route) => route.fulfill({ json: malformed ? success({ count: 1, contents: [null] }) : experienceList("data") }));
      await page.goto("/archive");
      await expect(page.locator("p:visible").filter({ hasText: /^경험 목록을 불러오지 못했어요$/ })).toBeVisible();
      await expect(page.getByRole("button", { name: "새 경험 추가하기", exact: true })).toHaveCount(0);
      if (process.env.FRT173_CAPTURE_DIR) {
        await mkdir(process.env.FRT173_CAPTURE_DIR, { recursive: true });
        await page.screenshot({ path: `${process.env.FRT173_CAPTURE_DIR}/list-${width}.jpg`, fullPage: true, type: "jpeg", quality: 70, animations: "disabled" });
      }
      malformed = false;
      await page.getByRole("button", { name: "다시 시도", exact: true }).click();
      await expect(page.getByRole("heading", { level: 3, name: "캡스톤 팀 프로젝트" })).toBeVisible();
    });
    test("malformed detail shows error and a route back to the list", async ({ page }) => {
      await stubApi(page, { authed: true });
      await page.route(`${API_ORIGIN}/experiences/exp-e2e-1`, (route) => route.fulfill({ json: success({ ...experienceDetail().data, content: null }) }));
      await page.goto("/archive/exp-e2e-1/edit");
      await expect(page.getByText("경험을 불러오지 못했어요", { exact: true })).toBeVisible();
      if (process.env.FRT173_CAPTURE_DIR) {
        await mkdir(process.env.FRT173_CAPTURE_DIR, { recursive: true });
        await page.screenshot({ path: `${process.env.FRT173_CAPTURE_DIR}/detail-${width}.jpg`, fullPage: true, type: "jpeg", quality: 70, animations: "disabled" });
      }
      await page.getByRole("link", { name: "목록으로 돌아가기", exact: true }).click();
      await expect(page.getByRole("heading", { level: 3, name: "캡스톤 팀 프로젝트" })).toBeVisible();
    });
    test("a valid future experience type remains visible", async ({ page }) => {
      await stubApi(page, { authed: true });
      const data = structuredClone(experienceDetail().data);
      data.type = "future-experience-type";
      data.content.title = "새 유형의 경험";
      await page.route(`${API_ORIGIN}/experiences/`, (route) => route.fulfill({ json: success({ count: 1, contents: [data] }) }));
      await page.goto("/archive");
      await expect(page.getByRole("heading", { level: 3, name: "새 유형의 경험" })).toBeVisible();
    });
  });
}
