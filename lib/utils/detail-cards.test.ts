import { describe, expect, it } from "vitest"
import type { Block, BlockValue, ExperienceV2 } from "@/types/archive"
import { getTemplateForType } from "@/lib/constants/templates-v2"
import { cloneBlocks, createGroupBlock, createTextField } from "@/lib/utils/block-utils"
import { buildDetailSections } from "@/lib/utils/detail-cards"

function text(t: string): BlockValue {
  return { type: "text", text: t }
}
function textarea(t: string): BlockValue {
  return { type: "textarea", text: t }
}

function setVal(blocks: Block[], key: string, value: BlockValue): Block[] {
  return blocks.map(b => (b.key === key ? { ...b, value } : b))
}

function makeExperienceV2(overrides: Partial<ExperienceV2> = {}): ExperienceV2 {
  return {
    id: "exp-1",
    userId: "user-1",
    typeId: "career",
    title: "ARC 인턴",
    summary: "백엔드 인턴",
    status: "complete",
    tags: [],
    coreBlocks: [],
    extensionBlocks: [],
    customBlocks: [],
    hiddenKeys: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
    ...overrides,
  }
}

/** career 템플릿 기준으로 값이 채워진 core/extension 블록을 만든다. */
function filledCareerBlocks(): { core: Block[]; ext: Block[] } {
  const tmpl = getTemplateForType("career")
  let core = cloneBlocks(tmpl.commonCore.blocks)
  core = setVal(core, "core.경험명", text("ARC 인턴")) // 헤더 소유 — 본문 제외 대상
  core = setVal(core, "core.한 줄 요약", text("백엔드 인턴")) // 헤더 소유 — 본문 제외 대상
  core = setVal(core, "core.내 역할/기여도", textarea("API 개발"))
  core = setVal(core, "core.핵심 성과", textarea("응답속도 30% 개선"))
  core = setVal(core, "core.증빙 자료", {
    type: "file",
    fileName: "cert.pdf",
    description: "",
    evidenceType: "",
  })

  let ext = cloneBlocks(tmpl.extensions.flatMap(s => s.blocks))
  ext = setVal(ext, "career-info.회사명", text("ARC Inc"))
  ext = setVal(ext, "career-info.근무 기간", {
    type: "period",
    start: "2025-01",
    end: "2025-06",
    isCurrent: false,
  })
  ext = setVal(ext, "career-detail.지원 동기", textarea("성장하고 싶었다"))
  ext = setVal(ext, "career-tasks.프로젝트/담당 업무", {
    type: "repeatable-cell",
    columns: [],
    // 실제 값이 든 행이어야 "반복 기록" 카드가 정당하게 노출된다 — 빈 셀 행은 FRT-122 이후
    // empty 로 판정돼 상세뷰에서 숨겨진다.
    rows: [{ id: "r1", cells: { detail: "결제 API 서버 개발" } }],
  })
  return { core, ext }
}

