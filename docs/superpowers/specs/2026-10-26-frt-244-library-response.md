# FRT-244 library response boundary

Goal: distinguish valid empty library lists from malformed server responses, while preserving existing UI copy/layout and membership behavior.
User delegated technical design and execution. Chosen approach: validate the response envelope and both array buckets before spread; reject malformed payloads with an explicit Error through existing useLibraries catch. Do not silently default missing buckets to empty or accept iterable strings. Keep system-before-custom order, row identity and optional fields unchanged. Item schema expansion is outside this issue; validate the list container only.
Constraints: Node20, dev-based isolated branch, no hook/UI changes, no dependency changes. PR326 changes membership recovery through getLibraryExperiences, preserving list catch and array contract, so this API change is independent.
Alternatives: empty fallback hides contract failure; full DTO validation expands unrelated field policy. Neither chosen.
Acceptance: normal mixed and empty buckets succeed; null/missing/wrong envelope or buckets reject controlled Error; transport errors unchanged; demo behavior preserved. Regressions must demonstrate RED then GREEN.

UI review ruling: malformed iterable strings previously succeeded, now reach existing error/retry UI. Treat as UI state change; require explicit user approval before merge. Browser regression captures desktop/mobile error followed by retry into valid empty buckets. No new UI copy or component.
