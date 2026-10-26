# Task 1 report

Status: implementation complete; root owns full gates, Storybook browser runs and capture.

## Scope and behavior

Added a pure display utility with removal positions computed against the joined complete raw string. Grounding matching still runs on raw server text; each original flagged segment is then projected through that mask, preserving flagged claim text even when a delimiter is split by grounding boundaries. No API, storage, feature flag, count/limit, claim policy or edit-comparison logic changed. Edited bodies receive the same display transformation while stale highlight remains disabled.

Only paired ** and __, clear ATX headers (0–3 spaces, 1–6 hashes and whitespace+content) and runs of at least two same-indent/same-family list items are removed. Ordered runs must increase by one. Prefix removal preserves indent and line endings. Escapes, Unicode intraword underscore, single/triple markers, ambiguous numeric operations, code, links and HTML are conservatively retained. Code fences/backticks and indented code are protected. Link/HTML-containing lines are protected conservatively in their entirety.

## RED and GREEN

Node20 v20.19.2, locked npm ci succeeded (concurrently declares Node>=22; existing dependency warning).

Initial focused run: existing grounding suite passed (13); preview regressions failed: flagged raw '*수상 경력*' instead of '수상 경력', and edited raw '**고친 수상 경력**입니다.' instead of cleaned text. New utility suite failed to resolve the then-missing implementation, as expected.

Additional edge-case RED run: Unicode intraword 가나다__라__마 and escaped closing **성과\\** both lost literal delimiters. Unicode letter/number boundaries and conservative closing-escape checks fixed those failures.

Final focused command: npm run test:unit -- lib/export/cover-letter-grounding.test.ts lib/export/cover-letter-display.test.ts components/features/export/CoverLetterPreview.test.tsx
Result: 3 files, 41 tests passed. Covers matching across highlight boundaries, repeated and multiline claims, input immutability, raw count/limit, edited disable, empty/multiple, plain text/punctuation and CRLF retention.

npm run typecheck: passed (requires escalated worktree cache write).
Targeted eslint of all five owned files: passed.

## Storybook

Added Markdown_표시 play verifying actual cleaned text, cross-delimiter flagged claim and raw count; Markdown_편집 verifies cleaned edited text without mark; 정상_문장부호 preserves punctuation/escape/code. Added play assertions to base, multiple and empty stories. Existing flagged/edited stories retained. Root will run browser tests/capture without enabling product flag.

## Self-review and limits

Pure display transformation leaves source strings and grounding objects untouched. Deliberately conservative: this is not a Markdown parser; mixed/single lists and syntax outside the agreed set remain literal. Links/HTML lines retain even surrounding emphasis to avoid accidentally changing syntax outside scope. No CSS layout changes. Root-generated next-env.d.ts left uncommitted. Root-owned docs and browser work left untouched.

Commit: see git commit immediately following this report; only owned product/test/story files included with this report.

## Review round 1

Read /private/tmp/frt334-storybook-test.log: initial browser run had 3 play failures / 5 passes. Base and literal stories used normalized multiline getByText; Markdown also exposed retained underscores before Korean suffix and the sr-only warning included in textContent.

Added regressions first. RED: four failures for __협업 경험__도, two spaced horizontal rules, and multiline backtick code span. __init__method stayed literal. Fixed underscore rule per clarified spec (opening boundary required, Korean suffix permitted; ASCII identifier suffix preserved), protected spaced horizontal-rule lines and multiline code spans.

Story checks now compare exact body text (including original line breaks), cloning the rendered body and removing only .sr-only annotations. Markdown independently checks mark's precise first text node, accessible title and sr-only warning. This keeps visible-prose assertions strict while retaining accessibility assertions.

GREEN: 46 focused tests passed, 3 files. Typecheck and targeted lint passed. Root owns rerunning actual Storybook browser play and captures. No flags changed.
