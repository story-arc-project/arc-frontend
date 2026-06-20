import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

/**
 * FRT-62 / FRT-75 — `/archive` 목록 뷰 빈·데이터 상태 UX 회귀 가드.
 *
 * FRT-75 에서 목록 뷰가 메인이 되고 미리보기는 카드 클릭 시에만 우측에 도킹된다
 * (노션형 push peek). 진입 시 자동선택은 의도적으로 폐기됐다. 아래는 FRT-42
 * stateful stub 위에서 백엔드 없이 결정론적으로 검증한다(앱코드 의존 0):
 *  1. 데이터 상태 — 진입 시 미리보기는 닫혀 있고(상세 h2 없음) 첫 카드(h3)만
 *     목록에 보인다. 카드 클릭 시 우측에 상세가 도킹되고 ?id 가 push 된다.
 *  2. 데스크톱 빈 상태 — empty-state CTA 가 정확히 1개(목록 영역 히어로).
 *  3. 모바일 빈 상태 — 48px+ 터치 타겟의 '새 경험 추가하기' CTA 가 보인다.
 */

test.describe("FRT-62/FRT-75 아카이브 빈·데이터 상태", () => {
  test("데이터 상태: 진입 시 미리보기는 닫혀 있고, 카드 클릭 시 우측에 도킹된다", async ({
    page,
  }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");

    // 기본 정렬은 updated 내림차순 — 가장 최근 갱신된 "캡스톤 팀 프로젝트"(2026-02-20)가
    // 목록 첫 카드(h3)다. 자동선택은 폐기됐으므로 진입 시 상세(h2)는 렌더되지 않고
    // URL 도 ?id 없이 그대로다.
    await expect(
      page.getByRole("heading", { level: 3, name: "캡스톤 팀 프로젝트" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "캡스톤 팀 프로젝트" }),
    ).toHaveCount(0);
    await expect(page).toHaveURL(/\/archive$/);

    // 카드 클릭 → 우측 미리보기(상세 h2) 도킹 + ?id push.
    await page
      .getByRole("heading", { level: 3, name: "캡스톤 팀 프로젝트" })
      .click();
    await expect(
      page.getByRole("heading", { level: 2, name: "캡스톤 팀 프로젝트" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/archive\?id=/);
  });

  test("브라우저 Back 으로 ?id 가 사라지면 미리보기가 닫힌다", async ({ page }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");

    await page
      .getByRole("heading", { level: 3, name: "캡스톤 팀 프로젝트" })
      .click();
    await expect(
      page.getByRole("heading", { level: 2, name: "캡스톤 팀 프로젝트" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/archive\?id=/);

    // Back → URL 이 ?id 없는 목록 상태로 돌아가면 도킹된 미리보기도 닫힌다.
    await page.goBack();
    await expect(page).toHaveURL(/\/archive$/);
    await expect(
      page.getByRole("heading", { level: 2, name: "캡스톤 팀 프로젝트" }),
    ).toHaveCount(0);
  });

  test("데스크톱 빈 상태: empty-state CTA 가 정확히 1개만 보인다", async ({
    page,
  }) => {
    await stubApi(page, { authed: true, scenario: "empty" });
    await page.goto("/archive");

    // 경험 0건이면 목록 영역이 히어로 CTA 를 단독으로 렌더한다(미리보기 미도킹).
    // 데스크톱/모바일 레이아웃은 각각 hidden md:flex / md:hidden 으로 한쪽만 a11y
    // 트리에 노출되므로, 데스크톱 뷰포트에서 '새 경험 추가하기' 는 정확히 1개다.
    // (상단 toolbar 의 버튼은 '새 경험' 이라 이름이 달라 잡히지 않는다.)
    await expect(
      page.getByRole("button", { name: "새 경험 추가하기" }),
    ).toHaveCount(1);
  });

  test("모바일 빈 상태: 48px+ 터치 타겟의 CTA 가 보인다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubApi(page, { authed: true, scenario: "empty" });
    await page.goto("/archive");

    const cta = page.getByRole("button", { name: "새 경험 추가하기" });
    await expect(cta).toBeVisible();

    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(48);
  });
});
