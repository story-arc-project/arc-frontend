import { Briefcase, Rocket, Trophy } from 'lucide-react'

/**
 * 랜딩 체험 섹션의 유형별 입력 정의 (FRT-339).
 *
 * 실제 제품 템플릿(`lib/constants/templates-v2.ts`)을 **재사용하지 않는다.** 그쪽은 3천 줄
 * 상수 + 폼 엔진이라 랜딩 번들로 딸려 들어오고, 랜딩은 기록을 저장하지도 않는다. 대신 확정본의
 * 라벨·가이드 문구를 그대로 옮겨 적은 축약본을 둔다 — 체험에서 본 질문이 가입 후 실제로
 * 나오는 질문이어야 하기 때문이다. 확정본 문구가 바뀌면 이 파일도 손으로 맞춘다.
 *
 * 유형은 셋만 둔다. 랜딩 체험은 데모가 아니라 맛보기고, 유형을 늘리는 것보다 **유형마다
 * 입력 포맷이 통째로 달라지는 것**이 우리 특장점이다.
 */

export type DemoTypeId = 'internship' | 'project' | 'award'

export type DemoFieldFormat =
  | 'text'
  | 'textarea'
  | 'period'
  | 'date'
  | 'select'
  | 'tags'
  | 'rows'

export interface DemoRowColumn {
  key: string
  label: string
  placeholder: string
}

export interface DemoFieldDef {
  key: string
  label: string
  format: DemoFieldFormat
  /** 라벨과 입력칸 사이 안내문. 실제 폼과 같은 자리에 같은 문구를 둔다. */
  guide: string
  placeholder?: string
  options?: readonly string[]
  columns?: readonly DemoRowColumn[]
  /** '＋ 더 자세히 묻기'로 접어 두는 필드. 펼치는 행위 자체가 우리가 묻는 깊이를 보여준다. */
  advanced?: boolean
}

export interface DemoTypeDef {
  id: DemoTypeId
  label: string
  icon: typeof Briefcase
  tone: string
  titleKey: string
  summaryKey: string
  fields: DemoFieldDef[]
}

export interface DemoPeriod {
  start: string
  end: string
}

export interface DemoRow {
  id: string
  cells: Record<string, string>
}

export type DemoFieldValue = string | string[] | DemoPeriod | DemoRow[]

/** 편집 중인 값. **유형을 가로질러 하나만 둔다** — 아래 `DEMO_TYPES` 주석 참고. */
export type DemoDraft = Record<string, DemoFieldValue>

export interface DemoExperience {
  id: string
  typeId: DemoTypeId
  values: DemoDraft
}

/**
 * 유형 정의.
 *
 * ⚠️ 키는 **유형을 가로질러 공유된다**(`title`·`period`). 칩을 바꿔도 draft 를 비우지 않기
 * 때문이다 — 잘못 눌렀다 되돌리면 적던 값이 살아있는 쪽이 안 놀랍다. 그래서 같은 키를 두
 * 유형이 쓰면 포맷도 같아야 한다(`landing-demo-fields.test.ts` 가 강제한다). 저장 시점에
 * `collectValues` 가 현재 유형의 키만 골라 담으므로, 남은 값이 카드로 따라가지는 않는다.
 */
