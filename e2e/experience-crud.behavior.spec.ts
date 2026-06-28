import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

/**
 * FRT-43 — 경험 CRUD 동작(behavior) E2E.
 *
 * 스모크(렌더 검증) 너머, 실제 UI 조작의 **결과**(목록·상세 반영, 변이 payload)를
 * Arrange→Act→Assert 로 검증한다. FRT-42 stateful mock 위에서 백엔드 없이 결정론적으로
 * 통과한다.
 *
 * FRT-74: 입력(새 경험/편집)이 별도 라우트(`/archive/new`·`/archive/[id]/edit`)로
 * 분리됐다. 생성/편집은 더 이상 목록 페이지의 우측 패널 폼이 아니라 입력 전용 라우트로
 * 이동하므로, 각 조작 뒤에 `waitForURL` 로 라우트 전환을 기다린 다음 폼을 조작한다.
 * 폼 필드·완료 버튼의 접근성 이름(aria-label/role)은 셸 이관 후에도 동일하다.
 *
 * 한 테스트에 생성→편집→삭제를 모두 담는 이유: 시드 경험은 content.coreBlocks 가 비어
 * 있어 편집 폼의 "경험명" 입력이 렌더되지 않으므로(=제목 편집을 단언할 수 없음), UI 로
 * 직접 생성한 경험(공통 코어 블록 = 경험명 포함)을 이어서 편집·삭제한다.
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
    // "새 경험 추가"(사이드바)는 입력 전용 라우트 /archive/new 로 이동시킨다.
    await page
      .getByRole("button", { name: "새 경험 추가", exact: true })
      .first()
      .click();
    await page.waitForURL(/\/archive\/new/);

    // 유형을 선택해야 비로소 경험명 입력이 렌더된다(template 로드 후). 완료 버튼은
    // 입력 뷰 셸(InputViewShell)의 sticky 액션 바에 있다(이름 "완료" 동일).
    await page.getByRole("button", { name: "대외활동", exact: true }).click();
    await page.getByRole("textbox", { name: "경험명" }).fill("E2E 동작 검증 경험");
    await page.getByRole("textbox", { name: "한 줄 요약" }).fill("생성 동작 검증");
    await page.getByRole("button", { name: "완료", exact: true }).click();

    // 저장 성공 → 목록(?id=) 으로 복귀한다.
    await page.waitForURL(/\/archive\?id=/);

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
    // 상세의 "수정" 은 /archive/{id}/edit 로 이동시킨다.
    await page.getByRole("button", { name: "수정", exact: true }).click();
    await page.waitForURL(/\/archive\/.+\/edit/);
    const titleInput = page.getByRole("textbox", { name: "경험명" });
    await expect(titleInput).toHaveValue("E2E 동작 검증 경험");
    await titleInput.fill("E2E 수정된 경험");
    await page.getByRole("button", { name: "완료", exact: true }).click();

    // 저장 성공 → 목록(?id=) 으로 복귀한다.
    await page.waitForURL(/\/archive\?id=/);

    // 결과(관찰 가능한 UI 효과)를 먼저 await 한다: 옛 제목은 사라지고 새 제목이
    // 목록·상세에 반영된다.
    await expect(
      page.getByRole("heading", { level: 3, name: "E2E 수정된 경험" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "E2E 수정된 경험" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "E2E 동작 검증 경험" }),
    ).toHaveCount(0);

    // 변이 payload 단언: PUT /experiences/{newId} 에 수정된 content 가 전송된다.
    const updates = stub.mutations.filter(
      (m) => m.method === "PUT" && m.path.startsWith("/experiences/"),
    );
    expect(updates).toHaveLength(1);
    expect(updates[0].body).toMatchObject({
      content: { title: "E2E 수정된 경험" },
    });

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

    // 결과: 삭제한 경험 카드는 목록에서 사라지고, 시드 2건은 남는다.
    await expect(
      page.getByRole("heading", { level: 3, name: "E2E 수정된 경험" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 3, name: "교내 개발 동아리 운영진" }),
    ).toBeVisible();

    // 변이 payload 단언: DELETE /experiences/{newId} 가 전송된다.
    const deletes = stub.mutations.filter(
      (m) => m.method === "DELETE" && m.path.startsWith("/experiences/"),
    );
    expect(deletes).toHaveLength(1);
  });
});

/**
 * FRT-74/53 — 입력 뷰 미저장 이탈 가드.
 *
 * 입력 전용 라우트(/archive/new·/archive/[id]/edit)에서 미저장 상태로 "목록으로"를
 * 누르면 이탈 가드 모달이 떠야 하고, '취소' 시 작성 중 내용·URL 이 보존되고, '나가기'
 * 후에만 목록으로 이동해야 한다. (라우트 분리 전에는 목록과 폼이 한 화면에 공존해
 * "편집 중 다른 카드 컨텍스트 메뉴"로 가드를 검증했으나, 입력 라우트에는 목록이 없으므로
 * "목록으로" 트리거로 가드 정확성을 검증한다 — FRT-53 가드 시맨틱 보존.)
 */
