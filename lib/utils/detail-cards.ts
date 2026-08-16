import type { Block, ExperienceV2, SectionCategory, TemplateV2 } from "@/types/archive"
import { SECTION_CATEGORIES, SECTION_LABEL_OVERRIDES } from "@/types/archive"
import { isBlockEmpty } from "@/lib/utils/block-utils"
import { computeFormCards, type FormCardSection } from "@/lib/utils/form-cards"

export interface DetailSection {
  label: string
  blocks: Block[]
  id?: string
}

const TITLE_KEY = "core.경험명"
const SUMMARY_KEY = "core.한 줄 요약"

function isHeaderBlock(b: Block): boolean {
  return (
    b.key === TITLE_KEY ||
    b.key === SUMMARY_KEY ||
    b.label === "경험명" ||
    b.label === "한 줄 요약"
  )
}

/**
 * 상세뷰 본문 섹션 구성.
 *
 * #69 스키마 v2가 `extensionBlocks`를 레지스트리 순서로 복원하고 안정키를 주입해 두므로
 * 라벨매칭 재조립 없이 입력 폼(#70)과 동일한 4카드 구조(computeFormCards)로 직접 렌더한다.
 * 경험명/한 줄 요약은 헤더가 단독 소유하므로 computeFormCards가 본문에서 제외한다.
 *
 * - 빈 블록은 숨기고, 빈 카드는 드롭한다.
 * - 입력 폼과 동일하게 미리보기도 항상 정식 4섹션(기본 정보/경험 상세/반복 기록/활동 증빙)만
 *   보인다. 키 없는 레거시 블록은 라벨+타입으로 섹션을 특정하고(모호 라벨도 타입이 다르면
 *   구분된다 — 미리보기는 값 주입 없이 표시만 하므로 안전), 그래도 어느 섹션과도 매칭되지
 *   않으면 블록 자신의 category(없으면 detail)로 정식 섹션에 합류시킨다(별도 "추가 입력" 없음).
 * - 템플릿이 없으면(v1/미지 타입) 헤더 제외 코어/확장 블록을 단순 그룹으로 폴백한다.
 */
export function buildDetailSections(
  experience: ExperienceV2,
  template: TemplateV2 | null,
): DetailSection[] {
  const out: DetailSection[] = []

  if (template) {
    // 저장된 확장 블록을 템플릿 섹션으로 되돌린다 — 안정키 우선, 키 없는 레거시는
    // ①전체에서 유일한 라벨 또는 ②라벨+타입 일치로 섹션을 특정한다. 모호 라벨
    // (예: extracurricular `결과/성과` = extended textarea + extra-detail repeatable-cell)도
    // 타입이 다르면 정확히 갈린다. 미리보기는 값을 주입하지 않고 표시만 하므로 타입 기반
    // 매칭이 값 손상을 일으키지 않는다(매퍼의 보수적 미주입과 달리 안전).
    const labelCounts = new Map<string, number>()
    for (const ext of template.extensions)
      for (const b of ext.blocks)
        labelCounts.set(b.label, (labelCounts.get(b.label) ?? 0) + 1)

    const consumed = new Set<string>()
    const sections: FormCardSection[] = template.extensions.map(ext => {
      const keys = new Set(ext.blocks.map(b => b.key).filter((k): k is string => !!k))
      const blocks = experience.extensionBlocks.filter(b => {
        if (consumed.has(b.id)) return false
        const hit = b.key
          ? keys.has(b.key)
          : (labelCounts.get(b.label) === 1 && ext.blocks.some(tb => tb.label === b.label))
            || ext.blocks.some(tb => tb.label === b.label && tb.type === b.type)
        if (hit) consumed.add(b.id)
        return hit
      })
      return {
        id: ext.id,
        label: ext.label,
        standalone: ext.standalone,
        description: ext.description,
        category: ext.category,
        blocks,
      }
    })

    const { cards } = computeFormCards(experience.coreBlocks, sections)

    // 카드 이름은 입력 폼과 같아야 한다 — 저장 직후 '봉사 회고'로 적어 넣은 카드가 상세뷰에서만
    // 일반 라벨 '경험 상세'로 바뀌면 같은 카드가 화면마다 다른 이름으로 불린다(FRT-247 Codex P2).
    // 폼은 ExperienceFormV2 가 computeFormCards 에 넘겨 적용하지만 상세뷰는 여기서 라벨을 직접
    // 만들어 왔다. 표시 전용이라 안정키·저장 shape 와 무관하다.
    // 분할 카드(FRT-320, id≠category)는 섹션 이름(card.label)이 곧 폼 카드 제목이므로 그대로 쓴다.
    const labelOverrides = SECTION_LABEL_OVERRIDES[experience.typeId]
    const categoryLabel = new Map(SECTION_CATEGORIES.map(c => [c.id, c.label]))
    const rendered = cards.map(card => ({
      category: card.category,
      label:
        card.id === card.category
          ? labelOverrides?.[card.category] ?? categoryLabel.get(card.category)!
          : card.label,
      blocks: card.blocks.filter(b => !isBlockEmpty(b)),
    }))
    // 매칭 안 된 잔여 블록(키 없는 레거시)은 자신의 category(없으면 detail)의 마지막 카드에
    // 합류시키고, 그 카테고리 카드가 없으면 새로 만든다("추가 입력" 미생성 — 기존 동작 유지).
    for (const b of experience.extensionBlocks) {
      if (consumed.has(b.id) || isBlockEmpty(b)) continue
      const cat = b.category ?? "detail"
      const target = [...rendered].reverse().find(c => c.category === cat)
      if (target) target.blocks.push(b)
      else rendered.push({ category: cat, label: labelOverrides?.[cat] ?? categoryLabel.get(cat)!, blocks: [b] })
    }
    // 잔여 블록으로 새로 만든 카드가 뒤에 붙었을 수 있다 — 카테고리 순서(SECTION_CATEGORIES)로
    // 안정 정렬해 기존 출력 순서를 유지한다(같은 카테고리 안의 분할 카드 순서는 그대로).
    const rank = new Map(SECTION_CATEGORIES.map((c, i) => [c.id, i]))
    rendered.sort((a, b) => (rank.get(a.category) ?? 0) - (rank.get(b.category) ?? 0))
    for (const card of rendered) {
      if (card.blocks.length > 0) out.push({ label: card.label, blocks: card.blocks })
    }
  } else {
    const coreBlocks = experience.coreBlocks.filter(
      b => !isHeaderBlock(b) && !isBlockEmpty(b),
    )
    if (coreBlocks.length > 0) out.push({ label: "기본 정보", blocks: coreBlocks })
    const extBlocks = experience.extensionBlocks.filter(b => !isBlockEmpty(b))
    if (extBlocks.length > 0) out.push({ label: "추가 입력", blocks: extBlocks })
  }

  // 사용자 섹션(group) = 개별 카드(라벨=섹션명, children leaf 만, 빈 섹션 제외).
  // 레거시 loose leaf = 단일 "추가 블록" 카드.
  const looseCustom: Block[] = []
  for (const b of experience.customBlocks) {
    if (b.type === "group") {
      const children = (b.children ?? []).filter(c => !isBlockEmpty(c))
      if (children.length > 0) out.push({ label: b.label || "새 블록", blocks: children, id: b.id })
    } else if (!isBlockEmpty(b)) {
      looseCustom.push(b)
    }
  }
  if (looseCustom.length > 0) out.push({ label: "추가 블록", blocks: looseCustom })

  return out
}
