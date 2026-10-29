import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"

import type { LibraryDTO } from "@/lib/utils/library-mapper"
import type { Experience, ExperienceListData } from "@/types/experience"
import type { Library } from "@/types/archive"

const getLibrariesMock = vi.fn()
const getLibraryExperiencesMock = vi.fn()
const addExperienceToLibraryMock = vi.fn()
const removeExperienceFromLibraryMock = vi.fn()
const createLibraryMock = vi.fn()
const updateLibraryMock = vi.fn()
const deleteLibraryMock = vi.fn()

vi.mock("@/lib/api/library-api", () => ({
  getLibraries: (...args: unknown[]) => getLibrariesMock(...args),
  getLibraryExperiences: (...args: unknown[]) => getLibraryExperiencesMock(...args),
  addExperienceToLibrary: (...args: unknown[]) => addExperienceToLibraryMock(...args),
  removeExperienceFromLibrary: (...args: unknown[]) => removeExperienceFromLibraryMock(...args),
  createLibrary: (...args: unknown[]) => createLibraryMock(...args),
  updateLibrary: (...args: unknown[]) => updateLibraryMock(...args),
  deleteLibrary: (...args: unknown[]) => deleteLibraryMock(...args),
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
  vi.resetAllMocks()
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
  createLibraryMock.mockResolvedValue("lib-new")
  updateLibraryMock.mockResolvedValue(undefined)
  deleteLibraryMock.mockResolvedValue(undefined)
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
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1", "exp-3"])
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
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1", "exp-3"])
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

    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1", "exp-2"])
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

  // 아무것도 바꾸지 않는 호출이 mutation 세대를 올리면, 진행 중이던 쓰기의 실패 복구가
  // 자기 스냅샷을 stale 로 판정해 아무것도 되돌리지 못한다. 그러면 서버에서 실패한
  // 낙관적 변경이 화면에 무기한 남는다 — no-op 은 세대를 건드리지 말아야 한다.
  it("중복 클릭으로 무시된 추가가, 진행 중이던 추가의 실패 복구를 막지 않는다", async () => {
    const { result } = await renderWithMembershipSettled()
    // 초기 로딩분을 비워, 이후 등록되는 GET 은 실패 복구 재조회뿐이게 한다.
    pendingMembership.clear()

    const post = deferred<undefined>()
    addExperienceToLibraryMock.mockReturnValueOnce(post.promise)

    let rejected = false
    let failedAdd!: Promise<void>
    await act(async () => {
      failedAdd = result.current.addExperienceToLibrary("lib-a", "exp-2").catch(() => {
        rejected = true
      })
      await Promise.resolve()
    })

    // 응답을 기다리는 동안 같은 항목을 한 번 더 누른다 — 아무 일도 일어나지 않아야 한다.
    await act(async () => {
      await result.current.addExperienceToLibrary("lib-a", "exp-2")
    })
    expect(addExperienceToLibraryMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      post.reject(new Error("서버 오류"))
      await Promise.resolve()
    })
    await settle()
    expect(pendingMembership.has("lib-a")).toBe(true)

    // 서버에는 exp-2 가 없다 — 실패한 낙관적 추가는 화면에서도 사라져야 한다.
    await act(async () => {
      pendingMembership.get("lib-a")!.resolve(listData(["exp-1"]))
      await failedAdd
    })
    await settle()

    expect(rejected).toBe(true)
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1"])
  })

  it("중복 클릭으로 무시된 제거가, 진행 중이던 제거의 실패 복구를 막지 않는다", async () => {
    const { result } = await renderWithMembershipSettled()
    pendingMembership.clear()

    const del = deferred<undefined>()
    removeExperienceFromLibraryMock.mockReturnValueOnce(del.promise)

    let rejected = false
    let failedRemove!: Promise<void>
    await act(async () => {
      failedRemove = result.current.removeExperienceFromLibrary("lib-a", "exp-1").catch(() => {
        rejected = true
      })
      await Promise.resolve()
    })

    await act(async () => {
      await result.current.removeExperienceFromLibrary("lib-a", "exp-1")
    })
    expect(removeExperienceFromLibraryMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      del.reject(new Error("서버 오류"))
      await Promise.resolve()
    })
    await settle()
    expect(pendingMembership.has("lib-a")).toBe(true)

    // 서버에는 exp-1 이 그대로 있다 — 실패한 제거는 화면에서도 되돌아와야 한다.
    await act(async () => {
      pendingMembership.get("lib-a")!.resolve(listData(["exp-1"]))
      await failedRemove
    })
    await settle()

    expect(rejected).toBe(true)
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1"])
  })
})

