import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { IndividualAnalysisResult } from "@/types/analysis";

// FRT-134: 결과 본문이 안 온 상태로 상세에 진입했을 때 조용한 빈 화면이 뜨지 않는다.
// 진입 경로는 실재한다 — 북마크 목록은 status 게이팅이 없어 진행 중인 분석도 열린다.

vi.mock("@/lib/api/analysis-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/analysis-api")>();
  return { ...actual, getIndividualAnalysisResult: vi.fn() };
});

vi.mock("next/navigation", () => ({
  useParams: () => ({ analysisId: "ind-1" }),
  usePathname: () => "/analysis/individual/ind-1",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { getIndividualAnalysisResult } from "@/lib/api/analysis-api";

import IndividualAnalysisDetailPage from "./page";

const getResult = vi.mocked(getIndividualAnalysisResult);

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

function emptyBody(): IndividualAnalysisResult["result"] {
  return {
    status: "",
    itemName: "",
    itemType: "",
    briefSummary: "",
    deepAnalysis: {
      careerValue: "",
      strengths: [],
      limitations: [],
      applicableRoles: [],
      marketValue: "",
    },
    starFormat: { title: "", situation: "", task: "", action: "", result: "" },
    itemDiagnosis: {
      oneLineVerdict: "",
      weaknesses: [],
      missingElements: [],
      rewriteSuggestion: "",
    },
    synergyRecommendations: [],
    actionPlan: { shortTerm: "", midTerm: "", longTerm: "" },
    missingInfoWarning: "",
  };
}

function result(overrides: Partial<IndividualAnalysisResult>): IndividualAnalysisResult {
  return {
    id: "ind-1",
    status: "completed",
    experienceId: "exp-1",
    isBookmarked: false,
    hasResultBody: true,
    result: emptyBody(),
    ...overrides,
  };
}

describe("개별 분석 상세 — 본문 부재 화면 (FRT-134)", () => {
  it("진행 중이면 빈 화면 대신 진행 중 안내가 뜬다", async () => {
    getResult.mockResolvedValue(
      result({ status: "processing", hasResultBody: false }),
    );
    render(<IndividualAnalysisDetailPage />);

    expect(await screen.findByText("분석이 아직 진행 중이에요")).toBeInTheDocument();
    // 회귀 시엔 이 제목만 덩그러니 남은 화면이 떴다.
    expect(screen.queryByRole("heading", { name: "이력 분석" })).not.toBeInTheDocument();
  });

  it("실패면 실패라고 알린다", async () => {
    getResult.mockResolvedValue(result({ status: "failed", hasResultBody: false }));
    render(<IndividualAnalysisDetailPage />);

    expect(await screen.findByText("분석에 실패했습니다")).toBeInTheDocument();
  });

  it("본문이 오면 평소대로 결과를 그린다", async () => {
    getResult.mockResolvedValue(
      result({
        result: { ...emptyBody(), itemName: "뉴스 감성 분석 프로젝트", briefSummary: "요약" },
      }),
    );
    render(<IndividualAnalysisDetailPage />);

    expect(
      await screen.findByRole("heading", { name: "뉴스 감성 분석 프로젝트" }),
    ).toBeInTheDocument();
    expect(screen.getByText("요약")).toBeInTheDocument();
    expect(screen.queryByText("분석이 아직 진행 중이에요")).not.toBeInTheDocument();
  });

  it("불러오기 실패는 본문 부재와 다르게 취급한다 — 상태 안내가 아니라 오류다", async () => {
    getResult.mockRejectedValue(new Error("network"));
    render(<IndividualAnalysisDetailPage />);

    await waitFor(() =>
      expect(screen.getByText("분석 결과를 불러오지 못했습니다.")).toBeInTheDocument(),
    );
  });
});