export const DEMO_TYPES: DemoTypeDef[] = [
  {
    id: 'internship',
    label: '인턴십',
    icon: Briefcase,
    tone: 'bg-surface-brand text-brand-dark',
    titleKey: 'title',
    summaryKey: 'careerOutcome',
    fields: [
      {
        key: 'title',
        label: '회사 / 직무',
        format: 'text',
        guide: '어디서 어떤 일을 했는지 적어주세요.',
        placeholder: '예: OO주식회사 브랜드 마케팅 인턴',
      },
      {
        key: 'period',
        label: '근무 기간',
        format: 'period',
        guide: '근무를 시작하고 종료한 시점을 선택해주세요. 아직 다니는 중이면 종료는 비워두세요.',
      },
      {
        key: 'careerWorkType',
        label: '근무 형태',
        format: 'select',
        guide: '근무 형태를 선택해주세요.',
        options: ['풀타임', '파트타임', '원격', '하이브리드'],
      },
      {
        key: 'careerOutcome',
        label: '나의 담당 업무 / 주요 성과',
        format: 'textarea',
        guide: '내가 담당했던 업무나 개인적으로 이룬 성과를 적어주세요.',
        placeholder: '예: 신제품 런칭 SNS 캠페인을 운영해 팔로워를 2배로 늘렸어요',
      },
      {
        key: 'careerStack',
        label: '사용한 스킬 / 툴 / 기술',
        format: 'tags',
        guide: '인턴 기간 동안 실제로 배우거나 사용한 툴, 언어, 기술을 태그로 추가해주세요.',
        placeholder: '예: Figma',
        advanced: true,
      },
      {
        key: 'careerGrowth',
        label: '성장 / 변화',
        format: 'textarea',
        guide: '이 인턴 경험을 통해 개선되거나 나아진 부분이 있나요?',
        placeholder: '예: 회의 내용을 문서로 정리하는 습관이 생겼습니다',
        advanced: true,
      },
    ],
  },
  {
    id: 'project',
    label: '프로젝트',
    icon: Rocket,
    tone: 'bg-surface-success text-success',
    titleKey: 'title',
    summaryKey: 'projectOutcome',
    fields: [
      {
        key: 'title',
        label: '프로젝트명',
        format: 'text',
        guide: '이 프로젝트의 이름을 적어주세요.',
        placeholder: '예: 캠퍼스 중고거래 앱 개발',
      },
      {
        key: 'period',
        label: '진행 기간',
        format: 'period',
        guide: '프로젝트를 시작하고 마무리한 시점을 선택해주세요.',
      },
      {
        key: 'projectOutcome',
        label: '핵심 성과',
        format: 'textarea',
        guide:
          '이 프로젝트로 만들어낸 결과나 임팩트를 적어주세요. 수치, 반응, 채택 여부 등 무엇이든 괜찮아요.',
        placeholder: '예: 베타 출시 2주 만에 DAU 150명 달성',
      },
      {
        key: 'projectTasks',
        label: '세부 작업',
        format: 'rows',
        guide: '프로젝트 안에서 내가 한 일을 작업 단위로 나눠 적어보세요. 줄을 늘릴 수 있어요.',
        columns: [
          { key: 'task', label: '작업', placeholder: '예: 사용자 인터뷰' },
          { key: 'role', label: '내 역할', placeholder: '예: 설계·진행' },
        ],
      },
      {
        key: 'projectCollab',
        label: '개인 / 팀',
        format: 'select',
        guide: '혼자 한 프로젝트인지 팀으로 한 프로젝트인지 선택해주세요.',
        options: ['개인 프로젝트', '팀 프로젝트(2~5명)', '팀 프로젝트(6명 이상)'],
        advanced: true,
      },
      {
        key: 'projectStack',
        label: '사용 기술 / 툴',
        format: 'tags',
        guide: '이 프로젝트에서 사용한 기술 스택, 툴, 언어를 태그로 추가해주세요.',
        placeholder: '예: React',
        advanced: true,
      },
    ],
  },
  {
    id: 'award',
    label: '공모전·수상',
    icon: Trophy,
    tone: 'bg-surface-warning text-warning',
    titleKey: 'title',
    summaryKey: 'awardBackground',
    fields: [
      {
        key: 'title',
        label: '대회 / 프로그램명',
        format: 'text',
        guide: '이 상을 받은 대회나 프로그램의 이름을 적어주세요.',
        placeholder: '예: 2024 전국 대학생 창업 경진대회',
      },
      {
        key: 'awardGrade',
        label: '수상 훈격',
        format: 'text',
        guide: '받은 상의 등급이나 이름을 적어주세요.',
        placeholder: '예: 대상, 우수상, 최우수 논문상',
      },
      {
        key: 'awardedAt',
        label: '수상일',
        format: 'date',
        guide: '수상한 날짜를 선택해주세요.',
      },
      {
        key: 'awardBackground',
        label: '수상 내용 / 배경',
        format: 'textarea',
        guide: '어떤 프로젝트나 활동으로 수상했는지, 무엇이 인정받았는지 적어주세요.',
        placeholder: '예: 지역 소상공인 대상 AI 챗봇 아이디어로 수상했어요',
      },
      {
        key: 'awardType',
        label: '대회 유형',
        format: 'select',
        guide: '이 상의 성격을 선택해주세요.',
        options: [
          '공모전/경진대회',
          '학술상/논문상',
          '장학상',
          '성적 우수상(학기별 우수 등)',
          '대외 활동 시상',
          '기타',
        ],
        advanced: true,
      },
      {
        key: 'awardScale',
        label: '참가 규모 / 경쟁률',
        format: 'text',
        guide:
          '총 참가자 수, 본선 진출 팀 수, 내가 받은 등수까지 함께 적으면 상의 무게가 명확히 전달돼요.',
        placeholder: '예: 총 300팀 참가 중 1위',
        advanced: true,
      },
    ],
  },
]

export const DEMO_TYPE_MAP: Record<DemoTypeId, DemoTypeDef> = Object.fromEntries(
  DEMO_TYPES.map(t => [t.id, t])
) as Record<DemoTypeId, DemoTypeDef>

/** 표 필드의 첫 행 id. 서버·클라이언트가 같은 값을 만들어야 하므로 난수를 쓰지 않는다. */
function seedRowId(fieldKey: string) {
  return `${fieldKey}-1`
}

