import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError, api } from "@/lib/api/client"

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
  // client.ts 는 window.location.href 만 참조한다. 쓰기 가능한 stub 으로 교체해
  // 로그인 리다이렉트 발생 여부를 검증한다.
  Object.defineProperty(window, "location", {
    value: { href: "" },
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("api 기본 응답 처리", () => {
  it("2xx 응답 본문(JSON 봉투)을 그대로 반환한다", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: "success", data: { id: "1" } }),
    )
    const res = await api.get<{ status: string; data: { id: string } }>("/x")
    expect(res).toEqual({ status: "success", data: { id: "1" } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("204 No Content 는 undefined 를 반환한다", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    const res = await api.delete<undefined>("/x")
    expect(res).toBeUndefined()
  })

  it("비-2xx 응답은 body 의 message/code 로 ApiError 를 던진다", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: "이미 있어요", code: "DUP" }, 409),
    )
    const err = await api.get("/x").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    if (!(err instanceof ApiError)) return
    expect(err.status).toBe(409)
    expect(err.message).toBe("이미 있어요")
    expect(err.code).toBe("DUP")
  })

  it("JSON 파싱 실패 시 INVALID_JSON ApiError 를 던진다", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<<not json>>", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    const err = await api.get("/x").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    if (!(err instanceof ApiError)) return
    expect(err.code).toBe("INVALID_JSON")
  })

  it("POST 는 body 를 JSON.stringify 하고 Content-Type 을 설정한다", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await api.post("/x", { a: 1 })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe("POST")
    expect(init.body).toBe(JSON.stringify({ a: 1 }))
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    )
  })
})

describe("401 → refresh 분기 (FRT-11 회귀 가드)", () => {
  it("refresh 성공 시 원요청을 1회 재시도해 성공시킨다", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // 원요청
      .mockResolvedValueOnce(new Response(null, { status: 200 })) // /auth/refresh
      .mockResolvedValueOnce(jsonResponse({ ok: true })) // 재시도
    const res = await api.get<{ ok: boolean }>("/x")
    expect(res).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][0]).toContain("/auth/refresh")
  })

  it("refresh 가 5xx(일시 장애)면 503 을 던지고 로그아웃 리다이렉트하지 않는다", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
    const err = await api.get("/x").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    if (!(err instanceof ApiError)) return
    expect(err.status).toBe(503)
    // 핵심: 유효 세션을 일시 장애로 끊지 않는다.
    expect(window.location.href).toBe("")
    expect(fetchMock).toHaveBeenCalledTimes(2) // 재시도 없음
  })

  it("refresh 가 401(재인증 필요)이면 401 을 던지고 /login 으로 보낸다", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
    const err = await api.get("/x").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    if (!(err instanceof ApiError)) return
    expect(err.status).toBe(401)
    expect(window.location.href).toBe("/login")
  })

  it("auth:false 면 401 재인증이어도 리다이렉트하지 않는다", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
    const err = await api.get("/x", { auth: false }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    if (!(err instanceof ApiError)) return
    expect(err.status).toBe(401)
    expect(window.location.href).toBe("")
  })
})
