import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// next/headers·next/navigation 은 서버 전용 모듈이라 jsdom 에서 직접 못 쓴다 → mock.
const getAll = vi.fn(() => [{ name: "session", value: "abc" }])
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ getAll })),
}))
const notFoundMock = vi.fn(() => {
  // 실제 notFound()는 특수 에러를 throw 해 렌더를 중단한다 — 동일 시맨틱 재현.
  throw new Error("NEXT_NOT_FOUND")
})
vi.mock("next/navigation", () => ({ notFound: () => notFoundMock() }))

import { isAdminEmail, getAdminUserOrNull, requireAdmin } from "@/lib/auth/admin"
import type { AuthUser } from "@/types/auth"

function makeUser(email: string): AuthUser {
  return {
    account: { email, has_password: true, email_verified: true, connected_oauth: [] },
    profile: null,
    onboarded: true,
  }
}

function mockFetch(impl: () => Promise<Response> | Response) {
  vi.stubGlobal("fetch", vi.fn(impl))
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
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("isAdminEmail", () => {
  it("ADMIN_EMAILS 미설정이면 누구도 admin 이 아니다", () => {
    expect(isAdminEmail("a@story-arc.org")).toBe(false)
  })

  it("빈 문자열·null·undefined 는 false", () => {
    vi.stubEnv("ADMIN_EMAILS", "a@story-arc.org")
    expect(isAdminEmail("")).toBe(false)
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
  })

  it("정확히 일치하면 true", () => {
    vi.stubEnv("ADMIN_EMAILS", "a@story-arc.org")
    expect(isAdminEmail("a@story-arc.org")).toBe(true)
  })

  it("대소문자를 무시한다", () => {
    vi.stubEnv("ADMIN_EMAILS", "Admin@Story-Arc.org")
    expect(isAdminEmail("admin@story-arc.ORG")).toBe(true)
  })

  it("allowlist·입력의 앞뒤 공백을 무시한다", () => {
    vi.stubEnv("ADMIN_EMAILS", "  a@story-arc.org , b@story-arc.org ")
    expect(isAdminEmail("  b@story-arc.org  ")).toBe(true)
  })

  it("콤마로 구분된 여러 이메일 중 하나면 true", () => {
    vi.stubEnv("ADMIN_EMAILS", "a@x.com,b@x.com,c@x.com")
    expect(isAdminEmail("c@x.com")).toBe(true)
  })

  it("목록에 없으면 false", () => {
    vi.stubEnv("ADMIN_EMAILS", "a@x.com,b@x.com")
    expect(isAdminEmail("z@x.com")).toBe(false)
  })

  it("빈 항목(연속 콤마·꼬리 콤마)이 섞여도 안전하다", () => {
    vi.stubEnv("ADMIN_EMAILS", ",a@x.com,,b@x.com,")
    expect(isAdminEmail("a@x.com")).toBe(true)
    expect(isAdminEmail("")).toBe(false)
  })
})

describe("getAdminUserOrNull", () => {
  it("200 + admin 이메일이면 user 를 반환한다", async () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@story-arc.org")
    mockFetch(() => jsonResponse(200, { data: makeUser("admin@story-arc.org") }))
    const user = await getAdminUserOrNull()
    expect(user?.account.email).toBe("admin@story-arc.org")
  })

  it("200 이지만 비-admin 이메일이면 null", async () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@story-arc.org")
    mockFetch(() => jsonResponse(200, { data: makeUser("user@story-arc.org") }))
    expect(await getAdminUserOrNull()).toBeNull()
  })

  it("401(비로그인)이면 redirect 하지 않고 null 을 반환한다", async () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@story-arc.org")
    mockFetch(() => jsonResponse(401, {}))
    expect(await getAdminUserOrNull()).toBeNull()
    // server.ts 와 달리 401 에서 어떤 리다이렉트/에러도 발생시키지 않는 게 이 모듈의 계약이다.
    expect(notFoundMock).not.toHaveBeenCalled()
  })

  it("5xx 여도 throw 하지 않고 null", async () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@story-arc.org")
    mockFetch(() => jsonResponse(500, {}))
    expect(await getAdminUserOrNull()).toBeNull()
  })

  it("네트워크 오류(fetch reject)여도 null", async () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@story-arc.org")
    mockFetch(() => Promise.reject(new Error("network down")))
    expect(await getAdminUserOrNull()).toBeNull()
  })

  it("응답에 data 래퍼가 없어도(방어 파싱) null", async () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@story-arc.org")
    mockFetch(() => jsonResponse(200, {}))
    expect(await getAdminUserOrNull()).toBeNull()
  })
})

describe("requireAdmin", () => {
  it("admin 이면 user 를 반환하고 notFound 를 호출하지 않는다", async () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@story-arc.org")
    mockFetch(() => jsonResponse(200, { data: makeUser("admin@story-arc.org") }))
    const user = await requireAdmin()
    expect(user.account.email).toBe("admin@story-arc.org")
    expect(notFoundMock).not.toHaveBeenCalled()
  })

  it("비-admin 이면 notFound() 로 중단한다", async () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@story-arc.org")
    mockFetch(() => jsonResponse(200, { data: makeUser("user@story-arc.org") }))
    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND")
    expect(notFoundMock).toHaveBeenCalledOnce()
  })

  it("비로그인(401)이면 notFound() 로 중단한다", async () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@story-arc.org")
    mockFetch(() => jsonResponse(401, {}))
    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND")
    expect(notFoundMock).toHaveBeenCalledOnce()
  })
})