describe("useLibraries — 실패한 변경과 유효한 변경을 재조정한다", () => {
  it.each([false, true])("성공 응답이 먼저인가=%s: 겹친 성공만 남기고 실패한 추가를 제거한다", async (successFirst) => {
    const { result } = await renderWithMembershipSettled()
    membershipQueue.length = 0
    const failedPost = deferred<void>()
    const successfulPost = deferred<void>()
    addExperienceToLibraryMock.mockReturnValueOnce(failedPost.promise).mockReturnValueOnce(successfulPost.promise)
    let failed!: Promise<void>
    let successful!: Promise<void>
    await act(async () => {
      failed = result.current.addExperienceToLibrary("lib-a", "exp-2").catch(() => {})
      successful = result.current.addExperienceToLibrary("lib-a", "exp-3")
    })
    expect(addExperienceToLibraryMock).toHaveBeenCalledTimes(2)
    if (successFirst) await act(async () => { successfulPost.resolve(); await successful })
    await act(async () => { failedPost.reject(new Error("write failed")); await Promise.resolve() })
    await settle()
    await act(async () => {
      membershipQueue[0].resolve(listData(successFirst ? ["exp-1", "exp-3"] : ["exp-1"]))
      await failed
    })
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1", "exp-3"])
    if (!successFirst) await act(async () => { successfulPost.resolve(); await successful })
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1", "exp-3"])
  })

  it.each([false, true])("복구 응답 역순=%s: 두 추가가 모두 실패하면 둘 다 제거한다", async (reverse) => {
    const { result } = await renderWithMembershipSettled()
    membershipQueue.length = 0
    const posts = [deferred<void>(), deferred<void>()]
    addExperienceToLibraryMock.mockReturnValueOnce(posts[0].promise).mockReturnValueOnce(posts[1].promise)
    let writes!: Promise<void>[]
    await act(async () => {
      writes = ["exp-2", "exp-3"].map((id) => result.current.addExperienceToLibrary("lib-a", id).catch(() => {}))
      posts[0].reject(new Error("first failed"))
      await Promise.resolve()
    })
    await settle()
    await act(async () => { posts[1].reject(new Error("second failed")); await Promise.resolve() })
    await settle()
    for (const index of reverse ? [1, 0] : [0, 1]) {
      await act(async () => { membershipQueue[index].resolve(listData(["exp-1"])); await writes[index] })
    }
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1"])
    expect(result.current.membershipErrorIds.has("lib-a")).toBe(false)
  })

  it.each(["add", "remove"] as const)("같은 항목 %s 실패 뒤 반대 변경은 요청 순서를 지키고 복구에 보존된다", async (firstAction) => {
    const { result } = await renderWithMembershipSettled()
    membershipQueue.length = 0
    const firstRequest = deferred<void>()
    const secondRequest = deferred<void>()
    const firstMock = firstAction === "add" ? addExperienceToLibraryMock : removeExperienceFromLibraryMock
    const secondMock = firstAction === "add" ? removeExperienceFromLibraryMock : addExperienceToLibraryMock
    firstMock.mockReturnValueOnce(firstRequest.promise)
    secondMock.mockReturnValueOnce(secondRequest.promise)
    const id = firstAction === "add" ? "exp-2" : "exp-1"
    let first!: Promise<void>
    let second!: Promise<void>
    await act(async () => {
      first = (firstAction === "add" ? result.current.addExperienceToLibrary : result.current.removeExperienceFromLibrary)("lib-a", id).catch(() => {})
      second = (firstAction === "add" ? result.current.removeExperienceFromLibrary : result.current.addExperienceToLibrary)("lib-a", id)
    })
    expect(secondMock).not.toHaveBeenCalled()
    await act(async () => { firstRequest.reject(new Error("failed")); await Promise.resolve() })
    await settle()
    expect(secondMock).toHaveBeenCalledWith("lib-a", id)
    await act(async () => { membershipQueue[0].resolve(listData(["exp-1"])); await first })
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1"])
    await act(async () => { secondRequest.resolve(); await second })
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1"])
  })

  it("같은 항목의 후속 요청은 앞의 서버 응답 전에는 전송하지 않고 다른 라이브러리는 독립 처리한다", async () => {
    const { result } = await renderWithMembershipSettled()
    const post = deferred<void>()
    addExperienceToLibraryMock.mockReturnValueOnce(post.promise)
    let add!: Promise<void>
    let remove!: Promise<void>
    await act(async () => {
      add = result.current.addExperienceToLibrary("lib-a", "exp-2")
      remove = result.current.removeExperienceFromLibrary("lib-a", "exp-2")
      await result.current.addExperienceToLibrary("lib-b", "exp-2")
    })
    expect(removeExperienceFromLibraryMock).not.toHaveBeenCalled()
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1"])
    expect(membershipOf(result.current.libraries, "lib-b")).toEqual(["exp-2"])
    await act(async () => { post.resolve(); await Promise.all([add, remove]) })
    expect(removeExperienceFromLibraryMock).toHaveBeenCalledOnce()
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1"])
  })

  it("복구 GET 실패 뒤 재시도하는 동안에도 진행 중인 추가를 유지한다", async () => {
    const { result } = await renderWithMembershipSettled()
    membershipQueue.length = 0
    addExperienceToLibraryMock.mockRejectedValueOnce(new Error("failed"))
    let failed!: Promise<void>
    await act(async () => { failed = result.current.addExperienceToLibrary("lib-a", "exp-2").catch(() => {}); await Promise.resolve() })
    await settle()
    await act(async () => { membershipQueue[0].reject(new Error("GET failed")); await failed })
    expect(result.current.membershipErrorIds.has("lib-a")).toBe(true)
    const post = deferred<void>()
    addExperienceToLibraryMock.mockReturnValueOnce(post.promise)
    let added!: Promise<void>
    let retry!: Promise<void>
    await act(async () => {
      added = result.current.addExperienceToLibrary("lib-a", "exp-3")
      retry = result.current.retryLibraryMembership("lib-a")
    })
    await act(async () => { membershipQueue[1].resolve(listData(["exp-1"])); await retry })
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1", "exp-3"])
    expect(result.current.membershipErrorIds.has("lib-a")).toBe(false)
    await act(async () => { post.resolve(); await added })
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1", "exp-3"])
  })

  it("언마운트 뒤 실패한 쓰기는 복구 GET을 시작하지 않는다", async () => {
    const { result, unmount } = await renderWithMembershipSettled()
    membershipQueue.length = 0
    const post = deferred<void>()
    addExperienceToLibraryMock.mockReturnValueOnce(post.promise)
    let write!: Promise<void>
    await act(async () => { write = result.current.addExperienceToLibrary("lib-a", "exp-2").catch(() => {}) })
    unmount()
    post.reject(new Error("failed after unmount"))
    await settle()
    expect(membershipQueue).toHaveLength(0)
    await write
  })

  it("언마운트 전에 시작한 복구 응답도 목록을 갱신하지 않는다", async () => {
    const { result, unmount } = await renderWithMembershipSettled()
    membershipQueue.length = 0
    addExperienceToLibraryMock.mockRejectedValueOnce(new Error("failed"))
    let write!: Promise<void>
    await act(async () => { write = result.current.addExperienceToLibrary("lib-a", "exp-2").catch(() => {}); await Promise.resolve() })
    await settle()
    const before = result.current.libraries
    unmount()
    membershipQueue[0].resolve(listData(["exp-1"]))
    await write
    expect(result.current.libraries).toBe(before)
  })
})

