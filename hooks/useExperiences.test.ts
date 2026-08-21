import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"

import type { Experience, ExperienceListData } from "@/types/experience"

const getExperiencesMock = vi.fn()
const getExperienceMock = vi.fn()
const duplicateExperienceMock = vi.fn()

vi.mock("@/lib/api/experience-api", () => ({
  getExperiences: (...args: unknown[]) => getExperiencesMock(...args),
  getExperience: (...args: unknown[]) => getExperienceMock(...args),
  duplicateExperience: (...args: unknown[]) => duplicateExperienceMock(...args),
  createExperience: vi.fn(),
  updateExperience: vi.fn(),
  updateExperienceImportance: vi.fn(),
  deleteExperience: vi.fn(),
}))

import { useExperiences } from "./useExperiences"

function experience(id: string): Experience {
  return {
    id,
    user_id: "user-1",
    type: "project",
    importance: null,
    content: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }
}

function listData(ids: string[]): ExperienceListData {
  return { count: ids.length, contents: ids.map(experience) }
}

describe("useExperiences — duplicateExperience", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getExperiencesMock.mockResolvedValue(listData(["exp-1"]))
  })

  afterEach(() => {
    cleanup()
  })

  it("복제한 항목이 목록에 들어가면 개수도 함께 늘어난다", async () => {
    duplicateExperienceMock.mockResolvedValue("exp-2")
    getExperienceMock.mockResolvedValue(experience("exp-2"))

    const { result } = renderHook(() => useExperiences())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.count).toBe(1)

    await act(async () => {
      await result.current.duplicateExperience("exp-1")
    })

    expect(result.current.experiences.map((e) => e.id)).toEqual(["exp-2", "exp-1"])
    expect(result.current.count).toBe(2)
  })

  it("이미 목록에 있는 항목이 다시 실려 오면 개수를 올리지 않는다", async () => {
    duplicateExperienceMock.mockResolvedValue("exp-1")
    getExperienceMock.mockResolvedValue(experience("exp-1"))

    const { result } = renderHook(() => useExperiences())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.count).toBe(1)

    await act(async () => {
      await result.current.duplicateExperience("exp-1")
    })

    expect(result.current.experiences.map((e) => e.id)).toEqual(["exp-1"])
    expect(result.current.count).toBe(1)
  })
})
