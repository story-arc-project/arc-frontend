import { expect, test, type Page } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

/**
 * FRT-43 / FRT-116 / FRT-117 — 이력서(export) 생성→편집→저장 동작(behavior) E2E.
 *
 * 서버는 생성을 큐잉만 하고 id 를 돌려주지 않으므로(POST /export/resume →
 * {status, message}), 생성 직후 상세로 이동하지 않고 "만드는 중" 안내 후 목록을
 * 갱신한다. 목록 항목의 이름은 서버가 제목을 주지 않아 created_at 으로 만든다.
 *
 * ⚠️ 이력서 상세 조회·변이(PATCH/DELETE)는 백엔드 미구현 → stateful mock 으로 프론트
 * 동작을 선검증한다. 목록·생성 stub 은 실 계약(6356a37) 그대로다.
 */

test.describe("FRT-43 이력서 생성·편집 동작", () => {
  test("이력서 생성 → 자기소개 편집·저장이 상세·목록에 반영된다", async ({ page }) => {
    const stub = await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/export");

    // Arrange: 시드 이력서 1건이 목록에 보인다(이름은 만든 시각 기반).
    await expect(page.getByRole("heading", { level: 1, name: "익스포트" })).toBeVisible();
    await expect(page.getByRole("link", { name: /이력서/ })).toHaveCount(1);

    // ── CREATE ─────────────────────────────────────────────────────────────
    // 이력서 트랙 카드(버튼)로 생성 모달을 연다.
    await page.getByRole("button", { name: "새 이력서 만들기" }).click();
    const dialog = page.getByRole("dialog", { name: "새 이력서 만들기" });
    await expect(dialog).toBeVisible();
    // 언어 기본값은 한국어 → 그대로 "만들기".
    await dialog.getByRole("button", { name: "만들기", exact: true }).click();

    // FRT-116 가드: 생성이 큐잉되면 실패 경고가 아니라 "만드는 중" 안내가 뜬다.
    await expect(page.getByText("이력서를 만들고 있어요", { exact: false })).toBeVisible();
    await expect(page.getByText("이력서 생성에 실패했어요.", { exact: false })).toHaveCount(0);

    // FRT-117 가드: 상세로 튀지 않고 목록에 새 항목이 반영된다.
    await expect(page).toHaveURL(/\/export$/);
    await expect(page.getByRole("link", { name: /이력서/ })).toHaveCount(2);

    // 변이 payload 단언: POST /export/resume 에 언어가 담겨 전송된다.
    const creates = stub.mutations.filter(
      (m) => m.method === "POST" && m.path === "/export/resume",
    );
    expect(creates).toHaveLength(1);
    expect(creates[0].body).toMatchObject({ language: "ko" });

    // ── EDIT + SAVE ────────────────────────────────────────────────────────
    // 새로 만든 이력서(목록 최상단) 상세로 들어간다.
    await page.getByRole("link", { name: /이력서/ }).first().click();
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
    // 본문은 `result` 로 감싸 보낸다(BAC-56 `ResumePatchRequest{title?, result?}`).
    // 맨 본문을 보내면 서버가 거절하는 대신 **아무것도 저장하지 않은 채** 성공을 돌려준다.
    expect(updates[0].body).toMatchObject({
      result: { 자기소개_요약: "E2E 갱신 자기소개 요약" },
    });

    // ── 상세 반영(리로드) ────────────────────────────────────────────────────
    await page.reload();
    await page.getByRole("button", { name: "자기소개", exact: true }).click();
    await expect(
      page.getByPlaceholder("간단한 자기소개를 적어주세요."),
    ).toHaveValue("E2E 갱신 자기소개 요약");

    // ── 목록 반영 ────────────────────────────────────────────────────────────
    await page.goto("/export");
    // 새 이력서(시드 + 1 = 2건)가 목록에 남아 있다. 목록 응답에는 요약이 없으므로
    // 미리보기 대신 건수와 이름만 단언한다.
    await expect(page.getByRole("link", { name: /이력서/ })).toHaveCount(2);
  });
});

/**
 * FRT-112 — 이력서 파일 내보내기(PDF·DOCX) 동작 E2E.
 *
 * PDF 는 한글 폰트(수 MB)를 런타임에 받아 만들기 때문에 스모크에서 제외하고,
 * 순수 JS 로 즉시 만들어지는 Word(.docx) 로 "실제 파일이 규칙대로 떨어지는지"를 본다.
 */
test.describe("FRT-112 이력서 내보내기", () => {
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

    // 파일명 규칙: {이름}_이력서_{YYYYMMDD}.docx (픽스처 인적사항 이름 = 김아크)
    expect(download.suggestedFilename()).toMatch(/^김아크_이력서_\d{8}\.docx$/);

    // 내려받고 나면 다이얼로그는 닫힌다.
    await expect(dialog).toBeHidden();
  });
});

