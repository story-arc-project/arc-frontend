import { flattenDraftText, type DemoExperience } from './landing-demo-fields'

/**
 * 랜딩 체험의 가짜 분석 (FRT-339에서 `LandingDemo.tsx` 밖으로 옮겼다).
 *
 * 옮긴 이유는 corpus 가 넓어졌기 때문이다 — 예전에는 제목·요약 두 필드만 읽었지만, 이제
 * 유형마다 다른 필드를 받으므로 태그·표의 셀까지 읽어야 한다. 그러지 않으면 "칩을 눌러도
 * 안 바뀐다"(FRT-339)가 "입력해도 분석이 안 바뀐다"로 한 층 아래에서 재발한다.
 *
 * 실제 분석은 backend AI 가 한다. 여기 있는 것은 랜딩에서 보여주는 규칙 기반 흉내다.
 */

export type KeywordKey =
  | '리더십'
  | '협업'
  | '기획'
  | '개발'
  | '디자인'
  | '분석'
  | '커뮤니케이션'

const KEYWORD_RULES: Record<KeywordKey, string[]> = {
  리더십: ['리더', '팀장', '주도', '이끌', '운영', '총괄', '관리'],
  협업: ['협업', '팀', '함께', '회의', '조율', '커뮤니', '동료'],
  기획: ['기획', '전략', '설계', '로드맵', '아이디어', '브레인', '방향'],
  개발: ['개발', '구현', '코드', '프론트', '백엔드', '앱', 'api', '배포'],
  디자인: ['디자인', 'ui', 'ux', '프로토타입', '와이어프레임', '비주얼'],
  분석: ['분석', '데이터', '리서치', '조사', '인터뷰', '지표', '가설'],
  커뮤니케이션: ['발표', '피드백', '설득', '공유', '문서', '소통'],
}

export const KEYWORD_CATEGORY: Record<KeywordKey, 'skill' | 'work_style'> = {
  리더십: 'work_style',
  협업: 'work_style',
  기획: 'skill',
  개발: 'skill',
  디자인: 'skill',
  분석: 'skill',
  커뮤니케이션: 'work_style',
}

export const CATEGORY_LABEL: Record<'skill' | 'work_style', string> = {
  skill: '직무/스킬',
  work_style: '업무 성향',
}

export interface AnalyzedKeyword {
  key: KeywordKey
  percent: number
  category: 'skill' | 'work_style'
  hits: number
}

export function analyzeExperiences(exps: DemoExperience[]) {
  const corpus = exps
    .map(e => flattenDraftText(e.values))
    .join(' ')
    .toLowerCase()

  const scored = (Object.keys(KEYWORD_RULES) as KeywordKey[]).map(key => {
    const count = KEYWORD_RULES[key].reduce((acc, w) => {
      const regex = new RegExp(w.toLowerCase(), 'g')
      const matches = corpus.match(regex)
      return acc + (matches ? matches.length : 0)
    }, 0)
    return { key, count }
  })

  const max = Math.max(1, ...scored.map(s => s.count))
  const keywords: AnalyzedKeyword[] = scored
    .map(s => ({
      key: s.key,
      percent: Math.min(98, Math.round((s.count / max) * 92) + (s.count ? 6 : 0)),
      category: KEYWORD_CATEGORY[s.key],
      hits: s.count,
    }))
    .sort((a, b) => b.percent - a.percent)

  const top = keywords.filter(k => k.hits > 0).slice(0, 3)
  const topLabels = top.map(k => k.key)

  const storyline =
    exps.length === 0
      ? '경험을 2~3개 기록해보면 AI가 이 자리에서 스토리라인을 찾아드려요.'
      : top.length === 0
        ? '조금 더 구체적인 활동·역할을 적어주시면 패턴이 또렷해져요.'
        : `${exps.length}개의 경험에서 '${topLabels.join(
            ' · '
          )}'(이)라는 흐름이 반복되고 있어요. 서로 다른 활동이 하나의 서사로 연결됩니다.`

  return { keywords, top, storyline }
}
