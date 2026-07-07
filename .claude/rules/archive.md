---
paths:
  - "app/(main)/archive/**"
  - "components/features/archive/**"
  - "types/archive.ts"
  - "lib/utils/form-cards.ts"
  - "lib/utils/detail-cards.ts"
  - "lib/utils/experience-mapper.ts"
---

# Archive 도메인 규칙

- content JSONB는 **스키마 v2** (FRT-69): 안정키 `fields` 맵 + `custom[]` 배열.
  라벨 문자열 매칭으로 값을 재조립하지 말 것 — 항상 안정키로 접근한다.
- 입력 폼과 상세뷰는 같은 소스를 공유한다: `computeFormCards`(lib/utils/form-cards.ts) ·
  `buildDetailSections`(lib/utils/detail-cards.ts) 순수함수 재사용. 새 뷰에서 카드 구성을 재구현하지 않는다.
- 사용자 섹션 블록(`entryType: 'section'`, 레거시 group은 로드 시 승격)은 **중첩 1겹 제한**.
  group-in-group 허용 시 무한재귀 이력 있음 — depth 가드를 제거하지 말 것.
- 미저장 이탈 가드는 `useUnsavedNavGuard` 훅(history state의 `__navGuardSentinel` 태그 판정).
  불리언 ref 판정으로 되돌리면 stale 회귀한다(FRT-81 교훈).
- '완료' 저장 시 빈 경험명 차단(role=alert 에러)을 유지한다. draft 저장과 조건을 섞지 말 것.
