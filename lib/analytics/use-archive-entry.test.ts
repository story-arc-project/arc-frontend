import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { capture } from "@/lib/analytics/client";
import { useArchiveEntryAnalytics } from "@/lib/analytics/use-archive-entry";
import type { FormCompletionSnapshot } from "@/lib/utils/form-cards";

vi.mock("@/lib/analytics/client", () => ({ capture: vi.fn() }));

const captureMock = vi.mocked(capture);

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 unmount 로 리스너 해제.
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

// 언마운트 발화는 StrictMode 를 걸러내려고 한 틱 미룬다 — 그 틱을 흘려보낸다.
function settle(): void {
  vi.advanceTimersByTime(0);
}

function snapshot(
  completed: string[],
  qualitative: string[] = [],
): FormCompletionSnapshot {
  return {
    sectionIds: ["basic", "detail", "repeat", "evidence"],
    completedSectionIds: completed,
    qualitativeFieldsFilled: qualitative,
  };
}

describe("useArchiveEntryAnalytics — 입력 폼 이탈·진행(FRT-107)", () => {
  it("저장 없이 떠나면 멈춘 자리를 실어 이탈을 알린다", () => {
    const { result, unmount } = renderHook(() =>
      useArchiveEntryAnalytics({ mode: "new", active: true }),
    );

    act(() =>
      result.current.handleCompletionChange(
        snapshot(["basic", "detail"], ["detail.배운 점"]),
      ),
    );
    vi.advanceTimersByTime(45_000);
    unmount();
    settle();

    expect(captureMock).toHaveBeenCalledWith(
      "archive_entry_abandoned",
      {
        mode: "new",
        last_section: "detail",
        sections_done: 2,
        sections_total: 4,
        elapsed_seconds: 45,
        qualitative_fields_filled: ["detail.배운 점"],
      },
      { atUnload: true },
    );
  });

  it("하나도 못 채우고 떠나면 last_section 이 null 이다 (시작도 못 했다는 답)", () => {
    const { result, unmount } = renderHook(() =>
      useArchiveEntryAnalytics({ mode: "new", active: true }),
    );

    act(() => result.current.handleCompletionChange(snapshot([])));
    unmount();
    settle();

    const call = captureMock.mock.calls.find(
      (c) => c[0] === "archive_entry_abandoned",
    );
    expect(call?.[1]).toMatchObject({ last_section: null, sections_done: 0 });
  });

  it("저장하면 이탈로 세지 않는다", () => {
    const { result, unmount } = renderHook(() =>
      useArchiveEntryAnalytics({ mode: "new", active: true }),
    );

    act(() => result.current.handleCompletionChange(snapshot(["basic"])));
    act(() => result.current.markSaved());
    unmount();
    settle();

    expect(
      captureMock.mock.calls.filter((c) => c[0] === "archive_entry_abandoned"),
    ).toHaveLength(0);
  });

  it("이탈 스냅샷은 마지막 진행을 쓴다 (옛 진행률이 굳지 않는다)", () => {
    const { result, unmount } = renderHook(() =>
      useArchiveEntryAnalytics({ mode: "edit", active: true }),
    );

    act(() => result.current.handleCompletionChange(snapshot(["basic"])));
    act(() =>
      result.current.handleCompletionChange(snapshot(["basic", "detail", "repeat"])),
    );
    unmount();
    settle();

    const call = captureMock.mock.calls.find(
      (c) => c[0] === "archive_entry_abandoned",
    );
    expect(call?.[1]).toMatchObject({
      mode: "edit",
      last_section: "repeat",
      sections_done: 3,
    });
  });

  it("섹션 완료는 새로 완료된 것만, 자리와 함께 알린다", () => {
    const { result } = renderHook(() =>
      useArchiveEntryAnalytics({ mode: "new", active: true }),
    );

    act(() => result.current.handleCompletionChange(snapshot(["basic"])));
    act(() => result.current.handleCompletionChange(snapshot(["basic", "repeat"])));

    const sectionCalls = captureMock.mock.calls.filter(
      (c) => c[0] === "archive_section_completed",
    );
    expect(sectionCalls).toHaveLength(2);
    expect(sectionCalls[0][1]).toEqual({
      section_key: "basic",
      section_index: 0,
      sections_done: 1,
      sections_total: 4,
    });
    // 순서를 건너뛰어 채운 자리 — sections_done 만으로는 안 보이는 사실이다.
    expect(sectionCalls[1][1]).toEqual({
      section_key: "repeat",
      section_index: 2,
      sections_done: 2,
      sections_total: 4,
    });
  });

  it("지웠다 다시 채운 섹션을 두 번 세지 않는다", () => {
    const { result } = renderHook(() =>
      useArchiveEntryAnalytics({ mode: "new", active: true }),
    );

    act(() => result.current.handleCompletionChange(snapshot(["basic"])));
    act(() => result.current.handleCompletionChange(snapshot([])));
    act(() => result.current.handleCompletionChange(snapshot(["basic"])));

    expect(
      captureMock.mock.calls.filter((c) => c[0] === "archive_section_completed"),
    ).toHaveLength(1);
  });

  it("progressProps 는 이탈과 같은 시계·같은 축을 준다", () => {
    const { result } = renderHook(() =>
      useArchiveEntryAnalytics({ mode: "new", active: true }),
    );

    act(() =>
      result.current.handleCompletionChange(
        snapshot(["basic", "detail"], ["detail.지원 동기"]),
      ),
    );
    vi.advanceTimersByTime(30_000);

    expect(result.current.progressProps()).toEqual({
      elapsed_seconds: 30,
      sections_done: 2,
      sections_total: 4,
      qualitative_fields_filled: ["detail.지원 동기"],
    });
  });

  it("폼이 아직 안 떴으면(active=false) 이탈로 세지 않는다", () => {
    const { unmount } = renderHook(() =>
      useArchiveEntryAnalytics({ mode: "edit", active: false }),
    );

    vi.advanceTimersByTime(20_000);
    unmount();
    settle();

    expect(
      captureMock.mock.calls.filter((c) => c[0] === "archive_entry_abandoned"),
    ).toHaveLength(0);
  });
});
