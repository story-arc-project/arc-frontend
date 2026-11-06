# FRT-189 list editor common operations

Preserve existing behavior in Activity, Award, Career, Certification, Club, Education, Language and Project list editors while centralizing their repeated array operations.

## Design
Use adjacent `useListEditor<T extends { id: number }>(value, onChange, createItem)`. It owns only append, shallow patch-by-id and filter-by-id. It has no local state, memoization or effects. The current controlled props remain authoritative. Each editor passes its existing item literal as a lazy factory; `nextClientId()` and nested arrays are created only when Add is clicked. Reorder callbacks, JSX, labels, IDs, focus, parsing and save behavior remain untouched.

## Alternatives
Pure operation helpers would centralize map/filter but leave repeated onChange wiring. A state-owning hook would change ownership and risk stale values. A stateless operation hook fits the requested common boundary with the smallest behavior surface. This technical choice is made under the explicitly autonomous implementation scope.

## Constraints and acceptance
No shared.tsx/page/page.test changes; preserve all defaults, duplicate-id behavior, patch null/undefined/id semantics, array order and surviving references. No feature or UI changes. Verify hook contracts and controlled add/edit/remove plus focus for all eight editors; retain existing GPA tests; run Node20 lint/typecheck/unit/build and browser smoke before PR.
