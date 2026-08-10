import { describe, it, expect, vi } from "vitest"
import type { KeyboardEvent } from "react"

import { isImeComposing, onEnterCommit } from "./keyboard"

/**
 * FRT-172 — IME(한글) 조합 중 Enter 가 값을 커밋하지 않아야 한다.
 *
 * 판정을 이 유틸 한 곳에 모았으므로, 입력칸별 회귀는 대표 컴포넌트 두 곳에서만 실물로 증명하고
 * (ExperienceFormV2 태그 입력 · SingleSelectBlock 옵션 이름 편집) 나머지는 이 단위 테스트가 덮는다.
 */

/**
 * React KeyboardEvent 중 판정에 쓰이는 부분만 흉내 낸다.
 *
 * `keyCode` 기본값 13 은 조합과 무관한 평범한 Enter 다. WebKit 만 조합 확정 Enter 를
 * 229 로 보낸다(아래 describe 참고).
 */
function keyEvent(key: string, isComposing: boolean, preventDefault = vi.fn(), keyCode = 13) {
  return {
    key,
    preventDefault,
    nativeEvent: { isComposing, keyCode },
  } as unknown as KeyboardEvent
}

describe("isImeComposing", () => {
  it("조합 중이면 true", () => {
    expect(isImeComposing(keyEvent("Enter", true))).toBe(true)
  })

  it("조합 중이 아니면 false", () => {
    expect(isImeComposing(keyEvent("Enter", false))).toBe(false)
  })

  it("WebKit 처럼 isComposing 이 false 여도 keyCode 229 면 조합으로 본다", () => {
    expect(isImeComposing(keyEvent("Enter", false, vi.fn(), 229))).toBe(true)
  })
})

describe("onEnterCommit", () => {
  it("조합 중 Enter 는 커밋하지 않고 기본 동작도 막지 않는다", () => {
    const commit = vi.fn()
    const preventDefault = vi.fn()
    onEnterCommit(commit)(keyEvent("Enter", true, preventDefault))
    expect(commit).not.toHaveBeenCalled()
    expect(preventDefault).not.toHaveBeenCalled()
  })

  it("조합이 끝난 Enter 는 커밋하고 기본 동작(form submit)을 막는다", () => {
    const commit = vi.fn()
    const preventDefault = vi.fn()
    onEnterCommit(commit)(keyEvent("Enter", false, preventDefault))
    expect(commit).toHaveBeenCalledTimes(1)
    expect(preventDefault).toHaveBeenCalledTimes(1)
  })

  it("WebKit 의 조합 확정 Enter(isComposing false + keyCode 229)도 커밋하지 않는다", () => {
    const commit = vi.fn()
    const preventDefault = vi.fn()
    onEnterCommit(commit)(keyEvent("Enter", false, preventDefault, 229))
    expect(commit).not.toHaveBeenCalled()
    expect(preventDefault).not.toHaveBeenCalled()
  })

  it("Enter 가 아닌 키는 커밋하지 않고 기본 동작도 막지 않는다", () => {
    // 기존 핸들러들은 Enter 이외의 키에서 preventDefault 를 부르지 않았다. 문자 입력이 막히면 안 된다.
    const commit = vi.fn()
    const preventDefault = vi.fn()
    onEnterCommit(commit)(keyEvent("a", false, preventDefault))
    expect(commit).not.toHaveBeenCalled()
    expect(preventDefault).not.toHaveBeenCalled()
  })
})
