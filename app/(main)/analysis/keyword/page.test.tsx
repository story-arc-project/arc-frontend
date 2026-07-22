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

vi.mock("@/lib/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...actual, capture: vi.fn() };
});

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

import KeywordAnalysisPage from "./page";

const getList = vi.mocked(getKeywordList);
const deleteAnalysis = vi.mocked(deleteKeywordAnalysis);
const retryAnalysis = vi.mocked(retryKeywordAnalysis);

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
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
