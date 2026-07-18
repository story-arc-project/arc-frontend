import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FeedbackContext } from "@/lib/feedback/types";
import type { ApiSuccessResponse } from "@/types/api";

import {
  fetchFeedbackStatus,
  markFeedbackPromptShown,
  submitFeedbackResponse,
} from "./feedback-api";

// api 래퍼와 데모 플래그를 목한다. 실제 fetch 는 타지 않는다.
vi.mock("./client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/lib/demo/state", () => ({ isDemoMode: vi.fn(() => false) }));

import { api } from "./client";
import { isDemoMode } from "@/lib/demo/state";

const mockedPost = vi.mocked(api.post);
const mockedGet = vi.mocked(api.get);
const mockedIsDemo = vi.mocked(isDemoMode);

function ok<T>(data: T): ApiSuccessResponse<T> {
  return { status: "success", message: "ok", data };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedIsDemo.mockReturnValue(false);
});

describe("markFeedbackPromptShown", () => {
  it("trigger_source 를 snake body 로 정확한 경로에 POST 한다", async () => {
    mockedPost.mockResolvedValue(ok({ created: true }));
    await markFeedbackPromptShown("analysis-satisfaction", "experience_threshold");
    expect(mockedPost).toHaveBeenCalledWith(
      "/feedback/campaigns/analysis-satisfaction/prompt-shown",
      { trigger_source: "experience_threshold" },
    );
  });

  it("created=true 를 그대로 반환한다", async () => {
    mockedPost.mockResolvedValue(ok({ created: true }));
    await expect(
      markFeedbackPromptShown("analysis-satisfaction", "analysis_completed"),
    ).resolves.toEqual({ created: true });
  });

  it("created=false 를 그대로 반환한다", async () => {
    mockedPost.mockResolvedValue(ok({ created: false }));
    await expect(
      markFeedbackPromptShown("analysis-satisfaction", "analysis_completed"),
    ).resolves.toEqual({ created: false });
  });

  it("created 가 없거나 boolean 이 아니면 방어적으로 false", async () => {
    mockedPost.mockResolvedValue(ok({ created: "yes" }));
    await expect(
      markFeedbackPromptShown("analysis-satisfaction", "analysis_completed"),
    ).resolves.toEqual({ created: false });
  });

  it("data 자체가 없는 성공 응답이어도 throw 하지 않고 false", async () => {
    mockedPost.mockResolvedValue(ok(undefined));
    await expect(
      markFeedbackPromptShown("analysis-satisfaction", "analysis_completed"),
    ).resolves.toEqual({ created: false });
  });

  it("api 가 던진 실패는 그대로 전파한다(삼키지 않음)", async () => {
    mockedPost.mockRejectedValue(new Error("network down"));
    await expect(
      markFeedbackPromptShown("analysis-satisfaction", "analysis_completed"),
    ).rejects.toThrow("network down");
  });

  it("데모 모드면 네트워크 호출 없이 created:false", async () => {
    mockedIsDemo.mockReturnValue(true);
    await expect(
      markFeedbackPromptShown("analysis-satisfaction", "analysis_completed"),
    ).resolves.toEqual({ created: false });
    expect(mockedPost).not.toHaveBeenCalled();
  });
});

