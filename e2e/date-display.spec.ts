import { expect, test } from "@playwright/test";
import { stubApi, STUB_API_URL } from "./fixtures/stub-api";
import { experienceList, success } from "./fixtures/api-data";

const fixtures = [
  ["Korea rollover", "2026-03-14T20:00:00Z", "2026.03.15"],
  ["Calendar day", "2026-03-14", "2026.03.14"],
  ["Invalid calendar", "2026-02-30", "2026-02-30"],
  ["Missing date", "", "—"],
] as const;

for (const width of [1440, 390]) {
  test(`Korea date displays at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await stubApi(page, { authed: true });
    const seed = experienceList("data").data.contents[0];
    const contents = fixtures.map(([title, updated_at], index) => ({
      ...seed, id: `date-fixture-${index}`, updated_at,
      content: { ...seed.content, title },
    }));
    await page.route(`${STUB_API_URL}/experiences/**`, async (route) => {
      await route.fulfill({ json: success({ count: contents.length, contents }), headers: {
        "access-control-allow-origin": new URL(page.url()).origin,
        "access-control-allow-credentials": "true",
      } });
    });
    await page.goto("/archive");
    for (const [title, , expected] of fixtures) {
      await expect(page.getByRole("heading", { level: 3, name: title })).toBeVisible();
      await expect(page.getByText(expected, { exact: true }).filter({ visible: true })).toBeVisible();
    }
    await page.screenshot({ path: `e2e/preview/out/frt188-archive-${width}.jpg`, fullPage: true, animations: "disabled" });
    await page.getByRole("heading", { level: 3, name: "Korea rollover" }).click();
    await expect(page.getByText("마지막 수정: 2026.03.15").filter({ visible: true })).toBeVisible();
    await page.screenshot({ path: `e2e/preview/out/frt188-detail-${width}.jpg`, fullPage: true, animations: "disabled" });
    await page.goto("/export");
    await page.getByRole("button", { name: "새 이력서 만들기" }).click();
    const dialog = page.getByRole("dialog", { name: "새 이력서 만들기" });
    await expect(dialog).toBeVisible();
    // The picker is behind a rollout flag; preview config explicitly enables it.
    if (process.env.FRT188_CAPTURE) {
      for (const [title, , expected] of fixtures) await expect(dialog.getByRole("checkbox", { name: `${title} 동아리/교내 단체 ${expected}`, exact: true })).toBeVisible();
      await page.screenshot({ path: `e2e/preview/out/frt188-picker-${width}.jpg`, fullPage: true, animations: "disabled" });
    }
  });
}
