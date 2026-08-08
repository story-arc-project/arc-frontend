import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnalysisSnapshot } from "@/types/analysis";

// FRT-185: 즐겨찾기·히스토리와 같은 계약이다 — "화면은 마지막에 고른 필터의 답만 보여준다".
// 여기서는 상태 필터(전체/대기 중/분석 완료)가 그 역할을 한다.

vi.mock("@/lib/api/analysis-api", () => ({
  getIndividualAnalysisList: vi.fn(),
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
}));

// next/link 는 앱 라우터 컨텍스트를 요구한다 — 표시 검증에는 순수 앵커로 충분하다.
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { getIndividualAnalysisList } from "@/lib/api/analysis-api";

import IndividualAnalysisPage from "./page";

const getList = vi.mocked(getIndividualAnalysisList);

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

function snap(
  id: string,
  status: AnalysisSnapshot["status"] = "completed",
): AnalysisSnapshot {
  return {
    id,
    type: "individual",
    title: `분석 ${id}`,
    status,
    createdAt: "2026-08-01T00:00:00Z",
    experienceCount: 1,
    isBookmarked: false,
  };
}

// 응답 순서를 손으로 정하려면 프로미스를 붙잡고 있어야 한다. reject 도 필요하다 —
// 늦게 도착하는 것이 성공만은 아니기 때문이다.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await act(async () => {});
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

describe("개별 분석 목록 — 필터 전환 race (FRT-185)", () => {
  it("먼저 떠난 요청이 뒤늦게 도착해도 지금 고른 필터의 목록을 덮지 않는다", async () => {
    const stale = deferred<AnalysisSnapshot[]>();
    getList.mockReturnValueOnce(stale.promise); // filter=all (느림)

    const { container } = render(<IndividualAnalysisPage />);
    await flush();
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();

    const fresh = deferred<AnalysisSnapshot[]>();
    getList.mockReturnValueOnce(fresh.promise); // filter=completed (현재)
    await click(screen.getByRole("tab", { name: "분석 완료" }));
    await flush();

    await act(async () => {
      fresh.resolve([snap("fresh")]);
    });
    expect(screen.getByText("분석 fresh")).toBeInTheDocument();

    // 뒤늦게 도착한 '전체' 응답.
    await act(async () => {
      stale.resolve([snap("stale", "processing")]);
    });

    expect(screen.queryByText("분석 stale")).not.toBeInTheDocument();
    expect(screen.getByText("분석 fresh")).toBeInTheDocument();
  });

  it("새 요청이 아직 진행 중인데 늦은 응답이 로딩을 꺼버리지 않는다", async () => {
    const stale = deferred<AnalysisSnapshot[]>();
    getList.mockReturnValueOnce(stale.promise);

    const { container } = render(<IndividualAnalysisPage />);
    await flush();

    const pending = deferred<AnalysisSnapshot[]>();
    getList.mockReturnValueOnce(pending.promise); // 끝내 응답하지 않는다
    await click(screen.getByRole("tab", { name: "분석 완료" }));
    await flush();

    await act(async () => {
      stale.resolve([snap("stale", "processing")]);
    });

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByText("분석 stale")).not.toBeInTheDocument();
  });

  it("늦게 도착한 옛 요청의 실패는 멀쩡한 화면을 에러로 바꾸지 않는다", async () => {
    const stale = deferred<AnalysisSnapshot[]>();
    getList.mockReturnValueOnce(stale.promise);

    render(<IndividualAnalysisPage />);
    await flush();

    const fresh = deferred<AnalysisSnapshot[]>();
    getList.mockReturnValueOnce(fresh.promise);
    await click(screen.getByRole("tab", { name: "분석 완료" }));
    await flush();

    await act(async () => {
      fresh.resolve([snap("fresh")]);
    });
    expect(screen.getByText("분석 fresh")).toBeInTheDocument();

    await act(async () => {
      stale.reject(new Error("분석 목록을 불러올 수 없습니다."));
    });

    expect(screen.queryByText("데이터를 불러오지 못했습니다.")).not.toBeInTheDocument();
    expect(screen.getByText("분석 fresh")).toBeInTheDocument();
  });

  it("에러 화면의 '다시 시도'는 지금 필터로 다시 읽는다", async () => {
    getList.mockRejectedValueOnce(new Error("분석 목록을 불러올 수 없습니다."));

    render(<IndividualAnalysisPage />);
    await flush();
    expect(screen.getByText("데이터를 불러오지 못했습니다.")).toBeInTheDocument();

    getList.mockResolvedValueOnce([snap("retried")]);
    await click(screen.getByRole("button", { name: "다시 시도" }));
    await flush();

    expect(getList).toHaveBeenCalledTimes(2);
    expect(screen.getByText("분석 retried")).toBeInTheDocument();
  });

  it("'다시 시도'를 누른 직후에는 이전 실패가 아니라 기다리는 중임을 보여준다", async () => {
    getList.mockRejectedValueOnce(new Error("분석 목록을 불러올 수 없습니다."));

    const { container } = render(<IndividualAnalysisPage />);
    await flush();
    expect(screen.getByText("데이터를 불러오지 못했습니다.")).toBeInTheDocument();

    const pending = deferred<AnalysisSnapshot[]>();
    getList.mockReturnValueOnce(pending.promise);
    await click(screen.getByRole("button", { name: "다시 시도" }));
    await flush();

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByText("데이터를 불러오지 못했습니다.")).not.toBeInTheDocument();
  });
});
