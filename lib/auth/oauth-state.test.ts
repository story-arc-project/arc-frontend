import { afterEach, describe, expect, it } from "vitest"
import { createOAuthState, readOAuthState, clearOAuthState } from "@/lib/auth/oauth-state"

afterEach(() => {
  clearOAuthState()
})

describe("createOAuthState — 의도 바인딩(state 접두사)", () => {
  it("prefix 없이 생성하면 일반 토큰을 저장하고 읽어온다", () => {
    const state = createOAuthState()
    expect(state).not.toContain(":")
    expect(readOAuthState()).toBe(state)
  })

  it("prefix 를 주면 `prefix:token` 형태로 저장한다", () => {
    const state = createOAuthState("delete")
    expect(state.startsWith("delete:")).toBe(true)
    expect(readOAuthState()).toBe(state)
  })

  it("일반 state 는 delete 접두사를 갖지 않는다(누수 방지의 핵심)", () => {
    const state = createOAuthState()
    expect(state.startsWith("delete:")).toBe(false)
  })

  it("clear 후에는 null 이다", () => {
    createOAuthState("delete")
    clearOAuthState()
    expect(readOAuthState()).toBeNull()
  })
})
