// ─── Block System ───────────────────────────────────────────────

export type BlockType =
  | 'text'
  | 'textarea'
  | 'checklist'
  | 'single-select'
  | 'date'
  | 'period'
  | 'tags'
  | 'link'
  | 'file'
  | 'repeatable-cell'
  | 'table'
  | 'group'

export interface TextBlockValue {
  type: 'text'
  text: string
}

export interface TextareaBlockValue {
  type: 'textarea'
  text: string
}

export interface ChecklistBlockValue {
  type: 'checklist'
  options: string[]
  checked: string[]
}

export interface SingleSelectBlockValue {
  type: 'single-select'
  options: string[]
  selected: string
}

export interface DateBlockValue {
  type: 'date'
  date: string
}

export interface PeriodBlockValue {
  type: 'period'
  start: string
  end: string
  isCurrent: boolean
}

export interface TagsBlockValue {
  type: 'tags'
  tags: string[]
}

export interface LinkBlockValue {
  type: 'link'
  url: string
  title: string
  description: string
  linkType: string
}

export interface FileBlockValue {
  type: 'file'
  fileName: string
  description: string
  evidenceType: string
  fileId?: string
  mimeType?: string
  size?: number
  url?: string
}

export interface BlockColumnDef {
  key: string
  label: string
  blockType: Exclude<BlockType, 'repeatable-cell' | 'table' | 'group'>
  required?: boolean
  placeholder?: string
  options?: string[]
  /** 입력 가이드라인(컬럼 라벨과 입력칸 사이 안내문). 반복 입력의 첫 행에만 렌더된다. */
  guide?: string
  /**
   * 셀 렌더 모드 힌트 (FRT-178). 블록의 `variant` 와 같은 역할을 컬럼 층위에서 한다.
   * `'role-chip'` 은 옵션 없는 `checklist` 컬럼을 자유 태그 입력이 아니라 역할 칩으로 렌더한다 —
   * 선택지가 상수가 아니라 같은 폼의 '역할 이력' 값에서 파생되기 때문이다(RoleHistoryContext).
   * `'month'` 는 `date` 컬럼을 일 단위가 아니라 **월 단위**로 받는다(FRT-269) — 확정본이 month 로
   * 정한 시점 컬럼용이다. 블록 층위에는 `DatePicker mode` 가 있는데 셀에는 없어 생긴 구멍이고,
   * `period` 컬럼은 시작~종료 **두 칸**이라 단일 시점을 담을 수 없다. 안 주면 기존대로 일 단위다.
   *
   * ⚠️ 블록 층위의 `variant` 와 달리 이건 `RepeatableCellBlockValue.columns` 안에 있어
   * **value(JSONB)에 함께 저장된다** — 저장된 레코드를 다시 열면 템플릿이 아니라 저장값의
   * columns 가 채택되므로(`injectValue`), 값을 읽는 쪽은 columns 에 `variant` 키가 실릴 수
   * 있음을 전제해야 한다. 렌더 힌트일 뿐이라 무시해도 무해하다.
   */
  variant?: 'role-chip' | 'month'
}

/**
 * 반복 입력(`repeatable-cell`)의 `file` 컬럼 셀 값 (FRT-213).
 *
 * 블록 층위 `FileBlockValue` 와 달리 `description`·`evidenceType` 을 담지 않는다 —
 * 셀은 표의 한 칸이고, 설명이 필요하면 템플릿이 별도 텍스트 컬럼을 두는 게 표 관행이다
 * (역할 이력의 start/end/role 3컬럼과 같은 결).
 *
 * ⚠️ `fileName` 을 **함께 저장하는 것이 핵심이다.** `GET /files/{id}/download` 는
 * `{url, expiresAt}` 만 주고 파일명·mime·크기를 돌려주지 않아(`lib/api/files-api.ts`),
 * `fileId` 만 저장하면 새로고침 후 표에 무슨 파일인지 표시할 방법이 사라진다.
 * `url` 은 저장하지 않는다 — presigned URL 은 만료되므로 표시 시점에 새로 받는다.
 */
export interface FileCellValue {
  type: 'file'
  fileId: string
  fileName: string
  mimeType?: string
  size?: number
}

/**
 * 반복 입력 셀 하나가 담을 수 있는 값 (FRT-213).
 *
 * 대부분의 컬럼은 값의 알맹이만 담는다 — `link` 는 url 문자열만, `checklist` 는 checked
 * 배열만 담고 블록 층위의 래퍼 객체(`LinkBlockValue` 등)를 그대로 싣지 않는다.
 * `file` 만 예외로 구조화 객체를 담는데, 파일은 사람이 읽는 문자열 하나로 접히지 않기 때문이다.
 * `period` 는 예외가 아니다 — 점 구분 문자열(`"2023.03 ~ 현재"`) 하나로 접힌다.
 */
export type CellValue = string | string[] | FileCellValue

