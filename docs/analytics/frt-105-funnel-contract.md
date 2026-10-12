# FRT-105 browser funnel contract

This increment instruments existing screens. It does not complete FRT-105's server-backed WTP measurement or create a live dashboard. User-approved event mapping: preserve the Notion draft names where the meaning matches; separate click, rendered notice and committed server outcome.

## Emitted browser events

| Event | Observation | Deduplication / interpretation |
| --- | --- | --- |
| token_purchase_page_viewed | A usable API/adapter catalog rendered | Once per flow/catalog. Failed/fallback catalog is not valid exposure. Not account-first exposure. |
| token_package_selected | Explicit package selection | Includes price/credits snapshot, selection count and catalog provenance. |
| credit_purchase_intent | Accepted click on 결제하기 | One intent per accepted click. Storage retry is not another intent. |
| fake_door_revealed | Preparation notice committed to the UI | Separate from click and backend intent storage; not proof of eye attention. |
| fake_door_dismissed | Notice close action | Does not claim page abandonment or navigation destination. |
| mission_page_navigated_from_fakedoor | Mission navigation button clicked | Destination arrival is a separate page event. |
| mission_page_viewed | Mission workspace's initial result shown (list or direct detail) | Once per account/store flow across list/detail remounts. Availability is included; an empty successful snapshot is unavailable, matching the configuration-failure UI. Unavailable is not eligibility or participation. |
| mission_started | Evidence entry, external participation action, or successful invitation copy | Once per mission and participation cycle within a flow. Detailed view alone is not participation. Automatic/retroactive missions skip this step. |
| mission_submit_clicked | Valid evidence form submission action | is_retry separates uncertain-request retry from fresh action. Not stored submission. |
| mission_claim_clicked | Reward claim action | is_retry separates status recovery. Not a committed grant. |
| referral_code_shared | Invitation clipboard write succeeded | Means copy, not successful delivery to a friend. |

## Common metadata and privacy

The shared typed wrapper adds event_id (fresh browser observation UUID), schema_version=1, occurred_at (browser clock), environment=production. flow_id joins observations within a frontend flow; intent_id joins an accepted purchase click with its notice. None is a committed server event or a guarantee of durable delivery.

Entry paths use a fixed allowlist. Settings navigation carries only the exact `entry=settings` marker through mission list/detail routes; other values resolve to direct. MissionWorkspace accepts a trusted in-memory flowId from the Fake Door callback so adapter integrations can join destination observations to the source flow. This handoff is tested as an integration API; the current production legacy charge screen has no mission navigation, so production end-to-end connectivity is not claimed. No flow ID is read from a URL. No query strings, emails, raw account IDs, invitation/evidence URLs, notes, freeform rejection reasons or feature costs. Public package price and quantity snapshots are allowed. Unknown source/history stays unknown; there is no browser-local assertion of account-wide first exposure.

The existing PostHog capture wrapper is reused. Collection is best effort and cannot throw into user actions. Demo, development/test and /dev previews do not send funnel events; SDK absence also remains a no-op. Internal staff are labeled with the existing $internal_or_test_user property and MUST be excluded in all dashboard queries. A production build alone is insufficient: next.config.ts exposes VERCEL_ENV as NEXT_PUBLIC_FUNNEL_DEPLOYMENT, and only production collects. Preview/development/unknown deployments fail closed. On non-Vercel hosts, explicitly set NEXT_PUBLIC_FUNNEL_DEPLOYMENT=production at build time for the real production deployment only. Vercel classification takes precedence over a manually supplied value. Keep production-host filters on dashboards as a second boundary.

## Deferred server facts

BAC-89 must supply first valid exposure, persisted intent and actual notice history across sessions/tabs/devices; catalog version is currently absent from the public /credits/packages response (unknown, never invented). The frontend adapter version is not automatically a server policy version.

BAC-79 owns submission commit, approval and rejection. BAC-77 owns eligibility and reward/ledger commit, including automatic/retroactive paths. BAC-75 owns committed event delivery, stable server event_id, occurred_at, schema version and retry/deduplication semantics. The current frontend submit/claim Promise<void> interfaces are not HTTP contracts. Existing unavailable production adapters remain in place.

Do not emit mission_submitted, mission_approved, mission_rejected, mission_credits_pending, mission_credits_claimed, referral_signup_completed or referral_credit_qualified from browser clicks or snapshots. The current implementation claims no real mission success.

No token_purchase_completed, revenue or payment-method events. free_token_exhausted is still disabled until its definition distinguishes free allocation exhaustion from balance=0. No return-click event is invented: the current notice has only mission and close actions. Alert subscription is outside current UI scope.

## Dashboard definition for server integration

- Exploratory browser flow: valid price exposure → purchase intent → rendered notice → mission click / close. Explicitly exclude catalog_source=fallback, unknown provenance where appropriate, staff/test users and nonproduction hosts. Repeated flows remain repeat observations, not unique first-exposure cohorts.
- Primary WTP: account's first server-confirmed valid exposure followed by intent within 24h. Only include accounts with a full 24h observation window; 7-day result is supplementary and requires a full 7-day window. Report denominator, distinct exposed accounts, distinct intent accounts and per-price counts/shares. Zero denominator is undefined, not 0%.
- Catalog displays all three offers together: selection share is not an independent price experiment or causal price sensitivity estimate.
- Mission funnel uses committed server stages; automatic/retroactive missions omit submission. Seven-day generation resumption after grant is descriptive, not a causal effect.
- Do not activate a primary WTP dashboard from these browser-only events or treat absence as user abandonment when collection failed. A real PostHog dashboard link and production sample validation remain pending server contracts.

## Validation boundary

Unit checks validate browser semantics and payloads; stubbed browser smoke validates the existing UI still works. Neither proves production ingestion, backend idempotency, real grant correctness, or cross-device first-exposure cohorts.
