import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";

import { useDwell } from "@/lib/analytics/use-dwell";

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 unmount 로 리스너 해제.
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  setVisibility("visible");
});

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility("visible");
});

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

function fireVisibilityChange(state: DocumentVisibilityState): void {
  setVisibility(state);
  document.dispatchEvent(new Event("visibilitychange"));
}

function firePageHide(): void {
  window.dispatchEvent(new Event("pagehide"));
}

// 언마운트 발화는 StrictMode 이중 마운트를 걸러내려고 한 틱 미룬다 — 그 틱을 흘려보낸다.
function settle(): void {
  vi.advanceTimersByTime(0);
}

describe("useDwell — 화면을 처음 벗어나기까지 보인 시간(FRT-107)", () => {
  it("언마운트하면 경과 초를 1회 넘긴다", () => {
    const onLeave = vi.fn();
    const { unmount } = renderHook(() => useDwell({ active: true, onLeave }));

    vi.advanceTimersByTime(4_000);
    unmount();
    settle();

    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onLeave).toHaveBeenCalledWith(4);
  });

  it("active 가 한 번도 true 가 아니면 발화하지 않는다", () => {
    const onLeave = vi.fn();
    const { unmount } = renderHook(() => useDwell({ active: false, onLeave }));

    vi.advanceTimersByTime(9_000);
    unmount();
    settle();

    expect(onLeave).not.toHaveBeenCalled();
  });

  it("active 가 늦게 켜지면 그 시점부터 잰다 (로딩 시간은 체류가 아니다)", () => {
    const onLeave = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ active }) => useDwell({ active, onLeave }),
      { initialProps: { active: false } },
    );

    vi.advanceTimersByTime(10_000); // 로딩 중
    rerender({ active: true });
    vi.advanceTimersByTime(3_000); // 실제로 본 시간
    unmount();
    settle();

    expect(onLeave).toHaveBeenCalledWith(3);
  });

  it("탭이 숨겨지면 그 시점에 발화하고, 이후 언마운트에서 재발화하지 않는다", () => {
    const onLeave = vi.fn();
    const { unmount } = renderHook(() => useDwell({ active: true, onLeave }));

    vi.advanceTimersByTime(2_000);
    fireVisibilityChange("hidden");
    vi.advanceTimersByTime(60_000); // 백그라운드 시간은 체류가 아니다
    unmount();
    settle();

    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onLeave).toHaveBeenCalledWith(2);
  });

  it("pagehide 에서 발화하고, 이후 언마운트에서 재발화하지 않는다", () => {
    const onLeave = vi.fn();
    const { unmount } = renderHook(() => useDwell({ active: true, onLeave }));

    vi.advanceTimersByTime(5_000);
    firePageHide();
    unmount();
    settle();

    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onLeave).toHaveBeenCalledWith(5);
  });

  it("StrictMode 이중 마운트가 0초짜리 유령 체류를 만들지 않는다", () => {
    const onLeave = vi.fn();
    const { unmount } = renderHook(() => useDwell({ active: true, onLeave }), {
      wrapper: StrictMode,
    });

    settle(); // 모사된 언마운트의 미뤄진 발화가 취소됐는지
    expect(onLeave).not.toHaveBeenCalled();

    vi.advanceTimersByTime(7_000);
    unmount();
    settle();

    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onLeave).toHaveBeenCalledWith(7);
  });

  it("최신 콜백을 쓴다 (언마운트 클로저가 옛 값을 굳히지 않는다)", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ onLeave }) => useDwell({ active: true, onLeave }),
      { initialProps: { onLeave: first } },
    );

    rerender({ onLeave: second });
    unmount();
    settle();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
