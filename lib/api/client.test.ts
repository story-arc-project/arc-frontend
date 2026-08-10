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

/**
 * 백엔드(`arc-backend app/src/api/auth.py`)의 refresh 토큰 **회전 + 재사용 탐지**를 흉내낸다.
 *
 * - 회전 성공 시 옛 토큰에 `next` 를 기록한다 → 그 토큰이 다시 오면 재사용(=탈취)으로 본다.
 * - 재사용 응답은 403 인 동시에 `remove_tokens(response)` 로 **쿠키를 지운다**. 즉 먼저 성공한
 *   refresh 가 방금 심어 둔 새 쿠키까지 함께 사라져, 이후 재시도로는 복구할 수 없다.
 *
 * `detectReuse: false` 는 회전하지 않는 관대한 서버 — 중복 발사 자체만 세고 싶을 때 쓴다.
 */
function stubRotatingServer(opts: { detectReuse: boolean }) {
  const state = { accessValid: false, sessionAlive: true, refreshCalls: 0 }

  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes("/auth/refresh")) {
      state.refreshCalls += 1
      if (!state.sessionAlive) return new Response(null, { status: 401 })
      if (opts.detectReuse && state.refreshCalls > 1) {
        state.sessionAlive = false
        state.accessValid = false
        return new Response(null, { status: 403 })
      }
      state.accessValid = true
      return new Response(null, { status: 200 })
    }
    return state.accessValid
      ? jsonResponse({ ok: true })
      : new Response(null, { status: 401 })
  })

  return state
}

// 주의: client.ts 의 공유 refresh Promise 는 **모듈 스코프**라 이 파일의 테스트 전체가
// 한 슬롯을 나눠 쓴다. 완료 시 비워지므로(`finally`) 요청을 await 로 완결시키는 한 안전하지만,
// refresh 를 띄운 채 끝나는 테스트를 새로 넣으면 그 결과가 다음 테스트로 샌다.
describe("병렬 401 → refresh 단일화 (FRT-209/FRT-253)", () => {
  it("동시에 401 을 받은 요청들이 refresh 를 한 번만 보낸다", async () => {
    const state = stubRotatingServer({ detectReuse: false })

    await Promise.all([api.get("/a"), api.get("/b"), api.get("/c")])

    expect(state.refreshCalls).toBe(1)
  })

  it("회전하는 서버에서도 병렬 요청이 세션을 죽이지 않는다", async () => {
    // 신고된 버그 그 자체: 15분 자리를 비운 뒤 대시보드에 들어오면 GET 4개가 동시에 401 을
    // 받고, 각자 쏜 refresh 중 뒤의 것들이 403 + 쿠키 삭제를 부른다.
    const state = stubRotatingServer({ detectReuse: true })

    const results = await Promise.all([
      api.get<{ ok: boolean }>("/a"),
      api.get<{ ok: boolean }>("/b"),
      api.get<{ ok: boolean }>("/c"),
    ])

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }])
    expect(state.refreshCalls).toBe(1)
    expect(state.sessionAlive).toBe(true)
    // 핵심: 유효한 세션이 로그아웃되지 않는다.
    expect(window.location.href).toBe("")
  })

  it("refresh 가 401 이면 병렬 요청 전부가 같은 재인증 판정으로 수렴한다", async () => {
    // 실패 결과도 공유해야 한다 — 각자 다시 쏘면 그것이 곧 중복 발사다.
    const state = stubRotatingServer({ detectReuse: false })
    state.sessionAlive = false

    const errors = await Promise.all([
      api.get("/a").catch((e: unknown) => e),
      api.get("/b").catch((e: unknown) => e),
      api.get("/c").catch((e: unknown) => e),
    ])

    for (const err of errors) {
      expect(err).toBeInstanceOf(ApiError)
      if (err instanceof ApiError) expect(err.status).toBe(401)
    }
    expect(state.refreshCalls).toBe(1)
    expect(window.location.href).toBe("/login")
  })

  it("앞선 refresh 가 끝난 뒤 만료되면 새 refresh 를 다시 시작한다", async () => {
    // 거울상: 공유 Promise 가 완료된 채로 눌러앉으면 다음 만료 때 갱신이 영영 되지 않는다.
    const state = stubRotatingServer({ detectReuse: false })

    await api.get("/a")
    expect(state.refreshCalls).toBe(1)

    state.accessValid = false // 액세스 토큰이 다시 만료됨
    await api.get("/b")

    expect(state.refreshCalls).toBe(2)
  })
})

/**
 * 백엔드의 **액세스 토큰 검증**(`arc-backend app/src/utils/auth.py: check_auth`)까지 흉내낸다.
 *
 * 액세스 토큰은 자기를 발급한 refresh 토큰의 jti 를 품는다
 * (`utils/token.py: create_access_token(user_id, ref.jti)`). refresh 가 성공하면 옛 행에
 * `next` 가 박히므로 **그 액세스 토큰도 같은 순간 죽는다** — 이후 그 토큰을 실은 요청은
 * 401 이 아니라 **403 `AUTH_REUSE_DETECTED`** 로 거절된다. 유예 창은 없다.
 *
 * 위 `stubRotatingServer` 는 refresh 엔드포인트의 재사용 탐지만 모델링해 이 경로를 볼 수 없었고,
 * 그래서 "갱신 경계를 걸친 요청이 죽는다"는 결함이 FRT-253 의 그물을 그대로 통과했다.
 *
 * 두 403 을 반드시 구별해야 한다:
 * - `/auth/refresh` 의 403 은 `remove_tokens` 를 동반한다 → 쿠키가 사라져 복구 불가.
 * - `check_auth` 의 403 은 `remove_tokens` 를 부르지 않는다 → **쿠키가 살아 있어** 갱신 후
 *   다시 보내면 그대로 성공한다.
 */