describe("useLibraries — 같은 항목 요청 결과 조합", () => {
  it.each([
    { first: "add", failFirst: false, failSecond: false, server: ["exp-1"], expected: ["exp-1"] },
    { first: "add", failFirst: false, failSecond: true, server: ["exp-1", "exp-2"], expected: ["exp-1", "exp-2"] },
    { first: "add", failFirst: true, failSecond: true, server: ["exp-1"], expected: ["exp-1"] },
    { first: "remove", failFirst: false, failSecond: false, server: ["exp-1"], expected: ["exp-1"] },
    { first: "remove", failFirst: false, failSecond: true, server: [], expected: [] },
    { first: "remove", failFirst: true, failSecond: true, server: ["exp-1"], expected: ["exp-1"] },
  ])("$first → 반대 변경: 첫 실패=$failFirst, 다음 실패=$failSecond", async ({ first, failFirst, failSecond, server, expected }) => {
    const { result } = await renderWithMembershipSettled()
    membershipQueue.length = 0
    const requests = [deferred<void>(), deferred<void>()]
    const firstMock = first === "add" ? addExperienceToLibraryMock : removeExperienceFromLibraryMock
    const secondMock = first === "add" ? removeExperienceFromLibraryMock : addExperienceToLibraryMock
    firstMock.mockReturnValueOnce(requests[0].promise)
    secondMock.mockReturnValueOnce(requests[1].promise)
    const id = first === "add" ? "exp-2" : "exp-1"
    let writes!: Promise<void>[]
    await act(async () => {
      writes = [
        (first === "add" ? result.current.addExperienceToLibrary : result.current.removeExperienceFromLibrary)("lib-a", id).catch(() => {}),
        (first === "add" ? result.current.removeExperienceFromLibrary : result.current.addExperienceToLibrary)("lib-a", id).catch(() => {}),
      ]
    })
    expect(secondMock).not.toHaveBeenCalled()
    await act(async () => {
      if (failFirst) requests[0].reject(new Error("first failed"))
      else requests[0].resolve()
      await Promise.resolve()
    })
    await settle()
    expect(secondMock).toHaveBeenCalledOnce()
    await act(async () => {
      if (failSecond) requests[1].reject(new Error("second failed"))
      else requests[1].resolve()
      await Promise.resolve()
    })
    await settle()
    // Resolve the newest server snapshot first, then the older response. The
    // older GET must neither restore an earlier toggle nor clear a newer error.
    for (const recovery of [...membershipQueue].reverse()) {
      await act(async () => { recovery.resolve(listData(server)); await Promise.resolve() })
    }
    await act(async () => { await Promise.all(writes) })
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(expected)
  })

  it("추가 실패 → 제거 → 추가 세 번을 눌러도 마지막 의도를 순서대로 처리한다", async () => {
    const { result } = await renderWithMembershipSettled()
    membershipQueue.length = 0
    const first = deferred<void>()
    const second = deferred<void>()
    const third = deferred<void>()
    addExperienceToLibraryMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(third.promise)
    removeExperienceFromLibraryMock.mockReturnValueOnce(second.promise)
    let writes!: Promise<void>[]
    await act(async () => {
      writes = [
        result.current.addExperienceToLibrary("lib-a", "exp-2").catch(() => {}),
        result.current.removeExperienceFromLibrary("lib-a", "exp-2"),
        result.current.addExperienceToLibrary("lib-a", "exp-2"),
      ]
    })
    expect(addExperienceToLibraryMock).toHaveBeenCalledTimes(1)
    expect(removeExperienceFromLibraryMock).not.toHaveBeenCalled()
    await act(async () => { first.reject(new Error("first failed")); await Promise.resolve() })
    await settle()
    expect(removeExperienceFromLibraryMock).toHaveBeenCalledOnce()
    expect(addExperienceToLibraryMock).toHaveBeenCalledTimes(1)
    await act(async () => { membershipQueue[0].resolve(listData(["exp-1"])); await writes[0] })
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1", "exp-2"])
    await act(async () => { second.resolve(); await writes[1] })
    expect(addExperienceToLibraryMock).toHaveBeenCalledTimes(2)
    await act(async () => { third.resolve(); await writes[2] })
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1", "exp-2"])
  })

  it("오래 걸린 최초 GET은 복구 실패 뒤 재시도 필요 상태를 loaded로 바꾸지 않는다", async () => {
    const { result } = await renderWithMembershipInFlight()
    const initial = pendingMembership.get("lib-a")!
    addExperienceToLibraryMock.mockRejectedValueOnce(new Error("write failed"))
    let write!: Promise<void>
    await act(async () => { write = result.current.addExperienceToLibrary("lib-a", "exp-2").catch(() => {}); await Promise.resolve() })
    await settle()
    await act(async () => { pendingMembership.get("lib-a")!.reject(new Error("recovery failed")); await write })
    await act(async () => { initial.resolve(listData([])); await Promise.resolve() })
    expect(result.current.membershipErrorIds.has("lib-a")).toBe(true)
    expect(result.current.loadedMembershipIds.has("lib-a")).toBe(false)
  })
})