describe("buildDetailSections", () => {
  it("저장된 섹션 순서(폼 4카드 순서)대로 렌더한다 — 재정렬 없음", () => {
    const { core, ext } = filledCareerBlocks()
    const tmpl = getTemplateForType("career")
    const sections = buildDetailSections(
      makeExperienceV2({ coreBlocks: core, extensionBlocks: ext }),
      tmpl,
    )
    // career 는 repeat 카드에 유형별 이름을 쓴다(SECTION_LABEL_OVERRIDES) — 입력 폼과 같은 이름이
    // 상세뷰에도 나와야 한다(FRT-247).
    expect(sections.map(s => s.label)).toEqual([
      "기본 정보",
      "경험 상세",
      "프로젝트 / 담당 업무 기록",
      "활동 증빙",
    ])
  })

  it("경험명/한 줄 요약은 본문 섹션에 중복 표시되지 않는다 (헤더 단독 소유)", () => {
    const { core, ext } = filledCareerBlocks()
    const tmpl = getTemplateForType("career")
    const sections = buildDetailSections(
      makeExperienceV2({ coreBlocks: core, extensionBlocks: ext }),
      tmpl,
    )
    const allLabels = sections.flatMap(s => s.blocks.map(b => b.label))
    expect(allLabels).not.toContain("경험명")
    expect(allLabels).not.toContain("한 줄 요약")
  })

  it("입력 블록 순서가 섞여도 출력 섹션 순서는 안정적이다", () => {
    const { core, ext } = filledCareerBlocks()
    const tmpl = getTemplateForType("career")
    const shuffled = [...ext].reverse()
    const sections = buildDetailSections(
      makeExperienceV2({ coreBlocks: core, extensionBlocks: shuffled }),
      tmpl,
    )
    expect(sections.map(s => s.label)).toEqual([
      "기본 정보",
      "경험 상세",
      "프로젝트 / 담당 업무 기록",
      "활동 증빙",
    ])
  })

  it("빈 블록은 숨기고, 비어있지 않은 커스텀 블록은 '추가 블록'으로 맨 끝에 둔다", () => {
    const { core, ext } = filledCareerBlocks()
    const tmpl = getTemplateForType("career")
    const custom: Block[] = [
      { id: "c1", type: "text", label: "메모", value: text("추가 메모") },
      { id: "c2", type: "text", label: "빈 메모", value: text("") },
    ]
    const sections = buildDetailSections(
      makeExperienceV2({ coreBlocks: core, extensionBlocks: ext, customBlocks: custom }),
      tmpl,
    )
    const last = sections.at(-1)
    expect(last?.label).toBe("추가 블록")
    expect(last?.blocks.map(b => b.label)).toEqual(["메모"])
  })

  it("빈 셀만 있는 반복 입력 행은 상세뷰에서 숨겨진다 — 유령 섹션 방지 (FRT-122)", () => {
    // career-tasks.프로젝트/담당 업무(repeat 카테고리)만 빈 셀 행으로 두면 "반복 기록" 섹션이 통째로
    // 사라져야 한다(내용 없는 '+ 추가'·placeholder 실체화 후 삭제 경로가 '—'만 남기지 않도록).
    const { core, ext } = filledCareerBlocks()
    const blanked = setVal(ext, "career-tasks.프로젝트/담당 업무", {
      type: "repeatable-cell",
      columns: [],
      rows: [{ id: "r1", cells: { detail: "" } }],
    })
    const tmpl = getTemplateForType("career")
    const sections = buildDetailSections(
      makeExperienceV2({ coreBlocks: core, extensionBlocks: blanked }),
      tmpl,
    )
    expect(sections.find(s => s.label === "프로젝트 / 담당 업무 기록")).toBeUndefined()
  })

  it("매칭되지 않는 확장 블록(레거시 라벨)은 '추가 입력' 없이 정식 섹션에 합류한다", () => {
    // 입력 폼과 동일하게 미리보기도 정식 4섹션만 노출한다 — 어느 템플릿 섹션과도 매칭되지
    // 않는 블록은 자신의 category(없으면 detail=경험 상세)로 합류한다(FRT-75).
    const { core, ext } = filledCareerBlocks()
    const tmpl = getTemplateForType("career")
    const orphan: Block = { id: "o1", type: "text", label: "옛날필드", value: text("legacy") }
    const sections = buildDetailSections(
      makeExperienceV2({ coreBlocks: core, extensionBlocks: [...ext, orphan] }),
      tmpl,
    )
    expect(sections.find(s => s.label === "추가 입력")).toBeUndefined()
    const detail = sections.find(s => s.label === "경험 상세")
    expect(detail?.blocks).toContainEqual(orphan)
  })

  it("v1 모호 라벨(키 없음)도 타입으로 섹션을 특정해 정식 카드에 배치한다", () => {
    // extracurricular: extended.결과/성과(textarea) vs extra-detail.결과/성과(repeatable-cell)
    // → 라벨은 모호하지만 타입(textarea)으로 extended(경험 상세)에 정확히 매칭된다. 미리보기는
    // 값 주입 없이 표시만 하므로 타입 기반 매칭이 안전하다(FRT-75).
    const tmpl = getTemplateForType("extracurricular")
    const legacy: Block = {
      id: "lg1",
      type: "textarea",
      label: "결과/성과",
      value: textarea("성과 내용"),
    }
    const sections = buildDetailSections(
      makeExperienceV2({ typeId: "extracurricular", coreBlocks: [], extensionBlocks: [legacy] }),
      tmpl,
    )
    expect(sections.find(s => s.label === "추가 입력")).toBeUndefined()
    // extracurricular 의 detail 카드 이름은 '활동 상세'(SECTION_LABEL_OVERRIDES).
    const detail = sections.find(s => s.label === "활동 상세")
    expect(detail?.blocks).toContainEqual(legacy)
  })

  it("템플릿 없음(v1/미지 타입) 폴백: 헤더 제외 코어/확장 블록을 단순 그룹 렌더", () => {
    const { core, ext } = filledCareerBlocks()
    const sections = buildDetailSections(
      makeExperienceV2({ coreBlocks: core, extensionBlocks: ext }),
      null,
    )
    expect(sections.map(s => s.label)).toEqual(["기본 정보", "추가 입력"])
    const basicLabels = sections[0].blocks.map(b => b.label)
    expect(basicLabels).not.toContain("경험명")
    expect(basicLabels).not.toContain("한 줄 요약")
  })
})

