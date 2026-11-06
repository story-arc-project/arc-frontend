import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { stubApi, corsHeaders, STUB_API_URL } from "./fixtures/stub-api";
import { experienceList, success } from "./fixtures/api-data";

// All requests stay in page.route stubs; no real library move/delete is performed.
async function setup(page: Page, libraryCount = 30) {
  await stubApi(page, { authed: true });
  const moves: string[] = [];
  await page.route(`${STUB_API_URL}/libraries/**`, async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = corsHeaders(request.headers()["origin"] ?? "http://localhost:3000");
    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: { ...headers,
        "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
        "access-control-allow-headers": "content-type,idempotency-key" } });
    }
    if (request.method() !== "GET") {
      moves.push(path);
      return route.fulfill({ json: success({}), headers });
    }
    if (path === "/libraries/") {
      const custom = Array.from({ length: libraryCount }, (_, i) => ({
        id: `menu-lib-${i + 1}`, name: `검증 라이브러리 ${String(i + 1).padStart(2, "0")}`,
        color: null, icon: null, is_system: false, filter: null,
      }));
      return route.fulfill({ json: success({ count: custom.length, contents: { system: [], custom } }), headers });
    }
    return route.fulfill({ json: success({ count: 0, contents: [] }), headers });
  });
  await page.route(`${STUB_API_URL}/experiences/`, async route => {
    if (route.request().method() !== "GET") return route.fallback();
    const seed = experienceList("data").data.contents[0];
    const contents = Array.from({ length: 20 }, (_, i) => ({ ...seed,
      id: `menu-exp-${i}`, content: { ...seed.content, title: `경계 검증 경험 ${i}` } }));
    return route.fulfill({ json: success({ count: contents.length, contents }),
      headers: corsHeaders(route.request().headers()["origin"] ?? "http://localhost:3000") });
  });
  await page.goto("/archive");
  const trigger = page.locator('[data-experience-id="menu-exp-8"]').getByRole("button", { name: "더보기" });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.evaluate(button => {
    let ancestor = button.parentElement;
    while (ancestor && getComputedStyle(ancestor).overflowY !== "auto") ancestor = ancestor.parentElement;
    if (!ancestor) throw new Error("archive scroll container missing");
    ancestor.scrollTop += button.getBoundingClientRect().bottom - (innerHeight - 24);
  });
  await expect(trigger).toBeInViewport();
  return { trigger, moves };
}

async function bounded(menu: Locator, page: Page) {
  await expect(menu).toBeVisible();
  await expect.poll(async () => {
    const box = await menu.boundingBox();
    const viewport = page.viewportSize()!;
    return !!box && box.x >= 7 && box.y >= 7 && box.x + box.width <= viewport.width - 7 && box.y + box.height <= viewport.height - 7;
  }).toBe(true);
}

async function capture(page: Page, name: string) {
  if (!process.env.FRT262_CAPTURE_DIR) return;
  await mkdir(process.env.FRT262_CAPTURE_DIR, { recursive: true });
  await page.screenshot({ path: `${process.env.FRT262_CAPTURE_DIR}/${name}.jpg`, type: "jpeg", quality: 75, animations: "disabled" });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 700 },
  { width: 390, height: 360 }, { width: 320, height: 480 }]) {
  test(`archive menus stay reachable at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const { trigger, moves } = await setup(page);
    const triggerBox = await trigger.boundingBox();
    expect(triggerBox!.y + triggerBox!.height).toBeGreaterThan(viewport.height - 60);
    await trigger.click();
    const menu = page.locator("[data-archive-popover]").filter({ has: page.getByRole("button", { name: "편집", exact: true }) });
    await bounded(menu, page);
    await capture(page, `${viewport.width}x${viewport.height}-menu`);
    await page.getByRole("button", { name: "라이브러리 이동", exact: true }).hover();
    const last = page.getByRole("button", { name: "검증 라이브러리 30", exact: true });
    const submenu = page.locator("[data-archive-popover]").filter({ has: last });
    await bounded(submenu, page);
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await bounded(submenu, page);
    await capture(page, `${viewport.width}x${viewport.height}-submenu`);
    const geometry = await page.locator("[data-archive-popover]").evaluateAll(elements => elements.map(el => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right,
        scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
    }));
    await testInfo.attach("geometry", { body: JSON.stringify(geometry), contentType: "application/json" });
    await last.click();
    await expect.poll(() => moves.some(path => path.includes("menu-lib-30"))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-archive-popover]")).toHaveCount(0);
  });
}

test("resize repositions; internal scroll stays open; outside click and scroll dismiss", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  const { trigger } = await setup(page);
  await trigger.click();
  await page.setViewportSize({ width: 390, height: 180 });
  const menu = page.locator("[data-archive-popover]");
  await bounded(menu, page);
  await menu.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(menu).toHaveCount(1);
  await expect(page.getByRole("button", { name: "삭제", exact: true })).toBeInViewport();
  await page.mouse.click(1, 1);
  await expect(menu).toHaveCount(0);
  await page.setViewportSize({ width: 900, height: 700 });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await expect(menu).toHaveCount(1);
  await trigger.evaluate(button => {
    let ancestor = button.parentElement;
    while (ancestor && getComputedStyle(ancestor).overflowY !== "auto") ancestor = ancestor.parentElement;
    if (!ancestor) throw new Error("archive scroll container missing");
    ancestor.scrollTop += 20;
  });
  await expect(menu).toHaveCount(0);
});

test.describe("touch reachability", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 360 } });
  test("last library can be tapped after scrolling the submenu", async ({ page }) => {
    const { trigger, moves } = await setup(page);
    await trigger.tap();
    await page.getByRole("button", { name: "라이브러리 이동", exact: true }).tap();
    const last = page.getByRole("button", { name: "검증 라이브러리 30", exact: true });
    const submenu = page.locator("[data-archive-popover]").filter({ has: last });
    await bounded(submenu, page);
    await last.scrollIntoViewIfNeeded();
    await last.tap();
    await expect.poll(() => moves.some(path => path.includes("menu-lib-30"))).toBe(true);
  });
});


test("scrolling the main menu reanchors a short submenu", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  const { trigger } = await setup(page, 1);
  await trigger.click();
  await page.setViewportSize({ width: 390, height: 140 });
  const libraryTrigger = page.getByRole("button", { name: "라이브러리 이동", exact: true });
  await libraryTrigger.hover();
  const submenu = page.locator("[data-archive-popover]").filter({ has: page.getByRole("button", { name: "검증 라이브러리 01", exact: true }) });
  const menu = page.locator("[data-archive-popover]").filter({ has: page.getByRole("button", { name: "편집", exact: true }) });
  await bounded(submenu, page);
  const before = await submenu.boundingBox();
  await menu.evaluate(el => { el.scrollTop += 24; });
  await expect.poll(async () => (await submenu.boundingBox())!.y).toBeLessThan(before!.y);
  await bounded(submenu, page);
  const anchor = await libraryTrigger.boundingBox();
  const after = await submenu.boundingBox();
  expect(Math.abs(after!.y - anchor!.y)).toBeLessThanOrEqual(1);
});