describe("useLibraries — 재시도 상태", () => {
  it("복구 오류 뒤 중복 no-op 호출은 재시도 안내와 요청 수를 바꾸지 않는다", async () => {
    const { result } = await renderWithMembershipSettled()
    membershipQueue.length = 0
    addExperienceToLibraryMock.mockRejectedValueOnce(new Error("write failed"))
    let failed!: Promise<void>
    await act(async () => { failed = result.current.addExperienceToLibrary("lib-a", "exp-2").catch(() => {}); await Promise.resolve() })
    await settle()
    await act(async () => { membershipQueue[0].reject(new Error("GET failed")); await failed })
    await act(async () => {
      await result.current.addExperienceToLibrary("lib-a", "exp-2")
      await result.current.removeExperienceFromLibrary("lib-a", "absent")
    })
    expect(addExperienceToLibraryMock).toHaveBeenCalledTimes(1)
    expect(removeExperienceFromLibraryMock).not.toHaveBeenCalled()
    expect(result.current.membershipErrorIds.has("lib-a")).toBe(true)
    expect(result.current.loadedMembershipIds.has("lib-a")).toBe(false)
  })

  it("겹친 재시도 중 이전 응답이 먼저 끝나도 다음 응답까지 loading을 유지한다", async () => {
    const { result } = await renderWithMembershipSettled()
    membershipQueue.length = 0
    let retries!: Promise<void>[]
    await act(async () => {
      retries = [result.current.retryLibraryMembership("lib-a"), result.current.retryLibraryMembership("lib-a")]
    })
    await act(async () => { membershipQueue[0].resolve(listData(["exp-1"])); await retries[0] })
    expect(result.current.loadingMembershipIds.has("lib-a")).toBe(true)
    await act(async () => { membershipQueue[1].resolve(listData(["exp-1"])); await retries[1] })
    expect(result.current.loadingMembershipIds.has("lib-a")).toBe(false)
  })
})

