import { describe, it, expect } from "vitest"
import { computeFormCards } from "@/lib/utils/form-cards"
import { getTemplateForType } from "@/lib/constants/templates-v2"
import { cloneBlocks } from "@/lib/utils/block-utils"
import type { FormCardSection } from "@/lib/utils/form-cards"

function sectionsFor(typeId: Parameters<typeof getTemplateForType>[0]): { core: ReturnType<typeof cloneBlocks>; sections: FormCardSection[] } {
  const t = getTemplateForType(typeId)
  return {
    core: cloneBlocks(t.commonCore.blocks),
    sections: t.extensions.map(e => ({ id: e.id, category: e.category, blocks: cloneBlocks(e.blocks) })),
  }
}

describe("computeFormCards", () => {
  it("헤더(경험명/요약)를 key 로 추출하고 카드에 넣지 않는다", () => {
    const { core, sections } = sectionsFor("career")
    const r = computeFormCards(core, sections)
    expect(r.titleBlock?.label).toBe("경험명")
    expect(r.summaryBlock?.label).toBe("한 줄 요약")
    for (const c of r.cards) {
      expect(c.blocks.find(b => b.label === "경험명")).toBeUndefined()
      expect(c.blocks.find(b => b.label === "한 줄 요약")).toBeUndefined()
    }
  })

  it("career: basic=근무정보, repeat=업무내용, detail=경험상세, evidence=증빙 카드가 보인다", () => {
    const { core, sections } = sectionsFor("career")
    const r = computeFormCards(core, sections)
    expect(r.visibleCategories).toEqual(["basic", "detail", "repeat", "evidence"])
    const basic = r.cards.find(c => c.category === "basic")!
    expect(basic.blocks.some(b => b.label === "회사명")).toBe(true)
    const repeat = r.cards.find(c => c.category === "repeat")!
    expect(repeat.blocks.some(b => b.label === "업무내용")).toBe(true)
    const evidence = r.cards.find(c => c.category === "evidence")!
    expect(evidence.blocks.some(b => b.label === "증빙 자료")).toBe(true)
  })

  it("detail 카드만 optional + showOptionalBadge", () => {
    const { core, sections } = sectionsFor("career")
    const r = computeFormCards(core, sections)
    for (const c of r.cards) {
      const expected = c.category === "detail"
      expect(!!c.optional).toBe(expected)
      expect(!!c.showOptionalBadge).toBe(expected)
    }
  })

  it("dedup(career): 비어있는 core 기간은 재직기간과 중복이라 숨긴다", () => {
    const { core, sections } = sectionsFor("career")
    const r = computeFormCards(core, sections)
    const all = r.cards.flatMap(c => c.blocks)
    expect(all.filter(b => b.label === "기간").length).toBe(0)
  })

  it("dedup(extracurricular): core 역할/성과가 type 섹션 동의어와 중복이면 숨긴다", () => {
    const { core, sections } = sectionsFor("extracurricular")
    const r = computeFormCards(core, sections)
    const all = r.cards.flatMap(c => c.blocks)
    expect(all.filter(b => b.label === "내 역할/기여도").length).toBe(0)
    expect(all.filter(b => b.label === "핵심 성과").length).toBe(0)
  })

  it("dedup 안전장치: 값이 채워진 core 블록은 중복이어도 유지한다", () => {
    const { core, sections } = sectionsFor("career")
    const period = core.find(b => b.label === "기간")!
    period.value = { type: "period", start: "2024-01", end: "2024-06", isCurrent: false }
    const r = computeFormCards(core, sections)
    const all = r.cards.flatMap(c => c.blocks)
    expect(all.some(b => b.id === period.id)).toBe(true)
  })

  it("repeat 섹션이 없는 유형(award)은 repeat 카드를 숨긴다", () => {
    const { core, sections } = sectionsFor("award")
    const r = computeFormCards(core, sections)
    expect(r.visibleCategories).not.toContain("repeat")
    expect(r.visibleCategories).toContain("basic")
    expect(r.visibleCategories).toContain("evidence")
  })
})
