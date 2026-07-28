import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import type { AnalysisSnapshot, AnalysisStatus } from "@/types/analysis";

vi.mock("@/lib/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...actual, capture: vi.fn() };
});

vi.mock("@/contexts/FeedbackTriggerContext", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/contexts/FeedbackTriggerContext")>();
  return { ...actual, useFeedbackTriggers: vi.fn() };
});

import { capture } from "@/lib/analytics";
import { useFeedbackTriggers } from "@/contexts/FeedbackTriggerContext";

import { useAnalysisProgressWatch } from "./use-analysis-progress-watch";

const captureMock = vi.mocked(capture);
const reportAnalysisCompleted = vi.fn();

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup);

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.mocked(useFeedbackTriggers).mockReturnValue({
    reportAnalysisCompleted,
    reportExperienceCount: vi.fn(),
    setSuppressed: vi.fn(),
  });
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

function snap(id: string, status: AnalysisStatus): AnalysisSnapshot {
  return {
    id,
    type: "comprehensive",
    title: `${id} 분석`,
    status,
    createdAt: "2026-07-28T00:00:00Z",
    experienceCount: 2,
    isBookmarked: false,
  };
}

type Props = {
  items: AnalysisSnapshot[];
  startedId?: string | null;
  refresh?: () => boolean | void | Promise<boolean | void>;
  onCompleted?: (completed: AnalysisSnapshot[]) => void;
};

function render(initial: Props) {
  return renderHook(
    (props: Props) =>
      useAnalysisProgressWatch({
        items: props.items,
        type: "comprehensive",
        startedId: props.startedId ?? null,
        refresh: props.refresh ?? (() => true),
        onCompleted: props.onCompleted,
      }),
    { initialProps: initial },
  );
}