test.describe("FRT-74 입력 뷰 미저장 이탈 가드", () => {
  // /archive/new 에서 유형 선택 + 경험명 입력으로 미저장(hasUnsaved) 상태를 만든다.
  async function arrangeUnsavedNewForm(page: import("@playwright/test").Page) {
    await page.goto("/archive");
    await page
      .getByRole("button", { name: "새 경험 추가", exact: true })
      .first()
      .click();
    await page.waitForURL(/\/archive\/new/);
    await page.getByRole("button", { name: "대외활동", exact: true }).click();
    await page
      .getByRole("textbox", { name: "경험명" })
      .fill("가드 검증 작성 중 경험");
  }

  test("미저장 입력 중 '목록으로' → 가드 모달이 뜨고 '취소'하면 보존된다", async ({
    page,
  }) => {
    const stub = await stubApi(page, { authed: true, scenario: "data" });
    await arrangeUnsavedNewForm(page);

    await page.getByRole("button", { name: "목록으로 돌아가기" }).click();

    // 즉시 이동하지 않고 unsaved 가드 모달이 뜬다.
    const guard = page.getByRole("dialog", { name: "저장하지 않고 나갈까요?" });
    await expect(guard).toBeVisible();

    // '취소' → 입력 라우트에 그대로 남고, 작성 중 내용도 보존된다. 저장 변이도 없다.
    await guard.getByRole("button", { name: "취소", exact: true }).click();
    await expect(guard).toBeHidden();
    await expect(page).toHaveURL(/\/archive\/new/);
    await expect(page.getByRole("textbox", { name: "경험명" })).toHaveValue(
      "가드 검증 작성 중 경험",
    );
    expect(
      stub.mutations.filter(
        (m) => m.method === "POST" && m.path === "/experiences/",
      ),
    ).toHaveLength(0);
  });

  test("미저장 입력 중 '목록으로' → '나가기' 후에만 목록으로 이동한다", async ({
    page,
  }) => {
    const stub = await stubApi(page, { authed: true, scenario: "data" });
    await arrangeUnsavedNewForm(page);

    await page.getByRole("button", { name: "목록으로 돌아가기" }).click();
    const guard = page.getByRole("dialog", { name: "저장하지 않고 나갈까요?" });
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "나가기", exact: true }).click();

    // '나가기' 후 목록으로 복귀하고, 저장 변이는 없었다(작성 내용 폐기).
    await page.waitForURL(/\/archive$/);
    await expect(
      page.getByRole("heading", { level: 3, name: "교내 개발 동아리 운영진" }),
    ).toBeVisible();
    expect(
      stub.mutations.filter(
        (m) => m.method === "POST" && m.path === "/experiences/",
      ),
    ).toHaveLength(0);
  });
});

