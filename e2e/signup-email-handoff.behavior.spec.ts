import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { stubApi } from "./fixtures/stub-api";
import { API_ORIGIN } from "./fixtures/api-origin";

async function attachScreenshots(page: Page, testInfo: TestInfo, label: string) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    // Framer Motion uses JS transforms, which Playwright's CSS animation switch does not finish.
    // Wait for its final geometry before taking review screenshots at either viewport.
    await expect.poll(() => page.locator("h1").evaluate((heading) => {
      let node: HTMLElement | null = heading;
      while (node) {
        const { transform, opacity } = getComputedStyle(node);
        if (Number(opacity) < 1) return false;
        if (transform !== "none") {
          const matrix = new DOMMatrixReadOnly(transform);
          if (Math.abs(matrix.m41) > 0.01 || Math.abs(matrix.m42) > 0.01) return false;
        }
        node = node.parentElement;
      }
      return true;
    })).toBe(true);
    await testInfo.attach(`${label}-${width}`, { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
  }
}

async function unverifiedLogin(page: Page, email = "reader@example.test") {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill("testpass123");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/signup\?step=verify&flow=[\w-]+$/);
  await expect(page.getByText(email, { exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await stubApi(page, { authed: false });
  await page.route(`${API_ORIGIN}/auth/me`, route => route.fulfill({
    status: 401, headers: { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" }, json: { code: "AUTH_MISSING_COOKIES" },
  }));
  await page.route(`${API_ORIGIN}/auth/login`, route => route.fulfill({
    status: 403, contentType: "application/json",
    headers: { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" },
    body: JSON.stringify({ code: "EMAIL_NOT_VERIFIED" }),
  }));
});

test("verification resumes on reload without email URL, back keeps editable email", async ({ page }, testInfo) => {
  await unverifiedLogin(page);
  await page.reload();
  await expect(page.getByText("reader@example.test", { exact: true })).toBeVisible();
  await attachScreenshots(page, testInfo, "verification");
  await page.getByRole("button", { name: "← 이전" }).click();
  await expect(page.getByRole("heading", { name: "비밀번호를 설정해주세요" })).toBeVisible();
  await page.getByRole("button", { name: "← 이전" }).click();
  await expect(page.getByLabel("이메일", { exact: true })).toHaveValue("reader@example.test");
  expect(page.url()).not.toContain("email=");
});

test("a new login account invalidates the old flow", async ({ page }) => {
  await unverifiedLogin(page, "first@example.test");
  const oldUrl = page.url();
  await unverifiedLogin(page, "second@example.test");
  await page.goto(oldUrl);
  await expect(page.getByRole("heading", { name: "시작해볼까요" })).toBeVisible();
  await expect(page.getByLabel("이메일", { exact: true })).toBeEmpty();
});

for (const query of ["step=verify&flow=missing", "step=password", "step=verify&email=legacy%40example.test"]) {
  test(`missing or legacy context recovers: ${query}`, async ({ page }, testInfo) => {
    await page.goto(`/signup?${query}`);
    await expect(page.getByRole("status")).toContainText("이메일을 다시 입력");
    await expect(page.getByLabel("이메일", { exact: true })).toBeEmpty();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByText("legacy@example.test", { exact: true })).toHaveCount(0);
    if (query.includes("legacy")) await attachScreenshots(page, testInfo, "recovery");
  });
}

test("blocked storage leaves recoverable login error", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", { get() { throw new Error("blocked"); } });
  });
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill("reader@example.test");
  await page.getByLabel("비밀번호", { exact: true }).fill("testpass123");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "브라우저 저장 공간" })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await attachScreenshots(page, testInfo, "storage-blocked");
});

const cors = { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" };
const onboardingResult = { status: "success", data: { onboarded: false, user: { email: "reader@example.test" } } };

test("successful email login starts onboarding without email URL", async ({ page }) => {
  await page.route(`${API_ORIGIN}/auth/login`, route => route.fulfill({ status: 200, headers: cors, json: onboardingResult }));
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill("reader@example.test");
  await page.getByLabel("비밀번호", { exact: true }).fill("testpass123");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/signup\?step=consent$/);
  await expect(page.getByRole("heading", { name: "약관에 동의해주세요" })).toBeVisible();
});

test("Google callback starts onboarding without email URL", async ({ page, context }) => {
  await context.addCookies([{ name: "oauth_state", value: "test-state", domain: "localhost", path: "/" }]);
  await page.route(`${API_ORIGIN}/auth/social-login`, route => route.fulfill({ status: 200, headers: cors, json: onboardingResult }));
  await page.goto("/callback/google?code=test-code&state=test-state");
  await expect(page).toHaveURL(/\/signup\?step=consent$/);
  await expect(page.getByRole("heading", { name: "약관에 동의해주세요" })).toBeVisible();
});

test("verification failure remains retryable with restored email", async ({ page }) => {
  let attempts = 0;
  await page.route(`${API_ORIGIN}/auth/verify-email`, route => {
    attempts += 1;
    return route.fulfill({ status: 400, headers: cors, json: { code: "INVALID_CODE", message: "인증 코드를 확인해주세요." } });
  });
  await unverifiedLogin(page);
  await page.getByLabel("인증 코드", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toBeVisible();
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await expect.poll(() => attempts).toBe(2);
  expect(page.url()).not.toContain("example.test");
});

test("browser back to login invalidates forward verification", async ({ page }) => {
  await unverifiedLogin(page);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "반가워요" })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "시작해볼까요" })).toBeVisible();
  await expect(page.getByLabel("이메일", { exact: true })).toBeEmpty();
});
