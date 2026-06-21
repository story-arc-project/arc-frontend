import type { Block, ExperienceV2, SectionCategory, TemplateV2 } from "@/types/archive"
import { SECTION_CATEGORIES } from "@/types/archive"
import { isBlockEmpty } from "@/lib/utils/block-utils"
import { computeFormCards, type FormCardSection } from "@/lib/utils/form-cards"

export interface DetailSection {
  label: string
  blocks: Block[]
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
      return { id: ext.id, category: ext.category, blocks }
    })

    const { cards } = computeFormCards(experience.coreBlocks, sections)

    // 정식 4섹션만 노출 — 매칭된 카드 블록 + 매칭 안 된 잔여 블록(자신의 category, 없으면
    // detail)을 category 별로 합쳐 SECTION_CATEGORIES 순서로 출력한다("추가 입력" 미생성).
    const blocksByCat = new Map<SectionCategory, Block[]>()
    const add = (cat: SectionCategory, blocks: Block[]) => {
      if (blocks.length > 0) blocksByCat.set(cat, [...(blocksByCat.get(cat) ?? []), ...blocks])
    }
    for (const card of cards) add(card.category, card.blocks.filter(b => !isBlockEmpty(b)))
    for (const b of experience.extensionBlocks) {
      if (consumed.has(b.id) || isBlockEmpty(b)) continue
      add(b.category ?? "detail", [b])
    }
    for (const { id, label } of SECTION_CATEGORIES) {
      const blocks = blocksByCat.get(id)
      if (blocks && blocks.length > 0) out.push({ label, blocks })
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
      if (children.length > 0) out.push({ label: b.label || "새 블록", blocks: children })
    } else if (!isBlockEmpty(b)) {
      looseCustom.push(b)
    }
  }
  if (looseCustom.length > 0) out.push({ label: "추가 블록", blocks: looseCustom })

  return out
}
