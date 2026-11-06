# FRT-283 OutcomeList input names

## Intent
Screen-reader users can identify each editable OutcomeList row by its block label and current one-based row number, including the empty display row and inputs with no placeholder.

## Approach
Use the existing internal AutoGrowInput boundary: require an `ariaLabel: string`, render it as `aria-label`, and supply `${block.label} ${index + 1}행`. The visible block label and the accessible name stay aligned. `aria-labelledby` with generated IDs would also connect the label, but adds identity plumbing and hidden row labels without improving this small input-only change.

## Constraints
- Preserve row IDs, React keys, focus, Korean IME behavior, input values and serialized schema.
- Preserve layout, read-only output, role chips and project links.
- No shared block helper changes; PR #325 and #343 stay independent.
- FRT-198 touch targets are outside this issue.
- The latest UI requires explicit user approval before merge.

## Acceptance
Inputs expose block and current row context without relying on placeholder or typed text. Adding and removing rows updates their numbers while existing nodes survive. Placeholder materialization preserves focus and name. Enter, Backspace, Shift+Enter and IME keep their existing behavior. Unit, Storybook and mocked main-route checks cover these paths; real assistive-technology testing remains separate.
