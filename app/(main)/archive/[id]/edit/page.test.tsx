import { useEffect, useState, type ReactNode } from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import ArchiveEditPage from "./page"

const mocks = vi.hoisted(() => ({
  id: "A",
  experience: { id: "A", status: "saved", typeId: "project" },
  report: vi.fn(),
  push: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: mocks.id }),
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@/lib/utils/use-base-path", () => ({ useBasePath: () => "" }))
vi.mock("@/hooks/useExperience", () => ({
  useExperience: () => ({ experience: mocks.experience, error: null }),
}))
vi.mock("@/lib/utils/experience-mapper", () => ({
  toExperienceV2: (experience: unknown) => experience,
  toSavePayload: vi.fn(),
}))
vi.mock("@/lib/api/experience-api", () => ({ updateExperience: vi.fn() }))
vi.mock("@/lib/analytics", () => ({
  capture: vi.fn(),
  useArchiveEntryAnalytics: () => ({
    handleCompletionChange: mocks.report,
    markSaved: vi.fn(),
  }),
}))
vi.mock("@/app/(main)/archive/_components/InputViewShell", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("@/components/features/archive/ExperienceFormV2", () => ({
  default: function MockForm({ initialExperience, onCompletionChange }: {
    initialExperience: { id: string }
    onCompletionChange: (value: { recordId: string }) => void
  }) {
    // 실제 폼처럼 초기 데이터는 마운트 시에만 내부 state에 반영한다.
    const [recordId] = useState(initialExperience.id)
    useEffect(() => { onCompletionChange({ recordId }) }, [onCompletionChange, recordId])
    return <div data-testid="edit-form">{recordId}</div>
  },
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("archive edit record loading boundary", () => {
  it("hides stale A during B fetch and mounts B with its own completion snapshot", () => {
    mocks.id = "A"
    mocks.experience = { id: "A", status: "saved", typeId: "project" }
    const view = render(<ArchiveEditPage />)
    expect(screen.getByTestId("edit-form")).toHaveTextContent("A")
    expect(mocks.report).toHaveBeenLastCalledWith({ recordId: "A" })

    mocks.id = "B"
    view.rerender(<ArchiveEditPage />)
    expect(screen.queryByTestId("edit-form")).not.toBeInTheDocument()
    expect(screen.getByText("불러오는 중…")).toBeInTheDocument()
    expect(mocks.report).toHaveBeenCalledTimes(1)

    mocks.experience = { id: "B", status: "saved", typeId: "project" }
    view.rerender(<ArchiveEditPage />)
    expect(screen.getByTestId("edit-form")).toHaveTextContent("B")
    expect(mocks.report).toHaveBeenLastCalledWith({ recordId: "B" })
    expect(mocks.report).toHaveBeenCalledTimes(2)
  })
})
