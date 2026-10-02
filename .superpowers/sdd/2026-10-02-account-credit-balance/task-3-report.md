# Task 3 report — account menu credit balance

## Implemented

- Mounted `CreditBalance variant="compact"` only while the desktop account disclosure or mobile navigation is open.
- Changed the desktop account popover to a labelled disclosure group with native links/buttons, `aria-controls`/`aria-expanded`, and Escape focus return.
- Added `AdminEntryLink.semanticRole` so the desktop disclosure uses native link semantics while existing menu-item callers keep their default behavior.
- Reused an already-settled `CreditsStore` snapshot when a second consumer subscribes. First subscription fetching, explicit refetch/invalidation, account isolation, and last-unmount abort/reset remain covered by the existing provider suite.
- Exposed the static credit loading placeholder as a named `status` after Chromium accessibility-tree review showed a labelled generic span was omitted. Balance numbers are not live regions.
- Updated admin smoke selectors and added focused browser coverage for lazy requests, shared settings/menu state, desktop/mobile rendering, keyboard focus, retry, unavailable API, and logout clearing the prior balance.

## Validation (Node 20.19.2)

- RED confirmation (performed after implementation because the initial run was not recorded before the fix): in detached temp worktree `/private/tmp/arc-account-credit-balance-red` at `fa7554b`, restored only the original provider subscription behavior and ran `npm run test:unit -- contexts/CreditsContext.test.tsx -t "shares a settled snapshot when a second consumer mounts"` — expected FAIL, exit 1: `getCredits` was called 2 times instead of 1. The review checkout was not modified.
- Menu RED confirmation (also retrospective, not a pre-implementation run): in the same detached worktree, retained the committed desktop-menu test and removed only the two menu `CreditBalance` mounts to reproduce the original UI. `npx playwright test e2e/account-credit-balance.spec.ts --project=chromium -c .superpowers/sdd/2026-10-02-account-credit-balance/playwright.config.ts -g "데스크톱 계정 메뉴는 열릴 때만 잔액을 조회하고 표시한다"` — expected FAIL, exit 1: `getByText('50 크레딧')` was not found. The first attempt could not start because the temporary dependency symlink was outside Turbopack's filesystem root; replacing it with an APFS clone allowed the targeted RED run. The review checkout was not modified.
- `npm run test:unit -- components/features/credits/CreditBalance.test.tsx contexts/CreditsContext.test.tsx lib/api/credits-api.test.ts` — PASS, 57 tests.
- `npx playwright test e2e/account-credit-balance.spec.ts e2e/credits-foundation.spec.ts e2e/admin.smoke.spec.ts --project=chromium -c .superpowers/sdd/2026-10-02-account-credit-balance/playwright.config.ts` — PASS, 13 tests.
- `npx playwright test e2e/account-credit-balance.spec.ts --project=chromium -c .superpowers/sdd/2026-10-02-account-credit-balance/playwright.config.ts` after logout regression addition — PASS, 10 tests.
- `npm run test:unit -- contexts/CreditBalance.integration.test.tsx contexts/CreditsContext.test.tsx components/features/credits/CreditBalance.test.tsx` after review coverage additions — PASS, 38 tests.
- `npx playwright test e2e/account-credit-balance.spec.ts --project=chromium -c .superpowers/sdd/2026-10-02-account-credit-balance/playwright.config.ts` after review coverage additions — PASS, 12 tests.
- Focused ESLint over the owned implementation and test files — PASS, exit 0.
- `git diff --check` — PASS.

The controller owns the full lint, typecheck, unit, build, Storybook, and visual preview gates. Browser checks above used explicit API/auth stubs and do not prove the live credit API or a physical-device session.

## Coverage boundary

- Account isolation is covered at provider level by the existing account-switch/auth-loading/late-response tests and at rendered integration level by `CreditBalance.integration.test.tsx`, which changes the mocked authenticated account around a real `CreditsProvider` and verifies the old `50 크레딧` disappears before the next account's `9 크레딧` resolves. Browser integration additionally covers logout removing the visible prior balance. A live backend account handoff remains outside stubbed test proof.
- Stale refresh behavior is covered by provider lifecycle tests and by the rendered real-provider integration, which holds the refresh request open and observes the last `50 크레딧` with `업데이트 중`, then rejects it and observes `업데이트 지연` plus retry. Browser integration separately covers initial error → retry → success and 404 unavailable.
