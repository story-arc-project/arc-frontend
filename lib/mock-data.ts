import type { ExperienceV2, Library, Preset, Folder, ExperienceWithFolder } from '@/types/archive'
import { createTextField, createTextareaField, createPeriodField, uid } from '@/lib/block-utils'

// ─── V2 Mock Data ───────────────────────────────────────────────

export const MOCK_LIBRARIES: Library[] = [
  {
    id: 'lib-all',
    name: '전체',
    isSystem: true,
    experienceIds: [],
  },
  {
    id: 'lib-dev',
    name: '개발 관련',
    color: '#6366f1',
    isSystem: false,
    experienceIds: ['exp-v2-1', 'exp-v2-3'],
  },
  {
    id: 'lib-draft',
    name: '작성 중',
    color: '#f59e0b',
    isSystem: true,
    experienceIds: ['exp-v2-2', 'exp-v2-3'],
  },
]

export const MOCK_EXPERIENCES_V2: ExperienceV2[] = [
  {
    id: 'exp-v2-1',
    userId: 'mock',
    typeId: 'career',
    title: '카카오 프론트엔드 인턴',
    summary: '웹 서비스 개발 및 유지보수를 담당한 6개월 인턴 경험',
    status: 'complete',
    tags: ['프론트엔드', 'React', '인턴'],
    coreBlocks: [
      { ...createTextField('경험명', { required: true }), id: 'cb-1', value: { type: 'text', text: '카카오 프론트엔드 인턴' } },
      { ...createPeriodField('기간', { required: true }), id: 'cb-2', value: { type: 'period', start: '2023-03', end: '2024-02', isCurrent: false } },
      { ...createTextField('한 줄 요약'), id: 'cb-3', value: { type: 'text', text: '웹 서비스 개발 및 유지보수를 담당한 6개월 인턴 경험' } },
      { ...createTextareaField('내 역할/기여도'), id: 'cb-4', value: { type: 'textarea', text: '프론트엔드 개발자로서 신규 기능 개발과 코드 리뷰 참여' } },
      { ...createTextareaField('핵심 성과'), id: 'cb-5', value: { type: 'textarea', text: '주요 페이지 성능 40% 개선' } },
    ],
    extensionBlocks: [
      { ...createTextField('회사명', { required: true }), id: 'eb-1', value: { type: 'text', text: '카카오' } },
      { ...createTextField('직책/직급'), id: 'eb-2', value: { type: 'text', text: '프론트엔드 인턴' } },
      { ...createTextField('직무(업무분야)'), id: 'eb-3', value: { type: 'text', text: '프론트엔드 개발' } },
    ],
    customBlocks: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z',
  },
  {
    id: 'exp-v2-2',
    userId: 'mock',
    typeId: 'extracurricular',
    title: '멋쟁이사자처럼 12기',
    summary: '프론트엔드 트랙에서 웹 개발을 배우고 팀 프로젝트 수행',
    status: 'draft',
    tags: ['대외활동', '웹개발'],
    coreBlocks: [
      { ...createTextField('경험명', { required: true }), id: 'cb-6', value: { type: 'text', text: '멋쟁이사자처럼 12기' } },
      { ...createPeriodField('기간', { required: true }), id: 'cb-7', value: { type: 'period', start: '2023-03', end: '2023-11', isCurrent: false } },
      { ...createTextField('한 줄 요약'), id: 'cb-8', value: { type: 'text', text: '프론트엔드 트랙에서 웹 개발을 배우고 팀 프로젝트 수행' } },
    ],
    extensionBlocks: [
      { ...createTextField('활동명', { required: true }), id: 'eb-4', value: { type: 'text', text: '멋쟁이사자처럼 12기' } },
      { ...createTextField('주최/기관명'), id: 'eb-5', value: { type: 'text', text: '멋쟁이사자처럼' } },
      { ...createTextField('직책/역할', { required: true }), id: 'eb-6', value: { type: 'text', text: '프론트엔드 트랙' } },
    ],
    customBlocks: [],
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'exp-v2-3',
    userId: 'mock',
    typeId: 'personal-project',
    title: 'ARC 포트폴리오 서비스',
    summary: 'AI 기반 포트폴리오 아카이빙 웹앱 개발',
    status: 'draft',
    tags: ['Next.js', 'TypeScript', 'AI'],
    coreBlocks: [
      { ...createTextField('경험명', { required: true }), id: 'cb-9', value: { type: 'text', text: 'ARC 포트폴리오 서비스' } },
      { ...createPeriodField('기간', { required: true }), id: 'cb-10', value: { type: 'period', start: '2026-03', end: '', isCurrent: true } },
      { ...createTextField('한 줄 요약'), id: 'cb-11', value: { type: 'text', text: 'AI 기반 포트폴리오 아카이빙 웹앱 개발' } },
    ],
    extensionBlocks: [],
    customBlocks: [],
    createdAt: '2026-03-15T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'exp-v2-4',
    userId: 'mock',
    typeId: 'award',
    title: '교내 해커톤 최우수상',
    summary: '24시간 해커톤에서 AI 기반 학습 플래너 개발로 최우수상 수상',
    status: 'complete',
    tags: ['수상', '해커톤', 'AI'],
    coreBlocks: [
      { ...createTextField('경험명', { required: true }), id: 'cb-12', value: { type: 'text', text: '교내 해커톤 최우수상' } },
      { ...createPeriodField('기간'), id: 'cb-13', value: { type: 'period', start: '2025-11', end: '2025-11', isCurrent: false } },
      { ...createTextField('한 줄 요약'), id: 'cb-14', value: { type: 'text', text: '24시간 해커톤에서 AI 기반 학습 플래너 개발로 최우수상 수상' } },
    ],
    extensionBlocks: [],
    customBlocks: [],
    createdAt: '2025-11-20T00:00:00Z',
    updatedAt: '2025-12-01T00:00:00Z',
  },
]

