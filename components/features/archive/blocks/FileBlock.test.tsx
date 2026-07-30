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

  it("업로드가 끝나기 전에 블록이 사라지면 발화하지 않는다", async () => {
    // useFileUpload 는 언마운트 뒤 완료된 업로드도 결과를 그대로 돌려준다.
    // 그 결과는 폼에 반영되지 않으므로 첨부로 세면 유령 집계가 된다.
    let finishUpload: (value: UploadedFile | null) => void = () => {}
    start.mockReturnValue(
      new Promise<UploadedFile | null>((resolve) => {
        finishUpload = resolve
      }),
    )
    const view = render(<FileBlock block={emptyFileBlock} onChange={vi.fn()} />)
    await selectFile()
    await waitFor(() => expect(start).toHaveBeenCalled())

    view.unmount()
    finishUpload(uploaded)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(capture).not.toHaveBeenCalled()
  })
})

describe("FileBlock 증빙 유형 (FRT-179)", () => {
  it("템플릿이 선택지를 주면 드롭다운으로 좁힌다", async () => {
    const onChange = vi.fn()
    render(
      <FileBlock
        block={{
          ...emptyFileBlock,
          options: ["합격증/자격증 사본", "성적표/점수 확인서", "기타"],
        }}
        onChange={onChange}
      />,
    )
    const select = screen.getByLabelText("증빙 유형")
    expect(select.tagName).toBe("SELECT")
    // 빈 선택 + 선택지 3종
    expect(screen.getAllByRole("option")).toHaveLength(4)

    await userEvent.selectOptions(select, "성적표/점수 확인서")
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ evidenceType: "성적표/점수 확인서" }),
    )
  })

  it("선택지에 없는 기존 값도 목록에 남겨 선택 상태를 지킨다", () => {
    // 자유 입력이던 시절 저장된 값이 드롭다운 도입 후 사라진 것처럼 보이면 안 된다.
    render(
      <FileBlock
        block={{
          ...emptyFileBlock,
          value: { type: "file", fileName: "", description: "", evidenceType: "상장 사본" },
          options: ["합격증/자격증 사본", "성적표/점수 확인서", "기타"],
        }}
        onChange={vi.fn()}
      />,
    )
    const select = screen.getByLabelText("증빙 유형") as HTMLSelectElement
    expect(select.value).toBe("상장 사본")
    // 빈 선택 + 선택지 3종 + 레거시 값 1종
    expect(screen.getAllByRole("option")).toHaveLength(5)
  })

  it("선택지가 없으면 기존 자유 입력을 유지한다", () => {
    render(<FileBlock block={emptyFileBlock} onChange={vi.fn()} />)
    expect(screen.queryByLabelText("증빙 유형")).toBeNull()
    expect(screen.getByPlaceholderText("증빙 유형 (성적표/상장 등)")).toBeTruthy()
  })
})
