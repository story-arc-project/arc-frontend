import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"

import type { LibraryDTO } from "@/lib/utils/library-mapper"
import type { Experience, ExperienceListData } from "@/types/experience"
import type { Library } from "@/types/archive"

const getLibrariesMock = vi.fn()
const getLibraryExperiencesMock = vi.fn()
const addExperienceToLibraryMock = vi.fn()
const removeExperienceFromLibraryMock = vi.fn()

vi.mock("@/lib/api/library-api", () => ({
  getLibraries: (...args: unknown[]) => getLibrariesMock(...args),
  getLibraryExperiences: (...args: unknown[]) => getLibraryExperiencesMock(...args),
  addExperienceToLibrary: (...args: unknown[]) => addExperienceToLibraryMock(...args),
  removeExperienceFromLibrary: (...args: unknown[]) => removeExperienceFromLibraryMock(...args),
  createLibrary: vi.fn(),
  updateLibrary: vi.fn(),
  deleteLibrary: vi.fn(),
}))

import { useLibraries } from "./useLibraries"

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

/** 응답 도착 시점을 테스트가 직접 잡기 위한 수동 해소 Promise. */
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

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

const LIBRARY_DTOS: LibraryDTO[] = [
  { id: "lib-a", name: "A 라이브러리", is_system: false },
  { id: "lib-b", name: "B 라이브러리", is_system: false },
]

function membershipOf(libraries: Library[], id: string): string[] {
  const library = libraries.find((item) => item.id === id)
  if (!library) throw new Error(`라이브러리 ${id} 를 찾지 못했다`)
  return library.experienceIds
}

/** 아직 응답하지 않은 멤버십 GET 들. 라이브러리 id 로 골라 해소한다. */
let pendingMembership: Map<string, Deferred<ExperienceListData>>

beforeEach(() => {
  vi.clearAllMocks()
  pendingMembership = new Map()
  getLibrariesMock.mockResolvedValue(LIBRARY_DTOS)
  getLibraryExperiencesMock.mockImplementation((id: string) => {
    const pending = deferred<ExperienceListData>()
    pendingMembership.set(id, pending)
    return pending.promise
  })
  addExperienceToLibraryMock.mockResolvedValue(undefined)
  removeExperienceFromLibraryMock.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
})

/** 목록 조회가 끝나 두 라이브러리의 멤버십 GET 이 모두 떠 있는 상태까지 진행시킨다. */
async function renderWithMembershipInFlight() {
  const rendered = renderHook(() => useLibraries())
  await waitFor(() => {
    expect(pendingMembership.has("lib-a")).toBe(true)
    expect(pendingMembership.has("lib-b")).toBe(true)
  })
  return rendered
}

async function settle() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe("useLibraries — 병렬 멤버십 로딩과 mutation 경합", () => {
  it("다른 라이브러리에서 경험을 추가해도, 로딩 중이던 라이브러리는 받아온 목록을 그대로 반영한다", async () => {
    const { result } = await renderWithMembershipInFlight()

    await act(async () => {
      await result.current.addExperienceToLibrary("lib-b", "exp-b1")
    })

    await act(async () => {
      pendingMembership.get("lib-a")!.resolve(listData(["exp-a1", "exp-a2"]))
      await Promise.resolve()
    })
    await settle()

    await waitFor(() => {
      expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-a1", "exp-a2"])
    })
    expect(result.current.loadingMembershipIds.has("lib-a")).toBe(false)
    expect(result.current.membershipErrorIds.has("lib-a")).toBe(false)
  })

  it("다른 라이브러리에서 경험을 삭제해도, 로딩 중이던 라이브러리는 받아온 목록을 그대로 반영한다", async () => {
    const { result } = await renderWithMembershipInFlight()

    // 삭제 대상이 실제 멤버여야 DELETE 경로를 타므로 먼저 넣어 둔다.
    await act(async () => {
      await result.current.addExperienceToLibrary("lib-b", "exp-b1")
    })
    await act(async () => {
      await result.current.removeExperienceFromLibrary("lib-b", "exp-b1")
    })

    await act(async () => {
      pendingMembership.get("lib-a")!.resolve(listData(["exp-a1"]))
      await Promise.resolve()
    })
    await settle()

    await waitFor(() => {
      expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-a1"])
    })
    expect(membershipOf(result.current.libraries, "lib-b")).toEqual([])
  })

  it("같은 라이브러리를 변경했다면 뒤늦게 도착한 응답은 여전히 버려 낙관적 상태를 지킨다", async () => {
    const { result } = await renderWithMembershipInFlight()

    await act(async () => {
      await result.current.addExperienceToLibrary("lib-b", "exp-b1")
    })

    // 서버 응답은 추가 이전 시점의 스냅샷이다 — 반영하면 방금 넣은 경험이 사라진다.
    await act(async () => {
      pendingMembership.get("lib-b")!.resolve(listData([]))
      await Promise.resolve()
    })
    await settle()

    expect(membershipOf(result.current.libraries, "lib-b")).toEqual(["exp-b1"])
    expect(result.current.loadingMembershipIds.has("lib-b")).toBe(false)
  })

  it("경합이 없으면 두 라이브러리 모두 각자의 목록을 반영한다", async () => {
    const { result } = await renderWithMembershipInFlight()

    await act(async () => {
      pendingMembership.get("lib-a")!.resolve(listData(["exp-a1"]))
      pendingMembership.get("lib-b")!.resolve(listData(["exp-b1", "exp-b2"]))
      await Promise.resolve()
    })
    await settle()

    await waitFor(() => {
      expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-a1"])
      expect(membershipOf(result.current.libraries, "lib-b")).toEqual(["exp-b1", "exp-b2"])
    })
  })
})
