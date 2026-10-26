# FRT-297 analysis list request guard

Goal: centralize the request/filter/generation/loaded-key/ignore lifecycle used by bookmarks, individual, and history without changing observable behavior.

Compare all five screens: bookmarks and individual use one filter; history adds sort and partial failures. Comprehensive and keyword instead use mutationEpoch, foreground/background refresh, progress watch, started query cleanup, optimistic retry/bookmark/delete. They do not share this lifecycle and stay unchanged; FRT-197 remains open in full.

Choose one generic keyed-list hook, with typed selection, stable loader, result state and setter. It owns atomic selection+generation, same-selection no-op, explicit retry, loading derived from current versus loaded generation, and effect cleanup guarding success/error/settlement. Pages retain API adaptation, item mutations, history partial-failure policy, and all JSX. Do not introduce polling or mutation policy into the hook.

Preserve error-before-retry behavior, prior result retention, synchronous loading after selection changes including batched away/back, stale success/failure suppression, unmount cleanup, history sort/filter axes and completed-only API contract. All visible copy, markup, accessibility and layout stay identical.

Tests: hook deferred promise races/no-op/retry/away-back/unmount and both selection axes; existing three page tests and comprehensive/keyword regressions; main-route Playwright smoke; Node20 lint/typecheck/unit/build. PR base dev; exact-head Codex completion and all remote gates before authorized non-UI merge. No production verification claimed.

Authorization: delegated autonomous execution explicitly authorizes internal design choices and non-UI merge after gates; no additional design approval required.
