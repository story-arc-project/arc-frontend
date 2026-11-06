# FRT-89 implementation plan

Spec: docs/superpowers/specs/2026-10-27-frt-89-archive-url.md

## Global Constraints
URL authority;300ms search debounce; no lost pending query on navigation; preserve preview id, reserved chars, repeated tags and demo base. Leave PR362/363/352/325 files and release345 untouched. Keep FRT81 sentinel and new success all-library behavior. Node20.19.2; no merge before latest UI approval.

## Task 1: URL state and archive integration
Own route-local useArchiveContext hook/test, archive page.tsx and independent page test if needed; extend useLibraryFilter with optional controlled filter mode only if needed, preserving its other consumers. Reuse archive-context parse/serialize/buildReturnTo; do not duplicate serializers. First prove RED for URL rerender/Back restoration and pending search then navigation. Implement URL replacement/debounce cleanup and atomic context changes. All archive selection/close/peer/delete/duplicate navigation must include current context; edit/new must flush the prior list entry before leaving so immediate Back restores latest draft. Missing library normalizes only on successful load. Unit tests cover current filters, invalid/default context, reserved characters/repeated tags, input ordering, URL change during debounce and preview id preservation. Run focused tests GREEN, record evidence and self-review in task report.

## Task 2: Browser evidence
Own new e2e/archive-url-context.spec.ts and temporary preview config/gallery output. Use existing stubApi fixtures; do not edit fixtures or existing E2Es. Verify desktop1440/mobile390: filters refresh/share, clean edit Back, dirty guard stay/leave, new cancel, preview open/close/peer/back/forward, empty reset, query before300ms edit/preview, missing library and failed library request/retry. Include URL assertions plus visible results. Run existing archive-edit-context, experience-crud and empty states as regressions. Capture screenshots for remote gallery. No duplicated styling component or product UI.

## Review Focus
Navigation while a timer is pending; rapid filter composition before URL rerender; async delete callback with changed filters; id-only URL changes resetting draft; library failure incorrectly normalizing context. Task1 covers unit boundaries and Task2 browser consequences.
