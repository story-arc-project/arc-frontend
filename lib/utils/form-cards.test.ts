import { describe, it, expect } from "vitest"
import { computeFormCards, isCardComplete, computeFormProgress } from "@/lib/utils/form-cards"
import { getTemplateForType } from "@/lib/constants/templates-v2"
import { cloneBlocks } from "@/lib/utils/block-utils"
import type { FormCardSection, FormCardModel } from "@/lib/utils/form-cards"
import type { Block } from "@/types/archive"

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

  it("labelOverrides: 지정 카테고리는 오버라이드 라벨, 미지정은 기본 라벨", () => {
    const { core, sections } = sectionsFor("academic-society")
    const overridden = computeFormCards(core, sections, { repeat: "프로젝트 기록" })
    const repeat = overridden.cards.find(c => c.category === "repeat")!
    expect(repeat.label).toBe("프로젝트 기록")
    // 미지정 카테고리는 기본(SECTION_CATEGORIES) 라벨 유지
    expect(overridden.cards.find(c => c.category === "basic")!.label).toBe("기본 정보")
  })

  it("labelOverrides 미전달 시 기본 라벨을 쓴다", () => {
    const { core, sections } = sectionsFor("academic-society")
    const plain = computeFormCards(core, sections)
    expect(plain.cards.find(c => c.category === "repeat")!.label).toBe("반복 기록")
  })
})

describe("isCardComplete / computeFormProgress", () => {
  function fillBlock(card: FormCardModel, label: string, text: string) {
    const b = card.blocks.find(x => x.label === label)!
    b.value = { type: b.value.type === "textarea" ? "textarea" : "text", text } as Block["value"]
  }

  it("필수 항목이 모두 채워지면 완료, 하나라도 비면 미완료", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    const basic = r.cards.find(c => c.category === "basic")!
    // basic 필수(학회): 학회명·기간·역할/직책(경험명은 titleBlock 으로 추출돼 카드 밖). 초기엔 미완료.
    expect(basic.blocks.filter(b => b.required).map(b => b.label).sort()).toEqual(["기간", "역할/직책", "학회명"])
    expect(isCardComplete(basic)).toBe(false)
    // 필수 텍스트만 채우고 기간(period)은 비워두면 여전히 미완료
    fillBlock(basic, "학회명", "한국인공지능학회")
    fillBlock(basic, "역할/직책", "부회장")
    expect(isCardComplete(basic)).toBe(false)
    // 기간(period)까지 채우면 완료
    const period = basic.blocks.find(b => b.label === "기간")!
    period.value = { type: "period", start: "2024-03", end: "2024-12", isCurrent: false }
    expect(isCardComplete(basic)).toBe(true)
  })

  it("필수 없는 섹션(detail)은 하나라도 채우면 완료", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    const detail = r.cards.find(c => c.category === "detail")!
    expect(detail.blocks.some(b => b.required)).toBe(false)
    expect(isCardComplete(detail)).toBe(false)
    fillBlock(detail, detail.blocks[0].label, "무언가 입력")
    expect(isCardComplete(detail)).toBe(true)
  })

  it("repeatable-cell 섹션(학회 프로젝트 기록): 빈 행은 미완료, 필수 셀 채운 행은 완료", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    const repeat = r.cards.find(c => c.category === "repeat")!
    expect(isCardComplete(repeat)).toBe(false)
    const cell = repeat.blocks.find(b => b.value.type === "repeatable-cell")!
    if (cell.value.type !== "repeatable-cell") throw new Error("expected repeatable-cell")
    const requiredKeys = cell.value.columns.filter(c => c.required).map(c => c.key)
    expect(requiredKeys.length).toBeGreaterThan(0)
    // 빈 행만 추가하면 여전히 미완료 (필수 셀 미충족)
    cell.value = { ...cell.value, rows: [{ id: "row-1", cells: {} }] }
    expect(isCardComplete(repeat)).toBe(false)
    // 필수 셀을 모두 채운 행이 있으면 완료
    const filledCells: Record<string, string> = {}
    for (const k of requiredKeys) filledCells[k] = "값"
    cell.value = { ...cell.value, rows: [{ id: "row-1", cells: filledCells }] }
    expect(isCardComplete(repeat)).toBe(true)
  })

  it("computeFormProgress: done/total 카운트", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    expect(computeFormProgress(r.cards)).toEqual({ done: 0, total: r.cards.length })
    const detail = r.cards.find(c => c.category === "detail")!
    fillBlock(detail, detail.blocks[0].label, "채움")
    expect(computeFormProgress(r.cards).done).toBe(1)
  })
})
