import { describe, expect, it } from "vitest";
import { displayCoverLetterSegments, stripCoverLetterMarkdown } from "./cover-letter-display";
import { buildGroundingHighlight } from "./cover-letter-grounding";

describe("cover letter display", () => {
  it.each([
    ["__협업 경험__도 있습니다.", "협업 경험도 있습니다."],
    ["## 강점 ##\n\n**실행력**과 __협업__", "강점\n\n실행력과 협업"],
    ["- 첫 경험\n- 다음 경험\n\n1. 시작\n2. 완료", "첫 경험\n다음 경험\n\n시작\n완료"],
    ["## 제목 ##\r\n- 하나\r\n- 둘\r\n", "제목\r\n하나\r\n둘\r\n"],
    ["  + 하나\n  + 둘\n3) 셋\n4) 넷", "  하나\n  둘\n셋\n넷"],
  ])("removes clear syntax: %s", (raw, shown) => expect(stripCoverLetterMarkdown(raw)).toBe(shown));
  it.each([
    "C# #태그 inline #, 10% + 2 = 12, -5, 2026-10-26, 1.5", "1. 단독 항목\n3. 비연속 항목", "- 단독 대시", "* * *\n* * *", "- - -\n- - -", "`code\n**literal**`", "__init__method", "a__word__b", "가나다__라__마", "**성과\\**", "** 미완성 **", "** **", "**미완성", "\\**보존**", "*단일* _단일_", "2 ** 3 ** 4", "***삼중***", "---\n***\n___", "`**코드**`", "```\n# 코드\n- 하나\n- 둘\n```", "[**링크**](url)", "<b>**HTML**</b>", "    # 들여쓴 코드\n    **코드**",
  ])("preserves ambiguous or out-of-scope text: %s", raw => expect(stripCoverLetterMarkdown(raw)).toBe(raw));
  it.each([
    "`` **앞 코드** ` **뒤 코드** ``",
    "`` **앞 코드**\n` # 코드\n**뒤 코드** ``",
    "`` **코드** ``` **코드** ``",
    "[**링크**][ref]\n\n[ref]: https://example.com",
    "[**링크**][]\n\n[**링크**]: https://example.com",
    "[**링크**]\n\n[**링크**]: https://example.com",
    "<pre>\n**literal**\n</pre>",
    "<div>\n<div>**inner**</div>\n**outer**\n</div>",
    "[**링크**][REF]\n\n[ref]: https://example.com",
    "[**링크**][missing]",
    "<div>\n## literal\n- 하나\n- 둘\n</div>",
    '<pre class="example">\n__literal__\n</pre>',
  ])("preserves complete literal ranges: %s", raw => expect(stripCoverLetterMarkdown(raw)).toBe(raw));
  it("still strips ordinary bracket prose and emphasis outside literal ranges", () => {
    expect(stripCoverLetterMarkdown("[**설명**]\n<pre>\n**literal**\n</pre>\n**강점**")).toBe("[설명]\n<pre>\n**literal**\n</pre>\n강점");
  });
  it("preserves literal ranges across grounding segment boundaries", () => {
    const raw = "`` **코드** ` **본문** ``\n[**링크**][ref]\n\n[ref]: url\n<pre>\n**literal**\n</pre>\n**강점**";
    const segments = raw.split(/(코드|링크|literal|강점)/).map(text => ({ text, flagged: ["코드", "링크", "literal", "강점"].includes(text) }));
    const before = structuredClone(segments);
    const shown = displayCoverLetterSegments(segments);
    expect(shown.map(segment => segment.text).join("")).toBe(raw.slice(0, -6) + "강점");
    expect(shown.filter(segment => segment.flagged).map(segment => segment.text)).toEqual(["코드", "링크", "literal", "강점"]);
    expect(segments).toEqual(before);
  });
  it("projects whole-string removals across raw grounding boundaries without mutating input", () => {
    const raw = "**수상 경력**입니다. **수상 경력**입니다.\n## 다음 주장";
    const segments = buildGroundingHighlight(raw, ["*수상 경력*", "## 다음 주장"]).segments;
    const before = structuredClone(segments);
    const shown = displayCoverLetterSegments(segments);
    expect(shown.map(s => s.text).join("")).toBe("수상 경력입니다. 수상 경력입니다.\n다음 주장");
    expect(shown.filter(s => s.flagged).map(s => s.text)).toEqual(["수상 경력", "수상 경력", "다음 주장"]);
    expect(segments).toEqual(before);
  });
  it.each([
    "[a\n**link**\n](https://example.com)",
    "<!--\n**literal**\n## literal\n- 하나\n- 둘\n-->",
    "𐐀__value__", "café__value__", "__value__𐐀", "__value__́",
    "**첫 문단\n\n다음 문단**", "**첫 문단\r\n \t\r\n다음 문단**",
  ])("preserves cloud review literal case: %s", raw => expect(stripCoverLetterMarkdown(raw)).toBe(raw));
  it.each([
    ["`**` 기호로 **강조**합니다.", "`**` 기호로 강조합니다."],
    ["\\**literal **강조**", "\\**literal 강조"],
    ["** 미완성 **강조**", "** 미완성 강조"],
    ["**첫 줄\n다음 줄**", "첫 줄\n다음 줄"],
  ])("recovers valid emphasis after rejected candidates: %s", (raw, shown) => expect(stripCoverLetterMarkdown(raw)).toBe(shown));
  it.each([
    "[label](https://example.com/path'**value**)",
    '[label](https://example.com/path(foo) "**title**")',
    '[label](<https://example.com/path(foo)> "**title**")',
    '[label](https://example.com/path(foo)\n"**title**")',
    '[multi\nlabel](https://example.com/a(b(c))\n"**title**) text")',
    "[label](https://example.com/a(b)\n'**title**) text')",
    '[label](https://example.com/path(foo)\r\n"**title**")',
    '[label](<https://example.com/path(foo)>\n"**title**) text")',
    '[label](https://example.com/path\\(foo\\)\n"**title**")',
  ])("preserves balanced inline link and following emphasis: %s", raw => {
    expect(stripCoverLetterMarkdown(raw)).toBe(raw);
    expect(stripCoverLetterMarkdown(raw + " **강조**")).toBe(raw + " 강조");
  });
  it.each(["<https://example.com/**path**>", "<mailto:__name__@example.com>", "<__name__@example.com>"])("preserves angle autolinks with emphasis outside: %s", raw => {
    expect(stripCoverLetterMarkdown(raw + " **강조**")).toBe(raw + " 강조");
  });
  it("projects balanced links across raw grounding segments", () => {
    const raw = '[label](https://example.com/path(foo)\n"**title**") **강조**';
    const segments = buildGroundingHighlight(raw, ["title", "강조**"]).segments;
    const before = structuredClone(segments);
    const shown = displayCoverLetterSegments(segments);
    expect(shown.map(s => s.text).join("")).toBe(raw.slice(0, -6) + "강조");
    expect(shown.filter(s => s.flagged).map(s => s.text)).toEqual(["title", "강조"]);
    expect(segments).toEqual(before);
  });
  it.each([
    '<![CDATA[**literal**]]>', '<![CDATA[\n## title\n**literal**\n]]>',
    '<?pi **literal**?>', '<?pi\n**literal** >\n?>',
    '<!DOCTYPE html PUBLIC "**literal**">', '<!DOCTYPE html "a>b **literal**">',
  ])("preserves angle declarations with following emphasis: %s", raw => {
    expect(stripCoverLetterMarkdown(raw + " **강조**")).toBe(raw + " 강조");
  });
  it.each([
    '[**label**](https://example.com',
    '[**label**](https://example.com/path(foo)\n"**title**"',
  ])("retains ambiguous incomplete links: %s", raw => expect(stripCoverLetterMarkdown(raw)).toBe(raw));
  it.each([
    ["`<?php` 구문 뒤 **강조**", "`<?php` 구문 뒤 강조"],
    ["`[label](` 구문 뒤 **강조**", "`[label](` 구문 뒤 강조"],
    ["`code\n<?php [label](`\n**강조**", "`code\n<?php [label](`\n강조"],
    ["<!-- <?php [label]( --> **강조**", "<!-- <?php [label]( --> 강조"],
    ["<pre>\n<?php [label](\n**literal**\n</pre>\n**강조**", "<pre>\n<?php [label](\n**literal**\n</pre>\n강조"],
  ])("does not expand openers inside established literal ranges: %s", (raw, shown) => expect(stripCoverLetterMarkdown(raw)).toBe(shown));
  it.each([
    '[label](https://example.com/**path**)\n\n[label]: https://example.com',
    '[label](https://example.com/a(b)\n"**title**")\n\n[label]: https://example.com',
    '[label](https://example.com/**path**\n\n[label]: https://example.com',
  ])("gives inline links precedence over same-label shortcut references: %s", raw => expect(stripCoverLetterMarkdown(raw)).toBe(raw));
  it("still cleans ordinary emphasis after an inline link with a reference label", () => {
    const raw = '[label](https://example.com/**path**) **강조**\n\n[label]: https://example.com';
    expect(stripCoverLetterMarkdown(raw)).toBe('[label](https://example.com/**path**) 강조\n\n[label]: https://example.com');
  });
  it.each([
    '[label [nested] **text**](https://example.com)',
    '[label \\] **text**](https://example.com)',
    '[label [nested] **text**](https://example.com',
  ])("retains balanced or escaped link labels: %s", raw => {
    expect(stripCoverLetterMarkdown(raw)).toBe(raw);
  });
  it("cleans outside balanced labels and keeps escaped opening brackets ordinary", () => {
    expect(stripCoverLetterMarkdown('[label [nested] **text**](url) **강조**')).toBe('[label [nested] **text**](url) 강조');
    expect(stripCoverLetterMarkdown('\\[label **text**](url) **강조**')).toBe('\\[label text](url) 강조');
  });
  it.each([
    '<div>\n<!-- </div> -->\n**literal**\n</div>',
    '<div>\n<!-- <div> -->\n**literal**\n</div>',
  ])("ignores comment tags when pairing actual HTML: %s", raw => expect(stripCoverLetterMarkdown(raw + '\n**강조**')).toBe(raw + '\n강조'));
  it("does not interpret a code-contained comment opener as an HTML comment", () => {
    const raw = '`<!--`\n<div>\n**literal**\n</div>\n**강조**';
    expect(stripCoverLetterMarkdown(raw)).toBe('`<!--`\n<div>\n**literal**\n</div>\n강조');
  });
  it.each([
    ['\\` **ordinary** `**code**`', '\\` ordinary `**code**`'],
    ['\\\\` **code** ` **ordinary**', '\\\\` **code** ` ordinary'],
    ['\\`` **ordinary** ``**code**``', '\\`` ordinary ``**code**``'],
    ['`**code**\\` **ordinary**', '`**code**\\` ordinary'],
  ])("respects escaped opener parity and actual code closers: %s", (raw, shown) => expect(stripCoverLetterMarkdown(raw)).toBe(shown));
  it.each([
    '[label](url "<!--")',
    "[label](url '<!--')",
    '<!DOCTYPE html "<!--">',
    '<?pi "<!--"?>',
  ])("does not let enclosed comment syntax change following HTML pairing: %s", prefix => {
    const raw = prefix + '\n<div>\n**literal**\n</div>\n**ordinary**';
    expect(stripCoverLetterMarkdown(raw)).toBe(prefix + '\n<div>\n**literal**\n</div>\nordinary');
  });
  it("still recognizes a real comment after a link-contained fake opener", () => {
    const raw = '[label](url "<!--")\n<div>\n<!-- </div> -->\n**literal**\n</div>\n**ordinary**';
    expect(stripCoverLetterMarkdown(raw)).toBe(raw.slice(0, -12) + 'ordinary');
  });
  it.each([
    '<!-- <?php -->\n<div>\n<!-- </div> -->\n**literal**\n</div>\n**ordinary**',
    '<pre>\n<?php [label](\n<!-- </pre> -->\n**literal**\n</pre>\n**ordinary**',
  ])("keeps genuine comment masking despite earlier ambiguous openers: %s", raw => {
    expect(stripCoverLetterMarkdown(raw)).toBe(raw.slice(0, -12) + 'ordinary');
  });
  it.each([
    '<div title="<!--">', "<div title='<!--'>", '<div title="a>b<!--">', '<div title="&quot;<!--">',
  ])("ignores comment-like HTML attribute text: %s", opening => {
    const raw = opening + '\n**literal**\n</div>\n**ordinary**';
    expect(stripCoverLetterMarkdown(raw)).toBe(opening + '\n**literal**\n</div>\nordinary');
  });
  it("recognizes actual comments after an opening tag with a fake attribute opener", () => {
    const raw = '<div title="<!--">\n<!-- </div> -->\n**literal**\n</div>\n**ordinary**';
    expect(stripCoverLetterMarkdown(raw)).toBe(raw.slice(0, -12) + 'ordinary');
  });
  it("keeps multiline raw claim matching", () => {
    const raw = "**여러 줄\n주장입니다**";
    const shown = displayCoverLetterSegments(buildGroundingHighlight(raw, ["여러 줄 주장입니다"]).segments);
    expect(shown.filter(s => s.flagged).map(s => s.text)).toEqual(["여러 줄\n주장입니다"]);
  });
});
