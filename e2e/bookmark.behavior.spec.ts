import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

/**
 * FRT-43 — 북마크(즐겨찾기) 토글 동작(behavior) E2E.
 *
 * 종합 분석 목록에서 북마크 추가(POST) → /analysis/bookmarks 목록에 반영, 해제(DELETE)
 * → 목록에서 사라짐을, 토글 상태·목록 반영·변이 payload 로 검증한다.
 *
 * ⚠️ 백엔드 BAC-27(분석 즐겨찾기 엔드포인트) 미구현 → stateful mock 으로 프론트 동작을
 * 선검증한다. mock↔실 백엔드 계약 드리프트는 FRT-33(통합 E2E)에서 재대조한다.
 *
 * ⚠️ 이슈 본문은 "analysis 상세에서 북마크"라 적었으나, 실제 BookmarkToggle 은 분석 상세가
 * 아니라 **목록/허브 페이지**(종합·키워드·즐겨찾기 등)에 있다. 멀티페이지 반영(AC)을
 * 만족하도록 "종합 목록에서 북마크 → 즐겨찾기 목록에서 확인" 경로로 검증한다.
 */

test.describe("FRT-43 북마크 토글 동작", () => {
  test("종합 목록에서 북마크 → 즐겨찾기 목록 반영 → 해제 시 사라진다", async ({ page }) => {
    const stub = await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/analysis/comprehensive");

    // Arrange: comp-1(전체 경험 종합 분석)이 목록에 있고, 아직 북마크 전이다.
    await expect(
      page.getByRole("link", { name: /전체 경험 종합 분석/ }),
    ).toBeVisible();
    // exact: "즐겨찾기"는 "즐겨찾기 해제"의 부분 문자열이라 정확 매칭으로 미북마크 상태만 잡는다.
    const addToggle = page.getByRole("button", { name: "즐겨찾기", exact: true });
    await expect(addToggle).toBeVisible();

    // ── ADD ────────────────────────────────────────────────────────────────
    await addToggle.click();

    // 결과(토글 상태): 같은 버튼이 "즐겨찾기 해제"로 바뀐다.
    await expect(
      page.getByRole("button", { name: "즐겨찾기 해제" }),
    ).toBeVisible();
    // 변이 payload 단언: POST /analysis/bookmarks/comp-1 (body 없음)이 전송된다.
    const adds = stub.mutations.filter(
      (m) => m.method === "POST" && m.path === "/analysis/bookmarks/comp-1",
    );
    expect(adds).toHaveLength(1);

    // ── 멀티페이지 반영 ──────────────────────────────────────────────────────
    await page.goto("/analysis/bookmarks");
    await expect(page.getByRole("heading", { level: 1, name: "즐겨찾기" })).toBeVisible();
    // 방금 추가한 comp-1 + 시드 북마크 ind-1 이 함께 보인다.
    await expect(
      page.getByRole("link", { name: /전체 경험 종합 분석/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /교내 개발 동아리 운영진 분석/ }),
    ).toBeVisible();

    // ── REMOVE ─────────────────────────────────────────────────────────────
    // 두 항목 모두 "즐겨찾기 해제"를 가지므로, comp-1 행(링크의 부모) 안에서만 클릭한다.
    const compRow = page
      .getByRole("link", { name: /전체 경험 종합 분석/ })
      .locator("..");
    await compRow.getByRole("button", { name: "즐겨찾기 해제" }).click();

    // 결과: comp-1 은 즐겨찾기 목록에서 사라지고, 시드 ind-1 은 남는다.
    await expect(
      page.getByRole("link", { name: /전체 경험 종합 분석/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /교내 개발 동아리 운영진 분석/ }),
    ).toBeVisible();
    // 변이 payload 단언: DELETE /analysis/bookmarks/comp-1 이 전송된다.
    const removes = stub.mutations.filter(
      (m) => m.method === "DELETE" && m.path === "/analysis/bookmarks/comp-1",
    );
    expect(removes).toHaveLength(1);
  });
});
