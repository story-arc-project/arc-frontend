import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api/api-error";

vi.mock("@/lib/api/client", () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/lib/demo/state", () => ({ isDemoMode: () => false }));
import { api } from "@/lib/api/client";
import { usePresets } from "./usePresets";
const dto = { id: "p1", name: "Saved", blocks: [{ type: "future", opaque: { value: 42 } }], is_favorite: false, created_at: "2026-10-26T00:00:00Z", updated_at: "2026-10-26T00:00:00Z" };
const list = (contents: unknown[]) => ({ data: { contents } });
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it("preserves cached presets on malformed refetch and recovers on retry", async () => {
  vi.mocked(api.get).mockResolvedValueOnce(list([dto]));
  const { result } = renderHook(() => usePresets());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  const saved = result.current.presets;
  vi.mocked(api.get).mockResolvedValueOnce({ data: { contents: null } });
  await act(() => result.current.refetch());
  expect(result.current.error).toBeInstanceOf(ApiError);
  expect(result.current.presets).toBe(saved);
  expect(result.current.presets[0].blocks).toBe(dto.blocks);
  vi.mocked(api.get).mockResolvedValueOnce(list([{ ...dto, name: "Recovered" }]));
  await act(() => result.current.refetch());
  expect(result.current.error).toBeNull();
  expect(result.current.presets[0].name).toBe("Recovered");
});
it("does not append malformed created preset and keeps cache if reconciliation also fails", async () => {
  vi.mocked(api.get).mockResolvedValueOnce(list([dto])).mockResolvedValueOnce({ data: {} });
  vi.mocked(api.post).mockResolvedValue({ data: { id: "fake-success" } });
  const { result } = renderHook(() => usePresets());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await act(async () => { await expect(result.current.createPreset("New", [])).rejects.toBeInstanceOf(ApiError); });
  expect(result.current.presets.map(p => p.id)).toEqual(["p1"]);
});
it("rolls back malformed update without replacing saved blocks", async () => {
  vi.mocked(api.get).mockResolvedValueOnce(list([dto])).mockResolvedValue({ data: {} });
  let finishUpdate!: (value: unknown) => void;
  vi.mocked(api.put).mockReturnValue(new Promise(resolve => { finishUpdate = resolve; }));
  const { result } = renderHook(() => usePresets());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  let update!: Promise<void>;
  act(() => { update = result.current.updatePreset("p1", { name: "Changed" }); });
  expect(result.current.presets[0].name).toBe("Changed");
  await act(async () => {
    finishUpdate({ data: null });
    await expect(update).rejects.toBeInstanceOf(ApiError);
  });
  expect(result.current.presets[0].name).toBe("Saved");
  expect(result.current.presets[0].blocks).toBe(dto.blocks);
});
it("rejects invalid duplicate IDs before success reconciliation", async () => {
  vi.mocked(api.get).mockResolvedValue(list([dto]));
  vi.mocked(api.post).mockResolvedValue({ data: { id: "" } });
  const { result } = renderHook(() => usePresets());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await act(async () => { await expect(result.current.duplicatePreset("p1")).rejects.toBeInstanceOf(ApiError); });
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(result.current.presets[0].name).toBe("Saved");
});
