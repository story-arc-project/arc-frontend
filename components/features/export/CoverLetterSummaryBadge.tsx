"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface CoverLetterSummaryBadgeProps {
  /** `meta.all_grounded` 또는 answers 파생값(types/cover-letter isAllGrounded). */
  allGrounded: boolean;
  /** 문항 중 하나라도 경고가 있는지. */
  hasWarning: boolean;
}

/**
 * 자소서 전체의 근거 상태 한 줄 요약.
 *
 * 세 상태를 구분한다 — "확인됨" / "확인 필요" / **"확인하지 못함"**. 마지막이 중요하다:
 * 검증 결과를 읽지 못했을 때(meta 부재 + 판단 근거 없음) 이를 "확인됨"으로 보여주면
 * 근거 없는 초안이 안전해 보인다. 모르면 모른다고 말한다.
 */
export function CoverLetterSummaryBadge({
  allGrounded,
  hasWarning,
}: CoverLetterSummaryBadgeProps) {
  if (allGrounded) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-caption font-medium text-success">
        <CheckCircle2 size={13} aria-hidden="true" />내 기록으로 확인된 초안이에요
      </span>
    );
  }

  if (hasWarning) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-error/10 px-2.5 py-1 text-caption font-medium text-error">
        <AlertTriangle size={13} aria-hidden="true" />제출 전 사실 확인이 필요해요
      </span>
    );
  }

  // 경고도 없고 통과도 아니다 = 판단할 근거 자체가 없다(문항 0개·검증 정보 부재).
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-tertiary px-2.5 py-1 text-caption font-medium text-text-secondary">
      <AlertTriangle size={13} aria-hidden="true" />근거를 확인하지 못했어요
    </span>
  );
}
