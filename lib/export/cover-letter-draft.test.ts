import { describe, it, expect, beforeEach } from "vitest";

import { isDraftNewer, readDraft, writeDraft, type CoverLetterDraft } from "./cover-letter-draft";
import type { CoverLetterResult } from "@/types/cover-letter";

function result(createdAt?: unknown): CoverLetterResult {
  return {
    answers: [
      {
        question: "지원 동기를 서술하시오",
        cover_letter: "저는 학부 시절 데이터 분석 동아리에서…",
        grounding: { grounded: true, unsupported_claims: [], notes: "" },
        writing_guide: "",
      },
    ],
    ...(createdAt === undefined ? {} : { created_at: createdAt as string }),
  };
}

function draft(updatedAt: string): CoverLetterDraft {
  return { data: result(), updated_at: updatedAt };
}

beforeEach(() => {
  window.localStorage.clear();
});

/**
 * `isDraftNewer === false` 는 호출부에서 `clearDraft` 로 이어진다(되돌릴 수 없다).
 * 그래서 이 판정의 실패 방향이 곧 데이터 유실 여부다 — 아래 두 케이스가 그 경계다.
 */
describe("isDraftNewer — 판정 불가는 삭제 쪽으로 떨어지지 않는다", () => {
  it("서버 created_at 이 없으면 draft 를 살린다(BAC-62 계약이 이 필드를 안 줄 수 있다)", () => {
    expect(isDraftNewer(draft("2026-07-24T00:00:00.000Z"), result(undefined))).toBe(true);
  });

  it.each([["빈 문자열", ""], ["형식 이상", "어제쯤"], ["숫자", 17_216_000]])(
    "서버 created_at 이 %s 이어도 draft 를 살린다",
    (_label, createdAt) => {
      expect(isDraftNewer(draft("2026-07-24T00:00:00.000Z"), result(createdAt))).toBe(true);
    },
  );

  // 반대편 경계 — draft 자신의 시각이 깨졌으면 그 draft 는 신뢰할 수 없다.
  it("draft 자신의 시각이 깨졌으면 정리 대상으로 둔다", () => {
    expect(isDraftNewer(draft("not-a-date"), result("2026-07-24T00:00:00.000Z"))).toBe(false);
  });

  it("양쪽을 다 읽을 수 있으면 시각으로 비교한다", () => {
    const server = "2026-07-24T00:00:00.000Z";
    expect(isDraftNewer(draft("2026-07-25T00:00:00.000Z"), result(server))).toBe(true);
    expect(isDraftNewer(draft("2026-07-23T00:00:00.000Z"), result(server))).toBe(false);
  });
});

/**
 * 임시 저장도 본문이 들어오는 하나의 경계다 — 서버 경로와 같은 정규화를 태우지 않으면
 * 낡은 스키마의 draft 가 방어를 우회한다(resume-draft 교훈).
 */
describe("readDraft — 복원도 정규화를 통과한다", () => {
  it("grounding 이 깨진 구 draft 를 복원해도 통과로 보지 않는다", () => {
    window.localStorage.setItem(
      "arc:cover-letter-draft:cl-1",
      JSON.stringify({
        data: { answers: [{ question: "Q", cover_letter: "본문", grounding: null }] },
        updated_at: "2026-07-24T00:00:00.000Z",
      }),
    );

    const restored = readDraft("cl-1");
    expect(restored?.data.answers[0].grounding).toEqual({
      grounded: false,
      unsupported_claims: [],
      notes: "",
    });
  });

  it("정상 draft 는 왕복해도 본문이 보존된다", () => {
    expect(writeDraft("cl-2", result("2026-07-24T00:00:00.000Z"))).toBe(true);
    expect(readDraft("cl-2")?.data.answers[0].cover_letter).toContain("데이터 분석 동아리");
  });

  it("updated_at 없는 저장물은 draft 로 인정하지 않는다", () => {
    window.localStorage.setItem(
      "arc:cover-letter-draft:cl-3",
      JSON.stringify({ data: result() }),
    );
    expect(readDraft("cl-3")).toBeNull();
  });

  it("저장된 값이 없으면 null 을 돌려준다", () => {
    expect(readDraft("missing")).toBeNull();
  });
});
