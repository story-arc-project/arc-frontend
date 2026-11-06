# FRT-242 Demo mobile menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Make the existing mobile menu state accessible.
**Architecture:** Derive semantic attributes from mobileOpen; useId links persistent hidden navigation.
**Tech Stack:** React 19, Next 16, Vitest, Storybook, Playwright; Node 20.
**Spec:** docs/superpowers/specs/2026-10-26-frt-242-demo-menu-state.md

## Global Constraints
- Preserve layout and menu items; no product scope expansion.
- Work on dev-based feature branch. Latest UI approval before merge.
- No real account or backend mutations.

## Review Focus
- Collapsed target resolves without exposing links to keyboard/AT.
- Separate instances have unique control targets.
- Enter/Space activation and focus stay native.
- Navigation and guide actions still close.
- Desktop menu remains unchanged.

### Task 1: Toggle semantics and regression
- [ ] Modify components/demo/DemoGNB.tsx only for name, expanded, unique controls and hidden target.
- [ ] Add components/demo/DemoGNB.test.tsx for state, unique target, keyboard and action regression. Run RED then GREEN.
- [ ] Add components/demo/DemoGNB.stories.tsx with mobile closed/open play coverage and existing provider pattern.
- [ ] Review specification compliance and quality independently.

### Task 2: Actual route verification and delivery
- [ ] Add e2e/frt-242-demo-menu.spec.ts: mobile keyboard toggle, navigation, guide, signup and desktop visibility, screenshots + accessible tree attachments.
- [ ] Run Node20 lint/typecheck/unit/build, focused Storybook and E2E.
- [ ] Publish gallery or CI artifact fallback, Ready PR base dev and latest-head Codex request.
- [ ] Record review/check/UI gate state. Release development slot; no merge before UI approval.
