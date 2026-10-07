import { expect, test, type Page } from "@playwright/test";
import { API_ORIGIN } from "./fixtures/api-origin";
import { corsHeaders, stubApi } from "./fixtures/stub-api";

type Attempt = { key: string | undefined; body: unknown };

// Record the request before returning an uncertain result, as if the server had
// accepted it but the client could not learn the outcome. Never touch a live API.
async function uncertainGeneration(page: Page, path: string) {
  const attempts: Attempt[] = [];
  let status = 503;
  await page.route(`${API_ORIGIN}${path}`, async (route) => {
    const request = route.request();
    if (request.method() === "GET") return route.fallback();
    const headers = corsHeaders(request.headers().origin ?? "");
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: {
      ...headers,
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "content-type,idempotency-key",
    } });
    attempts.push({ key: request.headers()["idempotency-key"], body: request.postDataJSON() });
    await new Promise((resolve) => setTimeout(resolve, 150));
    return route.fulfill({ status, headers, json: { error: {
      code: status === 422 ? "VALIDATION_ERROR" : "SERVER_ERROR",
      message: "Generation request failed",
    } } });
  });
  return { attempts, rejectNext: () => { status = 422; } };
}

function expectStable(attempts: Attempt[]) {
  expect(attempts).toHaveLength(2);
  expect(attempts[0].key).toMatch(/\S+/);
  expect(attempts[1]).toEqual(attempts[0]);
}

test("키워드 생성은 연타를 막고 불확실한 실패 재시도에 같은 키를 사용한다", async ({ page }) => {
  await stubApi(page, { authed: true });
  const { attempts, rejectNext } = await uncertainGeneration(page, "/analysis/keyword");
  await page.goto("/analysis/keyword/new");
  await page.getByPlaceholder("키워드 입력").fill("문제 해결");
  await page.getByRole("button", { name: "키워드 추가" }).click();
  const goal = page.getByLabel("목표 (선택)");
  await goal.fill("디자이너 지원");
  const submit = page.getByRole("button", { name: "분석 시작", exact: true });
  await submit.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.getByRole("alert").filter({ hasText: "분석 요청에 실패했습니다." })).toBeVisible();
  expect(attempts).toHaveLength(1);
  const error = page.getByRole("alert").filter({ hasText: "분석 요청에 실패했습니다." });
  const returnToForm = () => page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await returnToForm();
  await submit.click();
  await expect(error).toBeVisible();
  expectStable(attempts);
  await returnToForm();
  await goal.fill("기획자 지원");
  rejectNext();
  await submit.click();
  await expect(error).toBeVisible();
  expect(attempts[2].key).not.toBe(attempts[1].key);
  expect(attempts[2].body).not.toEqual(attempts[1].body);
  await returnToForm();
  await submit.click();
  await expect(error).toBeVisible();
  expect(attempts[3].key).not.toBe(attempts[2].key);
  expect(attempts[3].body).toEqual(attempts[2].body);
});

test("이력서 생성 모달은 같은 입력의 503 재시도에 같은 키를 사용한다", async ({ page }) => {
  await stubApi(page, { authed: true });
  const { attempts } = await uncertainGeneration(page, "/export/resume");
  await page.goto("/export");
  await page.getByRole("button", { name: "새 이력서 만들기" }).click();
  const form = page.getByRole("dialog", { name: "새 이력서 만들기" });
  const submit = form.getByRole("button", { name: "만들기", exact: true });
  await submit.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(submit).toBeEnabled();
  await expect.poll(() => attempts.length).toBe(1);
  await submit.click();
  await expect(submit).toBeEnabled();
  expectStable(attempts);
  await form.getByText("English", { exact: true }).click();
  await submit.click();
  await expect(submit).toBeEnabled();
  expect(attempts[2].key).not.toBe(attempts[1].key);
});

test("이력서 다시 만들기도 불확실한 실패 재시도의 키를 보존한다", async ({ page }) => {
  await stubApi(page, { authed: true, scenario: "data" });
  const { attempts } = await uncertainGeneration(page, "/export/resume");
  await page.goto("/export/resume/resume-e2e-1");
  await page.locator("header").getByRole("button", { name: "다시 만들기" }).click();
  const submit = page.getByRole("dialog", { name: "다시 만들기 확인" }).getByRole("button", { name: "다시 만들기", exact: true });
  await submit.click();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(submit).toBeEnabled();
  expectStable(attempts);
});

test("자기소개서 생성은 연타를 막고 재시도 키를 보존하며 입력 변경 시 교체한다", async ({ page }) => {
  await stubApi(page, { authed: true });
  const { attempts } = await uncertainGeneration(page, "/export/cover_letter");
  await page.goto("/export/cover-letter/new");
  const company = page.getByPlaceholder("예: 토스");
  await company.fill("테스트 회사");
  const submit = page.getByRole("button", { name: "초안 만들기" });
  await submit.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.getByText("자기소개서 생성에 실패했어요. 다시 시도해 주세요.", { exact: true })).toBeVisible();
  expect(attempts).toHaveLength(1);
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByText("자기소개서 생성에 실패했어요. 다시 시도해 주세요.", { exact: true })).toBeVisible();
  expectStable(attempts);
  await company.fill("다른 회사");
  await submit.click();
  await expect(page.getByText("자기소개서 생성에 실패했어요. 다시 시도해 주세요.", { exact: true })).toBeVisible();
  expect(attempts[2].key).not.toBe(attempts[1].key);
});

for (const kind of ["comprehensive", "keyword"] as const) {
  test(`${kind} 분석 재시도는 연타를 막고 503 뒤 같은 키로 다시 요청한다`, async ({ page }) => {
    await stubApi(page, { authed: true });
    const id = `failed-${kind}`;
    await page.route(`${API_ORIGIN}/analysis/${kind}/${id}`, async (route) => {
      const headers = corsHeaders(route.request().headers().origin ?? "");
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      return route.fulfill({ headers, json: { data: { id, status: "failed" } } });
    });
    const { attempts } = await uncertainGeneration(page, `/analysis/${kind}/${id}/retry`);
    await page.goto(`/analysis/${kind}/${id}`);
    await expect(page.getByText("분석에 실패했습니다", { exact: true })).toBeVisible();
    const submit = page.getByRole("button", { name: "다시 시도", exact: true });
    await submit.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    const error = page.getByText("다시 시도하지 못했어요. 잠시 후 한 번 더 눌러주세요.", { exact: true });
    await expect(error).toBeVisible();
    expect(attempts).toHaveLength(1);
    await submit.click();
    await expect(error).toBeVisible();
    expectStable(attempts);
  });
}
