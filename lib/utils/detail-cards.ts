import type { Block, ExperienceV2, TemplateV2 } from "@/types/archive"
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
 * - 어느 템플릿 섹션에도 매칭되지 않는 확장 블록(레거시/리네임 라벨)은 "추가 입력"으로 보존한다.
 * - 템플릿이 없으면(v1/미지 타입) 헤더 제외 코어/확장 블록을 단순 그룹으로 폴백한다.
 */
export function buildDetailSections(
  experience: ExperienceV2,
  template: TemplateV2 | null,
): DetailSection[] {
  const out: DetailSection[] = []

  if (template) {
    // 저장된 확장 블록을 템플릿 섹션으로 되돌린다 — 안정키 우선, 키 없는 레거시만 라벨 폴백.
    // 키 없는 블록의 라벨 폴백은 *전체 확장 블록에서 유일한 라벨*만 허용한다. 모호 라벨
    // (예: extracurricular `결과/성과` = extended + type-specific 양쪽 존재)은 먼저 순회되는
    // extended 섹션이 가로채 잘못된 카드로 흡수될 수 있으므로 매칭하지 않고 "추가 입력"으로
    // 보존한다(매퍼의 "모호 라벨엔 안정키 미주입" 철학과 정합).
    const labelCounts = new Map<string, number>()
    for (const ext of template.extensions)
      for (const b of ext.blocks)
        labelCounts.set(b.label, (labelCounts.get(b.label) ?? 0) + 1)

    const consumed = new Set<string>()
    const sections: FormCardSection[] = template.extensions.map(ext => {
      const keys = new Set(ext.blocks.map(b => b.key).filter((k): k is string => !!k))
      const labels = new Set(ext.blocks.map(b => b.label))
      const blocks = experience.extensionBlocks.filter(b => {
        if (consumed.has(b.id)) return false
        const hit = b.key
          ? keys.has(b.key)
          : labels.has(b.label) && labelCounts.get(b.label) === 1
        if (hit) consumed.add(b.id)
        return hit
      })
      return { id: ext.id, category: ext.category, blocks }
    })

    const { cards } = computeFormCards(experience.coreBlocks, sections)
    for (const card of cards) {
      const blocks = card.blocks.filter(b => !isBlockEmpty(b))
      if (blocks.length > 0) out.push({ label: card.label, blocks })
    }

    // 어느 섹션에도 매칭되지 않은 확장 블록은 유실 없이 보존한다.
    const leftover = experience.extensionBlocks.filter(
      b => !consumed.has(b.id) && !isBlockEmpty(b),
    )
    if (leftover.length > 0) out.push({ label: "추가 입력", blocks: leftover })
  } else {
    const coreBlocks = experience.coreBlocks.filter(
      b => !isHeaderBlock(b) && !isBlockEmpty(b),
    )
    if (coreBlocks.length > 0) out.push({ label: "기본 정보", blocks: coreBlocks })
    const extBlocks = experience.extensionBlocks.filter(b => !isBlockEmpty(b))
    if (extBlocks.length > 0) out.push({ label: "추가 입력", blocks: extBlocks })
  }

  const customBlocks = experience.customBlocks.filter(b => !isBlockEmpty(b))
  if (customBlocks.length > 0) out.push({ label: "추가 블록", blocks: customBlocks })

  return out
}
