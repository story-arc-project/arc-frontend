import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { AnalysisSnapshot } from "@/types/analysis";

// FRT-108: 이 테스트가 지키는 계약은 하나다 — "재시도 폴링이 사용자의 로컬 변경을 되돌리지 않는다".
// 폴링 GET 은 요청 시점의 서버 스냅샷을 들고 온다. 그 사이 사용자가 삭제하거나 다른 카드를
// 재시도하면, 늦게 도착한 옛 응답이 목록을 통째 교체하며 방금 한 행동을 지운다.

vi.mock("@/lib/api/analysis-api", () => ({
  getComprehensiveList: vi.fn(),
  deleteComprehensiveAnalysis: vi.fn(),
  retryComprehensiveAnalysis: vi.fn(),
  retryKeywordAnalysis: vi.fn(),
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
}));

// 플래그는 빌드타임 인라인이라 스텁으로 열어야 재시도 버튼이 렌더된다.
vi.mock("@/lib/analysis/flags", () => ({ isAnalysisRetryEnabled: () => true }));

let searchParams = new URLSearchParams();

vi.mock("@/lib/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...actual, capture: vi.fn() };
});

// 목록은 `?started=` 로 "방금 만든 분석"을 받는다(FRT-176). 기본은 빈 파라미터.
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));

// next/link 는 앱 라우터 컨텍스트를 요구한다 — 표시 검증에는 순수 앵커로 충분하다.
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import {
  getComprehensiveList,
  deleteComprehensiveAnalysis,
  retryComprehensiveAnalysis,
} from "@/lib/api/analysis-api";

import { capture } from "@/lib/analytics";
import { toast } from "@/components/ui/toast";

import ComprehensiveAnalysisPage from "./page";

const captureMock = vi.mocked(capture);
const toastMock = vi.mocked(toast);
const getList = vi.mocked(getComprehensiveList);
const deleteAnalysis = vi.mocked(deleteComprehensiveAnalysis);
const retryAnalysis = vi.mocked(retryComprehensiveAnalysis);

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  searchParams = new URLSearchParams();
});

afterEach(() => {
  vi.useRealTimers();
});

