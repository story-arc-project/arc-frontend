import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { API_ORIGIN } from "./fixtures/api-origin";
import { corsHeaders, stubApi } from "./fixtures/stub-api";
import type { Block } from "../types/archive";

const label = "주요 활동 / 이벤트";
const outcome: Block = {
  id: "frt283-outcomes", type: "repeatable-cell", label, variant: "outcome-list",
  value: { type: "repeatable-cell", columns: [{ key: "item", label: "활동", blockType: "text" }],
    rows: [{ id: "first", cells: { item: "첫 활동" } }, { id: "second", cells: { item: "둘째 활동" } }] },
};

for (const width of [1440, 390]) {
  test(`FRT-283 목록 입력 이름·포커스·행 변경 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await stubApi(page, { authed: true });
    await page.route(`${API_ORIGIN}/experiences/exp-e2e-2`, async route => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({ headers: corsHeaders(route.request().headers()["origin"] ?? "http://localhost:3000"), json: {
        status: "success", data: {
          id: "exp-e2e-2", user_id: "e2e-user", type: "team-project", importance: 3,
          created_at: "2026-02-20T09:00:00Z", updated_at: "2026-02-20T09:00:00Z",
          content: { title: "목록 입력 접근성 확인", summary: "FRT-283 mock", status: "draft", tags: [],
            coreBlocks: [], extensionBlocks: [], customBlocks: [outcome] },
        },
      } });
    });
    await page.goto("/archive/exp-e2e-2/edit");
    const input = (row: number) => page.getByRole("textbox", { name: `${label} ${row}행`, exact: true });
    await expect(input(1)).toHaveValue("첫 활동");
    await expect(input(2)).toHaveValue("둘째 활동");
    await input(1).focus();
    await page.keyboard.press("End");
    await page.keyboard.type(" 수정");
    await expect(input(1)).toHaveValue("첫 활동 수정");
    await page.keyboard.press("Enter");
    await expect(input(2)).toBeFocused();
    await expect(input(3)).toHaveValue("둘째 활동");
    await page.keyboard.press("Backspace");
    await expect(input(1)).toBeFocused();
    await expect(input(2)).toHaveValue("둘째 활동");
    const block = input(1).locator("xpath=ancestor::div[@data-row-id]/../..");
    const screenshot = await block.screenshot({ animations: "disabled" });
    const names = await block.ariaSnapshot();
    await testInfo.attach(`outcomes-${width}`, { body: screenshot, contentType: "image/png" });
    await testInfo.attach(`accessible-names-${width}`, { body: names, contentType: "text/plain" });
    if (process.env.FRT283_CAPTURE) {
      await mkdir("/private/tmp/frt283-preview", { recursive: true });
      await writeFile(`/private/tmp/frt283-preview/outcomes-${width}.png`, screenshot);
      await writeFile(`/private/tmp/frt283-preview/names-${width}.txt`, names);
    }
    await block.getByRole("button", { name: "첫 활동 수정 삭제", exact: true }).click();
    await expect(input(1)).toHaveValue("둘째 활동");
    await expect(input(2)).toHaveCount(0);
    await block.getByRole("button", { name: "활동 추가", exact: true }).click();
    await expect(input(2)).toBeFocused();
    await input(2).fill("새 활동");
    await expect(input(1)).toHaveValue("둘째 활동");
    await expect(input(2)).toHaveValue("새 활동");
  });
}
