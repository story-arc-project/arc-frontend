import { describe, expect, it } from "vitest"
import type { Block, BlockValue, CustomEntry, ExperienceV2 } from "@/types/archive"
import type { Experience } from "@/types/experience"
import { getTemplateForType, TEMPLATE_VERSION } from "@/lib/constants/templates-v2"
import {
  toExperienceV2,
  toSavePayload,
} from "@/lib/utils/experience-mapper"
import { createGroupBlock, createTextField } from "@/lib/utils/block-utils"

function makeExperience(overrides: Partial<Experience> = {}): Experience {
  return {
    id: "exp-1",
    user_id: "user-1",
    type: "career",
    importance: null,
    content: {},
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
    ...overrides,
  }
}

function text(t: string): BlockValue {
  return { type: "text", text: t }
}
function textarea(t: string): BlockValue {
  return { type: "textarea", text: t }
}

/** career 템플릿에서 키를 가진 core/extension 블록 배열을 만든다(폼 로드 결과 모사). */
function careerBlocks(): { coreBlocks: Block[]; extensionBlocks: Block[] } {
  const tmpl = getTemplateForType("career")
  return {
    coreBlocks: tmpl.commonCore.blocks,
    extensionBlocks: tmpl.extensions.flatMap(s => s.blocks),
  }
}

function makeExperienceV2(overrides: Partial<ExperienceV2> = {}): ExperienceV2 {
  return {
    id: "exp-1",
    userId: "user-1",
    typeId: "career",
    title: "타이틀",
    summary: "요약",
    status: "draft",
    tags: ["a"],
    importance: 4,
    coreBlocks: [],
    extensionBlocks: [],
    customBlocks: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
    ...overrides,
  }
}

