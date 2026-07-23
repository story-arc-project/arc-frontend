import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ComprehensiveAnalysisResult } from "@/types/analysis";
import { mockComprehensiveResult } from "@/lib/api/mocks/analysis";

// FRT-134: 결과 본문이 안 온 상태로 상세에 진입했을 때 조용한 빈 화면(헤더+경험 배지만) 대신
// 상태 안내가 뜬다. 진입 경로는 실재한다 — 북마크 목록은 status 게이팅이 없다.

vi.mock("@/lib/api/analysis-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/analysis-api")>();
  return { ...actual, getComprehensiveResult: vi.fn() };
});

vi.mock("next/navigation", () => ({
  useParams: () => ({ analysisId: "comp-1" }),
  usePathname: () => "/analysis/comprehensive/comp-1",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { getComprehensiveResult } from "@/lib/api/analysis-api";

import ComprehensiveDetailPage from "./page";

const getResult = vi.mocked(getComprehensiveResult);

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

function result(overrides: Partial<ComprehensiveAnalysisResult>): ComprehensiveAnalysisResult {
  return { ...mockComprehensiveResult, ...overrides };
}

describe("종합 분석 상세 — 본문 부재 화면 (FRT-134)", () => {
  it("진행 중이면 경험 배지만 남은 빈 화면 대신 진행 중 안내가 뜬다", async () => {
    getResult.mockResolvedValue(result({ status: "processing", hasResultBody: false }));
    render(<ComprehensiveDetailPage />);

    expect(await screen.findByText("분석이 아직 진행 중이에요")).toBeInTheDocument();
    // 회귀 시엔 이 제목과 경험 배지만 덩그러니 남은 화면이 떴다.
    expect(screen.queryByRole("heading", { name: "종합 분석 결과" })).not.toBeInTheDocument();
  });

  it("실패면 실패라고 알린다", async () => {
    getResult.mockResolvedValue(result({ status: "failed", hasResultBody: false }));
    render(<ComprehensiveDetailPage />);

    expect(await screen.findByText("분석에 실패했습니다")).toBeInTheDocument();
  });

  it("본문이 오면 평소대로 결과를 그린다", async () => {
    getResult.mockResolvedValue(result({ hasResultBody: true }));
    render(<ComprehensiveDetailPage />);

    expect(
      await screen.findByRole("heading", { name: "종합 분석 결과" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("분석이 아직 진행 중이에요")).not.toBeInTheDocument();
  });

  it("불러오기 실패는 본문 부재와 다르게 취급한다 — 상태 안내가 아니라 오류다", async () => {
    getResult.mockRejectedValue(new Error("network"));
    render(<ComprehensiveDetailPage />);

    await waitFor(() =>
      expect(screen.getByText("분석 결과를 불러오지 못했습니다.")).toBeInTheDocument(),
    );
  });
});