/**
 * FRT-81 — 입력 라우트 미저장 상태 브라우저 Back 가드.
 *
 * App Router 에서 브라우저 Back 은 popstate(SPA 전환)라 beforeunload 가 발화하지 않는다.
 * useUnsavedNavGuard 의 history sentinel + popstate 리스너가 Back 을 가로채 "목록으로"와
 * 동일한 이탈 가드 모달을 띄우고, '취소' 시 URL·작성 내용을 보존하며 '나가기' 후에만
 * 실제로 목록으로 이동해야 한다.
 */
test.describe("FRT-81 입력 뷰 브라우저 Back 가드", () => {
  async function arrangeUnsavedNewForm(page: import("@playwright/test").Page) {
    await page.goto("/archive");
    await page
      .getByRole("button", { name: "새 경험 추가", exact: true })
      .first()
      .click();
    await page.waitForURL(/\/archive\/new/);
    const lenBefore = await page.evaluate(() => window.history.length);
    await page.getByRole("button", { name: "대외활동", exact: true }).click();
    await page
      .getByRole("textbox", { name: "경험명" })
      .fill("Back 가드 작성 중 경험");
    // 미저장 → useUnsavedNavGuard 가 history sentinel 을 push(arm)할 때까지 대기.
    // popstate 가드의 전제 조건이며, 입력 직후 즉시 Back 하는 레이스를 막는다(임의 sleep 대신
    // 기능에 직결된 조건 대기).
    await page.waitForFunction(
      (n) => window.history.length > n,
      lenBefore,
    );
  }

  test("미저장 입력 중 브라우저 Back → 가드 모달이 뜨고 '취소'하면 보존된다", async ({
    page,
  }) => {
    const stub = await stubApi(page, { authed: true, scenario: "data" });
    await arrangeUnsavedNewForm(page);

    await page.goBack();

    // beforeunload 가 아니라 popstate 가드가 모달을 띄운다. URL 은 입력 라우트 유지.
    const guard = page.getByRole("dialog", { name: "저장하지 않고 나갈까요?" });
    await expect(guard).toBeVisible();
    await expect(page).toHaveURL(/\/archive\/new/);

    await guard.getByRole("button", { name: "취소", exact: true }).click();
    await expect(guard).toBeHidden();
    await expect(page).toHaveURL(/\/archive\/new/);
    await expect(page.getByRole("textbox", { name: "경험명" })).toHaveValue(
      "Back 가드 작성 중 경험",
    );
    expect(
      stub.mutations.filter(
        (m) => m.method === "POST" && m.path === "/experiences/",
      ),
    ).toHaveLength(0);
  });

  test("미저장 입력 중 브라우저 Back → '나가기' 후에만 목록으로 이동한다", async ({
    page,
  }) => {
    const stub = await stubApi(page, { authed: true, scenario: "data" });
    await arrangeUnsavedNewForm(page);

    await page.goBack();
    const guard = page.getByRole("dialog", { name: "저장하지 않고 나갈까요?" });
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "나가기", exact: true }).click();

    await page.waitForURL(/\/archive$/);
    await expect(
      page.getByRole("heading", { level: 3, name: "교내 개발 동아리 운영진" }),
    ).toBeVisible();
    expect(
      stub.mutations.filter(
        (m) => m.method === "POST" && m.path === "/experiences/",
      ),
    ).toHaveLength(0);
  });
});

/**
 * FRT-52 — 편집 모드 진입 즉시 dirty 위양성 회귀 가드 (라우트 분리판).
 *
 * 버그: 편집 모드 진입 시 아무것도 안 바꿔도 hasUnsaved=true 가 되어, 이탈 시 항상 가드
 * 모달이 떴다. 라우트 분리 후에도 동일 회귀를 막는다 — 편집 라우트에 무수정 진입 후
 * "목록으로"를 누르면 가드 없이 곧장 목록으로 나가야 한다.
 */
