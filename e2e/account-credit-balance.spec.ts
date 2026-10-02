import { expect, test, type Page } from "@playwright/test";

import { seedDemoUser } from "@/lib/demo/seed";
import { API_ORIGIN } from "./fixtures/api-origin";
import { corsHeaders, stubApi } from "./fixtures/stub-api";

async function stubAccount(page: Page, affiliation: "student" | "employed") {
  await stubApi(page, { authed: true, scenario: "data" });
  await page.route(`${API_ORIGIN}/auth/me`, (route) => {
    const origin = route.request().headers()["origin"] ?? "";
    return route.fulfill({
      headers: corsHeaders(origin),
      json: {
        status: "success",
        message: "ok",
        data: {
          ...seedDemoUser,
          account: {
            ...seedDemoUser.account,
            email: "student.with.a.very.long.email.address.for.layout@example-university.ac.kr",
          },
          profile: seedDemoUser.profile && { ...seedDemoUser.profile, affiliation },
        },
      },
    });
  });
  await page.route(`${API_ORIGIN}/credits`, (route) => {
    const origin = route.request().headers()["origin"] ?? "";
    return route.fulfill({
      headers: corsHeaders(origin),
      json: { balance: 50, reserved: 3, available: 47, updated_at: "2026-10-02T12:00:00Z" },
    });
  });
}

for (const { width, affiliation } of [
  { width: 1024, affiliation: "student" as const },
  { width: 1280, affiliation: "employed" as const },
]) {
  test(`설정 잔액과 두 열의 실제 카드 외곽이 정렬된다 (${affiliation}, ${width}px)`, async ({ page }) => {
    await stubAccount(page, affiliation);
    await page.setViewportSize({ width, height: 1100 });
    await page.goto("/settings");

    await expect(page.getByText("50 크레딧", { exact: true })).toBeVisible();
    await expect(page.getByText("현재 플랜")).toHaveCount(0);
    await expect(page.getByText(/Pro 업그레이드/)).toHaveCount(0);

    const leftColumn = page.getByTestId("settings-profile-column");
    const rightColumn = page.getByTestId("settings-account-column");
    const left = await leftColumn.boundingBox();
    const right = await rightColumn.boundingBox();
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    expect(Math.abs(left!.y - right!.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(left!.y + left!.height - right!.y - right!.height)).toBeLessThanOrEqual(2);

    const profileCard = leftColumn.locator(":scope > .border");
    const bottomCard = rightColumn.locator("[data-testid='settings-account-bottom'] > .border").last();
    await expect(profileCard).toHaveCSS("border-top-width", "1px");
    await expect(bottomCard).toHaveCSS("border-bottom-width", "1px");
    const profileBox = await profileCard.boundingBox();
    const bottomBox = await bottomCard.boundingBox();
    expect(Math.abs(profileBox!.y - left!.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(bottomBox!.y + bottomBox!.height - (right!.y + right!.height))).toBeLessThanOrEqual(2);
  });
}

for (const width of [390, 768]) {
  test(`모바일 설정은 자연 높이 한 열 순서를 유지한다 (${width}px)`, async ({ page }) => {
    await stubAccount(page, "student");
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/settings");

    const labels = ["프로필 편집", "계정 정보", "보안", "로그아웃", "위험 구역"];
    const positions = await Promise.all(labels.map(async (label) => {
      const element = page.getByText(label, { exact: true });
      await expect(element).toBeVisible();
      return (await element.boundingBox())!.y;
    }));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    await expect(page.getByLabel("학교")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
