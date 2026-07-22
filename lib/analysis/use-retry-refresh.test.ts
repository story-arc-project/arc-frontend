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

// 갱신이 끝난 뒤 다음 차례를 예약하므로, 타이머 전진 사이에 microtask 를 흘려보내야 한다.
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useRetryRefresh (FRT-108)", () => {
  it("재시도 전에는 아무 요청도 내지 않는다", async () => {
    const reload = vi.fn();
    renderHook(() => useRetryRefresh(reload));

    await advance(60_000);

    expect(reload).not.toHaveBeenCalled();
  });

  it("재시도를 접수하면 5초 간격으로 목록을 다시 읽는다", async () => {
    const reload = vi.fn();
    const { result } = renderHook(() => useRetryRefresh(reload));

    act(() => result.current());

    await advance(5_000);
    expect(reload).toHaveBeenCalledTimes(1);

    await advance(10_000);
    expect(reload).toHaveBeenCalledTimes(3);
  });

  it("12회에서 멈춘다 — 무한 폴링을 만들지 않는다", async () => {
    const reload = vi.fn();
    const { result } = renderHook(() => useRetryRefresh(reload));

    act(() => result.current());
    await advance(10 * 60_000);

    expect(reload).toHaveBeenCalledTimes(12);
  });

  it("다시 누르면 상한이 처음부터 다시 세어진다", async () => {
    const reload = vi.fn();
    const { result } = renderHook(() => useRetryRefresh(reload));

    act(() => result.current());
    await advance(10 * 60_000);
    expect(reload).toHaveBeenCalledTimes(12);

    act(() => result.current());
    await advance(5_000);
    expect(reload).toHaveBeenCalledTimes(13);
  });

  it("언마운트되면 타이머를 정리한다", async () => {
    const reload = vi.fn();
    const { result, unmount } = renderHook(() => useRetryRefresh(reload));

    act(() => result.current());
    unmount();

    await advance(60_000);
    expect(reload).not.toHaveBeenCalled();
  });

  it("최신 reload 를 호출한다 (stale closure 가드)", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ fn }) => useRetryRefresh(fn), {
      initialProps: { fn: first },
    });

    act(() => result.current());
    rerender({ fn: second });

    await advance(5_000);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("이전 갱신이 끝나기 전에는 다음 요청을 내지 않는다 (응답 역전 방지)", async () => {
    let settle: (() => void) | undefined;
    const reload = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
    );
    const { result } = renderHook(() => useRetryRefresh(reload));

    act(() => result.current());

    // 목록 GET 이 5초보다 오래 걸리는 상황 — 20초가 지나도 요청은 1건뿐이어야 한다.
    await advance(20_000);
    expect(reload).toHaveBeenCalledTimes(1);

    await act(async () => {
      settle?.();
    });
    await advance(5_000);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("갱신이 실패해도 폴링을 멈추지 않는다", async () => {
    const reload = vi.fn(() => Promise.reject(new Error("network")));
    const { result } = renderHook(() => useRetryRefresh(reload));

    act(() => result.current());

    await advance(5_000);
    expect(reload).toHaveBeenCalledTimes(1);

    await advance(5_000);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
