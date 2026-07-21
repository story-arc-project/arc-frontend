import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import FileBlock from "./FileBlock"
import { uid } from "@/lib/utils/block-utils"
import type { Block } from "@/types/archive"
import type { UploadedFile } from "@/lib/api/files-api"

// FRT-113: 업로드 성공 시에만 첨부로 세는지 검증한다.
vi.mock("@/lib/analytics", () => ({ capture: vi.fn() }))
const { capture } = await import("@/lib/analytics")

const start = vi.fn<(file: File) => Promise<UploadedFile | null>>()
vi.mock("@/hooks/useFileUpload", () => ({
  useFileUpload: () => ({
    state: "idle" as const,
    progress: 0,
    error: null,
    start,
    cancel: vi.fn(),
    reset: vi.fn(),
  }),
}))

afterEach(cleanup)
beforeEach(() => {
  vi.mocked(capture).mockClear()
  start.mockReset()
})

const emptyFileBlock: Block = {
  id: uid(),
  type: "file",
  label: "증빙 파일",
  value: { type: "file", fileName: "", description: "", evidenceType: "" },
}

const uploaded: UploadedFile = {
  id: "file-1",
  originalName: "성적표.pdf",
  mimeType: "application/pdf",
  size: 1024,
  url: "https://files.example/file-1",
}

async function selectFile() {
  const input = screen.getByLabelText(/파일 선택/, { selector: "input[type=file]" })
  await userEvent.upload(input, new File(["x"], "성적표.pdf", { type: "application/pdf" }))
}

describe("FileBlock 파일 첨부 계측", () => {
  it("업로드가 성공하면 1회 발화한다", async () => {
    start.mockResolvedValue(uploaded)
    // onChange 를 no-op 으로 둬 fileId 가 주입되지 않게 한다(getFileUrl 실호출 방지).
    render(<FileBlock block={emptyFileBlock} onChange={vi.fn()} />)
    await selectFile()
    await waitFor(() => {
      expect(capture).toHaveBeenCalledWith("archive_attachment_added", {
        attachment_type: "file",
      })
    })
    expect(capture).toHaveBeenCalledTimes(1)
  })

  it("업로드가 실패·취소되면 발화하지 않는다", async () => {
    start.mockResolvedValue(null)
    render(<FileBlock block={emptyFileBlock} onChange={vi.fn()} />)
    await selectFile()
    await waitFor(() => expect(start).toHaveBeenCalled())
    expect(capture).not.toHaveBeenCalled()
  })
})
