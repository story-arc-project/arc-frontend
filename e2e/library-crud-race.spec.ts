import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

import { experienceList, success } from "./fixtures/api-data";
import { corsHeaders, STUB_API_URL, stubApi } from "./fixtures/stub-api";

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

// Every request is intercepted: these delete scenarios never touch user data.
for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
  for (const action of ["create", "update", "delete"] as const) {
    test(`FRT-251 ${viewport.name}: ${action} survives overlapping membership recovery`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await stubApi(page, { authed: true });
      const write = gate();
      const refresh = gate();
      let membershipRequested = false;
      let crudAcknowledged = false;
      let recoveryRead = false;
      let custom = [
        { id: "lib-stable", name: "경험 보존", color: "#5E6AD2", is_system: false, filter: null },
        { id: "lib-target", name: "변경 대상", color: "#22C55E", is_system: false, filter: null },
      ];
      const experiences = experienceList("data").data.contents;
      await page.route(`${STUB_API_URL}/libraries/**`, async (route) => {
        const request = route.request();
        const method = request.method();
        const path = new URL(request.url()).pathname;
        const headers = corsHeaders(new URL(page.url()).origin);
        if (method === "OPTIONS") return route.fulfill({ status: 204, headers: { ...headers,
          "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
          "access-control-allow-headers": "content-type,authorization,idempotency-key" } });
        if (path === "/libraries/" && method === "GET") {
          const snapshot = structuredClone(custom);
          if (crudAcknowledged) await refresh.promise;
          return route.fulfill({ json: success({ count: snapshot.length, contents: { system: [], custom: snapshot } }), headers });
        }
        if (path === "/libraries/lib-stable/experiences/exp-e2e-2") {
          membershipRequested = true;
          await write.promise;
          return route.fulfill({ status: 500, json: { status: "error", message: "검증용 추가 실패" }, headers });
        }
        if (method === "GET") {
          if (membershipRequested && crudAcknowledged && path.includes("lib-stable")) recoveryRead = true;
          const contents = path.includes("lib-stable") ? experiences.filter((e) => e.id === "exp-e2e-1") : [];
          return route.fulfill({ json: success({ count: contents.length, contents }), headers });
        }
        if (method === "POST" && path === "/libraries/") {
          custom.push({ id: "lib-created", name: request.postDataJSON().name, color: "", is_system: false, filter: null });
        } else if (method === "PATCH") {
          custom = custom.map((lib) => lib.id === "lib-target" ? { ...lib, ...request.postDataJSON() } : lib);
        } else if (method === "DELETE" && path === "/libraries/lib-target") {
          custom = custom.filter((lib) => lib.id !== "lib-target");
        } else throw new Error(`Unexpected mock mutation ${method} ${path}`);
        crudAcknowledged = true;
        return route.fulfill({ json: success({ id: "lib-created" }), headers });
      });
      try {
        await page.goto("/archive");
        const card = page.locator('[data-experience-id="exp-e2e-2"]').filter({ visible: true });
        await expect(card).toBeVisible();
        await card.getByRole("button", { name: "더보기", exact: true }).click();
        await page.getByRole("button", { name: "라이브러리 이동", exact: true }).hover();
        await page.getByRole("button", { name: /^경험 보존/ }).click();
        await page.keyboard.press("Escape");
        await expect.poll(() => membershipRequested).toBe(true);
        await page.getByRole("button", { name: "전체", exact: true }).filter({ visible: true }).click();
        const row = page.getByRole("listitem").filter({ hasText: "변경 대상" });
        if (action === "create") await page.getByRole("button", { name: "라이브러리 추가", exact: true }).click();
        else if (action === "delete") await row.getByRole("button", { name: "삭제", exact: true }).click();
        else {
          await row.getByRole("button", { name: "이름 변경", exact: true }).click();
          await page.locator("[data-archive-popover] input").fill("이름 반영 완료");
          await page.locator("[data-archive-popover] input").press("Enter");
        }
        await expect.poll(() => crudAcknowledged).toBe(true);
        // Select a different library while the acknowledged CRUD refresh is held.
        await page.getByRole("listitem").filter({ hasText: "경험 보존" }).locator('[aria-pressed]').click();
        write.release();
        await expect.poll(() => recoveryRead).toBe(true);
        await expect(page.getByText("라이브러리에 추가하지 못했어요", { exact: true }).filter({ visible: true })).toBeVisible();
        refresh.release();
        await expect(page.getByRole("heading", { level: 3, name: "교내 개발 동아리 운영진", exact: true }).filter({ visible: true })).toBeVisible();
        await expect(page.getByRole("heading", { level: 3, name: "캡스톤 팀 프로젝트", exact: true })).toHaveCount(0);
        await page.getByRole("button", { name: "경험 보존", exact: true }).filter({ visible: true }).click();
        const expected = action === "create" ? "라이브러리 3" : "이름 반영 완료";
        if (action === "delete") await expect(page.getByRole("listitem").filter({ hasText: "변경 대상" })).toHaveCount(0);
        else await expect(page.getByRole("listitem").filter({ hasText: expected })).toBeVisible();
        await expect(page.getByRole("listitem").filter({ hasText: "경험 보존" }).locator('[aria-pressed]')).toHaveAttribute("aria-pressed", "true");
        const image = testInfo.outputPath(`${action}-${viewport.name}.jpg`);
        await page.screenshot({ path: image, type: "jpeg", quality: 70, animations: "disabled", fullPage: true });
        await testInfo.attach(`${action} ${viewport.name}`, { path: image, contentType: "image/jpeg" });
        if (process.env.FRT251_CAPTURE_DIR) {
          await mkdir(process.env.FRT251_CAPTURE_DIR, { recursive: true });
          await page.screenshot({ path: `${process.env.FRT251_CAPTURE_DIR}/${action}--${viewport.name}.jpg`, type: "jpeg", quality: 70, animations: "disabled", fullPage: true });
        }
      } finally {
        write.release();
        refresh.release();
      }
    });
  }
}
