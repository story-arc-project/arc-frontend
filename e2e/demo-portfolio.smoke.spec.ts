import { expect, test } from "@playwright/test";

/**
 * 데모 e-포트폴리오 강화 콘텐츠 스모크.
 *
 * /demo/portfolio는 공개 라우트(in-memory 핸들러)라 인증·스텁이 필요 없다.
 * 김서윤 페르소나 + 강화 섹션(나에 대해·가치관·경험 모음·목표)이 렌더되는지 확인한다.
 */
test("데모 포트폴리오: 김서윤 페르소나 + 강화 섹션 렌더", async ({ page }) => {
  await page.goto("/demo/portfolio/demo-portfolio-1");

  await expect(page.getByRole("heading", { name: "김서윤" })).toBeVisible();
  await expect(page.getByText("나에 대해")).toBeVisible();
  await expect(page.getByText("가치관")).toBeVisible();
  await expect(page.getByText("경험 모음")).toBeVisible();
  await expect(page.getByText("목표 & 성장 여정")).toBeVisible();
});
