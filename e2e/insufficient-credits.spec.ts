import { expect, test, type Page } from "@playwright/test";
import { API_ORIGIN } from "./fixtures/api-origin";
import { corsHeaders, stubApi } from "./fixtures/stub-api";

async function rejectGeneration(page: Page, path: string, status = 402, delayMs = 0) {
  const attempts: unknown[] = [];
  await page.route(`${API_ORIGIN}${path}`, async (route) => {
    const req = route.request();
    if (req.method() === "GET") return route.fallback();
    const headers = corsHeaders(req.headers().origin ?? "");
    if (req.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: {
        ...headers,
        "access-control-allow-methods": "POST,OPTIONS",
        "access-control-allow-headers": "content-type,idempotency-key",
      } });
    }
    attempts.push(req.postDataJSON());
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    return route.fulfill({ status, headers, json: { error: {
      code: status === 402 ? "INSUFFICIENT_CREDITS" : "SERVER_ERROR",
      message: "required=731 available=129 shortfall=602",
      required: 731, available: 129,
    } } });
  });
  return attempts;
}

async function enterKeyword(page: Page) {
  await page.goto("/analysis/keyword/new");
  await page.getByPlaceholder("키워드 입력").fill("문제 해결");
  await page.getByRole("button", { name: "키워드 추가" }).click();
  await page.getByLabel("목표 (선택)").fill("프로덕트 디자이너 지원");
}

test("부족 모달은 수치를 숨기며 Escape 뒤 입력과 포커스를 보존한다", async ({ page }) => {
  await stubApi(page, { authed: true });
  const attempts = await rejectGeneration(page, "/analysis/keyword", 402, 200);
  await enterKeyword(page);
  const submit = page.getByRole("button", { name: "분석 시작", exact: true });
  await submit.click();
  const dialog = page.getByRole("dialog", { name: "크레딧이 부족해요" });
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText(/731|129|602|required|available/);
  await expect(dialog.getByRole("link", { name: "충전 페이지로 이동" })).toHaveAttribute("href", "/credits/charge");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(submit).toBeFocused();
  await expect(page.getByLabel("목표 (선택)")).toHaveValue("프로덕트 디자이너 지원");
  await expect(page.getByRole("button", { name: "문제 해결 제거" })).toBeVisible();
  expect(attempts).toHaveLength(1);
  await submit.click();
  await expect(dialog).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
  await dialog.getByRole("link", { name: "충전 페이지로 이동" }).click();
  await expect(page).toHaveURL(/\/credits\/charge$/);
  await expect(page.getByRole("heading", { name: "크레딧 충전", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("서버 오류는 잔액 부족 모달로 바꾸지 않는다", async ({ page }) => {
  await stubApi(page, { authed: true });
  await rejectGeneration(page, "/analysis/keyword", 503);
  await enterKeyword(page);
  await page.getByRole("button", { name: "분석 시작", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "분석 요청에 실패했습니다." })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "크레딧이 부족해요" })).toHaveCount(0);
});

test("이력서 부족 안내는 생성 모달과 겹치지 않고 언어 선택을 복원한다", async ({ page }) => {
  await stubApi(page, { authed: true });
  const attempts = await rejectGeneration(page, "/export/resume");
  await page.goto("/export");
  await page.getByRole("button", { name: "새 이력서 만들기" }).click();
  const form = page.getByRole("dialog", { name: "새 이력서 만들기" });
  await form.getByRole("radio", { name: "English" }).check({ force: true });
  await form.getByRole("button", { name: "만들기", exact: true }).click();
  const shortage = page.getByRole("dialog", { name: "크레딧이 부족해요" });
  await expect(shortage).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(form).toBeVisible();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(form.getByRole("button", { name: "만들기", exact: true })).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  expect(attempts).toHaveLength(1);
  await form.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(shortage).toBeVisible();
  expect(attempts).toEqual([{ language: "en", max_pages: 1, auto_fill: true }, { language: "en", max_pages: 1, auto_fill: true }]);
});

for (const width of [320, 390, 1440]) {
  test(`충전 페이지는 결제 버튼을 누른 뒤에만 준비 중을 안내한다 (${width}px)`, async ({ page }) => {
    const stub = await stubApi(page, { authed: true });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/credits/charge");
    await expect(page.getByRole("heading", { name: "크레딧 충전", exact: true })).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(3);
    await expect(page.getByText(/준비 중|준비하고/)).toHaveCount(0);
    const pay = page.getByRole("button", { name: /결제하기/ });
    await expect(pay).toBeDisabled();
    await page.getByText("Basic", { exact: true }).click();
    await expect(pay).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await pay.click();
    const dialog = page.getByRole("dialog", { name: "크레딧 충전 안내" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/결제/);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(pay).toBeFocused();
    await expect(page.getByRole("radio").nth(1)).toBeChecked();
    expect(stub.mutations.filter((m) => /credit|payment|purchase/.test(m.path))).toHaveLength(0);
  });
}


test("이력서 재생성 부족 안내를 닫으면 다시 만들기 버튼으로 포커스가 돌아온다", async ({ page }) => {
  await stubApi(page, { authed: true, scenario: "data" });
  const attempts = await rejectGeneration(page, "/export/resume", 402, 200);
  await page.goto("/export/resume/resume-e2e-1");
  await page.locator("header").getByRole("button", { name: "다시 만들기" }).click();
  const confirm = page.getByRole("dialog", { name: "다시 만들기 확인" });
  await confirm.getByRole("button", { name: "다시 만들기", exact: true }).click();
  const shortage = page.getByRole("dialog", { name: "크레딧이 부족해요" });
  await expect(shortage).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(confirm).toBeVisible();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(confirm.getByRole("button", { name: "다시 만들기", exact: true })).toBeFocused();
  expect(attempts).toHaveLength(1);
});
