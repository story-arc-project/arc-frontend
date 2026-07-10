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

  it("학회 detail 카드는 학회 전용 6필드로 구성되고 범용 확장·commonCore 성과 필드가 없다", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    const detail = r.cards.find(c => c.category === "detail")!
    const labels = detail.blocks.map(b => b.label)
    // 학회 전용 6필드(노션 원본) 존재
    for (const l of [
      "참여 동기",
      "단체 활동 / 성과",
      "개인 활동 / 성과",
      "성장 / 변화",
      "사용한 스킬 / 툴 / 기술",
      "협업 / 팀원",
    ]) {
      expect(labels).toContain(l)
    }
    // 범용 확장 필드(buildExtendedSection) 부재
    expect(labels).not.toContain("배경/목표")
    expect(labels).not.toContain("내가 한 행동")
    expect(labels).not.toContain("결과/성과")
    expect(labels).not.toContain("배운 점")
    expect(labels).not.toContain("난이도")
    // commonCore detail 필드는 학회 앵커와 동의어라 dedup 으로 부재
    expect(labels).not.toContain("핵심 성과")
    expect(labels).not.toContain("내 역할/기여도")
    // 공개 설정은 포트폴리오 발행에 필요하므로 보존
    expect(labels).toContain("공개 설정")
  })

  it("비-커스텀 유형(club)은 범용 확장 필드(배경/목표·공개 설정)를 유지한다", () => {
    const { core, sections } = sectionsFor("club")
    const r = computeFormCards(core, sections)
    const all = r.cards.flatMap(c => c.blocks).map(b => b.label)
    expect(all).toContain("배경/목표")
    expect(all).toContain("공개 설정")
  })

  it("학회 템플릿: society-info 에 지원 동기가 없고 society-detail 에 참여 동기가 있다", () => {
    const t = getTemplateForType("academic-society")
    const info = t.extensions.find(e => e.id === "society-info")!
    expect(info.blocks.some(b => b.label === "지원 동기")).toBe(false)
    const detail = t.extensions.find(e => e.id === "society-detail")!
    expect(detail.category).toBe("detail")
    expect(detail.blocks.some(b => b.label === "참여 동기")).toBe(true)
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

  it("필수 컬럼 repeatable + optional 형제(교육 수업 기록): optional 만 채우면 미완료", () => {
    // Codex P2: block.required 는 false 지만 필수 컬럼을 가진 repeatable-cell 은 필수로 취급해야 한다.
    const { core, sections } = sectionsFor("education")
    const r = computeFormCards(core, sections)
    const repeat = r.cards.find(c => c.category === "repeat")!
    const cell = repeat.blocks.find(b => b.value.type === "repeatable-cell")!
    const tags = repeat.blocks.find(b => b.value.type === "tags")!
    if (cell.value.type !== "repeatable-cell") throw new Error("expected repeatable-cell")
    expect(cell.value.columns.some(c => c.required)).toBe(true)
    expect(cell.required).toBeFalsy()
    // optional 태그 형제만 채움 → 필수 컬럼 미충족이므로 여전히 미완료여야 한다
    tags.value = { type: "tags", tags: ["백엔드"] }
    expect(isCardComplete(repeat)).toBe(false)
    // 필수 컬럼을 채운 행이 생기면 완료
    const filled: Record<string, string> = {}
    for (const c of cell.value.columns.filter(c => c.required)) filled[c.key] = "값"
    cell.value = { ...cell.value, rows: [{ id: "row-1", cells: filled }] }
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