/**
 * FRT-148 — 저장이 실패해도 임시 저장으로 편집을 붙드는 동작.
 *
 * 이때 화면에 낡은 복원 배너가 떠 있으면 배너 하나가 편집을 두 번 잃게 만든다:
 * '복원'이 화면에 없는 옛 스냅샷을 되돌리면서 방금 쓴 최신 임시 저장까지 지운다.
 * 폴백이 새 임시 저장을 쓰면 배너는 내려가야 한다. 이건 실패 사유와 무관하게 같다.
 *
 * ⚠️ **안내 문구는 사유마다 달라야 한다.** 예전엔 422 도 "곧 제공될 예정이에요"로 묶여
 * 있었는데, 백엔드(BAC-56)가 PATCH 를 배포한 뒤로 422 는 "저장 경로가 없다"가 아니라
 * **제목 길이 초과 같은 진짜 검증 실패**를 뜻한다. 그걸 미구현 안내로도, "잠시 후 다시
 * 시도해주세요"로도 뭉개면 사용자는 자기가 고칠 수 있는 것을 못 고친 채 재시도만 반복한다.
 */
test.describe("FRT-148 저장 실패와 복원 배너", () => {
  const DRAFT_KEY = "arc:resume-draft:resume-e2e-1";

  /** PATCH 만 골라 실패시킨다. stubApi 뒤에 등록해야 이 라우트가 먼저 매칭된다. */
  async function failPatchWith(page: Page, status: number, message: string) {
    await page.route("**/export/resume/resume-e2e-1", async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({ status: "error", message }),
      });
    });
  }

  /** 시드 이력서(generated_at 2026-03-10)보다 새 임시 저장을 심어 배너를 띄운다. */
  async function seedStaleDraft(page: Page) {
    await page.addInitScript(
      ([key, draft]) => window.localStorage.setItem(key, draft),
      [
        DRAFT_KEY,
        JSON.stringify({
          updated_at: "2026-06-01T00:00:00.000Z",
          data: {
            meta: {
              language: "ko",
              format: "json",
              generated_at: "2026-03-10T09:00:00.000Z",
              source_chars: 1200,
            },
            인적사항: { 이름: "김아크", 링크: [] },
            자기소개_요약: "낡은 임시 저장",
          },
        }),
      ] as const,
    );
  }

  /** 배너를 무시한 채 서버본을 고치고 저장한다. */
  async function editAndSave(page: Page) {
    await page.getByRole("button", { name: "자기소개", exact: true }).click();
    await page
      .getByPlaceholder("간단한 자기소개를 적어주세요.")
      .fill("폴백으로 남는 편집 내용");
    await page.getByRole("button", { name: "저장", exact: true }).click();
  }

  /** 배너는 내려가고, localStorage 에는 방금 편집한 내용이 남아야 한다. */
  async function expectEditKept(page: Page) {
    await expect(page.getByText("저장하지 못한 편집 내용이 있어요")).toHaveCount(0);
    const stored = await page.evaluate(
      (k) => window.localStorage.getItem(k),
      DRAFT_KEY,
    );
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored as string).data.자기소개_요약).toBe(
      "폴백으로 남는 편집 내용",
    );
  }

  test("서버가 저장을 거절해도(501) 임시 저장이 갱신되며 낡은 복원 배너가 사라진다", async ({
    page,
  }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    // 구 백엔드로 롤백된 상태를 재현한다 — 배포된 서버에는 PATCH 가 실재한다(FRT-111).
    await failPatchWith(page, 501, "Not Implemented");
    await seedStaleDraft(page);

    await page.goto("/export/resume/resume-e2e-1");
    await expect(page.getByText("저장하지 못한 편집 내용이 있어요")).toBeVisible();

    await editAndSave(page);

    // 더는 "곧 제공될 예정"으로 안내하지 않는다 — 기능은 있고, 이건 그냥 저장 실패다.
    await expect(
      page.getByText("편집 저장 기능은 곧 제공될 예정이에요", { exact: false }),
    ).toHaveCount(0);
    await expect(page.getByText("저장에 실패했어요", { exact: false })).toBeVisible();
    // 안내가 무엇이든 편집은 붙들어야 한다 — 여기가 이 테스트의 본론이다.
    await expectEditKept(page);
  });

  // 생성이 아직 안 끝난 이력서를 저장하면 서버가 400 과 **영문** 메시지를 준다.
  // 사유를 그대로 보여주는 관용구가 여기서는 읽히지 않는 문장을 띄운다.
  test("400 은 서버 영문 메시지 대신 생성 중이라는 한글 안내를 보여준다", async ({
    page,
  }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await failPatchWith(page, 400, "Resume is not completed yet.");
    await seedStaleDraft(page);

    await page.goto("/export/resume/resume-e2e-1");
    await editAndSave(page);

    await expect(
      page.getByText("아직 이력서를 만드는 중이에요", { exact: false }),
    ).toBeVisible();
    await expect(page.getByText("Resume is not completed yet.")).toHaveCount(0);
    await expectEditKept(page);
  });

  test("422 는 서버가 준 사유를 그대로 보여준다 — 미구현 안내로도 재시도 안내로도 뭉개지 않는다", async ({
    page,
  }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    // 저장 경로는 있고, 입력이 규칙을 어긴 상태다.
    await failPatchWith(page, 422, "제목은 100자를 넘을 수 없어요.");
    await seedStaleDraft(page);

    await page.goto("/export/resume/resume-e2e-1");
    await expect(page.getByText("저장하지 못한 편집 내용이 있어요")).toBeVisible();

    await editAndSave(page);

    // 사용자는 무엇을 고쳐야 하는지 화면에서 읽을 수 있어야 한다.
    await expect(
      page.getByText("제목은 100자를 넘을 수 없어요.", { exact: false }),
    ).toBeVisible();
    // 둘 다 거짓 안내다 — 기능은 있고(미구현 아님), 다시 시도해도 같은 결과다.
    await expect(
      page.getByText("편집 저장 기능은 곧 제공될 예정이에요", { exact: false }),
    ).toHaveCount(0);
    await expect(page.getByText("잠시 후 다시 시도해주세요")).toHaveCount(0);

    // 사유를 말해주더라도 편집은 여전히 붙들어야 한다.
    await expectEditKept(page);
  });

  /**
   * FRT-329 — 탭을 닫거나 새로고침하면 편집이 저장 없이 사라졌다.
   *
   * 임시 저장은 언마운트 cleanup 에만 있었고 진짜 페이지 언로드에서는 그 cleanup 이
   * 실행되지 않는다. 브라우저 경고에서 "나가기"를 고르면 편집은 그대로 없어졌다.
   * 새로고침이 pagehide 를 일으키므로, 저장 없이 새로고침해도 복원 배너가 떠야 한다.
   */
  test("저장 없이 새로고침해도 다음 진입에 복원 배너로 편집을 되살릴 수 있다", async ({
    page,
  }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/export/resume/resume-e2e-1");
    await expect(page.getByText("저장하지 못한 편집 내용이 있어요")).toHaveCount(0);

    await page.getByRole("button", { name: "자기소개", exact: true }).click();
    await page
      .getByPlaceholder("간단한 자기소개를 적어주세요.")
      .fill("새로고침 직전 편집 내용");

    // dirty 라 beforeunload 경고가 뜬다 — 사용자가 "나가기"를 고르는 상황이다.
    page.once("dialog", (dialog) => dialog.accept());
    await page.reload();

    await expect(page.getByText("저장하지 못한 편집 내용이 있어요")).toBeVisible();
    await page.getByRole("button", { name: "복원", exact: true }).click();
    await page.getByRole("button", { name: "자기소개", exact: true }).click();
    await expect(
      page.getByPlaceholder("간단한 자기소개를 적어주세요."),
    ).toHaveValue("새로고침 직전 편집 내용");
  });
});

