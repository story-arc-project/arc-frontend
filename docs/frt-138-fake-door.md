# FRT-138: unpublished fake-door frontend

Price selection → explicit payment intent → preparation notice → mission integration boundary.
This branch does not implement BAC-89 or FRT-348 and does not complete their integration.

## Preview and publication

Run Node 20 and `FRT138_PREVIEW=true npm run dev -- --port 3128`, then open
`http://localhost:3128/dev/credit-fake-door`. This route returns 404 unless both
`NODE_ENV=development` and the server-only opt-in are present. Production builds
return 404 even with the opt-in. Production entrypoints remain on FRT-99 behavior.
The existing `/credits/charge` page component accepts an optional fake-door adapter;
only the development harness opts in. The production page remains on its existing behavior.

The harness preserves the source draft while rendering the existing CreditCharge page.
Price selection is never a modal. Only the payment-preparation notice uses a dialog,
with mission and close actions. Close, Escape, and backdrop click all retain the
selected package and restore the payment button focus. A page-level back control
returns to the source screen. Its mission destination is explicitly a mock, not a placeholder production link.
The account and request records controls are diagnostic preview controls only.
Storybook also exposes catalog, error, selection, notice, delayed, and retry states.

## UI states

| Surface | Loading | Error | Empty/partial | Ready |
| --- | --- | --- | --- | --- |
| Prices | Disabled CTA, loading text | Explicit retry; no fallback selection | Production adapter must reject invalid/empty catalog | Unselected radio group, amount in CTA |
| Intent | Notice and mission remain usable | Same-request retry; no success emitted | First/repeat remains server-authoritative | No payment or balance update |
| Notice exposure | Separate from click request | Never fabricate successful exposure | No local first-time inference | Record only after notice mounts |
| Mission | Not implemented here | Not implemented here | Explicit mock in preview | FRT-348 integration pending |

## Adapter boundary (not an HTTP contract)

`FakeDoorAdapter` in `lib/credits/fake-door.ts` separates catalog loading,
intent persistence, and actual notice exposure. These TypeScript shapes are a
frontend port. They do not claim BAC-89 endpoint names or server wire fields.
The real adapter must use authenticated owner scope; never trust a client-supplied
account ID as authorization. Catalog version must come from the agreed server
contract, not the preview's `mock-2026-10-05` label.

`getCreditPackagesStrict` validates the existing public catalog and rejects failure,
including a bounded timeout. The old `getCreditPackages` wrapper retains landing
fallback behavior. BAC-89's versioned catalog adapter is deliberately not fabricated.

Intent payloads retain the same ID and price snapshot across response-loss retries.
Exposure has its own ID and timestamp. The preview mock models idempotency and
response loss in memory only: it is not proof of server concurrency, multi-tab
correctness, durable storage, or actual first/repeat classification. It never
calls a payment, ledger, credit invalidation, or purchase-complete event.

## Before publishing

- Confirm BAC-89 authentication, catalog version, validation, idempotency/conflict,
  first/repeat semantics, and independent exposure recording with the backend owner.
- Connect FRT-348 while preserving the originating task/draft and explicit return;
  returning must not automatically resubmit generation.
- Align event IDs and retries with FRT-105; do not include draft text or private
  per-feature costs in analytics. No purchase-complete event for intent clicks.
- Complete FRT-363 with real login, deployed APIs, mobile and keyboard verification.
  Mock tests and screenshots do not establish these release conditions.

## Validation

Targeted tests: `npx vitest run lib/api/credit-packages-api.test.ts lib/mocks/fake-door.test.ts components/features/credits/FakeDoorDialog.test.tsx`.
Browser tests: `npx playwright test --config playwright.fake-door.config.ts`.
Baseline gates: lint, typecheck, test:unit, build. Merge requires user approval.
