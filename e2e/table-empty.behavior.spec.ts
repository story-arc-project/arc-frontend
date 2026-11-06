import { expect, test, type Page } from "@playwright/test";
import { stubApi } from "./fixtures/stub-api";

async function expectDetailFits(page: Page) {
  // Wait for both the mobile panel slide and record transition to finish before measuring.
  const detail = page.getByRole("heading", { level: 2, name: "FRT-184 표 판정 검증" });
  await expect.poll(() => detail.evaluate(el => document.getAnimations().filter(a => {
    const target = a.effect instanceof KeyframeEffect ? a.effect.target : null;
    return a.playState === "running" && target instanceof Element && target.contains(el);
  }).length)).toBe(0);
  const bounds = await detail.evaluate(el => {
    const root = el.closest('[class*="max-w-"]') as HTMLElement;
    const panel = root.parentElement!;
    const box = root.getBoundingClientRect();
    return { left: box.left, right: box.right, viewport: innerWidth, scroll: panel.scrollWidth, width: panel.clientWidth };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewport + 1);
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.width + 1);
  for (const name of ["수정", "복제", "삭제"]) {
    const box = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(bounds.viewport + 1);
  }
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test.describe(`FRT-184 custom table ${viewport.width}px`, () => {
    test.use({ viewport });
    test("empty rows stay editable and saved, while detail shows only filled tables", async ({ page }, testInfo) => {
      const stub = await stubApi(page, { authed: true, scenario: "data" });
      await page.goto("/archive/new");
      await page.getByRole("button", { name: "대외활동", exact: true }).click();
      await page.getByRole("textbox", { name: "경험명" }).fill("FRT-184 표 판정 검증");
      await page.getByRole("button", { name: "블록 추가", exact: true }).last().click();
      const sectionName = page.getByLabel("섹션 이름");
      await sectionName.fill("표 회귀 검증 섹션");
      const section = page.locator("section").filter({ has: sectionName });
      await section.getByRole("button", { name: "블록 추가", exact: true }).click();
      await page.getByRole("listbox").getByRole("option", { name: "표 (그리드)", exact: true }).click();
      const modal = page.getByRole("dialog", { name: "블록 설정" });
      await modal.getByPlaceholder("블록 이름을 입력하세요").fill("검증용 표");
      await modal.getByRole("button", { name: "확인", exact: true }).click();
      await section.getByPlaceholder("첫 번째 열 이름...").fill("내용");
      await section.getByRole("button", { name: "열 추가", exact: true }).click();
      await section.getByRole("button", { name: "행 추가", exact: true }).click();
      const cell = section.locator("tbody input").first();
      await cell.fill("   ");
      await expect(section.locator("tbody tr")).toHaveCount(1);
      await page.screenshot({ path: testInfo.outputPath("empty-editor.jpg"), fullPage: true, animations: "disabled" });
      await page.getByRole("button", { name: "완료", exact: true }).click();
      await page.waitForURL(/\/archive\?id=/);
      await expect(page.getByRole("heading", { level: 2, name: "FRT-184 표 판정 검증" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 3, name: "표 회귀 검증 섹션" })).toHaveCount(0);
      const create = stub.mutations.find(m => m.method === "POST" && m.path === "/experiences/");
      expect(JSON.stringify(create?.body)).toContain('"rows":[["   "]]');
      await expectDetailFits(page);
      await page.screenshot({ path: testInfo.outputPath("empty-detail.jpg"), fullPage: true, animations: "disabled" });
      await page.getByRole("button", { name: "수정", exact: true }).click();
      await page.waitForURL(/\/archive\/.+\/edit/);
      const editSection = page.locator("section").filter({ has: page.getByLabel("섹션 이름") });
      const restored = editSection.locator("tbody input").first();
      await expect(restored).toHaveValue("   ");
      await restored.fill("입력한 내용은 유지됩니다");
      await page.getByRole("button", { name: "완료", exact: true }).click();
      await page.waitForURL(/\/archive\?id=/);
      await expect(page.getByRole("heading", { level: 3, name: "표 회귀 검증 섹션" })).toBeVisible();
      await expect(page.getByRole("cell", { name: "입력한 내용은 유지됩니다", exact: true })).toBeVisible();
      await expectDetailFits(page);
      await page.screenshot({ path: testInfo.outputPath("filled-detail.jpg"), fullPage: true, animations: "disabled" });
      // A long unbroken value and several columns must scroll inside the table, not widen the detail.
      await page.getByRole("button", { name: "수정", exact: true }).click();
      await page.waitForURL(/\/archive\/.+\/edit/);
      const wideSection = page.locator("section").filter({ has: page.getByLabel("섹션 이름") });
      await wideSection.locator("tbody input").first().fill("LongTableValue".repeat(24));
      for (const column of ["두 번째 열", "세 번째 열", "네 번째 열"]) {
        await wideSection.getByPlaceholder("열 추가...", { exact: true }).fill(column);
        await wideSection.getByRole("button", { name: "열 추가", exact: true }).click();
      }
      await page.getByRole("button", { name: "완료", exact: true }).click();
      await page.waitForURL(/\/archive\?id=/);
      await expect(page.getByRole("cell", { name: "LongTableValue".repeat(24), exact: true })).toBeVisible();
      await expectDetailFits(page);
      const table = page.getByRole("table");
      const scroller = table.locator("..");
      const scroll = await scroller.evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth }));
      expect(scroll.scrollWidth).toBeGreaterThan(scroll.width);
      await page.screenshot({ path: testInfo.outputPath("wide-detail.jpg"), fullPage: true, animations: "disabled" });
      await scroller.evaluate(el => { el.scrollLeft = el.scrollWidth; });
      const lastColumn = await page.getByRole("columnheader", { name: "네 번째 열" }).boundingBox();
      const scrollBox = await scroller.boundingBox();
      expect(lastColumn!.x).toBeGreaterThanOrEqual(scrollBox!.x - 1);
      expect(lastColumn!.x + lastColumn!.width).toBeLessThanOrEqual(scrollBox!.x + scrollBox!.width + 1);
      await expectDetailFits(page);
      await page.screenshot({ path: testInfo.outputPath("wide-detail-scrolled.jpg"), fullPage: true, animations: "disabled" });
    });
  });
}
