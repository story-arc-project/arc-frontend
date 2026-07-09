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
}

export interface BlockRow {
  id: string
  cells: Record<string, string | string[]>
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
  value: BlockValue
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
