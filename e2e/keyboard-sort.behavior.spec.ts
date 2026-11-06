import { expect, test, type Page } from "@playwright/test";
import { stubApi } from "./fixtures/stub-api";

async function addText(page: Page, label: string) {
  const section = page.locator("section").filter({ has: page.getByLabel("섹션 이름") });
  await section.getByRole("button", { name: "블록 추가", exact: true }).click();
  await page.getByRole("option", { name: "텍스트 (짧은)", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "블록 설정" });
  await modal.getByPlaceholder("블록 이름을 입력하세요").fill(label);
  await modal.getByRole("button", { name: "확인", exact: true }).click();
  await page.getByRole("textbox", { name: label, exact: true }).fill(label);
}

for (const width of [1440, 390]) {
  test(`archive keyboard order, cancel and mock save (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const stub = await stubApi(page, { authed: true });
    await page.goto("/archive/new");
    await page.getByRole("button", { name: "대외활동", exact: true }).click();
    await page.getByRole("textbox", { name: "경험명" }).fill("키보드 정렬 검증");
    await page.getByRole("button", { name: "블록 추가", exact: true }).last().click();
    await page.getByLabel("섹션 이름").fill("키보드 섹션");
    await addText(page, "첫째 메모");
    await addText(page, "둘째 메모");
    const section = page.locator("section").filter({ has: page.getByLabel("섹션 이름") });
    const handles = section.getByRole("button", { name: "드래그하여 순서 변경" });
    await handles.first().focus();
    await page.keyboard.press("Space", { delay: 150 });
    await expect(handles.and(page.locator('[aria-pressed="true"]'))).toHaveCount(1);
    await page.keyboard.press("ArrowDown", { delay: 150 });
    await expect(page.getByRole("status")).toContainText("2번째 위치");
    await page.keyboard.press("Space", { delay: 150 });
    await expect(section.getByRole("textbox").nth(1)).toHaveValue("둘째 메모");
    await expect(handles.nth(1)).toBeFocused();
    await page.keyboard.press("Enter", { delay: 150 });
    await expect(handles.and(page.locator('[aria-pressed="true"]'))).toHaveCount(1);
    await page.keyboard.press("ArrowUp", { delay: 150 });
    await expect(page.getByRole("status")).toContainText("1번째 위치");
    await page.keyboard.press("Escape", { delay: 150 });
    await expect(section.getByRole("textbox").nth(1)).toHaveValue("둘째 메모");
    await section.screenshot({ path: `e2e/preview/out/keyboard-archive-${width}.jpg` });
    await page.getByRole("button", { name: "완료", exact: true }).click();
    await page.waitForURL(/\/archive\?id=/);
    const creates = stub.mutations.filter(m => m.method === "POST" && m.path === "/experiences/");
    expect(creates).toHaveLength(1);
    expect(creates[0].body).toMatchObject({ content: { custom: [{ label: "키보드 섹션", children: [{ label: "둘째 메모" }, { label: "첫째 메모" }] }] } });
  });

  test(`resume keyboard order, cancel and mock save (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const stub = await stubApi(page, { authed: true });
    await page.goto("/export/resume/resume-e2e-1");
    await page.getByRole("button", { name: "동아리 · 학회", exact: true }).click();
    for (const name of ["첫째 모임", "둘째 모임"]) {
      await page.getByRole("button", { name: "동아리·학회 추가" }).click();
      // The newly appended card contains its own organization-name field.
      const card = page.getByRole("button", { name: "순서 변경", exact: true }).last().locator('..');
      await card.locator('input').first().fill(name);
    }
    const handles = page.getByRole("button", { name: "순서 변경", exact: true });
    await handles.first().focus();
    await page.keyboard.press("Enter", { delay: 150 });
    await expect(handles.and(page.locator('[aria-pressed="true"]'))).toHaveCount(1);
    await page.keyboard.press("ArrowDown", { delay: 150 });
    await expect(page.getByRole("status")).toContainText("2번째 위치");
    await page.keyboard.press("Enter", { delay: 150 });
    await expect(handles.last()).toBeFocused();
    await page.keyboard.press("Space", { delay: 150 });
    await expect(handles.and(page.locator('[aria-pressed="true"]'))).toHaveCount(1);
    await page.keyboard.press("ArrowUp", { delay: 150 });
    await expect(page.getByRole("status")).toContainText("1번째 위치");
    await page.keyboard.press("Escape", { delay: 150 });
    await page.screenshot({ path: `e2e/preview/out/keyboard-resume-${width}.jpg`, fullPage: true });
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("저장됐어요")).toBeVisible();
    const patch = stub.mutations.find(m => m.method === "PATCH" && m.path.includes("/export/resume/"));
    expect(patch?.body).toMatchObject({ result: { 동아리_학회: [{ 단체명: "둘째 모임" }, { 단체명: "첫째 모임" }] } });
  });
}
