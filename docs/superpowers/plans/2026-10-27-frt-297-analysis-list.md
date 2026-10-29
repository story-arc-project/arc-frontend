# FRT-297 Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development task-by-task.

**Goal:** Share request guards for three analysis lists with identical behavior.
**Architecture:** Generic typed selection/result hook; stable module-level loaders adapt API responses. Domain mutations and history partial-failure rendering stay at pages.
**Tech Stack:** React19, TypeScript, Next16, Vitest, Playwright, Node20.
**Spec:** docs/superpowers/specs/2026-10-27-frt-297-analysis-list.md

## Global Constraints
- Preserve all visible copy, JSX, accessibility, layout, filters, sort and completed-only API contract.
- Atomic selection+generation; same selection is a no-op; retry increments generation.
- Ignore stale successes, failures and settlement after effect cleanup/unmount.
- Comprehensive and keyword stay unchanged; FRT-197 remains separate.
- Do not edit API clients, shared date utils, or overlapping open PR files.

## Review Focus
- Batched away/back selections must create a fresh generation.
- Old failures must not hide newer successful results or clear partial failures.
- History sort and filter must retain the other axis.
- Local bookmark/delete/title edits must keep existing page behavior.
- Loader callback identity must not trigger request loops.

### Task 1: Extract and integrate request lifecycle
**Files:** Create hooks/useAnalysisListRequest.ts and hooks/useAnalysisListRequest.test.ts. Modify only analysis bookmarks/individual/history page.tsx and their tests as needed. Add e2e/analysis-list-request.spec.ts if existing smoke is insufficient.
**Interfaces:** typed selection/result state, selection updater, retry, result setter, loading and error. Pick minimal names after inspection; no domain-specific mutation/polling options.
- [ ] Write meaningful hook deferred-promise tests for the review focus, retry/error, stale success/error and unmount; run RED before implementation.
- [ ] Implement generic hook and adapt the three pages using stable loaders. Preserve history partial failures on success and clear on total error without effects that add transient UI.
- [ ] Run focused tests across all five pages and the hook. Confirm JSX diff is absent.
- [ ] Run actual main-route Playwright smoke with API mocks, covering the three paths/filter/sort/retry as useful.
- [ ] Self-review and report exact tests/results. Do not commit or push; controller handles packaging.
