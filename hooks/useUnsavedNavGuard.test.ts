import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { renderHook, cleanup } from "@testing-library/react"
import useUnsavedNavGuard from "./useUnsavedNavGuard"

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 unmount 로 리스너 해제.
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

let pushSpy: ReturnType<typeof vi.spyOn>
let backSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  pushSpy = vi.spyOn(window.history, "pushState")
  backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {})
})

function firePopState() {
  window.dispatchEvent(new PopStateEvent("popstate"))
}

describe("useUnsavedNavGuard", () => {
  it("enabled 면 마운트 시 sentinel 을 1회 push(arm)한다", () => {
    renderHook(() =>
      useUnsavedNavGuard({ enabled: true, onAttemptLeave: vi.fn(), onLeave: vi.fn() }),
    )
    expect(pushSpy).toHaveBeenCalledTimes(1)
  })

  it("disabled 면 arm 하지 않고 Back(popstate)도 무시한다", () => {
    const onAttemptLeave = vi.fn()
    renderHook(() =>
      useUnsavedNavGuard({ enabled: false, onAttemptLeave, onLeave: vi.fn() }),
    )
    expect(pushSpy).not.toHaveBeenCalled()
    firePopState()
    expect(onAttemptLeave).not.toHaveBeenCalled()
  })

  it("Back(popstate) 시 onAttemptLeave 를 호출하고 sentinel 을 재-arm 한다", () => {
    const onAttemptLeave = vi.fn()
    renderHook(() =>
      useUnsavedNavGuard({ enabled: true, onAttemptLeave, onLeave: vi.fn() }),
    )
    pushSpy.mockClear()

    firePopState()

    expect(onAttemptLeave).toHaveBeenCalledTimes(1)
    expect(pushSpy).toHaveBeenCalledTimes(1) // 재-arm
  })

  it("confirmLeave() 는 history.back() 을 호출하고, 이후 popstate 에서 onLeave 만 호출한다", () => {
    const onAttemptLeave = vi.fn()
    const onLeave = vi.fn()
    const { result } = renderHook(() =>
      useUnsavedNavGuard({ enabled: true, onAttemptLeave, onLeave }),
    )

    result.current.confirmLeave()
    expect(backSpy).toHaveBeenCalledTimes(1)

    // back() 으로 sentinel 이 pop 되며 발화하는 popstate
    firePopState()
    expect(onLeave).toHaveBeenCalledTimes(1)
    expect(onAttemptLeave).not.toHaveBeenCalled() // bypass 분기라 모달 안 띄움
  })

  it("unmount 후 popstate 리스너가 해제된다", () => {
    const onAttemptLeave = vi.fn()
    const { unmount } = renderHook(() =>
      useUnsavedNavGuard({ enabled: true, onAttemptLeave, onLeave: vi.fn() }),
    )
    unmount()
    firePopState()
    expect(onAttemptLeave).not.toHaveBeenCalled()
  })
})