describe("toExperienceV2", () => {
  it("content 가 비어 있으면(v1 빈 레코드) 모든 필드를 안전 기본값으로 채운다", () => {
    const v2 = toExperienceV2(makeExperience({ content: {} }))
    expect(v2).toMatchObject({
      id: "exp-1",
      userId: "user-1",
      typeId: "career",
      title: "",
      summary: "",
      status: "draft",
      tags: [],
      coreBlocks: [],
      extensionBlocks: [],
      customBlocks: [],
    })
    expect(v2.importance).toBeUndefined()
  })

  it("content 가 null/undefined 여도 throw 없이 기본값을 반환한다", () => {
    const v2 = toExperienceV2(
      makeExperience({ content: undefined as unknown as Experience["content"] }),
    )
    expect(v2.title).toBe("")
    expect(v2.coreBlocks).toEqual([])
  })

  it("v1 레거시: snake_case 매핑 + content 스칼라 보존", () => {
    const v2 = toExperienceV2(
      makeExperience({
        content: {
          title: "프로젝트 X",
          summary: "한 줄 요약",
          status: "complete",
          tags: ["리더십", "협업"],
        },
        importance: 3,
      }),
    )
    expect(v2.userId).toBe("user-1")
    expect(v2.title).toBe("프로젝트 X")
    expect(v2.summary).toBe("한 줄 요약")
    expect(v2.status).toBe("complete")
    expect(v2.tags).toEqual(["리더십", "협업"])
    expect(v2.importance).toBe(3)
  })

  it("importance 경계: 유효 정수 1~5 만 통과시키고 그 외는 undefined", () => {
    expect(toExperienceV2(makeExperience({ importance: 1 })).importance).toBe(1)
    expect(toExperienceV2(makeExperience({ importance: 5 })).importance).toBe(5)
    expect(toExperienceV2(makeExperience({ importance: 0 })).importance).toBeUndefined()
    expect(toExperienceV2(makeExperience({ importance: 6 })).importance).toBeUndefined()
    expect(toExperienceV2(makeExperience({ importance: 2.5 })).importance).toBeUndefined()
    expect(toExperienceV2(makeExperience({ importance: null })).importance).toBeUndefined()
  })

  it("v1 레거시: 모호한 라벨(여러 섹션 중복)은 안정키를 주입하지 않는다 (Codex P1 회귀)", () => {
    // extracurricular: extended.결과/성과(textarea) vs extra-detail.결과/성과(repeatable-cell)
    const v2 = toExperienceV2(
      makeExperience({
        type: "extracurricular",
        content: {
          title: "T",
          summary: "",
          status: "draft",
          tags: [],
          coreBlocks: [],
          extensionBlocks: [
            {
              id: "x1",
              type: "repeatable-cell",
              label: "결과/성과",
              value: { type: "repeatable-cell", columns: [], rows: [{ id: "r1", cells: {} }] },
            },
          ],
          customBlocks: [],
        },
      }),
    )
    // 모호 라벨 → unkeyed (custom 으로 보존 유도, 타입 충돌 손상 방지)
    expect(v2.extensionBlocks.find(b => b.label === "결과/성과")?.key).toBeUndefined()
  })

  it("v2: fields 값 타입이 블록 타입과 다르면 주입을 생략한다 (손상 방지)", () => {
    const v2 = toExperienceV2(
      makeExperience({
        content: {
          schema_version: 2,
          template_version: TEMPLATE_VERSION,
          title: "T",
          summary: "",
          status: "draft",
          tags: [],
          // core.핵심 성과 는 textarea 인데 text 값이 들어온 손상 케이스
          fields: { "core.핵심 성과": { type: "text", text: "wrong" } },
          custom: [],
        },
      }),
    )
    // 템플릿 기본 타입(textarea) 유지 — text 값 주입 생략
    expect(v2.coreBlocks.find(b => b.key === "core.핵심 성과")?.value.type).toBe("textarea")
  })

  it("v1 레거시: 저장된 블록 배열에 레지스트리 라벨매칭으로 안정키를 주입한다", () => {
    const v2 = toExperienceV2(
      makeExperience({
        content: {
          title: "T",
          summary: "S",
          status: "draft",
          tags: [],
          coreBlocks: [
            { id: "b1", type: "text", label: "경험명", value: text("T") },
            { id: "b2", type: "textarea", label: "핵심 성과", value: textarea("성과!") },
          ],
          extensionBlocks: [
            { id: "b3", type: "text", label: "회사명", value: text("ARC") },
          ],
          customBlocks: [],
        },
      }),
    )
    expect(v2.coreBlocks.find(b => b.label === "핵심 성과")?.key).toBe("core.핵심 성과")
    expect(v2.extensionBlocks.find(b => b.label === "회사명")?.key).toBe("career-info.회사명")
  })

  it("v2: fields 맵을 레지스트리 순서대로 블록으로 재구성하고 title/summary 를 헤더 블록에 주입한다", () => {
    const v2 = toExperienceV2(
      makeExperience({
        content: {
          schema_version: 2,
          template_version: TEMPLATE_VERSION,
          title: "v2 타이틀",
          summary: "v2 요약",
          status: "complete",
          tags: ["t"],
          fields: {
            "core.핵심 성과": textarea("성과 v2"),
            "career-info.회사명": text("ARC Inc"),
          },
          custom: [],
        },
        importance: 5,
      }),
    )
    expect(v2.title).toBe("v2 타이틀")
    expect(v2.summary).toBe("v2 요약")
    expect(v2.status).toBe("complete")
    expect(v2.importance).toBe(5)
    // 헤더 값이 core 경험명/요약 블록에 주입됨
    expect(v2.coreBlocks.find(b => b.key === "core.경험명")?.value).toEqual(text("v2 타이틀"))
    expect(v2.coreBlocks.find(b => b.key === "core.한 줄 요약")?.value).toEqual(text("v2 요약"))
    // fields 값 주입
    expect(v2.coreBlocks.find(b => b.key === "core.핵심 성과")?.value).toEqual(textarea("성과 v2"))
    expect(v2.extensionBlocks.find(b => b.key === "career-info.회사명")?.value).toEqual(text("ARC Inc"))
    // 모든 템플릿 블록에 key 가 존재
    expect(v2.coreBlocks.every(b => !!b.key)).toBe(true)
    expect(v2.extensionBlocks.every(b => !!b.key)).toBe(true)
  })

  it("v2: custom[] field 항목을 customBlocks 로 복원한다", () => {
    const v2 = toExperienceV2(
      makeExperience({
        content: {
          schema_version: 2,
          template_version: TEMPLATE_VERSION,
          title: "T",
          summary: "",
          status: "draft",
          tags: [],
          fields: {},
          custom: [
            { key: "custom-1", entryType: "field", type: "text", label: "나만의 메모", value: text("hi") },
          ],
        },
      }),
    )
    expect(v2.customBlocks).toHaveLength(1)
    expect(v2.customBlocks[0]).toMatchObject({ key: "custom-1", label: "나만의 메모", type: "text" })
    expect(v2.customBlocks[0].value).toEqual(text("hi"))
  })
})

