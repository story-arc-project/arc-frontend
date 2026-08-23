import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";

import { usePersistOnUnload } from "@/lib/export/use-persist-on-unload";

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 unmount 로 리스너 해제.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setVisibility("visible");
});

beforeEach(() => {
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

function firePageShow(persisted: boolean): void {
  window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted }));
}

describe("usePersistOnUnload — 언로드 시점에도 편집을 남긴다(FRT-329)", () => {
  it("pagehide 가 오면 reason='pagehide' 로 1회 부른다", () => {
    const onPersist = vi.fn();
    const { unmount } = renderHook(() =>
      usePersistOnUnload({ enabled: true, onPersist }),
    );

    firePageHide();

    expect(onPersist).toHaveBeenCalledTimes(1);
    expect(onPersist).toHaveBeenCalledWith("pagehide");
    unmount();
  });

  it("탭이 숨겨지면 reason='hidden' 으로 부르고, 다시 보일 때는 부르지 않는다", () => {
    const onPersist = vi.fn();
    const { unmount } = renderHook(() =>
      usePersistOnUnload({ enabled: true, onPersist }),
    );

    fireVisibilityChange("hidden");
    fireVisibilityChange("visible");

    expect(onPersist).toHaveBeenCalledTimes(1);
    expect(onPersist).toHaveBeenCalledWith("hidden");
    unmount();
  });

  it("enabled=false 면 어떤 신호에도 부르지 않는다", () => {
    const onPersist = vi.fn();
    const { unmount } = renderHook(() =>
      usePersistOnUnload({ enabled: false, onPersist }),
    );

    firePageHide();
    fireVisibilityChange("hidden");

    expect(onPersist).not.toHaveBeenCalled();
    unmount();
  });

  it("enabled 가 꺼지면 리스너가 풀려 더 이상 부르지 않는다", () => {
    const onPersist = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ enabled }) => usePersistOnUnload({ enabled, onPersist }),
      { initialProps: { enabled: true } },
    );

    rerender({ enabled: false });
    firePageHide();

    expect(onPersist).not.toHaveBeenCalled();
    unmount();
  });

  it("언마운트 뒤에는 부르지 않는다", () => {
    const onPersist = vi.fn();
    const { unmount } = renderHook(() =>
      usePersistOnUnload({ enabled: true, onPersist }),
    );

    unmount();
    firePageHide();

    expect(onPersist).not.toHaveBeenCalled();
  });

  // 리스너는 enabled 가 바뀔 때만 다시 걸린다. 그 사이 onPersist 가 바뀌어도(편집이 더
  // 진행돼 새 클로저가 만들어져도) 최신 것이 불려야 낡은 편집을 담지 않는다.
  it("onPersist 가 바뀌면 리스너를 다시 걸지 않아도 최신 콜백을 부른다", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ onPersist }) => usePersistOnUnload({ enabled: true, onPersist }),
      { initialProps: { onPersist: first } },
    );

    rerender({ onPersist: second });
    firePageHide();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("pagehide");
    unmount();
  });

  // beforeunload 는 bfcache 를 깨므로 저장 경로로 쓰지 않는다(lib/analytics/exit-signal.ts).
  it("beforeunload 에는 반응하지 않는다", () => {
    const onPersist = vi.fn();
    const { unmount } = renderHook(() =>
      usePersistOnUnload({ enabled: true, onPersist }),
    );

    window.dispatchEvent(new Event("beforeunload"));

    expect(onPersist).not.toHaveBeenCalled();
    unmount();
  });

  // Chrome·Safari 는 beforeunload 가 있어도 bfcache 에 넣는다 — pagehide 뒤에 같은 인스턴스가
  // 되살아날 수 있다. 호출부의 "한 이탈 한 번" 가드를 되돌릴 신호가 필요하다.
  it("bfcache 에서 되살아나면(pageshow.persisted) onRestore 를 부른다", () => {
    const onPersist = vi.fn();
    const onRestore = vi.fn();
    const { unmount } = renderHook(() =>
      usePersistOnUnload({ enabled: true, onPersist, onRestore }),
    );

    firePageHide();
    firePageShow(true);

    expect(onRestore).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("첫 진입의 pageshow(persisted=false) 에는 onRestore 를 부르지 않는다", () => {
    const onRestore = vi.fn();
    const { unmount } = renderHook(() =>
      usePersistOnUnload({ enabled: true, onPersist: vi.fn(), onRestore }),
    );

    firePageShow(false);

    expect(onRestore).not.toHaveBeenCalled();
    unmount();
  });
});