/**
 * 상세뷰 카드 이름은 입력 폼과 같아야 한다. 폼은 ExperienceFormV2 가 SECTION_LABEL_OVERRIDES 를
 * computeFormCards 에 넘겨 적용해 왔지만 상세뷰는 SECTION_CATEGORIES 의 일반 라벨을 직접
 * 만들어 써서, 저장 전에는 '봉사 회고'로 보이던 카드가 저장 후엔 '경험 상세'가 됐다
 * (FRT-247 Codex P2 — 오버라이드를 쓰는 10개 유형 공통).
 */
describe("buildDetailSections — 유형별 섹션 이름 (FRT-247)", () => {
  it("봉사 확정본의 detail 카드는 상세뷰에서도 '봉사 회고'로 불린다", () => {
    const tmpl = getTemplateForType("volunteer")
    let ext = cloneBlocks(tmpl.extensions.flatMap(s => s.blocks))
    ext = setVal(ext, "volunteer-info.봉사 활동명", text("OO복지관 학습 멘토링"))
    ext = setVal(ext, "volunteer-reflection.배운 점", textarea("상대의 속도에 맞추게 됐다"))

    const sections = buildDetailSections(
      makeExperienceV2({ typeId: "volunteer", coreBlocks: [], extensionBlocks: ext }),
      tmpl,
    )

    expect(sections.map(s => s.label)).toEqual(["기본 정보", "봉사 회고"])
    expect(sections.find(s => s.label === "경험 상세")).toBeUndefined()
  })

  it("오버라이드가 없는 카테고리는 기본 라벨로 폴백한다", () => {
    const tmpl = getTemplateForType("volunteer")
    let ext = cloneBlocks(tmpl.extensions.flatMap(s => s.blocks))
    ext = setVal(ext, "volunteer-info.봉사 활동명", text("OO복지관 학습 멘토링"))

    const sections = buildDetailSections(
      makeExperienceV2({ typeId: "volunteer", coreBlocks: [], extensionBlocks: ext }),
      tmpl,
    )

    // 봉사는 basic 을 오버라이드하지 않는다 → 기본 라벨 유지.
    expect(sections.map(s => s.label)).toEqual(["기본 정보"])
  })

  /**
   * 해외경험(FRT-249)은 repeat 만 오버라이드한다 — detail 은 확정본 ② 의 이름이 기본 라벨과
   * 같은 '경험 상세'라 오버라이드가 없는 것이 정상이다. 카드가 셋 다 뜨는 구성이라
   * "오버라이드한 것만 바뀌고 나머지는 그대로"를 한 번에 증명할 수 있다.
   */
  it("해외경험의 repeat 카드는 상세뷰에서도 '활동별 상세 설명'으로 불린다", () => {
    const tmpl = getTemplateForType("overseas")
    let ext = cloneBlocks(tmpl.extensions.flatMap(s => s.blocks))
    ext = setVal(ext, "overseas-program.국가 / 도시", text("독일 베를린"))
    ext = setVal(ext, "overseas-reflection.기억에 남는 순간", textarea("근거 중심 논의에 놀랐다"))
    ext = ext.map(b =>
      b.key === "overseas-activities.활동별 상세 설명" && b.value.type === "repeatable-cell"
        ? {
            ...b,
            value: {
              ...b.value,
              rows: [{ id: "r1", cells: { activity: "팀 프로젝트", detail: "마케팅 리서치" } }],
            },
          }
        : b,
    )

    const sections = buildDetailSections(
      makeExperienceV2({ typeId: "overseas", coreBlocks: [], extensionBlocks: ext }),
      tmpl,
    )

    expect(sections.map(s => s.label)).toEqual(["기본 정보", "경험 상세", "활동별 상세 설명"])
    expect(sections.find(s => s.label === "반복 기록")).toBeUndefined()
  })
})

