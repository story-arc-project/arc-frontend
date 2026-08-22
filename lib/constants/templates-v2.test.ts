import { describe, it, expect } from "vitest"
import {
  ALL_EXPERIENCE_TYPES,
  EXPERIENCE_TYPES,
  EXPERIENCE_TYPE_MAP,
  RETIRED_TYPE_IDS,
  SYSTEM_TEMPLATES_V2,
  TEMPLATE_MAP,
  TEMPLATE_VERSION,
  canonicalTypeId,
  getTemplateForType,
} from "@/lib/constants/templates-v2"
import { getQuickPickPreset } from "@/lib/constants/quick-pick-presets"
import { isRequiredBlock } from "@/lib/utils/block-utils"
import { canHideBlock } from "@/lib/utils/hidden-fields"
import { computeFormCards, isCardComplete } from "@/lib/utils/form-cards"
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

describe("'＋빠른 선택' 픽커 배선 (FRT-130)", () => {
  // 픽커를 켠 곳을 **세지 않고** 전 템플릿에서 그러모은다 — 나중에 다른 유형이 켜도 그물이 따라간다.
  const walk = (blocks: Block[]): Block[] => blocks.flatMap(b => [b, ...walk(b.children ?? [])])
  const picked = SYSTEM_TEMPLATES_V2.flatMap(t =>
    [t.commonCore, ...t.extensions].flatMap(s =>
      walk(s.blocks)
        .filter(b => b.quickPick !== undefined)
        .map(b => ({ where: `${t.typeId}/${s.id}/${b.label}`, block: b })),
    ),
  )

  it("픽커를 켠 블록이 실제로 있다", () => {
    // 이 단언이 없으면 아래 전칭들이 빈 배열 위에서 조용히 통과한다.
    expect(picked.length).toBeGreaterThan(0)
  })

  it("모든 quickPick 은 실재하는 프리셋을 가리킨다", () => {
    for (const { where, block } of picked) {
      expect(getQuickPickPreset(block.quickPick), where).not.toBeNull()
    }
  })

  it("프리셋 선택 방식과 블록 타입이 맞물린다 — multi↔tags · single↔text", () => {
    // 어긋나면 값을 담을 그릇이 안 맞는다: text 칸에 다중 선택을 태우면 고를 때마다 앞 값이
    // 조용히 지워진다. 렌더러는 그럴 때 픽커를 아예 안 그리고 폴백하므로 "켰는데 안 뜨는"
    // 조용한 실패가 된다 — 배선 단계에서 잡는다.
    const EXPECTED_TYPE = { multi: "tags", single: "text" } as const
    for (const { where, block } of picked) {
      const preset = getQuickPickPreset(block.quickPick)
      expect(block.type, where).toBe(EXPECTED_TYPE[preset!.mode])
    }
  })
})

