// FRT-91: 인앱 피드백 캠페인의 타입 계약 (단일 출처).
//
// 이후 전송 레이어(FRT-92)·노출 판정 훅(FRT-93)·모달(FRT-94)·배선(FRT-95)이 모두
// 이 타입에 의존한다. 서버 계약의 정본은 docs/feedback-campaign-contract.md 이며,
// 이 파일은 그 계약을 프론트 타입으로 표현한 것이다.

import type { AnalysisKind } from "@/lib/analytics";

/**
 * 모달이 어느 게이트로 떴는지. 서버 `trigger_source` 컬럼과 값이 1:1 대응하므로
 * snake_case 리터럴을 그대로 쓴다(전송 시 변환 없음).
 */
export type FeedbackTriggerSource = "analysis_completed" | "experience_threshold";

/**
 * 캠페인 식별자. campaigns.ts 에서 파생하지 않고 여기에 명시해 순환 참조를 피한다.
 * config 쪽 `as const satisfies` 가 "config 의 id 가 이 유니온에 속하는지"를 컴파일 타임에 검증한다.
 */
export type FeedbackCampaignId = "analysis-satisfaction";

/** 별점 5점 척도. 서버 CHECK (rating BETWEEN 1 AND 5) 와 대응. */
export type FeedbackRating = 1 | 2 | 3 | 4 | 5;

export interface FeedbackCampaign {
  /** 안정적 식별자 — 조회는 배열 순서가 아니라 이 값으로 한다. */
  id: FeedbackCampaignId;
  /** 이 캠페인을 띄울 수 있는 게이트들. 먼저 오는 것 하나에만 반응한다(FRT-93). */
  triggers: readonly FeedbackTriggerSource[];
  /**
   * 트리거별 질문 문구. 캠페인은 하나지만 게이트가 둘이라 문구는 갈린다 —
   * 경험 3개 도달로 뜬 사용자는 분석을 한 적이 없으므로 "방금 이 분석"을 물으면 안 된다.
   */
  questionCopy: Record<FeedbackTriggerSource, string>;
  /** 자유텍스트 placeholder. 점수와 무관하게 항상 열리고, 문구만 적응한다. */
  placeholder: { high: string; low: string };
  /** 이 점수 이상이면 high placeholder 를 쓴다. */
  highScoreMin: FeedbackRating;
}

/**
 * 응답에 함께 싣는 최소 메타. **PII 금지** — 키 화이트리스트로만 확장한다.
 * 자유텍스트(comment)와 함께 이 기능의 유일한 PII 리스크 지점이다.
 */
export interface FeedbackContext {
  analysisId?: string;
  /**
   * 개별(individual) 분석은 프론트에 완료 관측 지점이 없어 AnalysisKind 에서 제외돼 있다
   * (lib/analytics/events.ts). 피드백도 같은 완료 신호를 트리거로 쓰므로 그대로 재사용한다.
   */
  analysisType?: AnalysisKind;
}

/** 사용자가 제출한 응답. 전송 레이어(FRT-92)가 이 값을 PostHog·서버로 보낸다. */
export interface FeedbackPayload {
  campaignId: FeedbackCampaignId;
  triggerSource: FeedbackTriggerSource;
  rating: FeedbackRating;
  /**
   * 자유텍스트. 길이 상한은 FEEDBACK_COMMENT_MAX_LENGTH(campaigns.ts)이며 서버도 같은
   * 값을 강제한다 — 타입으로는 표현할 수 없으므로 입력 단계(FRT-94)에서 막는다.
   */
  comment?: string;
  context?: FeedbackContext;
}

/**
 * 서버가 판단하는 노출·응답 이력(크로스 기기 dedup 의 진실 원천).
 * `hasSeen` 이 dedup 기준 — 응답이 아니라 **노출**을 기록하므로 닫은 사용자에게도 재노출하지 않는다.
 */
export interface FeedbackStatus {
  hasSeen: boolean;
  hasResponded: boolean;
}
