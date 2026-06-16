import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

/**
 * FRT-62 — `/archive` 빈·데이터 상태 UX 회귀 가드.
 *
 * 세 가지 수정의 관찰 가능한 효과를 FRT-42 stateful stub 위에서 백엔드 없이
 * 결정론적으로 검증한다(앱코드 의존 0):
 *  1. 데이터 상태 — 첫 항목 자동 선택(클릭 없이 우측 상세가 채워진다). URL 은
 *     ?id 를 push 하지 않아 `/archive` 그대로 유지(뷰 기본값일 뿐).
 *  2. 데스크톱 빈 상태 — empty-state CTA 가 정확히 1개(리스트 vs 우측 패널 이중
 *     공허 메시지 제거).
 *  3. 모바일 빈 상태 — 48px+ 터치 타겟의 '새 경험 추가하기' CTA 가 보인다.
 */

test.describe("FRT-62 아카이브 빈·데이터 상태", () => {
  test("데이터 상태: 첫 경험이 클릭 없이 자동 선택돼 상세가 채워진다", async ({
    page,
  }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");

    // 클릭 없이 첫 시드 경험의 상세(h2)가 우측 패널에 렌더된다(자동 선택 증명).
    // 기본 정렬은 updated 내림차순 — 가장 최근 갱신된 "캡스톤 팀 프로젝트"(2026-02-20)가
    // filteredExperiences[0] 이라 자동 선택된다.
    await expect(
      page.getByRole("heading", { level: 2, name: "캡스톤 팀 프로젝트" }),
    ).toBeVisible();

    // 자동 선택은 뷰 기본값이라 ?id 를 push 하지 않는다 — URL 은 그대로 유지된다.
    await expect(page).toHaveURL(/\/archive$/);
  });

  test("데스크톱 빈 상태: empty-state CTA 가 정확히 1개만 보인다", async ({
    page,
  }) => {
    await stubApi(page, { authed: true, scenario: "empty" });
    await page.goto("/archive");

    // 우측 패널 히어로만 CTA 를 갖고, 리스트 패널은 데스크톱에서 passive 텍스트뿐.
    // (리스트 패널의 모바일 CTA 는 md:hidden 이라 a11y 트리에서 제외된다.)
    // getByRole 은 숨김(md:hidden) 사본을 a11y 트리에서 제외하므로, 데스크톱에서
    // 보이는 CTA(우측 히어로)만 1개로 잡힌다. 리스트 패널 모바일 CTA 는 숨겨져 0개.
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