describe("toSavePayload", () => {
  it("빈 ExperienceV2 를 v2 content 로 직렬화한다", () => {
    const payload = toSavePayload(makeExperienceV2())
    expect(payload.type).toBe("career")
    expect(payload.importance).toBe(4)
    expect(payload.content).toMatchObject({
      schema_version: 2,
      template_version: TEMPLATE_VERSION,
      title: "타이틀",
      summary: "요약",
      status: "draft",
      tags: ["a"],
      fields: {},
      custom: [],
    })
  })

  it("importance 가 undefined 면 null 로 강제한다", () => {
    expect(toSavePayload(makeExperienceV2({ importance: undefined })).importance).toBeNull()
  })

  it("키 있는 블록은 fields 맵으로, title/summary 블록은 제외한다", () => {
    const { coreBlocks, extensionBlocks } = careerBlocks()
    // 값 채우기
    const filledCore = coreBlocks.map(b =>
      b.key === "core.핵심 성과" ? { ...b, value: textarea("성과!") } : b,
    )
    const filledExt = extensionBlocks.map(b =>
      b.key === "career-info.회사명" ? { ...b, value: text("ARC") } : b,
    )
    const payload = toSavePayload(
      makeExperienceV2({ coreBlocks: filledCore, extensionBlocks: filledExt }),
    )
    const content = payload.content as Record<string, unknown>
    const fields = content.fields as Record<string, BlockValue>
    expect(fields["core.핵심 성과"]).toEqual(textarea("성과!"))
    expect(fields["career-info.회사명"]).toEqual(text("ARC"))
    // 헤더 소유 필드는 fields 에 중복 저장하지 않음
    expect(fields["core.경험명"]).toBeUndefined()
    expect(fields["core.한 줄 요약"]).toBeUndefined()
  })
})

