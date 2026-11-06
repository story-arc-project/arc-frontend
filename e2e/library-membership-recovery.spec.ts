import { expect, test, type Page } from "@playwright/test";

import { experienceList, success } from "./fixtures/api-data";
import { corsHeaders, STUB_API_URL, stubApi } from "./fixtures/stub-api";

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

async function toggleMembership(page: Page, title: string) {
  const card = page.locator('[role="button"]').filter({
    has: page.getByRole("heading", { level: 3, name: title, exact: true }),
  }).first();
  await card.getByRole("button", { name: "더보기", exact: true }).click();
  await page.getByRole("button", { name: "라이브러리 이동", exact: true }).hover();
  await page.getByRole("button", { name: /^복구 확인/ }).click();
  await page.keyboard.press("Escape");
}

for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
  test(`FRT-235 ${viewport.name}: 실패한 추가만 제거하고 겹친 추가는 보존한다`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await stubApi(page, { authed: true });
    const first = gate();
    const second = gate();
    const members = new Set<string>();
    const requested = new Set<string>();
    const experiences = experienceList("data").data.contents;
    await page.route(`${STUB_API_URL}/libraries/**`, async (route) => {
      const request = route.request();
      const headers = corsHeaders(new URL(page.url()).origin);
      if (request.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: { ...headers, "access-control-allow-methods": "GET,POST,DELETE,OPTIONS", "access-control-allow-headers": "content-type,authorization,idempotency-key" } });
        return;
      }
      const pathname = new URL(request.url()).pathname;
      if (pathname === "/libraries/") {
        await route.fulfill({ json: success({ count: 1, contents: { system: [], custom: [{ id: "lib-recovery", name: "복구 확인", is_system: false, color: "#5E6AD2", filter: null }] } }), headers });
        return;
      }
      if (request.method() === "GET") {
        const contents = experiences.filter((experience) => members.has(experience.id));
        await route.fulfill({ json: success({ count: contents.length, contents }), headers });
        return;
      }
      const id = pathname.split("/").at(-1)!;
      requested.add(id);
      if (id === "exp-e2e-2") {
        await first.promise;
        await route.fulfill({ status: 500, json: { status: "error", message: "추가 실패" }, headers });
      } else {
        await second.promise;
        members.add(id);
        await route.fulfill({ status: 204, headers });
      }
    });
    try {
      await page.goto("/archive");
      await expect(page.getByRole("heading", { level: 3, name: "캡스톤 팀 프로젝트" })).toBeVisible();
      await toggleMembership(page, "캡스톤 팀 프로젝트");
      await toggleMembership(page, "교내 개발 동아리 운영진");
      await expect.poll(() => requested.size).toBe(2);
      // Observe the actual archive filtered by the library, with both writes pending.
      await page.getByRole("button", { name: "전체", exact: true }).click();
      await page.getByRole("listitem").filter({ hasText: "복구 확인" }).getByRole("button").first().click();
      await expect(page.getByRole("heading", { level: 3 })).toHaveCount(2);
      await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-pending.jpg`), fullPage: true, animations: "disabled", type: "jpeg", quality: 70 });
      first.release();
      await expect(page.getByRole("heading", { level: 3, name: "캡스톤 팀 프로젝트" })).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 3, name: "교내 개발 동아리 운영진" })).toBeVisible();
      second.release();
      await expect.poll(() => members.has("exp-e2e-1")).toBe(true);
      await expect(page.getByRole("heading", { level: 3, name: "교내 개발 동아리 운영진" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 3, name: "캡스톤 팀 프로젝트" })).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-recovered.jpg`), fullPage: true, animations: "disabled", type: "jpeg", quality: 70 });
      await testInfo.attach(`${viewport.name} pending`, { path: testInfo.outputPath(`${viewport.name}-pending.jpg`), contentType: "image/jpeg" });
      await testInfo.attach(`${viewport.name} recovered`, { path: testInfo.outputPath(`${viewport.name}-recovered.jpg`), contentType: "image/jpeg" });
    } finally {
      first.release();
      second.release();
    }
  });
}
