import { describe, expect, it } from "vitest";

import {
  FEEDBACK_CAMPAIGNS,
  feedbackCampaign,
  placeholderFor,
  questionCopyFor,
} from "./campaigns";
import type { FeedbackRating } from "./types";

describe("feedbackCampaign", () => {
  it("id 로 캠페인을 찾는다(배열 순서 비의존)", () => {
    expect(feedbackCampaign("analysis-satisfaction").id).toBe(
      "analysis-satisfaction",
    );
  });

  it("등록된 모든 캠페인이 자기 id 로 조회된다", () => {
    for (const campaign of FEEDBACK_CAMPAIGNS) {
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
    for (const c of FEEDBACK_CAMPAIGNS) {
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
