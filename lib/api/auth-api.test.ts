import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/demo/state", () => ({
  isDemoMode: () => false,
  setDemoMode: () => {},
  DEMO_BASE_PATH: "/demo",
}))

vi.mock("@/lib/api/client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}))

import { api } from "@/lib/api/client"
import {
  deleteAccountWithPassword,
  deleteAccountWithSocial,
  requestPasswordReset,
  verifyResetCode,
  resetPassword,
} from "@/lib/api/auth-api"

const apiMock = vi.mocked(api)

beforeEach(() => {
  vi.resetAllMocks()
})

describe("deleteAccountWithPassword", () => {
  it("DELETE /auth/account/password 를 password 바디·auth:false 로 호출한다", async () => {
    apiMock.delete.mockResolvedValue(undefined)
    await deleteAccountWithPassword("pw123")
    expect(apiMock.delete).toHaveBeenCalledWith("/auth/account/password", {
      auth: false,
      body: JSON.stringify({ password: "pw123" }),
    })
  })
})

describe("deleteAccountWithSocial", () => {
  it("DELETE /auth/account/social 를 social 바디·auth:false 로 호출한다", async () => {
    apiMock.delete.mockResolvedValue(undefined)
    await deleteAccountWithSocial("code-abc")
    expect(apiMock.delete).toHaveBeenCalledWith("/auth/account/social", {
      auth: false,
      body: JSON.stringify({ social: "code-abc" }),
    })
  })
})

describe("requestPasswordReset", () => {
  it("POST /auth/forgot-password 를 email 바디·auth:false 로 호출한다", async () => {
    apiMock.post.mockResolvedValue(undefined)
    await requestPasswordReset("user@example.com")
    expect(apiMock.post).toHaveBeenCalledWith(
      "/auth/forgot-password",
      { email: "user@example.com" },
      { auth: false }
    )
  })
})

describe("verifyResetCode", () => {
  it("POST /auth/reset-password/verify 를 email·code 바디·auth:false 로 호출한다", async () => {
    apiMock.post.mockResolvedValue(undefined)
    await verifyResetCode("user@example.com", "123456")
    expect(apiMock.post).toHaveBeenCalledWith(
      "/auth/reset-password/verify",
      { email: "user@example.com", code: "123456" },
      { auth: false }
    )
  })
})

describe("resetPassword", () => {
  it("POST /auth/reset-password 를 email·code·newPassword 바디·auth:false 로 호출한다", async () => {
    apiMock.post.mockResolvedValue(undefined)
    await resetPassword("user@example.com", "123456", "newpw123")
    expect(apiMock.post).toHaveBeenCalledWith(
      "/auth/reset-password",
      { email: "user@example.com", code: "123456", newPassword: "newpw123" },
      { auth: false }
    )
  })
})
