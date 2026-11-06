# FRT-284 Search Label Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for the single scoped task, then independent review.

**Goal:** Keep the archive search field named 경험 검색 before and after input.
**Architecture:** Add one explicit accessible name to the existing controlled input; exercise current callbacks and route behavior.
**Tech Stack:** React, TypeScript, Storybook play, Playwright.
**Spec:** docs/superpowers/specs/2026-10-26-frt-284-search-label.md

## Global Constraints
- Preserve placeholder, styles, search policy and FRT-276 filter chips.
- Node20; latest-head explicit UI approval before merge.

## Review Focus
- Empty and populated input retain the exact accessible name.
- Clear restores results without changing keyboard order.
- Mobile route exposes one visible named search input.
- Existing filter reset remains usable.
- No disabled prop exists; no new disabled behavior is introduced.

### Task 1: Name and verify the existing search input
- [x] Add aria-label="경험 검색" in components/features/archive/FilterBar.tsx.
- [x] Add controlled SearchAccessibleName story in FilterBar.stories.tsx with play assertions for empty/type/clear, callbacks and keyboard focus.
- [x] Add e2e/frt-284-search-label.spec.ts for mocked /archive desktop/mobile name, search results, keyboard focus and reset; capture ignored previews.
- [x] Run targeted story and route tests, then required four validation gates and independent review.
