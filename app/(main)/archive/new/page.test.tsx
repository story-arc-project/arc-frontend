import { StrictMode } from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, cleanup } from "@testing-library/react"

import ArchiveNewPage from "./page"

// FRT-113: 이 테스트가 지키는 계약은 하나다 — "새 기록 입력 진입 1회당 이벤트 1건".
// StrictMode 이중 마운트로 2건이 되면 퍼널의 진입 수가 부풀어 이탈률이 통째로 틀어진다.
vi.mock("@/lib/analytics", () => ({
  capture: vi.fn(),
  markFirstRecordIfUnseen: vi.fn().mockResolvedValue(false),
}))
const { capture } = await import("@/lib/analytics")

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/archive/new",
}))
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }))

// 폼·셸은 이 테스트의 관심사가 아니다(무거운 템플릿 로드를 피한다).
vi.mock("@/app/(main)/archive/_components/InputViewShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock("@/components/features/archive/ExperienceFormV2", () => ({
  default: () => <div data-testid="form" />,
}))

afterEach(cleanup)
beforeEach(() => vi.mocked(capture).mockClear())

describe("아카이브 새 기록 진입 계측", () => {
  it("진입 시 archive_entry_started 를 1회 발화한다", () => {
    render(<ArchiveNewPage />)
    expect(capture).toHaveBeenCalledTimes(1)
    expect(capture).toHaveBeenCalledWith("archive_entry_started", {})
  })

  it("StrictMode 이중 마운트에서도 1회만 발화한다", () => {
    render(
      <StrictMode>
        <ArchiveNewPage />
      </StrictMode>,
    )
    expect(capture).toHaveBeenCalledTimes(1)
  })
})
