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
      applicableRoles: [],
      marketValue: "",
    },
    starFormat: { title: "", situation: "", task: "", action: "", result: "" },
    starNote: "",
    itemStrengths: {
      hasGenuineStrengths: false,
      oneLineVerdict: "",
      noStrengthReason: "",
      summarizedStrengths: [],
      strengths: [],
      strongestAsset: "",
      positioningTip: "",
    },
    itemDiagnosis: {
      oneLineVerdict: "",
      limitations: [],
      weaknesses: [],
      missingElements: [],
      rewriteSuggestion: "",
    },
    synergyRecommendations: [],
    removedRecommendations: [],
    actionPlan: {
      shortTerm: { period: "", deadline: "", content: "" },
      midTerm: { period: "", deadline: "", content: "" },
      longTerm: { period: "", deadline: "", content: "" },
    },
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

// FRT-271: 백엔드가 보내던 값들이 화면에 도달하는지 — 매퍼가 읽어도 그리지 않으면 같은 증상이다.
describe("개별 분석 상세 — 강점·적합 직무·한계 (FRT-271)", () => {
  const strengths = (): IndividualAnalysisResult["result"]["itemStrengths"] => ({
    hasGenuineStrengths: true,
    oneLineVerdict: "전 구간을 혼자 이어본 것이 이 항목의 핵심이다.",
    noStrengthReason: "",
    summarizedStrengths: ["수집~시각화 단독 구현"],
    strengths: [
      {
        id: "1",
        category: "전문성_희소성",
        level: "moderate",
        title: "단독 파이프라인",
        analysis: "수집·전처리·모델링을 한 사람이 이었다.",
        evidence: "크롤러부터 대시보드까지 직접 구현",
        careerImpact: "전 구간 이해도를 증명한다.",
        leverageAction: "구조도를 한 장으로 정리하라.",
        showcaseExample: "Before: 감성 분석을 했다 → After: 일 1만건 단독 구축",
      },
    ],
    strongestAsset: "전 구간을 혼자 이어본 경험",
    positioningTip: "'왜 그 설계였나'로 이야기를 열어라.",
  });

  it("강점 섹션을 그린다 — 회귀 시 이 영역이 통째로 없었다", async () => {
    getResult.mockResolvedValue(
      result({ result: { ...emptyBody(), itemStrengths: strengths() } }),
    );
    render(<IndividualAnalysisDetailPage />);

    expect(await screen.findByRole("heading", { name: "강점" })).toBeInTheDocument();
    expect(
      screen.getByText("전 구간을 혼자 이어본 것이 이 항목의 핵심이다."),
    ).toBeInTheDocument();
    expect(screen.getByText("단독 파이프라인")).toBeInTheDocument();
    // 백엔드가 만든 7개 필드를 버리지 않는다.
    expect(screen.getByText("수집~시각화 단독 구현")).toBeInTheDocument();
    expect(screen.getByText("수집·전처리·모델링을 한 사람이 이었다.")).toBeInTheDocument();
    expect(screen.getByText("크롤러부터 대시보드까지 직접 구현")).toBeInTheDocument();
    expect(screen.getByText("전 구간 이해도를 증명한다.")).toBeInTheDocument();
    expect(screen.getByText("구조도를 한 장으로 정리하라.")).toBeInTheDocument();
    expect(
      screen.getByText("Before: 감성 분석을 했다 → After: 일 1만건 단독 구축"),
    ).toBeInTheDocument();
    expect(screen.getByText("전 구간을 혼자 이어본 경험")).toBeInTheDocument();
    expect(screen.getByText("'왜 그 설계였나'로 이야기를 열어라.")).toBeInTheDocument();
    // 개별분석 전용 등급 라벨 — 종합분석 표를 쓰면 moderate 에서 터지거나 오라벨된다.
    expect(screen.getByText("무난")).toBeInTheDocument();
  });

  it("강점이 없으면 사유만 알린다 — 강점 카드 자리를 비워두지 않는다", async () => {
    getResult.mockResolvedValue(
      result({
        result: {
          ...emptyBody(),
          itemStrengths: {
            ...strengths(),
            hasGenuineStrengths: false,
            strengths: [],
            summarizedStrengths: [],
            oneLineVerdict: "",
            strongestAsset: "",
            positioningTip: "",
            noStrengthReason: "기간·역할·성과가 모두 비어 강점을 판단할 수 없다.",
          },
        },
      }),
    );
    render(<IndividualAnalysisDetailPage />);

    expect(await screen.findByRole("heading", { name: "강점" })).toBeInTheDocument();
    expect(
      screen.getByText("기간·역할·성과가 모두 비어 강점을 판단할 수 없다."),
    ).toBeInTheDocument();
  });

  it("강점이 통째로 비면 섹션 자체를 그리지 않는다", async () => {
    getResult.mockResolvedValue(
      result({ result: { ...emptyBody(), briefSummary: "요약" } }),
    );
    render(<IndividualAnalysisDetailPage />);

    await screen.findByText("요약");
    expect(screen.queryByRole("heading", { name: "강점" })).not.toBeInTheDocument();
  });

  it("적합한 직무를 그린다", async () => {
    getResult.mockResolvedValue(
      result({
        result: {
          ...emptyBody(),
          deepAnalysis: {
            careerValue: "",
            marketValue: "",
            applicableRoles: ["데이터 분석가", "ML 엔지니어"],
          },
        },
      }),
    );
    render(<IndividualAnalysisDetailPage />);

    expect(await screen.findByText("적합한 직무")).toBeInTheDocument();
    expect(screen.getByText("데이터 분석가")).toBeInTheDocument();
    expect(screen.getByText("ML 엔지니어")).toBeInTheDocument();
  });

  it("한계를 진단 결과 안에 그린다", async () => {
    getResult.mockResolvedValue(
      result({
        result: {
          ...emptyBody(),
          itemDiagnosis: {
            ...emptyBody().itemDiagnosis,
            limitations: ["기간이 3주로 짧다", "팀 규모가 적혀 있지 않다"],
          },
        },
      }),
    );
    render(<IndividualAnalysisDetailPage />);

    expect(await screen.findByText("한계")).toBeInTheDocument();
    expect(screen.getByText("기간이 3주로 짧다")).toBeInTheDocument();
    expect(screen.getByText("팀 규모가 적혀 있지 않다")).toBeInTheDocument();
  });

  // 백엔드 프롬프트의 앵커링 저항 원칙(강점 → 약점)과 화면 순서를 맞춘다.
  it("강점을 진단 결과보다 먼저 놓는다", async () => {
    getResult.mockResolvedValue(
      result({
        result: {
          ...emptyBody(),
          itemStrengths: strengths(),
          itemDiagnosis: {
            ...emptyBody().itemDiagnosis,
            oneLineVerdict: "서술이 얇다.",
          },
        },
      }),
    );
    render(<IndividualAnalysisDetailPage />);

    const strengthHeading = await screen.findByRole("heading", { name: "강점" });
    const diagnosisHeading = screen.getByRole("heading", { name: "진단 결과" });
    expect(
      strengthHeading.compareDocumentPosition(diagnosisHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

// ─── 스키마 v1.2 가 화면에 닿는가 ───────────────────────────
describe("개별 분석 상세 — 스키마 v1.2", () => {
  const bucket = (content: string, period = "", deadline = "") => ({
    period,
    deadline,
    content,
  });

  it("액션 플랜의 절대 기간·마감일을 함께 보여준다", async () => {
    getResult.mockResolvedValue(
      result({
        result: {
          ...emptyBody(),
          actionPlan: {
            shortTerm: bucket("SQL 포트폴리오 정리", "2026-09-01 ~ 2026-12-01", "2026-12-01"),
            midTerm: bucket(""),
            longTerm: bucket(""),
          },
        },
      }),
    );
    render(<IndividualAnalysisDetailPage />);

    expect(await screen.findByText("SQL 포트폴리오 정리")).toBeInTheDocument();
    expect(screen.getByText("2026-09-01 ~ 2026-12-01")).toBeInTheDocument();
    expect(screen.getByText("마감 2026-12-01")).toBeInTheDocument();
  });

  // v1.0 레코드는 기간·마감일이 없다. 그 자리에 빈 줄이 남으면 안 된다.
  it("기간·마감일이 없는 v1.0 레코드도 내용만으로 그린다", async () => {
    getResult.mockResolvedValue(
      result({
        result: {
          ...emptyBody(),
          actionPlan: {
            shortTerm: bucket("3개월 이내 SQL 학습"),
            midTerm: bucket(""),
            longTerm: bucket(""),
          },
        },
      }),
    );
    render(<IndividualAnalysisDetailPage />);

    expect(await screen.findByText("3개월 이내 SQL 학습")).toBeInTheDocument();
    expect(screen.queryByText(/^마감 /)).not.toBeInTheDocument();
  });

  // 내용 없이 기간·마감일만 온 칸을 살리면 "행동은 없는데 마감일만 있는" 카드가 남는다.
  it("내용이 빈 칸은 마감일이 있어도 그리지 않는다", async () => {
    getResult.mockResolvedValue(
      result({
        result: {
          ...emptyBody(),
          actionPlan: {
            shortTerm: bucket("", "2026-09-01 ~ 2026-12-01", "2026-12-01"),
            midTerm: bucket(""),
            longTerm: bucket(""),
          },
        },
      }),
    );
    render(<IndividualAnalysisDetailPage />);

    await screen.findByRole("heading", { name: "이력 분석" });
    expect(screen.queryByRole("heading", { name: "액션 플랜" })).not.toBeInTheDocument();
    expect(screen.queryByText("마감 2026-12-01")).not.toBeInTheDocument();
  });

  it("STAR 가 비어도 사유가 오면 이유를 보여준다", async () => {
    getResult.mockResolvedValue(
      result({
        result: { ...emptyBody(), starNote: "기간과 성과 수치가 없어 STAR 로 정리하기 어려워요." },
      }),
    );
    render(<IndividualAnalysisDetailPage />);

    expect(
      await screen.findByText("기간과 성과 수치가 없어 STAR 로 정리하기 어려워요."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "STAR 정리" })).toBeInTheDocument();
  });

  // 사유도 없이 비었으면 종전대로 접는다 — 빈 카드를 만들지 않는다.
  it("STAR 도 사유도 없으면 섹션을 접는다", async () => {
    getResult.mockResolvedValue(result({ result: emptyBody() }));
    render(<IndividualAnalysisDetailPage />);

    await screen.findByRole("heading", { name: "이력 분석" });
    expect(screen.queryByRole("heading", { name: "STAR 정리" })).not.toBeInTheDocument();
  });

  it("검증에서 걸러낸 추천이 있으면 개수를 알리되 이름은 적지 않는다", async () => {
    getResult.mockResolvedValue(
      result({
        result: {
          ...emptyBody(),
          synergyRecommendations: [
            {
              priority: "high",
              category: "자격증",
              name: "ADsP",
              reason: "",
              expectedEffect: "",
              estimatedDuration: "",
            },
          ],
          removedRecommendations: [
            { name: "사회분석사", category: "자격증", removedReason: "실재하지 않는 자격증명" },
          ],
        },
      }),
    );
    render(<IndividualAnalysisDetailPage />);

    expect(
      await screen.findByText("실재 여부를 확인하지 못한 추천 1건은 빼고 보여드려요."),
    ).toBeInTheDocument();
    // 환각 자격증명을 추천 자리에 되살리지 않는다.
    expect(screen.queryByText("사회분석사")).not.toBeInTheDocument();
  });
});
