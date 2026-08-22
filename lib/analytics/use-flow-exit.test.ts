import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useFlowExit } from "@/lib/analytics/use-flow-exit";

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

describe("useFlowExit — 완료하지 못하고 떠났는가(FRT-107)", () => {
  it("완료 표시 없이 언마운트하면 경과 초와 함께 1회 발화한다", () => {
    const onExit = vi.fn();
    const { unmount } = renderHook(() => useFlowExit({ active: true, onExit }));

    vi.advanceTimersByTime(12_000);
    unmount();
    settle();

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledWith(12);
  });

  it("markCompleted 후에는 언마운트해도 발화하지 않는다", () => {
    const onExit = vi.fn();
    const { result, unmount } = renderHook(() =>
      useFlowExit({ active: true, onExit }),
    );

    vi.advanceTimersByTime(3_000);
    act(() => result.current.markCompleted());
    unmount();
    settle();

    expect(onExit).not.toHaveBeenCalled();
  });

  it("markCompleted 후에는 pagehide 에서도 발화하지 않는다", () => {
    const onExit = vi.fn();
    const { result, unmount } = renderHook(() =>
      useFlowExit({ active: true, onExit }),
    );

    act(() => result.current.markCompleted());
    firePageHide();
    unmount();
    settle();

    expect(onExit).not.toHaveBeenCalled();
  });

  it("active 가 false 면 발화하지 않는다", () => {
    const onExit = vi.fn();
    const { unmount } = renderHook(() => useFlowExit({ active: false, onExit }));

    vi.advanceTimersByTime(5_000);
    unmount();
    settle();

    expect(onExit).not.toHaveBeenCalled();
  });

  it("탭 전환(hidden)은 이탈이 아니다 — 돌아와서 계속 쓸 수 있다", () => {
    const onExit = vi.fn();
    const { unmount } = renderHook(() => useFlowExit({ active: true, onExit }));

    vi.advanceTimersByTime(2_000);
    fireVisibilityChange("hidden");
    vi.advanceTimersByTime(0);

    expect(onExit).not.toHaveBeenCalled();

    fireVisibilityChange("visible");
    vi.advanceTimersByTime(3_000);
    unmount();
    settle();

    // 숨어 있던 시간도 폼 앞에 머문 시간으로 함께 센다(체류가 아니라 이탈까지의 소요다).
    expect(onExit).toHaveBeenCalledWith(5);
  });

  it("pagehide 에서 발화하고, 이후 언마운트에서 재발화하지 않는다", () => {
    const onExit = vi.fn();
    const { unmount } = renderHook(() => useFlowExit({ active: true, onExit }));

    vi.advanceTimersByTime(8_000);
    firePageHide();
    unmount();
    settle();

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledWith(8);
  });

  it("StrictMode 이중 마운트가 유령 이탈을 만들지 않는다", () => {
    const onExit = vi.fn();
    const { unmount } = renderHook(() => useFlowExit({ active: true, onExit }), {
      wrapper: StrictMode,
    });

    settle();
    expect(onExit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(6_000);
    unmount();
    settle();

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledWith(6);
  });

  it("elapsedSeconds 는 이탈 이벤트와 같은 시계를 준다 (완료자·포기자 비교 가능)", () => {
    const onExit = vi.fn();
    const { result, unmount } = renderHook(() =>
      useFlowExit({ active: true, onExit }),
    );

    vi.advanceTimersByTime(9_000);
    expect(result.current.elapsedSeconds()).toBe(9);

    // 완료로 끝난 흐름은 이탈로 세지 않지만, 소요시간은 같은 시계에서 읽힌다.
    act(() => result.current.markCompleted());
    unmount();
    settle();
    expect(onExit).not.toHaveBeenCalled();
  });

  it("시작 전에는 elapsedSeconds 가 0 이다", () => {
    const { result } = renderHook(() =>
      useFlowExit({ active: false, onExit: vi.fn() }),
    );
    vi.advanceTimersByTime(5_000);
    expect(result.current.elapsedSeconds()).toBe(0);
  });

  it("최신 콜백을 쓴다 — 이탈 스냅샷이 옛 값으로 굳지 않는다", () => {
    const seen: number[] = [];
    const { rerender, unmount } = renderHook(
      ({ progress }) =>
        useFlowExit({ active: true, onExit: () => seen.push(progress) }),
      { initialProps: { progress: 1 } },
    );

    rerender({ progress: 2 });
    rerender({ progress: 3 });
    unmount();
    settle();

    expect(seen).toEqual([3]);
  });
  // ── 리뷰(Codex P2)에서 드러난 것 ───────────────────────────────────────────────
  // active 는 false→true 로만 간다고 상정했지만, 온보딩은 스텝 state 하나라 「← 이전」으로
  // 흐름을 벗어나도 컴포넌트가 안 죽는다. 그때 예약된 발화를 취소해 버리면 진짜 이탈이
  // 통째로 사라진다 — 계측이 조용히 줄어드는 쪽으로 틀리는 종류다.
  it("흐름 밖으로 나가면(active true→false) 언마운트 없이도 이탈로 센다", () => {
    const onExit = vi.fn();
    const { rerender } = renderHook(
      ({ active }) => useFlowExit({ active, onExit }),
      { initialProps: { active: true } },
    );

    vi.advanceTimersByTime(9_000);
    rerender({ active: false });
    settle();

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledWith(9);
  });

  it("잠깐 꺼졌다 같은 틱에 다시 켜지면 이탈이 아니다 — 시계도 이어 쓴다", () => {
    const onExit = vi.fn();
    const { rerender, result } = renderHook(
      ({ active }) => useFlowExit({ active, onExit }),
      { initialProps: { active: true } },
    );

    vi.advanceTimersByTime(4_000);
    rerender({ active: false });
    rerender({ active: true });
    settle();

    expect(onExit).not.toHaveBeenCalled();
    expect(result.current.elapsedSeconds()).toBe(4);
  });

  it("흐름이 새로 시작되면 완료 표식이 풀린다 — 한 번 저장한 뒤 다음 흐름이 영영 안 잡히면 안 된다", () => {
    const onExit = vi.fn();
    const { rerender, result } = renderHook(
      ({ active }) => useFlowExit({ active, onExit }),
      { initialProps: { active: true } },
    );

    act(() => result.current.markCompleted());
    rerender({ active: false });
    settle();
    expect(onExit).not.toHaveBeenCalled(); // 완료했으므로 이탈 아님

    rerender({ active: true }); // 다음 기록
    vi.advanceTimersByTime(6_000);
    rerender({ active: false });
    settle();

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledWith(6);
  });
});
