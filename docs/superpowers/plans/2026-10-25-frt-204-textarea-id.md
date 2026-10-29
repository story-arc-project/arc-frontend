# FRT-204 Textarea unique IDs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this task.

**Goal:** Identical Textarea labels keep independent label, hint and error associations.

**Architecture:** Call React useId unconditionally per Textarea and select explicit id with nullish fallback. Preserve existing description override, resize, ref and input behavior.

**Tech Stack:** React 19, Next.js 16, TypeScript, Vitest, Storybook, Playwright; Node 20.

**Spec:** Supplied FRT-204 issue and authorized task brief. Scope is Textarea and its regressions; no visible wording/layout change or adjacent Input/DatePicker refactor.

## Global Constraints

- Explicit id and consumer aria-describedby override semantics remain unchanged.
- SSR/hydration, rerender, required, hintPosition, error priority, refs and controlled/uncontrolled resize behavior must remain valid.
- UI behavior requires current PR user approval before merge.

## Approaches

React useId provides instance identity that survives server rendering and hydration. Random IDs and module counters risk server/client divergence and are rejected. Label-derived IDs reproduce the defect.

## Review Focus

Duplicate labels and errors; label changes; unlabeled hints; explicit IDs and descriptions; SSR hydration and existing resize/ref behavior are covered by the regression tests.

### Task 1: Instance identity and regression fixture

**Files:** components/ui/textarea.tsx, components/ui/textarea.test.tsx, components/ui/textarea.stories.tsx.

- [x] Baseline: existing three resize tests pass on Node 20.
- [x] Add regression tests and confirm five fail before the product fix.
- [x] Replace only label-derived fallback with useId; focused ten tests pass.
- [x] Add DuplicateLabels Storybook play fixture checking each label focus and accessible description.
- [ ] Run Node20 lint, typecheck, full unit suite and build.
- [ ] Run representative desktop/mobile browser fixture, capture remote-review gallery.
- [ ] Independent review and Ready PR to dev; latest-head Codex review, CI and UI approval gates.
