# FRT-295 Dashboard tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make dashboard analysis tabs operable with standard keyboard navigation.
**Architecture:** Keep local tab state and result rendering. Add focus refs and scoped key handling following existing controls.
**Tech Stack:** React 19, Next16, TypeScript, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-26-frt-295-dashboard-tabs.md

## Global Constraints
- No layout, API, or policy expansion.
- Left/Right wrap; Home/End first/last; selected tabIndex=0, others=-1.
- Explicit latest UI approval required before merge.

## Review Focus
- Boundary wrapping and first/last keys.
- Unhandled keys keep default browser behavior.
- Click and keyboard update the same selection and content.
- Deferred summary response retains current selection.
- Tab exits the group and selection adds no API calls.

### Task 1: dashboard tabs and regression coverage
**Files:** app/(main)/dashboard/page.tsx, page.test.tsx; e2e/frt-295-dashboard-tabs.spec.ts.
- [ ] Add unit regressions and observe RED.
- [ ] Implement scoped keyboard handling and roving tabIndex; observe GREEN.
- [ ] Add desktop/mobile browser flow and capture selected/focused states.
- [ ] Run full gates, review diff, create Ready PR base dev; request actual Codex review.
