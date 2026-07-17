// FRT-91: 피드백 캠페인 config (단일 출처).
//
// 새 피드백 순간을 추가할 때는 코드가 아니라 이 배열만 늘린다. 문구·트리거·점수 경계를
// 컴포넌트에 하드코딩하지 않는다. 캠페인 id 를 늘릴 때는 types.ts 의 FeedbackCampaignId
// 유니온도 함께 넓혀야 하며, 그때까지는 아래 `satisfies` 가 컴파일을 막는다.

import type {
  FeedbackCampaign,
  FeedbackCampaignId,
  FeedbackRating,
  FeedbackTriggerSource,
} from "./types";

/**
 * v1 은 캠페인 하나. 게이트는 둘(분석 완료 · 경험 3개 도달)이고 먼저 오는 것에 1회만
 * 뜬다(FRT-93). 캠페인을 쪼개지 않고 문구만 갈라, 서버 계약(unique(user_id, campaign_id))과
 * "사용자는 1회만 본다"는 결정을 함께 지킨다.
 */
export const FEEDBACK_CAMPAIGNS = [
  {
    id: "analysis-satisfaction",
    triggers: ["analysis_completed", "experience_threshold"],
    questionCopy: {
      analysis_completed: "방금 이 분석, 도움이 됐나요?",
      experience_threshold: "ARC에 기록해 보니 어떠셨나요?",
    },
    placeholder: {
      high: "가장 좋았던 점이 있다면?",
      low: "무엇이 더 있으면 좋을까요?",
    },
    highScoreMin: 4,
  },
] as const satisfies readonly FeedbackCampaign[];

/** id 로 캠페인을 조회한다(배열 순서 비의존). */
export function feedbackCampaign(id: FeedbackCampaignId): FeedbackCampaign {
  return FEEDBACK_CAMPAIGNS.find((c) => c.id === id)!;
}

/** 모달을 띄운 게이트에 맞는 질문 문구를 고른다. */
export function questionCopyFor(
  campaign: FeedbackCampaign,
  trigger: FeedbackTriggerSource,
): string {
  return campaign.questionCopy[trigger];
}

/** 점수에 맞는 자유텍스트 placeholder 를 고른다(텍스트 자체는 점수와 무관하게 항상 열린다). */
export function placeholderFor(
  campaign: FeedbackCampaign,
  rating: FeedbackRating,
): string {
  return rating >= campaign.highScoreMin
    ? campaign.placeholder.high
    : campaign.placeholder.low;
}
