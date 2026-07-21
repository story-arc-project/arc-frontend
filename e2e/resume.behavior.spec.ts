import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

/**
 * FRT-43 / FRT-116 / FRT-117 — 레쥬메(export) 생성→편집→저장 동작(behavior) E2E.
 *
 * 서버는 생성을 큐잉만 하고 id 를 돌려주지 않으므로(POST /export/resume →
 * {status, message}), 생성 직후 상세로 이동하지 않고 "만드는 중" 안내 후 목록을
 * 갱신한다. 목록 항목의 이름은 서버가 제목을 주지 않아 created_at 으로 만든다.
 *
 * ⚠️ 레쥬메 상세 조회·변이(PATCH/DELETE)는 백엔드 미구현 → stateful mock 으로 프론트
 * 동작을 선검증한다. 목록·생성 stub 은 실 계약(6356a37) 그대로다.
 */

test.describe("FRT-43 레쥬메 생성·편집 동작", () => {
  test("레쥬메 생성 → 자기소개 편집·저장이 상세·목록에 반영된다", async ({ page }) => {
    const stub = await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/export");

    // Arrange: 시드 레쥬메 1건이 목록에 보인다(이름은 만든 시각 기반).
    await expect(page.getByRole("heading", { level: 1, name: "익스포트" })).toBeVisible();
    await expect(page.getByRole("link", { name: /레쥬메/ })).toHaveCount(1);

    // ── CREATE ─────────────────────────────────────────────────────────────
    // 레쥬메 트랙 카드(버튼)로 생성 모달을 연다.
    await page.getByRole("button", { name: "새 레쥬메 만들기" }).click();
    const dialog = page.getByRole("dialog", { name: "새 레쥬메 만들기" });
    await expect(dialog).toBeVisible();
    // 언어 기본값은 한국어 → 그대로 "만들기".
    await dialog.getByRole("button", { name: "만들기", exact: true }).click();

    // FRT-116 가드: 생성이 큐잉되면 실패 경고가 아니라 "만드는 중" 안내가 뜬다.
    await expect(page.getByText("레쥬메를 만들고 있어요", { exact: false })).toBeVisible();
    await expect(page.getByText("레쥬메 생성에 실패했어요.", { exact: false })).toHaveCount(0);

    // FRT-117 가드: 상세로 튀지 않고 목록에 새 항목이 반영된다.
    await expect(page).toHaveURL(/\/export$/);
    await expect(page.getByRole("link", { name: /레쥬메/ })).toHaveCount(2);

    // 변이 payload 단언: POST /export/resume 에 언어가 담겨 전송된다.
    const creates = stub.mutations.filter(
      (m) => m.method === "POST" && m.path === "/export/resume",
    );
    expect(creates).toHaveLength(1);
    expect(creates[0].body).toMatchObject({ language: "ko" });

    // ── EDIT + SAVE ────────────────────────────────────────────────────────
    // 새로 만든 레쥬메(목록 최상단) 상세로 들어간다.
    await page.getByRole("link", { name: /레쥬메/ }).first().click();
    await expect(page).toHaveURL(/\/export\/resume\/e2e-resume-new-/);
    const newId = page.url().split("/export/resume/")[1];

    // 자기소개 아코디언을 펼치고 요약을 수정한다(저장 전 버튼은 비활성).
    const saveButton = page.getByRole("button", { name: "저장", exact: true });
    await expect(saveButton).toBeDisabled();
    await page.getByRole("button", { name: "자기소개", exact: true }).click();
    const summary = page.getByPlaceholder("간단한 자기소개를 적어주세요.");
    await summary.fill("E2E 갱신 자기소개 요약");

    // 수정으로 dirty → 저장 활성화 → 클릭 시 PATCH 전송.
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // 저장 커밋 결과: 성공 토스트가 (main) 전역에 표시되고, dirty 해제로 저장 버튼이
    // 다시 비활성화된다. (FRT-45 회귀 가드: ToastContainer 를 루트 레이아웃에 전역
    //  마운트 — 토스트는 3.5s 후 자동 소멸하므로 리로드 전에 단언한다.)
    await expect(page.getByText("저장됐어요")).toBeVisible();
    await expect(saveButton).toBeDisabled();

    // 변이 payload 단언: PATCH /export/resume/{newId} 에 수정된 요약이 전송된다.
    const updates = stub.mutations.filter(
      (m) => m.method === "PATCH" && m.path === `/export/resume/${newId}`,
    );
    expect(updates).toHaveLength(1);
    expect(updates[0].body).toMatchObject({ 자기소개_요약: "E2E 갱신 자기소개 요약" });

    // ── 상세 반영(리로드) ────────────────────────────────────────────────────
    await page.reload();
    await page.getByRole("button", { name: "자기소개", exact: true }).click();
    await expect(
      page.getByPlaceholder("간단한 자기소개를 적어주세요."),
    ).toHaveValue("E2E 갱신 자기소개 요약");

    // ── 목록 반영 ────────────────────────────────────────────────────────────
    await page.goto("/export");
    // 새 레쥬메(시드 + 1 = 2건)가 목록에 남아 있다. 목록 응답에는 요약이 없으므로
    // 미리보기 대신 건수와 이름만 단언한다.
    await expect(page.getByRole("link", { name: /레쥬메/ })).toHaveCount(2);
  });
});

