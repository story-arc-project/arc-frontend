# FRT-334 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Execute task-by-task.

**Goal:** Remove unambiguous minimal Markdown syntax only in cover-letter preview text.
**Architecture:** Compute removal positions on the whole raw body, project existing raw grounding segments through those positions, retain flags on surviving text. Reuse one pure utility for edited plain rendering and highlighted rendering.
**Tech Stack:** TypeScript, React19, Vitest, Storybook10.
**Spec:** docs/superpowers/specs/2026-10-26-frt-334-cover-letter-markdown.md

## Global Constraints
Node20. No API/storage/editor/feature-flag or grounding policy change. No ReactMarkdown dependency. Preserve normal punctuation, hashes, underscores, asterisks, numbers, newlines. Latest PR UI approval required before merge.

### Task 1: Pure sanitizer and preview integration
Own lib/export/cover-letter-display.ts (+ .test.ts), components/features/export/CoverLetterPreview.tsx (+ .test.tsx and .stories.tsx). No other product files.
- [x] Baseline existing grounding tests, new failing preservation/removal tests, and reproduce preview raw marker bug.
- [x] Implement minimal Markdown removal with source position retention; apply to whole joined grounding segments before re-splitting so markers crossing highlight boundaries are removed consistently.
- [x] Test untouched input/objects, raw counters/max limit, edited highlight disable, ordinary plain text, preserved suspicious/non-syntax values, multiline and repeated claims, markers crossing flagged boundaries.
- [x] Add Storybook play cases: Markdown, normal punctuation, flagged Markdown, edited Markdown, empty and multi-answer.
- [x] Run focused tests, record RED/GREEN evidence, self-review, commit.

### Task 1b: Adjudicated literal-boundary contract repair
After the five-wave Task1 cap, actual review at d7dfde9 reproduced two valid preservation defects. The coordinator ruled them load-bearing because code/link source preservation is an explicit spec invariant. Stop the previous automatic retry loop and perform this single bounded repair.
- Own only the display utility and its tests, plus this plan record.
- Bound inline-code matching to its paragraph, including LF/CRLF and whitespace-only blank boundaries; preserve single-newline code spans and resume at genuine later openers.
- Reuse balanced/escaped label scanning for full/collapsed reference links, accepting explicit literal tokens in source order. Keep shortcut-definition knowledge and inline precedence intact.
- RED exact reproductions and fixed boundary/control cases, GREEN focused suite, independent scoped review, required gates and UI comparison.
- No dependency, production parser, API/storage/editor/grounding policy or feature-flag change. Any further preservation defect returns to scope/design adjudication; no automatic retry loop.

### Task 2: Validation and review delivery
- [ ] Node20 lint/typecheck/unit/build through validate subagent.
- [x] Storybook build/play with desktop1440/mobile390 captures of existing preview; feature flag remains disabled. Prepare local gallery and CI/remote verification route.
- [ ] Independent spec/quality and final branch review, then Ready PR base dev, attach, latest-head Codex request and completion evidence.
- [ ] Update personal existing Notion row minimally, preserve review/UI approval and deployment distinctions; return development slot.

## Review Focus
Ambiguous inline operators/intraword underscores; numeric prose vs sequential lists; escaped delimiters; marker removal across grounding boundaries; raw counts and edited highlight state; no artificial feature exposure.
