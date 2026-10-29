import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api-error";

vi.mock("./client", () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/lib/demo/state", () => ({ isDemoMode: vi.fn(() => false) }));
vi.mock("@/lib/demo/handlers", () => ({ getPresets: vi.fn(), getPreset: vi.fn(), createPreset: vi.fn(), updatePreset: vi.fn(), duplicatePreset: vi.fn(), deletePreset: vi.fn() }));
import { api } from "./client";
import { isDemoMode } from "@/lib/demo/state";
import * as demo from "@/lib/demo/handlers";
import { createPreset, deletePreset, duplicatePreset, getPreset, getPresets, updatePreset } from "./preset-api";

const dto = { id: "preset-1", name: "", description: null, blocks: [{ type: "future-widget", version: 99, nested: { data: [null, 1, "retained"] } }], is_favorite: false, created_at: "2026-10-26T00:00:00Z", updated_at: "2026-10-26T00:00:00Z", future: { retained: true } };
const envelope = (data: unknown) => ({ data });
const invalidResponses = [undefined, null, [], "oops", {}, { data: null }, { data: {} }, { data: { contents: null } }, { data: { contents: {} } }];
beforeEach(() => { vi.resetAllMocks(); vi.mocked(isDemoMode).mockReturnValue(false); });

describe("preset response boundaries", () => {
  it.each(invalidResponses)("rejects malformed list %j with typed error", async (response) => {
    vi.mocked(api.get).mockResolvedValue(response);
    await expect(getPresets()).rejects.toMatchObject({ name: "ApiError", code: "INVALID_RESPONSE" });
  });
  it("preserves normal empty and future data by reference", async () => {
    const contents = [dto];
    vi.mocked(api.get).mockResolvedValueOnce(envelope({ contents, count: 1 })).mockResolvedValueOnce(envelope({ contents: [], count: 0 }));
    expect(await getPresets()).toBe(contents);
    expect(await getPresets()).toEqual([]);
    expect(contents[0]).toBe(dto);
  });
  it.each([null, {}, { ...dto, name: null }, { ...dto, id: " " }, { ...dto, blocks: [null] }, { ...dto, blocks: [[]] }, { ...dto, blocks: ["text"] }, { ...dto, is_favorite: "false" }, { ...dto, created_at: null }, { ...dto, updated_at: 2 }, { ...dto, description: {} }, { ...dto, user_id: 2 }])("rejects malformed records atomically %j", async (bad) => {
    vi.mocked(api.get).mockResolvedValue(envelope({ contents: [dto, bad] }));
    await expect(getPresets()).rejects.toBeInstanceOf(ApiError);
  });
  for (const [name, run, mock] of [
    ["detail", () => getPreset("preset-1"), () => vi.mocked(api.get)],
    ["create", () => createPreset({ name: "new", blocks: [], isFavorite: true }), () => vi.mocked(api.post)],
    ["update", () => updatePreset("preset-1", { name: "new", isFavorite: true }), () => vi.mocked(api.put)],
  ] as const) {
    it.each([null, undefined, [], {}, { data: null }, { data: {} }])(`${name} rejects absent or invalid data %j`, async (response) => {
      mock().mockResolvedValue(response);
      await expect(run()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    });
    it(`${name} preserves valid DTO and rejects malformed response`, async () => {
      mock().mockResolvedValueOnce(envelope(dto)).mockResolvedValueOnce(envelope({ ...dto, blocks: null }));
      expect(await run()).toBe(dto);
      await expect(run()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    });
  }
  it("keeps existing mutation paths and payload mapping", async () => {
    vi.mocked(api.post).mockResolvedValue(envelope(dto));
    vi.mocked(api.put).mockResolvedValue(envelope(dto));
    await createPreset({ name: "new", blocks: [], isFavorite: true });
    await updatePreset("preset-1", { isFavorite: true });
    expect(api.post).toHaveBeenCalledWith("/presets/", { name: "new", blocks: [], is_favorite: true });
    expect(api.put).toHaveBeenCalledWith("/presets/preset-1", { is_favorite: true });
  });
  it.each([undefined, null, {}, { data: null }, { data: {} }, { data: { id: "" } }, { data: { id: " " } }, { data: { id: 1 } }])("duplicate never fabricates ID for %j", async (response) => {
    vi.mocked(api.post).mockResolvedValue(response);
    await expect(duplicatePreset("preset-1")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("returns duplicate ID unchanged", async () => {
    vi.mocked(api.post).mockResolvedValue(envelope({ id: "new-id" }));
    expect(await duplicatePreset("preset-1")).toBe("new-id");
  });
  it("retains transport errors and delete behavior", async () => {
    const error = new ApiError(503, "offline");
    vi.mocked(api.get).mockRejectedValue(error);
    await expect(getPresets()).rejects.toBe(error);
    vi.mocked(api.delete).mockResolvedValue(undefined);
    await deletePreset("preset-1");
    expect(api.delete).toHaveBeenCalledWith("/presets/preset-1");
  });
  it("keeps all demo branches independent of HTTP parsing", async () => {
    vi.mocked(isDemoMode).mockReturnValue(true);
    vi.mocked(demo.getPresets).mockResolvedValue([]);
    vi.mocked(demo.duplicatePreset).mockResolvedValue("demo-id");
    await getPresets(); await getPreset("demo-id"); await createPreset({ name: "demo", blocks: [] }); await updatePreset("demo-id", { isFavorite: true }); await deletePreset("demo-id");
    expect(await duplicatePreset("demo-id")).toBe("demo-id");
    expect(demo.getPresets).toHaveBeenCalledOnce();
    expect(demo.getPreset).toHaveBeenCalledWith("demo-id");
    expect(demo.createPreset).toHaveBeenCalledWith({ name: "demo", blocks: [] });
    expect(demo.updatePreset).toHaveBeenCalledWith("demo-id", { is_favorite: true });
    expect(demo.deletePreset).toHaveBeenCalledWith("demo-id");
    expect(api.get).not.toHaveBeenCalled(); expect(api.post).not.toHaveBeenCalled(); expect(api.put).not.toHaveBeenCalled(); expect(api.delete).not.toHaveBeenCalled();
  });
});
