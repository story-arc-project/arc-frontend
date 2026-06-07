import { describe, expect, it } from "vitest"
import type { ExperienceV2 } from "@/types/archive"
import type { Experience } from "@/types/experience"
import {
  toExperienceV2,
  toSavePayload,
  toUpdateImportancePayload,
} from "@/lib/utils/experience-mapper"

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
  it("content 가 비어 있으면 모든 필드를 안전 기본값으로 채운다", () => {
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
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-02T00:00:00Z",
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

  it("snake_case API 필드를 camelCase 로 매핑하고 content 값을 보존한다", () => {
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
})

describe("toSavePayload", () => {
  it("ExperienceV2 를 저장 payload 형태로 묶는다", () => {
    const payload = toSavePayload(makeExperienceV2())
    expect(payload).toEqual({
      type: "career",
      importance: 4,
      content: {
        title: "타이틀",
        summary: "요약",
        status: "draft",
        tags: ["a"],
        coreBlocks: [],
        extensionBlocks: [],
        customBlocks: [],
      },
    })
  })

  it("importance 가 undefined 면 null 로 강제한다", () => {
    expect(toSavePayload(makeExperienceV2({ importance: undefined })).importance).toBeNull()
  })
})

describe("round-trip (toExperienceV2 → toSavePayload)", () => {
  it("content·importance 가 왕복 후에도 보존된다", () => {
    const original = makeExperience({
      content: {
        title: "T",
        summary: "S",
        status: "draft",
        tags: ["x"],
        coreBlocks: [],
        extensionBlocks: [],
        customBlocks: [],
      },
      importance: 2,
    })
    const payload = toSavePayload(toExperienceV2(original))
    expect(payload.content).toEqual(original.content)
    expect(payload.importance).toBe(2)
    expect(payload.type).toBe(original.type)
  })
})

describe("toUpdateImportancePayload", () => {
  it("값을 그대로, undefined 는 null 로 보낸다", () => {
    expect(toUpdateImportancePayload(3)).toEqual({ importance: 3 })
    expect(toUpdateImportancePayload(undefined)).toEqual({ importance: null })
  })
})
