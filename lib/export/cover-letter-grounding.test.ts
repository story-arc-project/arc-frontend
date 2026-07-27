import { describe, it, expect } from "vitest";
import { buildGroundingHighlight } from "./cover-letter-grounding";

/** 하이라이트된 조각만 뽑아 비교하기 위한 헬퍼. */
function flagged(body: string, claims: string[]): string[] {
  return buildGroundingHighlight(body, claims)
    .segments.filter((s) => s.flagged)
    .map((s) => s.text);
}

/** 조각을 다시 이으면 항상 원문이어야 한다 — 본문 손실은 절대 없어야 하는 불변식. */
function joined(body: string, claims: string[]): string {
  return buildGroundingHighlight(body, claims)
    .segments.map((s) => s.text)
    .join("");
}

describe("buildGroundingHighlight", () => {
  it("주장이 없으면 본문 한 덩어리를 그대로 돌려준다", () => {
    const res = buildGroundingHighlight("저는 성장했습니다.", []);
    expect(res.segments).toEqual([{ text: "저는 성장했습니다.", flagged: false }]);
    expect(res.unmatched).toEqual([]);
  });

  it("본문에 있는 주장을 찾아 구간을 표시한다", () => {
    const body = "저는 데이터 분석을 했습니다. 3년간 팀장 경험이 있습니다. 그래서 지원합니다.";
    expect(flagged(body, ["3년간 팀장 경험이 있습니다."])).toEqual([
      "3년간 팀장 경험이 있습니다.",
    ]);
  });

  it("같은 주장이 여러 번 나오면 모두 표시한다", () => {
    const body = "수상 경력이 있습니다. 그리고 또, 수상 경력이 있습니다.";
    expect(flagged(body, ["수상 경력이 있습니다."])).toHaveLength(2);
  });

  it("줄바꿈·띄어쓰기만 다른 경우도 공백을 접어 찾아낸다", () => {
    const body = "저는 3년간\n  팀장 경험이 있습니다.";
    const res = buildGroundingHighlight(body, ["3년간 팀장 경험이 있습니다."]);
    expect(res.unmatched).toEqual([]);
    expect(res.segments.some((s) => s.flagged)).toBe(true);
  });

  // 이 유틸의 가장 중요한 안전장치 — 못 찾은 주장이 조용히 사라지면 안 된다.
  it("본문에서 못 찾은 주장은 unmatched 로 돌려준다(배너가 반드시 보여줘야 함)", () => {
    const res = buildGroundingHighlight("전혀 다른 본문입니다.", ["없는 주장입니다"]);
    expect(res.unmatched).toEqual(["없는 주장입니다"]);
    expect(res.segments.every((s) => !s.flagged)).toBe(true);
  });

  it("너무 짧은 조각은 하이라이트하지 않고 unmatched 로 넘긴다(오탐 방지)", () => {
    const res = buildGroundingHighlight("저는 팀을 이끌었습니다.", ["팀"]);
    expect(res.segments.every((s) => !s.flagged)).toBe(true);
    expect(res.unmatched).toEqual(["팀"]);
  });

  it("겹치는 주장들은 한 구간으로 합친다", () => {
    const body = "저는 3년간 팀장으로 일했습니다.";
    const res = buildGroundingHighlight(body, ["3년간 팀장으로", "팀장으로 일했습니다"]);
    expect(res.segments.filter((s) => s.flagged)).toHaveLength(1);
    expect(flagged(body, ["3년간 팀장으로", "팀장으로 일했습니다"])[0]).toBe(
      "3년간 팀장으로 일했습니다",
    );
  });

  it("빈 문자열 주장은 무시한다", () => {
    const res = buildGroundingHighlight("본문입니다.", ["", "   "]);
    expect(res.unmatched).toEqual([]);
    expect(res.segments).toEqual([{ text: "본문입니다.", flagged: false }]);
  });

  it("빈 본문이면 주장은 전부 unmatched 다", () => {
    const res = buildGroundingHighlight("", ["어떤 주장입니다"]);
    expect(res.segments).toEqual([]);
    expect(res.unmatched).toEqual(["어떤 주장입니다"]);
  });

  // 불변식: 하이라이트는 표시일 뿐 본문을 바꾸지 않는다.
  it.each([
    ["본문 시작에 주장", "3년간 팀장 경험. 이후 성장했습니다.", ["3년간 팀장 경험."]],
    ["본문 끝에 주장", "성장했습니다. 3년간 팀장 경험.", ["3년간 팀장 경험."]],
    ["본문 전체가 주장", "3년간 팀장 경험.", ["3년간 팀장 경험."]],
    ["여러 주장", "가나다라. 마바사아. 자차카타.", ["가나다라.", "자차카타."]],
  ])("%s — 조각을 이으면 원문 그대로다", (_label, body, claims) => {
    expect(joined(body, claims)).toBe(body);
  });
});
