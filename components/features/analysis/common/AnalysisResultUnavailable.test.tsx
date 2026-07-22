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

  it("어느 상태든 목록으로 돌아갈 길이 있다 — basePath 는 유형 경로 앞에 붙는다", () => {
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
      "/demo/analysis/comprehensive",
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
