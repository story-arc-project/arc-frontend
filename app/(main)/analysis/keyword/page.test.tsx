import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { AnalysisSnapshot } from "@/types/analysis";

// FRT-108: 종합 분석 목록과 같은 계약을 키워드 목록에서도 지킨다 —
// "재시도 폴링이 사용자의 로컬 변경을 되돌리지 않는다".
// 두 화면은 병렬 복제 구조라, 한쪽만 고치면 다른 쪽에 같은 결함이 남는다.

vi.mock("@/lib/api/analysis-api", () => ({
  getKeywordList: vi.fn(),
  deleteKeywordAnalysis: vi.fn(),
  retryComprehensiveAnalysis: vi.fn(),
  retryKeywordAnalysis: vi.fn(),
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
}));

vi.mock("@/lib/analysis/flags", () => ({ isAnalysisRetryEnabled: () => true }));

let searchParams = new URLSearchParams();
const replace = vi.fn();

vi.mock("@/lib/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...actual, capture: vi.fn() };
});

// 목록은 `?started=` 로 "방금 만든 분석"을 받는다(FRT-176). 기본은 빈 파라미터.
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace }),
}));

vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import {
  getKeywordList,
  deleteKeywordAnalysis,
  retryKeywordAnalysis,
} from "@/lib/api/analysis-api";

import { capture } from "@/lib/analytics";
import { toast } from "@/components/ui/toast";

import KeywordAnalysisPage from "./page";

const captureMock = vi.mocked(capture);
const toastMock = vi.mocked(toast);

const getList = vi.mocked(getKeywordList);
const deleteAnalysis = vi.mocked(deleteKeywordAnalysis);
const retryAnalysis = vi.mocked(retryKeywordAnalysis);

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
    type: "keyword",
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
async function flush() {
  await act(async () => {});
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("키워드 분석 목록 — 재시도 폴링과 로컬 변경 (FRT-108)", () => {
  it("삭제한 카드가 낡은 폴링 응답으로 되살아나지 않는다", async () => {
    const initial = [snap("a", "failed"), snap("b", "completed")];
    getList.mockResolvedValueOnce(initial);
    retryAnalysis.mockResolvedValue(undefined);
    deleteAnalysis.mockResolvedValue(undefined);

    render(<KeywordAnalysisPage />);
    await flush();
    expect(screen.getByText("분석 b")).toBeInTheDocument();

    await click(screen.getByRole("button", { name: "다시 시도" }));
    await flush();
    expect(retryAnalysis).toHaveBeenCalledWith("a");

    const poll = deferred<AnalysisSnapshot[]>();
    getList.mockReturnValueOnce(poll.promise);
    await advance(5_000);
    expect(getList).toHaveBeenCalledTimes(2);

    await click(screen.getAllByLabelText("삭제")[1]);
    await flush();
    const dialog = screen.getByRole("dialog");
    await click(within(dialog).getByRole("button", { name: "삭제" }));
    await flush();
    expect(screen.queryByText("분석 b")).not.toBeInTheDocument();

    await act(async () => {
      poll.resolve(initial);
      await poll.promise;
    });
    await flush();

    expect(screen.queryByText("분석 b")).not.toBeInTheDocument();
  });
});

// FRT-176: 종합 목록과 같은 감시를 키워드 목록에서도 건다.
// 두 화면은 병렬 복제 구조라, 한쪽만 고치면 다른 쪽에 같은 결함이 남는다.
describe("키워드 분석 목록 — 진행 중 감시와 완료 관측 (FRT-176)", () => {
  it("진행 중 항목이 있으면 재시도를 누르지 않아도 목록을 다시 읽는다", async () => {
    getList.mockResolvedValueOnce([snap("a", "processing")]);
    render(<KeywordAnalysisPage />);
    await flush();
    expect(getList).toHaveBeenCalledTimes(1);

    getList.mockResolvedValueOnce([snap("a", "processing")]);
    await advance(5_000);

    expect(getList).toHaveBeenCalledTimes(2);
  });

  it("진행 중 항목이 없으면 목록을 다시 읽지 않는다", async () => {
    getList.mockResolvedValueOnce([snap("a", "completed")]);
    render(<KeywordAnalysisPage />);
    await flush();

    await advance(60_000);

    expect(getList).toHaveBeenCalledTimes(1);
  });

  it("완료로 바뀌면 토스트를 띄우고 카드가 열린다", async () => {
    getList.mockResolvedValueOnce([snap("a", "processing")]);
    render(<KeywordAnalysisPage />);
    await flush();
    expect(screen.getByText("분석 진행 중...")).toBeInTheDocument();

    getList.mockResolvedValueOnce([snap("a", "completed")]);
    await advance(5_000);

    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock.mock.calls[0][0]).toBe("분석이 완료됐어요.");
    expect(captureMock).toHaveBeenCalledWith("analysis_completed", {
      analysis_type: "keyword",
    });
    expect(screen.getByRole("link", { name: /분석 a/ })).toHaveAttribute(
      "href",
      "/analysis/keyword/a",
    );
  });

  it("방금 만든 분석이 첫 조회부터 완료면 그 완료도 관측한다", async () => {
    // 키워드 분석의 knn 경로는 LLM 을 타지 않아 수 초 만에 끝난다 — 전이가 아예 없다.
    searchParams = new URLSearchParams("started=a");
    getList.mockResolvedValueOnce([snap("a", "completed"), snap("old", "completed")]);

    render(<KeywordAnalysisPage />);
    await flush();

    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledWith("analysis_completed", {
      analysis_type: "keyword",
    });
    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it("`?started=` 없이 들어오면 이미 완료된 목록만으로는 아무 신호도 내지 않는다", async () => {
    getList.mockResolvedValueOnce([snap("a", "completed"), snap("b", "completed")]);

    render(<KeywordAnalysisPage />);
    await flush();

    expect(captureMock).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("관측을 마치면 `?started=` 를 URL 에서 지운다", async () => {
    // 남겨두면 새로고침마다 같은 완료가 새 완료로 다시 세어진다 — 중복 방지 기록은
    // 마운트를 넘기지 못한다.
    searchParams = new URLSearchParams("started=a");
    getList.mockResolvedValueOnce([snap("a", "completed")]);

    render(<KeywordAnalysisPage />);
    await flush();

    expect(replace).toHaveBeenCalledWith("/analysis/keyword", { scroll: false });
  });

  it("목록에 아직 나타나지 않은 `?started=` 는 지우지 않는다", async () => {
    searchParams = new URLSearchParams("started=missing");
    getList.mockResolvedValueOnce([snap("a", "completed")]);

    render(<KeywordAnalysisPage />);
    await flush();

    expect(replace).not.toHaveBeenCalled();
  });
});

describe("`?started=` 수명 (codex 후속)", () => {
  it("아직 진행 중이면 쿼리를 지우지 않는다 — 떠났다 돌아왔을 때 완료를 잡아야 한다", async () => {
    searchParams = new URLSearchParams("started=a");
    getList.mockResolvedValueOnce([snap("a", "processing")]);

    render(<KeywordAnalysisPage />);
    await flush();

    expect(replace).not.toHaveBeenCalled();
  });

  it("실패로 끝난 경우에도 쿼리를 지운다 — 더 지켜볼 완료가 없다", async () => {
    searchParams = new URLSearchParams("started=a");
    getList.mockResolvedValueOnce([snap("a", "failed")]);

    render(<KeywordAnalysisPage />);
    await flush();

    expect(replace).toHaveBeenCalledWith("/analysis/keyword", { scroll: false });
  });
});