describe("useLibraries — 전체 재조회 이후 복구 상태", () => {
  it("실패 복구 GET 뒤 전체 재조회가 성공하면 새 멤버십을 loaded로 표시한다", async () => {
    const { result } = await renderWithMembershipSettled()
    membershipQueue.length = 0
    addExperienceToLibraryMock.mockRejectedValueOnce(new Error("write failed"))
    let failed!: Promise<void>
    await act(async () => { failed = result.current.addExperienceToLibrary("lib-a", "exp-2").catch(() => {}); await Promise.resolve() })
    await settle()
    await act(async () => { membershipQueue[0].reject(new Error("recovery failed")); await failed })
    expect(result.current.membershipErrorIds.has("lib-a")).toBe(true)
    await act(async () => { await result.current.refetch() })
    await act(async () => {
      pendingMembership.get("lib-a")!.resolve(listData(["exp-1"]))
      pendingMembership.get("lib-b")!.resolve(listData([]))
      await Promise.resolve()
    })
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1"])
    expect(result.current.loadedMembershipIds.has("lib-a")).toBe(true)
    expect(result.current.membershipErrorIds.has("lib-a")).toBe(false)
    expect(result.current.loadingMembershipIds.has("lib-a")).toBe(false)
  })
})


describe("useLibraries — acknowledged library CRUD", () => {
  it.each(["create", "update", "delete"] as const)("%s success survives overlapping membership edits without another list request", async (action) => {
    const { result } = await renderWithMembershipSettled()
    const response = deferred<never>()
    const api = action === "create" ? createLibraryMock : action === "update" ? updateLibraryMock : deleteLibraryMock
    api.mockReturnValueOnce(response.promise)
    let write!: Promise<void>
    await act(async () => {
      write = action === "create" ? result.current.createLibrary({ name: "New" })
        : action === "update" ? result.current.updateLibrary("lib-b", { name: "Renamed", color: "red" })
        : result.current.deleteLibrary("lib-b")
      await result.current.addExperienceToLibrary("lib-a", "exp-2")
      await result.current.removeExperienceFromLibrary("lib-a", "exp-1")
    })
    await act(async () => { response.resolve((action === "create" ? "lib-new" : undefined) as never); await write })
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-2"])
    expect(result.current.loadedMembershipIds.has("lib-a")).toBe(true)
    if (action === "create") expect(result.current.libraries.find((l) => l.id === "lib-new")?.name).toBe("New")
    if (action === "update") expect(result.current.libraries.find((l) => l.id === "lib-b")).toMatchObject({ name: "Renamed", color: "red" })
    if (action === "delete") expect(result.current.libraries.some((l) => l.id === "lib-b")).toBe(false)
    expect(getLibrariesMock).toHaveBeenCalledTimes(1)
    expect(getLibraryExperiencesMock).toHaveBeenCalledTimes(2)
  })

  it.each(["create", "update", "delete"] as const)("%s failure leaves acknowledged state unchanged", async (action) => {
    const { result } = await renderWithMembershipSettled()
    const api = action === "create" ? createLibraryMock : action === "update" ? updateLibraryMock : deleteLibraryMock
    api.mockRejectedValueOnce(new Error("write failed"))
    const before = result.current.libraries
    await act(async () => {
      const write = action === "create" ? result.current.createLibrary({ name: "New" })
        : action === "update" ? result.current.updateLibrary("lib-b", { name: "Renamed" })
        : result.current.deleteLibrary("lib-b")
      await expect(write).rejects.toThrow("write failed")
    })
    expect(result.current.libraries).toBe(before)
  })

  it.each(["create", "update", "delete"] as const)("an older list response cannot undo %s success", async (action) => {
    const { result } = await renderWithMembershipSettled()
    const snapshot = deferred<LibraryDTO[]>()
    getLibrariesMock.mockReturnValueOnce(snapshot.promise)
    let refresh!: Promise<void>
    await act(async () => { refresh = result.current.refetch() })
    await act(async () => {
      if (action === "create") await result.current.createLibrary({ name: "New" })
      if (action === "update") await result.current.updateLibrary("lib-b", { name: "Renamed" })
      if (action === "delete") await result.current.deleteLibrary("lib-b")
    })
    await act(async () => { snapshot.resolve(LIBRARY_DTOS); await refresh })
    if (action === "create") expect(result.current.libraries.some((l) => l.id === "lib-new")).toBe(true)
    if (action === "update") expect(result.current.libraries.find((l) => l.id === "lib-b")?.name).toBe("Renamed")
    if (action === "delete") expect(result.current.libraries.some((l) => l.id === "lib-b")).toBe(false)
    expect(result.current.isLoading).toBe(false)
  })

  it("same-library updates preserve user order and a failed later update preserves prior success", async () => {
    const { result } = await renderWithMembershipSettled()
    const first = deferred<void>()
    const second = deferred<void>()
    let calls = 0
    updateLibraryMock.mockImplementation((id: string) => id === "lib-a" ? (++calls === 1 ? first.promise : second.promise) : Promise.resolve())
    let writes!: Promise<void>[]
    await act(async () => {
      writes = [result.current.updateLibrary("lib-a", { name: "First" }), result.current.updateLibrary("lib-a", { name: "Second" }).catch(() => {})]
      await result.current.updateLibrary("lib-b", { name: "Independent" })
    })
    expect(updateLibraryMock.mock.calls.map(([id]) => id)).toEqual(["lib-a", "lib-b"])
    await act(async () => { first.resolve(); await writes[0] })
    expect(result.current.libraries.find((l) => l.id === "lib-a")?.name).toBe("First")
    await act(async () => { second.reject(new Error("later failed")); await writes[1] })
    expect(result.current.libraries.find((l) => l.id === "lib-a")?.name).toBe("First")
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1"])
  })

  it("delete waits for an earlier update and late membership GET cannot resurrect it", async () => {
    const { result } = await renderWithMembershipInFlight()
    const initialMembership = pendingMembership.get("lib-a")!
    const update = deferred<void>()
    updateLibraryMock.mockReturnValueOnce(update.promise)
    let writes!: Promise<void>[]
    await act(async () => { writes = [result.current.updateLibrary("lib-a", { name: "Renamed" }), result.current.deleteLibrary("lib-a")] })
    expect(deleteLibraryMock).not.toHaveBeenCalled()
    await act(async () => { update.resolve(); await Promise.all(writes) })
    await act(async () => { initialMembership.resolve(listData(["exp-1"])); await Promise.resolve() })
    expect(result.current.libraries.some((l) => l.id === "lib-a")).toBe(false)
    expect(result.current.loadedMembershipIds.has("lib-a")).toBe(false)
    expect(result.current.loadingMembershipIds.has("lib-a")).toBe(false)
  })

  it("CRUD does not invalidate an overlapping failed membership recovery", async () => {
    const { result } = await renderWithMembershipSettled()
    membershipQueue.length = 0
    addExperienceToLibraryMock.mockRejectedValueOnce(new Error("membership failed"))
    let failed!: Promise<void>
    await act(async () => { failed = result.current.addExperienceToLibrary("lib-a", "exp-2").catch(() => {}); await Promise.resolve() })
    await settle()
    await act(async () => { await result.current.updateLibrary("lib-b", { name: "Renamed" }) })
    await act(async () => { membershipQueue[0].resolve(listData(["exp-1"])); await failed })
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1"])
    expect(result.current.libraries.find((l) => l.id === "lib-b")?.name).toBe("Renamed")
  })
})


