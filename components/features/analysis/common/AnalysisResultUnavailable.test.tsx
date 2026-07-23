import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import AnalysisResultUnavailable from "./AnalysisResultUnavailable";

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup);

describe("AnalysisResultUnavailable 상태별 안내 (FRT-134)", () => {
  it("진행 중이면 실패로 단정하지 않고 기다리면 된다고 알린다", () => {
    render(
      <AnalysisResultUnavailable
        status="processing"
        basePath=""
        fallbackHref="/analysis/individual"
        analysisId="ind-1"
      />,
    );
    expect(screen.getByText("분석이 아직 진행 중이에요")).toBeInTheDocument();
    expect(screen.queryByText("분석에 실패했습니다")).not.toBeInTheDocument();
  });

  it("pending 도 진행 중으로 묶는다 — 사용자에겐 같은 상황이다", () => {
    render(
      <AnalysisResultUnavailable
        status="pending"
        basePath=""
        fallbackHref="/analysis/individual"
        analysisId="ind-1"
      />,
    );
    expect(screen.getByText("분석이 아직 진행 중이에요")).toBeInTheDocument();
  });

  it("실패면 목록과 같은 문구로 실패를 알린다", () => {
    render(
      <AnalysisResultUnavailable
        status="failed"
        basePath=""
        fallbackHref="/analysis/comprehensive"
        analysisId="comp-1"
        analysisType="comprehensive"
      />,
    );
    expect(screen.getByText("분석에 실패했습니다")).toBeInTheDocument();
  });

  it("재시도 버튼이 없으면 '다시 시도'를 약속하지 않는다 — 없는 행동을 가리키면 안 된다", () => {
    render(
      <AnalysisResultUnavailable
        status="failed"
        basePath=""
        fallbackHref="/analysis/comprehensive"
        analysisId="comp-1"
        analysisType="comprehensive"
        // canRetry 미지정(플래그 off) → 버튼 없음
      />,
    );
    expect(
      screen.getByText("결과를 만들지 못했어요. 목록에서 다시 분석을 요청할 수 있어요."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/다시 시도하면 같은 조합으로 새로 분석합니다/),
    ).not.toBeInTheDocument();
  });

  it("재시도 버튼이 뜰 때만 '다시 시도하면 새로 분석' 문구를 쓴다", () => {
    render(
      <AnalysisResultUnavailable
        status="failed"
        basePath=""
        fallbackHref="/analysis/comprehensive"
        analysisId="comp-1"
        analysisType="comprehensive"
        canRetry
      />,
    );
    expect(
      screen.getByText("결과를 만들지 못했어요. 다시 시도하면 같은 조합으로 새로 분석합니다."),
    ).toBeInTheDocument();
  });

  it("completed 인데 본문이 없으면 진행 중도 실패도 아닌 이상 상태로 안내한다", () => {
    render(
      <AnalysisResultUnavailable
        status="completed"
        basePath=""
        fallbackHref="/analysis/keyword"
        analysisId="kw-1"
      />,
    );
    expect(screen.getByText("결과를 표시할 수 없습니다")).toBeInTheDocument();
  });

  it("일반 모드는 유형별 목록(fallbackHref)으로 돌아간다", () => {
    render(
      <AnalysisResultUnavailable
        status="processing"
        basePath=""
        fallbackHref="/analysis/comprehensive"
        analysisId="comp-1"
      />,
    );
    expect(screen.getByRole("link", { name: "목록으로 돌아가기" })).toHaveAttribute(
      "href",
      "/analysis/comprehensive",
    );
  });

  it("데모 모드는 유형별 목록 라우트가 없어 /demo/analysis 허브로 보낸다 — 404 회피", () => {
    // app/demo/analysis 아래엔 [analysisId] 만 있고 individual/comprehensive/keyword
    // 목록 라우트가 없다. fallbackHref 를 그대로 붙이면 /demo/analysis/comprehensive → 404.
    render(
      <AnalysisResultUnavailable
        status="processing"
        basePath="/demo"
        fallbackHref="/analysis/comprehensive"
        analysisId="comp-1"
      />,
    );
    expect(screen.getByRole("link", { name: "목록으로 돌아가기" })).toHaveAttribute(
      "href",
      "/demo/analysis",
    );
  });
});

describe("AnalysisResultUnavailable 재시도 노출 게이팅 (FRT-134)", () => {
  it("실패 + canRetry 면 다시 시도할 수 있다", () => {
    render(
      <AnalysisResultUnavailable
        status="failed"
        basePath=""
        fallbackHref="/analysis/comprehensive"
        analysisId="comp-1"
        analysisType="comprehensive"
        canRetry
      />,
    );
    expect(screen.getByRole("button", { name: /다시 시도/ })).toBeInTheDocument();
  });

  it("canRetry 가 꺼져 있으면 버튼이 없다 — 플래그 판단은 호출부 몫이다", () => {
    render(
      <AnalysisResultUnavailable
        status="failed"
        basePath=""
        fallbackHref="/analysis/comprehensive"
        analysisId="comp-1"
        analysisType="comprehensive"
      />,
    );
    expect(screen.queryByRole("button", { name: /다시 시도/ })).not.toBeInTheDocument();
  });

  it("analysisType 이 없으면(개별 분석) 재시도를 노출하지 않는다 — 재시도 API 자체가 없다", () => {
    render(
      <AnalysisResultUnavailable
        status="failed"
        basePath=""
        fallbackHref="/analysis/individual"
        analysisId="ind-1"
        canRetry
      />,
    );
    expect(screen.queryByRole("button", { name: /다시 시도/ })).not.toBeInTheDocument();
  });

  it("진행 중에는 재시도를 노출하지 않는다 — 아직 실패한 게 아니다", () => {
    render(
      <AnalysisResultUnavailable
        status="processing"
        basePath=""
        fallbackHref="/analysis/keyword"
        analysisId="kw-1"
        analysisType="keyword"
        canRetry
      />,
    );
    expect(screen.queryByRole("button", { name: /다시 시도/ })).not.toBeInTheDocument();
  });
});
