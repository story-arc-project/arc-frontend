# FRT-295 Dashboard tabs

Authorized scope: restore the keyboard behavior promised by existing dashboard tab roles. Left/Right wrap focus and selection; Home/End select first/last; only selected tab is in the Tab order. Click continues selecting. Current tabpanel associations and async summary behavior must stay correct. No layout, API, or policy expansion.

Approach: use the existing local button keyboard/ref convention with automatic selection, since results are already loaded together. A shared tab abstraction or manual activation would broaden scope or change the existing selection model.

Validation: focused unit regressions for navigation, click/content replacement, delayed response and no added requests; browser desktop/mobile focus and Tab exit; full Node20 lint/typecheck/unit/build; remote CI and actual completed Codex review. UI requires explicit user approval before merge.
