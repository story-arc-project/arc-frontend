import { describe, expect, it } from "vitest";
import { displayCoverLetterSegments, stripCoverLetterMarkdown } from "./cover-letter-display";
import { buildGroundingHighlight } from "./cover-letter-grounding";

describe("cover letter display", () => {
  it.each([
    ["## 강점 ##\n\n**실행력**과 __협업__", "강점\n\n실행력과 협업"],
    ["- 첫 경험\n- 다음 경험\n\n1. 시작\n2. 완료", "첫 경험\n다음 경험\n\n시작\n완료"],
    ["## 제목 ##\r\n- 하나\r\n- 둘\r\n", "제목\r\n하나\r\n둘\r\n"],
    ["  + 하나\n  + 둘\n3) 셋\n4) 넷", "  하나\n  둘\n셋\n넷"],
  ])("removes clear syntax: %s", (raw, shown) => expect(stripCoverLetterMarkdown(raw)).toBe(shown));
  it.each([
    "C# #태그 inline #, 10% + 2 = 12, -5, 2026-10-26, 1.5", "1. 단독 항목\n3. 비연속 항목", "- 단독 대시", "a__word__b", "가나다__라__마", "**성과\\**", "** 미완성 **", "** **", "**미완성", "\\**보존**", "*단일* _단일_", "2 ** 3 ** 4", "***삼중***", "---\n***\n___", "`**코드**`", "```\n# 코드\n- 하나\n- 둘\n```", "[**링크**](url)", "<b>**HTML**</b>", "    # 들여쓴 코드\n    **코드**",
  ])("preserves ambiguous or out-of-scope text: %s", raw => expect(stripCoverLetterMarkdown(raw)).toBe(raw));
  it("projects whole-string removals across raw grounding boundaries without mutating input", () => {
    const raw = "**수상 경력**입니다. **수상 경력**입니다.\n## 다음 주장";
    const segments = buildGroundingHighlight(raw, ["*수상 경력*", "## 다음 주장"]).segments;
    const before = structuredClone(segments);
    const shown = displayCoverLetterSegments(segments);
    expect(shown.map(s => s.text).join("")).toBe("수상 경력입니다. 수상 경력입니다.\n다음 주장");
    expect(shown.filter(s => s.flagged).map(s => s.text)).toEqual(["수상 경력", "수상 경력", "다음 주장"]);
    expect(segments).toEqual(before);
  });
  it("keeps multiline raw claim matching", () => {
    const raw = "**여러 줄\n주장입니다**";
    const shown = displayCoverLetterSegments(buildGroundingHighlight(raw, ["여러 줄 주장입니다"]).segments);
    expect(shown.filter(s => s.flagged).map(s => s.text)).toEqual(["여러 줄\n주장입니다"]);
  });
});
