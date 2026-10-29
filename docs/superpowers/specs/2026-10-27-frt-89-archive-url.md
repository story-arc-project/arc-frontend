# FRT-89 archive URL context

## Intent and authority
Exact Linear FRT-89 UUID0030ec30-57b0-43b5-a824-cbbd77db2e6c, Frontend team47ee1d10-c8ab-4ada-8f95-c92755a8b283, assigneebeb42a3c-9b32-48c6-b033-ed7a0b47e7a5 verified; full description/comments0 read. PR149 review3543890435 and replies3543958715/3549331519 explicitly defer URL canonicalization here. No connected Notion Task; personal tracking row403eedeede868158ae65e5079a68b296 is not a product Task.

## Behavior
Library/search/sort/type/status/tag URL parameters become authoritative across refresh, shared links, same-route navigation, browser Back/Forward and edit/new round trips. Search draft updates immediately; URL replacement is debounced300ms. Other filters replace without adding history. Navigation must preserve pending search and preview id and prevent stale timers from undoing navigation. Use existing parse/serialize helpers. Preserve current default omission, demo base path, reserved characters, repeated tags, invalid-value normalization and library-load failure recovery.

## Existing decisions
New-record success returns to all-library so unassigned records remain visible (PR149 comment3543198796); cancel restores context. FRT75 removed automatic selection. FRT81 sentinel and unsaved guard are unchanged. Preview open/close/peer/delete/duplicate links preserve context. Missing library falls back only after successful library loading. No tag UI addition.

## Approach
Issue explicitly selects approach A, URL authority with local search draft; capture-only approach B is the confirmed bug. General technical details delegated by request; no new product decision. Use a route-local URL context hook and controlled filtering integration, retaining existing useLibraryFilter behavior for other consumers. Technical choice: synchronous native history.replaceState(null, "", url) for context writes and pre-departure flush; Next16.2.1 integrates this with useSearchParams. Passing current __NA state bypasses that integration. Peer navigation still uses router.replace. See https://nextjs.org/docs/app/getting-started/linking-and-navigating#native-history-api and installed app-router.js268-278. Reconcile actual window location when traversal precedes subscription render; own write acknowledgments must not erase newer input.

## Independence
Base origin/dev465906e. PR353/354 merged6a19754/8feaf09. PR363 modifies API validation; PR362 modifies useLibraries; PR352 resume detail; PR325 block-utils/BlockList/form-card and mapper tests. Do not modify those files; use route-local integration tests and existing public hooks. Release345 read-only excluded.

## Verification and completion
TDD hook/filter/URL boundary tests; browser desktop/mobile refresh/share/back/forward/pending input/preview/empty/missing-library/loading-error/new/edit/dirty guard cases. Node20.19.2 lint,typecheck,unit,build; CI + actual latest-head Codex completion required. Publish remote screenshots and checklist then Ready PR; latest PR UI approval required before merge. Stub browser evidence is separate from real backend/production/Safari behavior.
