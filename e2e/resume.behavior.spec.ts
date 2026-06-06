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

    // 저장 커밋 결과: dirty 해제로 저장 버튼이 다시 비활성화된다.
    // (성공 토스트 "저장됐어요"는 ToastContainer 가 (main) 레이아웃에 미마운트라 렌더되지
    //  않는다 — 앱 잠재 버그, FRT-43 범위 밖. 결과는 payload·상세·목록 반영으로 단언한다.)
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
