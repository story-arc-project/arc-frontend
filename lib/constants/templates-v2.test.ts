import { describe, it, expect } from "vitest"
import { SYSTEM_TEMPLATES_V2, getTemplateForType } from "@/lib/constants/templates-v2"
import type { ExperienceTypeId, Block } from "@/types/archive"

describe("templates-v2 category tagging", () => {
  it("모든 확장 섹션에 category 가 부여된다", () => {
    for (const t of SYSTEM_TEMPLATES_V2) {
      for (const s of t.extensions) {
        expect(s.category, `${t.typeId}/${s.id}`).toBeDefined()
      }
      expect(t.commonCore.category).toBe("basic")
    }
  })

  it("첫 type-specific(info) 섹션은 basic, 나머지는 repeat 또는 유형 전용 detail 이다", () => {
    // 유형이 자기 '경험 상세'(detail) 섹션을 소유하면 범용 확장 섹션 대신 그 섹션을 쓴다(FRT-90 3차).
    for (const t of SYSTEM_TEMPLATES_V2) {
      const typeSections = t.extensions.filter(s => s.id !== "extended")
      expect(typeSections[0].category, `${t.typeId} info`).toBe("basic")
      for (const s of typeSections.slice(1)) {
        expect(["repeat", "detail"], `${t.typeId}/${s.id}`).toContain(s.category)
      }
    }
  })

  it("유형 전용 detail 섹션을 가지면 범용 extended 대신 설정 섹션(공개 설정만)을 쓴다", () => {
    const t = getTemplateForType("academic-society")
    const hasCustomDetail = t.extensions.some(s => s.id !== "extended" && s.category === "detail")
    expect(hasCustomDetail).toBe(true)
    const ext = t.extensions.find(s => s.id === "extended")!
    expect(ext.blocks.map(b => b.label)).toEqual(["공개 설정"])
  })

  it("extended 섹션은 detail 이다", () => {
    for (const t of SYSTEM_TEMPLATES_V2) {
      const ext = t.extensions.find(s => s.id === "extended")
      expect(ext?.category).toBe("detail")
    }
  })

  it("core 블록 category: 기간=basic, 역할/성과=detail, 증빙=evidence, 제목/요약 미지정", () => {
    const core = getTemplateForType("career").commonCore.blocks
    const byLabel = (l: string) => core.find(b => b.label === l)
    expect(byLabel("경험명")?.category).toBeUndefined()
    expect(byLabel("한 줄 요약")?.category).toBeUndefined()
    expect(byLabel("기간")?.category).toBe("basic")
    expect(byLabel("내 역할/기여도")?.category).toBe("detail")
    expect(byLabel("핵심 성과")?.category).toBe("detail")
    expect(byLabel("증빙 자료")?.category).toBe("evidence")
  })
})