export interface BlockRow {
  id: string
  cells: Record<string, CellValue>
  /**
   * intra-experience 블록 간 링크 (FRT-76). OutcomeList 활동 행이 '프로젝트로 연결'로
   * 만든 프로젝트 행(다른 섹션 repeatable-cell 의 BlockRow)의 id 를 가리킨다.
   * value(JSONB) 경로로 직렬화되므로 additive·무마이그레이션(컬럼이 아니라 row 필드라
   * OutcomeList 단일컬럼 가드에 영향 없음). soft link — 대상 행이 사라지면 미연결로 복귀한다.
   */
  linkedProjectRowId?: string
  /**
   * 이 행에 붙은 역할 태그 (FRT-178). '역할 이력'에 등록된 역할명을 값으로 갖는다.
   * `linkedProjectRowId` 와 같은 이유로 컬럼이 아니라 **행 필드**다 — OutcomeList 는
   * 단일컬럼 전제 위에서 동작하므로 둘째 컬럼을 만들면 그 전제가 깨진다. additive·무마이그레이션.
   * 행 id 가 아니라 **이름**을 저장한다 — 저장된 JSONB 를 백엔드 분석이 그대로 읽어야 하므로.
   * 이름이 바뀌거나 지워질 때의 동기화는 RoleHistoryContext 가 편집 시점에 전파한다.
   */
  roleTags?: string[]
  /**
   * 이 행에만 사용자가 직접 붙인 항목 (FRT-145). 템플릿이 소유하는 `columns` 는 그대로 두므로
   * FRT-104 의 열 잠금 정책과 충돌하지 않는다 — 열을 늘리면 **모든 행**에 칸이 생기지만
   * 여기 붙는 항목은 그 행 하나에만 있다. `linkedProjectRowId`·`roleTags` 와 같은 행 필드
   * 규약(additive·무마이그레이션, value(JSONB) 경로로 직렬화).
   * 노출 여부는 블록 층위 `Block.allowRowExtras` 로 템플릿이 opt-in 한다.
   */
  extraFields?: RowExtraField[]
  /**
   * 이 행에만 붙은 결과물 첨부 목록 (FRT-291).
   *
   * 확정본 프로젝트 ③ 은 세부 작업마다 결과물을 **여러 개** 등록한다. 셀 값(`CellValue`)은
   * 단일 값이라 목록을 담을 수 없고 `BlockColumnDef.blockType` 은 `repeatable-cell` 을
   * 제외하므로, 열을 늘리는 대신 `extraFields`·`roleTags`·`linkedProjectRowId` 와 같은
   * **행 필드**로 얹는다(additive·무마이그레이션, value(JSONB) 경로로 직렬화).
   * 노출 여부는 블록 층위 `Block.allowRowArtifacts` 로 템플릿이 opt-in 한다.
   *
   * ⚠️ 파일을 담으므로 `hostsAttachment`(hidden-fields.ts)의 업로드 유실 불변식이 이 경로에도
   * 서야 한다 — 그 함수는 `file` **열**만 보므로 행 첨부는 그냥 두면 검사를 통과해 버린다.
   */
  artifacts?: RowArtifact[]
}

/**
 * 행 첨부 한 건 (FRT-291). 확정본의 'artifact-blocks (파일 or 링크 + 설명)' 한 줄에 대응한다.
 *
 * 링크와 파일을 **둘 다** 담을 수 있게 둔 것은 확정본 ⑤ '결과물 링크 / 파일'(link·file·desc
 * 3컬럼 표)과 같은 모양을 유지하기 위해서다 — 같은 질문을 층위만 달리해 묻는데 담는 것이
 * 달라지면, 나중에 둘 사이에 값을 옮길 때 한쪽이 조용히 버려진다.
 *
 * 파일은 `FileCellValue` 를 그대로 재사용한다(신규 값 타입을 만들지 않는다) — 업로드·다운로드
 * 배선이 그 모양에 이미 맞춰져 있고, 모양이 갈리면 `cellFilled` 같은 공유 술어가 한쪽을 못 읽는다.
 */
export interface RowArtifact {
  id: string
  /** 사용자가 적는 링크. 만료되는 presigned URL(`FileCellValue`)과 다른 층이다. */
  url?: string
  file?: FileCellValue
  desc?: string
}

/**
 * 사용자가 행 하나에 추가한 항목 (FRT-145).
 *
 * `label` 은 id 가 아니라 **이름**을 저장한다 — 저장된 JSONB 를 백엔드 분석이 그대로 읽어야
 * 하므로(FRT-178 교훈). `key` 는 렌더 키·수정 대상 식별에만 쓰는 내부 값이다.
 *
 * `blockType` 은 `BlockColumnDef.blockType` 의 부분집합이다. 셀 렌더러(`CellInput`)가
 * 실제로 분기하고 **선택지 없이도 성립하는** 6종만 연다 — `single-select` 는 options 가
 * 없으면 빈 드롭다운이 되고, `checklist` 는 `tags` 와 동일한 자유입력으로 폴백한다.
 *
 * `file` 은 계속 미지원이다(FRT-213). 옵션 편집 UI 도 아직 없다.
 * 파일 셀 값은 구조화 객체(`FileCellValue`)라 아래 `value: string | string[]` 로는 담을 수
 * 없다 — 열려면 값 타입부터 넓혀야 하므로 별도 논의가 필요하다.
 */
export interface RowExtraField {
  key: string
  label: string
  blockType: RowExtraFieldType
  value: string | string[]
}

export type RowExtraFieldType = 'text' | 'textarea' | 'date' | 'period' | 'link' | 'tags'

