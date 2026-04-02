import type { Template, RawTextField } from '@/types/archive'

/** Templates whose field_schema includes motivation + takeaway keys */
export const QUALITATIVE_KEYS = ['motivation', 'takeaway'] as const

/** Template labels that show the QualitativeSection */
export const QUALITATIVE_TEMPLATE_LABELS = ['경력', '인턴/대외활동/프로젝트', '수상']

export function isQualitativeTemplate(templateLabel: string): boolean {
  return QUALITATIVE_TEMPLATE_LABELS.includes(templateLabel)
}

export function isQualitativeKey(key: string): boolean {
  return (QUALITATIVE_KEYS as readonly string[]).includes(key)
}

/** Build qualitative RawTextField entries from motivation/takeaway values */
export function buildQualitativeFields(
  motivation: string,
  takeaway: string,
): RawTextField[] {
  return [
    { key: 'motivation', label: '왜 이 활동을 했나요?', value: motivation },
    { key: 'takeaway', label: '무엇을 배웠나요?', value: takeaway },
  ]
}

/** Derive title for sidebar display from raw_text */
export function getExperienceTitle(rawText: RawTextField[]): string {
  return (
    rawText.find(
      f => f.value && !isQualitativeKey(f.key) && f.key !== 'description'
    )?.value ?? '(제목 없음)'
  )
}

/** Derive period string for sidebar display from raw_text */
export function getExperiencePeriod(rawText: RawTextField[]): string | undefined {
  return rawText.find(f => f.key === 'period' && f.value)?.value
}

/** System templates — fallback when API is unavailable (DB is seeded with these) */
export const SYSTEM_TEMPLATES: Template[] = [
  {
    id: 'sys-education',
    user_id: 'system',
    label: '학력',
    is_system: true,
    field_schema: [
      { key: 'school', label: '학교명', type: 'text', required: true, placeholder: '○○대학교' },
      { key: 'major', label: '전공', type: 'text', placeholder: '컴퓨터공학과' },
      { key: 'period', label: '재학 기간', type: 'period' },
      {
        key: 'graduation_status',
        label: '졸업 여부',
        type: 'select',
        options: ['재학중', '졸업', '휴학중', '졸업예정'],
      },
      { key: 'gpa', label: '학점', type: 'text', placeholder: '4.0 / 4.5' },
    ],
  },
  {
    id: 'sys-career',
    user_id: 'system',
    label: '경력',
    is_system: true,
    field_schema: [
      { key: 'company', label: '회사명', type: 'text', required: true },
      { key: 'role', label: '직무/직책', type: 'text', placeholder: '프론트엔드 개발자' },
      { key: 'period', label: '근무 기간', type: 'period' },
      { key: 'description', label: '주요 업무', type: 'textarea', placeholder: '담당한 주요 업무를 입력하세요' },
      {
        key: 'motivation',
        label: '왜 이 활동을 했나요?',
        type: 'textarea',
        placeholder: '처음엔 그냥 스펙 쌓으려고 지원했는데...',
      },
      {
        key: 'takeaway',
        label: '무엇을 배웠나요?',
        type: 'textarea',
        placeholder: '팀으로 일한다는 게 어떤 건지 처음 느꼈어요.',
      },
    ],
  },
  {
    id: 'sys-activity',
    user_id: 'system',
    label: '인턴/대외활동/프로젝트',
    is_system: true,
    field_schema: [
      { key: 'name', label: '활동명', type: 'text', required: true },
      { key: 'organization', label: '기관/단체명', type: 'text' },
      { key: 'period', label: '활동 기간', type: 'period' },
      { key: 'role', label: '역할', type: 'text' },
      { key: 'description', label: '활동 내용', type: 'textarea' },
      {
        key: 'motivation',
        label: '왜 이 활동을 했나요?',
        type: 'textarea',
        placeholder: '처음엔 그냥 스펙 쌓으려고 지원했는데...',
      },
      {
        key: 'takeaway',
        label: '무엇을 배웠나요?',
        type: 'textarea',
        placeholder: '팀으로 일한다는 게 어떤 건지 처음 느꼈어요.',
      },
    ],
  },
  {
    id: 'sys-award',
    user_id: 'system',
    label: '수상',
    is_system: true,
    field_schema: [
      { key: 'name', label: '수상명', type: 'text', required: true },
      { key: 'organization', label: '수여 기관', type: 'text' },
      { key: 'year', label: '수상 연도', type: 'text', placeholder: '2024' },
      { key: 'description', label: '수상 내용 요약', type: 'textarea' },
      {
        key: 'motivation',
        label: '왜 이 활동을 했나요?',
        type: 'textarea',
        placeholder: '처음엔 그냥 스펙 쌓으려고 지원했는데...',
      },
      {
        key: 'takeaway',
        label: '무엇을 배웠나요?',
        type: 'textarea',
        placeholder: '팀으로 일한다는 게 어떤 건지 처음 느꼈어요.',
      },
    ],
  },
  {
    id: 'sys-cert',
    user_id: 'system',
    label: '자격증',
    is_system: true,
    field_schema: [
      { key: 'name', label: '자격증명', type: 'text', required: true },
      { key: 'issuer', label: '발급 기관', type: 'text' },
      { key: 'date', label: '취득일', type: 'text', placeholder: '2024.03' },
      { key: 'number', label: '자격증 번호', type: 'text', placeholder: '선택 사항' },
    ],
  },
  {
    id: 'sys-language',
    user_id: 'system',
    label: '어학',
    is_system: true,
    field_schema: [
      { key: 'language', label: '언어', type: 'text', required: true, placeholder: '영어' },
      { key: 'exam', label: '시험명', type: 'text', placeholder: 'TOEIC' },
      { key: 'score', label: '점수/등급', type: 'text', placeholder: '950' },
      { key: 'date', label: '취득일', type: 'text', placeholder: '2024.03' },
    ],
  },
  {
    id: 'sys-skill',
    user_id: 'system',
    label: '보유기술',
    is_system: true,
    field_schema: [
      { key: 'skill_name', label: '기술명', type: 'text', required: true, placeholder: 'React' },
      {
        key: 'level',
        label: '숙련도',
        type: 'select',
        options: ['입문', '초급', '중급', '고급'],
      },
      { key: 'description', label: '설명', type: 'textarea', placeholder: '이 기술을 어떻게 활용했는지 설명해주세요' },
    ],
  },
  {
    id: 'sys-intro',
    user_id: 'system',
    label: '소개',
    is_system: true,
    field_schema: [
      { key: 'headline', label: '한줄 소개', type: 'text', required: true, placeholder: '성장을 즐기는 프론트엔드 개발자' },
      { key: 'bio', label: '자기소개', type: 'textarea', placeholder: '자신을 자유롭게 소개해주세요' },
    ],
  },
]