function stubRotatedOutServer(script: Array<Response | "refresh-ok">) {
  const state = { refreshCalls: 0, dataCalls: 0 }
  const queue = [...script]

  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes("/auth/refresh")) {
      state.refreshCalls += 1
      return new Response(null, { status: 200 })
    }
    state.dataCalls += 1
    const next = queue.shift()
    if (next === undefined || next === "refresh-ok") return jsonResponse({ ok: true })
    return next
  })

  return state
}

function rotatedOut() {
  return jsonResponse({ message: "Login required.", code: "AUTH_REUSE_DETECTED" }, 403)
}

describe("갱신에 밀려난 요청 되살리기 (FRT-209 재발)", () => {
  it("403 AUTH_REUSE_DETECTED 를 받으면 갱신 후 다시 보내 성공시킨다", async () => {
    // 신고된 증상 그 자체: refresh 200 뒤에 individual 403 이 뜨고, 그 화면은
    // "경험 데이터를 불러오지 못했어요."로 끝났다. 쿠키는 살아 있으므로 되살릴 수 있다.
    const state = stubRotatedOutServer([rotatedOut()])

    const res = await api.get<{ ok: boolean }>("/individual")

    expect(res).toEqual({ ok: true })
    expect(state.refreshCalls).toBe(1)
    // 핵심: 유효한 세션이 에러 화면으로 끝나지 않는다.
    expect(window.location.href).toBe("")
  })

  it("AUTH_REVOKED 403 은 갱신하지 않고 그대로 던진다", async () => {
    // 진짜 폐기된 세션이다. 여기서 갱신을 시도하면 죽은 세션을 붙잡고 늘어지는 셈이고,
    // 되살릴 수도 없다 — 되살리기는 '회전에 밀려남'에만 적용한다.
    const state = stubRotatedOutServer([
      jsonResponse({ message: "Login required.", code: "AUTH_REVOKED" }, 403),
    ])

    const err = await api.get("/x").catch((e: unknown) => e)

    expect(err).toBeInstanceOf(ApiError)
    if (!(err instanceof ApiError)) return
    expect(err.status).toBe(403)
    expect(err.code).toBe("AUTH_REVOKED")
    expect(state.refreshCalls).toBe(0)
  })

  it("인증과 무관한 403 은 갱신하지 않고 그대로 던진다", async () => {
    const state = stubRotatedOutServer([
      jsonResponse({ message: "권한이 없어요", code: "FORBIDDEN" }, 403),
    ])

    const err = await api.get("/x").catch((e: unknown) => e)

    expect(err).toBeInstanceOf(ApiError)
    if (!(err instanceof ApiError)) return
    expect(err.status).toBe(403)
    expect(err.code).toBe("FORBIDDEN")
    expect(state.refreshCalls).toBe(0)
  })

  it("갱신해도 403 이 계속되면 무한히 재시도하지 않는다", async () => {
    // 거울상: 되살리기에 상한이 없으면 회전이 계속되는 서버에서 한 요청이 영원히 맴돈다.
    const state = stubRotatedOutServer([rotatedOut(), rotatedOut(), rotatedOut(), rotatedOut()])

    const err = await api.get("/x").catch((e: unknown) => e)

    expect(err).toBeInstanceOf(ApiError)
    if (!(err instanceof ApiError)) return
    expect(err.status).toBe(403)
    expect(state.dataCalls).toBeLessThanOrEqual(3)
  })

  it("갱신 직후 재시도가 다시 401 이어도 한 번 더 갱신해 되살린다", async () => {
    // 신고된 트레이스의 나머지 절반: refresh 200 뒤 재시도가 다시 401 을 받았고, 재시도
    // 예산이 1회뿐이라 그 요청들은 영구히 실패했다(화면에는 에러 카드만 남는다).
    // 실제로 두 번째 refresh 를 받은 요청 하나만 200 으로 돌아왔다.
    const state = stubRotatedOutServer([
      new Response(null, { status: 401 }),
      new Response(null, { status: 401 }),
    ])

    const res = await api.get<{ ok: boolean }>("/experiences")

    expect(res).toEqual({ ok: true })
    expect(state.refreshCalls).toBe(2)
    expect(window.location.href).toBe("")
  })

  it("동시에 쏜 요청 중 갱신 경계에 걸린 것도 함께 되살아난다", async () => {
    // 대시보드는 GET 을 한꺼번에 쏘고, 그중 몇 개가 갱신 경계의 어느 쪽에 떨어지는지는
    // 밀리초 타이밍이라 매번 다르다 — 신고자가 "될 때가 있고 안 될 때가 있다"고 한 이유다.
    // 어느 쪽에 떨어지든 결과는 같아야 한다.
    stubRotatedOutServer([
      rotatedOut(), // 갱신에 밀려난 요청
      jsonResponse({ ok: true }),
      rotatedOut(), // 또 하나
    ])

    const results = await Promise.all([
      api.get<{ ok: boolean }>("/individual"),
      api.get<{ ok: boolean }>("/keyword"),
      api.get<{ ok: boolean }>("/comprehensive"),
    ])

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }])
    expect(window.location.href).toBe("")
  })
})
