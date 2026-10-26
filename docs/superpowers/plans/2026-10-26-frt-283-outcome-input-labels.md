# FRT-283 OutcomeList Input Names Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this single scoped task and review spec compliance and quality separately.

**Goal:** Give every editable OutcomeList textarea its block and current row name.
**Architecture:** Add a required internal ariaLabel prop without changing public component API, row identity or mutation logic.
**Tech Stack:** React 19, TypeScript, Vitest, Storybook, Playwright.
**Spec:** `docs/superpowers/specs/2026-10-26-frt-283-outcome-input-labels.md`

## Global Constraints
Preserve storage schema, layout, stable row IDs, focus and IME behavior. Do not change shared block utilities, RepeatableCellBlock or touch targets. Latest UI approval is required before merge.

## Review Focus
- No-placeholder inputs and adjacent blocks retain usable block-specific names.
- Placeholder materialization retains the same focused DOM node.
- Insert/delete renumber existing nodes without remounting them.
- IME Enter/Backspace and Shift+Enter do not trigger row operations.
- Read-only output and serialized row data remain unchanged.

### Task 1: Name inputs and verify row interaction
**Files:** OutcomeList.tsx, OutcomeList.test.tsx, OutcomeList.stories.tsx; parent adds dedicated mocked E2E/preview.
**Interface:** Internal `ariaLabel: string`; value `${block.label} ${index + 1}행`.

- [x] Run existing focused tests and unchanged Storybook baseline (39 unit / 6 Storybook passed).
- [x] Add regression tests for accessible names, placeholder materialization, row renumbering/focus and keyboard/IME behavior; confirm name assertions fail before the fix (4 new failures, 39 existing passes).
- [x] Pass ariaLabel through AutoGrowInput to textarea (43 unit passed).
- [x] Add Storybook accessible-name assertions; unchanged baseline did not reproduce the historical console warning, so no warning workaround was added.
- [ ] Run focused tests and Storybook, then Node20 lint/typecheck/unit/build and mocked browser checks.
- [ ] Review spec compliance and quality, create Ready PR against dev, request completed Codex review on its exact head, and retain UI approval gate.
