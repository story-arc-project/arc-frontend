import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/api/analysis-api", () => ({
  retryComprehensiveAnalysis: vi.fn(),
  retryKeywordAnalysis: vi.fn(),
}));

vi.mock("@/lib/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...actual, capture: vi.fn() };
});

import { retryComprehensiveAnalysis, retryKeywordAnalysis } from "@/lib/api/analysis-api";
import { ANALYTICS_EVENTS, capture } from "@/lib/analytics";

import RetryAnalysisButton from "./RetryAnalysisButton";

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup);

const retryComprehensive = vi.mocked(retryComprehensiveAnalysis);
const retryKeyword = vi.mocked(retryKeywordAnalysis);
const captureMock = vi.mocked(capture);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RetryAnalysisButton (FRT-108)", () => {
  it("분석 유형에 맞는 재시도 API 를 호출하고 부모에 통지한다", async () => {
    retryComprehensive.mockResolvedValue(undefined);
    const onRetried = vi.fn();
    render(
      <RetryAnalysisButton
        analysisId="comp-1"
        analysisType="comprehensive"
        onRetried={onRetried}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() => expect(onRetried).toHaveBeenCalledTimes(1));
    expect(retryComprehensive).toHaveBeenCalledWith("comp-1");
    expect(retryKeyword).not.toHaveBeenCalled();
  });

  it("키워드 유형은 키워드 재시도 API 로 간다", async () => {
    retryKeyword.mockResolvedValue(undefined);
    render(
      <RetryAnalysisButton analysisId="kw-1" analysisType="keyword" onRetried={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() => expect(retryKeyword).toHaveBeenCalledWith("kw-1"));
    expect(retryComprehensive).not.toHaveBeenCalled();
  });

  it("성공했을 때만 재시도 이벤트를 남긴다", async () => {
    retryComprehensive.mockRejectedValue(new Error("409"));
    render(
      <RetryAnalysisButton
        analysisId="comp-1"
        analysisType="comprehensive"
        onRetried={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    await screen.findByRole("alert");
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("성공 시 analysis_retried 를 analysis_type 과 함께 남긴다", async () => {
    retryKeyword.mockResolvedValue(undefined);
    render(
      <RetryAnalysisButton analysisId="kw-1" analysisType="keyword" onRetried={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() =>
      expect(captureMock).toHaveBeenCalledWith(ANALYTICS_EVENTS.analysisRetried, {
        analysis_type: "keyword",
      }),
    );
  });

  it("요청이 실패하면 안내를 띄우고 다시 누를 수 있게 둔다 (부모 통지 없음)", async () => {
    retryComprehensive.mockRejectedValue(new Error("500"));
    const onRetried = vi.fn();
    render(
      <RetryAnalysisButton
        analysisId="comp-1"
        analysisType="comprehensive"
        onRetried={onRetried}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onRetried).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeEnabled();
  });

  it("요청 중에는 버튼을 잠가 중복 요청을 막는다", async () => {
    let resolve: (() => void) | undefined;
    retryComprehensive.mockImplementation(
      () => new Promise<void>((r) => { resolve = () => r(); }),
    );
    render(
      <RetryAnalysisButton
        analysisId="comp-1"
        analysisType="comprehensive"
        onRetried={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    const busyButton = await screen.findByRole("button", { name: "요청 중…" });
    expect(busyButton).toBeDisabled();

    resolve?.();
    await waitFor(() => expect(retryComprehensive).toHaveBeenCalledTimes(1));
  });
});
