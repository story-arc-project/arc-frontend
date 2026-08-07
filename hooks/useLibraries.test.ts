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
  reject: (reason?: unknown) => void
}

/** 응답 도착 시점을 테스트가 직접 잡기 위한 수동 해소 Promise. */
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
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
/** 같은 라이브러리로 여러 건이 겹칠 때 호출 순서로 골라 해소하기 위한 큐. */
let membershipQueue: Deferred<ExperienceListData>[]

beforeEach(() => {
  vi.clearAllMocks()
  pendingMembership = new Map()
  membershipQueue = []
  getLibrariesMock.mockResolvedValue(LIBRARY_DTOS)
  getLibraryExperiencesMock.mockImplementation((id: string) => {
    const pending = deferred<ExperienceListData>()
    pendingMembership.set(id, pending)
    membershipQueue.push(pending)
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

  it("실패 복구 재조회가 도착하기 전에 새 변경이 들어오면, 뒤늦은 서버 스냅샷이 그 변경을 덮지 않는다", async () => {
    const { result } = await renderWithMembershipInFlight()

    await act(async () => {
      pendingMembership.get("lib-a")!.resolve(listData(["exp-1"]))
      pendingMembership.get("lib-b")!.resolve(listData([]))
      await Promise.resolve()
    })
    await settle()

    // 초기 로딩분을 비워, 이후 등록되는 GET 은 실패 복구 재조회뿐이게 한다.
    pendingMembership.clear()

    // 추가가 서버에서 실패하면 훅은 서버 기준으로 재조회(resync)해 로컬 상태를 되돌린다.
    // 재조회 응답이 도착해야 이 호출이 끝나므로 여기서 await 하면 안 된다.
    addExperienceToLibraryMock.mockRejectedValueOnce(new Error("서버 오류"))
    let rejected = false
    let failedAdd!: Promise<void>
    await act(async () => {
      failedAdd = result.current.addExperienceToLibrary("lib-a", "exp-2").catch(() => {
        rejected = true
      })
      await Promise.resolve()
    })
    await settle()
    expect(pendingMembership.has("lib-a")).toBe(true)

    // 재조회 응답이 오기 전에 사용자가 같은 라이브러리에 다른 경험을 추가한다.
    await act(async () => {
      await result.current.addExperienceToLibrary("lib-a", "exp-3")
    })

    // 재조회 응답은 exp-3 추가 이전 시점의 스냅샷이다 — 반영하면 방금 넣은 경험이 사라진다.
    await act(async () => {
      pendingMembership.get("lib-a")!.resolve(listData(["exp-1"]))
      await failedAdd
    })
    await settle()

    expect(rejected).toBe(true)
    expect(membershipOf(result.current.libraries, "lib-a")).toContain("exp-3")
  })

  it("실패한 변경의 복구 재조회가, 그 사이 시작된 다른 변경까지 되돌리지 않는다", async () => {
    const { result } = await renderWithMembershipInFlight()

    await act(async () => {
      pendingMembership.get("lib-a")!.resolve(listData(["exp-1"]))
      pendingMembership.get("lib-b")!.resolve(listData([]))
      await Promise.resolve()
    })
    await settle()
    pendingMembership.clear()

    // 같은 라이브러리에 두 건이 겹쳐 진행된다. 앞의 것은 실패하고, 뒤의 것은 성공한다.
    const postA = deferred<void>()
    const postB = deferred<void>()
    addExperienceToLibraryMock.mockImplementationOnce(() => postA.promise)
    addExperienceToLibraryMock.mockImplementationOnce(() => postB.promise)

    let rejectedA = false
    let addA!: Promise<void>
    let addB!: Promise<void>
    await act(async () => {
      addA = result.current.addExperienceToLibrary("lib-a", "exp-2").catch(() => {
        rejectedA = true
      })
      addB = result.current.addExperienceToLibrary("lib-a", "exp-3")
      await Promise.resolve()
    })

    // 앞의 변경이 실패해 복구 재조회가 시작된다.
    await act(async () => {
      postA.reject(new Error("서버 오류"))
      await Promise.resolve()
    })
    await settle()
    expect(pendingMembership.has("lib-a")).toBe(true)

    // 재조회 응답은 뒤의 변경이 서버에 닿기 전 시점이라 exp-3 이 없다.
    await act(async () => {
      pendingMembership.get("lib-a")!.resolve(listData(["exp-1"]))
      await addA
    })
    // 뒤의 변경은 서버에서 성공한다 — 화면에서 사라지면 안 된다.
    await act(async () => {
      postB.resolve(undefined)
      await addB
    })
    await settle()

    expect(rejectedA).toBe(true)
    expect(membershipOf(result.current.libraries, "lib-a")).toContain("exp-3")
  })

  it("겹친 두 변경이 모두 실패하면, 뒤늦게 성공한 옛 복구가 새 복구의 재시도 안내를 지우지 않는다", async () => {
    const { result } = await renderWithMembershipInFlight()

    await act(async () => {
      pendingMembership.get("lib-a")!.resolve(listData(["exp-1"]))
      pendingMembership.get("lib-b")!.resolve(listData([]))
      await Promise.resolve()
    })
    await settle()
    pendingMembership.clear()
    membershipQueue.length = 0

    const postA = deferred<void>()
    const postB = deferred<void>()
    addExperienceToLibraryMock.mockImplementationOnce(() => postA.promise)
    addExperienceToLibraryMock.mockImplementationOnce(() => postB.promise)

    let addA!: Promise<void>
    let addB!: Promise<void>
    await act(async () => {
      addA = result.current.addExperienceToLibrary("lib-a", "exp-2").catch(() => {})
      addB = result.current.addExperienceToLibrary("lib-a", "exp-3").catch(() => {})
      await Promise.resolve()
    })

    // 두 건 모두 실패해 각자의 복구 재조회가 뜬다 — 앞의 것이 queue[0], 뒤의 것이 queue[1].
    await act(async () => {
      postA.reject(new Error("서버 오류 A"))
      await Promise.resolve()
    })
    await settle()
    await act(async () => {
      postB.reject(new Error("서버 오류 B"))
      await Promise.resolve()
    })
    await settle()
    expect(membershipQueue).toHaveLength(2)

    // 뒤의 복구가 먼저 실패해 재시도 안내를 띄운다.
    await act(async () => {
      membershipQueue[1].reject(new Error("재조회 실패"))
      await addB
    })
    await settle()
    expect(result.current.membershipErrorIds.has("lib-a")).toBe(true)

    // 앞의 복구가 뒤늦게 성공한다 — 이미 뒤처진 응답이므로 새 재시도 안내를 지우면 안 된다.
    await act(async () => {
      membershipQueue[0].resolve(listData(["exp-1"]))
      await addA
    })
    await settle()

    expect(result.current.membershipErrorIds.has("lib-a")).toBe(true)
  })

  it("아직 진행 중인 변경이 있으면, 나중 변경의 실패 복구가 그 변경을 지우지 않는다", async () => {
    const { result } = await renderWithMembershipInFlight()

    await act(async () => {
      pendingMembership.get("lib-a")!.resolve(listData(["exp-1"]))
      pendingMembership.get("lib-b")!.resolve(listData([]))
      await Promise.resolve()
    })
    await settle()
    pendingMembership.clear()
    membershipQueue.length = 0

    const postA = deferred<void>()
    const postB = deferred<void>()
    addExperienceToLibraryMock.mockImplementationOnce(() => postA.promise)
    addExperienceToLibraryMock.mockImplementationOnce(() => postB.promise)

    let addA!: Promise<void>
    let addB!: Promise<void>
    await act(async () => {
      addA = result.current.addExperienceToLibrary("lib-a", "exp-2")
      addB = result.current.addExperienceToLibrary("lib-a", "exp-3").catch(() => {})
      await Promise.resolve()
    })

    // 뒤의 변경만 실패한다 — 앞의 변경은 아직 서버 응답을 기다리는 중이다.
    await act(async () => {
      postB.reject(new Error("서버 오류"))
      await Promise.resolve()
    })
    await settle()
    expect(membershipQueue).toHaveLength(1)

    // 복구 재조회 응답에는 아직 처리 중인 앞의 변경이 담겨 있지 않다.
    await act(async () => {
      membershipQueue[0].resolve(listData(["exp-1"]))
      await addB
    })
    await settle()

    // 앞의 변경은 서버에서 성공한다 — 화면에서 사라지면 안 된다.
    await act(async () => {
      postA.resolve(undefined)
      await addA
    })
    await settle()

    expect(membershipOf(result.current.libraries, "lib-a")).toContain("exp-2")
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

/** 목록·멤버십 조회가 모두 끝나 lib-a 에 exp-1 만 들어 있는 평온한 상태까지 진행시킨다. */
async function renderWithMembershipSettled() {
  const rendered = await renderWithMembershipInFlight()
  await act(async () => {
    pendingMembership.get("lib-a")!.resolve(listData(["exp-1"]))
    pendingMembership.get("lib-b")!.resolve(listData([]))
    await Promise.resolve()
  })
  await settle()
  await waitFor(() => {
    expect(membershipOf(rendered.result.current.libraries, "lib-a")).toEqual(["exp-1"])
  })
  return rendered
}

// 멤버 여부 판정을 `setLibraries` 업데이터의 **부수효과**로 하면, React 가 그 업데이터를
// dispatch 시점에 동기 실행해 준다는 조건부 보장(내부 eager state 최적화)에 기대게 된다.
// 이 훅에서는 그 최적화가 걸리지 않아 판정이 늘 초기값으로 읽혔다 — 제거는 서버로 나가지도
// 않은 채 화면에서만 사라졌고(FRT-234), 추가 쪽의 중복 클릭 방지는 조용히 죽어 있었다.
// 판정은 업데이터 밖에서, 현재 목록을 미러링하는 ref 로 해야 한다.
describe("useLibraries — 멤버십 판정은 상태 업데이터 밖에서 한다", () => {
  it("경합이 없는 평범한 제거도 서버로 삭제 요청을 보낸다", async () => {
    const { result } = await renderWithMembershipSettled()

    await act(async () => {
      await result.current.removeExperienceFromLibrary("lib-a", "exp-1")
    })

    expect(removeExperienceFromLibraryMock).toHaveBeenCalledWith("lib-a", "exp-1")
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual([])
  })

  it("들어 있지 않은 경험을 빼려 하면 서버로 요청을 보내지 않는다", async () => {
    const { result } = await renderWithMembershipSettled()

    await act(async () => {
      await result.current.removeExperienceFromLibrary("lib-a", "없는-경험")
    })

    expect(removeExperienceFromLibraryMock).not.toHaveBeenCalled()
  })

  it("새 경험을 추가하면 서버로 추가 요청을 보낸다", async () => {
    const { result } = await renderWithMembershipSettled()

    await act(async () => {
      await result.current.addExperienceToLibrary("lib-a", "exp-2")
    })

    expect(addExperienceToLibraryMock).toHaveBeenCalledWith("lib-a", "exp-2")
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1", "exp-2"])
  })

  it("이미 들어 있는 경험을 다시 추가하면 중복 요청을 보내지 않는다", async () => {
    const { result } = await renderWithMembershipSettled()

    await act(async () => {
      await result.current.addExperienceToLibrary("lib-a", "exp-1")
    })

    expect(addExperienceToLibraryMock).not.toHaveBeenCalled()
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1"])
  })

  // 원래 주석이 약속한 동작: 느린 연결에서 두 번째 클릭은 낙관적으로 바뀐 상태를 보고
  // 스스로 멈춘다. 판정이 업데이터 안에 있으면 첫 클릭의 상태 변화를 두 번째가 못 봐서
  // 같은 경험에 POST 가 두 번 나간다.
  it("응답이 오기 전에 같은 경험을 두 번 추가해도 요청은 한 번만 나간다", async () => {
    const { result } = await renderWithMembershipSettled()

    const post = deferred<undefined>()
    addExperienceToLibraryMock.mockReturnValueOnce(post.promise)

    let first!: Promise<void>
    await act(async () => {
      first = result.current.addExperienceToLibrary("lib-a", "exp-2")
      await Promise.resolve()
    })

    await act(async () => {
      await result.current.addExperienceToLibrary("lib-a", "exp-2")
    })

    expect(addExperienceToLibraryMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      post.resolve(undefined)
      await first
    })
  })

  it("응답이 오기 전에 같은 경험을 두 번 빼도 요청은 한 번만 나간다", async () => {
    const { result } = await renderWithMembershipSettled()

    const del = deferred<undefined>()
    removeExperienceFromLibraryMock.mockReturnValueOnce(del.promise)

    let first!: Promise<void>
    await act(async () => {
      first = result.current.removeExperienceFromLibrary("lib-a", "exp-1")
      await Promise.resolve()
    })

    await act(async () => {
      await result.current.removeExperienceFromLibrary("lib-a", "exp-1")
    })

    expect(removeExperienceFromLibraryMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      del.resolve(undefined)
      await first
    })
  })
})