/**
 * FRT-112 — 레쥬메 파일 내보내기(PDF·DOCX) 동작 E2E.
 *
 * PDF 는 한글 폰트(수 MB)를 런타임에 받아 만들기 때문에 스모크에서 제외하고,
 * 순수 JS 로 즉시 만들어지는 Word(.docx) 로 "실제 파일이 규칙대로 떨어지는지"를 본다.
 */
test.describe("FRT-112 레쥬메 내보내기", () => {
  test("내보내기에서 Word 를 고르면 이름 규칙대로 파일이 내려온다", async ({
    page,
  }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/export/resume/resume-e2e-1");

    await page
      .locator("header")
      .getByRole("button", { name: "내보내기" })
      .click();

    // 세 가지 형식이 모두 제시된다.
    const dialog = page.getByRole("dialog", { name: "내보내기 형식 선택" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^PDF/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^인쇄/ })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: /^Word/ }).click();
    const download = await downloadPromise;

    // 파일명 규칙: {이름}_레쥬메_{YYYYMMDD}.docx (픽스처 인적사항 이름 = 김아크)
    expect(download.suggestedFilename()).toMatch(/^김아크_레쥬메_\d{8}\.docx$/);

    // 내려받고 나면 다이얼로그는 닫힌다.
    await expect(dialog).toBeHidden();
  });
});

/**
 * FRT-56 — 레쥬메 '다시 만들기' 재생성 동작(behavior) E2E.
 *
 * 편집(dirty) 중 재생성하면: (1) 새 레쥬메가 큐잉되고 목록으로 돌아가 거기에 반영되며,
 * (2) 구 versionId 의 draft 가 localStorage 에 잔존하지 않는다(다이얼로그 "편집 내용이
 * 사라진다" 약속과 정합). 서버가 새 id 를 주지 않아 새 버전 상세로는 갈 수 없다.
 */
test.describe("FRT-56 레쥬메 재생성 동작", () => {
  const DRAFT_KEY = "arc:resume-draft:resume-e2e-1";

  test("편집 중 재생성 시 목록에 반영되고 구 draft 가 남지 않는다", async ({
    page,
  }) => {
    await stubApi(page, { authed: true, scenario: "data" });

    // Arrange: 시드 레쥬메 상세로 진입한다.
    await page.goto("/export/resume/resume-e2e-1");
    const regenerateButton = page
      .locator("header")
      .getByRole("button", { name: "다시 만들기" });
    await expect(regenerateButton).toBeEnabled();

    // 자기소개를 수정해 dirty 상태로 만든다(저장하지 않음).
    await page.getByRole("button", { name: "자기소개", exact: true }).click();
    await page
      .getByPlaceholder("간단한 자기소개를 적어주세요.")
      .fill("재생성 직전 편집 내용");
    await expect(
      page.getByRole("button", { name: "저장", exact: true }),
    ).toBeEnabled();

    // ── REGENERATE ─────────────────────────────────────────────────────────
    await regenerateButton.click();
    const dialog = page.getByRole("dialog", { name: "다시 만들기 확인" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "다시 만들기" }).click();

    // 재생성은 큐잉만 되므로 새 버전 상세가 아니라 목록으로 돌아간다.
    await expect(page).toHaveURL(/\/export$/);
    await expect(page.getByText("레쥬메를 다시 만들고 있어요", { exact: false })).toBeVisible();

    // 새 레쥬메가 목록에 반영된다(시드 1 + 재생성 1).
    await expect(page.getByRole("link", { name: /레쥬메/ })).toHaveCount(2);

    // 구 versionId 의 draft 가 localStorage 에 남지 않는다
    // (다이얼로그 "편집 내용이 사라진다" 약속과 정합).
    const leftoverDraft = await page.evaluate(
      (k) => window.localStorage.getItem(k),
      DRAFT_KEY,
    );
    expect(leftoverDraft).toBeNull();
  });
});
