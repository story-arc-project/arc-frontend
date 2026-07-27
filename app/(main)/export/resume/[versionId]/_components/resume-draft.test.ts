import { describe, it, expect, beforeEach } from "vitest";

import { readDraft, writeDraft } from "./resume-draft";
import type { ResumeVersion } from "@/types/resume";

function resume(링크: unknown): ResumeVersion {
  return {
    meta: {
      language: "ko",
      format: "korean_resume",
      generated_at: "2026-07-20",
      source_chars: 100,
    },
    인적사항: {
      이름: "홍길동",
      영문명: null,
      생년월일: null,
      이메일: null,
      전화번호: null,
      주소: null,
      링크: 링크 as never,
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
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

/**
 * 임시 저장은 레쥬메 본문이 들어오는 **또 하나의 경계**다. getResume 만 정규화하면,
 * 이 변경 이전에 저장된(문자열 링크가 그대로 들어 있는) draft 를 복원할 때 정규화를
 * 우회해 링크가 화면에서 사라지는 증상이 되살아난다.
 */
describe("readDraft — 링크 정규화 (codex P2)", () => {
  it("문자열 링크가 든 구 draft 를 복원해도 객체로 정규화한다", () => {
    window.localStorage.setItem(
      "arc:resume-draft:v1",
      JSON.stringify({
        data: resume(["https://github.com/me"]),
        updated_at: "2026-07-21T00:00:00.000Z",
      }),
    );

    const draft = readDraft("v1");
    expect(draft?.data.인적사항.링크).toEqual([
      { label: null, url: "https://github.com/me" },
    ]);
  });

  it("정상 객체 draft 는 그대로 통과시킨다", () => {
    writeDraft("v2", resume([{ label: "GitHub", url: "https://github.com/me" }]));

    const draft = readDraft("v2");
    expect(draft?.data.인적사항.링크).toEqual([
      { label: "GitHub", url: "https://github.com/me" },
    ]);
  });

  it("저장된 값이 없으면 null 을 그대로 돌려준다", () => {
    expect(readDraft("missing")).toBeNull();
  });
});
