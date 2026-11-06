import { afterEach, expect, it, vi } from "vitest"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"

vi.mock("@/lib/demo/state", () => ({ isDemoMode: () => false }))
vi.mock("@/lib/api/client", async () => ({
  api: { get: vi.fn() },
  ApiError: (await import("@/lib/api/api-error")).ApiError,
}))

import { api, ApiError } from "@/lib/api/client"
import { useExperiences } from "./useExperiences"

afterEach(cleanup)

it("retains the last valid list and exposes ApiError after malformed refetch", async () => {
  const contents = [{
    id: "exp-1", user_id: "user-1", type: "future", importance: null,
    content: { nested: { text: "keep" } }, created_at: "opaque", updated_at: "opaque",
  }]
  vi.mocked(api.get).mockResolvedValueOnce({ data: { count: 3, contents } })
    .mockResolvedValueOnce({ data: { count: 3, contents: [null] } })
  const { result } = renderHook(() => useExperiences())
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.experiences).toBe(contents)
  await act(async () => { await result.current.refetch() })
  expect(result.current.experiences).toBe(contents)
  expect(result.current.count).toBe(3)
  expect(result.current.isLoading).toBe(false)
  expect(result.current.error).toBeInstanceOf(ApiError)
  expect(result.current.error).toMatchObject({ status: 500, message: "경험 목록 응답 형식이 올바르지 않아요." })
})
