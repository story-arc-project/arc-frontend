# Task 3 report — account menu credit balance

## Implemented

- Mounted `CreditBalance variant="compact"` only while the desktop account disclosure or mobile navigation is open.
- Changed the desktop account popover to a labelled disclosure group with native links/buttons, `aria-controls`/`aria-expanded`, and Escape focus return.
- Added `AdminEntryLink.semanticRole` so the desktop disclosure uses native link semantics while existing menu-item callers keep their default behavior.
- Reused an already-settled `CreditsStore` snapshot when a second consumer subscribes. First subscription fetching, explicit refetch/invalidation, account isolation, and last-unmount abort/reset remain covered by the existing provider suite.
- Exposed the static credit loading placeholder as a named `status` after Chromium accessibility-tree review showed a labelled generic span was omitted. Balance numbers are not live regions.
- Updated admin smoke selectors and added focused browser coverage for lazy requests, shared settings/menu state, desktop/mobile rendering, keyboard focus, retry, unavailable API, and logout clearing the prior balance.

## Validation (Node 20.19.2)

- `npm run test:unit -- components/features/credits/CreditBalance.test.tsx contexts/CreditsContext.test.tsx lib/api/credits-api.test.ts` — PASS, 57 tests.
- `npx playwright test e2e/account-credit-balance.spec.ts e2e/credits-foundation.spec.ts e2e/admin.smoke.spec.ts --project=chromium -c .superpowers/sdd/2026-10-02-account-credit-balance/playwright.config.ts` — PASS, 13 tests.
- `npx playwright test e2e/account-credit-balance.spec.ts --project=chromium -c .superpowers/sdd/2026-10-02-account-credit-balance/playwright.config.ts` after logout regression addition — PASS, 10 tests.
- Focused ESLint over the owned implementation and test files — PASS, exit 0.
- `git diff --check` — PASS.

The controller owns the full lint, typecheck, unit, build, Storybook, and visual preview gates. Browser checks above used explicit API/auth stubs and do not prove the live credit API or a physical-device session.
