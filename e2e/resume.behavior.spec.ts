import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

/**
 * FRT-43 — 레쥬메(export) 생성→편집→저장 동작(behavior) E2E.
 *
 * /export 에서 레쥬메 생성(POST)→상세로 이동, 자기소개 편집→저장(PATCH)→상세(리로드)·
 * 목록 미리보기에 반영됨을 검증한다. 편집은 자기소개_요약을 바꿔, 그 값이 목록의
 * summary_preview 로도 전파되는 멀티페이지 반영(AC)을 단언한다.
 *
 * ⚠️ 백엔드 BAC-23(POST /export/resume 미구현)·레쥬메 변이 미구현 → stateful mock 으로
 * 프론트 동작을 선검증한다. mock↔실 백엔드 계약 드리프트는 FRT-33 에서 재대조한다.
 */

test.describe("FRT-43 레쥬메 생성·편집 동작", () => {
  test("레쥬메 생성 → 자기소개 편집·저장이 상세·목록에 반영된다", async ({ page }) => {
    const stub = await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/export");

    // Arrange: 시드 레쥬메 1건이 목록에 보인다.
    await expect(page.getByRole("heading", { level: 1, name: "익스포트" })).toBeVisible();
    await expect(page.getByRole("link", { name: /레쥬메 #resume-e/ })).toBeVisible();

    // ── CREATE ─────────────────────────────────────────────────────────────
    // 레쥬메 트랙 카드(버튼)로 생성 모달을 연다.
    await page.getByRole("button", { name: "새 레쥬메 만들기" }).click();
    const dialog = page.getByRole("dialog", { name: "새 레쥬메 만들기" });
    await expect(dialog).toBeVisible();
    // 언어 기본값은 한국어 → 그대로 "만들기".
    await dialog.getByRole("button", { name: "만들기", exact: true }).click();

    // 생성 직후 새 레쥬메 상세로 이동한다.
    await expect(page).toHaveURL(/\/export\/resume\/[^/]+$/);
    const newId = page.url().split("/export/resume/")[1];
    expect(newId).not.toBe("resume-e2e-1");

    // 변이 payload 단언: POST /export/resume 에 언어가 담겨 전송된다.
    const creates = stub.mutations.filter(
      (m) => m.method === "POST" && m.path === "/export/resume",
    );
    expect(creates).toHaveLength(1);
    expect(creates[0].body).toMatchObject({ language: "ko" });

    // ── EDIT + SAVE ────────────────────────────────────────────────────────
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
    // 새 레쥬메(시드 + 1 = 2건)가 목록에 있고, 미리보기가 수정한 요약으로 갱신됐다.
    await expect(page.getByRole("link", { name: /레쥬메 #/ })).toHaveCount(2);
    await expect(page.getByText("E2E 갱신 자기소개 요약")).toBeVisible();
  });
});

/**
 * FRT-56 — 레쥬메 '다시 만들기' 재생성 동작(behavior) E2E.
 *
 * 편집(dirty) 중 재생성하면: (1) 새 버전 상세로 이동한 뒤에도 '다시 만들기' 버튼이
 * 활성 상태로 남고(App Router 동일 인스턴스 재사용 시 regenerating 고정 회귀 가드),
 * (2) 구 versionId 의 draft 가 localStorage 에 잔존하지 않는다(다이얼로그 "편집 내용이
 * 사라진다" 약속과 정합). 두 버그 모두 성공 경로 router.push 직전의 상태/draft 정리로 해소.
 */
test.describe("FRT-56 레쥬메 재생성 동작", () => {
  const DRAFT_KEY = "arc:resume-draft:resume-e2e-1";

  test("편집 중 재생성 시 버튼 재활성화되고 구 draft 가 남지 않는다", async ({
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

    // 새 버전 상세로 이동한다(구 id 와 다르다).
    await expect(page).toHaveURL(/\/export\/resume\/e2e-resume-new-/);

    // 버그1 가드: 이동 후에도 '다시 만들기' 버튼이 활성 상태다(재사용된 인스턴스에서
    // regenerating 이 true 로 고정되지 않는다).
    await expect(regenerateButton).toBeEnabled();

    // 버그2 가드: 구 versionId 의 draft 가 localStorage 에 남지 않는다
    // (다이얼로그 "편집 내용이 사라진다" 약속과 정합).
    const leftoverDraft = await page.evaluate(
      (k) => window.localStorage.getItem(k),
      DRAFT_KEY,
    );
    expect(leftoverDraft).toBeNull();
  });
});
