import { expect, test } from "@playwright/test";

import { STUB_API_URL, stubApi } from "./fixtures/stub-api";

for (const hydrationFails of [false, true]) {
  test(`FRT-241 복제 ${hydrationFails ? "상세 GET 실패 후 목록 복구" : "성공"}: 목록·개수·선택 유지`, async ({ page }) => {
    const stub = await stubApi(page, { authed: true, scenario: "data" });
    if (hydrationFails) {
      await page.route(`${STUB_API_URL}/experiences/**`, async (route) => {
        const request = route.request();
        if (request.method() === "GET" && /\/experiences\/e2e-exp-new-/.test(new URL(request.url()).pathname)) {
          await route.abort("failed");
        } else {
          await route.fallback();
        }
      });
    }
    await page.goto("/archive");
    const title = "교내 개발 동아리 운영진";
    await page.getByRole("heading", { level: 3, name: title, exact: true }).click();
    await page.getByRole("button", { name: "복제", exact: true }).click();
    await expect(page).toHaveURL(/\/archive\?id=e2e-exp-new-/);
    await expect(page.getByRole("heading", { level: 2, name: title, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: title, exact: true })).toHaveCount(2);
    expect(stub.mutations.filter((m) => m.path.endsWith("/duplicate"))).toHaveLength(1);
    await page.getByRole("button", { name: "미리보기 닫기", exact: true }).click();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(3);
    await expect(page.getByRole("heading", { level: 3, name: title, exact: true })).toHaveCount(2);
  });
}

// A duplicate POST may still be pending when the user deletes its source.
// Its late success must replace, rather than drop, the delete reconciliation.
for (const width of [1440, 390]) {
  test(`FRT-241 삭제 목록조회 중 복제 성공: 삭제·복제 결과 유지 @${width}`, async ({ page }) => {
    const { createStatefulStore } = await import("./fixtures/stateful-store");
    const { success } = await import("./fixtures/api-data");
    const { corsHeaders } = await import("./fixtures/stub-api");
    await stubApi(page, { authed: true, scenario: "data" });
    const store = createStatefulStore("data");
    let releasePost!: () => void;
    let releaseOldList!: () => void;
    let releaseReplacement!: () => void;
    const replacementGate = new Promise<void>(resolve => { releaseReplacement = resolve; });
    const postGate = new Promise<void>(resolve => { releasePost = resolve; });
    const listGate = new Promise<void>(resolve => { releaseOldList = resolve; });
    let deleted = false;
    let oldListCaptured = false;
    let replacementCaptured = false;
    let duplicateStarted = false;
    await page.route(`${STUB_API_URL}/experiences/**`, async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const headers = corsHeaders(request.headers()["origin"] ?? "http://localhost:3141");
      if (request.method() === "POST" && path.endsWith("/duplicate")) {
        const id = path.split("/")[2];
        const newId = store.experiences.duplicate(id);
        duplicateStarted = true;
        await postGate;
        await route.fulfill({ json: success({ id: newId }), headers });
      } else if (request.method() === "DELETE") {
        store.experiences.remove(path.split("/")[2]);
        deleted = true;
        await route.fulfill({ json: success(null), headers });
      } else if (request.method() === "GET" && path === "/experiences/") {
        const snapshot = store.experiences.list();
        if (deleted && !oldListCaptured) {
          oldListCaptured = true;
          await listGate;
        } else if (deleted) {
          replacementCaptured = true;
          await replacementGate;
        }
        await route.fulfill({ json: success(snapshot), headers });
      } else if (request.method() === "GET") {
        await route.fulfill({ json: success(store.experiences.get(path.split("/")[2])), headers });
      } else {
        await route.fallback();
      }
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/archive");
    const title = "교내 개발 동아리 운영진";
    await page.getByRole("heading", { level: 3, name: title, exact: true }).click();
    await page.getByRole("button", { name: "복제", exact: true }).click();
    await expect.poll(() => duplicateStarted).toBe(true);
    const actions = page.getByRole("button", { name: "복제", exact: true }).locator("..");
    await actions.getByRole("button", { name: "삭제", exact: true }).click();
    await page.getByRole("dialog", { name: "경험 삭제 확인" }).getByRole("button", { name: "삭제", exact: true }).click();
    await expect.poll(() => oldListCaptured).toBe(true);
    releasePost();
    await expect.poll(() => replacementCaptured).toBe(true);
    releaseOldList();
    await expect(page).toHaveURL(/\/archive$/);
    await expect(page.getByText("불러오는 중…", { exact: true }).filter({ visible: true })).toBeVisible();
    await page.screenshot({ path: `e2e/preview/out/delete-duplicate-loading--${width}.jpg`, type: "jpeg", quality: 70, fullPage: true, animations: "disabled" });
    releaseReplacement();
    await expect(page).toHaveURL(/\/archive\?id=e2e-exp-new-/);
    await expect(page.getByRole("heading", { level: 2, name: title, exact: true })).toBeVisible();
    await page.getByRole("button", { name: width < 768 ? "목록으로 돌아가기" : "미리보기 닫기", exact: true }).click();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(2);
    await expect(page.getByRole("heading", { level: 3, name: title, exact: true })).toHaveCount(1);
    await page.screenshot({ path: `e2e/preview/out/delete-duplicate--${width}.jpg`, type: "jpeg", quality: 70, fullPage: true, animations: "disabled" });
  });
}
