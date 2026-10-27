# FRT-173 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for implementation and independent review.

**Goal:** Reject malformed experience read responses while preserving valid future data.
**Architecture:** Small private guards in experience-api.ts; unknown network boundary; original data returned unchanged.
**Tech Stack:** TypeScript, Vitest, Node20.19.2.
**Spec:** docs/superpowers/specs/2026-10-27-frt-173-experience-response.md

## Global Constraints
- Only experience read validation and regression tests; preserve demo and mutation behavior.
- No type whitelist, content normalization, UUID/date parsing or count/length equality.
- ApiError(500) with clear Korean list/detail error messages.

## Review Focus
- Null/primitive/missing envelope/data must reject explicitly.
- Invalid count, nonarray contents and malformed entries must reject whole response.
- Unknown type/extra fields/nested content retain object identity.
- Transport ApiError and demo bypass retain behavior.
- Existing hook keeps last valid list on failed refetch and exposes error.

### Task 1: Read boundary guards and regression tests
**Files:** lib/api/experience-api.ts, lib/api/experience-api.test.ts, optionally separate hook integration regression file.
- [ ] Write malformed list/detail tests and preservation/demo/transport regressions; run RED.
- [ ] Implement spec guards and run focused GREEN; add meaningful consumer refetch regression without modifying useExperiences.
- [ ] Run lint/typecheck/unit/build; independently review diff.
- [ ] Prepare current UI error-state preview and Ready PR; request latest-head Codex review; no merge before user UI approval.
