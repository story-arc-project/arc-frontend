import { expect, test } from "@playwright/test";

/**
 * 데모 e-포트폴리오 흐름 스모크.
 *
 * `/demo` 는 공개 라우트(in-memory 핸들러)라 인증·스텁이 필요 없다.
 * 생성 진입 → 인덱스(발행물 룩, GNB 숨김) → 상세 글 → 다음 경험 → 인덱스 복귀까지
 * 한 흐름이 깨지지 않는지 결정론적으로 검증한다. (FRT 테스트 매트릭스의 데모 스모크 층)
 *
 * 600ms 가짜 생성 지연은 toHaveURL 이 자동 대기한다.
 */
test("데모 e-포트폴리오: 생성 → 인덱스 → 상세 → 다음 경험 → 복귀", async ({ page }) => {
  await page.goto("/demo/export");

  // 1. 데모 전용 e-포트폴리오 진입 카드 노출
  await expect(page.getByRole("heading", { name: "e-포트폴리오" })).toBeVisible();

  // 2. 카드 클릭 → 600ms 후 인덱스로 이동
  await page.getByText("e-포트폴리오 만들기").click();
  await expect(page).toHaveURL(/\/demo\/portfolio\/demo-portfolio-1$/);

  // 3. 발행물 룩 — 히어로 렌더 + 데모 GNB(아카이브 링크) 미표시
  await expect(page.getByRole("heading", { name: "김서윤" })).toBeVisible();
  await expect(page.getByText("경험 모음")).toBeVisible();
  await expect(page.getByRole("link", { name: "아카이브" })).toHaveCount(0);

  // 4. 첫 경험 카드 진입 → 상세 글
  await page.getByRole("link", { name: /주가 예측 프로젝트/ }).first().click();
  await expect(page).toHaveURL(/\/demo\/portfolio\/demo-portfolio-1\/exp-v2-1$/);
  await expect(page.getByText("전체 포트폴리오로")).toBeVisible();

  // 5. 다음 경험으로 이동
  await page.getByRole("link", { name: /다음 경험/ }).click();
  await expect(page).toHaveURL(/\/demo\/portfolio\/demo-portfolio-1\/exp-v2-2$/);

  // 6. 전체 포트폴리오로 복귀
  await page.getByRole("link", { name: "전체 포트폴리오로" }).click();
  await expect(page).toHaveURL(/\/demo\/portfolio\/demo-portfolio-1$/);
});

test("알 수 없는 포트폴리오 id 는 시드 대신 not-found 로 fail-closed 한다", async ({ page }) => {
  // 인덱스: 임의 id 는 시드 포트폴리오를 노출하지 않고 not-found 를 보여준다.
  await page.goto("/demo/portfolio/not-real");
  await expect(page.getByRole("heading", { name: "포트폴리오를 찾을 수 없어요" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "김서윤" })).toHaveCount(0);

  // 상세: 임의 id + 임의 postId 도 동일하게 not-found.
  await page.goto("/demo/portfolio/not-real/exp-v2-1");
  await expect(page.getByRole("heading", { name: "포트폴리오를 찾을 수 없어요" })).toBeVisible();
});
