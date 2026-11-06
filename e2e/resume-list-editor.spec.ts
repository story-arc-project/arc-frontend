import { expect, test } from "@playwright/test";

import type { ResumeVersion } from "@/types/resume";
import { stubApi } from "./fixtures/stub-api";

test("FRT-189 목록 추가·입력·중간 삭제 후 순서와 저장 데이터가 유지된다", async ({ page }) => {
  const stub = await stubApi(page, { authed: true, scenario: "data" });
  await page.goto("/export/resume/resume-e2e-1");
  const projectToggle = page.getByRole("button", { name: /^프로젝트(?: \d+)?$/ });
  await projectToggle.click();
  const projects = page.locator("section").filter({ has: projectToggle });
  const names = projects.getByLabel("프로젝트명", { exact: true });
  const add = projects.getByRole("button", { name: "프로젝트 추가", exact: true });

  await add.click();
  await names.nth(0).fill("첫 프로젝트");
  await expect(names.nth(0)).toBeFocused();
  await projects.getByLabel("소속 기관", { exact: true }).nth(0).fill("ARC");
  await add.click();
  await names.nth(1).fill("삭제할 프로젝트");
  await add.click();
  await names.nth(2).pressSequentially("마지막 프로젝트");
  await expect(names.nth(2)).toBeFocused();
  await expect(names.nth(0)).toHaveValue("첫 프로젝트");

  await projects.getByRole("button", { name: "삭제", exact: true }).nth(1).click();
  await expect(names).toHaveCount(2);
  await expect(names.nth(0)).toHaveValue("첫 프로젝트");
  await expect(names.nth(1)).toHaveValue("마지막 프로젝트");
  await names.nth(1).fill("마지막 프로젝트 수정");
  await expect(names.nth(1)).toBeFocused();

  const save = page.getByRole("button", { name: "저장", exact: true });
  await save.click();
  await expect(save).toBeDisabled();
  const updates = stub.mutations.filter(
    (mutation) => mutation.method === "PATCH" && mutation.path === "/export/resume/resume-e2e-1",
  );
  expect(updates).toHaveLength(1);
  const result = (updates[0].body as { result: ResumeVersion }).result;
  expect(result.프로젝트).toEqual([
    {
      id: expect.any(Number), 프로젝트명: "첫 프로젝트", 소속기관: "ARC",
      기간_시작: null, 기간_종료: null, 기간_원문: null, 역할: null,
      사용기술: [], 내용: [], 성과: [],
    },
    {
      id: expect.any(Number), 프로젝트명: "마지막 프로젝트 수정", 소속기관: null,
      기간_시작: null, 기간_종료: null, 기간_원문: null, 역할: null,
      사용기술: [], 내용: [], 성과: [],
    },
  ]);
  expect(result.프로젝트[0].id).toBeLessThan(0);
  expect(result.프로젝트[1].id).toBeLessThan(result.프로젝트[0].id);
  expect(result.학력[0]).toMatchObject({ id: 1, 학교명: "ARC 대학교", 학과: "컴퓨터공학과" });

  await page.reload();
  await projectToggle.click();
  await expect(names).toHaveCount(2);
  await expect(names.nth(0)).toHaveValue("첫 프로젝트");
  await expect(names.nth(1)).toHaveValue("마지막 프로젝트 수정");
  await expect(projects.getByLabel("소속 기관", { exact: true }).nth(0)).toHaveValue("ARC");
});
