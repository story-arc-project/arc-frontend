# FRT-220 callback URL regression plan

**Goal:** Lock the existing login redirect security contract without changing behavior.
**Architecture:** Move resolveCallbackUrl(raw: string): string verbatim into lib/auth/callback-url.ts. Login imports it; tests exercise the production helper with explicit expected destinations.
**Authorization:** User delegated extraction plus meaningful tests and autonomous implementation choices. No new policy, actual login, external navigation, or UI changes.
**Alternatives:** Page-only named export violates Next route constraints; browser-only tests add broad mocking. A pure helper gives direct deterministic security coverage.

## Task 1
- [x] Write lib/auth/callback-url.test.ts for absolute/protocol-relative/backslash/dot-segment/invalid inputs returning /dashboard, and valid internal paths preserving query/hash and normalization.
- [x] Observe missing-helper RED, extract the exact existing function to lib/auth/callback-url.ts, import from login/page.tsx, observe GREEN.
- [x] Demonstrate tests detect representative unsafe mutations (origin check, pathname double-slash check, query/hash loss), restore original production source.
- [x] Review diff for unchanged login/signup behavior; run Node20 lint/typecheck/unit/build.
- [ ] Ready PR base dev with source/role/remaining work/verification; request latest-head Codex review. Merge only after actual review completion and all gates succeed under delegated non-UI authorization.

## Review focus
Origin checks, same-origin protocol-relative inputs, normalized double slash, preserved query/hash, malformed URL fallback. Inputs stay strings as in the existing contract. No arbitrary path allowlist or new URL decoding.
