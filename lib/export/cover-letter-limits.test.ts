import { describe, it, expect, beforeEach } from "vitest";

import { applyLimits, readLimits, writeLimits } from "./cover-letter-limits";
import type { CoverLetterResult } from "@/types/cover-letter";

function result(
  ...answers: { question: string; max_chars?: number }[]
): CoverLetterResult {
  return {
    answers: answers.map((a) => ({
      question: a.question,
      cover_letter: "본문",
      grounding: { grounded: true, unsupported_claims: [], notes: "" },
      ...(a.max_chars === undefined ? {} : { max_chars: a.max_chars }),
    })),
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("cover-letter limits — 입력한 글자수 제한은 출력 계약에 없어 로컬에 남긴다", () => {
  it("제한이 있는 문항만 저장한다", () => {
    writeLimits("cl-1", [
      { question: "지원 동기", maxChars: 800 },
      { question: "성장 과정" },
    ]);
    expect(readLimits("cl-1")).toEqual([{ question: "지원 동기", max_chars: 800 }]);
  });

  it("제한이 하나도 없으면 아무것도 남기지 않는다", () => {
    writeLimits("cl-2", [{ question: "지원 동기" }]);
    expect(readLimits("cl-2")).toBeNull();
  });

  it("문항 본문으로 짝지어 채운다 — 인덱스만 믿으면 다른 문항 제한이 붙는다", () => {
    const merged = applyLimits(
      result({ question: "성장 과정" }, { question: "지원 동기" }),
      [{ question: "지원 동기", max_chars: 800 }],
    );
    expect(merged.answers[0].max_chars).toBeUndefined();
    expect(merged.answers[1].max_chars).toBe(800);
  });

  it("서버가 준 제한이 정본이다 — 로컬 저장분으로 덮지 않는다", () => {
    const merged = applyLimits(result({ question: "지원 동기", max_chars: 1200 }), [
      { question: "지원 동기", max_chars: 800 },
    ]);
    expect(merged.answers[0].max_chars).toBe(1200);
  });

  it("짝이 없으면 원본 객체를 그대로 돌려준다(불필요한 리렌더 방지)", () => {
    const server = result({ question: "다른 문항" });
    expect(applyLimits(server, [{ question: "지원 동기", max_chars: 800 }])).toBe(server);
    expect(applyLimits(server, null)).toBe(server);
  });

  it("깨진 저장물은 무시한다", () => {
    window.localStorage.setItem("arc:cover-letter-limits:cl-3", "{{{");
    expect(readLimits("cl-3")).toBeNull();
    window.localStorage.setItem(
      "arc:cover-letter-limits:cl-4",
      JSON.stringify([{ question: "지원 동기", max_chars: "800" }]),
    );
    expect(readLimits("cl-4")).toBeNull();
  });
});