describe("useLibraries — new library readiness", () => {
  it("a newly created manual library is immediately a loaded empty library", async () => {
    const { result } = await renderWithMembershipSettled()
    await act(async () => { await result.current.createLibrary({ name: "New" }) })
    expect(result.current.loadedMembershipIds.has("lib-new")).toBe(true)
    expect(membershipOf(result.current.libraries, "lib-new")).toEqual([])
  })

  it("a list that observes create before its response does not produce duplicate ids or lose membership", async () => {
    const { result } = await renderWithMembershipSettled()
    const created = deferred<string>()
    createLibraryMock.mockReturnValueOnce(created.promise)
    let write!: Promise<void>
    await act(async () => { write = result.current.createLibrary({ name: "New" }) })
    getLibrariesMock.mockResolvedValueOnce([...LIBRARY_DTOS, { id: "lib-new", name: "New", is_system: false }])
    await act(async () => { await result.current.refetch() })
    await act(async () => { pendingMembership.get("lib-new")!.resolve(listData(["server-member"])); await Promise.resolve() })
    await act(async () => { created.resolve("lib-new"); await write })
    expect(result.current.libraries.filter((l) => l.id === "lib-new")).toHaveLength(1)
    expect(membershipOf(result.current.libraries, "lib-new")).toEqual(["server-member"])
  })

  it("a failed first metadata write does not prevent the queued successful write", async () => {
    const { result } = await renderWithMembershipSettled()
    const first = deferred<void>()
    updateLibraryMock.mockReturnValueOnce(first.promise)
    let writes!: Promise<void>[]
    await act(async () => { writes = [result.current.updateLibrary("lib-a", { name: "Failed" }).catch(() => {}), result.current.updateLibrary("lib-a", { color: "blue" })] })
    await act(async () => { first.reject(new Error("first failed")); await Promise.all(writes) })
    expect(result.current.libraries.find((l) => l.id === "lib-a")).toMatchObject({ name: "A 라이브러리", color: "blue" })
  })

  it.each(["create", "update", "delete"] as const)("%s response after unmount does not change React state", async (action) => {
    const { result, unmount } = await renderWithMembershipSettled()
    const response = deferred<never>()
    const api = action === "create" ? createLibraryMock : action === "update" ? updateLibraryMock : deleteLibraryMock
    api.mockReturnValueOnce(response.promise)
    let write!: Promise<void>
    await act(async () => {
      write = action === "create" ? result.current.createLibrary({ name: "New" })
        : action === "update" ? result.current.updateLibrary("lib-b", { name: "Renamed" })
        : result.current.deleteLibrary("lib-b")
    })
    const before = result.current.libraries
    unmount()
    response.resolve((action === "create" ? "lib-new" : undefined) as never)
    await write
    expect(result.current.libraries).toBe(before)
  })
})


