import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/demo/state", () => ({
  isDemoMode: () => false,
  setDemoMode: () => {},
  DEMO_BASE_PATH: "/demo",
}))

vi.mock("@/lib/api/client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}))

import { api } from "@/lib/api/client"
import { updateExperienceImportance } from "@/lib/api/experience-api"

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
