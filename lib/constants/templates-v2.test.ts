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

  it("첫 type-specific(info) 섹션은 basic, 나머지는 repeat·detail·evidence 다", () => {
    // 유형이 자기 '경험 상세'(detail) 섹션을 소유하면 범용 확장 섹션 대신 그 섹션을 쓴다(FRT-90 3차).
    // evidence 는 수상경력(FRT-211)이 처음 소유한다 — core '증빙 자료' 파일 블록 옆에 유형 고유의
    // 증빙 입력('관련 링크')을 더해야 하는 첫 사례다. core 증빙이 evidence 버킷에 먼저 들어가므로
    // (form-cards.ts) 카드 순서는 [증빙 자료, 관련 링크] 로 확정본 ③ 순서와 맞는다.
    for (const t of SYSTEM_TEMPLATES_V2) {
      const typeSections = t.extensions.filter(s => s.id !== "extended")
      expect(typeSections[0].category, `${t.typeId} info`).toBe("basic")
      for (const s of typeSections.slice(1)) {
        expect(["repeat", "detail", "evidence"], `${t.typeId}/${s.id}`).toContain(s.category)
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

  it("대외활동은 core 핵심 성과를 노출하지 않는다 (② 주요 성과·③ 핵심 성과 컬럼이 대신 묻는다)", () => {
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

  // ── FRT-177: 대외활동 문서 확정본 1:1 대조 ──────────────────────
  //
  // 출처: Notion 「완성된 입력항목 및 가이드라인 기획 내용」 > 대외활동 — 입력항목 명세.

  it("대외활동 ② 는 문서 5필드 순서 그대로다 ('가장 중요했던 경험'은 폐기)", () => {
    const detail = detailOf("extracurricular")!
    expect(labelsIn(detail.blocks)).toEqual([
      "지원 동기",
      "활동 내용 요약",
      "주요 미션 / 프로젝트",
      "주요 성과",
      "활동 성격",
    ])
  })

  it("대외활동 ② '주요 미션 / 프로젝트'는 개조식이고 ③ 표로 연결된다", () => {
    const detail = detailOf("extracurricular")!
    const missions = detail.blocks.find(b => b.label === "주요 미션 / 프로젝트")!
    expect(missions.variant).toBe("outcome-list")
    expect(missions.linkConfig).toEqual({
      targetSectionId: "extra-missions",
      titleColumnKey: "name",
      label: "프로젝트로 기록",
    })
    // 연결 대상 섹션·컬럼이 실제로 존재해야 버튼이 행을 만든다(없으면 조용히 미연결).
    const target = getTemplateForType("extracurricular").extensions.find(s => s.id === "extra-missions")!
    const cell = target.blocks.find(b => b.value.type === "repeatable-cell")!
    if (cell.value.type === "repeatable-cell") {
      expect(cell.value.columns.some(c => c.key === "name")).toBe(true)
    }
    expect(detail.blocks.find(b => b.label === "주요 성과")?.variant).toBe("outcome-list")
  })

  it("대외활동 '활동 성격'은 이모티콘 태그 12종 프리셋 (저장은 checklist)", () => {
    const mood = detailOf("extracurricular")!.blocks.find(b => b.label === "활동 성격")!
    expect(mood.type).toBe("checklist")
    expect(mood.variant).toBe("mood-tag")
    expect(mood.value.type).toBe("checklist")
    if (mood.value.type === "checklist") {
      expect(mood.value.options).toHaveLength(12)
      expect(mood.value.options[0]).toBe("🎨 창의적 표현")
      expect(mood.value.options).toContain("💡 아이디어 발산")
      expect(mood.value.checked).toEqual([])
    }
  })

  it("대외활동 ③ 은 문서 7컬럼 순서·필수를 따른다", () => {
    const columns = columnsOf("extracurricular", "extra-missions", "미션 / 프로젝트")
    expect(columns.map(c => c.key)).toEqual([
      "name", "type", "description", "work", "result", "difficulty", "output",
    ])
    // 문서상 필수: 프로젝트명·유형
    expect(columns.filter(c => c.required).map(c => c.key)).toEqual(["name", "type"])
    expect(columns.every(c => Boolean(c.guide))).toBe(true)
  })

  it("대외활동 ① 선택지는 문서 표기를 그대로 쓴다 (활동 유형 11종·규모 6종)", () => {
    const info = sectionsOf("extracurricular")[0]
    const optionsOf = (label: string) => info.blocks.find(b => b.label === label)?.options ?? []
    const types = optionsOf("활동 유형")
    expect(types).toHaveLength(11)
    expect(types).toContain("공모전 / 경진대회")
    expect(types).toContain("기자단 / 에디터")
    expect(types).toContain("해외 프로그램 / 교환")
    expect(optionsOf("활동 규모")).toEqual([
      "10명 미만", "10~30명", "30~100명", "100~300명", "300명 이상", "잘 모름",
    ])
  })

  it("대외활동 모든 입력 필드에 가이드라인이 붙어 있다", () => {
    const blocks = sectionsOf("extracurricular").flatMap(s => s.blocks)
    // 반복 블록은 컬럼마다 guide 를 갖고, 블록 자체 안내는 카드 설명이 맡는다
    // (SECTION_DESCRIPTION_OVERRIDES) — 둘 다 실으면 같은 문장이 두 번 나온다.
    const fields = blocks.filter(b => b.value.type !== "repeatable-cell")
    expect(fields.filter(b => !b.guide).map(b => b.label)).toEqual([])
    // 개조식(outcome-list)은 repeatable-cell 이지만 한 줄 입력이라 블록 guide 를 쓴다.
    const outcomeLists = blocks.filter(b => b.variant === "outcome-list")
    expect(outcomeLists).toHaveLength(2)
    expect(outcomeLists.filter(b => !b.guide).map(b => b.label)).toEqual([])
  })

  // ── FRT-178: 동아리 문서 확정본 1:1 대조 ────────────────────────
  //
  // 출처: Notion 「완성된 입력항목 및 가이드라인 기획 내용」 > 동아리 / 교내 단체 — 입력항목 명세.

  it("동아리 ① 은 문서 9필드 순서 그대로다 (역할 이력 포함)", () => {
    const info = sectionsOf("club")[0]
    expect(labelsIn(info.blocks)).toEqual([
      "동아리 / 단체명",
      "단체 유형",
      "소속 학교",
      "학과 / 학부",
      "소속 단위",
      "활동 기간",
      "역할 / 직책",
      "역할 이력",
      "활동 규모",
      "공식 URL",
    ])
    // 문서상 필수: 단체명·단체 유형·활동 기간 (구 정의의 '직책/역할 필수'는 확정본에서 선택)
    expect(info.blocks.filter(b => b.required).map(b => b.label)).toEqual([
      "동아리 / 단체명",
      "단체 유형",
      "활동 기간",
    ])
  })

  it("동아리 ① '역할 이력'은 기간+역할명 반복 입력이고 잠겨 있다", () => {
    const history = sectionsOf("club")[0].blocks.find(b => b.label === "역할 이력")!
    expect(history.variant).toBe("role-history")
    expect(history.lockColumns).toBe(true)
    if (history.value.type === "repeatable-cell") {
      expect(history.value.columns.map(c => c.key)).toEqual(["start", "end", "role"])
    }
  })

  it("동아리 ② 는 문서 5필드 순서 그대로다", () => {
    const detail = detailOf("club")!
    expect(labelsIn(detail.blocks)).toEqual([
      "가입 동기",
      "동아리 소개",
      "주요 활동 / 이벤트",
      "주요 성과",
      "활동 성격",
    ])
  })

  it("동아리 ② 개조식 2종은 역할 태그를 켜고, '주요 활동 / 이벤트'는 ③ 표로 연결된다", () => {
    const detail = detailOf("club")!
    const activities = detail.blocks.find(b => b.label === "주요 활동 / 이벤트")!
    expect(activities.variant).toBe("outcome-list")
    expect(activities.roleTags).toBe(true)
    expect(activities.linkConfig).toEqual({
      targetSectionId: "club-activities",
      titleColumnKey: "name",
      label: "프로젝트로 기록",
    })
    // 연결 대상 섹션·컬럼이 실제로 존재해야 버튼이 행을 만든다(없으면 조용히 미연결).
    const target = getTemplateForType("club").extensions.find(s => s.id === "club-activities")!
    const cell = target.blocks.find(b => b.value.type === "repeatable-cell")!
    if (cell.value.type === "repeatable-cell") {
      expect(cell.value.columns.some(c => c.key === "name")).toBe(true)
    }
    const results = detail.blocks.find(b => b.label === "주요 성과")!
    expect(results.variant).toBe("outcome-list")
    expect(results.roleTags).toBe(true)
    // 링크는 '주요 활동 / 이벤트'만 — 성과 행에서 프로젝트를 만들면 제목이 성과 문장이 된다.
    expect(results.linkConfig).toBeUndefined()
  })

  it("FRT-145: 프로젝트 기록 블록만 행에 '항목 추가'를 연다", () => {
    // 켠 곳 — 확정본이 '블록 안에서 항목 추가'를 말한 프로젝트/활동 기록 5종.
    const enabled: [ExperienceTypeId, string][] = [
      ["academic-society", "society-projects.프로젝트/연구활동"],
      ["education", "edu-projects.프로젝트 / 과제 / 제작물"],
      ["extracurricular", "extra-missions.미션 / 프로젝트"],
      ["club", "club-activities.활동 / 이벤트"],
      ["career", "career-tasks.프로젝트/담당 업무"],
    ]
    for (const [typeId, key] of enabled) {
      const block = getTemplateForType(typeId).extensions.flatMap(s => s.blocks).find(b => b.key === key)
      expect(block, `${typeId} 의 ${key} 블록이 있어야 한다`).toBeDefined()
      expect(block!.allowRowExtras, `${key} 는 항목 추가를 켠다`).toBe(true)
      // 열 잠금과 함께 켜진다 — 열은 계속 템플릿이 소유한다(FRT-104 유지).
      expect(block!.lockColumns).toBe(true)
    }
    // 끈 곳 — 같은 유형 안의 다른 반복 블록에는 붙지 않는다(기본 off).
    const importantContent = getTemplateForType("education")
      .extensions.flatMap(s => s.blocks)
      .find(b => b.label === "가장 중요했던 내용")
    expect(importantContent?.allowRowExtras).toBeUndefined()
  })

  it("동아리 '활동 성격'은 대외활동과 다른 12종 프리셋을 쓴다", () => {
    const mood = detailOf("club")!.blocks.find(b => b.label === "활동 성격")!
    expect(mood.type).toBe("checklist")
    expect(mood.variant).toBe("mood-tag")
    if (mood.value.type === "checklist") {
      expect(mood.value.options).toHaveLength(12)
      expect(mood.value.options[0]).toBe("🎨 창작 / 예술")
      expect(mood.value.options).toContain("🏛️ 자치 / 대표")
      // 대외활동 프리셋(창의적 표현·아이덴티티가 아닌 성격 축)과 섞이지 않는다.
      expect(mood.value.options).not.toContain("🎨 창의적 표현")
      expect(mood.value.checked).toEqual([])
    }
  })

  it("동아리 ③ 은 문서 8컬럼 순서·필수를 따르고 첫 컬럼이 역할 칩이다", () => {
    const columns = columnsOf("club", "club-activities", "활동 / 이벤트")
    expect(columns.map(c => c.key)).toEqual([
      "role", "name", "type", "detail", "work", "result", "difficulty", "output",
    ])
    expect(columns[0].label).toBe("이 활동 때의 역할")
    expect(columns[0].variant).toBe("role-chip")
    // 역할 칩의 선택지는 '역할 이력'에서 파생된다 — 여기 상수 옵션을 두면 안 된다.
    expect(columns[0].options).toBeUndefined()
    // 문서상 필수: 프로젝트명·유형
    expect(columns.filter(c => c.required).map(c => c.key)).toEqual(["name", "type"])
    expect(columns.every(c => Boolean(c.guide))).toBe(true)
  })

  it("동아리 ① 선택지는 문서 표기를 그대로 쓴다 (단체 유형 10종·소속 단위 6종·규모 6종)", () => {
    const info = sectionsOf("club")[0]
    const optionsOf = (label: string) => info.blocks.find(b => b.label === label)?.options ?? []
    const types = optionsOf("단체 유형")
    expect(types).toHaveLength(10)
    expect(types).toContain("공연 / 예술 (밴드·연극·댄스 등)")
    expect(types).toContain("자치회 / 학생회")
    expect(types).toContain("연합 동아리")
    expect(optionsOf("소속 단위")).toEqual([
      "중앙 동아리", "단과대 동아리", "학과 (과 동아리)", "연합 동아리", "학생회", "기타",
    ])
    // 규모 구간이 대외활동(30~100/100~300/300명 이상)과 다르다 — 동아리는 부원 규모다.
    expect(optionsOf("활동 규모")).toEqual([
      "10명 미만", "10~30명", "30~50명", "50~100명", "100명 이상", "잘 모름",
    ])
  })

  it("동아리 모든 입력 필드에 가이드라인이 붙어 있다", () => {
    const blocks = sectionsOf("club").flatMap(s => s.blocks)
    const fields = blocks.filter(b => b.value.type !== "repeatable-cell")
    expect(fields.filter(b => !b.guide).map(b => b.label)).toEqual([])
    // 개조식 2종 + 역할 이력은 repeatable-cell 이지만 블록 guide 를 쓴다(한 줄/패널 입력).
    const guided = blocks.filter(b => b.variant === "outcome-list" || b.variant === "role-history")
    expect(guided).toHaveLength(3)
    expect(guided.filter(b => !b.guide).map(b => b.label)).toEqual([])
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

  // ─── 자격증 (FRT-179) ───
  // 확정본은 ① 자격증 정보 · ② 취득 배경 · ③ 자격증 증빙 3섹션이고 **반복 기록 섹션이 없다**.
  // 다른 유형과 달리 필드 추가가 아니라 섹션을 하나 없애는 구조 변경이라 회귀 위험이 크다.

  it("자격증 ① 은 문서 6필드 순서 그대로다", () => {
    const info = sectionsOf("certification")[0]
    expect(info.category).toBe("basic")
    expect(labelsIn(info.blocks)).toEqual([
      "자격증명",
      "자격증 분야",
      "등급/급수",
      "발급 기관",
      "취득일",
      "유효기간",
    ])
    // 문서에서 '(선택, 필드 삭제 가능)' 표기가 없는 4개가 필수다.
    expect(info.blocks.filter(b => b.required).map(b => b.label)).toEqual([
      "자격증명",
      "자격증 분야",
      "발급 기관",
      "취득일",
    ])
    expect(info.blocks.find(b => b.label === "취득일")?.type).toBe("date")
    expect(info.blocks.find(b => b.label === "유효기간")?.type).toBe("date")
  })

  it("자격증 분야 선택지는 문서 표기 20종을 그대로 쓴다", () => {
    const field = sectionsOf("certification")[0].blocks.find(b => b.label === "자격증 분야")!
    expect(field.type).toBe("single-select")
    expect(field.options).toHaveLength(20)
    expect(field.options?.[0]).toBe("IT/개발")
    expect(field.options).toContain("금융/투자(CFA 등)")
    expect(field.options).toContain("디자인/크리에이티브(GTQ 등)")
    expect(field.options?.at(-1)).toBe("기타")
  })

  it("자격증 ② 취득 배경은 문서 3필드이고 전부 여러 줄 입력이다", () => {
    const detail = detailOf("certification")!
    expect(labelsIn(detail.blocks)).toEqual(["취득 동기", "준비 기간/방법", "활용 계획"])
    expect(detail.blocks.every(b => b.type === "textarea")).toBe(true)
  })

  it("자격증은 반복 기록 섹션이 없다 — '실무 적용 사례' 표는 확정본에 없다", () => {
    expect(repeatOf("certification")).toBeUndefined()
    const labels = sectionsOf("certification").flatMap(s => labelsIn(s.blocks))
    expect(labels).not.toContain("실무 적용 사례")
  })

  it("자격증 증빙은 core 증빙 자료 한 곳뿐 — 증빙 유형은 문서 4종 드롭다운이다", () => {
    // FileBlock 이 이미 파일+설명+증빙 유형을 담으므로 별도 '파일 설명'·'증빙 유형' 블록을
    // 만들면 같은 입력칸이 두 벌 생긴다. 학회와 같은 원칙 — 증빙은 한 곳뿐.
    const sectionLabels = sectionsOf("certification").flatMap(s => labelsIn(s.blocks))
    expect(sectionLabels).not.toContain("자격증 증빙")
    expect(sectionLabels).not.toContain("증빙 유형")
    expect(sectionLabels).not.toContain("파일 설명")

    const evidence = getTemplateForType("certification").commonCore.blocks.find(
      b => b.label === "증빙 자료",
    )!
    expect(evidence.options).toEqual([
      "합격증/자격증 사본",
      "성적표/점수 확인서",
      "발급 확인서",
      "기타",
    ])
  })

  it("자격증은 core 기간·역할/기여도·핵심 성과를 노출하지 않는다 (확정본에 없다)", () => {
    const coreLabels = getTemplateForType("certification").commonCore.blocks.map(b => b.label)
    expect(coreLabels).not.toContain("기간")
    expect(coreLabels).not.toContain("내 역할/기여도")
    expect(coreLabels).not.toContain("핵심 성과")
    // 증빙 자료는 남긴다 — ③ 자격증 증빙 카드가 이 블록이다.
    expect(coreLabels).toContain("증빙 자료")
  })

  it("자격증은 유형 전용 detail 섹션을 소유한다 (extended 는 공개 설정만)", () => {
    expect(detailOf("certification")).toBeDefined()
    const ext = getTemplateForType("certification").extensions.find(s => s.id === "extended")!
    expect(ext.blocks.map(b => b.label)).toEqual(["공개 설정"])
  })

  it("자격증 모든 입력 필드에 가이드라인이 붙어 있다", () => {
    for (const s of sectionsOf("certification")) {
      for (const b of s.blocks) {
        expect(b.guide, `${s.id}/${b.label}`).toBeTruthy()
      }
    }
  })

  it("확정본에 없는 구 필드는 템플릿에서 사라진다 (값은 매퍼가 orphan 으로 보존)", () => {
    const labels = sectionsOf("certification").flatMap(s => labelsIn(s.blocks))
    for (const gone of [
      "자격 번호",
      "학습 방식",
      "핵심 공부 자료",
      "준비 기간",
      "성적/등급",
      "유효기간/갱신 필요 여부",
    ]) {
      expect(labels, gone).not.toContain(gone)
    }
  })

  // ── 수상경력 확정본 (FRT-211) ──────────────────────────────────
  // Notion 「완성된 입력항목 및 가이드라인 기획 내용」 → 수상경력_final 과 1:1 대조.

  it("수상경력 ① 은 문서 11필드 순서 그대로다", () => {
    expect(labelsIn(sectionsOf("award")[0].blocks)).toEqual([
      "대회 / 프로그램명",
      "대회 유형",
      "수상 훈격",
      "주최 기관",
      "수상일",
      "참가 규모 / 경쟁률",
      "개인 / 팀",
      "팀에서 내가 맡은 역할",
      "지원 동기",
      "수상 내용 / 배경",
      "상금 / 부상",
    ])
  })

  it("수상경력 ① 의 필수는 문서가 '선택'을 표기하지 않은 5필드뿐이다", () => {
    const required = sectionsOf("award")[0]
      .blocks.filter(b => b.required)
      .map(b => b.label)
    expect(required).toEqual(["대회 / 프로그램명", "대회 유형", "수상 훈격", "주최 기관", "수상일"])
  })

  it("수상경력 '대회 유형' 선택지는 문서 6종 표기를 그대로 쓴다", () => {
    const block = sectionsOf("award")[0].blocks.find(b => b.label === "대회 유형")!
    expect(block.options).toEqual([
      "공모전/경진대회",
      "학술상/논문상",
      "장학상",
      "성적 우수상(학기별 우수 등)",
      "대외 활동 시상",
      "기타",
    ])
  })

  it("수상경력 '개인 / 팀' 선택지는 문서 3종이다", () => {
    const block = sectionsOf("award")[0].blocks.find(b => b.label === "개인 / 팀")!
    expect(block.options).toEqual(["개인 수상", "팀 수상 (2~5명)", "팀 수상 (6명 이상)"])
  })

  it("'팀에서 내가 맡은 역할'은 '팀 수상'으로 시작할 때만 보이는 조건부 필드다", () => {
    const role = sectionsOf("award")[0].blocks.find(b => b.label === "팀에서 내가 맡은 역할")!
    expect(role.visibleWhen?.startsWith).toEqual(["팀 수상"])
  })

  /**
   * 안정키는 `withSectionKeys` 가 `${sectionId}.${label}` 로 만든다 — 즉 **라벨을 바꾸면 트리거 키도
   * 바뀐다**. `visibleWhen.key` 는 문자열 상수라 자동으로 따라가지 않으므로, 갱신을 잊으면 조건이
   * 영원히 미충족이 되어 필드가 아예 안 보인다(화면에서 조용히 사라진다). 이 테스트가 유일한 방어선.
   */
  it("조건부 필드의 트리거 키는 '개인 / 팀'의 실제 안정키와 일치한다", () => {
    const blocks = sectionsOf("award")[0].blocks
    const role = blocks.find(b => b.label === "팀에서 내가 맡은 역할")!
    const trigger = blocks.find(b => b.label === "개인 / 팀")!
    expect(role.visibleWhen?.key).toBe(trigger.key)
  })

  it("수상경력 ② 는 문서 2필드이고 둘 다 여러 줄 입력이다", () => {
    const detail = detailOf("award")!
    expect(labelsIn(detail.blocks)).toEqual(["준비 과정", "기억에 남는 순간 / 배운 점"])
    expect(detail.blocks.every(b => b.type === "textarea")).toBe(true)
  })

  it("수상경력에는 반복 기록 섹션이 없다", () => {
    expect(repeatOf("award")).toBeUndefined()
  })

  /**
   * ③ 은 '관련 링크'만 블록이다 — 파일·파일 설명·증빙 유형은 core '증빙 자료' FileBlock 하나가
   * 함께 담는다. 블록으로 쪼개면 입력칸이 두 벌 생긴다(FRT-179 최대 교훈).
   */
  it("수상경력 ③ 은 관련 링크 한 필드뿐 — 파일·설명·증빙 유형은 core 증빙 자료가 담는다", () => {
    const evidence = sectionsOf("award").find(s => s.category === "evidence")!
    expect(labelsIn(evidence.blocks)).toEqual(["관련 링크"])

    const core = getTemplateForType("award").commonCore.blocks
    const file = core.find(b => b.label === "증빙 자료")!
    expect(file.type).toBe("file")
    expect(file.options).toEqual([
      "상장 원본/사본",
      "트로피·상패 사진",
      "관련 기사",
      "공식 발표 페이지 캡처",
      "기타",
    ])
  })

  it("수상경력은 core 기간·내 역할/기여도·핵심 성과를 노출하지 않는다", () => {
    const core = getTemplateForType("award").commonCore.blocks.map(b => b.label)
    expect(core).not.toContain("기간")
    expect(core).not.toContain("내 역할/기여도")
    expect(core).not.toContain("핵심 성과")
    expect(core).toContain("경험명")
    expect(core).toContain("증빙 자료")
  })

  it("수상경력은 유형 전용 detail 섹션을 소유한다 (extended 는 공개 설정만)", () => {
    expect(detailOf("award")).toBeDefined()
    const ext = getTemplateForType("award").extensions.find(s => s.id === "extended")!
    expect(ext.blocks.map(b => b.label)).toEqual(["공개 설정"])
  })

  it("수상경력 모든 입력 필드에 가이드라인이 붙어 있다", () => {
    for (const s of sectionsOf("award")) {
      for (const b of s.blocks) {
        expect(b.guide, `${s.id}/${b.label}`).toBeTruthy()
      }
    }
  })

  it("확정본에 없는 구 필드는 템플릿에서 사라진다 (값은 매퍼가 orphan 으로 보존)", () => {
    const labels = sectionsOf("award").flatMap(s => labelsIn(s.blocks))
    for (const gone of [
      "수상명",
      "주최/기관",
      "대회/프로그램명",
      "수상 구분",
      "참가 형태",
      "팀명/팀원",
      "평가 기준/요구사항",
      "내 역할/기여",
      "제출물/발표 자료",
      "수상 증빙",
      "핵심 성과",
      "이 수상이 의미하는 역량",
    ]) {
      expect(labels, gone).not.toContain(gone)
    }
  })
})

// 어학능력 확정본(2026-07) — ① 언어 개요 · ② 어학 경험 · ③ 경험 상세 기록 · ④ 어학 자격증 (FRT-210).
describe("확정본: 어학능력", () => {
  const sections = () => getTemplateForType("language").extensions.filter(s => s.id !== "extended")
  const labelsIn = (blocks: Block[]) => blocks.map(b => b.label)
  const blockAt = (idx: number, label: string) =>
    sections()[idx].blocks.find(b => b.label === label)!

  it("확정본 4섹션을 순서·id·category 그대로 갖는다", () => {
    expect(sections().map(s => [s.id, s.category])).toEqual([
      ["lang-overview", "basic"],
      ["lang-experience", "detail"],
      ["lang-records", "repeat"],
      ["lang-certificate", "evidence"],
    ])
  })

  /**
   * 구 섹션 id 를 재사용하지 않는 것이 이 작업의 핵심 안전 장치다(FRT-210). 구 '언어'(text)가
   * 확정본에선 드롭다운이고 구 '유효기간'(text)은 date 인데, id 를 유지하면 안정키가 같아져
   * injectValue 는 타입 불일치로 값을 안 싣고 consumedKeys 때문에 orphan 안전망도 건너뛴다 —
   * 값이 '기타' 카드에도 없이 사라진다. id 가 다르면 구 키가 전부 orphan 으로 흘러 보존된다.
   */
  it("구 섹션 id 를 재사용하지 않는다 — 구 키가 orphan 안전망으로 흐르게", () => {
    const ids = sections().map(s => s.id)
    expect(ids).not.toContain("lang-info")
    expect(ids).not.toContain("lang-usage")
  })

  it("① 언어 개요는 확정본 4필드다", () => {
    expect(labelsIn(sections()[0].blocks)).toEqual([
      "언어",
      "언어 직접 입력",
      "전반적 수준",
      "가능한 활용 영역",
    ])
  })

  it("① 의 필수는 문서가 '선택'을 표기하지 않은 언어·전반적 수준뿐이다", () => {
    const required = sections()[0].blocks.filter(b => b.required).map(b => b.label)
    expect(required).toEqual(["언어", "전반적 수준"])
  })

  it("'언어'는 확정본 12종 드롭다운이다", () => {
    const lang = blockAt(0, "언어")
    expect(lang.type).toBe("single-select")
    expect(lang.options).toEqual([
      "영어",
      "중국어",
      "일본어",
      "스페인어",
      "독일어",
      "프랑스어",
      "러시아어",
      "베트남어",
      "아랍어",
      "이탈리아어",
      "포르투갈어",
      "기타",
    ])
  })

  it("'전반적 수준'은 괄호 예시까지 확정본 표기 그대로인 6종 드롭다운이다", () => {
    const level = blockAt(0, "전반적 수준")
    expect(level.type).toBe("single-select")
    expect(level.options).toEqual([
      "입문(인사·기초 표현)",
      "초급(간단한 일상 대화)",
      "중급(일상 회화·기본 업무 소통)",
      "중상급(실무 소통·문서 이해)",
      "고급(자유로운 업무 수행)",
      "원어민 수준",
    ])
  })

  it("'가능한 활용 영역'은 이모지 태그 9종 다중선택이다", () => {
    const tags = blockAt(0, "가능한 활용 영역")
    expect(tags.type).toBe("checklist")
    expect(tags.variant).toBe("mood-tag")
    expect(tags.options).toEqual([
      "💬 일상 회화",
      "💼 비즈니스 회화",
      "📖 문서 독해",
      "✍️ 문서 작성",
      "🎓 학술 논문 독해",
      "📝 학술 논문 작성",
      "🎤 발표 / 프레젠테이션",
      "🗣️ 통역 / 번역",
      "🌍 원어민과 자유로운 소통",
    ])
  })

  it("'언어 직접 입력'은 '기타'를 골랐을 때만 보이는 조건부 필드다", () => {
    expect(blockAt(0, "언어 직접 입력").visibleWhen?.equals).toEqual(["기타"])
  })

  /**
   * 안정키는 `${sectionId}.${label}` 파생이라 **라벨을 바꾸면 트리거 키도 바뀐다**.
   * `visibleWhen.key` 는 문자열 상수라 자동으로 따라가지 않으므로, 갱신을 잊으면 조건이 영원히
   * 미충족이 되어 칸이 조용히 사라진다. 상수를 베껴 적으면 사각지대가 생기므로 **템플릿에서
   * 파생시켜** 비교한다(FRT-211 교훈).
   */
  it("조건부 필드의 트리거 키는 '언어'의 실제 안정키와 일치한다", () => {
    expect(blockAt(0, "언어 직접 입력").visibleWhen?.key).toBe(blockAt(0, "언어").key)
  })

  it("② 어학 경험은 확정본 3필드이고 '주요 경험'이 개조식 리스트다", () => {
    expect(labelsIn(sections()[1].blocks)).toEqual([
      "어학 학습 / 습득 동기",
      "주요 경험",
      "학습 방법 / 노력",
    ])
    expect(blockAt(1, "주요 경험").variant).toBe("outcome-list")
  })

  /**
   * ② 각 행의 '상세 기록' 이 ③ 에 행을 만든다. 대상 섹션·제목 컬럼이 실재하지 않으면 버튼을
   * 눌러도 아무 일이 없거나(대상 없음) 제목이 엉뚱한 칸에 들어간다 — 둘 다 화면엔 조용하다.
   */
  it("'주요 경험'의 연결 설정이 ③ 섹션·제목 컬럼을 실제로 가리킨다", () => {
    const link = blockAt(1, "주요 경험").linkConfig!
    expect(link.targetSectionId).toBe("lang-records")

    const target = sections().find(s => s.id === link.targetSectionId)!
    const table = target.blocks.find(b => b.value.type === "repeatable-cell")!
    const columns = table.value.type === "repeatable-cell" ? table.value.columns : []
    expect(columns.map(c => c.key)).toContain(link.titleColumnKey)
  })

  it("③ 경험 상세 기록은 확정본 5컬럼이고 기간은 period 셀이다", () => {
    const table = sections()[2].blocks[0]
    expect(table.type).toBe("repeatable-cell")
    const columns = table.value.type === "repeatable-cell" ? table.value.columns : []
    expect(columns.map(c => [c.key, c.label, c.blockType])).toEqual([
      ["name", "경험명", "text"],
      ["period", "기간", "period"],
      ["activities", "어떤 언어 활동을 했나요?", "checklist"],
      ["summary", "어떤 경험이었는지 간단히", "textarea"],
      ["moment", "인상 깊었던 순간", "textarea"],
    ])
  })

  /**
   * ①과 ③이 같은 태그 목록을 쓴다고 확정본이 명시했다 — 한쪽만 고치면 같은 질문에 다른 선택지가
   * 나온다. 양쪽을 템플릿에서 읽어 비교하므로 상수를 베껴 적은 사본이 아니다.
   */
  it("③ 의 언어 활동 태그는 ① '가능한 활용 영역'과 같은 선택지다", () => {
    const table = sections()[2].blocks[0]
    const columns = table.value.type === "repeatable-cell" ? table.value.columns : []
    const activities = columns.find(c => c.key === "activities")!
    expect(activities.options).toEqual(blockAt(0, "가능한 활용 영역").options)
  })

  it("④ 어학 자격증은 확정본 5필드이고 취득일·유효기간이 date 다", () => {
    expect(labelsIn(sections()[3].blocks)).toEqual([
      "시험 / 자격증명",
      "점수 / 등급",
      "취득일",
      "유효기간",
      "성적표 첨부",
    ])
    expect(blockAt(3, "취득일").type).toBe("date")
    expect(blockAt(3, "유효기간").type).toBe("date")
  })

  it("④ '성적표 첨부'는 증빙 유형 4종을 드롭다운으로 좁힌다", () => {
    const file = blockAt(3, "성적표 첨부")
    expect(file.type).toBe("file")
    expect(file.options).toEqual([
      "성적표/점수 확인서",
      "합격증/자격증 사본",
      "발급 확인서",
      "기타",
    ])
  })

  /**
   * 확정본 ④는 시험명·점수·취득일·유효기간과 첨부가 **한 카드**다. core '증빙 자료'를 남기면
   * 같은 카드(evidence)에 파일 입력칸이 두 벌 생긴다 — 교육의 '성적 증빙'과 같은 처리다.
   * '기간'을 빼는 이유는 다르다: 어학은 시작·종료가 뚜렷하지 않아 required 기간이 억지 입력이 된다.
   */
  it("core 에서 기간·증빙 자료·역할·성과를 제외한다", () => {
    const core = labelsIn(getTemplateForType("language").commonCore.blocks)
    expect(core).toEqual(["경험명", "한 줄 요약"])
  })

  it("①②③ 의 필드에 가이드라인이 있다 (확정본이 '—'로 비운 것만 예외)", () => {
    // 확정본이 가이드라인 칸을 '—'로 둔 필드들 — 없는 문구를 지어내지 않는다.
    // '언어 직접 입력'은 placeholder 가 곧 안내이고, ④ 는 섹션 전체가 '—'라 아래 루프에서 제외.
    const NO_GUIDE = new Set(["언어 직접 입력"])
    for (const s of sections().slice(0, 3)) {
      for (const b of s.blocks) {
        if (NO_GUIDE.has(b.label)) {
          expect(b.placeholder, `${s.id}/${b.label}`).toBeTruthy()
          continue
        }
        // 표형 반복 입력은 안내가 컬럼마다 붙는다(확정본도 컬럼별로 기술) — 블록 자체 안내는
        // 섹션 설명(SECTION_DESCRIPTION_OVERRIDES)이 맡는다. 개조식 리스트(outcome-list)는
        // 컬럼이 내부 구현일 뿐이라 블록 층위 guide 를 그대로 본다.
        if (b.value.type === "repeatable-cell" && b.variant !== "outcome-list") {
          for (const c of b.value.columns) {
            expect(c.guide, `${s.id}/${b.label}/${c.label}`).toBeTruthy()
          }
          continue
        }
        expect(b.guide, `${s.id}/${b.label}`).toBeTruthy()
      }
    }
  })

  it("확정본에 없는 구 필드는 템플릿에서 사라진다 (값은 매퍼가 orphan 으로 보존)", () => {
    const labels = sections().flatMap(s => labelsIn(s.blocks))
    for (const gone of [
      "시험/인증명",
      "점수/등급",
      "응시일",
      "강점 영역",
      "학습 기간",
      "학습 방식",
      "활용 사례",
    ]) {
      expect(labels, gone).not.toContain(gone)
    }
  })
})
