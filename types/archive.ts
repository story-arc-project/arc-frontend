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
   *
   * ⚠️ 블록 층위의 `variant` 와 달리 이건 `RepeatableCellBlockValue.columns` 안에 있어
   * **value(JSONB)에 함께 저장된다** — 저장된 레코드를 다시 열면 템플릿이 아니라 저장값의
   * columns 가 채택되므로(`injectValue`), 값을 읽는 쪽은 columns 에 `variant` 키가 실릴 수
   * 있음을 전제해야 한다. 렌더 힌트일 뿐이라 무시해도 무해하다.
   */
  variant?: 'role-chip'
}

export interface BlockRow {
  id: string
  cells: Record<string, string | string[]>
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
}

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
   * 템플릿 정의에만 존재하며 value(JSONB)에는 직렬화되지 않는다 — 로드 시 레지스트리에서 재공급된다.
   */
  variant?: 'outcome-list' | 'mood-tag' | 'role-history'
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
  value: BlockValue
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

export interface ExperienceTypeInfo {
  id: ExperienceTypeId
  label: string
  icon: string
  category: 'academic' | 'career' | 'project' | 'personal'
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
  'career': { repeat: '프로젝트 / 담당 업무 기록' },
  'club': { detail: '활동 상세', repeat: '활동 / 이벤트 기록' },
  'education': { detail: '수업 상세', repeat: '프로젝트 / 과제 / 제작물 기록' },
  'extracurricular': { detail: '활동 상세', repeat: '미션 / 프로젝트 기록' },
}

/**
 * 유형별 섹션(카드) 안내 문구 오버라이드 (FRT-177). 카드 제목 아래 회색 설명 문단으로 렌더된다.
 * 미지정 유형·카테고리는 폼의 기본 문구(detail 카드의 "선택 입력이에요…")로 폴백한다.
 * 라벨 오버라이드와 마찬가지로 표시 전용이라 안정키·저장 shape 와 무관하다.
 */
export const SECTION_DESCRIPTION_OVERRIDES: Partial<
  Record<ExperienceTypeId, Partial<Record<SectionCategory, string>>>
> = {
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
}

// ─── Templates ──────────────────────────────────────────────────

export interface TemplateSection {
  id: string
  label: string
  /** 입력 폼 4섹션 분류 (FRT-70). 섹션 블록은 기본적으로 이 category 로 묶인다. */
  category: SectionCategory
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

/** @deprecated Use Block with type 'text' instead */
export interface RawTextField {
  key: string
  label: string
  value: string
}

/** @deprecated Use TemplateV2 instead */
export interface TemplateField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'period' | 'select'
  required?: boolean
  options?: string[]
  placeholder?: string
}

/** @deprecated Use TemplateV2 instead */
export interface Template {
  id: string
  user_id: string
  label: string
  field_schema: TemplateField[]
  is_system?: boolean
}

/** @deprecated Use ExperienceV2 instead */
export interface Experience {
  id: string
  user_id: string
  templates_id: string
  raw_text: RawTextField[]
  created_at: string
  updated_at: string
}

/** @deprecated Use ExperienceV2 instead */
export interface ExperienceWithFolder extends Experience {
  folderId: string
}

/** @deprecated Use Library instead */
export interface Folder {
  id: string
  name: string
  isSystem: boolean
}

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
