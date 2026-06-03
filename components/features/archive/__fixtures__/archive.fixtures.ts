/**
 * Domain-scoped fixtures for Archive Storybook stories (FRT-26).
 * Only imported by *.stories.tsx files in this directory — never shared globally.
 */

import type {
  ExperienceV2,
  Library,
  LibraryFilter,
  Block,
  Preset,
  Folder,
  ExperienceWithFolder,
  Template,
  ImportanceLevel,
} from "@/types/archive"
import type { UsePresetsReturn } from "@/hooks/usePresets"

// ─── Blocks ─────────────────────────────────────────────────────────────────

export const textBlock: Block = {
  id: "blk-text-01",
  type: "text",
  label: "경험명",
  placeholder: "예: 네이버 소프트웨어 엔지니어",
  value: { type: "text", text: "네이버 소프트웨어 엔지니어" },
}

export const emptyTextBlock: Block = {
  id: "blk-text-empty",
  type: "text",
  label: "경험명",
  placeholder: "경험명을 입력하세요",
  value: { type: "text", text: "" },
}

export const dateBlock: Block = {
  id: "blk-date-01",
  type: "date",
  label: "시작일",
  value: { type: "date", date: "2024-03-01" },
}

export const emptyDateBlock: Block = {
  id: "blk-date-empty",
  type: "date",
  label: "시작일",
  value: { type: "date", date: "" },
}

export const checklistBlock: Block = {
  id: "blk-checklist-01",
  type: "checklist",
  label: "핵심 역량",
  value: {
    type: "checklist",
    options: ["React", "TypeScript", "Node.js", "AWS"],
    checked: ["React", "TypeScript"],
  },
}

export const emptyChecklistBlock: Block = {
  id: "blk-checklist-empty",
  type: "checklist",
  label: "핵심 역량",
  value: { type: "checklist", options: [], checked: [] },
}

export const tableBlock: Block = {
  id: "blk-table-01",
  type: "table",
  label: "성과 지표",
  value: {
    type: "table",
    columns: ["지표", "Before", "After"],
    rows: [
      ["응답 속도", "800ms", "120ms"],
      ["월 사용자", "5,000명", "28,000명"],
    ],
  },
}

export const emptyTableBlock: Block = {
  id: "blk-table-empty",
  type: "table",
  label: "성과 지표",
  value: { type: "table", columns: [], rows: [] },
}

// ─── ExperienceV2 ────────────────────────────────────────────────────────────

export const careerExperience: ExperienceV2 = {
  id: "exp-career-01",
  userId: "user-story-01",
  typeId: "career",
  title: "네이버 소프트웨어 엔지니어",
  summary: "검색 품질 개선 프로젝트 리드, 응답 속도 85% 단축",
  status: "complete",
  importance: 5 as ImportanceLevel,
  tags: ["백엔드", "Node.js", "검색", "최적화"],
  coreBlocks: [
    {
      id: "core-01",
      type: "text",
      label: "경험명",
      value: { type: "text", text: "네이버 소프트웨어 엔지니어" },
    },
    {
      id: "core-02",
      type: "text",
      label: "한 줄 요약",
      value: { type: "text", text: "검색 품질 개선 프로젝트 리드" },
    },
  ],
  extensionBlocks: [
    {
      id: "ext-01",
      type: "text",
      label: "핵심 성과",
      value: { type: "text", text: "응답 속도 85% 단축, 월 활성 사용자 5.6배 증가" },
    },
    {
      id: "ext-02",
      type: "text",
      label: "내 역할/기여도",
      value: { type: "text", text: "백엔드 아키텍처 설계 및 주요 알고리즘 구현 담당" },
    },
  ],
  customBlocks: [tableBlock],
  createdAt: "2025-01-10T09:00:00.000Z",
  updatedAt: "2025-06-01T14:30:00.000Z",
}

