import { describe, it, expect } from "vitest";

import { splitLongToken } from "@/lib/export/resume-pdf";

// react-pdf 는 텍스트를 공백으로만 쪼갠다. 공백 없이 긴 토큰(URL·이메일)이 통째로
// 남으면 줄을 바꿀 자리가 없어 본문 폭을 넘어 잘린다 — 그 지점을 만드는 함수다.
describe("splitLongToken", () => {
  it("짧은 말은 건드리지 않는다", () => {
    expect(splitLongToken("협업")).toEqual(["협업"]);
    expect(splitLongToken("engineering")).toEqual(["engineering"]);
  });

  it("긴 URL 에 줄바꿈 지점을 만든다", () => {
    const url = "https://github.com/story-arc-project/arc-frontend/pull/182";
    const parts = splitLongToken(url);

    expect(parts.length).toBeGreaterThan(1);
    // 어떤 조각도 한 줄을 통째로 삼킬 만큼 길면 안 된다.
    expect(Math.max(...parts.map((p) => p.length))).toBeLessThanOrEqual(18);
  });

  it("쪼갠 조각을 이어 붙이면 원문 그대로다", () => {
    const samples = [
      "https://github.com/story-arc-project/arc-frontend/pull/182",
      "very.long.email.address@some-university.ac.kr",
      "가".repeat(50),
      "supercalifragilisticexpialidocious",
    ];

    for (const sample of samples) {
      expect(splitLongToken(sample).join("")).toBe(sample);
    }
  });

  it("구분자가 없는 긴 토큰도 상한 길이로 끊는다", () => {
    const parts = splitLongToken("a".repeat(45));

    expect(parts.every((p) => p.length <= 18)).toBe(true);
    expect(parts.join("")).toBe("a".repeat(45));
  });
});
