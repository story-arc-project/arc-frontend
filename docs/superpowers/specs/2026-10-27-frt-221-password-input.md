# FRT-221 Password Input

Extract the identical visibility button and Input composition from login (one), signup (two), and password reset (two). Keep each visibility state in its form: step exit/reentry must preserve it. PasswordInput forwards Input props and ref, owns type, rightAddon and existing pr-14 padding, and receives visible/onToggleVisibility.

Preserve DOM, copy, classes, focus/selection behavior, independent state, errors, labels, autocomplete, disabled input behavior, type=button and submission behavior. Authentication, password policy and OAuth remain unchanged.

State matrix: empty/partial values pass through; errors/hints remain Input's responsibility; loading/disabled remains caller-owned; visibility never derives from value or errors. No new product states or visual changes.

Validation: component tests and Storybook interaction, real Chromium on all three routes including signup/reset step reentry, existing authentication unit regressions, Node20 lint/typecheck/unit/build. No live account login/password mutation.
