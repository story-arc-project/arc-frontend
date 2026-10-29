import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

const CAREER = "인턴 및 업무 경력";
const RETURN_TO = "/archive?q=캡스톤";
const newUrl = (type?: string) => {
  const params = new URLSearchParams({ returnTo: RETURN_TO });
  if (type !== undefined) params.set("type", type);
  return `/archive/new?${params}`;
};

async function expectType(page: Page, type: string | null) {
  await expect.poll(() => new URL(page.url()).searchParams.get("type")).toBe(type);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(RETURN_TO);
}

async function keyboardSelectCareer(page: Page) {
  const career = page.getByRole("button", { name: CAREER, exact: true });
  await career.focus();
  await page.keyboard.press("Enter");
  await expectType(page, "career");
  await expect(page.getByRole("textbox", { name: "경험명", exact: true })).toBeVisible();
}

async function expectSelector(page: Page) {
  await expectType(page, null);
  await expect(page.getByRole("button", { name: "대외활동", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "유형 변경", exact: true })).toHaveCount(0);
}

async function attachPreview(page: Page, testInfo: TestInfo, state: string) {
  const buffer = await page.screenshot({ animations: "disabled", fullPage: false });
  await testInfo.attach(`type-url-${state}`, { body: buffer, contentType: "image/png" });
  if (process.env.FRT336_PREVIEW_DIR) {
    await mkdir(process.env.FRT336_PREVIEW_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(process.env.FRT336_PREVIEW_DIR, `${testInfo.project.name}-${page.viewportSize()?.width}-${state}.png`),
      animations: "disabled",
      fullPage: false,
    });
  }
}

for (const width of [1440, 390]) {
  test.describe(`FRT-336 유형 URL ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("keyboard selection, Back/Forward and refresh preserve type and returnTo", async ({ page }, testInfo) => {
      await stubApi(page, { authed: true, scenario: "data" });
      await page.goto(newUrl());
      await keyboardSelectCareer(page);
      await attachPreview(page, testInfo, "selected");

      await page.goBack();
      await expectSelector(page);
      await attachPreview(page, testInfo, "selector");
      await page.goForward();
      await expectType(page, "career");
      await expect(page.getByRole("button", { name: CAREER, exact: true })).toHaveAttribute("aria-pressed", "true");

      await page.reload();
      await expectType(page, "career");
      await expect(page.getByRole("textbox", { name: "경험명", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "유형 변경", exact: true })).toBeVisible();
    });

    test("direct valid type and invalid parameter boundaries render safely", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await stubApi(page, { authed: true, scenario: "data" });
      await page.goto(newUrl("career"));
      await expect(page.getByRole("textbox", { name: "경험명", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: CAREER, exact: true })).toHaveAttribute("aria-pressed", "true");

      for (const query of ["type=", "type=unknown-type", "type=sports", "type=career&type=award"]) {
        await page.goto(`/archive/new?${query}`);
        await expect(page.getByRole("button", { name: "대외활동", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "유형 변경", exact: true })).toHaveCount(0);
        await expect(page.getByRole("textbox", { name: "경험명", exact: true })).toHaveCount(0);
      }
      expect(errors).toEqual([]);
    });

    test("dirty Back/Forward retains input and cancel/leave keeps the return context", async ({ page }, testInfo) => {
      const stub = await stubApi(page, { authed: true, scenario: "data" });
      await page.goto(newUrl());
      await keyboardSelectCareer(page);
      const title = page.getByRole("textbox", { name: "경험명", exact: true });
      await title.fill("보존할 인턴 경험");
      await page.waitForFunction(() => Boolean(window.history.state?.__navGuardSentinel));

      await page.goBack();
      await expectSelector(page);
      await expect(page.getByRole("dialog", { name: "저장하지 않고 나갈까요?" })).toBeHidden();
      await page.goForward();
      await expectType(page, "career");
      await expect(title).toHaveValue("보존할 인턴 경험");
      await attachPreview(page, testInfo, "dirty-restored");

      await page.getByRole("button", { name: "목록으로 돌아가기", exact: true }).click();
      const guard = page.getByRole("dialog", { name: "저장하지 않고 나갈까요?" });
      await expect(guard).toBeVisible();
      await guard.getByRole("button", { name: "취소", exact: true }).click();
      await expect(title).toHaveValue("보존할 인턴 경험");
      await expectType(page, "career");

      await page.getByRole("button", { name: "목록으로 돌아가기", exact: true }).click();
      await guard.getByRole("button", { name: "나가기", exact: true }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/archive" && url.searchParams.get("q") === "캡스톤");
      await expect(page.getByPlaceholder("경험 검색...").first()).toHaveValue("캡스톤");
      expect(stub.mutations.filter((mutation) => mutation.path === "/experiences/" && mutation.method === "POST")).toHaveLength(0);
    });

    test("direct-link dirty Back reaches selector and guards the next departure", async ({ page }) => {
      await stubApi(page, { authed: true, scenario: "data" });
      await page.goto("/archive");
      await expect(page.getByRole("heading", { level: 3, name: "캡스톤 팀 프로젝트" })).toBeVisible();
      await page.goto(newUrl("career"));
      const title = page.getByRole("textbox", { name: "경험명", exact: true });
      await title.fill("직접 링크에서 작성한 경험");
      await page.waitForFunction(() => Boolean(window.history.state?.__navGuardSentinel));
      await page.goBack();
      await expectSelector(page);
      await page.goBack();
      const guard = page.getByRole("dialog", { name: "저장하지 않고 나갈까요?" });
      await expect(guard).toBeVisible();
      await guard.getByRole("button", { name: "취소", exact: true }).click();
      await page.getByRole("button", { name: CAREER, exact: true }).click();
      await expectType(page, "career");
      await expect(title).toHaveValue("직접 링크에서 작성한 경험");
    });

    test("explicit type change still asks before resetting the existing draft", async ({ page }) => {
      await stubApi(page, { authed: true, scenario: "data" });
      await page.goto(newUrl("career"));
      const title = page.getByRole("textbox", { name: "경험명", exact: true });
      await title.fill("유형 변경 확인 전 입력");

      const rejected = page.waitForEvent("dialog").then(async (dialog) => {
        expect(dialog.type()).toBe("confirm");
        expect(dialog.message()).toContain("경험 유형을 바꾸면");
        await dialog.dismiss();
      });
      await page.getByRole("button", { name: "유형 변경", exact: true }).click();
      await rejected;
      await expectType(page, "career");
      await expect(title).toHaveValue("유형 변경 확인 전 입력");

      page.on("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "유형 변경", exact: true }).click();
      await page.getByRole("button", { name: "대외활동", exact: true }).click();
      await expectType(page, "extracurricular");
      await expect(title).toHaveValue("");
      await expect(page.getByRole("button", { name: "대외활동", exact: true })).toHaveAttribute("aria-pressed", "true");
    });
  });
}
