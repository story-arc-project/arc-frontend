import { describe, it, expect, beforeEach } from "vitest";

import {
  applyBaseline,
  readBaseline,
  writeBaselineIfAbsent,
} from "./cover-letter-baseline";
import type { CoverLetterResult } from "@/types/cover-letter";

function result(...bodies: string[]): CoverLetterResult {
  return {
    answers: bodies.map((body, i) => ({
      question: `문항 ${i + 1}`,
      cover_letter: body,
      grounding: { grounded: true, unsupported_claims: [], notes: "" },
    })),
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

/**
 * 이 기준선이 없으면 **저장 성공 후 새로고침**이 편집을 "검증됨"으로 세탁한다:
 * 서버 본문이 편집본으로 바뀌어 `서버 === 화면` 이 되므로 편집 신호가 사라진다.
 */
describe("cover-letter baseline — 검증 기준선은 생성 본문에 고정된다", () => {
  it("처음 본 본문을 기준선으로 남긴다", () => {
    writeBaselineIfAbsent("cl-1", result("원본 A", "원본 B"));
    expect(readBaseline("cl-1")).toEqual(["원본 A", "원본 B"]);
  });

  it("이미 기준선이 있으면 덮지 않는다 — 덮으면 편집본이 새 기준선이 된다", () => {
    writeBaselineIfAbsent("cl-1", result("원본"));
    writeBaselineIfAbsent("cl-1", result("사용자가 고친 본문"));
    expect(readBaseline("cl-1")).toEqual(["원본"]);
  });

  it("서버 본문에 기준선을 덧씌워 편집 판정 기준을 만든다", () => {
    const server = result("사용자가 고친 본문");
    const merged = applyBaseline(server, ["원본"]);
    expect(merged.answers[0].cover_letter).toBe("원본");
    // 본문만 갈아 끼우고 검증 결과 등 나머지는 서버 값을 그대로 둔다.
    expect(merged.answers[0].grounding).toEqual(server.answers[0].grounding);
  });

  it("문항 수가 어긋난 기준선은 쓰지 않는다 — 억지 비교는 엉뚱한 문항을 '고쳤다'고 만든다", () => {
    const server = result("A", "B");
    expect(applyBaseline(server, ["A"])).toBe(server);
  });

  it("기준선이 없으면 서버 본문을 그대로 쓴다", () => {
    const server = result("A");
    expect(applyBaseline(server, null)).toBe(server);
  });

  it.each([
    ["배열이 아님", JSON.stringify({ 0: "A" })],
    ["원소가 문자열이 아님", JSON.stringify(["A", 3])],
    ["JSON 아님", "{{{"],
  ])("%s 인 저장물은 기준선으로 신뢰하지 않는다", (_label, raw) => {
    window.localStorage.setItem("arc:cover-letter-verified:cl-2", raw);
    expect(readBaseline("cl-2")).toBeNull();
  });
});