describe("round-trip (toExperienceV2 → toSavePayload)", () => {
  it("v2 스칼라·importance 가 왕복 후 보존된다", () => {
    const original = makeExperience({
      content: {
        schema_version: 2,
        template_version: TEMPLATE_VERSION,
        title: "T",
        summary: "S",
        status: "complete",
        tags: ["x"],
        fields: {},
        custom: [],
      },
      importance: 2,
    })
    const payload = toSavePayload(toExperienceV2(original))
    expect(payload.content).toMatchObject({
      schema_version: 2,
      title: "T",
      summary: "S",
      status: "complete",
      tags: ["x"],
    })
    expect(payload.importance).toBe(2)
    expect(payload.type).toBe("career")
  })

  it("저장순서=화면순서: extensionBlocks 가 왕복 후에도 레지스트리 순서를 유지한다", () => {
    const { coreBlocks, extensionBlocks } = careerBlocks()
    const expectedKeys = extensionBlocks.map(b => b.key)
    const v2In = makeExperienceV2({ coreBlocks, extensionBlocks })
    const payload = toSavePayload(v2In)
    const reloaded = toExperienceV2(
      makeExperience({ content: payload.content, importance: payload.importance }),
    )
    expect(reloaded.extensionBlocks.map(b => b.key)).toEqual(expectedKeys)
  })

  it("필드 값이 키 기준으로 왕복 보존된다(라벨 충돌 무관)", () => {
    const { coreBlocks, extensionBlocks } = careerBlocks()
    const filledExt = extensionBlocks.map(b =>
      b.key === "career-tasks.업무내용"
        ? b
        : b.key === "career-info.회사명"
          ? { ...b, value: text("ARC") }
          : b,
    )
    const v2In = makeExperienceV2({ coreBlocks, extensionBlocks: filledExt, title: "헤더T" })
    const payload = toSavePayload(v2In)
    const reloaded = toExperienceV2(
      makeExperience({ content: payload.content, importance: payload.importance }),
    )
    expect(reloaded.extensionBlocks.find(b => b.key === "career-info.회사명")?.value).toEqual(text("ARC"))
    expect(reloaded.title).toBe("헤더T")
    expect(reloaded.coreBlocks.find(b => b.key === "core.경험명")?.value).toEqual(text("헤더T"))
  })

  it("키 없는(모호 라벨) 확장 블록은 custom 으로 보존된다 (Codex P1 회귀)", () => {
    const block: Block = {
      id: "x1",
      type: "repeatable-cell",
      label: "결과/성과",
      value: { type: "repeatable-cell", columns: [], rows: [{ id: "r1", cells: {} }] },
    }
    const payload = toSavePayload(
      makeExperienceV2({ typeId: "extracurricular", extensionBlocks: [block] }),
    )
    const content = payload.content as Record<string, unknown>
    const custom = content.custom as CustomEntry[]
    const preserved = custom.find(
      e => e.entryType === "field" && e.label === "결과/성과",
    )
    expect(preserved).toBeDefined()
    expect(preserved?.entryType === "field" && preserved.value.type).toBe("repeatable-cell")
  })

  it("custom 블록이 왕복 보존된다", () => {
    const custom: Block[] = [
      { id: "c1", key: "custom-1", type: "text", label: "메모", value: text("note") },
    ]
    const payload = toSavePayload(makeExperienceV2({ customBlocks: custom }))
    const reloaded = toExperienceV2(
      makeExperience({ content: payload.content, importance: payload.importance }),
    )
    expect(reloaded.customBlocks).toHaveLength(1)
    expect(reloaded.customBlocks[0]).toMatchObject({ label: "메모", type: "text" })
    expect(reloaded.customBlocks[0].value).toEqual(text("note"))
  })
})