describe("buildDetailSections — 사용자 섹션 (FRT-78)", () => {
  it("비어있지 않은 사용자 섹션은 자신의 라벨로 개별 카드가 된다", () => {
    const { core, ext } = filledCareerBlocks()
    const tmpl = getTemplateForType("career")
    const g = createGroupBlock("프로젝트 역할")
    const child = createTextField("메모"); if (child.value.type === "text") child.value.text = "팀 리드"
    g.children = [child]
    const sections = buildDetailSections(
      makeExperienceV2({ coreBlocks: core, extensionBlocks: ext, customBlocks: [g] }),
      tmpl,
    )
    const card = sections.find(s => s.label === "프로젝트 역할")
    expect(card).toBeDefined()
    expect(card?.blocks.map(b => b.label)).toEqual(["메모"])
    // group 자체가 아니라 children(leaf)이 들어간다
    expect(card?.blocks.every(b => b.type !== "group")).toBe(true)
  })

  it("children 이 모두 빈 사용자 섹션은 카드로 노출되지 않는다", () => {
    const { core, ext } = filledCareerBlocks()
    const tmpl = getTemplateForType("career")
    const emptyGroup = createGroupBlock("빈 섹션")
    emptyGroup.children = [createTextField("아무것도 없음")]
    const sections = buildDetailSections(
      makeExperienceV2({ coreBlocks: core, extensionBlocks: ext, customBlocks: [emptyGroup] }),
      tmpl,
    )
    expect(sections.find(s => s.label === "빈 섹션")).toBeUndefined()
  })

  it("여러 사용자 섹션은 customBlocks 순서대로 카드가 된다", () => {
    const { core, ext } = filledCareerBlocks()
    const tmpl = getTemplateForType("career")
    const a = createGroupBlock("섹션A")
    const ca = createTextField("a"); if (ca.value.type === "text") ca.value.text = "1"; a.children = [ca]
    const b = createGroupBlock("섹션B")
    const cb = createTextField("b"); if (cb.value.type === "text") cb.value.text = "2"; b.children = [cb]
    const sections = buildDetailSections(
      makeExperienceV2({ coreBlocks: core, extensionBlocks: ext, customBlocks: [a, b] }),
      tmpl,
    )
    const labels = sections.map(s => s.label)
    expect(labels.indexOf("섹션A")).toBeLessThan(labels.indexOf("섹션B"))
  })

  it("레거시 loose leaf 블록은 '추가 블록' 단일 카드로 들어간다", () => {
    const { core, ext } = filledCareerBlocks()
    const tmpl = getTemplateForType("career")
    const leaf: Block = { id: "l1", type: "text", label: "메모", value: { type: "text", text: "내용" } }
    const g = createGroupBlock("섹션A")
    const c = createTextField("필드"); if (c.value.type === "text") c.value.text = "값"; g.children = [c]
    const sections = buildDetailSections(
      makeExperienceV2({ coreBlocks: core, extensionBlocks: ext, customBlocks: [leaf, g] }),
      tmpl,
    )
    expect(sections.find(s => s.label === "섹션A")?.blocks.map(b => b.label)).toEqual(["필드"])
    expect(sections.find(s => s.label === "추가 블록")?.blocks.map(b => b.label)).toEqual(["메모"])
  })

  it("동명 사용자 섹션 두 개가 서로 다른 id를 가진다 (React key 충돌 방지, I2)", () => {
    // 두 group이 모두 기본 라벨 "새 블록"을 가진 경우 — 저장 후 상세뷰에서 key 충돌이
    // 발생하지 않으려면 DetailSection.id가 각 group.id로 채워져야 한다.
    const { core, ext } = filledCareerBlocks()
    const tmpl = getTemplateForType("career")
    const g1 = createGroupBlock("새 블록")
    const c1 = createTextField("필드1"); if (c1.value.type === "text") c1.value.text = "값1"; g1.children = [c1]
    const g2 = createGroupBlock("새 블록")
    const c2 = createTextField("필드2"); if (c2.value.type === "text") c2.value.text = "값2"; g2.children = [c2]
    const sections = buildDetailSections(
      makeExperienceV2({ coreBlocks: core, extensionBlocks: ext, customBlocks: [g1, g2] }),
      tmpl,
    )
    const userSections = sections.filter(s => s.label === "새 블록")
    expect(userSections).toHaveLength(2)
    expect(userSections[0].id).toBeDefined()
    expect(userSections[1].id).toBeDefined()
    expect(userSections[0].id).toBe(g1.id)
    expect(userSections[1].id).toBe(g2.id)
    expect(userSections[0].id).not.toBe(userSections[1].id)
  })

  /**
   * FRT-306 — 상세뷰도 입력 폼과 같은 소스(`computeFormCards`)를 쓰므로 함께 내려간다.
   *
   * 값이 이미 저장돼 있어도 보이면 안 된다. 상세뷰는 "빈 블록은 숨긴다"라서 값이 없는 새 기록은
   * 어차피 안 보이는데, 정작 사용자가 헤맸던 **'공개'로 저장해 둔 기존 기록**이 그대로 보이면
   * 폼에서는 고칠 수 없는 값이 상세에만 남아 되돌릴 곳 없는 안내가 된다.
   *
   * ⚠️ 이 단언은 잔여 블록 재합류 루프까지 함께 지킨다 — 상세뷰는 섹션에 매칭 안 된 확장 블록을
   * 카테고리 마지막 카드로 다시 밀어 넣기 때문에, 키 매칭이 깨지는 순간 이 필드가 그 경로로
   * 되살아난다.
   */
  it("FRT-306: '공개'로 저장해 둔 기존 기록도 상세뷰에 공개 설정을 보이지 않는다", () => {
    const { core, ext } = filledCareerBlocks()
    const published = setVal(ext, "extended.공개 설정", {
      type: "single-select",
      options: ["공개", "비공개", "일부 공개"],
      selected: "공개",
    })
    const sections = buildDetailSections(
      makeExperienceV2({ coreBlocks: core, extensionBlocks: published }),
      getTemplateForType("career"),
    )
    expect(sections.flatMap(s => s.blocks).map(b => b.label)).not.toContain("공개 설정")
  })
})
