# FRT-242 Demo mobile menu state

Source: Linear FRT-242, no linked original Notion task. User authorized narrow accessibility fix and keyboard/menu regression checks; latest UI approval required before merge.

Goal: announce open/closed menu meaning from the existing mobileOpen state. Preserve layout, copy except toggle name, navigation, guide and signup actions.

Approach: dynamic 메뉴 열기/메뉴 닫기, aria-expanded, useId-based aria-controls linked to the mobile navigation. Keep a hidden collapsed navigation target mounted so the relationship resolves in both states. Native button keyboard behavior is retained. No new focus trapping or menu-role pattern.

Alternatives: label alone leaves programmatic expansion state absent; replacing navigation with a menu widget changes keyboard contracts unnecessarily.

Completion: closed/open names and expanded state agree; controlled ID resolves uniquely; collapsed links not keyboard-accessible; Enter/Space toggles, nav click closes, guide closes/reopens existing tour, signup remains correct; desktop unaffected. Actual screen-reader speech and deployment are separate checks.