// 프로토타입 확정본(2026-07) 반영 — 인턴·수업·대외활동을 학회(FRT-90) 패턴으로 재정의.
describe("프로토타입 확정본: 인턴·수업·대외활동", () => {
  const CASES: ExperienceTypeId[] = ["career", "education", "extracurricular"]

  const sectionsOf = (typeId: ExperienceTypeId) =>
    getTemplateForType(typeId).extensions.filter(s => s.id !== "extended")
  const detailOf = (typeId: ExperienceTypeId) =>
    sectionsOf(typeId).find(s => s.category === "detail")
  const repeatOf = (typeId: ExperienceTypeId) =>
    sectionsOf(typeId).find(s => s.category === "repeat")
  const labelsIn = (blocks: Block[]) => blocks.map(b => b.label)

  it.each(CASES)("%s 는 유형 전용 detail 섹션을 소유한다 (extended 는 공개 설정만)", typeId => {
    expect(detailOf(typeId), `${typeId} detail`).toBeDefined()
    const ext = getTemplateForType(typeId).extensions.find(s => s.id === "extended")!
    expect(ext.blocks.map(b => b.label)).toEqual(["공개 설정"])
  })

  it.each(CASES)("%s 는 basic·detail·repeat 3섹션 구조다", typeId => {
    const cats = sectionsOf(typeId).map(s => s.category)
    expect(cats).toContain("basic")
    expect(cats).toContain("detail")
    expect(cats).toContain("repeat")
  })

  it("인턴 ① 기본 정보에 산업·직무·근무형태·상태 식별 필드가 있다", () => {
    const info = sectionsOf("career")[0]
    const labels = labelsIn(info.blocks)
    expect(labels).toContain("회사명")
    expect(labels).toContain("산업 / 회사 종류")
    expect(labels).toContain("직무 / 포지션")
    expect(labels).toContain("근무 형태")
    expect(labels).toContain("상태")
    // 상태·근무형태는 라디오 → single-select 로 근사
    expect(info.blocks.find(b => b.label === "상태")?.type).toBe("single-select")
  })

  it("인턴 ② 상세는 개조식 성과 필드를 갖고, '나의 담당 업무 / 주요 성과'는 ③으로 연결된다", () => {
    const detail = detailOf("career")!
    const outcome = detail.blocks.filter(b => b.variant === "outcome-list")
    expect(outcome.length).toBeGreaterThanOrEqual(2)
    const mine = detail.blocks.find(b => b.label === "나의 담당 업무 / 주요 성과")
    expect(mine?.variant).toBe("outcome-list")
    expect(mine?.linkConfig?.targetSectionId).toBe("career-tasks")
    // 확정 가이드가 반영된 필드
    const team = detail.blocks.find(b => b.label === "팀이 진행한 프로젝트 / 업무")
    expect(team?.guide).toContain("팀이 함께 움직인 일")
  })

  it("인턴 ③ 반복 기록에 '어려움 / 문제 해결' 컬럼이 신규로 있다", () => {
    const repeat = repeatOf("career")!
    const cell = repeat.blocks.find(b => b.value.type === "repeatable-cell")!
    const colLabels =
      cell.value.type === "repeatable-cell" ? cell.value.columns.map(c => c.label) : []
    expect(colLabels).toContain("어려움 / 문제 해결")
  })

  it("수업 ① 은 강좌 단위 — 강좌명·학년·학기 드롭다운이 있고 전공/재학상태는 없다", () => {
    const info = sectionsOf("education")[0]
    const labels = labelsIn(info.blocks)
    expect(labels).toContain("강좌명")
    expect(labels).toContain("학년")
    expect(labels).toContain("학기")
    expect(labels).not.toContain("전공")
    expect(labels).not.toContain("재학/졸업 상태")
    expect(info.blocks.find(b => b.label === "학년")?.type).toBe("single-select")
  })

  it("수업 ② 상세는 3필드(수강 동기·수업 요약·가장 중요했던 내용)다", () => {
    const detail = detailOf("education")!
    const labels = labelsIn(detail.blocks)
    expect(labels).toEqual(["수강 동기", "수업 요약", "가장 중요했던 내용"])
    // '가장 중요했던 내용' = 소제목+설명 2컬럼 블록반복
    const important = detail.blocks.find(b => b.label === "가장 중요했던 내용")!
    expect(important.value.type).toBe("repeatable-cell")
    if (important.value.type === "repeatable-cell") {
      expect(important.value.columns.length).toBe(2)
    }
  })

  it("대외활동 ① 은 활동 유형·기수·주최·주관·규모 식별 필드를 갖는다", () => {
    const info = sectionsOf("extracurricular")[0]
    const labels = labelsIn(info.blocks)
    expect(labels).toContain("활동 유형")
    expect(labels).toContain("기수 / 차수")
    expect(labels).toContain("주최")
    expect(labels).toContain("주관 / 후원")
    expect(labels).toContain("활동 규모")
    expect(info.blocks.find(b => b.label === "활동 유형")?.type).toBe("single-select")
  })

  it("수업은 core 기간·역할/기여도·핵심 성과·증빙 자료를 노출하지 않는다 (강좌 단위 간소화)", () => {
    const coreLabels = getTemplateForType("education").commonCore.blocks.map(b => b.label)
    expect(coreLabels).toContain("경험명")
    expect(coreLabels).toContain("한 줄 요약")
    expect(coreLabels).not.toContain("기간")
    expect(coreLabels).not.toContain("내 역할/기여도")
    expect(coreLabels).not.toContain("핵심 성과")
    expect(coreLabels).not.toContain("증빙 자료")
  })

  it("대외활동은 core 핵심 성과를 노출하지 않는다 (성과 개조식 없음)", () => {
    const coreLabels = getTemplateForType("extracurricular").commonCore.blocks.map(b => b.label)
    expect(coreLabels).not.toContain("핵심 성과")
    // 기간·역할은 유형 섹션(활동 기간·참여 역할)이 있어 core 를 유지해도 dedup 되므로 core 에 남는다.
    expect(coreLabels).toContain("증빙 자료")
  })

  it("인턴은 core 필드를 그대로 유지한다 (유형 섹션 동의어로 dedup 처리)", () => {
    const coreLabels = getTemplateForType("career").commonCore.blocks.map(b => b.label)
    expect(coreLabels).toContain("기간")
    expect(coreLabels).toContain("내 역할/기여도")
    expect(coreLabels).toContain("핵심 성과")
    expect(coreLabels).toContain("증빙 자료")
  })

  it("대외활동 ②·③ 은 수업과 동일한 최소 구조(② 3필드 / ③ 4컬럼)다", () => {
    const detail = detailOf("extracurricular")!
    expect(detail.blocks.length).toBe(3)
    const repeat = repeatOf("extracurricular")!
    const cell = repeat.blocks.find(b => b.value.type === "repeatable-cell")!
    if (cell.value.type === "repeatable-cell") {
      expect(cell.value.columns.length).toBe(4)
      expect(cell.value.columns.some(c => c.required)).toBe(true)
    }
  })
})