export interface RepeatableCellBlockValue {
  type: 'repeatable-cell'
  columns: BlockColumnDef[]
  rows: BlockRow[]
}

export interface TableBlockValue {
  type: 'table'
  columns: string[]
  rows: string[][]
}

/**
 * group(접이식 미니 섹션, FRT-72) 블록의 센티넬 값. group 은 스칼라 값이 없고
 * children(Block[]) 으로 구조를 표현하므로 value 는 타입 일관성을 위한 자리표시다.
 */
export interface GroupBlockValue {
  type: 'group'
}

export type BlockValue =
  | TextBlockValue
  | TextareaBlockValue
  | ChecklistBlockValue
  | SingleSelectBlockValue
  | DateBlockValue
  | PeriodBlockValue
  | TagsBlockValue
  | LinkBlockValue
  | FileBlockValue
  | RepeatableCellBlockValue
  | TableBlockValue
  | GroupBlockValue

/**
 * '＋ 빠른 선택' 그룹 픽커 프리셋 식별자 (FRT-130).
 * 실제 카테고리·항목 목록은 `lib/constants/quick-pick-presets.ts` 가 소유한다 —
 * 여기엔 id 만 두어 타입 층(의존성 최하층)이 상수 모듈을 참조하지 않게 한다.
 */
export type QuickPickPresetId = 'industry' | 'job-function'

// ─── Section Category (입력 폼 4섹션 분류, FRT-70) ───────────────
export type SectionCategory = "basic" | "detail" | "repeat" | "evidence"

/** 입력 폼 카드 4섹션 — 고정 순서·고정 라벨. scrollspy 네비가 소비한다. */
export const SECTION_CATEGORIES: { id: SectionCategory; label: string }[] = [
  { id: "basic", label: "기본 정보" },
  { id: "detail", label: "경험 상세" },
  { id: "repeat", label: "반복 기록" },
  { id: "evidence", label: "활동 증빙" },
]

