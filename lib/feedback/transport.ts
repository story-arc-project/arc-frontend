// FRT-92: 피드백 전송 레이어.
//
// 피드백 응답을 한 인터페이스 뒤에서 PostHog(흐름 분석)와 서버(영구 저장·dedup)로 동시에
// 보낸다. 백엔드 계약이 바뀌어도 소비 측(FRT-93 훅·FRT-94 모달)은 이 레이어 뒤에서 그대로다.
//
// fire-and-forget: 전송이 실패해도 throw 로 UI 를 막지 않는다. 서버 엔드포인트가 아직 없어도
// (arc-backend@dev 에 feedback 코드 0줄) PostHog capture 만으로 동작한다 — 삼키는 책임은 여기
// 있고, 그 아래 lib/api/feedback-api.ts 는 실패를 정직하게 throw 한다.
//
// PII: PostHog 에는 comment 원문·analysis_id 를 절대 싣지 않는다(계약 정본 §PII 방어).
// rating·trigger_source 같은 비식별 메타와, "의견을 남겼는지"만 표시하는 has_comment 만 보낸다.
// 원문은 서버(feedback_responses.comment)에만 남는다.
//
// console.error 직접 사용은 허용된다 — lib/feedback/** 는 .claude/rules/api.md(scope lib/api/**)
// 밖이고, 전역 eslint 가 no-console 에 warn/error 를 allow 한다.

import { ANALYTICS_EVENTS, capture } from "@/lib/analytics";
import {
  fetchFeedbackStatus,
  submitFeedbackResponse,
} from "@/lib/api/feedback-api";

import type { FeedbackCampaignId, FeedbackPayload, FeedbackStatus } from "./types";

// PostHog 로 보낼 비식별 메타만 구성한다. comment 원문·analysis_id 는 형태상 아예 넣지 않는다.
function captureFeedbackSubmitted(payload: FeedbackPayload): void {
  try {
    capture(ANALYTICS_EVENTS.feedbackSubmitted, {
      campaign_id: payload.campaignId,
      trigger_source: payload.triggerSource,
      rating: payload.rating,
      has_comment: Boolean(payload.comment?.trim()),
      // analysisType 을 유니온으로 한 번 더 검증한 뒤에만 싣는다 — feedback-api 의 toContextPayload
      // 와 같은 방어(캐스트로 위조된 값이 계약 밖 analysis_type 으로 새지 않게). 양쪽 sink 대칭.
      ...(payload.context?.analysisType === "comprehensive" ||
      payload.context?.analysisType === "keyword"
        ? { analysis_type: payload.context.analysisType }
        : {}),
    });
  } catch (err) {
    console.error("[feedback] posthog capture failed", err);
  }
}

// 사용자가 제출한 응답을 PostHog·서버로 병행 전송한다. 반환 promise 는 절대 reject 하지
// 않는다(유일한 계약) — capture 와 서버 저장은 서로 독립이라 하나가 실패해도 다른 하나는 진행된다.
// capture 는 동기라 먼저 호출하면 자연히 병행되고, 서버 POST 는 await 하되 reject 를 삼킨다
// (테스트 결정성 + FRT-94 가 `void submitFeedback(...)` 로 detach 를 스스로 선택할 수 있게).
export async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  captureFeedbackSubmitted(payload);
  try {
    await submitFeedbackResponse({
      campaignId: payload.campaignId,
      rating: payload.rating,
      comment: payload.comment,
      context: payload.context,
    });
  } catch (err) {
    console.error("[feedback] server submit failed", err);
  }
}

// 관리·집계용 상태 조회. 실패하면 null 을 돌려 호출부가 "알 수 없음" 으로 다루게 한다
// (throw 로 UI 를 막지 않는다). ⚠️ 노출 판정에는 쓰지 않는다 — 그건 markFeedbackPromptShown 이다.
export async function getFeedbackStatus(
  campaignId: FeedbackCampaignId,
): Promise<FeedbackStatus | null> {
  try {
    return await fetchFeedbackStatus(campaignId);
  } catch (err) {
    console.error("[feedback] status fetch failed", err);
    return null;
  }
}
