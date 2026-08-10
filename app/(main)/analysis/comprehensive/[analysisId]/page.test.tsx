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

describe("종합 분석 상세 — v2.0 섹션 렌더", () => {
  it("강점 진단 섹션을 critical_diagnosis 앞에 그린다", async () => {
    getResult.mockResolvedValue(result({ hasResultBody: true }));
    render(<ComprehensiveDetailPage />);

    const strength = await screen.findByRole("heading", { name: "강점 진단" });
    const critical = screen.getByRole("heading", { name: "보완 포인트" });
    expect(strength).toBeInTheDocument();
    // DOM 순서상 강점 진단이 보완 포인트보다 앞에 온다(앵커링 저항).
    expect(strength.compareDocumentPosition(critical)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("강점이 없으면 개선 방향을 안내한다", async () => {
    getResult.mockResolvedValue(
      result({
        hasResultBody: true,
        strengthDiagnosis: {
          oneLineVerdict: "",
          strengths: [],
          noStrengthDiagnosis: {
            hasIssue: true,
            reason: "아직 직무 연관 경험이 부족합니다.",
            improvementDirection: "관련 프로젝트를 1건 추가해보세요.",
          },
          standoutExperienceTypes: [],
          contentQualityHighlights: [],
          competitorAdvantage: "",
        },
      }),
    );
    render(<ComprehensiveDetailPage />);

    expect(await screen.findByText("관련 프로젝트를 1건 추가해보세요.")).toBeInTheDocument();
  });

  it("추가 활동 추천을 객체 카드(이름·추천 이유)로 그린다", async () => {
    getResult.mockResolvedValue(result({ hasResultBody: true }));
    render(<ComprehensiveDetailPage />);

    // 회귀 시엔 asStringArray 로 뭉개져 자격증 섹션이 통째로 비었다.
    expect(await screen.findByText("ADsP (데이터분석 준전문가)")).toBeInTheDocument();
    expect(screen.getByText("추천 자격증")).toBeInTheDocument();
  });

  it("동아리 추천은 활동 내용과 추천 이유를 함께 보여준다", async () => {
    getResult.mockResolvedValue(result({ hasResultBody: true }));
    render(<ComprehensiveDetailPage />);

    // 회귀 시엔 `reason || description` 이라 description(그 단체가 무엇을 하는지)이 통째로 버려졌다.
    expect(
      await screen.findByText(
        "머신러닝·데이터 분야 오픈 스터디와 논문 리뷰를 진행하는 커뮤니티",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("학회 운영 경험을 교외 커뮤니티로 넓혀 외부 네트워크를 만들 수 있습니다.")).toBeInTheDocument();
  });

  it("마감된 채용 공고를 '마감된 공고'로 별도 표기한다", async () => {
    getResult.mockResolvedValue(result({ hasResultBody: true }));
    render(<ComprehensiveDetailPage />);

    expect(await screen.findByText("마감된 공고")).toBeInTheDocument();
  });

  it("마감 공고만 남았을 때 '유효' 표기를 붙이지 않는다", async () => {
    getResult.mockResolvedValue(
      result({
        hasResultBody: true,
        verifiedJobs: [],
        expiredJobs: [
          {
            company: "라인",
            role: "ML 엔지니어",
            deadline: "2026-06-30",
            whyMatch: "마감이 지났습니다.",
            url: "",
          },
        ],
      }),
    );
    render(<ComprehensiveDetailPage />);

    // 회귀 시엔 마감 공고만 깔린 섹션 제목이 "유효 채용 공고" 였다.
    expect(await screen.findByRole("heading", { name: "채용 공고" })).toBeInTheDocument();
    expect(screen.queryByText("유효 채용 공고")).not.toBeInTheDocument();
    expect(screen.queryByText("유효 공고")).not.toBeInTheDocument();
    expect(screen.getByText("마감된 공고")).toBeInTheDocument();
  });
});

describe("종합 분석 상세 — v3.1 STAR (FRT-208)", () => {
  /** v2.0 백엔드 응답의 star_analysis_status — 섹션 자체가 없다. */
  const absentStatus: ComprehensiveAnalysisResult["starAnalysisStatus"] = {
    present: false,
    generated: false,
    reason: "",
    experienceBlockCount: 0,
    starEligibleBlockCount: 0,
    coaching: [],
    rejectedEntries: [],
    qualityReview: null,
  };

  it("STAR 를 못 만들었으면 이유와 쓰는 법을 알려준다 (섹션이 사라지지 않는다)", async () => {
    // 회귀의 핵심: v3.1 은 못 만든 이유를 star_analysis_status 로 보내는데, 배열이 비었다고
    // 섹션째 null 을 반환하면 그 이유가 화면에 도달할 길이 없다(FRT-169 와 같은 형태).
    getResult.mockResolvedValue(
      result({
        hasResultBody: true,
        resumeStarFormat: [],
        starAnalysisStatus: {
          ...absentStatus,
          present: true,
          generated: false,
          reason: "STAR 로 쓸 만큼 자세한 경험 기록이 아직 없어요.",
          experienceBlockCount: 3,
          starEligibleBlockCount: 0,
          coaching: ["내가 맡은 역할을 한 문장으로 적어보세요."],
        },
      }),
    );
    render(<ComprehensiveDetailPage />);

    expect(
      await screen.findByText("STAR 로 쓸 만큼 자세한 경험 기록이 아직 없어요."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("내가 맡은 역할을 한 문장으로 적어보세요."),
    ).toBeInTheDocument();
  });

  it("근거가 없어 빠진 경험은 무엇이 빠졌는지 알려준다", async () => {
    getResult.mockResolvedValue(
      result({
        hasResultBody: true,
        resumeStarFormat: [],
        starAnalysisStatus: {
          ...absentStatus,
          present: true,
          generated: false,
          reason: "근거를 찾지 못했어요.",
          rejectedEntries: [
            {
              title: "교내 코딩 동아리 활동",
              reason: "행동과 결과를 뒷받침할 문장을 찾지 못했습니다.",
              unsupportedSlots: ["A", "R"],
              coaching: "무엇을 맡아 어떻게 했는지 적어보세요.",
            },
          ],
        },
      }),
    );
    render(<ComprehensiveDetailPage />);

    expect(await screen.findByText("교내 코딩 동아리 활동")).toBeInTheDocument();
    expect(screen.getByText("무엇을 맡아 어떻게 했는지 적어보세요.")).toBeInTheDocument();
  });

  it("v2.0 응답(status 부재)에서 STAR 가 0건이면 섹션을 그리지 않는다", async () => {
    // 부재를 "만들지 못했다"로 읽으면 v2.0 사용자에게 이유가 빈 안내가 뜬다.
    getResult.mockResolvedValue(
      result({ hasResultBody: true, resumeStarFormat: [], starAnalysisStatus: absentStatus }),
    );
    render(<ComprehensiveDetailPage />);

    await screen.findByRole("heading", { name: "종합 분석 결과" });
    expect(screen.queryByRole("heading", { name: "자소서용 STAR" })).not.toBeInTheDocument();
  });

  it("한 줄 성취문(headline)과 배움(L)을 보여준다", async () => {
    getResult.mockResolvedValue(result({ hasResultBody: true }));
    render(<ComprehensiveDetailPage />);

    expect(
      await screen.findByText(
        "판단이 갈리던 320건을 6개 패턴으로 정리해 데이터 신뢰도를 끌어올림",
      ),
    ).toBeInTheDocument();
    // 배움(L)은 원문에 명시된 경우에만 오므로, 값이 있을 때만 칸이 생긴다.
    // 라벨은 근거 인용 쪽에도 쓰이므로 값으로 확인한다.
    expect(
      screen.getByText("모델을 바꾸는 것보다 판단 기준을 다시 세우는 편이 점수를 올렸다는 것"),
    ).toBeInTheDocument();
  });

  it("등급·점수·총평·우선 개선점을 함께 표기한다", async () => {
    getResult.mockResolvedValue(result({ hasResultBody: true }));
    render(<ComprehensiveDetailPage />);

    expect(await screen.findByText("9/10")).toBeInTheDocument();
    expect(
      screen.getByText("행동과 결과가 원문 근거로 잘 묶여 있어 그대로 써도 좋아요."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("'왜 문제였는지'와 '내가 맡은 일'을 다른 문장으로 나눠보세요."),
    ).toBeInTheDocument();
    // 등급 문자는 배지로 보인다.
    expect(screen.getByText(/충분해요/)).toBeInTheDocument();
  });

  it("입력을 재배치한 수준이면 그 사실을 알려준다", async () => {
    getResult.mockResolvedValue(result({ hasResultBody: true }));
    render(<ComprehensiveDetailPage />);

    expect(
      await screen.findByText(
        "입력 문장을 슬롯별로 재배치한 수준이에요. 과제와 상황을 다른 문장으로 나눠 적으면 훨씬 또렷해집니다.",
      ),
    ).toBeInTheDocument();
  });

  it("원문 근거는 접어서 보여준다 (기본은 닫힘)", async () => {
    getResult.mockResolvedValue(result({ hasResultBody: true }));
    render(<ComprehensiveDetailPage />);

    const summaries = await screen.findAllByText("이 문장의 근거");
    expect(summaries.length).toBeGreaterThan(0);
    const details = summaries[0].closest("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
    // 인용문 자체는 접힌 상태로도 DOM 에 있다.
    expect(
      screen.getByText("'인용된 혐오 표현'을 혐오로 볼지 의견이 갈려 2주간 결론이 나지 않았습니다."),
    ).toBeInTheDocument();
  });

  it("근거를 못 찾은 슬롯은 그 사유를 알려준다", async () => {
    getResult.mockResolvedValue(result({ hasResultBody: true }));
    render(<ComprehensiveDetailPage />);

    expect(
      await screen.findByText("원문에서 '내가 맡은 과제'로 볼 문장을 찾지 못했습니다."),
    ).toBeInTheDocument();
  });

  it("포트폴리오 전체 총평을 한 번 보여준다", async () => {
    getResult.mockResolvedValue(result({ hasResultBody: true }));
    render(<ComprehensiveDetailPage />);

    expect(
      await screen.findByText(
        "한 건은 그대로 써도 좋고, 두 건은 출발점만 채우면 크게 좋아져요.",
      ),
    ).toBeInTheDocument();
  });

  it("일부만 만들어졌어도 빠진 경험의 사유를 알려준다", async () => {
    // 일부 생성(generated: true) + 빠진 경험이 함께 오는 형태가 실제 응답이다(mock 기본값).
    // "못 만들었을 때만" 안내를 그리면 카드는 보이는데 빠진 이유만 조용히 사라진다.
    getResult.mockResolvedValue(result({ hasResultBody: true }));
    render(<ComprehensiveDetailPage />);

    await screen.findByRole("heading", { name: "자소서용 STAR" });
    expect(screen.getAllByText("SQL 개발자 (SQLD)")).toHaveLength(1);
    expect(
      screen.getByText(
        "이 자격증을 실제로 써서 해결한 일이 있다면 그 사례를 따로 적어보세요. STAR 로 만들 수 있어요.",
      ),
    ).toBeInTheDocument();
  });

  it("총평 문장이 없어도 우선 개선점은 보여준다", async () => {
    // 총평만 게이트로 쓰면, 본문 판정(hasResultBody)은 개선점을 컨텐츠로 세는데
    // 화면은 그 개선점을 통째로 감추는 모순이 생긴다.
    getResult.mockResolvedValue(
      result({
        hasResultBody: true,
        starAnalysisStatus: {
          ...mockComprehensiveResult.starAnalysisStatus,
          qualityReview: {
            evaluated: 2,
            gradeDistribution: { A: 1, C: 1 },
            portfolioVerdict: "",
            topFixes: ["Action 비중 — 2건 중 1건에서 미달"],
          },
        },
      }),
    );
    render(<ComprehensiveDetailPage />);

    expect(
      await screen.findByText("Action 비중 — 2건 중 1건에서 미달"),
    ).toBeInTheDocument();
  });
});

describe("종합 분석 상세 — v3.1 추천 사유 (FRT-208)", () => {
  it("추천이 하나도 없어도 사유가 있으면 이유를 알려준다", async () => {
    // 지금은 3종이 모두 비면 섹션째 사라져 "왜 없는지"가 갈 곳이 없다.
    getResult.mockResolvedValue(
      result({
        hasResultBody: true,
        additionalRecommendations: {
          certifications: [],
          clubsAndSocieties: [],
          projectsAndContests: [],
        },
        recommendationNotices: ["확실한 자격증을 찾지 못해 이번엔 추천하지 않았어요."],
      }),
    );
    render(<ComprehensiveDetailPage />);

    expect(
      await screen.findByText("확실한 자격증을 찾지 못해 이번엔 추천하지 않았어요."),
    ).toBeInTheDocument();
  });

  it("추천도 사유도 없으면 섹션을 그리지 않는다", async () => {
    getResult.mockResolvedValue(
      result({
        hasResultBody: true,
        additionalRecommendations: {
          certifications: [],
          clubsAndSocieties: [],
          projectsAndContests: [],
        },
        recommendationNotices: [],
      }),
    );
    render(<ComprehensiveDetailPage />);

    await screen.findByRole("heading", { name: "종합 분석 결과" });
    expect(screen.queryByRole("heading", { name: "추가 활동 추천" })).not.toBeInTheDocument();
  });

  it("링크 검증에 실패한 추천은 직접 확인 안내를 보여준다", async () => {
    getResult.mockResolvedValue(result({ hasResultBody: true }));
    render(<ComprehensiveDetailPage />);

    // 지금은 url 이 null 이면 링크가 조용히 사라질 뿐이라 사용자가 찾아갈 방법이 없다.
    expect(
      await screen.findByText("직접 확인하십시오: 한양대 데이터 저널리즘 소모임 모집"),
    ).toBeInTheDocument();
  });
});
