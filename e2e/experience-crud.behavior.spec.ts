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

    // 결과(관찰 가능한 UI 효과)를 먼저 await 한다: 옛 제목은 사라지고 새 제목이
    // 목록·상세에 반영된다. PUT 은 비동기로 기록되므로, 캡처된 변이를 동기적으로
    // 읽기 전에 web-first 단언으로 반영을 기다려야 결정론적이다.
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

    // 결과(관찰 가능한 UI 효과)를 먼저 await: 삭제한 경험 카드는 목록에서 사라지고,
    // 시드 2건은 남는다. (캡처된 DELETE 변이를 동기적으로 읽기 전에 반영을 기다린다.)
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
 * FRT-53 — 편집 중 다른 카드 복제/삭제 시 unsaved 가드.
 *
 * `handleSelectExperience`/`handleNewExperience` 만 가드를 걸고 복제·삭제는
 * 바로 실행돼 편집 내용이 소실되던 버그의 회귀 가드. 새 경험을 만들다(미저장)
 * 다른 카드의 컨텍스트 메뉴로 삭제·복제를 시도하면 가드 모달이 떠야 하고,
 * '취소' 시 변이 요청이 나가지 않고 작성 중 내용이 보존, '나가기' 후에만 실행돼야 한다.
 */
test.describe("FRT-53 편집 중 복제/삭제 가드", () => {
  // 미저장 편집(hasUnsaved) 상태를 만들고 시드 카드의 컨텍스트 메뉴를 연다.
  // 컨텍스트 메뉴 '삭제'/'복제'는 텍스트 버튼이라, aria-label 만 가진 아이콘형
  // '삭제'(라이브러리 행) 버튼과 구분하려 getByText 로 메뉴 항목만 정확히 집는다.
  async function arrangeUnsavedThenOpenMenu(page: import("@playwright/test").Page) {
    const seedCard = page.getByRole("heading", {
      level: 3,
      name: "교내 개발 동아리 운영진",
    });
    await expect(seedCard).toBeVisible();

    await page
      .getByRole("button", { name: "새 경험 추가", exact: true })
      .first()
      .click();
    await page.getByRole("button", { name: "대외활동", exact: true }).click();
    await page
      .getByRole("textbox", { name: "경험명" })
      .fill("가드 검증 작성 중 경험");

    await seedCard
      .locator("..")
      .getByRole("button", { name: "더보기", exact: true })
      .click();
    return seedCard;
  }

  test("미저장 편집 중 다른 카드 삭제 시 가드 모달이 뜨고 '취소'하면 보존된다", async ({
    page,
  }) => {
    const stub = await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");

    const seedCard = await arrangeUnsavedThenOpenMenu(page);
    await page.getByText("삭제", { exact: true }).click();

    // 즉시 삭제되지 않고 unsaved 가드 모달이 뜬다.
    const guard = page.getByRole("dialog", { name: "저장하지 않고 나갈까요?" });
    await expect(guard).toBeVisible();

    // '취소' → 삭제 요청은 나가지 않고, 작성 중 내용과 시드 카드가 그대로 남는다.
    await guard.getByRole("button", { name: "취소", exact: true }).click();
    await expect(guard).toBeHidden();
    expect(
      stub.mutations.filter(
        (m) => m.method === "DELETE" && m.path.startsWith("/experiences/"),
      ),
    ).toHaveLength(0);
    await expect(page.getByRole("textbox", { name: "경험명" })).toHaveValue(
      "가드 검증 작성 중 경험",
    );
    await expect(seedCard).toBeVisible();
  });

  test("미저장 편집 중 다른 카드 삭제 시 '나가기' 후에만 삭제가 실행된다", async ({
    page,
  }) => {
    const stub = await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");

    const seedCard = await arrangeUnsavedThenOpenMenu(page);
    await page.getByText("삭제", { exact: true }).click();

    const guard = page.getByRole("dialog", { name: "저장하지 않고 나갈까요?" });
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "나가기", exact: true }).click();

    // '나가기' 확인 후 비로소 시드 카드가 삭제되고 DELETE 요청이 한 번 나간다.
    await expect(seedCard).toHaveCount(0);
    expect(
      stub.mutations.filter(
        (m) => m.method === "DELETE" && m.path.startsWith("/experiences/"),
      ),
    ).toHaveLength(1);
  });

  test("미저장 편집 중 다른 카드 복제 시 '나가기' 후에만 복제가 실행된다", async ({
    page,
  }) => {
    const stub = await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");

    await arrangeUnsavedThenOpenMenu(page);
    await page.getByText("복제", { exact: true }).click();

    const guard = page.getByRole("dialog", { name: "저장하지 않고 나갈까요?" });
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "나가기", exact: true }).click();

    // '나가기' 확인 후 비로소 복제 POST(/experiences/{id}/duplicate)가 한 번 나간다.
    await expect(
      page.getByRole("heading", { level: 2, name: "교내 개발 동아리 운영진" }),
    ).toBeVisible();
    expect(
      stub.mutations.filter(
        (m) => m.method === "POST" && /\/experiences\/.+\/duplicate/.test(m.path),
      ),
    ).toHaveLength(1);
  });
});