describe("useAnalysisProgressWatch — 진행 중이면 갱신한다", () => {
  it("진행 중 항목이 없으면 아무 요청도 내지 않는다", async () => {
    const refresh = vi.fn(() => true);
    render({ items: [snap("a", "completed"), snap("b", "failed")], refresh });

    await advance(10 * 60_000);

    expect(refresh).not.toHaveBeenCalled();
  });

  it("진행 중 항목이 있으면 5초 간격으로 목록을 다시 읽는다", async () => {
    const refresh = vi.fn(() => true);
    render({ items: [snap("a", "processing")], refresh });

    await advance(5_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    await advance(10_000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("pending 도 진행 중으로 본다", async () => {
    const refresh = vi.fn(() => true);
    render({ items: [snap("a", "pending")], refresh });

    await advance(5_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("진행 중 항목이 사라지면 멈춘다", async () => {
    const refresh = vi.fn(() => true);
    const { rerender } = render({ items: [snap("a", "processing")], refresh });

    await advance(5_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    rerender({ items: [snap("a", "completed")], refresh });
    await advance(60_000);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("5분(60틱)에서 멈춘다 — 무한 폴링을 만들지 않는다", async () => {
    const refresh = vi.fn(() => true);
    render({ items: [snap("a", "processing")], refresh });

    await advance(60 * 60_000);

    expect(refresh).toHaveBeenCalledTimes(60);
  });

  it("낡아서 버려진 갱신은 관찰 기회를 쓰지 않는다", async () => {
    // false = "응답이 낡아 버렸다". 서버를 들여다볼 기회를 쓴 게 아니므로 상한에서 깎지 않는다.
    let calls = 0;
    const refresh = vi.fn(() => Promise.resolve(calls++ < 5 ? false : true));
    render({ items: [snap("a", "processing")], refresh });

    await advance(60 * 60_000);

    expect(refresh).toHaveBeenCalledTimes(65);
  });

  it("전부 버려져도 무한히 돌지 않는다 (절대 상한)", async () => {
    const refresh = vi.fn(() => Promise.resolve(false));
    render({ items: [snap("a", "processing")], refresh });

    await advance(60 * 60_000);

    expect(refresh).toHaveBeenCalledTimes(90);
  });

  it("이전 갱신이 끝나기 전에는 다음 요청을 내지 않는다 (응답 역전 방지)", async () => {
    let settle: (() => void) | undefined;
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
    );
    render({ items: [snap("a", "processing")], refresh });

    await advance(20_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      settle?.();
    });
    await advance(5_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("갱신이 실패해도 폴링을 멈추지 않는다", async () => {
    const refresh = vi.fn(() => Promise.reject(new Error("network")));
    render({ items: [snap("a", "processing")], refresh });

    await advance(5_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    await advance(5_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("언마운트되면 타이머를 정리한다", async () => {
    const refresh = vi.fn(() => true);
    const { unmount } = render({ items: [snap("a", "processing")], refresh });

    unmount();
    await advance(60_000);

    expect(refresh).not.toHaveBeenCalled();
  });

  it("최신 refresh 를 호출한다 (stale closure 가드)", async () => {
    const first = vi.fn(() => true);
    const second = vi.fn(() => true);
    const { rerender } = render({ items: [snap("a", "processing")], refresh: first });

    rerender({ items: [snap("a", "processing")], refresh: second });
    await advance(5_000);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("useAnalysisProgressWatch — 완료를 관측한다", () => {
  it("진행 중 → 완료 전이에서 두 신호를 각 1회 낸다", async () => {
    const onCompleted = vi.fn();
    const { rerender } = render({ items: [snap("a", "processing")], onCompleted });

    expect(captureMock).not.toHaveBeenCalled();

    rerender({ items: [snap("a", "completed")], onCompleted });

    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledWith("analysis_completed", {
      analysis_type: "comprehensive",
    });
    expect(reportAnalysisCompleted).toHaveBeenCalledTimes(1);
    expect(reportAnalysisCompleted).toHaveBeenCalledWith({
      analysisId: "a",
      analysisType: "comprehensive",
    });
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(onCompleted.mock.calls[0][0]).toHaveLength(1);
  });

  it("같은 완료를 다시 렌더해도 중복 발화하지 않는다", async () => {
    const { rerender } = render({ items: [snap("a", "processing")] });

    rerender({ items: [snap("a", "completed")] });
    rerender({ items: [snap("a", "completed")] });
    rerender({ items: [snap("a", "completed")] });

    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(reportAnalysisCompleted).toHaveBeenCalledTimes(1);
  });

  it("최초 로드에 이미 완료돼 있던 항목은 발화하지 않는다", async () => {
    render({ items: [snap("a", "completed"), snap("b", "completed")] });

    expect(captureMock).not.toHaveBeenCalled();
    expect(reportAnalysisCompleted).not.toHaveBeenCalled();
  });

  it("방금 시작한 분석(startedId)은 첫 관측이 이미 완료여도 발화한다", async () => {
    // 빠르게 끝나는 분석(키워드 knn 등)은 목록 첫 GET 시점에 이미 completed 다.
    // 전이만 보면 이 완료는 영영 관측되지 않는다 — 지금 잘 되던 경로가 깨진다.
    const onCompleted = vi.fn();
    render({
      items: [snap("a", "completed"), snap("old", "completed")],
      startedId: "a",
      onCompleted,
    });

    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(reportAnalysisCompleted).toHaveBeenCalledWith({
      analysisId: "a",
      analysisType: "comprehensive",
    });
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it("startedId 가 아직 진행 중이면 완료될 때 한 번만 발화한다", async () => {
    const { rerender } = render({
      items: [snap("a", "processing")],
      startedId: "a",
    });

    expect(captureMock).not.toHaveBeenCalled();

    rerender({ items: [snap("a", "completed")], startedId: "a" });
    rerender({ items: [snap("a", "completed")], startedId: "a" });

    expect(captureMock).toHaveBeenCalledTimes(1);
  });

  it("실패 → 완료(재시도 성공)도 완료로 본다", async () => {
    const { rerender } = render({ items: [snap("a", "failed")] });

    rerender({ items: [snap("a", "completed")] });

    expect(captureMock).toHaveBeenCalledTimes(1);
  });

  it("재시도로 다시 진행 중이 되면 그 다음 완료를 또 발화한다", async () => {
    const { rerender } = render({ items: [snap("a", "processing")] });

    rerender({ items: [snap("a", "completed")] });
    expect(captureMock).toHaveBeenCalledTimes(1);

    // 재시도 — 목록이 낙관적으로 processing 으로 되돌린다.
    rerender({ items: [snap("a", "processing")] });
    rerender({ items: [snap("a", "completed")] });

    expect(captureMock).toHaveBeenCalledTimes(2);
  });

  it("여러 건이 한 번에 완료되면 건별로 신호를 내되 onCompleted 는 한 번에 모아 준다", async () => {
    const onCompleted = vi.fn();
    const { rerender } = render({
      items: [snap("a", "processing"), snap("b", "processing")],
      onCompleted,
    });

    rerender({
      items: [snap("a", "completed"), snap("b", "completed")],
      onCompleted,
    });

    expect(captureMock).toHaveBeenCalledTimes(2);
    expect(reportAnalysisCompleted).toHaveBeenCalledTimes(2);
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(onCompleted.mock.calls[0][0]).toHaveLength(2);
  });

  it("목록에 처음 나타난 항목이 완료 상태여도 발화하지 않는다 (내가 건 분석이 아니다)", async () => {
    const { rerender } = render({ items: [snap("a", "processing")] });

    rerender({ items: [snap("a", "processing"), snap("other", "completed")] });

    expect(captureMock).not.toHaveBeenCalled();
  });

  it("완료를 발화한 항목이 삭제됐다가 같은 id 로 다시 나타나도 재발화하지 않는다", async () => {
    // 기록 정리는 '진행 중으로 관측될 때'만 한다 — 삭제만으로 재발화하면 안 된다.
    const { rerender } = render({ items: [snap("a", "processing")] });

    rerender({ items: [snap("a", "completed")] });
    expect(captureMock).toHaveBeenCalledTimes(1);

    rerender({ items: [] });
    rerender({ items: [snap("a", "completed")] });

    expect(captureMock).toHaveBeenCalledTimes(1);
  });
});

describe("useAnalysisProgressWatch — 예산 소진 뒤에도 새 작업은 다시 감시한다", () => {
  it("예산을 다 쓴 뒤 다른 카드가 진행 중이 되면 폴링이 되살아난다", async () => {
    // 불리언 하나로 감시하면 이미 진행 중인 항목이 값을 true 로 붙들고 있어 effect 가
    // 다시 돌지 않는다 — 방금 재시도한 카드가 서버 완료 후에도 '진행 중'에 고착된다.
    const refresh = vi.fn(() => true);
    const { rerender } = render({
      items: [snap("a", "processing"), snap("b", "failed")],
      refresh,
    });

    await advance(60 * 60_000);
    expect(refresh).toHaveBeenCalledTimes(60);

    // b 재시도 — 목록이 낙관적으로 진행 중으로 바꾼다.
    rerender({ items: [snap("a", "processing"), snap("b", "processing")], refresh });
    await advance(5_000);

    expect(refresh).toHaveBeenCalledTimes(61);
  });

  it("진행 중 항목의 pending → processing 전이만으로는 예산이 리셋되지 않는다", async () => {
    const refresh = vi.fn(() => true);
    const { rerender } = render({ items: [snap("a", "pending")], refresh });

    await advance(5_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    rerender({ items: [snap("a", "processing")], refresh });
    await advance(60 * 60_000);

    // 같은 id 가 계속 진행 중일 뿐이므로 예산은 이어서 소진된다.
    expect(refresh).toHaveBeenCalledTimes(60);
  });
});

describe("useAnalysisProgressWatch — 생애 상한 (codex 후속)", () => {
  it("감시 대상이 계속 바뀌어도 결국 멈춘다 — 예산 리셋이 무한 폴링을 만들지 않는다", async () => {
    // 완료·추가가 번갈아 일어나면 라운드마다 예산이 새로 세어진다. 리셋되지 않는
    // 생애 상한이 없으면 목록을 열어둔 채로 요청이 영원히 나간다.
    const refresh = vi.fn(() => true);
    const { rerender } = render({ items: [snap("w-0", "processing")], refresh });

    for (let round = 1; round <= 12; round += 1) {
      await advance(60 * 60_000);
      rerender({ items: [snap(`w-${round}`, "processing")], refresh });
    }
    await advance(60 * 60_000);

    expect(refresh).toHaveBeenCalledTimes(240);
  });

  it("생애 상한에 닿기 전까지는 재시도가 정상적으로 되살아난다", async () => {
    const refresh = vi.fn(() => true);
    const { rerender } = render({ items: [snap("a", "processing")], refresh });

    await advance(60 * 60_000);
    rerender({ items: [snap("a", "processing"), snap("b", "processing")], refresh });
    await advance(5_000);

    expect(refresh).toHaveBeenCalledTimes(61);
  });
});

describe("useAnalysisProgressWatch — 사람이 누른 재시도는 상한에 갇히지 않는다 (codex 후속)", () => {
  it("생애 상한에 닿은 뒤에도 rearm 하면 다시 지켜본다", async () => {
    // 자동 상한은 지켜보는 사람이 없을 때를 위한 것이다. 버튼을 누른 사용자를 가두면
    // 그 카드는 서버가 다 만든 뒤에도 '진행 중'에 머물고, 아무 반응도 없다.
    const refresh = vi.fn(() => true);
    const { result, rerender } = render({ items: [snap("w-0", "processing")], refresh });

    for (let round = 1; round <= 12; round += 1) {
      await advance(60 * 60_000);
      rerender({ items: [snap(`w-${round}`, "processing")], refresh });
    }
    await advance(60 * 60_000);
    expect(refresh).toHaveBeenCalledTimes(240);

    // 사람이 재시도를 눌렀다 — 목록이 낙관적으로 진행 중으로 바꾸고 예산을 되살린다.
    await act(async () => {
      result.current.rearm();
    });
    rerender({ items: [snap("retried", "processing")], refresh });
    await advance(5_000);

    expect(refresh).toHaveBeenCalledTimes(241);
  });
});

describe("useAnalysisProgressWatch — 화면을 떠났다 돌아와도 완료를 놓치지 않는다 (codex 후속)", () => {
  it("진행 중일 때 떠났다가 완료 후 돌아오면 startedId 로 완료를 관측한다", async () => {
    // 목록을 떠나면 직전 상태 기록도 함께 사라진다. 돌아왔을 때 이미 완료라면 전이가
    // 존재하지 않으므로, `?started=` 표시가 남아 있어야만 그 완료를 잡을 수 있다.
    const first = render({ items: [snap("a", "processing")], startedId: "a" });
    expect(captureMock).not.toHaveBeenCalled();
    first.unmount();

    render({ items: [snap("a", "completed")], startedId: "a" });

    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(reportAnalysisCompleted).toHaveBeenCalledWith({
      analysisId: "a",
      analysisType: "comprehensive",
    });
  });
});

describe("useAnalysisProgressWatch — 아직 목록에 안 뜬 분석 (codex 후속)", () => {
  it("방금 만든 분석이 첫 조회에 없으면 그것만으로도 감시를 건다", async () => {
    // 생성 응답과 첫 목록 조회 사이에 그 행이 안 보일 수 있다. 진행 중 항목이 없다는
    // 이유로 감시를 안 걸면 사용자는 "내 분석 어디 갔지" 상태로 새로고침까지 방치된다.
    const refresh = vi.fn(() => true);
    render({ items: [snap("old", "completed")], startedId: "mine", refresh });

    await advance(5_000);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("그 분석이 목록에 나타나 완료되면 감시를 멈춘다", async () => {
    const refresh = vi.fn(() => true);
    const { rerender } = render({
      items: [snap("old", "completed")],
      startedId: "mine",
      refresh,
    });

    await advance(5_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    rerender({
      items: [snap("old", "completed"), snap("mine", "completed")],
      startedId: "mine",
      refresh,
    });
    await advance(60_000);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledTimes(1);
  });

  it("startedId 가 없으면 진행 중도 없는 목록에서 요청을 내지 않는다", async () => {
    const refresh = vi.fn(() => true);
    render({ items: [snap("old", "completed")], refresh });

    await advance(60_000);

    expect(refresh).not.toHaveBeenCalled();
  });
});
