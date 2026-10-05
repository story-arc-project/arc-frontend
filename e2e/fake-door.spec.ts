import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function openPrices(page: Page, scenario = "normal") {
  await page.goto("/dev/credit-fake-door");
  await page.getByLabel("시나리오").selectOption(scenario);
  await page.getByRole("button", { name: "분석 시도" }).click();
  await page.getByRole("button", { name: "충전 패키지 보기" }).click();
}
async function records(page: Page) {
  // Deliberately simulate harness instrumentation behind the modal.
  await page.getByRole("button", { name: "기록 확인" }).evaluate((button: HTMLButtonElement) => button.click());
  return JSON.parse(await page.getByTestId("mock-records").innerText()) as {
    intents: { intentId: string; accountId: string; package: { price_krw: number }; flowId: string }[];
    exposures: { intentId: string; accountId: string; flowId: string }[];
  };
}

test("selection, keyboard, exposure and original draft preservation", async ({ page }, info) => {
  await page.goto("/dev/credit-fake-door");
  await page.getByLabel("작성 중인 내용").fill("돌아와도 남아 있어야 하는 초안");
  await page.getByRole("button", { name: "분석 시도" }).scrollIntoViewIfNeeded();
  const originalScroll = await page.evaluate(() => window.scrollY);
  await page.getByRole("button", { name: "분석 시도" }).click();
  await page.getByRole("button", { name: "충전 패키지 보기" }).click();
  await expect(page.getByRole("radio")).toHaveCount(3);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "결제하기", exact: true })).toBeDisabled();
  await expect(page.getByText("지금은 실제 결제", { exact: false })).toHaveCount(0);
  expect(await records(page)).toEqual({ intents: [], exposures: [] });
  await page.getByRole("radio").first().focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "4,900원 결제하기" })).toBeEnabled();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "9,900원 결제하기" })).toBeEnabled();
  await mkdir("e2e/preview/out", { recursive: true });
  const prices = `e2e/preview/out/frt138-${info.project.name}-prices.png`;
  await page.getByRole("heading", { name: "크레딧 충전", exact: true }).locator("../..").screenshot({ path: prices });
  await info.attach("prices", { path: prices, contentType: "image/png" });
  await page.getByRole("button", { name: "9,900원 결제하기" }).click();
  await expect(page.getByRole("dialog", { name: "크레딧 결제 안내" })).toBeVisible();
  await expect.poll(async () => (await records(page)).exposures.length).toBe(1);
  const saved = await records(page);
  expect(saved.intents).toHaveLength(1);
  expect(saved.intents[0].package.price_krw).toBe(9900);
  expect(saved.exposures[0].intentId).toBe(saved.intents[0].intentId);
  const notice = `e2e/preview/out/frt138-${info.project.name}-notice.png`;
  await page.screenshot({ path: notice, style: '[data-testid="mock-records"] { display: none !important; }' });
  await info.attach("notice", { path: notice, contentType: "image/png" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "이전 화면으로", exact: true }).click();
  await expect(page.getByLabel("작성 중인 내용")).toHaveValue("돌아와도 남아 있어야 하는 초안");
  await expect(page.getByRole("button", { name: "분석 시도" })).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(originalScroll);
  await expect(page.getByText("생성 요청: 0 · 실제 잔액 변경: 0")).toBeVisible();
});

test("catalog errors require explicit retry", async ({ page }) => {
  await openPrices(page, "catalog-error");
  await expect(page.getByRole("alert").filter({ hasText: "가격을 불러오지 못했어요." })).toHaveText("가격을 불러오지 못했어요.");
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "결제하기", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(page.getByRole("radio")).toHaveCount(3);
});

test("pending double click creates one intent and account change rejects old responses", async ({ page }) => {
  await openPrices(page, "delayed");
  await expect(page.getByRole("status").filter({ hasText: "불러오는 중이에요" })).toContainText("불러오는 중이에요");
  await page.getByRole("radio").first().focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "4,900원 결제하기" }).focus();
  await page.getByRole("button", { name: "4,900원 결제하기" }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.getByRole("dialog", { name: "크레딧 결제 안내" })).toBeVisible();
  expect(await records(page)).toEqual({ intents: [], exposures: [] });
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  const pendingPurchase = page.getByRole("button", { name: "4,900원 결제하기" });
  await expect(pendingPurchase).toBeFocused();
  await pendingPurchase.evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(async () => (await records(page)).intents.length).toBe(1);
  await expect.poll(async () => (await records(page)).exposures.length).toBe(1);
  await pendingPurchase.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "계정 전환" }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByLabel("현재 계정")).toHaveText("preview-account-b");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(3);
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  expect((await records(page)).intents).toHaveLength(1);
  await page.getByRole("radio").first().focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "4,900원 결제하기" }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await records(page)).intents.length).toBe(2);
  expect((await records(page)).intents[1].accountId).toBe("preview-account-b");
});

test("response-loss retry preserves intent identity and mission returns without generation", async ({ page }) => {
  await openPrices(page, "intent-error");
  await page.getByRole("radio").nth(2).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "19,900원 결제하기" }).click();
  await expect(page.getByRole("button", { name: "저장 다시 시도" })).toBeVisible();
  const before = await records(page);
  expect(before.intents).toHaveLength(1);
  await page.getByRole("button", { name: "저장 다시 시도" }).click();
  await expect(page.getByRole("button", { name: "저장 다시 시도" })).toHaveCount(0);
  expect((await records(page)).intents).toEqual(before.intents);
  await page.getByRole("button", { name: "미션으로 크레딧 받기" }).click();
  await expect(page.getByRole("region", { name: "미션 mock" })).toBeVisible();
  await page.getByRole("button", { name: "작성 화면으로 돌아가기" }).click();
  await expect(page.getByRole("button", { name: "분석 시도" })).toBeFocused();
  await expect(page.getByText("생성 요청: 0 · 실제 잔액 변경: 0")).toBeVisible();
});


test("notice dismissal retains page selection and restores purchase focus", async ({ page }) => {
  await openPrices(page);
  await page.getByRole("radio").nth(2).focus();
  await page.keyboard.press("Space");
  const purchase = page.getByRole("button", { name: "19,900원 결제하기" });
  for (const method of ["close", "escape", "backdrop"]) {
    await purchase.click();
    const dialog = page.getByRole("dialog", { name: "크레딧 결제 안내" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button")).toHaveCount(2);
    await expect(dialog.getByRole("button", { name: "미션으로 크레딧 받기" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "닫기", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "미션으로 크레딧 받기" })).toBeFocused();
    if (method === "close") await dialog.getByRole("button", { name: "닫기", exact: true }).click();
    else if (method === "escape") await page.keyboard.press("Escape");
    else await page.mouse.click(3, 3);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("radio").nth(2)).toBeChecked();
    await expect(purchase).toBeFocused();
  }
});
