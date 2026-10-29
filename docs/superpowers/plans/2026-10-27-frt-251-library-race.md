# FRT-251 implementation plan

> For agentic workers: use subagent-driven-development; maintain existing work.

**Goal:** Render acknowledged CRUD despite membership concurrency.
**Architecture:** Local acknowledged patches; separate list snapshot invalidation; per-library metadata queue.
**Tech Stack:** React 19, TypeScript, Vitest, Playwright, Node 20.
**Spec:** ../specs/2026-10-27-frt-251-library-race.md

## Global Constraints
Preserve FRT-235 recovery and current deletion policy. No real user data deletion. UI approval required before merge.

## Review Focus
Stale list responses; same-library write order including failures; unrelated recovery GETs; deleted library response cleanup; unmount.

### Task 1: Hook reconciliation
- [x] Add failing hook regressions in hooks/useLibraries.test.ts for CRUD/membership concurrency, failures, stale list GETs and same-library order.
- [x] Run focused tests and confirm expected failures.
- [x] Modify hooks/useLibraries.ts to patch successful CRUD, keep membership generation independent, and serialize same-library metadata writes.
- [x] Focused61 and Node20 lint/typecheck/unit3823/build PASS.

### Task 2: Browser verification
- [x] Add delayed mock CRUD/membership scenarios for creation, rename, delete and latest selection in e2e/library-crud-race.spec.ts.
- [ ] Capture desktop/mobile UI gallery and checklist; open Ready PR after validation and require explicit UI approval before merge.
