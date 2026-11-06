import { expect, test } from "@playwright/test";
import { stubApi } from "./fixtures/stub-api";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

for (const phase of ["PATCH", "GET"] as const) {
  test(`프로필 ${phase} 대기 중 추가 입력은 동기화 후에도 남고 다시 저장된다`, async ({ page }, testInfo) => {
    const stub = await stubApi(page, { authed: true });
    await page.goto("/settings");
    const name = page.getByLabel("이름", { exact: true });
    const department = page.getByLabel("학과", { exact: true });
    const save = page.getByRole("button", { name: "저장", exact: true });
    await expect(name).toHaveValue("김서윤");
    const entered = deferred();
    const release = deferred();
    const path = phase === "PATCH" ? "**/auth/profile" : "**/auth/me";
    let held = false;
    await page.route(path, async (route) => {
      if (!held && route.request().method() === phase) {
        held = true;
        entered.resolve();
        await release.promise;
      }
      await route.fallback();
    });

    await name.fill("저장한 이름");
    await save.click();
    await entered.promise;
    await expect(page.getByRole("button", { name: "저장 중..." })).toBeDisabled();
    await department.fill("저장 중 추가한 학과");
    await name.fill("저장 후 추가한 이름");
    release.resolve();
    await expect(save).toBeEnabled();
    await expect(name).toHaveValue("저장 후 추가한 이름");
    await expect(department).toHaveValue("저장 중 추가한 학과");
    expect(stub.mutations.filter((m) => m.path === "/auth/profile")).toHaveLength(1);
    expect(stub.mutations.find((m) => m.path === "/auth/profile")?.body).toEqual({ name: "저장한 이름" });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`draft-retained-${phase}.png`), fullPage: true, animations: "disabled" });

    await save.click();
    await expect(save).toBeDisabled();
    await expect(name).toHaveValue("저장 후 추가한 이름");
    await expect(department).toHaveValue("저장 중 추가한 학과");
    expect(stub.mutations.filter((m) => m.path === "/auth/profile").map((m) => m.body)).toEqual([
      { name: "저장한 이름" },
      { name: "저장 후 추가한 이름", department: "저장 중 추가한 학과" },
    ]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`draft-saved-${phase}.png`), fullPage: true, animations: "disabled" });
  });
}

test("프로필 PATCH 실패 시 추가 입력은 보존되고 재시도할 수 있다", async ({ page }) => {
  const stub = await stubApi(page, { authed: true });
  await page.goto("/settings");
  const name = page.getByLabel("이름", { exact: true });
  const department = page.getByLabel("학과", { exact: true });
  const save = page.getByRole("button", { name: "저장", exact: true });
  await expect(name).toHaveValue("김서윤");
  const entered = deferred();
  const release = deferred();
  await page.route("**/auth/profile", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    entered.resolve();
    await release.promise;
    await route.abort("failed");
  });
  await name.fill("재시도할 이름");
  await save.click();
  await entered.promise;
  await department.fill("실패해도 남는 학과");
  release.resolve();
  await expect(save).toBeEnabled();
  await expect(name).toHaveValue("재시도할 이름");
  await expect(department).toHaveValue("실패해도 남는 학과");
  await page.unroute("**/auth/profile");
  await save.click();
  await expect(save).toBeDisabled();
  expect(stub.mutations.find((m) => m.path === "/auth/profile")?.body).toEqual({
    name: "재시도할 이름", department: "실패해도 남는 학과",
  });
});

test("저장 중 다른 화면으로 이동해도 저장한 이름이 전역 헤더에 반영된다", async ({ page }) => {
  await stubApi(page, { authed: true });
  await page.goto("/settings");
  const name = page.getByLabel("이름", { exact: true });
  await expect(name).toHaveValue("김서윤");
  const entered = deferred();
  const release = deferred();
  await page.route("**/auth/profile", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    entered.resolve();
    await release.promise;
    await route.fallback();
  });
  await name.fill("이동 뒤 저장한 이름");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await entered.promise;
  const dashboard = page.getByRole("link", { name: "대시보드", exact: true }).filter({ visible: true });
  if (!await dashboard.count()) {
    await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  }
  await dashboard.click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const synchronized = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/auth/me" && response.request().method() === "GET");
  release.resolve();
  const response = await synchronized;
  expect((await response.json()).data.profile.name).toBe("이동 뒤 저장한 이름");
  if (!await page.getByRole("button", { name: "계정 메뉴", exact: true }).isVisible()) {
    await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  }
  await expect(page.locator("header").getByText("이동 뒤 저장한 이름", { exact: true }).filter({ visible: true }).first()).toBeVisible();
});
