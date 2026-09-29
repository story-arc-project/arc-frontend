# FRT-98 Shared Credit Query Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development task-by-task.

**Goal:** Provide exact own-balance query state shared by authenticated screens.
**Architecture:** Existing API client plus lazy, auth-scoped context and hook; typed invalidation bridge for later transaction integration.
**Tech Stack:** React 19, TypeScript, existing Vitest/testing-library, Node 20.
**Spec:** ../specs/2026-09-30-credit-query-design.md

## Global Constraints

- Only authenticated own balances; no landing balance query.
- No fabricated balance, optimistic arithmetic, persistent cache or new dependency.
- Preserve existing visible UI; settings/history and execution gates are follow-ups.
- Existing client owns cookies and refresh behavior. Backend contract is a proposal.

## Review Focus

- Late previous-account responses must never appear for a new account.
- Invalidation during a request must schedule a subsequent read.
- Failed refresh retains explicitly stale data rather than showing zero.
- React StrictMode cleanup must not leave a stuck request or duplicate subscription.
- An unused mounted provider must not call an unreleased API.

### Task 1: Query foundation and integration

**Files:** Create types/credits.ts, lib/api/credits-api.ts, lib/credits/events.ts, contexts/CreditsContext.tsx, hooks/useCredits.ts and adjacent tests; modify app/(main)/layout.tsx. Add a main-layout integration test if appropriate.

**Interfaces:** CreditBalance has balance/reserved/available/updated_at. getCredits(signal?: AbortSignal): Promise<CreditBalance>; invalidateCredits(): void; CreditsProvider default export; useCredits exposes the state and refetch contract from the spec.

- [ ] Write and run failing API and state tests covering the spec and review focus.
- [ ] Implement API validation and shared lazy auth-scoped state; preserve the existing API client.
- [ ] Integrate provider around GNB/content without visible changes or eager fetching.
- [ ] Run targeted tests and record RED/GREEN evidence.
- [ ] Commit focused implementation.

### Task 2: Contract documentation and issue alignment

**Files:** docs/credits-user-api-proposal.md; link from docs/credits-api-proposal.md.

- [ ] Document response, errors, private cache, refresh semantics and future operation call sites.
- [ ] Update FRT-98 scope, preserving real backend integration as pending.
- [ ] Post BAC-38 contract proposal with confirmed authenticated disclosure boundary.

### Task 3: Review and delivery

- [ ] Independent spec and quality review; remediate concrete findings.
- [ ] Run lint, typecheck, unit, build; main-layout browser smoke.
- [ ] Open PR to dev with contract status, validation and follow-up limitations. Do not merge.
