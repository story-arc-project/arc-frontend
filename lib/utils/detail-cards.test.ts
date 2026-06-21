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
  ext = setVal(ext, "career-info.재직기간", {
    type: "period",
    start: "2025-01",
    end: "2025-06",
    isCurrent: false,
  })
  ext = setVal(ext, "extended.배경/목표", textarea("성장하고 싶었다"))
  ext = setVal(ext, "career-tasks.업무내용", {
    type: "repeatable-cell",
    columns: [],
    rows: [{ id: "r1", cells: {} }],
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
    expect(sections.map(s => s.label)).toEqual([
      "기본 정보",
      "경험 상세",
      "반복 기록",
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
      "반복 기록",
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
    const detail = sections.find(s => s.label === "경험 상세")
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
})