describe("'기타' 직접 입력 배선 (FRT-322)", () => {
  // 켠 곳을 세지 않고 전 템플릿에서 그러모은다 — 확정본이 늘어도 그물이 따라간다(FRT-130 패턴).
  const walk = (blocks: Block[]): Block[] => blocks.flatMap(b => [b, ...walk(b.children ?? [])])
  const selects = SYSTEM_TEMPLATES_V2.flatMap(t =>
    [t.commonCore, ...t.extensions].flatMap(s =>
      walk(s.blocks)
        .filter(b => b.type === "single-select")
        .map(b => ({ where: `${t.typeId}/${s.id}/${b.label}`, block: b })),
    ),
  )

  it("템플릿에 드롭다운이 실제로 있다", () => {
    // 이 단언이 없으면 아래 전칭들이 빈 배열 위에서 조용히 통과한다.
    expect(selects.length).toBeGreaterThan(0)
  })

  /**
   * 인라인 옵션 편집을 없앴으므로(FRT-322) '기타'가 프리셋 밖 값을 넣는 유일한 통로다.
   * '기타'를 가진 필드가 그 통로를 안 열어 두면 사용자는 목록에 없는 답을 적을 데가 없다.
   */
  it("'기타' 선택지를 가진 드롭다운은 전부 직접 입력을 연다", () => {
    const offenders = selects
      .filter(({ block }) => (block.options ?? []).includes("기타") && block.allowOther !== true)
      .map(({ where }) => where)
    expect(offenders).toEqual([])
  })

  /**
   * 반대 방향도 막는다 — '기타'가 없는데 플래그만 켜면 UI 는 폴백해 아무 일도 안 하므로
   * "켰는데 안 뜨는" 조용한 실패가 된다.
   */
  it("'기타'가 없는 드롭다운에는 플래그를 켜지 않는다", () => {
    const offenders = selects
      .filter(({ block }) => block.allowOther === true && !(block.options ?? []).includes("기타"))
      .map(({ where }) => where)
    expect(offenders).toEqual([])
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

  it("인턴 ① 산업·직무는 '＋빠른 선택' 픽커를 켜되 저장 타입은 그대로다 (FRT-130)", () => {
    const info = sectionsOf("career")[0]
    const industry = info.blocks.find(b => b.label === "산업 / 회사 종류")
    const job = info.blocks.find(b => b.label === "직무 / 포지션")

    // 픽커는 입력 보조일 뿐이라 저장 shape 은 근사 구현(FRT-135) 때와 동일해야 한다 —
    // 타입이 바뀌면 이미 저장된 인턴 기록의 값이 그 자리에서 안 그려진다.
    expect(industry?.type).toBe("tags")
    expect(job?.type).toBe("text")
    expect(industry?.quickPick).toBe("industry")
    expect(job?.quickPick).toBe("job-function")
    // 직무는 확정본에서 필수다.
    expect(job?.required).toBe(true)
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

  // 반복 기록 표의 '세부 기간' 은 기간을 **고르는** 칸이다. 가이드가 이미 "선택해주세요" 라
  // 쓰여 있는데 blockType 만 text 로 남아 자유 입력이 됐다(노션 유저테스트 피드백). 형제 표들
  // (어학 '기간'·프로젝트 '기간')은 처음부터 period 였으므로, 같은 규칙을 전 유형에 걸어 둔다.
  it("반복 기록 표의 기간 컬럼은 어느 유형에서든 기간 선택이다", () => {
    const periodColumns: Array<[ExperienceTypeId, string, string]> = [
      ["academic-society", "society-projects", "프로젝트/연구활동"],
      ["career", "career-tasks", "프로젝트/담당 업무"],
      ["language", "lang-records", "경험 상세 기록"],
      ["personal-project", "project-tasks", "세부 작업"],
    ]
    for (const [typeId, sectionId, blockLabel] of periodColumns) {
      const column = columnsOf(typeId, sectionId, blockLabel).find(c => c.key === "period")
      expect(column, `${typeId}/${sectionId} 에 period 컬럼이 없다`).toBeDefined()
      expect(column?.blockType, `${typeId}/${sectionId} 의 ${column?.label}`).toBe("period")
    }
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

describe("확정본: 독서", () => {
  const sections = () => getTemplateForType("reading").extensions.filter(s => s.id !== "extended")
  const labelsIn = (blocks: Block[]) => blocks.map(b => b.label)
  const blockAt = (idx: number, label: string) =>
    sections()[idx].blocks.find(b => b.label === label)!

  it("확정본 3섹션을 순서·id·category 그대로 갖는다", () => {
    expect(sections().map(s => [s.id, s.category])).toEqual([
      ["book-info", "basic"],
      ["book-reflection", "detail"],
      ["book-quotes", "repeat"],
    ])
  })

  /**
   * 어학능력(FRT-210)과 같은 안전 장치다. 구 '읽은 기간/완독일'(text)이 확정본에선 period 이고
   * 구 '인상 깊은 문장'(textarea)은 개조식 리스트인데, 섹션 id 를 유지하면 안정키가 같아져
   * injectValue 는 타입 불일치로 값을 안 싣고 그 키는 consumedKeys 에 잡혀 orphan 안전망도
   * 건너뛴다 — 값이 '기타' 카드에도 없이 사라진다. id 가 다르면 구 키가 전부 orphan 으로 흐른다.
   */
  it("구 섹션 id 를 재사용하지 않는다 — 구 키가 orphan 안전망으로 흐르게", () => {
    const ids = sections().map(s => s.id)
    expect(ids).not.toContain("reading-info")
    expect(ids).not.toContain("reading-apply")
  })

  it("① 도서 정보는 확정본 9필드다", () => {
    expect(labelsIn(sections()[0].blocks)).toEqual([
      "도서명",
      "저자",
      "장르 / 분야",
      "페이지 수",
      "독서 기간",
      "독서 이유",
      "한 줄 감상",
      "요약",
      "인상 깊었던 문장",
    ])
  })

  /**
   * 확정본 ① 은 "1/3, 필수" 섹션이고 선택 필드는 전부 *(선택, 필드 삭제 가능)* 으로 표기돼 있다.
   * 그 표기가 없는 셋만 필수다 — 표기를 근거로 세지 않으면 선택 필드가 진행도를 막는다.
   */
  it("① 의 필수는 문서가 '선택'을 표기하지 않은 도서명·저자·독서 기간뿐이다", () => {
    const required = sections()[0].blocks.filter(b => b.required).map(b => b.label)
    expect(required).toEqual(["도서명", "저자", "독서 기간"])
  })

  it("'장르 / 분야'는 확정본 12종 드롭다운이다", () => {
    const genre = blockAt(0, "장르 / 분야")
    expect(genre.type).toBe("single-select")
    expect(genre.options).toEqual([
      "인문/철학",
      "역사",
      "사회/정치",
      "경제/경영",
      "자기계발",
      "과학/기술",
      "심리/뇌과학",
      "예술/문화",
      "소설/문학",
      "에세이/시",
      "전공/학술",
      "기타",
    ])
  })

  it("'독서 기간'은 시작·종료를 받는 period 다 (구 text 완독일이 아니다)", () => {
    expect(blockAt(0, "독서 기간").type).toBe("period")
  })

  it("'인상 깊었던 문장'은 개조식 불릿 리스트다", () => {
    const quotes = blockAt(0, "인상 깊었던 문장")
    expect(quotes.variant).toBe("outcome-list")
    const columns = quotes.value.type === "repeatable-cell" ? quotes.value.columns : []
    expect(columns.map(c => c.label)).toEqual(["문장"])
  })

  /**
   * 확정본의 '↻ 문장 동기화' 를 행별 '감상 남기기' 링크로 구현했다. 대상 섹션·제목 컬럼이
   * 실재하지 않으면 버튼을 눌러도 아무 일이 없거나(대상 없음) 문장이 엉뚱한 칸에 들어간다 —
   * 둘 다 화면엔 조용하다. 상수를 베껴 적지 않고 **템플릿에서 파생시켜** 대조한다.
   */
  it("'인상 깊었던 문장'의 연결 설정이 ③ 섹션·문장 컬럼을 실제로 가리킨다", () => {
    const link = blockAt(0, "인상 깊었던 문장").linkConfig!
    expect(link.targetSectionId).toBe("book-quotes")

    const target = sections().find(s => s.id === link.targetSectionId)!
    const table = target.blocks.find(b => b.value.type === "repeatable-cell")!
    const columns = table.value.type === "repeatable-cell" ? table.value.columns : []
    expect(columns.map(c => c.key)).toContain(link.titleColumnKey)
  })

  it("② 감상과 평가는 확정본 ②의 회고와 ③의 별점을 함께 갖는다", () => {
    expect(labelsIn(sections()[1].blocks)).toEqual(["이 책이 나에게 남긴 것", "별점"])
    expect(sections()[1].blocks.some(b => b.required)).toBe(false)
  })

  it("'별점'은 확정본 표기 그대로인 5종 드롭다운이다", () => {
    const rating = blockAt(1, "별점")
    expect(rating.type).toBe("single-select")
    expect(rating.options).toEqual([
      "⭐⭐⭐⭐⭐ (강력 추천)",
      "⭐⭐⭐⭐ (추천)",
      "⭐⭐⭐ (괜찮았음)",
      "⭐⭐ (아쉬웠음)",
      "⭐ (별로)",
    ])
  })

  /**
   * 확정본 ②는 "섹션 전체 선택"이고 카드 안내도 "굳이 모두 채울 필요는 없어요"라고 적는다.
   * 그런데 `isRequiredBlock` 은 **컬럼 하나라도 required 면 표 블록 전체를 필수로 본다** —
   * 그러면 문장을 하나도 안 적은 사용자는 이 카드를 영영 완료할 수 없고(빈 표는
   * `isCardComplete` 를 못 채운다), 필수 블록은 숨길 수도 없어 치울 방법조차 없다.
   * 안내는 "안 채워도 된다"는데 진행도는 채우라고 요구하는 모순이다(Codex P2).
   */
  it("③ 은 통째로 선택이다 — 필수 컬럼이 카드를 영영 미완료로 만들지 않는다", () => {
    const table = sections()[2].blocks[0]
    expect(isRequiredBlock(table)).toBe(false)
  })

  it("③ 이 비어 있으면 치울 수 있다 — 숨긴 뒤에는 카드가 완료된다", () => {
    const table = sections()[2].blocks[0]
    // 필수 블록은 `canHideBlock` 이 거부한다. 여기가 실제 게이트다 —
    // `isCardComplete` 는 숨김 키를 먼저 걸러내므로 "숨길 수 있는가"를 증명하지 못한다.
    expect(canHideBlock(table)).toBe(true)

    const card = { id: "repeat", category: "repeat" as const, label: "문장별 감상", blocks: [table] }
    expect(isCardComplete(card)).toBe(false)
    expect(isCardComplete(card, [table.key!])).toBe(true)
  })

  it("③ 문장별 감상은 문장·생각 2컬럼이다", () => {
    const table = sections()[2].blocks[0]
    expect(table.type).toBe("repeatable-cell")
    const columns = table.value.type === "repeatable-cell" ? table.value.columns : []
    expect(columns.map(c => [c.key, c.label, c.blockType])).toEqual([
      ["quote", "문장", "text"],
      ["impression", "이 문장에 대한 생각", "textarea"],
    ])
  })

  /**
   * 확정본에 증빙 섹션이 없다고 core '증빙 자료'까지 빼면 첨부 수단이 아예 사라진다 —
   * 어학능력은 자체 '성적표 첨부'가 있어서 뺄 수 있었던 것이라 그대로 베끼면 안 된다.
   * 시점은 확정본의 '독서 기간'이 받고, 역할·성과는 독서에 성립하지 않는 질문이라 뺀다.
   */
  it("core 에서 기간·역할·성과만 제외하고 증빙 자료는 남긴다", () => {
    const core = labelsIn(getTemplateForType("reading").commonCore.blocks)
    expect(core).toEqual(["경험명", "한 줄 요약", "증빙 자료"])
  })

  it("①②③ 의 필드에 가이드라인이 있다 (확정본이 '—'로 비운 것만 예외)", () => {
    // 확정본이 가이드라인 칸을 비운 필드들 — 없는 문구를 지어내지 않는다.
    // '페이지 수'는 '—', '별점'은 그 칸이 선택지 목록이라 안내가 따로 없다.
    const NO_GUIDE = new Map<string, "placeholder" | "options">([
      ["페이지 수", "placeholder"],
      ["별점", "options"],
    ])
    for (const s of sections()) {
      for (const b of s.blocks) {
        const fallback = NO_GUIDE.get(b.label)
        if (fallback) {
          expect(b[fallback], `${s.id}/${b.label}`).toBeTruthy()
          continue
        }
        // 표형 반복 입력은 안내가 컬럼마다 붙는다. 개조식 리스트(outcome-list)는 컬럼이 내부
        // 구현일 뿐이라 블록 층위 guide 를 본다 — 어학능력(FRT-210)과 같은 기준이다.
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
      "읽은 기간/완독일",
      "읽은 이유",
      "핵심 요약 (3줄)",
      "인상 깊은 문장",
      "적용/실험",
      "관련 자료",
      "추천 대상",
    ]) {
      expect(labels, gone).not.toContain(gone)
    }
  })

  /**
   * `withSectionKeys` 규약: 안정키가 라벨에서 파생되므로 **섹션 id·라벨 교체는 breaking change**
   * 이고 `TEMPLATE_VERSION` bump 를 동반해야 한다. 버전 2 자체가 어학능력(FRT-210)이 섹션 id 를
   * 갈아치우며 올린 bump 다. 독서도 같은 교체를 했으므로 같은 대우를 받아야 한다 —
   * 안 올리면 개편 전후 레코드가 `content.template_version` 으로 구분되지 않는다(Codex P2).
   */
  it("섹션 id 를 갈아치웠으므로 TEMPLATE_VERSION 이 어학능력(2) 위로 올라가 있다", () => {
    expect(TEMPLATE_VERSION).toBeGreaterThanOrEqual(3)
  })
})

describe("확정본: 봉사", () => {
  const sections = () => getTemplateForType("volunteer").extensions.filter(s => s.id !== "extended")
  const labelsIn = (blocks: Block[]) => blocks.map(b => b.label)
  const blockAt = (idx: number, label: string) =>
    sections()[idx].blocks.find(b => b.label === label)!

  it("확정본 2섹션을 순서·id·category 그대로 갖는다", () => {
    expect(sections().map(s => [s.id, s.category])).toEqual([
      ["volunteer-info", "basic"],
      ["volunteer-reflection", "detail"],
    ])
  })

  /**
   * 어학능력(FRT-210)·독서(FRT-236)와 같은 안전 장치다. 구 `vol-info` 를 유지하면 라벨이 그대로인
   * 필드의 안정키가 같아져, 타입이 바뀐 칸은 injectValue 가 값을 안 싣는데 그 키가 consumedKeys 에
   * 잡혀 orphan 안전망까지 건너뛴다 — 값이 '기타' 카드에도 없이 사라진다.
   */
  it("구 섹션 id 를 재사용하지 않는다 — 구 키가 orphan 안전망으로 흐르게", () => {
    expect(sections().map(s => s.id)).not.toContain("vol-info")
  })

  it("① 봉사 정보는 확정본 8필드다", () => {
    expect(labelsIn(sections()[0].blocks)).toEqual([
      "봉사 활동명",
      "봉사 분야",
      "봉사 기관",
      "활동 기간",
      "총 봉사시간",
      "참여 형태",
      "역할",
      "봉사 확인서 첨부",
    ])
  })

  /**
   * 확정본 ① 은 "1/2, 필수" 섹션이고 선택 필드는 전부 *(선택, 필드 삭제 가능)* 으로 표기돼 있다.
   * 그 표기가 없는 넷만 필수다 — 표기를 근거로 세지 않으면 선택 필드가 진행도를 막는다.
   */
  it("① 의 필수는 문서가 '선택'을 표기하지 않은 넷뿐이다", () => {
    const required = sections()[0].blocks.filter(b => b.required).map(b => b.label)
    expect(required).toEqual(["봉사 활동명", "봉사 분야", "봉사 기관", "활동 기간"])
  })

  it("'봉사 분야'는 확정본 11종 드롭다운이다", () => {
    const field = blockAt(0, "봉사 분야")
    expect(field.type).toBe("single-select")
    expect(field.options).toEqual([
      "교육/학습 지원",
      "아동/청소년",
      "노인/어르신",
      "장애인",
      "다문화/이주민",
      "의료/보건",
      "환경/동물",
      "재난/재해 구호",
      "지역사회/캠페인",
      "해외 봉사",
      "기타",
    ])
  })

  it("'참여 형태'는 확정본 5종 드롭다운이다", () => {
    const field = blockAt(0, "참여 형태")
    expect(field.type).toBe("single-select")
    expect(field.options).toEqual([
      "정기 봉사(주기적)",
      "단기/일회성",
      "캠프/단기 집중",
      "온라인/재택 봉사",
      "해외 봉사",
    ])
  })

  it("'활동 기간'은 시작·종료를 받는 period 다", () => {
    expect(blockAt(0, "활동 기간").type).toBe("period")
  })

  /** 확정본 ① 의 '역할'은 한 줄 텍스트다(예: 학습 멘토, 팀장) — 구 '내 역할' textarea 가 아니다. */
  it("'역할'은 한 줄 텍스트이고 선택 입력이다", () => {
    const role = blockAt(0, "역할")
    expect(role.type).toBe("text")
    expect(role.required).toBeFalsy()
  })

  it("'봉사 확인서 첨부'는 증빙 유형 4종을 고르는 파일 블록이다", () => {
    const file = blockAt(0, "봉사 확인서 첨부")
    expect(file.type).toBe("file")
    expect(file.options).toEqual([
      "봉사시간 인증서(1365 등)",
      "봉사 확인서/수료증",
      "활동 사진",
      "기타",
    ])
  })

  /**
   * 확정본 ② 는 계기(왜 시작했나) → 내용(무엇을 했나) → 순간(어떤 장면이 남았나) →
   * 배운 점(무엇을 얻었나) 순서를 설계 노트로 못 박았다. 회고 서사 순서라 임의로 바꾸지 말 것.
   */
  it("② 봉사 회고는 확정본 4필드를 서사 순서 그대로 갖는다", () => {
    expect(labelsIn(sections()[1].blocks)).toEqual([
      "시작하게 된 계기",
      "봉사 내용",
      "기억에 남는 순간",
      "배운 점",
    ])
  })

  it("② 는 '섹션 전체 선택'이라 필수 필드가 하나도 없다", () => {
    expect(sections()[1].blocks.some(b => b.required)).toBe(false)
  })

  /**
   * 확정본은 파일 첨부를 ① 안에 두고 사이드 네비도 "섹션 2개 앵커"로 못 박았다. core '증빙 자료'를
   * 남기면 evidence 카드가 따로 생겨 파일 입력칸이 두 벌이 되고 카드가 3장이 된다 —
   * 어학능력의 '성적표 첨부'(FRT-210)와 같은 처리다.
   */
  it("core 는 헤더 둘만 남는다 — 기간·역할·성과·증빙이 확정본 필드로 대체됐다", () => {
    const core = labelsIn(getTemplateForType("volunteer").commonCore.blocks)
    expect(core).toEqual(["경험명", "한 줄 요약"])
  })

  it("①② 의 모든 필드에 가이드라인이 있다 (확정본이 '—'로 비운 것만 예외)", () => {
    // 확정본이 가이드라인 칸을 '—' 로 비운 필드 — 없는 문구를 지어내지 않는다.
    const NO_GUIDE = new Map<string, "placeholder" | "options">([["참여 형태", "options"]])
    for (const s of sections()) {
      for (const b of s.blocks) {
        const fallback = NO_GUIDE.get(b.label)
        if (fallback) {
          expect(b[fallback], `${s.id}/${b.label}`).toBeTruthy()
          continue
        }
        expect(b.guide, `${s.id}/${b.label}`).toBeTruthy()
      }
    }
  })

  it("확정본에 없는 구 필드는 템플릿에서 사라진다 (값은 매퍼가 orphan 으로 보존)", () => {
    const labels = sections().flatMap(s => labelsIn(s.blocks))
    for (const gone of [
      "봉사활동명",
      "기관/장소",
      "총 시간",
      "대상",
      "활동 형태",
      "내 역할",
      "활동 내용",
      "임팩트/변화",
      "느낀 점/가치관 변화",
      "봉사 확인서",
    ]) {
      expect(labels, gone).not.toContain(gone)
    }
  })

  /** 섹션 id 교체는 breaking change 다 — `withSectionKeys` 규약대로 bump 를 동반한다(FRT-236). */
  it("섹션 id 를 갈아치웠으므로 TEMPLATE_VERSION 이 독서(3) 위로 올라가 있다", () => {
    expect(TEMPLATE_VERSION).toBeGreaterThanOrEqual(4)
  })
})

describe("확정본: 해외경험", () => {
  const sections = () => getTemplateForType("overseas").extensions.filter(s => s.id !== "extended")
  const labelsIn = (blocks: Block[]) => blocks.map(b => b.label)
  const blockAt = (idx: number, label: string) =>
    sections()[idx].blocks.find(b => b.label === label)!

  /**
   * 확정본 §8 은 "섹션 2개 앵커"지만 화면 카드는 3장이다. ② 의 '↳ 활동별 상세 설명'을 ② 안에
   * 두면 `ExperienceFormV2.findProjectBlock` 이 **대상 섹션의 첫 repeatable-cell** 을 집는데
   * OutcomeList 자체가 repeatable-cell 이라 목록이 자기 자신을 가리킨다. 독서(book-info →
   * book-quotes)와 같은 구성으로 분리하는 것이 유일한 안전한 배치다.
   */
  it("확정본 2섹션 + 링크 대상 1섹션을 순서·id·category 그대로 갖는다", () => {
    expect(sections().map(s => [s.id, s.category])).toEqual([
      ["overseas-program", "basic"],
      ["overseas-reflection", "detail"],
      ["overseas-activities", "repeat"],
    ])
  })

  /**
   * 구 `overseas-info` 를 유지하면 '경험 유형'의 안정키가 그대로라, **라벨도 타입도 같고 선택지
   * 도메인만 다른** 값이 injectValue 로 실려 새 드롭다운에 없는 값이 박힌다(FRT-247에서 봉사
   * '대상'·'활동 형태'로 확인한 함정). 섹션 id 교체가 그 값을 orphan 안전망으로 흘려보낸다.
   */
  it("구 섹션 id 를 재사용하지 않는다 — 구 키가 orphan 안전망으로 흐르게", () => {
    const ids = sections().map(s => s.id)
    expect(ids).not.toContain("overseas-info")
    expect(ids).not.toContain("overseas-challenges")
  })

  it("① 해외경험 정보는 확정본 필드를 순서 그대로 갖는다 (경험명은 헤더 코어 소유)", () => {
    expect(labelsIn(sections()[0].blocks)).toEqual([
      "경험 유형",
      "국가 / 도시",
      "주최 / 소속 기관",
      "기간",
      "사용 언어",
      "참여 형태",
      "증빙 자료",
    ])
  })

  /**
   * '기간'은 코어에 맡기면 순서를 잃는다 — `computeFormCards` 가 유형 섹션 블록을 전부 깐 뒤에
   * 코어를 붙이므로 확정본 4번째 자리가 아니라 카드 맨 끝으로 밀린다. 섹션이 소유해야 하는 이유.
   */
  it("'기간'은 확정본 ① 의 4번째 자리, 즉 '주최 / 소속 기관' 과 '사용 언어' 사이다", () => {
    const labels = labelsIn(sections()[0].blocks)
    expect(labels.indexOf("기간")).toBe(labels.indexOf("주최 / 소속 기관") + 1)
    expect(labels.indexOf("사용 언어")).toBe(labels.indexOf("기간") + 1)
  })

  it("'기간'은 month~month 를 받는 period 블록이다", () => {
    expect(blockAt(0, "기간").type).toBe("period")
  })

  /** 확정본 ① 에서 *(선택, 필드 삭제 가능)* 표기가 없는 것만 필수다. */
  it("① 의 필수는 '경험 유형'·'국가 / 도시'·'기간' 셋이다", () => {
    const required = sections()[0].blocks.filter(b => b.required).map(b => b.label)
    expect(required).toEqual(["경험 유형", "국가 / 도시", "기간"])
  })

  it("'경험 유형'은 확정본 9종 드롭다운이다", () => {
    const field = blockAt(0, "경험 유형")
    expect(field.type).toBe("single-select")
    expect(field.options).toEqual([
      "교환학생",
      "어학연수",
      "해외 인턴/취업",
      "해외 봉사",
      "단기 프로그램/캠프",
      "여행/자유 탐방",
      "워킹홀리데이",
      "학회/컨퍼런스 참가",
      "기타",
    ])
  })

  it("'참여 형태'는 확정본 4종 드롭다운이다", () => {
    const field = blockAt(0, "참여 형태")
    expect(field.type).toBe("single-select")
    expect(field.options).toEqual(["혼자", "친구/지인과 함께", "가족과 함께", "단체/팀 프로그램"])
  })

  it("'증빙 자료'는 증빙 유형 3종을 고르는 파일 블록이다", () => {
    const file = blockAt(0, "증빙 자료")
    expect(file.type).toBe("file")
    expect(file.options).toEqual(["수료증/참가 확인서", "활동 사진", "기타"])
  })

  /**
   * 코어 '기간'을 남기면 안 된다(FRT-249, Codex P1). 구 `overseas-info` 에도 '기간' 앵커가 있어
   * dedup 이 **빈 코어 블록을 화면에서 지웠고**, 그래서 기존 레코드의 값은 `core.기간` 이 아니라
   * `overseas-info.기간` 에 있다. 코어를 남기면 값 없는 required 칸이 떠서 완료 저장이 막힌다.
   * 봉사·독서·자격증과 같은 처리로 되돌린 자리다.
   */
  it("core 에는 헤더 둘만 남는다 — 기간·역할·성과·증빙이 확정본 필드로 대체됐다", () => {
    const core = labelsIn(getTemplateForType("overseas").commonCore.blocks)
    expect(core).toEqual(["경험명", "한 줄 요약"])
  })

  it("② 경험 상세는 확정본 3필드를 순서 그대로 갖는다", () => {
    expect(labelsIn(sections()[1].blocks)).toEqual([
      "주요 활동",
      "이 경험이 나에게 준 것",
      "기억에 남는 순간",
    ])
  })

  it("②③ 은 '섹션 전체 선택'이라 필수 필드가 하나도 없다", () => {
    expect(sections()[1].blocks.some(b => b.required)).toBe(false)
    expect(sections()[2].blocks.some(b => b.required)).toBe(false)
  })

  /**
   * 확정본 §7 의 '↻ 활동 동기화' 일괄 버튼 대신 독서가 쓴 행별 링크를 재사용한다.
   * `titleColumnKey` 는 반드시 명시한다 — columns[0] 의존은 FRT-178 에서 깨진 전제다.
   */
  it("'주요 활동'은 ③ 으로 이어지는 개조식 목록이다", () => {
    const list = blockAt(1, "주요 활동")
    expect(list.variant).toBe("outcome-list")
    expect(list.linkConfig).toEqual({
      targetSectionId: "overseas-activities",
      titleColumnKey: "activity",
      label: "상세 설명",
    })
  })

  it("'이 경험이 나에게 준 것'은 확정본 10종 이모지 태그다", () => {
    const tags = blockAt(1, "이 경험이 나에게 준 것")
    expect(tags.type).toBe("checklist")
    expect(tags.variant).toBe("mood-tag")
    expect(tags.options).toEqual([
      "🗣️ 언어 능력 향상",
      "🌍 다양성 이해",
      "🤝 이문화 소통",
      "💪 독립성/자립심",
      "🎓 학문적 시야 확장",
      "💼 커리어 방향 확립",
      "🧭 새로운 관점",
      "🌐 글로벌 네트워크",
      "🔥 도전 정신",
      "💡 문제 해결력",
    ])
  })

  /**
   * ⚠️ 컬럼에 required 를 붙이지 말 것. `isRequiredBlock` 은 컬럼 하나라도 required 면 표 블록
   * 전체를 필수로 보고, 그러면 활동을 하나도 안 적은 사용자가 이 카드를 영영 완료할 수 없는 데다
   * `canHideBlock` 이 숨기지도 못한다(FRT-236 독서 '문장별 감상'과 같은 자리).
   */
  it("③ 활동별 상세 설명은 활동·상세 설명 2컬럼이다", () => {
    const table = sections()[2].blocks[0]
    expect(table.type).toBe("repeatable-cell")
    const columns = table.value.type === "repeatable-cell" ? table.value.columns : []
    expect(columns.map(c => [c.key, c.label, c.blockType])).toEqual([
      ["activity", "활동", "text"],
      ["detail", "상세 설명", "textarea"],
    ])
    expect(columns.some(c => c.required)).toBeFalsy()
  })

  it("③ 이 비어 있으면 치울 수 있다 — 숨긴 뒤에는 카드가 완료된다", () => {
    const table = sections()[2].blocks[0]
    // 필수 블록은 `canHideBlock` 이 거부한다. 여기가 실제 게이트다 —
    // `isCardComplete` 는 숨김 키를 먼저 걸러내므로 "숨길 수 있는가"를 증명하지 못한다.
    expect(canHideBlock(table)).toBe(true)

    const card = { id: "repeat", category: "repeat" as const, label: "활동별 상세 설명", blocks: [table] }
    expect(isCardComplete(card)).toBe(false)
    expect(isCardComplete(card, [table.key!])).toBe(true)
  })

  it("①②③ 의 모든 필드에 가이드라인이 있다 (확정본이 '—'로 비운 것만 예외)", () => {
    // 확정본이 가이드라인 칸을 '—' 로 비운 필드 — 없는 문구를 지어내지 않는다.
    // '기간'은 placeholder·options 도 없는 period 위젯이라 타입 자체로 확인한다.
    const NO_GUIDE = new Map<string, "placeholder" | "options" | "type">([
      ["참여 형태", "options"],
      ["기간", "type"],
    ])
    for (const s of sections()) {
      for (const b of s.blocks) {
        const fallback = NO_GUIDE.get(b.label)
        if (fallback) {
          expect(b[fallback], `${s.id}/${b.label}`).toBeTruthy()
          continue
        }
        expect(b.guide, `${s.id}/${b.label}`).toBeTruthy()
      }
    }
  })

  it("확정본에 없는 구 필드는 템플릿에서 사라진다 (값은 매퍼가 orphan 으로 보존)", () => {
    const labels = sections().flatMap(s => labelsIn(s.blocks))
    for (const gone of [
      "국가/도시",
      "목적",
      "활동 요약",
      "언어 사용 수준",
      "어려웠던 상황",
      "성과/산출물",
      "증빙",
    ]) {
      expect(labels, gone).not.toContain(gone)
    }
  })

  /** 섹션 id 교체는 breaking change 다 — `withSectionKeys` 규약대로 bump 를 동반한다. */
  it("섹션 id 를 갈아치웠으므로 TEMPLATE_VERSION 이 봉사(4) 위로 올라가 있다", () => {
    expect(TEMPLATE_VERSION).toBeGreaterThanOrEqual(5)
  })
})

describe("확정본: 창작물", () => {
  const sections = () => getTemplateForType("creative-work").extensions.filter(s => s.id !== "extended")
  const labelsIn = (blocks: Block[]) => blocks.map(b => b.label)
  const blockAt = (idx: number, label: string) =>
    sections()[idx].blocks.find(b => b.label === label)!

  it("확정본 2섹션을 순서·id·category 그대로 갖는다", () => {
    expect(sections().map(s => [s.id, s.category])).toEqual([
      ["creative-info", "basic"],
      ["creative-detail", "detail"],
    ])
  })

  /**
   * 구 `cw-info` 를 유지하면 '분야'(7종)의 안정키가 그대로라, 선택지 도메인만 13종으로 바뀐 값이
   * injectValue 로 실려 새 드롭다운에 없는 값('디자인'·'글'…)이 박힌다 — 고를 수도 지울 수도 없다
   * (FRT-247 봉사 '대상', FRT-249 해외경험 '경험 유형'과 같은 함정).
   * 구 `cw-process.제작 과정`(표)도 확정본에선 같은 라벨의 textarea 라, id 를 갈아야 orphan 으로 흐른다.
   */
  it("구 섹션 id 를 재사용하지 않는다 — 구 키가 orphan 안전망으로 흐르게", () => {
    const ids = sections().map(s => s.id)
    expect(ids).not.toContain("cw-info")
    expect(ids).not.toContain("cw-process")
  })

  it("① 작품 정보는 확정본 필드를 순서 그대로 갖는다 (경험명·한 줄 요약은 헤더 코어 소유)", () => {
    expect(labelsIn(sections()[0].blocks)).toEqual([
      "작품명 / 작업물명",
      "유형 / 매체",
      "개인 / 팀",
      "역할",
      "작업 기간",
      "공개 / 전시 이력",
      "사용 툴 / 기술",
      "작품 링크 / 파일",
    ])
  })

  /**
   * '작업 기간'은 코어에 맡기면 순서를 잃는다 — `computeFormCards` 가 유형 섹션 블록을 전부 깐 뒤에
   * 코어를 붙이므로 확정본 5번째 자리가 아니라 카드 맨 끝으로 밀린다(FRT-249와 같은 이유).
   */
  it("'작업 기간'은 확정본 ① 의 5번째 자리, 즉 '역할' 과 '공개 / 전시 이력' 사이다", () => {
    const labels = labelsIn(sections()[0].blocks)
    expect(labels.indexOf("작업 기간")).toBe(labels.indexOf("역할") + 1)
    expect(labels.indexOf("공개 / 전시 이력")).toBe(labels.indexOf("작업 기간") + 1)
  })

  it("'작업 기간'은 month~month 를 받는 period 블록이다", () => {
    expect(blockAt(0, "작업 기간").type).toBe("period")
  })

  /**
   * 확정본 ① 에서 *(선택, 필드 삭제 가능)* 표기가 없는 것만 필수다 — 다만 둘은 예외로 뺀다.
   *  · '역할'은 조건부 노출이라 required 로 두면 '개인 작업'을 고른 사용자가 **화면에 없는 칸**
   *    때문에 완료 저장을 못 한다(FRT-211 의 "조건 판정에 걸린 칸이 도달 불가"). 수상경력의
   *    '팀에서 내가 맡은 역할'도 같은 이유로 required 가 아니다.
   *  · '작품 링크 / 파일'은 표라서 required 로 두면 `isRequiredBlock` 이 블록 전체를 필수로 보고
   *    `canHideBlock` 이 숨기지도 못한다 — 링크가 없는 작업은 영영 완료 불가(FRT-236).
   */
  it("① 의 필수는 '작품명 / 작업물명'·'유형 / 매체'·'작업 기간' 셋이다", () => {
    const required = sections()[0].blocks.filter(b => b.required).map(b => b.label)
    expect(required).toEqual(["작품명 / 작업물명", "유형 / 매체", "작업 기간"])
  })

  it("'유형 / 매체'는 확정본 13종 드롭다운이다", () => {
    const field = blockAt(0, "유형 / 매체")
    expect(field.type).toBe("single-select")
    expect(field.options).toEqual([
      "그래픽/디자인",
      "브랜딩/아이덴티티",
      "웹/앱 UI",
      "영상/모션",
      "사진",
      "일러스트/그림",
      "글/문학",
      "음악/사운드",
      "개발/프로젝트",
      "제품/프로덕트",
      "공간/건축",
      "공연/퍼포먼스",
      "기타",
    ])
  })

  it("'개인 / 팀'은 확정본 4종 드롭다운이다", () => {
    const field = blockAt(0, "개인 / 팀")
    expect(field.type).toBe("single-select")
    expect(field.options).toEqual([
      "개인 작업",
      "팀 작업(2~5명)",
      "팀 작업(6명 이상)",
      "공동 프로젝트",
    ])
  })

  /**
   * 확정본은 "'개인 작업' 외 선택 시 노출"이라는 **부정 조건**인데 `VisibilityCondition` 에는
   * 부정이 없어 양성 값을 열거한다. 그래서 선택지가 늘면 이 목록도 함께 늘려야 하고,
   * 빠뜨리면 그 값을 고른 사용자에게 역할 칸이 영영 안 뜬다 — 드리프트를 여기서 고정한다.
   */
  it("'역할'은 '개인 작업'을 뺀 나머지 선택지 전부에서 노출된다", () => {
    const role = blockAt(0, "역할")
    const options = blockAt(0, "개인 / 팀").options ?? []
    expect(role.visibleWhen).toEqual({
      key: "creative-info.개인 / 팀",
      equals: options.filter(o => o !== "개인 작업"),
    })
    // 트리거 키가 실재 블록의 안정키와 어긋나면 조건이 영원히 거짓이 된다.
    expect(role.visibleWhen!.key).toBe(blockAt(0, "개인 / 팀").key)
  })

  it("'공개 / 전시 이력'은 개조식 목록이고 '사용 툴 / 기술'은 자유 태그다", () => {
    expect(blockAt(0, "공개 / 전시 이력").variant).toBe("outcome-list")
    expect(blockAt(0, "사용 툴 / 기술").type).toBe("tags")
  })

  /**
   * 확정본 ① '결과물 블록(artifact-blocks) — 다중 등록 가능'. FRT-213 이 셀 컬럼에 file·link 를
   * 열어 둔 덕에 신규 위젯 없이 표로 받는다. ⚠️ 컬럼에 required 를 붙이지 말 것 — 위 ① 필수 주석과
   * 같은 이유로 링크가 없는 작업이 카드를 영영 완료할 수 없게 된다.
   */
  it("'작품 링크 / 파일'은 링크·파일·설명 3컬럼 다중 등록 표다", () => {
    const table = blockAt(0, "작품 링크 / 파일")
    expect(table.type).toBe("repeatable-cell")
    const columns = table.value.type === "repeatable-cell" ? table.value.columns : []
    expect(columns.map(c => [c.key, c.label, c.blockType])).toEqual([
      ["link", "링크", "link"],
      ["file", "파일", "file"],
      ["desc", "설명", "text"],
    ])
    expect(columns.some(c => c.required)).toBeFalsy()
  })

  /**
   * 이 표는 **파일 열을 가진 첫 템플릿 블록**이라 `hostsAttachment` 가 숨김을 막는다
   * (hidden-fields.ts — 표는 열 단위 업로드 상태를 위로 흘릴 배선이 없어 제외하며, 그 주석은
   * "현재 템플릿에 파일 열이 0개라 비용이 없다"를 전제로 쓰였다. 이 필드가 그 전제를 깬다).
   *
   * 그래도 결함이 아니다 — 확정본이 '작품 링크 / 파일'에 *(선택, 필드 삭제 가능)* 표기를 하지
   * 않았으므로 **치울 수 없는 것이 확정본과 일치**한다. 진행도도 막히지 않는다: ① 은 필수가 있는
   * 카드라 `isCardComplete` 가 필수만으로 판정하고, 비어 있는 이 표는 세지 않는다.
   *
   * ⚠️ 그래서 ① 에서 필수를 전부 없애면 이 카드는 `some(채워짐)` 기준으로 바뀌고, 그 순간 링크가
   * 없는 사용자는 **치울 수도 채울 수도 없는** 카드를 얻는다(FRT-236 이 독서에서 만난 자리).
   * 두 사실을 한 테스트에 묶어 그 조합이 깨지면 여기서 걸리게 한다.
   */
  it("'작품 링크 / 파일'은 치울 수 없지만 — ① 이 필수 기준 카드라 진행도를 막지 않는다", () => {
    const table = blockAt(0, "작품 링크 / 파일")
    // 실제 게이트는 `canHideBlock` 이다 — `isCardComplete` 는 숨김 키를 먼저 걸러내므로
    // "숨길 수 있는가"를 증명하지 못한다(FRT-236).
    expect(isRequiredBlock(table)).toBe(false)
    expect(canHideBlock(table)).toBe(false)

    const card = { id: "basic", category: "basic" as const, label: "기본 정보", blocks: sections()[0].blocks }
    expect(card.blocks.some(isRequiredBlock)).toBe(true)
    // 필수를 채우면 빈 '작품 링크 / 파일' 이 남아 있어도 카드가 완료된다.
    const filled = {
      ...card,
      blocks: card.blocks.map(b =>
        isRequiredBlock(b)
          ? b.value.type === "period"
            ? { ...b, value: { ...b.value, start: "2024-01" } }
            : b.value.type === "single-select"
              ? { ...b, value: { ...b.value, selected: "사진" } }
              : { ...b, value: { type: "text" as const, text: "채움" } }
          : b,
      ),
    }
    expect(isCardComplete(filled)).toBe(true)
  })

  /**
   * ⚠️ 선행 5종과 **반대 결론**이다. 봉사·해외경험 등은 core '내 역할/기여도'를 뺐지만, 창작물은
   * 빼지 않는다 — 구 `cw-info`/`cw-process` 에 role 동의어 앵커가 **하나도 없어** 이 코어 칸이
   * 실제로 화면에 렌더됐고 값이 들어 있을 수 있기 때문이다. 빼면 그 값이 '기타'로 밀린다.
   * 대신 확정본의 '역할'이 새 앵커가 되므로 `keepCoreOrExtended` 가 빈 것만 숨기고 값 있는 것은
   * 남긴다 — 확정본 충실성과 값 보존이 동시에 성립한다.
   * (FRT-249 Codex P1 의 판정식 "그 유형 섹션에 동명·동의어 앵커가 있었나"를 필드마다 따로 물은 결과다.)
   */
  it("core 에는 헤더 둘과 '내 역할/기여도'가 남는다 — 기간·성과·증빙만 확정본 필드로 대체됐다", () => {
    const core = labelsIn(getTemplateForType("creative-work").commonCore.blocks)
    expect(core).toEqual(["경험명", "한 줄 요약", "내 역할/기여도"])
  })

  it("② 작업 상세는 확정본 5필드를 순서 그대로 갖는다", () => {
    expect(labelsIn(sections()[1].blocks)).toEqual([
      "작업 배경 / 컨셉",
      "제작 과정",
      "반응 / 피드백",
      "이 작업이 나에게 남긴 것",
      "작품 성격",
    ])
  })

  it("② 는 '섹션 전체 선택'이라 필수 필드가 하나도 없다", () => {
    expect(sections()[1].blocks.some(b => b.required)).toBe(false)
  })

  /** 확정본 설계 노트: 🌱 개인 프로젝트 태그는 ① '개인/팀'과 중복이라 삭제됐다 — 되살리지 말 것. */
  it("'작품 성격'은 확정본 12종 이모지 태그다", () => {
    const tags = blockAt(1, "작품 성격")
    expect(tags.type).toBe("checklist")
    expect(tags.variant).toBe("mood-tag")
    expect(tags.options).toEqual([
      "🎨 실험적",
      "💼 상업적",
      "📖 서사적",
      "🔍 리서치 기반",
      "💡 컨셉 중심",
      "🛠️ 기술 중심",
      "🤝 협업 기반",
      "🧪 프로토타입/실험작",
      "🎯 특정 타겟 대상",
      "🏆 공모전 출품작",
      "📚 학술/졸업 작품",
      "🌍 사회적 메시지",
    ])
    expect(tags.options).not.toContain("🌱 개인 프로젝트")
  })

  it("①② 의 모든 필드에 가이드라인이 있다 (확정본이 '—'로 비운 것만 예외)", () => {
    // 확정본이 가이드라인 칸을 '—' 로 비운 필드 — 없는 문구를 지어내지 않는다.
    const NO_GUIDE = new Map<string, "placeholder" | "options" | "type">([
      ["개인 / 팀", "options"],
      ["작업 기간", "type"],
    ])
    for (const s of sections()) {
      for (const b of s.blocks) {
        const fallback = NO_GUIDE.get(b.label)
        if (fallback) {
          expect(b[fallback], `${s.id}/${b.label}`).toBeTruthy()
          continue
        }
        expect(b.guide, `${s.id}/${b.label}`).toBeTruthy()
      }
    }
  })

  it("확정본에 없는 구 필드는 템플릿에서 사라진다 (값은 매퍼가 orphan 으로 보존)", () => {
    const labels = sections().flatMap(s => labelsIn(s.blocks))
    for (const gone of [
      "작품/작업물명",
      "분야",
      "제작 기간",
      "한 줄 소개",
      "의도/주제",
      "사용 도구",
      "공개 링크",
      "반응/성과",
      "저작권/사용 범위",
    ]) {
      expect(labels, gone).not.toContain(gone)
    }
  })

  /** 섹션 id 교체는 breaking change 다 — `withSectionKeys` 규약대로 bump 를 동반한다. */
  it("섹션 id 를 갈아치웠으므로 TEMPLATE_VERSION 이 해외경험(5) 위로 올라가 있다", () => {
    expect(TEMPLATE_VERSION).toBeGreaterThanOrEqual(6)
  })
})

describe("확정본: 연구논문", () => {
  const sections = () => getTemplateForType("research").extensions.filter(s => s.id !== "extended")
  const labelsIn = (blocks: Block[]) => blocks.map(b => b.label)
  const blockAt = (idx: number, label: string) =>
    sections()[idx].blocks.find(b => b.label === label)!
  const columnsOf = (block: Block) =>
    block.value.type === "repeatable-cell" ? block.value.columns : []

  it("확정본 3섹션을 순서·id·category 그대로 갖는다 (④ 는 코어 증빙이 받는다)", () => {
    expect(sections().map(s => [s.id, s.category])).toEqual([
      ["research-paper", "basic"],
      ["research-content", "detail"],
      ["research-publication", "repeat"],
    ])
  })

  /**
   * 구 `research-info` 를 유지하면 '역할'(주저자/공저/연구원/RA/기타)의 안정키가 그대로라,
   * 선택지가 5종으로 다시 짜인 값이 injectValue 로 실려 새 드롭다운에 없는 값이 박힌다 —
   * 고를 수도 지울 수도 없다(FRT-247 봉사 '대상', FRT-249 해외경험 '경험 유형'과 같은 함정).
   */
  it("구 섹션 id 를 재사용하지 않는다 — 구 키가 orphan 안전망으로 흐르게", () => {
    expect(sections().map(s => s.id)).not.toContain("research-info")
  })

  it("① 기본 정보는 확정본 필드를 순서 그대로 갖는다 (경험명·한 줄 요약은 헤더 코어 소유)", () => {
    expect(labelsIn(sections()[0].blocks)).toEqual([
      "연구 / 논문 제목",
      "유형",
      "연구 분야",
      "지도 교수",
      "소속 기관 / 연구실",
      "연구 기간",
      "역할 / 기여도",
      "공저자 / 팀원",
      "논문 파일 / 링크",
    ])
  })

  /**
   * '연구 기간'은 코어에 맡기면 순서를 잃는다 — `computeFormCards` 가 유형 섹션 블록을 전부 깐 뒤에
   * 코어를 붙이므로 확정본 6번째 자리가 아니라 카드 맨 끝으로 밀린다(FRT-249·FRT-267과 같은 이유).
   */
  it("'연구 기간'은 확정본 ① 의 6번째 자리, 즉 '소속 기관 / 연구실' 과 '역할 / 기여도' 사이다", () => {
    const labels = labelsIn(sections()[0].blocks)
    expect(labels.indexOf("연구 기간")).toBe(labels.indexOf("소속 기관 / 연구실") + 1)
    expect(labels.indexOf("역할 / 기여도")).toBe(labels.indexOf("연구 기간") + 1)
    expect(blockAt(0, "연구 기간").type).toBe("period")
  })

  /**
   * 확정본 ① 에서 *(선택, 필드 삭제 가능)* 표기가 없는 것만 필수다. '논문 파일 / 링크'는
   * 표기가 **있으므로** 애초에 대상이 아니고, 표라서 required 를 붙이면 `isRequiredBlock` 이
   * 블록 전체를 필수로 보고 `canHideBlock` 이 숨기지도 못한다(FRT-236) — 확정본이 삭제 가능이라
   * 못 박은 칸이 영영 삭제 불가가 된다. 두 근거가 같은 결론을 가리킨다.
   */
  it("① 의 필수는 '연구 / 논문 제목'·'유형'·'연구 분야'·'연구 기간' 넷이다", () => {
    const required = sections()[0].blocks.filter(b => b.required).map(b => b.label)
    expect(required).toEqual(["연구 / 논문 제목", "유형", "연구 분야", "연구 기간"])
  })

  it("'유형'은 확정본 9종 드롭다운이다", () => {
    const field = blockAt(0, "유형")
    expect(field.type).toBe("single-select")
    expect(field.options).toEqual([
      "학부 논문/졸업 논문",
      "학회 발표 논문",
      "저널 게재 논문",
      "학부생 연구 프로젝트(URP 등)",
      "연구실 인턴/참여 연구",
      "공동 연구",
      "리뷰/서베이 페이퍼",
      "학위 논문(석·박사)",
      "기타",
    ])
  })

  it("'역할 / 기여도'는 확정본 5종 드롭다운이다", () => {
    const field = blockAt(0, "역할 / 기여도")
    expect(field.type).toBe("single-select")
    expect(field.options).toEqual([
      "제 1저자(주저자)",
      "공동 저자",
      "연구 참여(데이터 수집·분석)",
      "지도 하 단독 연구",
      "기타",
    ])
    // 구 '역할' 선택지가 섞여 남으면 이관 판정(SELECT_DOMAIN_MIGRATIONS)의 전제가 무너진다.
    for (const gone of ["주저자", "공저", "연구원", "RA"]) {
      expect(field.options, gone).not.toContain(gone)
    }
  })

  /**
   * 확정본은 이 한 칸에서 'URL + 파일 첨부'를 함께 받는다. 블록 `file` 은 업로드 전용이고
   * (`FileBlockValue.url` 은 사용자가 적는 링크가 아니라 만료되는 presigned 다운로드 URL),
   * 블록 `link` 는 파일을 못 받는다 — 둘을 한 칸에 담는 위젯은 표뿐이다(창작물 '작품 링크 / 파일').
   */
  it("'논문 파일 / 링크'는 링크·파일 2컬럼 표이고 컬럼에 필수가 없다", () => {
    const table = blockAt(0, "논문 파일 / 링크")
    expect(table.type).toBe("repeatable-cell")
    expect(columnsOf(table).map(c => [c.key, c.label, c.blockType])).toEqual([
      ["link", "링크", "link"],
      ["file", "파일", "file"],
    ])
    expect(columnsOf(table).some(c => c.required)).toBeFalsy()
  })

  /**
   * ⚠️ 확정본 ④ '연구 증빙'은 **코어 증빙 카드 그 자체**다 — 파일 + '파일 설명' + '증빙 유형'
   * 세 칸이 `FileBlockValue` 와 1:1이다. 그래서 봉사·어학·해외와 **반대로** core '증빙 자료'를
   * 빼지 않는다(자격증·수상경력과 같은 처리). 빼면 첨부 수단이 통째로 사라진다.
   * 반대로 기간·역할·성과는 구 `research-info` 에 동명·동의어 앵커가 있어 dedup 이 빈 코어를
   * 이미 지워 왔으므로 빼도 안전하다(FRT-249 Codex P1 의 판정식).
   */
  it("core 에는 헤더 둘과 '증빙 자료'가 남는다 — 기간·역할·성과만 확정본 필드로 대체됐다", () => {
    const core = labelsIn(getTemplateForType("research").commonCore.blocks)
    expect(core).toEqual(["경험명", "한 줄 요약", "증빙 자료"])
  })

  it("코어 '증빙 자료'의 증빙 유형이 확정본 ④ 4종 드롭다운이다", () => {
    const evidence = getTemplateForType("research").commonCore.blocks.find(
      b => b.label === "증빙 자료",
    )!
    expect(evidence.options).toEqual([
      "연구 참여 확인서",
      "IRB 승인서",
      "우수 발표 인증서/상장",
      "기타",
    ])
  })

  it("② 연구 내용은 확정본 6필드를 순서 그대로 갖고, 필수가 하나도 없다", () => {
    expect(labelsIn(sections()[1].blocks)).toEqual([
      "연구 주제 / 배경",
      "초록 / 핵심 요약",
      "연구 방법론",
      "주요 발견 / 결과",
      "연구 성격",
      "평가 / 피드백",
    ])
    // 확정본은 ② 를 '필수' 섹션이라 부르지만 여섯 칸 모두 (선택, 필드 삭제 가능) 이다.
    expect(sections()[1].blocks.some(b => b.required)).toBe(false)
  })

  it("'연구 방법론'·'주요 발견 / 결과'는 개조식 목록이다", () => {
    expect(blockAt(1, "연구 방법론").variant).toBe("outcome-list")
    expect(blockAt(1, "주요 발견 / 결과").variant).toBe("outcome-list")
  })

  it("'연구 성격'은 확정본 10종 이모지 태그다", () => {
    const tags = blockAt(1, "연구 성격")
    expect(tags.type).toBe("checklist")
    expect(tags.variant).toBe("mood-tag")
    expect(tags.options).toEqual([
      "📊 정량 연구",
      "💬 정성 연구",
      "🔬 실험 연구",
      "📚 문헌 연구",
      "🔍 사례 연구",
      "🧮 데이터 분석",
      "🤖 머신러닝/AI",
      "🌐 융합/학제간",
      "📝 이론 정립",
      "🎯 응용/실용",
    ])
  })

  it("③ 게재 / 발표 이력은 확정본 7컬럼 반복 표이고 컬럼에 필수가 없다", () => {
    expect(sections()[2].blocks).toHaveLength(1)
    const table = blockAt(2, "게재 / 발표")
    expect(table.type).toBe("repeatable-cell")
    expect(columnsOf(table).map(c => [c.key, c.label, c.blockType])).toEqual([
      ["type", "유형", "single-select"],
      ["venue", "저널 / 학회명", "text"],
      ["date", "게재 / 발표일", "date"],
      ["place", "발표 장소", "text"],
      ["status", "게재 상태", "single-select"],
      ["citations", "피인용 수", "text"],
      ["award", "수상 내역", "text"],
    ])
    // 확정본 ③ 은 "섹션 전체 선택" — 필수 컬럼이 하나라도 생기면 표를 숨길 수 없게 된다(FRT-236).
    expect(columnsOf(table).some(c => c.required)).toBeFalsy()
  })

  /**
   * 확정본은 '게재 / 발표일'을 **month** 로 정했다. 셀의 `date` 는 기본이 일 단위라 그대로 두면
   * 호(issue) 단위로만 아는 게재 시점에 없는 날짜를 지어내게 한다 — `variant: 'month'` 로 좁힌다.
   * (`period` 컬럼은 시작~종료 두 칸이라 단일 시점을 담을 수 없어 대안이 아니다.)
   */
  it("'게재 / 발표일'은 일이 아니라 월 단위로 받는다", () => {
    const date = columnsOf(blockAt(2, "게재 / 발표")).find(c => c.key === "date")
    expect(date?.blockType).toBe("date")
    expect(date?.variant).toBe("month")
  })

  it("③ 의 두 드롭다운 컬럼이 확정본 선택지를 그대로 갖는다", () => {
    const columns = columnsOf(blockAt(2, "게재 / 발표"))
    expect(columns.find(c => c.key === "type")?.options).toEqual([
      "국내 학술지 게재",
      "SCI(E)/SSCI/A&HCI 등재",
      "국내 학회 발표(구두)",
      "국내 학회 발표(포스터)",
      "국제 학회 발표(구두)",
      "국제 학회 발표(포스터)",
      "대학·기관 내부 발표",
      "워킹 페이퍼/프리프린트",
      "기타",
    ])
    expect(columns.find(c => c.key === "status")?.options).toEqual([
      "투고 중",
      "심사 중(Under Review)",
      "게재 예정(Accepted)",
      "게재 완료",
    ])
  })

  it("①② 의 모든 필드에 가이드라인이 있다 (확정본이 '—'로 비운 것만 예외)", () => {
    // 확정본이 가이드라인 칸을 '—' 로 비운 필드 — 없는 문구를 지어내지 않는다.
    const NO_GUIDE = new Map<string, "placeholder" | "options" | "type">([
      ["지도 교수", "placeholder"],
      ["소속 기관 / 연구실", "placeholder"],
      ["연구 기간", "type"],
      ["역할 / 기여도", "options"],
    ])
    for (const s of sections().slice(0, 2)) {
      for (const b of s.blocks) {
        const fallback = NO_GUIDE.get(b.label)
        if (fallback) {
          expect(b[fallback], `${s.id}/${b.label}`).toBeTruthy()
          continue
        }
        expect(b.guide, `${s.id}/${b.label}`).toBeTruthy()
      }
    }
  })

  it("확정본에 없는 구 필드는 템플릿에서 사라진다 (값은 매퍼가 orphan 으로 보존)", () => {
    const labels = sections().flatMap(s => labelsIn(s.blocks))
    for (const gone of [
      "연구 주제/논문 제목",
      "소속/기관/랩",
      "역할",
      "연구 질문/가설",
      "방법/설계",
      "데이터/자료 출처",
      "내가 맡은 파트",
      "결과 요약",
      "성과",
      "재현/공유 자료",
      "참고문헌/관련 읽을거리",
      "산출물",
    ]) {
      expect(labels, gone).not.toContain(gone)
    }
  })

  /** 섹션 id 교체는 breaking change 다 — `withSectionKeys` 규약대로 bump 를 동반한다. */
  it("섹션 id 를 갈아치웠으므로 TEMPLATE_VERSION 이 창작물(6) 위로 올라가 있다", () => {
    expect(TEMPLATE_VERSION).toBeGreaterThanOrEqual(7)
  })
})

describe("확정본: 프로젝트 (개인·팀 통합)", () => {
  const sections = () =>
    getTemplateForType("personal-project").extensions.filter(s => s.id !== "extended")
  const labelsIn = (blocks: Block[]) => blocks.map(b => b.label)
  const blockAt = (idx: number, label: string) => sections()[idx].blocks.find(b => b.label === label)!
  const columnsOf = (block: Block) =>
    block.value.type === "repeatable-cell" ? block.value.columns : []

  it("확정본 5섹션을 순서·id·category 그대로 갖는다 (④⑤ 는 evidence 한 카드로 접힌다)", () => {
    expect(sections().map(s => [s.id, s.category])).toEqual([
      ["project-info", "basic"],
      ["project-detail", "detail"],
      ["project-tasks", "repeat"],
      ["project-release", "evidence"],
      ["project-artifacts", "evidence"],
    ])
  })

  it("구 섹션 id 를 재사용하지 않는다 — 구 키가 orphan 안전망으로 흐르게", () => {
    const ids = sections().map(s => s.id)
    for (const gone of ["pp-info", "pp-decisions", "tp-info", "tp-tasks"]) {
      expect(ids, gone).not.toContain(gone)
    }
  })

  /**
   * 확정본은 개인/팀을 **유형이 아니라 항목**으로 묻는다 → 은퇴한 `team-project` 레코드도
   * 같은 폼으로 열려야 한다. 두 id 가 갈리면 같은 유형인데 저장 세대에 따라 화면이 달라진다.
   */
  it("개인·팀 두 id 가 같은 템플릿을 받는다", () => {
    const personal = getTemplateForType("personal-project").extensions.map(s => s.id)
    const team = getTemplateForType("team-project").extensions.map(s => s.id)
    expect(team).toEqual(personal)
  })

  it("선택 목록에서는 팀 프로젝트가 내려갔지만 라벨 조회는 계속 된다", () => {
    expect(EXPERIENCE_TYPES.map(t => t.id)).not.toContain("team-project")
    // 목록에서 빼기만 하고 map 에서도 빠지면 `hasTemplate` 이 v2 판정을 못 해 기존 팀 레코드가
    // 통째로 v1 경로로 떨어지고, 대시보드·카드·상세의 라벨이 사라진다.
    expect(EXPERIENCE_TYPE_MAP["team-project"]?.label).toBe("프로젝트")
    expect(EXPERIENCE_TYPE_MAP["personal-project"]?.label).toBe("프로젝트")
  })

  /**
   * 목록에서 내린 id 는 **필터 칩이 만들어지지 않는다** → 그 id 를 정확 일치로 거르는 소비처가
   * 있으면 옛 레코드를 골라낼 방법이 영영 사라진다. 그래서 **자리를 넘겨받은 유형이 있는 은퇴
   * (흡수형)** 는 반드시 그 현행 id 로 접힌다.
   *
   * 원래 이 단언은 "은퇴 id 는 *전부* 접힌다"였다. FRT-300 이 **대신할 유형이 없는 은퇴(폐기형)**
   * 를 들여오면서 그 규칙이 더는 전칭이 아니게 됐다 — 접을 곳이 없는데 억지로 접으면 그 기록이
   * 남의 유형으로 집계된다. 그래서 두 갈래를 갈라 단언하되, **접혔다면 반드시 지금 고를 수 있는
   * 유형이어야 한다**는 알맹이는 그대로 지킨다(은퇴 유형으로 접히면 문제가 그대로 남는다).
   */
  it("은퇴한 id 는 현행 유형으로 접히거나, 접히지 않고 자기 자신으로 해석된다", () => {
    const selectable = EXPERIENCE_TYPES.map(t => t.id)
    for (const id of RETIRED_TYPE_IDS) {
      const canonical = canonicalTypeId(id)
      if (canonical === id) {
        // 폐기형 — 자기 라벨·자기 템플릿으로 계속 해석돼야 한다.
        expect(EXPERIENCE_TYPE_MAP[id], id).toBeDefined()
      } else {
        // 흡수형 — 접힌 곳은 반드시 '지금 고를 수 있는' 유형이다.
        expect(selectable, id).toContain(canonical)
      }
    }
  })

  it("현행 id 는 그대로 통과한다", () => {
    for (const t of EXPERIENCE_TYPES) {
      expect(canonicalTypeId(t.id)).toBe(t.id)
    }
  })

  it("① 기본 정보는 확정본 필드를 순서 그대로 갖는다 (경험명·한 줄 요약은 헤더 코어 소유)", () => {
    expect(labelsIn(sections()[0].blocks)).toEqual([
      "프로젝트명",
      "프로젝트 유형",
      "개인 / 팀",
      "역할",
      "진행 기간",
      "사용 기술 / 툴",
      "팀원",
    ])
  })

  it("① 프로젝트 유형은 확정본 9종을 그대로 갖는다", () => {
    expect(blockAt(0, "프로젝트 유형").options).toEqual([
      "앱/웹 서비스 개발",
      "데이터 분석/모델링",
      "기획/전략 프로젝트",
      "디자인 프로젝트",
      "해커톤",
      "스터디 결과물",
      "비즈니스 아이디어 실험",
      "콘텐츠/미디어 제작",
      "기타",
    ])
  })

  it("① 개인 / 팀은 확정본 3종을 그대로 갖는다", () => {
    expect(blockAt(0, "개인 / 팀").options).toEqual([
      "개인 프로젝트",
      "팀 프로젝트(2~5명)",
      "팀 프로젝트(6명 이상)",
    ])
  })

  /**
   * 트리거 키는 `${sectionId}.${label}` 파생이라 라벨을 바꾸면 함께 바꿔야 한다.
   * 어긋나면 조건이 영원히 미충족이 되어 역할 칸이 아예 안 뜬다 — 이 테스트가 유일한 방어선이다.
   */
  it("① 역할의 조건부 노출 트리거가 실제 '개인 / 팀' 안정키를 가리킨다", () => {
    expect(blockAt(0, "역할").visibleWhen?.key).toBe(blockAt(0, "개인 / 팀").key)
  })

  /** 확정본 §4 "'개인 프로젝트' 외 선택 시 노출" — 손으로 적지 않고 선택지에서 파생시킨다. */
  it("① 역할은 '개인 프로젝트' 를 뺀 나머지 선택지 전부에서 노출된다", () => {
    const all = blockAt(0, "개인 / 팀").options ?? []
    expect(blockAt(0, "역할").visibleWhen?.equals).toEqual(all.filter(o => o !== "개인 프로젝트"))
  })

  /** 조건부 노출 칸을 required 로 두면 '개인 프로젝트'에서 화면에 없는 칸이 완료 저장을 막는다. */
  it("① 역할은 required 가 아니다", () => {
    expect(blockAt(0, "역할").required).toBeFalsy()
  })

  it("① 필수는 확정본이 (선택) 표기를 안 한 셋뿐이다", () => {
    expect(sections()[0].blocks.filter(b => b.required).map(b => b.label)).toEqual([
      "프로젝트명",
      "프로젝트 유형",
      "진행 기간",
    ])
  })

  it("② 프로젝트 상세는 확정본 5필드를 순서 그대로 갖는다", () => {
    expect(labelsIn(sections()[1].blocks)).toEqual([
      "기획 배경 / 동기",
      "핵심 성과",
      "어려움 / 문제 해결",
      "이 프로젝트가 나에게 남긴 것",
      "성장 / 변화",
    ])
  })

  /** 확정본 ② 는 "(필수)" 섹션인데 다섯 칸이 모두 *(선택)* 이다 — 연구논문과 같게 읽는다. */
  it("② 는 required 를 하나도 두지 않는다", () => {
    expect(sections()[1].blocks.filter(b => b.required)).toEqual([])
  })

  it("② 성장 / 변화는 확정본 10종 이모지 카드다", () => {
    const growth = blockAt(1, "성장 / 변화")
    expect(growth.variant).toBe("mood-tag")
    expect(growth.options).toEqual([
      "🗺️ 기획/설계",
      "⚡ 실행력",
      "🧠 문제 해결력",
      "🤝 협업/팀워크",
      "🚩 리더십",
      "⚙️ 기술 역량",
      "👤 사용자 이해",
      "📊 데이터 감각",
      "🗣️ 커뮤니케이션",
      "🎯 우선순위 판단",
    ])
  })

  /**
   * ②→③ '＋ 세부 기록' 은 학회·독서·어학이 쓰는 FRT-76 링크 그대로다. 대상 섹션·컬럼이
   * 실재하지 않으면 버튼이 조용히 아무 일도 안 한다(드리프트 가드).
   */
  it("② 핵심 성과의 세부 기록 링크가 실재하는 ③ 섹션·컬럼을 가리킨다", () => {
    const link = blockAt(1, "핵심 성과").linkConfig
    expect(link?.label).toBe("＋ 세부 기록")
    const target = sections().find(s => s.id === link?.targetSectionId)
    expect(target, link?.targetSectionId).toBeTruthy()
    const cell = target!.blocks.find(b => b.value.type === "repeatable-cell")!
    expect(columnsOf(cell).map(c => c.key)).toContain(link!.titleColumnKey)
  })

  it("③ 세부 작업은 확정본 컬럼을 순서 그대로 갖는다", () => {
    expect(columnsOf(blockAt(2, "세부 작업")).map(c => [c.label, c.blockType])).toEqual([
      ["작업 단위명", "text"],
      ["기간", "period"],
      ["내가 한 일", "textarea"],
      ["성과 / 결과", "textarea"],
      ["어려움 / 문제 해결", "textarea"],
    ])
  })

  /**
   * 확정본 ③ '결과물' 은 세부 작업 하나당 **여러 건**이라 열로는 담을 수 없다(셀 값은 단일).
   * 행 첨부로 받는다 — 이 플래그가 꺼지면 결과물 입력이 화면에서 통째로 사라진다.
   */
  it("③ 은 행마다 결과물을 여러 건 붙일 수 있다", () => {
    expect(blockAt(2, "세부 작업").allowRowArtifacts).toBe(true)
  })

  it("③ 필수 컬럼은 확정본이 (선택) 표기를 안 한 둘뿐이다", () => {
    expect(columnsOf(blockAt(2, "세부 작업")).filter(c => c.required).map(c => c.label)).toEqual([
      "작업 단위명",
      "내가 한 일",
    ])
  })

  it("④ 공개 / 배포 이력은 확정본 4필드를 순서 그대로 갖는다", () => {
    expect(labelsIn(sections()[3].blocks)).toEqual([
      "배포 / 공개 채널",
      "사용자 수 / 반응",
      "외부 노출 이력",
      "서비스 운영 상태",
    ])
  })

  /** 확정본 라벨은 '현재 운영 상태'인데 상단 진행 상태 토글과 겹쳐 읽혀 바꿨다(사용자 확인). */
  it("④ 서비스 운영 상태는 확정본 4종을 그대로 갖는다", () => {
    expect(blockAt(3, "서비스 운영 상태").options).toEqual([
      "운영 중",
      "종료(아카이브 공개)",
      "종료(비공개)",
      "개발 중/준비 중",
    ])
  })

  /** 확정본 초과 결정 — 채널명만으로는 실제 주소를 남길 자리가 없다(사용자 요청). */
  it("④ 배포 / 공개 채널은 채널과 링크를 함께 받는다", () => {
    expect(columnsOf(blockAt(3, "배포 / 공개 채널")).map(c => [c.key, c.blockType])).toEqual([
      ["channel", "text"],
      ["link", "link"],
    ])
  })

  /**
   * 표 컬럼에 required 가 하나라도 붙으면 `isRequiredBlock` 이 표 전체를 필수로 보고
   * `canHideBlock` 이 숨기지도 못한다 — 배포한 적 없는 프로젝트가 카드를 영영 완료 못 한다.
   */
  it("④⑤ 의 표에는 required 컬럼이 없다", () => {
    expect(columnsOf(blockAt(3, "배포 / 공개 채널")).filter(c => c.required)).toEqual([])
    expect(columnsOf(blockAt(4, "결과물 링크 / 파일")).filter(c => c.required)).toEqual([])
  })

  it("⑤ 결과물 링크 / 파일은 링크·파일·설명 3열 다중 등록이다", () => {
    expect(columnsOf(blockAt(4, "결과물 링크 / 파일")).map(c => [c.key, c.blockType])).toEqual([
      ["link", "link"],
      ["file", "file"],
      ["desc", "text"],
    ])
  })

  it("확정본에 없는 구 필드는 템플릿에서 사라졌다 (값은 orphan '기타' 로 보존)", () => {
    const labels = sections().flatMap(s => labelsIn(s.blocks))
    for (const gone of [
      "한 줄 설명",
      "대상 사용자/사용 상황",
      "주요 기능",
      "설계/결정",
      "다음 개선 계획",
      "협업 방식",
      "역할 분담표",
      "내 역할",
      "회고 (잘된 점/아쉬운 점/다음엔)",
      "갈등/의견 차이와 조율",
    ]) {
      expect(labels, gone).not.toContain(gone)
    }
  })

  /** 섹션 id 교체는 breaking change 다 — `withSectionKeys` 규약대로 bump 를 동반한다. */
  it("섹션 id 를 갈아치웠으므로 TEMPLATE_VERSION 이 연구논문(7) 위로 올라가 있다", () => {
    expect(TEMPLATE_VERSION).toBeGreaterThanOrEqual(8)
  })
})

/**
 * FRT-300 — 경험 유형 선택지를 확정본 14종으로 정리.
 *
 * 이 블록이 지키는 불변식은 하나다: **내려간 것은 '선택지'뿐이고, 레지스트리·템플릿은 그대로다.**
 * 두 단언을 한 벌로 두는 이유는 둘이 같은 배열에서 갈라져 나오기 때문이다 — 목록만 보면
 * "은퇴 3종이 빠졌다"가 성공으로 보이는데, 그게 레지스트리에서 빠진 결과일 수도 있다.
 *
 * 은퇴는 두 종류이고 여기서 갈린다(FRT-291 흡수 / FRT-300 폐기). 흡수형은 `canonicalTypeId` 로
 * 접히고, 폐기형은 접히면 **남의 유형으로 둔갑**하므로 접히지 않아야 한다.
 */
describe("확정본에서 내려간 유형 (FRT-300)", () => {
  /** 대신할 유형이 없어 자기 라벨·자기 템플릿을 그대로 유지하는 '폐기형'. */
  const DISCARDED: ExperienceTypeId[] = ["sports", "journal", "goal"]

  it("선택지에는 폐기된 유형이 없다 — 확정본 14종만 남는다", () => {
    const ids = EXPERIENCE_TYPES.map(t => t.id)
    for (const id of DISCARDED) {
      expect(ids, id).not.toContain(id)
    }
    // 확정본 14종 + '나는 누구인가?'(FRT-320) = 목록 15항목. 프로젝트는 FRT-291 에서
    // 개인·팀이 한 유형으로 합쳐졌다.
    expect(EXPERIENCE_TYPES).toHaveLength(15)
  })

  it("폐기된 유형도 라벨·아이콘 레지스트리에는 남는다 — 기존 기록의 유형 이름이 깨지지 않게", () => {
    for (const id of DISCARDED) {
      expect(EXPERIENCE_TYPE_MAP[id], id).toBeDefined()
      expect(EXPERIENCE_TYPE_MAP[id].label, id).toBeTruthy()
      expect(RETIRED_TYPE_IDS, id).toContain(id)
    }
  })

  it("폐기된 유형도 템플릿이 그대로 조립된다 — 기존 기록이 열리고 편집되게", () => {
    for (const id of DISCARDED) {
      const tmpl = getTemplateForType(id)
      expect(tmpl.typeId, id).toBe(id)
      expect(tmpl.commonCore.blocks.length, id).toBeGreaterThan(0)
      expect(TEMPLATE_MAP[id], id).toBeDefined()
    }
  })

  /**
   * 폐기형에 alias 를 걸면 그 기록이 통째로 남의 유형으로 집계된다 — 흡수형(`team-project`)과
   * 정확히 반대 처리라, 한 표에 같이 올리는 실수를 여기서 막는다.
   */
  it("폐기된 유형은 접히지 않는다 — 대신할 유형이 없으므로", () => {
    for (const id of DISCARDED) {
      expect(canonicalTypeId(id), id).toBe(id)
    }
    // 대조군: 흡수형은 접힌다.
    expect(canonicalTypeId("team-project")).toBe("personal-project")
  })

  it("저장될 수 있는 모든 유형은 템플릿을 갖는다 — 목록에서 내리는 일이 템플릿 삭제로 번지지 않게", () => {
    for (const t of ALL_EXPERIENCE_TYPES) {
      expect(TEMPLATE_MAP[t.id], t.id).toBeDefined()
    }
  })

  it("선택지의 모든 유형은 레지스트리에 있고 은퇴 목록에 없다", () => {
    for (const t of EXPERIENCE_TYPES) {
      expect(EXPERIENCE_TYPE_MAP[t.id], t.id).toBeDefined()
      expect(RETIRED_TYPE_IDS, t.id).not.toContain(t.id)
    }
  })
})

/**
 * FRT-320 — '나는 누구인가?' 확정본 (나는누구인가_final).
 *
 * 다른 유형이 "무엇을 했는가"를 기록한다면 이 유형은 "나는 어떤 사람인가"를 기록하는
 * 자기 인식 프로필이다. 그래서 두 가지가 다른 유형과 구조적으로 다르다:
 *  · core 4종(기간·역할·성과·증빙)이 전부 성립하지 않는 질문이라 모두 CORE_EXCLUDE 다.
 *    기간이 없으므로 TYPE_PERIOD_KEY 미등록·기간순 정렬 맨 뒤는 **의도된 결과**다.
 *  · 확정본 배너가 "천천히, 오래 두고 채워가세요"다 — 필수 필드를 하나라도 두면
 *    그 약속이 거짓이 되므로 전 필드가 선택이다.
 */
describe("확정본: 나는 누구인가 (FRT-320)", () => {
  const sections = () =>
    getTemplateForType("self-identity").extensions.filter(s => s.id !== "extended")
  const labelsIn = (blocks: Block[]) => blocks.map(b => b.label)
  const blockIn = (sectionId: string, label: string) =>
    sections().find(s => s.id === sectionId)!.blocks.find(b => b.label === label)!

  it("선택지·레지스트리에 등록된다 — 칩이 이 배열에서 파생되므로 작성·필터 양쪽에 노출된다", () => {
    expect(EXPERIENCE_TYPES.map(t => t.id)).toContain("self-identity")
    expect(EXPERIENCE_TYPE_MAP["self-identity"].label).toBe("나는 누구인가?")
    expect(EXPERIENCE_TYPE_MAP["self-identity"].category).toBe("personal")
    expect(RETIRED_TYPE_IDS).not.toContain("self-identity")
  })

  /**
   * ⑤(관심 분야)도 repeat 이 아니라 detail 이다 — 카드가 카테고리 순서(basic→detail→repeat)로
   * 서므로 repeat 으로 두면 ⑤ 가 ⑥⑦ 뒤로 밀려 문서 순서가 깨진다. ②~⑦ 이 전부
   * `standalone: true` 라 각자 자기 카드로 서고, 템플릿 순서가 곧 카드 순서다.
   */
  it("확정본 7섹션을 순서·id·category 그대로 갖는다 — ②~⑦ 은 standalone 카드", () => {
    expect(sections().map(s => [s.id, s.category, s.standalone ?? false])).toEqual([
      ["self-intro", "basic", false],
      ["self-values", "detail", true],
      ["self-worklife", "detail", true],
      ["self-relations", "detail", true],
      ["self-interests", "detail", true],
      ["self-direction", "detail", true],
      ["self-reflection", "detail", true],
    ])
  })

  it("core 는 헤더 둘만 남는다 — 기간·역할·성과·증빙은 프로필에 성립하지 않는 질문이다", () => {
    const core = getTemplateForType("self-identity").commonCore.blocks
    expect(core.map(b => b.label)).toEqual(["경험명", "한 줄 요약"])
  })

  it("① 나를 소개한다면 — 확정본 5필드", () => {
    expect(labelsIn(sections()[0].blocks)).toEqual([
      "내가 나라는 사람을 스스로 정의한다면",
      "주변 사람들이 나를 어떻게 평가하는지",
      "성격적 강점",
      "보완하고 있는 약점",
      "나를 표현하는 키워드",
    ])
  })

  it("'나를 표현하는 키워드'는 확정본 20종 태그 + 직접 추가", () => {
    const kw = blockIn("self-intro", "나를 표현하는 키워드")
    expect(kw.variant).toBe("mood-tag")
    expect(kw.allowCustomTag).toBe(true)
    expect(kw.options).toEqual([
      "꼼꼼한", "추진력 있는", "관계 중심", "분석적인", "감성적인",
      "도전적인", "신중한", "유연한", "책임감 강한", "아이디어가 많은",
      "성실한", "공감 잘하는", "논리적인", "행동파", "호기심 많은",
      "독립적인", "낙관적인", "끈기 있는", "배우는 걸 좋아하는", "정리 잘하는",
    ])
  })

  it("② 가치관과 동기 — 태그 15종과 이유·열정 서술", () => {
    expect(labelsIn(sections()[1].blocks)).toEqual([
      "삶에서 가장 중요하게 생각하는 가치관",
      "이 가치가 중요한 이유",
      "가장 열정을 갖고 임하는 일",
    ])
    const values = blockIn("self-values", "삶에서 가장 중요하게 생각하는 가치관")
    expect(values.variant).toBe("mood-tag")
    // 확정본이 프리셋 15종만 정의한다 — 직접 추가는 ① 키워드에만 있다.
    expect(values.allowCustomTag).toBeUndefined()
    expect(values.options).toEqual([
      "🌱 성장", "🕊️ 자율성", "🏠 안정감", "⚖️ 공정함", "🎨 창의성",
      "🔬 전문성", "🌍 영향력", "🤝 팀워크", "💎 진정성", "⚡ 효율",
      "🔥 도전", "🌏 사회 기여", "👏 인정", "⏰ 균형(워라밸)", "🎯 몰입",
    ])
  })

  /**
   * 확정본 '나의 업무 성향'은 이름 없는 5행 양자택일이다. 행 라벨(실행 방식 등)은 안정키가
   * 되므로 여기 적힌 이름이 곧 계약이다 — 확정본에 이름이 없어 구현이 명명했고, 머지 전
   * 리뷰에서 확정한다.
   */
  it("③ 업무 성향은 확정본 5행 양자택일이다 — 저장은 single-select 그대로", () => {
    const pairs = sections()[2].blocks.filter(b => b.variant === "binary-choice")
    expect(pairs.map(b => b.label)).toEqual([
      "실행 방식", "협업 방식", "관점 순서", "실행 속도", "우선순위",
    ])
    expect(pairs.map(b => b.options)).toEqual([
      ["계획을 세운 뒤 실행", "상황에 맞게 유연하게 대응"],
      ["혼자 집중해서 작업", "함께 논의하며 진행"],
      ["큰 방향부터 잡고 내려가기", "디테일부터 쌓아 올리기"],
      ["빠르게 실행하고 수정", "충분히 검토 후 실행"],
      ["팀워크와 합의를 우선", "개인의 전문성과 성과를 우선"],
    ])
    for (const b of pairs) expect(b.type, b.label).toBe("single-select")
  })

  it("③ 업무 스타일과 협업 — 양자택일 5행 뒤에 역할 태그 8종과 서술 4필드", () => {
    expect(labelsIn(sections()[2].blocks)).toEqual([
      "실행 방식", "협업 방식", "관점 순서", "실행 속도", "우선순위",
      "팀에서 자연스럽게 맡게 되는 역할",
      "동료와 의견 충돌이 생겼을 때 대처 방식",
      "가장 힘들었던 피드백 경험과 대응",
      "에너지를 얻는 순간",
      "에너지를 잃는 순간",
    ])
    const role = blockIn("self-worklife", "팀에서 자연스럽게 맡게 되는 역할")
    expect(role.variant).toBe("mood-tag")
    expect(role.options).toEqual([
      "🚩 리더", "⚡ 실행자", "🗺️ 기획자", "🤝 조율자",
      "📊 분석가", "🎨 크리에이터", "🛡️ 서포터", "🧠 문제 해결사",
    ])
  })

  it("④ 관계와 환경 — 확정본 4필드, 조직 문화 태그 10종", () => {
    expect(labelsIn(sections()[3].blocks)).toEqual([
      "함께 일하고 싶은 사람",
      "함께 일하기 어려운 유형",
      "선호하는 조직 문화",
      "조직문화가 나와 맞지 않을 때 적응 방식",
    ])
    const culture = blockIn("self-relations", "선호하는 조직 문화")
    expect(culture.variant).toBe("mood-tag")
    expect(culture.options).toEqual([
      "🤝 수평적", "📋 체계적", "🕊️ 자율적", "📈 성과 중심", "🔄 과정 중심",
      "🚀 빠른 실행", "💬 깊은 논의", "☕ 따뜻한 분위기", "🔬 전문성 존중", "🎉 재미/유머",
    ])
  })

  it("⑤ 관심 분야와 나의 적합성 — 분야별로 반복 추가하는 4컬럼 표", () => {
    expect(labelsIn(sections()[4].blocks)).toEqual(["관심 분야와 나의 적합성"])
    const table = sections()[4].blocks[0]
    const columns = table.value.type === "repeatable-cell" ? table.value.columns : []
    expect(columns.map(c => [c.key, c.label, c.blockType])).toEqual([
      ["field", "관심 분야 / 직무", "text"],
      ["motive", "이 분야에 관심을 갖게 된 계기", "textarea"],
      ["fit", "이 분야에 나라는 사람이 필요한 이유", "textarea"],
      ["evidence", "관련 경험 / 근거", "textarea"],
    ])
    expect(columns.some(c => c.required)).toBe(false)
    expect(table.lockColumns).toBe(true)
  })

  it("⑥ 방향과 지향점 — 확정본 3필드", () => {
    expect(labelsIn(sections()[5].blocks)).toEqual([
      "1~2년 안에 이루고 싶은 것",
      "장기적으로 되고 싶은 모습",
      "나의 성장에서 빠질 수 없는 경험 하나",
    ])
  })

  it("⑦ 인생 회고 — 시기별 자유 서술 4필드 (구조를 늘릴수록 회고를 못 쓴다)", () => {
    expect(labelsIn(sections()[6].blocks)).toEqual([
      "🧒 유년기", "🎒 중학생", "📚 고등학생", "🎓 대학생",
    ])
    for (const b of sections()[6].blocks) expect(b.type, b.label).toBe("textarea")
  })

  it("⑤·⑦ 은 확정본 섹션 안내를 카드 설명으로 갖는다", () => {
    const interests = sections().find(s => s.id === "self-interests")!
    expect(interests.description).toBe(
      "관심 있는 분야별로 '왜 나인가'를 정리해두세요. 분야마다 다른 이유가 있을 수 있으니 블록을 여러 개 추가해도 좋아요.",
    )
    const reflection = sections().find(s => s.id === "self-reflection")!
    expect(reflection.description).toBe(
      "시기별로 나의 이야기를 자유롭게 풀어보세요. 잘 정리된 글이 아니어도 좋아요. 기억나는 장면, 감정, 사람, 선택 — 떠오르는 대로 적어주세요.",
    )
  })

  it("전 필드가 선택이다 — 표 컬럼까지 (배너 '천천히 채워가세요'가 약속이 되게)", () => {
    for (const s of sections()) {
      for (const b of s.blocks) {
        expect(isRequiredBlock(b), `${s.id}.${b.label}`).toBe(false)
      }
    }
  })

  /**
   * 필수 0 카드의 완료 판정. FRT-291 함정(치울 수도 채울 수도 없는 첨부 표가 완료를 영영
   * 막는다)은 이 유형에 file 블록이 하나도 없어 성립하지 않는다 — 그 사실을 이론이 아니라
   * 코드로 고정한다: 빈 카드는 미완료, 값 하나면 완료.
   */
  it("필수 0 카드도 값 하나로 완료가 된다 — 빈 카드는 미완료", () => {
    const t = getTemplateForType("self-identity")
    const { cards } = computeFormCards(
      t.commonCore.blocks,
      t.extensions.map(e => ({ id: e.id, label: e.label, category: e.category, blocks: e.blocks })),
    )
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) {
      expect(isCardComplete(card, []), card.label).toBe(false)
    }
    const intro = cards.find(c => c.blocks.some(b => b.label === "성격적 강점"))!
    const strength = intro.blocks.find(b => b.label === "성격적 강점")!
    strength.value = { type: "textarea", text: "구조화" }
    expect(isCardComplete(intro, [])).toBe(true)
  })

  it("파일을 담을 블록이 없다 — 업로드 유실 불변식(FRT-291)의 전제가 성립한다", () => {
    for (const s of sections()) {
      for (const b of s.blocks) {
        expect(b.type, `${s.id}.${b.label}`).not.toBe("file")
        expect(b.allowRowArtifacts, `${s.id}.${b.label}`).toBeUndefined()
      }
    }
  })
})
