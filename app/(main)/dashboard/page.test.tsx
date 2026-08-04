import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnalysisHomeSummary, AnalysisSnapshot, AnalysisType } from "@/types/analysis";

// FRT-169: 대시보드도 `getAnalysisHomeSummary` 를 소비한다. 부분 실패가 무음이던 시절엔
// '분석 완료' 카운트가 과소집계된 값을 그대로 "N회"라고 말했고, 그 카운트가 0으로 떨어지면
// (경험도 0인 사용자에겐) **최근 분석 섹션 자체가 사라져** 못 불러왔다고 말할 자리조차 없었다.

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

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { profile: { name: "상협" } } }),
}));

const experiencesState = { experiences: [] as unknown[], count: 0 };
vi.mock("@/hooks/useExperiences", () => ({
  useExperiences: () => ({
    experiences: experiencesState.experiences,
    count: experiencesState.count,
    isLoading: false,
    error: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/contexts/FeedbackTriggerContext", () => ({
  useReportExperienceCount: () => {},
}));

import { getAnalysisHomeSummary } from "@/lib/api/analysis-api";

import DashboardPage from "./page";

const getSummary = vi.mocked(getAnalysisHomeSummary);

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  // 경험이 0개인 사용자 — 마지막 경험을 지웠지만 분석 기록은 남아 있는 상태.
  experiencesState.experiences = [];
  experiencesState.count = 0;
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

describe("대시보드 — 분석 요약 부분 실패 안내 (FRT-169)", () => {
  it("과소집계로 분석 완료가 0이 되어도 최근 분석 섹션이 사라지지 않는다", async () => {
    // 경험 0 + 분석 목록 전부 실패 → 예전엔 섹션 자체가 증발해 안내할 자리조차 없었다.
    getSummary.mockResolvedValue(
      summary({
        failedTypes: ["individual", "comprehensive", "keyword"],
        stats: { totalExperiences: 0, analysisCompleted: 0, lastAnalysisAt: "" },
        recentIndividual: [],
        recentComprehensive: [],
        recentKeyword: [],
      }),
    );

    render(<DashboardPage />);
    await flush();

    expect(screen.getByRole("heading", { name: "최근 분석" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("개별 분석·종합 분석·키워드 분석");
  });

  it("분석 유형이 실패하면 '분석 완료' 라벨을 '—'로 물린다", async () => {
    getSummary.mockResolvedValue(summary({ failedTypes: ["keyword"] }));

    render(<DashboardPage />);
    await flush();

    const card = screen.getByText("분석 완료").closest("div")?.parentElement;
    expect(card?.querySelector("p")?.textContent).toBe("—");
  });

  it("실패가 없으면 기존대로 횟수를 보여주고 안내를 띄우지 않는다", async () => {
    getSummary.mockResolvedValue(summary());

    render(<DashboardPage />);
    await flush();

    const card = screen.getByText("분석 완료").closest("div")?.parentElement;
    expect(card?.querySelector("p")?.textContent).toBe("3회");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("실패한 유형의 탭에서 '아직 분석 결과가 없습니다'로 위장하지 않는다", async () => {
    getSummary.mockResolvedValue(
      summary({ failedTypes: ["keyword"], recentKeyword: [] }),
    );

    render(<DashboardPage />);
    await flush();
    await click(screen.getByRole("tab", { name: "키워드" }));

    expect(screen.queryByText("아직 분석 결과가 없습니다.")).not.toBeInTheDocument();
    expect(screen.getByText("이 유형의 분석 기록을 불러오지 못했어요.")).toBeInTheDocument();
  });

  it("다시 시도를 누르면 요약을 다시 불러온다", async () => {
    getSummary.mockResolvedValue(summary({ failedTypes: ["comprehensive"] }));

    render(<DashboardPage />);
    await flush();
    getSummary.mockResolvedValue(summary());
    await click(screen.getByRole("button", { name: "다시 시도" }));
    await flush();

    expect(getSummary).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("전부 실패하면 기존대로 섹션 안 전체 에러로 전환된다", async () => {
    getSummary.mockRejectedValue(new Error("분석 데이터를 불러올 수 없습니다."));

    render(<DashboardPage />);
    await flush();

    expect(screen.getByText("분석 데이터를 불러오지 못했습니다.")).toBeInTheDocument();
  });
});
