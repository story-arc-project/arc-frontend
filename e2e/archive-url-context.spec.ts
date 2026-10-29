import { appendFile, mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { stubApi, STUB_API_URL, corsHeaders } from "./fixtures/stub-api";
const first = "캡스톤 팀 프로젝트", second = "교내 개발 동아리 운영진";
const button = (p: Page, name: string) => p.getByRole("button", { name, exact: true }).filter({ visible: true });
const search = (p: Page) => p.getByPlaceholder("경험 검색...").filter({ visible: true });
const card = (p: Page, name: string) => p.getByRole("heading", { level: 3, name });
const detail = (p: Page, name: string) => p.getByRole("heading", { level: 2, name });
async function query(p: Page, values: Record<string, string | null>) {
  await expect.poll(() => Object.fromEntries(Object.keys(values).map(k => [k, new URL(p.url()).searchParams.get(k)]))).toEqual(values);
}
// Native input events exercise React's real change handler. Input and navigation
// share one task so the 300ms timer cannot fire between them.
async function pendingNavigate(p: Page, value: string, target: "preview" | "new" | "peer") {
  const beforeNavigation = await p.evaluate(({ value, target }) => {
    const inputs = [...document.querySelectorAll<HTMLInputElement>('input[placeholder="경험 검색..."]')];
    // Mobile fullscreen preview hides the search: peer covers a programmatic
    // subscription boundary there; desktop uses its visible search input.
    const input = inputs.find(el => el.offsetParent !== null) ?? inputs[0];
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const before = new URLSearchParams(location.search).get("q");
    if (target === "preview") {
      [...document.querySelectorAll<HTMLHeadingElement>("h3")].find(el => el.textContent === "캡스톤 팀 프로젝트" && el.offsetParent !== null)!.click();
    } else {
      const name = target === "peer" ? "다음 기록" : "새 경험 추가";
      [...document.querySelectorAll<HTMLButtonElement>("button")].find(el => (el.getAttribute("aria-label") === name || el.textContent?.trim() === name) && el.offsetParent !== null)!.click();
    }
    return before;
  }, { value, target });
  expect(beforeNavigation).toBeNull();
}
async function capture(p: Page, state: string) {
  if (!process.env.FRT89_PREVIEW_DIR) return;
  await mkdir(process.env.FRT89_PREVIEW_DIR, { recursive: true });
  await appendFile(`${process.env.FRT89_PREVIEW_DIR}/metadata.jsonl`, JSON.stringify({ state, url: p.url(), viewport: p.viewportSize(), file: `${p.viewportSize()?.width}-${state}.jpg` }) + "\n");
  await p.screenshot({ path: `${process.env.FRT89_PREVIEW_DIR}/${p.viewportSize()?.width}-${state}.jpg`, type: "jpeg", quality: 35, animations: "disabled" });
}
for (const width of [1440, 390]) test.describe(`FRT89 ${width}px`, () => {
  test.use({ viewport: { width, height: 844 } });
  test.beforeEach(async ({ page }) => { await stubApi(page, { authed: true, scenario: "data" }); });
  test("search plus rapid sort/chips survives refresh and shared URL", async ({ page }) => {
    await page.goto("/archive");
    await button(page, "필터").click();
    await search(page).fill("동아리");
    await page.getByRole("combobox").filter({ visible: true }).selectOption("completion");
    await page.evaluate(() => {
      for (const name of ["완료", "동아리/교내 단체"]) [...document.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent?.trim() === name && b.offsetParent !== null)!.click();
    });
    await query(page, { q: "동아리", sort: "completion", status: "complete", type: "club" });
    await expect(card(page, second)).toBeVisible();
    await expect(card(page, first)).toHaveCount(0);
    await capture(page, "filtered");
    const shared = page.url();
    await page.reload();
    await expect(search(page)).toHaveValue("동아리");
    await expect(page.getByRole("combobox").filter({ visible: true })).toHaveValue("completion");
    await expect(card(page, second)).toBeVisible();
    await page.goto("/archive");
    await page.goto(shared);
    await expect(search(page)).toHaveValue("동아리");
    await expect(card(page, first)).toHaveCount(0);
  });
  test("Next native history subscription and Back/Forward restore UI", async ({ page }) => {
    await page.goto("/archive");
    await expect(card(page, first)).toBeVisible();
    await page.evaluate(() => history.pushState(null, "", "/archive?q=동아리&sort=period&status=complete"));
    await expect(search(page)).toHaveValue("동아리");
    await expect(card(page, first)).toHaveCount(0);
    await page.goBack();
    await expect(search(page)).toHaveValue("");
    await expect(card(page, first)).toBeVisible();
    await page.goForward();
    await expect(search(page)).toHaveValue("동아리");
    await expect(page.getByRole("combobox").filter({ visible: true })).toHaveValue("period");
  });
  test("batched sort round trip retires stale acknowledgements before external history", async ({ page }) => {
    await page.goto("/archive?q=first");
    const sort = page.getByRole("combobox").filter({ visible: true });
    await expect(search(page)).toHaveValue("first");
    await expect(sort).toHaveValue("updated");
    await page.evaluate(() => {
      const select = [...document.querySelectorAll<HTMLSelectElement>("select")].find(el => el.offsetParent !== null)!;
      for (const value of ["period", "updated"]) {
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await query(page, { q: "first", sort: null });
    await expect(sort).toHaveValue("updated");
    // A fresh task crosses the real Next native-history subscription after the
    // batched own writes ended at the query already observed on initial render.
    await page.evaluate(() => history.pushState(null, "", "/archive?q=first&sort=period"));
    await query(page, { q: "first", sort: "period" });
    await expect(sort).toHaveValue("period");
    await expect(search(page)).toHaveValue("first");
    await page.goBack();
    await query(page, { q: "first", sort: null });
    await expect(sort).toHaveValue("updated");
    await page.goForward();
    await query(page, { q: "first", sort: "period" });
    await expect(sort).toHaveValue("period");
    await expect(search(page)).toHaveValue("first");
  });
  test("pending search preview flush, peer, Back/Forward and close", async ({ page }) => {
    await page.goto("/archive");
    await expect(card(page, first)).toBeVisible();
    await pendingNavigate(page, " ", "preview");
    await query(page, { q: " ", id: "exp-e2e-2" });
    await expect(detail(page, first)).toBeVisible();
    await button(page, "다음 기록").click();
    await query(page, { q: " ", id: "exp-e2e-1" });
    await expect(detail(page, second)).toBeVisible();
    await capture(page, "preview");
    await page.goBack();
    await query(page, { q: " ", id: null });
    await expect(detail(page, second)).toHaveCount(0);
    await expect(search(page)).toHaveValue(" ");
    await page.goForward();
    await expect(detail(page, second)).toBeVisible();
    await page.keyboard.press("Escape");
    await query(page, { q: " ", id: null });
  });
  test("pending draft survives peer id transition (mobile programmatic boundary)", async ({ page }) => {
    await page.goto("/archive?id=exp-e2e-2");
    await expect(detail(page, first)).toBeVisible();
    await pendingNavigate(page, " ", "peer");
    await query(page, { q: " ", id: "exp-e2e-1" });
    await expect(detail(page, second)).toBeVisible();
    // Observe the real search state even under the mobile fullscreen preview.
    await expect(page.getByPlaceholder("경험 검색...").first()).toHaveValue(" ");
    await page.keyboard.press("Escape");
    await expect(search(page)).toHaveValue(" ");
    await query(page, { q: " ", id: null });
    await expect(card(page, first)).toBeVisible();
    await expect(card(page, second)).toBeVisible();
  });
  test("pending edit flush, clean Back, dirty stay and leave", async ({ page }) => {
    await page.goto("/archive");
    await button(page, "더보기").first().click();
    await page.evaluate(() => {
      const input = [...document.querySelectorAll<HTMLInputElement>('input[placeholder="경험 검색..."]')].find(el => el.offsetParent !== null)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "캡스톤");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      [...document.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent?.trim() === "편집" && b.offsetParent !== null)!.click();
    });
    await expect(page).toHaveURL(/\/exp-e2e-2\/edit/);
    expect(new URL(new URL(page.url()).searchParams.get("returnTo")!, "http://local").searchParams.get("q")).toBe("캡스톤");
    await page.goBack();
    await expect(search(page)).toHaveValue("캡스톤");
    await button(page, "더보기").first().click();
    await button(page, "편집").click();
    const title = page.getByRole("textbox", { name: "경험명", exact: true });
    await title.fill("변경한 제목");
    await button(page, "목록으로 돌아가기").first().click();
    const guard = page.getByRole("dialog", { name: "저장하지 않고 나갈까요?" });
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "취소", exact: true }).click();
    await expect(title).toHaveValue("변경한 제목");
    await button(page, "목록으로 돌아가기").first().click();
    await guard.getByRole("button", { name: "나가기", exact: true }).click();
    await query(page, { q: "캡스톤", id: "exp-e2e-2" });
    await expect(detail(page, first)).toBeVisible();
  });
  test("pending new cancel and empty reset preserve library", async ({ page }) => {
    await page.goto("/archive?lib=lib-custom-1");
    await expect(card(page, second)).toBeVisible();
    await pendingNavigate(page, "동아리", "new");
    await expect(page).toHaveURL(/\/archive\/new/);
    const context = new URL(new URL(page.url()).searchParams.get("returnTo")!, "http://local");
    expect(context.searchParams.get("q")).toBe("동아리");
    expect(context.searchParams.get("lib")).toBe("lib-custom-1");
    await button(page, "목록으로 돌아가기").first().click();
    await query(page, { q: "동아리", lib: "lib-custom-1" });
    await search(page).fill("없는검색결과");
    await expect(page.getByText("조건에 맞는 경험이 없어요").filter({ visible: true })).toBeVisible();
    await query(page, { q: "없는검색결과", lib: "lib-custom-1" });
    await capture(page, "empty");
    await button(page, "필터 초기화").click();
    await query(page, { q: null, lib: "lib-custom-1" });
    await expect(card(page, second)).toBeVisible();
    await capture(page, "reset");
  });
  test("retained duplicate completion preserves departed dashboard history entry", async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let duplicateStarted = false;
    await page.route(`${STUB_API_URL}/experiences/*/duplicate`, async route => {
      if (route.request().method() !== "POST") return route.fallback();
      duplicateStarted = true;
      await gate;
      // Continue through the existing stateful stub so duplicate ID/detail/list
      // behavior is identical to the other CRUD browser regressions.
      await route.fallback();
    });
    try {
      await page.goto("/archive?q=캡스톤&sort=period");
      await card(page, first).click();
      await expect(detail(page, first)).toBeVisible();
      await button(page, "복제").click();
      await expect.poll(() => duplicateStarted).toBe(true);
      if (width < 640) await button(page, "메뉴 열기").click();
      await page.getByRole("link", { name: "대시보드", exact: true }).filter({ visible: true }).click();
      await expect(page.getByRole("heading", { level: 1, name: /안녕하세요/ })).toBeVisible();
      // Query state belongs to the destination and must never be consumed by
      // the retained archive callback when the gated request later finishes.
      await page.evaluate(() => history.replaceState(null, "", "/dashboard?q=destination&sort=completion"));
      await expect(page).toHaveURL(/\/dashboard\?q=destination&sort=completion$/);
      release();
      await expect(page).toHaveURL(url => url.pathname === "/archive" && url.searchParams.get("id")?.startsWith("e2e-exp-new-") === true);
      await query(page, { q: "캡스톤", sort: "period" });
      await expect(detail(page, first)).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(/\/dashboard\?q=destination&sort=completion$/);
      await expect(page.getByRole("heading", { level: 1, name: /안녕하세요/ })).toBeVisible();
    } finally {
      release();
    }
  });
  test("library failure retains URL until retry; missing library fallback keeps filters", async ({ page }) => {
    let fail = true;
    await page.route(`${STUB_API_URL}/libraries/`, async route => {
      if (route.request().method() !== "GET" || !fail) return route.fallback();
      await route.fulfill({ status: 500, headers: corsHeaders(new URL(page.url()).origin), json: { message: "library unavailable" } });
    });
    await page.goto("/archive?lib=lib-custom-1&q=동아리&sort=period");
    await expect(button(page, "다시 시도").first()).toBeVisible();
    await query(page, { lib: "lib-custom-1", q: "동아리", sort: "period" });
    fail = false;
    await button(page, "다시 시도").first().click();
    await expect(card(page, second)).toBeVisible();
    await expect(button(page, "백엔드 역량")).toBeVisible();
    await query(page, { lib: "lib-custom-1", q: "동아리", sort: "period" });
    await page.goto("/archive?lib=deleted&q=캡스톤&sort=period");
    await query(page, { lib: null, q: "캡스톤", sort: "period" });
    await expect(card(page, first)).toBeVisible();
  });
});
