import { describe, it, expect } from 'vitest'

import { analyzeExperiences } from './landing-demo-analysis'
import type { DemoExperience } from './landing-demo-fields'

function project(values: DemoExperience['values']): DemoExperience {
  return { id: 'p1', typeId: 'project', values }
}

describe('analyzeExperiences', () => {
  it('경험이 없으면 다음 행동을 알려준다', () => {
    const result = analyzeExperiences([])
    expect(result.top).toHaveLength(0)
    expect(result.storyline).toContain('기록')
  })

  it('키워드가 하나도 안 잡히면 더 적어달라고 안내한다', () => {
    const result = analyzeExperiences([project({ title: 'ㅁㅁㅁ', projectOutcome: 'ㅇㅇㅇ' })])
    expect(result.top).toHaveLength(0)
    expect(result.storyline).toContain('구체적')
  })

  it('제목과 요약에서 키워드를 찾는다', () => {
    const result = analyzeExperiences([
      project({ title: '중고거래 앱 개발', projectOutcome: '팀장으로 팀을 이끌었습니다' }),
    ])
    expect(result.top.map(k => k.key)).toContain('개발')
    expect(result.top.map(k => k.key)).toContain('리더십')
  })

  it('태그 필드의 값도 읽는다 — 유형 전용 필드가 분석에 닿아야 한다', () => {
    const withoutTags = analyzeExperiences([
      project({ title: '캠퍼스 앱', projectOutcome: '베타 출시' }),
    ])
    const withTags = analyzeExperiences([
      project({
        title: '캠퍼스 앱',
        projectOutcome: '베타 출시',
        projectStack: ['디자인', '프로토타입'],
      }),
    ])

    const designBefore = withoutTags.keywords.find(k => k.key === '디자인')?.hits ?? 0
    const designAfter = withTags.keywords.find(k => k.key === '디자인')?.hits ?? 0
    expect(designAfter).toBeGreaterThan(designBefore)
  })

  it('표(세부 작업)의 셀 값도 읽는다', () => {
    const result = analyzeExperiences([
      project({
        title: '캠퍼스 앱',
        projectOutcome: '출시',
        projectTasks: [{ id: 'r1', cells: { task: '사용자 인터뷰', role: '기획 담당' } }],
      }),
    ])
    expect(result.top.map(k => k.key)).toEqual(expect.arrayContaining(['분석', '기획']))
  })

  it('경험 수를 스토리라인에 반영한다', () => {
    const result = analyzeExperiences([
      project({ title: '앱 개발', projectOutcome: '팀장으로 주도' }),
      { id: 'p2', typeId: 'award', values: { title: '수상', awardBackground: '기획으로 수상' } },
    ])
    expect(result.storyline).toContain('2개')
  })

  it('키워드는 비중 내림차순으로 돌려준다', () => {
    const result = analyzeExperiences([
      project({ title: '개발 개발 개발', projectOutcome: '발표 한 번' }),
    ])
    const percents = result.keywords.map(k => k.percent)
    expect([...percents].sort((a, b) => b - a)).toEqual(percents)
  })
})
