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
  // ── 리뷰(Codex P1)에서 드러난 것 ───────────────────────────────────────────────
  // 수정 화면은 이미 완료된 기록을 들고 시작한다. 도착 시점의 완료분을 그대로 세면
  // "기록을 열었다"가 "섹션을 완료했다"로 집계되고, 이 이벤트에는 mode 가 없어 진짜
  // 완료와 구분조차 안 된다.
  it("수정 진입 시 이미 완료돼 있던 섹션은 세지 않는다", () => {
    const { result } = renderHook(() =>
      useArchiveEntryAnalytics({ mode: "edit", active: true, sessionKey: "exp-1" }),
    );

    act(() => result.current.handleCompletionChange(snapshot(["basic", "detail"])));

    expect(
      captureMock.mock.calls.filter(([e]) => e === "archive_section_completed"),
    ).toHaveLength(0);
  });

  it("수정 중 새로 완료한 섹션은 센다 — 기준선 이후만", () => {
    const { result } = renderHook(() =>
      useArchiveEntryAnalytics({ mode: "edit", active: true, sessionKey: "exp-1" }),
    );

    act(() => result.current.handleCompletionChange(snapshot(["basic", "detail"])));
    act(() =>
      result.current.handleCompletionChange(snapshot(["basic", "detail", "repeat"])),
    );

    const done = captureMock.mock.calls.filter(
      ([e]) => e === "archive_section_completed",
    );
    expect(done).toHaveLength(1);
    expect(done[0][1]).toMatchObject({ section_key: "repeat", section_index: 2 });
  });

  it("확장 섹션이 늦게 도착해도 기준선은 폼이 자리 잡은 뒤에 잡힌다", () => {
    const { result } = renderHook(() =>
      useArchiveEntryAnalytics({ mode: "edit", active: true, sessionKey: "exp-1" }),
    );

    // 템플릿 로드 전: 섹션이 하나도 없는 빈 스냅샷이 먼저 온다.
    act(() =>
      result.current.handleCompletionChange({
        sectionIds: [],
        completedSectionIds: [],
        qualitativeFieldsFilled: [],
      }),
    );
    act(() => result.current.handleCompletionChange(snapshot(["basic", "detail"])));

    expect(
      captureMock.mock.calls.filter(([e]) => e === "archive_section_completed"),
    ).toHaveLength(0);
  });

  it("신규 작성은 기준선을 깔지 않는다 — 첫 완료부터 센다", () => {
    const { result } = renderHook(() =>
      useArchiveEntryAnalytics({ mode: "new", active: true }),
    );

    act(() => result.current.handleCompletionChange(snapshot(["basic"])));

    const done = captureMock.mock.calls.filter(
      ([e]) => e === "archive_section_completed",
    );
    expect(done).toHaveLength(1);
    expect(done[0][1]).toMatchObject({ section_key: "basic" });
  });

  it("다루는 기록이 바뀌면 앞 기록의 완료 자취를 물려주지 않는다", () => {
    const { result, rerender } = renderHook(
      ({ key }) =>
        useArchiveEntryAnalytics({ mode: "edit", active: true, sessionKey: key }),
      { initialProps: { key: "exp-1" } },
    );

    act(() => result.current.handleCompletionChange(snapshot(["basic"])));
    act(() => result.current.handleCompletionChange(snapshot(["basic", "detail"])));
    captureMock.mockClear();

    // 다른 기록으로 갈아탄다 — 기준선도 자취도 새로 잡혀야 한다.
    rerender({ key: "exp-2" });
    act(() => result.current.handleCompletionChange(snapshot(["basic", "detail"])));
    expect(
      captureMock.mock.calls.filter(([e]) => e === "archive_section_completed"),
    ).toHaveLength(0);

    act(() =>
      result.current.handleCompletionChange(snapshot(["basic", "detail", "repeat"])),
    );
    const done = captureMock.mock.calls.filter(
      ([e]) => e === "archive_section_completed",
    );
    expect(done).toHaveLength(1);
    expect(done[0][1]).toMatchObject({ section_key: "repeat" });
  });

  it("앞 기록을 저장했어도 다음 기록의 이탈은 잡힌다", () => {
    const { result, rerender, unmount } = renderHook(
      ({ key, active }) =>
        useArchiveEntryAnalytics({ mode: "edit", active, sessionKey: key }),
      { initialProps: { key: "exp-1", active: true } },
    );

    act(() => result.current.handleCompletionChange(snapshot(["basic"])));
    act(() => result.current.markSaved());

    // 라우트 전환: 앞 기록이 빠지고(비활성) 다음 기록이 실린다.
    rerender({ key: "exp-2", active: false });
    settle();
    rerender({ key: "exp-2", active: true });
    act(() => result.current.handleCompletionChange(snapshot(["basic"])));
    vi.advanceTimersByTime(20_000);
    unmount();
    settle();

    const abandoned = captureMock.mock.calls.filter(
      ([e]) => e === "archive_entry_abandoned",
    );
    expect(abandoned).toHaveLength(1);
    expect(abandoned[0][1]).toMatchObject({ elapsed_seconds: 20, sections_done: 1 });
  });
});
