import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, render, screen, cleanup, waitFor } from "@testing-library/react"
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
const { getFileUrl } = await import("@/lib/api/files-api")

afterEach(cleanup)
beforeEach(() => {
  vi.mocked(capture).mockClear()
  vi.mocked(getFileUrl).mockClear()
  vi.mocked(getFileUrl).mockResolvedValue({ url: "https://files.example/dl", expiresAt: undefined })
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

  // 업로드는 네트워크라 오래 걸린다. 그 사이 사용자가 다른 칸을 고치면 부모의 값이 바뀌는데,
  // 업로드를 시작할 때 붙잡아 둔 콜백은 그 이전의 행 전체를 품고 있다 — 그걸로 커밋하면
  // 그동안 친 글자와 다른 첨부가 통째로 되감긴다.
  it("업로드가 끝나면 최신 onChange 로 커밋한다 — 그 사이의 수정을 되감지 않는다", async () => {
    const user = userEvent.setup()
    const stale = vi.fn()
    const fresh = vi.fn()
    let finish: (v: UploadedFile) => void = () => {}
    start.mockImplementation(
      () =>
        new Promise<UploadedFile | null>(resolve => {
          finish = resolve
        }),
    )

    const { container, rerender } = render(<FileCellInput value={undefined} onChange={stale} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, new File(["x"], "결과보고서.pdf", { type: "application/pdf" }))
    await waitFor(() => expect(start).toHaveBeenCalled())

    // 업로드가 도는 동안 부모가 다시 그려진다(다른 셀 수정 등).
    rerender(<FileCellInput value={undefined} onChange={fresh} />)
    finish(uploaded)

    await waitFor(() => expect(fresh).toHaveBeenCalled())
    expect(stale).not.toHaveBeenCalled()
  })

  // presigned URL 은 만료된다. 입력 폼은 오래 열어두는 화면이라, 한 번 받고 마는 동안
  // 카드의 다운로드가 조용히 죽는다 — 링크 조회는 성공했으니 실패 안내도 뜨지 않는다.
  // 가짜 타이머 아래에서는 `waitFor` 의 폴링도 함께 멈춘다 — 시간을 직접 밀어 대기를 대신한다.
  it("만료 시각을 주면 그 전에 링크를 다시 받아온다", async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(getFileUrl)
        .mockResolvedValueOnce({
          url: "https://files.example/dl",
          expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        })
        // 두 번째 응답엔 만료 시각이 없어 더는 예약하지 않는다(호출 수를 못 박기 위해서다).
        .mockResolvedValue({ url: "https://files.example/dl-2", expiresAt: undefined })

      render(<FileCellInput value={filled} onChange={() => {}} />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(getFileUrl).toHaveBeenCalledTimes(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60_000)
      })

      expect(getFileUrl).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  // 실계약(`pickUrl`)은 `data` 가 presigned URL 문자열 그 자체라 **만료 시각을 주지 않는다**.
  // 만료 시각이 있을 때만 갱신하면 프로덕션에서는 한 번도 갱신되지 않는다.
  it("만료 시각을 안 줘도 주기적으로 다시 받아온다", async () => {
    vi.useFakeTimers()
    try {
      render(<FileCellInput value={filled} onChange={() => {}} />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(getFileUrl).toHaveBeenCalledTimes(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60_000)
      })

      expect(getFileUrl).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it("첨부가 없으면 갱신도 걸지 않는다 — 빈 셀이 네트워크를 두드리지 않는다", async () => {
    vi.useFakeTimers()
    try {
      render(<FileCellInput value={undefined} onChange={() => {}} />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30 * 60_000)
      })

      expect(getFileUrl).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  // 다운로드 링크는 만료되므로 표시 시점에 받아온다 — 그 호출이 실패하면 파일명만 남고
  // 다운로드 수단이 사라진다. 조용히 삼키면 사용자는 화면을 다시 열기 전엔 손쓸 방법이 없다.
  it("다운로드 링크를 못 받으면 알리고 다시 시도할 수 있다", async () => {
    const user = userEvent.setup()
    vi.mocked(getFileUrl).mockRejectedValueOnce(new Error("network"))
    render(<FileCellInput value={filled} onChange={() => {}} />)

    const retry = await screen.findByRole("button", { name: "다운로드 링크 다시 시도" })
    expect(screen.getByText("결과보고서.pdf")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /다운로드/ })).toBeNull()

    await user.click(retry)

    expect(await screen.findByRole("link", { name: /다운로드/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "다운로드 링크 다시 시도" })).toBeNull()
  })

  it("조회 화면에서도 링크 실패를 알린다", async () => {
    vi.mocked(getFileUrl).mockRejectedValueOnce(new Error("network"))
    render(<FileCellInput value={filled} readOnly onChange={() => {}} />)

    expect(await screen.findByRole("button", { name: "다운로드 링크 다시 시도" })).toBeInTheDocument()
  })

  // 표에 파일 컬럼이 여러 개면 버튼이 전부 '파일 선택'으로만 읽힌다 — 어느 칸인지 알 수 없다.
  it("컬럼 이름이 보이는 버튼의 접근성 이름에 반영된다", () => {
    render(<FileCellInput value={undefined} ariaLabel="결과물" onChange={() => {}} />)

    expect(screen.getByRole("button", { name: /결과물/ })).toBeInTheDocument()
  })
})
