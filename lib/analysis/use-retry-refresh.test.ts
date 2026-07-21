import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useRetryRefresh } from "./use-retry-refresh";

afterEach(cleanup);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useRetryRefresh (FRT-108)", () => {
  it("재시도 전에는 아무 요청도 내지 않는다", () => {
    const reload = vi.fn();
    renderHook(() => useRetryRefresh(reload));

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(reload).not.toHaveBeenCalled();
  });

  it("재시도를 접수하면 5초 간격으로 목록을 다시 읽는다", () => {
    const reload = vi.fn();
    const { result } = renderHook(() => useRetryRefresh(reload));

    act(() => result.current());

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(reload).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(reload).toHaveBeenCalledTimes(3);
  });

  it("60초(12회)에서 멈춘다 — 무한 폴링을 만들지 않는다", () => {
    const reload = vi.fn();
    const { result } = renderHook(() => useRetryRefresh(reload));

    act(() => result.current());
    act(() => {
      vi.advanceTimersByTime(10 * 60_000);
    });

    expect(reload).toHaveBeenCalledTimes(12);
  });

  it("다시 누르면 상한이 처음부터 다시 세어진다", () => {
    const reload = vi.fn();
    const { result } = renderHook(() => useRetryRefresh(reload));

    act(() => result.current());
    act(() => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(reload).toHaveBeenCalledTimes(12);

    act(() => result.current());
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(reload).toHaveBeenCalledTimes(13);
  });

  it("언마운트되면 타이머를 정리한다", () => {
    const reload = vi.fn();
    const { result, unmount } = renderHook(() => useRetryRefresh(reload));

    act(() => result.current());
    unmount();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(reload).not.toHaveBeenCalled();
  });

  it("최신 reload 를 호출한다 (stale closure 가드)", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ fn }) => useRetryRefresh(fn), {
      initialProps: { fn: first },
    });

    act(() => result.current());
    rerender({ fn: second });

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