export const draftExperience: ExperienceV2 = {
  id: "exp-draft-01",
  userId: "user-story-01",
  typeId: "personal-project",
  title: "오픈소스 번역 기여",
  summary: "",
  status: "draft",
  importance: 3 as ImportanceLevel,
  tags: ["오픈소스"],
  coreBlocks: [
    {
      id: "core-draft-01",
      type: "text",
      label: "경험명",
      value: { type: "text", text: "오픈소스 번역 기여" },
    },
    {
      id: "core-draft-02",
      type: "text",
      label: "한 줄 요약",
      value: { type: "text", text: "" },
    },
  ],
  extensionBlocks: [],
  customBlocks: [],
  createdAt: "2025-05-20T10:00:00.000Z",
  updatedAt: "2025-05-22T11:00:00.000Z",
}

// ─── Libraries ───────────────────────────────────────────────────────────────

export const systemLibrary: Library = {
  id: "lib-all",
  name: "전체",
  isSystem: true,
  experienceIds: [careerExperience.id, draftExperience.id],
}

export const customLibrary: Library = {
  id: "lib-custom-01",
  name: "취업 준비",
  color: "#3B82F6",
  isSystem: false,
  experienceIds: [careerExperience.id],
}

export const filteredLibrary: Library = {
  id: "lib-filter-01",
  name: "완료된 경험",
  color: "#22C55E",
  isSystem: false,
  experienceIds: [],
  filter: { statuses: ["complete"] },
}

export const sampleLibraries: Library[] = [
  systemLibrary,
  customLibrary,
  filteredLibrary,
]

// ─── LibraryFilter ───────────────────────────────────────────────────────────

export const emptyFilter: LibraryFilter = {}

export const activeFilter: LibraryFilter = {
  search: "네이버",
  sortBy: "updated",
  typeIds: ["career"],
  statuses: ["complete"],
}

// ─── Presets ─────────────────────────────────────────────────────────────────

export const samplePreset: Preset = {
  id: "preset-01",
  name: "기술 역량 블록 세트",
  description: "개발 경험 기록에 유용한 블록들",
  blocks: [checklistBlock],
  isFavorite: true,
  createdAt: "2025-04-01T00:00:00.000Z",
  updatedAt: "2025-05-01T00:00:00.000Z",
}

// ─── UsePresetsReturn mock ────────────────────────────────────────────────────

export const mockPresetsHook: UsePresetsReturn = {
  presets: [samplePreset],
  isLoading: false,
  error: null,
  refetch: async () => {},
  createPreset: async () => {},
  updatePreset: async () => {},
  deletePreset: async () => {},
  duplicatePreset: async () => {},
  getPreset: (id: string) => (id === samplePreset.id ? samplePreset : undefined),
}

export const emptyPresetsHook: UsePresetsReturn = {
  presets: [],
  isLoading: false,
  error: null,
  refetch: async () => {},
  createPreset: async () => {},
  updatePreset: async () => {},
  deletePreset: async () => {},
  duplicatePreset: async () => {},
  getPreset: () => undefined,
}

// ─── Legacy (ArchiveSidebar) fixtures ────────────────────────────────────────

export const systemFolder: Folder = {
  id: "folder-all",
  name: "전체",
  isSystem: true,
}

export const customFolder: Folder = {
  id: "folder-custom-01",
  name: "서류 준비",
  isSystem: false,
}

export const sampleFolders: Folder[] = [systemFolder, customFolder]

export const legacyTemplate: Template = {
  id: "tmpl-career",
  user_id: "system",
  label: "경력",
  is_system: true,
  field_schema: [
    { key: "company", label: "회사명", type: "text", required: true },
    { key: "role", label: "직책", type: "text" },
    { key: "period", label: "재직 기간", type: "period" },
  ],
}

export const sampleTemplates: Template[] = [legacyTemplate]

export const legacyExperience: ExperienceWithFolder = {
  id: "legacy-exp-01",
  user_id: "user-story-01",
  templates_id: "tmpl-career",
  raw_text: [
    { key: "company", label: "회사명", value: "네이버" },
    { key: "role", label: "직책", value: "소프트웨어 엔지니어" },
    { key: "period", label: "재직 기간", value: "2022.07 ~ 재직 중" },
  ],
  created_at: "2025-01-10T09:00:00.000Z",
  updated_at: "2025-06-01T14:30:00.000Z",
  folderId: "folder-custom-01",
}

export const sampleLegacyExperiences: ExperienceWithFolder[] = [legacyExperience]
