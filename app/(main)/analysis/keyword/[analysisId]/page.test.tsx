import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import type { KeywordAnalysisResult } from "@/types/analysis";
import { mockKeywordResult } from "@/lib/api/mocks/analysis";

// FRT-134: 결과 본문(A~F)이 안 온 상태로 상세에 진입했을 때 조용한 빈 화면(헤더+키워드 배지만)
// 대신 상태 안내가 뜬다. 진입 경로는 실재한다 — 북마크 목록은 status 게이팅이 없다.

vi.mock("@/lib/api/analysis-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/analysis-api")>();
  return { ...actual, getKeywordResult: vi.fn() };
});

vi.mock("next/navigation", () => ({
  useParams: () => ({ analysisId: "kw-1" }),
  usePathname: () => "/analysis/keyword/kw-1",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { getKeywordResult } from "@/lib/api/analysis-api";

import KeywordDetailPage from "./page";

const getResult = vi.mocked(getKeywordResult);

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

function result(overrides: Partial<KeywordAnalysisResult>): KeywordAnalysisResult {
  return { ...mockKeywordResult, ...overrides };
}

describe("키워드 분석 상세 — 본문 부재 화면 (FRT-134)", () => {
  it("진행 중이면 키워드 배지만 남은 빈 화면 대신 진행 중 안내가 뜬다", async () => {
    getResult.mockResolvedValue(result({ status: "processing", hasResultBody: false }));
    render(<KeywordDetailPage />);

    expect(await screen.findByText("분석이 아직 진행 중이에요")).toBeInTheDocument();
    // 회귀 시엔 키워드 제목과 배지만 남은 화면이 떴다.
    expect(screen.queryByRole("heading", { name: /키워드 분석/ })).not.toBeInTheDocument();
  });

  it("실패면 실패라고 알린다", async () => {
    getResult.mockResolvedValue(result({ status: "failed", hasResultBody: false }));
    render(<KeywordDetailPage />);

    expect(await screen.findByText("분석에 실패했습니다")).toBeInTheDocument();
  });

  it("본문이 오면 평소대로 결과를 그린다", async () => {
    getResult.mockResolvedValue(result({ hasResultBody: true }));
    render(<KeywordDetailPage />);

    expect(
      await screen.findByRole("heading", { name: "'문제 해결 · 자기주도성' 키워드 분석" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("분석이 아직 진행 중이에요")).not.toBeInTheDocument();
  });

  it("불러오기 실패는 본문 부재와 다르게 취급한다 — 상태 안내가 아니라 오류다", async () => {
    getResult.mockRejectedValue(new Error("network"));
    render(<KeywordDetailPage />);

    await waitFor(() =>
      expect(screen.getByText("분석 결과를 불러오지 못했습니다.")).toBeInTheDocument(),
    );
  });
});


describe("FRT-137 — 근거 없는 커버리지 비율 숨김", () => {
  it.each([
    { relatedCount: 2, totalCount: 0, coveragePercent: 80 },
    { relatedCount: 4, totalCount: 3, coveragePercent: 100 },
    { relatedCount: 2, totalCount: 5, coveragePercent: null },
    { relatedCount: 2, totalCount: 5, coveragePercent: 120 },
  ])("유효하지 않은 비율과 진행 막대를 숨기고 등급 개수는 보존한다: %j", async (coverage) => {
    getResult.mockResolvedValue(result({
      hasResultBody: true,
      coverage: [{ keyword: "협업", highCount: 2, mediumCount: 0, lowCount: 0, ...coverage }],
    }));
    render(<KeywordDetailPage />);
    const heading = await screen.findByRole("heading", { name: "커버리지" });
    const section = within(heading.closest("section")!);
    expect(section.getByText("협업")).toBeInTheDocument();
    expect(section.getByText("높음 2")).toBeInTheDocument();
    expect(section.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(section.queryByText(/%|\//)).not.toBeInTheDocument();
  });

  it("정상 분모의 API 비율은 표시한다", async () => {
    getResult.mockResolvedValue(result({
      hasResultBody: true,
      coverage: [{ keyword: "협업", relatedCount: 2, totalCount: 5, coveragePercent: 37.5, highCount: 2, mediumCount: 0, lowCount: 0 }],
    }));
    render(<KeywordDetailPage />);
    expect(await screen.findByText("2/5 · 38%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "협업 커버리지" })).toHaveAttribute("aria-valuenow", "38");
  });
});
