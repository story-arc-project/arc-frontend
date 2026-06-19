import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useScrollspy } from "./useScrollspy";

afterEach(() => vi.unstubAllGlobals());

describe("useScrollspy", () => {
  it("IntersectionObserver 없으면 첫 id 를 반환", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { result } = renderHook(() => useScrollspy(["basic", "detail"]));
    expect(result.current).toBe("basic");
  });

  it("빈 ids 면 null", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { result } = renderHook(() => useScrollspy([]));
    expect(result.current).toBeNull();
  });
});
