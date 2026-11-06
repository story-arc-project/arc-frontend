import { expect, test } from "@playwright/test";

import { STUB_API_URL, stubApi } from "./fixtures/stub-api";

// Real archive readOnly route with synthetic data; no backend/file permission proof.
for (const width of [1440, 390]) {
  test(`FRT-202 legacy attachments in archive detail ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await stubApi(page, { authed: true, scenario: "data" });
    const file = (key: string, fileName: string, url?: string, mimeType?: string) => ({
      entryType: "field", key: `custom.${key}`, type: "file", label: key,
      value: { type: "file", fileName, url, mimeType, description: "레거시 첨부 확인", evidenceType: "증빙 자료" },
    });
    const experience = {
      id: "frt202", user_id: "e2e", type: "club", importance: null,
      content: {
        schema_version: 2, template_version: 9,
        title: "레거시 첨부 열람", summary: "FRT-202 synthetic API mock", status: "draft", tags: [], fields: {},
        custom: [
          file("PDF 첨부", "성적표.pdf", "https://files.example/%EC%84%B1%EC%A0%81%ED%91%9C.pdf?token=synthetic", "application/pdf"),
          file("종류 없는 첨부", "발표.pdf", "https://files.example/legacy.pdf"),
          file("이름만 있는 첨부", "데모 증빙.txt"),
          file("차단되는 첨부", "안전하지 않은 파일.pdf", "javascript:alert(1)", "application/pdf"),
          file("URL만 있는 첨부", "", "https://files.example/unnamed"),
        ],
      }, created_at: "2026-10-25T00:00:00Z", updated_at: "2026-10-25T00:00:00Z",
    };
    await page.route(`${STUB_API_URL}/experiences/`, route => route.fulfill({ json: {
      status: "success", message: "ok", data: { count: 1, contents: [experience] },
    } }));
    let fileRequests = 0;
    page.on("request", request => { if (request.url().includes("/files/")) fileRequests += 1; });
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto("/archive?id=frt202");
    await expect(page.getByRole("heading", { level: 2, name: "레거시 첨부 열람" })).toBeVisible();
    const pdf = page.getByRole("link", { name: "성적표.pdf 열기", exact: true }).filter({ visible: true });
    await expect(pdf).toHaveAttribute("href", "https://files.example/%EC%84%B1%EC%A0%81%ED%91%9C.pdf?token=synthetic");
    await expect(pdf).toHaveAttribute("target", "_blank");
    await expect(pdf).toHaveAttribute("rel", /noopener/);
    await expect(page.getByRole("link", { name: "발표.pdf 다운로드", exact: true }).filter({ visible: true })).toHaveAttribute("href", "https://files.example/legacy.pdf");
    await expect(page.getByRole("link", { name: /데모 증빙|안전하지 않은/ })).toHaveCount(0);
    await expect(page.getByText("데모 증빙.txt", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText("안전하지 않은 파일.pdf", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.locator('a[href="https://files.example/unnamed"]').filter({ visible: true })).toBeVisible();
    const attachment = pdf.locator("xpath=../../..");
    await pdf.scrollIntoViewIfNeeded();
    const metrics = await attachment.evaluate(el => ({
      left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right,
      viewport: innerWidth, scroll: el.scrollWidth, client: el.clientWidth,
    }));
    expect(metrics.left).toBeGreaterThanOrEqual(0);
    expect(metrics.right).toBeLessThanOrEqual(metrics.viewport);
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.client);
    expect(fileRequests).toBe(0);
    expect(pageErrors).toEqual([]);
    await page.getByRole("heading", { level: 2, name: "레거시 첨부 열람" }).locator("xpath=../../..").screenshot({ path: testInfo.outputPath(`detail-${width}.jpg`), type: "jpeg", quality: 65 });
    await attachment.screenshot({ path: testInfo.outputPath(`legacy-${width}.jpg`), type: "jpeg", quality: 70 });
  });
}
