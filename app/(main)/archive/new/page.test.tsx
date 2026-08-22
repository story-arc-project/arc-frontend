import { StrictMode } from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react"

import ArchiveNewPage from "./page"

// FRT-113: 이 테스트가 지키는 계약은 하나다 — "새 기록 입력 진입 1회당 이벤트 1건".
// StrictMode 이중 마운트로 2건이 되면 퍼널의 진입 수가 부풀어 이탈률이 통째로 틀어진다.
// FRT-107: 이탈·진행 계측 훅은 자기 유닛 테스트(lib/analytics/use-archive-entry.test.ts)가
// 계약을 지킨다. 여기서는 **페이지가 그 훅을 제대로 쓰는가**만 본다 — 저장 순간에 진행
// 속성을 읽어 record_created 에 싣고, 이 진입을 이탈에서 빼는지.
const markSaved = vi.fn()
const progressProps = vi.fn(() => ({
  elapsed_seconds: 42,
  sections_done: 3,
  sections_total: 4,
  qualitative_fields_filled: ["detail.배운 점"],
}))
vi.mock("@/lib/analytics", () => ({
  capture: vi.fn(),
  markFirstRecordIfUnseen: vi.fn().mockResolvedValue(false),
  useArchiveEntryAnalytics: () => ({
    handleCompletionChange: vi.fn(),
    markSaved,
    progressProps,
  }),
}))
const { capture } = await import("@/lib/analytics")

vi.mock("@/lib/api/experience-api", () => ({
  createExperience: vi.fn().mockResolvedValue("exp-1"),
  getExperiences: vi.fn().mockResolvedValue({ count: 5, items: [] }),
}))

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
  default: ({ onSave }: { onSave: (exp: unknown) => void }) => (
    <button
      data-testid="save"
      onClick={() =>
        onSave({
          id: "",
          userId: "",
          typeId: "career",
          title: "테스트 경험",
          summary: "",
          status: "complete",
          tags: [],
          coreBlocks: [],
          extensionBlocks: [],
          customBlocks: [],
          hiddenKeys: [],
          createdAt: "",
          updatedAt: "",
        })
      }
    />
  ),
}))

afterEach(cleanup)
beforeEach(() => {
  vi.mocked(capture).mockClear()
  markSaved.mockClear()
  progressProps.mockClear()
})

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

describe("아카이브 저장 계측 — 끝낸 사람의 진행(FRT-107)", () => {
  it("record_created 에 이탈과 같은 축의 진행 속성을 싣는다", async () => {
    const { getByTestId } = render(<ArchiveNewPage />)
    fireEvent.click(getByTestId("save"))

    await waitFor(() =>
      expect(capture).toHaveBeenCalledWith("record_created", {
        experience_type: "career",
        status: "complete",
        elapsed_seconds: 42,
        sections_done: 3,
        sections_total: 4,
        qualitative_fields_filled: ["detail.배운 점"],
      }),
    )
  })

  it("저장한 진입은 이탈에서 뺀다", async () => {
    const { getByTestId } = render(<ArchiveNewPage />)
    fireEvent.click(getByTestId("save"))

    await waitFor(() => expect(markSaved).toHaveBeenCalledTimes(1))
  })
})
