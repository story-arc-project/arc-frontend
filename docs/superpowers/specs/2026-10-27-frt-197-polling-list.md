# FRT-197 polling analysis lists

Extract the duplicated comprehensive/keyword list lifecycle into one hook while preserving existing UI, API, query, demo, notification and race behavior. User delegated technical decisions and explicitly authorized behavior-preserving implementation and conditional non-UI merge.

## Approaches
- Dedicated polling-list hook: chosen because these two domains share foreground/background epochs, progress watching, started cleanup, delete and optimistic mutations.
- Extend FRT-297 keyed-request hook: rejected because its filter/sequence/ignore contract differs; would couple unrelated lifecycle policies.
- Shared page: rejected because markup differs (keywords, dates, experience counts).

## Binding constraints
Keep domain-specific JSX and APIs. Preserve foreground loading/error behavior, background failure silence and stale response false return, foreground epoch increment, local mutation epoch increment, polling pause, completion toast text/count and watcher type. Preserve started query cleanup only when settled or deleted, retry processing/rearm/query ordering, demo restrictions, bookmark updates, delete error/cancel behavior. Do not fix unrelated policy or foreground/delete semantics. Existing watcher and FRT-297 hook unchanged. No changes to open PR files.

## Verification
Existing two page suites and real watcher regressions plus direct shared-hook contract tests. A main-route Chromium smoke for both domains. Node20 lint/typecheck/full unit/build and all PR CI; independent reviews and completed remote Codex review on latest head. No deployment or real-server claims.