export function createEmptyValue(field: DemoFieldDef): DemoFieldValue {
  switch (field.format) {
    case 'tags':
      return []
    case 'period':
      return { start: '', end: '' }
    case 'rows':
      return [
        {
          id: seedRowId(field.key),
          cells: Object.fromEntries((field.columns ?? []).map(c => [c.key, ''])),
        },
      ]
    default:
      return ''
  }
}

/** 모든 유형의 모든 필드를 빈 값으로 채운 draft. 입력칸이 제어 컴포넌트라 미리 자리를 만든다. */
export function createEmptyDraft(): DemoDraft {
  const draft: DemoDraft = {}
  for (const type of DEMO_TYPES) {
    for (const field of type.fields) {
      if (!(field.key in draft)) draft[field.key] = createEmptyValue(field)
    }
  }
  return draft
}

export function isFieldFilled(format: DemoFieldFormat, value: DemoFieldValue | undefined): boolean {
  if (value === undefined) return false
  switch (format) {
    case 'tags':
      return Array.isArray(value) && value.length > 0
    case 'period':
      return typeof value === 'object' && !Array.isArray(value) && value.start.trim().length > 0
    case 'rows':
      return (
        Array.isArray(value) &&
        value.some(row => typeof row === 'object' && 'cells' in row
          ? Object.values(row.cells).some(cell => cell.trim().length > 0)
          : false)
      )
    default:
      return typeof value === 'string' && value.trim().length > 0
  }
}

/** 제목과 요약이 있어야 카드가 성립한다 — 나머지는 전부 선택이다(입력 허들 최소화). */
export function canAddExperience(typeId: DemoTypeId, draft: DemoDraft): boolean {
  const type = DEMO_TYPE_MAP[typeId]
  return [type.titleKey, type.summaryKey].every(key => {
    const field = type.fields.find(f => f.key === key)
    return field ? isFieldFilled(field.format, draft[key]) : false
  })
}

/** 현재 유형이 정의한 키 중 **채워진 것만** 담는다. 전환하며 남은 값은 따라오지 않는다. */
export function collectValues(typeId: DemoTypeId, draft: DemoDraft): DemoDraft {
  const values: DemoDraft = {}
  for (const field of DEMO_TYPE_MAP[typeId].fields) {
    const value = draft[field.key]
    if (isFieldFilled(field.format, value)) values[field.key] = value as DemoFieldValue
  }
  return values
}

/**
 * 분석이 읽을 한 덩어리 텍스트. 태그·표의 셀까지 편다 —
 * 유형 전용 필드를 빼면 "입력해도 분석이 안 바뀐다"가 한 층 아래에서 재발한다.
 * 기간·날짜는 뺀다: 연도 숫자가 키워드 판정을 흔들 뿐 의미를 더하지 않는다.
 */
export function flattenDraftText(values: DemoDraft): string {
  const parts: string[] = []
  for (const value of Object.values(values)) {
    if (typeof value === 'string') parts.push(value)
    else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') parts.push(item)
        else parts.push(...Object.values(item.cells))
      }
    }
    // period(객체)는 건너뛴다.
  }
  return parts
    .map(p => p.trim())
    .filter(Boolean)
    .join(' ')
}

export function formatPeriod(period: DemoPeriod): string {
  const start = period.start.trim()
  if (!start) return ''
  const end = period.end.trim()
  return `${toDotted(start)} — ${end ? toDotted(end) : '진행 중'}`
}

export function formatDate(value: string): string {
  return toDotted(value.trim())
}

function toDotted(isoLike: string): string {
  return isoLike.replaceAll('-', '.')
}

export interface DemoExperienceSummary {
  title: string
  summary: string
  /** 카드에 한 줄로 붙는 시점. 없으면 빈 문자열이라 카드가 줄을 지운다. */
  timeframe: string
  /** 입력한 태그·표가 카드에도 보이게 하는 칩. 최대 4개. */
  chips: string[]
}

export function summarizeExperience(exp: DemoExperience): DemoExperienceSummary {
  const type = DEMO_TYPE_MAP[exp.typeId]
  const title = asText(exp.values[type.titleKey])
  const summary = asText(exp.values[type.summaryKey])

  let timeframe = ''
  const chips: string[] = []

  for (const field of type.fields) {
    const value = exp.values[field.key]
    if (!isFieldFilled(field.format, value)) continue

    if (field.format === 'period' && !timeframe) {
      timeframe = formatPeriod(value as DemoPeriod)
    } else if (field.format === 'date' && !timeframe) {
      timeframe = formatDate(value as string)
    } else if (field.format === 'tags') {
      chips.push(...(value as string[]).slice(0, 3))
    } else if (field.format === 'rows') {
      const filled = (value as DemoRow[]).filter(row =>
        Object.values(row.cells).some(cell => cell.trim().length > 0)
      )
      chips.push(`세부 작업 ${filled.length}건`)
    }
  }

  return { title, summary, timeframe, chips: chips.slice(0, 4) }
}

function asText(value: DemoFieldValue | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}
