import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FeedbackPayload } from "./types";

vi.mock("@/lib/analytics", () => ({
  capture: vi.fn(),
  ANALYTICS_EVENTS: { feedbackSubmitted: "feedback_submitted" },
}));
vi.mock("@/lib/api/feedback-api", () => ({
  submitFeedbackResponse: vi.fn(),
  fetchFeedbackStatus: vi.fn(),
}));

import { capture } from "@/lib/analytics";
import { fetchFeedbackStatus, submitFeedbackResponse } from "@/lib/api/feedback-api";

import { getFeedbackStatus, submitFeedback } from "./transport";

const mockedCapture = vi.mocked(capture);
const mockedSubmit = vi.mocked(submitFeedbackResponse);
const mockedFetchStatus = vi.mocked(fetchFeedbackStatus);

function payload(overrides: Partial<FeedbackPayload> = {}): FeedbackPayload {
  return {
    campaignId: "analysis-satisfaction",
    triggerSource: "analysis_completed",
    rating: 5,
    ...overrides,
  };
}

// capture 의 두 번째 인자(props)를 꺼낸다.
function capturedProps(): Record<string, unknown> {
  return mockedCapture.mock.calls[0][1] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSubmit.mockResolvedValue({ respondedAt: "t" });
  mockedFetchStatus.mockResolvedValue({ hasSeen: false, hasResponded: false });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("submitFeedback", () => {
  it("feedback_submitted 이벤트로 비식별 메타를 capture 한다", async () => {
    await submitFeedback(
      payload({ rating: 4, triggerSource: "experience_threshold" }),
    );
    expect(mockedCapture).toHaveBeenCalledWith("feedback_submitted", {
      campaign_id: "analysis-satisfaction",
      trigger_source: "experience_threshold",
      rating: 4,
      has_comment: false,
    });
  });

  it("comment 원문은 capture props 에 절대 실리지 않는다(PII 회귀 가드)", async () => {
    await submitFeedback(payload({ comment: "제 이메일은 x@y.com 입니다" }));
    const props = capturedProps();
    expect("comment" in props).toBe(false);
    expect(props.has_comment).toBe(true);
  });

  it("공백만 있는 comment 는 has_comment:false", async () => {
    await submitFeedback(payload({ comment: "   " }));
    expect(capturedProps().has_comment).toBe(false);
  });

  it("comment 미제공이면 has_comment:false", async () => {
    await submitFeedback(payload());
    expect(capturedProps().has_comment).toBe(false);
  });

  it("context.analysisType 가 있으면 analysis_type 을 포함한다", async () => {
    await submitFeedback(
      payload({ context: { analysisId: "a-1", analysisType: "keyword" } }),
    );
    expect(capturedProps().analysis_type).toBe("keyword");
  });

  it("context 가 없으면 analysis_type 키 자체를 넣지 않는다", async () => {
    await submitFeedback(payload());
    expect("analysis_type" in capturedProps()).toBe(false);
  });

  it("analysis_id 는 어떤 경우에도 capture props 에 실리지 않는다", async () => {
    await submitFeedback(
      payload({ context: { analysisId: "a-1", analysisType: "comprehensive" } }),
    );
    expect("analysis_id" in capturedProps()).toBe(false);
  });

  it("서버에는 comment/context 를 원본 그대로 넘긴다(재구현하지 않는다)", async () => {
    const p = payload({
      comment: "좋았어요",
      context: { analysisId: "a-1", analysisType: "comprehensive" },
    });
    await submitFeedback(p);
    expect(mockedSubmit).toHaveBeenCalledWith({
      campaignId: "analysis-satisfaction",
      rating: 5,
      comment: "좋았어요",
      context: { analysisId: "a-1", analysisType: "comprehensive" },
    });
  });

  it("서버 저장이 성공하면 resolve 한다", async () => {
    await expect(submitFeedback(payload())).resolves.toBeUndefined();
  });

  it("서버가 500 으로 reject 해도 submitFeedback 은 reject 하지 않는다(fire-and-forget)", async () => {
    mockedSubmit.mockRejectedValue(new Error("500"));
    await expect(submitFeedback(payload())).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("서버가 404(엔드포인트 부재)로 reject 해도 UI 를 막지 않는다", async () => {
    mockedSubmit.mockRejectedValue(new Error("404"));
    await expect(submitFeedback(payload())).resolves.toBeUndefined();
  });

  it("capture 가 동기적으로 throw 해도 서버 호출은 진행되고 resolve 한다(독립성)", async () => {
    mockedCapture.mockImplementation(() => {
      throw new Error("posthog boom");
    });
    await expect(submitFeedback(payload())).resolves.toBeUndefined();
    expect(mockedSubmit).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();
  });
});

describe("getFeedbackStatus", () => {
  it("성공 시 상태를 그대로 반환한다", async () => {
    mockedFetchStatus.mockResolvedValue({ hasSeen: true, hasResponded: true });
    await expect(getFeedbackStatus("analysis-satisfaction")).resolves.toEqual({
      hasSeen: true,
      hasResponded: true,
    });
  });

  it("fetch 가 reject 하면 null 을 반환한다(throw 하지 않음)", async () => {
    mockedFetchStatus.mockRejectedValue(new Error("404"));
    await expect(getFeedbackStatus("analysis-satisfaction")).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
