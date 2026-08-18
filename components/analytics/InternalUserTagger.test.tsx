import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render } from "@testing-library/react"

const useIsAdminMock = vi.fn()
vi.mock("@/hooks/useIsAdmin", () => ({
  useIsAdmin: () => useIsAdminMock(),
}))

const markInternalUserMock = vi.fn()
vi.mock("@/lib/analytics", () => ({
  markInternalUser: () => markInternalUserMock(),
}))

import InternalUserTagger from "./InternalUserTagger"

beforeEach(() => {
  vi.clearAllMocks()
})

// Vitest globals:false 라 testing-library 자동 cleanup 이 등록되지 않는다.
afterEach(() => {
  cleanup()
})

describe("InternalUserTagger (FRT-139)", () => {
  it("팀 계정이면 내부 사용자 표식을 심는다", () => {
    useIsAdminMock.mockReturnValue(true)

    render(<InternalUserTagger />)

    expect(markInternalUserMock).toHaveBeenCalledTimes(1)
  })

  it("일반 사용자에게는 표식을 심지 않는다", () => {
    useIsAdminMock.mockReturnValue(false)

    render(<InternalUserTagger />)

    expect(markInternalUserMock).not.toHaveBeenCalled()
  })

  it("판정이 아직 안 끝난 동안(false)에는 심지 않다가, 팀원으로 확정되면 심는다", () => {
    // useIsAdmin 은 /api/admin/status 왕복 전까지 false 를 준다 — 그 사이 잘못 심으면
    // 일반 사용자가 내부 사용자로 표시된다.
    useIsAdminMock.mockReturnValue(false)
    const { rerender } = render(<InternalUserTagger />)
    expect(markInternalUserMock).not.toHaveBeenCalled()

    useIsAdminMock.mockReturnValue(true)
    rerender(<InternalUserTagger />)

    expect(markInternalUserMock).toHaveBeenCalledTimes(1)
  })

  it("화면에 아무것도 그리지 않는다", () => {
    useIsAdminMock.mockReturnValue(true)

    const { container } = render(<InternalUserTagger />)

    expect(container).toBeEmptyDOMElement()
  })
})
