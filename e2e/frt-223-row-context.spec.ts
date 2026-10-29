import { expect, test } from "@playwright/test";
import { corsHeaders, stubApi } from "./fixtures/stub-api";
import { API_ORIGIN } from "./fixtures/api-origin";
import { writeFile } from "node:fs/promises";
import type { Block, BlockColumnDef } from "../types/archive";

const columns: BlockColumnDef[] = [
  { key: "name", label: "기록명", blockType: "text" },
  { key: "notes", label: "설명", blockType: "textarea" },
  { key: "date", label: "일자", blockType: "date" },
  { key: "period", label: "기간", blockType: "period" },
  { key: "link", label: "링크", blockType: "link" },
  { key: "tags", label: "태그", blockType: "tags" },
  { key: "checks", label: "분야", blockType: "checklist", options: ["기획", "개발"] },
  { key: "select", label: "상태", blockType: "single-select", options: ["완료", "진행"] },
  { key: "file", label: "첨부", blockType: "file" },
];
const block: Block = {
  id: "frt223-records", type: "repeatable-cell", label: "행 맥락 검증", lockColumns: true,
  value: { type: "repeatable-cell", columns, rows: [
    { id: "row-a", cells: { name: "첫 기록", period: "2023.03 ~ 2023.12" } },
    { id: "row-b", cells: { name: "둘째 기록", period: "2024.01 ~ 현재" } },
  ] },
};

for (const width of [1440, 390]) {
  test(`FRT-223 반복 기록 이름과 행 삭제 후 번호 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await stubApi(page, { authed: true });
    await page.route(`${API_ORIGIN}/experiences/exp-e2e-2`, async route => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({ headers: corsHeaders(route.request().headers()["origin"] ?? "http://localhost:3000"), json: { status: "success", data: {
        id: "exp-e2e-2", user_id: "e2e-user", type: "team-project", importance: 3,
        created_at: "2026-02-20T09:00:00Z", updated_at: "2026-02-20T09:00:00Z",
        content: { title: "행 맥락 확인", summary: "접근성 검증", status: "draft", tags: [],
          coreBlocks: [], extensionBlocks: [], customBlocks: [block] },
      } } });
    });
    await page.goto("/archive/exp-e2e-2/edit");
    const first = page.locator('[data-row-id="row-a"]');
    const second = page.locator('[data-row-id="row-b"]');
    await expect(first.getByLabel("1번째 기록 기록명", { exact: true })).toHaveValue("첫 기록");
    await expect(second.getByLabel("2번째 기록 기록명", { exact: true })).toHaveValue("둘째 기록");
    for (const [row, number] of [[first, 1], [second, 2]] as const) {
      for (const label of ["설명", "일자", "링크", "태그", "상태", "기간 시작", "기간 종료", "기간 현재"]) {
        await expect(row.getByLabel(`${number}번째 기록 ${label}`, { exact: true })).toHaveCount(1);
      }
      await expect(row.getByRole("checkbox", { name: `${number}번째 기록 분야 기획`, exact: true })).toHaveCount(1);
      await expect(row.getByLabel(`${number}번째 기록 첨부`, { exact: true })).toHaveCount(1);
    }
    await second.getByLabel("2번째 기록 기록명", { exact: true }).scrollIntoViewIfNeeded();
    await testInfo.attach(`row-context-${width}`, { body: await first.locator("..").screenshot({ style: "[class*=fixed] { visibility: hidden !important; }", animations: "disabled" }), contentType: "image/png" });
    const accessibility = await first.locator("..").ariaSnapshot();
    await testInfo.attach(`accessible-names-${width}`, { body: accessibility, contentType: "text/plain" });
    if (process.env.FRT223_CAPTURE) {
      await first.locator("..").screenshot({ path: `/private/tmp/frt223-preview/records-${width}.jpg`, type: "jpeg", quality: 65, style: "[class*=fixed] { visibility: hidden !important; }", animations: "disabled" });
      await writeFile(`/private/tmp/frt223-preview/names-${width}.txt`, accessibility);
    }
    await first.getByRole("button", { name: "1번째 기록 행 삭제", exact: true }).click();
    await expect(second.getByLabel("1번째 기록 기록명", { exact: true })).toHaveValue("둘째 기록");
    await expect(second.getByLabel("1번째 기록 기간 현재", { exact: true })).toBeChecked();
    await second.locator("..").getByRole("button", { name: "행 추가", exact: true }).click();
    await expect(second.locator("..").getByLabel("2번째 기록 기록명", { exact: true })).toHaveValue("");
  });
}
