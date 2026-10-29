# FRT-244 Library Response Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development.

**Goal:** Reject malformed list containers without presenting success-empty.
**Architecture:** Local API-boundary guards in getLibraries before destructuring/spread. Existing catch handles failure.
**Tech Stack:** TypeScript, Vitest, Next.js.
**Spec:** docs/superpowers/specs/2026-10-26-frt-244-library-response.md

## Global Constraints
Node20; preserve valid DTOs/order/demo; no UI/hook/membership/dependency changes; malformed response rejects Error with stable code INVALID_LIBRARY_RESPONSE and English diagnostic (no new UI copy).

## Review Focus
Missing envelope; null contents; either missing bucket; iterable strings; valid one-empty bucket. All pinned below.

### Task 1: Guard getLibraries and regression tests
**Files:** lib/api/library-api.ts; lib/api/library-api.test.ts.
**Interface:** getLibraries(): Promise<LibraryDTO[]> remains unchanged.
- [x] Add tests: valid mixed buckets preserve system-first order/fields; both empty succeeds; each single-empty bucket succeeds.
- [x] Add table tests for missing/null/primitive/array envelope, data, contents and either bucket; malformed buckets include strings, objects, null. Assert controlled Error carrying code INVALID_LIBRARY_RESPONSE; never success-empty or incidental TypeError. Preserve network rejection identity.
- [x] Run focused tests, record meaningful RED before implementation.
- [x] Implement minimal unknown-safe record and array guards only in getLibraries; use Error with code via Object.assign or established compatible pattern. Do not validate count or full DTO item fields.
- [x] Run focused GREEN and existing hook tests; self-review. Controller runs 4 gates via validator and independent review.

### Task 2: Browser contract regression (controller)
- [x] e2e/library-response-contract.spec.ts: desktop/mobile malformed iterable bucket shows existing error; retry with valid empty buckets recovers visible experiences. Attach screenshots.
- [x] Build local screenshot gallery; publish through supported artifact tool or use CI artifact fallback. UI approval remains required.
