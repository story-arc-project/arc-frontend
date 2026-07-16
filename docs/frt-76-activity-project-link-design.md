# FRT-76 — 활동/성과 → '프로젝트로 연결' 설계 결정서

*작성 2026-07-15 · Linear FRT-76(설계 스파이크, FE+BAC) · 선행 FRT-97(OutcomeList)·FRT-69(스키마 v2)*

## 배경

Notion `아카이빙 입력항목 set 대거 수정 1차`(학회 프로토타입): **경험 상세**에서 활동을 개조식으로 나열(OutcomeList)한 뒤, 각 활동 행 옆 `프로젝트로 연결` 버튼을 누르면 아래 **프로젝트 기록** 섹션에 그 활동을 제목으로 한 프로젝트 입력이 즉시 생긴다.

**정정(2026-06-17, 사용자 확인):** 이것은 경험 간(cross-experience) 링크가 **아니다.** 한 경험 **내부**의 *활동 나열 블록*과 *프로젝트 블록*을 잇는 **intra-experience(같은 content JSONB 내) 블록 간 링크**다. 별도 Experience 레코드 생성이 아니며 **백엔드 비의존**이다.

## 결정 요약

| 항목 | 결정 |
| --- | --- |
| **적용 타입 범위** | academic-society 먼저(society-detail의 '단체 활동/성과'·'개인 활동/성과' 2곳). '성장/변화'·다른 18종 템플릿은 제외. **config 한 줄로 확장 가능한 구조**로 설계 — 인턴(career)·동아리(club)·대외활동은 후속 이슈에서 대상 섹션만 지정해 opt-in. |
| **링크 의미** | 단방향 **outcome → project soft link**. 활동 행이 대상 프로젝트 행의 id를 가리킨다. 프로젝트 행이 삭제되면 다음 로드에서 자동 미연결로 복귀(soft). 양방향·자동 제목 동기화는 채택하지 않음(사용자가 프로젝트 제목을 독립 편집할 자유 보존). |
| **데이터 모델** | `BlockRow.linkedProjectRowId?: string` (additive, 무마이그레이션). value(JSONB) 경로로 직렬화·복원. `schema_version`/`TEMPLATE_VERSION` 변경 없음. |
| **설정 가능성** | `Block.linkConfig?: ProjectLinkConfig`(template-only, `variant`처럼 비직렬화). 인스턴스별 on/off + 버튼 문구를 `createOutcomeList(label, { link })`로 주입. |
| **연결 상태 UX** | 연결된 행 = `연결됨 ↗` 칩(클릭=프로젝트로 스크롤), 칩 ×로 참조만 해제(프로젝트 행 존치). 미연결 = `프로젝트로 연결` 버튼. stale(대상 삭제) = 버튼으로 복귀. |

## 왜 이 데이터 모델인가 (제약 3가지)

1. **컬럼 추가 함정**: 링크를 OutcomeList의 새 컬럼으로 넣으면 `BlockRenderer`의 `columnCount ≤ 1` 가드에 걸려 표(RepeatableCell) 렌더러로 폴백한다. → 링크는 컬럼이 아니라 **`BlockRow`의 필드**로 얹어 단일컬럼 가드를 유지한다.
2. **매퍼가 Block-레벨 임의 필드를 버림**: `blockToCustomEntry`/`toSavePayload`는 `key/type/label/value/required/options`만 직렬화하고 `variant`조차 버린다. 하지만 `repeatable-cell`은 `fields[key] = b.value`로 **value 전체(=columns+rows)를 통째로** 저장하고, 로드 시 `injectValue`가 `value.type`만 검사해 그대로 주입한다. → **row 안의 새 필드(`linkedProjectRowId`)는 value 경로를 타고 additive하게 왕복 보존**된다(단위 테스트로 검증).
3. **prop 체인 단절**: `BlockRenderer`/`BlockList`는 자기완결형(`block`+`onChange`만 관통)이라 OutcomeList 행까지 콜백을 내릴 길이 없다. → 링크 **설정**은 값(`linkConfig`)으로 흘리고, **교차-섹션 동작**(다른 섹션에 프로젝트 행 생성/조회/스크롤)은 `ProjectLinkContext`로 폼 최상위(`ExperienceFormV2`)에서 공급한다. 활동 행 자신의 `linkedProjectRowId` 세팅/해제는 OutcomeList가 자기 onChange로 직접 한다.

## FRT-69 안정키 정합

- OutcomeList 블록 키 = `society-detail.단체 활동 / 성과`(섹션 재분배·저장순서 안정). 링크는 그 블록 **value 내부의 row 필드**라 안정키 체계를 건드리지 않는다.
- 참조 대상은 프로젝트 행의 **client `row.id`**(`uid()`)다. 안정키가 아니라 세션/영속 uid이므로 같은 경험 content 내부에서만 유효한 intra-experience 앵커다 — cross-experience로 새지 않는다.
- additive·무마이그레이션: 기존 학회 레코드는 `linkedProjectRowId` 없이 로드돼 전부 미연결 상태로 정상 동작한다.

## 후속 확대 방법 (config 한 줄)

다른 활동나열형 타입에 확대하려면 해당 타입 템플릿의 OutcomeList에 `link: { targetSectionId, titleColumnKey, label? }`만 추가한다. 예: 인턴(career) 업무내용 OutcomeList → `career-projects`(있다면) 또는 신설 프로젝트 섹션. 대상 섹션은 단일 `repeatable-cell` 블록을 가진 `TemplateSection`이어야 한다(현 `createProjectRow`가 섹션의 첫 repeatable-cell에 행을 append).

## DoD 체크

- [x] 적용 타입 범위·링크 의미(단/양방향)·content 내 참조 데이터 모델 결정 → 위 표.
- [x] FRT-69 안정키와의 정합 확인(additive, 무마이그레이션) → 매퍼 왕복 단위 테스트.
- [x] 후속 구현으로의 확장점 정의 → config 한 줄 확대.

## 구현 산출물

- `types/archive.ts` — `BlockRow.linkedProjectRowId?`, `ProjectLinkConfig`, `Block.linkConfig?`
- `lib/utils/block-utils.ts` — `createOutcomeList` `link` 옵션
- `lib/constants/templates-v2.ts` — 학회 2개 OutcomeList opt-in
- `contexts/ProjectLinkContext.tsx` — 교차-섹션 provider/hook
- `components/features/archive/ExperienceFormV2.tsx` — provider 구현
- `components/features/archive/blocks/OutcomeList.tsx` — 링크 버튼/연결됨 칩
- `components/features/archive/blocks/RepeatableCellBlock.tsx` — 프로젝트 행 `data-row-id`(스크롤 앵커)
- 테스트: block-utils / experience-mapper 왕복 / OutcomeList 링크 동작 / OutcomeList 스토리 play
