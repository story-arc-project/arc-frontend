import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnalysisHomeSummary, AnalysisSnapshot, AnalysisType } from "@/types/analysis";

// FRT-169: 이 화면은 개별·종합·키워드 목록 + 경험 목록 넷을 병합해 요약한다. 일부만 실패해도
// 예전엔 그 사실이 어디에도 안 남아, 목록은 "결과 없음"으로 위장되고 상단 통계는 과소집계된
// 숫자를 확신 있게 보여줬다. 여기서 지키는 계약은 셋이다:
//   (1) 못 불러온 것의 이름을 댄다
//   (2) 실패를 "결과 없음"으로 위장하지 않는다
//   (3) 믿을 수 없는 숫자는 숫자인 척하지 않는다("—")

vi.mock("@/lib/api/analysis-api", () => ({
  getAnalysisHomeSummary: vi.fn(),
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/utils/use-base-path", () => ({ useBasePath: () => "" }));

import { getAnalysisHomeSummary } from "@/lib/api/analysis-api";

import AnalysisHomePage from "./page";

const getSummary = vi.mocked(getAnalysisHomeSummary);

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

function summary(overrides: Partial<AnalysisHomeSummary> = {}): AnalysisHomeSummary {
  return {
    stats: { totalExperiences: 5, analysisCompleted: 3, lastAnalysisAt: "2026-07-27T00:00:00Z" },
    recentIndividual: [snap("i1", "individual")],
    recentComprehensive: [snap("c1", "comprehensive")],
    recentKeyword: [snap("k1", "keyword")],
    recommendations: { experienceGroups: [], suggestedKeywords: [] },
    failedTypes: [],
    experiencesFailed: false,
    ...overrides,
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

/** 통계 카드는 값과 라벨이 형제 요소다 — 라벨로 카드를 찾아 그 안의 값을 읽는다. */
function statValue(label: string): string {
  const labelNode = screen.getByText(label);
  const card = labelNode.closest("div")?.parentElement;
  return card?.querySelector("p")?.textContent ?? "";
}

describe("분석 홈 — 부분 실패 안내 (FRT-169)", () => {
  it("못 불러온 유형의 이름을 대고, 살아남은 목록은 그대로 보여준다", async () => {
    getSummary.mockResolvedValue(summary({ failedTypes: ["comprehensive"] }));

    render(<AnalysisHomePage />);
    await flush();

    expect(screen.getByRole("alert")).toHaveTextContent("종합 분석");
    // 회복력은 그대로 — 기본 탭(개별)의 살아남은 기록은 계속 보인다.
    expect(screen.getByText("분석 i1")).toBeInTheDocument();
    // 목록 항목 제목은 리스트 항목 제목 토큰이어야 한다. font-medium(500)이 남으면
    // .text-title 의 600 을 덮어써 절반만 고친 상태가 된다. min-w-0 은 truncate 가 실제로
    // 발동하기 위한 짝 — flex item 의 기본 min-width:auto 를 풀어준다 (FRT-127).
    expect(screen.getByText("분석 i1")).toHaveClass("text-title");
    expect(screen.getByText("분석 i1")).not.toHaveClass("font-medium");
    expect(screen.getByText("분석 i1")).toHaveClass("min-w-0");
  });

  it("경험 목록 실패도 이름을 댄다 — 전체 경험이 0으로 보이는 이유다", async () => {
    getSummary.mockResolvedValue(
      summary({ experiencesFailed: true, stats: { totalExperiences: 0, analysisCompleted: 3, lastAnalysisAt: "2026-07-27T00:00:00Z" } }),
    );

    render(<AnalysisHomePage />);
    await flush();

    expect(screen.getByRole("alert")).toHaveTextContent("경험 목록");
  });

  it("실패가 없으면 안내를 띄우지 않는다", async () => {
    getSummary.mockResolvedValue(summary());

    render(<AnalysisHomePage />);
    await flush();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("실패한 유형의 탭에서 '아직 분석 결과가 없습니다'로 위장하지 않는다", async () => {
    getSummary.mockResolvedValue(
      summary({ failedTypes: ["keyword"], recentKeyword: [] }),
    );

    render(<AnalysisHomePage />);
    await flush();
    await click(screen.getByRole("tab", { name: "키워드" }));

    expect(screen.queryByText("아직 분석 결과가 없습니다.")).not.toBeInTheDocument();
    expect(screen.getByText("이 유형의 분석 기록을 불러오지 못했어요.")).toBeInTheDocument();
  });

  it("실패하지 않은 유형이 정말 비어 있으면 기존 빈 상태를 그대로 보여준다", async () => {
    getSummary.mockResolvedValue(
      summary({ failedTypes: ["keyword"], recentComprehensive: [] }),
    );

    render(<AnalysisHomePage />);
    await flush();
    await click(screen.getByRole("tab", { name: "종합" }));

    expect(screen.getByText("아직 분석 결과가 없습니다.")).toBeInTheDocument();
  });

  it("분석 유형이 실패하면 분석 완료·최근 분석 수치를 '—'로 물린다", async () => {
    getSummary.mockResolvedValue(summary({ failedTypes: ["comprehensive"] }));

    render(<AnalysisHomePage />);
    await flush();

    expect(statValue("분석 완료")).toBe("—");
    expect(statValue("최근 분석")).toBe("—");
    // 경험 목록은 멀쩡하므로 그 숫자는 그대로 믿을 수 있다.
    expect(statValue("전체 경험")).toBe("5");
  });

  it("경험 목록이 실패하면 전체 경험만 '—'다 — 분석 숫자는 여전히 정확하다", async () => {
    getSummary.mockResolvedValue(
      summary({ experiencesFailed: true, stats: { totalExperiences: 0, analysisCompleted: 3, lastAnalysisAt: "2026-07-27T00:00:00Z" } }),
    );

    render(<AnalysisHomePage />);
    await flush();

    expect(statValue("전체 경험")).toBe("—");
    expect(statValue("분석 완료")).toBe("3");
  });

  it("다시 시도를 누르면 요약을 다시 불러온다", async () => {
    getSummary.mockResolvedValue(summary({ failedTypes: ["keyword"] }));

    render(<AnalysisHomePage />);
    await flush();
    getSummary.mockResolvedValue(summary());
    await click(screen.getByRole("button", { name: "다시 시도" }));
    await flush();

    expect(getSummary).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("전부 실패하면 기존대로 전체 에러 화면으로 간다", async () => {
    getSummary.mockRejectedValue(new Error("분석 데이터를 불러올 수 없습니다."));

    render(<AnalysisHomePage />);
    await flush();

    expect(screen.getByText("데이터를 불러오지 못했습니다.")).toBeInTheDocument();
  });
});
