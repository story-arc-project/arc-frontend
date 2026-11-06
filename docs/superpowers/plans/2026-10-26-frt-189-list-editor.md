# FRT-189 List Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove eight copies of controlled list operations without changing editing behavior.
**Architecture:** A stateless generic hook wraps the existing append/map/filter expressions; item defaults remain lazy editor-owned factories.
**Tech Stack:** TypeScript, React19, Vitest, Testing Library, Playwright, Node20.
**Spec:** docs/superpowers/specs/2026-10-26-frt-189-list-editor.md

## Global Constraints
Preserve UI, IDs, parsing, patch semantics, array order and focus. Do not change shared.tsx or page/page.test.

## Review Focus
- New items must retain every editor-specific default and get fresh arrays/IDs only on click.
- Rerenders must use latest controlled value/callback/factory.
- Shallow patches retain untouched nested references and honor explicit null/undefined/id.
- Duplicate IDs keep current update-all/remove-all behavior.
- Survivor input DOM identity and active focus remain stable while typing.

### Task 1: Hook and editor migration
**Files:** Create editors/useListEditor.ts and useListEditor.test.ts; modify the eight *ListEditor.tsx files.
**Interfaces:** `useListEditor<T extends { id: number }>(value: T[], onChange: (next: T[]) => void, createItem: () => T)` returns addItem(), updateItem(id:number, patch:Partial<T>), removeItem(id:number).
- [x] Write contract tests and observe RED for absent hook.
- [x] Implement hook with the existing expressions; migrate only handler declarations to lazy factories.
- [x] Run focused hook tests GREEN.

### Task 2: Controlled regressions
**Files:** Create editors/ListEditors.test.tsx.
- [x] Test exact defaults and click-only IDs for all eight editors before migration.
- [x] Verify controlled add/edit/remove keeps saved fields, row order, distinct IDs/arrays and input DOM focus.
- [x] Run all editor tests and report focused validation; parent runs required four gates, browser smoke and independent review.

## Focused validation
Hook RED: missing module confirmed before implementation. Before migration controlled regressions: 8 passed. After migration all editor suites: 24 passed / 0 failed across 4 files, including GPA focus/blur and shared controls. Required four gates, browser smoke and independent review are tracked by the parent execution.
