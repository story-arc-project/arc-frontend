import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnalysisSnapshot, AnalysisType } from "@/types/analysis";

// FRT-170: 이 화면은 개별·종합·키워드 세 목록을 병합해 보여준다. 그 중 일부만 실패해도
// 예전엔 살아남은 소스만으로 정렬된 목록이 "전체 기록"인 얼굴로 떴다 — 사용자는 특정 유형의
// 기록이 삭제됐다고 오인한다. 여기서 지키는 계약은 둘이다:
//   (1) 못 불러온 유형의 **이름을 댄다**  (2) 실패를 "결과 없음"으로 위장하지 않는다

vi.mock("@/lib/api/analysis-api", () => ({
  getAnalysisHistory: vi.fn(),
  updateAnalysisMeta: vi.fn(),
  deleteAnalysis: vi.fn(),
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
}));

// next/link 는 앱 라우터 컨텍스트를 요구한다 — 표시 검증에는 순수 앵커로 충분하다.
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { getAnalysisHistory } from "@/lib/api/analysis-api";

import HistoryPage from "./page";

const getHistory = vi.mocked(getAnalysisHistory);

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

function snap(id: string, type: AnalysisType): AnalysisSnapshot {
  return {
    id,
    type,
    title: `분석 ${id}`,
    status: "completed",
    createdAt: "2026-07-27T00:00:00Z",
    experienceCount: 1,
    isBookmarked: false,
  };
}

async function flush() {
  await act(async () => {});
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

describe("분석 기록 목록 — 부분 실패 안내 (FRT-170)", () => {
  it("못 불러온 유형의 이름을 대고, 살아남은 기록은 그대로 보여준다", async () => {
    getHistory.mockResolvedValue({
      items: [snap("i1", "individual"), snap("k1", "keyword")],
      failedTypes: ["comprehensive"],
    });

    render(<HistoryPage />);
    await flush();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("종합 분석");
    // 회복력은 그대로 — 살아남은 소스는 계속 보인다.
    expect(screen.getByText("분석 i1")).toBeInTheDocument();
    expect(screen.getByText("분석 k1")).toBeInTheDocument();
  });

  it("실패한 유형이 둘이면 둘 다 이름을 댄다", async () => {
    getHistory.mockResolvedValue({
      items: [snap("c1", "comprehensive")],
      failedTypes: ["individual", "keyword"],
    });

    render(<HistoryPage />);
    await flush();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("개별 분석");
    expect(alert).toHaveTextContent("키워드 분석");
  });

  it("안내의 '다시 시도'는 목록을 다시 읽는다", async () => {
    getHistory.mockResolvedValue({
      items: [snap("i1", "individual")],
      failedTypes: ["comprehensive"],
    });

    render(<HistoryPage />);
    await flush();
    expect(getHistory).toHaveBeenCalledTimes(1);

    await click(screen.getByRole("button", { name: "다시 시도" }));
    await flush();

    expect(getHistory).toHaveBeenCalledTimes(2);
  });

  it("실패가 없으면 안내를 띄우지 않는다", async () => {
    getHistory.mockResolvedValue({
      items: [snap("i1", "individual")],
      failedTypes: [],
    });

    render(<HistoryPage />);
    await flush();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("보고 있는 유형이 실패했으면 '아직 분석 결과가 없습니다'로 위장하지 않는다", async () => {
    // 이 버그의 가장 날카로운 형태 — 목록이 비었는데 원인이 실패다.
    // 빈 상태 문구를 그대로 두면 화면이 사용자에게 거짓말을 한다.
    getHistory.mockResolvedValue({ items: [], failedTypes: ["comprehensive"] });

    render(<HistoryPage />);
    await flush();
    await click(screen.getByRole("tab", { name: "종합" }));
    await flush();

    expect(screen.queryByText("아직 분석 결과가 없습니다.")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("종합 분석");
  });

  it("보고 있지 않은 유형의 실패는 알리지 않는다", async () => {
    // 종합 탭의 목록은 키워드 실패와 무관하게 정확하다 — 알릴 '변화'가 없으면 알리지 않는다.
    getHistory.mockResolvedValue({
      items: [snap("c1", "comprehensive")],
      failedTypes: ["keyword"],
    });

    render(<HistoryPage />);
    await flush();
    await click(screen.getByRole("tab", { name: "종합" }));
    await flush();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("분석 c1")).toBeInTheDocument();
  });

  it("정말 아무 기록도 없고 실패도 없으면 기존 빈 상태를 그대로 보여준다", async () => {
    getHistory.mockResolvedValue({ items: [], failedTypes: [] });

    render(<HistoryPage />);
    await flush();

    expect(screen.getByText("아직 분석 결과가 없습니다.")).toBeInTheDocument();
  });

  it("전부 실패(throw)는 기존대로 전체 에러 화면으로 간다", async () => {
    getHistory.mockRejectedValue(new Error("분석 기록을 불러올 수 없습니다."));

    render(<HistoryPage />);
    await flush();

    expect(screen.getByText("데이터를 불러오지 못했습니다.")).toBeInTheDocument();
  });
});
