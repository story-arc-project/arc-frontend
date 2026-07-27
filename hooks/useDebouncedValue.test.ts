import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useDebouncedValue } from "./useDebouncedValue";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("초기값을 즉시 반환한다", () => {
    const { result } = renderHook(() => useDebouncedValue("a", 300));
    expect(result.current).toBe("a");
  });

  it("delay 경과 전에는 이전 값을 유지한다", () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebouncedValue(v, 300),
      { initialProps: { v: "a" } },
    );
    rerender({ v: "b" });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("a");
  });

  it("delay 경과 후 최신 값으로 갱신된다", () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebouncedValue(v, 300),
      { initialProps: { v: "a" } },
    );
    rerender({ v: "b" });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe("b");
  });

  it("연속 변경 시 마지막 값만 반영하고 중간값은 버린다(타이머 리셋)", () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebouncedValue(v, 300),
      { initialProps: { v: "a" } },
    );
    rerender({ v: "ab" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ v: "abc" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // 첫 변경으로부터 400ms 지났지만 마지막 변경으로부터는 200ms → 아직 미갱신.
    expect(result.current).toBe("a");
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("abc");
  });
});
