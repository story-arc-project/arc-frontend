# FRT-197 polling list Implementation Plan

> For agentic workers: Use superpowers:subagent-driven-development.

**Goal:** centralize comprehensive/keyword lifecycle without behavior changes.
**Spec:** docs/superpowers/specs/2026-10-27-frt-197-polling-list.md
**Architecture:** dedicated usePollingAnalysisList hook in hooks/, with stable module-level domain configuration, existing watcher untouched, and domain JSX remaining in pages.
**Stack:** Node20, React19, Next16, Vitest/RTL, Playwright.

## Global Constraints
Preserve all existing UI, API, query, demo, notification and race behavior. Existing watcher and FRT-297 hook unchanged. No changes to open PR files. Do not change delete policies or fix unrelated semantics.

## Task 1: Extract polling list lifecycle and integrate both pages
Ownership: hooks/usePollingAnalysisList.ts, its colocated tests, comprehensive/page.tsx, keyword/page.tsx and optional focused e2e spec only. Docs already provided by controller.
1. Read current two pages, both page tests, watcher, FRT-297 hook and docs/frontend-testing.md. Verify clean baseline focused tests with Node20 (npm ci if needed).
2. Add meaningful direct hook contract tests first; watch expected failure before implementation. Cover domain APIs/type/path, initial foreground/error/retry, quiet background error, deferred stale background after bookmark/delete/retry or foreground refresh, started settling/deletion and deletion failure/cancel. Existing page tests should continue proving actual watcher integration. Avoid asserting implementation details.
3. Extract lifecycle including mutationEpoch, foreground/background loadData, progress watcher/toast, started query cleanup, delete state/flow and retry/bookmark callbacks. Return state and named actions needed by existing JSX. Stable domain configuration prevents effect churn. Keep previous timing and behavior exactly.
4. Integrate pages: no markup/text/style changes, replace duplicate callbacks with hook actions. Preserve all differences including keyword badges and comprehensive count, basePath/demo and flag behavior.
5. Run focused new and existing page/watcher suites. Add and run a focused real-route Chromium smoke for both pages using API stubs (no backend dependency). Reuse existing e2e utilities; no production config changes.
6. Self-review diff, commit code and docs with focused gitmoji message; report test evidence/red-green, files, SHA and any concern. Do not push or create PR; controller owns that.

Controller then runs independent task review (spec and quality), four validation gates, whole-branch review, creates Ready PR and requests remote Codex on exact head. Merge only after all delegated conditions hold.