describe("useLibraries — list and membership request lifetimes", () => {
  it("an invalidated list refresh does not discard membership GETs that still own the displayed libraries", async () => {
    const { result } = await renderWithMembershipInFlight()
    const initialA = pendingMembership.get("lib-a")!
    const snapshot = deferred<LibraryDTO[]>()
    getLibrariesMock.mockReturnValueOnce(snapshot.promise)
    let refresh!: Promise<void>
    await act(async () => { refresh = result.current.refetch() })
    await act(async () => { await result.current.createLibrary({ name: "New" }) })
    await act(async () => { snapshot.resolve(LIBRARY_DTOS); await refresh; initialA.resolve(listData(["exp-1"])); await Promise.resolve() })
    expect(membershipOf(result.current.libraries, "lib-a")).toEqual(["exp-1"])
  })

  it("create waits for the initial list so it cannot hide pre-existing libraries", async () => {
    const initial = deferred<LibraryDTO[]>()
    getLibrariesMock.mockReturnValueOnce(initial.promise)
    const { result } = renderHook(() => useLibraries())
    let write!: Promise<void>
    await act(async () => { write = result.current.createLibrary({ name: "New" }); await Promise.resolve() })
    expect(createLibraryMock).not.toHaveBeenCalled()
    await act(async () => { initial.resolve(LIBRARY_DTOS); await write })
    expect(result.current.libraries.map((l) => l.id)).toEqual(["lib-all", "lib-a", "lib-b", "lib-new"])
  })

  it("initial list failure does not block creation or remove the list retry error", async () => {
    const initial = deferred<LibraryDTO[]>()
    getLibrariesMock.mockReturnValueOnce(initial.promise)
    const { result } = renderHook(() => useLibraries())
    let write!: Promise<void>
    await act(async () => { write = result.current.createLibrary({ name: "New" }); initial.reject(new Error("initial list failed")); await write })
    expect(result.current.libraries.some((l) => l.id === "lib-new")).toBe(true)
    expect(result.current.error?.message).toBe("initial list failed")
    expect(result.current.isLoading).toBe(false)
    getLibrariesMock.mockResolvedValueOnce([...LIBRARY_DTOS, { id: "lib-new", name: "New", is_system: false }])
    await act(async () => { await result.current.refetch() })
    expect(result.current.error).toBeNull()
    expect(result.current.libraries.map((l) => l.id)).toEqual(["lib-all", "lib-a", "lib-b", "lib-new"])
  })
})


it("creation waits for an active initial-list retry rather than discarding it", async () => {
  getLibrariesMock.mockRejectedValueOnce(new Error("initial failed"))
  const { result } = renderHook(() => useLibraries())
  await waitFor(() => { expect(result.current.error?.message).toBe("initial failed") })
  const retry = deferred<LibraryDTO[]>()
  getLibrariesMock.mockReturnValueOnce(retry.promise)
  let refresh!: Promise<void>
  let create!: Promise<void>
  await act(async () => { refresh = result.current.refetch(); create = result.current.createLibrary({ name: "New" }); await Promise.resolve() })
  expect(createLibraryMock).not.toHaveBeenCalled()
  expect(result.current.isLoading).toBe(true)
  await act(async () => { retry.resolve(LIBRARY_DTOS); await Promise.all([refresh, create]) })
  expect(result.current.libraries.map((l) => l.id)).toEqual(["lib-all", "lib-a", "lib-b", "lib-new"])
  expect(result.current.error).toBeNull()
})