export interface Block {
  id: string
  /**
   * 안정 시맨틱 키 (schema v2). 템플릿 블록은 `${sectionId}.${label}` 로 부여되어
   * 화면순서=저장순서를 구조적으로 보장한다. 사용자가 추가한 커스텀 블록은 key 가 없을 수 있다.
   */
  key?: string
  type: BlockType
  label: string
  required?: boolean
  collapsed?: boolean
  placeholder?: string
  /**
   * 입력 가이드라인(필드 아래 안내문). Input/Textarea 의 hint 로 렌더된다.
   * placeholder 가 "무엇을 쓰는 칸인가"라면, guide 는 "어떻게·왜 쓰면 좋은가"를 안내한다.
   */
  guide?: string
  options?: string[]
  /** 섹션 category override. core 섹션의 이질적 블록(기간/역할/성과/증빙) 분류에 사용. */
  category?: SectionCategory
  /**
   * 접이식 group 블록(FRT-72)의 자식 블록들. type 이 'group' 일 때만 사용한다.
   * 중첩은 1겹만 허용한다(group 안에 group 불가).
   */
  children?: Block[]
  /**
   * 렌더 모드 힌트 (FRT-97). type 을 바꾸지 않고 같은 블록을 다른 UI 로 그릴 때 쓴다.
   * `'outcome-list'` 는 단일컬럼 `repeatable-cell` 을 개조식 불릿-행(OutcomeList)으로 렌더한다.
   * `'mood-tag'` 는 `checklist` 를 이모티콘 알약 태그(MoodTagBlock)로 렌더한다 — 옵션이 고정
   * 프리셋이라 체크리스트의 옵션 추가·삭제 UI 를 숨긴다(FRT-177).
   * `'role-history'` 는 `repeatable-cell` 을 접이식 역할 이력 패널(RoleHistoryBlock)로 렌더한다.
   * 이 블록의 역할명이 폼 안의 모든 역할 칩 선택지가 된다(FRT-178).
   * `'binary-choice'` 는 `single-select` 를 두 카드 나란히 양자택일 UI(BinaryChoiceBlock)로
   * 렌더한다(FRT-320) — 옵션이 정확히 2개일 때만 이 UI 가 뜨고, 아니면(사용자가 옵션 편집으로
   * 늘린 저장값 등) 값이 숨지 않도록 SingleSelectBlock 드롭다운으로 폴백한다.
   * 템플릿 정의에만 존재하며 value(JSONB)에는 직렬화되지 않는다 — 로드 시 레지스트리에서 재공급된다.
   */
  variant?: 'outcome-list' | 'mood-tag' | 'role-history' | 'binary-choice'
  /**
   * 이모티콘/키워드 태그에 사용자가 직접 새 태그를 추가할 수 있게 한다 (FRT-320, '나는
   * 누구인가?' ① 키워드). `variant: 'mood-tag'` 블록에서만 의미가 있고, `roleTags` 와 같은
   * 인스턴스별 opt-in 규약이다 — 켜지 않은 블록(대외활동·동아리 등)의 동작은 완전히 그대로다.
   * 저장 shape 은 바뀌지 않는다: 새 태그는 `options`(프리셋)를 건드리지 않고 `checked` 에만
   * 추가되고, `moodTagOptions()` 의 기존 "checked 에만 남은 값도 뒤에 붙인다" 폴백이 다음
   * 렌더에서 그대로 그려 준다. 템플릿 정의에만 존재하며 value(JSONB)에는 직렬화되지 않는다.
   */
  allowCustomTag?: boolean
  /**
   * '＋ 빠른 선택' 그룹 픽커를 켠다 (FRT-130, 인턴 ① 산업·직무). 값은 어느 프리셋 목록을 쓸지
   * 가리키는 id 이고, 실제 목록은 `lib/constants/quick-pick-presets.ts` 가 소유한다.
   * `allowCustomTag`·`roleTags` 와 같은 인스턴스별 opt-in 규약이다 — 켜지 않은 블록의 동작은
   * 완전히 그대로다.
   *
   * ⚠️ **입력 보조일 뿐 저장 shape 을 바꾸지 않는다.** `tags` 블록이면 고른 항목이 `tags` 배열에,
   * `text` 블록이면 `text` 문자열에 그냥 들어간다 — 픽커에 없는 값도 자유 입력으로 계속 들어오고,
   * 목록을 나중에 바꿔도 기존 레코드는 살아 있다. 라벨을 안 바꾸므로 안정키도 무변경이다.
   *
   * ⚠️ 모르는 id 는 픽커를 켜지 않고 기존 자유 입력 UI 로 폴백한다(`getQuickPickPreset` → null).
   * 새 프론트가 추가한 프리셋을 구 프론트가 만났을 때 입력이 막히면 안 된다.
   *
   * `variant` 와 동일하게 템플릿 정의에만 존재하며 value(JSONB)에는 직렬화되지 않는다
   * (로드 시 레지스트리에서 재공급).
   */
  quickPick?: QuickPickPresetId
  /**
   * '프로젝트로 연결' 링크 설정 (FRT-76). OutcomeList 인스턴스별로 opt-in 한다 —
   * 있으면 각 활동 행에 링크 버튼이 노출되고, 없으면 미노출(설정 가능한 on/off).
   * `variant` 와 동일하게 템플릿 정의에만 존재하며 value(JSONB)에는 직렬화되지 않는다
   * (로드 시 레지스트리에서 재공급). 실제 참조는 `BlockRow.linkedProjectRowId` 에 저장된다.
   */
  linkConfig?: ProjectLinkConfig
  /**
   * 각 행에 역할 태그를 붙일 수 있게 한다 (FRT-178). OutcomeList 인스턴스별로 opt-in 한다 —
   * `linkConfig` 와 같은 규약이다. 켜지 않은 블록에는 칩 UI 가 아예 노출되지 않으므로,
   * 역할 개념이 없는 유형(대외활동 등)의 개조식 목록은 영향을 받지 않는다.
   * 실제 선택값은 `BlockRow.roleTags` 에 저장된다.
   * `variant` 와 동일하게 템플릿 정의에만 존재하며 value(JSONB)에는 직렬화되지 않는다.
   */
  roleTags?: boolean
  /**
   * 컬럼 고정 (FRT-104). `repeatable-cell` 에서 켜면 열 태그 줄(컬럼 pill·삭제·'열 추가' 입력)을
   * 숨겨 정해진 컬럼만 입력하게 한다. 기본 템플릿의 표는 컬럼이 고정이라 이 관리 UI 가 산만하다 —
   * 사용자가 직접 만드는 커스텀 표(createBlock 경로)는 잠기지 않는다. 표시 전용으로 value(JSONB)는 무변경.
   * `variant` 와 동일하게 템플릿 정의에만 존재하며 직렬화되지 않는다(로드 시 레지스트리에서 재공급).
   */
  lockColumns?: boolean
  /**
   * 각 행에 사용자가 항목을 추가할 수 있게 한다 (FRT-145). 블록 인스턴스별로 opt-in 한다 —
   * `roleTags`·`linkConfig` 와 같은 규약이다. `lockColumns` 와 충돌하지 않는다: 열은 계속
   * 템플릿이 소유하고(모든 행에 적용), 여기서 열리는 건 **그 행에만 붙는 항목**이다.
   * 실제 값은 `BlockRow.extraFields` 에 저장된다.
   * `variant` 와 동일하게 템플릿 정의에만 존재하며 value(JSONB)에는 직렬화되지 않는다.
   */
  allowRowExtras?: boolean
  /**
   * 각 행에 결과물(링크·파일·설명)을 **여러 건** 붙일 수 있게 한다 (FRT-291).
   * `allowRowExtras` 와 같은 인스턴스별 opt-in 규약이고, 값은 `BlockRow.artifacts` 에 저장된다.
   * 열이 아니라 행에 붙으므로 `lockColumns` 와도 충돌하지 않는다.
   *
   * ⚠️ 켜는 순간 그 블록은 파일을 담을 수 있게 된다 → `canHideBlock` 이 × 를 막아야 한다
   * (업로드 중 언마운트로 고른 파일이 조용히 사라지는 것을 막는 불변식, hidden-fields.ts).
   */
  allowRowArtifacts?: boolean
  /**
   * 조건부 노출 (FRT-211). 다른 블록(트리거)의 현재 값에 따라 이 필드를 보이거나 숨긴다 —
   * 수상경력 확정본의 "'개인 / 팀'에서 '팀 수상'을 고르면 '팀에서 내가 맡은 역할'이 나타난다".
   * `roleTags`·`lockColumns` 와 같은 규약이다: 템플릿 정의에만 존재하며 value(JSONB)에는
   * 직렬화되지 않는다(로드 시 레지스트리에서 재공급).
   *
   * ⚠️ 사용자가 직접 치운 목록(`hiddenKeys`, FRT-190)과는 **다른 층**이다. 조건 미충족은 어디에도
   * 저장되지 않는 순수 파생 상태이고, 조건으로 숨은 필드는 '숨긴 항목 N개' 되살리기 목록에
   * 나타나지 않는다(사용자가 치운 것이 아니므로 되살릴 것도 없다).
   */
  visibleWhen?: VisibilityCondition
  value: BlockValue
}

