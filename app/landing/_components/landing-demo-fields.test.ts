import { describe, it, expect } from 'vitest'

import {
  DEMO_TYPES,
  DEMO_TYPE_MAP,
  canAddExperience,
  collectValues,
  createEmptyDraft,
  flattenDraftText,
  formatPeriod,
  isFieldFilled,
  summarizeExperience,
  type DemoTypeId,
} from './landing-demo-fields'

const TYPE_IDS: DemoTypeId[] = ['internship', 'project', 'award']

describe('DEMO_TYPES 정의', () => {
  it('세 유형만 노출한다 — 랜딩 체험은 데모가 아니라 맛보기다', () => {
    expect(DEMO_TYPES.map(t => t.id)).toEqual(TYPE_IDS)
  })

  it.each(TYPE_IDS)('%s: titleKey·summaryKey 가 실제 필드를 가리킨다', id => {
    const type = DEMO_TYPE_MAP[id]
    const keys = type.fields.map(f => f.key)
    expect(keys).toContain(type.titleKey)
    expect(keys).toContain(type.summaryKey)
  })

  it.each(TYPE_IDS)('%s: 기본 노출 4개 + 접힘 2개로 볼륨을 묶는다', id => {
    const fields = DEMO_TYPE_MAP[id].fields
    expect(fields.filter(f => !f.advanced)).toHaveLength(4)
    expect(fields.filter(f => f.advanced)).toHaveLength(2)
  })

  it('유형마다 필드 구성이 실제로 다르다 — 칩이 눌리는 컨트롤로 느껴져야 한다', () => {
    const [a, b, c] = TYPE_IDS.map(id => DEMO_TYPE_MAP[id].fields.map(f => f.key).join('|'))
    expect(new Set([a, b, c]).size).toBe(3)
  })

  it('모든 필드에 가이드 문구가 붙는다 — 자세히 물어보는 것이 이 섹션의 요점이다', () => {
    for (const type of DEMO_TYPES) {
      for (const field of type.fields) {
        expect(field.guide, `${type.id}.${field.key}`).toBeTruthy()
      }
    }
  })

  it('여러 입력 포맷을 한 섹션 안에서 보여준다', () => {
    const formats = new Set(DEMO_TYPES.flatMap(t => t.fields.map(f => f.format)))
    expect(formats).toEqual(
      new Set(['text', 'textarea', 'period', 'date', 'select', 'tags', 'rows'])
    )
  })

  it('select 는 options 를, rows 는 columns 를 반드시 갖는다', () => {
    for (const type of DEMO_TYPES) {
      for (const field of type.fields) {
        if (field.format === 'select') expect(field.options?.length).toBeGreaterThan(1)
        if (field.format === 'rows') expect(field.columns?.length).toBeGreaterThan(1)
      }
    }
  })

  it('필드 키는 유형 안에서 유일하다', () => {
    for (const type of DEMO_TYPES) {
      const keys = type.fields.map(f => f.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('유형을 가로질러 같은 키를 쓰면 포맷도 같다 — 전환해도 값이 살아있기 때문이다', () => {
    const seen = new Map<string, string>()
    for (const type of DEMO_TYPES) {
      for (const field of type.fields) {
        const known = seen.get(field.key)
        if (known) expect(field.format, field.key).toBe(known)
        else seen.set(field.key, field.format)
      }
    }
  })
})

describe('isFieldFilled', () => {
  it('빈 문자열·공백은 비어 있다', () => {
    expect(isFieldFilled('text', '')).toBe(false)
    expect(isFieldFilled('text', '   ')).toBe(false)
    expect(isFieldFilled('text', '카카오')).toBe(true)
  })

  it('태그는 항목이 하나라도 있어야 채워진 것이다', () => {
    expect(isFieldFilled('tags', [])).toBe(false)
    expect(isFieldFilled('tags', ['Figma'])).toBe(true)
  })

  it('기간은 시작만 있어도 채워진 것이다 — 진행 중인 경험을 막지 않는다', () => {
    expect(isFieldFilled('period', { start: '', end: '' })).toBe(false)
    expect(isFieldFilled('period', { start: '2024-07', end: '' })).toBe(true)
  })

  it('표는 셀에 값이 하나라도 있어야 채워진 것이다 — 빈 행은 세지 않는다', () => {
    expect(isFieldFilled('rows', [{ id: 'r1', cells: { task: '', role: '' } }])).toBe(false)
    expect(isFieldFilled('rows', [{ id: 'r1', cells: { task: '기획', role: '' } }])).toBe(true)
  })
})

describe('canAddExperience', () => {
  it('제목과 요약이 채워져야 추가할 수 있다', () => {
    const draft = createEmptyDraft()
    expect(canAddExperience('internship', draft)).toBe(false)

    draft['title'] = '카카오 UX 인턴십'
    expect(canAddExperience('internship', draft)).toBe(false)

    draft[DEMO_TYPE_MAP.internship.summaryKey] = '온보딩 플로우를 재설계했습니다'
    expect(canAddExperience('internship', draft)).toBe(true)
  })

  it('다른 유형에서 채운 값으로는 추가되지 않는다', () => {
    const draft = createEmptyDraft()
    draft[DEMO_TYPE_MAP.award.summaryKey] = '대상을 받았습니다'
    draft['title'] = '앱잼'
    expect(canAddExperience('project', draft)).toBe(false)
    expect(canAddExperience('award', draft)).toBe(true)
  })
})

describe('collectValues', () => {
  it('현재 유형이 정의한 키만 담는다 — 전환하며 남은 값은 따라오지 않는다', () => {
    const draft = createEmptyDraft()
    draft['title'] = '캠퍼스 중고거래 앱'
    draft['awardGrade'] = '대상'

    const values = collectValues('project', draft)
    expect(values['title']).toBe('캠퍼스 중고거래 앱')
    expect(values['awardGrade']).toBeUndefined()
  })

  it('빈 필드는 담지 않는다', () => {
    const draft = createEmptyDraft()
    draft['title'] = '캠퍼스 중고거래 앱'
    const values = collectValues('project', draft)
    expect(Object.keys(values)).toEqual(['title'])
  })
})

describe('flattenDraftText', () => {
  it('태그와 표의 셀까지 한 덩어리 텍스트로 편다 — 분석이 그 값을 읽어야 한다', () => {
    const values = {
      title: '캠퍼스 중고거래 앱',
      projectTasks: [{ id: 'r1', cells: { task: '프론트엔드 개발', role: '팀장' } }],
      projectStack: ['React', 'TypeScript'],
    }
    const text = flattenDraftText(values)
    expect(text).toContain('캠퍼스 중고거래 앱')
    expect(text).toContain('프론트엔드 개발')
    expect(text).toContain('팀장')
    expect(text).toContain('React')
  })

  it('기간은 텍스트에 섞지 않는다 — 숫자가 키워드 판정을 흔든다', () => {
    const text = flattenDraftText({ period: { start: '2024-07', end: '2024-09' } })
    expect(text).toBe('')
  })
})

describe('formatPeriod', () => {
  it('시작과 종료를 사람이 읽는 표기로 잇는다', () => {
    expect(formatPeriod({ start: '2024-07', end: '2024-09' })).toBe('2024.07 — 2024.09')
  })

  it('종료가 없으면 진행 중으로 읽는다', () => {
    expect(formatPeriod({ start: '2024-07', end: '' })).toBe('2024.07 — 진행 중')
  })

  it('시작이 없으면 빈 문자열이다', () => {
    expect(formatPeriod({ start: '', end: '' })).toBe('')
  })
})

describe('summarizeExperience', () => {
  it('제목·요약·시점을 카드가 쓸 모양으로 돌려준다', () => {
    const summary = summarizeExperience({
      id: 'x',
      typeId: 'internship',
      values: {
        title: '카카오 UX 인턴십',
        careerOutcome: '온보딩 플로우를 재설계했습니다',
        period: { start: '2024-07', end: '2024-09' },
      },
    })
    expect(summary.title).toBe('카카오 UX 인턴십')
    expect(summary.summary).toBe('온보딩 플로우를 재설계했습니다')
    expect(summary.timeframe).toBe('2024.07 — 2024.09')
  })

  it('시점이 없으면 빈 문자열로 두어 카드가 줄을 지우게 한다', () => {
    const summary = summarizeExperience({
      id: 'x',
      typeId: 'internship',
      values: { title: '카카오 UX 인턴십', careerOutcome: '재설계' },
    })
    expect(summary.timeframe).toBe('')
  })

  it('태그와 표는 칩으로 요약한다 — 입력한 것이 카드에 보여야 한다', () => {
    const summary = summarizeExperience({
      id: 'x',
      typeId: 'project',
      values: {
        title: '캠퍼스 중고거래 앱',
        projectOutcome: '베타 2주 만에 DAU 150명',
        projectStack: ['React', 'TypeScript', 'Supabase', 'Figma'],
        projectTasks: [
          { id: 'r1', cells: { task: '기획', role: '팀장' } },
          { id: 'r2', cells: { task: '개발', role: '프론트엔드' } },
        ],
      },
    })
    expect(summary.chips).toContain('React')
    expect(summary.chips.filter(c => c.startsWith('세부 작업'))).toEqual(['세부 작업 2건'])
    expect(summary.chips.length).toBeLessThanOrEqual(4)
  })

  it('수상일처럼 date 를 쓰는 유형도 시점을 읽어준다', () => {
    const summary = summarizeExperience({
      id: 'x',
      typeId: 'award',
      values: {
        title: '앱잼',
        awardBackground: '중고거래 앱으로 수상',
        awardedAt: '2024-03-15',
      },
    })
    expect(summary.timeframe).toBe('2024.03.15')
  })
})
