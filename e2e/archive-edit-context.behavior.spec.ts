import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

/**
 * FRT-82 — 편집 라우트 진입·복귀 시 리스트의 라이브러리/필터 컨텍스트 보존.
 *
 * `/archive` 목록에서 카드 편집으로 나갈 때, 그 시점의 활성 필터(검색어 등)를
 * `returnTo` 쿼리(basePath 내장 완성형 상대 URL)에 실어 편집 라우트로 넘긴다.
 * 편집 라우트의 "목록으로"/저장은 이 returnTo 로 복귀하고, 리스트는 마운트 시
 * URL 쿼리에서 컨텍스트를 1회 복원한다(lib/utils/archive-context.ts).
 *
 * data 시나리오 고정값(e2e/fixtures/api-data.ts):
 *  - exp-e2e-2 "캡스톤 팀 프로젝트"(최신, draft)
 *  - exp-e2e-1 "교내 개발 동아리 운영진"(complete)
 */

test.describe("FRT-82 아카이브 편집 왕복 컨텍스트 보존", () => {
  test("검색 필터로 좁힌 뒤 편집 진입 → 목록으로 복귀 시 검색·선택이 그대로 유지된다", async ({
    page,
  }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");

    // 검색으로 "캡스톤 팀 프로젝트" 1건만 남긴다.
    await page.getByPlaceholder("경험 검색...").first().fill("캡스톤");
    await expect(
      page.getByRole("heading", { level: 3, name: "캡스톤 팀 프로젝트" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "교내 개발 동아리 운영진" }),
    ).toHaveCount(0);

    // 유일하게 보이는 카드의 "더보기" → "편집"으로 진입한다.
    await page.getByRole("button", { name: "더보기", exact: true }).click();
    await page.getByRole("button", { name: "편집" }).click();

    // URL 이 편집 라우트로 바뀌고, returnTo 에 검색어(q=캡스톤)와 id 가 인코딩돼 있다.
    await expect(page).toHaveURL(/\/archive\/exp-e2e-2\/edit\?returnTo=/);
    const editUrl = new URL(page.url());
    const returnTo = decodeURIComponent(editUrl.searchParams.get("returnTo")!);
    expect(returnTo).toBe("/archive?q=캡스톤&id=exp-e2e-2");

    // 편집 화면에서 "목록으로"로 복귀(데스크톱 좌측 레일 버튼 — 폭이 좁은 헤더 버튼도
    // 동일 accessible name 을 갖지만 lg 뷰포트에서는 레일 쪽만 보인다).
    await page
      .getByRole("button", { name: "목록으로 돌아가기" })
      .first()
      .click();

    // 복귀 URL 에 검색어(q)와 id 가 남아 있어야 한다.
    await expect(page).toHaveURL(/\/archive\?q=.*&id=exp-e2e-2/);
    const backUrl = new URL(page.url());
    expect(backUrl.searchParams.get("q")).toBe("캡스톤");

    // 검색창에도 복원된 검색어가 그대로 보이고, 목록은 여전히 1건으로 좁혀져 있다.
    await expect(page.getByPlaceholder("경험 검색...").first()).toHaveValue("캡스톤");
    await expect(
      page.getByRole("heading", { level: 3, name: "캡스톤 팀 프로젝트" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "교내 개발 동아리 운영진" }),
    ).toHaveCount(0);
  });

  test("필터 없이 편집 진입 → 목록으로 복귀 시 전체 목록으로 정상 복귀한다(회귀 없음)", async ({
    page,
  }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");

    // 검색 없이 "교내 개발 동아리 운영진" 카드를 바로 편집 진입한다.
    const card = page
      .locator('[role="button"]', {
        has: page.getByRole("heading", { level: 3, name: "교내 개발 동아리 운영진" }),
      })
      .first();
    await card.getByRole("button", { name: "더보기" }).click();
    await page.getByRole("button", { name: "편집" }).click();

    await expect(page).toHaveURL(/\/archive\/exp-e2e-1\/edit\?returnTo=/);
    const editUrl = new URL(page.url());
    const returnTo = decodeURIComponent(editUrl.searchParams.get("returnTo")!);
    // 컨텍스트가 없으므로 returnTo 에는 id 만 실린다(q 등 필터 파라미터 없음).
    expect(returnTo).toBe("/archive?id=exp-e2e-1");

    await page
      .getByRole("button", { name: "목록으로 돌아가기" })
      .first()
      .click();

    // 필터 없는 전체 목록으로 복귀 — 두 카드 모두 다시 보인다.
    await expect(page).toHaveURL(/\/archive\?id=exp-e2e-1/);
    await expect(page.getByPlaceholder("경험 검색...").first()).toHaveValue("");
    await expect(
      page.getByRole("heading", { level: 3, name: "캡스톤 팀 프로젝트" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "교내 개발 동아리 운영진" }),
    ).toBeVisible();
  });

  test("검색 필터로 좁힌 뒤 편집 진입 → 저장 완료 시에도 검색·id 컨텍스트가 유지된다", async ({
    page,
  }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");

    await page.getByPlaceholder("경험 검색...").first().fill("캡스톤");
    await page.getByRole("button", { name: "더보기", exact: true }).click();
    await page.getByRole("button", { name: "편집" }).click();
    await expect(page).toHaveURL(/\/archive\/exp-e2e-2\/edit\?returnTo=/);

    // 데스크톱 좌측 레일의 "완료" 저장 버튼(SectionNav) — 폼을 건드리지 않아도
    // 기존 제목이 있으므로 검증을 통과하고 저장이 성공한다.
    await page.getByRole("button", { name: "완료", exact: true }).click();

    // 저장 성공 → backTo(검색어+id 보존)로 복귀.
    await expect(page).toHaveURL(/\/archive\?q=.*&id=exp-e2e-2/);
    const backUrl = new URL(page.url());
    expect(backUrl.searchParams.get("q")).toBe("캡스톤");
    await expect(page.getByPlaceholder("경험 검색...").first()).toHaveValue("캡스톤");
    await expect(
      page.getByRole("heading", { level: 3, name: "캡스톤 팀 프로젝트" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "교내 개발 동아리 운영진" }),
    ).toHaveCount(0);
  });
});
