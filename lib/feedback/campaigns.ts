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
 * 자유텍스트 최대 길이. 계약 정본(docs/feedback-campaign-contract.md)이 못박은 값이며
 * 서버도 같은 한도를 강제한다 — 양쪽이 다른 경계를 구현하면 한쪽이 받은 값을 다른 쪽이
 * 거절한다. 변경 시 이 상수·문서·서버를 함께 고친다.
 *
 * **단위는 유니코드 코드 포인트다.** 서버(Python `len`)가 코드 포인트로 세므로 프론트도
 * `.length`(UTF-16 code unit)가 아니라 `[...comment].length` 로 세야 경계가 일치한다 —
 * `"😀".length` 는 2, `[..."😀"].length` 는 1이라 이모지가 섞이면 양쪽이 다른 지점에서 자른다.
 */
export const FEEDBACK_COMMENT_MAX_LENGTH = 500;

/**
 * `experience_threshold` 게이트가 열리는 경험 개수(이상). 문구·점수 경계와 마찬가지로
 * 트리거 경계도 훅(FRT-93)이 아니라 이 config 파일에 둔다 — 노출 조건을 바꿀 때 코드가
 * 아니라 여기만 본다.
 */
export const FEEDBACK_EXPERIENCE_THRESHOLD = 3;

/**
 * v1 은 캠페인 하나. 게이트는 둘(분석 완료 · 경험 3개 도달)이고 먼저 오는 것에 1회만
 * 뜬다(FRT-93). 캠페인을 쪼개지 않고 문구만 갈라, 서버 계약(unique(user_id, campaign_id))과
 * "사용자는 1회만 본다"는 결정을 함께 지킨다.
 *
 * 배열이 아니라 Record 로 두는 이유: 키가 FeedbackCampaignId 로 고정돼 있어 유니온에
 * id 를 추가하면 config 를 채우기 전까지 컴파일이 막힌다. 배열 + `satisfies` 는 "config 의
 * id 가 유니온에 속하는지"만 보고 역방향은 보지 않아, 조회 시 undefined 가 샐 수 있다.
 */
export const FEEDBACK_CAMPAIGNS = {
  "analysis-satisfaction": {
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
} as const satisfies Record<FeedbackCampaignId, FeedbackCampaign>;

/** id 로 캠페인을 조회한다. 키가 exhaustive 하게 강제되므로 undefined 가 나올 수 없다. */
export function feedbackCampaign(id: FeedbackCampaignId): FeedbackCampaign {
  return FEEDBACK_CAMPAIGNS[id];
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
