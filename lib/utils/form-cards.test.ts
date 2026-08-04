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

  it("career: basic=근무정보, repeat=프로젝트/담당 업무, detail=경험상세, evidence=증빙 카드가 보인다", () => {
    const { core, sections } = sectionsFor("career")
    const r = computeFormCards(core, sections)
    expect(r.visibleCategories).toEqual(["basic", "detail", "repeat", "evidence"])
    const basic = r.cards.find(c => c.category === "basic")!
    expect(basic.blocks.some(b => b.label === "회사명")).toBe(true)
    const repeat = r.cards.find(c => c.category === "repeat")!
    expect(repeat.blocks.some(b => b.label === "프로젝트/담당 업무")).toBe(true)
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

  it("dedup(career): core 역할/성과가 type 섹션 동의어와 중복이면 숨긴다", () => {
    // career 는 '직무 / 포지션'(role)·'나의 담당 업무 / 주요 성과'(achievement)를 앵커로 가져
    // 비어있는 core 역할/기여도·핵심 성과를 숨긴다. (수업은 성과 앵커가 없어 CORE_EXCLUDE 로 제거)
    const { core, sections } = sectionsFor("career")
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

  // detail 섹션을 정의하지 않은 유형은 지금도 범용 확장 카드로 폴백한다.
  // (club 은 FRT-178 에서 자기 detail 섹션을 갖게 되어 더는 이 예시가 아니다.)
  it("비-커스텀 유형(volunteer)은 범용 확장 필드(배경/목표·공개 설정)를 유지한다", () => {
    const { core, sections } = sectionsFor("volunteer")
    const r = computeFormCards(core, sections)
    const all = r.cards.flatMap(c => c.blocks).map(b => b.label)
    expect(all).toContain("배경/목표")
    expect(all).toContain("공개 설정")
  })

  // ── FRT-178: 동아리가 확정본 4카드로 그려지는지 (문서 ①~④) ──
  it("동아리: 4카드가 모두 보이고 범용 확장 카드가 걷힌다", () => {
    const { core, sections } = sectionsFor("club")
    const r = computeFormCards(core, sections)
    expect(r.visibleCategories).toEqual(["basic", "detail", "repeat", "evidence"])

    const all = r.cards.flatMap(c => c.blocks).map(b => b.label)
    // detail 섹션이 생겼으므로 범용 확장 필드는 더 이상 붙지 않는다.
    expect(all).not.toContain("배경/목표")
    expect(all).not.toContain("내가 한 행동")
    expect(all).not.toContain("배운 점")
    // core '기간'·'내 역할/기여도'는 '활동 기간'·'역할 / 직책' 동의어라 숨는다.
    expect(all).not.toContain("기간")
    expect(all).not.toContain("내 역할/기여도")
    // core '핵심 성과'는 CORE_EXCLUDE 로 애초에 없다(② 주요 성과·③ 핵심 성과 컬럼이 대신 묻는다).
    expect(all).not.toContain("핵심 성과")
    // 문서 ④ 활동 증빙 = core 증빙 자료.
    expect(r.cards.find(c => c.category === "evidence")!.blocks.map(b => b.label)).toContain("증빙 자료")
    // 공개 설정은 보존(설정 섹션).
    expect(all).toContain("공개 설정")
  })

  it("동아리 detail 카드는 확정본 5필드 + 공개 설정만 갖는다", () => {
    const { core, sections } = sectionsFor("club")
    const r = computeFormCards(core, sections)
    const detail = r.cards.find(c => c.category === "detail")!
    expect(detail.blocks.map(b => b.label)).toEqual([
      "가입 동기",
      "동아리 소개",
      "주요 활동 / 이벤트",
      "주요 성과",
      "활동 성격",
      "공개 설정",
    ])
  })

  // ── FRT-177: 대외활동이 확정본 4카드로 그려지는지 (문서 ①~④) ──
  it("대외활동: 4카드가 모두 보이고 core 중복 필드는 유형 앵커에 흡수된다", () => {
    const { core, sections } = sectionsFor("extracurricular")
    const r = computeFormCards(core, sections)
    expect(r.visibleCategories).toEqual(["basic", "detail", "repeat", "evidence"])

    const all = r.cards.flatMap(c => c.blocks).map(b => b.label)
    // core '기간'·'내 역할/기여도'는 '활동 기간'·'참여 역할 / 포지션' 동의어라 숨는다.
    expect(all).not.toContain("기간")
    expect(all).not.toContain("내 역할/기여도")
    // core '핵심 성과'는 CORE_EXCLUDE 로 애초에 없다(② 주요 성과·③ 핵심 성과 컬럼이 대신 묻는다).
    expect(all).not.toContain("핵심 성과")
    // 문서 ④ 활동 증빙 = core 증빙 자료(파일+설명+증빙 유형).
    expect(r.cards.find(c => c.category === "evidence")!.blocks.map(b => b.label)).toContain("증빙 자료")
  })

  it("대외활동 detail 카드는 확정본 ② 5필드 + 공개 설정만 갖는다", () => {
    const { core, sections } = sectionsFor("extracurricular")
    const r = computeFormCards(core, sections)
    const labels = r.cards.find(c => c.category === "detail")!.blocks.map(b => b.label)
    expect(labels).toEqual([
      "지원 동기",
      "활동 내용 요약",
      "주요 미션 / 프로젝트",
      "주요 성과",
      "활동 성격",
      "공개 설정",
    ])
    // 범용 확장(buildExtendedSection) 필드는 유형 전용 detail 이 있으므로 부재
    expect(labels).not.toContain("배경/목표")
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

  // 기간 셀은 종료를 먼저 고르면 시작이 빈 채로 저장된다 — 사용자가 방금 고른 값을 잃지
  // 않으려는 의도된 직렬화다. 다만 그 부분 입력이 필수 컬럼을 충족한 것으로 잡히면
  // 진행도가 완료라고 거짓말한다(기간은 시작이 있어야 한 기간이다).
  it("기간 필수 컬럼은 시작 없이 종료만 있으면 완료로 치지 않는다", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    const repeat = r.cards.find(c => c.category === "repeat")!
    const cell = repeat.blocks.find(b => b.value.type === "repeatable-cell")!
    if (cell.value.type !== "repeatable-cell") throw new Error("expected repeatable-cell")

    const withPeriodColumn = {
      ...cell.value,
      columns: [{ key: "period", label: "기간", blockType: "period" as const, required: true }],
    }

    cell.value = { ...withPeriodColumn, rows: [{ id: "row-1", cells: { period: " ~ 2024.01" } }] }
    expect(isCardComplete(repeat)).toBe(false)

    cell.value = { ...withPeriodColumn, rows: [{ id: "row-1", cells: { period: " ~ 현재" } }] }
    expect(isCardComplete(repeat)).toBe(false)

    // 시작이 들어오면 그때 완료다. 종료가 없는 한 토큰짜리 값도 온전한 기간이다.
    cell.value = { ...withPeriodColumn, rows: [{ id: "row-1", cells: { period: "2023.03" } }] }
    expect(isCardComplete(repeat)).toBe(true)

    cell.value = {
      ...withPeriodColumn,
      rows: [{ id: "row-1", cells: { period: "2023.03 ~ 2024.01" } }],
    }
    expect(isCardComplete(repeat)).toBe(true)
  })

  // 텍스트 열을 기간으로 바꾸면 옛 값이 그대로 남는다. 셀은 그 값을 못 그려 빈 칸 + 안내를
  // 띄우는데, 진행도만 "채워짐"이라고 하면 화면과 어긋난다 — 두 판정이 같은 기준을 써야 한다.
  it("기간 필수 컬럼은 달력에 없는 옛 값을 완료로 치지 않는다", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    const repeat = r.cards.find(c => c.category === "repeat")!
    const cell = repeat.blocks.find(b => b.value.type === "repeatable-cell")!
    if (cell.value.type !== "repeatable-cell") throw new Error("expected repeatable-cell")

    const withPeriodColumn = {
      ...cell.value,
      columns: [{ key: "period", label: "기간", blockType: "period" as const, required: true }],
    }

    for (const legacy of ["자유 형식 메모", "2023.13", "2023.13 ~ 2024.01", "작년 봄쯤"]) {
      cell.value = { ...withPeriodColumn, rows: [{ id: "row-1", cells: { period: legacy } }] }
      expect(isCardComplete(repeat), legacy).toBe(false)
    }

    // 일 단위 값은 절삭돼도 시작 월이 실재하므로 기간으로 성립한다.
    cell.value = {
      ...withPeriodColumn,
      rows: [{ id: "row-1", cells: { period: "2023.03.15 ~ 2024.01.20" } }],
    }
    expect(isCardComplete(repeat)).toBe(true)
  })

  // 블록 층위 기간도 같은 부분 입력을 만든다 — `PeriodBlock` 이 `formatPeriodString` 을 거치므로
  // 종료만 고르면 start 가 빈 값으로 저장되고, `isBlockEmpty` 는 둘 중 하나만 있어도 '안 비었다'다.
  it("블록 층위 기간도 시작 없이 종료만 있으면 완료로 치지 않는다", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    const basic = r.cards.find(c => c.category === "basic")!
    fillBlock(basic, "학회명", "한국인공지능학회")
    fillBlock(basic, "역할/직책", "부회장")
    const period = basic.blocks.find(b => b.label === "기간")!

    period.value = { type: "period", start: "", end: "2024-12", isCurrent: false }
    expect(isCardComplete(basic)).toBe(false)

    period.value = { type: "period", start: "", end: "", isCurrent: true }
    expect(isCardComplete(basic)).toBe(false)

    period.value = { type: "period", start: "2024-03", end: "", isCurrent: true }
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

  it("필수 컬럼 repeatable + optional 형제(팀프로젝트 작업 기록): optional 만 채우면 미완료", () => {
    // Codex P2: block.required 는 false 지만 필수 컬럼을 가진 repeatable-cell 은 필수로 취급해야 한다.
    const { core, sections } = sectionsFor("team-project")
    const r = computeFormCards(core, sections)
    const repeat = r.cards.find(c => c.category === "repeat")!
    const cell = repeat.blocks.find(b => b.value.type === "repeatable-cell")!
    const sibling = repeat.blocks.find(b => b.value.type !== "repeatable-cell")!
    if (cell.value.type !== "repeatable-cell") throw new Error("expected repeatable-cell")
    expect(cell.value.columns.some(c => c.required)).toBe(true)
    expect(cell.required).toBeFalsy()
    // optional 형제만 채움 → 필수 컬럼 미충족이므로 여전히 미완료여야 한다
    sibling.value = { type: "textarea", text: "채움" }
    expect(isCardComplete(repeat)).toBe(false)
    // 필수 컬럼을 채운 행이 생기면 완료
    const filled: Record<string, string> = {}
    for (const c of cell.value.columns.filter(c => c.required)) filled[c.key] = "값"
    cell.value = { ...cell.value, rows: [{ id: "row-1", cells: filled }] }
    expect(isCardComplete(repeat)).toBe(true)
  })

  it("FRT-145: 추가 항목만 채우면 필수 컬럼을 대신 충족하지 않는다", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    const repeat = r.cards.find(c => c.category === "repeat")!
    const cell = repeat.blocks.find(b => b.value.type === "repeatable-cell")!
    if (cell.value.type !== "repeatable-cell") throw new Error("expected repeatable-cell")
    expect(cell.value.columns.some(c => c.required)).toBe(true)
    // 사용자가 추가한 항목만 채운 행 — 필수 컬럼(프로젝트명)은 여전히 비어 있다.
    cell.value = {
      ...cell.value,
      rows: [{
        id: "row-1",
        cells: {},
        extraFields: [{ key: "x1", label: "발표 여부", blockType: "text", value: "구두 발표" }],
      }],
    }
    expect(isCardComplete(repeat)).toBe(false)
  })

  it("FRT-145: 필수 컬럼이 없는 반복 블록은 추가 항목만 채워도 완료로 본다", () => {
    // 필수 컬럼이 없으면 판정은 '아무거나 채워졌는가'다 — 그 '아무거나'에 추가 항목도 포함된다
    // (제외하면 사용자가 쓴 값이 진행도에 안 잡힌다).
    const { core, sections } = sectionsFor("education")
    const r = computeFormCards(core, sections)
    const detail = r.cards.find(c => c.category === "detail")!
    const cell = detail.blocks.find(
      b => b.value.type === "repeatable-cell" && !b.value.columns.some(c => c.required),
    )!
    if (cell.value.type !== "repeatable-cell") throw new Error("expected repeatable-cell")
    expect(isCardComplete(detail)).toBe(false)
    cell.value = {
      ...cell.value,
      rows: [{
        id: "row-1",
        cells: {},
        extraFields: [{ key: "x1", label: "참고 자료", blockType: "text", value: "링크" }],
      }],
    }
    expect(isCardComplete(detail)).toBe(true)
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
