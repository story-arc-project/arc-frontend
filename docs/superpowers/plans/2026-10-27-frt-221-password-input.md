# Password Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate five password visibility controls without behavior changes.
**Architecture:** Controlled forwarded-ref Input wrapper; existing form state remains in place.
**Tech Stack:** React 19, TypeScript, Next16, Vitest, Storybook, Playwright.
**Spec:** docs/superpowers/specs/2026-10-27-frt-221-password-input.md

## Global Constraints
Preserve existing UI, authentication policy, OAuth, independent visibility and state lifetime. No live account actions.

## Review Focus
Step reentry, independent toggles, keyboard/focus/selection, forwarded ref/props, no accidental form submission.

### Task 1: Extract and integrate
- [x] Add components/ui/password-input.tsx with visible:boolean/onToggleVisibility:()=>void and forwarded Input props/ref.
- [x] Replace only five password Input compositions in the three auth pages, leaving visibility state untouched.
- [x] Add component tests, Storybook states/play, and auth route browser regressions for the review focus.
- [x] Run focused tests and browser checks; lint/typecheck/test:unit/build under Node20.
- [x] Independently review diff and regressions before ready PR.
