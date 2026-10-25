import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor, act, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import FileBlock from "./FileBlock"
import { uid } from "@/lib/utils/block-utils"
import type { Block, FileBlockValue } from "@/types/archive"
import { getFileUrl } from "@/lib/api/files-api"
import type { UploadedFile } from "@/lib/api/files-api"

vi.mock("@/lib/api/files-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/files-api")>(),
  getFileUrl: vi.fn(),
}))

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

afterEach(() => { cleanup(); vi.useRealTimers() })
beforeEach(() => {
  vi.mocked(capture).mockClear()
  start.mockReset()
  vi.mocked(getFileUrl).mockReset().mockResolvedValue({ url: "https://files.example/fresh" })
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

const attachedBlock = (id = "A"): Block => ({
  ...emptyFileBlock,
  value: { type: "file", fileName: `${id}.pdf`, fileId: id, mimeType: "application/pdf",
    url: "https://files.example/stale", description: "", evidenceType: "" },
})
async function flush() { await act(async () => {}) }
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe("FileBlock URL lifecycle", () => {
  it.each([
    ["valid TTL", 600_000, 540_000],
    ["short TTL", 10_000, 30_000],
    ["past TTL", -1, 30_000],
    ["missing expiry", undefined, 300_000],
    ["invalid expiry", "invalid", 300_000],
  ])("refreshes %s with one bounded timer", async (_, ttl, delay) => {
    vi.useFakeTimers()
    const expiresAt = typeof ttl === "number" ? new Date(Date.now() + ttl).toISOString() : ttl
    vi.mocked(getFileUrl).mockResolvedValueOnce({ url: "https://files.example/first", expiresAt })
      .mockResolvedValue({ url: "https://files.example/second" })
    render(<FileBlock block={attachedBlock()} onChange={vi.fn()} />)
    await flush()
    expect(screen.getByRole("link").getAttribute("href")).toBe("https://files.example/first")
    await act(async () => { vi.advanceTimersByTime(delay - 1) })
    expect(screen.getByRole("link").getAttribute("href")).toBe("https://files.example/first")
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(screen.getByRole("link").getAttribute("href")).toBe("https://files.example/second")
    expect(vi.getTimerCount()).toBe(1)
  })

  it.each([false, true])("discards failed links and retries in readOnly=%s", async (readOnly) => {
    vi.useFakeTimers()
    vi.mocked(getFileUrl).mockResolvedValueOnce({ url: "https://files.example/first" })
      .mockRejectedValueOnce(new Error("secret signed URL"))
      .mockResolvedValue({ url: "https://files.example/recovered" })
    render(<FileBlock block={attachedBlock()} readOnly={readOnly} onChange={vi.fn()} />)
    await flush()
    await act(async () => { vi.advanceTimersByTime(300_000) })
    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.queryByText(/secret/)).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    fireEvent.click(screen.getByRole("button", { name: "다운로드 링크 다시 시도" }))
    await flush()
    expect(screen.getByRole("link").getAttribute("href")).toBe("https://files.example/recovered")
    expect(screen.queryByRole("button", { name: "다운로드 링크 다시 시도" })).toBeNull()
  })

  it.each(["resolve", "reject"])("ignores late A %s after switching to B", async (outcome) => {
    const pending = deferred<{ url: string }>()
    vi.mocked(getFileUrl).mockReturnValueOnce(pending.promise).mockResolvedValue({ url: "https://files.example/B" })
    const view = render(<FileBlock block={attachedBlock()} onChange={vi.fn()} />)
    view.rerender(<FileBlock block={attachedBlock("B")} onChange={vi.fn()} />)
    await flush()
    await act(async () => { if (outcome === "resolve") pending.resolve({ url: "https://files.example/A" }); else pending.reject(new Error("A failed")) })
    expect(screen.getByRole("link").getAttribute("href")).toBe("https://files.example/B")
    expect(screen.queryByRole("button", { name: "다운로드 링크 다시 시도" })).toBeNull()
  })

  it("isolates errors to their file ID", async () => {
    vi.mocked(getFileUrl).mockRejectedValueOnce(new Error("A failed")).mockResolvedValue({ url: "https://files.example/B" })
    const view = render(<FileBlock block={attachedBlock()} onChange={vi.fn()} />)
    await flush()
    view.rerender(<FileBlock block={attachedBlock("B")} onChange={vi.fn()} />)
    await flush()
    expect(screen.queryByText(/failed/)).toBeNull()
    expect(screen.queryByRole("button", { name: "다운로드 링크 다시 시도" })).toBeNull()
  })

  it.each(["delete", "unmount"])("invalidates pending refresh on %s", async (action) => {
    vi.useFakeTimers()
    const pending = deferred<{ url: string }>()
    vi.mocked(getFileUrl).mockResolvedValueOnce({ url: "https://files.example/first" }).mockReturnValueOnce(pending.promise)
    const view = render(<FileBlock block={attachedBlock()} onChange={vi.fn()} />)
    await flush()
    await act(async () => { vi.advanceTimersByTime(300_000) })
    if (action === "unmount") view.unmount()
    else fireEvent.click(screen.getByRole("button", { name: /삭제/ }))
    await act(async () => { pending.resolve({ url: "https://files.example/late" }) })
    expect(vi.getTimerCount()).toBe(0)
    expect(screen.queryByRole("link", { name: /열기/ })?.getAttribute("href")).not.toBe("https://files.example/late")
  })

  it("does not apply an upload to a replacement file", async () => {
    const pending = deferred<UploadedFile | null>()
    start.mockReturnValue(pending.promise)
    const onChange = vi.fn()
    const view = render(<FileBlock block={emptyFileBlock} onChange={onChange} />)
    await selectFile()
    view.rerender(<FileBlock block={attachedBlock("B")} onChange={onChange} />)
    await act(async () => { pending.resolve(uploaded) })
    expect(onChange).not.toHaveBeenCalled()
    expect(capture).not.toHaveBeenCalled()
    expect(screen.getByRole("link").getAttribute("href")).toBe("https://files.example/fresh")
  })

  it("keeps name-only demo rendering without fetching", async () => {
    render(<FileBlock block={{ ...emptyFileBlock, value: { type: "file", fileName: "demo.pdf", description: "", evidenceType: "" } }} readOnly onChange={vi.fn()} />)
    await flush()
    expect(screen.getByText("demo.pdf")).toBeTruthy()
    expect(screen.queryByRole("link")).toBeNull()
    expect(getFileUrl).not.toHaveBeenCalled()
  })

  it("uses latest fields and callback when upload finishes", async () => {
    const pending = deferred<UploadedFile | null>()
    start.mockReturnValue(pending.promise)
    const originalChange = vi.fn()
    const latestChange = vi.fn()
    const view = render(<FileBlock block={emptyFileBlock} onChange={originalChange} />)
    await selectFile()
    view.rerender(<FileBlock block={{ ...emptyFileBlock, value: { ...emptyFileBlock.value as FileBlockValue, description: "new", evidenceType: "updated" } }} onChange={latestChange} />)
    await act(async () => { pending.resolve(uploaded) })
    expect(originalChange).not.toHaveBeenCalled()
    expect(latestChange).toHaveBeenCalledWith(expect.objectContaining({ fileId: "file-1", description: "new", evidenceType: "updated" }))
  })
})
