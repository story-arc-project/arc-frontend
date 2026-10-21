import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { useRequestAttempt } from "./useRequestAttempt";

describe("useRequestAttempt", () => {
  it("snapshots input and preserves a key across response loss and ambiguous failures", () => {
    const { result } = renderHook(() => useRequestAttempt<{ ids: string[] }>());
    const payload = { ids: ["a"] };
    const first = result.current.begin(payload);
    payload.ids.push("mutated");
    expect(first.payload.ids).toEqual(["a"]);
    for (const error of [new TypeError("network"), new ApiError(500, "failed"), new ApiError(400, "queued"), new ApiError(200, "invalid body")]) {
      result.current.reject(first.key, error);
      expect(result.current.begin({ ids: ["a"] }).key).toBe(first.key);
    }
    expect(result.current.begin({ ids: ["b"] }).key).not.toBe(first.key);
  });
  it("rotates on confirmed rejection or a new operation", () => {
    const { result } = renderHook(() => useRequestAttempt<string>());
    const first = result.current.begin("analysis-a");
    result.current.reject(first.key, new ApiError(422, "invalid"));
    const second = result.current.begin("analysis-a");
    expect(second.key).not.toBe(first.key);
    result.current.reset();
    expect(result.current.begin("analysis-a").key).not.toBe(second.key);
  });
});
