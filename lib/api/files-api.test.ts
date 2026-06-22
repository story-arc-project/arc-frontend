import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {
    code: string | undefined
    constructor(
      public readonly status: number,
      message: string,
      code?: string,
    ) {
      super(message)
      this.code = code
    }
  },
}))

import { api, ApiError } from "@/lib/api/client"
import {
  deleteFile,
  getFileUrl,
  uploadFile,
  validateFile,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/api/files-api"

const apiMock = vi.mocked(api)

interface FakeXhrConfig {
  status: number
  outcome: "load" | "error" | "none"
}

let xhrConfig: FakeXhrConfig
let lastXhr: FakeXhr | null = null

class FakeXhr {
  method = ""
  url = ""
  headers: Record<string, string> = {}
  withCredentials = false
  status = 0
  responseText = ""
  sentBody: unknown = null
  aborted = false
  upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }

  setRequestHeader(k: string, v: string) {
    this.headers[k] = v
  }

  send(body: unknown) {
    this.sentBody = body
    lastXhr = this // eslint-disable-line @typescript-eslint/no-this-alias
    queueMicrotask(() => {
      if (this.aborted) return
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: 50,
        total: 100,
      } as ProgressEvent)
      if (xhrConfig.outcome === "load") {
        this.status = xhrConfig.status
        this.onload?.()
      } else if (xhrConfig.outcome === "error") {
        this.onerror?.()
      }
    })
  }

  abort() {
    this.aborted = true
    this.onabort?.()
  }
}

function makeFile(name = "cert.pdf", type = "application/pdf", size = 1234): File {
  const f = new File([new Uint8Array(8)], name, { type })
  Object.defineProperty(f, "size", { value: size })
  return f
}

