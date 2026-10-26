# FRT-188 Date Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** consistent Korea date rendering without changing saved data.
**Architecture:** one shared date-only formatter with compact/admin styles; callers preserve punctuation.
**Tech Stack:** TypeScript, Intl, Vitest, Playwright, Next16, Node20.
**Spec:** docs/superpowers/specs/2026-10-26-frt-188-date-display.md

## Global Constraints
- timestamps: Asia/Seoul; date-only inputs preserve calendar day; timezone-less ISO datetime means Korea wall time.
- compact YYYY.MM.DD; default Korean short locale and admin two-digit locale punctuation preserved.
- empty/null/undefined => —; unparseable => original input.
- no saved-data, API serialization, formatDateTime or relative-time changes.
- latest-head user UI approval required before merge.

## Review Focus
- UTC rollover, UTC midnight, negative/positive offsets.
- date-only on hosts UTC/Asia/Seoul/America/Los_Angeles.
- invalid, empty and missing source values.
- compact caller wiring and existing admin use.
- timestamp without offset deterministic across hosts.

### Task 1: Shared date contract and integration
Files: lib/utils/date-utils.ts and date-utils.test.ts; lib/admin/format.ts and relevant tests; components/features/archive/{ExperienceCard,ExperienceDetailV2}.tsx; components/features/export/ResumeExperiencePicker.tsx; focused component/e2e tests as needed.
Interface: extend formatDate(iso, style?) with styles compact/admin while retaining default; formatAdminDate delegates admin style.
- [ ] Add failing regression table for all Review Focus inputs and exact expected outputs; run targeted Vitest to prove red.
- [ ] Implement shared formatter and replace three local copies, preserving styles.
- [ ] Run targeted tests under TZ=UTC, Asia/Seoul and America/Los_Angeles; add integration assertions proving all three callers use contract.
- [ ] Capture mock desktop/mobile UI and route smoke with rollover/invalid/date-only fixtures. Record limitations.
- [ ] Validate Node20 lint, typecheck, test:unit and build; self review; commit focused change.

Implementation note: existing default month:short locale options render “2026년 3월 15일” on Node20 ICU; retain those options rather than the old stale dotted example. Compact remains YYYY.MM.DD; admin remains YYYY. MM. DD.

Validation (2026-10-26): Node v20.19.2 from ~/.nvm/versions/node/v20.19.2/bin. lint PASS (2 existing warnings); typecheck PASS; test:unit PASS 202 files/3628 tests; build PASS. Focused 42 tests PASS each TZ UTC, Asia/Seoul, America/Los_Angeles. Mock Playwright PASS 2 tests (1440px/390px), six captures under e2e/preview/out/frt188-*.jpg; local gallery /private/tmp/frt188-ui-gallery.html. Initial regression run failed 11 tests as expected. No live backend or real login exercised. Latest-head user UI approval pending.
