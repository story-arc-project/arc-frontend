import { useEffect, useState, type ReactNode } from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { capture } from "@/lib/analytics"
import { updateExperience } from "@/lib/api/experience-api"
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
  toSavePayload: () => ({ type: "project", content: { status: "complete" } }),
}))
vi.mock("@/lib/api/experience-api", () => ({ updateExperience: vi.fn() }))
vi.mock("@/lib/analytics", () => ({
  capture: vi.fn(),
  useArchiveEntryAnalytics: () => ({
    entryAttemptId: "attempt-edit",
    progressProps: () => ({ elapsed_seconds: 10, sections_done: 1, sections_total: 2, qualitative_fields_filled: [] }),
    handleCompletionChange: mocks.report,
    markSaved: vi.fn(),
  }),
}))
vi.mock("@/app/(main)/archive/_components/InputViewShell", () => ({
  default: ({ children, saving }: { children: ReactNode; saving: boolean }) => <div data-testid="shell" data-saving={String(saving)}>{children}</div>,
}))
vi.mock("@/components/features/archive/ExperienceFormV2", () => ({
  default: function MockForm({ initialExperience, onCompletionChange, onSave }: {
    onSave: (value: unknown) => void
    initialExperience: { id: string }
    onCompletionChange: (value: { recordId: string }) => void
  }) {
    // 실제 폼처럼 초기 데이터는 마운트 시에만 내부 state에 반영한다.
    const [recordId] = useState(initialExperience.id)
    useEffect(() => { onCompletionChange({ recordId }) }, [onCompletionChange, recordId])
    return <div data-testid="edit-form">{recordId}<button onClick={() => onSave({ status: "complete" })}>save</button></div>
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

it.each([ ["draft", "draft_to_complete"], ["complete", "complete_edit"] ])("observes %s edit with correct save kind", async (status, kind) => {
  mocks.id = "A"
  mocks.experience = { id: "A", status, typeId: "project" }
  vi.mocked(updateExperience).mockResolvedValue(undefined)
  render(<ArchiveEditPage />)
  fireEvent.click(screen.getByText("save"))
  await waitFor(() => expect(capture).toHaveBeenCalledWith("record_saved", expect.objectContaining({
    record_id: "A", entry_attempt_id: "attempt-edit", save_kind: kind, status: "complete",
  })))
})

it("does not carry a pending save into a reused edit route", async () => {
  mocks.id = "A"
  mocks.experience = { id: "A", status: "draft", typeId: "project" }
  let resolve!: () => void
  vi.mocked(updateExperience).mockReturnValue(new Promise<void>(r => { resolve = r }))
  const view = render(<ArchiveEditPage />)
  fireEvent.click(screen.getByText("save"))
  expect(screen.getByTestId("shell")).toHaveAttribute("data-saving", "true")
  mocks.id = "B"
  mocks.experience = { id: "B", status: "draft", typeId: "project" }
  view.rerender(<ArchiveEditPage />)
  expect(screen.getByTestId("shell")).toHaveAttribute("data-saving", "false")
  resolve()
  await new Promise(r => setTimeout(r, 0))
  expect(mocks.push).not.toHaveBeenCalled()
  expect(vi.mocked(capture).mock.calls.some(([event]) => event === "record_saved")).toBe(false)
})

it("releases a stale request lock before returning to its record", async () => {
  mocks.id = "A"
  mocks.experience = { id: "A", status: "draft", typeId: "project" }
  let resolve!: () => void
  vi.mocked(updateExperience).mockReturnValueOnce(new Promise<void>(r => { resolve = r })).mockResolvedValue(undefined)
  const view = render(<ArchiveEditPage />)
  fireEvent.click(screen.getByText("save"))
  mocks.id = "B"
  mocks.experience = { id: "B", status: "draft", typeId: "project" }
  view.rerender(<ArchiveEditPage />)
  resolve()
  await new Promise(r => setTimeout(r, 0))
  mocks.id = "A"
  mocks.experience = { id: "A", status: "draft", typeId: "project" }
  view.rerender(<ArchiveEditPage />)
  expect(screen.getByTestId("shell")).toHaveAttribute("data-saving", "false")
  fireEvent.click(screen.getByText("save"))
  await waitFor(() => expect(updateExperience).toHaveBeenCalledTimes(2))
})

it("rejects old A response after A to B to new A entry", async () => {
  mocks.id = "A"
  mocks.experience = { id: "A", status: "draft", typeId: "project" }
  let resolve!: () => void
  vi.mocked(updateExperience).mockReturnValueOnce(new Promise<void>(r => { resolve = r })).mockResolvedValue(undefined)
  const view = render(<ArchiveEditPage />)
  fireEvent.click(screen.getByText("save"))
  mocks.id = "B"
  mocks.experience = { id: "B", status: "draft", typeId: "project" }
  view.rerender(<ArchiveEditPage />)
  mocks.id = "A"
  mocks.experience = { id: "A", status: "draft", typeId: "project" }
  view.rerender(<ArchiveEditPage />)
  resolve()
  await new Promise(r => setTimeout(r, 0))
  expect(mocks.push).not.toHaveBeenCalled()
  expect(vi.mocked(capture).mock.calls.some(([event]) => event === "record_saved")).toBe(false)
  fireEvent.click(screen.getByText("save"))
  await waitFor(() => expect(updateExperience).toHaveBeenCalledTimes(2))
})
