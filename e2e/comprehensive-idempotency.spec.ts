import { expect, test, type Page } from "@playwright/test";

import { API_ORIGIN } from "./fixtures/api-origin";
import { experienceList } from "./fixtures/api-data";
import { corsHeaders, stubApi } from "./fixtures/stub-api";

async function selectExperiences(page: Page) {
  await expect(page.getByRole("heading", { name: "새 종합 분석" })).toBeVisible();
  const choices = page.getByRole("checkbox");
  await expect(choices).toHaveCount(2);
  await choices.nth(0).check({ force: true });
  await choices.nth(1).check({ force: true });
}

for (const failure of ["network", "server", "rejected"] as const) {
  test(`종합 분석 ${failure} 이후 재요청의 키 수명`, async ({ page }) => {
    await stubApi(page, { authed: true });
    await page.route(`${API_ORIGIN}/experiences/`, async (route) => {
      const payload = experienceList("data");
      payload.data.contents = payload.data.contents.map((experience) => ({
        ...experience, content: { ...experience.content, status: "complete" },
      }));
      await route.fulfill({ status: 200, headers: corsHeaders(new URL(page.url()).origin), json: payload });
    });
    const keys: string[] = [];
    const payloads: unknown[] = [];
    await page.route(`${API_ORIGIN}/analysis/comprehensive`, async (route) => {
      const request = route.request();
      if (request.method() === "GET") return route.fallback();
      const headers = corsHeaders(new URL(page.url()).origin);
      if (request.method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers: {
          ...headers,
          "access-control-allow-methods": "POST,OPTIONS",
          "access-control-allow-headers": "content-type,idempotency-key",
        } });
      }
      keys.push(request.headers()["idempotency-key"] ?? "");
      payloads.push(request.postDataJSON());
      if (keys.length === 1) {
        if (failure === "network") return route.abort("failed");
        return route.fulfill({
          status: failure === "server" ? 503 : 402,
          headers,
          json: { error: { code: failure === "server" ? "SERVER_ERROR" : "INSUFFICIENT_CREDITS", message: "Request failed" } },
        });
      }
      return route.fulfill({ status: 200, headers, json: {
        status: "success", data: { id: "comp-idempotent", title: "종합 분석" },
      } });
    });

    await page.goto("/analysis/comprehensive/new");
    await selectExperiences(page);
    await page.getByRole("button", { name: "분석 시작", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "분석 요청에 실패했습니다." })).toBeVisible();
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await page.getByRole("button", { name: "분석 시작", exact: true }).click();
    await expect(page).toHaveURL(/\/analysis\/comprehensive\?started=comp-idempotent$/);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(payloads[1]).toEqual(payloads[0]);
    if (failure === "rejected") expect(keys[1]).not.toBe(keys[0]);
    else expect(keys[1]).toBe(keys[0]);
  });
}
