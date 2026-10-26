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
  it.each([
    '<!-- <span title=" -->\n<div>\n**literal**\n</div>\n" >\n**ordinary**',
    "<!-- <span title=' -->\n<div>\n**literal**\n</div>\n' >\n**ordinary**",
  ])("does not let comment-contained quoted tags hide following real tags: %s", raw => {
    expect(stripCoverLetterMarkdown(raw)).toBe(raw.slice(0, -12) + 'ordinary');
  });
  it.each([
    '[label](url "`")', '<!-- ` -->', '<!DOCTYPE html "`">',
    '[label](url "``")',
  ])("does not open code from an enclosing literal: %s", prefix => {
    const ticks = prefix.includes('``') ? '``' : '`';
    expect(stripCoverLetterMarkdown(prefix + ' **ordinary** ' + ticks + '**code**' + ticks)).toBe(prefix + ' ordinary ' + ticks + '**code**' + ticks);
  });
  it.each([
    '[ref]:\nhttps://example.com/**path**',
    '[ref]: https://example.com\n"**title**"',
    "[ref]:\nhttps://example.com/**path**\n'**title**\ncontinued'",
    '[ref]: <https://example.com/**path**>\n("**title**")',
  ])("preserves a full multiline reference definition: %s", definition => {
    const raw = definition + '\n\n[link][ref]\n**ordinary**';
    expect(stripCoverLetterMarkdown(raw)).toBe(definition + '\n\n[link][ref]\nordinary');
  });
  it.each([
    ['[ref]:\n\n**ordinary**', '[ref]:\n\nordinary'],
    ['[ref]: url\n\n"**ordinary**"', '[ref]: url\n\n"ordinary"'],
    ['[ref]: url\n**ordinary**', '[ref]: url\nordinary'],
    ['[ref]: url\n"unfinished\n\n**ordinary**', '[ref]: url\n"unfinished\n\nordinary'],
  ])("respects reference continuation boundaries: %s", (raw, shown) => expect(stripCoverLetterMarkdown(raw)).toBe(shown));
  it("projects enclosing literals and reference continuations across raw claims", () => {
    const raw = '[label](url "`") **ordinary** `**code**`\n\n[ref]:\nhttps://example.com/**path**\n"**title**"\n\n**claim**';
    const segments = buildGroundingHighlight(raw, ['ordinary', 'code', 'path', 'title', 'claim']).segments;
    const before = structuredClone(segments);
    const shown = displayCoverLetterSegments(segments);
    expect(shown.map(s => s.text).join('')).toBe(raw.replace('**ordinary**', 'ordinary').replace('**claim**', 'claim'));
    expect(shown.filter(s => s.flagged).map(s => s.text)).toEqual(['ordinary', 'code', 'path', 'title', 'claim']);
    expect(segments).toEqual(before);
  });
  it.each([
    '`[label](url "**literal**")`', '`<!-- **literal** -->`',
    '[ref]: url "**title**\ncontinued"',
    '[ref\\]]:\nurl\n"**title**"',
    '[ref [nested]]: url\n"**title**"',
    '[ref]:\r\n  <https://example.com/**path**>\r\n  "**title**"',
  ])("preserves surrounding literal ownership and reference variants: %s", literal => {
    expect(stripCoverLetterMarkdown(literal + '\n\n**ordinary**')).toBe(literal + '\n\nordinary');
  });
  it.each([
    '<div>\n`\n</div>',
    '<pre>\n``\n**literal**\n</pre>',
    '<div>\n<div>`</div>\n<!-- </div> -->\n**literal**\n</div>',
    '<div title="a>b">\n`\n<span title="</div>">**literal**</span>\n</div>',
  ])("resolves enclosing HTML before interior code openers: %s", html => {
    const ticks = html.includes('``') ? '``' : '`';
    expect(stripCoverLetterMarkdown(html + '\n\n**ordinary** ' + ticks + '**code**' + ticks)).toBe(html + '\n\nordinary ' + ticks + '**code**' + ticks);
  });
  it.each([
    'https://example.com/__portfolio__/',
    'http://example.com/**path**?q=__query__#**fragment**',
    'https://example.com/a(b)/__portfolio__/',
    'www.example.com/__portfolio__/',
  ])("preserves bare URLs while cleaning neighboring prose: %s", url => {
    expect(stripCoverLetterMarkdown('**before** ' + url + ' **after**')).toBe('before ' + url + ' after');
  });
  it("keeps code ownership around HTML-looking text and URL boundaries", () => {
    expect(stripCoverLetterMarkdown('`<div>**literal**</div>`\n**ordinary**')).toBe('`<div>**literal**</div>`\nordinary');
    expect(stripCoverLetterMarkdown('https://example.com/__path__/\n**ordinary** `**code**`')).toBe('https://example.com/__path__/\nordinary `**code**`');
  });
  it("projects HTML and bare URL ranges without changing raw grounding claims", () => {
    const raw = '<div>\n` **literal**\n</div>\n\n**ordinary** `**code**` https://example.com/__portfolio__/';
    const segments = buildGroundingHighlight(raw, ['literal', 'ordinary', 'code', 'portfolio']).segments;
    const before = structuredClone(segments);
    const shown = displayCoverLetterSegments(segments);
    expect(shown.map(s => s.text).join('')).toBe(raw.replace('**ordinary**', 'ordinary'));
    expect(shown.filter(s => s.flagged).map(s => s.text)).toEqual(['literal', 'ordinary', 'code', 'portfolio']);
    expect(segments).toEqual(before);
  });
  it.each(['\n\n', '\n \t\n', '\r\n\r\n', '\r\n \t\r\n'])("bounds code matching at paragraph breaks: %j", boundary => {
    const raw = '`unfinished' + boundary + '**ordinary** `**code**`';
    expect(stripCoverLetterMarkdown(raw)).toBe('`unfinished' + boundary + 'ordinary `**code**`');
  });
  it.each([
    '[label [nested] **text**][ref]',
    '[label \\] **text**][ref]',
    '[label [nested] **text**][]',
    '[label \\] **text**][]',
    '[label [nested] **text**][missing]',
    '[label \\] ` **text**][ref]',
  ])("recognizes balanced explicit references as source-order literals: %s", reference => {
    const definitions = '\n\n[ref]: https://example.com';
    expect(stripCoverLetterMarkdown(reference + definitions)).toBe(reference + definitions);
    expect(stripCoverLetterMarkdown(reference + ' **ordinary** `**code**`' + definitions)).toBe(reference + ' ordinary `**code**`' + definitions);
  });
  it("keeps single-newline code spans and projects bounded literal ranges", () => {
    expect(stripCoverLetterMarkdown('`first\n**code**` **ordinary**')).toBe('`first\n**code**` ordinary');
    const raw = '`unfinished\r\n \t\r\n[label [nested] **text**][ref] **ordinary** `**code**`\n\n[ref]: url';
    const segments = buildGroundingHighlight(raw, ['text', 'ordinary', 'code']).segments;
    const before = structuredClone(segments);
    const shown = displayCoverLetterSegments(segments);
    expect(shown.map(s => s.text).join('')).toBe(raw.replace('**ordinary**', 'ordinary'));
    expect(shown.filter(s => s.flagged).map(s => s.text)).toEqual(['text', 'ordinary', 'code']);
    expect(segments).toEqual(before);
  });
  it("keeps multiline raw claim matching", () => {
    const raw = "**여러 줄\n주장입니다**";
    const shown = displayCoverLetterSegments(buildGroundingHighlight(raw, ["여러 줄 주장입니다"]).segments);
    expect(shown.filter(s => s.flagged).map(s => s.text)).toEqual(["여러 줄\n주장입니다"]);
  });
});