/**
 * 조건부 노출 트리거 조건 (FRT-211).
 *
 * 트리거는 라벨이 아니라 **안정키**로 가리킨다 — 같은 라벨이 여러 섹션에 존재할 수 있어
 * 라벨로는 어느 블록이 트리거인지 확정되지 않는다.
 *
 * ⚠️ 안정키는 `withSectionKeys` 가 `${sectionId}.${label}` 로 만들므로 **라벨을 바꾸면 이 `key`
 * 문자열도 함께 바꿔야 한다.** 잊으면 조건이 영원히 미충족이 되어 필드가 아예 안 보인다 —
 * templates-v2.test.ts 의 "트리거 키가 실제 안정키와 일치한다" 테스트가 유일한 방어선이다.
 *
 * `equals` 는 정확히 일치, `startsWith` 는 접두어 일치. 둘 다 없으면 "트리거에 값이 있으면 노출".
 */
export interface VisibilityCondition {
  key: string
  equals?: string[]
  startsWith?: string[]
}

/**
 * OutcomeList 활동 행 → 프로젝트 행 링크 설정 (FRT-76).
 * `targetSectionId` 의 (첫) repeatable-cell 블록에 행을 만들고, 활동 텍스트를
 * `titleColumnKey` 컬럼에 채운다. `label` 은 링크 버튼 문구(설정 가능, 기본 '프로젝트로 연결').
 */
export interface ProjectLinkConfig {
  targetSectionId: string
  titleColumnKey: string
  label?: string
}

// ─── Experience Types (18) ──────────────────────────────────────

export type ExperienceTypeId =
  | 'education'
  | 'extracurricular'
  | 'academic-society'
  | 'club'
  | 'career'
  | 'award'
  | 'certification'
  | 'language'
  | 'research'
  | 'personal-project'
  | 'team-project'
  | 'volunteer'
  | 'overseas'
  | 'creative-work'
  | 'sports'
  | 'reading'
  | 'journal'
  | 'goal'
  | 'self-identity'

export interface ExperienceTypeInfo {
  id: ExperienceTypeId
  label: string
  icon: string
  category: 'academic' | 'career' | 'project' | 'personal'
}

/**
 * 프로젝트는 개인·팀 두 id 가 **같은 템플릿**을 공유하므로(FRT-291) 표시 오버라이드도 같아야 한다.
 * 한쪽만 등록하면 같은 폼인데 저장된 유형에 따라 카드 이름이 갈린다.
 */
const PROJECT_SECTION_LABELS: Partial<Record<SectionCategory, string>> = {
  detail: '프로젝트 상세',
  repeat: '세부 작업 기록',
  evidence: '공개 / 배포 · 결과물',
}

/**
 * 유형별 섹션(카드·앵커) 라벨 오버라이드. 고정 4카테고리 라벨(SECTION_CATEGORIES)을
 * 특정 경험 유형에서만 다른 이름으로 보이게 한다 — 예: 학회의 '반복 기록' → '프로젝트 기록'.
 * "유형마다 섹션이 달라지는" 구조의 확장점이며, 표시 전용이라 안정키(`${sectionId}.${label}`)와
 * 무관하다(마이그레이션 불필요). 미지정 카테고리는 기본 라벨로 폴백한다.
 */
export const SECTION_LABEL_OVERRIDES: Partial<
  Record<ExperienceTypeId, Partial<Record<SectionCategory, string>>>
