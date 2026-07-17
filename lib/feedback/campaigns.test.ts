import { describe, expect, it } from "vitest";

import {
  FEEDBACK_CAMPAIGNS,
  FEEDBACK_COMMENT_MAX_LENGTH,
  feedbackCampaign,
  placeholderFor,
  questionCopyFor,
} from "./campaigns";
import type { FeedbackRating } from "./types";

const allCampaigns = Object.values(FEEDBACK_CAMPAIGNS);

describe("FEEDBACK_CAMPAIGNS (정본 집합)", () => {
  // 계약 정본(docs/feedback-campaign-contract.md)이 "v1 은 캠페인 하나"로 못박았다.
  // 캠페인이나 트리거가 늘면 서버 계약·문서도 함께 바뀌어야 하므로 여기서 잠근다.
  it("v1 은 analysis-satisfaction 캠페인 하나뿐이다", () => {
    expect(Object.keys(FEEDBACK_CAMPAIGNS)).toEqual(["analysis-satisfaction"]);
  });

  it("analysis-satisfaction 의 게이트는 정확히 둘이다", () => {
    expect(feedbackCampaign("analysis-satisfaction").triggers).toEqual([
      "analysis_completed",
      "experience_threshold",
    ]);
  });

  it("자유텍스트 상한이 서버와 합의한 500자다", () => {
    expect(FEEDBACK_COMMENT_MAX_LENGTH).toBe(500);
  });
});

describe("feedbackCampaign", () => {
  it("id 로 캠페인을 찾는다", () => {
    expect(feedbackCampaign("analysis-satisfaction").id).toBe(
      "analysis-satisfaction",
    );
  });

  it("등록된 모든 캠페인이 자기 id 로 조회된다", () => {
    for (const campaign of allCampaigns) {
      expect(feedbackCampaign(campaign.id)).toBe(campaign);
    }
  });
});

describe("questionCopyFor", () => {
  const campaign = feedbackCampaign("analysis-satisfaction");

  it("트리거마다 다른 문구를 준다", () => {
    expect(questionCopyFor(campaign, "analysis_completed")).not.toBe(
      questionCopyFor(campaign, "experience_threshold"),
    );
  });

  it("경험 3개 도달로 뜬 경우 분석을 언급하지 않는다", () => {
    // 이 캠페인은 게이트가 둘인데 문구는 하나였다. 경험 3개로 뜬 사용자는 분석을 한
    // 적이 없으므로 "방금 이 분석"을 물으면 말이 되지 않는다 — 그 회귀를 막는다.
    expect(questionCopyFor(campaign, "experience_threshold")).not.toContain(
      "분석",
    );
  });

  it("분석 완료로 뜬 경우 분석을 언급한다", () => {
    expect(questionCopyFor(campaign, "analysis_completed")).toContain("분석");
  });

  it("캠페인이 선언한 모든 트리거에 대해 빈 문구가 없다", () => {
    for (const c of allCampaigns) {
      for (const trigger of c.triggers) {
        expect(questionCopyFor(c, trigger).trim()).not.toBe("");
      }
    }
  });
});

describe("placeholderFor", () => {
  const campaign = feedbackCampaign("analysis-satisfaction");

  it("highScoreMin 이상이면 high 문구를 준다", () => {
    expect(placeholderFor(campaign, campaign.highScoreMin)).toBe(
      campaign.placeholder.high,
    );
    expect(placeholderFor(campaign, 5)).toBe(campaign.placeholder.high);
  });

  it("highScoreMin 미만이면 low 문구를 준다", () => {
    const below = (campaign.highScoreMin - 1) as FeedbackRating;
    expect(placeholderFor(campaign, below)).toBe(campaign.placeholder.low);
    expect(placeholderFor(campaign, 1)).toBe(campaign.placeholder.low);
  });

  it("경계값에서 갈린다(3 → low, 4 → high)", () => {
    expect(placeholderFor(campaign, 3)).toBe(campaign.placeholder.low);
    expect(placeholderFor(campaign, 4)).toBe(campaign.placeholder.high);
  });
});
