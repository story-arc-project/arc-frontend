/**
 * '＋ 빠른 선택' 그룹 픽커 프리셋 (FRT-130).
 *
 * 인턴 ① 기본 정보의 '산업 / 회사 종류'·'직무 / 포지션'은 자유 입력이라 백지에서 시작해야 했다.
 * 프로토타입 확정본은 평상시 `＋ 빠른 선택` 버튼 하나만 보이다가 클릭 시 **카테고리별 그룹 패널**이
 * 펼쳐지는 형태를 정했다 — 태그를 화면에 늘어놓지 않아 입력 허들을 올리지 않는다.
 *
 * ⚠️ 이 프리셋은 **입력 보조**일 뿐이다. 저장 shape 은 전혀 바뀌지 않는다:
 * 산업은 `tags {tags: string[]}`, 직무는 `text {text: string}` 그대로이고 선택값은 그냥 그 문자열이
 * 된다. 따라서 목록을 나중에 바꿔도 기존 레코드는 살아 있고, 여기 없는 값도 직접 입력으로 들어온다.
 * 안정키(`${sectionId}.${label}`)와 무관하므로 `TEMPLATE_VERSION` bump 대상이 아니다.
 *
 * ⚠️ 항목 문자열이 곧 저장값이다 — 이미 저장된 기록과 갈리지 않도록 **문구 변경은 신중히** 한다.
 * (라벨을 고치면 그 뒤 저장분만 새 문구가 되고, 기존 값은 픽커에서 '선택됨'으로 안 잡힌다.)
 */

import type { QuickPickPresetId } from '@/types/archive'

export type { QuickPickPresetId }

export interface QuickPickGroup {
  /** 그룹 헤더 문구. 저장값이 아니라 화면 분류일 뿐이다. */
  label: string
  items: string[]
}

export interface QuickPickPreset {
  /**
   * 선택 방식. `'multi'` 는 `tags` 블록(여러 개 토글), `'single'` 은 `text` 블록(하나 고르면 대체).
   * 블록 타입과 어긋나게 붙이면 값을 담을 그릇이 안 맞으므로 테스트가 정합성을 못박는다.
   */
  mode: 'multi' | 'single'
  /** 패널을 열기 전 버튼 옆에 붙는 설명 — 무엇을 고르는 패널인지 스크린리더에도 알린다. */
  title: string
  groups: QuickPickGroup[]
}

/**
 * 산업 / 회사 종류 — 6 카테고리, 다중 선택.
 *
 * '회사 형태' 6종만 확정본 원문에 명시돼 있고 나머지 5그룹의 세부 항목은 문서에 없다(원본 HTML 이
 * 공유 링크에서 가려져 옮겨지지 못했다). 그래서 아래 항목들은 **구현이 명명한 초안**이다 —
 * 확정 전까지 자유 입력이 항상 열려 있으므로 목록이 좁아도 사용자가 막히지는 않는다.
 */
const INDUSTRY_PRESET: QuickPickPreset = {
  mode: 'multi',
  title: '산업·회사 종류 빠른 선택',
  groups: [
    // 확정본 원문에 그대로 적힌 6종. 다른 그룹과 조합해 "스타트업 + IT" 처럼 쓴다.
    { label: '회사 형태', items: ['스타트업', '대기업', '중견기업', '외국계', '공공기관', 'NGO/비영리'] },
    { label: '기술 · IT', items: ['IT/소프트웨어', '플랫폼/서비스', 'AI/데이터', '게임', '하드웨어/반도체'] },
    { label: '금융 · 전문서비스', items: ['금융/은행', '증권/자산운용', '핀테크', '컨설팅', '법률/회계'] },
    { label: '소비재 · 유통', items: ['소비재/F&B', '패션/뷰티', '이커머스', '유통/리테일', '여행/레저'] },
    { label: '바이오 · 산업', items: ['바이오/헬스케어', '제약/의료기기', '제조', '화학/에너지', '건설/부동산'] },
    { label: '미디어 · 문화', items: ['미디어/방송', '광고/마케팅', '콘텐츠/엔터테인먼트', '교육', '출판'] },
  ],
}

/**
 * 직무 / 포지션 — 5 카테고리 총 15종, 단일 선택.
 *
 * 확정본은 카테고리 5개와 "총 15개 세분화"라는 개수만 남겼고 항목 문구는 없다 — 아래는 그 개수를
 * 지키는 초안이다(그룹당 3종). 개수는 테스트가 못박으므로 항목을 늘리려면 확정본을 먼저 고친다.
 */
const JOB_FUNCTION_PRESET: QuickPickPreset = {
  mode: 'single',
  title: '직무·포지션 빠른 선택',
  groups: [
    { label: '기획/전략', items: ['서비스 기획', '사업/전략 기획', 'PM/PO'] },
    { label: '마케팅/콘텐츠', items: ['브랜드 마케팅', '퍼포먼스 마케팅', '콘텐츠/SNS'] },
    { label: '개발/데이터', items: ['개발(프론트엔드/백엔드)', '데이터 분석', 'AI/ML'] },
    { label: '디자인', items: ['UX/UI 디자인', '그래픽/BX 디자인', '영상/모션 디자인'] },
    { label: '비즈니스/지원', items: ['영업/BD', 'HR/인사', '재무/회계'] },
  ],
}

export const QUICK_PICK_PRESETS: Record<QuickPickPresetId, QuickPickPreset> = {
  industry: INDUSTRY_PRESET,
  'job-function': JOB_FUNCTION_PRESET,
}

/**
 * 블록에 실린 `quickPick` 값으로 프리셋을 찾는다.
 *
 * ⚠️ **모르는 id 는 `null` 을 돌려준다** — 그래야 픽커가 안 뜨고 블록이 기존 자유 입력 UI 로
 * 그대로 그려진다. 새 프론트가 추가한 프리셋 id 를 구 프론트가 만났을 때 화면이 죽거나 입력이
 * 막히면 안 된다(BlockRenderer 의 variant 폴백과 같은 규약).
 */
export function getQuickPickPreset(id: string | undefined | null): QuickPickPreset | null {
  if (!id) return null
  return Object.prototype.hasOwnProperty.call(QUICK_PICK_PRESETS, id)
    ? QUICK_PICK_PRESETS[id as QuickPickPresetId]
    : null
}

/** 프리셋 안의 모든 항목을 그룹 순서대로 펼친다(중복 검사·테스트용). */
export function quickPickItems(preset: QuickPickPreset): string[] {
  return preset.groups.flatMap(g => g.items)
}