beforeEach(() => {
  vi.resetAllMocks()
  xhrConfig = { status: 200, outcome: "load" }
  lastXhr = null
  vi.stubGlobal("XMLHttpRequest", FakeXhr as unknown as typeof XMLHttpRequest)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("uploadFile — presign → PUT → confirm", () => {
  it("presign 에 {filename, content_type, size} 를 보낸다", async () => {
    apiMock.post.mockImplementation(async (path: string) => {
      if (path === "/files/presign") {
        return { data: { id: "file-1", upload_url: "https://store/put", expires_in: 600 } }
      }
      return {}
    })

    await uploadFile(makeFile("cert.pdf", "application/pdf", 1234))

    expect(apiMock.post).toHaveBeenCalledWith("/files/presign", {
      filename: "cert.pdf",
      content_type: "application/pdf",
      size: 1234,
    })
  })

  it("빈 content_type 은 application/octet-stream 으로 보낸다", async () => {
    apiMock.post.mockImplementation(async (path: string) => {
      if (path === "/files/presign") {
        return { data: { id: "f", upload_url: "https://store/put", expires_in: 1 } }
      }
      return {}
    })

    await uploadFile(makeFile("blob.bin", "", 10))

    expect(apiMock.post).toHaveBeenCalledWith("/files/presign", {
      filename: "blob.bin",
      content_type: "application/octet-stream",
      size: 10,
    })
  })

  it("발급된 upload_url 로 raw File 을 PUT 한다 (Content-Type 일치, 쿠키 미전송)", async () => {
    apiMock.post.mockImplementation(async (path: string) => {
      if (path === "/files/presign") {
        return { data: { id: "file-9", upload_url: "https://store/abc", expires_in: 600 } }
      }
      return {}
    })
    const file = makeFile("a.png", "image/png", 99)

    await uploadFile(file)

    expect(lastXhr).not.toBeNull()
    expect(lastXhr!.method).toBe("PUT")
    expect(lastXhr!.url).toBe("https://store/abc")
    expect(lastXhr!.headers["Content-Type"]).toBe("image/png")
    expect(lastXhr!.withCredentials).toBe(false)
    expect(lastXhr!.sentBody).toBe(file)
  })

  it("PUT 성공 후 /files/confirm 에 {id} 를 보내고 UploadedFile 을 반환한다", async () => {
    const calls: string[] = []
    apiMock.post.mockImplementation(async (path: string) => {
      calls.push(path)
      if (path === "/files/presign") {
        return { data: { id: "file-77", upload_url: "https://store/x", expires_in: 600 } }
      }
      return {}
    })

    const result = await uploadFile(makeFile("report.pdf", "application/pdf", 4096))

    expect(calls).toEqual(["/files/presign", "/files/confirm"])
    expect(apiMock.post).toHaveBeenCalledWith("/files/confirm", { id: "file-77" })
    expect(result).toEqual({
      id: "file-77",
      mimeType: "application/pdf",
      size: 4096,
      originalName: "report.pdf",
      url: undefined,
    })
  })

  it("PUT 가 비-2xx 면 ApiError 를 던지고 confirm 을 호출하지 않는다", async () => {
    xhrConfig = { status: 403, outcome: "load" }
    const calls: string[] = []
    apiMock.post.mockImplementation(async (path: string) => {
      calls.push(path)
      if (path === "/files/presign") {
        return { data: { id: "f", upload_url: "https://store/x", expires_in: 1 } }
      }
      return {}
    })

    await expect(uploadFile(makeFile())).rejects.toBeInstanceOf(ApiError)
    expect(calls).toEqual(["/files/presign"])
  })

  it("PUT 네트워크 오류면 ApiError 를 던진다", async () => {
    xhrConfig = { status: 0, outcome: "error" }
    apiMock.post.mockImplementation(async (path: string) => {
      if (path === "/files/presign") {
        return { data: { id: "f", upload_url: "https://store/x", expires_in: 1 } }
      }
      return {}
    })

    await expect(uploadFile(makeFile())).rejects.toBeInstanceOf(ApiError)
  })

  it("onProgress 로 업로드 진행률을 보고한다", async () => {
    apiMock.post.mockImplementation(async (path: string) => {
      if (path === "/files/presign") {
        return { data: { id: "f", upload_url: "https://store/x", expires_in: 1 } }
      }
      return {}
    })
    const onProgress = vi.fn()

    await uploadFile(makeFile(), { onProgress })

    expect(onProgress).toHaveBeenCalledWith(50)
  })

  it("이미 aborted 된 signal 이면 code:'aborted' ApiError", async () => {
    apiMock.post.mockImplementation(async (path: string) => {
      if (path === "/files/presign") {
        return { data: { id: "f", upload_url: "https://store/x", expires_in: 1 } }
      }
      return {}
    })
    const controller = new AbortController()
    controller.abort()

    await expect(
      uploadFile(makeFile(), { signal: controller.signal }),
    ).rejects.toMatchObject({ code: "aborted" })
  })

  it("용량 초과면 presign 을 호출하지 않는다", async () => {
    await expect(
      uploadFile(makeFile("big.pdf", "application/pdf", MAX_FILE_SIZE_BYTES + 1)),
    ).rejects.toBeInstanceOf(ApiError)
    expect(apiMock.post).not.toHaveBeenCalled()
  })

  it("비허용 MIME(font/woff2) 면 presign 을 호출하지 않는다", async () => {
    await expect(
      uploadFile(makeFile("x.woff2", "font/woff2", 10)),
    ).rejects.toBeInstanceOf(ApiError)
    expect(apiMock.post).not.toHaveBeenCalled()
  })
})

describe("getFileUrl", () => {
  it("GET /files/{id}/download 를 호출한다 (메타데이터 경로 아님)", async () => {
    apiMock.get.mockResolvedValue({ data: { url: "https://store/dl?sig=1" } })

    const info = await getFileUrl("file-5")

    expect(apiMock.get).toHaveBeenCalledWith("/files/file-5/download")
    expect(info.url).toBe("https://store/dl?sig=1")
  })

  it("봉투 없는 평탄 응답({url})도 허용한다", async () => {
    apiMock.get.mockResolvedValue({ url: "https://store/flat" })
    const info = await getFileUrl("f")
    expect(info.url).toBe("https://store/flat")
  })

  it("download_url 키도 허용한다", async () => {
    apiMock.get.mockResolvedValue({ data: { download_url: "https://store/dlk" } })
    const info = await getFileUrl("f")
    expect(info.url).toBe("https://store/dlk")
  })

  it("url 이 없으면 ApiError 를 던진다", async () => {
    apiMock.get.mockResolvedValue({ data: {} })
    await expect(getFileUrl("f")).rejects.toBeInstanceOf(ApiError)
  })
})

describe("deleteFile", () => {
  it("DELETE /files/{id} 를 호출한다", async () => {
    apiMock.delete.mockResolvedValue(undefined)
    await deleteFile("file-3")
    expect(apiMock.delete).toHaveBeenCalledWith("/files/file-3")
  })
})

describe("validateFile", () => {
  it("정상 파일은 null", () => {
    expect(validateFile(makeFile("a.pdf", "application/pdf", 100))).toBeNull()
  })
  it("용량 초과는 메시지", () => {
    expect(validateFile(makeFile("b.pdf", "application/pdf", MAX_FILE_SIZE_BYTES + 1))).toMatch(/MB/)
  })
})