describe("group round-trip", () => {
  it("toSavePayload: group 블록은 entryType:'group' 으로 직렬화된다", () => {
    const g = createGroupBlock("나만의 섹션")
    const child = createTextField("메모")
    if (child.value.type === "text") child.value.text = "내용"
    g.children = [child]

    const payload = toSavePayload(makeExperienceV2({ customBlocks: [g] }))
    const content = payload.content as Record<string, unknown>
    const custom = content.custom as CustomEntry[]
    expect(custom).toHaveLength(1)
    expect(custom[0].entryType).toBe("group")
    if (custom[0].entryType === "group") {
      expect(custom[0].label).toBe("나만의 섹션")
      expect(custom[0].children).toHaveLength(1)
      expect(custom[0].children[0].entryType).toBe("field")
    }
  })

  it("toExperienceV2: custom group 항목이 type:'group' Block 으로 복원된다 (평탄화 아님)", () => {
    const exp = makeExperience({
      content: {
        schema_version: 2,
        template_version: TEMPLATE_VERSION,
        title: "T",
        summary: "",
        status: "draft",
        tags: [],
        fields: {},
        custom: [
          {
            key: "grp-1",
            entryType: "group",
            label: "나만의 섹션",
            collapsed: false,
            children: [
              { key: "c-1", entryType: "field", type: "text", label: "메모", value: { type: "text", text: "내용" } },
            ],
          } as CustomEntry,
        ],
      },
    })
    const v2 = toExperienceV2(exp)
    expect(v2.customBlocks).toHaveLength(1)
    expect(v2.customBlocks[0].type).toBe("group")
    expect(v2.customBlocks[0].label).toBe("나만의 섹션")
    expect(v2.customBlocks[0].children).toHaveLength(1)
    expect(v2.customBlocks[0].children![0].label).toBe("메모")
  })

  it("FULL round-trip: group with two children survives toSavePayload → toExperienceV2", () => {
    const g = createGroupBlock("섹션A")
    const c1 = createTextField("필드1")
    const c2 = createTextField("필드2")
    if (c1.value.type === "text") c1.value.text = "값1"
    if (c2.value.type === "text") c2.value.text = "값2"
    g.children = [c1, c2]
    g.key = "grp-stable"

    const payload = toSavePayload(makeExperienceV2({ customBlocks: [g] }))
    const reloaded = toExperienceV2(makeExperience({ content: payload.content }))

    expect(reloaded.customBlocks).toHaveLength(1)
    const rg = reloaded.customBlocks[0]
    expect(rg.type).toBe("group")
    expect(rg.label).toBe("섹션A")
    expect(rg.key).toBe("grp-stable")
    expect(rg.children).toHaveLength(2)
    expect(rg.children![0].label).toBe("필드1")
    expect(rg.children![0].value).toEqual({ type: "text", text: "값1" })
    expect(rg.children![1].label).toBe("필드2")
    expect(rg.children![1].value).toEqual({ type: "text", text: "값2" })
  })

  it("REGRESSION: section entry 는 여전히 평탄화된다 (FRT-78 미구현)", () => {
    const exp = makeExperience({
      content: {
        schema_version: 2,
        template_version: TEMPLATE_VERSION,
        title: "T",
        summary: "",
        status: "draft",
        tags: [],
        fields: {},
        custom: [
          {
            key: "sec-1",
            entryType: "section",
            label: "섹션",
            children: [
              { key: "c-1", entryType: "field", type: "text", label: "메모", value: { type: "text", text: "내용" } },
            ],
          } as CustomEntry,
        ],
      },
    })
    const v2 = toExperienceV2(exp)
    // section 은 평탄화되므로 customBlocks 에 type:'group' 이 없고 child 가 직접 들어온다
    expect(v2.customBlocks.every(b => b.type !== "group")).toBe(true)
    expect(v2.customBlocks).toHaveLength(1)
    expect(v2.customBlocks[0].label).toBe("메모")
  })

  it("children 없는 group 이 빈 children:[] 로 왕복된다", () => {
    const g = createGroupBlock("빈 그룹")
    const payload = toSavePayload(makeExperienceV2({ customBlocks: [g] }))
    const reloaded = toExperienceV2(makeExperience({ content: payload.content }))
    expect(reloaded.customBlocks[0].type).toBe("group")
    expect(reloaded.customBlocks[0].children).toEqual([])
  })

  it("FIX 6: toSavePayload 에서 직렬화된 group 항목에 collapsed 가 포함되지 않는다", () => {
    const g = createGroupBlock("섹션")
    // collapsed defaults to false in createGroupBlock
    const payload = toSavePayload(makeExperienceV2({ customBlocks: [g] }))
    const content = payload.content as Record<string, unknown>
    const custom = content.custom as CustomEntry[]
    expect(custom[0].entryType).toBe("group")
    if (custom[0].entryType === "group") {
      expect(Object.prototype.hasOwnProperty.call(custom[0], "collapsed")).toBe(false)
    }
  })

  it("FIX 2: 중첩 group(group-in-group)은 평탄화되고 children 에 type:group 이 없다", () => {
    const exp = makeExperience({
      content: {
        schema_version: 2,
        template_version: TEMPLATE_VERSION,
        title: "T",
        summary: "",
        status: "draft",
        tags: [],
        fields: {},
        custom: [
          {
            key: "grp-outer",
            entryType: "group",
            label: "외부 그룹",
            children: [
              {
                key: "grp-inner",
                entryType: "group",
                label: "내부 그룹 (중첩)",
                children: [
                  { key: "c-1", entryType: "field", type: "text", label: "메모", value: { type: "text", text: "내용" } },
                ],
              } as CustomEntry,
            ],
          } as CustomEntry,
        ],
      },
    })
    const v2 = toExperienceV2(exp)
    // 외부 group 은 Block 으로 복원됨
    expect(v2.customBlocks).toHaveLength(1)
    expect(v2.customBlocks[0].type).toBe("group")
    // 자식에 type:'group' 이 없어야 한다 (내부 group 은 평탄화됨)
    const children = v2.customBlocks[0].children ?? []
    expect(children.every(c => c.type !== "group")).toBe(true)
    // 내부 group 의 자식(field)이 평탄화되어 올라온다
    expect(children).toHaveLength(1)
    expect(children[0].label).toBe("메모")
  })
})
