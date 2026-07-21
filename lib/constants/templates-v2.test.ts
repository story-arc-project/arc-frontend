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

  it("인턴 ① 기본 정보에 산업·직무·근무형태가 있고, '상태'는 폼 필드가 아니라 없다", () => {
    const info = sectionsOf("career")[0]
    const labels = labelsIn(info.blocks)
    expect(labels).toContain("회사명")
    expect(labels).toContain("산업 / 회사 종류")
    expect(labels).toContain("직무 / 포지션")
    expect(labels).toContain("근무 형태")
    // 근무 형태는 라디오 → single-select 로 근사
    expect(info.blocks.find(b => b.label === "근무 형태")?.type).toBe("single-select")
    // '진행 중/완료'는 임시저장인지 입력완료인지를 가리는 개념이지 입력 항목이 아니다(FRT-135).
    expect(labels).not.toContain("상태")
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

  it("수업 ① 은 강좌 단위 — 이수 시기가 연도+학기이고 전공/재학상태·학년은 없다", () => {
    const info = sectionsOf("education")[0]
    const labels = labelsIn(info.blocks)
    expect(labels).toContain("강좌명")
    expect(labels).toContain("이수 연도")
    expect(labels).toContain("학기")
    expect(labels).not.toContain("전공")
    expect(labels).not.toContain("재학/졸업 상태")
    // 문서가 폐기한 '학년' 개념은 사라졌다(FRT-135).
    expect(labels).not.toContain("학년")
    expect(info.blocks.find(b => b.label === "이수 연도")?.type).toBe("single-select")
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

  // ── FRT-135: 문서 확정본 1:1 대조 ────────────────────────────────
  //
  // 문서와 코드가 충돌하면 문서가 맞다. 여기 기대값의 출처는 Notion
  // 「아카이빙 입력항목 set 대거 수정 1차」 > 완성된 입력항목 및 가이드라인 기획 내용.

  const columnsOf = (typeId: ExperienceTypeId, sectionId: string, blockLabel: string) => {
    const section = getTemplateForType(typeId).extensions.find(s => s.id === sectionId)!
    const block = section.blocks.find(b => b.label === blockLabel)!
    return block.value.type === "repeatable-cell" ? block.value.columns : []
  }

  it("수업 ① 은 학과/학부·학위 과정·수업 분류·강의계획서를 묻고 공식 URL 은 묻지 않는다", () => {
    const labels = labelsIn(sectionsOf("education")[0].blocks)
    expect(labels).toContain("학과 / 학부")
    expect(labels).toContain("학위 과정")
    expect(labels).toContain("수업 분류")
    expect(labels).toContain("강의계획서 첨부")
    // 문서에 없는 필드는 싣지 않는다.
    expect(labels).not.toContain("공식 URL")
  })

  it("수업 이수 연도는 2026년~2000년 27개, 학기·성적 선택지는 문서 문구를 쓴다", () => {
    const info = sectionsOf("education")[0]
    const optionsOf = (label: string) => info.blocks.find(b => b.label === label)?.options ?? []

    // 상한은 현재 연도(문서 기준연도 2026 이 하한) — 해가 바뀌어도 올해를 고를 수 있어야 한다.
    const newest = Math.max(2026, new Date().getFullYear())
    const years = optionsOf("이수 연도")
    expect(years[0]).toBe(`${newest}년`)
    expect(years[years.length - 1]).toBe("2000년")
    expect(years).toHaveLength(newest - 2000 + 1)

    expect(optionsOf("학기")).toEqual(["1학기", "여름 계절학기", "2학기", "겨울 계절학기"])

    const grades = optionsOf("성적")
    expect(grades).toContain("C-")
    expect(grades).toContain("D+")
    expect(grades).toContain("P (Pass)")
    expect(grades).toContain("NP (Non-Pass)")
    expect(grades).not.toContain("P/NP")
  })

  it("수업 ③ 은 '내가 한 일'을 묻고 프로젝트 유형 라벨이 문서 표기다", () => {
    const columns = columnsOf("education", "edu-projects", "프로젝트 / 과제 / 제작물")
    expect(columns.map(c => c.label)).toContain("내가 한 일")
    const typeOptions = columns.find(c => c.key === "type")?.options ?? []
    expect(typeOptions).toContain("학기말 프로젝트")
    expect(typeOptions).toContain("중간 과제")
    expect(typeOptions).toContain("기말 과제")
  })

  it("학회 증빙은 활동 증빙 한 곳뿐 — 기본 정보에 '활동 인증서'를 중복해 두지 않는다", () => {
    const infoLabels = labelsIn(sectionsOf("academic-society")[0].blocks)
    expect(infoLabels).not.toContain("활동 인증서")
    // 대신 core 증빙 자료가 활동 증빙 카드를 담당한다(파일+설명+증빙 유형).
    const coreLabels = getTemplateForType("academic-society").commonCore.blocks.map(b => b.label)
    expect(coreLabels).toContain("증빙 자료")
  })

  it("학회 ③ 은 문서 순서·필수·컬럼 구성을 그대로 따른다", () => {
    const columns = columnsOf("academic-society", "society-projects", "프로젝트/연구활동")
    expect(columns.map(c => c.key)).toEqual([
      "name", "role", "period", "goal", "work", "result", "difficulty", "output",
    ])
    const required = columns.filter(c => c.required).map(c => c.key)
    // 문서상 필수: 프로젝트명·직책/역할·세부 기간·내가 한 일·핵심 성과
    expect(required).toEqual(["name", "role", "period", "work", "result"])
    // 문서에 없던 두 컬럼은 제거됐다.
    const labels = columns.map(c => c.label)
    expect(labels).not.toContain("발표/포스터/세미나 여부")
    expect(labels).not.toContain("피드백/질문과 대응")
  })

  it("인턴 '협업 / 팀원'은 여러 줄 입력이고 문서 가이드·예시를 갖는다", () => {
    const block = detailOf("career")!.blocks.find(b => b.label === "협업 / 팀원")!
    expect(block.type).toBe("textarea")
    expect(block.guide).toContain("사수, 매니저")
    expect(block.placeholder).toContain("위클리 미팅")
  })
})
