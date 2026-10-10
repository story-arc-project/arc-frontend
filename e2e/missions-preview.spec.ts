import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function open(page: Page, scenario = "normal") {
  await page.goto("/dev/missions");
  await page.getByLabel("시나리오").selectOption(scenario);
  await page.getByLabel("작성 중인 내용").fill("작성하던 내용은 돌아와도 그대로");
  await page.getByRole("button", { name: "미션 센터 열기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "미션", exact: true })).toBeVisible();
}
async function records(page: Page) {
  await page.getByRole("button", { name: "요청 기록 확인" }).click();
  return JSON.parse(await page.getByTestId("mission-requests").innerText()) as { claims: {requestId:string}[]; submissions: {requestId:string}[] };
}

test("approved layout, all ten missions, source draft and no auto generation", async ({ page }, info) => {
  await open(page);
  await expect(page.getByText("프로필 100% 완성", { exact: true })).toBeVisible();
  await expect(page.getByText("앱 알림 수신 동의", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await mkdir("e2e/preview/out", { recursive: true });
  await page.screenshot({ path: `e2e/preview/out/frt348-${info.project.name}-center.png`, fullPage: true });
  await page.getByRole("button", { name: /작성 화면으로 돌아가기/ }).click();
  await expect(page.getByLabel("작성 중인 내용")).toHaveValue("작성하던 내용은 돌아와도 그대로");
  await expect(page.getByText("자동 생성 요청: 0")).toBeVisible();
});

test("lost claim response retries same operation once and refetches balance", async ({ page }) => {
  await open(page, "claim-loss");
  await page.getByRole("button", { name: "크레딧 받기", exact: true }).first().click();
  await expect(page.getByText(/같은 요청/).first()).toBeVisible();
  await page.getByRole("button", { name: /다시 확인|다시 시도/ }).first().click();
  await expect(page.getByText("17 크레딧", { exact: true })).toBeVisible();
  await expect.poll(async () => (await records(page)).claims.length).toBe(1);
});

test("revision keeps evidence, response loss retry, approval then claim", async ({ page }, info) => {
  await open(page, "submit-loss");
  await page.getByRole("button", { name: /보완하기/ }).click();
  await expect(page.getByRole("textbox", { name: /공개 게시물 주소/ })).toHaveValue("https://example.com/my-arc-review");
  await page.getByRole("textbox", { name: /공개 게시물 주소/ }).fill("https://example.com/published-review");
  await page.screenshot({ path: `e2e/preview/out/frt348-${info.project.name}-revision.png`, fullPage: true });
  await page.getByRole("button", { name: /검토 요청/ }).click();
  await expect(page.getByText(/같은 요청/).first()).toBeVisible();
  await page.getByRole("button", { name: /다시 확인|다시 시도/ }).first().click();
  await expect.poll(async () => (await records(page)).submissions.length).toBe(1);
  await page.getByRole("button", { name: "후기 승인 시뮬레이션" }).click();
  await page.getByRole("button", { name: "크레딧 받기", exact: true }).click();
  await expect.poll(async () => (await records(page)).claims.length).toBe(1);
});

test("switching account clears mission evidence and source draft", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /보완하기/ }).click();
  await page.getByRole("textbox", { name: /함께 전할 내용/ }).fill("계정 A 전용 수정 내용");
  await page.getByRole("button", { name: "계정 전환", exact: true }).click();
  await expect(page.getByLabel("작성 중인 내용")).toHaveValue("");
  await page.getByRole("button", { name: "미션 센터 열기", exact: true }).click();
  await page.getByRole("button", { name: /보완하기/ }).click();
  await expect(page.getByRole("textbox", { name: /함께 전할 내용/ })).not.toHaveValue("계정 A 전용 수정 내용");
});

test("balance retry after confirmed claim does not regrant", async ({ page }) => {
  await open(page, "balance-error");
  await page.getByRole("button", { name: "크레딧 받기", exact: true }).first().click();
  await expect(page.getByText("보상은 수령했어요. 잔액을 다시 확인해 주세요.").first()).toBeVisible();
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByText("17 크레딧", { exact: true })).toBeVisible();
  await expect.poll(async () => (await records(page)).claims.length).toBe(1);
});

test("embedded mission dialog keeps source input and restores keyboard focus", async ({ page }) => {
  await page.goto("/dev/missions");
  await page.getByLabel("작성 중인 내용").fill("대화상자 뒤에 남아 있는 초안");
  await page.getByRole("button", { name: "부족 안내 열기" }).click();
  await page.getByRole("button", { name: "미션 둘러보기" }).click();
  const dialog = page.getByRole("dialog", { name: "크레딧 미션" });
  await expect(dialog.getByRole("heading", { name: "미션", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "미션 둘러보기" })).toBeFocused();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.getByLabel("작성 중인 내용")).toHaveValue("대화상자 뒤에 남아 있는 초안");
  await expect(page.getByText("자동 생성 요청: 0")).toBeVisible();
});

test("missing mission status never becomes a zero total or fabricated eligibility", async ({ page }) => {
  for (const scenario of ["load-error", "empty", "partial"]) {
    await open(page, scenario);
    await expect(page.getByText("확인할 수 없어요", { exact: true })).toBeVisible();
    if (scenario !== "partial") await expect(page.getByRole("button", { name: "크레딧 받기", exact: true })).toHaveCount(0);
    else await expect(page.getByText("상태 확인 불가").first()).toBeVisible();
  }
});
