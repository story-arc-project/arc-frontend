import { expect, test, type Page } from "@playwright/test";
import { stubApi } from "./fixtures/stub-api";

async function expectIndependentPair(page: Page, firstLabel: string, secondLabel: string) {
  const first = page.getByLabel(firstLabel, { exact: true });
  const second = page.getByLabel(secondLabel, { exact: true });
  await first.fill("arcpass123");
  await second.fill("different123");
  await expect(page.getByText("비밀번호가 일치하지 않아요")).toBeVisible();
  await page.getByRole("button", { name: "보기", exact: true }).first().click();
  await expect(first).toHaveAttribute("type", "text");
  await expect(second).toHaveAttribute("type", "password");
  await expect(first).toHaveValue("arcpass123");
  await page.getByRole("button", { name: "보기", exact: true }).click();
  await expect(second).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "숨기기", exact: true }).first().click();
  await expect(first).toHaveAttribute("type", "password");
  await expect(second).toHaveAttribute("type", "text");
}

test("login forwards the Enter focus ref and toggles retain native selection behavior without submitting", async ({ page }) => {
  const stub = await stubApi(page);
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill("test@example.com");
  await page.getByLabel("이메일", { exact: true }).press("Enter");
  const password = page.getByLabel("비밀번호", { exact: true });
  await expect(password).toBeFocused();
  await password.fill("arcpass123");
  await password.evaluate((input: HTMLInputElement) => input.setSelectionRange(2, 5));
  const toggle = page.getByRole("button", { name: "보기", exact: true });
  await expect(toggle).toHaveAttribute("type", "button");
  await toggle.click();
  await expect(page.getByRole("button", { name: "숨기기", exact: true })).toBeFocused();
  await expect(password).toHaveAttribute("type", "text");
  expect(await password.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd])).toEqual([0, 0]);
  await page.getByRole("button", { name: "숨기기", exact: true }).press("Enter");
  await expect(password).toHaveAttribute("type", "password");
  await expect(password).toHaveValue("arcpass123");
  expect(stub.mutations.filter((m) => m.path === "/auth/login")).toHaveLength(0);
});

test("signup keeps both visibility states on leaving and reentering the password step", async ({ page }) => {
  const stub = await stubApi(page);
  await page.goto("/signup");
  await page.getByLabel("이메일", { exact: true }).fill("test@example.com");
  await page.getByRole("button", { name: "이메일로 계속하기" }).click();
  await expectIndependentPair(page, "비밀번호", "비밀번호 확인");
  await page.getByRole("button", { name: "← 이전" }).click();
  await page.getByRole("button", { name: "이메일로 계속하기" }).click();
  await expect(page.getByLabel("비밀번호", { exact: true })).toHaveAttribute("type", "password");
  await expect(page.getByLabel("비밀번호 확인", { exact: true })).toHaveAttribute("type", "text");
  await expect(page.getByLabel("비밀번호 확인", { exact: true })).toHaveValue("different123");
  expect(stub.mutations.filter((m) => m.path === "/auth/signup")).toHaveLength(0);
});

test("reset keeps both visibility states on leaving and reentering the password step", async ({ page }) => {
  const stub = await stubApi(page);
  await page.goto("/forgot-password");
  await page.getByLabel("이메일", { exact: true }).fill("test@example.com");
  await page.getByRole("button", { name: "재설정 코드 받기" }).click();
  await page.getByPlaceholder("코드 6자리 입력").fill("123456");
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await expectIndependentPair(page, "새 비밀번호", "새 비밀번호 확인");
  await page.getByRole("button", { name: "← 이전" }).click();
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await expect(page.getByLabel("새 비밀번호", { exact: true })).toHaveAttribute("type", "password");
  await expect(page.getByLabel("새 비밀번호 확인", { exact: true })).toHaveAttribute("type", "text");
  // Existing code verification clears values while retaining visibility.
  await expect(page.getByLabel("새 비밀번호 확인", { exact: true })).toHaveValue("");
  expect(stub.mutations.filter((m) => m.path === "/auth/reset-password")).toHaveLength(0);
});