export const MOCK_PRESETS: Preset[] = [
  {
    id: 'preset-1',
    name: '성과 기록 셀',
    description: '성과 유형/수치/설명을 반복 입력할 수 있는 블록',
    recommendedTypeIds: ['extracurricular', 'career', 'team-project'],
    blocks: [
      {
        id: uid('preset-blk'),
        type: 'repeatable-cell',
        label: '성과 기록',
        value: {
          type: 'repeatable-cell',
          columns: [
            { key: 'type', label: '성과 유형', blockType: 'text' },
            { key: 'metric', label: '수치', blockType: 'text' },
            { key: 'description', label: '설명', blockType: 'textarea' },
          ],
          rows: [],
        },
      },
    ],
    isFavorite: true,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
]

// ─── Legacy Mock Data (for backward compatibility) ──────────────

export const MOCK_FOLDERS: Folder[] = [
  { id: 'unclassified', name: '미분류', isSystem: true },
  { id: 'folder-dev', name: '개발 관련', isSystem: false },
]

export const MOCK_EXPERIENCES: ExperienceWithFolder[] = [
  {
    id: 'exp-1',
    user_id: 'mock',
    templates_id: 'sys-career',
    folderId: 'folder-dev',
    raw_text: [
      { key: 'company', label: '회사명', value: '카카오' },
      { key: 'role', label: '직무/직책', value: '프론트엔드 개발자' },
      { key: 'period', label: '근무 기간', value: '2023.03 ~ 2024.02' },
      { key: 'description', label: '주요 업무', value: '웹 서비스 개발 및 유지보수' },
      { key: 'motivation', label: '왜 이 활동을 했나요?', value: '' },
      { key: 'takeaway', label: '무엇을 배웠나요?', value: '' },
    ],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
  },
  {
    id: 'exp-2',
    user_id: 'mock',
    templates_id: 'sys-activity',
    folderId: 'unclassified',
    raw_text: [
      { key: 'name', label: '활동명', value: '멋쟁이사자처럼 12기' },
      { key: 'organization', label: '기관/단체명', value: '멋쟁이사자처럼' },
      { key: 'period', label: '활동 기간', value: '2023.03 ~ 2023.11' },
      { key: 'role', label: '역할', value: '프론트엔드 트랙' },
      { key: 'description', label: '활동 내용', value: '' },
      { key: 'motivation', label: '왜 이 활동을 했나요?', value: '' },
      { key: 'takeaway', label: '무엇을 배웠나요?', value: '' },
    ],
    created_at: '2024-02-01T00:00:00Z',
    updated_at: '2024-02-01T00:00:00Z',
  },
]