/**
 * FRT-52 — 편집 모드 진입 즉시 dirty 위양성 + onEdit setTimeout race 회귀 가드.
 *
 * 버그 1: 편집 모드 진입 시 아무것도 안 바꿔도 hasUnsaved=true 가 되어, 다른 카드로
 * 이동하면 항상 가드 모달이 떴다.
 * 버그 2: 카드의 '편집'(onEdit) 이 select 후 `setTimeout(setMode("edit"))` 을 무조건
 * 실행해, 가드에 막혀도 잘못된 selectedId 로 edit 폼이 마운트됐다.
 *
 * 두 버그가 결합돼, 한 카드를 편집하다 다른 카드를 편집하려 하면 가드가 떠 막혔다.
 * 수정 후에는: 수정이 없으면 가드 없이 곧장 대상 카드로 전환된다.
 */
test.describe("FRT-52 편집 진입 dirty 위양성 / onEdit race", () => {
  // 카드의 '더보기' 메뉴를 열고 '편집' 을 눌러 그 카드의 편집 모드로 진입한다.
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

  test("카드 '편집' 은 가드/race 없이 그 카드의 편집 폼을 연다", async ({ page }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");

    await openCardEdit(page, "교내 개발 동아리 운영진");

    // 올바른 카드가 편집 모드로 열린다(경험명 입력 + 완료 버튼 존재).
    await expect(page.getByRole("textbox", { name: "경험명" })).toHaveValue(
      "교내 개발 동아리 운영진",
    );
    await expect(
      page.getByRole("button", { name: "완료", exact: true }),
    ).toBeVisible();
    // 진입 즉시 가드 모달이 뜨면 안 된다.
    await expect(
      page.getByRole("dialog", { name: "저장하지 않고 나갈까요?" }),
    ).toBeHidden();
  });

  test("수정 없이 편집 진입 후 다른 카드를 선택하면 가드 없이 전환된다", async ({
    page,
  }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");

    // 한 카드를 편집 모드로 열되 아무것도 수정하지 않는다.
    await openCardEdit(page, "교내 개발 동아리 운영진");
    await expect(page.getByRole("textbox", { name: "경험명" })).toHaveValue(
      "교내 개발 동아리 운영진",
    );

    // 다른 카드를 클릭 → 미수정이므로 가드 없이 상세로 전환된다.
    await page
      .getByRole("heading", { level: 3, name: "캡스톤 팀 프로젝트" })
      .click();

    await expect(
      page.getByRole("dialog", { name: "저장하지 않고 나갈까요?" }),
    ).toBeHidden();
    await expect(
      page.getByRole("heading", { level: 2, name: "캡스톤 팀 프로젝트" }),
    ).toBeVisible();
  });

  test("수정 없이 편집 진입 후 다른 카드를 편집해도 가드 없이 그 카드가 열린다", async ({
    page,
  }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");

    await openCardEdit(page, "교내 개발 동아리 운영진");
    await expect(page.getByRole("textbox", { name: "경험명" })).toHaveValue(
      "교내 개발 동아리 운영진",
    );

    // 수정 없이 다른 카드 '편집' → 가드 없이 그 카드 편집 폼으로 전환된다.
    await openCardEdit(page, "캡스톤 팀 프로젝트");
    await expect(
      page.getByRole("dialog", { name: "저장하지 않고 나갈까요?" }),
    ).toBeHidden();
    await expect(page.getByRole("textbox", { name: "경험명" })).toHaveValue(
      "캡스톤 팀 프로젝트",
    );
    // 편집 모드는 유지되면서 URL ?id 도 대상 카드로 동기화된다(새로고침/공유 정합).
    // render-sync 가 edit 을 detail 로 덮지 않는지도 함께 보장한다.
    await expect(page).toHaveURL(/id=exp-e2e-2/);
  });
});
