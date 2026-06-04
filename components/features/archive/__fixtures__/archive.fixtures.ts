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

// ─── Remaining block fixtures ────────────────────────────────────────────────

export const textareaBlock: Block = {
  id: "blk-textarea-01",
  type: "textarea",
  label: "경험 상세 설명",
  placeholder: "경험에 대해 자세히 적어주세요",
  value: { type: "textarea", text: "검색 품질 개선 프로젝트를 리드하며 응답 속도를 85% 단축했습니다.\n팀원 5명과 협업하며 백엔드 아키텍처를 개선했습니다." },
}

export const emptyTextareaBlock: Block = {
  id: "blk-textarea-empty",
  type: "textarea",
  label: "경험 상세 설명",
  placeholder: "경험에 대해 자세히 적어주세요",
  value: { type: "textarea", text: "" },
}

export const periodBlock: Block = {
  id: "blk-period-01",
  type: "period",
  label: "재직 기간",
  value: { type: "period", start: "2022-07", end: "", isCurrent: true },
}

export const periodBlockFinished: Block = {
  id: "blk-period-02",
  type: "period",
  label: "재직 기간",
  value: { type: "period", start: "2020-03", end: "2022-06", isCurrent: false },
}

export const emptyPeriodBlock: Block = {
  id: "blk-period-empty",
  type: "period",
  label: "재직 기간",
  value: { type: "period", start: "", end: "", isCurrent: false },
}

export const singleSelectBlock: Block = {
  id: "blk-single-select-01",
  type: "single-select",
  label: "고용 형태",
  value: { type: "single-select", options: ["정규직", "계약직", "인턴", "프리랜서"], selected: "정규직" },
}

export const emptySingleSelectBlock: Block = {
  id: "blk-single-select-empty",
  type: "single-select",
  label: "고용 형태",
  value: { type: "single-select", options: ["정규직", "계약직", "인턴", "프리랜서"], selected: "" },
}

export const tagsBlock: Block = {
  id: "blk-tags-01",
  type: "tags",
  label: "기술 스택",
  value: { type: "tags", tags: ["React", "TypeScript", "Node.js", "AWS"] },
}

export const emptyTagsBlock: Block = {
  id: "blk-tags-empty",
  type: "tags",
  label: "기술 스택",
  value: { type: "tags", tags: [] },
}

export const linkBlock: Block = {
  id: "blk-link-01",
  type: "link",
  label: "관련 링크",
  value: {
    type: "link",
    url: "https://github.com/example/project",
    title: "GitHub 레포지토리",
    description: "검색 품질 개선 프로젝트 소스 코드",
    linkType: "GitHub",
  },
}

export const emptyLinkBlock: Block = {
  id: "blk-link-empty",
  type: "link",
  label: "관련 링크",
  value: { type: "link", url: "", title: "", description: "", linkType: "" },
}

export const fileBlock: Block = {
  id: "blk-file-01",
  type: "file",
  label: "첨부 파일",
  // No `fileId`: FileBlock's effect calls getFileUrl(fileId) regardless of
  // readOnly, which would hit the backend and 401→redirect inside Storybook.
  // The rich file preview (which needs a fileId) is covered by the dedicated
  // ImagePreview/PdfCard/etc. stories; here we show the readOnly filename row.
  value: {
    type: "file",
    fileName: "성과_보고서.pdf",
    description: "2023년 4분기 성과 보고서",
    evidenceType: "보고서",
  },
}

export const emptyFileBlock: Block = {
  id: "blk-file-empty",
  type: "file",
  label: "첨부 파일",
  value: { type: "file", fileName: "", description: "", evidenceType: "" },
}

// ─── File preview fixtures ────────────────────────────────────────────────────

// 1×1 transparent PNG data-URI for visual testing without real network requests
export const sampleImageDataUri =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

export interface SampleFileInfo {
  name: string
  size: number
  url: string
  mimeType: string
}

export const sampleImageFile: SampleFileInfo = {
  name: "프로젝트_스크린샷.png",
  size: 204800,
  url: sampleImageDataUri,
  mimeType: "image/png",
}

export const sampleAudioFile: SampleFileInfo = {
  name: "발표_녹음.mp3",
  size: 3145728,
  url: "https://example.com/sample-audio.mp3",
  mimeType: "audio/mpeg",
}

export const sampleVideoFile: SampleFileInfo = {
  name: "데모_영상.mp4",
  size: 10485760,
  url: "https://example.com/sample-video.mp4",
  mimeType: "video/mp4",
}

export const samplePdfFile: SampleFileInfo = {
  name: "성과_보고서.pdf",
  size: 1048576,
  url: "https://example.com/sample.pdf",
  mimeType: "application/pdf",
}

export const sampleGenericFile: SampleFileInfo = {
  name: "프로젝트_자료.zip",
  size: 5242880,
  url: "https://example.com/sample.zip",
  mimeType: "application/zip",
}