> = {
  'academic-society': { repeat: '프로젝트 기록' },
  'award': { detail: '수상 과정과 배움', evidence: '상장 / 증빙' },
  'career': { repeat: '프로젝트 / 담당 업무 기록' },
  'certification': { detail: '취득 배경', evidence: '자격증 증빙' },
  'club': { detail: '활동 상세', repeat: '활동 / 이벤트 기록' },
  'education': { detail: '수업 상세', repeat: '프로젝트 / 과제 / 제작물 기록' },
  'extracurricular': { detail: '활동 상세', repeat: '미션 / 프로젝트 기록' },
  'language': { detail: '어학 경험', repeat: '경험 상세 기록', evidence: '어학 자격증' },
  // 독서 확정본은 3섹션이지만 화면은 고정 4카테고리로 접힌다. ③ '평가'(별점)를 evidence 에
  // 두면 core '증빙 자료' 파일칸이 '평가' 카드에 딸려오므로 detail 에 합쳐 이름만 바꾼다.
  'reading': { detail: '감상과 평가', repeat: '문장별 감상' },
  // 봉사 확정본 ②. basic 은 오버라이드하지 않는다 — 확정본 ① '봉사 정보' 카드에는 헤더 코어
  // (경험명·한 줄 요약)도 함께 들어가므로 기본 라벨 '기본 정보'가 맞다(선행 유형들과 동일).
  'volunteer': { detail: '봉사 회고' },
  // 해외경험은 detail 을 오버라이드하지 않는다 — 확정본 ② 의 이름이 기본 라벨과 같은 '경험 상세'다.
  // basic 도 마찬가지로 코어(경험명·기간·한 줄 요약)가 함께 드는 카드라 '기본 정보'가 맞다.
  'overseas': { repeat: '활동별 상세 설명' },
  // 창작물 확정본 ② '작업 상세'. basic 은 오버라이드하지 않는다 — 확정본 ① '작품 정보' 카드에는
  // 헤더 코어(경험명·한 줄 요약)와 코어 '내 역할/기여도'도 함께 들어가므로 기본 라벨이 맞다.
  // 안내 문구(SECTION_DESCRIPTION_OVERRIDES)는 두지 않는다 — 확정본이 ② 에 섹션 안내를 달지
  // 않았고, 없는 문구를 지어내는 대신 폼 기본 문구로 폴백한다(독서와 같은 처리).
  'creative-work': { detail: '작업 상세' },
  // 연구논문 확정본 ②③④(FRT-269). basic 은 오버라이드하지 않는다 — 확정본 ① 의 이름이 기본
  // 라벨과 같은 '기본 정보'이고, 헤더 코어(경험명·한 줄 요약)도 함께 드는 카드다.
  'research': { detail: '연구 내용', repeat: '게재 / 발표 이력', evidence: '연구 증빙' },
  // 프로젝트 확정본 ②③④⑤(FRT-291). basic 은 오버라이드하지 않는다 — 헤더 코어(경험명·한 줄
  // 요약)와 코어 '내 역할/기여도'가 함께 드는 카드라 기본 라벨 '기본 정보'가 맞다.
  // evidence 이름이 둘을 합친 것인 이유는 확정본 5섹션이 고정 4카테고리로 접히기 때문이다
  // (④ 공개/배포 + ⑤ 결과물/증빙 → 한 카드, templates-v2 `projectExtensions` 주석 참조).
  'personal-project': PROJECT_SECTION_LABELS,
  'team-project': PROJECT_SECTION_LABELS,
  // '나는 누구인가?' 확정본 ① (FRT-320). basic 카드에는 헤더 코어(경험명·한 줄 요약)가 카드
  // 밖(헤더)으로 빠지고 ① 필드만 남으므로 확정본 이름을 그대로 쓴다. detail 카드들은 섹션당
  // 1카드로 분할되어 각 섹션의 label(②~⑦ 이름)이 카드 제목이 된다 — 카테고리 키인 이 표로는
  // 여섯 카드에 이름을 따로 줄 수 없어 여기엔 basic 만 둔다.
  'self-identity': { basic: '나를 소개한다면' },
}

/** 프로젝트 안내 문구 — 개인·팀 두 id 공유(FRT-291). */
const PROJECT_SECTION_DESCRIPTIONS: Partial<Record<SectionCategory, string>> = {
  detail:
    '이 프로젝트가 무엇이었는지, 어떻게 진행했는지, 무엇을 얻었는지 항목별로 기록해주세요.',
  repeat:
    '이 프로젝트를 단계별·기능별로 더 자세히 남기고 싶다면 기록해주세요. 기획, 개발, 디자인, 검증 등 원하는 단위로 추가할 수 있어요.',
  evidence:
    '어디에 공개했고 어떤 반응이 있었는지, 그리고 프로젝트를 직접 확인할 수 있는 링크나 파일을 남겨주세요.',
}

/**
 * 유형별 섹션(카드) 안내 문구 오버라이드 (FRT-177). 카드 제목 아래 회색 설명 문단으로 렌더된다.
 * 미지정 유형·카테고리는 폼의 기본 문구(detail 카드의 "선택 입력이에요…")로 폴백한다.
 * 라벨 오버라이드와 마찬가지로 표시 전용이라 안정키·저장 shape 와 무관하다.
 */
export const SECTION_DESCRIPTION_OVERRIDES: Partial<
  Record<ExperienceTypeId, Partial<Record<SectionCategory, string>>>
