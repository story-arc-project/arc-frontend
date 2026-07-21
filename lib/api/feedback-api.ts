// FRT-92: 인앱 피드백 서버 계약의 HTTP 클라이언트.
//
// 계약 정본은 docs/feedback-campaign-contract.md. 서버는 세 엔드포인트를 전부
// { status, message, data } 로 래핑하고 필드는 순수 snake_case 로 보낸다 — 이 파일이
// 그 경계에서 snake→camel 로 옮기고, PII 화이트리스트를 강제한다.
//
// 실패 경계: HTTP 실패(네트워크·4xx·5xx)는 그대로 throw 해 전파한다(export-api.ts 패턴).
// .claude/rules/api.md 의 "방어 파싱"은 *성공 응답의 형태 이상*에만 적용된다 — 실패 자체를
// 삼키면 호출부(FRT-93 훅)가 "장애(재시도해야 함)" 와 "이미 봤음(재시도 무의미)" 를 구분할 수
// 없어진다. 삼키는 책임은 transport.ts(및 FRT-93)에 있고, 이 계층은 항상 "성공이면 파싱값,
// 실패면 throw" 하나의 규칙만 지킨다.

import { api } from "./client";
import { isDemoMode } from "@/lib/demo/state";
import type {
  FeedbackCampaignId,
  FeedbackContext,
  FeedbackRating,
  FeedbackStatus,
  FeedbackTriggerSource,
} from "@/lib/feedback/types";
import type { ApiSuccessResponse } from "@/types/api";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object"
    ? (value as UnknownRecord)
    : {};
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

// PII 화이트리스트 — analysis_id / analysis_type 만 서버로 보낸다. 그 외 키(자유 확장으로
// 새는 이메일 등)는 여기서 버린다. 의미있는 값이 하나도 없으면 빈 객체가 아니라 null 을 보내
// 서버가 "컨텍스트 없음" 을 일관되게 해석하게 한다.
function toContextPayload(
  context: FeedbackContext | undefined,
): { analysis_id?: string; analysis_type?: "comprehensive" | "keyword" } | null {
  if (!context) return null;
  const out: {
    analysis_id?: string;
    analysis_type?: "comprehensive" | "keyword";
  } = {};
  if (typeof context.analysisId === "string" && context.analysisId) {
    out.analysis_id = context.analysisId;
  }
  if (
    context.analysisType === "comprehensive" ||
    context.analysisType === "keyword"
  ) {
    out.analysis_type = context.analysisType;
  }
  return Object.keys(out).length > 0 ? out : null;
}

// 노출 기록(dedup 의 핵심). created=true 면 이번에 노출 행이 생겼다는 뜻이라 호출부가 모달을
// 띄운다. created=false 는 이미 노출된 적 있음 — 서버가 ON CONFLICT DO NOTHING 으로 원자 판정한다.
export async function markFeedbackPromptShown(
  campaignId: FeedbackCampaignId,
  triggerSource: FeedbackTriggerSource,
): Promise<{ created: boolean }> {
  if (isDemoMode()) return { created: false };
  const res = await api.post<ApiSuccessResponse<unknown>>(
    `/feedback/campaigns/${campaignId}/prompt-shown`,
    { trigger_source: triggerSource },
  );
  return { created: asBoolean(asRecord(res.data).created) };
}

// 응답 저장. comment 는 미제공이어도 키를 누락하지 않고 null 을 명시 전송한다(서버 스키마가
// str | None). comment 길이 절단은 여기서 하지 않는다 — 입력 단계(FRT-94)가 코드포인트로
// 막고, 서버 422 가 백스톱이다.
export async function submitFeedbackResponse(payload: {
  campaignId: FeedbackCampaignId;
  rating: FeedbackRating;
  comment?: string;
  context?: FeedbackContext;
}): Promise<{ respondedAt: string }> {
  if (isDemoMode()) return { respondedAt: "" };
  const res = await api.post<ApiSuccessResponse<unknown>>(
    `/feedback/campaigns/${payload.campaignId}/responses`,
    {
      rating: payload.rating,
      comment: payload.comment ?? null,
      context: toContextPayload(payload.context),
    },
  );
  return { respondedAt: asString(asRecord(res.data).responded_at) };
}

// 상태 조회(관리·집계용). ⚠️ 노출 판정에 쓰지 않는다 — 판정은 markFeedbackPromptShown 의
// created 가 원자적으로 내린다(계약 정본 §3). 여기로 게이팅하면 SELECT-후-INSERT 레이스가 돈다.
export async function fetchFeedbackStatus(
  campaignId: FeedbackCampaignId,
): Promise<FeedbackStatus> {
  if (isDemoMode()) return { hasSeen: false, hasResponded: false };
  const res = await api.get<ApiSuccessResponse<unknown>>(
    `/feedback/campaigns/${campaignId}/status`,
  );
  const data = asRecord(res.data);
  return {
    hasSeen: asBoolean(data.has_seen),
    hasResponded: asBoolean(data.has_responded),
  };
}