it.each([false, true])("creation acknowledgment preserves an initial-list retry started while POST was pending (retry fails=%s)", async (retryFails) => {
  getLibrariesMock.mockRejectedValueOnce(new Error("initial failed"))
  const { result } = renderHook(() => useLibraries())
  await waitFor(() => { expect(result.current.error?.message).toBe("initial failed") })
  const post = deferred<string>()
  createLibraryMock.mockReturnValueOnce(post.promise)
  let create!: Promise<void>
  await act(async () => { create = result.current.createLibrary({ name: "New" }); await Promise.resolve() })
  const retry = deferred<LibraryDTO[]>()
  getLibrariesMock.mockReturnValueOnce(retry.promise)
  let refresh!: Promise<void>
  await act(async () => { refresh = result.current.refetch(); post.resolve("lib-new"); await Promise.resolve() })
  expect(result.current.isLoading).toBe(true)
  await act(async () => {
    if (retryFails) retry.reject(new Error("retry failed"))
    else retry.resolve(LIBRARY_DTOS)
    await Promise.all([refresh, create])
  })
  expect(result.current.libraries.map((l) => l.id)).toEqual(retryFails ? ["lib-all", "lib-new"] : ["lib-all", "lib-a", "lib-b", "lib-new"])
  if (retryFails) expect(result.current.error?.message).toBe("retry failed")
  else expect(result.current.error).toBeNull()
})


describe("useLibraries — reviewed initial retry races", () => {
  it.each([
    { action: "update", retryFails: false, supersede: false },
    { action: "update", retryFails: true, supersede: false },
    { action: "delete", retryFails: false, supersede: false },
    { action: "delete", retryFails: true, supersede: false },
    { action: "update", retryFails: false, supersede: true },
    { action: "delete", retryFails: true, supersede: true },
  ] as const)("$action acknowledgment preserves initial retry (fails=$retryFails, superseded=$supersede)", async ({ action, retryFails, supersede }) => {
    getLibrariesMock.mockRejectedValueOnce(new Error("initial failed"))
    const { result } = renderHook(() => useLibraries())
    await waitFor(() => { expect(result.current.error?.message).toBe("initial failed") })
    await act(async () => { await result.current.createLibrary({ name: "New" }) })
    const older = deferred<LibraryDTO[]>()
    const latest = deferred<LibraryDTO[]>()
    if (supersede) getLibrariesMock.mockReturnValueOnce(older.promise)
    getLibrariesMock.mockReturnValueOnce(latest.promise)
    let retries!: Promise<void>[]
    let write!: Promise<void>
    await act(async () => {
      retries = [result.current.refetch()]
      write = action === "update" ? result.current.updateLibrary("lib-new", { name: "Renamed" }) : result.current.deleteLibrary("lib-new")
      await Promise.resolve()
      if (supersede) retries.push(result.current.refetch())
    })
    if (supersede) await act(async () => { older.resolve(LIBRARY_DTOS); await retries[0] })
    expect(result.current.isLoading).toBe(true)
    await act(async () => {
      if (retryFails) latest.reject(new Error("latest retry failed"))
      else latest.resolve([...LIBRARY_DTOS, { id: "lib-new", name: "New", is_system: false }])
      await Promise.all([...retries, write])
    })
    const ids = result.current.libraries.map((library) => library.id)
    expect(ids).toEqual([
      "lib-all", ...(retryFails ? [] : ["lib-a", "lib-b"]), ...(action === "update" ? ["lib-new"] : []),
    ])
    if (action === "update") expect(result.current.libraries.find((library) => library.id === "lib-new")?.name).toBe("Renamed")
    if (retryFails) expect(result.current.error?.message).toBe("latest retry failed")
    else expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it("a delayed create acknowledgment cannot restore a library already observed and deleted", async () => {
    getLibrariesMock.mockRejectedValueOnce(new Error("initial failed"))
    const { result } = renderHook(() => useLibraries())
    await waitFor(() => { expect(result.current.error?.message).toBe("initial failed") })
    const post = deferred<string>()
    createLibraryMock.mockReturnValueOnce(post.promise)
    let create!: Promise<void>
    await act(async () => { create = result.current.createLibrary({ name: "New" }); await Promise.resolve() })
    getLibrariesMock.mockResolvedValueOnce([...LIBRARY_DTOS, { id: "lib-new", name: "New", is_system: false }])
    await act(async () => { await result.current.refetch() })
    await act(async () => { await result.current.deleteLibrary("lib-new") })
    await act(async () => { post.resolve("lib-new"); await create })
    expect(result.current.libraries.map((library) => library.id)).toEqual(["lib-all", "lib-a", "lib-b"])
    expect(result.current.loadedMembershipIds.has("lib-new")).toBe(false)
  })
})
