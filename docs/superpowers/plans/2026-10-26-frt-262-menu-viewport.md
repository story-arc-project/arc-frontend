# FRT-262 implementation plan

Spec: ../specs/2026-10-26-frt-262-menu-viewport.md

## Global constraints
Only ExperienceCard menu geometry and associated tests/stories. Preserve callbacks, portals, horizontal placement, outside dismissal and keyboard behavior. No data/list/membership hooks. Use Node20. No real delete/move. PR base dev; explicit latest UI approval before merge.

## Task 1: geometry and regression tests
Owner: implementation subagent. Files: components/features/archive/ExperienceCard.tsx, ExperienceCard.test.tsx, ExperienceCard.stories.tsx. Measure actual DOM height before paint; clamp both axes; bound height with internal scroll; reflow on resize; external scroll dismissal must ignore menu/submenu scroll. Preserve Escape and outside click. Add failing regression tests before implementation and meaningful Storybook play coverage. Report RED/GREEN evidence and self review. Do not commit until parent validation.

## Task 2: actual archive browser verification
Owner: parent. File e2e/experience-menu-viewport.spec.ts. API stub only. Validate desktop/mobile/short viewport, main and long submenu bounds, last item touch/click reachability, resize, outside scroll, internal scroll, Escape/outside click. Capture remote-review gallery via ui-preview fallback. Record geometry.

## Task 3: validation and delivery
Run Node20 lint/typecheck/unit/build via validate agent; focused browser and Storybook checks. Independent spec/quality and final review. Commit/push feature branch, Ready PR base dev with original issue and personal task record, gallery and checklist, attach artifact. Request latest-head Codex, record ID/SHA/time; inspect actual state without prolonged wait. Update existing personal Notion row only.

## Review focus
- Short viewport even main menu taller than screen: internal scroll reachable.
- Long submenu: last option visible/clickable after internal scroll.
- Resize: stays within new viewport.
- Narrow width: left-side fallback remains within viewport.
- Nested scroll and keyboard: internal scroll keeps menu open, external scroll/Escape close.
