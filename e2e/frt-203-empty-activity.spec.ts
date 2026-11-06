import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { expect, test, type Page } from "@playwright/test";
import type { Activity } from "../types/resume";
import { resumeDetail } from "./fixtures/api-data";
import { stubApi, STUB_API_URL } from "./fixtures/stub-api";

const routePath = "/export/resume/resume-e2e-1";
const activity = (id: number, patch: Partial<Activity> = {}): Activity => ({
  id, 활동명: null, 기관: null, 역할: null, 기간_시작: null,
  기간_종료: null, 기간_원문: null, 진행중: false, 활동내용: [], 성과: [], ...patch,
});
const unfinished = [
  activity(801, { 진행중: true }),
  activity(802, { 기간_시작: "1999-01", 기간_종료: "1999-02", 기간_원문: "1999년 기간만" }),
  activity(803, { 활동명: "  ", 기관: "\t", 역할: "\n", 활동내용: ["  "], 성과: ["\t"], 진행중: true }),
];

async function openResume(page: Page, mixed: boolean, width: number) {
  await stubApi(page, { authed: true, scenario: "data" });
  const response = structuredClone(resumeDetail());
  response.data.대외활동 = mixed ? [
    ...unfinished,
    activity(804, { 기관: "기관만 입력한 활동" }),
    activity(805, { 활동명: "현재 진행하는 활동", 기간_시작: "2024-03", 진행중: true, 활동내용: ["실제 활동 내용"], 성과: ["유지할 성과"] }),
  ] : unfinished;
  await page.route(`${STUB_API_URL}/export/resume/resume-e2e-1`, route => route.fulfill({ json: response, headers: { "access-control-allow-origin": route.request().headers().origin ?? "", "access-control-allow-credentials": "true" } }));
  await page.goto(routePath);
  await expect(page.getByRole("button", { name: /^대외활동 \d+$/ })).toBeVisible();
  // Hidden output rows must remain available in the existing editor.
  await page.getByRole("button", { name: /^대외활동 \d+$/ }).click();
  await expect(page.getByRole("checkbox", { name: "진행 중", exact: true })).toHaveCount(mixed ? 5 : 3);
  await expect(page.getByRole("checkbox", { name: "진행 중", exact: true }).first()).toBeChecked();
  if (width < 768) await page.getByRole("button", { name: "미리보기", exact: true }).click();
  return page.locator("article.resume-preview");
}

async function wordXml(page: Page) {
  await page.locator("header").getByRole("button", { name: "내보내기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "내보내기 형식 선택" });
  const pending = page.waitForEvent("download");
  await dialog.getByRole("button", { name: /^Word/ }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
  const zip = await JSZip.loadAsync(await readFile((await download.path())!));
  return zip.file("word/document.xml")!.async("string");
}

for (const width of [1440, 390]) {
  test.describe(`FRT-203 activity output ${width}px`, () => {
    test.use({ viewport: { width, height: width === 1440 ? 1000 : 844 } });
    for (const mixed of [false, true]) {
      test(`${mixed ? "partial and ongoing content stays" : "unfinished activities hide"} in preview and Word`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        const preview = await openResume(page, mixed, width);
        await expect(preview).toBeVisible();
        const section = preview.locator("section").filter({ has: page.getByRole("heading", { name: "대외활동", exact: true }) });
        await expect(section).toHaveCount(mixed ? 1 : 0);
        await expect(preview.getByText(/1999/)).toHaveCount(0);
        if (mixed) {
          await expect(section.getByText("기관만 입력한 활동", { exact: true })).toBeVisible();
          await expect(section.getByText("현재 진행하는 활동", { exact: true })).toBeVisible();
          await expect(section.getByText("실제 활동 내용", { exact: true })).toBeVisible();
          await expect(section.getByText("유지할 성과", { exact: true })).toBeVisible();
          await expect(section.getByText(/현재/, { exact: false })).toHaveCount(2);
          await expect(section.locator(":scope > div > div")).toHaveCount(2);
        } else {
          await expect(preview.getByText("현재", { exact: true })).toHaveCount(0);
        }
        await page.screenshot({ path: testInfo.outputPath(`${mixed ? "mixed" : "empty"}-${width}.jpg`), type: "jpeg", quality: 70, animations: "disabled", fullPage: true });
        const xml = await wordXml(page);
        expect(xml).not.toContain("1999");
        expect(xml.includes("대외활동")).toBe(mixed);
        expect(xml.includes("기관만 입력한 활동")).toBe(mixed);
        expect(xml.includes("현재 진행하는 활동")).toBe(mixed);
        expect(xml.includes("유지할 성과")).toBe(mixed);
        expect(xml.match(/현재/g) ?? []).toHaveLength(mixed ? 2 : 0);
        expect(errors).toEqual([]);
      });
    }
  });
}
