import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

import { success } from "./fixtures/api-data";
import { corsHeaders, STUB_API_URL, stubApi } from "./fixtures/stub-api";

for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
  for (const name of ["프로젝트 모음", "아주 긴 이름으로 여러 프로젝트와 커리어 경험을 모아 두었던 라이브러리" ]) {
    test(`FRT-175 ${viewport.name}: confirms deletion of ${name}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await stubApi(page, { authed: true });
      let deleted = false;
      const deletes: string[] = [];
      await page.route(`${STUB_API_URL}/libraries/**`, async route => {
        const request = route.request();
        const method = request.method();
        const path = new URL(request.url()).pathname;
        const headers = corsHeaders(new URL(page.url()).origin);
        if (method === "OPTIONS") return route.fulfill({ status: 204, headers: {
          ...headers, "access-control-allow-methods": "GET,DELETE,OPTIONS",
          "access-control-allow-headers": "content-type,authorization,idempotency-key",
        } });
        if (path === "/libraries/" && method === "GET") {
          const custom = deleted ? [] : [{ id: "lib-confirm", name, is_system: false, filter: null }];
          return route.fulfill({ json: success({ count: custom.length, contents: { system: [], custom } }), headers });
        }
        if (path === "/libraries/lib-confirm" && method === "DELETE") {
          deletes.push(path);
          deleted = true;
          return route.fulfill({ json: success({}), headers });
        }
        if (method === "GET") return route.fulfill({ json: success({ count: 0, contents: [] }), headers });
        throw new Error(`Unexpected mock request ${method} ${path}`);
      });
      await page.goto("/archive");
      const trigger = page.getByRole("button", { name: "전체", exact: true }).filter({ visible: true });
      await trigger.click();
      const row = page.getByRole("listitem").filter({ hasText: name });
      await row.getByRole("button", { name: "삭제", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "라이브러리 삭제" });
      await expect(dialog.getByText(name, { exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "취소" })).toBeFocused();
      await expect(page.locator("[data-archive-popover]")).toHaveCount(0);
      expect(deletes).toEqual([]);
      const screenshot = await page.screenshot({ animations: "disabled", fullPage: true });
      await testInfo.attach("library deletion confirmation", { body: screenshot, contentType: "image/png" });
      const gallery = testInfo.outputPath("confirmation-gallery.html");
      await writeFile(gallery, `<!doctype html><html lang="ko"><meta charset="utf-8"><title>FRT-175 ${viewport.name}</title><style>body{font:16px system-ui;margin:24px}img{max-width:100%;border:1px solid #ddd}</style><h1>라이브러리 삭제 확인 · ${viewport.name}</h1><p>실제 계정 데이터 없이 API 스텁으로 확인한 화면입니다.</p><img alt="라이브러리 삭제 확인 화면" src="data:image/png;base64,${screenshot.toString("base64")}"></html>`);
      await testInfo.attach("standalone confirmation gallery", { path: gallery, contentType: "text/html" });
      // The dropdown lives in responsive wrappers; the modal must survive a
      // breakpoint change without becoming hidden while retaining its focus trap.
      await page.setViewportSize({ width: viewport.name === "desktop" ? 390 : 1440, height: 900 });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: "취소" })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      expect(deletes).toEqual([]);
      await trigger.click();
      await row.getByRole("button", { name: "삭제", exact: true }).click();
      await dialog.getByRole("button", { name: "삭제", exact: true }).click();
      await expect.poll(() => deletes).toEqual(["/libraries/lib-confirm"]);
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await trigger.click();
      await expect(row).toHaveCount(0);
    });
  }
}