> = {
  'award': {
    detail:
      '간단히만 적어도 괜찮아요. 이 중 하나만 채워도 이후 AI 분석과 자기소개서 문장 추천 품질이 크게 달라져요.',
    evidence: '상장 사본, 트로피 사진, 관련 기사 등 수상을 증명할 자료를 첨부해주세요.',
  },
  'certification': {
    detail:
      '전부 선택 항목이지만, 이 중 하나만 채워도 이후 AI 분석과 자기소개서·이력서 문장 추천의 품질이 크게 달라져요.',
    evidence: '자격증 사본이나 취득 증명 자료를 첨부해주세요.',
  },
  'club': {
    detail:
      "이 동아리에서의 활동을 정리해주세요. 개별 이벤트나 프로젝트의 세부 내용은 아래 '활동 / 이벤트 기록'에서 따로 기록할 수 있어요.",
    repeat:
      "동아리에서 진행한 정기 이벤트, 공연, 프로젝트 등을 단위별로 기록해주세요. 위 '주요 활동 / 이벤트' 항목에서 프로젝트로 바로 연결할 수 있어요.",
    evidence:
      '임명장, 활동 확인서, 수상 내역, 공연 사진 등 이 동아리 활동을 증명할 수 있는 자료를 첨부해주세요.',
  },
  'extracurricular': {
    detail:
      "이 활동에서의 경험을 정리해주세요. 개별 미션이나 프로젝트의 세부 내용은 아래 '미션 / 프로젝트 기록'에서 따로 기록할 수 있어요.",
    // 문서 원문은 "위 '가장 중요했던 내용'에서"로 옛 필드명을 가리킨다 — 실제 필드명(주요 미션 /
    // 프로젝트)으로 맞췄다. 안내가 화면에 없는 필드를 가리키면 그게 더 큰 혼선이다.
    repeat:
      "이 활동에서 수행한 미션, 프로젝트, 제작물 등을 단위별로 기록해주세요. 위 '주요 미션 / 프로젝트'에서 관련 항목을 프로젝트로 바로 연결할 수 있어요.",
    evidence:
      '수료증, 위촉장, 활동 확인서 등 이 활동을 공식적으로 증명할 수 있는 자료를 첨부해주세요.',
  },
  'language': {
    detail:
      '이 언어를 실제로 사용하거나 능력이 성장한 경험을 자유롭게 기록해주세요. 외국계 인턴, 해외 생활, 통역, 논문 작성, 스터디, 원서 강독 등 어떤 것이든 좋아요.',
    repeat:
      "위 '주요 경험'에서 눈에 띄는 항목이 있다면 이곳에서 단위별로 자세히 기록해주세요. 기억나는 것부터 하나씩 추가해도 좋아요.",
    evidence: '보유한 어학 자격증이나 공인 시험 성적을 첨부해주세요.',
  },
  'reading': {
    // 확정본 ② 의 empty state 원문은 "문장을 추가하면 여기에 나타나요"(자동 동기화 전제)다.
    // 실제 구현은 행별 '감상 남기기' 버튼이므로 무엇을 눌러야 나타나는지로 맞췄다 — 안내가
    // 일어나지 않는 일을 약속하면 사용자는 버튼을 못 찾는다.
    repeat:
      "위 '인상 깊었던 문장'에서 문장에 '감상 남기기'를 누르면 여기에 나타나요. 문장이 특별히 마음에 남았다면 그때 남겨보세요 — 굳이 모두 채울 필요는 없어요.",
    // detail 은 override 하지 않는다 — 확정본에 대응 문구가 없어 지어내는 대신 폼 기본 문구로 폴백한다.
  },
  // 연구논문 확정본 ②③④ 의 '섹션 안내' 원문(FRT-269). ③ 은 이 카드 문구가 곧 안내라
  // 표 블록에는 guide 를 따로 달지 않는다 — 같은 문장이 카드 제목 아래와 표 위에 두 번 뜬다.
  'research': {
    detail: '이 연구가 무엇에 대한 것이었는지, 어떻게 진행했는지 정리해주세요.',
    repeat: '이 연구가 논문으로 게재되었거나 학회에서 발표된 이력을 기록해주세요.',
    evidence:
      '연구 참여 확인서, 상장, IRB 승인서 등 이 연구를 증명할 수 있는 자료를 첨부해주세요.',
  },
  // 프로젝트 확정본 ②③ 의 섹션 안내는 문서 문구 그대로다(FRT-291). evidence 는 ④⑤ 가 한 카드로
  // 합쳐진 자리라 확정본 ⑤ 의 안내에 ④ 를 포함해 다시 썼다 — 문서의 한 문장을 그대로 쓰면
  // 카드 절반(배포 이력)을 설명하지 못한다.
  'personal-project': PROJECT_SECTION_DESCRIPTIONS,
  'team-project': PROJECT_SECTION_DESCRIPTIONS,
  // '나는 누구인가?' 상단 가이드 배너 (FRT-320). 확정본은 페이지 최상단 독립 배너를 그리지만
  // 폼 셸에 그런 슬롯이 없어 첫 카드(①)의 안내 문단으로 근사한다. ⑤⑦ 의 섹션 안내는
  // 분할 카드라 이 표(카테고리 키)가 아니라 TemplateSection.description 이 싣는다.
  'self-identity': {
    basic:
      '이 페이지는 천천히, 오래 두고 채워가세요. 한 번에 다 채울 필요 없어요 — 면접 준비, 자소서 작성, 일상의 단상에서 하나씩 추가해도 좋아요. 여기 적어둔 내용이 자기소개서·면접 답변을 생성할 때 "나다운 결"을 잡는 핵심 재료가 됩니다.',
  },
}

// ─── Templates ──────────────────────────────────────────────────