describe("submitFeedbackResponse", () => {
  it("rating/comment/context 를 snake body 로 정확히 POST 한다", async () => {
    mockedPost.mockResolvedValue(ok({ responded_at: "2026-07-18T00:00:00Z" }));
    await submitFeedbackResponse({
      campaignId: "analysis-satisfaction",
      rating: 5,
      comment: "좋아요",
      context: { analysisId: "a-1", analysisType: "comprehensive" },
    });
    expect(mockedPost).toHaveBeenCalledWith(
      "/feedback/campaigns/analysis-satisfaction/responses",
      {
        rating: 5,
        comment: "좋아요",
        context: { analysis_id: "a-1", analysis_type: "comprehensive" },
      },
    );
  });

  it("comment 미제공이면 body 에 comment:null 을 명시 전송한다", async () => {
    mockedPost.mockResolvedValue(ok({ responded_at: "t" }));
    await submitFeedbackResponse({ campaignId: "analysis-satisfaction", rating: 3 });
    const body = mockedPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body.comment).toBeNull();
  });

  it("context 화이트리스트: 여분 키는 서버로 새지 않는다", async () => {
    mockedPost.mockResolvedValue(ok({ responded_at: "t" }));
    // TS 를 우회해 여분 키를 심어도 버려져야 한다(런타임 방어).
    const leaky = {
      analysisId: "a-1",
      analysisType: "keyword",
      email: "leak@x.com",
    } as unknown as FeedbackContext;
    await submitFeedbackResponse({
      campaignId: "analysis-satisfaction",
      rating: 4,
      context: leaky,
    });
    const body = mockedPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body.context).toEqual({ analysis_id: "a-1", analysis_type: "keyword" });
  });

  it("위조된 analysisType(유니온 밖)은 버려진다", async () => {
    mockedPost.mockResolvedValue(ok({ responded_at: "t" }));
    const bad = { analysisType: "individual" } as unknown as FeedbackContext;
    await submitFeedbackResponse({
      campaignId: "analysis-satisfaction",
      rating: 4,
      context: bad,
    });
    const body = mockedPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body.context).toBeNull();
  });

  it("context 미제공이면 context:null", async () => {
    mockedPost.mockResolvedValue(ok({ responded_at: "t" }));
    await submitFeedbackResponse({ campaignId: "analysis-satisfaction", rating: 2 });
    const body = mockedPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body.context).toBeNull();
  });

  it("화이트리스트 키가 전부 비면 빈 객체가 아니라 null", async () => {
    mockedPost.mockResolvedValue(ok({ responded_at: "t" }));
    await submitFeedbackResponse({
      campaignId: "analysis-satisfaction",
      rating: 2,
      context: {},
    });
    const body = mockedPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body.context).toBeNull();
  });

  it("responded_at → respondedAt 로 매핑한다", async () => {
    mockedPost.mockResolvedValue(ok({ responded_at: "2026-07-18T06:12:00Z" }));
    await expect(
      submitFeedbackResponse({ campaignId: "analysis-satisfaction", rating: 5 }),
    ).resolves.toEqual({ respondedAt: "2026-07-18T06:12:00Z" });
  });

  it("검증 실패(422)를 그대로 전파한다", async () => {
    mockedPost.mockRejectedValue(new Error("422"));
    await expect(
      submitFeedbackResponse({ campaignId: "analysis-satisfaction", rating: 5 }),
    ).rejects.toThrow("422");
  });

  it("서버 장애(500)도 그대로 전파한다", async () => {
    mockedPost.mockRejectedValue(new Error("500"));
    await expect(
      submitFeedbackResponse({ campaignId: "analysis-satisfaction", rating: 5 }),
    ).rejects.toThrow("500");
  });

  it("데모 모드면 실제 POST 없이 respondedAt 을 반환한다", async () => {
    mockedIsDemo.mockReturnValue(true);
    await expect(
      submitFeedbackResponse({ campaignId: "analysis-satisfaction", rating: 5 }),
    ).resolves.toEqual({ respondedAt: "" });
    expect(mockedPost).not.toHaveBeenCalled();
  });
});

describe("fetchFeedbackStatus", () => {
  it("has_seen/has_responded → camel 로 매핑한다", async () => {
    mockedGet.mockResolvedValue(ok({ has_seen: true, has_responded: false }));
    await expect(fetchFeedbackStatus("analysis-satisfaction")).resolves.toEqual({
      hasSeen: true,
      hasResponded: false,
    });
  });

  it("값이 boolean 이 아니면 방어적으로 false", async () => {
    mockedGet.mockResolvedValue(ok({ has_seen: 1, has_responded: null }));
    await expect(fetchFeedbackStatus("analysis-satisfaction")).resolves.toEqual({
      hasSeen: false,
      hasResponded: false,
    });
  });

  it("404(엔드포인트 미구현)를 그대로 던진다 — 여기선 삼키지 않는다", async () => {
    mockedGet.mockRejectedValue(new Error("404"));
    await expect(fetchFeedbackStatus("analysis-satisfaction")).rejects.toThrow("404");
  });

  it("데모 모드면 API 호출 없이 기본값", async () => {
    mockedIsDemo.mockReturnValue(true);
    await expect(fetchFeedbackStatus("analysis-satisfaction")).resolves.toEqual({
      hasSeen: false,
      hasResponded: false,
    });
    expect(mockedGet).not.toHaveBeenCalled();
  });
});
