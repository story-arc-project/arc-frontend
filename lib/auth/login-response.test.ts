import { describe, expect, it } from "vitest"
import { needsOnboarding } from "@/lib/auth/login-response"

describe("needsOnboarding — 로그인 응답 방어 파싱(FRT-51)", () => {
  it("onboarded === true 이면 온보딩이 필요 없다", () => {
    expect(needsOnboarding({ data: { onboarded: true } })).toBe(false)
  })

  it("onboarded === false 이면 온보딩이 필요하다", () => {
    expect(needsOnboarding({ data: { onboarded: false } })).toBe(true)
  })

  it("data 키가 누락돼도 TypeError 없이 false 를 반환한다", () => {
    expect(() => needsOnboarding({})).not.toThrow()
    expect(needsOnboarding({})).toBe(false)
  })

  it("data 가 null 이어도 TypeError 없이 false 를 반환한다", () => {
    expect(() => needsOnboarding({ data: null })).not.toThrow()
    expect(needsOnboarding({ data: null })).toBe(false)
  })

  it("onboarded 가 undefined 면 /signup 위양성 리다이렉트를 막기 위해 false 를 반환한다", () => {
    expect(needsOnboarding({ data: {} })).toBe(false)
  })

  it("onboarded 가 불리언이 아니면(문자열 'false' 등) false 를 반환한다", () => {
    expect(needsOnboarding({ data: { onboarded: "false" } })).toBe(false)
    expect(needsOnboarding({ data: { onboarded: 0 } })).toBe(false)
    expect(needsOnboarding({ data: { onboarded: null } })).toBe(false)
  })

  it("body 가 null/undefined/비객체여도 안전하게 false 를 반환한다", () => {
    expect(needsOnboarding(null)).toBe(false)
    expect(needsOnboarding(undefined)).toBe(false)
    expect(needsOnboarding("ok")).toBe(false)
  })
})