export interface TemplateSection {
  id: string
  label: string
  /** 입력 폼 4섹션 분류 (FRT-70). 섹션 블록은 기본적으로 이 category 로 묶인다. */
  category: SectionCategory
  /**
   * 이 섹션이 카테고리 버킷에 합쳐지지 않고 **자기 카드**로 선다 (FRT-320).
   * ⚠️ 개수로 추론하지 않고 명시로만 켠다 — "같은 카테고리 2개 이상이면 분할" 같은 파생
   * 규칙은 이미 프로젝트(evidence 섹션 2개가 한 카드 '공개 / 배포 · 결과물'로 합쳐지는 것이
   * 확정본)를 깨뜨린다. 켜지 않은 섹션(기존 전 유형)은 현행 카테고리당 1카드 그대로다.
   * 켠 카드의 제목은 `label`, 안내는 `description` 이 담당한다(카테고리 키 오버라이드는
   * 같은 카테고리의 여러 카드를 구분하지 못하므로).
   */
  standalone?: boolean
  /**
   * 섹션 카드 제목 아래 안내 문단 (FRT-320). `standalone` 카드에서만 쓰인다 — 카테고리
   * 카드는 기존 `SECTION_DESCRIPTION_OVERRIDES` 경로를 그대로 쓴다.
   */
  description?: string
  collapsed?: boolean
  blocks: Block[]
}

export interface TemplateV2 {
  id: string
  typeId: ExperienceTypeId
  label: string
  icon: string
  commonCore: TemplateSection
  extensions: TemplateSection[]
  isSystem: boolean
}

// ─── Experience ─────────────────────────────────────────────────

export type ExperienceStatus = 'draft' | 'complete'

// 경험 중요도 — 1(매우 낮음) ~ 5(매우 높음)
export type ImportanceLevel = 1 | 2 | 3 | 4 | 5

export const IMPORTANCE_LEVELS: readonly ImportanceLevel[] = [5, 4, 3, 2, 1] as const

export const IMPORTANCE_LABELS: Record<ImportanceLevel, string> = {
  5: '매우 높음',
  4: '높음',
  3: '보통',
  2: '낮음',
  1: '매우 낮음',
}

export function isImportanceLevel(value: unknown): value is ImportanceLevel {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  )
}

export interface ExperienceV2 {
  id: string
  userId: string
  typeId: ExperienceTypeId
  title: string
  summary: string
  status: ExperienceStatus
  tags: string[]
  importance?: ImportanceLevel
  coreBlocks: Block[]
  extensionBlocks: Block[]
  customBlocks: Block[]
  /**
   * 사용자가 숨긴 선택 필드의 안정키 (FRT-190). 빈 선택 필드만 들어간다 —
   * 판정·정리는 `lib/utils/hidden-fields.ts` 한 곳에서 한다.
   */
  hiddenKeys: string[]
  createdAt: string
  updatedAt: string
}

// ─── Persisted content schema v2 (저장 JSONB shape) ──────────────
//
// content(JSONB)의 내부 shape만 v1→v2 로 바뀐다. API 봉투({type, importance, content})와
// 엔드포인트는 불변. importance 는 content 밖 최상위 컬럼으로 유지(PATCH /importance, FRT-39).
//
// 핵심: 템플릿 필드는 `fields`(안정키→값 맵)로 값만 저장한다. 어떤 필드가·어떤 순서로·
// 어느 섹션에 있는지는 템플릿 레지스트리에서 결정되므로, 라벨 매칭/재분배가 불필요해져
// 저장순서=화면순서가 구조적으로 보장된다. custom 은 템플릿 밖 사용자 블록이라 순서 있는 배열.

export const SCHEMA_VERSION_V2 = 2 as const

/** custom[] 항목 — FRT-69 은 'field' 만 직렬화. group(FRT-72)/section(FRT-78) 은 구조 정의(중첩 1겹). */
export type CustomEntry =
  | { key: string; entryType: 'field'; type: Exclude<BlockType, 'group'>; label: string; value: BlockValue; required?: boolean; options?: string[] }
  | { key: string; entryType: 'group'; label: string; collapsed?: boolean; children: CustomEntry[] }
  | { key: string; entryType: 'section'; label: string; children: CustomEntry[] }

export interface ExperienceContentV2 {
  schema_version: typeof SCHEMA_VERSION_V2
  template_version: number
  title: string
  summary: string
  status: ExperienceStatus
  tags: string[]
  fields: Record<string, BlockValue>
  custom: CustomEntry[]
  /**
   * 사용자가 숨긴 선택 필드의 안정키 목록 (FRT-190). 옛 레코드엔 없으므로 optional 이며,
   * 로드 시 `parseHiddenKeys` 가 배열·문자열 원소만 통과시킨다.
   */
  hidden?: string[]
}

// ─── Library (replaces Folder) ──────────────────────────────────

export type SortBy = 'updated' | 'period' | 'completion'

export interface LibraryFilter {
  search?: string
  sortBy?: SortBy
  typeIds?: ExperienceTypeId[]
  statuses?: ExperienceStatus[]
  tags?: string[]
}

export interface Library {
  id: string
  name: string
  color?: string
  icon?: string
  isSystem: boolean
  experienceIds: string[]
  filter?: LibraryFilter
}

// ─── Preset ─────────────────────────────────────────────────────

export interface Preset {
  id: string
  name: string
  description?: string
  blocks: Block[]
  isFavorite: boolean
  createdAt: string
  updatedAt: string
}

// ─── Legacy types (kept for migration reference, will be removed) ──

/** @deprecated Use Block system instead */
export type CustomFieldType = 'text' | 'textarea' | 'date' | 'file'

/** @deprecated Use Block system instead */
export interface CustomField {
  id: string
  key: string
  label: string
  value: string
  type: CustomFieldType
}
