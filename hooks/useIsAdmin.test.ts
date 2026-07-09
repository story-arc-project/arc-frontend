import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"

const useAuthMock = vi.fn()
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}))

import { useIsAdmin } from "./useIsAdmin"

function mockFetch(impl: () => Promise<Response> | Response) {
  // 실제 fetch 는 항상 Promise 를 반환한다 → 동기 Response mock 도 감싼다.
  // (Promise.reject 를 반환하는 네트워크-오류 케이스는 flatten 되어 그대로 reject.)
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(impl())))
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useIsAdmin", () => {
  it("비인증이면 fetch 하지 않고 false", () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false })
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)

    const { result } = renderHook(() => useIsAdmin())

    expect(result.current).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("인증 + status {isAdmin:true} 면 true 로 갱신된다", async () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true })
    mockFetch(() => jsonResponse(200, { isAdmin: true }))

    const { result } = renderHook(() => useIsAdmin())

    await waitFor(() => expect(result.current).toBe(true))
    expect(fetch).toHaveBeenCalledWith("/api/admin/status", { credentials: "include" })
  })

  it("인증했지만 {isAdmin:false} 면 false 유지", async () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true })
    mockFetch(() => jsonResponse(200, { isAdmin: false }))

    const { result } = renderHook(() => useIsAdmin())

    // 초기값 false → 유지. 잠시 대기 후에도 false.
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(result.current).toBe(false)
  })

  it("응답이 not-ok 면 false(fail-close)", async () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true })
    mockFetch(() => jsonResponse(500, {}))

    const { result } = renderHook(() => useIsAdmin())

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(result.current).toBe(false)
  })

  it("네트워크 오류여도 false(fail-close)", async () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true })
    mockFetch(() => Promise.reject(new Error("network")))

    const { result } = renderHook(() => useIsAdmin())

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(result.current).toBe(false)
  })
})
