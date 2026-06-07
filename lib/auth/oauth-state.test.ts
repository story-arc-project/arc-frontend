import { afterEach, describe, expect, it } from "vitest"
import { setOAuthIntent, readOAuthIntent, clearOAuthIntent } from "@/lib/auth/oauth-state"

afterEach(() => {
  document.cookie = "oauth_intent=; Path=/; Max-Age=0"
})

describe("oauth_intent 쿠키", () => {
  it("설정한 intent 를 읽어온다", () => {
    setOAuthIntent("delete")
    expect(readOAuthIntent()).toBe("delete")
  })

  it("설정 전에는 null 이다", () => {
    expect(readOAuthIntent()).toBeNull()
  })

  it("clear 후에는 null 이다", () => {
    setOAuthIntent("delete")
    clearOAuthIntent()
    expect(readOAuthIntent()).toBeNull()
  })
})
