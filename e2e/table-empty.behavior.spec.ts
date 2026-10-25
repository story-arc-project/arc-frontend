import { expect, test } from "@playwright/test";
import { stubApi } from "./fixtures/stub-api";

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
      await page.screenshot({ path: testInfo.outputPath("filled-detail.jpg"), fullPage: true, animations: "disabled" });
    });
  });
}
