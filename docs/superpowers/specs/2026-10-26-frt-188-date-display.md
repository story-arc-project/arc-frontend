# FRT-188 date display

Goal: share deterministic Korea date presentation without changing saved source dates.

Current dev 44741b8: three local formatDate copies emit YYYY.MM.DD; CustomerListView already uses formatAdminDate. Existing shared formatDate emits Korean short dates and has empty/invalid fallbacks.

Approaches: replacing every display with the default locale format would change established punctuation; maintaining three independent padded formatters leaves timezone bugs. Selected technical approach under delegated design autonomy: add a compact style to shared formatDate, preserving default output and admin punctuation. Admin delegates its existing two-digit locale style to the same shared formatter. Keep formatDateTime/relative time out of scope.

Contract: timestamp dates use Asia/Seoul independent of host TZ, explicit offsets denote instants, YYYY-MM-DD stays that calendar day. Timezone-less ISO datetime uses Korea wall time (API timestamps otherwise vary by host). Empty/null/undefined => em dash; unparseable input => source string. Source storage and API serialization unchanged. Existing admin and default locale punctuation preserved; three compact callers keep YYYY.MM.DD.

UI: archive cards, archive detail and resume picker; midnight conversion and invalid-value fallbacks require user UI approval before merge. No new page or component. Use mocks for desktop/mobile screenshots and route smoke. Finish when focused regression, Node20 four gates, CI and review request are recorded; merge remains pending explicit latest-head UI approval.

Implementation note: existing default month:short locale options render “2026년 3월 15일” on Node20 ICU; retain those options rather than the old stale dotted example. Compact remains YYYY.MM.DD; admin remains YYYY. MM. DD.

Validation (2026-10-26): Node v20.19.2 from ~/.nvm/versions/node/v20.19.2/bin. lint PASS (2 existing warnings); typecheck PASS; test:unit PASS 202 files/3630 tests; build PASS. Focused 44 tests PASS each TZ UTC, Asia/Seoul, America/Los_Angeles. Mock Playwright PASS 2 tests (1440px/390px), six captures under e2e/preview/out/frt188-*.jpg; local gallery /private/tmp/frt188-ui-gallery.html. Initial regression run failed 11 tests as expected. No live backend or real login exercised. Latest-head user UI approval pending.

Final review correction: preserve calendar and offset-less wall-time date components via synthetic UTC formatting; explicit instants still use Asia/Seoul. Regression 1960-03-14 and 1960-03-14T00:00 proved red then green (historical Korea offset formerly moved them to March13). Final lint/typecheck/build PASS, full unit rerun PASS 3630 after one unrelated cover-letter fake-timer timeout (isolated17 PASS). Mock route E2E2 PASS recaptured. Existing CI uploads4 archive/detail screenshots; local preview gallery contains6 including rollout-enabled picker.