test.describe("FRT-52 편집 진입 dirty 위양성 회귀", () => {
  // 카드의 '더보기' 메뉴를 열고 '편집' 을 눌러 그 카드의 편집 라우트로 진입한다.
  async function openCardEdit(
    page: import("@playwright/test").Page,
    cardName: string,
  ) {
    await page
      .getByRole("heading", { level: 3, name: cardName })
      .locator("..")
      .getByRole("button", { name: "더보기", exact: true })
      .click();
    await page.getByText("편집", { exact: true }).click();
  }

  test("카드 '편집' 은 그 카드의 편집 라우트를 연다", async ({ page }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");

    await openCardEdit(page, "교내 개발 동아리 운영진");
    await page.waitForURL(/\/archive\/.+\/edit/);

    // 올바른 카드가 편집 모드로 열린다(경험명 입력 + 완료 버튼 존재).
    await expect(page.getByRole("textbox", { name: "경험명" })).toHaveValue(
      "교내 개발 동아리 운영진",
    );
    await expect(
      page.getByRole("button", { name: "완료", exact: true }),
    ).toBeVisible();
  });

  test("무수정 편집 진입 후 '목록으로' → 가드 없이 목록으로 나간다", async ({
    page,
  }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");

    // 한 카드를 편집 라우트로 열되 아무것도 수정하지 않는다.
    await openCardEdit(page, "교내 개발 동아리 운영진");
    await page.waitForURL(/\/archive\/.+\/edit/);
    await expect(page.getByRole("textbox", { name: "경험명" })).toHaveValue(
      "교내 개발 동아리 운영진",
    );

    // '목록으로' → 미수정이므로 가드 없이 곧장 목록으로 나간다(false-dirty 회귀 가드).
    await page.getByRole("button", { name: "목록으로 돌아가기" }).click();
    await expect(
      page.getByRole("dialog", { name: "저장하지 않고 나갈까요?" }),
    ).toBeHidden();
    await page.waitForURL(/\/archive(\?id=.*)?$/);
    await expect(
      page.getByRole("heading", { level: 3, name: "교내 개발 동아리 운영진" }),
    ).toBeVisible();
  });

  test("다른 카드 편집 전환 시 경로형 URL 로 동기화된다", async ({ page }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");

    // 카드 A 편집 진입(무수정) → 목록으로(가드 없음) → 카드 B 편집.
    await openCardEdit(page, "교내 개발 동아리 운영진");
    await page.waitForURL(/\/archive\/.+\/edit/);
    await page.getByRole("button", { name: "목록으로 돌아가기" }).click();
    await page.waitForURL(/\/archive(\?id=.*)?$/);

    await openCardEdit(page, "캡스톤 팀 프로젝트");
    // 편집 라우트가 경로 세그먼트로 동기화된다(새로고침/공유 정합).
    await page.waitForURL(/\/archive\/exp-e2e-2\/edit/);
    await expect(page.getByRole("textbox", { name: "경험명" })).toHaveValue(
      "캡스톤 팀 프로젝트",
    );
    await expect(page).toHaveURL(/\/archive\/exp-e2e-2\/edit/);
  });
});

/**
 * FRT-74 — 입력 라우트 직접 진입(deep-link) 스모크.
 *
 * 클릭 경유가 아닌 URL 직접 진입은 useExperience(id) 단건 조회 + toExperienceV2 변환
 * 경로를 태우므로 별도로 가드한다.
 */
test.describe("FRT-74 입력 라우트 직접 진입", () => {
  test("/archive/new 직접 진입 시 입력 셸이 렌더된다", async ({ page }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive/new");

    await expect(
      page.getByRole("button", { name: "목록으로 돌아가기" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "완료", exact: true }),
    ).toBeVisible();
  });

  test("/archive/{id}/edit 직접 진입 시 해당 경험 편집 폼이 렌더된다", async ({
    page,
  }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive/exp-e2e-1/edit");

    await expect(page.getByRole("textbox", { name: "경험명" })).toHaveValue(
      "교내 개발 동아리 운영진",
    );
  });
});
