import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { API_ORIGIN } from "./fixtures/api-origin";
import { corsHeaders, stubApi } from "./fixtures/stub-api";
import type { Block } from "../types/archive";

const label = "활동 비교표";
const table: Block = {
  id: "frt275-table", type: "table", label,
  value: { type: "table", columns: ["활동", "결과"], rows: [["첫 활동", "첫 결과"], ["둘째 활동", "둘째 결과"]] },
};

for (const width of [1440, 390]) {
  test(`FRT-275 표 셀 이름·키보드·행열 변경 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await stubApi(page, { authed: true });
    await page.route(`${API_ORIGIN}/experiences/exp-e2e-2`, async route => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({ headers: corsHeaders(route.request().headers()["origin"] ?? "http://localhost:3000"), json: {
        status: "success", data: {
          id: "exp-e2e-2", user_id: "e2e-user", type: "team-project", importance: 3,
          created_at: "2026-02-20T09:00:00Z", updated_at: "2026-02-20T09:00:00Z",
          content: { title: "표 입력 접근성 확인", summary: "FRT-275 mock", status: "draft", tags: [],
            coreBlocks: [], extensionBlocks: [], customBlocks: [table] },
        },
      } });
    });
    await page.goto("/archive/exp-e2e-2/edit");
    const cell = (row: number, column: number, name: string) => page.getByRole("textbox", {
      name: `${label} ${row}행 ${column}열 ${name}`, exact: true,
    });
    const first = cell(1, 1, "활동");
    await expect(first).toHaveValue("첫 활동");
    await expect(cell(2, 1, "활동")).toHaveValue("둘째 활동");
    await expect(cell(2, 2, "결과")).toHaveValue("둘째 결과");
    await first.focus();
    await page.keyboard.press("End");
    await page.keyboard.type(" 수정");
    await expect(first).toHaveValue("첫 활동 수정");
    await page.keyboard.press("Tab");
    await expect(cell(1, 2, "결과")).toBeFocused();

    const block = first.locator("xpath=ancestor::table/../..");
    const screenshot = await block.screenshot({ animations: "disabled", style: "[class*=fixed] { visibility: hidden !important; }" });
    const names = await block.ariaSnapshot();
    await testInfo.attach(`table-${width}`, { body: screenshot, contentType: "image/png" });
    await testInfo.attach(`accessible-names-${width}`, { body: names, contentType: "text/plain" });
    if (process.env.FRT275_CAPTURE) {
      await mkdir("/private/tmp/frt275-preview", { recursive: true });
      await writeFile(`/private/tmp/frt275-preview/table-${width}.png`, screenshot);
      await writeFile(`/private/tmp/frt275-preview/names-${width}.txt`, names);
    }

    await first.locator("xpath=ancestor::tr").getByRole("button", { name: "행 삭제", exact: true }).click();
    await expect(cell(1, 1, "활동")).toHaveValue("둘째 활동");
    await expect(cell(1, 2, "결과")).toHaveValue("둘째 결과");
    await expect(cell(2, 1, "활동")).toHaveCount(0);
    await block.getByRole("button", { name: "행 추가", exact: true }).click();
    await expect(cell(2, 1, "활동")).toHaveValue("");
    await block.getByPlaceholder("열 추가...", { exact: true }).fill("비고");
    await block.getByPlaceholder("열 추가...", { exact: true }).press("Enter");
    await expect(cell(1, 3, "비고")).toHaveValue("");
    await expect(cell(2, 3, "비고")).toHaveValue("");
    await expect(cell(1, 1, "활동")).toHaveValue("둘째 활동");
    await expect(cell(1, 2, "결과")).toHaveValue("둘째 결과");
  });
}
