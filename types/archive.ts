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
}

export interface BlockColumnDef {
  key: string
  label: string
  blockType: Exclude<BlockType, 'repeatable-cell' | 'table'>
  required?: boolean
  placeholder?: string
  options?: string[]
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

export interface Block {
  id: string
  type: BlockType
  label: string
  required?: boolean
  collapsed?: boolean
  placeholder?: string
  options?: string[]
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

// ─── Templates ──────────────────────────────────────────────────

export interface TemplateSection {
  id: string
  label: string
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
  recommendedTypeIds?: ExperienceTypeId[]
  blocks: Block[]
  isFavorite: boolean
  createdAt: string
  updatedAt: string
}

// ─── Library API DTOs ───────────────────────────────────────────

export interface LibraryFilterDTO {
  search?: string
  sortBy?: SortBy
  types?: string[]
  statuses?: string[]
  tags?: string[]
}

export interface LibraryDTO {
  id: string
  name: string
  color?: string
  icon?: string
  is_system: boolean
  filter?: LibraryFilterDTO
}

export interface CreateLibraryPayload {
  name: string
  color?: string
  icon?: string
  is_system?: boolean
  filter?: LibraryFilterDTO
}

export interface UpdateLibraryPayload {
  name?: string
  color?: string
  icon?: string
  filter?: LibraryFilterDTO
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