/**
 * FRT-56 — 이력서 '다시 만들기' 재생성 동작(behavior) E2E.
 *
 * 편집(dirty) 중 재생성하면: (1) 새 이력서가 큐잉되고 목록으로 돌아가 거기에 반영되며,
 * (2) 구 versionId 의 draft 가 localStorage 에 잔존하지 않는다(다이얼로그 "편집 내용이
 * 사라진다" 약속과 정합). 서버가 새 id 를 주지 않아 새 버전 상세로는 갈 수 없다.
 */
test.describe("FRT-56 이력서 재생성 동작", () => {
  const DRAFT_KEY = "arc:resume-draft:resume-e2e-1";

  test("편집 중 재생성 시 목록에 반영되고 구 draft 가 남지 않는다", async ({
    page,
  }) => {
    await stubApi(page, { authed: true, scenario: "data" });

    // Arrange: 시드 이력서 상세로 진입한다.
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
    await expect(page.getByText("이력서를 다시 만들고 있어요", { exact: false })).toBeVisible();

    // 새 이력서가 목록에 반영된다(시드 1 + 재생성 1).
    await expect(page.getByRole("link", { name: /이력서/ })).toHaveCount(2);

    // 구 versionId 의 draft 가 localStorage 에 남지 않는다
    // (다이얼로그 "편집 내용이 사라진다" 약속과 정합).
    const leftoverDraft = await page.evaluate(
      (k) => window.localStorage.getItem(k),
      DRAFT_KEY,
    );
    expect(leftoverDraft).toBeNull();
  });
});
