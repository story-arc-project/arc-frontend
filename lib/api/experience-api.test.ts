import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/demo/state", () => ({
  isDemoMode: vi.fn(() => false),
  setDemoMode: () => {},
  DEMO_BASE_PATH: "/demo",
}))

vi.mock("@/lib/api/client", async () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: (await import("@/lib/api/api-error")).ApiError,
}))

import { api, ApiError } from "@/lib/api/client"
import { getExperiences, getExperience, updateExperienceImportance } from "@/lib/api/experience-api"

import { isDemoMode } from "@/lib/demo/state"
import * as demo from "@/lib/demo/handlers"

vi.mock("@/lib/demo/handlers", () => ({ getExperiences: vi.fn(), getExperience: vi.fn() }))

const apiMock = vi.mocked(api)

beforeEach(() => {
  vi.resetAllMocks()
})

// FRT-39 회귀 가드: 중요도 변경은 전용 PATCH 엔드포인트로 보내야 한다.
// PUT /experiences/{id} 는 content 만 받고 importance 를 무시하므로,
// PUT 로 보내면 새로고침 시 값이 원복된다.
describe("updateExperienceImportance", () => {
  it("PATCH /experiences/{id}/importance 로 값을 보낸다 (PUT 아님)", async () => {
    apiMock.patch.mockResolvedValue(undefined)

    await updateExperienceImportance("exp-1", 4)

    expect(apiMock.patch).toHaveBeenCalledWith("/experiences/exp-1/importance", {
      importance: 4,
    })
    expect(apiMock.put).not.toHaveBeenCalled()
  })

  it("해제(null) 도 PATCH 로 보낸다", async () => {
    apiMock.patch.mockResolvedValue(undefined)

    await updateExperienceImportance("exp-2", null)

    expect(apiMock.patch).toHaveBeenCalledWith("/experiences/exp-2/importance", {
      importance: null,
    })
    expect(apiMock.put).not.toHaveBeenCalled()
  })
})

const experience = {
  id: "exp-1", user_id: "user-1", type: "future-type", importance: null,
  content: { nested: { arbitrary: [null, { text: "unchanged" }] } },
  created_at: "opaque-date", updated_at: "another-opaque-date", extra: true,
}
const invalidValues = [undefined, null, false, 1, "value", []]
const invalidExperiences = [
  ...invalidValues,
  ...["id", "user_id", "type"].flatMap(key =>
    [undefined, null, "", 12].map(value => ({ ...experience, [key]: value }))),
  ...["created_at", "updated_at"].flatMap(key =>
    [undefined, null, false, 12, [], {}].map(value => ({ ...experience, [key]: value }))),
  ...[undefined, "3", NaN, Infinity, -Infinity, 1.5].map(importance => ({ ...experience, importance })),
  ...invalidValues.map(content => ({ ...experience, content })),
]

describe("experience read response validation", () => {
  it.each([...invalidValues, {}])("rejects invalid envelope %j", async envelope => {
    apiMock.get.mockResolvedValue(envelope)
    await expect(getExperiences()).rejects.toMatchObject({ name: "ApiError", status: 500, message: "경험 목록 응답 형식이 올바르지 않아요." })
    await expect(getExperience("exp-1")).rejects.toMatchObject({ name: "ApiError", status: 500, message: "경험 상세 응답 형식이 올바르지 않아요." })
  })

  it.each([
    ...invalidValues,
    {}, { contents: [] }, { count: 0 },
    ...[-1, 0.5, NaN, Infinity, "1", Number.MAX_SAFE_INTEGER + 1].map(count => ({ count, contents: [] })),
    ...invalidValues.filter(value => !Array.isArray(value)).map(contents => ({ count: 0, contents })),
    ...invalidExperiences.map(entry => ({ count: 2, contents: [experience, entry] })),
  ])("rejects malformed list data %j", async data => {
    apiMock.get.mockResolvedValue({ data })
    await expect(getExperiences()).rejects.toMatchObject({ name: "ApiError", status: 500 })
  })

  it.each(invalidExperiences)("rejects malformed detail data %j", async data => {
    apiMock.get.mockResolvedValue({ data })
    await expect(getExperience("exp-1")).rejects.toMatchObject({ name: "ApiError", status: 500 })
  })

  it.each([null, -10, 10, Number.MAX_SAFE_INTEGER + 1])("preserves valid data and unknown fields with importance %j", async importance => {
    const entry = { ...experience, importance }
    const data = { count: 9, contents: [entry], extra: { future: true } }
    apiMock.get.mockResolvedValue({ data })
    expect(await getExperiences()).toBe(data)
    expect(apiMock.get).toHaveBeenCalledWith("/experiences/")
    apiMock.get.mockResolvedValue({ data: entry })
    expect(await getExperience("exp-1")).toBe(entry)
    expect(apiMock.get).toHaveBeenLastCalledWith("/experiences/exp-1")
  })

  it.each([
    { created_at: "", updated_at: experience.updated_at },
    { created_at: experience.created_at, updated_at: "" },
    { created_at: "", updated_at: "" },
  ])("preserves empty timestamp strings for date-display fallback %j", async timestamps => {
    const entry = { ...experience, ...timestamps }
    const data = { count: 1, contents: [entry] }
    apiMock.get.mockResolvedValue({ data })
    expect(await getExperiences()).toBe(data)
    apiMock.get.mockResolvedValue({ data: entry })
    expect(await getExperience("exp-1")).toBe(entry)
  })

  it("accepts an empty list", async () => {
    const data = { count: 0, contents: [] }
    apiMock.get.mockResolvedValue({ data })
    expect(await getExperiences()).toBe(data)
  })

  it.each([new ApiError(403, "권한이 없어요.", "FORBIDDEN"), new Error("network")])("preserves transport errors", async error => {
    apiMock.get.mockRejectedValue(error)
    await expect(getExperiences()).rejects.toBe(error)
    await expect(getExperience("exp-1")).rejects.toBe(error)
  })

  it("delegates demo reads before network validation", async () => {
    vi.mocked(isDemoMode).mockReturnValue(true)
    const list = { count: 0, contents: [] }
    vi.mocked(demo.getExperiences).mockResolvedValue(list)
    vi.mocked(demo.getExperience).mockResolvedValue(experience)
    expect(await getExperiences()).toBe(list)
    expect(await getExperience("demo-1")).toBe(experience)
    expect(demo.getExperience).toHaveBeenCalledWith("demo-1")
    expect(apiMock.get).not.toHaveBeenCalled()
  })
})
