import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/oauth-state", () => ({
  createOAuthState: vi.fn(() => "state-123"),
  setOAuthIntent: vi.fn(),
}))

import { createOAuthState, setOAuthIntent } from "@/lib/auth/oauth-state"
import {
  pickReauthProvider,
  startOAuthReauth,
  PROVIDER_LABELS,
  DELETE_INTENT,
} from "@/lib/auth/oauth-providers"

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "client-xyz")
  Object.defineProperty(window, "location", {
    value: { origin: "https://app.test", href: "" },
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("pickReauthProvider", () => {
  it("지원되는 provider 가 연결돼 있으면 반환한다", () => {
    expect(pickReauthProvider(["google"])).toBe("google")
  })
  it("빈 배열이면 null 이다", () => {
    expect(pickReauthProvider([])).toBeNull()
  })
  it("미지원 provider 만 있으면 null 이다", () => {
    expect(pickReauthProvider(["kakao"])).toBeNull()
  })
  it("지원/미지원 혼재 시 지원되는 첫 provider 를 반환한다", () => {
    expect(pickReauthProvider(["kakao", "google"])).toBe("google")
  })
})

describe("startOAuthReauth", () => {
  it("intent 를 설정하고 google authorize URL 로 리다이렉트한다", () => {
    const ok = startOAuthReauth("google")
    expect(ok).toBe(true)
    expect(setOAuthIntent).toHaveBeenCalledWith(DELETE_INTENT)
    expect(createOAuthState).toHaveBeenCalledTimes(1)
    expect(window.location.href).toContain("https://accounts.google.com/o/oauth2/v2/auth")
    expect(window.location.href).toContain("client_id=client-xyz")
    expect(window.location.href).toContain(
      `redirect_uri=${encodeURIComponent("https://app.test/callback/google")}`,
    )
    expect(window.location.href).toContain("state=state-123")
  })

  it("client_id 가 없으면 false 를 반환하고 리다이렉트하지 않는다", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "")
    const ok = startOAuthReauth("google")
    expect(ok).toBe(false)
    expect(window.location.href).toBe("")
    expect(setOAuthIntent).not.toHaveBeenCalled()
  })
})

describe("PROVIDER_LABELS", () => {
  it("google 라벨을 제공한다", () => {
    expect(PROVIDER_LABELS.google).toBe("Google")
  })
})
