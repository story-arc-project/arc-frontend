import { expect, test } from "@playwright/test";
import { corsHeaders, stubApi } from "./fixtures/stub-api";
import { API_ORIGIN } from "./fixtures/api-origin";

const endpoint = `${API_ORIGIN}/credits/packages`;

for (const width of [320, 390, 1440]) {
  test(`패키지 서버가 없으면 기획안 표시 (${width}px)`, async ({ page }) => {
    await stubApi(page, { authed: false });
    await page.route(endpoint, (route) => route.abort());
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/landing");
    const section = page.locator("#pricing");
    await section.scrollIntoViewIfNeeded();
    const cards = section.locator("article");
    await expect(cards).toHaveCount(3);
    for (const [index, name, credits, price] of [
      [0, "Lite", "20", "4,900"],
      [1, "Basic", "50", "9,900"],
      [2, "Pro", "120", "19,900"],
    ] as const) {
      await expect(cards.nth(index)).toContainText(name);
      await expect(cards.nth(index)).toContainText(`${credits}크레딧`);
      await expect(cards.nth(index)).toContainText(`${price}원`);
    }
    await expect(section).not.toContainText(/가입 즉시|가입하면|이력서 약|1회당|3~5/);
    await expect(section.getByRole("link")).toHaveCount(0);
    await expect(section).not.toContainText("크레딧 충전은 추후");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("정상 서버 패키지가 기획안 기본값을 대체한다", async ({ page }) => {
  await stubApi(page, { authed: false });
  await page.route(endpoint, (route) => route.fulfill({
    headers: corsHeaders(route.request().headers()["origin"] ?? ""),
    json: {
      packages: [{ id: "custom", name: "새 패키지", credits: 80, price_krw: 12300 }],
    },
  }));
  await page.goto("/landing");
  const section = page.locator("#pricing");
  await expect(section.locator("article")).toHaveCount(1);
  await expect(section.locator("article")).toContainText("새 패키지");
  await expect(section.locator("article")).toContainText("80크레딧");
  await expect(section.locator("article")).toContainText("12,300원");
  await expect(section).not.toContainText("Lite");
});

test("깨진 서버 응답이면 기본 패키지를 유지한다", async ({ page }) => {
  await stubApi(page, { authed: false });
  await page.route(endpoint, (route) => route.fulfill({
    headers: corsHeaders(route.request().headers()["origin"] ?? ""),
    json: { packages: [] },
  }));
  const response = page.waitForResponse(endpoint);
  await page.goto("/landing");
  await response;
  await expect(page.locator("#pricing article")).toHaveCount(3);
  await expect(page.locator("#pricing article").first()).toContainText("4,900원");
  await expect(page).toHaveURL(/\/landing$/);
});
