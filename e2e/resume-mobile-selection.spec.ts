import { expect, test } from "@playwright/test";
import { API_ORIGIN } from "./fixtures/api-origin";
import { resumeDetail } from "./fixtures/api-data";
import { stubApi } from "./fixtures/stub-api";

for (const width of [390, 1440]) {
  test(`FRT-153 panel selection at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/export/resume/resume-e2e-1");
    const group = page.getByRole("group", { name: "이력서 보기 선택" });
    const editor = page.getByRole("complementary", { name: "이력서 편집", includeHidden: true });
    const preview = page.getByRole("main", { name: "이력서 미리보기", includeHidden: true });
    await expect(editor).toBeVisible();
    if (width === 1440) {
      await expect(group).toBeHidden();
      await expect(preview).toBeVisible();
      await page.screenshot({ path: "e2e/preview/out/frt153-desktop.png", fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await expect(group).toBeVisible();
    const editButton = group.getByRole("button", { name: "편집", exact: true });
    const previewButton = group.getByRole("button", { name: "미리보기", exact: true });
    await expect(editButton).toHaveAttribute("aria-pressed", "true");
    await expect(previewButton).toHaveAttribute("aria-pressed", "false");
    await expect(preview).toBeHidden();
    await expect(editButton).toHaveAttribute("aria-controls", (await editor.getAttribute("id"))!);
    await expect(previewButton).toHaveAttribute("aria-controls", (await preview.getAttribute("id"))!);
    expect(await editor.getAttribute("id")).not.toBe(await preview.getAttribute("id"));
    await page.screenshot({ path: `e2e/preview/out/frt153-mobile-editor-${width}.png`, fullPage: true });
    await editButton.focus();
    await page.keyboard.press("Tab");
    await expect(previewButton).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(previewButton).toHaveAttribute("aria-pressed", "true");
    await expect(editButton).toHaveAttribute("aria-pressed", "false");
    await expect(preview).toBeVisible();
    await expect(editor).toBeHidden();
    await page.screenshot({ path: `e2e/preview/out/frt153-mobile-preview-${width}.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(group).toBeHidden();
    await expect(editor).toBeVisible();
    await expect(preview).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(previewButton).toHaveAttribute("aria-pressed", "true");
    await expect(editor).toBeHidden();
    await previewButton.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(editButton).toBeFocused();
    await page.keyboard.press("Space");
    await expect(editButton).toHaveAttribute("aria-pressed", "true");
    await expect(previewButton).toHaveAttribute("aria-pressed", "false");
    await expect(editor).toBeVisible();
    await expect(preview).toBeHidden();
    await page.keyboard.press("Space");
    await expect(editButton).toHaveAttribute("aria-pressed", "true");
  });

  test(`FRT-153 English read-only at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await stubApi(page, { authed: true, scenario: "data" });
    await page.route(`${API_ORIGIN}/export/resume/resume-e2e-1`, async (route) => {
      const body = structuredClone(resumeDetail());
      body.data.meta.language = "en";
      await route.fulfill({ json: body });
    });
    await page.goto("/export/resume/resume-e2e-1");
    await expect(page.getByText("영문 이력서는 아직 편집할 수 없어요")).toBeVisible();
    await expect(page.getByRole("group", { name: "이력서 보기 선택" })).toBeHidden();
    await expect(page.getByRole("complementary", { name: "이력서 편집", includeHidden: true })).toHaveCount(0);
    await expect(page.getByRole("main", { name: "이력서 미리보기" })).toBeVisible();
  });
}
