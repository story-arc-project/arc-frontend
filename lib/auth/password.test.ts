import { describe, expect, it } from "vitest"

import { passwordChecks, isPasswordValid } from "@/lib/auth/password"

describe("passwordChecks", () => {
  it("빈 문자열은 세 규칙 모두 실패한다", () => {
    const checks = passwordChecks("")
    expect(checks.map((c) => c.pass)).toEqual([false, false, false])
  })

  it("8자 미만이면 '8자 이상'만 실패한다", () => {
    // 7자, 영문+숫자 충족
    const checks = passwordChecks("abcd123")
    const byLabel = Object.fromEntries(checks.map((c) => [c.label, c.pass]))
    expect(byLabel["8자 이상"]).toBe(false)
    expect(byLabel["영문 포함"]).toBe(true)
    expect(byLabel["숫자 포함"]).toBe(true)
  })

  it("정확히 8자면 길이 규칙을 통과한다(경계)", () => {
    expect(passwordChecks("abcd1234").find((c) => c.label === "8자 이상")?.pass).toBe(true)
  })

  it("영문이 없으면 '영문 포함'만 실패한다", () => {
    const byLabel = Object.fromEntries(passwordChecks("12345678").map((c) => [c.label, c.pass]))
    expect(byLabel["영문 포함"]).toBe(false)
    expect(byLabel["숫자 포함"]).toBe(true)
    expect(byLabel["8자 이상"]).toBe(true)
  })

  it("숫자가 없으면 '숫자 포함'만 실패한다", () => {
    const byLabel = Object.fromEntries(passwordChecks("abcdefgh").map((c) => [c.label, c.pass]))
    expect(byLabel["숫자 포함"]).toBe(false)
    expect(byLabel["영문 포함"]).toBe(true)
    expect(byLabel["8자 이상"]).toBe(true)
  })
})

describe("isPasswordValid", () => {
  it("영문+숫자 8자 이상이면 유효하다", () => {
    expect(isPasswordValid("abcd1234")).toBe(true)
  })

  it("규칙을 하나라도 어기면 무효하다", () => {
    expect(isPasswordValid("")).toBe(false)
    expect(isPasswordValid("abcd123")).toBe(false) // 7자
    expect(isPasswordValid("12345678")).toBe(false) // 영문 없음
    expect(isPasswordValid("abcdefgh")).toBe(false) // 숫자 없음
  })
})
