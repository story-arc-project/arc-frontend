import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import FileCellInput from "./FileCellInput"
import type { FileCellValue } from "@/types/archive"
import type { UploadedFile } from "@/lib/api/files-api"

// FRT-113: 업로드가 확정된 시점에만 첨부로 세는지 검증한다.
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

// presigned URL 조회는 네트워크라 막는다 — 셀 렌더 자체가 이것에 의존하지 않아야 한다.
vi.mock("@/lib/api/files-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/files-api")>("@/lib/api/files-api")
  return { ...actual, getFileUrl: vi.fn(async () => ({ url: "https://files.example/dl", expiresAt: null })) }
})

afterEach(cleanup)
beforeEach(() => {
  vi.mocked(capture).mockClear()
  start.mockReset()
})

const uploaded: UploadedFile = {
  id: "file-1",
  originalName: "결과보고서.pdf",
  mimeType: "application/pdf",
  size: 2048,
  url: "https://files.example/file-1",
}

const filled: FileCellValue = {
  type: "file",
  fileId: "file-1",
  fileName: "결과보고서.pdf",
  mimeType: "application/pdf",
  size: 2048,
}

describe("FileCellInput (FRT-213)", () => {
  it("빈 셀에는 파일 선택 버튼이 나온다 — 텍스트칸이 아니다", () => {
    render(<FileCellInput value={undefined} onChange={() => {}} />)

    expect(screen.getByRole("button", { name: /파일 선택/ })).toBeInTheDocument()
    expect(screen.queryByRole("textbox")).toBeNull()
  })

  it("업로드가 끝나면 파일 식별자와 이름을 함께 저장한다", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    start.mockResolvedValue(uploaded)
    const { container } = render(<FileCellInput value={undefined} onChange={onChange} />)

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, new File(["x"], "결과보고서.pdf", { type: "application/pdf" }))

    await waitFor(() => expect(onChange).toHaveBeenCalled())
    // 파일명을 함께 저장하는 게 핵심이다 — 서버는 다운로드 URL만 주고 이름을 돌려주지 않는다.
    expect(onChange).toHaveBeenCalledWith({
      type: "file",
      fileId: "file-1",
      fileName: "결과보고서.pdf",
      mimeType: "application/pdf",
      size: 2048,
    })
  })

  it("업로드 성공 한 번에 첨부 계측도 한 번만 발화한다", async () => {
    const user = userEvent.setup()
    start.mockResolvedValue(uploaded)
    const { container } = render(<FileCellInput value={undefined} onChange={() => {}} />)

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, new File(["x"], "결과보고서.pdf", { type: "application/pdf" }))

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1))
    expect(capture).toHaveBeenCalledWith("archive_attachment_added", { attachment_type: "file" })
  })

  it("업로드가 실패하면 값도 계측도 남기지 않는다", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    start.mockResolvedValue(null)
    const { container } = render(<FileCellInput value={undefined} onChange={onChange} />)

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, new File(["x"], "결과보고서.pdf", { type: "application/pdf" }))

    await waitFor(() => expect(start).toHaveBeenCalled())
    expect(onChange).not.toHaveBeenCalled()
    expect(capture).not.toHaveBeenCalled()
  })

  it("첨부된 셀에는 파일명이 보이고 지울 수 있다", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<FileCellInput value={filled} onChange={onChange} />)

    expect(screen.getByText("결과보고서.pdf")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "첨부 삭제" }))
    expect(onChange).toHaveBeenCalledWith({ type: "file", fileId: "", fileName: "" })
  })

  it("조회 화면에서는 파일명만 보이고 삭제 버튼이 없다", () => {
    render(<FileCellInput value={filled} readOnly onChange={() => {}} />)

    expect(screen.getByText("결과보고서.pdf")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "첨부 삭제" })).toBeNull()
  })

  it("조회 화면에서 첨부가 없으면 빈 자리를 표시한다", () => {
    render(<FileCellInput value={undefined} readOnly onChange={() => {}} />)

    expect(screen.getByText("—")).toBeInTheDocument()
  })
})