function snap(id: string, status: AnalysisSnapshot["status"]): AnalysisSnapshot {
  return {
    id,
    type: "comprehensive",
    title: `분석 ${id}`,
    status,
    createdAt: "2026-07-22T00:00:00Z",
    experienceCount: 2,
    isBookmarked: false,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// globals:false 라 RTL 이 가짜 타이머를 감지하지 못한다 — waitFor/findBy 는 영영 멈춘다.
// 대기 대신 microtask 를 명시적으로 흘려보낸다.
async function flush() {
  await act(async () => {});
}

// userEvent 는 가짜 타이머와 물려 멈춘다(내부 지연이 전진되지 않는다).
// 여기서 누르는 건 전부 평범한 버튼이라 fireEvent 로 충분하다.
async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

/** 폴링은 완료 뒤 재예약이라 타이머 전진 사이에 microtask 를 흘려보내야 한다. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("종합 분석 목록 — 재시도 폴링과 로컬 변경 (FRT-108)", () => {
  it("삭제한 카드가 낡은 폴링 응답으로 되살아나지 않는다", async () => {
    const initial = [snap("a", "failed"), snap("b", "completed")];
    getList.mockResolvedValueOnce(initial);
    retryAnalysis.mockResolvedValue(undefined);
    deleteAnalysis.mockResolvedValue(undefined);

    render(<ComprehensiveAnalysisPage />);
    await flush();
    expect(screen.getByText("분석 b")).toBeInTheDocument();

    // 재시도를 눌러 폴링을 켠다.
    await click(screen.getByRole("button", { name: "다시 시도" }));
    await flush();
    expect(retryAnalysis).toHaveBeenCalledWith("a");

    // 폴링 GET 을 응답 전에 붙잡아 둔다.
    const poll = deferred<AnalysisSnapshot[]>();
    getList.mockReturnValueOnce(poll.promise);
    await advance(5_000);
    expect(getList).toHaveBeenCalledTimes(2);

    // GET 이 떠 있는 동안 b 를 삭제한다.
    await click(screen.getAllByLabelText("삭제")[1]);
    await flush();
    const dialog = screen.getByRole("dialog");
    await click(within(dialog).getByRole("button", { name: "삭제" }));
    await flush();
    expect(screen.queryByText("분석 b")).not.toBeInTheDocument();

    // 삭제 이전에 찍힌 서버 스냅샷이 뒤늦게 도착한다.
    await act(async () => {
      poll.resolve(initial);
      await poll.promise;
    });
    await flush();

    expect(screen.queryByText("분석 b")).not.toBeInTheDocument();
  });

  it("다른 카드를 재시도하는 사이 도착한 낡은 응답이 '진행 중'을 되돌리지 않는다", async () => {
    getList.mockResolvedValueOnce([snap("a", "failed"), snap("b", "failed")]);
    retryAnalysis.mockResolvedValue(undefined);

    render(<ComprehensiveAnalysisPage />);
    await flush();
    expect(screen.getAllByRole("button", { name: "다시 시도" })).toHaveLength(2);

    // a 재시도 → 폴링 1회차 시작.
    await click(screen.getAllByRole("button", { name: "다시 시도" })[0]);
    await flush();
    expect(retryAnalysis).toHaveBeenCalledWith("a");

    const poll = deferred<AnalysisSnapshot[]>();
    getList.mockReturnValueOnce(poll.promise);
    await advance(5_000);
    expect(getList).toHaveBeenCalledTimes(2);

    // GET 이 떠 있는 동안 b 도 재시도한다.
    await click(screen.getByRole("button", { name: "다시 시도" }));
    await flush();
    expect(retryAnalysis).toHaveBeenCalledWith("b");
    expect(screen.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument();

    // b 재시도 이전에 찍힌 스냅샷(b 는 아직 failed)이 뒤늦게 도착한다.
    await act(async () => {
      poll.resolve([snap("a", "processing"), snap("b", "failed")]);
      await poll.promise;
    });
    await flush();

    // 되돌아가면 '다시 시도'가 되살아나고, 사용자가 한 번 더 눌러 중복 재시도가 된다.
    expect(screen.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument();
    expect(screen.getAllByText("분석 진행 중...")).toHaveLength(2);
  });
});

// FRT-176: 대기 화면을 없앤 대신, 목록이 진행 중인 분석을 지켜보고 완료를 관측한다.
// 완료 관측이 유일한 신호원이다 — 여기서 놓치면 완료 계측(FRT-19)과 피드백 트리거(FRT-95)가
// 코드베이스 어디에서도 나가지 않는다.
describe("종합 분석 목록 — 진행 중 감시와 완료 관측 (FRT-176)", () => {
  it("진행 중 항목이 있으면 재시도를 누르지 않아도 목록을 다시 읽는다", async () => {
    getList.mockResolvedValueOnce([snap("a", "processing")]);
    render(<ComprehensiveAnalysisPage />);
    await flush();
    expect(getList).toHaveBeenCalledTimes(1);

    getList.mockResolvedValueOnce([snap("a", "processing")]);
    await advance(5_000);

    expect(getList).toHaveBeenCalledTimes(2);
  });

  it("진행 중 항목이 없으면 목록을 다시 읽지 않는다", async () => {
    getList.mockResolvedValueOnce([snap("a", "completed")]);
    render(<ComprehensiveAnalysisPage />);
    await flush();

    await advance(60_000);

    expect(getList).toHaveBeenCalledTimes(1);
  });

  it("완료로 바뀌면 토스트를 띄우고 카드가 열린다", async () => {
    getList.mockResolvedValueOnce([snap("a", "processing")]);
    render(<ComprehensiveAnalysisPage />);
    await flush();
    expect(screen.getByText("분석 진행 중...")).toBeInTheDocument();
    expect(toastMock).not.toHaveBeenCalled();

    getList.mockResolvedValueOnce([snap("a", "completed")]);
    await advance(5_000);

    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock.mock.calls[0][0]).toBe("분석이 완료됐어요.");
    expect(captureMock).toHaveBeenCalledWith("analysis_completed", {
      analysis_type: "comprehensive",
    });
    // 완료된 카드는 이제 상세로 들어갈 수 있다.
    expect(screen.getByRole("link", { name: /분석 a/ })).toHaveAttribute(
      "href",
      "/analysis/comprehensive/a",
    );
  });

  it("방금 만든 분석이 첫 조회부터 완료면 그 완료도 관측한다", async () => {
    // 빨리 끝나는 분석은 '진행 중 → 완료' 전이가 존재하지 않는다. 전이만 보면
    // 대기 화면 시절엔 잘 잡히던 이 경로의 완료 신호를 통째로 잃는다.
    searchParams = new URLSearchParams("started=a");
    getList.mockResolvedValueOnce([snap("a", "completed"), snap("old", "completed")]);

    render(<ComprehensiveAnalysisPage />);
    await flush();

    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledWith("analysis_completed", {
      analysis_type: "comprehensive",
    });
    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it("`?started=` 없이 들어오면 이미 완료된 목록만으로는 아무 신호도 내지 않는다", async () => {
    getList.mockResolvedValueOnce([snap("a", "completed"), snap("b", "completed")]);

    render(<ComprehensiveAnalysisPage />);
    await flush();

    expect(captureMock).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });
});
