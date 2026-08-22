import { describe, expect, it } from "vitest";

import { firstChangedAnswerIndex } from "@/lib/export/cover-letter-diff";
import type { CoverLetterResult } from "@/types/cover-letter";

function make(bodies: string[]): CoverLetterResult {
  return {
    answers: bodies.map((cover_letter, i) => ({
      question: `문항 ${i + 1}`,
      cover_letter,
      grounding: { grounded: true, sentences: [] } as never,
    })),
  };
}

describe("firstChangedAnswerIndex — 어느 문항에 처음 손댔나 (FRT-107)", () => {
  it("같으면 -1 이다", () => {
    expect(firstChangedAnswerIndex(make(["가", "나"]), make(["가", "나"]))).toBe(-1);
  });

  it("처음 달라지는 문항의 번호를 준다", () => {
    expect(firstChangedAnswerIndex(make(["가", "다"]), make(["가", "나"]))).toBe(1);
  });

  it("앞 문항이 바뀌면 뒤가 더 바뀌어도 앞을 준다", () => {
    expect(firstChangedAnswerIndex(make(["A", "B"]), make(["가", "나"]))).toBe(0);
  });

  it("문항 수가 늘면 경계가 첫 변화다", () => {
    expect(firstChangedAnswerIndex(make(["가", "나"]), make(["가"]))).toBe(1);
  });

  it("문항 수가 줄어도 경계가 첫 변화다", () => {
    expect(firstChangedAnswerIndex(make(["가"]), make(["가", "나"]))).toBe(1);
  });

  it("기준선이 없으면 판정하지 않는다 (-1)", () => {
    expect(firstChangedAnswerIndex(make(["가"]), null)).toBe(-1);
    expect(firstChangedAnswerIndex(null, make(["가"]))).toBe(-1);
  });

  it("문항 제목만 다른 것은 편집으로 세지 않는다 — 사용자가 고치는 대상은 본문이다", () => {
    const a = make(["가"]);
    const b = make(["가"]);
    b.answers[0].question = "다른 제목";
    expect(firstChangedAnswerIndex(a, b)).toBe(-1);
  });
});
