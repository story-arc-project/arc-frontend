# FRT-98: authenticated credit query

The user confirmed on 2026-09-30 that signed-in users must see their exact own balance. Landing privacy does not prohibit authenticated balance disclosure. This supersedes the earlier status-only suggestion.

## Scope

Build the reusable query foundation for FRT-98, with no new visible UI. FRT-101 owns settings/history presentation; FRT-99 owns execution gates. BAC-38 is a proposed contract, not an implemented backend guarantee. Keep the public package API unchanged.

Use the existing authenticated API client, a shared CreditsProvider and useCredits hook. No new query dependency, persistent storage, client deduction, or fake fallback balance. Mount the provider in the main layout, around both GNB and authenticated content. Fetch lazily only while there is a hook consumer, so unreleased backend APIs are not requested by existing screens.

## Contract

GET /credits returns { balance: 50, reserved: 3, available: 47, updated_at: "2026-09-30T00:00:00Z" }. Values must be nonnegative safe integers, reserved <= balance and available === balance - reserved. updated_at is a valid timezone-bearing ISO timestamp representing the latest account change. Ignore unknown fields. Authentication determines the owner; never send an arbitrary user ID. Browser requests use cache: no-store; backend should send Cache-Control: private, no-store. 404/501 mean unavailable, never zero. Other HTTP/network/parse failures remain errors; authentication uses existing client handling.

## Shared state

Bound the complete getCredits call (including auth retry and response body) to 10,000ms. Timeout aborts the request and surfaces a query error, freeing shared state for retry. External abort and all completion paths clean up timers/listeners.

Expose data: CreditBalance | null, status: idle/loading/success/error/unavailable, error: Error | null, isRefreshing: boolean, isStale: boolean, refetch(): Promise<void>. Initial errors have no data; refresh errors retain the last same-account snapshot explicitly stale. A successful zero remains success. One in-flight request per account, with a queued follow-up when invalidation occurs during a request so a pre-mutation snapshot cannot win. Guard state and in-flight completion by account/session generation, and abort on account changes/unmount. No data may appear for a different account, even for one render. Authentication loading must not fetch or expose old data. Existing auth identity is account.email; do not persist or log it.

Refresh on consumer mount, visible tab focus/visibility return, online, and explicit invalidation. Deduplicate simultaneous reads and avoid request storms. Provide invalidateCredits() as a small browser event bridge for future successful reserve/capture/release/grant integration. Do not infer settlement from analytics or add transaction writes. Wiring every operation event remains BAC-71/FRT-99 integration; document call sites and completion boundary honestly.

## Verification

TDD API parser/client: zero, normal, invalid integers/invariants/timestamp, unknown fields, unavailable and HTTP failures, abort. Provider tests: two consumers share one request, session switch and late response, unauthenticated state, refresh failure retains stale data, queued invalidation, tab return, unmount/StrictMode cleanup. Main-layout smoke checks provider integration without backend requests until a consumer exists. No Storybook/visual redesign required for a renderless provider. Run lint/typecheck/unit/build and independent spec/quality review. Actual server settlement checks remain pending backend delivery.
