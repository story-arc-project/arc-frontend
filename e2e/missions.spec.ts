import { expect, test } from "@playwright/test";
import { stubApi } from "./fixtures/stub-api";

test("account entry opens ten missions without fabricating eligibility or grant requests", async ({ page }) => {
  const stub = await stubApi(page, { authed: true });
  await page.goto("/settings");
  await page.getByRole("link", { name: /미션/ }).click();
  await expect(page).toHaveURL(/\/credits\/missions$/);
  await expect(page.getByRole("heading", { name: "미션", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "크레딧 받기", exact: true })).toHaveCount(0);
  await expect(page.getByText("프로필 100% 완성", { exact: true })).toBeVisible();
  expect(stub.mutations.filter(m => /mission|claim|grant/.test(m.path))).toHaveLength(0);
});

test("mission detail can be opened directly and unsupported IDs are rejected", async ({ page }) => {
  await stubApi(page, { authed: true });
  await page.goto("/credits/missions/M2");
  await expect(page.getByRole("heading", { name: "상세 사용 후기", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page.goto("/credits/missions/M99");
  await expect(page.getByRole("heading", { name: "페이지를 찾을 수 없어요" })).toBeVisible();
});
