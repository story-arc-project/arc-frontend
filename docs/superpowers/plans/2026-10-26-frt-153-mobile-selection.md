# FRT-153 mobile selection implementation plan

**Goal:** Expose mobile resume panel selection to assistive technology.

**Architecture:** Keep native buttons and existing mobileTab state. Add a named group, aria-pressed, aria-controls and useId-based named panel targets. Full ARIA tabs do not fit simultaneous desktop panels.

**Tech Stack:** React 19, Next.js 16, TypeScript, Vitest and Playwright.

**Spec:** `docs/superpowers/specs/2026-10-26-frt-153-mobile-selection.md`

**Global Constraints:** Preserve text, layout, CSS and read-only behavior. No dependencies, shared editor changes or custom keyboard handling.

**Review Focus:** Exclusive pressed state, unique target relationships, responsive simultaneous desktop panels, native Tab/Enter/Space and read-only regression.

## Task 1: Accessible mobile selection

- [x] Add regression first; confirm missing named group fails.
- [x] Add minimal ARIA attributes and stable unique IDs.
- [x] Verify all 85 page unit tests pass.
- [x] Verify actual route at 390/1440 pixels, resize preserving choice, read-only and screenshots.
- [ ] Complete repository gates and focused commit.
