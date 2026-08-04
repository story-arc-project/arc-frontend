import { describe, it, expect } from "vitest";

import type { ResumeVersion } from "@/types/resume";
import { changedResumeSections } from "./resume-diff";

/**
 * FRT-114 — "AI가 쓴 초안을 사용자가 얼마나 고쳐 쓰는가"를 재는 축.
 *
 * 지금 화면에는 문장 단위 승인/기각이 없다(정의서의 `resume_sentence_*` 는 21차 회의로
 * 폐기). 대신 섹션 아코디언 자유 편집만 있으므로, 수정률은 **어떤 섹션이 초안과 달라졌는가**
 * 로 잰다. 계측이 이 함수의 결과를 그대로 속성에 싣는다.
 */

function emptyResume(overrides: Partial<ResumeVersion> = {}): ResumeVersion {
  return {
    meta: {
      language: "ko",
      format: "json",
      generated_at: "2026-07-21T00:00:00Z",
      source_chars: 0,
    },
    인적사항: {
      이름: null,
      영문명: null,
      생년월일: null,
      이메일: null,
      전화번호: null,
      주소: null,
      링크: [],
    },
    학력: [],
    경력: [],
    자격증: [],
    어학: [],
    대외활동: [],
    프로젝트: [],
    수상: [],
    기술및역량: { 기술스택: [], 툴: [], 소프트스킬: [] },
    동아리_학회: [],
    연계성: [],
    자기소개_요약: null,
    파싱경고: [],
    ...overrides,
  };
}

describe("changedResumeSections", () => {
  it("아무것도 안 고쳤으면 빈 배열", () => {
    const initial = emptyResume();
    expect(changedResumeSections(initial, emptyResume())).toEqual([]);
  });

  it("초안이 아직 없으면(로드 전) 빈 배열 — 부재를 '전부 수정'으로 읽지 않는다", () => {
    expect(changedResumeSections(null, emptyResume())).toEqual([]);
    expect(changedResumeSections(emptyResume(), null)).toEqual([]);
  });

  it("경력만 고치면 경력만 잡는다", () => {
    const initial = emptyResume();
    const current = emptyResume({
      경력: [
        {
          id: 1,
          회사명: "ARC",
          부서: null,
          직위: null,
          고용형태: null,
          입사년월: null,
          퇴사년월: null,
          재직중: false,
          담당업무: [],
          성과: [],
        },
      ],
    });
    expect(changedResumeSections(initial, current)).toEqual(["career"]);
  });

  it("문자열 섹션(자기소개)도 잡는다", () => {
    const initial = emptyResume({ 자기소개_요약: "초안 문장" });
    const current = emptyResume({ 자기소개_요약: "내가 고친 문장" });
    expect(changedResumeSections(initial, current)).toEqual(["summary"]);
  });

  it("객체 섹션(인적사항) 안의 한 필드만 바뀌어도 잡는다", () => {
    const initial = emptyResume();
    const current = emptyResume({
      인적사항: { ...emptyResume().인적사항, 이름: "김서윤" },
    });
    expect(changedResumeSections(initial, current)).toEqual(["personal_info"]);
  });

  it("여러 섹션을 고치면 화면 순서대로 모두 잡는다", () => {
    const initial = emptyResume();
    const current = emptyResume({
      자기소개_요약: "고침",
      인적사항: { ...emptyResume().인적사항, 이름: "김서윤" },
      기술및역량: { 기술스택: ["TypeScript"], 툴: [], 소프트스킬: [] },
    });
    // 화면(ResumeEditorPanel) 아코디언 순서를 그대로 따른다 — 다운스트림에서
    // 정렬을 다시 하지 않아도 "위쪽 섹션부터 고치는가"를 볼 수 있다.
    expect(changedResumeSections(initial, current)).toEqual([
      "personal_info",
      "summary",
      "skills",
    ]);
  });

  it("사용자가 편집할 수 없는 키(meta·연계성·파싱경고)는 세지 않는다", () => {
    const initial = emptyResume();
    const current = emptyResume({
      meta: { ...emptyResume().meta, source_chars: 999 },
      연계성: [{ 항목ids: [1], 연결점: "x" }],
      파싱경고: ["경고"],
    });
    // 편집기에 입력칸이 없는 값들이다. 여기까지 세면 서버 응답 차이만으로
    // "사용자가 고쳤다"가 되어 수정률이 부풀려진다.
    expect(changedResumeSections(initial, current)).toEqual([]);
  });
});
