import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

/**
 * FRT-43 — 경험 CRUD 동작(behavior) E2E.
 *
 * 스모크(렌더 검증) 너머, 실제 UI 조작의 **결과**(목록·상세 반영, 변이 payload)를
 * Arrange→Act→Assert 로 검증한다. FRT-42 stateful mock 위에서 백엔드 없이 결정론적으로
 * 통과한다. (FRT-42 는 mock 메커니즘 자체를 direct fetch 로 고정했고, 여기서는 같은
 * 변이 흐름을 **사용자 조작 경로**로 검증한다.)
 *
 * 한 테스트에 생성→편집→삭제를 모두 담는 이유: 시드 경험은 content.coreBlocks 가 비어
 * 있어 편집 폼의 "경험명" 입력이 렌더되지 않으므로(=제목 편집을 단언할 수 없음), UI 로
 * 직접 생성한 경험(공통 코어 블록 = 경험명 포함)을 이어서 편집·삭제한다. 이는 곧
 * 신규 기능의 TDD 본보기(생성 항목을 끝까지 따라가는 흐름)이기도 하다.
 */

test.describe("FRT-43 경험 CRUD 동작", () => {
  test("새 경험 생성 → 편집 → 삭제가 목록·상세에 반영된다", async ({ page }) => {
    const stub = await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");

    // Arrange 확인: 시드 경험 2건이 로드돼 목록 카드(h3)로 보인다.
    await expect(
      page.getByRole("heading", { level: 3, name: "교내 개발 동아리 운영진" }),
    ).toBeVisible();

    // ── CREATE ─────────────────────────────────────────────────────────────
    // "새 경험 추가" 버튼은 사이드바·빈 우패널 두 곳에 동일 이름으로 있다(첫 번째 사용).
    await page
      .getByRole("button", { name: "새 경험 추가", exact: true })
      .first()
      .click();

    // 유형을 선택해야 비로소 경험명 입력·완료 버튼이 렌더된다(template 로드 후).
    await page.getByRole("button", { name: "대외활동", exact: true }).click();
    await page.getByRole("textbox", { name: "경험명" }).fill("E2E 동작 검증 경험");
    await page.getByRole("textbox", { name: "한 줄 요약" }).fill("생성 동작 검증");
    // exact: 경험 카드(role=button)의 접근성 이름이 상태 배지 "완료"를 포함하므로
    // 폼의 완료 버튼만 정확히 매칭한다.
    await page.getByRole("button", { name: "완료", exact: true }).click();

    // 변이 payload 단언: POST /experiences/ 에 유형·제목·상태가 담겨 전송된다.
    const creates = stub.mutations.filter(
      (m) => m.method === "POST" && m.path === "/experiences/",
    );
    expect(creates).toHaveLength(1);
    expect(creates[0].body).toMatchObject({
      type: "extracurricular",
      content: { title: "E2E 동작 검증 경험", status: "complete" },
    });

    // 결과: 목록 카드(h3) + 상세 제목(h2)에 새 경험이 반영된다.
    await expect(
      page.getByRole("heading", { level: 3, name: "E2E 동작 검증 경험" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "E2E 동작 검증 경험" }),
    ).toBeVisible();

    // ── UPDATE ─────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "수정", exact: true }).click();
    const titleInput = page.getByRole("textbox", { name: "경험명" });
    await expect(titleInput).toHaveValue("E2E 동작 검증 경험");
    await titleInput.fill("E2E 수정된 경험");
    await page.getByRole("button", { name: "완료", exact: true }).click();

    // 변이 payload 단언: PUT /experiences/{newId} 에 수정된 content 가 전송된다.
    const updates = stub.mutations.filter(
      (m) => m.method === "PUT" && m.path.startsWith("/experiences/"),
    );
    expect(updates).toHaveLength(1);
    expect(updates[0].body).toMatchObject({
      content: { title: "E2E 수정된 경험" },
    });

    // 결과: 옛 제목은 사라지고 새 제목이 목록·상세에 반영된다.
    await expect(
      page.getByRole("heading", { level: 3, name: "E2E 수정된 경험" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "E2E 수정된 경험" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "E2E 동작 검증 경험" }),
    ).toHaveCount(0);

    // ── DELETE ─────────────────────────────────────────────────────────────
    // 라이브러리 사이드바(nav)에도 "삭제" 버튼이 있어, 상세 헤더 액션바(수정·복제·삭제)
    // 내부로 한정한다. 복제는 사이드바에 없는 고유 버튼이라 액션바의 앵커로 쓴다.
    const detailActions = page
      .getByRole("button", { name: "복제", exact: true })
      .locator("..");
    await detailActions.getByRole("button", { name: "삭제", exact: true }).click();
    await page
      .getByRole("dialog", { name: "경험 삭제 확인" })
      .getByRole("button", { name: "삭제", exact: true })
      .click();

    // 변이 payload 단언: DELETE /experiences/{newId} 가 전송된다.
    const deletes = stub.mutations.filter(
      (m) => m.method === "DELETE" && m.path.startsWith("/experiences/"),
    );
    expect(deletes).toHaveLength(1);

    // 결과: 삭제한 경험 카드는 목록에서 사라지고, 시드 2건은 남는다.
    await expect(
      page.getByRole("heading", { level: 3, name: "E2E 수정된 경험" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 3, name: "교내 개발 동아리 운영진" }),
    ).toBeVisible();
  });
});
