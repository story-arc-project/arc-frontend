import { StrictMode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"

import type { Experience, ExperienceListData } from "@/types/experience"

const getExperiencesMock = vi.fn()
const getExperienceMock = vi.fn()
const duplicateExperienceMock = vi.fn()
const createExperienceMock = vi.fn()
const deleteExperienceMock = vi.fn()

vi.mock("@/lib/api/experience-api", () => ({
  getExperiences: (...args: unknown[]) => getExperiencesMock(...args),
  getExperience: (...args: unknown[]) => getExperienceMock(...args),
  duplicateExperience: (...args: unknown[]) => duplicateExperienceMock(...args),
  createExperience: (...args: unknown[]) => createExperienceMock(...args),
  updateExperience: vi.fn(),
  updateExperienceImportance: vi.fn(),
  deleteExperience: (...args: unknown[]) => deleteExperienceMock(...args),
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
    vi.resetAllMocks()
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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

// These regressions catch stale GET completions taking ownership of newer state.
describe("useExperiences response ownership", () => {
  beforeEach(() => { vi.resetAllMocks(); getExperiencesMock.mockResolvedValue(listData(["original"])) })
  afterEach(cleanup)
  const ids = (value: ReturnType<typeof useExperiences>) => value.experiences.map(e => e.id)

  it.each(["success", "error"])("ignores late initial %s after create refresh", async (outcome) => {
    const initial = deferred<ExperienceListData>()
    getExperiencesMock.mockReturnValueOnce(initial.promise).mockResolvedValueOnce(listData(["created", "original"]))
    createExperienceMock.mockResolvedValue("created")
    const { result } = renderHook(() => useExperiences())
    await act(async () => { expect(await result.current.createExperience({ type: "project", content: {} })).toBe("created") })
    await act(async () => { if (outcome === "success") initial.resolve(listData(["old"])); else initial.reject(new Error("old")) })
    expect(ids(result.current)).toEqual(["created", "original"])
    expect(result.current.count).toBe(2)
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it.each(["success", "error"])("keeps newer refetch loading and error ownership after older %s", async outcome => {
    const { result } = renderHook(() => useExperiences())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const older = deferred<ExperienceListData>(); const newer = deferred<ExperienceListData>()
    getExperiencesMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    let a!: Promise<void>; let b!: Promise<void>
    act(() => { a = result.current.refetch(); b = result.current.refetch() })
    await act(async () => { if (outcome === "success") older.resolve(listData(["old"])); else older.reject(new Error("old")); await a })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.error).toBeNull()
    const latestError = new Error("latest")
    await act(async () => { newer.reject(latestError); await b })
    expect(result.current.error).toBe(latestError)
    expect(ids(result.current)).toEqual(["original"])
  })

  it.each(["success", "error"])("keeps newest refetch snapshot when older %s arrives last", async outcome => {
    const { result } = renderHook(() => useExperiences())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const older = deferred<ExperienceListData>(); const newer = deferred<ExperienceListData>()
    getExperiencesMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    let a!: Promise<void>; let b!: Promise<void>
    act(() => { a = result.current.refetch(); b = result.current.refetch() })
    await act(async () => { newer.resolve(listData(["new", "original"])); await b })
    await act(async () => { if (outcome === "success") older.resolve(listData(["old"])); else older.reject(new Error("old")); await a })
    expect(result.current.error).toBeNull()
    expect(ids(result.current)).toEqual(["new", "original"]); expect(result.current.count).toBe(2)
  })

  it("duplicate hydration supersedes pending initial load", async () => {
    const initial = deferred<ExperienceListData>()
    getExperiencesMock.mockReturnValueOnce(initial.promise).mockResolvedValueOnce(listData(["copy", "original"]))
    duplicateExperienceMock.mockResolvedValue("copy"); getExperienceMock.mockResolvedValue(experience("copy"))
    const { result } = renderHook(() => useExperiences())
    await act(async () => { await result.current.duplicateExperience("original") })
    await act(async () => { initial.resolve(listData(["old"])) })
    expect(ids(result.current)).toEqual(["copy", "original"]); expect(result.current.count).toBe(2)
    expect(result.current.isLoading).toBe(false)
  })

  it.each(["refetch", "delete"])("late duplicate hydration cannot resurrect after newer %s snapshot", async action => {
    const { result } = renderHook(() => useExperiences())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const hydration = deferred<Experience>()
    duplicateExperienceMock.mockResolvedValue("copy"); getExperienceMock.mockReturnValue(hydration.promise)
    let copy!: Promise<string>
    await act(async () => { copy = result.current.duplicateExperience("original"); await Promise.resolve() })
    getExperiencesMock.mockResolvedValue(listData(["newer"]))
    await act(async () => { if (action === "delete") await result.current.deleteExperience("copy"); else await result.current.refetch() })
    await act(async () => { hydration.resolve(experience("copy")); expect(await copy).toBe("copy") })
    expect(ids(result.current)).toEqual(["newer"]); expect(result.current.count).toBe(1)
  })

  it("hydration keeps a refetch started after POST loading until its own response", async () => {
    const { result } = renderHook(() => useExperiences())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const hydration = deferred<Experience>(); const refresh = deferred<ExperienceListData>()
    duplicateExperienceMock.mockResolvedValue("copy"); getExperienceMock.mockReturnValue(hydration.promise)
    let copy!: Promise<string>; let read!: Promise<void>
    await act(async () => { copy = result.current.duplicateExperience("original"); await Promise.resolve() })
    getExperiencesMock.mockReturnValueOnce(refresh.promise)
    act(() => { read = result.current.refetch() })
    await act(async () => { hydration.resolve(experience("copy")); await copy })
    expect(result.current.isLoading).toBe(true)
    expect(ids(result.current)).toEqual(["copy", "original"])
    const failure = new Error("newest read")
    await act(async () => { refresh.reject(failure); await read })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(failure)
    expect(result.current.count).toBe(2)
  })

  it.each(["success", "error"])("reconciles a delete refresh superseded by duplication (%s)", async outcome => {
    getExperiencesMock.mockResolvedValueOnce(listData(["deleted", "original"]))
    const { result } = renderHook(() => useExperiences())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const deletedList = deferred<ExperienceListData>()
    const replacement = deferred<ExperienceListData>()
    getExperiencesMock.mockReturnValueOnce(deletedList.promise).mockReturnValueOnce(replacement.promise)
    duplicateExperienceMock.mockResolvedValue("copy")
    getExperienceMock.mockResolvedValue(experience("copy"))
    let deletion!: Promise<void>; let copy!: Promise<string>
    await act(async () => { deletion = result.current.deleteExperience("deleted"); await Promise.resolve() })
    await act(async () => { copy = result.current.duplicateExperience("original"); await Promise.resolve() })
    // The old delete snapshot predates the duplicate and must be replaced,
    // rather than dropping its reconciliation while only prepending the copy.
    await act(async () => { deletedList.resolve(listData(["original"])); await deletion })
    if (outcome === "success") {
      await act(async () => { replacement.resolve(listData(["copy", "original"])); expect(await copy).toBe("copy") })
      expect(ids(result.current)).toEqual(["copy", "original"])
      expect(result.current.count).toBe(2)
      expect(result.current.error).toBeNull()
    } else {
      expect(getExperiencesMock).toHaveBeenCalledTimes(3)
      const failure = new Error("replacement failed")
      await act(async () => { replacement.reject(failure); expect(await copy).toBe("copy") })
      expect(result.current.error).toBe(failure)
    }
    expect(result.current.isLoading).toBe(false)
  })

  it("preserves two concurrent duplicate hydrations", async () => {
    const { result } = renderHook(() => useExperiences())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const first = deferred<Experience>(); const second = deferred<Experience>()
    duplicateExperienceMock.mockResolvedValueOnce("a").mockResolvedValueOnce("b")
    getExperienceMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    let a!: Promise<string>; let b!: Promise<string>
    await act(async () => { a = result.current.duplicateExperience("original"); b = result.current.duplicateExperience("original"); await Promise.resolve() })
    await act(async () => { second.resolve(experience("b")); await b })
    await act(async () => { first.resolve(experience("a")); await a })
    expect(ids(result.current)).toEqual(["a", "b", "original"]); expect(result.current.count).toBe(3)
  })

  it("successful POST IDs survive failed follow-up GETs; POST failures reject", async () => {
    const { result } = renderHook(() => useExperiences())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    getExperiencesMock.mockRejectedValue(new Error("GET failed")); getExperienceMock.mockRejectedValue(new Error("GET failed"))
    createExperienceMock.mockResolvedValue("created"); duplicateExperienceMock.mockResolvedValue("copy")
    await act(async () => { expect(await result.current.createExperience({ type: "project", content: {} })).toBe("created"); expect(await result.current.duplicateExperience("original")).toBe("copy") })
    const failure = new Error("POST failed")
    createExperienceMock.mockRejectedValue(failure); duplicateExperienceMock.mockRejectedValue(failure)
    await act(async () => { await expect(result.current.createExperience({ type: "project", content: {} })).rejects.toBe(failure); await expect(result.current.duplicateExperience("original")).rejects.toBe(failure) })
  })

  it.each(["create", "duplicate"])("unmount during pending %s POST skips follow-up reads", async action => {
    const { result, unmount } = renderHook(() => useExperiences())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const post = deferred<string>()
    createExperienceMock.mockReturnValue(post.promise); duplicateExperienceMock.mockReturnValue(post.promise)
    let mutation!: Promise<string>
    act(() => { mutation = action === "create" ? result.current.createExperience({ type: "project", content: {} }) : result.current.duplicateExperience("original") })
    unmount()
    await act(async () => { post.resolve("new"); expect(await mutation).toBe("new") })
    expect(getExperiencesMock).toHaveBeenCalledTimes(1)
    expect(getExperienceMock).not.toHaveBeenCalled()
  })

  it("StrictMode cleanup invalidates work from the prior lifecycle", async () => {
    const stale = deferred<ExperienceListData>(); const current = deferred<ExperienceListData>()
    getExperiencesMock.mockReturnValueOnce(stale.promise).mockReturnValueOnce(current.promise)
    const { result, unmount } = renderHook(() => useExperiences(), { wrapper: StrictMode })
    await act(async () => { current.resolve(listData(["current"])) })
    await act(async () => { stale.resolve(listData(["stale"])) })
    expect(ids(result.current)).toEqual(["current"])
    const hydration = deferred<Experience>()
    duplicateExperienceMock.mockResolvedValue("copy"); getExperienceMock.mockReturnValue(hydration.promise)
    let copy!: Promise<string>
    await act(async () => { copy = result.current.duplicateExperience("current"); await Promise.resolve() })
    unmount()
    await act(async () => { hydration.reject(new Error("late")); expect(await copy).toBe("copy") })
    expect(ids(result.current)).toEqual(["current"])
    expect(getExperiencesMock).toHaveBeenCalledTimes(2)
  })
})
