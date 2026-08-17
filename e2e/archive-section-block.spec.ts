import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

/**
 * FRT-78 — 최상위 섹션 블록 추가 E2E 스모크.
 *
 * `/archive/new` 에서:
 *  1. 유형 선택 → 경험명 입력
 *  2. 최상위 "블록 추가" 클릭 → 사용자 섹션 생성
 *  3. 섹션 이름 변경
 *  4. 섹션 내부 "블록 추가" → BlockTypePicker 에서 "텍스트 (짧은)" 선택
 *     → BlockEditModal 에서 라벨 입력 → "확인"
 *  5. 생성된 텍스트 필드에 값 입력
 *  6. "완료" 저장 → `/archive?id=` 복귀
 *  7. 상세 미리보기에 섹션 라벨(h3)이 보인다.
 *
 * 범위 결정 근거: 상세뷰(buildDetailSections)는 빈 사용자 섹션을 prune 하므로
 * detail 검증에는 최소 1개의 비어 있지 않은 자식 필드가 필요하다.
 * 내부 블록 추가(Step 4–5)가 환경적으로 불안정하면 협의 좁힘 판단에 따른다.
 *
 * FRT-42 stateful mock + FRT-30 (main) 스모크 토대 위에서 백엔드 없이 결정론적으로
 * 통과한다.
 */

test.describe("FRT-78 최상위 섹션 블록 추가 스모크", () => {
  test(
    "사용자가 최상위 섹션 블록을 추가·이름변경·필드추가·저장하면 상세에 섹션 라벨이 반영된다",
    async ({ page }) => {
      await stubApi(page, { authed: true, scenario: "data" });
      await page.goto("/archive/new");

      // ── 1. 유형 선택 + 경험명 ──────────────────────────────────────────
      await page.getByRole("button", { name: "대외활동", exact: true }).click();
      await page.getByRole("textbox", { name: "경험명" }).fill("FRT-78 섹션 테스트");

      // ── 2. 최상위 "블록 추가" ─────────────────────────────────────────
      // 최상위 블록 추가 버튼은 태그(FRT-301 로 최상단 이동) + 4섹션 카드 다음의 전폭 점선 버튼이다.
      // 내부 BlockList 의 "블록 추가" 와 구별하려면 페이지의 마지막 "블록 추가"가 아니라
      // 섹션 카드가 아직 없는 상태이므로 첫 번째 "블록 추가"가 최상위 버튼이다.
      // (유형 선택 직후: 섹션 내 BlockList 에는 allowAdd=false 고정 블록만 있으므로
      //  내부 "블록 추가"는 렌더되지 않는다. 최상위가 유일하다.)
      const topLevelAddSection = page
        .getByRole("button", { name: "블록 추가", exact: true })
        .last();
      await topLevelAddSection.click();

      // ── 3. 섹션 이름 변경 ────────────────────────────────────────────
      const sectionNameInput = page.getByLabel("섹션 이름");
      await expect(sectionNameInput).toBeVisible();
      await sectionNameInput.clear();
      await sectionNameInput.fill("나의 커스텀 섹션");

      // ── 4. 섹션 내부 "블록 추가" → 텍스트 필드 추가 ─────────────────
      // 사용자 섹션(FormSection variant=card, allowAdd=true) 내부에만 "블록 추가" 버튼이
      // 렌더된다. 섹션 이름 input 과 같은 section[data-section-id] 안에서 scope.
      const userSection = page.locator("section").filter({ has: sectionNameInput });
      const innerAddButton = userSection.getByRole("button", {
        name: "블록 추가",
        exact: true,
      });
      await innerAddButton.click();

      // BlockTypePicker(role="listbox") 가 열리면 "텍스트 (짧은)" 선택.
      const picker = page.getByRole("listbox");
      await expect(picker).toBeVisible();
      await picker.getByRole("option", { name: "텍스트 (짧은)", exact: true }).click();

      // BlockEditModal 이 열리면 라벨 "블록 이름 *" 입력 후 "확인".
      // BlockEditModal 의 Dialog ariaLabel = "블록 설정".
      const modal = page.getByRole("dialog", { name: "블록 설정" });
      await expect(modal).toBeVisible();
      // 대외활동 유형의 실제 필드('활동 내용 요약')와 substring 충돌하지 않는 이름을 쓴다
      // (getByRole name 은 부분매칭이라 '활동 내용'은 '활동 내용 요약'에도 걸려 strict 위반).
      await modal.getByPlaceholder("블록 이름을 입력하세요").fill("개인 메모");
      await modal.getByRole("button", { name: "확인", exact: true }).click();

      // ── 5. 생성된 텍스트 필드에 값 입력 ─────────────────────────────
      // 새로 생성된 텍스트 블록의 input(label="개인 메모")에 값을 입력한다.
      await page
        .getByRole("textbox", { name: "개인 메모" })
        .fill("E2E 검증용 텍스트 값");

      // ── 6. 완료 저장 → 목록으로 복귀 ────────────────────────────────
      await page.getByRole("button", { name: "완료", exact: true }).click();
      await page.waitForURL(/\/archive\?id=/);

      // ── 7. 상세 미리보기에 섹션 라벨이 보인다 ────────────────────────
      // 카드 클릭(push peek) 없이 URL ?id= 가 이미 push 됐으므로 상세 패널이 렌더된다.
      // buildDetailSections 가 group block children(개인 메모 = 비어 있지 않음)을
      // 섹션으로 변환해 h3에 섹션 이름을 출력한다.
      await expect(
        page.getByRole("heading", { level: 3, name: "나의 커스텀 섹션" }),
      ).toBeVisible();
    },
  );
});
